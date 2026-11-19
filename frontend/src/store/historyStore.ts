/**
 * Undo and redo of the drawing.
 *
 * The history is of the board on screen: each board of the project keeps
 * its own for as long as the page is open (switching to another board and
 * back finds it again), and nothing of it is written to the browser's
 * storage or to the project file. Opening or creating a project starts every
 * history afresh, loading a sample the one of its board.
 *
 * **What a step holds.** The board as the project file keeps it: every field
 * `getCanvasSnapshot()` of networkStore hands over but the view, read from
 * the store under the same name (devices, cables, areas, counters, and
 * whatever a board is given later). A field written there is covered, with
 * nothing written here. A step is the state of those fields before it: the
 * stores never change an object in place, so a step holds references, and
 * what it did not change is shared with the steps around it rather than
 * copied (a drag of one device on a board of two hundred costs a list and
 * one device). A list is held as a list of its own, with the same things in
 * it: the engine keeps what it worked out for a list of the store (the
 * leases of DHCP, keyed by the list) for as long as the list is around, and
 * a history holding the lists themselves would keep all of that alive.
 *
 * **What a step is.** Whatever changes those fields, wherever it comes from
 * (the canvas, a window, the terminal, a menu), is seen here through a
 * subscription to networkStore: nothing has to call in. Changes made in one
 * go (the same task of the page) are one step, so that a save, a paste, a
 * bulk add, an import or a command of the terminal is one, however many
 * writes it makes; and while a button of the pointer is held, everything
 * changed until it is let go is one step too (a drag, an area moved or
 * resized, a stroke drawn), see `beginGesture`. A step that leaves the board
 * as it was (a window saved with nothing changed) is not kept.
 *
 * **What is not a step.** What is not in those fields: the view, the
 * selection, the windows, the network settings of the project, a
 * presentation, the preferences of the browser. A board that takes the place
 * of another (a switch of board, a project opened) is not a step either.
 */

import { create } from 'zustand';
import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';
import { describeStep, type StepName } from '@/utils/historySteps';
import { useNetworkStore } from './networkStore';
import { usePresentationStore } from './presentationStore';
import { useUIStore } from './uiStore';

/** The steps a board keeps: the oldest go first */
export const HISTORY_LIMIT = 100;

/** What the menus show of the history of the board on screen */
interface HistoryView {
  canUndo: boolean;
  canRedo: boolean;
  /** What undo would take back, when a few words can say it */
  undoStep: StepName | null;
  /** What redo would do again, when a few words can say it */
  redoStep: StepName | null;
}

export const useHistoryStore = create<HistoryView>(() => ({
  canUndo: false,
  canRedo: false,
  undoStep: null,
  redoStep: null,
}));

type NetworkState = ReturnType<typeof useNetworkStore.getState>;

/** The fields of a board, by the name they have in networkStore */
type BoardState = Record<string, unknown>;

interface BoardHistory {
  /** The board before each step, the last step last */
  past: BoardState[];
  /** The board before each undo, the last undone last */
  future: BoardState[];
}

const histories = new Map<string, BoardHistory>();

/** The step under way: the board it is made on, and that board before it */
let pending: { board: string; before: BoardState } | null = null;

/** True while a step is undone or redone: that is not a step of its own */
let restoring = false;

/** The buttons of the pointer held down (by pointer id), see beginGesture */
const pressed = new Set<number>();

/**
 * The board on screen when networkStore keeps no id for it (a first start, a
 * drawing older than projects): the active canvas of the project, which
 * projectStore names once it has paired the two (nameUnnamedBoard)
 */
let unnamedBoard = '';

const boardOf = (state: NetworkState): string => state.canvasId ?? unnamedBoard;

const fieldOf = (state: NetworkState, key: string): unknown => (state as unknown as BoardState)[key];

/** The fields of a board: what the project file keeps of it, but the view */
function boardFields(state: NetworkState): string[] {
  return Object.keys(state.getCanvasSnapshot()).filter((key) => key !== 'viewport' && key in state);
}

/** A field as a step holds it: a list of its own, with the same things in it (see above) */
const held = (value: unknown): unknown => (Array.isArray(value) ? value.slice() : value);

function pick(state: NetworkState, keys: Iterable<string>): BoardState {
  const board: BoardState = {};
  for (const key of keys) board[key] = held(fieldOf(state, key));
  return board;
}

/** Two values of a field that say the same: the same object, or lists of the same things */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((item, index) => item === b[index] || JSON.stringify(item) === JSON.stringify(b[index]));
}

/** True when the board is as it was before the step */
function unchanged(before: BoardState, state: NetworkState): boolean {
  return Object.keys(before).every((key) => sameValue(before[key], fieldOf(state, key)));
}

function historyOf(board: string): BoardHistory {
  let history = histories.get(board);
  if (!history) {
    history = { past: [], future: [] };
    histories.set(board, history);
  }
  return history;
}

/** The step under way is over: kept, unless it changed nothing */
function closeStep(after: NetworkState): void {
  const step = pending;
  if (!step) return;
  pending = null;
  if (unchanged(step.before, after)) return;
  const history = historyOf(step.board);
  history.past.push(step.before);
  if (history.past.length > HISTORY_LIMIT) history.past.splice(0, history.past.length - HISTORY_LIMIT);
  history.future = [];
}

/** The step under way ends once no button of the pointer is held */
function closeWhenLetGo(): void {
  if (pressed.size > 0 || !pending) return;
  closeStep(useNetworkStore.getState());
  publish();
}

/** The menus learn what can be undone and redone on the board on screen */
function publish(): void {
  const state = useNetworkStore.getState();
  const history = histories.get(boardOf(state));
  const past = history?.past ?? [];
  const future = history?.future ?? [];
  const now = pick(state, boardFields(state));
  useHistoryStore.setState({
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoStep: past.length > 0 ? describeStep(past[past.length - 1], now) : null,
    redoStep: future.length > 0 ? describeStep(now, future[future.length - 1]) : null,
  });
}

// The fields of the board as the last change found them: a field the snapshot
// hands over only when it holds something is seen both when it appears and
// when it goes
let lastFields = boardFields(useNetworkStore.getState());

useNetworkStore.subscribe((state, previous) => {
  const now = boardFields(state);
  const fields = [...new Set([...lastFields, ...now])];
  lastFields = now;
  if (restoring) return;

  // Another board took the place of this one (a switch, a project opened):
  // not a step. What was under way ends on the board it was made on
  if (state.canvasId !== previous.canvasId || state.canvasRevision !== previous.canvasRevision) {
    closeStep(previous);
    publish();
    return;
  }

  if (!fields.some((key) => fieldOf(state, key) !== fieldOf(previous, key))) return;
  if (!pending) {
    pending = { board: boardOf(previous), before: pick(previous, fields) };
    // (the end of the task: whatever else the same action writes is part of it)
    if (pressed.size === 0) queueMicrotask(closeWhenLetGo);
  } else {
    // (a field seen for the first time in this step had not changed before it)
    for (const key of fields) if (!(key in pending.before)) pending.before[key] = held(fieldOf(previous, key));
  }
});

/**
 * A button of the pointer is pressed: whatever the drawing is given until it
 * is let go is one step (a drag of devices, an area moved or resized, a
 * stroke). The window calls it on every press (utils/undoActions.ts)
 */
export function beginGesture(pointerId = 0): void {
  pressed.add(pointerId);
}

/** The button is let go (no id: every button, as when the page loses the focus) */
export function endGesture(pointerId?: number): void {
  if (pointerId === undefined) pressed.clear();
  else pressed.delete(pointerId);
  // (after the other handlers of the same release, which may still write)
  if (pressed.size === 0) setTimeout(closeWhenLetGo, 0);
}

/** The step under way is closed now (an undo needs it in the history) */
export function commitStep(): void {
  if (!pending) return;
  closeStep(useNetworkStore.getState());
  publish();
}

/** Undo and redo are for the drawing being built: not while presenting, not during a drag */
function canAct(): boolean {
  return !usePresentationStore.getState().active && pressed.size === 0;
}

/** The board as it was before a step, put back on screen */
function restore(target: BoardState): void {
  const current = useNetworkStore.getState();
  const next: BoardState = { ...target };
  // (an id once given is not given again on the board: the counters only go up)
  for (const counter of ['deviceCounter', 'connectionCounter']) {
    if (counter in next) next[counter] = Math.max(Number(next[counter]) || 0, Number(fieldOf(current, counter)) || 0);
  }
  const devices = (next.devices ?? current.devices) as NetworkDevice[];
  const connections = (next.connections ?? current.connections) as NetworkConnection[];
  const areas = (next.areas ?? current.areas) as CanvasArea[];
  const deviceIds = new Set(devices.map((device) => device.id));
  const connectionIds = new Set(connections.map((connection) => connection.id));
  const areaIds = new Set(areas.map((area) => area.id));

  // The selection keeps what is still there
  const selectedDeviceIds = current.selectedDeviceIds.filter((id) => deviceIds.has(id));
  const selectedAreaIds = current.selectedAreaIds.filter((id) => areaIds.has(id));
  const kept = (id: string | null, ids: Set<string>) => (id !== null && ids.has(id) ? id : null);

  restoring = true;
  try {
    useNetworkStore.setState({
      ...next,
      selectedDeviceIds,
      selectedAreaIds,
      selectedAreaId: selectedAreaIds.length === 1 && selectedDeviceIds.length === 0 ? selectedAreaIds[0] : null,
      selectedDeviceId: kept(current.selectedDeviceId, deviceIds),
      hoveredDeviceId: kept(current.hoveredDeviceId, deviceIds),
      editingAreaId: null,
    } as Partial<NetworkState>);
  } finally {
    restoring = false;
  }
  // An edit of the project like any other
  useNetworkStore.getState().markChanged();

  // A menu was about the drawing as it was; a window about something that is gone closes
  const ui = useUIStore.getState();
  ui.closeContextMenu();
  if (ui.modals.inspector && ui.inspectorDevice && !deviceIds.has(ui.inspectorDevice.id)) ui.closeModal('inspector');
  if (ui.modals.connectionInspector && ui.inspectorConnection && !connectionIds.has(ui.inspectorConnection.id)) {
    ui.closeModal('connectionInspector');
  }
}

/** Takes back the last step of the board on screen; false when there is none, or not now */
export function undo(): boolean {
  if (!canAct()) return false;
  commitStep();
  const state = useNetworkStore.getState();
  const history = histories.get(boardOf(state));
  const target = history?.past.pop();
  if (!history || !target) return false;
  history.future.push(pick(state, new Set([...Object.keys(target), ...boardFields(state)])));
  restore(target);
  publish();
  return true;
}

/** Does again the last step undone; false when there is none, or not now */
export function redo(): boolean {
  if (!canAct()) return false;
  commitStep();
  const state = useNetworkStore.getState();
  const history = histories.get(boardOf(state));
  const target = history?.future.pop();
  if (!history || !target) return false;
  history.past.push(pick(state, new Set([...Object.keys(target), ...boardFields(state)])));
  restore(target);
  publish();
  return true;
}

/** Every board starts afresh: a project opened or created */
export function clearHistory(): void {
  pending = null;
  histories.clear();
  publish();
}

/** The board on screen starts afresh: a sample loaded in its place */
export function clearCanvasHistory(): void {
  pending = null;
  histories.delete(boardOf(useNetworkStore.getState()));
  publish();
}

/**
 * The canvas of the project the board on screen is, while networkStore keeps
 * no id for it (projectStore tells it at start-up): its steps are found again
 * under that id once another board has been on screen
 */
export function nameUnnamedBoard(canvasId: string): void {
  if (canvasId === unnamedBoard) return;
  const history = histories.get(unnamedBoard);
  if (history) {
    histories.delete(unnamedBoard);
    histories.set(canvasId, history);
  }
  if (pending?.board === unnamedBoard) pending.board = canvasId;
  unnamedBoard = canvasId;
}

/** A board deleted: its history goes with it */
export function forgetCanvasHistory(canvasId: string): void {
  histories.delete(canvasId);
  publish();
}
