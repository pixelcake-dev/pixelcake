/**
 * Italian words for DHCP: the address shown for a device, where a lease comes
 * from, why a card has none, what is wrong with a pool as typed. (The engine's
 * own reasons are English: they go into terminal and trace messages.
 * Everything the windows and the drawing show goes through here.)
 */

import { leaseOf, listInterfaces, poolAt, poolOf, poolProblem, unservedOf } from '@/engine';
import type {
  DeviceInterface,
  DhcpLease,
  DhcpPoolState,
  DhcpResolution,
  DhcpUnserved,
  PoolProblem,
} from '@/engine';
import { interfaceShortLabel } from '@/utils/interfaceLabels';
import type { DhcpPool, NetworkDevice, NetworkInterfaceCard, Port } from '@/types';

/** What stands for an address a card on DHCP did not get */
export const NO_LEASE_LABEL = 'DHCP: nessun indirizzo';

/**
 * The address shown for a device, on the drawing and wherever devices are
 * listed: the one written by hand, or the one its first card is leased
 * (`192.168.20.100 · DHCP`), or `DHCP: nessun indirizzo`.
 */
export function shownAddress(device: NetworkDevice, dhcp: DhcpResolution): string {
  const primary = device.nics?.[0];
  if (!primary?.dhcp) return device.ip;
  const lease = leaseOf(dhcp, device.id, primary.id);
  return lease ? `${lease.ip} · DHCP` : NO_LEASE_LABEL;
}

/** `Router-Core, porta 2` / `Srv-Auth, eth0`: the interface a pool is on */
export function serverLabel(pool: Pick<DhcpPoolState, 'device' | 'iface'>): string {
  return `${pool.device.label}, ${interfaceShortLabel(pool.iface)}`;
}

/** `192.168.20.100 da Router-Core, porta 2` */
export function leaseText(lease: DhcpLease, dhcp: DhcpResolution): string {
  const pool = poolAt(dhcp, lease.server);
  return pool ? `${lease.ip} da ${serverLabel(pool)}` : lease.ip;
}

/** What is wrong with a pool, as the engine found it, in Italian */
export function poolProblemLabel(problem: PoolProblem, iface: DeviceInterface, pool: DhcpPool): string {
  const here = iface.kind === 'port' ? 'la porta' : 'la scheda';
  switch (problem.code) {
    case 'client':
      return 'la scheda prende il proprio indirizzo dal DHCP: non può anche assegnarne';
    case 'no-address':
      return `${here} non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete`;
    case 'invalid':
      return problem.value
        ? `"${problem.value}" non è un indirizzo IPv4 valido`
        : 'servono il primo e l\'ultimo indirizzo';
    case 'outside':
      // (`del` + `la porta`: «della porta»)
      return `${problem.value} è fuori dalla rete del${here} (${problem.network})`;
    case 'reversed':
      return `l'ultimo indirizzo (${pool.end}) viene prima del primo (${pool.start})`;
  }
}

/** Why a card on DHCP has no address, in Italian */
export function unservedText(entry: DhcpUnserved, dhcp: DhcpResolution): string {
  const pool = entry.server ? poolAt(dhcp, entry.server) : undefined;
  switch (entry.cause) {
    case 'routes':
      return 'un router o un firewall non prende i propri indirizzi dal DHCP';
    case 'disabled':
      return 'la scheda è disabilitata';
    case 'no-cable':
      return 'alla scheda non è collegato nessun cavo';
    case 'no-server':
      return 'nessun server DHCP risponde sulla sua rete';
    case 'unattached':
      return (
        `il cavo verso ${pool?.device.label ?? 'il server'} non è assegnato a una delle sue ` +
        `porte: non si sa quale intervallo risponde`
      );
    case 'unusable':
      return pool?.problem
        ? `l'intervallo di ${serverLabel(pool)} non è utilizzabile: ${poolProblemLabel(pool.problem, pool.iface, pool.pool)}`
        : 'l\'intervallo che risponde non è utilizzabile';
    case 'used-up': {
      if (!pool) return 'l\'intervallo che risponde è esaurito';
      if (pool.size === 0) return `l'intervallo di ${serverLabel(pool)} non ha indirizzi da assegnare`;
      const what = pool.size === 1 ? 'il suo unico indirizzo è già preso' : `${pool.size} indirizzi, tutti presi`;
      return `l'intervallo di ${serverLabel(pool)} è esaurito: ${what}`;
    }
  }
}



/**
 * What a card on DHCP shows in place of its three fields: the lease
 * (`192.168.20.100 da Router-Core, porta 2`), or why there is none.
 */
export function cardLeaseText(
  dhcp: DhcpResolution,
  deviceId: string,
  nicId: string
): { leased: boolean; text: string } {
  const lease = leaseOf(dhcp, deviceId, nicId);
  if (lease) return { leased: true, text: leaseText(lease, dhcp) };
  const waiting = unservedOf(dhcp, deviceId, nicId);
  return {
    leased: false,
    text: waiting ? `Nessun indirizzo: ${unservedText(waiting, dhcp)}` : 'Nessun indirizzo',
  };
}

/** True for a pool whose range was never typed: it is not kept, and is not an error */
export function isBlankPool(pool: DhcpPool): boolean {
  return !pool.start.trim() && !pool.end.trim() && !(pool.gateway ?? '').trim();
}

/** A pool as it is kept: trimmed, and without a gateway that was left empty */
export function tidyPool(pool: DhcpPool): DhcpPool {
  const gateway = (pool.gateway ?? '').trim();
  return { start: pool.start.trim(), end: pool.end.trim(), ...(gateway ? { gateway } : {}) };
}

/**
 * What is wrong with a pool as typed on an interface of a device; undefined
 * when it is fine (or blank)
 */
export function poolProblemText(
  device: NetworkDevice,
  iface: DeviceInterface,
  pool: DhcpPool
): string | undefined {
  if (isBlankPool(pool)) return undefined;
  const tidy = tidyPool(pool);
  const problem = poolProblem(device, iface, tidy);
  return problem ? poolProblemLabel(problem, iface, tidy) : undefined;
}

/** Said when the server is switched on and nothing was typed */
export const BLANK_POOL_ERROR =
  'Scrivi il primo e l\'ultimo indirizzo da assegnare, oppure togli la spunta al server DHCP';

/** A device of one interface, to ask the engine about a pool that is still in a form */
function standIn(type: string, interfaces: Pick<NetworkDevice, 'ports' | 'nics'>): NetworkDevice {
  return { id: '', type, label: '', ip: '', subnet: '', gateway: '', position: { x: 0, y: 0 }, ...interfaces };
}

/**
 * What is wrong with the pool typed for a router or firewall port, given the
 * port as it is in the form; undefined when it is fine (or blank)
 */
export function portPoolProblemText(deviceType: string, port: Port, pool: DhcpPool): string | undefined {
  const device = standIn(deviceType, { ports: [port] });
  return poolProblemText(device, listInterfaces(device)[0], pool);
}

/**
 * What is wrong with the pool typed for a network card, given the card as it
 * is in the form; undefined when it is fine (or blank)
 */
export function nicPoolProblemText(nic: NetworkInterfaceCard, pool: DhcpPool): string | undefined {
  const device = standIn('Server', { nics: [nic] });
  return poolProblemText(device, listInterfaces(device)[0], pool);
}

/**
 * The first pool of a device that cannot work as it is in the form, in the
 * words of the toast that refuses to save it (`Porta 2: …`); undefined when
 * every pool is fine
 */
export function firstPoolProblem(device: NetworkDevice): string | undefined {
  for (const iface of listInterfaces(device)) {
    const pool = poolOf(iface);
    if (!pool) continue;
    const problem = poolProblemText(device, iface, pool);
    if (problem) {
      const where = iface.kind === 'port' ? `Porta ${iface.port.id}` : `Scheda ${iface.label}`;
      return `${where}, server DHCP: ${problem}`;
    }
  }
  return undefined;
}
