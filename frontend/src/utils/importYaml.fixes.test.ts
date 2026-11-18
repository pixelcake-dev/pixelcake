/**
 * What reading a YAML file does with the names that look like something else
 * than text, with names that are twice in a file, with a VLAN outside its
 * range, and with places and areas (the round trip of the file).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseYamlTopology } from './importYaml';
import { generateYaml } from './exportYaml';
import { setLanguage } from '@/i18n/language';
import type { CanvasArea, NetworkDevice } from '@/types';

beforeEach(() => setLanguage('en'));

const file = (...lines: string[]) => lines.join('\n');

function device(id: string, label: string, x = 0, y = 0): NetworkDevice {
  return { id, type: 'PC', label, ip: '', subnet: '', gateway: '', position: { x, y } };
}

describe('names that look like numbers or booleans', () => {
  it('keeps them as text, as written, and keeps their links', () => {
    const result = parseYamlTopology(
      file(
        'pixelcake:',
        '  devices:',
        '    - name: 10',
        '      type: Switch',
        '    - name: true',
        '    - name: 1.50',
        '    - name: Plain',
        '  connections:',
        '    - source: 10',
        '      target: true',
        '    - source: 1.50',
        '      target: Plain'
      )
    );
    expect(result.devices.map((d) => d.label)).toEqual(['10', 'true', '1.50', 'Plain']);
    expect(result.connections).toHaveLength(2);
    expect(result.connections[0]).toMatchObject({ source: 'dev-0', target: 'dev-1' });
    expect(result.connections[1]).toMatchObject({ source: 'dev-2', target: 'dev-3' });
    expect(result.warnings).toEqual([]);
  });

  it('comes back from an export as it went in', () => {
    const devices = [device('a', '10'), device('b', 'true'), device('c', 'null')];
    const result = parseYamlTopology(
      generateYaml(devices, [{ id: 'k', source: 'a', target: 'b' }])
    );
    expect(result.devices.map((d) => d.label)).toEqual(['10', 'true', 'null']);
    expect(result.connections).toHaveLength(1);
  });
});

describe('names that are twice in a file', () => {
  const twice = file(
    'pixelcake:',
    '  devices:',
    '    - name: Dup',
    '      type: Switch',
    '    - name: Dup',
    '      type: Router',
    '    - name: pc-1',
    '    - name: PC-1',
    '  connections:',
    '    - source: Dup',
    '      target: PC-1'
  );

  it('gives the later ones the first free name, with the rule of the app', () => {
    const result = parseYamlTopology(twice);
    expect(result.devices.map((d) => d.label)).toEqual(['Dup', 'Dup-1', 'pc-1', 'PC-1-1']);
  });

  it('sends the links that name it to the first device that has it', () => {
    const result = parseYamlTopology(twice);
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]).toMatchObject({ source: 'dev-0', target: 'dev-2' });
  });

  it('says what was renamed', () => {
    const result = parseYamlTopology(twice);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Dup');
    expect(result.warnings[0]).toContain('Dup-1');
    expect(result.warnings[0]).toContain('PC-1-1');
  });

  it('does not give a new name that a later device of the file has', () => {
    const result = parseYamlTopology(
      file('devices:', '  - name: A', '  - name: A', '  - name: A-1')
    );
    expect(result.devices.map((d) => d.label)).toEqual(['A', 'A-2', 'A-1']);
  });
});

describe('a VLAN outside its range', () => {
  it('is not imported, and the warning says it was left out', () => {
    const result = parseYamlTopology(
      file(
        'devices:',
        '  - name: SW',
        '    type: Switch',
        '    vlan: [10, 5000]',
        '    ports:',
        '      - id: 1',
        '        vlan: [10, 0, 20, 4095]',
        '      - id: 2',
        '        vlan: 9999',
        '      - id: 3',
        '        vlan: 30',
        '  - name: PC',
        'connections:',
        '  - source: SW',
        '    target: PC',
        '    vlan: [1, 70000]'
      )
    );
    const sw = result.devices[0];
    expect(sw.vlan).toEqual([10]);
    expect(sw.ports?.[0].vlan).toEqual([10, 20]);
    expect(sw.ports?.[1].vlan).toBeUndefined();
    expect(sw.ports?.[2].vlan).toBe(30);
    expect(result.connections[0].vlan).toEqual([1]);
    const text = result.warnings.join('\n');
    expect(text).toContain('5000');
    expect(text).toContain('9999');
    expect(text).toContain('70000');
    expect(text).toMatch(/left out/);
    expect(result.warnings).toHaveLength(4);
  });
});

describe('places and areas', () => {
  const AREAS: CanvasArea[] = [
    { id: 'area-1', label: 'Core: "A"', color: 'violet', position: { x: 80, y: 20 }, size: { width: 300, height: 200 } },
    { id: 'area-2', label: '', color: 'teal', position: { x: -40.5, y: 0 }, size: { width: 240, height: 320.25 } },
  ];

  it('writes the places of the devices and the areas, and reads them back', () => {
    const devices = [device('a', 'A', 100, 50), device('b', 'B', -30, 400.5)];
    const text = generateYaml(devices, [], 'Lab', AREAS);
    const result = parseYamlTopology(text);
    expect(result.devices.map((d) => d.position)).toEqual([
      { x: 100, y: 50 },
      { x: -30, y: 400.5 },
    ]);
    expect(result.areas).toEqual(AREAS);
    expect(result.warnings).toEqual([]);
  });

  it('a file without areas has none, and one without places lays the devices on a grid', () => {
    const noAreas = generateYaml([device('a', 'A', 1, 2)], [], 'Lab');
    expect(noAreas).not.toMatch(/areas/);
    expect(parseYamlTopology(noAreas).areas).toEqual([]);
    const grid = parseYamlTopology(file('devices:', '  - name: A', '  - name: B'));
    expect(grid.devices.map((d) => d.position)).toEqual([
      { x: 100, y: 100 },
      { x: 350, y: 100 },
    ]);
  });

  it('leaves out an area that cannot be drawn, with a warning', () => {
    const result = parseYamlTopology(
      file('devices:', '  - name: A', 'areas:', '  - label: Broken', '  - label: Ok', '    position: {x: 1, y: 2}', '    size: {width: 200, height: 100}')
    );
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].label).toBe('Ok');
    expect(result.warnings).toHaveLength(1);
  });
});
