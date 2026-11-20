/**
 * A device on the canvas, in numbers: its frame, its drawing, its name and
 * its address, and where a cable ends on each of its four sides.
 *
 * The frame and the texts repeat what index.css says about `.network-device`
 * and what is in it (a test reads the style sheet and fails when the two
 * drift). The ends of the cables are worked out here, from what is drawn in
 * each drawing, and used by the canvas (which places its connection points
 * there) and by the exported picture.
 *
 * Pure: no React, no stores, no DOM.
 */

import { DEVICE_DRAWINGS, DEVICE_DRAWING_SIZE, type DeviceDrawingId } from '@/data/deviceDrawings';

export const DEVICE_METRICS = {
  /** One width for every device, whatever its name: a long name runs out on both sides */
  width: 104,
  /** The frame, which shows under the pointer and on a selected device */
  border: 2,
  radius: 3,
  paddingX: 6,
  paddingTop: 6,
  paddingBottom: 3,
  /** The side of the drawing */
  icon: 48,
  /** From the drawing to the name */
  iconGap: 3,
  nameLine: 16,
  nameSize: 12.5,
  ipLine: 14,
  ipSize: 10.5,
  /** The name and the address have the canvas behind them: this much more on each side */
  textPad: 4,
  /** How far from what is drawn a cable ends */
  cableGap: 3,
} as const;

export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

/** Where a device is on the canvas, and how large its frame is */
export interface FrameBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the middle run of a stepped cable goes, when it leaves a device by a
 * side and reaches another by the side that faces it (bottom to top, top to
 * bottom, right to left, left to right): halfway between the two frames.
 * React Flow puts it halfway between the two ends, and an end sits next to
 * what is drawn, higher or lower in each drawing: the cables of one switch
 * to a row of different devices would each run a pixel or two from the
 * next, and read as a double line. Any other pair of sides, or frames that
 * do not face each other, keep React Flow's own run (nothing is returned).
 */
export function cableRun(
  from: FrameBox,
  fromSide: Side,
  to: FrameBox,
  toSide: Side
): { centerX?: number; centerY?: number } {
  if (fromSide === 'bottom' && toSide === 'top' && to.y >= from.y + from.height) {
    return { centerY: (from.y + from.height + to.y) / 2 };
  }
  if (fromSide === 'top' && toSide === 'bottom' && from.y >= to.y + to.height) {
    return { centerY: (to.y + to.height + from.y) / 2 };
  }
  if (fromSide === 'right' && toSide === 'left' && to.x >= from.x + from.width) {
    return { centerX: (from.x + from.width + to.x) / 2 };
  }
  if (fromSide === 'left' && toSide === 'right' && from.x >= to.x + to.width) {
    return { centerX: (to.x + to.width + from.x) / 2 };
  }
  return {};
}

/**
 * The lines under the name: nothing for a device with no address to show,
 * else the address, and, on a line of its own, what is said of it (an
 * address that another device has too is followed by "in conflict")
 */
export function addressLines(text: string): string[] {
  return text === '' ? [] : text.split('\n');
}

/** The height of a device: it is lower when it shows no address, higher when what is under its name takes more lines */
export function deviceHeight(hasAddress: boolean, lines = 1): number {
  const m = DEVICE_METRICS;
  return (
    2 * m.border +
    m.paddingTop +
    m.icon +
    m.iconGap +
    m.nameLine +
    (hasAddress ? lines * m.ipLine : 0) +
    m.paddingBottom
  );
}

/** Where the drawing is, from the top left corner of the frame */
export function drawingPlace(): Point {
  const m = DEVICE_METRICS;
  return { x: (m.width - m.icon) / 2, y: m.border + m.paddingTop };
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Where a cable ends on one side of a device, from the top left corner of
 * its frame: a little off what is drawn (above it, at its left, at its
 * right, each drawing having its own shape), and under the name and the
 * address, at the bottom of the frame. `height` is the height of the device.
 */
export function cableEnd(drawing: DeviceDrawingId, side: Side, height: number): Point {
  const m = DEVICE_METRICS;
  const [left, top, right] = DEVICE_DRAWINGS[drawing].ink;
  const scale = m.icon / DEVICE_DRAWING_SIZE;
  const place = drawingPlace();
  switch (side) {
    case 'top':
      return { x: m.width / 2, y: round(place.y + top * scale - m.cableGap) };
    case 'bottom':
      return { x: m.width / 2, y: height };
    case 'left':
      return { x: round(place.x + left * scale - m.cableGap), y: place.y + m.icon / 2 };
    case 'right':
      return { x: round(place.x + right * scale + m.cableGap), y: place.y + m.icon / 2 };
  }
}
