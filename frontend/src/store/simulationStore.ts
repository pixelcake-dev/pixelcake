/**
 * Simulation Store
 * The packet travelling on the canvas: which way it goes, where it is now.
 *
 * Whoever wants an animation calls `startSimulation` with the devices to go
 * through (and, when the engine gave them, the cables between them).
 * PacketAnimation owns the timing and moves the packet; CustomEdge draws it.
 *
 * A run can be told how its question ends (`outcome`). When the packet gets
 * to the end of its way that becomes the `answer` left on the canvas: the
 * device it ended on says it with the lamp of its drawing, until another
 * run starts, a run is stopped, or the answer is taken away (`clearAnswer`:
 * a click on the empty canvas, a change to the drawing).
 * Nothing here is saved.
 */

import { create } from 'zustand';
import type { FlowModelType } from '@/types';

/** How fast the packet travels: 1 is the normal pace */
export const SIMULATION_SPEEDS = [0.5, 1, 2] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

/** How a question ends on the canvas: on which device, and whether it arrives there */
export interface SimulationOutcome {
  arrives: boolean;
  /** The device that answers, or the one the question stops on */
  deviceId: string;
}

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
  /** How the run in progress ends, when whoever started it said so */
  outcome: SimulationOutcome | null;
  /** What the last run that got to its end left on the canvas */
  answer: SimulationOutcome | null;

  // Actions
  /**
   * Start an animation (replacing a running one, and the answer of the one
   * before) and return its `runId`
   */
  startSimulation: (
    path: string[],
    flowModel: FlowModelType,
    links?: string[],
    outcome?: SimulationOutcome | null
  ) => number;
  /** The packet got to the end of its way: the run is over, its answer stays */
  finishSimulation: () => void;
  /**
   * Leave an answer on the canvas with no run: a question that stops on the
   * very device it starts from sends no packet anywhere
   */
  leaveAnswer: (outcome: SimulationOutcome | null) => void;
  /** Stop a run where it is: it leaves no answer, and takes away the one that was there */
  stopSimulation: () => void;
  /** Take the answer off the canvas; a run in progress goes on */
  clearAnswer: () => void;
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
  outcome: null,
  answer: null,
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
  startSimulation: (path, flowModel, links = [], outcome = null) => {
    const runId = get().runId + 1;
    set({ ...IDLE, isRunning: true, runId, flowModel, path, links, outcome });
    return runId;
  },

  finishSimulation: () => {
    set((state) => ({ ...IDLE, answer: state.outcome }));
  },

  leaveAnswer: (outcome) => {
    set({ ...IDLE, answer: outcome });
  },

  stopSimulation: () => {
    set({ ...IDLE });
  },

  clearAnswer: () => {
    if (get().answer !== null) set({ answer: null });
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
