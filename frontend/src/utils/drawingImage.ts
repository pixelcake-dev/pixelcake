/**
 * The drawing as a picture.
 *
 * The canvas on screen is live HTML. What is exported is drawn again here as
 * one SVG document, from the same data and the same measures: it can be
 * saved as it is (a vector file) or turned into a PNG of any size, in the
 * light or in the dark theme whatever the screen shows.
 *
 * Pure: no React, no stores, no DOM. The caller gives a way to measure text.
 *
 * A device is drawn as the canvas draws it: its drawing in the colours of
 * the theme, its name and its address under it, no box; a cable ends next to
 * what is drawn (utils/deviceGeometry.ts has the numbers of both). The
 * other numbers below repeat what index.css says about a cable, a label,
 * an area. drawingImage.test.ts reads the style sheet and fails when they
 * drift.
 */

import { Position, getSmoothStepPath } from 'reactflow';
import { DEVICE_DRAWING_SIZE, type DeviceDrawingId } from '@/data/deviceDrawings';
import {
  deviceState,
  drawingMarkup,
  drawingOfDevice,
  drawingWindows,
  type DeviceState,
} from '@/utils/deviceDrawing';
import {
  DEVICE_METRICS,
  cableEnd,
  cableRun,
  deviceHeight,
  drawingPlace,
  type Side,
} from '@/utils/deviceGeometry';
import type {
  AreaColour,
  CanvasArea,
  ConnectionTemplate,
  DeviceTemplate,
  NetworkConnection,
  NetworkDevice,
} from '@/types/network';
import { AREA_PALETTE, AREA_TINT } from '@/utils/canvasAreas';
// (the few words written into the picture: plain data, read when it is drawn)
import { getT } from '@/i18n';

export { DEVICE_METRICS };
export type { Side };

// ---------- what the caller gives ----------

export type ImageTheme = 'light' | 'dark';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point, Size {}

export interface FontSpec {
  size: number;
  weight: 400 | 600 | 700;
  /** In the letters of equal width (an address) */
  mono?: boolean;
}

/** Width of a piece of text, in the units of the drawing */
export type TextMeasure = (text: string, font: FontSpec) => number;

/** Presentation mode: what is marked on the drawing */
export interface DrawingMarks {
  sourceId: string | null;
  targetId: string | null;
  failedDevices: string[];
  failedConnections: string[];
  route: { links: string[]; arrives: boolean; dropDeviceId: string | null } | null;
}

export interface DrawingInput {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  /** The areas behind the devices («riquadri»), first drawn first */
  areas?: CanvasArea[];
  deviceTemplates: DeviceTemplate[];
  connectionTemplates: ConnectionTemplate[];
  measureText: TextMeasure;
  marks?: DrawingMarks;
  /** The devices that wait for an address nobody gave them: their lamp says so, as on screen */
  waiting?: readonly string[];
  /** The devices with an address another device has too: their lamp says so, as on screen */
  conflicts?: readonly string[];
  /** Outside a presentation: the answer the last question asked left on a device */
  answer?: { arrives: boolean; deviceId: string } | null;
}

export interface ImageTitle {
  name: string;
  /** A second, smaller line (the canvas of a project with several) */
  detail?: string;
}

/** What is written under the drawing: the question asked while presenting, and its answer */
export interface ImageCaption {
  tone: 'ok' | 'ko' | 'unknown' | null;
  heading: string;
  lines: string[];
}

export interface ImageOptions {
  theme: ImageTheme;
  /** No background: the drawing alone, for a page that has its own */
  transparent?: boolean;
  title?: ImageTitle;
  caption?: ImageCaption;
}

export interface DrawingImage {
  /** The document, declaring one pixel for each unit of the drawing */
  svg: string;
  /** Size in units of the drawing: the pixels of the picture at scale 1 */
  width: number;
  height: number;
}

// ---------- a device and a cable, as the style sheet draws them ----------

export const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * The letters of an address: of equal width. As for the other texts, the
 * picture cannot carry the font of the app: it names the ones a system has,
 * which are also what the browser measures the address with.
 */
export const MONO_FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const NAME_FONT: FontSpec = { size: DEVICE_METRICS.nameSize, weight: 600 };
const IP_FONT: FontSpec = { size: DEVICE_METRICS.ipSize, weight: 400, mono: true };
const PILL_STRONG: FontSpec = { size: 12, weight: 600 };
const PILL_SOFT: FontSpec = { size: 12, weight: 400 };
const ROLE_FONT: FontSpec = { size: 10, weight: 700 };
const TITLE_FONT: FontSpec = { size: 18, weight: 600 };
const DETAIL_FONT: FontSpec = { size: 12.5, weight: 400 };
const HEADING_FONT: FontSpec = { size: 14, weight: 600 };
const CAPTION_FONT: FontSpec = { size: 12.5, weight: 400 };

const PILL = { line: 16, padX: 8, padY: 4, border: 1, radius: 3 } as const;

/** An area («riquadro») as the style sheet draws it: its border, its corners, its label */
export const AREA_METRICS = {
  border: 1.5,
  radius: 3,
  /** The label: where its text starts from the inside of the border, its line, its letters */
  labelLeft: 9,
  labelTop: 4,
  labelLine: 18,
  labelSize: 11,
  /** Space between the letters, in ems */
  labelSpacing: 0.07,
} as const;
const AREA_LABEL_FONT: FontSpec = { size: AREA_METRICS.labelSize, weight: 600 };
const CUT_MARK_RADIUS = 11;
const FALLBACK_CABLE_WIDTH = 2.5;

/**
 * What presentation mode hangs on a device, from the top left corner of its
 * frame (the style sheet places them from the inside of the frame, which is
 * its border further in): the tag of an end of the question, the badge of a
 * failure. And how much the name of a broken device fades.
 */
export const ROLE_TAG = { left: 4, top: -7, height: 16 } as const;
export const FAILURE_BADGE = { right: 8, top: -6, radius: 12 } as const;
export const FAILED_TEXT_OPACITY = 0.55;
/** The mark of a device with a note: a square this large, just after the name (index.css, .device-note-mark) */
export const NOTE_MARK = { size: 5 } as const;

/** The colour of the upper layer of a drawing for each state: the same on both themes */
export const DEVICE_STATE_COLORS: Record<Exclude<DeviceState, 'rest'>, string> = {
  selected: '#f07d2a',
  ok: '#2fa866',
  warning: '#f2c230',
  error: '#e0483e',
  off: '#9aa7b0',
};

/** Colours of presentation mode: the same on both themes */
export const MARK_COLORS = {
  arrives: '#10b981',
  stops: '#f59e0b',
  failure: '#ef4444',
} as const;

export interface Palette {
  canvas: string;
  border: string;
  /** The two layers of the drawing of a device: the lower one, and the upper one at rest */
  deviceLower: string;
  deviceUpper: string;
  text: string;
  textLight: string;
  /** The address under the name of a device */
  address: string;
  line: string;
  pillFill: string;
  pillBorder: string;
  pillStrong: string;
  pillSoft: string;
  toneOk: string;
  toneKo: string;
  toneUnknown: string;
}

export const PALETTES: Record<ImageTheme, Palette> = {
  light: {
    canvas: '#ffffff',
    border: '#d5dbe0',
    deviceLower: '#22313b',
    deviceUpper: '#5e8096',
    text: '#22313b',
    textLight: '#5c6b76',
    address: '#5c6b76',
    line: '#7b8791',
    pillFill: '#ffffff',
    pillBorder: '#d5dbe0',
    pillStrong: '#22313b',
    pillSoft: '#5c6b76',
    toneOk: '#047857',
    toneKo: '#b91c1c',
    toneUnknown: '#b45309',
  },
  dark: {
    canvas: '#111315',
    border: '#2a3238',
    deviceLower: '#8fb0c6',
    deviceUpper: '#c9d8e2',
    text: '#f4f6f8',
    textLight: '#93a0aa',
    address: '#93a0aa',
    line: '#6f7c86',
    pillFill: '#111315',
    pillBorder: '#2a3238',
    pillStrong: '#f4f6f8',
    pillSoft: '#93a0aa',
    toneOk: '#6ee7b7',
    toneKo: '#fca5a5',
    toneUnknown: '#fcd34d',
  },
};

/** The two colours of the app, in light and in dark: where the question
 *  starts, where it ends, and the colour of what is written on each */
export interface Accents {
  accent: string;
  secondary: string;
  onAccent: string;
  onSecondary: string;
}

export const ACCENTS: Record<ImageTheme, Accents> = {
  light: { accent: '#F07D2A', secondary: '#5E8096', onAccent: '#22313b', onSecondary: '#ffffff' },
  dark: { accent: '#F07D2A', secondary: '#8FB0C6', onAccent: '#22313b', onSecondary: '#111315' },
};

// ---------- the scene: where everything is ----------

export type CableLook = 'plain' | 'cut' | 'faded' | 'arrives' | 'stops';

export interface SceneDevice {
  id: string;
  label: string;
  ip: string;
  box: Box;
  drawing: DeviceDrawingId;
  /** What the upper layer of the drawing says */
  state: DeviceState;
  role: 'source' | 'target' | null;
  failed: boolean;
  /** The packet of the answer stops here */
  drop: boolean;
  /** It has a note: a small square after its name, as on the canvas */
  note: boolean;
}

export interface SceneArea {
  id: string;
  /** The label as it is drawn: in capitals, cut where the area ends; '' for none */
  label: string;
  color: AreaColour;
  box: Box;
}

export interface SceneLabel {
  box: Box;
  lines: Array<{ text: string; strong: boolean }>;
}

export interface SceneCable {
  id: string;
  path: string;
  look: CableLook;
  width: number;
  dash: string | null;
  label: SceneLabel | null;
  /** Where the mark of a cut cable sits */
  cutMark: Point | null;
}

export interface Scene {
  /** Drawn first: everything else lies over them */
  areas: SceneArea[];
  devices: SceneDevice[];
  cables: SceneCable[];
  /** The smallest box that holds everything drawn */
  bounds: Box;
}

/**
 * A rough width for text when nothing can measure it (about what the system
 * fonts of the app give). Good enough to lay a drawing out; the app itself
 * measures with the browser.
 */
export const approximateTextWidth: TextMeasure = (text, font) =>
  [...text].length * font.size * (font.mono ? 0.6 : font.weight === 400 ? 0.54 : 0.58);

/**
 * The size the screen gives a device: its frame, the same for every device
 * whatever it is called, lower when there is no address to show
 */
export function deviceSize(hasAddress: boolean): Size {
  return { width: DEVICE_METRICS.width, height: deviceHeight(hasAddress) };
}

const SIDES: Record<Side, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

/** The side a cable end hangs on. An end that names none hangs on the first: the top */
function sideOf(handle: string | null | undefined): Side {
  return handle === 'bottom' || handle === 'left' || handle === 'right' ? handle : 'top';
}

function cableLook(connection: NetworkConnection, marks: DrawingMarks | undefined): CableLook {
  if (!marks) return 'plain';
  if (marks.failedConnections.includes(connection.id)) return 'cut';
  if (
    marks.failedDevices.includes(connection.source) ||
    marks.failedDevices.includes(connection.target)
  ) {
    return 'faded';
  }
  if (marks.route?.links.includes(connection.id)) return marks.route.arrives ? 'arrives' : 'stops';
  return 'plain';
}

class Bounds {
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  add(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
  }

  addBox(box: Box, margin = 0): void {
    this.add(box.x - margin, box.y - margin);
    this.add(box.x + box.width + margin, box.y + box.height + margin);
  }

  box(): Box {
    if (this.minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
    return {
      x: this.minX,
      y: this.minY,
      width: this.maxX - this.minX,
      height: this.maxY - this.minY,
    };
  }
}

/** Every pair of numbers in a path made of M, L and Q commands */
function pathPoints(path: string): Point[] {
  const numbers = (path.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  const points: Point[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push({ x: numbers[i], y: numbers[i + 1] });
  return points;
}

/** Where every device and every cable goes, in the coordinates of the canvas */
export function layoutDrawing(input: DrawingInput): Scene {
  const { marks, measureText } = input;
  const bounds = new Bounds();
  const m = DEVICE_METRICS;

  // The areas, as large as they were drawn. The label is written in
  // capitals, on one line, and gives way to dots where the area is too
  // narrow for it, as on screen
  const areas: SceneArea[] = (input.areas ?? []).map(area => {
    const box: Box = { ...area.position, ...area.size };
    bounds.addBox(box);
    return {
      id: area.id,
      label: fitAreaLabel(area.label, area.size.width, measureText),
      color: area.color,
      box,
    };
  });

  const devices: SceneDevice[] = input.devices.map(device => {
    const size = deviceSize(device.ip !== '');
    const failed = marks?.failedDevices.includes(device.id) ?? false;
    // Where the answer on screen ends: the one of the presentation, or the
    // one the last question left on the canvas
    const left = input.answer?.deviceId === device.id ? input.answer : null;
    const stops = marks?.route?.dropDeviceId === device.id || left?.arrives === false;
    const arrives =
      (marks?.route?.arrives === true && marks.targetId === device.id) || left?.arrives === true;
    // A broken device is where the packet stops only for the one before it
    const drop = !failed && stops;

    const scene: SceneDevice = {
      id: device.id,
      label: device.label,
      ip: device.ip,
      box: { x: device.position.x, y: device.position.y, width: size.width, height: size.height },
      // Same choice as the canvas: the template by id, else by type
      drawing: drawingOfDevice(device, input.deviceTemplates),
      // What the upper layer says, as on the canvas (a selection is not of the picture)
      state: deviceState({
        failed,
        stopsHere: stops,
        arrivesHere: arrives,
        conflict: input.conflicts?.includes(device.id),
        waiting: input.waiting?.includes(device.id),
      }),
      role:
        marks?.sourceId === device.id ? 'source' : marks?.targetId === device.id ? 'target' : null,
      failed,
      drop,
      note: Boolean(device.notes?.trim()),
    };

    bounds.addBox(scene.box);
    // What sticks out of the frame: a name or an address wider than it, the
    // badges of a role and of a failure
    const centre = scene.box.x + scene.box.width / 2;
    for (const [text, font] of [
      [scene.label, NAME_FONT],
      [scene.ip, IP_FONT],
    ] as const) {
      if (text === '') continue;
      const half = measureText(text, font) / 2 + m.textPad;
      bounds.add(centre - half, scene.box.y);
      bounds.add(centre + half, scene.box.y);
    }
    if (scene.note) {
      bounds.add(centre + measureText(scene.label, NAME_FONT) / 2 + m.textPad + NOTE_MARK.size, scene.box.y);
    }
    if (scene.role) bounds.add(scene.box.x + ROLE_TAG.left, scene.box.y + ROLE_TAG.top);
    if (scene.failed) {
      bounds.add(
        scene.box.x + scene.box.width - FAILURE_BADGE.right,
        scene.box.y + FAILURE_BADGE.top
      );
    }
    return scene;
  });

  const placed = new Map(devices.map(device => [device.id, device] as const));
  /** Where a cable ends on a side of a device: next to what is drawn, as on the canvas */
  const endOf = (device: SceneDevice, side: Side): Point => {
    const end = cableEnd(device.drawing, side, device.box.height);
    return { x: device.box.x + end.x, y: device.box.y + end.y };
  };

  const cables: SceneCable[] = [];
  for (const connection of input.connections) {
    const from = placed.get(connection.source);
    const to = placed.get(connection.target);
    if (!from || !to) continue;

    const fromSide = sideOf(connection.sourceHandle);
    const toSide = sideOf(connection.targetHandle);
    const start = endOf(from, fromSide);
    const end = endOf(to, toSide);
    // (the middle run halfway between the two frames, as on the canvas)
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX: start.x,
      sourceY: start.y,
      sourcePosition: SIDES[fromSide],
      targetX: end.x,
      targetY: end.y,
      targetPosition: SIDES[toSide],
      ...cableRun(from.box, fromSide, to.box, toSide),
    });

    const template = connection.type
      ? input.connectionTemplates.find(entry => entry.type === connection.type)
      : undefined;
    const dash = template?.strokeDasharray;
    const look = cableLook(connection, marks);

    const lines: SceneLabel['lines'] = [];
    if (connection.bandwidth) lines.push({ text: connection.bandwidth, strong: true });
    if (connection.label) lines.push({ text: connection.label, strong: false });

    let label: SceneLabel | null = null;
    // A cut cable shows its mark where the label was
    if (look !== 'cut' && lines.length > 0) {
      const textWidth = Math.max(
        ...lines.map(line => measureText(line.text, line.strong ? PILL_STRONG : PILL_SOFT))
      );
      const width = Math.round(textWidth + 2 * (PILL.padX + PILL.border));
      const height = lines.length * PILL.line + 2 * (PILL.padY + PILL.border);
      label = { box: { x: labelX - width / 2, y: labelY - height / 2, width, height }, lines };
    }

    for (const point of pathPoints(path)) bounds.add(point.x, point.y);
    if (label) bounds.addBox(label.box);
    if (look === 'cut') {
      bounds.add(labelX - CUT_MARK_RADIUS, labelY - CUT_MARK_RADIUS);
      bounds.add(labelX + CUT_MARK_RADIUS, labelY + CUT_MARK_RADIUS);
    }

    cables.push({
      id: connection.id,
      path,
      look,
      width: template?.strokeWidth ?? FALLBACK_CABLE_WIDTH,
      dash: dash && dash !== 'none' ? dash : null,
      label,
      cutMark: look === 'cut' ? { x: labelX, y: labelY } : null,
    });
  }

  return { areas, devices, cables, bounds: bounds.box() };
}

/** The width of a label of an area, with the space between its letters */
function areaLabelWidth(text: string, measure: TextMeasure): number {
  return (
    measure(text, AREA_LABEL_FONT) + [...text].length * AREA_METRICS.labelSize * AREA_METRICS.labelSpacing
  );
}

/**
 * How far the label of an area reaches from its left side, as it is drawn:
 * the border, the room before the text, the text as it fits. 0 for none.
 */
export function areaLabelReach(
  area: Pick<CanvasArea, 'label' | 'size'>,
  measure: TextMeasure
): number {
  const text = fitAreaLabel(area.label, area.size.width, measure);
  if (text === '') return 0;
  return AREA_METRICS.border + AREA_METRICS.labelLeft + areaLabelWidth(text, measure);
}

/** The label of an area as it fits in it: in capitals, ending in dots when it is cut */
function fitAreaLabel(label: string, areaWidth: number, measure: TextMeasure): string {
  const text = label.trim().toLocaleUpperCase('it');
  if (text === '') return '';
  const room = areaWidth - 2 * (AREA_METRICS.border + AREA_METRICS.labelLeft);
  if (areaLabelWidth(text, measure) <= room) return text;
  const letters = [...text];
  while (letters.length > 1 && areaLabelWidth(`${letters.join('')}…`, measure) > room) letters.pop();
  return `${letters.join('').trimEnd()}…`;
}

// ---------- the scene as SVG ----------

/** A number as SVG writes it: two decimals at most, no trailing zeros */
function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** Text made safe for XML, as content or inside an attribute */
export function escapeXml(text: string): string {
  return (
    text
      // Characters XML 1.0 does not allow at all
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );
}

/** Where the baseline of one line of text goes, for the text to sit in the middle of the line */
function baseline(lineTop: number, lineHeight: number, fontSize: number): number {
  return lineTop + lineHeight / 2 + fontSize * 0.36;
}

function textElement(
  text: string,
  x: number,
  y: number,
  font: FontSpec,
  fill: string,
  extra = ''
): string {
  const family = font.mono ? ` font-family="${MONO_FONT_FAMILY}"` : '';
  return `<text x="${num(x)}" y="${num(y)}"${family} font-size="${num(font.size)}" font-weight="${font.weight}" fill="${fill}"${extra}>${escapeXml(text)}</text>`;
}

/** The colour of the upper layer of a drawing, for a state */
function stateColour(state: DeviceState, palette: Palette): string {
  return state === 'rest' ? palette.deviceUpper : DEVICE_STATE_COLORS[state];
}

/** The names of the windows of the drawings start with this, in the document */
const ID_PREFIX = 'pc';

/** What the texts of a device are drawn with */
interface DeviceLook {
  palette: Palette;
  accents: Accents;
  measureText: TextMeasure;
  /** Nothing is painted behind the name and the address: the picture has no background */
  bare: boolean;
}

/** A line of text of a device, in the middle, with the canvas behind it as on screen */
function deviceLine(
  text: string,
  centre: number,
  top: number,
  line: number,
  font: FontSpec,
  fill: string,
  look: DeviceLook
): string {
  const width = look.measureText(text, font) + 2 * DEVICE_METRICS.textPad;
  const behind = look.bare
    ? ''
    : `<rect x="${num(centre - width / 2)}" y="${num(top)}" width="${num(width)}" height="${line}" fill="${look.palette.canvas}"/>`;
  return (
    behind + textElement(text, centre, baseline(top, line, font.size), font, fill, ' text-anchor="middle"')
  );
}

function deviceSvg(device: SceneDevice, look: DeviceLook): string {
  const { palette, accents, measureText } = look;
  const m = DEVICE_METRICS;
  const { x, y, width } = device.box;
  const centre = x + width / 2;
  const parts: string[] = [];

  // The answer ends on this device: its frame shows, in the colour of its lamp
  if (device.state === 'ok' || device.state === 'error') {
    const line = m.border;
    parts.push(
      `<rect x="${num(x + line / 2)}" y="${num(y + line / 2)}" width="${num(width - line)}" height="${num(device.box.height - line)}" rx="${num(m.radius - line / 2)}" fill="none" stroke="${stateColour(device.state, palette)}" stroke-width="${line}"/>`
    );
  }

  // The drawing, in the colours of the theme: what is drawn on its layers
  // is the canvas, and its upper layer says the state
  const place = drawingPlace();
  parts.push(
    `<g transform="translate(${num(x + place.x)} ${num(y + place.y)}) scale(${m.icon / DEVICE_DRAWING_SIZE})">${drawingMarkup(
      device.drawing,
      { lower: palette.deviceLower, state: stateColour(device.state, palette), ground: palette.canvas },
      ID_PREFIX
    )}</g>`
  );

  // Name, address: under the drawing, each with the canvas behind it
  const texts: string[] = [];
  const nameTop = y + place.y + m.icon + m.iconGap;
  texts.push(deviceLine(device.label, centre, nameTop, m.nameLine, NAME_FONT, palette.text, look));
  // (a device with a note: the small square just after its name, in the colour of the address)
  if (device.note) {
    const left = centre + measureText(device.label, NAME_FONT) / 2 + m.textPad;
    const top = nameTop + m.nameLine / 2 - NOTE_MARK.size / 2;
    texts.push(
      `<rect x="${num(left)}" y="${num(top)}" width="${NOTE_MARK.size}" height="${NOTE_MARK.size}" fill="${palette.address}"/>`
    );
  }
  if (device.ip) {
    texts.push(
      deviceLine(device.ip, centre, nameTop + m.nameLine, m.ipLine, IP_FONT, palette.address, look)
    );
  }
  // (the name and the address of a broken device fade)
  parts.push(device.failed ? `<g opacity="${FAILED_TEXT_OPACITY}">${texts.join('')}</g>` : texts.join(''));

  // The end of the question this device is
  if (device.role) {
    const words = getT().exportImage.picture;
    const text = device.role === 'source' ? words.from : words.to;
    const spacing = ROLE_FONT.size * 0.04;
    const textWidth = measureText(text, ROLE_FONT) + spacing * text.length;
    const pillWidth = Math.round(textWidth + 16);
    const left = x + ROLE_TAG.left;
    const top = y + ROLE_TAG.top;
    parts.push(
      `<rect x="${num(left)}" y="${num(top)}" width="${num(pillWidth)}" height="${ROLE_TAG.height}" rx="2" fill="${device.role === 'source' ? accents.accent : accents.secondary}"/>`,
      textElement(
        text,
        left + pillWidth / 2,
        baseline(top, ROLE_TAG.height, ROLE_FONT.size),
        ROLE_FONT,
        device.role === 'source' ? accents.onAccent : accents.onSecondary,
        ` text-anchor="middle" letter-spacing="${num(spacing)}"`
      )
    );
  }

  // A device taken as broken
  if (device.failed) {
    const cx = x + width - FAILURE_BADGE.right - FAILURE_BADGE.radius;
    const cy = y + FAILURE_BADGE.top + FAILURE_BADGE.radius;
    parts.push(
      `<circle cx="${num(cx)}" cy="${num(cy)}" r="${FAILURE_BADGE.radius}" fill="${MARK_COLORS.failure}"/>`,
      `<g transform="translate(${num(cx - 7)} ${num(cy - 7)}) scale(0.5833)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ZAP_OFF}</g>`
    );
  }

  return `<g>${parts.join('')}</g>`;
}

/** An area: a light tint of its colour, a thin border of the same colour, its label in a corner */
function areaSvg(area: SceneArea, theme: ImageTheme): string {
  const a = AREA_METRICS;
  const color = AREA_PALETTE[theme][area.color] ?? AREA_PALETTE[theme].slate;
  const { x, y, width, height } = area.box;
  const parts = [
    `<rect x="${num(x + a.border / 2)}" y="${num(y + a.border / 2)}" width="${num(width - a.border)}" height="${num(height - a.border)}" rx="${num(a.radius - a.border / 2)}" fill="${color}" fill-opacity="${AREA_TINT}" stroke="${color}" stroke-width="${a.border}"/>`,
  ];
  if (area.label) {
    parts.push(
      textElement(
        area.label,
        x + a.border + a.labelLeft,
        baseline(y + a.border + a.labelTop, a.labelLine, a.labelSize),
        AREA_LABEL_FONT,
        color,
        ` letter-spacing="${num(a.labelSize * a.labelSpacing)}"`
      )
    );
  }
  return `<g>${parts.join('')}</g>`;
}

/** The "no power" sign of a broken device (Lucide "zap-off", ISC licence) */
const ZAP_OFF =
  '<path d="M10.513 4.856 13.12 2.17a.5.5 0 0 1 .86.46l-1.377 4.317"/>' +
  '<path d="M15.656 10H20a1 1 0 0 1 .78 1.63l-1.72 1.773"/>' +
  '<path d="M16.273 16.273 10.88 21.83a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63l4.507-4.643"/>' +
  '<path d="m2 2 20 20"/>';

function cableSvg(cable: SceneCable, palette: Palette): string {
  const style = (() => {
    switch (cable.look) {
      case 'cut':
        return { stroke: MARK_COLORS.failure, width: cable.width + 0.5, dash: '3 7', opacity: 0.9 };
      case 'faded':
        return { stroke: palette.line, width: cable.width, dash: '3 7', opacity: 0.3 };
      case 'arrives':
        return { stroke: MARK_COLORS.arrives, width: cable.width + 1.5, dash: cable.dash, opacity: 1 };
      case 'stops':
        return { stroke: MARK_COLORS.stops, width: cable.width + 1.5, dash: cable.dash, opacity: 1 };
      default:
        return { stroke: palette.line, width: cable.width, dash: cable.dash, opacity: 0.6 };
    }
  })();
  const dash = style.dash ? ` stroke-dasharray="${escapeXml(style.dash)}"` : '';
  const opacity = style.opacity < 1 ? ` opacity="${style.opacity}"` : '';
  return `<path d="${cable.path}" fill="none" stroke="${style.stroke}" stroke-width="${num(style.width)}"${dash}${opacity}/>`;
}

function cableLabelSvg(cable: SceneCable, palette: Palette): string {
  if (cable.cutMark) {
    const { x, y } = cable.cutMark;
    return (
      `<circle cx="${num(x)}" cy="${num(y)}" r="${CUT_MARK_RADIUS}" fill="${MARK_COLORS.failure}"/>` +
      `<path d="M${num(x - 3.5)} ${num(y - 3.5)}L${num(x + 3.5)} ${num(y + 3.5)}M${num(x + 3.5)} ${num(y - 3.5)}L${num(x - 3.5)} ${num(y + 3.5)}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`
    );
  }
  if (!cable.label) return '';
  const { box, lines } = cable.label;
  const parts = [
    `<rect x="${num(box.x + 0.5)}" y="${num(box.y + 0.5)}" width="${num(box.width - 1)}" height="${num(box.height - 1)}" rx="${PILL.radius}" fill="${palette.pillFill}" stroke="${palette.pillBorder}" stroke-width="1"/>`,
  ];
  lines.forEach((line, index) => {
    const font = line.strong ? PILL_STRONG : PILL_SOFT;
    parts.push(
      textElement(
        line.text,
        box.x + box.width / 2,
        baseline(box.y + PILL.border + PILL.padY + index * PILL.line, PILL.line, font.size),
        font,
        line.strong ? palette.pillStrong : palette.pillSoft,
        ' text-anchor="middle"'
      )
    );
  });
  return parts.join('');
}

/** Break a text into lines no wider than `maxWidth`; a word longer than a line is cut */
export function wrapText(
  text: string,
  maxWidth: number,
  font: FontSpec,
  measure: TextMeasure
): string[] {
  const lines: string[] = [];
  let line = '';
  const push = () => {
    if (line !== '') lines.push(line);
    line = '';
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (measure(candidate, font) <= maxWidth) {
      line = candidate;
      continue;
    }
    push();
    // A word that does not fit a line by itself is cut where the line ends
    let rest = word;
    while (measure(rest, font) > maxWidth && [...rest].length > 1) {
      const letters = [...rest];
      let count = letters.length - 1;
      while (count > 1 && measure(letters.slice(0, count).join(''), font) > maxWidth) count -= 1;
      lines.push(letters.slice(0, count).join(''));
      rest = letters.slice(count).join('');
    }
    line = rest;
  }
  push();
  return lines;
}

const PAGE = {
  /** Empty space around everything */
  margin: 24,
  /** The least room a title or a caption is given to be read in */
  minTextWidth: 360,
  titleLine: 24,
  detailLine: 18,
  headingLine: 20,
  captionLine: 18,
  /** Between the title and the drawing, and between the drawing and its caption */
  gap: 16,
  /** The mark in the colour of the answer, in front of the heading of the caption */
  toneMark: 18,
} as const;

/** The drawing as an SVG document */
export function renderDrawingImage(input: DrawingInput, options: ImageOptions): DrawingImage {
  const scene = layoutDrawing(input);
  const palette = PALETTES[options.theme];
  const accents = ACCENTS[options.theme];
  const measure = input.measureText;
  const { title, caption } = options;

  const hasText = Boolean(title || caption);
  const innerWidth = Math.max(Math.ceil(scene.bounds.width), hasText ? PAGE.minTextWidth : 0);
  const width = innerWidth + 2 * PAGE.margin;
  const body: string[] = [];
  let cursor = PAGE.margin;

  if (title) {
    for (const line of wrapText(title.name, innerWidth, TITLE_FONT, measure)) {
      body.push(
        textElement(
          line,
          PAGE.margin,
          baseline(cursor, PAGE.titleLine, TITLE_FONT.size),
          TITLE_FONT,
          palette.text
        )
      );
      cursor += PAGE.titleLine;
    }
    for (const line of title.detail ? wrapText(title.detail, innerWidth, DETAIL_FONT, measure) : []) {
      body.push(
        textElement(
          line,
          PAGE.margin,
          baseline(cursor, PAGE.detailLine, DETAIL_FONT.size),
          DETAIL_FONT,
          palette.textLight
        )
      );
      cursor += PAGE.detailLine;
    }
    cursor += PAGE.gap;
  }

  // The drawing, in the middle of the page when the texts made it wider
  const offsetX = PAGE.margin + (innerWidth - scene.bounds.width) / 2 - scene.bounds.x;
  const offsetY = cursor - scene.bounds.y;
  body.push(
    `<g transform="translate(${num(offsetX)} ${num(offsetY)})">`,
    // (the areas first, in a group of their own: cables and devices are drawn over them)
    scene.areas.length > 0
      ? `<g>${scene.areas.map(area => areaSvg(area, options.theme)).join('')}</g>`
      : '',
    `<g>${scene.cables.map(cable => cableSvg(cable, palette)).join('')}</g>`,
    `<g>${scene.cables.map(cable => cableLabelSvg(cable, palette)).join('')}</g>`,
    ...scene.devices.map(device =>
      deviceSvg(device, { palette, accents, measureText: measure, bare: Boolean(options.transparent) })
    ),
    '</g>'
  );
  cursor += Math.ceil(scene.bounds.height);

  if (caption) {
    cursor += PAGE.gap;
    const indent = caption.tone ? PAGE.toneMark : 0;
    const tone =
      caption.tone === 'ok'
        ? palette.toneOk
        : caption.tone === 'ko'
          ? palette.toneKo
          : palette.toneUnknown;
    wrapText(caption.heading, innerWidth - indent, HEADING_FONT, measure).forEach((line, index) => {
      if (index === 0 && caption.tone) {
        body.push(
          `<circle cx="${num(PAGE.margin + 5)}" cy="${num(cursor + PAGE.headingLine / 2)}" r="5" fill="${tone}"/>`
        );
      }
      body.push(
        textElement(
          line,
          PAGE.margin + indent,
          baseline(cursor, PAGE.headingLine, HEADING_FONT.size),
          HEADING_FONT,
          palette.text
        )
      );
      cursor += PAGE.headingLine;
    });
    for (const paragraph of caption.lines) {
      for (const line of wrapText(paragraph, innerWidth - indent, CAPTION_FONT, measure)) {
        body.push(
          textElement(
            line,
            PAGE.margin + indent,
            baseline(cursor, PAGE.captionLine, CAPTION_FONT.size),
            CAPTION_FONT,
            palette.text
          )
        );
        cursor += PAGE.captionLine;
      }
    }
  }

  const height = Math.ceil(cursor) + PAGE.margin;
  const name = title?.name ?? getT().exportImage.picture.untitled;
  // The windows of the drawings that are in the picture, once each
  const drawings = [...new Set(scene.devices.map(device => device.drawing))];
  const svg = [
    `${SVG_OPEN} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_FAMILY}" role="img" aria-label="${escapeXml(name)}">`,
    `<title>${escapeXml(name)}</title>`,
    drawings.length > 0
      ? `<defs>${drawings.map(drawing => drawingWindows(drawing, ID_PREFIX)).join('')}</defs>`
      : '',
    options.transparent ? '' : `<rect width="${width}" height="${height}" fill="${palette.canvas}"/>`,
    ...body,
    '</svg>',
  ].join('');

  return { svg, width, height };
}

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg"';

/** The pixels of a picture made at `scale` pixels for each unit of the drawing */
export function pixelSize(image: Size, scale: number): Size {
  return {
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
  };
}

/**
 * The same document declaring another size. A browser paints an SVG at the
 * size it declares: this is what makes a large PNG sharp instead of stretched.
 */
export function scaledSvg(image: DrawingImage, scale: number): string {
  const size = pixelSize(image, scale);
  const declared = `${SVG_OPEN} width="${image.width}" height="${image.height}"`;
  if (!image.svg.startsWith(declared)) return image.svg;
  return `${SVG_OPEN} width="${size.width}" height="${size.height}"${image.svg.slice(declared.length)}`;
}
