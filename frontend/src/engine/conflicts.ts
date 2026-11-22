/**
 * Network Engine — Address conflicts
 *
 * An address written on two devices at once is in conflict, as on a real
 * network when a machine is cloned with its address: whoever asks for it may
 * be answered by either of the two, so nothing sent to it, or from it, can
 * be trusted. The engine says so instead of picking one (see ./trace).
 *
 * Which addresses count:
 *
 *  - every address written by hand on an interface that is switched on (a
 *    port, a card) and the address of the device itself; an interface
 *    switched off answers nobody;
 *  - not a lease: a DHCP server hands out only addresses that nobody it
 *    meets has (see ./dhcp and addressesMeet), so a leased address is never
 *    in conflict;
 *  - not 0.0.0.0, not a loopback address (127.0.0.0/8), not what is not an
 *    address; a device that has one address twice (its own address is the
 *    one of its first card) holds it once.
 *
 * When two devices that have the same address collide:
 *
 *  - a public address is unique on the Internet: two devices that have it
 *    are in conflict wherever they are on the board;
 *  - a private address is in conflict unless the public Internet stands
 *    between the two: they are joined only through Internet symbols (see
 *    isPublicInternet, all of them one Internet), which carry no private
 *    address, so each is in a private network of its own, as two offices
 *    behind their own NAT can both have 192.168.1.10;
 *  - two devices not joined at all are taken to be in one network: a device
 *    not cabled yet, like a copy just pasted, is to be plugged in next to
 *    the others.
 *
 * Simulated failures do not count: a conflict is in how the devices are
 * set, as a lease is.
 *
 * Pure and deterministic: no React, no Zustand, no side effects. The result
 * for a drawing is kept for as long as the drawing is (see addressConflicts).
 */

import type { NetworkConnection, NetworkDevice } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Topology } from './types';
import { listInterfaces } from './interfaces';
import { isPublicInternet } from './topology';
import { isPrivateAddress } from './nat';

/** One address in conflict, and the devices that have it */
export interface AddressConflict {
  ip: string;
  /** Every device that has it and collides with another, in drawing order */
  devices: NetworkDevice[];
}

/** Every conflict of a drawing */
export interface AddressConflicts {
  /** By address, in the order the addresses are first met in the drawing */
  list: AddressConflict[];
  /**
   * By device id, then by address: the devices it collides with there,
   * itself included, in drawing order
   */
  byDevice: Map<string, Map<string, NetworkDevice[]>>;
}

/** True for an address that can collide: a valid one, not 0.0.0.0, not a loopback one */
function counts(ip: string): boolean {
  return isValidIP(ip) && ip !== '0.0.0.0' && !ip.startsWith('127.');
}

/**
 * The addresses a device answers to, each once: those of its interfaces
 * that are switched on, and its own address unless it is the one of an
 * interface switched off (the mirror of a card that is off)
 */
export function heldAddresses(device: NetworkDevice): string[] {
  const held: string[] = [];
  const off = new Set<string>();
  for (const iface of listInterfaces(device)) {
    if (iface.ip === '') continue;
    if (iface.enabled) held.push(iface.ip);
    else off.add(iface.ip);
  }
  if (device.ip && !off.has(device.ip)) held.push(device.ip);
  return [...new Set(held)].filter(counts);
}

/** Groups of devices, joined two at a time */
function groups(size: number) {
  const parent = Array.from({ length: size }, (_, index) => index);
  const root = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  return {
    join: (a: number, b: number) => {
      parent[root(a)] = root(b);
    },
    same: (a: number, b: number) => root(a) === root(b),
  };
}

/**
 * Which devices of a drawing are joined only through the Internet, by their
 * place in `devices`: each is in a private network of its own, where a
 * private address of the other side is not met
 */
function apartness(
  devices: NetworkDevice[],
  connections: NetworkConnection[]
): (a: number, b: number) => boolean {
  // The board, the Internet symbols one Internet; and the board without
  // them, where the private networks on their different sides fall apart
  const index = new Map(devices.map((device, at) => [device.id, at] as const));
  const internet = devices.flatMap((device, at) => (isPublicInternet(device) ? [at] : []));
  const whole = groups(devices.length);
  const inside = groups(devices.length);
  for (const other of internet.slice(1)) whole.join(internet[0], other);
  for (const connection of connections) {
    const a = index.get(connection.source);
    const b = index.get(connection.target);
    if (a === undefined || b === undefined) continue;
    whole.join(a, b);
    if (!isPublicInternet(devices[a]) && !isPublicInternet(devices[b])) inside.join(a, b);
  }
  return (a, b) => whole.same(a, b) && !inside.same(a, b);
}

/**
 * Whether two devices of a drawing meet over an address, by their ids: two
 * devices that both have it are in conflict exactly when they meet (see the
 * header). A public address meets everywhere; a private one does not
 * between two devices joined only through the Internet symbols. A device
 * meets itself. The DHCP pools keep away from the addresses they meet (see
 * ./dhcp), so that a lease is never in conflict.
 */
export function addressesMeet(topo: Topology): (a: string, b: string, ip: string) => boolean {
  const index = new Map(topo.devices.map((device, at) => [device.id, at] as const));
  const apart = apartness(topo.devices, topo.connections);
  return (a, b, ip) => {
    if (a === b || !isPrivateAddress(ip)) return true;
    const at = index.get(a);
    const other = index.get(b);
    return at === undefined || other === undefined || !apart(at, other);
  };
}

function find(devices: NetworkDevice[], connections: NetworkConnection[]): AddressConflicts {
  const list: AddressConflict[] = [];
  const byDevice = new Map<string, Map<string, NetworkDevice[]>>();

  const holders = new Map<string, number[]>();
  devices.forEach((device, index) => {
    for (const ip of heldAddresses(device)) {
      const known = holders.get(ip);
      if (known) known.push(index);
      else holders.set(ip, [index]);
    }
  });
  const shared = [...holders].filter(([, indices]) => indices.length > 1);
  if (shared.length === 0) return { list, byDevice };

  /** Joined only through the Internet: each in a private network of its own */
  const apart = apartness(devices, connections);

  for (const [ip, indices] of shared) {
    const privateAddress = isPrivateAddress(ip);
    const meets = new Map<number, number[]>();
    for (const a of indices) {
      for (const b of indices) {
        if (a === b || (privateAddress && apart(a, b))) continue;
        meets.set(a, [...(meets.get(a) ?? []), b]);
      }
    }
    if (meets.size === 0) continue;
    for (const [a, others] of meets) {
      const together = [a, ...others].sort((x, y) => x - y).map((at) => devices[at]);
      const ofDevice = byDevice.get(devices[a].id) ?? new Map<string, NetworkDevice[]>();
      ofDevice.set(ip, together);
      byDevice.set(devices[a].id, ofDevice);
    }
    list.push({ ip, devices: [...meets.keys()].sort((x, y) => x - y).map((at) => devices[at]) });
  }
  return { list, byDevice };
}

/** What was worked out for a drawing, for as long as the drawing is around */
const known = new WeakMap<NetworkDevice[], { connections: NetworkConnection[]; conflicts: AddressConflicts }>();

/**
 * Every address in conflict in a drawing (see the header). The result is
 * kept by the identity of the two lists of the drawing, which the
 * application never changes in place.
 */
export function addressConflicts(topo: Topology): AddressConflicts {
  const kept = known.get(topo.devices);
  if (kept && kept.connections === topo.connections) return kept.conflicts;
  const conflicts = find(topo.devices, topo.connections);
  known.set(topo.devices, { connections: topo.connections, conflicts });
  return conflicts;
}

/**
 * The devices `deviceId` shares `ip` with, itself included, in drawing
 * order; undefined when the address is in no conflict there
 */
export function conflictOf(topo: Topology, deviceId: string, ip: string): NetworkDevice[] | undefined {
  return addressConflicts(topo).byDevice.get(deviceId)?.get(ip);
}

/** `address conflict: 10.0.0.5 is on both A and B, so the answer cannot be trusted` */
export function conflictReason(ip: string, devices: NetworkDevice[]): string {
  const names = devices.map((device) => device.label);
  const last = names[names.length - 1];
  const who =
    names.length === 2 ? `both ${names[0]} and ${last}` : `${names.slice(0, -1).join(', ')} and ${last}`;
  return `address conflict: ${ip} is on ${who}, so the answer cannot be trusted`;
}

/** The reason a question meets at `ip` of `deviceId`; undefined when it is in no conflict there */
export function conflictAt(topo: Topology, deviceId: string, ip: string): string | undefined {
  const devices = conflictOf(topo, deviceId, ip);
  return devices ? conflictReason(ip, devices) : undefined;
}
