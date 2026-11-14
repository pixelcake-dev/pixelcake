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
