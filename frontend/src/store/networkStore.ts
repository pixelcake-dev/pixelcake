/**
 * Network Store
 * Manages devices, connections, and global network settings
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type {
  NetworkDevice,
  NetworkConnection,
  GlobalNetworkSettings,
} from '@/types';
import { applyHierarchicalLayout, applySubnetGroupedLayout, autoConnectDevices } from '@/utils/autoLayout';
import { getCanvas, updateCanvas } from '@/api';
import { debounce } from '@/utils/debounce';
import { cleanupConnections } from '@/utils/cleanupConnections';
import { bindConnection, mirrorPrimaryNic, normalizeBindings, sanitizeBindings } from '@/engine';

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
  shouldFitView: boolean;

  // Counters (persistiti per evitare ID duplicati)
  deviceCounter: number;
  connectionCounter: number;

  // Connection mode state
  isConnecting: boolean;
  connectionStart: { deviceId: string; handleId: string | null } | null;

  // Backend sync state (canvas identity + dirty flag are persisted so a page
  // refresh can restore the session; isSyncing/lastSyncError are runtime only)
  currentProjectId: string | null;
  currentCanvasId: string | null;
  hasUnsavedChanges: boolean;
  isSyncing: boolean;
  lastSyncError: string | null;
  autoSaveEnabled: boolean;

  // Actions - Devices
  addDevice: (device: Omit<NetworkDevice, 'id'>) => void;
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
  startConnection: (deviceId: string, handleId: string | null) => void;
  endConnection: (deviceId: string, handleId: string | null) => void;
  cancelConnection: () => void;

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

  // Actions - Backend Sync
  setCurrentCanvas: (projectId: string, canvasId: string) => void;
  clearCurrentCanvas: () => void;
  loadFromBackend: (projectId: string, canvasId: string) => Promise<void>;
  saveToBackend: (options?: { silent?: boolean }) => Promise<boolean>;
  saveBeforeSwitch: () => Promise<boolean>;
  cancelPendingSave: () => void;
  setAutoSave: (enabled: boolean) => void;
  clearSyncError: () => void;

  // Internal helpers
  _triggerAutoSave: () => void;
}

/**
 * Debounced auto-save function
 * Delays backend save by 2 seconds after last change
 */
let debouncedSave: (() => void) & { cancel: () => void; flush: () => void };

/**
 * Counts local mutations. saveToBackend compares it before and after its
 * PUT to know whether something changed while the request was in flight.
 */
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
      shouldFitView: false,
      deviceCounter: 0,
      connectionCounter: 0,
      isConnecting: false,
      connectionStart: null,
      // Backend sync initial state
      currentProjectId: null,
      currentCanvasId: null,
      hasUnsavedChanges: false,
      isSyncing: false,
      lastSyncError: null,
      autoSaveEnabled: true,

      // Helper: Trigger auto-save (debounced)
      // This is called after any data modification
      _triggerAutoSave: () => {
        changeSeq++;
        set({ hasUnsavedChanges: true });
        if (!debouncedSave) {
          debouncedSave = debounce(() => {
            const state = get();
            if (state.autoSaveEnabled && state.currentProjectId && state.currentCanvasId) {
              state.saveToBackend({ silent: true });
            }
          }, 2000); // 2 second delay
        }
        debouncedSave();
      },

      // Device Actions
      addDevice: (device) => {
        set((state) => {
          const id = `dev-${state.deviceCounter}`;
          const newDevice: NetworkDevice = mirrorPrimaryNic({ ...device, id });
          return {
            devices: [...state.devices, newDevice],
            deviceCounter: state.deviceCounter + 1,
          };
        });
        get()._triggerAutoSave();
      },

      updateDevice: (id, updates) => {
        set((state) => {
          // A device with NICs is addressed through them: its device-level
          // ip/subnet/gateway follow the primary NIC on every edit
          const devices = state.devices.map((dev) =>
            dev.id === id ? mirrorPrimaryNic({ ...dev, ...updates }) : dev
          );
          // Ports/NICs edited: a link must never keep pointing at an
          // interface that was removed
          if ('ports' in updates || 'nics' in updates) {
            return { devices, connections: sanitizeBindings(devices, state.connections) };
          }
          return { devices };
        });
        get()._triggerAutoSave();
      },

      removeDevice: (id) => {
        set((state) => ({
          devices: state.devices.filter((dev) => dev.id !== id),
          connections: state.connections.filter((conn) => conn.source !== id && conn.target !== id),
          selectedDeviceId: state.selectedDeviceId === id ? null : state.selectedDeviceId,
        }));
        get()._triggerAutoSave();
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
        get()._triggerAutoSave();
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
        get()._triggerAutoSave();
      },

      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
        }));
        get()._triggerAutoSave();
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
        }));
        get()._triggerAutoSave();
      },

      getConnection: (id) => {
        return get().connections.find((conn) => conn.id === id);
      },

      getConnectionsForDevice: (deviceId) => {
        return get().connections.filter(
          (conn) => conn.source === deviceId || conn.target === deviceId
        );
      },

      startConnection: (deviceId, handleId) => {
        set({
          isConnecting: true,
          connectionStart: { deviceId, handleId },
        });
        document.body.classList.add('is-connecting');
      },

      endConnection: (deviceId, handleId) => {
        const { connectionStart, isConnecting } = get();
        if (!isConnecting || !connectionStart) return;

        get().addConnection({
          source: connectionStart.deviceId,
          target: deviceId,
          sourceHandle: connectionStart.handleId,
          targetHandle: handleId,
        });

        set({
          isConnecting: false,
          connectionStart: null,
        });
        document.body.classList.remove('is-connecting');
      },

      cancelConnection: () => {
        set({
          isConnecting: false,
          connectionStart: null,
        });
        document.body.classList.remove('is-connecting');
      },

      // Settings Actions
      setGlobalNetworkSettings: (settings) => {
        set((state) => ({
          globalNetworkSettings: { ...state.globalNetworkSettings, ...settings },
        }));
        get()._triggerAutoSave();
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
        set({ viewport });
        get()._triggerAutoSave();
      },

      triggerFitView: () => {
        set({ shouldFitView: true });
        // Reset immediately so it can be triggered again
        setTimeout(() => set({ shouldFitView: false }), 100);
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
        get()._triggerAutoSave();
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
        get()._triggerAutoSave();
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
        get()._triggerAutoSave();
      },

      loadTopology: (devices, connections) => {
        set((state) => {
          let devCounter = state.deviceCounter;
          let connCounter = state.connectionCounter;

          const devicesWithNewIds = devices.map((device) =>
            mirrorPrimaryNic({
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
      },

      // Backend Sync Actions
      setCurrentCanvas: (projectId, canvasId) => {
        set({
          currentProjectId: projectId,
          currentCanvasId: canvasId,
        });
      },

      clearCurrentCanvas: () => {
        // Disarm any pending autosave so it can't fire against a canvas
        // that no longer exists (e.g. right after deleting the active one)
        debouncedSave?.cancel();
        set({
          currentProjectId: null,
          currentCanvasId: null,
        });
      },

      cancelPendingSave: () => {
        debouncedSave?.cancel();
      },

      saveBeforeSwitch: async () => {
        // Disarm the debounced timer, then save synchronously: a stale timer
        // firing mid-switch would write against whatever canvas is current
        // at fire time (cross-canvas contamination)
        debouncedSave?.cancel();
        return get().saveToBackend({ silent: true });
      },

      loadFromBackend: async (projectId, canvasId) => {
        // A timer armed on the previous canvas must never fire during/after
        // the wholesale state overwrite below
        debouncedSave?.cancel();
        set({ isSyncing: true, lastSyncError: null });

        try {
          const canvas = await getCanvas(projectId, canvasId);

          // Canvases saved before interface bindings are bound here, in
          // memory only: the state stays clean (no dirty flag, no autosave)
          // and the bindings reach the backend with the next real edit
          const loadedDevices = (canvas.devices || []).map(mirrorPrimaryNic);
          const loadedConnections = normalizeBindings(loadedDevices, canvas.connections || []);

          set({
            currentProjectId: projectId,
            currentCanvasId: canvasId,
            devices: loadedDevices,
            connections: loadedConnections,
            viewport: canvas.settings?.viewport || { x: 0, y: 0, zoom: 1 },
            deviceCounter: canvas.settings?.deviceCounter || 0,
            connectionCounter: canvas.settings?.connectionCounter || 0,
            hasUnsavedChanges: false,
            isSyncing: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load canvas';
          set({
            isSyncing: false,
            lastSyncError: errorMessage,
          });
          console.error('[NetworkStore] Failed to load from backend:', error);
          throw error;
        }
      },

      saveToBackend: async (options) => {
        const state = get();

        // No canvas bound (welcome screen / local-only mode): nothing to
        // save, which is not a failure — callers awaiting a save-before-
        // switch must not be blocked by it
        if (!state.currentProjectId || !state.currentCanvasId) {
          console.warn('[NetworkStore] No current canvas set, skipping backend save');
          return true;
        }

        set({ isSyncing: true, lastSyncError: null });
        const seqAtStart = changeSeq;

        try {
          await updateCanvas(state.currentProjectId, state.currentCanvasId, {
            devices: state.devices,
            connections: state.connections,
            settings: {
              viewport: state.viewport,
              deviceCounter: state.deviceCounter,
              connectionCounter: state.connectionCounter,
            },
          });

          // An edit made while the PUT was in flight is not in the payload
          // just sent: the store must stay dirty until the next save
          set({ isSyncing: false, hasUnsavedChanges: changeSeq !== seqAtStart });
          if (!options?.silent) {
            toast.success('Canvas salvato con successo');
          }
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to save canvas';
          set({
            isSyncing: false,
            lastSyncError: errorMessage,
          });
          toast.error(`Errore durante il salvataggio: ${errorMessage}`);
          console.error('[NetworkStore] Failed to save to backend:', error);
          return false;
        }
      },

      setAutoSave: (enabled) => {
        set({ autoSaveEnabled: enabled });
      },

      clearSyncError: () => {
        set({ lastSyncError: null });
      },
    }),
    {
      name: 'pixelcake-network-v2',
      partialize: (state) => ({
        devices: state.devices,
        connections: state.connections,
        globalNetworkSettings: state.globalNetworkSettings,
        viewport: state.viewport,
        deviceCounter: state.deviceCounter,
        connectionCounter: state.connectionCounter,
        // Canvas identity + dirty flag survive a refresh so the session can
        // be restored (and orphaned edits pushed) instead of silently lost
        currentProjectId: state.currentProjectId,
        currentCanvasId: state.currentCanvasId,
        hasUnsavedChanges: state.hasUnsavedChanges,
      }),
      onRehydrateStorage: () => (state) => {
        // Device-level addressing follows the primary NIC (data saved before
        // this rule may carry a stale mirror). Plain assignment, like the
        // binding migration below, so it neither persists nor autosaves
        if (state) {
          state.devices = state.devices.map(mirrorPrimaryNic);
        }

        // Cleanup corrupted data from localStorage
        if (state && state.connections.length > 0) {
          const { cleanedConnections, maxCounter } = cleanupConnections(state.connections);

          // Update state with cleaned connections and correct counter.
          // Links persisted before interface bindings are bound here too; the
          // plain assignment (no set) keeps this migration from persisting,
          // marking the canvas dirty or autosaving on its own
          state.connections = normalizeBindings(state.devices, cleanedConnections);
          state.connectionCounter = Math.max(state.connectionCounter, maxCounter);

          console.log(`[Store Cleanup] Cleaned connections: ${state.connections.length}, Counter: ${state.connectionCounter}`);
        }
      },
    }
  )
);
