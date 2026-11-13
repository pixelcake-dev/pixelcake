/**
 * Network Engine — Topology helpers
 *
 * Pure TypeScript: no React, no Zustand, no side effects, fully deterministic.
 * Provides adjacency building, endpoint resolution (id / label / IP / NIC IP)
 * with "did you mean" suggestions, and small per-device accessors used by the
 * trace engine.
 */

import type { NetworkDevice, NetworkConnection } from '@/types';
import type { Topology, ResolvedEndpoint } from './types';
import { listInterfaces } from './interfaces';

/** One neighbor reachable from a device, with the connection that links them */
export interface AdjacencyEntry {
  neighborId: string;
  connection: NetworkConnection;
}

/**
 * Build a bidirectional adjacency map from the topology.
 * Every device gets an entry (possibly empty). Connections referencing
 * unknown devices and self-loops are skipped.
 */
export function buildAdjacency(topo: Topology): Map<string, AdjacencyEntry[]> {
  const adjacency = new Map<string, AdjacencyEntry[]>();
  for (const device of topo.devices) {
    adjacency.set(device.id, []);
  }
  for (const connection of topo.connections) {
    const sourceList = adjacency.get(connection.source);
    const targetList = adjacency.get(connection.target);
    if (!sourceList || !targetList) continue;
    if (connection.source === connection.target) continue;
    sourceList.push({ neighborId: connection.target, connection });
    targetList.push({ neighborId: connection.source, connection });
  }
  return adjacency;
}

/** Collapse whitespace runs and trim, for tolerant label comparison */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Resolve a terminal argument against the topology.
 * Match order: exact device id → label (case-insensitive, trimmed,
 * multi-word supported) → device.ip → the address of any enabled port or NIC.
 */
export function resolveEndpoint(query: string, topo: Topology): ResolvedEndpoint | undefined {
  const q = normalize(query);
  if (!q) return undefined;

  // 1. Exact device id
  for (const device of topo.devices) {
    if (device.id === q) return { device, ip: primaryIp(device) };
  }

  // 2. Label, case-insensitive
  const qLower = q.toLowerCase();
  for (const device of topo.devices) {
    if (normalize(device.label).toLowerCase() === qLower) {
      return { device, ip: primaryIp(device) };
    }
  }

  // 3. Device IP
  for (const device of topo.devices) {
    if (device.ip && device.ip === q) return { device, ip: device.ip };
  }

  // 4. The address of any enabled port or NIC
  for (const device of topo.devices) {
    const iface = listInterfaces(device).find(candidate => candidate.enabled && candidate.ip === q);
    if (iface) return { device, ip: iface.ip };
  }

  return undefined;
}

/** Classic iterative Levenshtein distance (two-row DP) */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + substitutionCost // substitution
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

/**
 * Closest device label (Levenshtein, case-insensitive) for "did you mean".
 * Returns undefined when nothing is reasonably close.
 */
export function suggestEndpoint(query: string, topo: Topology): string | undefined {
  const q = normalize(query).toLowerCase();
  if (!q) return undefined;

  let best: string | undefined;
  let bestDistance = Infinity;
  for (const device of topo.devices) {
    const label = normalize(device.label);
    if (!label) continue;
    const distance = levenshtein(q, label.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = label;
    }
  }
  if (best === undefined) return undefined;

  // Only suggest when the closest label is plausibly a typo of the query.
  const threshold = Math.max(2, Math.floor(q.length / 2));
  return bestDistance <= threshold ? best : undefined;
}

/** Device primary IP: device.ip, else first enabled NIC with an IP, else '' */
export function primaryIp(device: NetworkDevice): string {
  if (device.ip) return device.ip;
  const nic = device.nics?.find(n => n.enabled && n.ip);
  return nic ? nic.ip : '';
}

/** Device subnet mask: device.subnet, else first enabled NIC subnet, else /24 */
export function primaryMask(device: NetworkDevice): string {
  if (device.subnet) return device.subnet;
  const nic = device.nics?.find(n => n.enabled && n.subnet);
  return nic ? nic.subnet : '255.255.255.0';
}

/** Device gateway: device.gateway, else first enabled NIC gateway, else '' */
export function primaryGateway(device: NetworkDevice): string {
  if (device.gateway) return device.gateway;
  const nic = device.nics?.find(n => n.enabled && n.gateway);
  return nic ? nic.gateway : '';
}

/**
 * A device with NICs is addressed through them: its device-level
 * ip/subnet/gateway are only a mirror of the primary NIC (the first one, the
 * one the Inspector shows as the device's addressing). The engine reads the
 * NIC; labels, `show devices` and lookups by IP read the device-level fields,
 * so the two must not drift apart.
 *
 * A primary NIC that takes its address from a DHCP server has none of its
 * own to mirror: the device-level address, mask and gateway are emptied, and
 * what the card is leased is filled in where leases are worked out (see
 * ./dhcp).
 *
 * Returns the device with the mirror up to date: the SAME object when it
 * already is, or when the device has no primary NIC carrying an IP.
 */
export function mirrorPrimaryNic(device: NetworkDevice): NetworkDevice {
  const primary = device.nics?.[0];
  if (primary?.dhcp) {
    if (device.ip === '' && device.subnet === '' && device.gateway === '') return device;
    return { ...device, ip: '', subnet: '', gateway: '' };
  }
  if (!primary?.ip) return device;

  const subnet = primary.subnet || device.subnet;
  const gateway = primary.gateway ?? '';
  if (device.ip === primary.ip && device.subnet === subnet && device.gateway === gateway) {
    return device;
  }
  return { ...device, ip: primary.ip, subnet, gateway };
}

/**
 * The addressing of a device as it is kept in a drawing: a card that takes
 * its address from a DHCP server carries none of its own, and no DNS server
 * of its own either (whatever was typed before DHCP was switched on, or was
 * read from a file, is dropped), and the device-level fields mirror the
 * primary card (see mirrorPrimaryNic).
 *
 * So nothing that reads a drawing can mistake a stale address for the one a
 * card has: that one is worked out from the drawing, in ./dhcp.
 *
 * Returns the SAME object when there is nothing to change.
 */
export function normalizeAddressing(device: NetworkDevice): NetworkDevice {
  const stale = (device.nics ?? []).some(
    nic => nic.dhcp && (nic.ip !== '' || nic.subnet !== '' || nic.gateway !== '' || nic.dns !== undefined)
  );
  if (!stale) return mirrorPrimaryNic(device);
  return mirrorPrimaryNic({
    ...device,
    nics: device.nics?.map(nic => {
      if (!nic.dhcp) return nic;
      const kept = { ...nic, ip: '', subnet: '', gateway: '' };
      delete kept.dns;
      return kept;
    }),
  });
}

/** True when a device of this type routes between subnets (router or firewall) */
export function isL3Type(deviceType: string): boolean {
  const type = deviceType.toLowerCase();
  return type.includes('router') || type.includes('firewall');
}

/** True when the device can route between subnets (router or firewall) */
export function isL3Capable(device: NetworkDevice): boolean {
  return isL3Type(device.type);
}

/** True when the device behaves like an L2 switch */
export function isSwitchLike(device: NetworkDevice): boolean {
  return device.type.toLowerCase().includes('switch');
}

/** Lowercase type and template id, the fields device kinds are told apart by */
function kindText(device: NetworkDevice): string {
  return `${device.type} ${device.templateId ?? ''}`.toLowerCase();
}

/** True when the device stands for the outside world (an Internet or Cloud symbol) */
export function isInternetLike(device: NetworkDevice): boolean {
  const text = kindText(device);
  return text.includes('cloud') || text.includes('internet');
}

/**
 * True when the symbol is the public Internet itself: it is named so. Any
 * other Cloud symbol (a carrier's network, a private cloud) is not, and is
 * taken to carry whatever is sent across it.
 */
export function isPublicInternet(device: NetworkDevice): boolean {
  return isInternetLike(device) && `${kindText(device)} ${device.label}`.toLowerCase().includes('internet');
}

/**
 * What a device does with traffic that is not addressed to it:
 *
 *  - router:      forwards between networks by its routing table (router,
 *                 firewall)
 *  - bridge:      forwards inside one network, VLAN by VLAN (switch, access
 *                 point, any other device built with ports)
 *  - passthrough: not simulated, assumed to let traffic through (the
 *                 Internet/Cloud symbol, a load balancer)
 *  - host:        nothing: an end device never carries traffic for others
 */
export type ForwardingRole = 'router' | 'bridge' | 'passthrough' | 'host';

export function forwardingRole(device: NetworkDevice): ForwardingRole {
  if (isL3Capable(device)) return 'router';
  const text = kindText(device);
  if (isSwitchLike(device) || /access\s?point|bridge|hub/.test(text)) return 'bridge';
  if (isInternetLike(device) || /load\s?balancer/.test(text)) return 'passthrough';
  if ((device.ports ?? []).length > 0) return 'bridge';
  return 'host';
}
