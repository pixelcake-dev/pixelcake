/**
 * TopMenuBar tests — the two menu entries that used to destroy a drawing.
 *
 * - Help → "Mostra Welcome Screen" emptied the canvas without asking and,
 *   with a project open, autosaved the empty board over the saved one.
 * - File → "Nuovo" with a project open emptied the saved board as well.
 *
 * These tests click the real menu entries against the real stores, with only
 * the HTTP layer mocked, and check what reaches the backend.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { toast } from 'sonner';
import { updateCanvas } from '@/api';
import type { NetworkDevice } from '@/types';
import type { ProjectResponse } from '@/types/api';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import TopMenuBar from './TopMenuBar';

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
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

const updateCanvasMock = updateCanvas as Mock;
const toastInfoMock = toast.info as Mock;

function makeDevice(label: string): Omit<NetworkDevice, 'id'> {
  return {
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  };
}

const project: ProjectResponse = {
  id: 'proj-1',
  user_id: 'user-1',
  name: 'Sede HQ',
  description: null,
  version: '1.0.0',
  is_public: false,
  global_settings: { ipClass: '192.168.1.0', subnet: '255.255.255.0', gateway: '192.168.1.1' },
  canvases: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_accessed: '2026-01-01T00:00:00Z',
};

/** Put two devices on the canvas, as a user would */
function drawTwoDevices() {
  useNetworkStore.getState().addDevice(makeDevice('PC-1'));
  useNetworkStore.getState().addDevice(makeDevice('PC-2'));
}

/** Open a saved project whose board is the canvas on screen, with nothing pending */
function openProjectWithDrawing() {
  useProjectStore.setState({ currentProject: project });
  useNetworkStore.getState().setCurrentCanvas('proj-1', 'canvas-1');
  drawTwoDevices();
  useNetworkStore.getState().cancelPendingSave();
  useNetworkStore.setState({ hasUnsavedChanges: false });
}

async function click(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
    // Let async handlers and any armed autosave run to completion
    await vi.advanceTimersByTimeAsync(5000);
  });
}

describe('TopMenuBar: menu entries must not destroy a drawing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    updateCanvasMock.mockReset();
    updateCanvasMock.mockResolvedValue({});
    toastInfoMock.mockReset();
    useNetworkStore.getState().cancelPendingSave();
    useNetworkStore.setState({
      devices: [],
      connections: [],
      deviceCounter: 0,
      connectionCounter: 0,
      currentProjectId: null,
      currentCanvasId: null,
      hasUnsavedChanges: false,
    });
    useProjectStore.getState().reset();
    useUIStore.setState({ showWelcomeScreen: false });
  });

  afterEach(() => {
    useNetworkStore.getState().cancelPendingSave();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Help → Mostra Welcome Screen', () => {
    it('leaves a local drawing untouched and explains why', async () => {
      drawTwoDevices();
      render(<TopMenuBar />);

      await click('Mostra Welcome Screen');

      expect(useNetworkStore.getState().devices).toHaveLength(2);
      expect(useUIStore.getState().showWelcomeScreen).toBe(false);
      expect(toastInfoMock).toHaveBeenCalledTimes(1);
    });

    it('never saves an empty board over an open project', async () => {
      openProjectWithDrawing();
      render(<TopMenuBar />);

      await click('Mostra Welcome Screen');

      expect(useNetworkStore.getState().devices).toHaveLength(2);
      expect(updateCanvasMock).not.toHaveBeenCalled();
      expect(useProjectStore.getState().currentProject).not.toBeNull();
    });

    it('shows the welcome screen again on an empty canvas with no project', async () => {
      localStorage.setItem('pixelcake-hide-welcome', 'true');
      render(<TopMenuBar />);

      await click('Mostra Welcome Screen');

      expect(useUIStore.getState().showWelcomeScreen).toBe(true);
      expect(localStorage.getItem('pixelcake-hide-welcome')).toBeNull();
      expect(toastInfoMock).not.toHaveBeenCalled();
    });
  });

  describe('File → Nuovo', () => {
    it('with a project open: closes it and starts blank, leaving the saved board intact', async () => {
      openProjectWithDrawing();
      // A pending edit must be saved before the project is left
      useNetworkStore.getState().addDevice(makeDevice('PC-3'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<TopMenuBar />);

      await click('Nuovo');

      // The only save carried the full drawing, never an empty one
      expect(updateCanvasMock).toHaveBeenCalledTimes(1);
      expect(updateCanvasMock.mock.calls[0][2].devices).toHaveLength(3);
      // The app is now on an empty local drawing, detached from the project
      expect(useNetworkStore.getState().devices).toHaveLength(0);
      expect(useNetworkStore.getState().currentCanvasId).toBeNull();
      expect(useProjectStore.getState().currentProject).toBeNull();
    });

    it('with a project open: does nothing when the user declines', async () => {
      openProjectWithDrawing();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<TopMenuBar />);

      await click('Nuovo');

      expect(useNetworkStore.getState().devices).toHaveLength(2);
      expect(useNetworkStore.getState().currentCanvasId).toBe('canvas-1');
      expect(updateCanvasMock).not.toHaveBeenCalled();
    });

    it('with a project open: keeps everything when the save before leaving fails', async () => {
      openProjectWithDrawing();
      useNetworkStore.getState().addDevice(makeDevice('PC-3'));
      updateCanvasMock.mockRejectedValue(new Error('backend down'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<TopMenuBar />);

      await click('Nuovo');

      expect(useNetworkStore.getState().devices).toHaveLength(3);
      expect(useNetworkStore.getState().currentCanvasId).toBe('canvas-1');
      expect(useProjectStore.getState().currentProject).not.toBeNull();
    });

    it('with a local drawing: empties it only after confirmation', async () => {
      drawTwoDevices();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<TopMenuBar />);

      await click('Nuovo');
      expect(useNetworkStore.getState().devices).toHaveLength(2);

      confirmSpy.mockReturnValue(true);
      await click('Nuovo');
      expect(useNetworkStore.getState().devices).toHaveLength(0);
      expect(updateCanvasMock).not.toHaveBeenCalled();
    });
  });
});
