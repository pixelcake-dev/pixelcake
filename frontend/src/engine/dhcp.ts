/**
 * Network Engine — DHCP
 *
 * Which address every card set to "automatic" has, and which server gave it.
 * The engine has no clock, so a lease is not remembered: it is worked out
 * from the drawing, the same way every time.
 *
 *  - CLIENT: a network card (NIC) with `dhcp` on, on a device that does not
 *    route. Its own ip/subnet/gateway are not read.
 *  - SERVER: one pool per interface, kept on the interface (`dhcpServer`): a
 *    router or firewall port, or a card of a server. It hands out the
 *    addresses from `start` to `end`, with the mask of the interface and a
 *    gateway: the one written in the pool, else the interface's own address
 *    on a router or firewall, else none. A pool may also name a DNS server
 *    (`dns`, any address): the card then asks that server for names, see
 *    ./dns.
 *  - WHO ANSWERS WHOM: a card is served by a pool whose interface hears its
 *    broadcast, that is, sits on the same layer 2 network (see broadcastReach
 *    in ./l2). With more than one in reach, the first in drawing order that
 *    has an address left answers, and a warning names them.
 *  - WHICH ADDRESS: cards are served in drawing order (devices in order,
 *    cards in order); each gets the lowest address of the range that is
 *    free: not the network or broadcast address, and neither written by hand
 *    nor leased already on a device the pool meets. Meeting is the one of
 *    address conflicts (see addressesMeet in ./conflicts): a public address
 *    meets everywhere; a private one is not met on the far side of the
 *    Internet symbol, in another private network behind its own NAT, where
 *    the same address can be handed out again.
 *
 * Simulated failures do not change leases: a lease is the one of the drawing
 * with everything working, as a device keeps the address it had when
 * something breaks.
 *
 * Not simulated: relay (a server giving addresses to another network through
 * a router), reservations, lease times and renewal, router or firewall ports
 * as clients.
 *
 * Pure and deterministic: no React, no Zustand, no side effects. The result
 * for a drawing is kept for as long as the drawing is (see resolveDhcp).
 */

import type { DhcpPool, NetworkConnection, NetworkDevice } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Topology } from './types';
import { listInterfaces } from './interfaces';
import type { DeviceInterface } from './interfaces';
import { isL3Capable, normalizeAddressing } from './topology';
import {
  DEFAULT_MASK,
  formatNetwork,
  ipToNumber,
  networkContains,
  networkOf,
  numberToIp,
  ownedAddresses,
} from './addressing';
import type { Network } from './addressing';
import { broadcastReach } from './l2';
import { addressesMeet } from './conflicts';

/** A pool, by the interface it is on */
export interface DhcpServerRef {
  deviceId: string;
  /** `port:2` / `nic:nic-1` (see DeviceInterface.key) */
  interfaceKey: string;
}

/** The address a card was given */
export interface DhcpLease {
  deviceId: string;
  nicId: string;
  ip: string;
  mask: string;
  /** '' when the pool hands out none */
  gateway: string;
  /** The DNS server handed out with the address, when the pool names one */
  dns?: string;
  server: DhcpServerRef;
}

/**
 * Why a card on DHCP has no address:
 *
 *  - routes:     its device is a router or a firewall
 *  - disabled:   the card is switched off
 *  - no-cable:   nothing is plugged into it
 *  - no-server:  no pool hears it
 *  - unattached: a server hears it on a cable that is not attached to one of
 *                its interfaces, so which pool answers is not known
 *  - unusable:   the pool that hears it cannot work as written
 *  - used-up:    the pool that hears it has no address left
 */
export type UnservedCause =
  | 'routes'
  | 'disabled'
  | 'no-cable'
  | 'no-server'
  | 'unattached'
  | 'unusable'
  | 'used-up';

/** A card on DHCP that got no address */
export interface DhcpUnserved {
  deviceId: string;
  nicId: string;
  cause: UnservedCause;
  /** The cause in words, to follow "<device> has no address: " */
  reason: string;
  /** The pool the cause is about, when it is about one */
  server?: DhcpServerRef;
}

/**
 * Why a pool cannot work as written:
 *
 *  - no-address: its interface has no (valid) address, so no network
 *  - client:     its card takes its own address from DHCP
 *  - invalid:    `start`, `end`, `gateway` or `dns` is not an address
 *  - outside:    `start`, `end` or `gateway` is not in the network of the
 *                interface (a DNS server may be anywhere)
 *  - reversed:   the range ends before it starts
 */
export type PoolProblemCode = 'no-address' | 'client' | 'invalid' | 'outside' | 'reversed';

export interface PoolProblem {
  code: PoolProblemCode;
  /** The value the problem is about, when it is about one */
  value?: string;
  /** `outside`: the network the value should have been in (`192.168.20.0/24`) */
  network?: string;
  text: string;
}

/** One pool of the drawing, with what became of it */
export interface DhcpPoolState extends DhcpServerRef {
  device: NetworkDevice;
  iface: DeviceInterface;
  pool: DhcpPool;
  /** `Router-Core port 2` / `Srv-Auth eth0` */
  name: string;
  /** Set when the pool cannot work as written: it hands out nothing */
  problem?: PoolProblem;
  /** Mask and gateway handed out ('' for no gateway, and for a pool that cannot work) */
  mask: string;
  gateway: string;
  /** How many addresses of the range can be handed out at all */
  size: number;
  /** How many of them nobody the pool meets has: not written by hand, not leased */
  free: number;
  /** The addresses it handed out, in the order it did */
  leases: DhcpLease[];
}

/** Everything DHCP does in one drawing */
export interface DhcpResolution {
  /**
   * The drawing with every lease filled in: a card on DHCP carries the
   * address, mask, gateway and DNS server it was given (none when it got no
   * lease), and
   * the device-level fields of its device follow, as for any primary card.
   * It is the SAME `devices` array when no card is on DHCP.
   */
  topology: Topology;
  /** In the order they were given */
  leases: DhcpLease[];
  unserved: DhcpUnserved[];
  /** In drawing order: devices in order, ports before cards */
  pools: DhcpPoolState[];
  /** Pools that answer on one and the same network, a group for each such network */
  rivals: DhcpPoolState[][];
  /** Non-fatal observations, in words: one for each group of `rivals` */
  warnings: string[];
}

/** True when the device can hand out addresses: a router, a firewall or a server */
export function servesDhcp(device: NetworkDevice): boolean {
  return isL3Capable(device) || device.type.toLowerCase().includes('server');
}

/** True when the interface is a card that takes its address from a DHCP server */
function isDhcpClient(iface: DeviceInterface): boolean {
  return iface.kind === 'nic' && iface.nic.dhcp === true;
}

/** The pool kept on an interface, if any */
export function poolOf(iface: DeviceInterface): DhcpPool | undefined {
  return iface.kind === 'port' ? iface.port.dhcpServer : iface.nic.dhcpServer;
}

/** How a pool is named in messages: `Router-Core port 2` / `Srv-Auth eth0` */
function poolName(device: NetworkDevice, iface: DeviceInterface): string {
  return `${device.label} ${iface.label}`;
}

/** The network a pool hands out addresses of: the one of its interface */
function poolNetwork(iface: DeviceInterface): { network: Network; mask: string } | undefined {
  if (!isValidIP(iface.ip)) return undefined;
  const mask = iface.subnet || DEFAULT_MASK;
  return { network: networkOf(iface.ip, mask), mask };
}

/** First and last address of a network: its own address and its broadcast address */
function networkEnds(network: Network): { first: number; last: number } {
  const size = network.prefix === 0 ? 2 ** 32 : 2 ** (32 - network.prefix);
  return { first: network.address, last: network.address + size - 1 };
}

/**
 * Why a pool cannot work as written on `iface` of `device`; undefined when it
 * can. A pool that cannot work hands out nothing.
 */
export function poolProblem(
  device: NetworkDevice,
  iface: DeviceInterface,
  pool: DhcpPool
): PoolProblem | undefined {
  const where = `${iface.label} on ${device.label}`;
  if (isDhcpClient(iface)) {
    return {
      code: 'client',
      text: `${where} takes its own address from DHCP: it cannot hand out addresses too`,
    };
  }
  const own = poolNetwork(iface);
  if (!own) {
    return { code: 'no-address', text: `${where} has no address: a pool hands out the network of its interface` };
  }
  const network = formatNetwork(own.network);
  for (const value of [pool.start, pool.end, ...(pool.gateway ? [pool.gateway] : [])]) {
    if (!isValidIP(value)) return { code: 'invalid', value, text: `"${value}" is not an address` };
    if (!networkContains(own.network, value)) {
      return { code: 'outside', value, network, text: `${value} is outside ${network}, the network of ${where}` };
    }
  }
  if (pool.dns && !isValidIP(pool.dns)) {
    return { code: 'invalid', value: pool.dns, text: `"${pool.dns}" is not an address` };
  }
  if (ipToNumber(pool.start) > ipToNumber(pool.end)) {
    return { code: 'reversed', text: `the range ends (${pool.end}) before it starts (${pool.start})` };
  }
  return undefined;
}

/**
 * A range to start from on an interface that has no pool yet: the addresses
 * from .100 to .199 next to the interface's own, when its network has them
 * (a /24 or a larger one); the upper half of a smaller network. The
 * interface's own address is left out when it falls at an end of the range.
 * Undefined when the interface cannot hand out addresses (it has none, or it
 * is a card that takes its own from DHCP) or its network has none to spare.
 * What it gives always passes `poolProblem`.
 */
export function suggestedPool(iface: DeviceInterface): DhcpPool | undefined {
  if (isDhcpClient(iface)) return undefined;
  const own = poolNetwork(iface);
  if (!own) return undefined;
  const { first, last } = networkEnds(own.network);
  // the network's own address and its broadcast address are never handed out
  const lowest = first + 1;
  const highest = last - 1;
  const count = highest - lowest + 1;
  if (count < 1) return undefined;
  const self = ipToNumber(iface.ip);
  let start: number;
  let end: number;
  if (count >= 254) {
    // the block of 256 addresses the interface is in
    const block = self - (self % 256);
    start = block + 100;
    end = block + 199;
  } else {
    start = lowest + Math.floor(count / 2);
    end = highest;
  }
  if (self === start && start < end) start++;
  if (self === end && start < end) end--;
  if (start === end && start === self) {
    // the one address left is the interface's own: another one of its network
    start = end = self === lowest ? highest : lowest;
  }
  return { start: numberToIp(start), end: numberToIp(end) };
}

/** A pool while leases are being given */
interface WorkingPool {
  state: DhcpPoolState;
  /** Lowest address that may still be free; past `end` once the range is used up */
  cursor: number;
  end: number;
  /** Addresses of the range never handed out: the network's own two, the gateway */
  never: Set<number>;
}

/** The pools of a drawing, in drawing order, each with its range worked out */
function findPools(devices: NetworkDevice[]): WorkingPool[] {
  const pools: WorkingPool[] = [];
  for (const device of devices) {
    if (!servesDhcp(device)) continue;
    for (const iface of listInterfaces(device)) {
      const pool = poolOf(iface);
      if (!pool) continue;
      const state: DhcpPoolState = {
        deviceId: device.id,
        interfaceKey: iface.key,
        device,
        iface,
        pool,
        name: poolName(device, iface),
        mask: '',
        gateway: '',
        size: 0,
        free: 0,
        leases: [],
      };
      const problem = poolProblem(device, iface, pool);
      const own = poolNetwork(iface);
      if (problem || !own) {
        if (problem) state.problem = problem;
        pools.push({ state, cursor: 1, end: 0, never: new Set() });
        continue;
      }

      state.mask = own.mask;
      state.gateway = pool.gateway || (isL3Capable(device) ? iface.ip : '');
      const start = ipToNumber(pool.start);
      const end = ipToNumber(pool.end);
      const never = new Set<number>();
      // The first and the last address of a network are not for a device
      // (a point-to-point /31 and a single /32 have no such two)
      if (own.network.prefix < 31) {
        const ends = networkEnds(own.network);
        for (const address of [ends.first, ends.last]) {
          if (address >= start && address <= end) never.add(address);
        }
      }
      if (state.gateway) {
        const gateway = ipToNumber(state.gateway);
        if (gateway >= start && gateway <= end) never.add(gateway);
      }
      state.size = end - start + 1 - never.size;
      pools.push({ state, cursor: start, end, never });
    }
  }
  return pools;
}

/** `two DHCP servers on one network: A and B — …`, for the pools that hear one card */
function rivalsWarning(pools: WorkingPool[]): string {
  const names = pools.map(pool => pool.state.name);
  const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const count = names.length === 2 ? 'two' : String(names.length);
  return `${count} DHCP servers on one network: ${list} — the first that has an address left answers`;
}

/** `… is used up: 100 addresses, all taken`, to follow "<device> has no address: " */
function usedUpReason(pool: DhcpPoolState): string {
  if (pool.size === 0) return `the pool of ${pool.name} has no address to give`;
  const what = pool.size === 1 ? 'its one address is taken' : `${pool.size} addresses, all taken`;
  return `the pool of ${pool.name} is used up: ${what}`;
}

function resolve(drawing: NetworkDevice[], connections: NetworkConnection[]): DhcpResolution {
  const hasClients = drawing.some(device => (device.nics ?? []).some(nic => nic.dhcp));
  // What a card on DHCP carries of its own is not read
  const devices = hasClients
    ? drawing.map(device => ((device.nics ?? []).some(nic => nic.dhcp) ? normalizeAddressing(device) : device))
    : drawing;
  // (leases are those of the drawing with everything working: no failures)
  const topo: Topology = { devices, connections };

  const pools = findPools(devices);
  const leases: DhcpLease[] = [];
  const unserved: DhcpUnserved[] = [];
  const rivals: DhcpPoolState[][] = [];
  const warnings: string[] = [];

  // Who has each address: written by hand, wherever it is, and leased, as
  // the leases are given. An address is not free for a pool when a device
  // that has it meets the pool (see the header)
  const holders = new Map<number, string[]>();
  const hold = (address: number, deviceId: string) => {
    const known = holders.get(address);
    if (known) known.push(deviceId);
    else holders.set(address, [deviceId]);
  };
  for (const device of devices) {
    for (const ip of ownedAddresses(device)) {
      if (isValidIP(ip)) hold(ipToNumber(ip), device.id);
    }
  }
  const meet = addressesMeet(topo);
  const takenFor = (pool: WorkingPool, address: number): boolean =>
    (holders.get(address) ?? []).some(deviceId =>
      meet(deviceId, pool.state.deviceId, numberToIp(address))
    );

  /** The lowest free address of a pool, leased to `deviceId`; undefined when it has none left */
  const take = (pool: WorkingPool, deviceId: string): string | undefined => {
    while (pool.cursor <= pool.end && (takenFor(pool, pool.cursor) || pool.never.has(pool.cursor))) {
      pool.cursor += 1;
    }
    if (pool.cursor > pool.end) return undefined;
    hold(pool.cursor, deviceId);
    return numberToIp(pool.cursor);
  };

  for (const device of devices) {
    for (const iface of listInterfaces(device)) {
      if (iface.kind !== 'nic' || !iface.nic.dhcp) continue;
      const card = { deviceId: device.id, nicId: iface.nic.id };
      if (isL3Capable(device)) {
        unserved.push({
          ...card,
          cause: 'routes',
          reason: `a ${device.type.toLowerCase()} does not take its addresses from DHCP`,
        });
        continue;
      }
      if (!iface.enabled) {
        unserved.push({ ...card, cause: 'disabled', reason: `interface ${iface.label} is disabled` });
        continue;
      }
      const reach = broadcastReach(topo, device, iface);
      if (!reach.cabled) {
        unserved.push({
          ...card,
          cause: 'no-cable',
          reason: `interface ${iface.label} has no cable attached`,
        });
        continue;
      }

      const hears = (pool: WorkingPool) =>
        reach.listeners.some(
          listener => listener.device.id === pool.state.deviceId && listener.arrival?.key === pool.state.interfaceKey
        );
      const inReach = pools.filter(hears);
      if (inReach.length === 0) {
        // A server is there, on a cable that says nothing about the interface
        const loose = pools.find(pool =>
          reach.listeners.some(
            listener => listener.device.id === pool.state.deviceId && listener.arrival === undefined
          )
        );
        unserved.push(
          loose
            ? {
                ...card,
                cause: 'unattached',
                reason:
                  `the cable to ${loose.state.device.label} is not attached to one of its interfaces: ` +
                  `which pool answers is not known`,
                server: { deviceId: loose.state.deviceId, interfaceKey: loose.state.interfaceKey },
              }
            : { ...card, cause: 'no-server', reason: 'no DHCP server answers on its network' }
        );
        continue;
      }

      const usable = inReach.filter(pool => pool.state.problem === undefined);
      if (usable.length > 1) {
        const warning = rivalsWarning(usable);
        if (!warnings.includes(warning)) {
          warnings.push(warning);
          rivals.push(usable.map(pool => pool.state));
        }
      }
      const [first] = usable.length > 0 ? usable : inReach;
      const server: DhcpServerRef = { deviceId: first.state.deviceId, interfaceKey: first.state.interfaceKey };
      if (usable.length === 0) {
        unserved.push({
          ...card,
          cause: 'unusable',
          reason: `the pool of ${first.state.name} cannot be used: ${first.state.problem?.text}`,
          server,
        });
        continue;
      }

      let lease: DhcpLease | undefined;
      for (const pool of usable) {
        const ip = take(pool, device.id);
        if (ip === undefined) continue;
        lease = {
          ...card,
          ip,
          mask: pool.state.mask,
          gateway: pool.state.gateway,
          ...(pool.state.pool.dns ? { dns: pool.state.pool.dns } : {}),
          server: { deviceId: pool.state.deviceId, interfaceKey: pool.state.interfaceKey },
        };
        pool.state.leases.push(lease);
        break;
      }
      if (lease) {
        leases.push(lease);
      } else {
        unserved.push({
          ...card,
          cause: 'used-up',
          reason: usedUpReason(first.state),
          server,
        });
      }
    }
  }

  // How much of each range is left, once everybody has been served
  for (const pool of pools) {
    if (pool.state.problem) continue;
    const start = ipToNumber(pool.state.pool.start);
    let used = 0;
    for (const address of holders.keys()) {
      const inRange = address >= start && address <= pool.end && !pool.never.has(address);
      if (inRange && takenFor(pool, address)) used += 1;
    }
    pool.state.free = pool.state.size - used;
  }

  const states = pools.map(pool => pool.state);
  if (!hasClients) {
    return { topology: topo, leases, unserved, pools: states, rivals, warnings };
  }

  const leaseOf = new Map(leases.map(lease => [`${lease.deviceId}|${lease.nicId}`, lease] as const));
  const leased = devices.map(device => {
    if (!(device.nics ?? []).some(nic => nic.dhcp)) return device;
    const nics = (device.nics ?? []).map(nic => {
      if (!nic.dhcp) return nic;
      const lease = leaseOf.get(`${device.id}|${nic.id}`);
      return {
        ...nic,
        ip: lease?.ip ?? '',
        subnet: lease?.mask ?? '',
        gateway: lease?.gateway ?? '',
        // (the DNS server comes with the lease, when the pool names one)
        ...(lease?.dns ? { dns: lease.dns } : {}),
      };
    });
    // The device-level fields follow the primary card, as they do when its
    // address is written by hand
    const [primary] = nics;
    return primary.dhcp
      ? { ...device, nics, ip: primary.ip, subnet: primary.subnet, gateway: primary.gateway }
      : { ...device, nics };
  });
  return { topology: { devices: leased, connections }, leases, unserved, pools: states, rivals, warnings };
}

/** What was worked out for a drawing, for as long as the drawing is around */
const known = new WeakMap<NetworkDevice[], { connections: NetworkConnection[]; resolution: DhcpResolution }>();

/**
 * Everything DHCP does in a drawing: leases, cards left without an address,
 * pools, and the drawing with the leases filled in.
 *
 * Simulated failures in `topo` are not read (see the header). The result is
 * kept by the identity of the two lists of the drawing, which the application
 * never changes in place; asking again for the drawing a result came with
 * gives that same result.
 */
export function resolveDhcp(topo: Topology): DhcpResolution {
  const { devices, connections } = topo;
  const kept = known.get(devices);
  if (kept && kept.connections === connections) return kept.resolution;

  const resolution = resolve(devices, connections);
  known.set(devices, { connections, resolution });
  known.set(resolution.topology.devices, { connections, resolution });
  return resolution;
}

/**
 * `topo` as the rest of the engine reads it: every card on DHCP carries the
 * address it is leased. The SAME object when no card is on DHCP, or when the
 * leases are filled in already; simulated failures are kept.
 */
export function withLeases(topo: Topology): Topology {
  // (looked at every time: a drawing without DHCP costs one pass, and is
  // never kept)
  if (!topo.devices.some(device => (device.nics ?? []).some(nic => nic.dhcp))) return topo;
  const { devices } = resolveDhcp(topo).topology;
  return devices === topo.devices ? topo : { ...topo, devices };
}

/** The lease of a card, if it has one */
export function leaseOf(resolution: DhcpResolution, deviceId: string, nicId: string): DhcpLease | undefined {
  return resolution.leases.find(lease => lease.deviceId === deviceId && lease.nicId === nicId);
}

/** Why a card on DHCP has no address, if it has none */
export function unservedOf(
  resolution: DhcpResolution,
  deviceId: string,
  nicId: string
): DhcpUnserved | undefined {
  return resolution.unserved.find(entry => entry.deviceId === deviceId && entry.nicId === nicId);
}

/** The pool a lease came from, or a cause is about */
export function poolAt(resolution: DhcpResolution, server: DhcpServerRef): DhcpPoolState | undefined {
  return resolution.pools.find(
    pool => pool.deviceId === server.deviceId && pool.interfaceKey === server.interfaceKey
  );
}

/**
 * `Portatile-1 has no address: no DHCP server answers on its network` — why a
 * device that takes its address from DHCP has none. Undefined when DHCP is
 * not the reason (no card of the device is waiting for a lease).
 */
export function noLeaseReason(topo: Topology, device: NetworkDevice): string | undefined {
  if (!(device.nics ?? []).some(nic => nic.dhcp)) return undefined;
  const waiting = resolveDhcp(topo).unserved.find(entry => entry.deviceId === device.id);
  return waiting ? `${device.label} has no address: ${waiting.reason}` : undefined;
}
