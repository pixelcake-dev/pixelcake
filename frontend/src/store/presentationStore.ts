/**
 * Presentation Store
 * The state of presentation mode: the tools for building are put away and
 * the drawing becomes something to show — ask it a question, break a piece
 * of it and watch what happens.
 *
 * Nothing here is saved, and nothing here ever changes the drawing: a
 * simulated failure is a list of ids kept in this store, handed to the
 * engine next to the topology (see engine/failures).
 */

import { create } from 'zustand';
import { useNetworkStore } from './networkStore';
import { useSimulationStore } from './simulationStore';
import { useUIStore } from './uiStore';

/** The exchanges that can be asked for while presenting */
export type PresentationFlow = 'ping' | 'web' | 'email';

/** The small menu opened by a click on a device or on a cable */
export interface PresentationMenu {
  kind: 'device' | 'connection';
  id: string;
  /** Where the click was, in the window */
  x: number;
  y: number;
}

/** The way of the answer on screen, for the canvas to mark */
export interface PresentationRoute {
  /** Cables the exchange travels on */
  links: string[];
  /** True when it gets there (and back) */
  arrives: boolean;
  /** The device the packet is dropped on, when it does not arrive */
  dropDeviceId: string | null;
}

interface PresentationStore {
  // State
  active: boolean;
  sourceId: string | null;
  targetId: string | null;
  flow: PresentationFlow;
  /** Devices taken as down */
  failedDevices: string[];
  /** Cables taken as cut */
  failedConnections: string[];
  /** Goes up by one each time the answer must be played again as it is */
  replaySeq: number;
  menu: PresentationMenu | null;
  route: PresentationRoute | null;
  /** The panel with question, answer and failures; closed, the canvas has the whole window */
  panelOpen: boolean;

  // Actions
  /** Enter presentation mode. False (and nothing happens) on an empty canvas */
  enter: () => boolean;
  /** Leave it: failures, question and answer are forgotten */
  exit: () => void;
  setSource: (deviceId: string | null) => void;
  setTarget: (deviceId: string | null) => void;
  swapEnds: () => void;
  setFlow: (flow: PresentationFlow) => void;
  /** Ask a question in one go */
  ask: (sourceId: string, targetId: string) => void;
  toggleDeviceFailure: (deviceId: string) => void;
  toggleConnectionFailure: (connectionId: string) => void;
  repairAll: () => void;
  replay: () => void;
  openMenu: (menu: PresentationMenu) => void;
  closeMenu: () => void;
  setRoute: (route: PresentationRoute | null) => void;
  setPanelOpen: (open: boolean) => void;
  /** Another canvas came on screen: what was asked and broken belonged to the old one */
  resetCanvasState: () => void;
  /** Forget whatever is no longer in the drawing */
  prune: (deviceIds: string[], connectionIds: string[]) => void;
}

const CANVAS_STATE = {
  sourceId: null,
  targetId: null,
  failedDevices: [] as string[],
  failedConnections: [] as string[],
  menu: null,
  route: null,
};

function toggled(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter(entry => entry !== id) : [...list, id];
}

export const usePresentationStore = create<PresentationStore>((set, get) => ({
  // Initial State
  active: false,
  ...CANVAS_STATE,
  flow: 'ping',
  replaySeq: 0,
  panelOpen: true,

  // Actions
  enter: () => {
    if (get().active) return true;
    const network = useNetworkStore.getState();
    if (network.devices.length === 0) return false;

    // Put the building tools away: nothing stays selected, open or moving
    useSimulationStore.getState().stopSimulation();
    useUIStore.getState().closeContextMenu();
    network.clearSelection();
    network.setSelectedDevice(null);
    network.setHoveredDevice(null);

    set({ active: true, ...CANVAS_STATE, flow: 'ping', panelOpen: true });
    return true;
  },

  exit: () => {
    if (!get().active) return;
    useSimulationStore.getState().stopSimulation();
    set({ active: false, ...CANVAS_STATE });
  },

  setSource: deviceId => {
    set(state => ({
      sourceId: deviceId,
      // Picking the destination as the start turns the question round
      targetId: deviceId !== null && deviceId === state.targetId ? state.sourceId : state.targetId,
    }));
  },

  setTarget: deviceId => {
    set(state => ({
      targetId: deviceId,
      sourceId: deviceId !== null && deviceId === state.sourceId ? state.targetId : state.sourceId,
    }));
  },

  swapEnds: () => {
    set(state => ({ sourceId: state.targetId, targetId: state.sourceId }));
  },

  setFlow: flow => {
    set({ flow });
  },

  ask: (sourceId, targetId) => {
    if (sourceId === targetId) return;
    set(state => ({ sourceId, targetId, replaySeq: state.replaySeq + 1 }));
  },

  toggleDeviceFailure: deviceId => {
    set(state => ({ failedDevices: toggled(state.failedDevices, deviceId) }));
  },

  toggleConnectionFailure: connectionId => {
    set(state => ({ failedConnections: toggled(state.failedConnections, connectionId) }));
  },

  repairAll: () => {
    if (get().failedDevices.length === 0 && get().failedConnections.length === 0) return;
    set({ failedDevices: [], failedConnections: [] });
  },

  replay: () => {
    set(state => ({ replaySeq: state.replaySeq + 1 }));
  },

  openMenu: menu => {
    set({ menu });
  },

  closeMenu: () => {
    if (get().menu !== null) set({ menu: null });
  },

  setRoute: route => {
    set({ route });
  },

  setPanelOpen: open => {
    set({ panelOpen: open });
  },

  resetCanvasState: () => {
    useSimulationStore.getState().stopSimulation();
    set({ ...CANVAS_STATE });
  },

  prune: (deviceIds, connectionIds) => {
    const state = get();
    const hasDevice = (id: string) => deviceIds.includes(id);
    const hasConnection = (id: string) => connectionIds.includes(id);

    const next: Partial<PresentationStore> = {};
    if (state.sourceId !== null && !hasDevice(state.sourceId)) next.sourceId = null;
    if (state.targetId !== null && !hasDevice(state.targetId)) next.targetId = null;
    if (!state.failedDevices.every(hasDevice)) {
      next.failedDevices = state.failedDevices.filter(hasDevice);
    }
    if (!state.failedConnections.every(hasConnection)) {
      next.failedConnections = state.failedConnections.filter(hasConnection);
    }
    if (state.menu) {
      const exists = state.menu.kind === 'device' ? hasDevice(state.menu.id) : hasConnection(state.menu.id);
      if (!exists) next.menu = null;
    }
    if (Object.keys(next).length > 0) set(next);
  },
}));
