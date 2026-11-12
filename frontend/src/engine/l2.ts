/**
 * Network Engine — Layer 2 delivery
 *
 * One step of a packet's journey: a device has decided which address the
 * packet goes to next (the destination itself, or a gateway) and this module
 * finds the device that answers for that address on the same network,
 * crossing whatever sits in between:
 *
 *  - switches and other bridges, VLAN by VLAN (see ./vlan)
 *  - routers and firewalls WITHOUT interface addresses: transparent, and a
 *    firewall still applies its policy between the two ports crossed
 *  - devices that are not simulated (Internet/Cloud symbol, load balancer):
 *    assumed to let the frame through, with a note
 *
 * End devices and addressed routers never carry a frame for others.
 *
 * The search is breadth first, in connection order: the shortest way that
 * works is the one taken, so a cable or port that is down is routed around
 * when the drawing offers another way. Spanning tree is not simulated. The
 * same goes for simulated failures (see ./failures): a cable that is cut and
 * a device that is down carry nothing.
 *
 * Whatever cannot be verified is accepted with a note instead of failing
 * silently or passing silently: a link end not attached to a port, a router
 * without interface addresses, an address that belongs to the outside world.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { NetworkConnection, NetworkDevice } from '@/types';
import { areSameNetwork, getNetworkAddress, isValidIP } from '@/utils/ipHelpers';
import type { Topology } from './types';
import { boundInterface, interfacePhrase, listInterfaces } from './interfaces';
import type { DeviceInterface } from './interfaces';
import { buildAdjacency, forwardingRole, isInternetLike } from './topology';
import { hasInterfaceAddresses, ownedAddresses } from './addressing';
import { evaluateFirewall } from './firewall';
import type { Packet } from './firewall';
import { isDeviceDown, isLinkCut, linkDownReason } from './failures';
import { DEFAULT_VLAN, describePortVlan, isVlanAware, portVlanMode, trunkCarries } from './vlan';

/** A frame travelling on a cable */
interface Frame {
  /** VLAN tag put on by a trunk port; undefined = untagged */
  tag?: number;
  /** Set once the frame left a VLAN-aware switch untagged: the VLAN it was in */
  accessVlan?: number;
  /** "port 3 on SW-1 is an access port in VLAN 20", for messages */
  accessPort?: string;
  /** "port 8 on SW-1": the trunk port that put the tag on */
  taggedBy?: string;
  /** True once a VLAN-aware switch handled the frame */
  crossedAware: boolean;
}

/** One device reached by the search, with the way it was reached */
interface Node {
  device: NetworkDevice;
  prev?: Node;
  /** Cable the frame arrived by */
  link?: NetworkConnection;
  /** Interface of `device` on that cable (undefined: end not attached) */
  arrival?: DeviceInterface;
  /** Interface of the previous device on that cable */
  departure?: DeviceInterface;
  /** Frame as it arrived */
  frame: Frame;
  /** VLAN the frame is in while inside a VLAN-aware switch */
  vlan?: number;
  /** Notes about this device that also belong to the trace as a whole */
  notes: string[];
  /** Annotations shown on the hop only ("VLAN 10") */
  tags: string[];
  /** Notes about the PREVIOUS device that hold only on this way out of it */
  exitNotes: string[];
  /** "link A–B has no port binding…" for the cable arrived by */
  unbound?: string;
}

/** A place where the frame was dropped */
interface Drop {
  /** The device that drops it: the last one of `node`'s path */
  node: Node;
  reason: string;
  /** The cable it was dropped on, or about to take */
  link?: NetworkConnection;
}

/** A device crossed on the way, with what to say about it */
export interface L2Hop {
  device: NetworkDevice;
  notes: string[];
  /** Cable the frame reached the device by */
  link?: NetworkConnection;
}

/** Who is sending, for the wording of failures */
export interface L2Sender {
  /** Address the frame is sent from */
  ip: string;
  mask: string;
  /** "PC-1 uses gateway 192.168.10.1" — how the sender came to want the address */
  uses: string;
}

export interface L2Request {
  topo: Topology;
  from: NetworkDevice;
  /**
   * Interface the frame leaves by. Undefined for a device addressed at device
   * level, or one that does not choose (assumed forwarding): any cable.
   */
  egress?: DeviceInterface;
  /** Address to find */
  wantIp: string;
  /**
   * `deliver`: the address is the packet's destination, on `target`.
   * `next-hop`: it is a gateway; what cannot be verified is accepted with a note.
   */
  purpose: 'deliver' | 'next-hop';
  /** The device the packet is finally for */
  target: NetworkDevice;
  packet: Packet;
  sender: L2Sender;
}

export interface L2Success {
  ok: true;
  /** Device that takes the frame */
  device: NetworkDevice;
  /** Cable the frame reached it by */
  link?: NetworkConnection;
  /** Its interface on the cable the frame arrived by (undefined: end not attached) */
  arrival?: DeviceInterface;
  /** Interface of the sender the frame left by (undefined: end not attached) */
  departure?: DeviceInterface;
  /** Devices crossed in between, in order */
  transit: L2Hop[];
  /** Notes for the trace as a whole, in order */
  notes: string[];
  /**
   * How the device was chosen: it owns the address, or it was accepted
   * without proof (see the header), or — assumed forwarding only — it is the
   * router the frame is handed to.
   */
  match: 'address' | 'unverified' | 'handover';
}

export interface L2Failure {
  ok: false;
  reason: string;
  /**
   * Devices the frame went through after the sender; the last one is where
   * it is dropped. Empty when it never leaves the sender.
   */
  path: L2Hop[];
  notes: string[];
}

export type L2Result = L2Success | L2Failure;

/** Everything one search found out */
interface WalkOutcome {
  found?: Node;
  /** Addressed routers reached that do not answer for the address */
  routers: Node[];
  /** End devices reached that do not answer for the address */
  hosts: Node[];
  /** Devices that would be accepted as gateway without proof, in search order */
  candidates: Array<{ node: Node; note: string }>;
  drops: Drop[];
  /** Device ids reached, sender included */
  reached: Set<string>;
}

function nodePath(node: Node): Node[] {
  const path: Node[] = [];
  for (let current: Node | undefined = node; current; current = current.prev) path.unshift(current);
  return path;
}

/** `port 3 on SW-1` / `interface eth0 on PC-1` */
function interfaceOn(iface: DeviceInterface, device: NetworkDevice): string {
  return `${interfacePhrase(iface)} on ${device.label}`;
}

/** The VLANs a device that is not a bridge declares for itself */
function declaredVlans(device: NetworkDevice): number[] {
  return forwardingRole(device) === 'bridge' ? [] : (device.vlan ?? []);
}

/** A router or firewall whose ports carry no address: it cannot route, it lets frames through */
function isTransparentRouter(device: NetworkDevice): boolean {
  return forwardingRole(device) === 'router' && !hasInterfaceAddresses(device);
}

/**
 * The frame as it leaves `node`'s device through `near`, or the reason it
 * does not. Only a VLAN-aware switch changes or stops a frame on the way out.
 */
function leave(node: Node, near: DeviceInterface | undefined): { frame: Frame } | { reason: string } {
  if (node.vlan === undefined) return { frame: node.frame };
  // Way out not attached to a port: the port rule cannot be applied
  if (near?.kind !== 'port') return { frame: { crossedAware: true } };

  const mode = portVlanMode(near.port);
  const port = interfaceOn(near, node.device);
  if (mode.kind === 'access') {
    if (mode.vlan !== node.vlan) {
      return { reason: `VLAN ${node.vlan} does not leave through ${port}: it is ${describePortVlan(mode)}` };
    }
    return {
      frame: {
        crossedAware: true,
        accessVlan: mode.vlan,
        accessPort: `${port} is ${describePortVlan(mode)}`,
      },
    };
  }
  if (!trunkCarries(mode, node.vlan)) {
    return { reason: `VLAN ${node.vlan} does not leave through ${port}: it is ${describePortVlan(mode)}` };
  }
  // The default VLAN travels untagged on a trunk
  return node.vlan === DEFAULT_VLAN
    ? { frame: { crossedAware: true, accessVlan: DEFAULT_VLAN, accessPort: `${port} is ${describePortVlan(mode)}` } }
    : { frame: { crossedAware: true, tag: node.vlan, taggedBy: port } };
}

/**
 * A frame entering a bridge through `far`: the VLANs it may be in inside the
 * bridge (one entry, or several when a directly attached device declares
 * more than one), or the reason the bridge drops it. `undefined` in the list
 * means "no VLAN handling": the bridge is not VLAN-aware.
 */
function enterBridge(
  bridge: NetworkDevice,
  far: DeviceInterface | undefined,
  frame: Frame,
  previous: NetworkDevice,
  /** VLANs declared by the device at the other end of the cable, when it is the sender */
  attachedVlans: number[],
  /** VLANs declared by the sender, valid until a VLAN-aware switch takes over */
  senderVlans: number[]
): { vlans: Array<number | undefined>; notes: string[] } | { reason: string } {
  const defined = bridge.vlan ?? [];

  if (!isVlanAware(bridge)) {
    if (defined.length === 0) return { vlans: [undefined], notes: [] };
    const traffic =
      frame.tag !== undefined ? [frame.tag] : frame.crossedAware ? [] : senderVlans;
    if (traffic.length === 0) {
      return { vlans: [undefined], notes: [`untagged traffic through ${bridge.label}`] };
    }
    if (!traffic.some(vlan => defined.includes(vlan))) {
      return {
        reason:
          `VLAN mismatch on ${bridge.label}: traffic VLANs [${traffic.join(',')}] ` +
          `not allowed (device carries [${defined.join(',')}])`,
      };
    }
    return { vlans: [undefined], notes: [] };
  }

  let vlans: number[];
  if (far?.kind !== 'port') {
    // Way in not attached to a port: the port rule cannot be applied
    vlans = [frame.tag ?? DEFAULT_VLAN];
  } else {
    const mode = portVlanMode(far.port);
    const port = interfaceOn(far, bridge);
    if (mode.kind === 'access') {
      if (frame.tag !== undefined && frame.tag !== mode.vlan) {
        return { reason: `${port} is ${describePortVlan(mode)}: it drops traffic tagged VLAN ${frame.tag}` };
      }
      if (attachedVlans.length > 0 && !attachedVlans.includes(mode.vlan)) {
        return {
          reason:
            `VLAN mismatch: ${previous.label} is in VLAN [${attachedVlans.join(',')}] ` +
            `but ${port} is ${describePortVlan(mode)}`,
        };
      }
      vlans = [mode.vlan];
    } else if (frame.tag !== undefined) {
      if (!trunkCarries(mode, frame.tag)) {
        return { reason: `${port} is ${describePortVlan(mode)}: VLAN ${frame.tag} is not carried` };
      }
      vlans = [frame.tag];
    } else if (attachedVlans.length > 0) {
      vlans = attachedVlans.filter(vlan => trunkCarries(mode, vlan));
      if (vlans.length === 0) {
        return {
          reason:
            `VLAN mismatch: ${previous.label} is in VLAN [${attachedVlans.join(',')}] ` +
            `but ${port} is ${describePortVlan(mode)}`,
        };
      }
    } else {
      if (!trunkCarries(mode, DEFAULT_VLAN)) {
        return {
          reason: `${port} is ${describePortVlan(mode)}: untagged traffic from ${previous.label} is not carried`,
        };
      }
      vlans = [DEFAULT_VLAN];
    }
  }

  if (defined.length > 0) {
    const known = vlans.filter(vlan => vlan === DEFAULT_VLAN || defined.includes(vlan));
    if (known.length === 0) {
      return {
        reason: `VLAN ${vlans.join(',')} is not defined on ${bridge.label} (it carries [${defined.join(',')}])`,
      };
    }
    vlans = known;
  }
  return { vlans, notes: [] };
}

/**
 * Why a device that answers for the address still does not get the frame,
 * VLAN-wise. Undefined when it does.
 */
function endpointVlanProblem(node: Node, senderVlans: number[], sender: NetworkDevice): string | undefined {
  const endpoint = node.device;
  const declared = declaredVlans(endpoint);
  const { frame } = node;

  if (frame.tag !== undefined) {
    if (declared.includes(frame.tag)) return undefined;
    const trunk = frame.taggedBy ? ` (${frame.taggedBy} is a trunk)` : '';
    return (
      `${endpoint.label} receives traffic tagged VLAN ${frame.tag}${trunk} ` +
      `and does not expect a tag`
    );
  }
  if (frame.accessVlan !== undefined) {
    if (declared.length === 0 || declared.includes(frame.accessVlan)) return undefined;
    return `VLAN mismatch: ${endpoint.label} is in VLAN [${declared.join(',')}] but ${frame.accessPort}`;
  }
  if (
    !frame.crossedAware &&
    senderVlans.length > 0 &&
    declared.length > 0 &&
    !senderVlans.some(vlan => declared.includes(vlan))
  ) {
    return (
      `VLAN mismatch: ${sender.label} is in VLAN [${senderVlans.join(',')}], ` +
      `${endpoint.label} in VLAN [${declared.join(',')}]`
    );
  }
  return undefined;
}

/** "link A–B has no port binding…" when an end of the cable cannot be gated by its interface */
function unboundNote(
  device: NetworkDevice,
  near: DeviceInterface | undefined,
  next: NetworkDevice,
  far: DeviceInterface | undefined
): string | undefined {
  // A device with no ports/NICs at all has no per-interface rule to skip
  const nearMissing = !near && (!far || listInterfaces(device).length > 0);
  const farMissing = !far && (!near || listInterfaces(next).length > 0);
  if (!nearMissing && !farMissing) return undefined;
  const where = nearMissing && farMissing ? '' : ` on ${(nearMissing ? device : next).label}`;
  return `link ${device.label}–${next.label} has no port binding${where}: per-port rules skipped`;
}

/** The cables a frame from `from` may start on (connection ids) */
function startLinks(request: L2Request): Set<string> {
  const { topo, from, egress } = request;
  const own = topo.connections.filter(c => c.source === from.id || c.target === from.id);
  if (!egress) return new Set(own.map(c => c.id));

  const bound = own.filter(c => boundInterface(c, from)?.key === egress.key);
  if (bound.length > 0) return new Set(bound.map(c => c.id));
  // Nothing is attached to that interface: the frame can only be on a cable
  // whose end on this device is not attached to any interface
  return new Set(own.filter(c => boundInterface(c, from) === undefined).map(c => c.id));
}

/** Breadth-first search for the device that answers for `wantIp` */
function walk(request: L2Request): WalkOutcome {
  const { topo, from, wantIp, packet } = request;
  const devicesById = new Map(topo.devices.map(d => [d.id, d] as const));
  const adjacency = buildAdjacency(topo);
  const allowedStart = startLinks(request);
  const senderVlans = declaredVlans(from);

  const outcome: WalkOutcome = {
    routers: [],
    hosts: [],
    candidates: [],
    drops: [],
    reached: new Set([from.id]),
  };

  const start: Node = { device: from, frame: { crossedAware: false }, notes: [], tags: [], exitNotes: [] };
  // A VLAN-aware switch speaks for itself from its management VLAN
  if (forwardingRole(from) === 'bridge' && isVlanAware(from)) start.vlan = DEFAULT_VLAN;

  const queue: Node[] = [start];
  const seen = new Set<string>();
  const stateKey = (node: Node) => `${node.device.id}|${node.vlan ?? ''}|${node.frame.tag ?? ''}`;
  seen.add(stateKey(start));

  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    const { device } = node;

    for (const { neighborId, connection } of adjacency.get(device.id) ?? []) {
      if (node.link?.id === connection.id) continue; // never back down the same cable
      if (node === start && !allowedStart.has(connection.id)) continue;
      const next = devicesById.get(neighborId);
      if (!next) continue;

      const drop = (at: Node, reason: string) =>
        outcome.drops.push({ node: at, reason, link: connection });

      // ── simulated failures: a cut cable, a device that is down ──────────
      const broken = linkDownReason(topo, connection, device, next);
      if (broken !== undefined) {
        drop(node, broken);
        continue;
      }

      // ── leaving `device` ────────────────────────────────────────────────
      const near = boundInterface(connection, device);
      if (near && !near.enabled) {
        drop(node, `${interfaceOn(near, device)} is disabled`);
        continue;
      }
      const left = leave(node, near);
      if ('reason' in left) {
        drop(node, left.reason);
        continue;
      }
      const exitNotes: string[] = [];
      if (node !== start && isTransparentRouter(device)) {
        const verdict = evaluateFirewall(device, node.arrival, near, packet);
        if (verdict) {
          if (!verdict.allowed) {
            drop(node, verdict.text);
            continue;
          }
          exitNotes.push(verdict.text, ...verdict.skipped);
        }
      }

      // ── arriving at `next` ──────────────────────────────────────────────
      const far = boundInterface(connection, next);
      const child: Node = {
        device: next,
        prev: node,
        link: connection,
        arrival: far,
        departure: near,
        frame: left.frame,
        notes: [],
        tags: [],
        exitNotes,
        unbound: unboundNote(device, near, next, far),
      };
      outcome.reached.add(next.id);
      if (far && !far.enabled) {
        drop(child, `${interfaceOn(far, next)} is disabled`);
        continue;
      }

      const role = forwardingRole(next);
      const enqueue = (entry: Node) => {
        const key = stateKey(entry);
        if (seen.has(key)) return;
        seen.add(key);
        queue.push(entry);
      };
      /** Take the frame if the VLAN allows it; true when the search is over */
      const answer = (): boolean => {
        const problem = endpointVlanProblem(child, senderVlans, from);
        if (problem) {
          drop(child, problem);
          return false;
        }
        outcome.found = child;
        return true;
      };

      if (role === 'bridge') {
        const entered = enterBridge(
          next,
          far,
          child.frame,
          device,
          node === start ? senderVlans : [],
          senderVlans
        );
        if ('reason' in entered) {
          drop(child, entered.reason);
          continue;
        }
        for (const vlan of entered.vlans) {
          const inside: Node = {
            ...child,
            vlan,
            notes: [...entered.notes],
            tags: vlan === undefined ? [] : [`VLAN ${vlan}`],
          };
          // The switch's own (management) address lives in the default VLAN
          if (next.ip === wantIp) {
            if (vlan === undefined || vlan === DEFAULT_VLAN) {
              outcome.found = inside;
              return outcome;
            }
            drop(
              inside,
              `${next.label} answers on ${wantIp} in VLAN ${DEFAULT_VLAN} only: ` +
                `the traffic reaches it in VLAN ${vlan}`
            );
          }
          enqueue(inside);
        }
        continue;
      }

      if (role === 'router' && hasInterfaceAddresses(next)) {
        const owns = far ? far.ip === wantIp : ownedAddresses(next).includes(wantIp);
        if (owns) {
          if (answer()) return outcome;
          continue;
        }
        outcome.routers.push(child);
        if (!far) {
          outcome.candidates.push({
            node: child,
            note: `link ${device.label}–${next.label} has no port binding on ${next.label}: gateway not verified`,
          });
        }
        continue;
      }

      if (role === 'router') {
        // No interface addresses: answers on its device-level address, lets the rest through
        if (next.ip === wantIp) {
          if (answer()) return outcome;
          continue;
        }
        outcome.candidates.push({
          node: child,
          note: `${next.label} has no interface addresses: gateway and routing not verified`,
        });
        enqueue(child);
        continue;
      }

      const ownsHere = far?.ip ? far.ip === wantIp : ownedAddresses(next).includes(wantIp);
      if (ownsHere) {
        if (answer()) return outcome;
        continue;
      }
      if (role === 'passthrough') {
        if (isInternetLike(next)) {
          outcome.candidates.push({
            node: child,
            note: `${wantIp} is not in the drawing: ${next.label} assumed to take the traffic`,
          });
        }
        child.notes.push(`${next.label} is not simulated: traffic assumed to pass`);
        enqueue(child);
        continue;
      }
      outcome.hosts.push(child);
    }
  }
  return outcome;
}

/** Hops and notes of the way to `node`, sender excluded */
function describePath(node: Node): { hops: L2Hop[]; notes: string[] } {
  const path = nodePath(node);
  const hops: L2Hop[] = [];
  const notes: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const current = path[i];
    if (current.unbound) notes.push(current.unbound);
    // What the previous device decided on this way out belongs to its hop
    if (i > 1) hops[hops.length - 1].notes.push(...current.exitNotes);
    notes.push(...current.exitNotes, ...current.notes);
    hops.push({
      device: current.device,
      notes: [...current.tags, ...current.notes],
      link: current.link,
    });
  }
  return { hops, notes };
}

function success(node: Node, match: L2Success['match'], leadNotes: string[] = []): L2Success {
  const path = nodePath(node);
  const { hops, notes } = describePath(node);
  return {
    ok: true,
    device: node.device,
    link: node.link,
    arrival: node.arrival,
    departure: path[1]?.departure,
    transit: hops.slice(0, -1),
    notes: [...leadNotes, ...notes],
    match,
  };
}

function failure(reason: string, node: Node | undefined): L2Failure {
  if (!node) return { ok: false, reason, path: [], notes: [] };
  const { hops, notes } = describePath(node);
  return { ok: false, reason, path: hops, notes };
}

/** Shortest physical way from the sender to `targetId`, as device ids (sender first) */
function physicalRoute(request: L2Request, targetId: string): string[] | undefined {
  const { topo, from } = request;
  const adjacency = buildAdjacency(topo);
  const allowedStart = startLinks(request);
  const parents = new Map<string, string>();
  const visited = new Set([from.id]);
  const queue = [from.id];
  for (let head = 0; head < queue.length; head++) {
    const currentId = queue[head];
    for (const { neighborId, connection } of adjacency.get(currentId) ?? []) {
      if (currentId === from.id && !allowedStart.has(connection.id)) continue;
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      parents.set(neighborId, currentId);
      if (neighborId === targetId) {
        const route = [targetId];
        while (route[0] !== from.id) route.unshift(parents.get(route[0]) as string);
        return route;
      }
      queue.push(neighborId);
    }
  }
  return undefined;
}

/**
 * The entry of `items` that happened earliest along `route`, counting only
 * what happened on a cable of the route itself (a drop on a side branch says
 * nothing about the way to the destination). Between entries on the same
 * stretch — parallel cables — the first one `prefer` picks, else the first.
 */
function firstOnRoute<T>(
  items: T[],
  linkOf: (item: T) => NetworkConnection | undefined,
  route: string[] | undefined,
  prefer: (item: T) => boolean = () => false
): T | undefined {
  if (!route) return undefined;
  /** Position of the cable along the route, -1 when it is not part of it */
  const stretch = (link: NetworkConnection | undefined): number => {
    if (!link) return -1;
    for (let i = 0; i + 1 < route.length; i++) {
      const [a, b] = [route[i], route[i + 1]];
      if ((link.source === a && link.target === b) || (link.source === b && link.target === a)) {
        return i;
      }
    }
    return -1;
  };

  let best: T | undefined;
  let bestIndex = Infinity;
  for (const item of items) {
    const index = stretch(linkOf(item));
    if (index < 0 || index > bestIndex) continue;
    if (index < bestIndex || (best !== undefined && !prefer(best) && prefer(item))) {
      best = item;
      bestIndex = index;
    }
  }
  return best;
}

/** Why a gateway address is not the one of the router interface the frame reached */
function gatewayMismatch(request: L2Request, router: Node): string {
  const { sender } = request;
  const arrival = router.arrival;
  const where = arrival ? `${router.device.label} ${arrival.label}` : router.device.label;
  if (!arrival?.ip) return `${sender.uses}, but ${where} on its link has no IP address`;
  if (!isValidIP(sender.ip) || !areSameNetwork(arrival.ip, sender.ip, sender.mask)) {
    const network = getNetworkAddress(sender.ip, sender.mask);
    return `${sender.uses}, but ${where} is ${arrival.ip}, outside its network ${network}`;
  }
  return `${sender.uses}, but ${where} on its network is ${arrival.ip}`;
}

/** Turn a search that found nobody into the most useful explanation */
function explain(request: L2Request, outcome: WalkOutcome): L2Failure {
  const { topo, from, wantIp, purpose, target, sender } = request;
  const arrivalLink = (node: Node) => node.link;

  // Who should have answered, and the way there on the drawing
  const owner =
    purpose === 'deliver'
      ? target
      : topo.devices.find(d => d.id !== from.id && ownedAddresses(d).includes(wantIp));
  const route = owner ? physicalRoute(request, owner.id) : undefined;
  // The cables plugged into the interface that carries the address
  const ownerLinks = new Set(
    owner
      ? topo.connections
          .filter(connection => boundInterface(connection, owner)?.ip === wantIp)
          .map(connection => connection.id)
      : []
  );

  // 1. Something on that way dropped the frame
  const dropped = firstOnRoute(
    outcome.drops,
    drop => drop.link,
    route,
    drop => drop.link !== undefined && ownerLinks.has(drop.link.id)
  );
  if (dropped) return failure(dropped.reason, dropped.node);

  // 2. An end device sits in the way
  const blockingHost = firstOnRoute(
    outcome.hosts.filter(host => host.device.id !== owner?.id),
    arrivalLink,
    route
  );
  if (blockingHost) {
    return failure(
      `${blockingHost.device.label} is an end device: it does not forward traffic for others`,
      blockingHost
    );
  }

  if (purpose === 'deliver') {
    // 3. A router sits between two devices addressed in one network
    const blockingRouter = firstOnRoute(outcome.routers, arrivalLink, route);
    if (blockingRouter) {
      return failure(
        `${target.label} (${wantIp}) is addressed inside the network of ${from.label} but sits ` +
          `behind ${blockingRouter.device.label}: a router does not pass traffic within one network`,
        blockingRouter
      );
    }
  } else {
    // 3. A router is there, on another address
    const router = firstOnRoute(outcome.routers, arrivalLink, route) ?? outcome.routers[0];
    if (router) return failure(gatewayMismatch(request, router), undefined);

    // 4. Nothing on this network can route at all, and the destination is right here
    const targetHere = outcome.hosts.find(host => host.device.id === target.id);
    const { destinationIp } = request.packet;
    if (targetHere && isValidIP(destinationIp) && isValidIP(sender.ip)) {
      const sourceNet = getNetworkAddress(sender.ip, sender.mask);
      const targetNet = getNetworkAddress(destinationIp, targetMask(target, destinationIp));
      return failure(
        `no router between subnets ${sourceNet} and ${targetNet} — L2 devices cannot route`,
        targetHere.prev?.prev ? targetHere.prev : undefined
      );
    }
  }

  // 5. Whatever was dropped anywhere, else nobody is there
  if (outcome.drops.length > 0) return failure(outcome.drops[0].reason, outcome.drops[0].node);
  return failure(
    purpose === 'deliver'
      ? `${target.label} (${wantIp}) does not answer on the network of ${from.label}`
      : `${sender.uses}: no device has that address on its network`,
    undefined
  );
}

/** Mask of the interface of `device` that carries `ip`, else its device-level mask */
function targetMask(device: NetworkDevice, ip: string): string {
  const iface = listInterfaces(device).find(candidate => candidate.ip === ip);
  return iface?.subnet || device.subnet || '255.255.255.0';
}

/**
 * Find the device that answers for `request.wantIp` on the sender's network.
 * For a gateway (`next-hop`), a device that cannot be verified is accepted
 * with a note; see the header.
 */
export function resolveOnLink(request: L2Request): L2Result {
  if (request.egress && startLinks(request).size === 0) {
    return failure(`${interfaceOn(request.egress, request.from)} has no cable attached`, undefined);
  }
  const outcome = walk(request);
  if (outcome.found) return success(outcome.found, 'address');

  if (request.purpose === 'next-hop' && outcome.candidates.length > 0) {
    const { node, note } = outcome.candidates[0];
    return success(node, 'unverified', [note]);
  }
  return explain(request, outcome);
}

/**
 * Forwarding by a device that cannot decide where the packet goes (a router
 * without interface addresses, the Internet symbol): the packet is assumed
 * to travel towards its destination along the drawing. It is delivered when
 * the destination is on this side of every addressed router; otherwise it is
 * handed to the addressed router closest to the destination, which routes it
 * properly from there.
 */
export function forwardAssumed(request: L2Request): L2Result {
  const outcome = walk({ ...request, purpose: 'deliver' });
  if (outcome.found) return success(outcome.found, 'address');

  if (outcome.routers.length > 0) {
    // "Closest" over what works: a router cut off from the destination by a
    // simulated failure is not the one the packet is handed to
    const distances = hopDistances(request.topo, request.target.id, { workingOnly: true });
    let chosen = outcome.routers[0];
    for (const router of outcome.routers.slice(1)) {
      const best = distances.get(chosen.device.id) ?? Infinity;
      if ((distances.get(router.device.id) ?? Infinity) < best) chosen = router;
    }
    return success(chosen, 'handover');
  }
  return explain({ ...request, purpose: 'deliver' }, outcome);
}

/**
 * Hop distances from `originId` to every device reachable on the drawing.
 * With `workingOnly`, cables that are cut and devices that are down (see
 * ./failures) are not crossed.
 */
function hopDistances(
  topo: Topology,
  originId: string,
  options: { workingOnly?: boolean } = {}
): Map<string, number> {
  const adjacency = buildAdjacency(topo);
  const distances = new Map<string, number>([[originId, 0]]);
  const queue = [originId];
  for (let head = 0; head < queue.length; head++) {
    const currentId = queue[head];
    const distance = distances.get(currentId) ?? 0;
    for (const { neighborId, connection } of adjacency.get(currentId) ?? []) {
      if (distances.has(neighborId)) continue;
      if (
        options.workingOnly &&
        (isLinkCut(topo, connection.id) || isDeviceDown(topo, neighborId))
      ) {
        continue;
      }
      distances.set(neighborId, distance + 1);
      queue.push(neighborId);
    }
  }
  return distances;
}

/** True when the two devices are joined by cables at all */
export function physicallyConnected(topo: Topology, sourceId: string, targetId: string): boolean {
  return hopDistances(topo, sourceId).has(targetId);
}
