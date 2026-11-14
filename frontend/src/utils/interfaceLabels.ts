/**
 * UI labels for interfaces and the links attached to them, in the language
 * of the interface at the moment they are asked for.
 * (The engine's own labels are always English: they go into terminal and
 * trace messages. Everything the modals show goes through here.)
 */

import type { DeviceInterface, InterfaceLink } from '@/engine';
import { getT } from '@/i18n';

/** Name of an interface inside a sentence: "porta 8" / "eth0" */
export function interfaceShortLabel(iface: DeviceInterface): string {
  return iface.kind === 'port' ? getT().common.interfaces.portInSentence(iface.port.id) : iface.label;
}

/**
 * Entry of an interface picker: "Porta 3 — Uplink" / "eth0 (192.168.10.11)".
 * A card that takes its address from DHCP says so, with the address it is
 * leased when the interface comes with it: "eth0 (192.168.20.100 · DHCP)",
 * "eth0 (DHCP)".
 */
export function interfaceOptionLabel(iface: DeviceInterface): string {
  const address = iface.ip ? ` (${iface.ip})` : '';
  if (iface.kind === 'port') {
    const name = iface.port.name ? ` — ${iface.port.name}` : '';
    return `${getT().common.interfaces.port(iface.port.id)}${name}${address}`;
  }
  if (iface.nic.dhcp) return `${iface.label} (${iface.ip ? `${iface.ip} · DHCP` : 'DHCP'})`;
  return `${iface.label}${address}`;
}

/** What an interface is linked to: "SW-Office (porta 8)", or "SW-Office" when the far end is not assigned */
export function linkPeerLabel(link: InterfaceLink): string {
  const peer = link.peer?.label ?? getT().interfaces.link.unknownDevice;
  return link.peerInterface ? `${peer} (${interfaceShortLabel(link.peerInterface)})` : peer;
}
