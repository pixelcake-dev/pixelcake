/**
 * How a mark of annotation mode («Modalità appunti») is drawn: as a hand draws it, with
 * a little wobble. The wobble comes from the seed of the mark, never from
 * chance at the moment of drawing: the same mark is drawn the same on
 * screen, after a reload and in the exported image, which all draw it from
 * here.
 *
 * Pure: no React, no DOM, no store. Everything is in the coordinates of the
 * canvas. Words are measured by whoever asks (`HandMeasure`).
 */

import type { CanvasMark } from '@/types';
import { MARK_STROKE, MARK_TEXT_LINE, MARK_TEXT_SIZE } from './canvasMarks';

export interface HandPoint {
  x: number;
  y: number;
}

export interface HandBox extends HandPoint {
  width: number;
  height: number;
}

/** The width of a line of words written by hand, at a size */
export type HandMeasure = (text: string, size: number) => number;

/** Words, as they are written: from their point, line under line, slightly tilted */
export interface MarkText extends HandPoint {
  lines: string[];
  size: number;
  /** From one line to the next */
  line: number;
  /** The tilt of the hand, in degrees, around the point */
  rotate: number;
}

/** What a mark is drawn with: lines of its thickness, or words */
export interface MarkDrawing {
  paths: string[];
  stroke: number;
  text: MarkText | null;
}

/** A small random generator that gives the same numbers for the same seed (mulberry32) */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number as a path writes it: two decimals at most */
function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

const at = (point: HandPoint) => `${num(point.x)} ${num(point.y)}`;
const middle = (a: HandPoint, b: HandPoint): HandPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function pairs(points: readonly number[]): HandPoint[] {
  const out: HandPoint[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) out.push({ x: points[i], y: points[i + 1] });
  return out;
}

/** The box two corners make, whichever way the pointer went */
function boxOf(points: readonly number[]): HandBox {
  const [x0, y0, x1, y1] = points;
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

/** A smooth line through points: curves that pass through the middle of each two */
function smoothPath(points: readonly HandPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  // (a line of one point is a dot: a stroke of no length, with round ends)
  if (points.length === 1) return `M${at(first)}L${at({ x: first.x + 0.01, y: first.y })}`;
  let path = `M${at(first)}`;
  for (let i = 1; i < points.length - 1; i++) {
    path += `Q${at(points[i])} ${at(middle(points[i], points[i + 1]))}`;
  }
  return `${path}L${at(points[points.length - 1])}`;
}

/** How much a shape of this size wobbles: a little, more for a larger one, never much */
const wobbleOf = (size: number) => Math.min(2.2, Math.max(0.6, size * 0.025));

/** An arrow: its tail, the point its slight bend goes through, its tip and the two ends of its head */
function arrowGeometry(mark: CanvasMark) {
  const random = seeded(mark.seed);
  const [from, to] = pairs(mark.points);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  // (bent a little to one side, as a hand draws a long line)
  const bend = (0.04 + random() * 0.06) * (random() < 0.5 ? -1 : 1);
  const bow = { x: (from.x + to.x) / 2 - dy * bend, y: (from.y + to.y) / 2 + dx * bend };
  const angle = Math.atan2(to.y - bow.y, to.x - bow.x);
  const head = Math.min(Math.max(length * 0.22, 12), 24) + MARK_STROKE[mark.width];
  const spread = 0.45;
  const side = (turn: number): HandPoint => ({
    x: to.x + Math.cos(angle + Math.PI + turn) * head * (0.92 + random() * 0.16),
    y: to.y + Math.sin(angle + Math.PI + turn) * head * (0.92 + random() * 0.16),
  });
  const left = side(-spread - random() * 0.08);
  const right = side(spread + random() * 0.08);
  return { from, bow, to, left, right };
}

/** A ring around the box it was drawn in: once round and a little past where it started */
function ringPoints(mark: CanvasMark): HandPoint[] {
  const random = seeded(mark.seed);
  const box = boxOf(mark.points);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rx = Math.max(box.width / 2, 2);
  const ry = Math.max(box.height / 2, 2);
  const wobble = wobbleOf(Math.max(rx, ry));
  const start = -2.2 + (random() - 0.5) * 0.6;
  const steps = 26;
  const turn = Math.PI * 2 * (1.06 + random() * 0.05);
  const points: HandPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + (i / steps) * turn;
    const swell = 1 + (random() - 0.5) * 0.05;
    points.push({
      x: cx + Math.cos(angle) * rx * swell + (random() - 0.5) * wobble,
      y: cy + Math.sin(angle) * ry * swell + (random() - 0.5) * wobble,
    });
  }
  return points;
}

/** A tick in its box: down to the bottom a third of the way across, then up to the top right */
function tickPoints(mark: CanvasMark): HandPoint[] {
  const random = seeded(mark.seed);
  const box = boxOf(mark.points);
  const wobble = wobbleOf(Math.max(box.width, box.height));
  const shake = (point: HandPoint): HandPoint => ({
    x: point.x + (random() - 0.5) * 2 * wobble,
    y: point.y + (random() - 0.5) * 2 * wobble,
  });
  return [
    shake({ x: box.x, y: box.y + box.height * 0.55 }),
    shake({ x: box.x + box.width * 0.38, y: box.y + box.height }),
    shake({ x: box.x + box.width, y: box.y }),
  ];
}

/** A cross in its box: two strokes from corner to corner, each slightly bent */
function crossStrokes(mark: CanvasMark): HandPoint[][] {
  const random = seeded(mark.seed);
  const box = boxOf(mark.points);
  const wobble = wobbleOf(Math.max(box.width, box.height));
  const shake = (point: HandPoint, by = wobble): HandPoint => ({
    x: point.x + (random() - 0.5) * 2 * by,
    y: point.y + (random() - 0.5) * 2 * by,
  });
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  return [
    [{ x: box.x, y: box.y }, { x: right, y: bottom }],
    [{ x: right, y: box.y }, { x: box.x, y: bottom }],
  ].map(([a, b]) => {
    const start = shake(a);
    const end = shake(b);
    return [start, shake(middle(start, end), wobble * 1.5), end];
  });
}

/** A point along the curve from `a` to `c` bent through `b` */
function onCurve(a: HandPoint, b: HandPoint, c: HandPoint, t: number): HandPoint {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y };
}

function sampleCurve(a: HandPoint, b: HandPoint, c: HandPoint, steps = 16): HandPoint[] {
  return Array.from({ length: steps + 1 }, (_, index) => onCurve(a, b, c, index / steps));
}

/** Words, from their point: line under line, at the size of their thickness, slightly tilted */
function textOf(mark: CanvasMark): MarkText {
  const random = seeded(mark.seed);
  const size = MARK_TEXT_SIZE[mark.width];
  return {
    x: mark.points[0],
    y: mark.points[1],
    lines: (mark.text ?? '').split('\n'),
    size,
    line: size * MARK_TEXT_LINE,
    rotate: Math.round((random() - 0.5) * 2 * 1.2 * 100) / 100,
  };
}

/** Where the line `index` of words sits: its baseline, under the point of the words */
export function textBaseline(text: MarkText, index: number): number {
  return text.y + text.size * 0.82 + index * text.line;
}

/** What a mark is drawn with, in the coordinates of the canvas */
export function drawMark(mark: CanvasMark): MarkDrawing {
  const stroke = MARK_STROKE[mark.width];
  switch (mark.kind) {
    case 'text':
      return { paths: [], stroke, text: textOf(mark) };
    case 'arrow': {
      const { from, bow, to, left, right } = arrowGeometry(mark);
      return {
        paths: [`M${at(from)}Q${at(bow)} ${at(to)}`, `M${at(left)}L${at(to)}L${at(right)}`],
        stroke,
        text: null,
      };
    }
    case 'ellipse':
      return { paths: [smoothPath(ringPoints(mark))], stroke, text: null };
    case 'tick': {
      const [a, b, c] = tickPoints(mark);
      return { paths: [`M${at(a)}L${at(b)}L${at(c)}`], stroke, text: null };
    }
    case 'cross':
      return {
        paths: crossStrokes(mark).map(([a, b, c]) => `M${at(a)}Q${at(b)} ${at(c)}`),
        stroke,
        text: null,
      };
    default:
      return { paths: [smoothPath(pairs(mark.points))], stroke, text: null };
  }
}

/** The lines a mark is drawn along, as points: what the eraser touches, what holds it in a box */
function outlines(mark: CanvasMark): HandPoint[][] {
  switch (mark.kind) {
    case 'arrow': {
      const { from, bow, to, left, right } = arrowGeometry(mark);
      return [sampleCurve(from, bow, to), [left, to, right]];
    }
    case 'ellipse':
      return [ringPoints(mark)];
    case 'tick':
      return [tickPoints(mark)];
    case 'cross':
      return crossStrokes(mark).map(([a, b, c]) => sampleCurve(a, b, c, 8));
    default:
      return [pairs(mark.points)];
  }
}

/** The box words take: their longest line across, their lines down */
function textBox(mark: CanvasMark, measure: HandMeasure): HandBox {
  const text = textOf(mark);
  return {
    x: text.x,
    y: text.y,
    width: Math.max(0, ...text.lines.map((line) => measure(line, text.size))),
    height: text.lines.length * text.line,
  };
}

/** The smallest box that holds what is drawn of a mark */
export function markBox(mark: CanvasMark, measure: HandMeasure): HandBox {
  if (mark.kind === 'text') return textBox(mark, measure);
  const half = MARK_STROKE[mark.width] / 2;
  const all = outlines(mark).flat();
  const xs = all.map((point) => point.x);
  const ys = all.map((point) => point.y);
  const left = Math.min(...xs) - half;
  const top = Math.min(...ys) - half;
  return { x: left, y: top, width: Math.max(...xs) + half - left, height: Math.max(...ys) + half - top };
}

/** How far a point is from the segment between two others */
function distanceToSegment(point: HandPoint, a: HandPoint, b: HandPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * True when the pointer at `point` touches the mark, within `tolerance`
 * (units of the canvas): a line along what is drawn of it, words anywhere
 * on them
 */
export function markHit(mark: CanvasMark, point: HandPoint, tolerance: number, measure: HandMeasure): boolean {
  if (mark.kind === 'text') {
    const box = textBox(mark, measure);
    return (
      point.x >= box.x - tolerance &&
      point.x <= box.x + box.width + tolerance &&
      point.y >= box.y - tolerance &&
      point.y <= box.y + box.height + tolerance
    );
  }
  const reach = tolerance + MARK_STROKE[mark.width] / 2;
  return outlines(mark).some((line) =>
    line.length === 1
      ? Math.hypot(point.x - line[0].x, point.y - line[0].y) <= reach
      : line.slice(1).some((end, index) => distanceToSegment(point, line[index], end) <= reach)
  );
}

/**
 * A line drawn by hand with fewer points: its ends and its turns are kept,
 * the points that lie within `tolerance` of the line between those are
 * dropped (Ramer–Douglas–Peucker). Flat points in, flat points out.
 */
export function simplifyPoints(points: readonly number[], tolerance: number): number[] {
  const all = pairs(points);
  if (all.length <= 2) return [...points];
  const keep = new Array<boolean>(all.length).fill(false);
  keep[0] = true;
  keep[all.length - 1] = true;
  const stack: Array<[number, number]> = [[0, all.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let distance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const away = distanceToSegment(all[i], all[first], all[last]);
      if (away > distance) {
        distance = away;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return all.filter((_, index) => keep[index]).flatMap((point) => [point.x, point.y]);
}

/** The box of a tick or a cross placed with a click: a square of `size` around the point */
export function stampBox(centre: HandPoint, size: number): number[] {
  const half = size / 2;
  return [centre.x - half, centre.y - half, centre.x + half, centre.y + half];
}
