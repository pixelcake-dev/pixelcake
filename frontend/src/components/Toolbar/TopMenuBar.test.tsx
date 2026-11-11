/**
 * TopMenuBar tests — the menu entries that can lose a drawing, and the File
 * menu wired to the project file.
 *
 * - Help → "Mostra Welcome Screen" once emptied the canvas without asking: it
 *   must never touch the drawing, whatever is on the other canvases.
 * - File → "Nuovo progetto…" and "Apri…" replace the whole project: with
 *   changes not yet saved to a file they must ask first.
 *
 * These tests click the real menu entries against the real stores; only the
 * browser's file pickers and the toasts are faked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import type { NetworkDevice } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { parseProjectFile, serializeProject } from '@/utils/projectFile';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const toastInfoMock = toast.info as Mock;
const toastSuccessMock = toast.success as Mock;

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

const labels = () => useNetworkStore.getState().devices.map(d => d.label);

/** Put two devices on the canvas, as a user would */
function drawTwoDevices() {
  useNetworkStore.getState().addDevice(makeDevice('PC-1'));
  useNetworkStore.getState().addDevice(makeDevice('PC-2'));
}

/** A project with a drawing on its first canvas and another on a second one, saved */
function projectWithTwoCanvases(): string {
  drawTwoDevices();
  const second = useProjectStore.getState().addCanvas('DMZ');
  useProjectStore.getState().switchCanvas(second);
  useNetworkStore.getState().addDevice(makeDevice('FW-1'));
  useProjectStore.getState().switchCanvas('canvas-1');
  useNetworkStore.getState().markSaved();
  return second;
}

function click(label: string) {
  fireEvent.click(screen.getByText(label));
}

/** A file handle of the File System Access API that records what is written */
function fileHandle(name: string, content = '') {
  const file = { content, writes: 0 };
  const handle = {
    name,
    getFile: async () => new File([file.content], name, { type: 'application/json' }),
    createWritable: async () => {
      let buffer = '';
      return {
        write: async (data: string) => {
          buffer += data;
        },
        close: async () => {
          file.content = buffer;
          file.writes++;
        },
      };
    },
  };
  return { file, handle };
}

describe('TopMenuBar', () => {
  beforeEach(() => {
    localStorage.clear();
    // A new, empty, saved project with no file behind it
    createNewProject({ name: 'Sede HQ' });
    useUIStore.setState(state => ({
      showWelcomeScreen: false,
      modals: { ...state.modals, newProject: false },
    }));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('File menu', () => {
    it('offers the project entries, and none of the ones that were removed', () => {
      render(<TopMenuBar />);

      for (const entry of ['Nuovo progetto…', 'Apri…', 'Salva', 'Salva con nome…']) {
        expect(screen.getByText(entry)).not.toHaveClass('disabled');
      }
      expect(screen.getByText('Esporta come PNG')).toHaveClass('disabled');
      for (const removed of ['Nuovo', 'Nuovo Progetto', 'Apri...', 'Apri Progetto...']) {
        expect(screen.queryByText(removed)).toBeNull();
      }
      expect(screen.queryByText('Documentazione API')).toBeNull();
    });
  });

  describe('Help → Mostra Welcome Screen', () => {
    it('leaves the drawing untouched and explains why', () => {
      drawTwoDevices();
      render(<TopMenuBar />);

      click('Mostra Welcome Screen');

      expect(labels()).toEqual(['PC-1', 'PC-2']);
      expect(useUIStore.getState().showWelcomeScreen).toBe(false);
      expect(toastInfoMock).toHaveBeenCalledTimes(1);
      expect(toastInfoMock.mock.calls[0][0]).toContain('Il disegno non è stato toccato');
    });

    it('never empties or changes the project: every canvas keeps its drawing', () => {
      const second = projectWithTwoCanvases();
      const before = useProjectStore.getState().buildProjectFile().canvases;
      render(<TopMenuBar />);

      click('Mostra Welcome Screen');

      expect(labels()).toEqual(['PC-1', 'PC-2']);
      expect(useProjectStore.getState().buildProjectFile().canvases).toEqual(before);
      expect(useProjectStore.getState().canvases.map(c => c.id)).toEqual(['canvas-1', second]);
      // not even an edit: there is nothing new to save
      expect(useNetworkStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('shows the welcome screen again on an empty canvas, without touching the other canvases', () => {
      const second = projectWithTwoCanvases();
      const third = useProjectStore.getState().addCanvas('Vuoto');
      useProjectStore.getState().switchCanvas(third);
      localStorage.setItem('pixelcake-hide-welcome', 'true');
      render(<TopMenuBar />);

      click('Mostra Welcome Screen');

      expect(useUIStore.getState().showWelcomeScreen).toBe(true);
      expect(localStorage.getItem('pixelcake-hide-welcome')).toBeNull();
      expect(toastInfoMock).not.toHaveBeenCalled();
      const canvases = useProjectStore.getState().buildProjectFile().canvases;
      expect(canvases.map(c => [c.id, c.devices.map(d => d.label)])).toEqual([
        ['canvas-1', ['PC-1', 'PC-2']],
        [second, ['FW-1']],
        [third, []],
      ]);
    });
  });

  describe('File → Nuovo progetto…', () => {
    it('with changes not saved to a file: does nothing when the user declines', () => {
      drawTwoDevices();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<TopMenuBar />);

      click('Nuovo progetto…');

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      expect(confirmSpy.mock.calls[0][0]).toContain('modifiche non ancora salvate su file');
      expect(useUIStore.getState().modals.newProject).toBe(false);
      expect(labels()).toEqual(['PC-1', 'PC-2']);
      expect(useProjectStore.getState().name).toBe('Sede HQ');
      expect(useNetworkStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('with changes not saved to a file: opens the form after confirmation, drawing still there', () => {
      drawTwoDevices();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<TopMenuBar />);

      click('Nuovo progetto…');

      expect(useUIStore.getState().modals.newProject).toBe(true);
      // nothing is replaced until the form itself is confirmed
      expect(labels()).toEqual(['PC-1', 'PC-2']);
      expect(useProjectStore.getState().name).toBe('Sede HQ');
    });

    it('with everything saved: opens the form without asking', () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      render(<TopMenuBar />);

      click('Nuovo progetto…');

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(useUIStore.getState().modals.newProject).toBe(true);
    });
  });

  describe('File → Salva / Salva con nome…', () => {
    it('"Salva" writes the project to the file chosen, then to the same file without asking', async () => {
      drawTwoDevices();
      const { file, handle } = fileHandle('sede-hq.pixelcake.json');
      const picker = vi.fn().mockResolvedValue(handle);
      vi.stubGlobal('showSaveFilePicker', picker);
      render(<TopMenuBar />);

      click('Salva');
      await waitFor(() => expect(file.writes).toBe(1));

      const saved = parseProjectFile(file.content);
      expect(saved).toMatchObject({ ok: true, project: { name: 'Sede HQ' } });
      await waitFor(() => expect(useNetworkStore.getState().hasUnsavedChanges).toBe(false));
      expect(toastSuccessMock).toHaveBeenCalledWith('Progetto salvato su file', expect.anything());

      useNetworkStore.getState().addDevice(makeDevice('PC-3'));
      click('Salva');
      await waitFor(() => expect(file.writes).toBe(2));
      expect(picker).toHaveBeenCalledTimes(1);
    });

    it('"Salva con nome…" asks where every time', async () => {
      drawTwoDevices();
      const first = fileHandle('sede-hq.pixelcake.json');
      const second = fileHandle('copia.pixelcake.json');
      const picker = vi
        .fn()
        .mockResolvedValueOnce(first.handle)
        .mockResolvedValueOnce(second.handle);
      vi.stubGlobal('showSaveFilePicker', picker);
      render(<TopMenuBar />);

      click('Salva con nome…');
      await waitFor(() => expect(first.file.writes).toBe(1));
      click('Salva con nome…');
      await waitFor(() => expect(second.file.writes).toBe(1));

      expect(picker).toHaveBeenCalledTimes(2);
      expect(first.file.writes).toBe(1);
    });
  });

  describe('File → Apri…', () => {
    /** A project file on disk: one canvas with a single device "R-1" */
    function otherProjectFile() {
      return fileHandle(
        'sede-roma.pixelcake.json',
        serializeProject({
          format: 'pixelcake-project',
          version: 1,
          name: 'Sede Roma',
          description: '',
          savedAt: '2026-11-10T08:00:00.000Z',
          settings: { ipClass: '10.0.0.0', subnet: '255.0.0.0', gateway: '10.0.0.1' },
          activeCanvasId: 'canvas-1',
          canvases: [
            {
              id: 'canvas-1',
              name: 'Roma',
              devices: [{ ...makeDevice('R-1'), id: 'dev-0' }],
              connections: [],
              viewport: { x: 0, y: 0, zoom: 1 },
              deviceCounter: 1,
              connectionCounter: 0,
            },
          ],
          templates: { devices: [], connections: [] },
        })
      );
    }

    it('with changes not saved to a file: keeps the project when the user declines', async () => {
      drawTwoDevices();
      const picker = vi.fn().mockResolvedValue([otherProjectFile().handle]);
      vi.stubGlobal('showOpenFilePicker', picker);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<TopMenuBar />);

      click('Apri…');
      await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));

      expect(labels()).toEqual(['PC-1', 'PC-2']);
      expect(useProjectStore.getState().name).toBe('Sede HQ');
      expect(useNetworkStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('replaces the whole project once confirmed', async () => {
      projectWithTwoCanvases();
      useNetworkStore.getState().addDevice(makeDevice('PC-3'));
      vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([otherProjectFile().handle]));
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<TopMenuBar />);

      click('Apri…');
      await waitFor(() => expect(useProjectStore.getState().name).toBe('Sede Roma'));

      expect(labels()).toEqual(['R-1']);
      expect(useProjectStore.getState().canvases.map(c => c.name)).toEqual(['Roma']);
      expect(useNetworkStore.getState().hasUnsavedChanges).toBe(false);
    });

    it('with everything saved: opens without asking', async () => {
      vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([otherProjectFile().handle]));
      const confirmSpy = vi.spyOn(window, 'confirm');
      render(<TopMenuBar />);

      click('Apri…');
      await waitFor(() => expect(useProjectStore.getState().name).toBe('Sede Roma'));

      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });
});
