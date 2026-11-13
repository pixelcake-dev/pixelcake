/**
 * Network Engine — Address translation (NAT)
 *
 * What a router or a firewall does to the addresses of a packet, and the
 * reason it has to: the Internet does not carry private addresses.
 *
 *  - SOURCE NAT, on a port with NAT switched on: a new flow the device
 *    forwards out of that port leaves with the address of the port instead
 *    of its own. The device remembers the flow, and when the reply comes back
 *    to that address it sends it on to the real sender.
 *  - PORT FORWARD (destination NAT): a new flow addressed to one of the
 *    device's own ports, for a service the device forwards from that port,
 *    is sent on to an address inside. The reply leaves with the address the
 *    flow was sent to, so the sender never sees the inside one.
 *
 * A firewall on the same device looks at the packet between the two steps:
 * the destination is already the real one, the source is still the real one.
 * Its rules name real addresses.
 *
 * What is translated is the address. There are no port numbers in the engine
 * (a flow is ping, web or email), so a forward is "this service on this
 * port", and two flows never compete for a translation.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { NetworkDevice, PortForward, ServiceName } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Topology } from './types';
import type { DeviceInterface } from './interfaces';
import { networkContains, parseNetwork } from './addressing';
import type { Network } from './addressing';

/**
 * One flow a device has translated, as the device remembers it:
 *
 *  - `source`:  packets of the flow left with `outside` in place of `inside`;
 *               the reply arrives addressed to `outside` and goes on to `inside`
 *  - `forward`: packets of the flow arrived for `outside` and went on to
 *               `inside`; the reply leaves with `outside` in place of `inside`
 */
export interface NatTranslation {
  deviceId: string;
  kind: 'source' | 'forward';
  /** The real address, on the inner side of the device */
  inside: string;
  /** The address of the device's port that stands for it on the other side */
  outside: string;
}

/** The ranges kept for private networks (RFC 1918) and for a link with no addressing (RFC 3927) */
const PRIVATE_RANGES: Network[] = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16'].map(
  range => parseNetwork(range) as Network
);

/** True for an address the Internet does not carry: one of a private range */
export function isPrivateAddress(ip: string): boolean {
  if (!isValidIP(ip)) return false;
  return PRIVATE_RANGES.some(range => networkContains(range, ip));
}

/** True when the interface is a port with NAT switched on */
export function doesNat(iface: DeviceInterface | undefined): boolean {
  return iface?.kind === 'port' && iface.port.nat === true;
}

/**
 * The address a port with NAT gives to what leaves by it. Undefined when the
 * interface does not do NAT, or has no address to give.
 */
export function natAddress(iface: DeviceInterface | undefined): string | undefined {
  if (!iface || !doesNat(iface)) return undefined;
  return isValidIP(iface.ip) ? iface.ip : undefined;
}

/** The address of the port a forward publishes; undefined when the port has none */
export function forwardAddress(device: NetworkDevice, forward: PortForward): string | undefined {
  const ip = device.ports?.find(port => port.id === forward.port)?.ip;
  return ip && isValidIP(ip) ? ip : undefined;
}

/** A forward in the words of the terminal: `forward web from interface 3 to 172.16.0.10` */
export function describeForward(forward: PortForward): string {
  return `forward ${forward.service} from interface ${forward.port} to ${forward.to}`;
}

/** A forward of a device, with its place in the list (1-based, as shown) */
export interface NumberedForward {
  forward: PortForward;
  number: number;
}

/**
 * The forward of `device` that takes a packet addressed to `destinationIp`
 * for `service`: the first enabled one, in list order, whose port carries
 * that address. Undefined when there is none.
 */
export function matchForward(
  device: NetworkDevice,
  service: ServiceName,
  destinationIp: string
): NumberedForward | undefined {
  const forwards = device.portForwards ?? [];
  for (let index = 0; index < forwards.length; index++) {
    const forward = forwards[index];
    if (forward.enabled === false) continue;
    if (forward.service !== 'any' && forward.service !== service) continue;
    if (!isValidIP(forward.to)) continue;
    if (forwardAddress(device, forward) !== destinationIp) continue;
    return { forward, number: index + 1 };
  }
  return undefined;
}

/** Where an inside address is published: the device, its forward, the address to aim at */
export interface Publication extends NumberedForward {
  device: NetworkDevice;
  address: string;
}

/**
 * Every address `insideIp` is published at for `service`, in device order,
 * then list order: the forwards that send that service on to it, each with
 * the address of its port.
 */
export function publications(topo: Topology, insideIp: string, service: ServiceName): Publication[] {
  const found: Publication[] = [];
  for (const device of topo.devices) {
    const forwards = device.portForwards ?? [];
    forwards.forEach((forward, index) => {
      if (forward.enabled === false || forward.to !== insideIp) return;
      if (forward.service !== 'any' && forward.service !== service) return;
      const address = forwardAddress(device, forward);
      if (address) found.push({ device, forward, number: index + 1, address });
    });
  }
  return found;
}

/** Why a forward cannot work as written; undefined when it can */
export function forwardProblem(device: NetworkDevice, forward: PortForward): string | undefined {
  const port = device.ports?.find(candidate => candidate.id === forward.port);
  if (!port) return `${device.label} has no interface ${forward.port}`;
  if (!port.ip || !isValidIP(port.ip)) {
    return `interface ${forward.port} on ${device.label} has no address to publish`;
  }
  if (!isValidIP(forward.to)) return `${forward.to} is not a valid address`;
  if (port.ip === forward.to) return `${forward.to} is the address of interface ${forward.port} itself`;
  return undefined;
}
