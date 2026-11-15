/**
 * The areas of a canvas («riquadri»): rectangles with a label, drawn behind
 * groups of devices to say what they are. An area is a drawing: this module
 * knows where one goes, how one is named and coloured, and how a list of
 * them is read from a file or from the browser's storage.
 *
 * Pure: no React, no DOM, and no store but the language of the interface,
 * which the two names the app gives (a new area, a colour) are read in.
 */

import { AREA_COLOURS } from '@/types';
import type { AreaColour, CanvasArea } from '@/types';
import { getT } from '@/i18n';

export interface AreaBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The smallest an area can be made */
export const AREA_MIN_SIZE = { width: 120, height: 80 } as const;
/** The size of an area added by itself */
export const AREA_DEFAULT_SIZE = { width: 360, height: 240 } as const;
/** How long the label of an area can be: it is a word or two in a corner */
export const AREA_LABEL_MAX_LENGTH = 40;
/**
 * The room left around the devices an area is drawn around: more above,
 * where its label is. It is counted from the frame of a device, which has
 * room of its own around the drawing (utils/deviceGeometry): above, the
 * label of the area, and under it the tag a presentation hangs on the top
 * of a device, fit without touching.
 */
export const AREA_MARGIN = { side: 16, top: 40, bottom: 16 } as const;
/** The least of that room an area keeps when it has to give way: above, its label still fits */
export const AREA_MIN_MARGIN = { side: 4, top: 24, bottom: 4 } as const;
/** How far an area drawn around devices stays from another area, and from a device it does not hold */
export const AREA_GAP = 6;
/** The room the label of an area takes at its top: an area inside it starts under it */
export const AREA_LABEL_ROOM = 24;

/** An area already on the canvas, near where a new one goes */
export interface NearArea extends AreaBox {
  /** How far its label reaches from its left side; unknown, it is taken to reach across the whole area */
  labelReach?: number;
}

/** What a new area is called until it is given its name, in the language of the moment */
export function defaultAreaLabel(): string {
  return getT().canvas.area.defaultName;
}

/**
 * The palette, in the light theme and in the dark: the colour of the border
 * and of the label of an area. The screen takes them from the style sheet
 * (`--area-<name>` in index.css); the exported picture and the small map
 * take them from here, and a test holds the two to each other. Calm colours
 * of a kind of thing, like those of the cables: none is the accent.
 */
export const AREA_PALETTE: Record<'light' | 'dark', Record<AreaColour, string>> = {
  light: {
    slate: '#4a6b7f',
    green: '#2a7351',
    amber: '#8a5a12',
    red: '#a8463f',
    violet: '#6a58a6',
    teal: '#1c6f7c',
  },
  dark: {
    slate: '#8fb0c6',
    green: '#6fbf9a',
    amber: '#d9a441',
    red: '#e08f88',
    violet: '#a99bd6',
    teal: '#62bccb',
  },
};

/** How much of its colour the inside of an area takes: a light tint, the rest is the canvas */
export const AREA_TINT = 0.1;

/** The colours of the palette, as the menu of an area names them in the language of the moment */
export function areaColourNames(): Record<AreaColour, string> {
  return getT().contextMenu.area.colours;
}

export function isAreaColour(value: unknown): value is AreaColour {
  return typeof value === 'string' && (AREA_COLOURS as readonly string[]).includes(value);
}

/** The label of an area as it is kept: one line, nothing around it, no longer than the limit */
export function tidyAreaLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, AREA_LABEL_MAX_LENGTH).trim();
}

/** Id for a new area: `area-N`, N one above the highest in use, 1 at least */
export function nextAreaId(areas: readonly Pick<CanvasArea, 'id'>[]): string {
  let highest = 0;
  for (const { id } of areas) {
    const match = /^area-(\d+)$/.exec(id);
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  }
  return `area-${highest + 1}`;
}

/**
 * The colour a new area takes: the first of the palette no area of the
 * canvas has, so that areas added one after the other can be told apart;
 * once every colour is taken, the one used least.
 */
export function nextAreaColour(areas: readonly Pick<CanvasArea, 'color'>[]): AreaColour {
  const uses = new Map<AreaColour, number>(AREA_COLOURS.map((colour) => [colour, 0]));
  for (const { color } of areas) uses.set(color, (uses.get(color) ?? 0) + 1);
  let best: AreaColour = AREA_COLOURS[0];
  for (const colour of AREA_COLOURS) {
    if ((uses.get(colour) ?? 0) < (uses.get(best) ?? 0)) best = colour;
  }
  return best;
}

/** Where an area added by itself goes: its default size, its middle on `centre` */
export function areaAt(centre: { x: number; y: number }): Pick<CanvasArea, 'position' | 'size'> {
  return {
    position: {
      x: Math.round(centre.x - AREA_DEFAULT_SIZE.width / 2),
      y: Math.round(centre.y - AREA_DEFAULT_SIZE.height / 2),
    },
    size: { ...AREA_DEFAULT_SIZE },
  };
}

/** What is near the devices an area is drawn around */
export interface AreaNeighbours {
  /** The areas already on the canvas */
  areas?: readonly NearArea[];
  /** The devices that are not to be in the area */
  devices?: readonly AreaBox[];
}

export interface PlacedArea extends Pick<CanvasArea, 'position' | 'size'> {
  /**
   * The room could not be made small enough to keep the area clear of what
   * is near (another area across the devices, a device among them, one too
   * close): it is made with its whole room, and overlaps
   */
  overlaps: boolean;
}

type Side = 'left' | 'right' | 'top' | 'bottom';
type Edges = Record<Side, number>;

const edgesOf = (box: AreaBox): Edges => ({
  left: box.x,
  top: box.y,
  right: box.x + box.width,
  bottom: box.y + box.height,
});

/** True when the two share some room (touching is not sharing) */
const meet = (a: Edges, b: Edges) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** True when `outer` holds `inner` whole */
const holds = (outer: Edges, inner: Edges) =>
  outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom;

const grown = (edges: Edges, by: number): Edges => ({
  left: edges.left - by,
  top: edges.top - by,
  right: edges.right + by,
  bottom: edges.bottom + by,
});

/** The band that takes an area by a side of its border, at its widest: across the line, 5 outside and 4 inside */
export const AREA_EDGE_BAND = { width: 9, outside: 5 } as const;
/** The narrowest that band gets, however close its devices are */
export const AREA_EDGE_MIN = 3;

/**
 * How wide the band that takes an area by each side of its border is: no
 * more than a third of the room between that side and the devices inside
 * the area, so that most of that room is left to what is under it (a
 * selection box can start there), and no less than AREA_EDGE_MIN. A side
 * with no device inside along it keeps the whole band. A device counts
 * when it is inside the area whole.
 */
export function areaEdgeBands(area: AreaBox, devices: readonly AreaBox[]): Record<Side, number> {
  const box = edgesOf(area);
  const inside = devices.filter(isUsable).map(edgesOf).filter((device) => holds(box, device));
  const room: Edges = {
    left: Math.min(...inside.map((device) => device.left - box.left)),
    top: Math.min(...inside.map((device) => device.top - box.top)),
    right: Math.min(...inside.map((device) => box.right - device.right)),
    bottom: Math.min(...inside.map((device) => box.bottom - device.bottom)),
  };
  const band = (side: Side) =>
    Number.isFinite(room[side])
      ? Math.round(Math.min(AREA_EDGE_BAND.width, Math.max(AREA_EDGE_MIN, room[side] / 3)) * 10) / 10
      : AREA_EDGE_BAND.width;
  return { left: band('left'), top: band('top'), right: band('right'), bottom: band('bottom') };
}

/** How far a band of that width lies outside the line: as much of it as the whole band has, in proportion */
export function areaEdgeOutside(width: number): number {
  return Math.round(((width * AREA_EDGE_BAND.outside) / AREA_EDGE_BAND.width) * 10) / 10;
}

/**
 * The area that holds these boxes (the devices it is drawn around), with
 * room around them and for its label above. Null when there is no box.
 *
 * The room is AREA_MARGIN, but where it would cross another area, or cover
 * a device that is not to be in it, it is made smaller on that side, down
 * to AREA_MIN_MARGIN, so that AREA_GAP is left clear. An area is never
 * drawn across another: it can be inside another one (it then stays inside
 * it, under its label) or around another one, which is nesting. Where even
 * the least room cannot keep it clear, it is made with its whole room, and
 * says so (`overlaps`).
 */
export function areaAround(boxes: readonly AreaBox[], near: AreaNeighbours = {}): PlacedArea | null {
  const usable = boxes.filter(isUsable);
  if (usable.length === 0) return null;
  const held: Edges = {
    left: Math.min(...usable.map((box) => box.x)),
    top: Math.min(...usable.map((box) => box.y)),
    right: Math.max(...usable.map((box) => box.x + box.width)),
    bottom: Math.max(...usable.map((box) => box.y + box.height)),
  };
  const full: Edges = { left: AREA_MARGIN.side, right: AREA_MARGIN.side, top: AREA_MARGIN.top, bottom: AREA_MARGIN.bottom };
  const least: Edges = {
    left: AREA_MIN_MARGIN.side,
    right: AREA_MIN_MARGIN.side,
    top: AREA_MIN_MARGIN.top,
    bottom: AREA_MIN_MARGIN.bottom,
  };
  const around = (room: Edges): Edges => ({
    left: held.left - room.left,
    top: held.top - room.top,
    right: held.right + room.right,
    bottom: held.bottom + room.bottom,
  });
  const place = (room: Edges, overlaps: boolean): PlacedArea => {
    const edges = around(room);
    return {
      position: { x: Math.round(edges.left), y: Math.round(edges.top) },
      size: {
        width: Math.max(AREA_MIN_SIZE.width, Math.round(edges.right - edges.left)),
        height: Math.max(AREA_MIN_SIZE.height, Math.round(edges.bottom - edges.top)),
      },
      overlaps,
    };
  };

  const whole = around(full);
  const nearAreas = (near.areas ?? []).filter(isUsable);
  const areas = nearAreas.map(edgesOf);
  /** How far the label of each reaches across, from its left side */
  const labelEnd = new Map(areas.map((area, index) => [area, area.left + (nearAreas[index].labelReach ?? Infinity)]));
  /** Areas the new one is inside of: it stays inside them */
  const outer = areas.filter((area) => holds(area, held));
  /** Areas the new one is around: they stay inside it */
  const inner = areas.filter((area) => !holds(area, held) && holds(whole, area));
  /** What it keeps clear of, from outside */
  const beside = areas.filter((area) => !outer.includes(area) && !inner.includes(area));
  for (const device of (near.devices ?? []).filter(isUsable).map(edgesOf)) {
    // (a device inside an area the new one is around is in that area)
    if (!inner.some((area) => holds(area, device))) beside.push(device);
  }

  const room = { ...full };
  // Inside another area: clear of its sides, and under its label where it is under it
  for (const area of outer) {
    room.left = Math.min(room.left, held.left - area.left - AREA_GAP);
    room.right = Math.min(room.right, area.right - held.right - AREA_GAP);
    room.bottom = Math.min(room.bottom, area.bottom - held.bottom - AREA_GAP);
    const underLabel = held.left - room.left < (labelEnd.get(area) ?? Infinity) + AREA_GAP;
    room.top = Math.min(room.top, held.top - area.top - AREA_GAP - (underLabel ? AREA_LABEL_ROOM : 0));
  }
  // Clear of what is beside it: on the side it is on (of two, the one that gives up less)
  let clear = (Object.keys(room) as Side[]).every((side) => room[side] >= least[side]);
  for (const other of beside) {
    if (!clear) break;
    if (!meet(grown(other, AREA_GAP), around(room))) continue;
    const ways: Array<[Side, number]> = [];
    if (other.right <= held.left) ways.push(['left', held.left - other.right - AREA_GAP]);
    if (other.left >= held.right) ways.push(['right', other.left - held.right - AREA_GAP]);
    if (other.bottom <= held.top) ways.push(['top', held.top - other.bottom - AREA_GAP]);
    if (other.top >= held.bottom) ways.push(['bottom', other.top - held.bottom - AREA_GAP]);
    const possible = ways.filter(([side, value]) => value >= least[side]);
    if (possible.length === 0) {
      clear = false;
      break;
    }
    const [side, value] = possible.reduce((best, way) =>
      room[way[0]] - way[1] < room[best[0]] - best[1] ? way : best
    );
    room[side] = Math.min(room[side], value);
  }
  // (and what it was to be around is still inside it)
  if (clear) clear = inner.every((area) => holds(around(room), area));

  return clear ? place(room, false) : place(full, true);
}

/** A box whose four numbers are numbers */
function isUsable(box: AreaBox): boolean {
  return [box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export interface ReadAreas {
  areas: CanvasArea[];
  /** Entries that could not be drawn at all, and were left out */
  dropped: number;
  /** Entries that were completed: an id, a colour, a label, a size too small */
  repaired: number;
}

/**
 * A list of areas read from outside (a project file, the browser's storage)
 * as the app keeps it. An entry needs a place and a size to be an area;
 * everything else is completed: an id of its own, a colour of the palette,
 * a tidy label, the smallest size at least. What is not a list is no area.
 */
export function readAreas(value: unknown): ReadAreas {
  if (value === undefined) return { areas: [], dropped: 0, repaired: 0 };
  if (!Array.isArray(value)) return { areas: [], dropped: 1, repaired: 0 };

  const areas: CanvasArea[] = [];
  const pending: CanvasArea[] = [];
  const taken = new Set<string>();
  let dropped = 0;
  let repaired = 0;

  for (const entry of value) {
    const position = isRecord(entry) ? entry.position : undefined;
    const size = isRecord(entry) ? entry.size : undefined;
    if (
      !isRecord(entry) ||
      !isRecord(position) ||
      !isFiniteNumber(position.x) ||
      !isFiniteNumber(position.y) ||
      !isRecord(size) ||
      !isFiniteNumber(size.width) ||
      !isFiniteNumber(size.height) ||
      size.width <= 0 ||
      size.height <= 0
    ) {
      dropped++;
      continue;
    }

    let fixed = false;
    const label = typeof entry.label === 'string' ? tidyAreaLabel(entry.label) : '';
    if (typeof entry.label !== 'string') fixed = true;
    const color = isAreaColour(entry.color) ? entry.color : AREA_COLOURS[0];
    if (color !== entry.color) fixed = true;
    const width = Math.max(AREA_MIN_SIZE.width, size.width);
    const height = Math.max(AREA_MIN_SIZE.height, size.height);
    if (width !== size.width || height !== size.height) fixed = true;
    const hasOwnId = typeof entry.id === 'string' && entry.id.trim() !== '' && !taken.has(entry.id);
    if (!hasOwnId) fixed = true;

    const area: CanvasArea = {
      id: hasOwnId ? (entry.id as string) : '',
      label,
      color,
      position: { x: position.x, y: position.y },
      size: { width, height },
    };
    if (hasOwnId) taken.add(area.id);
    else pending.push(area);
    if (fixed) repaired++;
    areas.push(area);
  }

  // (ids are given once every id of the file is known, so that none is taken twice)
  for (const area of pending) {
    area.id = nextAreaId([...taken].map((id) => ({ id })));
    taken.add(area.id);
  }
  return { areas, dropped, repaired };
}
