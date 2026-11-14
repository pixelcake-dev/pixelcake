/**
 * Where a device just added goes: the place asked for when it is free,
 * otherwise the nearest free one around it. Always the same answer for the
 * same drawing: nothing is left to chance, so the device is where one
 * expects it.
 */

export interface Place {
  x: number;
  y: number;
}

/** From one place to the next: a device and the room around it */
const STEP = { x: 170, y: 130 };

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
  const isFree = (place: Place) =>
    !taken.some(
      (other) => Math.abs(other.x - place.x) < TAKEN.x && Math.abs(other.y - place.y) < TAKEN.y
    );

  for (let distance = 0; distance <= RINGS; distance++) {
    for (const [dx, dy] of ring(distance)) {
      const place = { x: centre.x + dx * STEP.x, y: centre.y + dy * STEP.y };
      if (isFree(place)) return place;
    }
  }
  return centre;
}
