/**
 * Network Engine — VLANs on switch ports
 *
 * A switch port is an ACCESS port in one VLAN or a TRUNK carrying a list:
 *
 *  - access N: untagged frames coming in belong to VLAN N; only VLAN N leaves,
 *    untagged
 *  - trunk:    frames keep their VLAN tag; only the listed VLANs pass (no
 *    list: all of them). An untagged frame on a trunk is in VLAN 1
 *
 * A switch is VLAN-AWARE once any of its ports has a VLAN written on it:
 * from then on the ports nobody touched are access ports in VLAN 1, as on
 * real hardware. A switch with no VLAN on any port forwards frames as they
 * are.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { NetworkDevice, Port } from '@/types';

/** VLAN of a port nobody configured, and of untagged frames on a trunk */
export const DEFAULT_VLAN = 1;

export type PortVlanMode =
  | { kind: 'access'; vlan: number; /** false for the default VLAN of an untouched port */ explicit: boolean }
  | { kind: 'trunk'; /** empty = every VLAN */ vlans: number[] };

/** True when the port carries a VLAN of its own */
function hasVlan(port: Port): boolean {
  return Array.isArray(port.vlan) ? port.vlan.length > 0 : port.vlan !== undefined;
}

/** True when the bridge applies VLANs port by port (see the header) */
export function isVlanAware(device: NetworkDevice): boolean {
  return (device.ports ?? []).some(hasVlan);
}

/** How a port of a VLAN-aware switch treats frames */
export function portVlanMode(port: Port | undefined): PortVlanMode {
  if (!port) return { kind: 'access', vlan: DEFAULT_VLAN, explicit: false };

  if (Array.isArray(port.vlan) && port.vlan.length > 0) {
    // A list on a port left in access mode with a single entry is that VLAN
    if (port.portType !== 'trunk' && port.vlan.length === 1) {
      return { kind: 'access', vlan: port.vlan[0], explicit: true };
    }
    return { kind: 'trunk', vlans: port.vlan };
  }
  if (typeof port.vlan === 'number') {
    return port.portType === 'trunk'
      ? { kind: 'trunk', vlans: [port.vlan] }
      : { kind: 'access', vlan: port.vlan, explicit: true };
  }
  if (port.portType === 'trunk') return { kind: 'trunk', vlans: [] };
  return { kind: 'access', vlan: DEFAULT_VLAN, explicit: false };
}

/** True when the trunk carries the VLAN */
export function trunkCarries(mode: Extract<PortVlanMode, { kind: 'trunk' }>, vlan: number): boolean {
  return mode.vlans.length === 0 || mode.vlans.includes(vlan);
}

/** `access port in VLAN 10` / `trunk carrying VLANs [10,20]` / `in the default VLAN 1` */
export function describePortVlan(mode: PortVlanMode): string {
  if (mode.kind === 'trunk') {
    return mode.vlans.length === 0
      ? 'a trunk carrying every VLAN'
      : `a trunk carrying VLANs [${mode.vlans.join(',')}]`;
  }
  return mode.explicit
    ? `an access port in VLAN ${mode.vlan}`
    : `in the default VLAN ${mode.vlan}`;
}
