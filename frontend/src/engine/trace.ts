/**
 * Network Engine — Trace / Ping
 *
 * Evaluates reachability over the SHORTEST BFS path, hop by hop, stopping at
 * the first block. Pure and deterministic: same topology in, same verdict out.
 *
 * Checks applied in order along the path:
 *  1. endpoints exist and have (valid) IPs                → 'error'
 *  2. a physical path exists                              → 'unreachable'
 *  3. per-link interface bindings (a disabled port or NIC
 *     on either end of a link drops the packet)           → 'blocked'
 *  4. L2 VLAN continuity on switch-like transit hops      → 'blocked'
 *  5. L3 across subnets: the source has a gateway, a router
 *     is on the path, and the gateway IS the address of the
 *     router port the packet arrives on                   → 'blocked'
 *  6. firewall security zones on port-bound firewall hops → 'blocked'
 *     (the reply to an allowed flow passes: see TraceOptions.returnTraffic)
 *
 * Endpoint addressing comes from the interface the endpoint's link is bound
 * to when that interface carries an IP, else from the device's primary
 * addressing.
 *
 * Whatever is NOT simulated says so in a note instead of passing silently:
 * links without a binding, routers without interface addresses (gateway not
 * verified) and routing between routers (no routing tables yet).
 */

import type { NetworkDevice, NetworkConnection } from '@/types';
import type { Topology, TraceResult, PingResult, HopResult } from './types';
import {
  buildAdjacency,
  primaryIp,
  primaryMask,
  primaryGateway,
  isL3Capable,
  isSwitchLike,
} from './topology';
import { boundInterface, interfacePhrase, listInterfaces } from './interfaces';
import { areSameNetwork, getNetworkAddress, isValidIP } from '@/utils/ipHelpers';

/** Firewall zone transitions that are denied (ingress→egress) */
const DENIED_ZONE_TRANSITIONS = new Set(['untrust→trust', 'untrust→dmz', 'dmz→trust']);

/** Mask assumed for an addressed interface that carries no mask */
const DEFAULT_MASK = '255.255.255.0';

interface BfsPath {
  /** Devices in order, source first */
  devices: NetworkDevice[];
  /** links[i] connects devices[i] and devices[i+1] */
  links: NetworkConnection[];
}

/** Shortest path via BFS (deterministic: follows connection insertion order) */
function shortestPath(sourceId: string, targetId: string, topo: Topology): BfsPath | undefined {
  const devicesById = new Map(topo.devices.map(d => [d.id, d] as const));
  const source = devicesById.get(sourceId);
  if (!source) return undefined;
  if (sourceId === targetId) return { devices: [source], links: [] };

  const adjacency = buildAdjacency(topo);
  const visited = new Set<string>([sourceId]);
  const parents = new Map<string, { prevId: string; connection: NetworkConnection }>();
  const queue: string[] = [sourceId];
  let head = 0;

  while (head < queue.length) {
    const currentId = queue[head++];
    for (const { neighborId, connection } of adjacency.get(currentId) ?? []) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      parents.set(neighborId, { prevId: currentId, connection });
      if (neighborId === targetId) {
        // Reconstruct path target → source
        const ids: string[] = [targetId];
        const links: NetworkConnection[] = [];
        let nodeId = targetId;
        while (nodeId !== sourceId) {
          const parent = parents.get(nodeId);
          if (!parent) return undefined; // unreachable by construction
          links.unshift(parent.connection);
          ids.unshift(parent.prevId);
          nodeId = parent.prevId;
        }
        const devices: NetworkDevice[] = [];
        for (const id of ids) {
          const device = devicesById.get(id);
          if (!device) return undefined;
          devices.push(device);
        }
        return { devices, links };
      }
      queue.push(neighborId);
    }
  }
  return undefined;
}

/** The addressing an endpoint uses for one trace */
interface EndpointAddress {
  ip: string;
  mask: string;
  gateway: string;
}

/**
 * Addressing of an endpoint for this trace. `link` is the path link attached
 * to the endpoint (undefined when there is no path).
 *
 *  - link bound to a NIC that has an IP → that NIC's ip/subnet/gateway. The
 *    NIC is the source of truth: its gateway is used even when empty, never
 *    the device-level one (which the Inspector leaves stale).
 *  - a SOURCE whose link is bound to an addressed port (router/firewall) →
 *    that port's ip/subnet: a router talks to a directly attached network
 *    from its own interface there and needs no gateway for it.
 *  - otherwise the device's primary addressing.
 */
function endpointAddress(
  device: NetworkDevice,
  link: NetworkConnection | undefined,
  role: 'source' | 'target'
): EndpointAddress {
  const iface = link ? boundInterface(link, device) : undefined;
  if (iface?.kind === 'nic' && iface.ip) {
    return { ip: iface.ip, mask: iface.subnet || DEFAULT_MASK, gateway: iface.nic.gateway || '' };
  }
  if (iface?.kind === 'port' && iface.ip && role === 'source') {
    return { ip: iface.ip, mask: iface.subnet || DEFAULT_MASK, gateway: primaryGateway(device) };
  }
  return { ip: primaryIp(device), mask: primaryMask(device), gateway: primaryGateway(device) };
}

/** Outcome of checking the source's gateway against the first router on the path */
interface GatewayCheck {
  /** Reason the packet never leaves the source */
  blocked?: string;
  /** What could not be verified */
  note?: string;
}

/**
 * Cross-subnet traffic is handed to the first router on the path: the source's
 * gateway must be the address of the router port the packet arrives on, and
 * that address must sit in the source's subnet. Routers without any port
 * address (data from before ports could be addressed) cannot be checked: the
 * old "a gateway is configured" behaviour stands and a note says so.
 */
function checkGateway(
  source: NetworkDevice,
  address: EndpointAddress,
  path: BfsPath
): GatewayCheck {
  const routerIndex = path.devices.findIndex((d, i) => i > 0 && isL3Capable(d));
  if (routerIndex < 0) return {}; // no router: reported by the "no router" check
  const router = path.devices[routerIndex];

  const hasAddresses = (router.ports ?? []).some(p => p.ip);
  if (!hasAddresses) {
    return { note: `${router.label} has no interface addresses: gateway not verified` };
  }

  const arrivalLink = path.links[routerIndex - 1];
  const arrival = boundInterface(arrivalLink, router);
  if (!arrival) {
    const previous = path.devices[routerIndex - 1];
    return {
      note:
        `link ${previous.label}–${router.label} has no port binding on ${router.label}: ` +
        `gateway not verified`,
    };
  }

  const uses = `${source.label} uses gateway ${address.gateway}`;
  const where = `${router.label} ${arrival.label}`;
  if (!arrival.ip) {
    return { blocked: `${uses}, but ${where} on its link has no IP address` };
  }
  if (!areSameNetwork(arrival.ip, address.ip, address.mask)) {
    const network = getNetworkAddress(address.ip, address.mask);
    return { blocked: `${uses}, but ${where} is ${arrival.ip}, outside its network ${network}` };
  }
  if (arrival.ip !== address.gateway) {
    return { blocked: `${uses}, but ${where} on its network is ${arrival.ip}` };
  }
  return {};
}

function makeHop(device: NetworkDevice, status: HopResult['status'], note?: string): HopResult {
  return { deviceId: device.id, label: device.label, deviceType: device.type, status, note };
}

/** Options for one trace */
export interface TraceOptions {
  /**
   * The packet is the reply to a flow that was just allowed in the opposite
   * direction (ping reply, HTTP response). Firewalls keep state: they let the
   * return traffic of an allowed flow through even when the zone table would
   * deny a NEW flow in that direction.
   */
  returnTraffic?: boolean;
}

/**
 * Evaluate reachability from source to target over the shortest physical path.
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

  // The path is needed up front: each endpoint is addressed through the
  // interface its link is bound to
  const path = shortestPath(sourceId, targetId, topo);
  const sourceAddress = endpointAddress(source, path?.links[0], 'source');
  const targetAddress = endpointAddress(target, path?.links[path.links.length - 1], 'target');
  const sourceIp = sourceAddress.ip;
  const targetIp = targetAddress.ip;
  for (const [device, ip] of [
    [source, sourceIp],
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

  // 2. Physical path
  if (!path) {
    return {
      verdict: 'unreachable',
      hops: [],
      failureReason: `no physical path between ${source.label} and ${target.label}`,
      notes,
    };
  }
  const { devices, links } = path;
  if (devices.length === 1) {
    // Pinging itself: trivially delivered
    return { verdict: 'success', hops: [makeHop(source, 'delivered')], notes };
  }

  const sourceMask = sourceAddress.mask;
  const crossSubnet = !areSameNetwork(sourceIp, targetIp, sourceMask);
  const trafficVlans = source.vlan && source.vlan.length > 0 ? source.vlan : undefined;
  const pathHasL3 = devices.some(isL3Capable);

  const hops: HopResult[] = [];
  let unboundLinkNoted = false;

  const blockedAt = (device: NetworkDevice, reason: string): TraceResult => {
    hops.push(makeHop(device, 'blocked', reason));
    return { verdict: 'blocked', hops, failureReason: reason, notes };
  };

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const isSource = i === 0;
    const isTarget = i === devices.length - 1;
    const hopNotes: string[] = [];

    // Arrival checks on transit hops
    if (!isSource && !isTarget) {
      // 4. L2 VLAN continuity on switch-like devices carrying VLANs
      const deviceVlans = device.vlan ?? [];
      if (isSwitchLike(device) && deviceVlans.length > 0) {
        if (trafficVlans) {
          const allowed = trafficVlans.some(v => deviceVlans.includes(v));
          if (!allowed) {
            return blockedAt(
              device,
              `VLAN mismatch on ${device.label}: traffic VLANs [${trafficVlans.join(',')}] ` +
                `not allowed (device carries [${deviceVlans.join(',')}])`
            );
          }
        } else {
          const note = `untagged traffic through ${device.label}`;
          hopNotes.push(note);
          notes.push(note);
        }
      }

      // 6. Firewall security zones (needs port-bound links on both sides)
      if (device.type.toLowerCase().includes('firewall')) {
        const ingress = boundInterface(links[i - 1], device);
        const egress = boundInterface(links[i], device);
        const ingressZone = ingress?.kind === 'port' ? ingress.port.securityZone : undefined;
        const egressZone = egress?.kind === 'port' ? egress.port.securityZone : undefined;
        if (ingressZone && egressZone) {
          const denied = DENIED_ZONE_TRANSITIONS.has(`${ingressZone}→${egressZone}`);
          if (denied && !options.returnTraffic) {
            return blockedAt(
              device,
              `firewall policy on ${device.label}: ${ingressZone} → ${egressZone} denied`
            );
          }
          const note = denied
            ? `firewall policy: ${ingressZone} → ${egressZone} allowed (reply to an allowed flow)`
            : `firewall policy: ${ingressZone} → ${egressZone} allowed`;
          hopNotes.push(note);
          notes.push(note);
        } else {
          const note = `firewall ${device.label} has no zone binding: allowed`;
          hopNotes.push(note);
          notes.push(note);
        }
      }

      // 5. Routed hop annotation
      if (crossSubnet && isL3Capable(device)) {
        hopNotes.push('routed between subnets');
      }
    }

    if (isTarget) {
      hops.push(makeHop(device, 'delivered', hopNotes.length > 0 ? hopNotes.join('; ') : undefined));
      break;
    }

    if (isSource && crossSubnet) {
      // 5a. Cross-subnet traffic needs a configured gateway on the source
      if (!sourceAddress.gateway) {
        return blockedAt(device, `no default gateway configured on ${source.label}`);
      }

      // 5c. ...and that gateway must be the router port the packet reaches
      const gateway = checkGateway(source, sourceAddress, path);
      if (gateway.blocked) return blockedAt(device, gateway.blocked);
      if (gateway.note) notes.push(gateway.note);

      // Only the first router is checked: what happens between routers
      // needs routing tables, which are not simulated yet
      if (devices.filter(isL3Capable).length > 1) {
        notes.push('routing between routers is not simulated: assumed');
      }
    }

    // 5b. Cross-subnet traffic needs at least one L3 device on the path.
    // Failure surfaces at the last hop before the target.
    if (i === devices.length - 2 && crossSubnet && !pathHasL3) {
      const sourceNet = getNetworkAddress(sourceIp, sourceMask);
      const targetNet = getNetworkAddress(targetIp, targetAddress.mask);
      return blockedAt(
        device,
        `no router between subnets ${sourceNet} and ${targetNet} — L2 devices cannot route`
      );
    }

    // 3. Per-link interface bindings on the outgoing link
    const link = links[i];
    const next = devices[i + 1];
    const near = boundInterface(link, device);
    const far = boundInterface(link, next);

    // An end without a resolved interface cannot be gated: say so once.
    // (A device with no ports/NICs at all has no per-interface rule to skip.)
    if (!unboundLinkNoted) {
      const nearMissing = !near && (!far || listInterfaces(device).length > 0);
      const farMissing = !far && (!near || listInterfaces(next).length > 0);
      if (nearMissing || farMissing) {
        const where = nearMissing && farMissing ? '' : ` on ${(nearMissing ? device : next).label}`;
        notes.push(
          `link ${device.label}–${next.label} has no port binding${where}: per-port rules skipped`
        );
        unboundLinkNoted = true;
      }
    }

    if (near && !near.enabled) {
      return blockedAt(device, `${interfacePhrase(near)} on ${device.label} is disabled`);
    }
    if (far && !far.enabled) {
      hops.push(
        makeHop(device, 'forwarded', hopNotes.length > 0 ? hopNotes.join('; ') : undefined)
      );
      return blockedAt(next, `${interfacePhrase(far)} on ${next.label} is disabled`);
    }

    hops.push(makeHop(device, 'forwarded', hopNotes.length > 0 ? hopNotes.join('; ') : undefined));
  }

  return { verdict: 'success', hops, notes };
}

/**
 * Ping: same evaluation as traceRoute, plus a deterministic simulated RTT
 * on success: 1ms base + 2ms per intermediate hop.
 */
export function ping(sourceId: string, targetId: string, topo: Topology): PingResult {
  const trace = traceRoute(sourceId, targetId, topo);
  if (trace.verdict !== 'success') return { ...trace };
  const intermediateHops = Math.max(0, trace.hops.length - 2);
  return { ...trace, rttMs: 1 + 2 * intermediateHops };
}
