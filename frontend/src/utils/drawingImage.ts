/**
 * The drawing as a picture.
 *
 * The canvas on screen is live HTML. What is exported is drawn again here as
 * one SVG document, from the same data and the same measures: it can be
 * saved as it is (a vector file) or turned into a PNG of any size, in the
 * light or in the dark theme whatever the screen shows.
 *
 * Pure: no React, no stores, no DOM. The caller gives the size each device
 * has on screen, the shape of the icons and a way to measure text.
 *
 * The numbers below repeat what index.css says about a device and a cable.
 * drawingImage.test.ts reads the style sheet and fails when they drift.
 */

import { Position, getSmoothStepPath } from 'reactflow';
import { DEVICE_ICONS } from '@/types/network';
import type {
  ConnectionTemplate,
  DeviceTemplate,
  NetworkConnection,
  NetworkDevice,
} from '@/types/network';

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
}

/** Width of a piece of text, in the units of the drawing */
export type TextMeasure = (text: string, font: FontSpec) => number;

/** An icon as Iconify describes it: markup for the inside of an `<svg>`, and its view box */
export interface IconShape {
  body: string;
  width: number;
  height: number;
  left: number;
  top: number;
}

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
  deviceTemplates: DeviceTemplate[];
  connectionTemplates: ConnectionTemplate[];
  /** Size of each device as the screen draws it; a missing one is worked out from its texts */
  sizes?: ReadonlyMap<string, Size>;
  /** Shape of an icon by name; null when it is not known */
  iconOf: (name: string) => IconShape | null;
  measureText: TextMeasure;
  marks?: DrawingMarks;
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

export const DEVICE_METRICS = {
  border: 2,
  padding: 10,
  icon: 48,
  iconGap: 5,
  nameLine: 20,
  nameSize: 14,
  ipGap: 4,
  ipLine: 16,
  ipSize: 12.24,
  minWidth: 120,
  radius: 3,
  /** How far outside the box the screen hangs a cable (the connection points) */
  handleReach: 12,
} as const;

export const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const NAME_FONT: FontSpec = { size: DEVICE_METRICS.nameSize, weight: 600 };
const IP_FONT: FontSpec = { size: DEVICE_METRICS.ipSize, weight: 400 };
const PILL_STRONG: FontSpec = { size: 12, weight: 600 };
const PILL_SOFT: FontSpec = { size: 12, weight: 400 };
const ROLE_FONT: FontSpec = { size: 10.08, weight: 700 };
const TITLE_FONT: FontSpec = { size: 18, weight: 600 };
const DETAIL_FONT: FontSpec = { size: 12.5, weight: 400 };
const HEADING_FONT: FontSpec = { size: 14, weight: 600 };
const CAPTION_FONT: FontSpec = { size: 12.5, weight: 400 };

const PILL = { line: 16, padX: 8, padY: 4, border: 1, radius: 3 } as const;
const CUT_MARK_RADIUS = 11;
const FALLBACK_ICON = 'mdi:help-circle-outline';
const FALLBACK_ICON_COLOR = '#5E8096';
const FALLBACK_CABLE_WIDTH = 2.5;

/** Colours of presentation mode: the same on both themes */
export const MARK_COLORS = {
  arrives: '#10b981',
  stops: '#f59e0b',
  failure: '#ef4444',
} as const;

export interface Palette {
  canvas: string;
  component: string;
  border: string;
  text: string;
  textLight: string;
  /** The address under the name of a device */
  address: string;
  line: string;
  iconOpacity: number;
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
    component: '#f4f6f8',
    border: '#d5dbe0',
    text: '#22313b',
    textLight: '#5c6b76',
    address: '#5c6b76',
    line: '#7b8791',
    iconOpacity: 0.95,
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
    component: '#1c2226',
    border: '#2a3238',
    text: '#f4f6f8',
    textLight: '#93a0aa',
    address: '#93a0aa',
    line: '#6f7c86',
    iconOpacity: 0.9,
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

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type CableLook = 'plain' | 'cut' | 'faded' | 'arrives' | 'stops';

export interface SceneDevice {
  id: string;
  label: string;
  ip: string;
  box: Box;
  iconName: string;
  icon: IconShape | null;
  color: string;
  role: 'source' | 'target' | null;
  failed: boolean;
  /** The packet of the answer stops here */
  drop: boolean;
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
  [...text].length * font.size * (font.weight === 400 ? 0.54 : 0.58);

/** The size the screen gives a device, worked out from its texts */
export function estimateDeviceSize(label: string, ip: string, measure: TextMeasure): Size {
  const m = DEVICE_METRICS;
  const inner = Math.max(m.icon, measure(label, NAME_FONT), ip ? measure(ip, IP_FONT) : 0);
  return {
    width: Math.max(m.minWidth, Math.round(inner + 2 * (m.border + m.padding))),
    height:
      2 * (m.border + m.padding) + m.icon + m.iconGap + m.nameLine + m.ipGap + (ip ? m.ipLine : 0),
  };
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

/** A point on the middle of one side of a box, `reach` outside it */
function sidePoint(box: Box, side: Side, reach: number): Point {
  switch (side) {
    case 'top':
      return { x: box.x + box.width / 2, y: box.y - reach };
    case 'bottom':
      return { x: box.x + box.width / 2, y: box.y + box.height + reach };
    case 'left':
      return { x: box.x - reach, y: box.y + box.height / 2 };
    case 'right':
      return { x: box.x + box.width + reach, y: box.y + box.height / 2 };
  }
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

  const devices: SceneDevice[] = input.devices.map(device => {
    // Same choice as the canvas: the template by id, else by type
    const template = device.templateId
      ? input.deviceTemplates.find(entry => entry.id === device.templateId)
      : input.deviceTemplates.find(entry => entry.type === device.type);
    const iconName = template?.icon || DEVICE_ICONS[device.type] || FALLBACK_ICON;
    const measured = input.sizes?.get(device.id);
    const size =
      measured && measured.width > 0 && measured.height > 0
        ? measured
        : estimateDeviceSize(device.label, device.ip, measureText);
    const failed = marks?.failedDevices.includes(device.id) ?? false;

    const scene: SceneDevice = {
      id: device.id,
      label: device.label,
      ip: device.ip,
      box: { x: device.position.x, y: device.position.y, width: size.width, height: size.height },
      iconName,
      icon: input.iconOf(iconName) ?? input.iconOf(FALLBACK_ICON),
      color: template?.color || FALLBACK_ICON_COLOR,
      role:
        marks?.sourceId === device.id ? 'source' : marks?.targetId === device.id ? 'target' : null,
      failed,
      // A broken device is where the packet stops only for the one before it
      drop: !failed && marks?.route?.dropDeviceId === device.id,
    };

    bounds.addBox(scene.box);
    // What sticks out of the box: the ring of a stop, the badges of a role and of a failure
    if (scene.drop) bounds.addBox(scene.box, 3);
    if (scene.role) bounds.add(scene.box.x - 6, scene.box.y - 9);
    if (scene.failed) bounds.add(scene.box.x + scene.box.width + 8, scene.box.y - 8);
    return scene;
  });

  const boxes = new Map(devices.map(device => [device.id, device.box] as const));

  const cables: SceneCable[] = [];
  for (const connection of input.connections) {
    const from = boxes.get(connection.source);
    const to = boxes.get(connection.target);
    if (!from || !to) continue;

    const fromSide = sideOf(connection.sourceHandle);
    const toSide = sideOf(connection.targetHandle);
    const start = sidePoint(from, fromSide, m.handleReach);
    const end = sidePoint(to, toSide, m.handleReach);
    const [stepPath, labelX, labelY] = getSmoothStepPath({
      sourceX: start.x,
      sourceY: start.y,
      sourcePosition: SIDES[fromSide],
      targetX: end.x,
      targetY: end.y,
      targetPosition: SIDES[toSide],
    });
    // On screen a cable stops at the connection point, a little short of the
    // device. A picture has no connection points: the cable goes on to the box
    // (one unit inside it, under its border).
    const startFoot = sidePoint(from, fromSide, -1);
    const endFoot = sidePoint(to, toSide, -1);
    const path = `M${num(startFoot.x)} ${num(startFoot.y)}L${stepPath.slice(1)}L${num(endFoot.x)} ${num(endFoot.y)}`;

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

  return { devices, cables, bounds: bounds.box() };
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
  return `<text x="${num(x)}" y="${num(y)}" font-size="${num(font.size)}" font-weight="${font.weight}" fill="${fill}"${extra}>${escapeXml(text)}</text>`;
}

/**
 * A colour as it can be written in an attribute. Anything that is not a plain
 * colour (templates come from files too) gives the neutral one.
 */
function safeColor(color: string): string {
  return /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%a-z]+\))$/i.test(color.trim())
    ? color.trim()
    : FALLBACK_ICON_COLOR;
}

/** The grey of the same brightness (what a broken device is drawn in) */
export function greyOf(color: string): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return '#888888';
  const full = hex.length === 3 ? [...hex].map(digit => digit + digit).join('') : hex;
  const [r, g, b] = [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
  const level = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
    .toString(16)
    .padStart(2, '0');
  return `#${level}${level}${level}`;
}

/**
 * True when the markup of an icon is only a drawing. Icons shipped with the
 * app always are; one fetched by name for a custom template is checked before
 * it goes into a file that may be opened on its own.
 */
export function isPlainDrawing(body: string): boolean {
  // Nothing that runs, nothing that styles the rest of the document, no link
  if (/<\s*(script|style|foreignObject|iframe|a)\b|\son\w+\s*=|javascript:/i.test(body)) return false;
  // A reference may only point inside the document itself ("#id")
  return !/(?:href|src)\s*=\s*(?:"(?!#)|'(?!#)|(?!["'#]))/i.test(body);
}

/** The markup of an icon in one colour, its ids kept apart from those of other icons */
function iconMarkup(shape: IconShape, color: string, prefix: string): string {
  let body = shape.body.replace(/currentColor/gi, color);
  if (/\sid\s*=/.test(body)) {
    body = body
      .replace(/\sid\s*=\s*"([^"]+)"/g, ` id="${prefix}$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
      .replace(/href\s*=\s*"#([^"]+)"/g, `href="#${prefix}$1"`);
  }
  return body;
}

function deviceSvg(
  device: SceneDevice,
  palette: Palette,
  accents: Accents,
  iconPrefix: string,
  measureText: TextMeasure
): string {
  const m = DEVICE_METRICS;
  const { x, y, width, height } = device.box;
  const centre = x + width / 2;
  const parts: string[] = [];

  const stroke = device.failed
    ? MARK_COLORS.failure
    : device.drop
      ? MARK_COLORS.stops
      : palette.border;
  parts.push(
    `<rect x="${num(x + m.border / 2)}" y="${num(y + m.border / 2)}" width="${num(width - m.border)}" height="${num(height - m.border)}" rx="${m.radius - m.border / 2}" fill="${palette.component}" stroke="${stroke}" stroke-width="${m.border}"${device.failed ? ' stroke-dasharray="6 4"' : ''}/>`
  );
  if (device.failed) {
    parts.push(
      `<rect x="${num(x + m.border)}" y="${num(y + m.border)}" width="${num(width - 2 * m.border)}" height="${num(height - 2 * m.border)}" rx="${m.radius - m.border}" fill="url(#pc-hatch)"/>`
    );
  }
  if (device.drop) {
    parts.push(
      `<rect x="${num(x - 1.5)}" y="${num(y - 1.5)}" width="${num(width + 3)}" height="${num(height + 3)}" rx="${m.radius + 1.5}" fill="none" stroke="${MARK_COLORS.stops}" stroke-opacity="0.4" stroke-width="3"/>`
    );
  }

  // Icon, name, address
  const content: string[] = [];
  const iconTop = y + m.border + m.padding;
  if (device.icon && device.icon.width > 0 && device.icon.height > 0) {
    const color = device.failed ? greyOf(device.color) : safeColor(device.color);
    // The icon keeps its proportions inside its square, in the middle of it
    const scale = Math.min(m.icon / device.icon.width, m.icon / device.icon.height);
    const left = centre - (device.icon.width * scale) / 2 - device.icon.left * scale;
    const top = iconTop + (m.icon - device.icon.height * scale) / 2 - device.icon.top * scale;
    content.push(
      `<g transform="translate(${num(left)} ${num(top)}) scale(${Math.round(scale * 10000) / 10000})" opacity="${palette.iconOpacity}">${iconMarkup(device.icon, color, iconPrefix)}</g>`
    );
  }
  const nameTop = iconTop + m.icon + m.iconGap;
  content.push(
    textElement(
      device.label,
      centre,
      baseline(nameTop, m.nameLine, m.nameSize),
      NAME_FONT,
      palette.text,
      ' text-anchor="middle"'
    )
  );
  if (device.ip) {
    content.push(
      textElement(
        device.ip,
        centre,
        baseline(nameTop + m.nameLine + m.ipGap, m.ipLine, m.ipSize),
        IP_FONT,
        palette.address,
        ' text-anchor="middle"'
      )
    );
  }
  parts.push(device.failed ? `<g opacity="0.45">${content.join('')}</g>` : content.join(''));

  // The end of the question this device is
  if (device.role) {
    const text = device.role === 'source' ? 'DA' : 'A';
    const spacing = ROLE_FONT.size * 0.04;
    const textWidth = measureText(text, ROLE_FONT) + spacing * text.length;
    const pillWidth = Math.round(textWidth + 16);
    const pillHeight = 16;
    const left = x - 6;
    const top = y - 9;
    parts.push(
      `<rect x="${num(left)}" y="${num(top)}" width="${num(pillWidth)}" height="${pillHeight}" rx="2" fill="${device.role === 'source' ? accents.accent : accents.secondary}"/>`,
      textElement(
        text,
        left + pillWidth / 2,
        baseline(top, pillHeight, ROLE_FONT.size),
        ROLE_FONT,
        device.role === 'source' ? accents.onAccent : accents.onSecondary,
        ` text-anchor="middle" letter-spacing="${num(spacing)}"`
      )
    );
  }

  // A device taken as broken
  if (device.failed) {
    const cx = x + width - 4;
    const cy = y + 4;
    parts.push(
      `<circle cx="${num(cx)}" cy="${num(cy)}" r="12" fill="${MARK_COLORS.failure}"/>`,
      `<g transform="translate(${num(cx - 7)} ${num(cy - 7)}) scale(0.5833)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ZAP_OFF}</g>`
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
  const iconPrefixes = new Map<string, string>();
  const prefixOf = (name: string) => {
    if (!iconPrefixes.has(name)) iconPrefixes.set(name, `pc-i${iconPrefixes.size}-`);
    return iconPrefixes.get(name) as string;
  };
  body.push(
    `<g transform="translate(${num(offsetX)} ${num(offsetY)})">`,
    `<g>${scene.cables.map(cable => cableSvg(cable, palette)).join('')}</g>`,
    `<g>${scene.cables.map(cable => cableLabelSvg(cable, palette)).join('')}</g>`,
    ...scene.devices.map(device =>
      deviceSvg(device, palette, accents, prefixOf(device.iconName), measure)
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
  const name = title?.name ?? 'Network';
  const svg = [
    `${SVG_OPEN} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_FAMILY}" role="img" aria-label="${escapeXml(name)}">`,
    `<title>${escapeXml(name)}</title>`,
    '<defs>',
    scene.devices.some(device => device.failed)
      ? `<pattern id="pc-hatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="16" fill="${MARK_COLORS.failure}" fill-opacity="0.1"/></pattern>`
      : '',
    '</defs>',
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
