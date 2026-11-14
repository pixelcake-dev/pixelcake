/**
 * ExplorerPanel tests — the project and its canvases, edited in place.
 * Real stores; only the browser's file pickers and the toasts are faked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { NetworkDevice } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { answerConfirms, settled } from '@/test/confirm';
import ExplorerPanel from './ExplorerPanel';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

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

const project = () => useProjectStore.getState();
const network = () => useNetworkStore.getState();
const canvasNames = () => project().canvases.map(c => c.name);

/** The card of a canvas, found through its name */
function card(name: string): HTMLElement {
  const element = screen.getByText(name).closest('.explorer-canvas-card');
  if (!(element instanceof HTMLElement)) throw new Error(`no card for canvas "${name}"`);
  return element;
}

/**
 * "Sede Milano": Canvas 1 (active, 2 devices) and "DMZ" (1 device), saved.
 * Returns the id of the second canvas.
 */
function twoCanvases(): string {
  network().addDevice(makeDevice('PC-1'));
  network().addDevice(makeDevice('PC-2'));
  const second = project().addCanvas('DMZ');
  project().switchCanvas(second);
  network().addDevice(makeDevice('FW-1'));
  project().switchCanvas('canvas-1');
  network().markSaved();
  return second;
}

describe('ExplorerPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano', description: 'Uffici e magazzino' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('project', () => {
    it('always shows the project: name, description, canvases — no empty state', () => {
      render(<ExplorerPanel />);

      expect(screen.getByText('Sede Milano')).toBeInTheDocument();
      expect(screen.getByText('Uffici e magazzino')).toBeInTheDocument();
      expect(screen.getByText('Canvas 1')).toBeInTheDocument();
      expect(screen.queryByText('Nessun progetto aperto')).toBeNull();
    });

    it('renames the project in place: Enter confirms', () => {
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Rinomina progetto' }));
      const input = screen.getByLabelText<HTMLInputElement>('Nome del progetto');
      expect(input.value).toBe('Sede Milano');
      fireEvent.change(input, { target: { value: 'Sede Torino' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(project().name).toBe('Sede Torino');
      expect(screen.getByText('Sede Torino')).toBeInTheDocument();
      expect(screen.queryByLabelText('Nome del progetto')).toBeNull();
      expect(network().hasUnsavedChanges).toBe(true);
    });

    it('renaming the project: Escape cancels, an empty name is ignored', () => {
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Rinomina progetto' }));
      let input = screen.getByLabelText<HTMLInputElement>('Nome del progetto');
      fireEvent.change(input, { target: { value: 'Altro' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(project().name).toBe('Sede Milano');
      expect(screen.queryByLabelText('Nome del progetto')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Rinomina progetto' }));
      input = screen.getByLabelText<HTMLInputElement>('Nome del progetto');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(project().name).toBe('Sede Milano');
      expect(network().hasUnsavedChanges).toBe(false);
    });

    it('edits the description in place, and offers to add one when there is none', () => {
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByText('Uffici e magazzino'));
      const input = screen.getByLabelText<HTMLInputElement>('Descrizione del progetto');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(project().description).toBe('');
      fireEvent.click(screen.getByText('Aggiungi una descrizione…'));
      fireEvent.change(screen.getByLabelText('Descrizione del progetto'), {
        target: { value: 'Solo uffici' },
      });
      fireEvent.blur(screen.getByLabelText('Descrizione del progetto'));
      expect(project().description).toBe('Solo uffici');
    });
  });

  describe('canvases', () => {
    it('lists every canvas with its device count: live for the active one', () => {
      twoCanvases();
      render(<ExplorerPanel />);

      expect(within(card('Canvas 1')).getByText('2 dispositivi')).toBeInTheDocument();
      expect(within(card('DMZ')).getByText('1 dispositivo')).toBeInTheDocument();
      expect(card('Canvas 1')).toHaveClass('active');
      expect(card('DMZ')).not.toHaveClass('active');
    });

    it('the count of the active canvas follows the drawing', () => {
      twoCanvases();
      render(<ExplorerPanel />);

      act(() => network().addDevice(makeDevice('PC-3')));

      expect(within(card('Canvas 1')).getByText('3 dispositivi')).toBeInTheDocument();
      // the stored entry is stale until the next commit: the count must not come from it
      expect(project().canvases[0].devices).toHaveLength(2);
    });

    it('clicking a canvas switches to it', () => {
      const second = twoCanvases();
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByText('DMZ'));

      expect(project().activeCanvasId).toBe(second);
      expect(network().devices.map(d => d.label)).toEqual(['FW-1']);
      expect(card('DMZ')).toHaveClass('active');
      expect(card('Canvas 1')).not.toHaveClass('active');
      expect(within(card('Canvas 1')).getByText('2 dispositivi')).toBeInTheDocument();
      // looking at another canvas is not an edit
      expect(network().hasUnsavedChanges).toBe(false);
    });

    it('adds a canvas: Enter confirms, the canvas on screen stays', () => {
      twoCanvases();
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByText('Nuovo Canvas'));
      const input = screen.getByLabelText('Nome del nuovo canvas');
      fireEvent.change(input, { target: { value: 'Sala server' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(canvasNames()).toEqual(['Canvas 1', 'DMZ', 'Sala server']);
      expect(within(card('Sala server')).getByText('0 dispositivi')).toBeInTheDocument();
      expect(project().activeCanvasId).toBe('canvas-1');
      expect(screen.queryByLabelText('Nome del nuovo canvas')).toBeNull();
      expect(network().hasUnsavedChanges).toBe(true);
    });

    it('adding a canvas: Escape cancels, an empty name adds nothing', () => {
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByText('Nuovo Canvas'));
      fireEvent.keyDown(screen.getByLabelText('Nome del nuovo canvas'), { key: 'Enter' });
      expect(canvasNames()).toEqual(['Canvas 1']);

      fireEvent.change(screen.getByLabelText('Nome del nuovo canvas'), { target: { value: 'X' } });
      // the press is used up by the field (marked: `false`), so that it cancels
      // the new canvas and nothing else
      expect(
        fireEvent.keyDown(screen.getByLabelText('Nome del nuovo canvas'), { key: 'Escape' })
      ).toBe(false);
      expect(canvasNames()).toEqual(['Canvas 1']);
      expect(screen.queryByLabelText('Nome del nuovo canvas')).toBeNull();
      expect(screen.getByText('Nuovo Canvas')).toBeInTheDocument();
    });

    it('renames a canvas in place: Enter confirms, without switching to it', () => {
      twoCanvases();
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Rinomina canvas DMZ' }));
      const input = screen.getByLabelText<HTMLInputElement>('Nome del canvas DMZ');
      expect(input.value).toBe('DMZ');
      fireEvent.click(input); // clicking in the field is not clicking the card
      fireEvent.change(input, { target: { value: 'Perimetro' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(canvasNames()).toEqual(['Canvas 1', 'Perimetro']);
      expect(screen.getByText('Perimetro')).toBeInTheDocument();
      expect(screen.queryByLabelText('Nome del canvas DMZ')).toBeNull();
      expect(project().activeCanvasId).toBe('canvas-1');
      expect(network().hasUnsavedChanges).toBe(true);
    });

    it('renaming a canvas: Escape cancels and leaves the name alone', () => {
      twoCanvases();
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Rinomina canvas DMZ' }));
      const input = screen.getByLabelText('Nome del canvas DMZ');
      fireEvent.change(input, { target: { value: 'Perimetro' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(canvasNames()).toEqual(['Canvas 1', 'DMZ']);
      expect(screen.queryByLabelText('Nome del canvas DMZ')).toBeNull();
      expect(network().hasUnsavedChanges).toBe(false);
    });

    it('a double click on the name starts the rename too, and leaving the field confirms', () => {
      twoCanvases();
      render(<ExplorerPanel />);

      fireEvent.doubleClick(screen.getByText('Canvas 1'));
      const input = screen.getByLabelText('Nome del canvas Canvas 1');
      fireEvent.change(input, { target: { value: 'Piano terra' } });
      fireEvent.blur(input);

      expect(canvasNames()).toEqual(['Piano terra', 'DMZ']);
    });

    it('deletes a canvas only after confirmation', async () => {
      const second = twoCanvases();
      const confirms = answerConfirms(false);
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Elimina canvas DMZ' }));
      await settled();
      expect(confirms.asked).toHaveLength(1);
      expect(confirms.asked[0].title).toContain('«DMZ»');
      expect(confirms.asked[0].detail).toContain('1 dispositivo');
      expect(confirms.asked[0]).toMatchObject({ confirmLabel: 'Elimina', danger: true });
      expect(project().canvases.map(c => c.id)).toEqual(['canvas-1', second]);
      // clicking the bin is not clicking the card: the canvas on screen stays
      expect(project().activeCanvasId).toBe('canvas-1');

      confirms.say(true);
      fireEvent.click(screen.getByRole('button', { name: 'Elimina canvas DMZ' }));
      await settled();
      expect(canvasNames()).toEqual(['Canvas 1']);
      expect(screen.queryByText('DMZ')).toBeNull();
      expect(project().activeCanvasId).toBe('canvas-1');
      expect(network().devices.map(d => d.label)).toEqual(['PC-1', 'PC-2']);
    });

    it('deleting the canvas on screen shows another one', async () => {
      twoCanvases();
      answerConfirms(true);
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Elimina canvas Canvas 1' }));
      await settled();

      expect(canvasNames()).toEqual(['DMZ']);
      expect(network().devices.map(d => d.label)).toEqual(['FW-1']);
      expect(card('DMZ')).toHaveClass('active');
    });

    it('the last canvas cannot be deleted: there is no button for it', () => {
      render(<ExplorerPanel />);

      expect(screen.queryByRole('button', { name: /Elimina canvas/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Rinomina canvas Canvas 1' })).toBeInTheDocument();
    });
  });

  describe('file', () => {
    it('hints at changes not saved to a file, only while there are some', () => {
      render(<ExplorerPanel />);
      expect(screen.queryByText('Modifiche non salvate su file')).toBeNull();

      act(() => network().addDevice(makeDevice('PC-1')));
      expect(screen.getByText('Modifiche non salvate su file')).toBeInTheDocument();

      act(() => network().markSaved());
      expect(screen.queryByText('Modifiche non salvate su file')).toBeNull();
    });

    it('"Salva su file" saves the project and the hint goes away', async () => {
      network().addDevice(makeDevice('PC-1'));
      let written = '';
      const handle = {
        name: 'sede-milano.pixelcake.json',
        getFile: async () => new File([written], 'sede-milano.pixelcake.json'),
        createWritable: async () => ({
          write: async (data: string) => {
            written = data;
          },
          close: async () => {},
        }),
      };
      vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue(handle));
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByText('Salva su file'));

      await waitFor(() => expect(network().hasUnsavedChanges).toBe(false));
      expect(JSON.parse(written)).toMatchObject({
        format: 'pixelcake-project',
        name: 'Sede Milano',
      });
      await waitFor(() => expect(screen.queryByText('Modifiche non salvate su file')).toBeNull());
    });

    it('"Apri file…" opens the file picker', async () => {
      const picker = vi
        .fn()
        .mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));
      vi.stubGlobal('showOpenFilePicker', picker);
      render(<ExplorerPanel />);

      fireEvent.click(screen.getByText('Apri file…'));

      await waitFor(() => expect(picker).toHaveBeenCalledTimes(1));
      expect(project().name).toBe('Sede Milano');
    });
  });
});
