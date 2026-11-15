/**
 * Where a device just added goes: the place asked for when it is free,
 * otherwise the nearest free one around it; and where devices added in bulk
 * go: in rows from the place asked for, past the places that are taken.
 * Always the same answer for the same drawing: nothing is left to chance, so
 * the devices are where one expects them.
 */

export interface Place {
  x: number;
  y: number;
}

/**
 * From one place to the next: the frame of a device (104 by 94) and the
 * room around it, across for a name that runs out of the frame on both
 * sides, down for a cable between the two
 */
export const NEW_DEVICE_STEP = { x: 160, y: 130 } as const;
const STEP = NEW_DEVICE_STEP;

/** Closer than this to a device that is already there, a place is taken */
const TAKEN = { x: 150, y: 110 };

/** How far around the centre a free place is looked for, in steps */
const RINGS = 12;

/**
 * The places of one ring around the centre, the nearest first; among equally
 * near ones, to the right before below, below before to the left, then above
 */
function ring(distance: number): Array<[number, number]> {
  if (distance === 0) return [[0, 0]];
  const cells: Array<[number, number]> = [];
  for (let dx = -distance; dx <= distance; dx++) {
    for (let dy = -distance; dy <= distance; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === distance) cells.push([dx, dy]);
    }
  }
  const side = ([dx, dy]: [number, number]) =>
    dy === 0 && dx > 0 ? 0 : dx === 0 && dy > 0 ? 1 : dy === 0 && dx < 0 ? 2 : dx === 0 && dy < 0 ? 3 : 4;
  return cells.sort(
    (a, b) =>
      a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]) ||
      side(a) - side(b) ||
      a[1] - b[1] ||
      a[0] - b[0]
  );
}

/**
 * The first free place for a new device: `centre` itself, or the nearest
 * place around it that no device of `taken` is on. When everything around is
 * taken (a very crowded drawing) the centre is given all the same.
 */
export function firstFreePlace(centre: Place, taken: Place[]): Place {
  const isFree = (place: Place) => isFreeOf(place, taken);

  for (let distance = 0; distance <= RINGS; distance++) {
    for (const [dx, dy] of ring(distance)) {
      const place = { x: centre.x + dx * STEP.x, y: centre.y + dy * STEP.y };
      if (isFree(place)) return place;
    }
  }
  return centre;
}

/** True when no device of `taken` is on the place */
function isFreeOf(place: Place, taken: Place[]): boolean {
  return !taken.some(
    (other) => Math.abs(other.x - place.x) < TAKEN.x && Math.abs(other.y - place.y) < TAKEN.y
  );
}

/**
 * The places of `count` devices added together: a grid of rows, with as
 * many columns as rows or one more, from `start` to the right and down. A
 * cell a device of `taken` is on is skipped, and the next one taken in its
 * place: the grid goes on, row after row, until each device has one.
 */
export function gridPlaces(count: number, start: Place, taken: Place[]): Place[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const origin = { x: Math.round(start.x), y: Math.round(start.y) };
  const places: Place[] = [];
  // (a device of `taken` is on four cells at most: there are always enough)
  for (let cell = 0; places.length < count && cell < count + 4 * taken.length; cell++) {
    const place = {
      x: origin.x + (cell % columns) * STEP.x,
      y: origin.y + Math.floor(cell / columns) * STEP.y,
    };
    if (isFreeOf(place, taken)) places.push(place);
  }
  return places;
}
