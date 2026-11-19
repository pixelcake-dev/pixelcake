/**
 * Addresses in conflict, as the screens show them: which address a device
 * shows as in conflict under its name, and which other devices have the
 * addresses of one device. The rule is the engine's (engine/conflicts).
 *
 * Pure: no React, no stores.
 */

import type { AddressConflicts } from '@/engine';
import type { NetworkDevice } from '@/types';

/**
 * The address shown in conflict under the name of a device: the one it
 * shows anyway, when that is in conflict, else the first of its addresses
 * that is (a port of a router); undefined when none is
 */
export function conflictedAddress(device: NetworkDevice, conflicts: AddressConflicts): string | undefined {
  const own = conflicts.byDevice.get(device.id);
  if (!own) return undefined;
  if (device.ip && own.has(device.ip)) return device.ip;
  return own.keys().next().value;
}

/** Each address of a device in conflict, with the names of the other devices that have it */
export function conflictsOf(
  deviceId: string,
  conflicts: AddressConflicts
): Array<{ address: string; devices: string[] }> {
  const own = conflicts.byDevice.get(deviceId);
  if (!own) return [];
  return [...own].map(([address, holders]) => ({
    address,
    devices: holders.filter((holder) => holder.id !== deviceId).map((holder) => holder.label),
  }));
}
