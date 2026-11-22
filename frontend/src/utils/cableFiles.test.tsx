/**
 * The cable of a link through the two file formats: the project file
 * (.pixelcake.json) and the YAML export/import, the import that adds to the
 * board included. The medium, the length and the delay written by hand must
 * come back as they were saved, a file written before they existed must open
 * as it did, and the time of a ping must not change on the way.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { NetworkConnection, ProjectFile } from '@/types';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { Topology } from '@/engine';
import { normalizeBindings, planAndEvaluateFlow, roundTripMs } from '@/engine';
import { device, host, link, nic, port, route, switchWith, topo } from '@/test/networkFixtures';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { getT } from '@/i18n';
import ImportExportModal from '@/components/Modals/ImportExportModal';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';
import { parseYamlTopology } from './importYaml';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const MASK = '255.255.255.0';

/**
 * Two sites over the Internet: a PC on a switch behind each router, the
 * head office on FTTH, the branch on a satellite with a delay written by
 * hand on its line, and a 12 km fibre inside the head office.
 */
function lab(): Topology {
  const router = (id: string, lan: string, other: string, wan: string, peer: string) =>
    device({
      id,
      label: id.toUpperCase(),
      type: 'Router',
      ip: `${lan}.1`,
      ports: [port(1, { ip: `${lan}.1`, subnet: MASK }), port(2, { ip: wan, subnet: MASK })],
      routes: [route(`${other}.0/24`, peer)],
    });
  return topo(
    [
      host('pc-a', '198.51.100.10', '198.51.100.1', { label: 'PC-A' }),
      switchWith('sw-a', [port(1), port(2)], { label: 'SW-A' }),
      router('r-a', '198.51.100', '192.0.2', '203.0.113.1', '203.0.113.2'),
      device({ id: 'inet', label: 'Internet', type: 'Cloud', templateId: 'tpl-cloud', nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })] }),
      router('r-b', '192.0.2', '198.51.100', '203.0.113.2', '203.0.113.1'),
      host('pc-b', '192.0.2.10', '192.0.2.1', { label: 'PC-B' }),
    ],
    [
      link('pc-a', 'sw-a', { sourceNic: 'nic-1', targetPort: 1 }),
      link('sw-a', 'r-a', { sourcePort: 2, targetPort: 1, medium: 'fibre', lengthM: 12_000 }),
      link('r-a', 'inet', { sourcePort: 2, targetNic: 'nic-1', medium: 'ftth' }),
      link('inet', 'r-b', { sourceNic: 'nic-2', targetPort: 2, medium: 'satellite', delayMs: 290.5 }),
      link('pc-b', 'r-b', { sourceNic: 'nic-1', targetPort: 1 }),
    ]
  );
}

/** The time of a ping from one site to the other, as the terminal would print it */
function pingTime(t: Topology): number {
  // (by name: a device read from YAML has an id of its own)
  const id = (label: string) => t.devices.find((d) => d.label === label)!.id;
  const flow = planAndEvaluateFlow('ping', id('PC-A'), id('PC-B'), t);
  expect(flow.verdict, flow.failureReason).toBe('success');
  return roundTripMs(flow.legs[0].trace, flow.legs[1].trace, t);
}

/** The cable of each link: medium, length, delay */
const cables = (connections: NetworkConnection[]) =>
  connections.map(({ medium, lengthM, delayMs }) => ({ medium, lengthM, delayMs }));

const CABLES = [
  { medium: undefined, lengthM: undefined, delayMs: undefined },
  { medium: 'fibre', lengthM: 12_000, delayMs: undefined },
  { medium: 'ftth', lengthM: undefined, delayMs: undefined },
  { medium: 'satellite', lengthM: undefined, delayMs: 290.5 },
  { medium: undefined, lengthM: undefined, delayMs: undefined },
];

function projectOf(t: Topology): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Lab',
    description: '',
    savedAt: '2026-11-22T10:00:00.000Z',
    settings: { ...DEFAULT_NETWORK_SETTINGS },
    activeCanvasId: 'canvas-1',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Canvas 1',
        devices: t.devices,
        connections: t.connections,
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 1,
        connectionCounter: 1,
      },
    ],
    templates: { devices: [], connections: [] },
  };
}

describe('the lab itself', () => {
  it('takes the time of its lines: FTTH, the Internet, a delay written on the satellite', () => {
    // one way: 0.06 (12 km) + 1.5 (FTTH) + 10 (Internet) + 290.5 (written) + switch and routers 0.21
    expect(pingTime(lab())).toBeCloseTo(2 * (0.06 + 1.5 + 10 + 290.5 + 0.21) + 0.2, 9);
  });
});

describe('the cable of a link in a project file', () => {
  it('comes back as it was saved, and the time with it', () => {
    const original = lab();
    const result = parseProjectFile(serializeProject(projectOf(original)));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    const [canvas] = result.project.canvases;
    expect(cables(canvas.connections)).toEqual(CABLES);
    expect(pingTime({ devices: canvas.devices, connections: canvas.connections })).toBe(pingTime(original));
  });

  it('is written after the colour, in the order medium, length, delay, and not at all when not set', () => {
    const saved = JSON.parse(serializeProject(projectOf(lab()))).canvases[0].connections;
    expect(Object.keys(saved[3])).toEqual(['id', 'source', 'target', 'sourceNic', 'targetPort', 'medium', 'delayMs']);
    expect(Object.keys(saved[1])).toEqual(['id', 'source', 'target', 'sourcePort', 'targetPort', 'medium', 'lengthM']);
    expect(Object.keys(saved[0])).toEqual(['id', 'source', 'target', 'sourceNic', 'targetPort']);
  });

  it('a file written before links had a cable opens with no warning, each link worked out as before', () => {
    const older = JSON.parse(serializeProject(projectOf(lab())));
    for (const c of older.canvases[0].connections) {
      delete c.medium;
      delete c.lengthM;
      delete c.delayMs;
    }
    const result = parseProjectFile(JSON.stringify(older));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    const [canvas] = result.project.canvases;
    expect(cables(canvas.connections).every((c) => Object.values(c).every((v) => v === undefined))).toBe(true);
    // copper with no length, the Internet, and the switch and the routers
    expect(pingTime({ devices: canvas.devices, connections: canvas.connections })).toBeCloseTo(2 * (10 + 0.21) + 0.2, 9);
  });

  it('drops what the engine could not read, keeps the rest of the link, and says so', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    const links = damaged.canvases[0].connections;
    links[1].medium = 'banana';
    links[2].lengthM = -3;
    links[3].delayMs = '290';
    links[4].lengthM = 50_000_000;

    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(cables(result.project.canvases[0].connections)).toEqual([
      CABLES[0],
      { medium: undefined, lengthM: 12_000, delayMs: undefined },
      CABLES[2],
      { medium: 'satellite', lengthM: undefined, delayMs: undefined },
      CABLES[4],
    ]);
    expect(result.project.canvases[0].connections[3]).toMatchObject({ sourceNic: 'nic-2', targetPort: 2 });
    expect(result.warnings).toEqual([
      'Canvas «Canvas 1»: 4 connessioni con mezzo, lunghezza o ritardo non validi corrette: i valori sono stati tolti.',
    ]);
  });
});

describe('the cable of a link through YAML', () => {
  function roundTrip(t: Topology) {
    const yaml = generateYaml(t.devices, t.connections, 'Lab');
    const result = parseYamlTopology(yaml);
    return {
      yaml,
      warnings: result.warnings,
      topology: { devices: result.devices, connections: normalizeBindings(result.devices, result.connections) },
    };
  }

  it('comes back as it was exported, and the time with it', () => {
    const { warnings, topology } = roundTrip(lab());
    expect(warnings).toEqual([]);
    expect(cables(topology.connections)).toEqual(CABLES);
    expect(pingTime(topology)).toBe(pingTime(lab()));
  });

  it('is written the way a person would read it: the length in metres, the delay in ms', () => {
    const { yaml } = roundTrip(lab());
    expect(yaml).toContain(['      target_port: 1', '      medium: fibre', '      length_m: 12000'].join('\n'));
    expect(yaml).toContain(['      medium: satellite', '      delay_ms: 290.5'].join('\n'));
    expect(yaml).toContain('      medium: ftth');
    expect(yaml.match(/medium:/g)).toHaveLength(3);
  });

  it('leaves out, with a warning, a value that is not one, and keeps the link', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: A',
      '    - name: B',
      '  connections:',
      '    - source: A',
      '      target: B',
      '      medium: banana',
      '      length_m: -4',
      '      delay_ms: soon',
      '    - source: B',
      '      target: A',
      '      medium: dsl',
      '      length_m: 2500',
      '      delay_ms: 0',
    ].join('\n');
    const result = parseYamlTopology(yaml);
    expect(result.connections).toHaveLength(2);
    expect(cables(result.connections)).toEqual([
      { medium: undefined, lengthM: undefined, delayMs: undefined },
      { medium: 'dsl', lengthM: 2500, delayMs: 0 },
    ]);
    expect(result.warnings).toEqual([
      'Connessione 1: medium "banana" non valido, non importato',
      'Connessione 1: length_m "-4" non valido, non importato',
      'Connessione 1: delay_ms "soon" non valido, non importato',
    ]);
  });

  describe('the import that adds to the board', () => {
    beforeEach(() => {
      localStorage.clear();
      useNetworkStore.getState().clearAllDevices();
      useUIStore.getState().closeModal('importExport');
    });

    it('keeps the cable of every link it adds', async () => {
      const yaml = generateYaml(lab().devices, lab().connections, 'Lab');
      useUIStore.getState().openModal('importExport');
      render(<ImportExportModal />);
      fireEvent.click(screen.getByRole('button', { name: /Import$|Importa$/ }));
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [new File([yaml], 'lab.yaml', { type: 'text/yaml' })] } });
      await screen.findByText('lab.yaml');
      const words = getT().importExport.importTab;
      fireEvent.click(screen.getByLabelText(words.append));
      fireEvent.click(screen.getAllByRole('button', { name: words.confirm }).pop() as HTMLElement);

      await waitFor(() => expect(useNetworkStore.getState().connections).toHaveLength(5));
      expect(cables(useNetworkStore.getState().connections)).toEqual(CABLES);
    });
  });
});
