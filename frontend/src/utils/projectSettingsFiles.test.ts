/**
 * The settings of a project through its file (.pixelcake.json): what was
 * added to them after the first version of the format must come back as it
 * was saved, be left out of a file that does not use it, and be repaired
 * with a word to the user when it cannot be read.
 */

import { describe, it, expect } from 'vitest';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { GlobalNetworkSettings, ProjectFile } from '@/types';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';

function projectWith(settings: GlobalNetworkSettings): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Sede Milano',
    description: '',
    savedAt: '2026-11-14T10:00:00.000Z',
    settings,
    activeCanvasId: 'canvas-1',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Canvas 1',
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

/** The file of a project, as an object ready to be changed by hand */
function fileWith(settings: Record<string, unknown>): string {
  const file = JSON.parse(serializeProject(projectWith({ ...DEFAULT_NETWORK_SETTINGS })));
  file.settings = settings;
  return JSON.stringify(file);
}

function read(text: string) {
  const result = parseProjectFile(text);
  if (!result.ok) throw new Error(result.error);
  return result;
}

const BASE = { ipClass: '10.0.0.0', subnet: '255.255.255.0', gateway: '10.0.0.1' };

describe('the names of the VLANs in a project file', () => {
  const VLANS = [
    { id: 10, name: 'Uffici' },
    { id: 20, name: 'Wi-Fi ospiti' },
    { id: 300, name: 'Server' },
  ];

  it('come back as they were saved, written last among the settings, a number and a name each', () => {
    const settings: GlobalNetworkSettings = { ...BASE, dns: '10.0.0.53', emailMode: 'cloud', vlans: VLANS };
    const text = serializeProject(projectWith(settings));

    const written = JSON.parse(text).settings;
    expect(Object.keys(written)).toEqual(['ipClass', 'subnet', 'gateway', 'dns', 'emailMode', 'vlans']);
    expect(written.vlans).toEqual(VLANS);
    expect(written.vlans.map((entry: object) => Object.keys(entry))).toEqual([
      ['id', 'name'],
      ['id', 'name'],
      ['id', 'name'],
    ]);
    const { project, warnings } = read(text);
    expect(project.settings).toEqual(settings);
    expect(warnings).toEqual([]);
  });

  it('are written the same whatever the order their fields were put together in', () => {
    const a = serializeProject(projectWith({ ...BASE, vlans: VLANS }));
    const b = serializeProject(
      projectWith({ vlans: VLANS.map(({ id, name }) => ({ name, id })), ...BASE })
    );
    expect(b).toBe(a);
  });

  it('a project that names none is written without a word about it', () => {
    const text = serializeProject(projectWith({ ...BASE, emailMode: 'auto' }));
    expect(text).not.toContain('vlans');
    expect(serializeProject(projectWith({ ...BASE, emailMode: 'auto', vlans: [] }))).toBe(text);
    expect(serializeProject(projectWith({ ...BASE, emailMode: 'auto', vlans: undefined }))).toBe(text);
  });

  it('a file written before they existed opens as before, with nothing to say', () => {
    const { project, warnings } = read(fileWith({ ...BASE, emailMode: 'auto' }));
    expect(project.settings).toEqual({ ...BASE, emailMode: 'auto' });
    expect('vlans' in project.settings).toBe(false);
    expect(warnings).toEqual([]);
  });

  it('are put in the order of their numbers, with their names trimmed, and nothing is said', () => {
    const { project, warnings } = read(
      fileWith({ ...BASE, vlans: [{ id: 20, name: ' Wi-Fi ' }, { id: 10, name: 'Uffici', colour: 'blu' }] })
    );
    expect(project.settings.vlans).toEqual([
      { id: 10, name: 'Uffici' },
      { id: 20, name: 'Wi-Fi' },
    ]);
    expect(warnings).toEqual([]);
  });

  it('an empty list is no list, and nothing is said', () => {
    const { project, warnings } = read(fileWith({ ...BASE, vlans: [] }));
    expect('vlans' in project.settings).toBe(false);
    expect(warnings).toEqual([]);
  });

  it('what is not a name for a VLAN is left out, the rest is kept, and the user is told how many', () => {
    const { project, warnings } = read(
      fileWith({
        ...BASE,
        vlans: [
          { id: 10, name: 'Uffici' },
          { id: 0, name: 'Zero' },
          { id: 4095, name: 'Troppo' },
          { id: '20', name: 'Testo' },
          { id: 10.5, name: 'Mezzo' },
          { id: 30, name: '   ' },
          { id: 40 },
          { id: 50, name: 7 },
          'Uffici',
          null,
          { id: 10, name: 'Doppione' },
          { id: 60, name: 'Stampanti' },
        ],
      })
    );
    expect(project.settings.vlans).toEqual([
      { id: 10, name: 'Uffici' },
      { id: 60, name: 'Stampanti' },
    ]);
    expect(warnings).toEqual(['10 nomi di VLAN non validi o duplicati ignorati.']);
  });

  it('one bad entry is said in the singular, and a list with nothing good left is no list', () => {
    const { project, warnings } = read(fileWith({ ...BASE, vlans: [{ id: 0, name: 'Zero' }] }));
    expect('vlans' in project.settings).toBe(false);
    expect(warnings).toEqual(['1 nome di VLAN non valido o duplicato ignorato.']);
  });

  it('a name that is too long is cut to the limit, and the user is told', () => {
    const long = 'Rete degli uffici del primo piano e del secondo';
    const { project, warnings } = read(
      fileWith({ ...BASE, vlans: [{ id: 10, name: long }, { id: 20, name: 'x'.repeat(32) }] })
    );
    expect(project.settings.vlans).toEqual([
      { id: 10, name: 'Rete degli uffici del primo pian' },
      { id: 20, name: 'x'.repeat(32) },
    ]);
    expect(warnings).toEqual(['1 nome di VLAN troppo lungo accorciato a 32 caratteri.']);
  });

  it.each([['Uffici'], [10], [{ 10: 'Uffici' }], [null], [true]])(
    'what is not a list (%j) is left out whole, and the user is told',
    (vlans) => {
      const { project, warnings } = read(fileWith({ ...BASE, emailMode: 'internal', vlans }));
      expect(project.settings).toEqual({ ...BASE, emailMode: 'internal' });
      expect(warnings).toEqual(['Elenco dei nomi delle VLAN non valido: ignorato.']);
    }
  );
});

describe('the DNS server of the project in a project file', () => {
  it('comes back as it was saved, written after the gateway', () => {
    const settings: GlobalNetworkSettings = { ...BASE, dns: '10.0.0.53', emailMode: 'cloud' };
    const text = serializeProject(projectWith(settings));

    expect(Object.keys(JSON.parse(text).settings)).toEqual([
      'ipClass',
      'subnet',
      'gateway',
      'dns',
      'emailMode',
    ]);
    const { project, warnings } = read(text);
    expect(project.settings).toEqual(settings);
    expect(warnings).toEqual([]);
  });

  it('a project without one is written without a word about it', () => {
    const text = serializeProject(projectWith({ ...BASE, emailMode: 'auto' }));
    expect(text).not.toContain('dns');
    // (a setting switched off in the app is there with no value: not written either)
    expect(serializeProject(projectWith({ ...BASE, dns: undefined, emailMode: 'auto' }))).toBe(text);
  });

  it('a file written before it existed opens as before, with no server and nothing to say', () => {
    const { project, warnings } = read(fileWith({ ...BASE, emailMode: 'auto' }));
    expect(project.settings).toEqual({ ...BASE, emailMode: 'auto' });
    expect('dns' in project.settings).toBe(false);
    expect(warnings).toEqual([]);
  });

  it('is kept trimmed', () => {
    const { project, warnings } = read(fileWith({ ...BASE, dns: ' 10.0.0.53 ' }));
    expect(project.settings.dns).toBe('10.0.0.53');
    expect(warnings).toEqual([]);
  });

  it('left empty is no server, and nothing is said', () => {
    for (const empty of ['', '   ']) {
      const { project, warnings } = read(fileWith({ ...BASE, dns: empty }));
      expect('dns' in project.settings).toBe(false);
      expect(warnings).toEqual([]);
    }
  });

  it.each([['srv-auth'], ['10.0.0'], ['10.0.0.300'], [53], [null], [['10.0.0.53']]])(
    'what is not an address (%j) is left out, the rest is kept, and the user is told',
    (dns) => {
      const { project, warnings } = read(fileWith({ ...BASE, dns, emailMode: 'internal' }));
      expect(project.settings).toEqual({ ...BASE, emailMode: 'internal' });
      expect('dns' in project.settings).toBe(false);
      expect(warnings).toEqual(['Server DNS predefinito non valido: ignorato.']);
    }
  );
});
