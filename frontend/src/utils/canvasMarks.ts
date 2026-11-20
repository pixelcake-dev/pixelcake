/**
 * The marks of annotation mode («Modalità appunti») as data: what they look like (the
 * thickness of a line, the size of words, the colours of the two themes),
 * how a new one is named and kept, and how a list of them is read from
 * outside (a project file, the browser's storage).
 *
 * Pure: no React, no DOM, no store. How a mark is drawn is in
 * utils/handDrawing.ts.
 */

import { MARK_COLOURS, MARK_KINDS, MARK_WIDTHS } from '@/types';
import type { CanvasMark, MarkColour, MarkKind, MarkWidth } from '@/types';

/** How thick a line of the marker is, in units of the canvas */
export const MARK_STROKE: Record<MarkWidth, number> = { thin: 3, thick: 6 };

/** How large words are written, in units of the canvas */
export const MARK_TEXT_SIZE: Record<MarkWidth, number> = { thin: 26, thick: 38 };

/** The height of a line of words, in sizes of the letters */
export const MARK_TEXT_LINE = 1.15;

/** How long the words of one mark can be: a few words on a board */
export const MARK_TEXT_MAX_LENGTH = 300;

/**
 * The handwriting: Caveat (SIL Open Font License 1.1), bundled with the app
 * (main.tsx), one weight. The others are what a system that lacks it writes
 * by hand with.
 */
export const HAND_FONT = {
  name: 'Caveat',
  family: "Caveat, 'Segoe Print', 'Comic Sans MS', cursive",
  weight: 600,
} as const;

/**
 * The colours of the marker, in the light theme and in the dark. The screen
 * takes them from the style sheet (`--mark-<name>` in index.css), the
 * exported image from here, and a test holds the two to each other. The
 * accent is the orange of the logo; the ink is the text of the theme.
 */
export const MARK_PALETTE: Record<'light' | 'dark', Record<MarkColour, string>> = {
  light: { accent: '#F07D2A', red: '#d92d20', green: '#1f8a4c', ink: '#22313b' },
  dark: { accent: '#F07D2A', red: '#ff5a4e', green: '#4cc38a', ink: '#f4f6f8' },
};

/** The colour of a mark on screen: the variable of the theme (index.css) MARK_PALETTE repeats */
export const MARK_COLOUR_VARS: Record<MarkColour, string> = {
  accent: 'var(--mark-accent)',
  red: 'var(--mark-red)',
  green: 'var(--mark-green)',
  ink: 'var(--mark-ink)',
};

/** How many numbers each kind needs at least: the points it is drawn from */
const NEEDED: Record<MarkKind, number> = { pen: 2, text: 2, arrow: 4, ellipse: 4, tick: 4, cross: 4 };

/** Id for a new mark: `mark-N`, N one above the highest in use, 1 at least */
export function nextMarkId(marks: readonly Pick<CanvasMark, 'id'>[]): string {
  let highest = 0;
  for (const { id } of marks) {
    const match = /^mark-(\d+)$/.exec(id);
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  }
  return `mark-${highest + 1}`;
}

/**
 * The words of a mark as they are kept: their lines, without the spaces at
 * the end of each and the empty lines around them, no longer than the limit
 */
export function tidyMarkText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\s*\n/, '')
    .trim()
    .slice(0, MARK_TEXT_MAX_LENGTH)
    .trim();
}

/** A number of the canvas as a mark keeps it: to a tenth */
const tenth = (value: number) => Math.round(value * 10) / 10 || 0;

/** A new seed for the wobble of a mark */
export function newSeed(): number {
  return 1 + Math.floor(Math.random() * 2147483646);
}

/**
 * A seed made from what a mark is, for one read without its own: the same
 * mark always gets the same, so that it is drawn the same after every load
 */
function seedOf(kind: string, points: readonly number[]): number {
  let hash = 2166136261;
  for (const char of `${kind}:${points.join(',')}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 || 1;
}

const isKind = (value: unknown): value is MarkKind =>
  typeof value === 'string' && (MARK_KINDS as readonly string[]).includes(value);
const isColour = (value: unknown): value is MarkColour =>
  typeof value === 'string' && (MARK_COLOURS as readonly string[]).includes(value);
const isWidth = (value: unknown): value is MarkWidth =>
  typeof value === 'string' && (MARK_WIDTHS as readonly string[]).includes(value);
const isSeed = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 2147483648;

/**
 * A new mark as the store keeps it: its points to a tenth, its words tidy,
 * no words on a mark that is not of words. Null when it is no mark: too few
 * points, a point that is no number, words without words.
 */
export function tidyMark(mark: Omit<CanvasMark, 'id'>): Omit<CanvasMark, 'id'> | null {
  if (!isKind(mark.kind)) return null;
  if (mark.points.length < NEEDED[mark.kind] || !mark.points.every(Number.isFinite)) return null;
  const points = mark.points.slice(0, mark.points.length - (mark.points.length % 2)).map(tenth);
  const kept: Omit<CanvasMark, 'id'> = {
    kind: mark.kind,
    color: isColour(mark.color) ? mark.color : 'accent',
    width: isWidth(mark.width) ? mark.width : 'thin',
    points: mark.kind === 'text' ? points.slice(0, 2) : points,
    seed: isSeed(mark.seed) ? mark.seed : seedOf(mark.kind, points),
  };
  if (mark.kind === 'text') {
    const text = typeof mark.text === 'string' ? tidyMarkText(mark.text) : '';
    if (text === '') return null;
    kept.text = text;
  }
  return kept;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ReadMarks {
  marks: CanvasMark[];
  /** Entries that could not be drawn at all, and were left out */
  dropped: number;
  /** Entries that were completed: an id, a colour, a thickness, a seed, a lone number */
  repaired: number;
}

/**
 * A list of marks read from outside (a project file, the browser's storage)
 * as the app keeps it. An entry needs a kind, the points of its kind (all
 * numbers) and, for words, words, to be a mark; everything else is
 * completed. What is not a list is no mark.
 */
export function readMarks(value: unknown): ReadMarks {
  if (value === undefined) return { marks: [], dropped: 0, repaired: 0 };
  if (!Array.isArray(value)) return { marks: [], dropped: 1, repaired: 0 };

  const marks: CanvasMark[] = [];
  const pending: CanvasMark[] = [];
  const taken = new Set<string>();
  let dropped = 0;
  let repaired = 0;

  for (const entry of value) {
    if (!isRecord(entry) || !isKind(entry.kind) || !Array.isArray(entry.points)) {
      dropped++;
      continue;
    }
    const points = entry.points as unknown[];
    if (!points.every((point) => typeof point === 'number' && Number.isFinite(point))) {
      dropped++;
      continue;
    }
    const kept = tidyMark({
      kind: entry.kind,
      color: entry.color as MarkColour,
      width: entry.width as MarkWidth,
      points: points as number[],
      text: typeof entry.text === 'string' ? entry.text : undefined,
      seed: entry.seed as number,
    });
    if (!kept) {
      dropped++;
      continue;
    }

    const hasOwnId = typeof entry.id === 'string' && entry.id.trim() !== '' && !taken.has(entry.id);
    const fixed =
      !hasOwnId ||
      kept.color !== entry.color ||
      kept.width !== entry.width ||
      kept.seed !== entry.seed ||
      kept.points.length !== points.length ||
      (kept.text !== undefined && kept.text !== entry.text);
    const mark: CanvasMark = { id: hasOwnId ? (entry.id as string) : '', ...kept };
    if (hasOwnId) taken.add(mark.id);
    else pending.push(mark);
    if (fixed) repaired++;
    marks.push(mark);
  }

  // (ids are given once every id of the list is known, so that none is taken twice)
  for (const mark of pending) {
    mark.id = nextMarkId([...taken].map((id) => ({ id })));
    taken.add(mark.id);
  }
  return { marks, dropped, repaired };
}
