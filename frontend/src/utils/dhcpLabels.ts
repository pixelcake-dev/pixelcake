/**
 * The words for DHCP, in the language of the interface: the address shown for
 * a device, where a lease comes from, why a card has none, what is wrong with
 * a pool as typed. (The engine's own reasons are English: they go into
 * terminal and trace messages. Everything the windows and the drawing show
 * goes through here.)
 *
 * The language is read when a function is called: a component that shows
 * what these give calls `useT()` too, so that it is drawn again when the
 * language changes.
 */

import {
  leaseOf,
  listInterfaces,
  poolAt,
  poolOf,
  poolProblem,
  suggestedPool,
  unservedOf,
} from '@/engine';
import type {
  DeviceInterface,
  DhcpLease,
  DhcpPoolState,
  DhcpResolution,
  DhcpUnserved,
  PoolProblem,
} from '@/engine';
import { interfaceShortLabel } from '@/utils/interfaceLabels';
import { getT } from '@/i18n';
import type { DhcpPool, NetworkDevice, NetworkInterfaceCard, Port } from '@/types';

/** What stands for an address a card on DHCP did not get */
export function noLeaseLabel(): string {
  return getT().dhcp.noLease;
}

/**
 * The address shown for a device, on the drawing and wherever devices are
 * listed: the one written by hand, or the one its first card is leased
 * (`192.168.20.100 · DHCP`), or the words that say it has none.
 */
export function shownAddress(device: NetworkDevice, dhcp: DhcpResolution): string {
  const primary = device.nics?.[0];
  if (!primary?.dhcp) return device.ip;
  const lease = leaseOf(dhcp, device.id, primary.id);
  return lease ? `${lease.ip} · DHCP` : noLeaseLabel();
}

/** `Router-Core, port 2` / `Srv-Auth, eth0`: the interface a pool is on */
export function serverLabel(pool: Pick<DhcpPoolState, 'device' | 'iface'>): string {
  return `${pool.device.label}, ${interfaceShortLabel(pool.iface)}`;
}

/** `192.168.20.100 from Router-Core, port 2` */
export function leaseText(lease: DhcpLease, dhcp: DhcpResolution): string {
  const pool = poolAt(dhcp, lease.server);
  return pool ? getT().dhcp.leaseFrom(lease.ip, serverLabel(pool)) : lease.ip;
}

/** What is wrong with a pool, as the engine found it, in the words of the interface */
export function poolProblemLabel(problem: PoolProblem, iface: DeviceInterface, pool: DhcpPool): string {
  const t = getT();
  const kind = iface.kind === 'port' ? 'port' : 'card';
  switch (problem.code) {
    case 'client':
      return t.dhcp.rangeProblem.client;
    case 'no-address':
      return t.dhcp.rangeProblem.noAddress(kind);
    case 'invalid':
      return problem.value
        ? t.common.validation.notIPv4(problem.value)
        : t.dhcp.rangeProblem.endsMissing;
    case 'outside':
      return t.dhcp.rangeProblem.outside(problem.value ?? '', kind, problem.network ?? '');
    case 'reversed':
      return t.dhcp.rangeProblem.reversed(pool.start, pool.end);
  }
}

/**
 * What a pool that works hands out, and how much of it is taken:
 * `Gateway handed out 192.168.10.1 · 2 leased, 98 free of 100`
 */
export function poolStatusText(state: DhcpPoolState): string {
  return getT().dhcp.rangeStatus({
    gateway: state.gateway,
    dns: state.pool.dns,
    leased: state.leases.length,
    free: state.free,
    size: state.size,
    disabled: state.iface.enabled ? undefined : state.iface.kind === 'port' ? 'port' : 'card',
  });
}

/** Why a card on DHCP has no address, in the words of the interface */
export function unservedText(entry: DhcpUnserved, dhcp: DhcpResolution): string {
  const words = getT().dhcp.unserved;
  const pool = entry.server ? poolAt(dhcp, entry.server) : undefined;
  switch (entry.cause) {
    case 'routes':
      return words.routes;
    case 'disabled':
      return words.disabled;
    case 'no-cable':
      return words.noCable;
    case 'no-server':
      return words.noServer;
    case 'unattached':
      return words.unattached(pool?.device.label);
    case 'unusable':
      return pool?.problem
        ? words.unusable(serverLabel(pool), poolProblemLabel(pool.problem, pool.iface, pool.pool))
        : words.unusableUnnamed;
    case 'used-up': {
      if (!pool) return words.usedUpUnnamed;
      if (pool.size === 0) return words.empty(serverLabel(pool));
      return words.usedUp(serverLabel(pool), pool.size);
    }
  }
}

/**
 * What a card on DHCP shows in place of its three fields: the lease
 * (`192.168.20.100 from Router-Core, port 2`), or why there is none.
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
    text: getT().dhcp.noAddress(waiting ? unservedText(waiting, dhcp) : undefined),
  };
}

/** True for a pool whose range was never typed: it is not kept, and is not an error */
export function isBlankPool(pool: DhcpPool): boolean {
  return (
    !pool.start.trim() && !pool.end.trim() && !(pool.gateway ?? '').trim() && !(pool.dns ?? '').trim()
  );
}

/** A pool as it is kept: trimmed, and without a gateway or a DNS server that was left empty */
export function tidyPool(pool: DhcpPool): DhcpPool {
  const gateway = (pool.gateway ?? '').trim();
  const dns = (pool.dns ?? '').trim();
  return {
    start: pool.start.trim(),
    end: pool.end.trim(),
    ...(gateway ? { gateway } : {}),
    ...(dns ? { dns } : {}),
  };
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
export function blankPoolError(): string {
  return getT().dhcp.blankRangeError;
}

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

/** A range to start from on a router or firewall port, given the port as it is in the form */
export function portSuggestedPool(deviceType: string, port: Port): DhcpPool | undefined {
  return suggestedPool(listInterfaces(standIn(deviceType, { ports: [port] }))[0]);
}

/** A range to start from on a card of a server, given the card as it is in the form */
export function nicSuggestedPool(nic: NetworkInterfaceCard): DhcpPool | undefined {
  return suggestedPool(listInterfaces(standIn('Server', { nics: [nic] }))[0]);
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
 * words of the toast that refuses to save it (`Port 2, DHCP server: …`);
 * undefined when every pool is fine
 */
export function firstPoolProblem(device: NetworkDevice): string | undefined {
  for (const iface of listInterfaces(device)) {
    const pool = poolOf(iface);
    if (!pool) continue;
    const problem = poolProblemText(device, iface, pool);
    if (problem) {
      const t = getT();
      const where =
        iface.kind === 'port'
          ? t.common.interfaces.port(iface.port.id)
          : t.common.interfaces.card(iface.label);
      return t.dhcp.rangeProblemOn(where, problem);
    }
  }
  return undefined;
}
