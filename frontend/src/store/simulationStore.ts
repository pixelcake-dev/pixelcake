/**
 * Simulation Store
 * The packet travelling on the canvas: which way it goes, where it is now.
 *
 * Whoever wants an animation calls `startSimulation` with the devices to go
 * through (and, when the engine gave them, the cables between them).
 * PacketAnimation owns the timing and moves the packet; CustomEdge draws it.
 * Nothing here is saved.
 */

import { create } from 'zustand';
import type { FlowModelType } from '@/types';

/** How fast the packet travels: 1 is the normal pace */
export const SIMULATION_SPEEDS = [0.5, 1, 2] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

interface SimulationStore {
  // State
  isRunning: boolean;
  /** Goes up by one at every start: tells a run from the one before it */
  runId: number;
  flowModel: FlowModelType;
  /** Device ids the packet goes through, in order */
  path: string[];
  /**
   * `links[i]` is the id of the cable between `path[i]` and `path[i + 1]`.
   * Empty string, or a shorter list: not known, the first working cable
   * between the two devices is taken.
   */
  links: string[];
  speed: SimulationSpeed;
  /** Index in `path` of the device the packet is leaving */
  currentHop: number;
  /** The device the packet is on, while it stops there */
  activeDeviceId: string | null;
  /** The cable the packet is travelling on */
  currentConnectionId: string | null;
  /** How long it takes to cross it (ms) */
  currentEdgeDuration: number;
  /** True when it travels from the target end of the cable to its source end */
  isPacketReversed: boolean;

  // Actions
  /** Start an animation (replacing a running one) and return its `runId` */
  startSimulation: (path: string[], flowModel: FlowModelType, links?: string[]) => number;
  stopSimulation: () => void;
  setSpeed: (speed: SimulationSpeed) => void;
  setCurrentHop: (hop: number) => void;
  setActiveDevice: (deviceId: string | null) => void;
  setCurrentConnection: (connectionId: string | null, isReversed?: boolean, duration?: number) => void;
  resetSimulation: () => void;
}

const IDLE = {
  isRunning: false,
  currentHop: 0,
  activeDeviceId: null,
  currentConnectionId: null,
  currentEdgeDuration: 0,
  isPacketReversed: false,
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  // Initial State
  ...IDLE,
  runId: 0,
  flowModel: 'ping',
  path: [],
  links: [],
  speed: 1,

  // Actions
  startSimulation: (path, flowModel, links = []) => {
    const runId = get().runId + 1;
    set({ ...IDLE, isRunning: true, runId, flowModel, path, links });
    return runId;
  },

  stopSimulation: () => {
    set({ ...IDLE });
  },

  setSpeed: speed => {
    set({ speed });
  },

  setCurrentHop: hop => {
    set({ currentHop: hop });
  },

  setActiveDevice: deviceId => {
    set({ activeDeviceId: deviceId });
  },

  setCurrentConnection: (connectionId, isReversed = false, duration = 0) => {
    set({
      currentConnectionId: connectionId,
      isPacketReversed: isReversed,
      currentEdgeDuration: duration,
    });
  },

  resetSimulation: () => {
    set({ ...IDLE, path: [], links: [] });
  },
}));
