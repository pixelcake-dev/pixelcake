/**
 * Where a file added to a drawing goes: beside it, in free room, with its
 * own layout kept.
 */

import { describe, it, expect } from 'vitest';
import { placeBesideDrawing, IMPORT_GAP } from './importPlacement';
import { DEVICE_METRICS } from './deviceGeometry';
import type { CanvasArea } from '@/types';

const at = (x: number, y: number) => ({ position: { x, y } });
const area = (x: number, y: number, width: number, height: number): CanvasArea => ({
  id: 'area-1',
  label: '',
  color: 'slate',
  position: { x, y },
  size: { width, height },
});

describe('placeBesideDrawing', () => {
  it('moves nothing when the board is empty', () => {
    expect(placeBesideDrawing({ devices: [at(100, 100)], areas: [] }, { devices: [], areas: [] })).toEqual({
      dx: 0,
      dy: 0,
    });
  });

  it('puts the group to the right of the drawing, top to top, with a gap', () => {
    const shift = placeBesideDrawing(
      { devices: [at(100, 100), at(350, 300)], areas: [] },
      { devices: [at(0, 40), at(500, 600)], areas: [] }
    );
    // the right side of the existing drawing is 500 + the width of a device
    const right = 500 + DEVICE_METRICS.width;
    expect(100 + shift.dx).toBe(right + IMPORT_GAP);
    expect(100 + shift.dy).toBe(40);
  });

  it('counts the areas of both, and the group keeps its layout (one shift for all)', () => {
    const shift = placeBesideDrawing(
      { devices: [at(150, 150)], areas: [area(100, 100, 300, 200)] },
      { devices: [at(0, 0)], areas: [area(-50, -20, 900, 100)] }
    );
    // the group starts at its area (100, 100); the existing one ends at 850
    expect(100 + shift.dx).toBe(850 + IMPORT_GAP);
    expect(100 + shift.dy).toBe(-20);
  });

  it('leaves no overlap with a tall drawing', () => {
    const existing = { devices: [at(0, 0), at(0, 2000)], areas: [] };
    const incoming = { devices: [at(0, 0), at(300, 400)], areas: [] };
    const shift = placeBesideDrawing(incoming, existing);
    const minX = Math.min(...incoming.devices.map((d) => d.position.x + shift.dx));
    expect(minX).toBeGreaterThanOrEqual(DEVICE_METRICS.width);
  });
});
