/**
 * Network Store
 * Manages devices, connections, and global network settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CanvasData,
  NetworkDevice,
  NetworkConnection,
  GlobalNetworkSettings,
} from '@/types';
import { applyHierarchicalLayout, applySubnetGroupedLayout, autoConnectDevices } from '@/utils/autoLayout';
import { cleanupConnections } from '@/utils/cleanupConnections';
import { safeJSONStorage } from '@/utils/safeStorage';
import { bindConnection, normalizeAddressing, normalizeBindings, sanitizeBindings } from '@/engine';

export { cleanupConnections };

interface NetworkStore {
  // State
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  globalNetworkSettings: GlobalNetworkSettings;
  selectedDeviceId: string | null;
  hoveredDeviceId: string | null;

  // Multi-selection & Clipboard
  selectedDeviceIds: string[];
  clipboard: { devices: NetworkDevice[]; connections: NetworkConnection[] } | null;

  // Canvas viewport state (persisted)
  viewport: { x: number; y: number; zoom: number };

  // Canvas view actions (non-persisted, triggers only)
  /** Goes up by one each time the whole drawing is to be brought into view */
  fitViewRequest: number;

  // Counters (persistiti per evitare ID duplicati)
  deviceCounter: number;
  connectionCounter: number;

  // Which canvas of the project this data is. An opaque tag for this store
  // (the project store owns the list of canvases), persisted next to the data
  // so the two can never be paired wrongly after a reload. null: data written
  // before projects kept their canvases in the browser.
  canvasId: string | null;

  // True when the project changed since it was last saved to / opened from a
  // file (persisted)
  hasUnsavedChanges: boolean;

  // Bumped every time the canvas is replaced as a whole, so the view can
  // apply the viewport that came with it (not persisted)
  canvasRevision: number;

  // Actions - Devices
  /** Adds the device and gives the id it got */
  addDevice: (device: Omit<NetworkDevice, 'id'>) => string;
  updateDevice: (id: string, updates: Partial<NetworkDevice>) => void;
  removeDevice: (id: string) => void;
  getDevice: (id: string) => NetworkDevice | undefined;
  setSelectedDevice: (id: string | null) => void;
  setHoveredDevice: (id: string | null) => void;

  // Actions - Multi-selection & Clipboard
  toggleDeviceSelection: (id: string) => void;
  clearSelection: () => void;
  selectMultipleDevices: (ids: string[]) => void;
  copySelection: () => void;
  paste: () => void;

  // Actions - Connections
  addConnection: (connection: Omit<NetworkConnection, 'id'>) => void;
  updateConnection: (id: string, updates: Partial<NetworkConnection>) => void;
  removeConnection: (id: string) => void;
  getConnection: (id: string) => NetworkConnection | undefined;
  getConnectionsForDevice: (deviceId: string) => NetworkConnection[];

  // Actions - Settings
  setGlobalNetworkSettings: (settings: Partial<GlobalNetworkSettings>) => void;
  findNextAvailableIP: () => string;

  // Actions - Viewport
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  triggerFitView: () => void;

  // Actions - Layout
  applyAutoLayout: (algorithm?: 'hierarchical' | 'subnet-grouped', direction?: 'TB' | 'LR') => void;
  autoConnectDevices: () => void;

  // Actions - Utility
  clearAllDevices: () => void;
  loadTopology: (devices: NetworkDevice[], connections: NetworkConnection[]) => void;

  // Actions - Whole canvas (used by the project store)
  /** The canvas on screen, as it is stored in a project */
  getCanvasSnapshot: () => CanvasData;
  /**
   * Replace the canvas on screen with another one. Not an edit: the changed
   * flag is left as it is. `settings` also replaces the project-wide network
   * settings (opening or creating a project).
   */
  replaceCanvas: (canvasId: string, canvas: CanvasData, settings?: GlobalNetworkSettings) => void;

  // Actions - Changed flag
  /** Record an edit of the project (called by every mutation) */
  markChanged: () => void;
  /** Position in the stream of edits, to hand back to markSaved */
  getChangeToken: () => number;
  /**
   * The project now matches a file. With a token, the flag is cleared only
   * if no edit landed after the token was taken (a save that was being
   * written does not contain it).
   */
  markSaved: (changeToken?: number) => void;
}

/** What is written to localStorage */
type PersistedNetworkState = Pick<
  NetworkStore,
  | 'devices'
  | 'connections'
  | 'globalNetworkSettings'
  | 'viewport'
  | 'deviceCounter'
  | 'connectionCounter'
  | 'canvasId'
  | 'hasUnsavedChanges'
>;

/** Counts edits; see getChangeToken / markSaved */
let changeSeq = 0;

export const useNetworkStore = create<NetworkStore>()(
  persist(
    (set, get) => ({
      // Initial State
      devices: [],
      connections: [],
      globalNetworkSettings: {
        ipClass: '192.168.1.0',
        subnet: '255.255.255.0',
        gateway: '192.168.1.1',
        emailMode: 'auto',
      },
      selectedDeviceId: null,
      hoveredDeviceId: null,
      selectedDeviceIds: [],
      clipboard: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      fitViewRequest: 0,
      deviceCounter: 0,
      connectionCounter: 0,
      canvasId: null,
      hasUnsavedChanges: false,
      canvasRevision: 0,

      // Changed flag
      markChanged: () => {
        changeSeq++;
        if (!get().hasUnsavedChanges) {
          set({ hasUnsavedChanges: true });
        }
      },

      getChangeToken: () => changeSeq,

      markSaved: (changeToken) => {
        if (changeToken !== undefined && changeToken !== changeSeq) return;
        if (get().hasUnsavedChanges) {
          set({ hasUnsavedChanges: false });
        }
      },

      // Device Actions
      addDevice: (device) => {
        const id = `dev-${get().deviceCounter}`;
        set((state) => {
          const newDevice: NetworkDevice = normalizeAddressing({ ...device, id });
          return {
            devices: [...state.devices, newDevice],
            deviceCounter: state.deviceCounter + 1,
          };
        });
        get().markChanged();
        return id;
      },

      updateDevice: (id, updates) => {
        set((state) => {
          // A device with NICs is addressed through them: its device-level
          // ip/subnet/gateway follow the primary NIC on every edit, and a
          // card set to DHCP keeps no address of its own
          const devices = state.devices.map((dev) =>
            dev.id === id ? normalizeAddressing({ ...dev, ...updates }) : dev
          );
          // Ports/NICs edited: a link must never keep pointing at an
          // interface that was removed
          if ('ports' in updates || 'nics' in updates) {
            return { devices, connections: sanitizeBindings(devices, state.connections) };
          }
          return { devices };
        });
        get().markChanged();
      },

      removeDevice: (id) => {
        set((state) => ({
          devices: state.devices.filter((dev) => dev.id !== id),
          connections: state.connections.filter((conn) => conn.source !== id && conn.target !== id),
          selectedDeviceId: state.selectedDeviceId === id ? null : state.selectedDeviceId,
        }));
        get().markChanged();
      },

      getDevice: (id) => {
        return get().devices.find((dev) => dev.id === id);
      },

      setSelectedDevice: (id) => {
        set({ selectedDeviceId: id });
      },

      setHoveredDevice: (id) => {
        set({ hoveredDeviceId: id });
      },

      // Multi-selection & Clipboard Actions
      toggleDeviceSelection: (id) => {
        set((state) => {
          const isSelected = state.selectedDeviceIds.includes(id);
          if (isSelected) {
            return { selectedDeviceIds: state.selectedDeviceIds.filter((devId) => devId !== id) };
          } else {
            return { selectedDeviceIds: [...state.selectedDeviceIds, id] };
          }
        });
      },

      clearSelection: () => {
        set({ selectedDeviceIds: [] });
      },

      selectMultipleDevices: (ids) => {
        set({ selectedDeviceIds: ids });
      },

      copySelection: () => {
        const state = get();
        const selectedIds = state.selectedDeviceIds;
        if (selectedIds.length === 0) return;

        // Copy selected devices
        const devicesCopy = state.devices.filter((dev) => selectedIds.includes(dev.id));

        // Copy connections between selected devices
        const connectionsCopy = state.connections.filter(
          (conn) => selectedIds.includes(conn.source) && selectedIds.includes(conn.target)
        );

        set({ clipboard: { devices: devicesCopy, connections: connectionsCopy } });
      },

      paste: () => {
        const state = get();
        if (!state.clipboard || state.clipboard.devices.length === 0) return;

        // Create ID mapping: old ID -> new ID
        const idMap = new Map<string, string>();
        state.clipboard.devices.forEach((device, index) => {
          const newId = `dev-${state.deviceCounter + index}`;
          idMap.set(device.id, newId);
        });

        // Paste devices with new IDs and offset position
        const pastedDevices: NetworkDevice[] = state.clipboard.devices.map((device) => {
          const newId = idMap.get(device.id)!;
          return {
            ...device,
            id: newId,
            position: {
              x: device.position.x + 50,
              y: device.position.y + 50,
            },
          };
        });

        // Paste connections with updated IDs
        const pastedConnections: NetworkConnection[] = state.clipboard.connections.map(
          (conn, index) => {
            const newId = `conn-${state.connectionCounter + index}`;
            return {
              ...conn,
              id: newId,
              source: idMap.get(conn.source)!,
              target: idMap.get(conn.target)!,
            };
          }
        );

        // Pasted links keep the interfaces of the links they were copied from
        // (pasted devices carry the same ports/NICs); unbound ends are bound
        const boundPastedConnections = normalizeBindings(pastedDevices, pastedConnections);

        set((state) => ({
          devices: [...state.devices, ...pastedDevices],
          connections: [...state.connections, ...boundPastedConnections],
          deviceCounter: state.deviceCounter + pastedDevices.length,
          connectionCounter: state.connectionCounter + pastedConnections.length,
          // Note: Don't update selectedDeviceIds here to avoid loop with onSelectionChange
        }));
        get().markChanged();
      },

      // Connection Actions
      addConnection: (connection) => {
        set((state) => {
          // Validate: ensure ID doesn't already exist (safety check)
          let counter = state.connectionCounter;
          let id = `conn-${counter}`;
          while (state.connections.some((c) => c.id === id)) {
            console.warn(`[addConnection] ID ${id} already exists, incrementing counter`);
            counter++;
            id = `conn-${counter}`;
          }

          // Every new link is attached to a concrete interface on both ends:
          // a binding supplied by the caller is kept when it holds (existing,
          // not already used), otherwise the first free interface is taken
          const candidate: NetworkConnection = { ...connection, id };
          const sanitized = sanitizeBindings(state.devices, [...state.connections, candidate]);
          const newConnection = bindConnection(
            sanitized[sanitized.length - 1],
            state.devices,
            state.connections
          );
          return {
            connections: [...state.connections, newConnection],
            connectionCounter: counter + 1,
          };
        });
        get().markChanged();
      },

      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
        }));
        get().markChanged();
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
        }));
        get().markChanged();
      },

      getConnection: (id) => {
        return get().connections.find((conn) => conn.id === id);
      },

      getConnectionsForDevice: (deviceId) => {
        return get().connections.filter(
          (conn) => conn.source === deviceId || conn.target === deviceId
        );
      },

      // Settings Actions
      setGlobalNetworkSettings: (settings) => {
        set((state) => ({
          globalNetworkSettings: { ...state.globalNetworkSettings, ...settings },
        }));
        get().markChanged();
      },

      findNextAvailableIP: () => {
        const { devices, globalNetworkSettings } = get();
        const usedIPs = new Set(devices.map((dev) => dev.ip));
        const baseIP = globalNetworkSettings.ipClass.substring(
          0,
          globalNetworkSettings.ipClass.lastIndexOf('.') + 1
        );

        for (let i = 2; i < 255; i++) {
          const ip = `${baseIP}${i}`;
          if (!usedIPs.has(ip)) {
            return ip;
          }
        }

        return `${baseIP}254`;
      },

      // Viewport Actions
      setViewport: (viewport) => {
        // Where the user is looking is remembered, but it is not an edit
        set({ viewport });
      },

      triggerFitView: () => {
        // A request, not a state: the canvas answers each one once, when it
        // can (a drawing that has just been loaded is fitted once its
        // devices have a size)
        set((state) => ({ fitViewRequest: state.fitViewRequest + 1 }));
      },

      // Layout Actions
      applyAutoLayout: (algorithm = 'hierarchical', direction = 'TB') => {
        const { devices, connections } = get();

        let layoutResult: { devices: NetworkDevice[]; connections: NetworkConnection[] };

        if (algorithm === 'subnet-grouped') {
          layoutResult = applySubnetGroupedLayout(devices, connections, direction);
        } else {
          layoutResult = applyHierarchicalLayout(devices, connections, direction);
        }

        set({
          devices: layoutResult.devices,
          connections: layoutResult.connections,
        });
        get().markChanged();
      },

      autoConnectDevices: () => {
        const { devices, connections, connectionCounter } = get();

        // Generate new intelligent connections (passa il counter corretto!)
        const newConnections = autoConnectDevices(devices, connections, connectionCounter);

        // Bind each generated link to free interfaces, in order
        const boundConnections: NetworkConnection[] = [];
        for (const connection of newConnections) {
          boundConnections.push(
            bindConnection(connection, devices, [...connections, ...boundConnections])
          );
        }

        // Add new connections to store
        set({
          connections: [...connections, ...boundConnections],
          connectionCounter: connectionCounter + newConnections.length,
        });
        get().markChanged();
      },

      // Utility Actions
      clearAllDevices: () => {
        set({
          devices: [],
          connections: [],
          selectedDeviceId: null,
          deviceCounter: 0,
          connectionCounter: 0,
        });
        get().markChanged();
      },

      loadTopology: (devices, connections) => {
        set((state) => {
          let devCounter = state.deviceCounter;
          let connCounter = state.connectionCounter;

          const devicesWithNewIds = devices.map((device) =>
            normalizeAddressing({
              ...device,
              id: `dev-${devCounter++}`,
            })
          );

          const idMapping = new Map();
          devices.forEach((oldDevice, idx) => {
            idMapping.set(oldDevice.id, devicesWithNewIds[idx].id);
          });

          const connectionsWithNewIds = connections.map((conn) => ({
            ...conn,
            id: `conn-${connCounter++}`,
            source: idMapping.get(conn.source) || conn.source,
            target: idMapping.get(conn.target) || conn.target,
          }));

          return {
            devices: devicesWithNewIds,
            connections: normalizeBindings(devicesWithNewIds, connectionsWithNewIds),
            selectedDeviceId: null,
            deviceCounter: devCounter,
            connectionCounter: connCounter,
          };
        });
        get().markChanged();
      },

      // Whole canvas
      getCanvasSnapshot: () => {
        const { devices, connections, viewport, deviceCounter, connectionCounter } = get();
        return { devices, connections, viewport, deviceCounter, connectionCounter };
      },

      replaceCanvas: (canvasId, canvas, settings) => {
        // Same repairs as on rehydration: a canvas stored before interface
        // bindings (or with a stale address mirror) is brought in line in
        // memory, without counting as an edit
        const devices = canvas.devices.map(normalizeAddressing);
        set((state) => ({
          canvasId,
          devices,
          connections: normalizeBindings(devices, canvas.connections),
          viewport: canvas.viewport,
          deviceCounter: canvas.deviceCounter,
          connectionCounter: canvas.connectionCounter,
          globalNetworkSettings: settings ?? state.globalNetworkSettings,
          selectedDeviceId: null,
          selectedDeviceIds: [],
          hoveredDeviceId: null,
          canvasRevision: state.canvasRevision + 1,
        }));
      },
    }),
    {
      name: 'pixelcake-network-v2',
      storage: safeJSONStorage<PersistedNetworkState>(),
      partialize: (state): PersistedNetworkState => ({
        devices: state.devices,
        connections: state.connections,
        globalNetworkSettings: state.globalNetworkSettings,
        viewport: state.viewport,
        deviceCounter: state.deviceCounter,
        connectionCounter: state.connectionCounter,
        canvasId: state.canvasId,
        hasUnsavedChanges: state.hasUnsavedChanges,
      }),
      // Only the fields this version knows are taken from storage: what an
      // older version wrote next to them (currentProjectId, currentCanvasId
      // of the removed server sync) is left behind
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PersistedNetworkState>;
        return {
          ...current,
          devices: saved.devices ?? current.devices,
          connections: saved.connections ?? current.connections,
          globalNetworkSettings: saved.globalNetworkSettings ?? current.globalNetworkSettings,
          viewport: saved.viewport ?? current.viewport,
          deviceCounter: saved.deviceCounter ?? current.deviceCounter,
          connectionCounter: saved.connectionCounter ?? current.connectionCounter,
          canvasId: saved.canvasId ?? current.canvasId,
          hasUnsavedChanges: saved.hasUnsavedChanges ?? current.hasUnsavedChanges,
        };
      },
      onRehydrateStorage: () => (state) => {
        // Device-level addressing follows the primary NIC (data saved before
        // this rule may carry a stale mirror). Plain assignment, like the
        // binding migration below, so it neither persists nor counts as an edit
        if (state) {
          state.devices = state.devices.map(normalizeAddressing);
        }

        // Cleanup corrupted data from localStorage
        if (state && state.connections.length > 0) {
          const { cleanedConnections, maxCounter } = cleanupConnections(state.connections);

          // Update state with cleaned connections and correct counter.
          // Links persisted before interface bindings are bound here too; the
          // plain assignment (no set) keeps this migration from persisting
          // or marking the project as changed on its own
          state.connections = normalizeBindings(state.devices, cleanedConnections);
          state.connectionCounter = Math.max(state.connectionCounter, maxCounter);

          console.log(`[Store Cleanup] Cleaned connections: ${state.connections.length}, Counter: ${state.connectionCounter}`);
        }
      },
    }
  )
);
