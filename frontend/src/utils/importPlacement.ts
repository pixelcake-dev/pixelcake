/**
 * Where the devices and the areas of a file go when they are added to a
 * drawing that is already there: beside it, in room that is free, with their
 * own layout kept (one shift for the whole group, so the areas stay around
 * their devices).
 *
 * Pure: no React, no stores.
 */

import type { CanvasArea, NetworkDevice } from '@/types';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';

/** The room left between the drawing there was and the group that is added */
export const IMPORT_GAP = 120;

export interface Drawing {
  devices: ReadonlyArray<Pick<NetworkDevice, 'position'>>;
  areas: ReadonlyArray<Pick<CanvasArea, 'position' | 'size'>>;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
}

/** The box a drawing takes, or null when it holds nothing */
function boundsOf(drawing: Drawing): Bounds | null {
  const height = deviceHeight(true);
  const boxes = [
    ...drawing.devices.map(({ position }) => ({
      x: position.x,
      y: position.y,
      width: DEVICE_METRICS.width,
      height,
    })),
    ...drawing.areas.map(({ position, size }) => ({ ...position, ...size })),
  ];
  if (boxes.length === 0) return null;
  return {
    minX: Math.min(...boxes.map((box) => box.x)),
    minY: Math.min(...boxes.map((box) => box.y)),
    maxX: Math.max(...boxes.map((box) => box.x + box.width)),
  };
}

/**
 * How far to move the group that is added so that it lies to the right of
 * the drawing, its top level with the top of the drawing. Nothing moves when
 * the board is empty (the file keeps the places it has).
 */
export function placeBesideDrawing(incoming: Drawing, existing: Drawing): { dx: number; dy: number } {
  const there = boundsOf(existing);
  const group = boundsOf(incoming);
  if (!there || !group) return { dx: 0, dy: 0 };
  return { dx: there.maxX + IMPORT_GAP - group.minX, dy: there.minY - group.minY };
}
