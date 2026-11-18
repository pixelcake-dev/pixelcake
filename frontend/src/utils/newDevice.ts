/**
 * What a new device starts with, whichever window makes it: the window that
 * adds one (AddDeviceModal) and the one that adds in bulk (bulkDeviceHelpers)
 * both ask here, so that the two cannot drift apart.
 *
 * Pure: no React, no stores.
 */

import type { NetworkDevice, Port } from '@/types/network';
import { isL3Type } from '@/engine';

/**
 * A name as the terminal compares names (`resolveEndpoint` of the engine):
 * without the spaces around it, a run of spaces taken for one space, and
 * whatever the case.
 */
const nameKey = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Whether another device of the list already has this name, compared as the
 * terminal compares names: «pc-1», «PC-1» and « PC-1 » are the same name,
 * because the terminal could not tell which of the two devices one means.
 *
 * Every place that names a device asks here (the window that adds one, the
 * window of a device, the terminal), so that the rule is one.
 *
 * @param name The name wanted
 * @param devices The devices of the canvas
 * @param exceptId The device being renamed, whose own name does not count
 */
export function isNameTaken(
  name: string,
  devices: ReadonlyArray<Pick<NetworkDevice, 'id' | 'label'>>,
  exceptId?: string
): boolean {
  const key = nameKey(name);
  if (!key) return false;
  return devices.some((device) => device.id !== exceptId && nameKey(device.label ?? '') === key);
}

/**
 * The name a new device of a template is proposed: the name of the template,
 * with a dash for each run of spaces, and a number: the lowest, from 1, for
 * which no device has that name.
 *
 * A name is taken when any device of the list has it, of that template or of
 * another, typed by hand or proposed here, and whatever its case: the
 * terminal finds a device by its name and does not tell «pc-1» from «PC-1».
 * The devices that are there are never renamed.
 *
 * @param templateName The name of the template (or of the type, for a device without one)
 * @param devices The devices of the canvas, those made a moment before included
 */
export function newDeviceName(
  templateName: string,
  devices: ReadonlyArray<Pick<NetworkDevice, 'label'>>
): string {
  const base = templateName.replace(/\s+/g, '-');
  const taken = new Set(devices.map((device) => nameKey(device.label ?? '')));
  let number = 1;
  while (taken.has(nameKey(`${base}-${number}`))) number++;
  return `${base}-${number}`;
}

/**
 * The ports a new switch, router or firewall starts with: as many as were
 * chosen, numbered from 1, each on and at the speed the link finds. A port of
 * a router or a firewall is a LAN port, one of a switch (or of any other
 * device with ports) an access port.
 *
 * Nothing else is written on them: no VLAN, PoE, NAT, zone or IPS. The engine
 * applies those for real, so each is for whoever configures the device to
 * choose; a device with nothing on its ports forwards as one expects.
 *
 * @param portCount How many ports
 * @param deviceType The type of the device (Switch, Router, Firewall…)
 */
export function newDevicePorts(portCount: number, deviceType: string): Port[] {
  const portType = isL3Type(deviceType) ? 'lan' : 'access';
  return Array.from({ length: portCount }, (_, index) => ({
    id: index + 1,
    enabled: true,
    speed: 'auto',
    portType,
  }));
}
