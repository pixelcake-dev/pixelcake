/**
 * Network Engine — Trace / Ping
 *
 * Follows one packet from a device to an address, the way the network would
 * carry it. Pure and deterministic: same topology in, same verdict out.
 *
 * At every device that handles the packet at layer 3:
 *
 *  1. the device looks the destination up in its routing table (see
 *     ./addressing): a network it is attached to, a static route, or its
 *     default gateway. No entry → 'blocked' ("no route", "no default gateway")
 *  2. a firewall in transit applies its rules, then its zone policy (see
 *     ./firewall)
 *  3. the packet is carried to the next address across switches, VLAN by
 *     VLAN, through whatever port and cable are up (see ./l2 and ./vlan)
 *
 * until the destination answers, something drops the packet, or the packet
 * comes back to a router it already crossed (routing loop).
 *
 * Verdicts: 'error' (an endpoint does not exist or has no usable address),
 * 'unreachable' (no cables join the two devices), 'blocked' (dropped on the
 * way, with the reason and the device), 'success'.
 *
 * Whatever is NOT simulated says so in a note instead of passing silently:
 * a link end not attached to a port, a router without interface addresses
 * (it lets traffic through, nothing is verified), the Internet symbol, NAT.
 */

import type { NetworkDevice, ServiceName } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Topology, TraceResult, PingResult, HopResult } from './types';
import { forwardingRole, isInternetLike } from './topology';
import { interfacePhrase } from './interfaces';
import type { DeviceInterface } from './interfaces';
import {
  formatNetwork,
  hasInterfaceAddresses,
  lookupRoute,
  primaryAddress,
  routingTable,
} from './addressing';
import type { L3Interface, RouteEntry } from './addressing';
import { evaluateFirewall } from './firewall';
import type { Packet } from './firewall';
import { forwardAssumed, physicallyConnected, resolveOnLink } from './l2';
import type { L2Request, L2Result } from './l2';

/** A packet that crosses more layer 3 devices than this is in a loop */
const MAX_ROUTED_HOPS = 64;

/** Options for one trace */
export interface TraceOptions {
  /**
   * The packet is the reply to a flow that was just allowed in the opposite
   * direction (ping reply, HTTP response). Firewalls keep state: they let the
   * return traffic of an allowed flow through even when their policy would
   * deny a NEW flow in that direction.
   */
  returnTraffic?: boolean;
  /** What the packet is, for firewall rules (default: ping) */
  service?: ServiceName;
  /**
   * Address the packet is sent to. Default: the target's primary address
   * (see primaryAddress). Set it to aim at one interface of the target.
   */
  targetIp?: string;
  /**
   * Address the packet comes from, as firewalls see it. Default: the address
   * of the interface the source sends from.
   */
  sourceIp?: string;
}

/** What a device decides to do with a packet */
type Decision =
  | { kind: 'direct'; out: L3Interface; entry: RouteEntry }
  | { kind: 'via'; out: L3Interface; nextHop: string; entry: RouteEntry }
  | { kind: 'assumed'; note: string }
  | { kind: 'blocked'; reason: string };

/** `port 2` / `eth0`; '' for a device-level address */
function outLabel(out: L3Interface): string {
  return out.iface ? out.iface.label : '';
}

function decide(device: NetworkDevice, destinationIp: string): Decision {
  const table = routingTable(device);
  const role = forwardingRole(device);
  const entry = lookupRoute(table, destinationIp, { enabledOnly: true });

  if (!entry) {
    // The only way there leaves from an interface that is down
    const down = lookupRoute(table, destinationIp)?.out;
    if (down?.iface && !down.enabled) {
      return {
        kind: 'blocked',
        reason: `${interfacePhrase(down.iface)} on ${device.label} is disabled`,
      };
    }
  }

  if (entry?.kind === 'connected' && entry.out) return { kind: 'direct', out: entry.out, entry };

  if (role === 'router' && !hasInterfaceAddresses(device)) {
    return {
      kind: 'assumed',
      note: `${device.label} has no interface addresses: gateway and routing not verified`,
    };
  }
  if (isInternetLike(device)) {
    return { kind: 'assumed', note: `${device.label} is not simulated: traffic assumed to pass` };
  }

  if (!entry || entry.nextHop === undefined) {
    return {
      kind: 'blocked',
      reason:
        role === 'router'
          ? `${device.label} has no route to ${destinationIp}`
          : `no default gateway configured on ${device.label}`,
    };
  }
  if (!entry.out) {
    const what =
      entry.kind === 'default' && !entry.route
        ? `its default gateway ${entry.nextHop}`
        : `the route ${formatNetwork(entry.network)} via ${entry.nextHop}`;
    return {
      kind: 'blocked',
      reason: `${device.label} cannot use ${what}: that address is on none of its networks`,
    };
  }
  return { kind: 'via', out: entry.out, nextHop: entry.nextHop, entry };
}

/** What a router's hop says about the way it sent the packet */
function routeNote(decision: Decision): string | undefined {
  if (decision.kind === 'assumed') return 'routing assumed';
  if (decision.kind === 'blocked') return undefined;
  const label = outLabel(decision.out);
  const network = formatNetwork(decision.entry.network);
  if (decision.kind === 'direct') {
    return label ? `routed: ${network} is on ${label}` : `routed: ${network} is connected`;
  }
  const out = label ? ` (${label})` : '';
  return decision.entry.network.prefix === 0
    ? `routed: default route via ${decision.nextHop}${out}`
    : `routed: ${network} via ${decision.nextHop}${out}`;
}

/** "PC-1 uses gateway 192.168.10.1" — how the device came to want its next hop */
function describeUse(device: NetworkDevice, decision: Decision): string {
  if (decision.kind !== 'via') return `${device.label} sends on its own network`;
  if (decision.entry.network.prefix === 0) {
    return `${device.label} uses gateway ${decision.nextHop}`;
  }
  return `${device.label} routes ${formatNetwork(decision.entry.network)} via ${decision.nextHop}`;
}

function makeHop(device: NetworkDevice, status: HopResult['status'], note?: string): HopResult {
  return { deviceId: device.id, label: device.label, deviceType: device.type, status, note };
}

function joined(notes: string[]): string | undefined {
  return notes.length > 0 ? notes.join('; ') : undefined;
}

/**
 * Follow a packet from `sourceId` to `targetId` (see the header).
 */
export function traceRoute(
  sourceId: string,
  targetId: string,
  topo: Topology,
  options: TraceOptions = {}
): TraceResult {
  const devicesById = new Map(topo.devices.map(d => [d.id, d] as const));
  const source = devicesById.get(sourceId);
  const target = devicesById.get(targetId);
  const notes: string[] = [];

  // 1. Endpoint validation
  if (!source) {
    return { verdict: 'error', hops: [], failureReason: `source device "${sourceId}" not found`, notes };
  }
  if (!target) {
    return { verdict: 'error', hops: [], failureReason: `target device "${targetId}" not found`, notes };
  }

  const targetIp = options.targetIp ?? primaryAddress(target);
  for (const [device, ip] of [
    [source, primaryAddress(source)],
    [target, targetIp],
  ] as const) {
    if (!ip) {
      return {
        verdict: 'error',
        hops: [],
        failureReason: `${device.label} has no IP address configured`,
        notes,
      };
    }
    if (!isValidIP(ip)) {
      return {
        verdict: 'error',
        hops: [],
        failureReason: `${device.label} has an invalid IP address (${ip})`,
        notes,
      };
    }
  }

  // 2. Cables
  if (!physicallyConnected(topo, sourceId, targetId)) {
    return {
      verdict: 'unreachable',
      hops: [],
      failureReason: `no physical path between ${source.label} and ${target.label}`,
      notes,
    };
  }

  const hops: HopResult[] = [];
  let sourceIp = options.sourceIp ?? primaryAddress(source);

  if (sourceId === targetId) {
    // Pinging itself: trivially delivered
    return { verdict: 'success', hops: [makeHop(source, 'delivered')], notes, sourceIp, targetIp };
  }

  const addNotes = (extra: string[]) => {
    for (const note of extra) {
      // One "per-port rules skipped" is enough to say the trace is partial
      const skipped = note.endsWith('per-port rules skipped');
      if (skipped && notes.some(existing => existing.endsWith('per-port rules skipped'))) continue;
      if (!notes.includes(note)) notes.push(note);
    }
  };
  const blocked = (device: NetworkDevice, reason: string): TraceResult => {
    hops.push(makeHop(device, 'blocked', reason));
    return { verdict: 'blocked', hops, failureReason: reason, notes, sourceIp, targetIp };
  };
  /** Record what an L2 step went through; returns the failure, if any */
  const record = (
    device: NetworkDevice,
    hopNotes: string[],
    result: L2Result
  ): TraceResult | undefined => {
    addNotes(result.notes);
    if (result.ok) {
      hops.push(makeHop(device, 'forwarded', joined(hopNotes)));
      for (const hop of result.transit) hops.push(makeHop(hop.device, 'forwarded', joined(hop.notes)));
      return undefined;
    }
    if (result.path.length === 0) return blocked(device, result.reason);
    hops.push(makeHop(device, 'forwarded', joined(hopNotes)));
    const dropAt = result.path[result.path.length - 1];
    for (const hop of result.path.slice(0, -1)) {
      hops.push(makeHop(hop.device, 'forwarded', joined(hop.notes)));
    }
    return blocked(dropAt.device, result.reason);
  };

  let current = source;
  let arrival: DeviceInterface | undefined;
  const crossed = new Set<string>();

  for (let step = 0; step <= MAX_ROUTED_HOPS; step++) {
    if (current.id === target.id) {
      hops.push(makeHop(current, 'delivered'));
      return { verdict: 'success', hops, notes, sourceIp, targetIp };
    }
    if (crossed.has(current.id) || step === MAX_ROUTED_HOPS) {
      return blocked(current, `routing loop: the packet comes back to ${current.label}`);
    }
    crossed.add(current.id);

    const isSource = step === 0;
    const decision = decide(current, targetIp);
    if (decision.kind === 'blocked') return blocked(current, decision.reason);

    if (isSource && options.sourceIp === undefined && decision.kind !== 'assumed') {
      sourceIp = decision.out.ip;
    }
    const packet: Packet = {
      sourceIp,
      destinationIp: targetIp,
      service: options.service ?? 'ping',
      returnTraffic: options.returnTraffic ?? false,
    };
    const hopNotes: string[] = [];
    if (!isSource && forwardingRole(current) === 'router') {
      const note = routeNote(decision);
      if (note) hopNotes.push(note);
    }

    /** Apply the firewall of a device in transit; returns the failure, if any */
    const filter = (egress: DeviceInterface | undefined): TraceResult | undefined => {
      if (isSource) return undefined;
      const verdict = evaluateFirewall(current, arrival, egress, packet);
      if (!verdict) return undefined;
      addNotes(verdict.skipped);
      if (!verdict.allowed) return blocked(current, verdict.text);
      hopNotes.push(verdict.text);
      addNotes([verdict.text]);
      return undefined;
    };
    /** NAT is stored on router ports and not applied: say so when one is crossed */
    const noteNat = (...ifaces: Array<DeviceInterface | undefined>) => {
      for (const iface of ifaces) {
        if (iface?.kind === 'port' && iface.port.nat) {
          addNotes([`NAT on ${current.label} ${iface.label} is not simulated: addresses are not translated`]);
        }
      }
    };

    const request: Omit<L2Request, 'egress' | 'wantIp' | 'purpose'> = {
      topo,
      from: current,
      target,
      packet,
      sender: {
        ip: decision.kind === 'assumed' ? sourceIp : decision.out.ip,
        mask: decision.kind === 'assumed' ? '255.255.255.0' : decision.out.mask,
        uses: describeUse(current, decision),
      },
    };

    let result: L2Result;
    if (decision.kind === 'assumed') {
      addNotes([decision.note]);
      result = forwardAssumed({ ...request, wantIp: targetIp, purpose: 'deliver' });
      if (result.ok) {
        const denied = filter(result.departure);
        if (denied) return denied;
        noteNat(arrival, result.departure);
      }
    } else {
      const denied = filter(decision.out.iface);
      if (denied) return denied;
      noteNat(arrival, decision.out.iface);
      result = resolveOnLink({
        ...request,
        egress: decision.out.iface,
        wantIp: decision.kind === 'direct' ? targetIp : decision.nextHop,
        purpose: decision.kind === 'direct' ? 'deliver' : 'next-hop',
      });
    }

    const failed = record(current, hopNotes, result);
    if (failed) return failed;
    if (!result.ok) break; // unreachable: record() returns the failure

    // Somebody else answers for the destination address before the target does
    if (decision.kind !== 'via' && result.match === 'address' && result.device.id !== target.id) {
      return blocked(
        result.device,
        `${result.device.label} answers for ${targetIp} before ${target.label}: the address is used twice`
      );
    }

    current = result.device;
    arrival = result.arrival;
  }

  return blocked(current, `routing loop: the packet comes back to ${current.label}`);
}

/**
 * Ping: same evaluation as traceRoute, plus a deterministic simulated RTT
 * on success: 1ms base + 2ms per intermediate hop.
 */
export function ping(
  sourceId: string,
  targetId: string,
  topo: Topology,
  options: TraceOptions = {}
): PingResult {
  const trace = traceRoute(sourceId, targetId, topo, options);
  if (trace.verdict !== 'success') return { ...trace };
  const intermediateHops = Math.max(0, trace.hops.length - 2);
  return { ...trace, rttMs: 1 + 2 * intermediateHops };
}
