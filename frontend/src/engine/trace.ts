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
 * A router or firewall may also change the addresses of the packet (see
 * ./nat). Before step 1, a packet addressed to the device itself is sent on
 * to whom the device stands for: the server a port forward publishes, or the
 * sender of a flow it translated, when the packet is the reply. After step 2,
 * a new flow that leaves by a port with NAT takes the address of that port.
 * So the firewall of the same device sees real addresses on both sides.
 *
 * A card that takes its address from a DHCP server has the address it is
 * leased, worked out from the drawing before the packet starts (see ./dhcp);
 * a card that got none has no address, and the error says why.
 *
 * Simulated failures (see ./failures) are part of the topology: a device that
 * is down sends and takes nothing, a cable that is cut carries nothing. A
 * route whose interface has no working cable left (cut, or switched off at
 * its other end) is withdrawn, as a device does when it loses the carrier,
 * and the next route for that destination is taken — a backup route written
 * after the main one. A network the device is attached to is not looked for
 * elsewhere: the broken link is the answer.
 *
 * A route whose next hop is on none of the device's networks is left out the
 * same way, with a note: the next route for that destination, or the default
 * one, takes the traffic. When no other route is left, it says why the
 * packet stops there.
 *
 * Verdicts: 'error' (an endpoint does not exist or has no usable address),
 * 'unreachable' (no cables join the two devices), 'blocked' (dropped on the
 * way, with the reason and the device), 'success'.
 *
 * Whatever is NOT simulated says so in a note instead of passing silently:
 * a link end not attached to a port, a router without interface addresses
 * (it lets traffic through, nothing is verified), a Cloud symbol.
 */

import type { NetworkDevice, ServiceName } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Topology, TraceResult, PingResult, HopResult } from './types';
import { devicesById, forwardingRole, isInternetLike } from './topology';
import { interfacePhrase } from './interfaces';
import type { DeviceInterface } from './interfaces';
import {
  formatNetwork,
  hasInterfaceAddresses,
  lookupRoute,
  ownedAddresses,
  primaryAddress,
  routingTable,
} from './addressing';
import type { L3Interface, RouteEntry } from './addressing';
import { evaluateFirewall } from './firewall';
import type { Packet } from './firewall';
import { deadInterfaces, isDeviceDown } from './failures';
import { forwardAssumed, physicallyConnected, resolveOnLink } from './l2';
import type { L2Request, L2Result, Unroutable } from './l2';
import { doesNat, matchForward, natAddress } from './nat';
import type { NatTranslation } from './nat';
import { noLeaseReason, withLeases } from './dhcp';

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
  /**
   * For a reply: what the NAT devices remember of the flow it answers (the
   * `translations` of the request). They translate the reply back.
   */
  natState?: NatTranslation[];
}

/** What a device decides to do with a packet */
type Decision =
  | { kind: 'direct'; out: L3Interface; entry: RouteEntry; detours: string[] }
  | { kind: 'via'; out: L3Interface; nextHop: string; entry: RouteEntry; detours: string[] }
  | { kind: 'assumed'; note: string }
  | { kind: 'blocked'; reason: string };

/** `port 2` / `eth0`; '' for a device-level address */
function outLabel(out: L3Interface): string {
  return out.iface ? out.iface.label : '';
}

/**
 * `the default route via 10.0.0.2` / `the route 192.168.30.0/24 via 10.0.0.2`
 * / `its own network 192.168.10.0/24`
 */
function routeName(entry: RouteEntry): string {
  if (entry.kind === 'connected') return `its own network ${formatNetwork(entry.network)}`;
  return entry.network.prefix === 0
    ? `the default route via ${entry.nextHop}`
    : `the route ${formatNetwork(entry.network)} via ${entry.nextHop}`;
}

/** `its default gateway 10.0.0.2` / `the route 192.168.30.0/24 via 10.0.0.2` (`the route default via …`) */
function gatewayOrRoute(entry: RouteEntry): string {
  return entry.kind === 'default' && !entry.route
    ? `its default gateway ${entry.nextHop}`
    : `the route ${formatNetwork(entry.network)} via ${entry.nextHop}`;
}

/** The key of the interface a route leaves by, when it leaves by one */
function exitKey(entry: RouteEntry): string | undefined {
  return entry.out?.iface?.key;
}

function decide(device: NetworkDevice, destinationIp: string, topo: Topology): Decision {
  const table = routingTable(device);
  const role = forwardingRole(device);
  const detours: string[] = [];

  // A route whose next hop is on none of the device's networks leads
  // nowhere: the device leaves it out, as a real router does, and the next
  // route for this destination takes the traffic. With none, that route is
  // the answer
  const reachable = table.filter(candidate => candidate.out !== undefined);
  const stranded = lookupRoute(table, destinationIp, { enabledOnly: true });
  let entry = lookupRoute(reachable, destinationIp, { enabledOnly: true });
  if (stranded && !stranded.out && entry) {
    detours.push(
      `${device.label}: ${routeName(stranded)} is unusable (${stranded.nextHop} is on none of its networks), ` +
        `${routeName(entry)} is used instead`
    );
  }

  // A route that leaves by an interface with no working cable left (cut,
  // or switched off at its other end) is withdrawn: the next one for this
  // destination takes over. With none, the route stays and layer 2 says
  // what is broken on its way
  const dead = deadInterfaces(device, topo);
  const deadReason = (candidate: RouteEntry) => dead.get(exitKey(candidate) ?? '');
  if (entry && entry.kind !== 'connected' && deadReason(entry) !== undefined) {
    const alive = reachable.filter(
      candidate => candidate.kind === 'connected' || deadReason(candidate) === undefined
    );
    const backup = lookupRoute(alive, destinationIp, { enabledOnly: true });
    if (backup && backup.nextHop !== undefined) {
      detours.push(
        `${device.label}: ${routeName(entry)} is unusable (${deadReason(entry)}), ` +
          `${routeName(backup)} is used instead`
      );
      entry = backup;
    }
  }

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

  if (entry?.kind === 'connected' && entry.out) {
    return { kind: 'direct', out: entry.out, entry, detours };
  }

  if (role === 'router' && !hasInterfaceAddresses(device)) {
    return {
      kind: 'assumed',
      note: `${device.label} has no interface addresses: gateway and routing not verified`,
    };
  }
  if (isInternetLike(device)) {
    return { kind: 'assumed', note: `${device.label} is not simulated: traffic assumed to pass` };
  }

  if (!entry?.out || entry.nextHop === undefined) {
    // (the only route there is one that leads nowhere: it says why)
    if (stranded && !stranded.out && stranded.nextHop !== undefined) {
      return {
        kind: 'blocked',
        reason: `${device.label} cannot use ${gatewayOrRoute(stranded)}: that address is on none of its networks`,
      };
    }
    return {
      kind: 'blocked',
      reason:
        role === 'router'
          ? `${device.label} has no route to ${destinationIp}`
          : `no default gateway configured on ${device.label}`,
    };
  }
  return { kind: 'via', out: entry.out, nextHop: entry.nextHop, entry, detours };
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

function makeHop(
  device: NetworkDevice,
  status: HopResult['status'],
  note?: string,
  viaConnectionId?: string
): HopResult {
  const hop: HopResult = {
    deviceId: device.id,
    label: device.label,
    deviceType: device.type,
    status,
    note,
  };
  if (viaConnectionId !== undefined) hop.viaConnectionId = viaConnectionId;
  return hop;
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
  drawing: Topology,
  options: TraceOptions = {}
): TraceResult {
  // A card on DHCP has the address it is leased (see ./dhcp)
  const topo = withLeases(drawing);
  const byId = devicesById(topo);
  const source = byId.get(sourceId);
  const target = byId.get(targetId);
  const notes: string[] = [];

  // 1. Endpoint validation
  if (!source) {
    return { verdict: 'error', hops: [], failureReason: `source device "${sourceId}" not found`, notes };
  }
  if (!target) {
    return { verdict: 'error', hops: [], failureReason: `target device "${targetId}" not found`, notes };
  }

  let targetIp = options.targetIp ?? primaryAddress(target);
  /** The address the packet is sent to, whatever it is translated into later */
  const sentTo = targetIp;
  for (const [device, ip] of [
    [source, primaryAddress(source)],
    [target, targetIp],
  ] as const) {
    if (!ip) {
      return {
        verdict: 'error',
        hops: [],
        // (a card waiting for an address says what it is waiting for)
        failureReason: noLeaseReason(topo, device) ?? `${device.label} has no IP address configured`,
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

  // 3. A device that is down (simulated failure) sends nothing
  if (isDeviceDown(topo, sourceId)) {
    const reason = `${source.label} is down`;
    return {
      verdict: 'blocked',
      hops: [makeHop(source, 'blocked', reason)],
      failureReason: reason,
      notes,
      sourceIp,
      targetIp,
    };
  }

  if (sourceId === targetId) {
    // Pinging itself: trivially delivered
    return { verdict: 'success', hops: [makeHop(source, 'delivered')], notes, sourceIp, targetIp };
  }

  const service = options.service ?? 'ping';
  const isReply = options.returnTraffic ?? false;
  const natState = options.natState ?? [];
  /** What the NAT devices on the way will remember of this flow */
  const translations: NatTranslation[] = [];
  /** The address the packet is sent from, whatever it is translated into later */
  let sentFrom = sourceIp;
  /** The addresses of the packet, for the result: as sent, and as they ended up */
  const addresses = (): Pick<
    TraceResult,
    'sourceIp' | 'targetIp' | 'seenSourceIp' | 'reachedIp' | 'translations'
  > => ({
    sourceIp: sentFrom,
    targetIp: sentTo,
    ...(sourceIp !== sentFrom ? { seenSourceIp: sourceIp } : {}),
    ...(targetIp !== sentTo ? { reachedIp: targetIp } : {}),
    ...(translations.length > 0 ? { translations } : {}),
  });

  /** The device that has an address, `target` first when it is one of its own */
  const ownerOf = (ip: string): NetworkDevice | undefined =>
    ownedAddresses(target).includes(ip)
      ? target
      : topo.devices.find(device => ownedAddresses(device).includes(ip));
  /**
   * The device the packet is addressed to at this point of the way. It is
   * `target` unless the packet is aimed at an address of a NAT device that
   * stands for it (a published address, or the address a flow went out with).
   */
  let addressee = ownerOf(targetIp) ?? target;

  /**
   * What a device does with a packet addressed to itself when it stands for
   * somebody else: the address to send it on to, and why. Undefined when the
   * packet is simply for the device.
   */
  const standsFor = (
    device: NetworkDevice
  ): { to: string; why: string; remember?: NatTranslation } | undefined => {
    if (isReply) {
      const known = natState.find(
        entry => entry.deviceId === device.id && entry.kind === 'source' && entry.outside === targetIp
      );
      return known ? { to: known.inside, why: 'reply to a translated flow' } : undefined;
    }
    const match = matchForward(device, service, targetIp);
    if (!match) return undefined;
    return {
      to: match.forward.to,
      why: `port forward ${match.number}`,
      remember: { deviceId: device.id, kind: 'forward', inside: match.forward.to, outside: targetIp },
    };
  };

  const addNotes = (extra: string[]) => {
    for (const note of extra) {
      // One "per-port rules skipped" is enough to say the trace is partial
      const skipped = note.endsWith('per-port rules skipped');
      if (skipped && notes.some(existing => existing.endsWith('per-port rules skipped'))) continue;
      if (!notes.includes(note)) notes.push(note);
    }
  };
  let current = source;
  let arrival: DeviceInterface | undefined;
  /** Id of the cable `current` was reached by */
  let arrivalLink: string | undefined;
  const crossed = new Set<string>();

  /** The packet is dropped at `device`, reached by the cable `via` */
  const blocked = (
    device: NetworkDevice,
    reason: string,
    via: string | undefined = arrivalLink,
    unroutable?: Unroutable
  ): TraceResult => {
    hops.push(makeHop(device, 'blocked', reason, via));
    return {
      verdict: 'blocked',
      hops,
      failureReason: reason,
      notes,
      ...addresses(),
      ...(unroutable ? { unroutable } : {}),
    };
  };
  /** Record what an L2 step went through; returns the failure, if any */
  const record = (
    device: NetworkDevice,
    hopNotes: string[],
    result: L2Result
  ): TraceResult | undefined => {
    addNotes(result.notes);
    if (result.ok) {
      hops.push(makeHop(device, 'forwarded', joined(hopNotes), arrivalLink));
      for (const hop of result.transit) {
        hops.push(makeHop(hop.device, 'forwarded', joined(hop.notes), hop.link?.id));
      }
      return undefined;
    }
    if (result.path.length === 0) {
      return blocked(device, result.reason, arrivalLink, result.unroutable);
    }
    hops.push(makeHop(device, 'forwarded', joined(hopNotes), arrivalLink));
    const dropAt = result.path[result.path.length - 1];
    for (const hop of result.path.slice(0, -1)) {
      hops.push(makeHop(hop.device, 'forwarded', joined(hop.notes), hop.link?.id));
    }
    return blocked(dropAt.device, result.reason, dropAt.link?.id, result.unroutable);
  };

  for (let step = 0; step <= MAX_ROUTED_HOPS; step++) {
    const hopNotes: string[] = [];
    if (current.id === addressee.id) {
      // The packet is for this device, unless the device stands for another
      // (a device does not translate what it sends itself)
      const onward = step > 0 ? standsFor(current) : undefined;
      const next = onward ? ownerOf(onward.to) : undefined;
      if (!onward || next?.id === current.id) {
        hops.push(makeHop(current, 'delivered', undefined, arrivalLink));
        return { verdict: 'success', hops, notes, ...addresses() };
      }
      if (!next) {
        return blocked(
          current,
          `${current.label} sends ${targetIp} on to ${onward.to} (${onward.why}), an address no device has`
        );
      }
      hopNotes.push(`NAT: destination ${targetIp} → ${onward.to} (${onward.why})`);
      if (onward.remember) translations.push(onward.remember);
      targetIp = onward.to;
      addressee = next;
    }
    if (crossed.has(current.id) || step === MAX_ROUTED_HOPS) {
      return blocked(current, `routing loop: the packet comes back to ${current.label}`);
    }
    crossed.add(current.id);

    const isSource = step === 0;
    const decision = decide(current, targetIp, topo);
    if (decision.kind === 'blocked') return blocked(current, decision.reason);
    if (decision.kind !== 'assumed') addNotes(decision.detours);

    if (isSource && options.sourceIp === undefined && decision.kind !== 'assumed') {
      sourceIp = decision.out.ip;
      sentFrom = sourceIp;
    }
    // What a firewall on this device sees: the destination already translated
    // (above), the source not yet (below)
    const packet: Packet = {
      sourceIp,
      destinationIp: targetIp,
      service,
      returnTraffic: isReply,
    };
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
    /**
     * The source of the packet as it leaves a device in transit by `egress`:
     * a reply to a flow the device forwarded takes back the address the flow
     * was sent to; a new flow that leaves by a port with NAT takes the
     * address of that port, and the device remembers it.
     */
    const translateSource = (egress: DeviceInterface | undefined) => {
      if (isSource) return;
      if (isReply) {
        const known = natState.find(
          entry => entry.deviceId === current.id && entry.kind === 'forward' && entry.inside === sourceIp
        );
        if (known) {
          hopNotes.push(`NAT: source ${sourceIp} → ${known.outside} (reply to a forwarded flow)`);
          sourceIp = known.outside;
        }
        return;
      }
      if (!egress || !doesNat(egress)) return;
      const address = natAddress(egress);
      if (!address) {
        addNotes([`NAT on ${current.label} ${egress.label} has no address to translate to: not applied`]);
        return;
      }
      if (address === sourceIp) return;
      hopNotes.push(`NAT: source ${sourceIp} → ${address}`);
      translations.push({ deviceId: current.id, kind: 'source', inside: sourceIp, outside: address });
      sourceIp = address;
    };

    const request = (): Omit<L2Request, 'egress' | 'wantIp' | 'purpose'> => ({
      topo,
      from: current,
      target: addressee,
      // (with the source as it is on the cable: translated, if it was)
      packet: { ...packet, sourceIp },
      sender: {
        ip: decision.kind === 'assumed' ? sourceIp : decision.out.ip,
        mask: decision.kind === 'assumed' ? '255.255.255.0' : decision.out.mask,
        uses: describeUse(current, decision),
      },
    });

    let result: L2Result;
    if (decision.kind === 'assumed') {
      addNotes([decision.note]);
      result = forwardAssumed({ ...request(), wantIp: targetIp, purpose: 'deliver' });
      if (result.ok) {
        const denied = filter(result.departure);
        if (denied) return denied;
        translateSource(result.departure);
      }
    } else {
      const denied = filter(decision.out.iface);
      if (denied) return denied;
      translateSource(decision.out.iface);
      result = resolveOnLink({
        ...request(),
        egress: decision.out.iface,
        wantIp: decision.kind === 'direct' ? targetIp : decision.nextHop,
        purpose: decision.kind === 'direct' ? 'deliver' : 'next-hop',
      });
    }

    const failed = record(current, hopNotes, result);
    if (failed) return failed;
    if (!result.ok) break; // unreachable: record() returns the failure

    // Somebody else answers for the destination address before the target does
    if (decision.kind !== 'via' && result.match === 'address' && result.device.id !== addressee.id) {
      return blocked(
        result.device,
        `${result.device.label} answers for ${targetIp} before ${addressee.label}: the address is used twice`
      );
    }

    current = result.device;
    arrival = result.arrival;
    arrivalLink = result.link?.id;
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
