/**
 * What a paste adds to the board: the devices of the clipboard, the cables
 * among them and the areas copied with them, each made a thing of its own.
 *
 *  - A pasted device takes the first free name of its family, by the rule
 *    that names a new device (`newDeviceName`): `PC-1` gives the first free
 *    `PC-n`.
 *  - Every network card gets a MAC address of its own.
 *  - An end device that is not a server (a PC, a laptop, a printer…) asks
 *    for its address, as a real one plugged into a network does: its cards
 *    go on DHCP. Without a DHCP server that hears it, it stays without one,
 *    and the board says so under its name. Servers, routers, firewalls and
 *    switches keep the addresses of the original, as a real machine that
 *    is cloned: those addresses are then in conflict (engine/conflicts),
 *    and the board says so, until they are changed.
 *  - The copy goes one step down and to the right of the original, or as
 *    many steps as it takes not to land on a device, or an area on an
 *    area, that is there (a copy pasted before).
 *
 * Pure but for the random MAC addresses, which can be handed in.
 */

import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';
import { forwardingRole, normalizeAddressing, normalizeBindings } from '@/engine';
import { nextAreaId } from '@/utils/canvasAreas';
import { generateMacAddress } from '@/utils/ipHelpers';
import { newDeviceName } from '@/utils/newDevice';

/** What Edit → Copy keeps: the devices, the cables among them, the areas */
export interface Clipboard {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  areas: CanvasArea[];
}

/** How far a copy goes from the original, down and to the right, at each step */
export const PASTE_STEP = 50;

/** Closer than this to a device that is there, a pasted device would be on top of it */
const ON_TOP = PASTE_STEP / 2;

/** The kinds that keep the addresses of the original: servers have fixed ones */
const SERVER_TYPES = new Set(['Server', 'Database']);

/** True when there is something to paste */
export function hasClipboard(clipboard: Clipboard | null): clipboard is Clipboard {
  return clipboard !== null && (clipboard.devices.length > 0 || clipboard.areas.length > 0);
}

/**
 * The name a pasted device takes: its name without the number at its end
 * (`PC-1` → `PC`, `Reception` as it is), and the first free number after it.
 */
export function pastedDeviceName(
  device: Pick<NetworkDevice, 'label' | 'type'>,
  devices: ReadonlyArray<Pick<NetworkDevice, 'label'>>
): string {
  // (a number glued to the name is part of it: `R1` is a name, not R and 1)
  const family = (device.label ?? '').trim().replace(/[-\s]+\d+$/, '').trim();
  return newDeviceName(family || device.type, devices);
}

/**
 * True when the cards of a pasted device go on DHCP: an end device (what
 * the engine calls a host) that is not a server, with at least one card
 */
export function asksForAddressWhenPasted(device: NetworkDevice): boolean {
  return (
    (device.nics ?? []).length > 0 && forwardingRole(device) === 'host' && !SERVER_TYPES.has(device.type)
  );
}

/** What a paste adds, and which of the devices went on DHCP */
export interface Pasted {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  areas: CanvasArea[];
  /** The ids of the pasted devices whose cards went on DHCP */
  onDhcp: string[];
}

/** The board a paste lands on */
export interface PasteTarget {
  devices: NetworkDevice[];
  areas: CanvasArea[];
  deviceCounter: number;
  connectionCounter: number;
}

/**
 * The first number of steps for which nothing pasted lands on what is there:
 * a device on a device, an area on an area
 */
function stepsAway(clipboard: Clipboard, board: PasteTarget): number {
  type Placed = { position: { x: number; y: number } };
  const onTop = (things: readonly Placed[], others: readonly Placed[], shift: number) =>
    things.some((thing) =>
      others.some(
        (other) =>
          Math.abs(other.position.x - (thing.position.x + shift)) < ON_TOP &&
          Math.abs(other.position.y - (thing.position.y + shift)) < ON_TOP
      )
    );
  for (let steps = 1; steps < 100; steps++) {
    const shift = steps * PASTE_STEP;
    if (!onTop(clipboard.devices, board.devices, shift) && !onTop(clipboard.areas, board.areas, shift)) {
      return steps;
    }
  }
  return 1;
}

/** A MAC address no card of the board has */
function freshMac(taken: Set<string>, newMac: () => string): string {
  let mac = newMac();
  for (let tries = 0; taken.has(mac.toUpperCase()) && tries < 100; tries++) mac = newMac();
  taken.add(mac.toUpperCase());
  return mac;
}

/**
 * The devices, cables and areas a paste adds to the board, with ids that
 * follow the counters of the board.
 */
export function pasteClipboard(
  clipboard: Clipboard,
  board: PasteTarget,
  newMac: () => string = generateMacAddress
): Pasted {
  const shift = stepsAway(clipboard, board) * PASTE_STEP;
  const moved = (place: { x: number; y: number }) => ({ x: place.x + shift, y: place.y + shift });

  const macs = new Set(
    board.devices.flatMap((device) => (device.nics ?? []).map((card) => (card.mac ?? '').toUpperCase()))
  );
  const idMap = new Map<string, string>();
  const named: NetworkDevice[] = [];
  const onDhcp: string[] = [];

  clipboard.devices.forEach((original, index) => {
    const id = `dev-${board.deviceCounter + index}`;
    idMap.set(original.id, id);
    const dhcp = asksForAddressWhenPasted(original);
    if (dhcp) onDhcp.push(id);
    const nics = original.nics?.map((card) => ({
      ...card,
      mac: freshMac(macs, newMac),
      ...(dhcp ? { dhcp: true } : {}),
    }));
    named.push(
      // (a card on DHCP keeps no address of its own: normalizeAddressing empties it)
      normalizeAddressing({
        ...original,
        id,
        label: pastedDeviceName(original, [...board.devices, ...named]),
        position: moved(original.position),
        ...(nics ? { nics } : {}),
      })
    );
  });

  const connections = clipboard.connections.map((connection, index) => ({
    ...connection,
    id: `conn-${board.connectionCounter + index}`,
    source: idMap.get(connection.source)!,
    target: idMap.get(connection.target)!,
  }));

  const areas: CanvasArea[] = [];
  for (const area of clipboard.areas) {
    areas.push({ ...area, id: nextAreaId([...board.areas, ...areas]), position: moved(area.position) });
  }

  return {
    devices: named,
    // (pasted cables keep the interfaces of those they were copied from: the
    // pasted devices carry the same ports and cards; an end left unbound is bound)
    connections: normalizeBindings(named, connections),
    areas,
    onDhcp,
  };
}
