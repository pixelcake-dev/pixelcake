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

/** A part of the board, in its coordinates */
export interface BoardRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a device added by itself goes: the first free place of the part of
 * the board on screen, row by row from the top left, on the grid of the
 * board (multiples of NEW_DEVICE_STEP, so that devices added one at a time
 * line up, wherever the view was moved in between). A place is left out when
 * a device is on it, when the device would not be wholly in view, or when it
 * would be under something that covers the board (`blocked`: a panel open
 * beside it, the small map). None when the view has no free place left.
 *
 * @param view The part of the board on screen, already less a margin
 * @param taken Where the devices of the board are
 * @param blocked The parts of the view that are covered
 * @param size How large a device is drawn
 */
export function placeInView(
  view: BoardRect,
  taken: Place[],
  blocked: BoardRect[],
  size: { width: number; height: number }
): Place | null {
  const covered = (x: number, y: number) =>
    blocked.some(
      (rect) => x < rect.right && x + size.width > rect.left && y < rect.bottom && y + size.height > rect.top
    );
  for (let y = Math.ceil(view.top / STEP.y) * STEP.y; y + size.height <= view.bottom; y += STEP.y) {
    for (let x = Math.ceil(view.left / STEP.x) * STEP.x; x + size.width <= view.right; x += STEP.x) {
      if (!covered(x, y) && isFreeOf({ x, y }, taken)) return { x, y };
    }
  }
  return null;
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
