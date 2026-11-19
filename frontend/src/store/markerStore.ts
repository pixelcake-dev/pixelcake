/**
 * Marker Store
 * The marker («Pennarello»): whether it is in use, and the tool, colour and
 * thickness it writes with. While it is in use the pointer writes on the
 * canvas and selects nothing; put away, what was written is inert.
 *
 * What is written while building is part of the canvas (`marks` of
 * networkStore: saved, in the project file). While presenting it is the
 * presenter's pen: the marks are kept here, on top of the canvas, never
 * saved, and they are gone when the presentation ends or another canvas
 * comes on screen (presentationStore says when).
 *
 * Nothing here is persisted.
 */

import { create } from 'zustand';
import type { CanvasMark, MarkColour, MarkKind, MarkWidth } from '@/types';
import { nextMarkId, tidyMark } from '@/utils/canvasMarks';

/** What the pointer does with the marker: one of the marks, or the eraser */
export type MarkerTool = MarkKind | 'eraser';

export const MARKER_TOOLS: readonly MarkerTool[] = ['pen', 'text', 'arrow', 'ellipse', 'tick', 'cross', 'eraser'];

interface MarkerStore {
  active: boolean;
  tool: MarkerTool;
  color: MarkColour;
  width: MarkWidth;
  /** While presenting: what the presenter wrote, on top of the canvas */
  presenterMarks: CanvasMark[];
  /** The marks the eraser has touched while it is pressed: shown faded, taken away when it is let go */
  erasing: string[];

  setActive: (active: boolean) => void;
  toggle: () => void;
  setTool: (tool: MarkerTool) => void;
  setColor: (color: MarkColour) => void;
  setWidth: (width: MarkWidth) => void;
  setErasing: (ids: string[]) => void;

  /** A mark of the presenter: the id it got, or null when it is no mark */
  addPresenterMark: (mark: Omit<CanvasMark, 'id'>) => string | null;
  removePresenterMarks: (ids: string[]) => void;
  clearPresenterMarks: () => void;
}

export const useMarkerStore = create<MarkerStore>((set, get) => ({
  active: false,
  tool: 'pen',
  color: 'accent',
  width: 'thin',
  presenterMarks: [],
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

  addPresenterMark: (mark) => {
    const kept = tidyMark(mark);
    if (!kept) return null;
    const id = nextMarkId(get().presenterMarks);
    set((state) => ({ presenterMarks: [...state.presenterMarks, { id, ...kept }] }));
    return id;
  },

  removePresenterMarks: (ids) => {
    const gone = new Set(ids);
    if (!get().presenterMarks.some((mark) => gone.has(mark.id))) return;
    set((state) => ({ presenterMarks: state.presenterMarks.filter((mark) => !gone.has(mark.id)) }));
  },

  clearPresenterMarks: () => {
    if (get().presenterMarks.length > 0) set({ presenterMarks: [] });
  },
}));
