/**
 * Network Engine — Time
 *
 * How long a packet takes on the path the engine found for it, and how long
 * an exchange takes: the request on its path, then the reply on its own (the
 * two may differ). Pure and deterministic: no randomness, no jitter, no load,
 * no queue; every reply of a ping takes the same time, and the same drawing
 * always gives the same times. The time never changes a verdict.
 *
 * The one-way time of a path is the sum of:
 *
 *  - each cable crossed: the time of its medium (Wi-Fi, a line to a provider)
 *    and 5 µs for every km of its length, which is how fast light goes in
 *    copper and in fibre. A delay written by hand on the link takes the
 *    place of both: a WAN line with the latency of its contract;
 *  - each device crossed: the time it takes to pass the packet on (a switch,
 *    an access point, a router, a firewall), or, for a Cloud symbol, the time
 *    of the network it stands for: the Internet, or a carrier's network.
 *
 * An exchange adds the two end devices once: the time the sender takes to
 * send and take back, and the time the device asked takes to answer.
 *
 * The values are typical, not measured (see the tables below). Bandwidth,
 * queues and congestion, jitter and loss are not simulated.
 */

import type { LinkMedium, NetworkConnection, NetworkDevice } from '@/types';
import { LINK_MEDIA } from '@/types';
import type { Topology, TraceResult } from './types';
import { devicesById, forwardingRole, isInternetLike, isPublicInternet } from './topology';

/** One-way time of each medium, in ms, besides the propagation of its length */
export const MEDIUM_MS: Readonly<Record<LinkMedium, number>> = {
  // Copper and fibre: nothing but the length of the cable
  copper: 0,
  fibre: 0,
  // A frame on the air: the access point waits its turn to send
  wifi: 1.5,
  // The line to the provider: interleaving on DSL, the optical network of
  // the provider on FTTH, the radio network and its core on 4G/5G
  dsl: 8,
  ftth: 1.5,
  mobile: 15,
  // Up to a geostationary satellite and down again: 36,000 km each way
  satellite: 280,
};

/** Propagation, in ms for each km of cable: light goes at about 200,000 km/s in copper and in fibre */
export const PROPAGATION_MS_PER_KM = 0.005;

/** Time a device takes to pass a packet on, in ms */
export const FORWARDING_MS = {
  switch: 0.01,
  accessPoint: 0.05,
  router: 0.1,
  firewall: 0.2,
  // (not simulated: it lets traffic through, and is given the time of a router)
  loadBalancer: 0.1,
} as const;

/** Time of the network a Cloud symbol stands for, one way, in ms */
export const CARRIER_MS = {
  /** The symbol named Internet: the networks between two providers */
  internet: 10,
  /** Any other Cloud symbol: a carrier's MPLS network, a private line */
  carrier: 4,
} as const;

/**
 * Time each end device of an exchange takes, once for the round trip: the
 * sender, to send the request and take the reply, and the device asked, to
 * answer. A device that asks itself is one device, counted once.
 */
export const END_DEVICE_MS = 0.1;

/** The longest cable a link may say it has, in metres: once round the Earth */
export const LINK_LENGTH_MAX_M = 40_000_000;
/** The longest delay that may be written by hand on a link, in ms */
export const LINK_DELAY_MAX_MS = 10_000;

/** True when a value is a medium the engine knows */
export function isLinkMedium(value: unknown): value is LinkMedium {
  return typeof value === 'string' && (LINK_MEDIA as readonly string[]).includes(value);
}

/** True when a value is a length a link can have, in metres: more than 0, up to once round the Earth */
export function isLinkLength(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= LINK_LENGTH_MAX_M;
}

/** True when a value is a delay that can be written on a link, in ms: from 0 to 10 s */
export function isLinkDelay(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= LINK_DELAY_MAX_MS;
}

/** Lower-case type and template id: what kinds of device are told apart by */
function kindText(device: NetworkDevice): string {
  return `${device.type} ${device.templateId ?? ''}`.toLowerCase();
}

/** A laptop, a smartphone or a tablet: what goes on Wi-Fi when it meets an access point */
function isWireless(device: NetworkDevice): boolean {
  return /laptop|smartphone|tablet/.test(kindText(device));
}

/** An access point that people connect to (an IoT gateway is built on one, and is not) */
function isAccessPoint(device: NetworkDevice): boolean {
  return /access\s?point/.test(kindText(device)) && device.templateId !== 'tpl-iotgateway';
}

/**
 * The medium of a link: the one chosen, or the one worked out from its two
 * ends (`automatic`): Wi-Fi between a laptop, a smartphone or a tablet and
 * an access point, copper otherwise.
 */
export function linkMedium(
  connection: NetworkConnection,
  source: NetworkDevice | undefined,
  target: NetworkDevice | undefined
): { medium: LinkMedium; automatic: boolean } {
  if (isLinkMedium(connection.medium)) return { medium: connection.medium, automatic: false };
  const radio = (a: NetworkDevice | undefined, b: NetworkDevice | undefined) =>
    a !== undefined && b !== undefined && isWireless(a) && isAccessPoint(b);
  return { medium: radio(source, target) || radio(target, source) ? 'wifi' : 'copper', automatic: true };
}

/** The time of one link, and what it comes from */
export interface LinkDelay {
  /** One-way time, in ms */
  ms: number;
  /** The medium of the link: the one chosen, or the one worked out */
  medium: LinkMedium;
  /** The medium was not chosen: it is worked out from the two ends */
  automatic: boolean;
  /** The length of the cable in metres, when it has one */
  lengthM?: number;
  /** The delay was written by hand: medium and length do not count */
  written: boolean;
}

/** How long a packet takes on a link, one way (see the header) */
export function linkDelay(
  connection: NetworkConnection,
  source: NetworkDevice | undefined,
  target: NetworkDevice | undefined
): LinkDelay {
  const { medium, automatic } = linkMedium(connection, source, target);
  const lengthM = isLinkLength(connection.lengthM) ? connection.lengthM : undefined;
  const shape = { medium, automatic, ...(lengthM !== undefined ? { lengthM } : {}) };
  if (isLinkDelay(connection.delayMs)) return { ...shape, ms: connection.delayMs, written: true };
  const propagation = lengthM !== undefined ? (lengthM / 1000) * PROPAGATION_MS_PER_KM : 0;
  return { ...shape, ms: MEDIUM_MS[medium] + propagation, written: false };
}

/**
 * The time a device takes when the packet crosses it: to pass it on, or, for
 * a Cloud symbol, the network it stands for. An end device never carries a
 * packet for others: nothing.
 */
export function crossingMs(device: NetworkDevice): number {
  switch (forwardingRole(device)) {
    case 'router':
      return kindText(device).includes('firewall') ? FORWARDING_MS.firewall : FORWARDING_MS.router;
    case 'bridge':
      return /access\s?point/.test(kindText(device)) ? FORWARDING_MS.accessPoint : FORWARDING_MS.switch;
    case 'passthrough':
      if (isPublicInternet(device)) return CARRIER_MS.internet;
      if (isInternetLike(device)) return CARRIER_MS.carrier;
      return FORWARDING_MS.loadBalancer;
    case 'host':
      return 0;
  }
}

/**
 * How long the packet of a trace took, one way: the cables it went along and
 * the devices it crossed, from the device it left to the one it reached.
 */
export function pathMs(trace: TraceResult, topo: Topology): number {
  const byId = devicesById(topo);
  const links = new Map(topo.connections.map(connection => [connection.id, connection] as const));
  let total = 0;
  trace.hops.forEach((hop, index) => {
    if (index > 0 && index < trace.hops.length - 1) {
      const device = byId.get(hop.deviceId);
      if (device) total += crossingMs(device);
    }
    const link = hop.viaConnectionId !== undefined ? links.get(hop.viaConnectionId) : undefined;
    if (link) total += linkDelay(link, byId.get(link.source), byId.get(link.target)).ms;
  });
  return total;
}

/**
 * The time of an exchange: the request on its path, the reply on its own,
 * and the two end devices once (see END_DEVICE_MS). It is the time `ping`
 * prints.
 */
export function roundTripMs(request: TraceResult, reply: TraceResult, topo: Topology): number {
  const first = request.hops[0]?.deviceId;
  const last = request.hops[request.hops.length - 1]?.deviceId;
  const ends = first !== undefined && first === last ? 1 : 2;
  return pathMs(request, topo) + pathMs(reply, topo) + ends * END_DEVICE_MS;
}

/**
 * A time as every part of the app shows it: under 1 ms with two decimals
 * (0.24), from 1 to 10 ms with one (7.4), from 10 ms whole (38). The number
 * alone, with a point: the unit, and the decimal mark of a language, are the
 * caller's.
 */
export function formatMs(ms: number): string {
  // (sums of decimals carry a little noise: 0.1 + 0.2 is 0.30000000000000004)
  const value = Math.round(ms * 1e6) / 1e6;
  if (value < 0.995) return value.toFixed(2);
  if (value < 9.95) return value.toFixed(1);
  return String(Math.round(value));
}

/** A number with at most `digits` decimals, without the zeros at its end: 1.5, 600 */
function trimmed(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

/**
 * The length of a cable as it is shown: in metres under a km (80 m), in km
 * from there (1.5 km, 600 km). With a point: the decimal mark of a language
 * is the caller's.
 */
export function formatLength(metres: number): string {
  if (metres < 999.5) return `${Math.max(1, Math.round(metres))} m`;
  const km = metres / 1000;
  return `${trimmed(km, km < 10 ? 2 : km < 100 ? 1 : 0)} km`;
}

/** The names of the media as the terminal writes and reads them */
export const MEDIUM_WORDS: Readonly<Record<LinkMedium, string>> = {
  copper: 'copper',
  fibre: 'fibre',
  wifi: 'wifi',
  dsl: 'dsl',
  ftth: 'ftth',
  mobile: 'mobile',
  satellite: 'satellite',
};

/**
 * The cable of a link in the words of the terminal, whether or not a delay
 * is written on it: `fibre, 600 km`, `wifi, automatic`, `copper, automatic`.
 */
export function describeCable(delay: Pick<LinkDelay, 'medium' | 'automatic' | 'lengthM'>): string {
  const parts = [MEDIUM_WORDS[delay.medium]];
  if (delay.automatic) parts.push('automatic');
  if (delay.lengthM !== undefined) parts.push(formatLength(delay.lengthM));
  return parts.join(', ');
}

/** What the time of a link comes from, in the words of the terminal: its cable, or `written by hand` */
export function describeLinkDelay(delay: LinkDelay): string {
  return delay.written ? 'written by hand' : describeCable(delay);
}
