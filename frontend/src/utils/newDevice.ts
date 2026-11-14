/**
 * What a new device starts with, whichever window makes it: the window that
 * adds one (AddDeviceModal) and the one that adds in bulk (bulkDeviceHelpers)
 * both ask here, so that the two cannot drift apart.
 *
 * Pure: no React, no stores.
 */

import type { NetworkDevice } from '@/types/network';

/**
 * A name as the terminal compares names (`resolveEndpoint` of the engine):
 * without the spaces around it, and whatever the case. (The terminal also
 * takes a run of spaces for one space, which makes no difference here: a
 * name proposed has no space in it.)
 */
const nameKey = (name: string): string => name.trim().toLowerCase();

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
