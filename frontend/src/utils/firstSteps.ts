/**
 * The first steps of a visitor: what is still due, from what this browser
 * keeps, and the first question a sample suggests.
 *
 * - The guided tour (components/Guide/GuidedTour.tsx) is offered once, on a
 *   first visit, when the welcome screen is left. A browser that keeps a
 *   drawing, or the welcome screen put away for good, was used before the
 *   tour existed: the tour is not forced on it (Aiuto → «Tour guidato» has
 *   it for whoever wants it).
 * - The first question (components/Guide/FirstTryHint.tsx) is suggested once
 *   in a browser, when a sample that has one is loaded.
 *
 * Pure: the browser's storage is handed in as a function that reads a key.
 */

import type { SampleNetwork } from './sampleNetwork';

/** Kept once the tour has been shown, by itself or from the Help menu */
export const TOUR_SEEN_KEY = 'pixelcake-tour-seen';

/** Kept once the first question has been shown */
export const FIRST_TRY_SEEN_KEY = 'pixelcake-first-try-seen';

/** Reads what the browser keeps under a key (null when nothing) */
export type ReadStored = (key: string) => string | null;

/** What is still due to a visitor, at the start of a visit */
export interface FirstSteps {
  /** The tour starts once the welcome screen is left */
  tourDue: boolean;
  /** The first question is suggested when a sample with one is loaded */
  firstTryDue: boolean;
}

/** The first question of a sample: two devices of the board, by their names */
export interface FirstTry {
  from: string;
  to: string;
}

/** What the store of a board, or of a project, keeps: `{ state: … }` */
function keptState(read: ReadStored, key: string): Record<string, unknown> | null {
  try {
    const raw = read(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const state = (parsed as { state?: unknown } | null)?.state;
    return state && typeof state === 'object' ? (state as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** True when a board holds something: a device, an area or a mark */
function hasDrawing(board: unknown): boolean {
  if (!board || typeof board !== 'object') return false;
  const { devices, areas, marks } = board as Record<string, unknown>;
  return [devices, areas, marks].some(list => Array.isArray(list) && list.length > 0);
}

/**
 * True when this browser was used before the tour existed: it keeps a drawing
 * (on the board on screen or on another board of the project), or the welcome
 * screen was put away for good. The empty board and the empty project the app
 * writes at its very first start are not a visit before.
 */
export function usedBefore(read: ReadStored): boolean {
  try {
    if (read('pixelcake-hide-welcome') === 'true') return true;
  } catch {
    return false;
  }
  if (hasDrawing(keptState(read, 'pixelcake-network-v2'))) return true;
  const canvases = keptState(read, 'pixelcake-project-v1')?.canvases;
  return Array.isArray(canvases) && canvases.some(hasDrawing);
}

/** What is due to the visitor of this browser, read at the start of the visit */
export function firstStepsAtStart(read: ReadStored): FirstSteps {
  const seen = (key: string) => {
    try {
      return read(key) !== null;
    } catch {
      return false;
    }
  };
  return {
    tourDue: !seen(TOUR_SEEN_KEY) && !usedBefore(read),
    firstTryDue: !seen(FIRST_TRY_SEEN_KEY),
  };
}

/** The first question of a sample, with the names its devices have as it is loaded; null when it has none */
export function firstTryOf(sample: SampleNetwork): FirstTry | null {
  const question = sample.firstQuestion;
  if (!question) return null;
  const name = (id: string) => sample.devices.find(device => device.id === id)?.label;
  const from = name(question.from);
  const to = name(question.to);
  return from && to ? { from, to } : null;
}

/** A name as the terminal reads it: in quotes when it has a space */
const typedName = (name: string) => (/\s/.test(name) ? `"${name}"` : name);

/** The first question as a command of the terminal: `ping Web-ERP from PC-Sales` */
export function firstTryCommand({ from, to }: FirstTry): string {
  return `ping ${typedName(to)} from ${typedName(from)}`;
}
