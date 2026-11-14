// Reads the drawings of the devices (src/assets/device-drawings/*.svg) and
// writes them as data to src/data/deviceDrawings.ts, so that the app draws a
// device without a request for its picture, in the colours of its theme.
//
//   pnpm drawings:build
//
// Run it again after a drawing is added or changed. Nothing of a shape is
// changed here: each one goes to the output with the attributes it has, its
// colour replaced by the name of what it is (a layer of the device, or the
// symbol on it). A file that is not built as README.md of that folder says
// stops the script. A test fails when the output is not the one of the files.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'src', 'assets', 'device-drawings');
const OUTPUT = path.join(ROOT, 'src', 'data', 'deviceDrawings.ts');

/** The side of the square a drawing is made in, and the height of the cut between its layers */
const SIZE = 128;
const CUT = 5;
/** The colours of the files: the lower layer and what is drawn on the layers */
const LOWER = '#22313B';
const GROUND = '#FFFFFF';
const UPPER = 'var(--pc-stato, #5E8096)';

/** The elements of a piece of markup, in order */
function elements(markup) {
  return [...markup.matchAll(/<(\w+)\b([^>]*?)\/>/g)].map((found) => ({
    tag: found[1],
    attributes: found[2].trim(),
  }));
}

const fillOf = (element) => /(?:^|\s)fill="([^"]*)"/.exec(element.attributes)?.[1];
const withoutFill = (element) => element.attributes.replace(/(^|\s)fill="[^"]*"/, '').trim();
const attribute = (element, name) => {
  const found = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(element.attributes);
  return found ? Number(found[1]) : 0;
};

/** Points on an arc of an ellipse, from the way a path writes it (SVG 1.1, F.6.5) */
function arcPoints(x1, y1, rx, ry, rotation, large, sweep, x2, y2) {
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  let rxs = Math.abs(rx);
  let rys = Math.abs(ry);
  const scale = (x1p * x1p) / (rxs * rxs) + (y1p * y1p) / (rys * rys);
  if (scale > 1) {
    rxs *= Math.sqrt(scale);
    rys *= Math.sqrt(scale);
  }
  const numerator = rxs * rxs * rys * rys - rxs * rxs * y1p * y1p - rys * rys * x1p * x1p;
  const denominator = rxs * rxs * y1p * y1p + rys * rys * x1p * x1p;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * rxs * y1p) / rys;
  const cyp = (-factor * rys * x1p) / rxs;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1p - cxp) / rxs, (y1p - cyp) / rys);
  let delta = angle((x1p - cxp) / rxs, (y1p - cyp) / rys, (-x1p - cxp) / rxs, (-y1p - cyp) / rys);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const points = [];
  const steps = 256;
  for (let step = 1; step <= steps; step++) {
    const t = start + (delta * step) / steps;
    points.push([
      cx + rxs * Math.cos(t) * cos - rys * Math.sin(t) * sin,
      cy + rxs * Math.cos(t) * sin + rys * Math.sin(t) * cos,
    ]);
  }
  return points;
}

/** The points a path goes through (its curves as many short steps) */
function pathPoints(d, file) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const points = [];
  let i = 0;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let command = '';
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase();
    switch (command.toUpperCase()) {
      case 'M':
        x = next() + (relative ? x : 0);
        y = next() + (relative ? y : 0);
        startX = x;
        startY = y;
        // (the pairs that follow a move are lines)
        command = relative ? 'l' : 'L';
        break;
      case 'L':
        x = next() + (relative ? x : 0);
        y = next() + (relative ? y : 0);
        break;
      case 'H':
        x = next() + (relative ? x : 0);
        break;
      case 'V':
        y = next() + (relative ? y : 0);
        break;
      case 'A': {
        const rx = next();
        const ry = next();
        const rotation = next();
        const large = next();
        const sweep = next();
        const endX = next() + (relative ? x : 0);
        const endY = next() + (relative ? y : 0);
        points.push(...arcPoints(x, y, rx, ry, rotation, large, sweep, endX, endY));
        x = endX;
        y = endY;
        break;
      }
      case 'Z':
        x = startX;
        y = startY;
        break;
      default:
        throw new Error(`${file}: a path uses "${command}", which this script cannot measure`);
    }
    points.push([x, y]);
  }
  return points;
}

/** The corners of the box that holds a shape */
function cornersOf(element, file) {
  switch (element.tag) {
    case 'rect': {
      const x = attribute(element, 'x');
      const y = attribute(element, 'y');
      return [
        [x, y],
        [x + attribute(element, 'width'), y + attribute(element, 'height')],
      ];
    }
    case 'circle': {
      const r = attribute(element, 'r');
      return [
        [attribute(element, 'cx') - r, attribute(element, 'cy') - r],
        [attribute(element, 'cx') + r, attribute(element, 'cy') + r],
      ];
    }
    case 'ellipse':
      return [
        [attribute(element, 'cx') - attribute(element, 'rx'), attribute(element, 'cy') - attribute(element, 'ry')],
        [attribute(element, 'cx') + attribute(element, 'rx'), attribute(element, 'cy') + attribute(element, 'ry')],
      ];
    case 'path':
      return pathPoints(/(?:^|\s)d="([^"]*)"/.exec(element.attributes)?.[1] ?? '', file);
    default:
      throw new Error(`${file}: a <${element.tag}>, which this script cannot measure`);
  }
}

const round = (value) => Math.round(value * 100) / 100;

/** One drawing, read from its file */
function readDrawing(id, text) {
  const file = `${id}.svg`;
  const found = new RegExp(
    `^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` +
      `<title>[^<]*</title>` +
      `<defs><clipPath id="([^"]+)"><rect width="${SIZE}" height="([\\d.]+)"/></clipPath>` +
      `<mask id="([^"]+)"><rect width="${SIZE}" height="${SIZE}" fill="#000"/>(.*?)</mask></defs>` +
      `(.*?)<g class="pc-stato" clip-path="url\\(#\\1\\)">(.*?)</g>` +
      `<rect y="([\\d.]+)" width="${SIZE}" height="([\\d.]+)" fill="([^"]+)" mask="url\\(#\\3\\)"/></svg>$`
  ).exec(text.trim());
  if (!found) throw new Error(`${file}: not built as the others are (see README.md of its folder)`);
  const [, , layerText, , maskMarkup, bodyMarkup, upperMarkup, cutY, cutHeight, cutFill] = found;
  const layer = Number(layerText);
  const mask = elements(maskMarkup);
  const body = elements(bodyMarkup);
  const upper = elements(upperMarkup);

  if (Number(cutY) !== layer - CUT / 2 || Number(cutHeight) !== CUT || cutFill !== GROUND) {
    throw new Error(`${file}: the cut is not ${CUT} high across the end of the upper layer`);
  }
  if (body.length === 0 || mask.length !== body.length || upper.length !== body.length) {
    throw new Error(`${file}: the mask, the body and the upper layer are not the same shapes`);
  }

  const shapes = [];
  const corners = [];
  body.forEach((element, index) => {
    const fill = fillOf(element);
    if (fill !== LOWER && fill !== GROUND) throw new Error(`${file}: a shape is ${fill}`);
    const geometry = withoutFill(element);
    const same = (other) => other.tag === element.tag && withoutFill(other) === geometry;
    if (!same(mask[index]) || fillOf(mask[index]) !== '#fff') {
      throw new Error(`${file}: shape ${index + 1} of the mask is not shape ${index + 1} of the body`);
    }
    if (!same(upper[index]) || fillOf(upper[index]) !== (fill === LOWER ? UPPER : GROUND)) {
      throw new Error(`${file}: shape ${index + 1} of the upper layer is not shape ${index + 1} of the body`);
    }
    // "l": of the device itself, in the colour of its layer. "g": drawn on
    // it, in the colour of what is behind the drawing
    shapes.push(`<${element.tag} class="${fill === LOWER ? 'l' : 'g'}" ${geometry}/>`);
    corners.push(...cornersOf(element, file));
  });

  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const ink = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(round);
  if (ink[0] < 0 || ink[1] < 0 || ink[2] > SIZE || ink[3] > SIZE) {
    throw new Error(`${file}: drawn outside its square (${ink.join(', ')})`);
  }
  return { id, layer, ink, shapes: shapes.join('') };
}

/** The drawings of the files ({ id: text }), in the order of their names */
export function readDrawings(files) {
  return Object.keys(files)
    .sort()
    .map((id) => readDrawing(id, files[id]));
}

/** The module, from the files as { id: text } */
export function buildModule(files) {
  const entries = readDrawings(files)
    .map(
      (drawing) =>
        `  '${drawing.id}': {\n` +
        `    layer: ${drawing.layer},\n` +
        `    ink: [${drawing.ink.join(', ')}],\n` +
        `    shapes:\n      '${drawing.shapes}',\n` +
        `  },`
    )
    .join('\n');
  return `/**
 * The drawings of the devices, as data.
 *
 * GENERATED by scripts/build-device-drawings.mjs from the files of
 * src/assets/device-drawings: do not edit, run \`pnpm drawings:build\`.
 * How a drawing is built, and how it is coloured, is in README.md there.
 */

export interface DeviceDrawingData {
  /** Where the upper layer ends, from the top of the drawing */
  readonly layer: number;
  /** The box of what is drawn: left, top, right, bottom */
  readonly ink: readonly [number, number, number, number];
  /**
   * The shapes, back to front, without a colour: class "l" on those of the
   * device itself, class "g" on what is drawn on them
   */
  readonly shapes: string;
}

/** The side of the square every drawing is made in */
export const DEVICE_DRAWING_SIZE = ${SIZE};

/** The height of the cut between the two layers, half above and half below the end of the upper one */
export const DEVICE_DRAWING_CUT = ${CUT};

export const DEVICE_DRAWINGS = {
${entries}
} as const satisfies Record<string, DeviceDrawingData>;

export type DeviceDrawingId = keyof typeof DEVICE_DRAWINGS;

/** The drawings, in the order of their names */
export const DEVICE_DRAWING_IDS = Object.keys(DEVICE_DRAWINGS) as DeviceDrawingId[];
`;
}

/** The drawings of the folder, as { id: text } */
export async function readSources() {
  const files = {};
  for (const name of (await readdir(SOURCE)).sort()) {
    if (!name.endsWith('.svg')) continue;
    files[name.replace(/\.svg$/, '')] = await readFile(path.join(SOURCE, name), 'utf8');
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = await readSources();
  await writeFile(OUTPUT, buildModule(files), 'utf8');
  console.log(`${Object.keys(files).length} drawings written to ${path.relative(ROOT, OUTPUT)}`);
}
