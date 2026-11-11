/**
 * Store-level tests for the localStorage↔backend sync behavior of networkStore.
 *
 * Several tests here encode the FIXED sync contract (silent autosave, boolean
 * result from saveToBackend, pending-timer cancellation on canvas load,
 * persisted canvas identity + dirty flag) and are expected to be red until the
 * corresponding fixes land — they pin the exact data-loss bugs being removed.
 *
 * Isolation notes: networkStore keeps the debounced save in module-level state
 * and the zustand store is a module singleton, so every test re-imports the
 * module through vi.resetModules() for a fresh store + fresh timer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import type { NetworkDevice } from '@/types';

vi.mock('@/api', () => ({
  getCanvas: vi.fn(),
  updateCanvas: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

function makeDevice(overrides: Partial<Omit<NetworkDevice, 'id'>> = {}): Omit<NetworkDevice, 'id'> {
  return {
    type: 'PC',
    label: 'Test PC',
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeCanvasResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'canvas-b',
    name: 'Canvas B',
    devices: [],
    connections: [],
    settings: {
      viewport: { x: 5, y: 5, zoom: 1 },
      deviceCounter: 0,
      connectionCounter: 0,
    },
    ...overrides,
  };
}

async function freshStore() {
  vi.resetModules();
  const api = await import('@/api');
  const { toast } = await import('sonner');
  const { useNetworkStore } = await import('./networkStore');
  return {
    store: useNetworkStore,
    updateCanvas: api.updateCanvas as Mock,
    getCanvas: api.getCanvas as Mock,
    toastSuccess: toast.success as Mock,
    toastError: toast.error as Mock,
  };
}

describe('networkStore backend sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('autosaves once, 2s after a mutation, with the full canvas payload', async () => {
    const { store, updateCanvas } = await freshStore();
    updateCanvas.mockResolvedValue(makeCanvasResponse());

    store.getState().setCurrentCanvas('proj-1', 'canvas-1');
    store.getState().addDevice(makeDevice());

    expect(updateCanvas).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);

    expect(updateCanvas).toHaveBeenCalledTimes(1);
    const [projectId, canvasId, payload] = updateCanvas.mock.calls[0];
    expect(projectId).toBe('proj-1');
    expect(canvasId).toBe('canvas-1');
    expect(payload.devices).toHaveLength(1);
    expect(payload.connections).toHaveLength(0);
    expect(payload.settings).toMatchObject({
      deviceCounter: 1,
      connectionCounter: 0,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });

  it('never PUTs when no canvas is set (the orphaned-edits guard)', async () => {
    const { store, updateCanvas } = await freshStore();

    store.getState().addDevice(makeDevice());
    await vi.advanceTimersByTimeAsync(5000);

    expect(updateCanvas).not.toHaveBeenCalled();
  });

  it('coalesces rapid mutations into a single PUT', async () => {
    const { store, updateCanvas } = await freshStore();
    updateCanvas.mockResolvedValue(makeCanvasResponse());

    store.getState().setCurrentCanvas('proj-1', 'canvas-1');
    store.getState().addDevice(makeDevice({ label: 'A' }));
    store.getState().addDevice(makeDevice({ label: 'B' }));
    store.getState().addDevice(makeDevice({ label: 'C' }));
    await vi.advanceTimersByTimeAsync(2000);

    expect(updateCanvas).toHaveBeenCalledTimes(1);
    expect(updateCanvas.mock.calls[0][2].devices).toHaveLength(3);
  });

  it('saveToBackend returns true when there is nothing to save (no canvas set)', async () => {
    const { store, updateCanvas } = await freshStore();

    const ok = await store.getState().saveToBackend();

    expect(ok).toBe(true);
    expect(updateCanvas).not.toHaveBeenCalled();
  });

  it('saveToBackend returns false and records the error when the PUT fails', async () => {
    const { store, updateCanvas, toastError } = await freshStore();
    updateCanvas.mockRejectedValue(new Error('boom'));

    store.getState().setCurrentCanvas('proj-1', 'canvas-1');
    const ok = await store.getState().saveToBackend();

    expect(ok).toBe(false);
    expect(store.getState().lastSyncError).toBe('boom');
    expect(toastError).toHaveBeenCalled();
  });

  it('saveToBackend({ silent: true }) shows no success toast; manual save shows one', async () => {
    const { store, updateCanvas, toastSuccess } = await freshStore();
    updateCanvas.mockResolvedValue(makeCanvasResponse());
    store.getState().setCurrentCanvas('proj-1', 'canvas-1');

    await store.getState().saveToBackend({ silent: true });
    expect(toastSuccess).not.toHaveBeenCalled();

    await store.getState().saveToBackend();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('manual saveToBackend works even with autosave disabled', async () => {
    const { store, updateCanvas } = await freshStore();
    updateCanvas.mockResolvedValue(makeCanvasResponse());

    store.getState().setCurrentCanvas('proj-1', 'canvas-1');
    store.getState().setAutoSave(false);
    const ok = await store.getState().saveToBackend();

    expect(ok).toBe(true);
    expect(updateCanvas).toHaveBeenCalledTimes(1);
  });

  it('loadFromBackend tolerates a canvas with missing settings', async () => {
    const { store, getCanvas } = await freshStore();
    getCanvas.mockResolvedValue(makeCanvasResponse({ settings: undefined }));

    await expect(store.getState().loadFromBackend('proj-1', 'canvas-b')).resolves.not.toThrow();

    expect(store.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(store.getState().deviceCounter).toBe(0);
    expect(store.getState().connectionCounter).toBe(0);
  });

  it('loadFromBackend cancels a pending autosave armed on the previous canvas', async () => {
    const { store, updateCanvas, getCanvas } = await freshStore();
    updateCanvas.mockResolvedValue(makeCanvasResponse());
    getCanvas.mockResolvedValue(makeCanvasResponse({ id: 'canvas-b' }));

    store.getState().setCurrentCanvas('proj-1', 'canvas-a');
    store.getState().addDevice(makeDevice()); // arms the 2s timer for canvas-a

    await store.getState().loadFromBackend('proj-1', 'canvas-b');
    await vi.advanceTimersByTimeAsync(5000);

    // The stale timer must not fire at all — neither against canvas-a
    // (cross-canvas contamination) nor pointlessly against canvas-b.
    expect(updateCanvas).not.toHaveBeenCalled();
  });

  it('persists canvas identity so a page refresh can restore the session', async () => {
    const { store } = await freshStore();

    store.getState().setCurrentCanvas('proj-9', 'canvas-9');
    store.getState().addDevice(makeDevice());

    const raw = localStorage.getItem('pixelcake-network-v2');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw!);
    expect(persisted.state.currentProjectId).toBe('proj-9');
    expect(persisted.state.currentCanvasId).toBe('canvas-9');
  });

  it('tracks unsaved changes: dirty after a mutation, clean after a successful save', async () => {
    const { store, updateCanvas } = await freshStore();
    updateCanvas.mockResolvedValue(makeCanvasResponse());

    store.getState().setCurrentCanvas('proj-1', 'canvas-1');
    store.getState().addDevice(makeDevice());
    expect(store.getState().hasUnsavedChanges).toBe(true);

    await store.getState().saveToBackend();
    expect(store.getState().hasUnsavedChanges).toBe(false);
  });

  it('stays dirty when an edit lands while a save is in flight', async () => {
    const { store, updateCanvas } = await freshStore();
    let finishPut: () => void = () => {};
    updateCanvas.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishPut = () => resolve(makeCanvasResponse());
        })
    );

    store.getState().setCurrentCanvas('proj-1', 'canvas-1');
    store.getState().addDevice(makeDevice({ label: 'A' }));

    const saving = store.getState().saveToBackend({ silent: true });
    store.getState().addDevice(makeDevice({ label: 'B' }));
    finishPut();

    expect(await saving).toBe(true);
    // B was added after the payload was built, so it has not been saved…
    expect(updateCanvas.mock.calls[0][2].devices).toHaveLength(1);
    // …and the store must not claim it has
    expect(store.getState().hasUnsavedChanges).toBe(true);

    // The autosave armed by B then sends it and the store becomes clean
    updateCanvas.mockResolvedValue(makeCanvasResponse());
    await vi.advanceTimersByTimeAsync(2000);
    expect(updateCanvas).toHaveBeenCalledTimes(2);
    expect(updateCanvas.mock.calls[1][2].devices).toHaveLength(2);
    expect(store.getState().hasUnsavedChanges).toBe(false);
  });
});
