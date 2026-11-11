/**
 * The project kept in the browser: projectStore (name, description, canvases)
 * driving networkStore (the canvas on screen).
 *
 * - the "changed since the last file" flag: set by edits, not by looking;
 * - canvas isolation: whatever the sequence of switch/add/delete, each canvas
 *   holds exactly its own devices and connections;
 * - the drawing of a browser that used an earlier version becomes the content
 *   of the default project, untouched;
 * - a localStorage write that fails does not break the action.
 *
 * Isolation: both stores are module singletons that read localStorage when
 * they are created, so each test re-imports them (a re-import is a reload).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import type {
  ConnectionTemplate,
  DeviceTemplate,
  NetworkConnection,
  NetworkDevice,
  NetworkInterfaceCard,
  ProjectFile,
  StoredCanvas,
} from '@/types';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const NETWORK_KEY = 'pixelcake-network-v2';
const PROJECT_KEY = 'pixelcake-project-v1';

type NewDevice = Omit<NetworkDevice, 'id'>;

function nic(ip: string): NetworkInterfaceCard {
  return {
    id: 'nic-1',
    name: 'eth0',
    enabled: true,
    speed: 'auto',
    ip,
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
  };
}

function makePc(label: string, ip = '192.168.1.10'): NewDevice {
  return {
    type: 'PC',
    label,
    ip,
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
    nics: [nic(ip)],
  };
}

function makeSwitch(label: string): NewDevice {
  return {
    type: 'Switch',
    label,
    ip: '192.168.1.2',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 100, y: 0 },
    portCount: 4,
    ports: [1, 2, 3, 4].map(id => ({ id, enabled: true })),
  };
}

/** Import the stores afresh: what a page load does */
async function loadApp() {
  vi.resetModules();
  const { toast } = await import('sonner');
  const { useNetworkStore } = await import('./networkStore');
  const { useProjectStore } = await import('./projectStore');
  const { useTemplateStore } = await import('./templateStore');
  const { useSimulationStore } = await import('./simulationStore');
  return {
    network: useNetworkStore,
    project: useProjectStore,
    templates: useTemplateStore,
    simulation: useSimulationStore,
    toastError: toast.error as Mock,
  };
}

type App = Awaited<ReturnType<typeof loadApp>>;

const labels = (devices: NetworkDevice[]) => devices.map(d => d.label);

/** The whole project as it would be written to a file, canvas on screen included */
function fileOf(app: App): ProjectFile {
  return app.project.getState().buildProjectFile();
}

function canvasOf(app: App, canvasId: string): StoredCanvas {
  const canvas = fileOf(app).canvases.find(c => c.id === canvasId);
  if (!canvas) throw new Error(`no canvas ${canvasId}`);
  return canvas;
}

function stored<T>(key: string): T {
  const raw = localStorage.getItem(key);
  if (raw === null) throw new Error(`nothing stored under ${key}`);
  return JSON.parse(raw).state as T;
}

describe('project in the browser', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ---------- there is always a project ----------

  describe('a fresh browser', () => {
    it('starts with "Progetto senza nome", one empty "Canvas 1", nothing to save', async () => {
      const app = await loadApp();

      expect(app.project.getState()).toMatchObject({
        name: 'Progetto senza nome',
        description: '',
        activeCanvasId: 'canvas-1',
      });
      expect(app.project.getState().canvases).toEqual([
        {
          id: 'canvas-1',
          name: 'Canvas 1',
          devices: [],
          connections: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          deviceCounter: 0,
          connectionCounter: 0,
        },
      ]);
      expect(app.network.getState().devices).toEqual([]);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('writes the project to its own localStorage key', async () => {
      await loadApp();

      expect(stored<{ name: string }>(PROJECT_KEY).name).toBe('Progetto senza nome');
    });
  });

  // ---------- changed flag ----------

  describe('changed flag', () => {
    /** Two linked devices on screen, flag cleared */
    async function appWithDrawing(): Promise<App> {
      const app = await loadApp();
      const network = app.network.getState();
      network.addDevice(makeSwitch('SW-1')); // dev-0
      network.addDevice(makePc('PC-1')); // dev-1
      network.addConnection({ source: 'dev-1', target: 'dev-0' }); // conn-0
      network.markSaved();
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
      return app;
    }

    const edits: Array<[string, (app: App) => void]> = [
      ['addDevice', app => app.network.getState().addDevice(makePc('PC-2'))],
      ['updateDevice', app => app.network.getState().updateDevice('dev-1', { label: 'X' })],
      [
        'updateDevice (moving a device)',
        app => app.network.getState().updateDevice('dev-1', { position: { x: 5, y: 5 } }),
      ],
      ['removeDevice', app => app.network.getState().removeDevice('dev-1')],
      [
        'addConnection',
        app => {
          app.network.getState().addDevice(makePc('PC-2'));
          app.network.getState().markSaved();
          app.network.getState().addConnection({ source: 'dev-2', target: 'dev-0' });
        },
      ],
      [
        'updateConnection',
        app => app.network.getState().updateConnection('conn-0', { label: 'x' }),
      ],
      ['removeConnection', app => app.network.getState().removeConnection('conn-0')],
      [
        'paste',
        app => {
          app.network.getState().selectMultipleDevices(['dev-0', 'dev-1']);
          app.network.getState().copySelection();
          app.network.getState().paste();
        },
      ],
      ['applyAutoLayout', app => app.network.getState().applyAutoLayout()],
      [
        'autoConnectDevices',
        app => {
          app.network.getState().removeConnection('conn-0');
          app.network.getState().markSaved();
          app.network.getState().autoConnectDevices();
        },
      ],
      ['clearAllDevices', app => app.network.getState().clearAllDevices()],
      [
        'loadTopology (sample, YAML import)',
        app => app.network.getState().loadTopology([{ ...makePc('PC-9'), id: 'x' }], []),
      ],
      [
        'setGlobalNetworkSettings',
        app => app.network.getState().setGlobalNetworkSettings({ gateway: '192.168.1.254' }),
      ],
      ['renameProject', app => app.project.getState().renameProject('Sede Roma')],
      ['setDescription', app => app.project.getState().setDescription('Uffici')],
      ['addCanvas', app => void app.project.getState().addCanvas('DMZ')],
      ['renameCanvas', app => app.project.getState().renameCanvas('canvas-1', 'Piano terra')],
      [
        'deleteCanvas',
        app => {
          const id = app.project.getState().addCanvas();
          app.network.getState().markSaved();
          app.project.getState().deleteCanvas(id);
        },
      ],
    ];

    it.each(edits)('is set by %s', async (_name, edit) => {
      const app = await appWithDrawing();

      edit(app);

      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    const notEdits: Array<[string, (app: App) => void]> = [
      [
        'setViewport (pan, zoom)',
        app => app.network.getState().setViewport({ x: 9, y: 9, zoom: 2 }),
      ],
      ['selecting devices', app => app.network.getState().selectMultipleDevices(['dev-0'])],
      ['setSelectedDevice', app => app.network.getState().setSelectedDevice('dev-0')],
      ['hovering a device', app => app.network.getState().setHoveredDevice('dev-0')],
      [
        'copySelection',
        app => {
          app.network.getState().selectMultipleDevices(['dev-0']);
          app.network.getState().copySelection();
        },
      ],
      ['triggerFitView', app => app.network.getState().triggerFitView()],
      [
        'starting and cancelling a link',
        app => {
          app.network.getState().startConnection('dev-0', null);
          app.network.getState().cancelConnection();
        },
      ],
      [
        'renaming the project to the name it has',
        app => app.project.getState().renameProject('Progetto senza nome'),
      ],
      ['renaming the project to nothing', app => app.project.getState().renameProject('   ')],
      [
        'renaming a canvas to the name it has',
        app => app.project.getState().renameCanvas('canvas-1', ' Canvas 1 '),
      ],
      [
        'deleting the last canvas (refused)',
        app => void app.project.getState().deleteCanvas('canvas-1'),
      ],
      ['building the project file', app => void app.project.getState().buildProjectFile()],
    ];

    it.each(notEdits)('is not set by %s', async (_name, action) => {
      const app = await appWithDrawing();

      action(app);

      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('is not set by switching canvas, and is not cleared by it either', async () => {
      const app = await appWithDrawing();
      const second = app.project.getState().addCanvas();
      app.network.getState().markSaved();

      app.project.getState().switchCanvas(second);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);

      app.network.getState().addDevice(makePc('PC-B'));
      app.project.getState().switchCanvas('canvas-1');
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('viewport changes are still remembered, they just are not edits', async () => {
      const app = await appWithDrawing();

      app.network.getState().setViewport({ x: 30, y: -40, zoom: 1.5 });

      expect(stored<{ viewport: unknown }>(NETWORK_KEY).viewport).toEqual({
        x: 30,
        y: -40,
        zoom: 1.5,
      });
      expect(canvasOf(app, 'canvas-1').viewport).toEqual({ x: 30, y: -40, zoom: 1.5 });
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('survives a reload, set or cleared', async () => {
      const first = await appWithDrawing();
      first.network.getState().addDevice(makePc('PC-2'));

      const second = await loadApp();
      expect(second.network.getState().hasUnsavedChanges).toBe(true);
      second.network.getState().markSaved();

      const third = await loadApp();
      expect(third.network.getState().hasUnsavedChanges).toBe(false);
      expect(labels(third.network.getState().devices)).toEqual(['SW-1', 'PC-1', 'PC-2']);
    });

    it('markSaved with a token leaves the flag set when an edit landed after the token', async () => {
      const app = await appWithDrawing();
      const network = app.network.getState();
      network.addDevice(makePc('PC-2'));

      const token = network.getChangeToken(); // the file is built here…
      network.addDevice(makePc('PC-3')); // …and this edit is not in it
      network.markSaved(token);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);

      network.markSaved(network.getChangeToken());
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });
  });

  // ---------- canvases ----------

  describe('canvases', () => {
    it('addCanvas gives ids canvas-N from the highest in use, and does not switch', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('PC-A'));
      const project = app.project.getState();

      expect(project.addCanvas('DMZ')).toBe('canvas-2');
      expect(project.addCanvas()).toBe('canvas-3');
      project.deleteCanvas('canvas-2');
      // canvas-2 is free again, but ids are never handed out twice in a row
      expect(project.addCanvas('  ')).toBe('canvas-4');

      expect(app.project.getState().canvases.map(c => [c.id, c.name])).toEqual([
        ['canvas-1', 'Canvas 1'],
        ['canvas-3', 'Canvas 3'],
        ['canvas-4', 'Canvas 4'],
      ]);
      expect(app.project.getState().activeCanvasId).toBe('canvas-1');
      expect(labels(app.network.getState().devices)).toEqual(['PC-A']);
      expect(canvasOf(app, 'canvas-3')).toMatchObject({
        devices: [],
        connections: [],
        deviceCounter: 0,
        connectionCounter: 0,
      });
    });

    it('renameCanvas renames only that canvas; an empty name is ignored', async () => {
      const app = await loadApp();
      const second = app.project.getState().addCanvas('DMZ');

      app.project.getState().renameCanvas(second, '  Sala server  ');
      app.project.getState().renameCanvas('canvas-1', '');
      app.project.getState().renameCanvas('canvas-99', 'Fantasma');

      expect(app.project.getState().canvases.map(c => c.name)).toEqual(['Canvas 1', 'Sala server']);
    });

    it('renameProject and setDescription trim; an empty name is ignored', async () => {
      const app = await loadApp();

      app.project.getState().renameProject('  Sede Milano ');
      app.project.getState().setDescription('  Uffici  ');
      app.project.getState().renameProject('');

      expect(app.project.getState()).toMatchObject({ name: 'Sede Milano', description: 'Uffici' });
      app.project.getState().setDescription('');
      expect(app.project.getState().description).toBe('');
    });

    it('each canvas keeps its own devices and connections across switches', async () => {
      const app = await loadApp();
      const network = () => app.network.getState();
      const project = () => app.project.getState();

      // Canvas 1: a switch, a PC and their link
      network().addDevice(makeSwitch('A-SW'));
      network().addDevice(makePc('A-PC'));
      network().addConnection({ source: 'dev-1', target: 'dev-0' });

      // Canvas 2: one PC
      const second = project().addCanvas('B');
      project().switchCanvas(second);
      expect(network().devices).toEqual([]);
      expect(network().connections).toEqual([]);
      network().addDevice(makePc('B-PC'));

      // Canvas 3: two PCs and a link between them
      const third = project().addCanvas('C');
      project().switchCanvas(third);
      network().addDevice(makePc('C-PC1', '192.168.1.21'));
      network().addDevice(makePc('C-PC2', '192.168.1.22'));
      network().addConnection({ source: 'dev-0', target: 'dev-1' });

      // Back to canvas 1: exactly what was left there
      project().switchCanvas('canvas-1');
      expect(labels(network().devices)).toEqual(['A-SW', 'A-PC']);
      expect(network().connections).toMatchObject([
        { id: 'conn-0', source: 'dev-1', target: 'dev-0', sourceNic: 'nic-1', targetPort: 1 },
      ]);

      project().switchCanvas(second);
      expect(labels(network().devices)).toEqual(['B-PC']);
      expect(network().connections).toEqual([]);

      project().switchCanvas(third);
      expect(labels(network().devices)).toEqual(['C-PC1', 'C-PC2']);
      expect(network().connections).toHaveLength(1);

      // And the project as a whole says the same
      const file = fileOf(app);
      expect(file.canvases.map(c => [c.name, labels(c.devices), c.connections.length])).toEqual([
        ['Canvas 1', ['A-SW', 'A-PC'], 1],
        ['B', ['B-PC'], 0],
        ['C', ['C-PC1', 'C-PC2'], 1],
      ]);
    });

    it('ids, counters and viewport are per canvas', async () => {
      const app = await loadApp();
      const network = () => app.network.getState();
      const project = () => app.project.getState();

      network().addDevice(makePc('A-1')); // dev-0
      network().addDevice(makePc('A-2')); // dev-1
      network().removeDevice('dev-1');
      network().setViewport({ x: 100, y: 200, zoom: 0.5 });

      const second = project().addCanvas();
      project().switchCanvas(second);
      expect(network().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      network().addDevice(makePc('B-1'));
      expect(network().devices.map(d => d.id)).toEqual(['dev-0']); // starts over

      project().switchCanvas('canvas-1');
      expect(network().viewport).toEqual({ x: 100, y: 200, zoom: 0.5 });
      network().addDevice(makePc('A-3'));
      // the counter of canvas 1 went on from where it was: dev-1 is not reused
      expect(network().devices.map(d => d.id)).toEqual(['dev-0', 'dev-2']);
    });

    it('survives any sequence of switch, add, delete and edits (checked against a model)', async () => {
      const app = await loadApp();
      const network = () => app.network.getState();
      const project = () => app.project.getState();

      // The model: canvas id → labels of its devices, plus the active canvas
      const model = new Map<string, string[]>([['canvas-1', []]]);
      let active = 'canvas-1';
      let serial = 0;

      // Small deterministic generator, so a failure can be replayed
      let seed = 20261111;
      const random = (n: number) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % n;
      };

      const check = (step: string) => {
        const file = fileOf(app);
        const actual = new Map(file.canvases.map(c => [c.id, labels(c.devices)]));
        expect(actual, step).toEqual(model);
        expect(project().activeCanvasId, step).toBe(active);
        expect(labels(network().devices), step).toEqual(model.get(active));
        for (const canvas of file.canvases) {
          const ids = new Set(canvas.devices.map(d => d.id));
          expect(ids.size, step).toBe(canvas.devices.length);
          // every device carries the id of the canvas it was created on
          for (const label of labels(canvas.devices)) {
            expect(label.startsWith(`${canvas.id}/`), `${step}: ${label} in ${canvas.id}`).toBe(
              true
            );
          }
          for (const connection of canvas.connections) {
            expect(ids.has(connection.source) && ids.has(connection.target), step).toBe(true);
          }
        }
      };

      for (let i = 0; i < 400; i++) {
        const ids = [...model.keys()];
        const roll = random(100);
        let step: string;

        if (roll < 35) {
          const label = `${active}/${serial++}`;
          network().addDevice(makePc(label));
          model.get(active)!.push(label);
          step = `#${i} add device ${label}`;
        } else if (roll < 45) {
          const devices = network().devices;
          if (devices.length >= 2) {
            network().addConnection({ source: devices[0].id, target: devices[1].id });
          }
          step = `#${i} add connection on ${active}`;
        } else if (roll < 55) {
          const devices = network().devices;
          if (devices.length > 0) {
            const victim = devices[random(devices.length)];
            network().removeDevice(victim.id);
            model.set(
              active,
              model.get(active)!.filter(label => label !== victim.label)
            );
          }
          step = `#${i} remove device on ${active}`;
        } else if (roll < 80) {
          const target = ids[random(ids.length)];
          project().switchCanvas(target);
          active = target;
          step = `#${i} switch to ${target}`;
        } else if (roll < 90) {
          const id = project().addCanvas();
          model.set(id, []);
          step = `#${i} add canvas ${id}`;
        } else {
          const target = ids[random(ids.length)];
          const index = ids.indexOf(target);
          const deleted = project().deleteCanvas(target);
          expect(deleted, `#${i} delete ${target}`).toBe(ids.length > 1);
          if (deleted) {
            model.delete(target);
            if (target === active) active = ids.filter(id => id !== target)[Math.max(0, index - 1)];
          }
          step = `#${i} delete canvas ${target}`;
        }

        check(step);
      }

      // The run really exercised several canvases
      expect(serial).toBeGreaterThan(50);
    });

    it('switching resets the selection and bumps the canvas revision (the view applies the viewport)', async () => {
      const app = await loadApp();
      const second = app.project.getState().addCanvas();
      app.network.getState().addDevice(makePc('A-1'));
      app.network.getState().setSelectedDevice('dev-0');
      app.network.getState().selectMultipleDevices(['dev-0']);
      app.network.getState().startConnection('dev-0', null);
      const revision = app.network.getState().canvasRevision;

      app.project.getState().switchCanvas(second);

      expect(app.network.getState()).toMatchObject({
        selectedDeviceId: null,
        selectedDeviceIds: [],
        isConnecting: false,
        connectionStart: null,
        canvasId: second,
        canvasRevision: revision + 1,
      });
    });

    it('switching to the active canvas or to one that does not exist does nothing', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('A-1'));
      app.network.getState().selectMultipleDevices(['dev-0']);
      const revision = app.network.getState().canvasRevision;

      app.project.getState().switchCanvas('canvas-1');
      app.project.getState().switchCanvas('canvas-99');

      expect(app.project.getState().activeCanvasId).toBe('canvas-1');
      expect(app.network.getState().canvasRevision).toBe(revision);
      expect(app.network.getState().selectedDeviceIds).toEqual(['dev-0']);
      expect(labels(app.network.getState().devices)).toEqual(['A-1']);
    });

    it('switching stops a running simulation', async () => {
      const app = await loadApp();
      const second = app.project.getState().addCanvas();
      app.simulation.getState().startSimulation(['dev-0', 'dev-1'], 'ping');
      expect(app.simulation.getState().isRunning).toBe(true);

      app.project.getState().switchCanvas(second);

      expect(app.simulation.getState().isRunning).toBe(false);
      expect(app.simulation.getState().path).toEqual([]);
    });

    it('the last canvas cannot be deleted', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('A-1'));

      expect(app.project.getState().deleteCanvas('canvas-1')).toBe(false);

      expect(app.project.getState().canvases.map(c => c.id)).toEqual(['canvas-1']);
      expect(app.project.getState().activeCanvasId).toBe('canvas-1');
      expect(labels(app.network.getState().devices)).toEqual(['A-1']);
    });

    it('deleting a canvas that does not exist is refused', async () => {
      const app = await loadApp();
      app.project.getState().addCanvas();

      expect(app.project.getState().deleteCanvas('canvas-99')).toBe(false);
      expect(app.project.getState().canvases).toHaveLength(2);
    });

    it('deleting another canvas leaves the one on screen alone', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('A-1'));
      const second = app.project.getState().addCanvas('B');
      app.project.getState().switchCanvas(second);
      app.network.getState().addDevice(makePc('B-1'));
      const revision = app.network.getState().canvasRevision;

      expect(app.project.getState().deleteCanvas('canvas-1')).toBe(true);

      expect(app.project.getState().activeCanvasId).toBe(second);
      expect(app.network.getState().canvasRevision).toBe(revision);
      expect(labels(app.network.getState().devices)).toEqual(['B-1']);
      expect(fileOf(app).canvases.map(c => [c.id, labels(c.devices)])).toEqual([[second, ['B-1']]]);
    });

    it('deleting the canvas on screen shows its neighbour and drops its content', async () => {
      const app = await loadApp();
      const network = () => app.network.getState();
      const project = () => app.project.getState();
      network().addDevice(makePc('A-1'));
      const second = project().addCanvas('B');
      const third = project().addCanvas('C');
      project().switchCanvas(third);
      network().addDevice(makePc('C-1'));
      project().switchCanvas(second);
      network().addDevice(makePc('B-1'));
      network().addDevice(makePc('B-2'));

      expect(project().deleteCanvas(second)).toBe(true);

      // the canvas before it in the list is now on screen, with its own content
      expect(project().activeCanvasId).toBe('canvas-1');
      expect(network().canvasId).toBe('canvas-1');
      expect(labels(network().devices)).toEqual(['A-1']);
      const file = fileOf(app);
      expect(file.canvases.map(c => [c.id, labels(c.devices)])).toEqual([
        ['canvas-1', ['A-1']],
        [third, ['C-1']],
      ]);
      expect(JSON.stringify(file)).not.toContain('B-1');
    });

    it('deleting the first canvas while it is on screen shows the next one', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('A-1'));
      const second = app.project.getState().addCanvas('B');

      expect(app.project.getState().deleteCanvas('canvas-1')).toBe(true);

      expect(app.project.getState().activeCanvasId).toBe(second);
      expect(app.network.getState().devices).toEqual([]);
    });
  });

  // ---------- the whole project ----------

  describe('buildProjectFile', () => {
    it('contains the canvas on screen as it is now, even though its entry is only refreshed on commit', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('PC-1'));
      app.network.getState().setViewport({ x: 7, y: 8, zoom: 1.25 });

      // the stored entry is stale by design…
      expect(app.project.getState().canvases[0].devices).toEqual([]);

      // …the file is not
      const file = fileOf(app);
      expect(file).toMatchObject({
        format: 'pixelcake-project',
        version: 1,
        name: 'Progetto senza nome',
        description: '',
        activeCanvasId: 'canvas-1',
        settings: {
          ipClass: '192.168.1.0',
          subnet: '255.255.255.0',
          gateway: '192.168.1.1',
          emailMode: 'auto',
        },
      });
      expect(file.canvases).toHaveLength(1);
      expect(file.canvases[0]).toMatchObject({
        id: 'canvas-1',
        name: 'Canvas 1',
        viewport: { x: 7, y: 8, zoom: 1.25 },
        deviceCounter: 1,
        connectionCounter: 0,
      });
      expect(labels(file.canvases[0].devices)).toEqual(['PC-1']);
      expect(new Date(file.savedAt).toISOString()).toBe(file.savedAt);
    });

    it('carries the custom templates only', async () => {
      const app = await loadApp();
      app.templates.getState().addTemplate({
        name: 'NVR',
        type: 'Server',
        icon: 'mdi:cctv',
        color: '#123456',
        isCustom: true,
        supportsVLAN: false,
        supportsSTP: false,
        supportsPorts: false,
        supportsNICs: true,
      });
      app.templates.getState().addConnectionTemplate({
        name: 'Fibra',
        type: 'fiber',
        color: '#00aa88',
        lineStyle: 'dashed',
        strokeWidth: 3,
        isCustom: true,
      });

      const { templates } = fileOf(app);

      expect(templates.devices.map(t => t.name)).toEqual(['NVR']);
      expect(templates.connections.map(t => t.name)).toEqual(['Fibra']);
      expect(app.templates.getState().templates.length).toBeGreaterThan(1);
    });
  });

  // ---------- new / opened project ----------

  describe('createProject', () => {
    it('replaces the open project with an empty one and has nothing to save', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('PC-1'));
      app.network.getState().setViewport({ x: 50, y: 50, zoom: 2 });
      app.project.getState().addCanvas('B');
      app.simulation.getState().startSimulation(['dev-0'], 'ping');

      app.project.getState().createProject({
        name: '  Sede Roma ',
        description: ' Nuova sede ',
        settings: { ipClass: '10.0.0.0', subnet: '255.0.0.0', gateway: '10.0.0.1' },
      });

      expect(app.project.getState()).toMatchObject({
        name: 'Sede Roma',
        description: 'Nuova sede',
        activeCanvasId: 'canvas-1',
      });
      expect(app.project.getState().canvases.map(c => [c.id, c.name])).toEqual([
        ['canvas-1', 'Canvas 1'],
      ]);
      expect(app.network.getState()).toMatchObject({
        devices: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 0,
        connectionCounter: 0,
        hasUnsavedChanges: false,
        globalNetworkSettings: {
          ipClass: '10.0.0.0',
          subnet: '255.0.0.0',
          gateway: '10.0.0.1',
          emailMode: 'auto',
        },
      });
      expect(app.simulation.getState().isRunning).toBe(false);
    });

    it('falls back to the default name and network', async () => {
      const app = await loadApp();
      app.network
        .getState()
        .setGlobalNetworkSettings({ ipClass: '172.16.0.0', emailMode: 'cloud' });

      app.project.getState().createProject({ name: '   ' });

      expect(app.project.getState().name).toBe('Progetto senza nome');
      expect(app.network.getState().globalNetworkSettings).toEqual({
        ipClass: '192.168.1.0',
        subnet: '255.255.255.0',
        gateway: '192.168.1.1',
        emailMode: 'auto',
      });
    });
  });

  describe('loadProject', () => {
    const customTemplate: DeviceTemplate = {
      id: 'tpl-1700000000000',
      name: 'NVR',
      type: 'Server',
      icon: 'mdi:cctv',
      color: '#123456',
      isCustom: true,
      supportsVLAN: false,
      supportsSTP: false,
      supportsPorts: false,
      supportsNICs: true,
    };
    const fiber: ConnectionTemplate = {
      id: 'conn-1700000000001',
      name: 'Fibra',
      type: 'fiber',
      color: '#00aa88',
      lineStyle: 'dashed',
      strokeWidth: 3,
      isCustom: true,
    };

    function projectFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
      return {
        format: 'pixelcake-project',
        version: 1,
        name: 'Sede Milano',
        description: 'Uffici',
        savedAt: '2026-11-11T12:00:00.000Z',
        settings: { ipClass: '10.1.0.0', subnet: '255.255.0.0', gateway: '10.1.0.1' },
        activeCanvasId: 'canvas-2',
        canvases: [
          {
            id: 'canvas-1',
            name: 'Uffici',
            devices: [{ ...makePc('U-1'), id: 'dev-0' }],
            connections: [],
            viewport: { x: 0, y: 0, zoom: 1 },
            deviceCounter: 1,
            connectionCounter: 0,
          },
          {
            id: 'canvas-2',
            name: 'Magazzino',
            devices: [
              { ...makeSwitch('M-SW'), id: 'dev-0' },
              { ...makePc('M-1'), id: 'dev-3' },
            ],
            connections: [
              { id: 'conn-2', source: 'dev-3', target: 'dev-0', sourceNic: 'nic-1', targetPort: 4 },
            ],
            viewport: { x: 12, y: 34, zoom: 0.8 },
            deviceCounter: 4,
            connectionCounter: 3,
          },
        ],
        templates: { devices: [], connections: [] },
        ...overrides,
      };
    }

    it('replaces the whole project, shows its active canvas and has nothing to save', async () => {
      const app = await loadApp();
      app.network.getState().addDevice(makePc('OLD'));
      app.project.getState().addCanvas('Old B');
      expect(app.network.getState().hasUnsavedChanges).toBe(true);

      app.project.getState().loadProject(projectFile());

      expect(app.project.getState()).toMatchObject({
        name: 'Sede Milano',
        description: 'Uffici',
        activeCanvasId: 'canvas-2',
      });
      expect(app.project.getState().canvases.map(c => c.name)).toEqual(['Uffici', 'Magazzino']);
      expect(app.network.getState()).toMatchObject({
        canvasId: 'canvas-2',
        viewport: { x: 12, y: 34, zoom: 0.8 },
        deviceCounter: 4,
        connectionCounter: 3,
        hasUnsavedChanges: false,
        globalNetworkSettings: { ipClass: '10.1.0.0', subnet: '255.255.0.0', gateway: '10.1.0.1' },
      });
      expect(labels(app.network.getState().devices)).toEqual(['M-SW', 'M-1']);
      expect(JSON.stringify(fileOf(app))).not.toContain('OLD');

      // and the other canvas is there, untouched, when it is opened
      app.project.getState().switchCanvas('canvas-1');
      expect(labels(app.network.getState().devices)).toEqual(['U-1']);
      // the next device on canvas 2 does not take an id in use
      app.project.getState().switchCanvas('canvas-2');
      app.network.getState().addDevice(makePc('M-2'));
      expect(app.network.getState().devices.at(-1)?.id).toBe('dev-4');
    });

    it('a project saved before links were bound opens bound, in memory, with nothing to save', async () => {
      const app = await loadApp();
      const unbound: NetworkConnection[] = [{ id: 'conn-2', source: 'dev-3', target: 'dev-0' }];
      const file = projectFile();
      file.canvases[1].connections = unbound;

      app.project.getState().loadProject(file);

      expect(app.network.getState().connections).toMatchObject([
        { id: 'conn-2', sourceNic: 'nic-1', targetPort: 1 },
      ]);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
      // the bindings are in the next file that is written
      expect(canvasOf(app, 'canvas-2').connections[0]).toMatchObject({ targetPort: 1 });
    });

    it('adds the custom templates that are not here yet and never overwrites one that is', async () => {
      const app = await loadApp();
      app.templates.setState(state => ({
        templates: [...state.templates, { ...customTemplate, name: 'NVR (mio)' }],
      }));
      const builtIn = app.templates.getState().templates.find(t => t.id === 'tpl-pc');

      app.project.getState().loadProject(
        projectFile({
          templates: {
            devices: [
              customTemplate, // same id as one already here
              { ...customTemplate, id: 'tpl-1700000000009', name: 'Telecamera' },
              { ...customTemplate, id: 'tpl-pc', name: 'PC rimpiazzato' }, // id of a built-in one
            ],
            connections: [
              fiber,
              { ...fiber, id: 'conn-x', type: 'trunk', name: 'Trunk rimpiazzato' }, // type already here
            ],
          },
        })
      );

      const templates = app.templates.getState();
      expect(templates.templates.filter(t => t.isCustom).map(t => t.name)).toEqual([
        'NVR (mio)',
        'Telecamera',
      ]);
      expect(templates.templates.find(t => t.id === 'tpl-pc')).toEqual(builtIn);
      expect(templates.connectionTemplates.filter(t => t.isCustom).map(t => t.name)).toEqual([
        'Fibra',
      ]);
      expect(templates.getConnectionTemplateByType('trunk')?.name).toBe('Trunk');
    });
  });

  // ---------- reload ----------

  describe('reload', () => {
    it('brings back the project, the active canvas and the edits made since the last switch', async () => {
      const first = await loadApp();
      first.project.getState().renameProject('Sede Milano');
      first.network.getState().addDevice(makePc('A-1'));
      const second = first.project.getState().addCanvas('B');
      first.project.getState().switchCanvas(second);
      first.network.getState().addDevice(makePc('B-1'));
      first.network.getState().addDevice(makePc('B-2')); // never committed: only on screen

      const reloaded = await loadApp();

      expect(reloaded.project.getState()).toMatchObject({
        name: 'Sede Milano',
        activeCanvasId: second,
      });
      expect(labels(reloaded.network.getState().devices)).toEqual(['B-1', 'B-2']);
      expect(fileOf(reloaded).canvases.map(c => [c.name, labels(c.devices)])).toEqual([
        ['Canvas 1', ['A-1']],
        ['B', ['B-1', 'B-2']],
      ]);
      reloaded.project.getState().switchCanvas('canvas-1');
      expect(labels(reloaded.network.getState().devices)).toEqual(['A-1']);
    });

    it('the canvas on screen is never taken for another one when the two keys disagree', async () => {
      // What a failed write or a second tab can leave behind: the project
      // says canvas-1 is active, the drawing on screen belongs to canvas-2
      const first = await loadApp();
      first.network.getState().addDevice(makePc('A-1'));
      const second = first.project.getState().addCanvas('B');
      first.project.getState().switchCanvas(second);
      first.network.getState().addDevice(makePc('B-1'));
      const project = stored<{ activeCanvasId: string }>(PROJECT_KEY);
      localStorage.setItem(
        PROJECT_KEY,
        JSON.stringify({ state: { ...project, activeCanvasId: 'canvas-1' }, version: 0 })
      );

      const reloaded = await loadApp();

      expect(reloaded.project.getState().activeCanvasId).toBe(second);
      expect(fileOf(reloaded).canvases.map(c => [c.id, labels(c.devices)])).toEqual([
        ['canvas-1', ['A-1']],
        [second, ['B-1']],
      ]);
    });

    it('a drawing whose canvas the project does not know is kept as a canvas of its own', async () => {
      const first = await loadApp();
      first.network.getState().addDevice(makePc('A-1'));
      const second = first.project.getState().addCanvas('B');
      const before = localStorage.getItem(PROJECT_KEY)!;
      const third = first.project.getState().addCanvas('C');
      first.project.getState().switchCanvas(third);
      first.network.getState().addDevice(makePc('C-1'));
      // the writes that recorded canvas C never reached the project key
      localStorage.setItem(PROJECT_KEY, before);

      const reloaded = await loadApp();

      expect(reloaded.project.getState().activeCanvasId).toBe(third);
      expect(fileOf(reloaded).canvases.map(c => [c.id, c.name, labels(c.devices)])).toEqual([
        ['canvas-1', 'Canvas 1', []], // its last commit was lost with the writes
        [second, 'B', []],
        [third, 'Canvas recuperato', ['C-1']],
      ]);
      expect(reloaded.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('a project key that cannot be read falls back to the default project, drawing intact', async () => {
      const first = await loadApp();
      first.network.getState().addDevice(makePc('A-1'));
      for (const broken of [
        '{ not json',
        JSON.stringify({ state: { canvases: [] }, version: 0 }),
      ]) {
        localStorage.setItem(PROJECT_KEY, broken);
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const reloaded = await loadApp();

        expect(reloaded.project.getState().canvases).toHaveLength(1);
        expect(labels(reloaded.network.getState().devices)).toEqual(['A-1']);
        expect(labels(fileOf(reloaded).canvases[0].devices)).toEqual(['A-1']);
      }
    });
  });

  // ---------- migration ----------

  describe('a browser that already holds a drawing from an earlier version', () => {
    const oldDevices: NetworkDevice[] = [
      { ...makeSwitch('SW-1'), id: 'dev-0' },
      { ...makePc('PC-1', '192.168.1.10'), id: 'dev-1' },
      { ...makePc('PC-2', '192.168.1.11'), id: 'dev-4' },
    ];
    const oldConnections: NetworkConnection[] = [
      { id: 'conn-0', source: 'dev-1', target: 'dev-0', sourceNic: 'nic-1', targetPort: 2 },
      { id: 'conn-3', source: 'dev-0', target: 'dev-4', type: 'access' }, // never bound
    ];

    /** pixelcake-network-v2 as the version with the server sync wrote it */
    function oldPersisted(overrides: Record<string, unknown> = {}) {
      return {
        state: {
          devices: oldDevices,
          connections: oldConnections,
          globalNetworkSettings: {
            ipClass: '10.0.0.0',
            subnet: '255.255.255.0',
            gateway: '10.0.0.1',
          },
          viewport: { x: -80, y: 45, zoom: 1.4 },
          deviceCounter: 5,
          connectionCounter: 4,
          currentProjectId: '6f1c2a3e-0000-4000-8000-000000000001',
          currentCanvasId: '6f1c2a3e-0000-4000-8000-000000000002',
          hasUnsavedChanges: false,
          ...overrides,
        },
        version: 0,
      };
    }

    it('the drawing becomes the single canvas of the default project, untouched', async () => {
      localStorage.setItem(NETWORK_KEY, JSON.stringify(oldPersisted()));
      expect(localStorage.getItem(PROJECT_KEY)).toBeNull();

      const app = await loadApp();

      expect(app.project.getState()).toMatchObject({
        name: 'Progetto senza nome',
        activeCanvasId: 'canvas-1',
      });
      expect(app.project.getState().canvases.map(c => [c.id, c.name])).toEqual([
        ['canvas-1', 'Canvas 1'],
      ]);

      // on screen: the same devices, the same links (the unbound one gets its
      // interfaces, as on every load), same view, same counters, same settings
      const live = app.network.getState();
      expect(live.devices).toEqual(oldDevices);
      expect(live.connections).toEqual([
        oldConnections[0],
        { ...oldConnections[1], sourcePort: 1, targetNic: 'nic-1' },
      ]);
      expect(live).toMatchObject({
        viewport: { x: -80, y: 45, zoom: 1.4 },
        deviceCounter: 5,
        connectionCounter: 4,
        globalNetworkSettings: { ipClass: '10.0.0.0', gateway: '10.0.0.1' },
      });

      // in the project: that drawing is the content of its only canvas
      const file = fileOf(app);
      expect(file.canvases).toHaveLength(1);
      expect(file.canvases[0]).toMatchObject({ deviceCounter: 5, connectionCounter: 4 });
      expect(file.canvases[0].devices).toEqual(oldDevices);
      expect(file.settings).toMatchObject({ ipClass: '10.0.0.0' });
    });

    it('ignores the ids of the removed server sync', async () => {
      localStorage.setItem(NETWORK_KEY, JSON.stringify(oldPersisted()));

      const app = await loadApp();

      expect(app.network.getState()).not.toHaveProperty('currentProjectId');
      expect(app.network.getState()).not.toHaveProperty('currentCanvasId');
      expect(app.network.getState().canvasId).toBeNull();
      expect(JSON.stringify(fileOf(app))).not.toContain('6f1c2a3e');
    });

    it('clears nothing: the drawing is still in localStorage after the first run', async () => {
      localStorage.setItem(NETWORK_KEY, JSON.stringify(oldPersisted()));

      await loadApp();

      const kept = stored<{ devices: NetworkDevice[]; connections: NetworkConnection[] }>(
        NETWORK_KEY
      );
      expect(kept.devices).toEqual(oldDevices);
      expect(kept.connections).toHaveLength(2);
      expect(localStorage.getItem(PROJECT_KEY)).not.toBeNull();
    });

    it('counts as not saved to a file yet, so nothing can replace it without asking', async () => {
      localStorage.setItem(NETWORK_KEY, JSON.stringify(oldPersisted()));

      const app = await loadApp();

      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('is adopted once: after a save to file, a reload does not mark it changed again', async () => {
      localStorage.setItem(NETWORK_KEY, JSON.stringify(oldPersisted()));
      const first = await loadApp();
      first.network.getState().markSaved(); // what saving to a file does

      const second = await loadApp();

      expect(second.network.getState().hasUnsavedChanges).toBe(false);
      expect(second.network.getState().devices).toEqual(oldDevices);
    });

    it('an empty old drawing has nothing to save', async () => {
      localStorage.setItem(
        NETWORK_KEY,
        JSON.stringify(oldPersisted({ devices: [], connections: [] }))
      );

      const app = await loadApp();

      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('the migrated drawing stays on its canvas when more canvases are added', async () => {
      localStorage.setItem(NETWORK_KEY, JSON.stringify(oldPersisted()));
      const app = await loadApp();

      const second = app.project.getState().addCanvas('Nuovo');
      app.project.getState().switchCanvas(second);
      app.network.getState().addDevice(makePc('N-1'));
      app.project.getState().switchCanvas('canvas-1');

      expect(app.network.getState().devices).toEqual(oldDevices);
      expect(fileOf(app).canvases.map(c => labels(c.devices))).toEqual([
        ['SW-1', 'PC-1', 'PC-2'],
        ['N-1'],
      ]);
    });
  });

  // ---------- storage full ----------

  describe('when localStorage refuses a write (quota)', () => {
    function refuseWrites() {
      return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      });
    }

    it('the edit still happens in memory and the user is told once to save to a file', async () => {
      const app = await loadApp();
      const setItem = refuseWrites();

      expect(() => {
        app.network.getState().addDevice(makePc('PC-1'));
        app.network.getState().addDevice(makePc('PC-2'));
        const second = app.project.getState().addCanvas('B');
        app.project.getState().switchCanvas(second);
        app.network.getState().addDevice(makePc('B-1'));
        app.project.getState().switchCanvas('canvas-1');
      }).not.toThrow();

      expect(setItem).toHaveBeenCalled();
      expect(labels(app.network.getState().devices)).toEqual(['PC-1', 'PC-2']);
      expect(fileOf(app).canvases.map(c => labels(c.devices))).toEqual([['PC-1', 'PC-2'], ['B-1']]);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);

      expect(app.toastError).toHaveBeenCalledTimes(1);
      expect(app.toastError.mock.calls[0][0]).toContain('Salva il progetto su file');
    });

    it('tells again if the problem comes back after writes had resumed', async () => {
      const app = await loadApp();
      const setItem = refuseWrites();
      app.network.getState().addDevice(makePc('PC-1'));
      expect(app.toastError).toHaveBeenCalledTimes(1);

      setItem.mockRestore();
      app.network.getState().addDevice(makePc('PC-2')); // written
      expect(stored<{ devices: unknown[] }>(NETWORK_KEY).devices).toHaveLength(2);

      refuseWrites();
      app.network.getState().addDevice(makePc('PC-3'));
      app.network.getState().addDevice(makePc('PC-4'));
      expect(app.toastError).toHaveBeenCalledTimes(2);
    });
  });
});
