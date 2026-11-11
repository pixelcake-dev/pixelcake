/**
 * Session Restore
 * After a page refresh the topology rehydrates from localStorage, but the
 * ProjectStore (explorer, welcome screen) is runtime-only. This module
 * restores the session on startup and reconciles local vs server state via
 * the persisted dirty flag: local wins if there are unsaved changes, server
 * wins otherwise.
 */

import { toast } from 'sonner';
import { getCanvas, updateCanvas } from '@/api';
import { HTTPError } from '@/api/client';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';

// Module-level guards: React StrictMode double-invokes mount effects
let restoreAttempted = false;
let unloadFlushRegistered = false;

/** Wait for the zustand persist middleware to finish rehydrating */
async function waitForHydration(): Promise<void> {
  if (useNetworkStore.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsubscribe = useNetworkStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

/**
 * Restore the previously open project/canvas after a page refresh.
 * No-op when no session was persisted or when it already ran.
 */
export async function restoreSession(): Promise<void> {
  if (restoreAttempted) return;
  restoreAttempted = true;

  await waitForHydration();

  const { currentProjectId, currentCanvasId, hasUnsavedChanges } = useNetworkStore.getState();
  if (!currentProjectId || !currentCanvasId) return;

  // Validate that the persisted canvas still exists before touching anything
  try {
    await getCanvas(currentProjectId, currentCanvasId);
  } catch (error) {
    if (error instanceof HTTPError && error.status === 404) {
      // Definitively gone: unbind, but KEEP the local topology on the canvas
      // so nothing is silently destroyed (the user can still Save As)
      useNetworkStore.getState().clearCurrentCanvas();
      toast.info('Il progetto aperto non esiste più sul server', {
        description: 'Le modifiche locali restano sul canvas',
      });
    }
    // Network error / 5xx: backend offline — keep IDs and local state; the
    // health check already announces local mode
    return;
  }

  try {
    // Repopulate the project store (explorer panel, welcome-screen suppression)
    await useProjectStore.getState().loadProject(currentProjectId);

    if (hasUnsavedChanges) {
      // Edits from before the refresh never reached the backend: push them
      await useNetworkStore.getState().saveToBackend({ silent: true });
    } else {
      // Clean session: the server is the source of truth, pull it
      await useNetworkStore.getState().loadFromBackend(currentProjectId, currentCanvasId);
    }
  } catch (error) {
    console.error('[RestoreSession] Failed to restore session:', error);
  }
}

/**
 * Best-effort flush of unsaved changes when the tab closes: fires a keepalive
 * PUT that can outlive the page. Browsers cap keepalive bodies (~64KB), so
 * very large topologies may be dropped — the dirty-flag restore above remains
 * the real guarantee.
 */
export function registerUnloadFlush(): void {
  if (unloadFlushRegistered) return;
  unloadFlushRegistered = true;

  window.addEventListener('pagehide', () => {
    const state = useNetworkStore.getState();
    if (!state.currentProjectId || !state.currentCanvasId || !state.hasUnsavedChanges) {
      return;
    }
    state.cancelPendingSave();
    void updateCanvas(
      state.currentProjectId,
      state.currentCanvasId,
      {
        devices: state.devices,
        connections: state.connections,
        settings: {
          viewport: state.viewport,
          deviceCounter: state.deviceCounter,
          connectionCounter: state.connectionCounter,
        },
      },
      { keepalive: true }
    ).catch(() => {
      // The page is going away; nothing useful can be done with a failure
    });
  });
}
