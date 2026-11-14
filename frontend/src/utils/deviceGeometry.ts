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

/** The height of a device: it is lower when it shows no address */
export function deviceHeight(hasAddress: boolean): number {
  const m = DEVICE_METRICS;
  return (
    2 * m.border + m.paddingTop + m.icon + m.iconGap + m.nameLine + (hasAddress ? m.ipLine : 0) + m.paddingBottom
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
