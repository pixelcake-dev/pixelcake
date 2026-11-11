/**
 * Store-level tests for interface bindings: every path that creates a link
 * attaches it to a concrete interface (port or NIC), data saved before
 * bindings existed is migrated on load without saving by itself, and a link
 * never keeps pointing at an interface that was removed.
 *
 * Isolation: same pattern as networkStore.sync.test.ts — the store is a module
 * singleton with a module-level debounce, so each test re-imports it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import type { NetworkConnection, NetworkDevice, NetworkInterfaceCard, Port } from '@/types';
import { boundInterface, isEndBound } from '@/engine';

vi.mock('@/api', () => ({
  getCanvas: vi.fn(),
  updateCanvas: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

type NewDevice = Omit<NetworkDevice, 'id'>;

function ports(count: number): Port[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, enabled: true }));
}

function nic(id: string, name: string, ip: string): NetworkInterfaceCard {
  return {
    id,
    name,
    enabled: true,
    speed: 'auto',
    ip,
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
  };
}

function makeSwitch(label: string, portCount = 8, overrides: Partial<NewDevice> = {}): NewDevice {
  return {
    type: 'Switch',
    label,
    ip: '192.168.1.2',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
    portCount,
    ports: ports(portCount),
    ...overrides,
  };
}

function makePc(label: string, ip: string, overrides: Partial<NewDevice> = {}): NewDevice {
  return {
    type: 'PC',
    label,
    ip,
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
    nics: [nic('nic-1', 'eth0', ip)],
    ...overrides,
  };
}

/** A device as it was saved before ports/NICs carried bindings: same shape, given id */
function saved(id: string, device: NewDevice): NetworkDevice {
  return { ...device, id };
}

async function freshStore() {
  vi.resetModules();
  const api = await import('@/api');
  const { toast } = await import('sonner');
  const { useNetworkStore } = await import('./networkStore');
  return {
    store: useNetworkStore,
    updateCanvas: api.updateCanvas as Mock,
    getCanvas: api.getCanvas as Mock,
    // every kind of toast the store could raise
    toasts: [toast.success, toast.error, toast.warning, toast.info] as Mock[],
  };
}

/** `deviceId|interfaceKey` for every bound end, duplicates kept */
function claims(devices: NetworkDevice[], connections: NetworkConnection[]): string[] {
  const out: string[] = [];
  for (const connection of connections) {
    for (const end of ['source', 'target'] as const) {
      const device = devices.find(d => d.id === connection[end]);
      const iface = device ? boundInterface(connection, device, end) : undefined;
      if (device && iface) out.push(`${device.id}|${iface.key}`);
    }
  }
  return out;
}

function expectNoToast(toasts: Mock[]) {
  expect(toasts).toHaveLength(4);
  for (const toast of toasts) {
    expect(toast).not.toHaveBeenCalled();
  }
}

describe('networkStore interface bindings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ---------- addConnection ----------

  describe('addConnection', () => {
    it('binds both ends of a new link to the first free interface', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1')); // dev-0
      s.addDevice(makePc('PC-1', '192.168.1.10')); // dev-1
      s.addDevice(makePc('PC-2', '192.168.1.11')); // dev-2

      s.addConnection({ source: 'dev-1', target: 'dev-0' });
      s.addConnection({ source: 'dev-0', target: 'dev-2' });

      const [first, second] = store.getState().connections;
      expect(first).toMatchObject({ id: 'conn-0', sourceNic: 'nic-1', targetPort: 1 });
      expect(second).toMatchObject({ id: 'conn-1', sourcePort: 2, targetNic: 'nic-1' });
    });

    it('is the path used by endConnection (drag between two handles)', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1'));
      s.addDevice(makePc('PC-1', '192.168.1.10'));

      s.startConnection('dev-1', 'top');
      store.getState().endConnection('dev-0', 'bottom');

      expect(store.getState().connections[0]).toMatchObject({
        source: 'dev-1',
        target: 'dev-0',
        sourceHandle: 'top',
        targetHandle: 'bottom',
        sourceNic: 'nic-1',
        targetPort: 1,
      });
    });

    it('keeps a binding supplied by the caller when it holds', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1'));
      s.addDevice(makePc('PC-1', '192.168.1.10'));

      s.addConnection({ source: 'dev-1', target: 'dev-0', sourceNic: 'nic-1', targetPort: 5 });

      expect(store.getState().connections[0]).toMatchObject({ sourceNic: 'nic-1', targetPort: 5 });
    });

    it('replaces a supplied binding that is already used or does not exist', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1'));
      s.addDevice(makePc('PC-1', '192.168.1.10'));
      s.addDevice(makePc('PC-2', '192.168.1.11'));
      s.addDevice(makePc('PC-3', '192.168.1.12'));

      s.addConnection({ source: 'dev-1', target: 'dev-0', targetPort: 1 });
      s.addConnection({ source: 'dev-2', target: 'dev-0', targetPort: 1 }); // taken
      s.addConnection({ source: 'dev-3', target: 'dev-0', targetPort: 99 }); // no such port

      const { devices, connections } = store.getState();
      expect(connections.map(c => c.targetPort)).toEqual([1, 2, 3]);
      const all = claims(devices, connections);
      expect(new Set(all).size).toBe(all.length);
    });

    it('leaves an end unbound when the device has no free interface', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makePc('PC-1', '192.168.1.10'));
      s.addDevice(makePc('PC-2', '192.168.1.11'));
      s.addDevice(makePc('PC-3', '192.168.1.12'));

      s.addConnection({ source: 'dev-0', target: 'dev-1' });
      s.addConnection({ source: 'dev-0', target: 'dev-2' }); // PC-1's only NIC is taken

      const second = store.getState().connections[1];
      expect(isEndBound(second, 'source')).toBe(false);
      expect(second.targetNic).toBe('nic-1');
    });
  });

  // ---------- paste ----------

  describe('paste', () => {
    it('gives pasted links the same interfaces on the pasted devices', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1')); // dev-0
      s.addDevice(makePc('PC-1', '192.168.1.10')); // dev-1
      s.addConnection({ source: 'dev-1', target: 'dev-0', sourceNic: 'nic-1', targetPort: 4 });

      s.selectMultipleDevices(['dev-0', 'dev-1']);
      store.getState().copySelection();
      store.getState().paste();

      const { devices, connections } = store.getState();
      expect(devices.map(d => d.id)).toEqual(['dev-0', 'dev-1', 'dev-2', 'dev-3']);
      expect(connections).toHaveLength(2);
      expect(connections[1]).toMatchObject({
        id: 'conn-1',
        source: 'dev-3',
        target: 'dev-2',
        sourceNic: 'nic-1',
        targetPort: 4,
      });
      // the original link is untouched
      expect(connections[0]).toMatchObject({ source: 'dev-1', target: 'dev-0', targetPort: 4 });
    });

    it('binds pasted links that were copied without a binding', async () => {
      const { store } = await freshStore();
      // Old data in the clipboard: a link that was never bound
      store.setState({
        devices: [
          saved('dev-0', makeSwitch('SW-1')),
          saved('dev-1', makePc('PC-1', '192.168.1.10')),
        ],
        connections: [{ id: 'conn-0', source: 'dev-1', target: 'dev-0' }],
        deviceCounter: 2,
        connectionCounter: 1,
      });

      store.getState().selectMultipleDevices(['dev-0', 'dev-1']);
      store.getState().copySelection();
      store.getState().paste();

      const { connections } = store.getState();
      expect(connections[1]).toMatchObject({
        source: 'dev-3',
        target: 'dev-2',
        sourceNic: 'nic-1',
        targetPort: 1,
      });
      // paste binds what it creates, it does not rewrite the copied original
      expect(isEndBound(connections[0], 'source')).toBe(false);
      expect(isEndBound(connections[0], 'target')).toBe(false);
    });
  });

  // ---------- autoConnectDevices ----------

  describe('autoConnectDevices', () => {
    it('binds every generated link, never using an interface twice', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice({
        type: 'Router',
        label: 'Router-1',
        ip: '192.168.1.1',
        subnet: '255.255.255.0',
        gateway: '',
        position: { x: 200, y: 0 },
        portCount: 4,
        ports: ports(4),
      });
      s.addDevice(makeSwitch('SW-1', 8, { position: { x: 200, y: 200 } }));
      s.addDevice(makePc('PC-1', '192.168.1.10', { position: { x: 100, y: 400 } }));
      s.addDevice(makePc('PC-2', '192.168.1.11', { position: { x: 300, y: 400 } }));

      store.getState().autoConnectDevices();

      const { devices, connections, connectionCounter } = store.getState();
      expect(connections).toHaveLength(3); // router–switch, switch–pc1, switch–pc2
      expect(connectionCounter).toBe(3);
      const all = claims(devices, connections);
      expect(all).toHaveLength(6); // every end bound
      expect(new Set(all).size).toBe(6); // no interface shared
      // Router-1 uses its first port, the switch three different ones
      expect(all.filter(c => c.startsWith('dev-1|')).sort()).toEqual([
        'dev-1|port:1',
        'dev-1|port:2',
        'dev-1|port:3',
      ]);
    });

    it('does not take interfaces already used by existing links', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1', 8, { position: { x: 200, y: 200 } })); // dev-0
      s.addDevice(makePc('PC-1', '192.168.1.10', { position: { x: 100, y: 400 } })); // dev-1
      s.addDevice(makePc('PC-2', '192.168.1.11', { position: { x: 300, y: 400 } })); // dev-2
      s.addConnection({ source: 'dev-0', target: 'dev-1' }); // takes SW-1 port 1

      store.getState().autoConnectDevices();

      const { connections } = store.getState();
      expect(connections).toHaveLength(2);
      expect(connections[1]).toMatchObject({
        source: 'dev-0',
        target: 'dev-2',
        sourcePort: 2,
        targetNic: 'nic-1',
      });
    });
  });

  // ---------- loadTopology ----------

  describe('loadTopology', () => {
    it('binds a topology that carries no bindings (imports, old samples)', async () => {
      const { store } = await freshStore();

      store.getState().loadTopology(
        [
          saved('sw', makeSwitch('SW-1')),
          saved('a', makePc('PC-1', '192.168.1.10')),
          saved('b', makePc('PC-2', '192.168.1.11')),
        ],
        [
          { id: 'x', source: 'a', target: 'sw' },
          { id: 'y', source: 'sw', target: 'b' },
        ]
      );

      const { connections } = store.getState();
      expect(connections).toMatchObject([
        { id: 'conn-0', source: 'dev-1', target: 'dev-0', sourceNic: 'nic-1', targetPort: 1 },
        { id: 'conn-1', source: 'dev-0', target: 'dev-2', sourcePort: 2, targetNic: 'nic-1' },
      ]);
    });

    it('keeps valid bindings and repairs the ones that cannot hold', async () => {
      const { store } = await freshStore();

      store.getState().loadTopology(
        [
          saved('sw', makeSwitch('SW-1', 4)),
          saved('a', makePc('PC-1', '192.168.1.10')),
          saved('b', makePc('PC-2', '192.168.1.11')),
          saved('c', makePc('PC-3', '192.168.1.12')),
        ],
        [
          { id: 'x', source: 'a', target: 'sw', sourceNic: 'nic-1', targetPort: 3 }, // valid
          { id: 'y', source: 'b', target: 'sw', sourceNic: 'nic-1', targetPort: 3 }, // duplicate
          { id: 'z', source: 'c', target: 'sw', sourceNic: 'nic-1', targetPort: 9 }, // no such port
        ]
      );

      const { devices, connections } = store.getState();
      expect(connections.map(c => c.targetPort)).toEqual([3, 1, 2]);
      const all = claims(devices, connections);
      expect(all).toHaveLength(6);
      expect(new Set(all).size).toBe(6);
    });
  });

  // ---------- updateDevice ----------

  describe('updateDevice', () => {
    it('unbinds links that pointed at ports removed by a port count shrink', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1', 8)); // dev-0
      s.addDevice(makePc('PC-1', '192.168.1.10')); // dev-1
      s.addDevice(makePc('PC-2', '192.168.1.11')); // dev-2
      s.addConnection({ source: 'dev-1', target: 'dev-0', targetPort: 2 });
      s.addConnection({ source: 'dev-2', target: 'dev-0', targetPort: 7 });

      store.getState().updateDevice('dev-0', { portCount: 4, ports: ports(4) });

      const [kept, orphaned] = store.getState().connections;
      expect(kept.targetPort).toBe(2);
      expect(isEndBound(orphaned, 'target')).toBe(false);
      expect(orphaned.sourceNic).toBe('nic-1'); // the PC side is still attached
    });

    it('unbinds links that pointed at a removed NIC', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1')); // dev-0
      s.addDevice(
        makePc('SRV-1', '192.168.1.20', {
          nics: [nic('nic-1', 'eth0', '192.168.1.20'), nic('nic-2', 'eth1', '192.168.1.21')],
        })
      ); // dev-1
      s.addConnection({ source: 'dev-1', target: 'dev-0', sourceNic: 'nic-2' });

      store.getState().updateDevice('dev-1', { nics: [nic('nic-1', 'eth0', '192.168.1.20')] });

      const [conn] = store.getState().connections;
      expect(isEndBound(conn, 'source')).toBe(false);
      expect(conn.targetPort).toBe(1);
    });

    it('leaves the connections alone when ports/NICs are untouched or still valid', async () => {
      const { store } = await freshStore();
      const s = store.getState();
      s.addDevice(makeSwitch('SW-1')); // dev-0
      s.addDevice(makePc('PC-1', '192.168.1.10')); // dev-1
      s.addConnection({ source: 'dev-1', target: 'dev-0' });
      const before = store.getState().connections;

      store.getState().updateDevice('dev-0', { label: 'SW-Renamed' });
      expect(store.getState().connections).toBe(before);

      // Disabling a port edits `ports` but removes nothing: binding survives
      const edited = ports(8).map(p => (p.id === 1 ? { ...p, enabled: false } : p));
      store.getState().updateDevice('dev-0', { ports: edited });
      expect(store.getState().connections).toBe(before);
      expect(store.getState().connections[0].targetPort).toBe(1);
    });
  });

  // ---------- migration on load ----------

  describe('migration of data saved before bindings', () => {
    const oldDevices: NetworkDevice[] = [
      saved('dev-0', makeSwitch('SW-1')),
      saved('dev-1', makePc('PC-1', '192.168.1.10')),
      saved('dev-2', makePc('PC-2', '192.168.1.11')),
    ];
    const oldConnections: NetworkConnection[] = [
      { id: 'conn-0', source: 'dev-1', target: 'dev-0' },
      { id: 'conn-1', source: 'dev-0', target: 'dev-2', type: 'access' },
    ];

    it('loadFromBackend binds an old canvas in memory without saving or toasting', async () => {
      const { store, getCanvas, updateCanvas, toasts } = await freshStore();
      getCanvas.mockResolvedValue({
        id: 'canvas-1',
        name: 'Old canvas',
        devices: oldDevices,
        connections: oldConnections,
        settings: { viewport: { x: 0, y: 0, zoom: 1 }, deviceCounter: 3, connectionCounter: 2 },
      });

      await store.getState().loadFromBackend('proj-1', 'canvas-1');

      const state = store.getState();
      expect(state.connections).toMatchObject([
        { id: 'conn-0', sourceNic: 'nic-1', targetPort: 1 },
        { id: 'conn-1', sourcePort: 2, targetNic: 'nic-1', type: 'access' },
      ]);
      expect(state.hasUnsavedChanges).toBe(false);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(updateCanvas).not.toHaveBeenCalled();
      expect(store.getState().hasUnsavedChanges).toBe(false);
      expectNoToast(toasts);
    });

    it('the bindings reach the backend with the next real edit', async () => {
      const { store, getCanvas, updateCanvas } = await freshStore();
      updateCanvas.mockResolvedValue({});
      getCanvas.mockResolvedValue({
        id: 'canvas-1',
        name: 'Old canvas',
        devices: oldDevices,
        connections: oldConnections,
        settings: { viewport: { x: 0, y: 0, zoom: 1 }, deviceCounter: 3, connectionCounter: 2 },
      });
      await store.getState().loadFromBackend('proj-1', 'canvas-1');

      store.getState().updateDevice('dev-1', { label: 'PC-Renamed' });
      await vi.advanceTimersByTimeAsync(2000);

      expect(updateCanvas).toHaveBeenCalledTimes(1);
      expect(updateCanvas.mock.calls[0][2].connections).toMatchObject([
        { id: 'conn-0', sourceNic: 'nic-1', targetPort: 1 },
        { id: 'conn-1', sourcePort: 2, targetNic: 'nic-1' },
      ]);
    });

    it('rehydrating old localStorage data binds the links without triggering a save', async () => {
      const persisted = {
        state: {
          devices: oldDevices,
          connections: oldConnections,
          globalNetworkSettings: {
            ipClass: '192.168.1.0',
            subnet: '255.255.255.0',
            gateway: '192.168.1.1',
          },
          viewport: { x: 0, y: 0, zoom: 1 },
          deviceCounter: 3,
          connectionCounter: 2,
          currentProjectId: 'proj-1',
          currentCanvasId: 'canvas-1',
          hasUnsavedChanges: false,
        },
        version: 0,
      };
      const raw = JSON.stringify(persisted);
      localStorage.setItem('pixelcake-network-v2', raw);

      const { store, updateCanvas, toasts } = await freshStore();
      updateCanvas.mockResolvedValue({});

      const state = store.getState();
      expect(state.currentCanvasId).toBe('canvas-1'); // rehydrated, autosave would be armed
      expect(state.connections).toMatchObject([
        { id: 'conn-0', sourceNic: 'nic-1', targetPort: 1 },
        { id: 'conn-1', sourcePort: 2, targetNic: 'nic-1', type: 'access' },
      ]);
      expect(state.hasUnsavedChanges).toBe(false);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(updateCanvas).not.toHaveBeenCalled();
      expect(store.getState().hasUnsavedChanges).toBe(false);
      expectNoToast(toasts);
      // nothing was written back: the migration alone does not persist
      expect(localStorage.getItem('pixelcake-network-v2')).toBe(raw);
    });

    it('rehydrating already-bound data changes nothing', async () => {
      const bound: NetworkConnection[] = [
        { id: 'conn-0', source: 'dev-1', target: 'dev-0', sourceNic: 'nic-1', targetPort: 6 },
      ];
      localStorage.setItem(
        'pixelcake-network-v2',
        JSON.stringify({
          state: {
            devices: oldDevices,
            connections: bound,
            deviceCounter: 3,
            connectionCounter: 1,
          },
          version: 0,
        })
      );

      const { store } = await freshStore();

      expect(store.getState().connections).toEqual(bound);
    });
  });

  describe('device-level addressing follows the primary NIC', () => {
    it('updateDevice: editing the NIC updates the device-level ip and gateway', async () => {
      const { store } = await freshStore();
      store.getState().addDevice(makePc('PC-1', '192.168.1.10')); // dev-0

      // What the Inspector sends on save: stale device-level fields + edited NIC
      store.getState().updateDevice('dev-0', {
        ip: '192.168.1.10',
        gateway: '192.168.1.1',
        nics: [{ ...nic('nic-1', 'eth0', '192.168.1.77'), gateway: '192.168.1.254' }],
      });

      const device = store.getState().devices[0];
      expect(device.ip).toBe('192.168.1.77');
      expect(device.gateway).toBe('192.168.1.254');
    });

    it('addDevice and loadTopology bring a stale mirror in line', async () => {
      const { store } = await freshStore();
      const stale = makePc('PC-1', '10.0.0.5', { ip: '192.168.1.10' });

      store.getState().addDevice(stale);
      expect(store.getState().devices[0].ip).toBe('10.0.0.5');

      store.getState().loadTopology([{ ...stale, id: 'old-1' }], []);
      expect(store.getState().devices[0].ip).toBe('10.0.0.5');
    });

    it('rehydration fixes a stale mirror without saving or marking the canvas dirty', async () => {
      localStorage.setItem(
        'pixelcake-network-v2',
        JSON.stringify({
          state: {
            devices: [{ ...makePc('PC-1', '10.0.0.5', { ip: '192.168.1.10' }), id: 'dev-0' }],
            connections: [],
            deviceCounter: 1,
            connectionCounter: 0,
            currentProjectId: 'proj-1',
            currentCanvasId: 'canvas-1',
            hasUnsavedChanges: false,
          },
          version: 0,
        })
      );

      const { store, updateCanvas } = await freshStore();
      await vi.advanceTimersByTimeAsync(5000);

      expect(store.getState().devices[0].ip).toBe('10.0.0.5');
      expect(store.getState().hasUnsavedChanges).toBe(false);
      expect(updateCanvas).not.toHaveBeenCalled();
    });
  });
});
