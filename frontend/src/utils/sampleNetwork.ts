/**
 * A sample network: a drawing, and what goes with it. A sample is made for
 * a network of its own, so it brings the network settings of the project it
 * is loaded into: without them a new device would be offered an address of
 * no network of the drawing. And it comes with its areas, the rectangles
 * that say at a glance what its groups of devices are.
 *
 * Pure: no React, no DOM, no store.
 */

import type {
  AreaColour,
  CanvasArea,
  GlobalNetworkSettings,
  NetworkConnection,
  NetworkDevice,
  ProjectVlan,
} from '@/types';
import { areaAround } from '@/utils/canvasAreas';
import { deviceSize } from '@/utils/drawingImage';
import { tidyVlans } from '@/utils/vlanNames';

export interface SampleNetwork {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  /** The network settings of the project the sample is made for: loading it sets them */
  settings: GlobalNetworkSettings;
  /** The areas behind its groups of devices (the canvas gives each its id when the sample is loaded) */
  areas: SampleArea[];
}

/** An area of a sample, before the canvas has given it an id */
export type SampleArea = Omit<CanvasArea, 'id'>;

/** A group of devices of a sample that an area is drawn around: its devices are named by their ids */
export interface SampleGroup {
  label: string;
  color: AreaColour;
  devices: readonly string[];
}

/** The size the canvas gives a device */
export type DeviceSize = (device: NetworkDevice) => { width: number; height: number };

/**
 * The size a device is drawn with: its frame (utils/deviceGeometry.ts, the
 * numbers of the style sheet), a line lower when it shows no address. A
 * device on DHCP shows the one it is leased. When the look of a device
 * changes, this follows, and the areas with it.
 */
export const drawnSize: DeviceSize = (device) =>
  deviceSize(Boolean(device.ip) || (device.nics ?? []).some((nic) => nic.dhcp === true));

/**
 * The areas of a sample: one around each group of its devices. No rectangle
 * is typed in a sample: each is where its devices are, with the room around
 * them, and above for its label, that «Racchiudi in un riquadro» leaves
 * (`areaAround`, utils/canvasAreas.ts). Move a device, or draw devices
 * larger, and the area follows.
 */
export function areasAround(
  groups: readonly SampleGroup[],
  devices: readonly NetworkDevice[],
  sizeOf: DeviceSize = drawnSize
): SampleArea[] {
  return groups.map((group) => {
    const members = group.devices.map((id) => {
      const device = devices.find((candidate) => candidate.id === id);
      if (!device) throw new Error(`the area "${group.label}" names a device the sample does not have: ${id}`);
      return device;
    });
    const place = areaAround(members.map((device) => ({ ...device.position, ...sizeOf(device) })));
    if (!place) throw new Error(`the area "${group.label}" holds no device`);
    return { label: group.label, color: group.color, position: place.position, size: place.size };
  });
}

/** A network of 254 addresses: every network of the samples is one */
const SAMPLE_MASK = '255.255.255.0';

/**
 * The settings a sample brings, every one of them: none of the project it
 * is loaded into is left over.
 *
 *  - `network`, `gateway`: where a new device starts from, the network its
 *    first PCs are on and the router port that serves it;
 *  - `dns`: the DNS server of the sample, when it has one;
 *  - `vlans`: a name for every VLAN the sample uses.
 *
 * The mail travels the way the drawing says (`auto`): a sample with a mail
 * server uses it, whatever the project it replaces was set to.
 */
export function sampleSettings(of: {
  network: string;
  gateway: string;
  dns?: string;
  vlans?: ProjectVlan[];
}): GlobalNetworkSettings {
  const vlans = tidyVlans(of.vlans ?? []);
  return {
    ipClass: of.network,
    subnet: SAMPLE_MASK,
    gateway: of.gateway,
    dns: of.dns,
    emailMode: 'auto',
    vlans: vlans.length > 0 ? vlans : undefined,
  };
}
