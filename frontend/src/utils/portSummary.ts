/**
 * The ports of a device at a glance, for the first screen of its window:
 * how a switch splits its ports among the VLANs, and which ports of a router
 * or of a firewall are in use. Pure: the window draws what comes out.
 */

import { maskToPrefix, portVlanMode } from '@/engine';
import { isValidIP } from '@/utils/ipHelpers';
import { vlanLabel, vlanShort } from '@/utils/vlanNames';
import type { Port, ProjectVlan } from '@/types';

/** `1–4, 7, 9–10`: a list of port numbers, runs written as ranges */
export function portRanges(ids: number[]): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) continue;
    const first = sorted[start];
    const last = sorted[i - 1];
    // two numbers in a row are clearer as two numbers than as a range
    if (last === first) parts.push(String(first));
    else if (last === first + 1) parts.push(String(first), String(last));
    else parts.push(`${first}–${last}`);
    start = i;
  }
  return parts.join(', ');
}

export interface SwitchSummary {
  total: number;
  linked: number;
  disabled: number;
  /**
   * True when the switch applies VLANs port by port: at least one port has a
   * VLAN of its own (see the engine, ./vlan)
   */
  vlanAware: boolean;
  /** The access ports by VLAN, lowest VLAN first; empty when the switch applies no VLAN */
  vlans: { vlan: number; ports: number[] }[];
  /** The trunk ports with the VLANs each carries; an empty list is all of them */
  trunks: { port: number; vlans: number[] }[];
}

/** True when a port of these has a VLAN of its own: the device then applies VLANs port by port */
function appliesVlans(ports: Port[]): boolean {
  return ports.some((port) => {
    const mode = portVlanMode(port);
    return mode.kind === 'access' ? mode.explicit : mode.vlans.length > 0;
  });
}

/**
 * The VLAN of a port in a few words, as the engine reads the port among the
 * others of its device: `VLAN 10 «Uffici»` for an access port, `trunk: VLAN
 * 10 «Uffici», 20` or `trunk: tutte le VLAN` for a trunk. Empty when the
 * device applies no VLAN: a router, a firewall, a switch nobody split.
 */
export function portVlanText(
  port: Port,
  ports: Port[],
  names: readonly ProjectVlan[] | undefined
): string {
  if (!appliesVlans(ports)) return '';
  const mode = portVlanMode(port);
  if (mode.kind === 'access') return vlanLabel(mode.vlan, names);
  if (mode.vlans.length === 0) return 'trunk: tutte le VLAN';
  const carried = [...mode.vlans].sort((a, b) => a - b).map((vlan) => vlanShort(vlan, names));
  return `trunk: VLAN ${carried.join(', ')}`;
}

export function summariseSwitch(ports: Port[], linkedPorts: ReadonlyMap<number, string>): SwitchSummary {
  const modes = ports.map((port) => ({ port, mode: portVlanMode(port) }));
  const vlanAware = appliesVlans(ports);
  const byVlan = new Map<number, number[]>();
  const trunks: SwitchSummary['trunks'] = [];
  for (const { port, mode } of modes) {
    if (mode.kind === 'trunk') {
      trunks.push({ port: port.id, vlans: [...mode.vlans].sort((a, b) => a - b) });
    } else if (vlanAware) {
      byVlan.set(mode.vlan, [...(byVlan.get(mode.vlan) ?? []), port.id]);
    }
  }
  return {
    total: ports.length,
    linked: ports.filter((port) => linkedPorts.has(port.id)).length,
    disabled: ports.filter((port) => port.enabled === false).length,
    vlanAware,
    vlans: [...byVlan.entries()].sort((a, b) => a[0] - b[0]).map(([vlan, ids]) => ({ vlan, ports: ids })),
    trunks,
  };
}

/** `192.168.10.1/24`: the address of a port with the length of its mask; '' when it has none */
export function portAddressText(port: Port): string {
  const ip = (port.ip ?? '').trim();
  if (!ip || !isValidIP(ip)) return '';
  const prefix = port.subnet ? maskToPrefix(port.subnet.trim()) : 24;
  return prefix === undefined ? ip : `${ip}/${prefix}`;
}

/** True for a port of a router or firewall worth a line on the first screen: it has an address, a cable or a service */
export function isPortInUse(port: Port, linkedPorts: ReadonlyMap<number, string>): boolean {
  return (
    portAddressText(port) !== '' ||
    linkedPorts.has(port.id) ||
    port.nat === true ||
    port.dhcpServer !== undefined
  );
}
