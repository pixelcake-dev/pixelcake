/**
 * Room where a laid out drawing is crowded (layoutRoom.makeRoom): a label
 * of a cable lying across the line of an area's border is moved off it, the
 * end of the cable beyond the line going further.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setLanguage } from '@/i18n';
import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';
import { host } from '@/test/networkFixtures';
import { crowding } from '@/test/drawingChecks';
import { areaAround } from './canvasAreas';
import { deviceHeight } from './deviceGeometry';
import { makeRoom, type RoomDrawing } from './layoutRoom';

afterEach(() => setLanguage('it'));

const cable: NetworkConnection = {
  id: 'c-1',
  source: 'A',
  target: 'B',
  sourceHandle: 'bottom',
  targetHandle: 'top',
  bandwidth: '1 Gbps',
  label: 'Linea principale',
};

/** The area drawn again around A and C, wherever they are, as the layout does */
function redraw(devices: NetworkDevice[]): RoomDrawing {
  const held = devices.filter((one) => one.id !== 'B').map((one) => ({ ...one.position, width: 104, height: deviceHeight(true) }));
  const around = areaAround(held)!;
  const area: CanvasArea = { id: 'area-1', label: 'Sede', color: 'slate', position: around.position, size: around.size };
  return { devices, connections: [cable], areas: [area] };
}

describe('a label across the line of a border', () => {
  it('is moved off it: the end beyond the line goes further, the area stays', () => {
    setLanguage('it');
    // A and C in the area, C lower and aside; B under A, as far below the border as A's
    // lower side is above it, so that the label, halfway, lies right on the border
    const a = host('A', '10.0.0.1', '', { position: { x: 0, y: 0 } });
    const c = host('C', '10.0.0.3', '', { position: { x: 300, y: 150 } });
    const area = redraw([a, c]).areas[0];
    const border = area.position.y + area.size.height;
    const below = 2 * border - deviceHeight(true);
    const start = redraw([a, c, host('B', '10.0.0.2', '', { position: { x: 0, y: below } })]);
    expect(crowding(start)).toEqual(['the label of A–B is on the border of SEDE']);

    const roomy = makeRoom(start, redraw, []);
    expect(crowding(roomy)).toEqual([]);
    expect(roomy.devices.find((one) => one.id === 'A')?.position).toEqual({ x: 0, y: 0 });
    expect(roomy.devices.find((one) => one.id === 'C')?.position).toEqual({ x: 300, y: 150 });
    expect(roomy.devices.find((one) => one.id === 'B')!.position.y).toBeGreaterThan(below);
  });
});
