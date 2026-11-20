/**
 * Marker Store
 * Annotation mode («Modalità appunti»): whether it is on, and the tool,
 * colour and thickness it writes with. The notes («appunti», the marks of the
 * canvas) are seen only while it is on, and only while it is on the pointer
 * writes on the canvas and selects nothing; off, the board is clean.
 *
 * What is written is part of the canvas (`marks` of networkStore: saved, in
 * the project file), while building and while presenting alike: one sheet.
 *
 * (The code keeps the first name of the feature, the marker: markerStore,
 * MarksLayer, `marks` in the canvas and in the project file.)
 *
 * Nothing here is persisted.
 */

import { create } from 'zustand';
import type { MarkColour, MarkKind, MarkWidth } from '@/types';

/** What the pointer does in annotation mode: one of the marks, or the eraser */
export type MarkerTool = MarkKind | 'eraser';

export const MARKER_TOOLS: readonly MarkerTool[] = ['pen', 'text', 'arrow', 'ellipse', 'tick', 'cross', 'eraser'];

interface MarkerStore {
  active: boolean;
  tool: MarkerTool;
  color: MarkColour;
  width: MarkWidth;
  /** The marks the eraser has touched while it is pressed: shown faded, taken away when it is let go */
  erasing: string[];

  setActive: (active: boolean) => void;
  toggle: () => void;
  setTool: (tool: MarkerTool) => void;
  setColor: (color: MarkColour) => void;
  setWidth: (width: MarkWidth) => void;
  setErasing: (ids: string[]) => void;
}

export const useMarkerStore = create<MarkerStore>((set, get) => ({
  active: false,
  tool: 'pen',
  color: 'accent',
  width: 'thin',
  erasing: [],

  setActive: (active) => {
    if (get().active !== active) set({ active, erasing: [] });
  },

  toggle: () => {
    set((state) => ({ active: !state.active, erasing: [] }));
  },

  setTool: (tool) => {
    set({ tool });
  },

  setColor: (color) => {
    set({ color });
  },

  setWidth: (width) => {
    set({ width });
  },

  setErasing: (ids) => {
    const now = get().erasing;
    if (ids.length === now.length && ids.every((id, index) => id === now[index])) return;
    set({ erasing: ids });
  },
}));
