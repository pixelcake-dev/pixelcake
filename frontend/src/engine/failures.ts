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
 * A cable whose far end is attached to an interface that is switched off
 * carries nothing either, and the device at the near end sees it: a port
 * switched off takes its line down for both ends, as a real link loses its
 * carrier on both sides.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { NetworkConnection, NetworkDevice } from '@/types';
import type { Failures, Topology } from './types';
import { boundInterface, interfacePhrase, listInterfaces } from './interfaces';
import { memoSlot, rememberedFor } from './memo';
import { connectionsOf, devicesById } from './topology';

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
 * Why `connection` carries nothing between `device` and `peer`, as `device`
 * sees it: the cable is cut, `peer` is down, or the interface at `peer`'s end
 * is switched off. Undefined when the line works.
 */
function lineDownReason(
  topo: Topology,
  connection: NetworkConnection,
  device: NetworkDevice,
  peer: NetworkDevice
): string | undefined {
  const broken = linkDownReason(topo, connection, device, peer);
  if (broken !== undefined) return broken;
  const far = boundInterface(connection, peer);
  return far && !far.enabled ? `${interfacePhrase(far)} on ${peer.label} is disabled` : undefined;
}

/**
 * The interfaces of `device` that have cables attached and none of them
 * working, as interface key → reason. A device knows such an interface is
 * down (no carrier) and stops using the routes that leave by it. A cable does
 * not work when it is cut, when the device at its other end is down, or when
 * the interface at its other end is switched off.
 *
 * An interface nothing is attached to is not in the map: there is no failure
 * to speak of, and layer 2 reports the missing cable. Nor is an interface of
 * `device` that is itself switched off: the routes that leave by it are
 * already out of use (see lookupRoute in ./addressing).
 *
 * Worked out once per topology and device while a memo is in force (see
 * ./memo); the map is not to be changed by the caller.
 */
export function deadInterfaces(device: NetworkDevice, topo: Topology): Map<string, string> {
  // (kept by its id when the device is the topology's own object; any other
  // version of it is worked out apart)
  if (devicesById(topo).get(device.id) !== device) return findDeadInterfaces(device, topo);
  return rememberedFor(DEAD_INTERFACES, topo, device.id, () => findDeadInterfaces(device, topo));
}

const DEAD_INTERFACES = memoSlot('dead interfaces');

function findDeadInterfaces(device: NetworkDevice, topo: Topology): Map<string, string> {
  const dead = new Map<string, string>();
  const byId = devicesById(topo);
  const interfaces = new Set(listInterfaces(device).map(iface => iface.key));
  const working = new Set<string>();

  for (const connection of connectionsOf(topo, device.id)) {
    if (connection.source === connection.target) continue;
    const iface = boundInterface(connection, device);
    if (!iface || !interfaces.has(iface.key)) continue;
    const peer = byId.get(connection.source === device.id ? connection.target : connection.source);
    if (!peer) continue;

    const reason = lineDownReason(topo, connection, device, peer);
    if (reason === undefined) {
      working.add(iface.key);
      dead.delete(iface.key);
    } else if (!working.has(iface.key) && !dead.has(iface.key)) {
      dead.set(iface.key, reason);
    }
  }
  return dead;
}
