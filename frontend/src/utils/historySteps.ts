/**
 * What a step of the history did, in a few words: the name the menu gives
 * to Undo and Redo («Annulla: elimina «PC-3»»). Worked out by comparing the
 * board before the step with the board after it, so that nothing has to say
 * what it is doing when it changes the drawing. Pure.
 *
 * Only what can be said plainly is named: one device, one link or one area
 * added, deleted, moved or changed, several devices added, deleted or moved,
 * several links added. Anything else (a drawing replaced by an import, a
 * field of the board other than devices, links and areas) has no name, and
 * the menu says «Annulla» alone.
 */

import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';

export type StepName =
  | { kind: 'addDevice' | 'deleteDevice' | 'moveDevice' | 'editDevice'; name: string }
  | { kind: 'addDevices' | 'deleteDevices' | 'moveDevices' | 'addLinks'; count: number }
  | { kind: 'addLink' | 'deleteLink' | 'editLink'; source: string; target: string }
  | { kind: 'addArea' | 'deleteArea' | 'moveArea' | 'editArea'; name: string };

/** The fields of a board, by the name they have in the store */
type Board = Record<string, unknown>;

/** The fields a step can be named by; the counters change with them */
const NAMED_FIELDS = new Set(['devices', 'connections', 'areas', 'deviceCounter', 'connectionCounter']);

const listOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** What was added, removed and changed between two lists of things with an id */
function compare<T extends { id: string }>(before: T[], after: T[]) {
  const was = new Map(before.map((item) => [item.id, item]));
  const now = new Map(after.map((item) => [item.id, item]));
  return {
    added: after.filter((item) => !was.has(item.id)),
    removed: before.filter((item) => !now.has(item.id)),
    changed: after
      .filter((item) => was.has(item.id) && !same(was.get(item.id), item))
      .map((item) => ({ before: was.get(item.id) as T, after: item })),
  };
}

/** True when nothing but these fields changed */
const onlyChanged =
  (fields: string[]) =>
  <T extends object>({ before, after }: { before: T; after: T }) => {
    const without = (item: T) => ({ ...item, ...Object.fromEntries(fields.map((field) => [field, null])) });
    return same(without(before), without(after));
  };
/** A device or an area moved, and nothing else */
const movedOnly = onlyChanged(['position']);
/** An area moved or drawn again around its devices (the automatic layout) */
const followedOnly = onlyChanged(['position', 'size']);
/** A link whose ends turned to other sides of its devices (the automatic layout) */
const turnedOnly = onlyChanged(['sourceHandle', 'targetHandle']);

/** What took the board from `before` to `after`, when it can be said in a few words */
export function describeStep(before: Board, after: Board): StepName | null {
  // (another field of the board changed: it is not named)
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!NAMED_FIELDS.has(key) && !same(before[key], after[key])) return null;
  }
  const devices = compare(listOf<NetworkDevice>(before.devices), listOf<NetworkDevice>(after.devices));
  const links = compare(listOf<NetworkConnection>(before.connections), listOf<NetworkConnection>(after.connections));
  const areas = compare(listOf<CanvasArea>(before.areas), listOf<CanvasArea>(after.areas));
  const names = new Map(
    [...listOf<NetworkDevice>(before.devices), ...listOf<NetworkDevice>(after.devices)].map((device) => [
      device.id,
      device.label,
    ])
  );
  const ends = (link: NetworkConnection) => ({
    source: names.get(link.source) ?? link.source,
    target: names.get(link.target) ?? link.target,
  });

  // Devices deleted, with what went with them (their links, the areas selected)
  if (devices.removed.length > 0) {
    // (deleted and added at once: a drawing replaced)
    if (devices.added.length > 0 || devices.changed.length > 0) return null;
    return devices.removed.length === 1
      ? { kind: 'deleteDevice', name: devices.removed[0].label }
      : { kind: 'deleteDevices', count: devices.removed.length };
  }

  // Devices added, with the links among them and the areas pasted with them
  if (devices.added.length > 0) {
    if (devices.changed.length > 0 || links.removed.length > 0 || areas.removed.length > 0) return null;
    return devices.added.length === 1
      ? { kind: 'addDevice', name: devices.added[0].label }
      : { kind: 'addDevices', count: devices.added.length };
  }

  // Devices and areas changed: moved, or edited in their window
  if (devices.changed.length > 0 || areas.changed.length > 0) {
    if (areas.added.length > 0 || areas.removed.length > 0 || links.added.length > 0 || links.removed.length > 0) {
      return null;
    }
    // Devices moved: the areas of a selection move with them, and an automatic
    // layout draws the areas again around them and turns the ends of the links
    if (
      devices.changed.length > 0 &&
      devices.changed.every(movedOnly) &&
      areas.changed.every(followedOnly) &&
      links.changed.every(turnedOnly)
    ) {
      return devices.changed.length === 1 && areas.changed.length === 0
        ? { kind: 'moveDevice', name: devices.changed[0].after.label }
        : { kind: 'moveDevices', count: devices.changed.length };
    }
    if (devices.changed.length === 0 && areas.changed.length === 1 && links.changed.length === 0) {
      return movedOnly(areas.changed[0])
        ? { kind: 'moveArea', name: areas.changed[0].after.label }
        : { kind: 'editArea', name: areas.changed[0].after.label };
    }
    // (a device edited: the links of a port taken away may change with it)
    if (devices.changed.length === 1 && areas.changed.length === 0) {
      return { kind: 'editDevice', name: devices.changed[0].after.label };
    }
    return null;
  }

  // Areas added or deleted alone
  if (areas.added.length + areas.removed.length > 0) {
    if (links.added.length + links.removed.length + links.changed.length > 0) return null;
    if (areas.added.length === 1 && areas.removed.length === 0) return { kind: 'addArea', name: areas.added[0].label };
    if (areas.removed.length === 1 && areas.added.length === 0) {
      return { kind: 'deleteArea', name: areas.removed[0].label };
    }
    return null;
  }

  // Links alone
  if (links.removed.length === 0 && links.changed.length === 0) {
    if (links.added.length === 1) return { kind: 'addLink', ...ends(links.added[0]) };
    if (links.added.length > 1) return { kind: 'addLinks', count: links.added.length };
  }
  if (links.added.length === 0 && links.changed.length === 0 && links.removed.length === 1) {
    return { kind: 'deleteLink', ...ends(links.removed[0]) };
  }
  if (links.added.length === 0 && links.removed.length === 0 && links.changed.length === 1) {
    return { kind: 'editLink', ...ends(links.changed[0].after) };
  }
  return null;
}
