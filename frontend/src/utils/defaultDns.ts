/**
 * The DNS server of the project (Impostazioni → Rete) and the devices of a
 * drawing. A new end device starts with it on its card; changing it does not
 * touch the devices that are there, so the settings offer to give it to
 * those that ask nobody.
 *
 * It is for end devices: a PC, a server, a printer. What carries traffic for
 * others (an access point, a load balancer, a Cloud symbol) has a card too,
 * and is left without, like the routers and the switches, which have none.
 *
 * Pure: no React, no stores.
 */

import type { NetworkConnection, NetworkDevice } from '@/types';
import { dnsCardOf, forwardingRole, withLeases } from '@/engine';

/** True when a device of this type (and template) is an end device */
export function isEndDeviceKind(type: string, templateId?: string): boolean {
  const blank = { id: '', label: '', ip: '', subnet: '', gateway: '', position: { x: 0, y: 0 } };
  return forwardingRole({ ...blank, type, templateId }) === 'host';
}

/**
 * The end devices of a drawing that have nobody to ask a name of, and a card
 * to write a DNS server on: no enabled card of theirs names one (by hand, or
 * with its lease), and at least one card is addressed by hand. A device
 * whose cards are all on DHCP is not among them: its server comes with the
 * address.
 */
export function devicesWithoutDns(
  devices: NetworkDevice[],
  connections: NetworkConnection[]
): NetworkDevice[] {
  const leased = new Map(
    withLeases({ devices, connections }).devices.map((device) => [device.id, device])
  );
  return devices.filter((device) => {
    if (forwardingRole(device) !== 'host') return false;
    const nics = device.nics ?? [];
    if (!nics.some((nic) => nic.dhcp !== true)) return false;
    return dnsCardOf(leased.get(device.id) ?? device) === undefined;
  });
}

/**
 * The device asking `dns`: the address is written on its first card that is
 * addressed by hand. Cards on DHCP are left as they are. The same device
 * when it has no such card.
 */
export function withDnsServer(device: NetworkDevice, dns: string): NetworkDevice {
  const nics = device.nics ?? [];
  const index = nics.findIndex((nic) => nic.dhcp !== true);
  if (index === -1) return device;
  return {
    ...device,
    nics: nics.map((nic, at) => (at === index ? { ...nic, dns } : nic)),
  };
}
