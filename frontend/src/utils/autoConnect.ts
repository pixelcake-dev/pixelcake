/**
 * The automatic connection (Vista → Collega i dispositivi senza cavo): a
 * cable for each device that has none, where a network engineer would put
 * it, and nothing else.
 *
 * 1. An end device with no cable goes to the nearest switch of its own
 *    network. An access point is one of them, and is cabled before the
 *    devices on its Wi-Fi, so that its first card stays its cable.
 * 2. A laptop, a smartphone or a tablet with no cable goes to the nearest
 *    access point of its network with a radio card free, else to a switch.
 * 3. A group of devices cabled together with no router, firewall or Internet
 *    in it gets one cable up: an access point with only its Wi-Fi devices to
 *    the nearest switch of its network; a group with switches (one switch
 *    with its devices, or several) from the switch of it nearest to a router,
 *    a firewall or a core switch (a switch cabled to a router or a firewall)
 *    of its network. One cable for the whole group: never one that closes a
 *    loop, since every cable added joins two groups.
 *
 * The network of a device is the one of its addresses (address and mask). A
 * switch is on the networks of what is cabled to it (the addresses of its end
 * devices, of the router ports its cables end on) and of the VLANs set on its
 * ports, known by the cables of the drawing that join a port in a VLAN to an
 * address; while one of its VLANs is not known that way, it may be on any
 * other network as well. With none of these, a switch with no VLANs set is on
 * the network of its own address; one with VLANs, or with no address, may be
 * on any (the address of a switch with VLANs is the one it is managed at). A
 * device on DHCP may be on any network too: it goes by distance alone.
 *
 * A cable takes a free interface meant for it: on a switch, a port in the
 * VLAN of the device's network, or one with nothing set on it, never a port
 * of another network's VLAN; on a router or a firewall, a port with an address
 * on the switch's network, or one with none, never another network's gateway.
 * End devices take the first such port of a switch, uplinks its trunk port or
 * else its last free one. A firewall whose ports carry zones gets its cable
 * with its end not bound: the port, and with it the zone, is the user's to
 * choose (engine/interfaces.ts, requiresExplicitBinding).
 *
 * Never cabled automatically: routers and firewalls between themselves, the
 * Internet, end devices between themselves. No cable is given a name. Among
 * the devices waiting for a cable, the one nearest to where it can go is
 * cabled first, so that the last free ports go to the nearest.
 *
 * What is left alone is said, with the reason. Pure: the cables to add and
 * the devices left alone are handed back, nothing is changed.
 */

import type { ConnectionType, NetworkConnection, NetworkDevice, Port } from '@/types';
import {
  type ConnectionEnd,
  type DeviceInterface,
  boundInterface,
  listInterfaces,
  normalizeBindings,
  requiresExplicitBinding,
  usedInterfaceKeys,
} from '@/engine';
import { getNetworkAddress, isValidIP } from './ipHelpers';

/** Why a device was given no cable */
export type LeftAloneReason =
  /** an end device: no switch of its network (nor access point) */
  | 'noSwitch'
  /** a switch with no cable: no router, firewall or core switch of its network */
  | 'noUplink'
  /** where it could go, no port is free for it (or none of its own) */
  | 'noFreePort'
  /** a router, a firewall or the Internet with no cable: cabled by hand */
  | 'byHand';

export interface LeftAlone {
  deviceId: string;
  reason: LeftAloneReason;
}

/** What the menu says afterwards: how many cables, and who was left alone */
export interface ConnectionSummary {
  added: number;
  left: LeftAlone[];
}

export interface LooseDevicesConnected {
  /** The new cables, bound to the interfaces they take */
  connections: NetworkConnection[];
  /** The devices that still have no cable, or no way up, and why */
  left: LeftAlone[];
  /** The connection counter after the ids taken */
  nextCounter: number;
}

/** Cabled by hand, never automatically */
const BY_HAND = new Set(['Router', 'Firewall', 'Cloud']);
/** Where a switch takes its uplink (a cloud is the Internet: by hand) */
const UPLINK = new Set(['Router', 'Firewall']);
/** What goes on the Wi-Fi when there is an access point for it */
const WIRELESS = new Set(['tpl-laptop', 'tpl-smartphone', 'tpl-tablet']);
const DEFAULT_MASK = '255.255.255.0';

const isSwitch = (device: NetworkDevice) => device.type === 'Switch';
const isEndDevice = (device: NetworkDevice) => !isSwitch(device) && !BY_HAND.has(device.type);
const isAccessPoint = (device: NetworkDevice) =>
  device.type === 'AccessPoint' && device.templateId !== 'tpl-iotgateway';
const isWireless = (device: NetworkDevice) =>
  isEndDevice(device) && device.templateId !== undefined && WIRELESS.has(device.templateId);

interface Address {
  ip: string;
  mask: string;
}

/**
 * The networks a device is on: those its addresses tell, and whether it may
 * be on others too (nothing to tell them by, or a VLAN nothing tells yet)
 */
interface Networks {
  known: Address[];
  open: boolean;
}

function addressOf(ip: string | undefined, mask: string | undefined): Address | undefined {
  if (!ip || !isValidIP(ip)) return undefined;
  return { ip, mask: mask && isValidIP(mask) ? mask : DEFAULT_MASK };
}

const known = (list: Array<Address | undefined>): Address[] =>
  list.filter((one): one is Address => one !== undefined);

/**
 * The addresses a device has of its own: its cards' (not those on DHCP:
 * they take theirs from where they are cabled), else its ports' and the
 * address it has as a device.
 */
function ownAddresses(device: NetworkDevice): Address[] {
  if (device.nics && device.nics.length > 0) {
    return known(device.nics.filter((card) => !card.dhcp).map((card) => addressOf(card.ip, card.subnet)));
  }
  return known([
    ...(device.ports ?? []).map((one) => addressOf(one.ip, one.subnet)),
    addressOf(device.ip, device.subnet),
  ]);
}

/** Two addresses on one network, as the mask of either one sees it */
function sameNetwork(a: Address, b: Address): boolean {
  return (
    getNetworkAddress(a.ip, a.mask) === getNetworkAddress(b.ip, a.mask) ||
    getNetworkAddress(a.ip, b.mask) === getNetworkAddress(b.ip, b.mask)
  );
}

const overlap = (a: Address[], b: Address[]) => a.some((one) => b.some((other) => sameNetwork(one, other)));

/** Two devices that may be on one network */
const share = (a: Networks, b: Networks) => a.open || b.open || overlap(a.known, b.known);

/** How well an interface on `addresses` suits a cable toward `toward`: 0 meant for it, 2 maybe, undefined not */
const fits = (addresses: Address[], toward: Networks): 0 | 2 | undefined =>
  overlap(addresses, toward.known) ? 0 : toward.open || toward.known.length === 0 ? 2 : undefined;

/** The one VLAN of a port in access mode (none on a trunk port, or with none set) */
function accessVlan(port: Port): number | undefined {
  if (port.portType === 'trunk') return undefined;
  if (typeof port.vlan === 'number') return port.vlan;
  return Array.isArray(port.vlan) && port.vlan.length === 1 ? port.vlan[0] : undefined;
}

/** Every VLAN set on a port: its own, or those its trunk carries */
const vlansOf = (port: Port): number[] =>
  port.vlan === undefined ? [] : Array.isArray(port.vlan) ? port.vlan : [port.vlan];

const distance = (a: NetworkDevice, b: NetworkDevice) =>
  Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);

/** The sides a new cable ends on: facing each other, from the upper device */
function sidesFor(upper: NetworkDevice, lower: NetworkDevice): Pick<NetworkConnection, 'sourceHandle' | 'targetHandle'> {
  const dx = lower.position.x - upper.position.x;
  const dy = lower.position.y - upper.position.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'top', targetHandle: 'bottom' };
  }
  return dx >= 0 ? { sourceHandle: 'right', targetHandle: 'left' } : { sourceHandle: 'left', targetHandle: 'right' };
}

/** The binding field of one end (none when the end is left unbound) */
function bound(end: ConnectionEnd, iface: DeviceInterface | undefined): Partial<NetworkConnection> {
  if (!iface) return {};
  if (end === 'source') return iface.kind === 'port' ? { sourcePort: iface.port.id } : { sourceNic: iface.nic.id };
  return iface.kind === 'port' ? { targetPort: iface.port.id } : { targetNic: iface.nic.id };
}

/** Room for a cable on a device: the interface it takes, none when it stays unbound */
interface Room {
  iface: DeviceInterface | undefined;
}

/** A cable to make: from `upper` down to `lower`, on these interfaces */
interface Choice {
  upper: NetworkDevice;
  lower: NetworkDevice;
  upperEnd: Room;
  lowerEnd: Room;
  distance: number;
}

/** The drawing as the cables are added: who is cabled to whom, what is taken */
class Board {
  private readonly byId: Map<string, NetworkDevice>;
  private readonly order: Map<string, number>;
  readonly connections: NetworkConnection[];
  readonly added: NetworkConnection[] = [];
  /** VLAN → the addresses its ports are cabled to; made again after each cable */
  private vlanNetworks: Map<number, Address[]> | undefined;

  constructor(devices: NetworkDevice[], existing: NetworkConnection[]) {
    this.byId = new Map(devices.map((device) => [device.id, device]));
    this.order = new Map(devices.map((device, index) => [device.id, index]));
    // The cables as the board keeps them: each end on its interface
    this.connections = normalizeBindings(
      devices,
      existing.filter((one) => this.byId.has(one.source) && this.byId.has(one.target))
    ).slice();
  }

  rank = (device: NetworkDevice) => this.order.get(device.id) ?? 0;

  cablesOf = (device: NetworkDevice) =>
    this.connections.filter((one) => one.source === device.id || one.target === device.id);

  private peerOf(connection: NetworkConnection, device: NetworkDevice): NetworkDevice | undefined {
    return this.byId.get(connection.source === device.id ? connection.target : connection.source);
  }

  /** A switch cabled to a router or a firewall */
  isCore = (device: NetworkDevice) =>
    isSwitch(device) && this.cablesOf(device).some((one) => UPLINK.has(this.peerOf(one, device)?.type ?? ''));

  /** The devices cabled together, group by group, in the order of the drawing */
  groups(): NetworkDevice[][] {
    const seen = new Set<string>();
    const found: NetworkDevice[][] = [];
    for (const start of this.byId.values()) {
      if (seen.has(start.id)) continue;
      const group = [start];
      seen.add(start.id);
      for (let index = 0; index < group.length; index += 1) {
        for (const one of this.cablesOf(group[index])) {
          const peer = this.peerOf(one, group[index]);
          if (peer && !seen.has(peer.id)) {
            seen.add(peer.id);
            group.push(peer);
          }
        }
      }
      found.push(group);
    }
    return found;
  }

  /** The address on the far end of a cable from a switch: an end device's, or a router port's */
  private addressesBeyond(connection: NetworkConnection, device: NetworkDevice): Address[] {
    const peer = this.peerOf(connection, device);
    if (!peer) return [];
    if (isEndDevice(peer)) return ownAddresses(peer);
    if (!UPLINK.has(peer.type)) return [];
    const iface = boundInterface(connection, peer);
    return known([addressOf(iface?.ip, iface?.subnet)]);
  }

  /** Which network each VLAN is, by the cables from a port in it to an address */
  private vlans(): Map<number, Address[]> {
    if (this.vlanNetworks) return this.vlanNetworks;
    const map = new Map<number, Address[]>();
    for (const one of this.connections) {
      for (const end of ['source', 'target'] as const) {
        const device = this.byId.get(end === 'source' ? one.source : one.target);
        if (!device || !isSwitch(device)) continue;
        const iface = boundInterface(one, device, end);
        const vlan = iface?.kind === 'port' ? accessVlan(iface.port) : undefined;
        if (vlan === undefined) continue;
        map.set(vlan, [...(map.get(vlan) ?? []), ...this.addressesBeyond(one, device)]);
      }
    }
    this.vlanNetworks = map;
    return map;
  }

  /** The networks a device is on (see the top of this file) */
  networksOf(device: NetworkDevice): Networks {
    const own = ownAddresses(device);
    if (!isSwitch(device)) return { known: own, open: own.length === 0 };
    const reached = this.cablesOf(device).flatMap((one) => this.addressesBeyond(one, device));
    // (VLAN 1 is where every port starts: not one set apart)
    const vlans = [...new Set((device.ports ?? []).flatMap(vlansOf))].filter((vlan) => vlan !== 1);
    const ofVlans = vlans.flatMap((vlan) => this.vlans().get(vlan) ?? []);
    // (a VLAN whose network nothing tells yet may be any)
    const untold = vlans.some((vlan) => (this.vlans().get(vlan) ?? []).length === 0);
    if (reached.length > 0 || ofVlans.length > 0) return { known: [...reached, ...ofVlans], open: untold };
    if (vlans.length > 0) return { known: [], open: true };
    return { known: own, open: own.length === 0 };
  }

  /**
   * How well a free port of `device` suits a cable to `peer`, whose end is on
   * `toward`: 0 meant for it, higher less so; undefined when it is meant for
   * another network
   */
  private suits(device: NetworkDevice, port: Port, peer: NetworkDevice, toward: Networks): number | undefined {
    if (UPLINK.has(device.type)) {
      const address = addressOf(port.ip, port.subnet);
      return address ? fits([address], toward) : 1;
    }
    if (!isSwitch(device)) return 1;
    const trunk = port.portType === 'trunk';
    const vlan = accessVlan(port);
    if (isSwitch(peer)) return trunk ? 0 : vlan === undefined ? 1 : 2;
    if (trunk) return UPLINK.has(peer.type) ? 0 : 3;
    const vlanNetworks = vlan === undefined ? [] : (this.vlans().get(vlan) ?? []);
    return vlanNetworks.length > 0 ? fits(vlanNetworks, toward) : 1;
  }

  /**
   * Room on `device` for a cable to `peer`, or none: the interface it takes
   * (no interface on a device that has none, nor on a firewall with zones,
   * where the user chooses it)
   */
  roomOn(device: NetworkDevice, peer: NetworkDevice, toward: Networks): Room | undefined {
    if (requiresExplicitBinding(device)) {
      // (each cable on it takes a port, bound or still to be chosen)
      return (device.ports ?? []).length > this.cablesOf(device).length ? { iface: undefined } : undefined;
    }
    const interfaces = listInterfaces(device);
    if (interfaces.length === 0) return { iface: undefined };
    const used = usedInterfaceKeys(device, this.connections);
    // An uplink of a switch from its last ports, its devices from the first
    const fromTheEnd = isSwitch(device) && (isSwitch(peer) || UPLINK.has(peer.type));
    const ranked = interfaces
      .filter((iface) => !used.has(iface.key))
      .map((iface) => ({ iface, score: iface.kind === 'port' ? this.suits(device, iface.port, peer, toward) : 0 }))
      .filter((one): one is { iface: DeviceInterface; score: number } => one.score !== undefined)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (a.iface.enabled !== b.iface.enabled) return a.iface.enabled ? -1 : 1;
        if (a.iface.kind === 'port' && b.iface.kind === 'port') {
          return fromTheEnd ? b.iface.port.id - a.iface.port.id : a.iface.port.id - b.iface.port.id;
        }
        return 0;
      });
    return ranked.length > 0 ? { iface: ranked[0].iface } : undefined;
  }

  /** The cable from `upper` down to `lower`, on interfaces meant for it; none when either has no room */
  choiceFor(upper: NetworkDevice, lower: NetworkDevice): Choice | undefined {
    const upperEnd = this.roomOn(upper, lower, this.networksOf(lower));
    if (!upperEnd) return undefined;
    // (the lower end goes with the network of the port it is cabled to, where it has one)
    const upperAddress = addressOf(upperEnd.iface?.ip, upperEnd.iface?.subnet);
    const toward = upperAddress ? { known: [upperAddress], open: false } : this.networksOf(upper);
    const lowerEnd = this.roomOn(lower, upper, toward);
    if (!lowerEnd) return undefined;
    return { upper, lower, upperEnd, lowerEnd, distance: distance(upper, lower) };
  }

  add(choice: Choice, type: ConnectionType, id: string) {
    const connection: NetworkConnection = {
      id,
      source: choice.upper.id,
      target: choice.lower.id,
      ...sidesFor(choice.upper, choice.lower),
      ...bound('source', choice.upperEnd.iface),
      ...bound('target', choice.lowerEnd.iface),
      type,
    };
    this.connections.push(connection);
    this.added.push(connection);
    this.vlanNetworks = undefined;
  }
}

/** Nearest first; on a tie, the one drawn first */
const nearestFirst = (board: Board) => (a: Choice, b: Choice) =>
  a.distance - b.distance || board.rank(a.lower) - board.rank(b.lower) || board.rank(a.upper) - board.rank(b.upper);

/**
 * Cable the waiting devices one at a time, the one nearest to where it can
 * go first. What can go nowhere is handed back with its reason: 'none' when
 * there was no place of its network at all.
 */
function settle(
  board: Board,
  waiting: NetworkDevice[],
  placesFor: (device: NetworkDevice) => NetworkDevice[],
  nextId: () => string
): Map<string, 'none' | 'noFreePort'> {
  const open = [...waiting];
  const reasons = new Map<string, 'none' | 'noFreePort'>();
  while (open.length > 0) {
    let best: Choice | undefined;
    for (const device of open) {
      const places = placesFor(device);
      const choice = places.map((upper) => board.choiceFor(upper, device)).find((one) => one !== undefined);
      if (!choice) {
        reasons.set(device.id, places.length === 0 ? 'none' : 'noFreePort');
        continue;
      }
      if (!best || nearestFirst(board)(choice, best) < 0) best = choice;
    }
    if (!best) break;
    board.add(best, 'access', nextId());
    reasons.delete(best.lower.id);
    open.splice(open.indexOf(best.lower), 1);
  }
  return reasons;
}

/**
 * One cable up for each group with no router, firewall or Internet: from the
 * group's `members` that are nearest to a place outside it. The nearest
 * group first; what is said of a group that can go nowhere is handed back.
 */
function climb(
  board: Board,
  members: (group: NetworkDevice[]) => NetworkDevice[],
  placesFor: (device: NetworkDevice, group: Set<string>) => NetworkDevice[],
  typeFor: (upper: NetworkDevice) => ConnectionType,
  nextId: () => string
): Map<string, 'none' | 'noFreePort'> {
  for (;;) {
    let best: Choice | undefined;
    const reasons = new Map<string, 'none' | 'noFreePort'>();
    for (const group of board.groups()) {
      if (group.some((device) => BY_HAND.has(device.type))) continue;
      const inGroup = new Set(group.map((device) => device.id));
      const pairs = members(group).flatMap((member) =>
        placesFor(member, inGroup).map((upper) => ({ upper, lower: member, distance: distance(upper, member) }))
      );
      if (pairs.length === 0) {
        for (const member of members(group)) reasons.set(member.id, 'none');
        continue;
      }
      const choices = pairs
        .sort((a, b) => a.distance - b.distance || board.rank(a.lower) - board.rank(b.lower) || board.rank(a.upper) - board.rank(b.upper))
        .map((pair) => ({ pair, choice: board.choiceFor(pair.upper, pair.lower) }));
      const first = choices.find((one) => one.choice !== undefined)?.choice;
      if (!first) {
        // (said of the one of the group nearest to where it could go)
        reasons.set(choices[0].pair.lower.id, 'noFreePort');
        continue;
      }
      if (!best || nearestFirst(board)(first, best) < 0) best = first;
    }
    if (!best) return reasons;
    board.add(best, typeFor(best.upper), nextId());
  }
}

/**
 * The cables for the devices that have none, and for the groups with no way
 * up, and the devices left alone with the reason. `startingCounter` is the
 * store's connection counter: the new ids follow it, skipping any taken.
 */
export function connectLooseDevices(
  devices: NetworkDevice[],
  existing: NetworkConnection[],
  startingCounter: number
): LooseDevicesConnected {
  const board = new Board(devices, existing);
  const taken = new Set(existing.map((one) => one.id));
  let counter = startingCounter;
  const nextId = () => {
    let id = `conn-${counter++}`;
    while (taken.has(id)) id = `conn-${counter++}`;
    taken.add(id);
    return id;
  };

  const loose = devices.filter((device) => board.cablesOf(device).length === 0);
  const left = new Map<string, LeftAloneReason>();
  const nearestTo = (device: NetworkDevice) => (a: NetworkDevice, b: NetworkDevice) =>
    distance(device, a) - distance(device, b) || board.rank(a) - board.rank(b);
  const switches = devices.filter(isSwitch);
  const ofItsNetwork = (device: NetworkDevice, places: NetworkDevice[]) => {
    const networks = board.networksOf(device);
    return places.filter((one) => one.id !== device.id && share(networks, board.networksOf(one))).sort(nearestTo(device));
  };

  // 1. End devices on a cable (the access points among them) to a switch
  const wired = loose.filter((device) => isEndDevice(device) && !isWireless(device));
  for (const [id, reason] of settle(board, wired, (device) => ofItsNetwork(device, switches), nextId)) {
    left.set(id, reason === 'none' ? 'noSwitch' : reason);
  }

  // 2. Laptops, smartphones and tablets to an access point, else to a switch
  const accessPoints = devices.filter(isAccessPoint);
  const wireless = loose.filter(isWireless);
  const radiosFor = (device: NetworkDevice) => [...ofItsNetwork(device, accessPoints), ...ofItsNetwork(device, switches)];
  for (const [id, reason] of settle(board, wireless, radiosFor, nextId)) {
    left.set(id, reason === 'none' ? 'noSwitch' : reason);
  }

  // 3. An access point with only its Wi-Fi devices: to a switch
  const apGroups = climb(
    board,
    (group) => (group.some(isSwitch) ? [] : group.filter(isAccessPoint)),
    (device, group) => ofItsNetwork(device, switches.filter((one) => !group.has(one.id))),
    () => 'access',
    nextId
  );
  for (const [id, reason] of apGroups) {
    // (one with no switch to go to is as it was drawn; one with none at all was said above)
    if (reason === 'noFreePort' && !left.has(id)) left.set(id, reason);
  }

  // 4. Switches with no way up: to a router, a firewall or a core switch
  const ups = devices.filter((device) => UPLINK.has(device.type) || isSwitch(device));
  const switchGroups = climb(
    board,
    (group) => group.filter(isSwitch),
    (device, group) => ofItsNetwork(device, ups.filter((one) => !group.has(one.id) && (UPLINK.has(one.type) || board.isCore(one)))),
    (upper) => (isSwitch(upper) ? 'trunk' : 'uplink'),
    nextId
  );
  for (const [id, reason] of switchGroups) {
    const device = devices.find((one) => one.id === id);
    if (reason === 'noFreePort') left.set(id, reason);
    // A switch with its devices and nowhere to go up to is as it was drawn:
    // only one with no cable at all is said
    else if (device && board.cablesOf(device).length === 0) left.set(id, 'noUplink');
  }

  // 5. Routers, firewalls and the Internet still with no cable: by hand
  for (const device of loose) {
    if (BY_HAND.has(device.type) && board.cablesOf(device).length === 0) left.set(device.id, 'byHand');
  }

  return {
    connections: board.added,
    left: devices
      .filter((device) => left.has(device.id))
      .map((device) => ({ deviceId: device.id, reason: left.get(device.id) as LeftAloneReason })),
    nextCounter: counter,
  };
}
