/**
 * The names of the VLANs of a project. A VLAN is a number everywhere in the
 * drawing and for the engine; the project gives a name to those it wants
 * («10 = Uffici», Impostazioni → Rete), and the interface writes the name
 * next to the number wherever it shows one.
 *
 * No React, and nothing of the drawing is read from a store. What is written
 * for a person (a VLAN with its name, what is wrong with a row) is in the
 * language of the interface, read when the function is called.
 */

import type { NetworkConnection, NetworkDevice, ProjectVlan } from '@/types';
import { isSwitchLike, isVlanAware, portVlanMode } from '@/engine';
import { getT } from '@/i18n';

/** How long the name of a VLAN can be (what most switches allow) */
export const VLAN_NAME_MAX_LENGTH = 32;

/** True for a VLAN number: a whole number from 1 to 4094 */
export function isVlanId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4094;
}

/** The name of a VLAN as it is kept: nothing around it, no longer than the limit */
export function tidyVlanName(name: string): string {
  return name.trim().slice(0, VLAN_NAME_MAX_LENGTH).trim();
}

/**
 * A list of named VLANs as a project keeps it: names tidy, entries without
 * a name or a VLAN number left out, one entry for a number (the first),
 * lowest number first.
 */
export function tidyVlans(list: readonly ProjectVlan[]): ProjectVlan[] {
  const byId = new Map<number, ProjectVlan>();
  for (const entry of list) {
    if (!isVlanId(entry.id) || typeof entry.name !== 'string') continue;
    const name = tidyVlanName(entry.name);
    if (name !== '' && !byId.has(entry.id)) byId.set(entry.id, { id: entry.id, name });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** The name the project gave a VLAN; undefined when it has none */
export function vlanName(id: number, vlans: readonly ProjectVlan[] | undefined): string | undefined {
  return vlans?.find((entry) => entry.id === id)?.name;
}

/** A VLAN in a list of numbers: `10 “Offices”`, or `10` when it has no name */
export function vlanShort(id: number, vlans: readonly ProjectVlan[] | undefined): string {
  const name = vlanName(id, vlans);
  return name ? getT().vlan.numberAndName(id, name) : String(id);
}

/** A VLAN by itself: `VLAN 10 “Offices”`, or `VLAN 10` when it has no name */
export function vlanLabel(id: number, vlans: readonly ProjectVlan[] | undefined): string {
  return `VLAN ${vlanShort(id, vlans)}`;
}

// ---------- the table the names are typed in (Impostazioni → Rete) ----------

/** A row of the table of the VLANs of the project, as it is typed */
export interface VlanRow {
  /** Tells the rows of the list apart, whatever is typed in them */
  key: string;
  /** The number, as typed */
  id: string;
  name: string;
  /**
   * The number is not typed: the VLAN had a name already, or the drawing
   * uses it. A row added by hand asks for it.
   */
  fixed: boolean;
  /** The drawing on screen uses this VLAN */
  inUse: boolean;
}

/**
 * The rows the table starts from: the VLANs that have a name and those the
 * drawing uses without one (to be named in one go), lowest number first.
 */
export function vlanRows(
  named: readonly ProjectVlan[] | undefined,
  used: readonly number[]
): VlanRow[] {
  const names = new Map((named ?? []).map((entry) => [entry.id, entry.name]));
  const ids = [...new Set([...names.keys(), ...used])].sort((a, b) => a - b);
  return ids.map((id) => ({
    key: `vlan-${id}`,
    id: String(id),
    name: names.get(id) ?? '',
    fixed: true,
    inUse: used.includes(id),
  }));
}

/** The number typed in a row, when it is one */
function rowNumber(row: VlanRow): number | undefined {
  const text = row.id.trim();
  const value = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  return isVlanId(value) ? value : undefined;
}

/**
 * What is wrong with a row of the table, given the list it is in; undefined
 * when it is fine. A row with no name is simply not kept: it is fine, unless
 * a number was typed for it by hand.
 */
export function vlanRowProblem(row: VlanRow, rows: readonly VlanRow[]): string | undefined {
  const words = getT().vlan.names.problems;
  const typedId = row.id.trim();
  const name = row.name.trim();
  if (row.fixed && name === '') return undefined;
  if (typedId === '' && name === '') return undefined;
  if (typedId === '') return words.numberMissing(name);
  const id = rowNumber(row);
  if (id === undefined) return words.notAVlan(typedId);
  if (name === '') return words.nameMissing(id);
  // (the row refused is the second one that carries the number)
  const first = rows.find((other) => rowNumber(other) === id);
  if (first !== undefined && first !== row) return words.duplicate(id);
  return undefined;
}

/** The names the table gives, as the project keeps them. Read it once no row has a problem */
export function namedVlans(rows: readonly VlanRow[]): ProjectVlan[] {
  return tidyVlans(
    rows.flatMap((row) => {
      const id = rowNumber(row);
      return id === undefined ? [] : [{ id, name: row.name }];
    })
  );
}

/**
 * The VLANs a drawing uses, lowest first: those written on a device, on a
 * port or on a cable, and VLAN 1 when a switch that applies VLANs has ports
 * nobody touched (they are in it: see the engine, ./vlan).
 */
export function vlansInUse(devices: NetworkDevice[], connections: NetworkConnection[]): number[] {
  const found = new Set<number>();
  const add = (value: unknown) => {
    if (isVlanId(value)) found.add(value);
  };
  for (const device of devices) {
    (device.vlan ?? []).forEach(add);
    const applies = isSwitchLike(device) && isVlanAware(device);
    for (const port of device.ports ?? []) {
      if (Array.isArray(port.vlan)) port.vlan.forEach(add);
      else add(port.vlan);
      if (!applies) continue;
      const mode = portVlanMode(port);
      if (mode.kind === 'access') add(mode.vlan);
    }
  }
  for (const connection of connections) (connection.vlan ?? []).forEach(add);
  return [...found].sort((a, b) => a - b);
}
