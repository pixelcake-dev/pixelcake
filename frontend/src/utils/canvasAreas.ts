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
/** The room left around the devices an area is drawn around: more above, where its label is */
export const AREA_MARGIN = { side: 28, top: 44, bottom: 28 } as const;

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

/**
 * The area that holds these boxes (the devices it is drawn around), with
 * room around them and for its label above. Null when there is no box.
 */
export function areaAround(boxes: readonly AreaBox[]): Pick<CanvasArea, 'position' | 'size'> | null {
  const usable = boxes.filter((box) =>
    [box.x, box.y, box.width, box.height].every((value) => Number.isFinite(value))
  );
  if (usable.length === 0) return null;
  const left = Math.min(...usable.map((box) => box.x));
  const top = Math.min(...usable.map((box) => box.y));
  const right = Math.max(...usable.map((box) => box.x + box.width));
  const bottom = Math.max(...usable.map((box) => box.y + box.height));
  return {
    position: { x: Math.round(left - AREA_MARGIN.side), y: Math.round(top - AREA_MARGIN.top) },
    size: {
      width: Math.max(AREA_MIN_SIZE.width, Math.round(right - left + 2 * AREA_MARGIN.side)),
      height: Math.max(
        AREA_MIN_SIZE.height,
        Math.round(bottom - top + AREA_MARGIN.top + AREA_MARGIN.bottom)
      ),
    },
  };
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
