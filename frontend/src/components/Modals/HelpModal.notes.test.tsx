/**
 * The guide and the window of a device tell the same story: every name the
 * step «Configurali» puts in «quotes» is on a control of the app, and the
 * note it speaks of is where it says and is read the way it says.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';
import { NOTE_REST_MS } from '@/components/Canvas/DeviceNote';
import ContextMenu from '@/components/ui/ContextMenu';
import HelpModal from './HelpModal';
import InspectorModal from './InspectorModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const TITLE = 'Configurali';
const ui = () => useUIStore.getState();
const device = (label: string) => {
  const found = useNetworkStore.getState().devices.find((d) => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

/** The text of one step of the guide, by its title */
function step(title: string): string {
  ui().openHelp('guide');
  render(<HelpModal />);
  const text = screen.getByText(title).closest('li')?.textContent ?? '';
  cleanup();
  ui().closeModal('help');
  return text;
}

/** What a step puts in «quotes»: the names of controls */
const quoted = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((match) => match[1]);

function openInspector(label: string) {
  cleanup();
  ui().setInspectorDevice(device(label));
  ui().openModal('inspector');
  render(<InspectorModal />);
}

const tabNames = () =>
  Array.from(document.querySelectorAll('.tab-header')).map((tab) => (tab.textContent ?? '').replace(/ \(\d+\)$/, ''));

beforeEach(() => {
  localStorage.clear();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createSampleTopology();
  store.loadTopology(sample.devices, sample.connections);
  ui().closeModal('inspector');
  ui().closeContextMenu();
});

describe('the guide — the window of a device and its note', () => {
  it('names what is on the screen', () => {
    expect(quoted(step(TITLE))).toEqual([
      'Dettagli (Modifica)',
      'Generale',
      'Porte',
      'Numero di porte',
      'Schede di rete',
      'Generale',
      'Note',
      'Salva',
    ]);
  });

  it('the menu of a device has the entry it names, and it opens the window on «Generale»', () => {
    ui().setContextMenuDevice(device('PC-1'), 40, 60);
    render(
      <>
        <ContextMenu />
        <InspectorModal />
      </>
    );
    fireEvent.click(screen.getByText('Dettagli (Modifica)'));
    expect(document.querySelector('.tab-header.active')).toHaveTextContent('Generale');
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();
  });

  it('a switch has the tab and the field it names, the other devices their cards', () => {
    openInspector('SW-Office');
    expect(tabNames()).toEqual(expect.arrayContaining(['Generale', 'Porte']));
    fireEvent.click(screen.getByRole('button', { name: /^Porte/ }));
    expect(screen.getByLabelText('Numero di porte')).toBeInTheDocument();

    openInspector('PC-1');
    expect(tabNames()).toEqual(['Generale', 'Schede di rete']);
  });

  it.each([['PC-1'], ['Web-01'], ['SW-Office'], ['Router-1']])(
    'on «Generale» %s has the «Note» it names: free text, of several lines',
    (label) => {
      expect(step(TITLE)).toContain(
        'Su «Generale» ogni dispositivo ha anche le «Note»: un testo libero, di più righe, per ciò che non sta in un campo.'
      );
      openInspector(label);
      expect(document.querySelector('.tab-header.active')).toHaveTextContent('Generale');
      // (what the open tab shows is in `.tab-content`)
      const shown = document.querySelector<HTMLElement>('.tab-content');
      if (!shown) throw new Error('no tab is shown');
      expect(within(shown).getByLabelText('Note').tagName).toBe('TEXTAREA');
    }
  );

  it('on the drawing the note is read by resting the pointer on the device, as it says', () => {
    expect(step(TITLE)).toContain('Sul disegno le leggi fermando il puntatore sul dispositivo.');
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
    useNetworkStore.getState().updateDevice(device('PC-1').id, { notes: 'Postazione di Marta' });
    render(
      <ReactFlowProvider>
        <NetworkCanvas />
      </ReactFlowProvider>
    );
    // (the app shows it in a panel of its own, after a short rest of the pointer)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const drawn = screen.getByText('PC-1', { selector: '.device-name' }).closest('.network-device')!;
    fireEvent.mouseEnter(drawn);
    act(() => {
      vi.advanceTimersByTime(NOTE_REST_MS);
    });
    vi.useRealTimers();
    expect(document.querySelector('.device-note')?.textContent).toBe('Postazione di Marta');
  });
});
