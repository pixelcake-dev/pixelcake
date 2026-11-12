/**
 * Network Engine — Addressing and routing tables
 *
 * IPv4 arithmetic, the addressed (layer 3) interfaces of a device and the
 * routing table the engine derives from them:
 *
 *  - connected: one entry per addressed interface, for its own network
 *  - static:    the routes written on a router or firewall (`device.routes`)
 *  - default:   the gateway of a NIC on end devices, `device.gateway` on
 *               routers and on devices addressed at device level
 *
 * The most specific entry wins (longest prefix); between entries of the same
 * length a connected network beats a static route, which beats the default.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { NetworkDevice, StaticRoute } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import { listInterfaces } from './interfaces';
import type { DeviceInterface } from './interfaces';
import { primaryGateway, primaryMask } from './topology';

/** Mask assumed for an address that carries no (valid) mask */
export const DEFAULT_MASK = '255.255.255.0';

/** An IPv4 network: its address as an unsigned 32-bit number and its prefix length */
export interface Network {
  address: number;
  prefix: number;
}

/** Dotted IPv4 → unsigned 32-bit number. The caller checks validity first. */
export function ipToNumber(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

/** Unsigned 32-bit number → dotted IPv4 */
export function numberToIp(value: number): string {
  return [24, 16, 8, 0].map(shift => (value >>> shift) & 0xff).join('.');
}

/** The mask of a prefix length, as a number */
function prefixMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** Prefix length → dotted mask ("255.255.255.0" for 24) */
export function prefixToMask(prefix: number): string {
  return numberToIp(prefixMask(prefix));
}

/**
 * Dotted mask → prefix length. Undefined when the text is not a mask: not an
 * address, or its one bits are not contiguous (255.0.255.0).
 */
export function maskToPrefix(mask: string): number | undefined {
  if (!isValidIP(mask)) return undefined;
  const value = ipToNumber(mask);
  for (let prefix = 0; prefix <= 32; prefix++) {
    if (prefixMask(prefix) === value) return prefix;
  }
  return undefined;
}

/** The network an address sits in, given its mask (an unusable mask counts as /24) */
export function networkOf(ip: string, mask: string): Network {
  const prefix = maskToPrefix(mask) ?? 24;
  return { address: (ipToNumber(ip) & prefixMask(prefix)) >>> 0, prefix };
}

/**
 * Parse a network written by a person: `192.168.30.0/24`, a bare address
 * (`192.168.30.7`, taken as a single host, /32) or `default` (0.0.0.0/0).
 * Host bits are dropped: `192.168.30.7/24` is the network 192.168.30.0/24.
 * Undefined when the text is none of these.
 */
export function parseNetwork(text: string): Network | undefined {
  const value = text.trim().toLowerCase();
  if (value === 'default') return { address: 0, prefix: 0 };

  const [ip, length, ...rest] = value.split('/');
  if (rest.length > 0 || !isValidIP(ip)) return undefined;
  if (length === undefined) return { address: ipToNumber(ip), prefix: 32 };
  if (!/^\d{1,2}$/.test(length)) return undefined;
  const prefix = Number(length);
  if (prefix > 32) return undefined;
  return { address: (ipToNumber(ip) & prefixMask(prefix)) >>> 0, prefix };
}

/** `192.168.30.0/24` however the network was typed; `0.0.0.0/0` for the default route */
export function canonicalNetwork(network: Network): string {
  return `${numberToIp(network.address)}/${network.prefix}`;
}

/** `192.168.30.0/24`; the default route reads `default` */
export function formatNetwork(network: Network): string {
  if (network.prefix === 0) return 'default';
  return `${numberToIp(network.address)}/${network.prefix}`;
}

/** True when the (valid) address belongs to the network */
export function networkContains(network: Network, ip: string): boolean {
  return ((ipToNumber(ip) & prefixMask(network.prefix)) >>> 0) === network.address;
}

/**
 * An address a device sends from and answers on: the IP of one of its ports
 * or NICs, or its device-level address when none of its interfaces has one.
 */
export interface L3Interface {
  /**
   * The port or NIC that carries the address. Undefined for the device-level
   * address, which is not tied to any one cable of the device.
   */
  iface?: DeviceInterface;
  ip: string;
  mask: string;
  network: Network;
  /** Default gateway reached through this interface ('' when none) */
  gateway: string;
  enabled: boolean;
}

/** True when at least one port or NIC of the device carries an address */
export function hasInterfaceAddresses(device: NetworkDevice): boolean {
  return listInterfaces(device).some(iface => iface.ip !== '');
}

/**
 * The addressed interfaces of a device, in interface order (ports, then
 * NICs). A device whose ports and NICs carry no address at all is addressed
 * at device level: one entry without `iface`, or none when it has no IP.
 *
 * The interface is the source of truth: on a device with addressed NICs the
 * device-level gateway is never used, even when a NIC has none.
 */
export function l3Interfaces(device: NetworkDevice): L3Interface[] {
  const addressed = listInterfaces(device).filter(iface => iface.ip !== '');
  if (addressed.length > 0) {
    return addressed.map(iface => {
      const mask = iface.subnet || DEFAULT_MASK;
      return {
        iface,
        ip: iface.ip,
        mask,
        network: isValidIP(iface.ip) ? networkOf(iface.ip, mask) : { address: 0, prefix: 32 },
        gateway: iface.kind === 'nic' ? iface.nic.gateway || '' : '',
        enabled: iface.enabled,
      };
    });
  }

  if (!device.ip) return [];
  const mask = primaryMask(device);
  return [
    {
      ip: device.ip,
      mask,
      network: isValidIP(device.ip) ? networkOf(device.ip, mask) : { address: 0, prefix: 32 },
      gateway: primaryGateway(device),
      enabled: true,
    },
  ];
}

/**
 * The address a device name stands for: the first enabled addressed
 * interface that is a NIC, else the device-level address, else the first
 * addressed interface. '' when the device has no address at all.
 *
 * On a device with NICs the device-level fields are only a mirror of the
 * first NIC, so the NIC is read; on a router the device-level address is its
 * management address, the one shown on the canvas.
 */
export function primaryAddress(device: NetworkDevice): string {
  const nic = device.nics?.find(n => n.enabled !== false && n.ip);
  if (nic) return nic.ip;
  if (device.ip) return device.ip;
  return listInterfaces(device).find(iface => iface.ip !== '')?.ip ?? '';
}

/** Every address the device answers to, whatever the interface */
export function ownedAddresses(device: NetworkDevice): string[] {
  const addresses = listInterfaces(device)
    .map(iface => iface.ip)
    .filter(ip => ip !== '');
  if (device.ip && !addresses.includes(device.ip)) addresses.push(device.ip);
  return addresses;
}

export type RouteKind = 'connected' | 'static' | 'default';

/** One line of a device's routing table */
export interface RouteEntry {
  network: Network;
  kind: RouteKind;
  /** Address the traffic is handed to; undefined for a connected network */
  nextHop?: string;
  /**
   * Interface the traffic leaves from. Always set for a connected network and
   * for the default route of a NIC; for the other routes it is the interface
   * whose network holds the next hop, undefined when no interface does.
   */
  out?: L3Interface;
  /** The static route this line comes from */
  route?: StaticRoute;
}

const KIND_ORDER: Record<RouteKind, number> = { connected: 0, static: 1, default: 2 };

/** The interface whose own network holds `ip` (most specific first) */
function interfaceFor(interfaces: L3Interface[], ip: string): L3Interface | undefined {
  if (!isValidIP(ip)) return undefined;
  let best: L3Interface | undefined;
  for (const candidate of interfaces) {
    if (!isValidIP(candidate.ip) || !networkContains(candidate.network, ip)) continue;
    if (!best || candidate.network.prefix > best.network.prefix) best = candidate;
  }
  return best;
}

/**
 * The routing table of a device, most specific entry first.
 *
 * `routes` (static routes) are read on any device that has them; entries
 * whose destination or next hop is not valid are left out, as a real device
 * would refuse them.
 */
export function routingTable(device: NetworkDevice): RouteEntry[] {
  const interfaces = l3Interfaces(device);
  const usable = interfaces.filter(entry => isValidIP(entry.ip));
  const entries: RouteEntry[] = [];

  for (const entry of usable) {
    entries.push({ network: entry.network, kind: 'connected', out: entry });
  }

  for (const route of device.routes ?? []) {
    const network = parseNetwork(route.destination);
    if (!network || !isValidIP(route.nextHop)) continue;
    entries.push({
      network,
      kind: network.prefix === 0 ? 'default' : 'static',
      nextHop: route.nextHop,
      out: interfaceFor(usable, route.nextHop),
      route,
    });
  }

  // Default gateways. On a device addressed through its interfaces each NIC
  // brings its own; a router (ports have no gateway field) and a device
  // addressed at device level use the device-level one.
  const defaultNetwork: Network = { address: 0, prefix: 0 };
  const perInterface = usable.filter(entry => entry.gateway !== '');
  if (perInterface.length > 0) {
    for (const entry of perInterface) {
      entries.push({ network: defaultNetwork, kind: 'default', nextHop: entry.gateway, out: entry });
    }
  } else if (device.gateway && !usable.some(entry => entry.iface?.kind === 'nic')) {
    entries.push({
      network: defaultNetwork,
      kind: 'default',
      nextHop: device.gateway,
      out: interfaceFor(usable, device.gateway),
    });
  }

  // Stable sort: longest prefix, then connected < static < default, then the
  // order the entries were written in
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        b.entry.network.prefix - a.entry.network.prefix ||
        KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] ||
        a.index - b.index
    )
    .map(({ entry }) => entry);
}

/**
 * The entry of `table` that decides where `ip` goes: the first (most
 * specific) one whose network holds it. With `enabledOnly`, entries leaving
 * from a disabled interface are skipped, as a device does with a link that is
 * down.
 */
export function lookupRoute(
  table: RouteEntry[],
  ip: string,
  options: { enabledOnly?: boolean } = {}
): RouteEntry | undefined {
  if (!isValidIP(ip)) return undefined;
  return table.find(
    entry =>
      networkContains(entry.network, ip) &&
      (!options.enabledOnly || entry.out === undefined || entry.out.enabled)
  );
}
