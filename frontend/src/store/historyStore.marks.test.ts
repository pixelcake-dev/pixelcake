/**
 * The marker and the history together: what is written on a board with the
 * marker is part of the board, so undo and redo take it back and put it
 * back like any other edit, with nothing written for it in the history.
 *
 * Isolation: the stores read localStorage when they are created, so each
 * test re-imports them (a re-import is a reload).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CanvasMark } from '@/types/network';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

async function loadApp() {
  vi.resetModules();
  const { useNetworkStore } = await import('./networkStore');
  await import('./projectStore');
  const history = await import('./historyStore');
  return { network: useNetworkStore, history };
}

/** The end of the task an action runs in: the step it made is closed then */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const line = (x: number): Omit<CanvasMark, 'id'> => ({
  kind: 'pen',
  color: 'accent',
  width: 'thin',
  points: [x, 10, x + 20, 30, x + 40, 15],
  seed: 7,
});

const marks = (app: Awaited<ReturnType<typeof loadApp>>) => app.network.getState().marks.map((mark) => mark.id);

beforeEach(() => {
  localStorage.clear();
});

describe('the marks of the marker in the history of the board', () => {
  it('a mark written is undone and redone', async () => {
    const app = await loadApp();
    const id = app.network.getState().addMark(line(0));
    await settle();
    expect(marks(app)).toEqual([id]);

    expect(app.history.undo()).toBe(true);
    expect(marks(app)).toEqual([]);
    expect(app.history.redo()).toBe(true);
    expect(marks(app)).toEqual([id]);
  });

  it('what the eraser took and what «clear» took come back with undo', async () => {
    const app = await loadApp();
    const first = app.network.getState().addMark(line(0));
    await settle();
    const second = app.network.getState().addMark(line(100));
    await settle();

    app.network.getState().removeMarks([first as string]);
    await settle();
    expect(marks(app)).toEqual([second]);
    app.history.undo();
    expect(marks(app)).toEqual([first, second]);

    app.network.getState().clearMarks();
    await settle();
    expect(marks(app)).toEqual([]);
    app.history.undo();
    expect(marks(app)).toEqual([first, second]);
  });

  it('a mark and a device are two steps, taken back in order', async () => {
    const app = await loadApp();
    app.network.getState().addDevice({ type: 'PC', label: 'PC-1', ip: '', subnet: '', gateway: '', position: { x: 0, y: 0 } });
    await settle();
    app.network.getState().addMark(line(0));
    await settle();

    app.history.undo();
    expect(marks(app)).toEqual([]);
    expect(app.network.getState().devices).toHaveLength(1);
    app.history.undo();
    expect(app.network.getState().devices).toHaveLength(0);
  });
});
