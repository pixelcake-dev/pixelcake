/**
 * The note of a device: written in its window, on the first screen, for
 * every kind of device; read on the drawing by resting the pointer on the
 * device, which carries no mark for it. Runs against the real stores with
 * the small sample network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import type { NetworkDevice } from '@/types';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';
import InspectorModal from './InspectorModal';
import ImportExportModal from './ImportExportModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const store = () => useNetworkStore.getState();

function device(label: string): NetworkDevice {
  const found = store().devices.find((d) => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

function openInspector(label: string) {
  cleanup();
  useUIStore.getState().setInspectorDevice(device(label));
  useUIStore.getState().openModal('inspector');
  render(<InspectorModal />);
}

const note = () => screen.getByLabelText<HTMLTextAreaElement>('Note');
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(toast.error).mockClear();
  usePresentationStore.getState().exit();
  store().clearAllDevices();
  const sample = createSampleTopology();
  store().loadTopology(sample.devices, sample.connections);
  useUIStore.getState().closeModal('inspector');
  useUIStore.getState().closeModal('importExport');
});

describe('the note of a device — in its window', () => {
  it.each([['PC-1'], ['Web-01'], ['SW-Office'], ['Router-1']])(
    '%s has it: the last field of «Identità», as wide as the row, of more than one line',
    (label) => {
      openInspector(label);
      const identity = screen.getByRole('group', { name: 'Identità' });
      const field = within(identity).getByLabelText('Note');
      expect(field.tagName).toBe('TEXTAREA');
      expect(field).toHaveValue('');
      // the last of the group, on a row of its own
      const fields = Array.from(identity.querySelectorAll('input, textarea, select, output'));
      expect(fields[fields.length - 1]).toBe(field);
      expect(field.parentElement?.className).toContain('col-span-4');
      expect(field.parentElement?.parentElement?.className).toContain('grid-cols-4');
      expect(identity).toHaveTextContent('Si leggono anche sul disegno, fermando il puntatore sul dispositivo.');
    }
  );

  it('is saved with the device, lines included, without what is around it', () => {
    openInspector('PC-1');
    fireEvent.change(note(), { target: { value: '  Postazione di Marta.\nDa sostituire a gennaio. \n\n' } });
    // nothing reaches the drawing before the device is saved
    expect(device('PC-1').notes).toBeUndefined();
    save();

    expect(toast.error).not.toHaveBeenCalled();
    expect(device('PC-1').notes).toBe('Postazione di Marta.\nDa sostituire a gennaio.');
    expect(store().hasUnsavedChanges).toBe(true);
    // and is there when the window is opened again
    openInspector('PC-1');
    expect(note()).toHaveValue('Postazione di Marta.\nDa sostituire a gennaio.');
  });

  it('emptied, the device has no note any more', () => {
    store().updateDevice(device('SW-Office').id, { notes: 'armadio B' });
    openInspector('SW-Office');
    expect(note()).toHaveValue('armadio B');

    fireEvent.change(note(), { target: { value: '   \n ' } });
    save();

    expect(device('SW-Office').notes).toBeUndefined();
    expect(JSON.stringify(device('SW-Office'))).not.toContain('notes');
  });

  it('«Annulla» leaves the note as it was', () => {
    store().updateDevice(device('Router-1').id, { notes: 'contratto fino al 2027' });
    openInspector('Router-1');
    fireEvent.change(note(), { target: { value: 'altro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(device('Router-1').notes).toBe('contratto fino al 2027');
  });

  it('saving a device without touching the note keeps it, whatever else is changed', () => {
    store().updateDevice(device('Web-01').id, { notes: 'backup ogni notte' });
    openInspector('Web-01');
    fireEvent.change(screen.getByLabelText('Nome Dispositivo'), { target: { value: 'Web-02' } });
    save();
    expect(device('Web-02').notes).toBe('backup ogni notte');
  });

  it('cannot be typed without end', () => {
    openInspector('PC-1');
    expect(note().maxLength).toBe(2000);
  });
});

describe('the note of a device — on the drawing', () => {
  function stubBrowser() {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  }
  const onCanvas = (label: string) =>
    screen.getByText(label, { selector: '.device-name' }).closest<HTMLElement>('.network-device');

  it('is what shows when the pointer rests on the device, and nothing is added to the device', () => {
    stubBrowser();
    store().updateDevice(device('PC-1').id, { notes: 'Postazione di Marta.\nDa sostituire a gennaio.' });
    render(
      <ReactFlowProvider>
        <NetworkCanvas />
      </ReactFlowProvider>
    );

    expect(onCanvas('PC-1')).toHaveAttribute('title', 'Postazione di Marta.\nDa sostituire a gennaio.');
    expect(onCanvas('PC-2')).not.toHaveAttribute('title');
    // a device with a note is drawn like one without: icon, name, address
    const parts = (label: string) =>
      Array.from(onCanvas(label)?.querySelector('.device-content')?.children ?? []).map((child) =>
        child.getAttribute('class')?.split(' ')[0]
      );
    expect(parts('PC-1')).toEqual(parts('PC-2'));
    expect(onCanvas('PC-1')?.textContent).not.toContain('Marta');
  });

  it('follows the note as it is written, changed and taken away', () => {
    stubBrowser();
    render(
      <>
        <ReactFlowProvider>
          <NetworkCanvas />
        </ReactFlowProvider>
        <InspectorModal />
      </>
    );
    expect(onCanvas('Router-1')).not.toHaveAttribute('title');

    openInspectorOverCanvas('Router-1');
    fireEvent.change(note(), { target: { value: 'contratto fino al 2027' } });
    save();
    expect(onCanvas('Router-1')).toHaveAttribute('title', 'contratto fino al 2027');

    openInspectorOverCanvas('Router-1');
    fireEvent.change(note(), { target: { value: '' } });
    save();
    expect(onCanvas('Router-1')).not.toHaveAttribute('title');
  });

  /** The window of a device, opened next to the canvas that is on screen */
  function openInspectorOverCanvas(label: string) {
    act(() => {
      useUIStore.getState().setInspectorDevice(device(label));
      useUIStore.getState().openModal('inspector');
    });
  }
});

describe('the note of a device — a YAML file added to the drawing', () => {
  const YAML_FILE = [
    'pixelcake:',
    '  devices:',
    '    - name: Stampante',
    '      type: PC',
    '      ip: 192.168.50.20',
    '      notes: "Primo piano.\\n- toner da cambiare"',
    '    - name: NAS',
    '      type: Database',
    '      ip: 192.168.50.30',
    '  connections: []',
  ].join('\n');

  async function importFile(mode: 'replace' | 'append') {
    useUIStore.getState().openModal('importExport');
    render(<ImportExportModal />);
    fireEvent.click(screen.getByRole('button', { name: /Import$/ }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input');
    fireEvent.change(input, { target: { files: [new File([YAML_FILE], 'rete.yaml', { type: 'text/yaml' })] } });
    await screen.findByText('Dispositivi trovati');
    if (mode === 'append') fireEvent.click(screen.getByLabelText('Aggiungi alla topologia'));
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }));
  }

  it.each([['replace'], ['append']] as const)('keeps the notes of its devices (%s)', async (mode) => {
    const before = store().devices.length;
    await importFile(mode);

    expect(store().devices).toHaveLength(mode === 'append' ? before + 2 : 2);
    expect(device('Stampante').notes).toBe('Primo piano.\n- toner da cambiare');
    expect(device('NAS').notes).toBeUndefined();
  });
});
