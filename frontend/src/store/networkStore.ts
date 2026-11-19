/**
 * Network Store
 * Manages devices, connections, and global network settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CanvasArea,
  CanvasMark,
  DeviceTemplate,
  CanvasData,
  NetworkDevice,
  NetworkConnection,
  GlobalNetworkSettings,
} from '@/types';
import { AREA_MIN_SIZE, nextAreaId, readAreas, tidyAreaLabel } from '@/utils/canvasAreas';
import { nextMarkId, readMarks, tidyMark } from '@/utils/canvasMarks';
import { arrangeInSteps, type LayoutDirection } from '@/utils/autoLayout';
import { connectLooseDevices, type ConnectionSummary } from '@/utils/autoConnect';
import { cleanupConnections } from '@/utils/cleanupConnections';
import { safeJSONStorage } from '@/utils/safeStorage';
import type { SampleNetwork } from '@/utils/sampleNetwork';
import { hasClipboard, pasteClipboard, type Clipboard } from '@/utils/pasteDevices';
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
  /**
   * What is written on the canvas with the marker («Pennarello»), first
   * written first: over the devices and the cables. A drawing and nothing
   * else, like the areas
   */
  marks: CanvasMark[];
  globalNetworkSettings: GlobalNetworkSettings;
  selectedDeviceId: string | null;
  hoveredDeviceId: string | null;

  // Multi-selection & Clipboard
  selectedDeviceIds: string[];
  clipboard: Clipboard | null;

  // The areas that are in the selection, with the devices or alone (taken
  // with a click, Ctrl+click or a selection box): they are moved, copied and
  // deleted with the devices. Kept apart from the selection of the devices,
  // which is React Flow's: an area is never part of it. Not persisted
  selectedAreaIds: string[];
  // The area selected by itself, nothing else with it: it can then be
  // resized and renamed. Always the one of `selectedAreaIds` when it is the
  // whole selection, null otherwise
  selectedAreaId: string | null;
  // The area whose label is being typed. Not persisted
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
  /**
   * The devices that are selected. A selection of devices lets go of the
   * areas that were in it, unless `keepAreas`: the canvas passes on React
   * Flow's selection so, and lets go of the areas itself where it has to
   */
  selectMultipleDevices: (ids: string[], options?: { keepAreas?: boolean }) => void;
  /** The selected devices, the cables among them and the selected areas go to the clipboard */
  copySelection: () => void;
  /** The clipboard comes on the board as new things (utils/pasteDevices): what was pasted */
  paste: () => { pasted: string[]; onDhcp: string[] };

  // Actions - Areas
  /** Adds the area and gives the id it got */
  addArea: (area: Omit<CanvasArea, 'id'>) => string;
  updateArea: (id: string, updates: Partial<Omit<CanvasArea, 'id'>>) => void;
  removeArea: (id: string) => void;
  /** Select an area (and no device), or none */
  selectArea: (id: string | null) => void;
  /** The areas in the selection, the devices of the selection kept (a selection box) */
  setSelectedAreas: (ids: string[]) => void;
  /** Ctrl+click: the area joins the selection, or leaves it; the devices stay */
  toggleAreaSelection: (id: string) => void;
  /**
   * Devices and areas moved together, to these places (the selection
   * dragged): one edit
   */
  moveTogether: (
    devicePlaces: Record<string, { x: number; y: number }>,
    areaPlaces: Record<string, { x: number; y: number }>
  ) => void;
  /** Devices (with their cables), cables and areas deleted together: one edit */
  removeElements: (ids: { devices?: string[]; connections?: string[]; areas?: string[] }) => void;
  /** The area whose label is being typed in place, or none */
  setEditingArea: (id: string | null) => void;

  // Actions - Marks of the marker
  /** A mark finished: one edit. The id it got, or null when it is no mark (too few points, no words) */
  addMark: (mark: Omit<CanvasMark, 'id'>) => string | null;
  /** The marks the eraser touched, in one edit */
  removeMarks: (ids: string[]) => void;
  /** Everything written on the canvas, in one edit */
  clearMarks: () => void;

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
   * each device is drawn, and so where its cables end. A drawing seen whole
   * laid out plainly is laid out at once, in the call; a larger one in steps
   * that leave the page free between them, done when the promise is kept. A
   * drawing changed in the meantime is left as it is (what was laid out is no
   * longer there)
   */
  applyAutoLayout: (direction?: LayoutDirection, deviceTemplates?: DeviceTemplate[]) => Promise<void>;
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
  | 'marks'
  | 'globalNetworkSettings'
  | 'viewport'
  | 'deviceCounter'
  | 'connectionCounter'
  | 'canvasId'
  | 'hasUnsavedChanges'
>;

/** Counts edits; see getChangeToken / markSaved */
let changeSeq = 0;

/**
 * The selection of areas, with the area selected by itself that follows
 * from it: the one area of the selection when nothing else is in it
 */
function areaSelection(areaIds: string[], deviceIds: readonly string[]) {
  return {
    selectedAreaIds: areaIds,
    selectedAreaId: areaIds.length === 1 && deviceIds.length === 0 ? areaIds[0] : null,
  };
}

/** No area selected */
const NO_AREA_SELECTED = { selectedAreaIds: [] as string[], selectedAreaId: null };

export const useNetworkStore = create<NetworkStore>()(
  persist(
    (set, get) => ({
      // Initial State
      devices: [],
      connections: [],
      areas: [],
      marks: [],
      selectedAreaIds: [],
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

      selectMultipleDevices: (ids, options) => {
        // (devices selected: the areas that were are no longer, unless the
        // canvas keeps them: Ctrl+click, a selection box)
        const areaIds = ids.length > 0 && !options?.keepAreas ? [] : get().selectedAreaIds;
        set({ selectedDeviceIds: ids, ...areaSelection(areaIds, ids) });
      },

      copySelection: () => {
        const state = get();
        const selectedIds = state.selectedDeviceIds;
        const areas = state.areas.filter((area) => state.selectedAreaIds.includes(area.id));
        if (selectedIds.length === 0 && areas.length === 0) return;

        // Copy selected devices
        const devicesCopy = state.devices.filter((dev) => selectedIds.includes(dev.id));

        // Copy connections between selected devices
        const connectionsCopy = state.connections.filter(
          (conn) => selectedIds.includes(conn.source) && selectedIds.includes(conn.target)
        );

        set({ clipboard: { devices: devicesCopy, connections: connectionsCopy, areas } });
      },

      paste: () => {
        const state = get();
        if (!hasClipboard(state.clipboard)) return { pasted: [], onDhcp: [] };

        // New names, new MAC addresses, end devices on DHCP, the areas with
        // them (utils/pasteDevices)
        const pasted = pasteClipboard(state.clipboard, state);

        set((state) => ({
          devices: [...state.devices, ...pasted.devices],
          connections: [...state.connections, ...pasted.connections],
          areas: [...state.areas, ...pasted.areas],
          deviceCounter: state.deviceCounter + pasted.devices.length,
          connectionCounter: state.connectionCounter + pasted.connections.length,
          // Note: Don't update selectedDeviceIds here to avoid loop with onSelectionChange
        }));
        get().markChanged();
        return { pasted: pasted.devices.map((device) => device.id), onDhcp: pasted.onDhcp };
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
          ...areaSelection(
            state.selectedAreaIds.filter((selected) => selected !== id),
            state.selectedDeviceIds
          ),
          editingAreaId: state.editingAreaId === id ? null : state.editingAreaId,
        }));
        get().markChanged();
      },

      selectArea: (id) => {
        if (id === null) {
          if (get().selectedAreaIds.length > 0 || get().selectedAreaId !== null) set(NO_AREA_SELECTED);
          return;
        }
        if (!get().areas.some((area) => area.id === id)) return;
        set({ selectedAreaIds: [id], selectedAreaId: id, selectedDeviceIds: [] });
      },

      setSelectedAreas: (ids) => {
        const { areas, selectedAreaIds, selectedDeviceIds } = get();
        const known = areas.filter((area) => ids.includes(area.id)).map((area) => area.id);
        // (the same areas: nothing to tell)
        if (known.length === selectedAreaIds.length && known.every((id) => selectedAreaIds.includes(id))) return;
        set(areaSelection(known, selectedDeviceIds));
      },

      toggleAreaSelection: (id) => {
        const { areas, selectedAreaIds, selectedDeviceIds } = get();
        if (!areas.some((area) => area.id === id)) return;
        const next = selectedAreaIds.includes(id)
          ? selectedAreaIds.filter((selected) => selected !== id)
          : [...selectedAreaIds, id];
        set(areaSelection(next, selectedDeviceIds));
      },

      moveTogether: (devicePlaces, areaPlaces) => {
        const { devices, areas } = get();
        const movesDevice = devices.some((device) => {
          const place = devicePlaces[device.id];
          return place && (place.x !== device.position.x || place.y !== device.position.y);
        });
        const movesArea = areas.some((area) => {
          const place = areaPlaces[area.id];
          return place && (place.x !== area.position.x || place.y !== area.position.y);
        });
        if (!movesDevice && !movesArea) return;
        set((state) => ({
          ...(movesDevice
            ? {
                devices: state.devices.map((device) =>
                  devicePlaces[device.id] ? { ...device, position: devicePlaces[device.id] } : device
                ),
              }
            : {}),
          ...(movesArea
            ? {
                areas: state.areas.map((area) =>
                  areaPlaces[area.id] ? { ...area, position: areaPlaces[area.id] } : area
                ),
              }
            : {}),
        }));
        get().markChanged();
      },

      removeElements: ({ devices = [], connections = [], areas = [] }) => {
        const state = get();
        const goneDevices = new Set(devices.filter((id) => state.devices.some((device) => device.id === id)));
        const goneConnections = new Set(connections);
        const goneAreas = new Set(areas.filter((id) => state.areas.some((area) => area.id === id)));
        const cablesGo = state.connections.some(
          (conn) => goneConnections.has(conn.id) || goneDevices.has(conn.source) || goneDevices.has(conn.target)
        );
        if (goneDevices.size === 0 && goneAreas.size === 0 && !cablesGo) return;
        const deviceIds = state.selectedDeviceIds.filter((id) => !goneDevices.has(id));
        set({
          devices: state.devices.filter((device) => !goneDevices.has(device.id)),
          // (the cables of a device go with it)
          connections: state.connections.filter(
            (conn) => !goneConnections.has(conn.id) && !goneDevices.has(conn.source) && !goneDevices.has(conn.target)
          ),
          areas: state.areas.filter((area) => !goneAreas.has(area.id)),
          selectedDeviceIds: deviceIds,
          ...areaSelection(
            state.selectedAreaIds.filter((id) => !goneAreas.has(id)),
            deviceIds
          ),
          selectedDeviceId: state.selectedDeviceId && goneDevices.has(state.selectedDeviceId) ? null : state.selectedDeviceId,
          editingAreaId: state.editingAreaId && goneAreas.has(state.editingAreaId) ? null : state.editingAreaId,
        });
        get().markChanged();
      },

      setEditingArea: (id) => {
        set({ editingAreaId: id });
      },

      // Marks of the marker
      addMark: (mark) => {
        const kept = tidyMark(mark);
        if (!kept) return null;
        const id = nextMarkId(get().marks);
        set((state) => ({ marks: [...state.marks, { id, ...kept }] }));
        get().markChanged();
        return id;
      },

      removeMarks: (ids) => {
        const gone = new Set(ids);
        if (!get().marks.some((mark) => gone.has(mark.id))) return;
        set((state) => ({ marks: state.marks.filter((mark) => !gone.has(mark.id)) }));
        get().markChanged();
      },

      clearMarks: () => {
        if (get().marks.length === 0) return;
        set({ marks: [] });
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
      applyAutoLayout: async (direction = 'TB', deviceTemplates = []) => {
        const { devices, connections, areas } = get();
        const steps = arrangeInSteps({ devices, connections, areas }, direction, deviceTemplates);
        let step = steps.next();
        // (between two steps the page draws, and answers the pointer)
        while (!step.done) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          step = steps.next();
        }
        // (changed meanwhile: what was laid out is no longer there)
        const now = get();
        if (now.devices !== devices || now.connections !== connections || now.areas !== areas) return;
        const laid = step.value;
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
        const { devices, connections, connectionCounter, areas } = get();
        // (the new cables come bound to the interfaces they take; the areas
        // say which site a device is in)
        const result = connectLooseDevices(devices, connections, connectionCounter, areas);
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
          // (the areas were drawn for the devices that are going, and the
          // marks written over them)
          areas: [],
          marks: [],
          selectedAreaIds: [],
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
            // canvas: the areas drawn around the old devices go with them,
            // and what was written over them
            areas: [],
            marks: [],
            selectedAreaIds: [],
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
        const { devices, connections, areas, marks, viewport, deviceCounter, connectionCounter } = get();
        // (a canvas without areas, or with nothing written on it, is stored,
        // and written to a file, without the list)
        return {
          devices,
          connections,
          areas: areas.length > 0 ? areas : undefined,
          marks: marks.length > 0 ? marks : undefined,
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
          marks: readMarks(canvas.marks).marks,
          selectedAreaIds: [],
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
        marks: state.marks,
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
          // (the same for the marks: none before the marker existed)
          marks: readMarks(saved.marks).marks,
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
