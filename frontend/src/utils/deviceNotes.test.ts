/**
 * The note of a device, wherever a device goes: kept the same way by
 * whoever writes it, and brought back by the project file, by the YAML
 * export and import, and by copy and paste.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { NetworkDevice, ProjectFile } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { executeCommand } from '@/terminal/executor';
import { host, link, port, switchWith } from '@/test/networkFixtures';
import { tidyNotes } from './deviceNotes';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';
import { parseYamlTopology } from './importYaml';
import { createCompanySample } from './sampleCompany';
import { createSampleTopology } from './sampleTopology';
import { createPerimeterSample } from './samplePerimeter';
import { createRedundancySample } from './sampleRedundancy';

const NOTE = 'Stampante del primo piano.\n- toner da cambiare\n- chiedere a "Marta": interno 214';

function projectOf(devices: NetworkDevice[]): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Lab',
    description: '',
    savedAt: '2026-11-14T10:00:00.000Z',
    settings: { ...DEFAULT_NETWORK_SETTINGS },
    activeCanvasId: 'canvas-1',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Canvas 1',
        devices,
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 9,
        connectionCounter: 0,
      },
    ],
    templates: { devices: [], connections: [] },
  };
}

/** The devices of a project file changed by hand, read back */
function readDevices(change: (device: Record<string, unknown>) => void) {
  const file = JSON.parse(serializeProject(projectOf([host('dev-0', '192.168.1.10')])));
  change(file.canvases[0].devices[0]);
  const result = parseProjectFile(JSON.stringify(file));
  if (!result.ok) throw new Error(result.error);
  return { device: result.project.canvases[0].devices[0], warnings: result.warnings };
}

describe('tidyNotes', () => {
  it('keeps a note as it was typed, lines included, without what is around it', () => {
    expect(tidyNotes(`  \n${NOTE}\n\n `)).toBe(NOTE);
    expect(tidyNotes('una riga')).toBe('una riga');
  });

  it('an empty note is no note', () => {
    expect(tidyNotes('')).toBeUndefined();
    expect(tidyNotes('  \n\t ')).toBeUndefined();
  });

  it('line ends are made one kind', () => {
    expect(tidyNotes('uno\r\ndue\rtre')).toBe('uno\ndue\ntre');
  });

  it('what is not text is no note', () => {
    for (const value of [undefined, null, 5, true, ['x'], { text: 'x' }]) {
      expect(tidyNotes(value)).toBeUndefined();
    }
  });
});

describe('the note of a device in a project file', () => {
  it('comes back as it was saved, written after the position of the device in the building', () => {
    const devices = [
      host('dev-0', '192.168.1.10', '', { vendor: 'HP', location: 'Piano 1', notes: NOTE }),
      switchWith('dev-1', [port(1)], { notes: 'una riga' }),
      host('dev-2', '192.168.1.11'),
    ];
    const text = serializeProject(projectOf(devices));
    const written = JSON.parse(text).canvases[0].devices as Record<string, unknown>[];
    expect(Object.keys(written[0]).slice(0, 10)).toEqual([
      'id', 'type', 'label', 'ip', 'subnet', 'gateway', 'vendor', 'location', 'notes', 'position',
    ]);
    expect('notes' in written[2]).toBe(false);

    const result = parseProjectFile(text);
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    expect(result.project.canvases[0].devices).toEqual(devices);
    expect(result.project.canvases[0].devices[0].notes).toBe(NOTE);
  });

  it('is written in its place whatever the order the device was put together in', () => {
    const device = host('dev-0', '192.168.1.10', '', { location: 'Piano 1' });
    const a = serializeProject(projectOf([{ notes: NOTE, ...device }]));
    const b = serializeProject(projectOf([{ ...device, notes: NOTE }]));
    expect(a).toBe(b);
  });

  it('a device without one is written without a word about it, and a file without notes opens as before', () => {
    const devices = [host('dev-0', '192.168.1.10'), host('dev-1', '192.168.1.11', '', { notes: undefined })];
    const text = serializeProject(projectOf(devices));
    expect(text).not.toContain('notes');
    const result = parseProjectFile(text);
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    expect(result.project.canvases[0].devices.some((d) => 'notes' in d)).toBe(false);
  });

  it('is kept the way the app keeps it: trimmed, with one kind of line end', () => {
    const { device, warnings } = readDevices((d) => {
      d.notes = '  prima riga\r\nseconda riga \n';
    });
    expect(device.notes).toBe('prima riga\nseconda riga');
    expect(warnings).toEqual([]);
  });

  it('left empty it is no note, and nothing is said', () => {
    const { device, warnings } = readDevices((d) => {
      d.notes = ' \n ';
    });
    expect('notes' in device).toBe(false);
    expect(warnings).toEqual([]);
  });

  it.each([[5], [null], [['una riga']], [{ text: 'una riga' }]])(
    'what is not text (%j) is dropped, the device is kept, and the user is told',
    (value) => {
      const { device, warnings } = readDevices((d) => {
        d.notes = value;
      });
      expect('notes' in device).toBe(false);
      expect(device).toMatchObject({ id: 'dev-0', ip: '192.168.1.10' });
      expect(warnings).toEqual(['Canvas "Canvas 1": 1 dispositivo incompleto corretto.']);
    }
  );
});

describe('the note of a device in the YAML export', () => {
  const exported = (notes: string | undefined) =>
    generateYaml([host('dev-0', '192.168.1.10', '', { label: 'Stampante', notes })], [], 'Lab');
  const readBack = (notes: string) => parseYamlTopology(exported(notes));

  it('is one line of the file, after the position in the building, whatever it holds', () => {
    const text = exported(NOTE);
    const line = text.split('\n').find((l) => l.trim().startsWith('notes:'));
    expect(line).toBe(
      '      notes: "Stampante del primo piano.\\n- toner da cambiare\\n- chiedere a \\"Marta\\": interno 214"'
    );
    // every line of the file is still a line of YAML: the note opened none
    expect(text.split('\n').filter((l) => l.startsWith('- toner'))).toEqual([]);
  });

  it.each([
    [NOTE],
    ['una riga'],
    ['- comincia con un trattino'],
    ['chiave: valore # e un commento'],
    ['C:\\Rete\\Stampanti e una "citazione"'],
    ['12345'],
    ['true'],
    ['riga\tcon\ttabulazioni\n\nuna riga vuota prima'],
    ['{ parentesi } [ quadre ] & * ! | > \' % @ `'],
  ])('comes back from the file as it was written: %j', (notes) => {
    const result = readBack(notes);
    expect(result.warnings).toEqual([]);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].notes).toBe(notes);
    expect(result.devices[0]).toMatchObject({ label: 'Stampante', ip: '192.168.1.10' });
  });

  it('a device without one is written without the line, and read without the field', () => {
    expect(exported(undefined)).not.toContain('notes');
    expect('notes' in parseYamlTopology(exported(undefined)).devices[0]).toBe(false);
  });

  it('a note written by hand in the file is read: on one line, on several, or as a number', () => {
    const yaml = (notes: string) =>
      `pixelcake:\n  devices:\n    - name: PC-1\n      type: PC\n      notes: ${notes}\n  connections: []\n`;
    expect(parseYamlTopology(yaml('da sostituire')).devices[0].notes).toBe('da sostituire');
    expect(parseYamlTopology(yaml('|\n        prima riga\n        seconda riga')).devices[0].notes).toBe(
      'prima riga\nseconda riga'
    );
    expect(parseYamlTopology(yaml('214')).devices[0].notes).toBe('214');
    expect('notes' in parseYamlTopology(yaml('"   "')).devices[0]).toBe(false);
    expect('notes' in parseYamlTopology(yaml('[a, b]')).devices[0]).toBe(false);
  });

  it('the rest of the drawing travels with it as before', () => {
    const devices = [
      host('dev-0', '192.168.1.10', '', { label: 'PC-1', notes: NOTE }),
      switchWith('dev-1', [port(1)], { label: 'SW-1', notes: 'armadio B' }),
    ];
    const connections = [link('dev-0', 'dev-1', { sourceNic: 'nic-1', targetPort: 1 })];
    const result = parseYamlTopology(generateYaml(devices, connections, 'Lab'));
    expect(result.warnings).toEqual([]);
    expect(result.devices.map((d) => [d.label, d.notes])).toEqual([
      ['PC-1', NOTE],
      ['SW-1', 'armadio B'],
    ]);
    expect(result.connections).toMatchObject([{ sourceNic: 'nic-1', targetPort: 1 }]);
  });
});

describe('the note of a device in the store', () => {
  const store = () => useNetworkStore.getState();

  beforeEach(() => {
    localStorage.clear();
    store().clearAllDevices();
  });

  it('a copy of a device carries the note of the original', () => {
    const id = store().addDevice({ ...host('x', '192.168.1.10'), label: 'PC-1', notes: NOTE });
    store().selectMultipleDevices([id]);
    store().copySelection();
    store().paste();

    expect(store().devices.map((d) => d.notes)).toEqual([NOTE, NOTE]);
    expect(store().devices[1].id).not.toBe(id);
  });

  it('a drawing loaded as a whole keeps the notes of its devices', () => {
    store().loadTopology([host('a', '192.168.1.10', '', { notes: NOTE }), host('b', '192.168.1.11')], []);
    expect(store().devices.map((d) => d.notes)).toEqual([NOTE, undefined]);
  });

  it('the terminal shows it with the rest of the device, line by line', () => {
    store().addDevice({ ...host('x', '192.168.1.10'), label: 'PC-1', location: 'Piano 1', notes: NOTE });
    store().addDevice({ ...host('y', '192.168.1.11'), label: 'PC-2' });

    const printed = (command: string) =>
      executeCommand(command, { deviceLabel: null }).lines.map((line) => line.text);
    const of1 = printed('show config PC-1');
    const at = of1.indexOf('  location: Piano 1');
    expect(of1.slice(at, at + 4)).toEqual([
      '  location: Piano 1',
      '  notes:    Stampante del primo piano.',
      '            - toner da cambiare',
      '            - chiedere a "Marta": interno 214',
    ]);
    expect(printed('show config PC-2').some((text) => text.includes('notes'))).toBe(false);
  });
});

describe('the sample networks', () => {
  it('are as they were: none of their devices has a note', () => {
    const samples = [createCompanySample(), createSampleTopology(), createPerimeterSample(), createRedundancySample()];
    for (const sample of samples) {
      expect(sample.devices.filter((d) => 'notes' in d)).toEqual([]);
    }
  });
});
