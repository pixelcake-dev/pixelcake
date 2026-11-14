/**
 * The areas of a canvas («riquadri») through the project file
 * (.pixelcake.json): they come back as they were saved, a file without them
 * is written and read as before, and one that cannot be drawn is left out
 * with a word to the user.
 */

import { describe, it, expect } from 'vitest';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { CanvasArea, ProjectFile } from '@/types';
import { host } from '@/test/networkFixtures';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';

const AREAS: CanvasArea[] = [
  { id: 'area-1', label: 'Core', color: 'violet', position: { x: 100, y: 50 }, size: { width: 300, height: 200 } },
  { id: 'area-2', label: '', color: 'teal', position: { x: -40.5, y: 0 }, size: { width: 240, height: 320.25 } },
];

function projectOf(areas: CanvasArea[] | undefined): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Sede Milano',
    description: '',
    savedAt: '2026-11-14T10:00:00.000Z',
    settings: { ...DEFAULT_NETWORK_SETTINGS },
    activeCanvasId: 'canvas-1',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Canvas 1',
        devices: [host('dev-0', '192.168.1.10')],
        connections: [],
        ...(areas ? { areas } : {}),
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 1,
        connectionCounter: 0,
      },
      {
        id: 'canvas-2',
        name: 'Vuoto',
        devices: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 0,
        connectionCounter: 0,
      },
    ],
    templates: { devices: [], connections: [] },
  };
}

/** The file of a project with these areas on its first canvas, changed by hand, read back */
function readWith(areas: unknown) {
  const file = JSON.parse(serializeProject(projectOf(undefined)));
  file.canvases[0].areas = areas;
  const result = parseProjectFile(JSON.stringify(file));
  if (!result.ok) throw new Error(result.error);
  return { canvas: result.project.canvases[0], warnings: result.warnings };
}

describe('the areas of a canvas in a project file', () => {
  it('are written after the connections of their canvas, each with its fields in a fixed order', () => {
    const written = JSON.parse(serializeProject(projectOf(AREAS))).canvases;
    expect(Object.keys(written[0])).toEqual([
      'id',
      'name',
      'devices',
      'connections',
      'areas',
      'viewport',
      'deviceCounter',
      'connectionCounter',
    ]);
    expect(written[0].areas).toEqual(AREAS);
    expect(Object.keys(written[0].areas[0])).toEqual(['id', 'label', 'color', 'position', 'size']);
    expect(Object.keys(written[0].areas[0].position)).toEqual(['x', 'y']);
    expect(Object.keys(written[0].areas[0].size)).toEqual(['width', 'height']);
  });

  it('are written the same whatever the order their fields were put together in', () => {
    const shuffled = AREAS.map(({ id, label, color, position, size }) => ({
      size: { height: size.height, width: size.width },
      position: { y: position.y, x: position.x },
      color,
      label,
      id,
    }));
    expect(serializeProject(projectOf(shuffled))).toBe(serializeProject(projectOf(AREAS)));
  });

  it('come back as they were saved, with nothing to say', () => {
    const result = parseProjectFile(serializeProject(projectOf(AREAS)));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    expect(result.project.canvases[0].areas).toEqual(AREAS);
    expect(result.project).toEqual(projectOf(AREAS));
  });

  it('a canvas without areas is written as it was before they existed', () => {
    const text = serializeProject(projectOf(undefined));
    expect(text).not.toContain('areas');
    expect(serializeProject(projectOf([]))).toBe(text);
    expect(Object.keys(JSON.parse(text).canvases[0])).toEqual([
      'id',
      'name',
      'devices',
      'connections',
      'viewport',
      'deviceCounter',
      'connectionCounter',
    ]);
  });

  it('a file written before they existed opens as before: no areas, nothing to say', () => {
    const result = parseProjectFile(serializeProject(projectOf(undefined)));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    for (const canvas of result.project.canvases) expect('areas' in canvas).toBe(false);
    expect(result.project).toEqual(projectOf(undefined));
  });

  it('an empty list is no list, and nothing is said', () => {
    const { canvas, warnings } = readWith([]);
    expect('areas' in canvas).toBe(false);
    expect(warnings).toEqual([]);
  });

  it('an area that cannot be drawn is left out, the others and the devices are kept, and the user is told', () => {
    const { canvas, warnings } = readWith([
      AREAS[0],
      { id: 'area-9', label: 'Senza posto', color: 'red', size: { width: 100, height: 100 } },
      'Core',
      AREAS[1],
    ]);
    expect(canvas.areas).toEqual(AREAS);
    expect(canvas.devices.map((d) => d.id)).toEqual(['dev-0']);
    expect(warnings).toEqual(['Canvas «Canvas 1»: 2 riquadri non validi ignorati.']);
  });

  it('one that is incomplete is completed, and the user is told', () => {
    const { canvas, warnings } = readWith([
      { ...AREAS[0], color: 'fucsia' },
      { ...AREAS[1], id: 'area-1' },
    ]);
    expect(canvas.areas).toEqual([
      { ...AREAS[0], color: 'slate' },
      { ...AREAS[1], id: 'area-2' },
    ]);
    expect(warnings).toEqual(['Canvas «Canvas 1»: 2 riquadri incompleti corretti.']);
  });

  it('one left out and one completed are said each in its own words, in the singular', () => {
    const { warnings } = readWith([{ label: 'Rotto' }, { ...AREAS[0], color: 7 }]);
    expect(warnings).toEqual([
      'Canvas «Canvas 1»: 1 riquadro non valido ignorato.',
      'Canvas «Canvas 1»: 1 riquadro incompleto corretto.',
    ]);
  });

  it('what is not a list is no area, and the user is told', () => {
    const { canvas, warnings } = readWith({ core: AREAS[0] });
    expect('areas' in canvas).toBe(false);
    expect(warnings).toEqual(['Canvas «Canvas 1»: 1 riquadro non valido ignorato.']);
  });
});

describe('the areas and the YAML export', () => {
  it('are not part of it: the file is of the network, which has no places', () => {
    // (devices are placed again on a grid when a YAML file is loaded: an area
    // drawn around them would be around nothing)
    const text = generateYaml([host('dev-0', '192.168.1.10')], [], 'Lab');
    expect(text).not.toMatch(/area|riquadr/i);
  });
});
