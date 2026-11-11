/**
 * Simulation Store
 * Manages network simulation state and packet flow
 */

import { create } from 'zustand';
import type { FlowModelType } from '@/types';

interface SimulationStore {
  // State
  isRunning: boolean;
  sourceId: string | null;
  targetId: string | null;
  flowModel: FlowModelType;
  path: string[];
  currentStep: number;
  currentHop: number; // Current hop index in path (0-based)
  hopDelay: number; // Delay at each intermediate hop (ms)
  isHopPaused: boolean; // Whether animation is paused at a hop
  packetPosition: { x: number; y: number } | null;
  currentConnectionId: string | null; // ID of connection currently being traversed
  currentEdgePath: string | null; // SVG path of current edge for global circle animation
  currentEdgeDuration: number; // Duration of current edge animation (ms)
  isPacketReversed: boolean; // Whether packet is traveling in reverse direction of connection

  // Actions
  startSimulation: (path: string[], flowModel: FlowModelType) => void;
  stopSimulation: () => void;
  setFlowModel: (model: FlowModelType) => void;
  setCurrentStep: (step: number) => void;
  setCurrentHop: (hop: number) => void;
  setHopDelay: (delay: number) => void;
  pauseAtHop: () => void;
  resumeFromHop: () => void;
  setPacketPosition: (position: { x: number; y: number } | null) => void;
  setCurrentConnection: (connectionId: string | null, isReversed?: boolean) => void;
  setCurrentEdgeAnimation: (path: string, duration: number) => void;
  resetSimulation: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  // Initial State
  isRunning: false,
  sourceId: null,
  targetId: null,
  flowModel: 'ping',
  path: [],
  currentStep: 0,
  currentHop: 0,
  hopDelay: 400, // 400ms pause at each intermediate hop
  isHopPaused: false,
  packetPosition: null,
  currentConnectionId: null,
  currentEdgePath: null,
  currentEdgeDuration: 0,
  isPacketReversed: false,

  // Actions
  startSimulation: (path, flowModel) => {
    set({
      isRunning: true,
      flowModel,
      path,
      currentStep: 0,
      currentHop: 0,
      isHopPaused: false,
    });
  },

  stopSimulation: () => {
    set({
      isRunning: false,
      currentStep: 0,
      currentHop: 0,
      isHopPaused: false,
      packetPosition: null,
      currentConnectionId: null,
      currentEdgePath: null,
      currentEdgeDuration: 0,
    });
  },

  setFlowModel: model => {
    set({ flowModel: model });
  },

  setCurrentStep: step => {
    set({ currentStep: step });
  },

  setCurrentHop: hop => {
    set({ currentHop: hop });
  },

  setHopDelay: delay => {
    set({ hopDelay: delay });
  },

  pauseAtHop: () => {
    set({ isHopPaused: true });
  },

  resumeFromHop: () => {
    set({ isHopPaused: false });
  },

  setPacketPosition: position => {
    set({ packetPosition: position });
  },

  setCurrentConnection: (connectionId, isReversed = false) => {
    set({
      currentConnectionId: connectionId,
      isPacketReversed: isReversed
    });
  },

  setCurrentEdgeAnimation: (path, duration) => {
    set({
      currentEdgePath: path,
      currentEdgeDuration: duration,
    });
  },

  resetSimulation: () => {
    set({
      isRunning: false,
      sourceId: null,
      targetId: null,
      path: [],
      currentStep: 0,
      currentHop: 0,
      isHopPaused: false,
      packetPosition: null,
      currentConnectionId: null,
      currentEdgePath: null,
      currentEdgeDuration: 0,
    });
  },
}));
