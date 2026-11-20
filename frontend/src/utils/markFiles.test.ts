/**
 * What is written with the marker, through the project file
 * (.pixelcake.json): it comes back as it was saved, each canvas with its
 * own; a file without it is written and read as before; a mark that cannot
 * be drawn is left out with a word to the user. Not in the YAML: that is the
 * network alone.
 */

import { describe, it, expect } from 'vitest';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { CanvasMark, ProjectFile } from '@/types';
import { host } from '@/test/networkFixtures';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';

const MARKS: CanvasMark[] = [
  { id: 'mark-1', kind: 'pen', color: 'accent', width: 'thin', points: [0, 0, 12.5, 4, 30, -2.5], seed: 9 },
  { id: 'mark-2', kind: 'text', color: 'ink', width: 'thick', points: [100, 40], text: 'Core\ngiù', seed: 3 },
  { id: 'mark-3', kind: 'arrow', color: 'red', width: 'thin', points: [10, 10, 200, 80], seed: 77 },
];

function projectOf(marks: CanvasMark[] | undefined): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Sede Milano',
    description: '',
    savedAt: '2026-11-19T10:00:00.000Z',
    settings: { ...DEFAULT_NETWORK_SETTINGS },
    activeCanvasId: 'canvas-1',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Canvas 1',
        devices: [host('dev-0', '192.168.1.10')],
        connections: [],
        ...(marks ? { marks } : {}),
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

/** The file of a project with these marks on its first canvas, changed by hand, read back */
function readWith(marks: unknown) {
  const file = JSON.parse(serializeProject(projectOf(undefined)));
  file.canvases[0].marks = marks;
  const result = parseProjectFile(JSON.stringify(file));
  if (!result.ok) throw new Error(result.error);
  return { canvas: result.project.canvases[0], warnings: result.warnings };
}

describe('the marks in the project file', () => {
  it('come back as they were saved, on their canvas', () => {
    const result = parseProjectFile(serializeProject(projectOf(MARKS)));
    if (!result.ok) throw new Error(result.error);

    expect(result.warnings).toEqual([]);
    expect(result.project.canvases[0].marks).toEqual(MARKS);
    expect(result.project.canvases[1]).not.toHaveProperty('marks');
  });

  it('a canvas with none is written without the list, as before they existed', () => {
    const without = serializeProject(projectOf(undefined));
    expect(serializeProject(projectOf([]))).toBe(without);
    expect(without).not.toContain('"marks"');
  });

  it('are written after the areas, each key in a fixed order, the points of a mark on one line', () => {
    const text = serializeProject(projectOf(MARKS));
    const canvas = JSON.parse(text).canvases[0];
    expect(Object.keys(canvas)).toEqual([
      'id',
      'name',
      'devices',
      'connections',
      'marks',
      'viewport',
      'deviceCounter',
      'connectionCounter',
    ]);
    expect(Object.keys(canvas.marks[1])).toEqual(['id', 'kind', 'color', 'width', 'points', 'text', 'seed']);
    expect(text).toContain('"points": [0, 0, 12.5, 4, 30, -2.5]');
    expect(text).toContain('"points": [100, 40]');
  });

  it('words typed in a name that look like a list of points are written as typed', () => {
    const project = projectOf(MARKS);
    const label = 'Rack "points": [1,2,  3]';
    project.canvases[0].devices[0] = { ...project.canvases[0].devices[0], label };

    const result = parseProjectFile(serializeProject(project));
    if (!result.ok) throw new Error(result.error);

    expect(result.project.canvases[0].devices[0].label).toBe(label);
    expect(result.project.canvases[0].marks).toEqual(MARKS);
  });

  it('a file made before the marker opens as before', () => {
    const result = parseProjectFile(serializeProject(projectOf(undefined)));
    if (!result.ok) throw new Error(result.error);
    expect(result.warnings).toEqual([]);
    expect(result.project.canvases[0]).not.toHaveProperty('marks');
  });

  it('a mark that cannot be drawn is left out, and the user is told', () => {
    const { canvas, warnings } = readWith([MARKS[0], { kind: 'pen' }, { ...MARKS[2], points: 'x' }]);

    expect(canvas.marks).toEqual([MARKS[0]]);
    expect(warnings).toEqual(['Canvas «Canvas 1»: 2 appunti non validi ignorati.']);
  });

  it('what is not a list of marks is no mark, and the user is told', () => {
    const { canvas, warnings } = readWith('a ring');

    expect(canvas).not.toHaveProperty('marks');
    expect(warnings).toEqual(['Canvas «Canvas 1»: 1 appunto non valido ignorato.']);
  });

  it('a mark that is completed is kept, and the user is told', () => {
    const { canvas, warnings } = readWith([{ ...MARKS[0], color: 'purple' }]);

    expect(canvas.marks?.[0].color).toBe('accent');
    expect(warnings).toEqual(['Canvas «Canvas 1»: 1 appunto incompleto corretto.']);
  });

  it('are not in the YAML: it is the network alone', () => {
    const canvas = projectOf(MARKS).canvases[0];
    expect(generateYaml(canvas.devices, canvas.connections)).not.toMatch(/mark|appunt/i);
  });
});
