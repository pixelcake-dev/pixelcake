/**
 * Project file (`.pixelcake.json`) — the pure serialiser and parser.
 *
 * - a saved project comes back identical (round trip);
 * - the text is stable: same project, same text, whatever the key order of
 *   the objects in memory;
 * - a file that cannot be opened gives an Italian error and nothing else;
 * - everything repairable is repaired and listed in `warnings`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  ConnectionTemplate,
  DeviceTemplate,
  NetworkConnection,
  NetworkDevice,
  NetworkInterfaceCard,
  Port,
  ProjectFile,
  StoredCanvas,
} from '@/types';
import { isEndBound } from '@/engine';
import formatReference from '../../../docs/project-file.md?raw';
import {
  nextCanvasId,
  parseProjectFile,
  fileSlug,
  projectFileName,
  serializeProject,
  type ParseProjectResult,
} from './projectFile';

// ---------- fixtures ----------

function nic(id: string, name: string, ip: string, gateway: string): NetworkInterfaceCard {
  return {
    id,
    name,
    enabled: true,
    speed: '1G',
    ip,
    subnet: '255.255.255.0',
    gateway,
    mac: `02:00:00:00:00:${id.slice(-1).padStart(2, '0')}`,
  };
}

function switchPorts(): Port[] {
  return [
    { id: 1, name: 'Uplink', enabled: true, speed: '10G', portType: 'trunk', vlan: [10, 20] },
    { id: 2, enabled: true, portType: 'access', vlan: 10, poe: true },
    { id: 3, enabled: true, portType: 'access', vlan: 20, description: 'server' },
    { id: 4, enabled: false },
  ];
}

const officeDevices: NetworkDevice[] = [
  {
    id: 'dev-0',
    type: 'Switch',
    templateId: 'tpl-switch',
    label: 'SW-Office',
    ip: '192.168.10.2',
    subnet: '255.255.255.0',
    gateway: '192.168.10.1',
    vendor: 'Acme',
    location: 'Rack 1',
    position: { x: 200, y: 120.5 },
    vlan: [10, 20],
    stp: { enabled: true, mode: 'RSTP', priority: 4096 },
    portCount: 4,
    ports: switchPorts(),
  },
  {
    id: 'dev-1',
    type: 'Router',
    label: 'Router-1',
    ip: '192.168.10.1',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 200, y: -40 },
    portCount: 2,
    ports: [
      { id: 1, enabled: true, portType: 'lan', ip: '192.168.10.1', subnet: '255.255.255.0' },
      {
        id: 2,
        enabled: true,
        portType: 'wan',
        ip: '203.0.113.2',
        subnet: '255.255.255.252',
        nat: true,
      },
    ],
  },
  {
    id: 'dev-2',
    type: 'PC',
    templateId: 'tpl-pc',
    label: 'PC-1',
    ip: '192.168.10.11',
    subnet: '255.255.255.0',
    gateway: '192.168.10.1',
    position: { x: 80, y: 300 },
    nics: [nic('nic-1', 'eth0', '192.168.10.11', '192.168.10.1')],
  },
  {
    id: 'dev-3',
    type: 'Server',
    templateId: 'tpl-1700000000000',
    label: 'NVR-1',
    ip: '192.168.20.5',
    subnet: '255.255.255.0',
    gateway: '192.168.20.1',
    position: { x: 340, y: 300 },
    nics: [
      nic('nic-1', 'eth0', '192.168.20.5', '192.168.20.1'),
      nic('nic-2', 'eth1', '10.0.0.5', ''),
    ],
  },
  {
    id: 'dev-4',
    type: 'Firewall',
    label: 'FW-1',
    ip: '203.0.113.1',
    subnet: '255.255.255.252',
    gateway: '',
    position: { x: 200, y: -200 },
    portCount: 2,
    ports: [
      { id: 1, enabled: true, portType: 'lan', securityZone: 'trust' },
      { id: 2, enabled: true, portType: 'wan', securityZone: 'untrust', ips: true },
    ],
  },
];

const officeConnections: NetworkConnection[] = [
  {
    id: 'conn-0',
    source: 'dev-2',
    target: 'dev-0',
    sourceHandle: null,
    targetHandle: 'bottom',
    sourceNic: 'nic-1',
    targetPort: 2,
    type: 'access',
    vlan: [10],
  },
  {
    id: 'conn-1',
    source: 'dev-0',
    target: 'dev-1',
    sourcePort: 1,
    targetPort: 1,
    type: 'trunk',
    bandwidth: '10Gbps',
    vlan: [10, 20],
    label: 'uplink',
    stpPortState: 'forwarding',
    stpPortPriority: 128,
  },
  { id: 'conn-2', source: 'dev-3', target: 'dev-0', sourceNic: 'nic-1', targetPort: 3 },
  {
    id: 'conn-3',
    source: 'dev-1',
    target: 'dev-4',
    sourcePort: 2,
    targetPort: 1,
    color: '#ff0000',
  },
];

const customDeviceTemplate: DeviceTemplate = {
  id: 'tpl-1700000000000',
  name: 'NVR',
  type: 'Server',
  icon: 'mdi:cctv',
  color: '#123456',
  terraformFields: { size: 'large', disks: 4, raid: true },
  isCustom: true,
  supportsVLAN: false,
  supportsSTP: false,
  supportsPorts: false,
  supportsNICs: true,
};

const customConnectionTemplate: ConnectionTemplate = {
  id: 'conn-1700000000001',
  name: 'Fibra',
  type: 'fiber',
  description: 'Dorsale in fibra',
  color: '#00aa88',
  lineStyle: 'dashed',
  strokeWidth: 3,
  strokeWidthHighlighted: 5,
  strokeDasharray: '6 3',
  isCustom: true,
};

/** A project with everything the format carries, already in its normal form */
function richProject(): ProjectFile {
  return {
    format: 'pixelcake-project',
    version: 1,
    name: 'Sede Milano',
    description: 'Uffici e sala server',
    savedAt: '2026-11-11T12:00:00.000Z',
    settings: {
      ipClass: '192.168.10.0',
      subnet: '255.255.255.0',
      gateway: '192.168.10.1',
      emailMode: 'cloud',
    },
    activeCanvasId: 'canvas-2',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Uffici',
        devices: structuredClone(officeDevices),
        connections: structuredClone(officeConnections),
        viewport: { x: -120.5, y: 40, zoom: 0.75 },
        deviceCounter: 5,
        connectionCounter: 4,
      },
      {
        id: 'canvas-2',
        name: 'Magazzino',
        devices: [
          {
            id: 'dev-0',
            type: 'PC',
            label: 'PC-Magazzino',
            ip: '192.168.30.11',
            subnet: '255.255.255.0',
            gateway: '192.168.30.1',
            position: { x: 0, y: 0 },
            nics: [nic('nic-1', 'eth0', '192.168.30.11', '192.168.30.1')],
          },
        ],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 7, // devices were added and removed: the counter only grows
        connectionCounter: 2,
      },
      {
        id: 'canvas-7',
        name: 'Vuoto',
        devices: [],
        connections: [],
        viewport: { x: 10, y: 20, zoom: 2 },
        deviceCounter: 0,
        connectionCounter: 0,
      },
    ],
    templates: {
      devices: [customDeviceTemplate],
      connections: [customConnectionTemplate],
    },
  };
}

/** The smallest valid file, as a plain object ready to be broken */
function minimalFile(): Record<string, unknown> {
  return {
    format: 'pixelcake-project',
    version: 1,
    name: 'Sede Milano',
    description: '',
    savedAt: '2026-11-11T12:00:00.000Z',
    settings: {
      ipClass: '192.168.1.0',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      emailMode: 'auto',
    },
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

function pc(id: string): Record<string, unknown> {
  return {
    id,
    type: 'PC',
    label: id.toUpperCase(),
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  };
}

/** minimalFile with the only canvas patched */
function fileWithCanvas(patch: Record<string, unknown>): Record<string, unknown> {
  const file = minimalFile();
  const [canvas] = file.canvases as Record<string, unknown>[];
  file.canvases = [{ ...canvas, ...patch }];
  return file;
}

function parse(file: unknown): ParseProjectResult {
  return parseProjectFile(JSON.stringify(file));
}

function parsed(file: unknown): { project: ProjectFile; warnings: string[] } {
  const result = parse(file);
  if (!result.ok) throw new Error(`expected the file to open, got: ${result.error}`);
  return result;
}

function errorOf(file: unknown): string {
  const result = parse(file);
  if (result.ok) throw new Error('expected the file to be refused');
  return result.error;
}

function onlyCanvas(file: unknown): { canvas: StoredCanvas; warnings: string[] } {
  const { project, warnings } = parsed(file);
  return { canvas: project.canvases[0], warnings };
}

describe('project file', () => {
  beforeEach(() => {
    // cleanupConnections reports each duplicate it drops
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- round trip ----------

  describe('round trip', () => {
    it('parse(serialize(project)) gives the same project back, with no warnings', () => {
      const project = richProject();

      const result = parseProjectFile(serializeProject(project));

      expect(result).toEqual({ ok: true, project, warnings: [] });
    });

    it('keeps bound links, port addresses, NICs, VLANs and custom templates exactly', () => {
      const result = parseProjectFile(serializeProject(richProject()));
      if (!result.ok) throw new Error(result.error);
      const [office] = result.project.canvases;

      expect(office.connections).toEqual(officeConnections);
      expect(office.devices[1].ports?.[1]).toEqual({
        id: 2,
        enabled: true,
        portType: 'wan',
        ip: '203.0.113.2',
        subnet: '255.255.255.252',
        nat: true,
      });
      expect(office.devices[3].nics).toHaveLength(2);
      expect(office.devices[0].ports?.[0].vlan).toEqual([10, 20]);
      expect(office.devices[0].vlan).toEqual([10, 20]);
      expect(result.project.templates).toEqual({
        devices: [customDeviceTemplate],
        connections: [customConnectionTemplate],
      });
    });

    it('a second round trip changes nothing (the normal form is stable)', () => {
      const once = serializeProject(richProject());
      const reopened = parseProjectFile(once);
      if (!reopened.ok) throw new Error(reopened.error);

      expect(serializeProject(reopened.project)).toBe(once);
    });

    it('an untouched default project round-trips too', () => {
      const result = parse(minimalFile());

      expect(result).toEqual({ ok: true, project: minimalFile(), warnings: [] });
    });
  });

  // ---------- text ----------

  describe('serializeProject', () => {
    it('writes pretty-printed JSON ending with a newline, top-level keys in the documented order', () => {
      const text = serializeProject(richProject());

      expect(text.endsWith('}\n')).toBe(true);
      expect(text).toContain('\n  "format": "pixelcake-project",\n  "version": 1,\n');
      expect(Object.keys(JSON.parse(text))).toEqual([
        'format',
        'version',
        'name',
        'description',
        'savedAt',
        'settings',
        'activeCanvasId',
        'canvases',
        'templates',
      ]);
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

    it('gives the same text whatever the key order of the objects in memory', () => {
      const project = richProject();
      const shuffled = richProject();
      // Same data, keys inserted in reverse: what editing history can produce
      const reverse = <T extends object>(value: T): T =>
        Object.fromEntries(Object.entries(value).reverse()) as T;
      shuffled.settings = reverse(shuffled.settings);
      shuffled.canvases = shuffled.canvases.map(canvas => ({
        ...reverse(canvas),
        devices: canvas.devices.map(device => ({
          ...reverse(device),
          ports: device.ports?.map(reverse),
          nics: device.nics?.map(reverse),
        })),
        connections: canvas.connections.map(reverse),
      }));
      shuffled.templates = {
        connections: shuffled.templates.connections.map(reverse),
        devices: shuffled.templates.devices.map(reverse),
      };

      expect(serializeProject(shuffled)).toBe(serializeProject(project));
    });

    it('starts devices and connections with their id, and keeps fields it does not know', () => {
      const project = richProject();
      const device = project.canvases[0].devices[0] as NetworkDevice & { notes?: string };
      device.notes = 'kept';

      const file = JSON.parse(serializeProject(project));

      const written = file.canvases[0].devices[0];
      expect(Object.keys(written).slice(0, 4)).toEqual(['id', 'type', 'templateId', 'label']);
      expect(written.notes).toBe('kept');
      expect(Object.keys(file.canvases[0].connections[0]).slice(0, 3)).toEqual([
        'id',
        'source',
        'target',
      ]);
    });
  });

  // ---------- errors ----------

  describe('a file that cannot be opened', () => {
    it('is not JSON', () => {
      expect(parseProjectFile('questo non è JSON {')).toEqual({
        ok: false,
        error: 'Il file non è un JSON valido.',
      });
      expect(parseProjectFile('')).toMatchObject({ ok: false });
    });

    it('has no "format", or another one', () => {
      const missing = minimalFile();
      delete missing.format;
      const message =
        'Il file non è un progetto PixelCake (campo "format" mancante o non riconosciuto).';

      expect(errorOf(missing)).toBe(message);
      expect(errorOf({ ...minimalFile(), format: 'something-else' })).toBe(message);
      // valid JSON that is not even an object
      expect(errorOf([1, 2, 3])).toBe(message);
      expect(errorOf(null)).toBe(message);
      expect(errorOf('pixelcake-project')).toBe(message);
    });

    it('was written by a newer version', () => {
      const error = errorOf({ ...minimalFile(), version: 2 });

      expect(error).toContain('creato con una versione più recente');
      expect(error).toContain('formato 2');
    });

    it('carries a version that is not a version', () => {
      for (const version of ['1', 0, -1, 1.5, null]) {
        expect(errorOf({ ...minimalFile(), version })).toBe(
          'Il file indica una versione del formato non valida.'
        );
      }
    });

    it('has no canvases', () => {
      const missing = minimalFile();
      delete missing.canvases;

      expect(errorOf(missing)).toBe('Il progetto non contiene nessun canvas.');
      expect(errorOf({ ...minimalFile(), canvases: [] })).toBe(
        'Il progetto non contiene nessun canvas.'
      );
      expect(errorOf({ ...minimalFile(), canvases: 'none' })).toBe(
        'Il progetto non contiene nessun canvas.'
      );
    });

    it('has a canvas without its list of devices', () => {
      expect(errorOf(fileWithCanvas({ devices: undefined }))).toBe(
        'Canvas «Canvas 1»: manca l\'elenco dei dispositivi ("devices").'
      );
      expect(errorOf(fileWithCanvas({ devices: {} }))).toContain('"devices"');
    });

    it('has a canvas without its list of connections', () => {
      expect(errorOf(fileWithCanvas({ connections: undefined }))).toBe(
        'Canvas «Canvas 1»: manca l\'elenco delle connessioni ("connections").'
      );
      expect(errorOf(fileWithCanvas({ connections: 'none' }))).toContain('"connections"');
    });

    it('has a canvas that is not an object', () => {
      expect(errorOf({ ...minimalFile(), canvases: [42] })).toBe(
        'Il canvas n. 1 del file non è valido.'
      );
    });

    it('never throws, whatever the content', () => {
      const nasty: unknown[] = [
        { ...minimalFile(), canvases: [null] },
        fileWithCanvas({ devices: [null, 3, 'x', [], { id: 7 }] }),
        fileWithCanvas({ devices: [{ ...pc('dev-0'), ports: [null, 'x'], nics: { a: 1 } }] }),
        fileWithCanvas({ connections: [null, 3, { id: 'conn-0' }] }),
        { ...minimalFile(), templates: { devices: [null, 3], connections: 'x' } },
        { ...minimalFile(), settings: 'x', name: 5, description: {} },
      ];

      for (const file of nasty) {
        expect(() => parse(file)).not.toThrow();
      }
    });
  });

  // ---------- repairs ----------

  describe('a file that is repaired', () => {
    it('without a description: empty, with a warning', () => {
      const file = minimalFile();
      delete file.description;

      const { project, warnings } = parsed(file);

      expect(project.description).toBe('');
      expect(warnings).toEqual(['Descrizione del progetto mancante: lasciata vuota.']);
    });

    it('without a name: the default one, with a warning', () => {
      const file = minimalFile();
      delete file.name;

      const { project, warnings } = parsed(file);

      expect(project.name).toBe('Progetto senza nome');
      expect(warnings).toEqual(['Nome del progetto mancante: usato «Progetto senza nome».']);
    });

    it('without settings: the default network, with a warning', () => {
      const file = minimalFile();
      delete file.settings;

      const { project, warnings } = parsed(file);

      expect(project.settings).toEqual({
        ipClass: '192.168.1.0',
        subnet: '255.255.255.0',
        gateway: '192.168.1.1',
        emailMode: 'auto',
      });
      expect(warnings).toEqual(['Impostazioni di rete mancanti: usati i valori predefiniti.']);
    });

    it('with incomplete settings: what is there is kept, the rest filled in', () => {
      const { project, warnings } = parsed({
        ...minimalFile(),
        settings: { ipClass: '10.0.0.0', gateway: 7, emailMode: 'pigeon' },
      });

      expect(project.settings).toEqual({
        ipClass: '10.0.0.0',
        subnet: '255.255.255.0',
        gateway: '192.168.1.1',
      });
      expect(warnings).toEqual([
        'Impostazioni di rete incomplete: completate con i valori predefiniti.',
      ]);
    });

    it('settings without emailMode are complete (it is optional)', () => {
      const settings = { ipClass: '10.0.0.0', subnet: '255.0.0.0', gateway: '10.0.0.1' };

      const { project, warnings } = parsed({ ...minimalFile(), settings });

      expect(project.settings).toEqual(settings);
      expect(warnings).toEqual([]);
    });

    it('without a viewport: the initial view, with a warning', () => {
      const { canvas, warnings } = onlyCanvas(fileWithCanvas({ viewport: undefined }));

      expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(warnings).toEqual([
        'Canvas «Canvas 1»: vista mancante o non valida, riportata alla posizione iniziale.',
      ]);
    });

    it('with a viewport that cannot be shown (zoom 0, text): the initial view', () => {
      for (const viewport of [{ x: 0, y: 0, zoom: 0 }, { x: '1', y: 2, zoom: 1 }, 'here']) {
        const { canvas, warnings } = onlyCanvas(fileWithCanvas({ viewport }));
        expect(canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
        expect(warnings).toHaveLength(1);
      }
    });

    it('without templates: none, with a warning', () => {
      const file = minimalFile();
      delete file.templates;

      const { project, warnings } = parsed(file);

      expect(project.templates).toEqual({ devices: [], connections: [] });
      expect(warnings).toEqual([
        'Elenco dei template personalizzati mancante: nessun template importato.',
      ]);
    });

    it('with templates that are not templates: only the valid ones are kept, as custom', () => {
      const { project, warnings } = parsed({
        ...minimalFile(),
        templates: {
          devices: [
            { ...customDeviceTemplate, isCustom: false },
            { id: 'tpl-x', name: 'Rotto' },
          ],
          connections: [
            customConnectionTemplate,
            { ...customConnectionTemplate, lineStyle: 'wavy' },
          ],
        },
      });

      expect(project.templates.devices).toEqual([customDeviceTemplate]);
      expect(project.templates.connections).toEqual([customConnectionTemplate]);
      expect(warnings).toEqual(['2 template personalizzati non validi ignorati.']);
    });

    it('with duplicate canvas ids: the later ones get a new id', () => {
      const canvas = (name: string, id: unknown) => ({
        id,
        name,
        devices: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 0,
        connectionCounter: 0,
      });

      const { project, warnings } = parsed({
        ...minimalFile(),
        activeCanvasId: 'canvas-3',
        canvases: [
          canvas('A', 'canvas-3'),
          canvas('B', 'canvas-3'),
          canvas('C', undefined),
          canvas('D', 'canvas-1'),
        ],
      });

      expect(project.canvases.map(c => [c.name, c.id])).toEqual([
        ['A', 'canvas-3'],
        ['B', 'canvas-4'],
        ['C', 'canvas-5'],
        ['D', 'canvas-1'],
      ]);
      expect(new Set(project.canvases.map(c => c.id)).size).toBe(4);
      // the first one keeps the id, so it is still the active canvas
      expect(project.activeCanvasId).toBe('canvas-3');
      expect(warnings).toEqual(['2 canvas con ID mancante o duplicato: assegnati nuovi ID.']);
    });

    it('with an activeCanvasId that is not there: the first canvas', () => {
      for (const activeCanvasId of ['canvas-99', undefined, 3]) {
        const { project, warnings } = parsed({ ...minimalFile(), activeCanvasId });

        expect(project.activeCanvasId).toBe('canvas-1');
        expect(warnings).toEqual(['Canvas attivo non trovato: aperto «Canvas 1».']);
      }
    });

    it('with duplicate connection ids: the first of each is kept', () => {
      const { canvas, warnings } = onlyCanvas(
        fileWithCanvas({
          devices: [pc('dev-0'), pc('dev-1'), pc('dev-2')],
          connections: [
            { id: 'conn-0', source: 'dev-0', target: 'dev-1', label: 'first' },
            { id: 'conn-0', source: 'dev-1', target: 'dev-2', label: 'second' },
            { id: 'conn-1', source: 'dev-0', target: 'dev-2' },
          ],
          deviceCounter: 3,
          connectionCounter: 2,
        })
      );

      expect(canvas.connections.map(c => [c.id, c.label])).toEqual([
        ['conn-0', 'first'],
        ['conn-1', undefined],
      ]);
      expect(warnings).toEqual(['Canvas «Canvas 1»: 1 connessione con ID duplicato rimossa.']);
    });

    it('with connections to devices that do not exist: they are dropped', () => {
      const { canvas, warnings } = onlyCanvas(
        fileWithCanvas({
          devices: [pc('dev-0'), pc('dev-1')],
          connections: [
            { id: 'conn-0', source: 'dev-0', target: 'dev-1' },
            { id: 'conn-1', source: 'dev-0', target: 'dev-9' },
            { id: 'conn-2', source: 'ghost', target: 'dev-1' },
          ],
          deviceCounter: 2,
          connectionCounter: 3,
        })
      );

      expect(canvas.connections.map(c => c.id)).toEqual(['conn-0']);
      expect(warnings).toEqual([
        'Canvas «Canvas 1»: 2 connessioni verso dispositivi inesistenti rimosse.',
      ]);
    });

    it('with counters below the ids in use: raised, so a new id never collides', () => {
      const { canvas, warnings } = onlyCanvas(
        fileWithCanvas({
          devices: [pc('dev-0'), pc('dev-7'), pc('core')],
          connections: [{ id: 'conn-12', source: 'dev-0', target: 'dev-7' }],
          deviceCounter: 2,
          connectionCounter: 0,
        })
      );

      expect(canvas.deviceCounter).toBe(8);
      expect(canvas.connectionCounter).toBe(13);
      expect(warnings).toEqual([
        'Canvas «Canvas 1»: contatori degli ID mancanti o troppo bassi, ricalcolati.',
      ]);
    });

    it('with counters missing or not numbers: computed from the ids in use', () => {
      const { canvas, warnings } = onlyCanvas(
        fileWithCanvas({
          devices: [pc('dev-0'), pc('dev-1')],
          deviceCounter: undefined,
          connectionCounter: '4',
        })
      );

      expect(canvas.deviceCounter).toBe(2);
      expect(canvas.connectionCounter).toBe(0);
      expect(warnings).toHaveLength(1);
    });

    it('a counter above the ids in use is left alone (ids are never reused)', () => {
      const { canvas, warnings } = onlyCanvas(
        fileWithCanvas({ devices: [pc('dev-0')], deviceCounter: 40, connectionCounter: 9 })
      );

      expect(canvas.deviceCounter).toBe(40);
      expect(canvas.connectionCounter).toBe(9);
      expect(warnings).toEqual([]);
    });

    it('with entries that are not devices or connections: they are dropped, the rest stays', () => {
      const { canvas, warnings } = onlyCanvas(
        fileWithCanvas({
          devices: [pc('dev-0'), null, { label: 'no id' }, pc('dev-0'), pc('dev-1')],
          connections: [{ id: 'conn-0', source: 'dev-0', target: 'dev-1' }, 'x', { id: 'conn-1' }],
          deviceCounter: 2,
          connectionCounter: 1,
        })
      );

      expect(canvas.devices.map(d => d.id)).toEqual(['dev-0', 'dev-1']);
      expect(canvas.connections.map(c => c.id)).toEqual(['conn-0']);
      expect(warnings).toEqual([
        'Canvas «Canvas 1»: 3 dispositivi non validi o duplicati ignorati.',
        'Canvas «Canvas 1»: 2 connessioni non valide ignorate.',
      ]);
    });

    it('with a device missing what the canvas needs to draw it: completed', () => {
      const { canvas, warnings } = onlyCanvas(
        fileWithCanvas({
          devices: [{ id: 'dev-0', type: 'Switch', ports: [{ id: 1, enabled: true }, 'x'] }],
          deviceCounter: 1,
        })
      );

      expect(canvas.devices).toEqual([
        {
          id: 'dev-0',
          type: 'Switch',
          label: 'dev-0',
          ip: '',
          subnet: '',
          gateway: '',
          position: { x: 0, y: 0 },
          ports: [{ id: 1, enabled: true }],
        },
      ]);
      expect(warnings).toEqual(['Canvas «Canvas 1»: 1 dispositivo incompleto corretto.']);
    });

    it('lists every repair of a badly damaged file, and still opens it', () => {
      const { project, warnings } = parsed({
        format: 'pixelcake-project',
        canvases: [{ devices: [pc('dev-3')], connections: [] }],
      });

      expect(project.canvases).toHaveLength(1);
      expect(project.canvases[0]).toMatchObject({
        id: 'canvas-1',
        name: 'Canvas 1',
        deviceCounter: 4,
      });
      expect(warnings).toEqual([
        'Versione del formato non indicata: il file è stato letto come versione 1.',
        'Nome del progetto mancante: usato «Progetto senza nome».',
        'Descrizione del progetto mancante: lasciata vuota.',
        'Impostazioni di rete mancanti: usati i valori predefiniti.',
        'Canvas n. 1 senza nome: chiamato «Canvas 1».',
        'Canvas «Canvas 1»: vista mancante o non valida, riportata alla posizione iniziale.',
        'Canvas «Canvas 1»: contatori degli ID mancanti o troppo bassi, ricalcolati.',
        '1 canvas con ID mancante o duplicato: assegnato un nuovo ID.',
        'Canvas attivo non trovato: aperto «Canvas 1».',
        'Elenco dei template personalizzati mancante: nessun template importato.',
      ]);
    });
  });

  // ---------- files written before interface bindings ----------

  describe('a file written before links were bound to interfaces', () => {
    const oldCanvas = {
      devices: [
        {
          id: 'dev-0',
          type: 'Switch',
          label: 'SW-1',
          ip: '192.168.1.2',
          subnet: '255.255.255.0',
          gateway: '192.168.1.1',
          position: { x: 0, y: 0 },
          portCount: 4,
          ports: [1, 2, 3, 4].map(id => ({ id, enabled: true })),
        },
        {
          // stale mirror: the device-level address no longer matches its NIC
          id: 'dev-1',
          type: 'PC',
          label: 'PC-1',
          ip: '192.168.1.10',
          subnet: '255.255.255.0',
          gateway: '192.168.1.1',
          position: { x: 0, y: 100 },
          nics: [nic('nic-1', 'eth0', '10.0.0.5', '10.0.0.1')],
        },
      ],
      connections: [{ id: 'conn-0', source: 'dev-1', target: 'dev-0', type: 'access' }],
      deviceCounter: 2,
      connectionCounter: 1,
    };

    it('opens with every link bound and the address mirror in line, without warnings', () => {
      const { canvas, warnings } = onlyCanvas(fileWithCanvas(oldCanvas));

      expect(canvas.connections).toEqual([
        {
          id: 'conn-0',
          source: 'dev-1',
          target: 'dev-0',
          type: 'access',
          sourceNic: 'nic-1',
          targetPort: 1,
        },
      ]);
      expect(canvas.devices[1]).toMatchObject({ ip: '10.0.0.5', gateway: '10.0.0.1' });
      // a migration, not damage: nothing to tell the user
      expect(warnings).toEqual([]);
    });

    it('drops a binding to an interface the device does not have, then binds the end again', () => {
      const { canvas } = onlyCanvas(
        fileWithCanvas({
          ...oldCanvas,
          connections: [{ id: 'conn-0', source: 'dev-1', target: 'dev-0', targetPort: 99 }],
        })
      );

      expect(canvas.connections[0].targetPort).toBe(1);
      expect(isEndBound(canvas.connections[0], 'source')).toBe(true);
    });
  });

  // ---------- the public reference ----------

  describe('docs/project-file.md', () => {
    // (the checkout may have either kind of line ending)
    const example = /```json\r?\n([\s\S]*?)\r?\n```/.exec(formatReference)?.[1] ?? '';

    it('its example is a file the parser opens as it is, with nothing to repair', () => {
      const result = parseProjectFile(example);

      expect(result).toMatchObject({ ok: true, warnings: [] });
      if (!result.ok) return;
      expect(result.project).toEqual(JSON.parse(example));
    });

    it('its example lists every key in the order the serialiser writes it', () => {
      const result = parseProjectFile(example);
      if (!result.ok) throw new Error(result.error);

      // same text once the layout of the hand-written example is evened out
      expect(serializeProject(result.project)).toBe(
        `${JSON.stringify(JSON.parse(example), null, 2)}\n`
      );
    });
  });

  // ---------- names ----------

  describe('projectFileName', () => {
    it('makes the project name safe for a file name and adds the extension', () => {
      expect(projectFileName('Sede Milano')).toBe('sede-milano.pixelcake.json');
      expect(projectFileName('  Rete: A/B\\C? "2026"  ')).toBe('rete-a-b-c-2026.pixelcake.json');
      expect(projectFileName('Città più grande')).toBe('citta-piu-grande.pixelcake.json');
    });

    it('falls back to progetto.pixelcake.json when nothing usable is left', () => {
      expect(projectFileName('')).toBe('progetto.pixelcake.json');
      expect(projectFileName('???')).toBe('progetto.pixelcake.json');
      expect(projectFileName('日本')).toBe('progetto.pixelcake.json');
    });

    it('keeps the name to a reasonable length', () => {
      const name = projectFileName('a'.repeat(300));

      expect(name).toBe(`${'a'.repeat(80)}.pixelcake.json`);
    });
  });

  describe('fileSlug', () => {
    it('is the name in plain lower-case letters and digits, hyphens in between', () => {
      expect(fileSlug('Sede Milano')).toBe('sede-milano');
      expect(fileSlug('  Rete: A/B\\C? "2026"  ')).toBe('rete-a-b-c-2026');
      expect(fileSlug('Città più grande')).toBe('citta-piu-grande');
      expect(fileSlug('a'.repeat(300))).toBe('a'.repeat(80));
      // cut at 80, it does not end on a hyphen
      expect(fileSlug(`${'a'.repeat(79)} b`)).toBe('a'.repeat(79));
    });

    it('is empty when nothing of the name can go in a file name', () => {
      expect(fileSlug('')).toBe('');
      expect(fileSlug('???')).toBe('');
      expect(fileSlug('日本')).toBe('');
    });
  });

  describe('nextCanvasId', () => {
    it('is one above the highest canvas-N in use', () => {
      expect(nextCanvasId(['canvas-1'])).toBe('canvas-2');
      expect(nextCanvasId(['canvas-1', 'canvas-9', 'canvas-3'])).toBe('canvas-10');
      // a deleted canvas does not free its number while a higher one exists
      expect(nextCanvasId(['canvas-1', 'canvas-3'])).toBe('canvas-4');
    });

    it('starts at 1 when no id has that shape', () => {
      expect(nextCanvasId([])).toBe('canvas-1');
      expect(nextCanvasId(['main', 'dmz'])).toBe('canvas-1');
    });
  });
});
