/**
 * How a mark of the marker is drawn: by hand, with a little wobble that is
 * always the same for the same mark (after a reload, in the exported image),
 * where it is on the canvas, what a pointer touches of it, and how a line
 * drawn by hand is kept short.
 */

import { describe, it, expect } from 'vitest';
import type { CanvasMark } from '@/types';
import { MARK_STROKE, MARK_TEXT_SIZE } from './canvasMarks';
import { drawMark, markBox, markHit, simplifyPoints, stampBox, type HandMeasure } from './handDrawing';

/** Half the size for each letter */
const measure: HandMeasure = (text, size) => text.length * size * 0.5;

const mark = (overrides: Partial<CanvasMark>): CanvasMark => ({
  id: 'mark-1',
  kind: 'pen',
  color: 'red',
  width: 'thin',
  points: [0, 0, 10, 0, 20, 5],
  seed: 42,
  ...overrides,
});

/** Every pair of numbers in a path */
const numbersOf = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('a mark drawn by hand', () => {
  it.each(['pen', 'arrow', 'ellipse', 'tick', 'cross'] as const)(
    'a %s is drawn the same every time from the same seed, and otherwise from another',
    (kind) => {
      const points = kind === 'pen' ? [0, 0, 30, 10, 60, 0, 90, 20] : [0, 0, 120, 80];
      const one = drawMark(mark({ kind, points, seed: 3 }));
      expect(drawMark(mark({ kind, points, seed: 3 }))).toEqual(one);
      expect(one.paths.length).toBeGreaterThan(0);
      if (kind !== 'pen') expect(drawMark(mark({ kind, points, seed: 4 }))).not.toEqual(one);
    }
  );

  it('a line by hand goes through the points it was drawn through, from the first to the last', () => {
    const { paths } = drawMark(mark({ points: [0, 0, 30, 10, 60, 0, 90, 20] }));
    expect(paths).toHaveLength(1);
    expect(paths[0].startsWith('M0 0')).toBe(true);
    expect(paths[0].endsWith('90 20')).toBe(true);
  });

  it('a line of one point is a dot', () => {
    const { paths } = drawMark(mark({ points: [5, 5] }));
    expect(numbersOf(paths[0]).slice(0, 2)).toEqual([5, 5]);
  });

  it('an arrow ends at its tip, with a head of two strokes there', () => {
    const { paths } = drawMark(mark({ kind: 'arrow', points: [0, 0, 200, 0] }));
    expect(paths).toHaveLength(2);
    expect(paths[0].endsWith('200 0')).toBe(true);
    // (the head goes back from the tip, either side of the line)
    const head = numbersOf(paths[1]);
    expect(head[2]).toBe(200);
    expect(head[3]).toBe(0);
    expect(head[0]).toBeLessThan(200);
    expect(head[4]).toBeLessThan(200);
    expect(Math.sign(head[1])).not.toBe(Math.sign(head[5]));
  });

  it('a ring goes round the box it was drawn in, a little past where it started', () => {
    const { paths } = drawMark(mark({ kind: 'ellipse', points: [100, 100, 0, 40] }));
    const numbers = numbersOf(paths[0]);
    const xs = numbers.filter((_, index) => index % 2 === 0);
    const ys = numbers.filter((_, index) => index % 2 === 1);
    // (whichever corner the drag started from)
    expect(Math.min(...xs)).toBeGreaterThan(-8);
    expect(Math.min(...xs)).toBeLessThan(8);
    expect(Math.max(...xs)).toBeGreaterThan(92);
    expect(Math.max(...ys)).toBeLessThan(108);
    expect(Math.min(...ys)).toBeGreaterThan(32);
  });

  it('a cross is two strokes, a tick one', () => {
    expect(drawMark(mark({ kind: 'cross', points: [0, 0, 30, 30] })).paths).toHaveLength(2);
    expect(drawMark(mark({ kind: 'tick', points: [0, 0, 30, 30] })).paths).toHaveLength(1);
  });

  it('is as thick as its thickness says', () => {
    expect(drawMark(mark({ width: 'thin' })).stroke).toBe(MARK_STROKE.thin);
    expect(drawMark(mark({ width: 'thick' })).stroke).toBe(MARK_STROKE.thick);
  });

  it('words are written from their point, a line under the other, at the size of their thickness', () => {
    const { paths, text } = drawMark(
      mark({ kind: 'text', points: [10, 20], text: 'Core\ngiù', width: 'thick' })
    );
    expect(paths).toEqual([]);
    expect(text).toMatchObject({ x: 10, y: 20, lines: ['Core', 'giù'], size: MARK_TEXT_SIZE.thick });
    // (a slight tilt, as a hand writes)
    expect(Math.abs(text?.rotate ?? 99)).toBeLessThanOrEqual(1.5);
  });
});

describe('where a mark is', () => {
  it('a line holds every point it goes through, with half its thickness around', () => {
    const box = markBox(mark({ points: [0, 0, 50, 20, 100, 0] }), measure);
    const half = MARK_STROKE.thin / 2;
    expect(box.x).toBeCloseTo(-half);
    expect(box.y).toBeCloseTo(-half);
    expect(box.width).toBeCloseTo(100 + 2 * half);
  });

  it('words take the room of their longest line, line after line', () => {
    const size = MARK_TEXT_SIZE.thin;
    const box = markBox(mark({ kind: 'text', points: [10, 20], text: 'ab\nabcd' }), measure);
    expect(box.x).toBe(10);
    expect(box.y).toBe(20);
    expect(box.width).toBeCloseTo(4 * size * 0.5);
    expect(box.height).toBeGreaterThan(2 * size);
  });
});

describe('what the pointer touches of a mark (the eraser)', () => {
  const line = mark({ points: [0, 0, 100, 0] });

  it('a line, along it and near enough', () => {
    expect(markHit(line, { x: 50, y: 3 }, 4, measure)).toBe(true);
    expect(markHit(line, { x: 50, y: 30 }, 4, measure)).toBe(false);
    expect(markHit(line, { x: 130, y: 0 }, 4, measure)).toBe(false);
  });

  it('a ring by its line, not by its inside', () => {
    const ring = mark({ kind: 'ellipse', points: [0, 0, 200, 100] });
    expect(markHit(ring, { x: 0, y: 50 }, 6, measure)).toBe(true);
    expect(markHit(ring, { x: 100, y: 50 }, 6, measure)).toBe(false);
  });

  it('words anywhere on them', () => {
    const text = mark({ kind: 'text', points: [0, 0], text: 'Guasto' });
    expect(markHit(text, { x: 20, y: 10 }, 2, measure)).toBe(true);
    expect(markHit(text, { x: 400, y: 10 }, 2, measure)).toBe(false);
  });
});

describe('a line drawn by hand, kept short', () => {
  it('keeps its ends and its turns, and drops the points that add nothing', () => {
    const straight = [0, 0, 10, 0.1, 20, -0.1, 30, 0, 40, 30];
    expect(simplifyPoints(straight, 0.5)).toEqual([0, 0, 30, 0, 40, 30]);
  });

  it('a line of one or two points is kept as it is', () => {
    expect(simplifyPoints([1, 2], 1)).toEqual([1, 2]);
    expect(simplifyPoints([1, 2, 3, 4], 1)).toEqual([1, 2, 3, 4]);
  });
});

describe('a tick or a cross placed with a click', () => {
  it('is a square of the size asked, around the point', () => {
    expect(stampBox({ x: 100, y: 50 }, 20)).toEqual([90, 40, 110, 60]);
  });
});
