/**
 * Network Store
 * Manages devices, connections, and global network settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CanvasArea,
  DeviceTemplate,
  CanvasData,
  NetworkDevice,
  NetworkConnection,
  GlobalNetworkSettings,
} from '@/types';
import { AREA_MIN_SIZE, nextAreaId, readAreas, tidyAreaLabel } from '@/utils/canvasAreas';
import { arrangeDrawing, type LayoutDirection } from '@/utils/autoLayout';
import { connectLooseDevices, type ConnectionSummary } from '@/utils/autoConnect';
import { cleanupConnections } from '@/utils/cleanupConnections';
import { safeJSONStorage } from '@/utils/safeStorage';
import type { SampleNetwork } from '@/utils/sampleNetwork';
import { bindConnection, normalizeAddressing, normalizeBindings, sanitizeBindings } from '@/engine';

export { cleanupConnections };

interface NetworkStore {
  // State
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  /**
   * The areas drawn behind the devices («riquadri»), first drawn first. A
   * drawing and nothing else: no device or cable refers to one
   */
  areas: CanvasArea[];
  globalNetworkSettings: GlobalNetworkSettings;
  selectedDeviceId: string | null;
  hoveredDeviceId: string | null;

  // Multi-selection & Clipboard
  selectedDeviceIds: string[];
  clipboard: { devices: NetworkDevice[]; connections: NetworkConnection[] } | null;

  // The area that is selected (it can then be resized, and the Delete key
  // deletes it), and the one whose label is being typed. Kept apart from the
  // selection of the devices, which is React Flow's: an area is never part
  // of it. Selecting one empties the other. Not persisted
  selectedAreaId: string | null;
  editingAreaId: string | null;

  // Canvas viewport state (persisted)
  viewport: { x: number; y: number; zoom: number };

  // Canvas view actions (non-persisted, triggers only)
  /** Goes up by one each time the whole drawing is to be brought into view */
  fitViewRequest: number;
  /** The devices the last request asked to be shown; null for the whole drawing */
  fitViewNodes: string[] | null;

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

  // Actions - Areas
  /** Adds the area and gives the id it got */
  addArea: (area: Omit<CanvasArea, 'id'>) => string;
  updateArea: (id: string, updates: Partial<Omit<CanvasArea, 'id'>>) => void;
  removeArea: (id: string) => void;
  /** Select an area (and no device), or none */
  selectArea: (id: string | null) => void;
  /** The area whose label is being typed in place, or none */
  setEditingArea: (id: string | null) => void;

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
  /** Ask the canvas to show the whole drawing, or only these devices (without zooming in) */
  triggerFitView: (nodeIds?: string[]) => void;

  // Actions - Layout
  /**
   * Lay the drawing out again (utils/autoLayout.ts): vertically or
   * horizontally, the areas following their devices. The templates say how
   * each device is drawn, and so where its cables end
   */
  applyAutoLayout: (direction?: LayoutDirection, deviceTemplates?: DeviceTemplate[]) => void;
  /**
   * A cable for each device that has none, and an uplink for each switch
   * with none (utils/autoConnect.ts): what was added, and what was left
   * alone with the reason
   */
  autoConnectDevices: () => ConnectionSummary;

  // Actions - Utility
  clearAllDevices: () => void;
  loadTopology: (devices: NetworkDevice[], connections: NetworkConnection[]) => void;
  /**
   * A sample network in place of what is on the canvas: its drawing with
   * its areas, and the network settings of the project, which become the ones
   * the sample brings
   */
  loadSample: (sample: SampleNetwork) => void;

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
  | 'areas'
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
      areas: [],
      selectedAreaId: null,
      editingAreaId: null,
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
      fitViewNodes: null,
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
        // (devices selected: the area that was is no longer)
        set(ids.length > 0 ? { selectedDeviceIds: ids, selectedAreaId: null } : { selectedDeviceIds: ids });
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

      // Area Actions
      addArea: (area) => {
        const id = nextAreaId(get().areas);
        set((state) => ({
          areas: [...state.areas, { ...area, id, label: tidyAreaLabel(area.label) }],
        }));
        get().markChanged();
        return id;
      },

      updateArea: (id, updates) => {
        const current = get().areas.find((area) => area.id === id);
        if (!current) return;
        const next: CanvasArea = {
          ...current,
          ...updates,
          id,
          label: updates.label === undefined ? current.label : tidyAreaLabel(updates.label),
        };
        // (never smaller than an area can be made)
        next.size = {
          width: Math.max(AREA_MIN_SIZE.width, next.size.width),
          height: Math.max(AREA_MIN_SIZE.height, next.size.height),
        };
        // (a label confirmed as it was, a handle pressed and let go: not an edit)
        if (JSON.stringify(next) === JSON.stringify(current)) return;
        set((state) => ({ areas: state.areas.map((area) => (area.id === id ? next : area)) }));
        get().markChanged();
      },

      removeArea: (id) => {
        if (!get().areas.some((area) => area.id === id)) return;
        set((state) => ({
          areas: state.areas.filter((area) => area.id !== id),
          selectedAreaId: state.selectedAreaId === id ? null : state.selectedAreaId,
          editingAreaId: state.editingAreaId === id ? null : state.editingAreaId,
        }));
        get().markChanged();
      },

      selectArea: (id) => {
        if (id === null) {
          if (get().selectedAreaId !== null) set({ selectedAreaId: null });
          return;
        }
        if (!get().areas.some((area) => area.id === id)) return;
        set({ selectedAreaId: id, selectedDeviceIds: [] });
      },

      setEditingArea: (id) => {
        set({ editingAreaId: id });
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

      triggerFitView: (nodeIds) => {
        // A request, not a state: the canvas answers each one once, when it
        // can (a drawing that has just been loaded is fitted once its
        // devices have a size)
        set((state) => ({
          fitViewRequest: state.fitViewRequest + 1,
          fitViewNodes: nodeIds && nodeIds.length > 0 ? nodeIds : null,
        }));
      },

      // Layout Actions
      applyAutoLayout: (direction = 'TB', deviceTemplates = []) => {
        const { devices, connections, areas } = get();
        const laid = arrangeDrawing({ devices, connections, areas }, direction, deviceTemplates);
        set({
          devices: laid.devices,
          connections: laid.connections,
          areas: laid.areas,
        });
        get().markChanged();
        // (and the view shows the whole drawing, as it now is)
        get().triggerFitView();
      },

      autoConnectDevices: () => {
        const { devices, connections, connectionCounter } = get();
        // (the new cables come bound to the interfaces they take)
        const result = connectLooseDevices(devices, connections, connectionCounter);
        if (result.connections.length > 0) {
          set({
            connections: [...connections, ...result.connections],
            connectionCounter: result.nextCounter,
          });
          get().markChanged();
        }
        return { added: result.connections.length, left: result.left };
      },

      // Utility Actions
      clearAllDevices: () => {
        set({
          devices: [],
          connections: [],
          // (the areas were drawn for the devices that are going)
          areas: [],
          selectedAreaId: null,
          editingAreaId: null,
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
            // A drawing loaded as a whole takes the place of the one on the
            // canvas: the areas drawn around the old devices go with them
            areas: [],
            selectedAreaId: null,
            editingAreaId: null,
            selectedDeviceId: null,
            deviceCounter: devCounter,
            connectionCounter: connCounter,
          };
        });
        get().markChanged();
      },

      loadSample: (sample) => {
        get().loadTopology(sample.devices, sample.connections);
        // (every setting is the sample's: none of those there were is left; the
        // areas of the drawing there was went with it, these are the sample's)
        set({
          globalNetworkSettings: { ...sample.settings },
          areas: sample.areas.map((area, index) => ({
            ...area,
            id: `area-${index + 1}`,
            label: tidyAreaLabel(area.label),
          })),
        });
        get().markChanged();
      },

      // Whole canvas
      getCanvasSnapshot: () => {
        const { devices, connections, areas, viewport, deviceCounter, connectionCounter } = get();
        // (a canvas without areas is stored, and written to a file, without the list)
        return {
          devices,
          connections,
          areas: areas.length > 0 ? areas : undefined,
          viewport,
          deviceCounter,
          connectionCounter,
        };
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
          areas: readAreas(canvas.areas).areas,
          selectedAreaId: null,
          editingAreaId: null,
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
        areas: state.areas,
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
          // (none in what an older version wrote; whatever is there is read
          // as a file is: an area that cannot be drawn is left behind)
          areas: readAreas(saved.areas).areas,
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
