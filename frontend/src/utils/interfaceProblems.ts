/**
 * A port and a network card as they are typed in the window of a device:
 * what is wrong with one (said under its fields while it is typed, and again
 * when the device is saved), and how one is kept (trimmed, without what was
 * left empty). The window edits its ports and cards in place and saves them
 * all together: nothing here knows of React.
 */

import { isValidIP } from '@/utils/ipHelpers';
import { isBlankPool, nicPoolProblemText, portPoolProblemText, tidyPool } from '@/utils/dhcpLabels';
import { dnsServerProblem } from '@/utils/networkConfigValidation';
import type { NetworkInterfaceCard, Port } from '@/types';

/** Mask given to an addressed port when the field is left empty */
export const DEFAULT_PORT_SUBNET = '255.255.255.0';

/** The ports of a router and of a firewall carry an address; those of a switch do not */
export function portsCarryAddress(deviceType: string): boolean {
  return deviceType === 'Router' || deviceType === 'Firewall';
}

export interface PortProblems {
  /** The address or the mask */
  address?: string;
  vlan?: string;
  /** The DHCP server of the port */
  pool?: string;
}

/** The address of a port as it is kept: none, or an address with a mask */
function keptAddress(port: Port): Pick<Port, 'ip' | 'subnet'> {
  const ip = (port.ip ?? '').trim();
  const subnet = (port.subnet ?? '').trim();
  return { ip: ip || undefined, subnet: ip ? subnet || DEFAULT_PORT_SUBNET : undefined };
}

/** What is wrong with a port as typed; an empty object when it is fine */
export function portProblems(deviceType: string, port: Port): PortProblems {
  const problems: PortProblems = {};
  if (portsCarryAddress(deviceType)) {
    const ip = (port.ip ?? '').trim();
    const subnet = (port.subnet ?? '').trim();
    if (ip && !isValidIP(ip)) problems.address = `"${ip}" non è un indirizzo IPv4 valido`;
    else if (subnet && !isValidIP(subnet)) problems.address = `"${subnet}" non è una subnet mask valida`;
    else if (!ip && subnet) problems.address = 'Inserisci un indirizzo IP oppure svuota la subnet mask';

    const pool = port.dhcpServer;
    if (pool && !isBlankPool(pool)) {
      const problem = portPoolProblemText(deviceType, { ...port, ...keptAddress(port) }, pool);
      if (problem) problems.pool = problem;
    }
  }
  if (deviceType === 'Switch' && typeof port.vlan === 'number' && !isVlanNumber(port.vlan)) {
    problems.vlan = `${port.vlan} non è una VLAN: il numero va da 1 a 4094`;
  }
  return problems;
}

/**
 * A port as the device keeps it: names and notes trimmed (none when left
 * empty), an address with its mask or neither, the DHCP range trimmed and
 * not there at all when it was never typed. The same object when nothing
 * changes.
 */
export function tidyPort(deviceType: string, port: Port): Port {
  const patch: Partial<Port> = {
    name: port.name?.trim() || undefined,
    description: port.description?.trim() || undefined,
  };
  if (portsCarryAddress(deviceType)) {
    Object.assign(patch, keptAddress(port));
    if (port.dhcpServer) {
      patch.dhcpServer = isBlankPool(port.dhcpServer) ? undefined : tidyPool(port.dhcpServer);
    }
  }
  return withPatch(port, patch);
}

export interface NicProblems {
  name?: string;
  /** The DNS server the card asks */
  dns?: string;
  /** The DHCP server of the card (a server) */
  pool?: string;
}

/** What is wrong with a card as typed; an empty object when it is fine */
export function nicProblems(nic: NetworkInterfaceCard): NicProblems {
  const problems: NicProblems = {};
  if (!nic.name.trim()) problems.name = 'La scheda deve avere un nome, per esempio eth0';
  // A card on DHCP has no address, no DNS server and no pool of its own
  if (nic.dhcp === true) return problems;
  const dns = dnsServerProblem(nic.dns ?? '');
  if (dns) problems.dns = dns;
  const pool = nic.dhcpServer;
  if (pool && !isBlankPool(pool)) {
    const problem = nicPoolProblemText(tidyNic(nic), pool);
    if (problem) problems.pool = problem;
  }
  return problems;
}

/**
 * A card as the device keeps it: trimmed; on DHCP, with no address, DNS
 * server or pool of its own (they come with the lease); a DHCP range not
 * there at all when it was never typed
 */
export function tidyNic(nic: NetworkInterfaceCard): NetworkInterfaceCard {
  const automatic = nic.dhcp === true;
  const pool = nic.dhcpServer;
  return withPatch(nic, {
    name: nic.name.trim(),
    ip: automatic ? '' : (nic.ip ?? '').trim(),
    subnet: automatic ? '' : (nic.subnet ?? '').trim(),
    gateway: automatic ? '' : (nic.gateway ?? '').trim(),
    dns: automatic ? undefined : nic.dns?.trim() || undefined,
    mac: nic.mac?.trim() || undefined,
    description: nic.description?.trim() || undefined,
    dhcp: automatic ? true : undefined,
    dhcpServer: automatic || !pool || isBlankPool(pool) ? undefined : tidyPool(pool),
  });
}

/**
 * The first thing wrong among the ports and the cards of a device, in the
 * words of the notice that refuses to save it (`Porta 2: …`, `Scheda eth0:
 * …`); undefined when all is fine. The DHCP ranges are not looked at here:
 * `firstPoolProblem` (utils/dhcpLabels) reads them once the addresses are
 * known to be good.
 */
export function firstInterfaceProblem(
  deviceType: string,
  ports: Port[],
  nics: NetworkInterfaceCard[]
): string | undefined {
  for (const port of ports) {
    const { address, vlan } = portProblems(deviceType, port);
    const problem = address ?? vlan;
    if (problem) return `Porta ${port.id}: ${problem}`;
  }
  const names = new Set<string>();
  for (const nic of nics) {
    const { name, dns } = nicProblems(nic);
    const problem = name ?? dns;
    if (problem) return `Scheda ${nic.name.trim() || nic.id}: ${problem}`;
    const key = nic.name.trim().toLowerCase();
    if (names.has(key)) return `Due schede si chiamano ${nic.name.trim()}: ogni scheda ha un nome suo`;
    names.add(key);
  }
  return undefined;
}

function isVlanNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 4094;
}

/**
 * What is typed in the VLAN field of a switch port, read: one number on an
 * access port, a list on a trunk. `error` says what cannot be read; `vlan` is
 * then left out, and the port keeps the VLAN it had.
 */
export function readVlanText(
  mode: 'access' | 'trunk',
  text: string
): { vlan: number | number[] | undefined; error?: string } {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { vlan: undefined };
  const numbers: number[] = [];
  for (const part of parts) {
    const value = /^\d+$/.test(part) ? Number(part) : NaN;
    if (!isVlanNumber(value)) {
      return { vlan: undefined, error: `${part} non è una VLAN: il numero va da 1 a 4094` };
    }
    if (!numbers.includes(value)) numbers.push(value);
  }
  if (mode === 'access') {
    if (numbers.length > 1) {
      return { vlan: undefined, error: 'Una porta di accesso sta in una sola VLAN: per più VLAN serve un trunk' };
    }
    return { vlan: numbers[0] };
  }
  return { vlan: numbers };
}

/** What the VLAN field shows for the VLAN a port has */
export function vlanText(vlan: Port['vlan']): string {
  if (vlan === undefined) return '';
  return Array.isArray(vlan) ? vlan.join(', ') : String(vlan);
}

/** `item` with `patch` over it, or `item` itself when the patch changes nothing */
function withPatch<T extends object>(item: T, patch: Partial<T>): T {
  const keys = Object.keys(patch) as (keyof T)[];
  const same = keys.every((key) => sameValue(item[key], patch[key]));
  return same ? item : { ...item, ...patch };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
