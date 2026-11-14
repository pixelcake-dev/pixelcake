/**
 * A sample network: a drawing, and what goes with it. A sample is made for
 * a network of its own, so it brings the network settings of the project it
 * is loaded into: without them a new device would be offered an address of
 * no network of the drawing.
 *
 * Pure: no React, no DOM, no store.
 */

import type { GlobalNetworkSettings, NetworkConnection, NetworkDevice, ProjectVlan } from '@/types';
import { tidyVlans } from '@/utils/vlanNames';

export interface SampleNetwork {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  /** The network settings of the project the sample is made for: loading it sets them */
  settings: GlobalNetworkSettings;
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
