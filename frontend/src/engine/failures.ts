/**
 * Network Engine — Simulated failures
 *
 * "What happens if this breaks?" A topology can carry a list of devices that
 * are down and cables that are cut (`Topology.failures`). The drawing itself
 * is untouched: the engine simply finds nothing travelling through them, says
 * so in the reason of a failed trace, and takes another way when the drawing
 * offers one:
 *
 *  - between switches, the search takes the shortest way that works (see ./l2)
 *  - a router or a host stops using a route whose interface has no working
 *    cable left, and takes its next route for that destination (see ./trace)
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { NetworkConnection, NetworkDevice } from '@/types';
import type { Failures, Topology } from './types';
import { boundInterface, listInterfaces } from './interfaces';
import { memoSlot, rememberedFor } from './memo';
import { devicesById } from './topology';

/** True when the list breaks something */
export function hasFailures(failures: Failures | undefined): failures is Failures {
  return failures !== undefined && (failures.devices.length > 0 || failures.connections.length > 0);
}

/**
 * `topo` with `failures` applied. Ids that are not in the topology are
 * dropped; with nothing left to break the result carries no `failures` at all,
 * so "no failures" has one shape only.
 */
export function withFailures(topo: Topology, failures: Failures | undefined): Topology {
  const base: Topology = { devices: topo.devices, connections: topo.connections };
  if (!hasFailures(failures)) return base;

  const deviceIds = new Set(topo.devices.map(device => device.id));
  const connectionIds = new Set(topo.connections.map(connection => connection.id));
  const kept: Failures = {
    devices: [...new Set(failures.devices)].filter(id => deviceIds.has(id)),
    connections: [...new Set(failures.connections)].filter(id => connectionIds.has(id)),
  };
  return hasFailures(kept) ? { ...base, failures: kept } : base;
}

/** True when the device is taken as down */
export function isDeviceDown(topo: Topology, deviceId: string): boolean {
  return topo.failures?.devices.includes(deviceId) ?? false;
}

/** True when the cable itself is taken as cut */
export function isLinkCut(topo: Topology, connectionId: string): boolean {
  return topo.failures?.connections.includes(connectionId) ?? false;
}

/**
 * Why nothing travels on `connection` when leaving `from` towards `to`:
 * the cable is cut, or the device at the far end is down. Undefined when the
 * cable works.
 */
export function linkDownReason(
  topo: Topology,
  connection: NetworkConnection,
  from: NetworkDevice,
  to: NetworkDevice
): string | undefined {
  if (!topo.failures) return undefined;
  if (isLinkCut(topo, connection.id)) return `link ${from.label}–${to.label} is down`;
  if (isDeviceDown(topo, to.id)) return `${to.label} is down`;
  return undefined;
}

/**
 * The interfaces of `device` that have cables attached and none of them
 * working, as interface key → reason. A device knows such an interface is
 * down (no carrier) and stops using the routes that leave by it.
 *
 * An interface nothing is attached to is not in the map: there is no failure
 * to speak of, and layer 2 reports the missing cable.
 *
 * Worked out once per topology and device while a memo is in force (see
 * ./memo); the map is not to be changed by the caller.
 */
export function deadInterfaces(device: NetworkDevice, topo: Topology): Map<string, string> {
  if (!hasFailures(topo.failures)) return new Map();
  // (kept by its id when the device is the topology's own object; any other
  // version of it is worked out apart)
  if (devicesById(topo).get(device.id) !== device) return findDeadInterfaces(device, topo);
  return rememberedFor(DEAD_INTERFACES, topo, device.id, () => findDeadInterfaces(device, topo));
}

const DEAD_INTERFACES = memoSlot('dead interfaces');

function findDeadInterfaces(device: NetworkDevice, topo: Topology): Map<string, string> {
  const dead = new Map<string, string>();
  const devicesById = new Map(topo.devices.map(d => [d.id, d] as const));
  const interfaces = new Set(listInterfaces(device).map(iface => iface.key));
  const working = new Set<string>();

  for (const connection of topo.connections) {
    if (connection.source !== device.id && connection.target !== device.id) continue;
    if (connection.source === connection.target) continue;
    const iface = boundInterface(connection, device);
    if (!iface || !interfaces.has(iface.key)) continue;
    const peer = devicesById.get(connection.source === device.id ? connection.target : connection.source);
    if (!peer) continue;

    const reason = linkDownReason(topo, connection, device, peer);
    if (reason === undefined) {
      working.add(iface.key);
      dead.delete(iface.key);
    } else if (!working.has(iface.key) && !dead.has(iface.key)) {
      dead.set(iface.key, reason);
    }
  }
  return dead;
}
