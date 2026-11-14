/**
 * Esc in the whole app — every window closes with it, as with its X, one
 * window for each press. The terminal is not one of those windows and keeps
 * its own keys: Esc does nothing there.
 *
 * (The export image window needs a browser that paints: its Esc, also while
 * presenting, is in ExportImageModal.test.tsx.)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createSampleTopology } from '@/utils/sampleTopology';
import App from './App';

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

type WindowName = keyof ReturnType<typeof useUIStore.getState>['modals'];

const ui = () => useUIStore.getState();
const network = () => useNetworkStore.getState();

/** How many windows are on screen */
const windows = () => document.querySelectorAll('.base-modal').length;

/** One press of Esc, with the keyboard nowhere in particular */
const esc = () => fireEvent.keyDown(document.body, { key: 'Escape' });

/** What jsdom lacks and the canvas needs to mount */
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

/** Every window built on the shared one, and how the app opens it */
const WINDOWS: Array<[WindowName, () => void]> = [
  [
    'addDevice',
    () => {
      ui().setAddDeviceType('PC', 'tpl-pc');
      ui().openModal('addDevice');
    },
  ],
  ['bulkAddDevice', () => ui().openModal('bulkAddDevice')],
  [
    'inspector',
    () => {
      ui().setInspectorDevice(network().devices[0]);
      ui().openModal('inspector');
    },
  ],
  [
    'connectionInspector',
    () => {
      ui().setInspectorConnection(network().connections[0]);
      ui().openModal('connectionInspector');
    },
  ],
  ['help', () => ui().openHelp('about')],
  ['settings', () => ui().openModal('settings')],
  ['newProject', () => ui().openModal('newProject')],
  ['importExport', () => ui().openModal('importExport')],
];

/** The tab of a window, or of a part of it, by its text */
function tab(label: string): HTMLElement {
  const found = Array.from(document.querySelectorAll<HTMLElement>('.settings-tab')).find(
    button => button.textContent?.trim() === label
  );
  if (!found) throw new Error(`no tab "${label}"`);
  return found;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pixelcake-hide-welcome', 'true');
  stubBrowser();
  usePresentationStore.getState().exit();
  createNewProject({ name: 'Sede Milano' });
  const sample = createSampleTopology();
  network().loadTopology(sample.devices, sample.connections);
  for (const name of Object.keys(ui().modals) as WindowName[]) ui().closeModal(name);
  ui().setHelpTab('guide');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App — Esc closes the window on top', () => {
  it('the list below has every window of the app', () => {
    // a window added to the app belongs in WINDOWS (or, with its reason, here)
    expect(Object.keys(ui().modals).sort()).toEqual(
      [...WINDOWS.map(([name]) => name), 'codeTerminal', 'exportImage'].sort()
    );
  });

  it.each(WINDOWS)('%s closes with Esc', (name, open) => {
    render(<App />);
    expect(windows()).toBe(0);

    act(open);
    expect(windows()).toBe(1);

    esc();

    expect(ui().modals[name]).toBe(false);
    expect(windows()).toBe(0);
  });

  it('does what the X does: the guide goes back to its first tab', () => {
    render(<App />);
    act(() => ui().openHelp('about'));
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Informazioni');

    esc();

    expect(ui().modals.help).toBe(false);
    expect(ui().helpTab).toBe('guide');
  });

  it('does what the X does: Import / Export starts again from Export', () => {
    render(<App />);
    act(() => ui().openModal('importExport'));
    fireEvent.click(tab('Import'));
    expect(screen.queryByLabelText('Formato:')).toBeNull();

    esc();
    act(() => ui().openModal('importExport'));

    expect(screen.getByLabelText('Formato:')).toBeInTheDocument();
  });

  it('a window opened from another: the list of icons, then that window, then the one under it', () => {
    render(<App />);
    act(() => ui().openModal('settings'));
    fireEvent.click(tab('Template'));
    fireEvent.click(tab('Dispositivi'));
    fireEvent.click(screen.getByRole('button', { name: /Nuovo template/ }));
    expect(windows()).toBe(2);
    expect(screen.getByRole('heading', { name: 'Nuovo template generico' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Seleziona un\'icona' }));
    expect(screen.getByPlaceholderText('Cerca icone…')).toBeInTheDocument();

    esc();
    expect(screen.queryByPlaceholderText('Cerca icone…')).toBeNull();
    expect(windows()).toBe(2);

    esc();
    expect(windows()).toBe(1);
    expect(screen.queryByRole('heading', { name: 'Nuovo template generico' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Impostazioni' })).toBeInTheDocument();
    expect(ui().modals.settings).toBe(true);

    esc();
    expect(windows()).toBe(0);
    expect(ui().modals.settings).toBe(false);
  });

  it('with no window open the key closes nothing, and nothing is deleted or deselected', () => {
    render(<App />);
    const before = JSON.stringify([network().devices, network().connections]);

    esc();

    expect(JSON.stringify([network().devices, network().connections])).toBe(before);
    expect(ui().modals).toEqual(
      Object.fromEntries(Object.keys(ui().modals).map(name => [name, false]))
    );
  });
});

describe('App — Esc and the terminal', () => {
  it('Esc does nothing in the terminal: it stays open, with what was typed', () => {
    render(<App />);
    act(() => ui().openModal('codeTerminal'));
    const input = screen.getByLabelText<HTMLInputElement>('Riga di comando del terminale');
    fireEvent.change(input, { target: { value: 'show devices' } });

    fireEvent.keyDown(input, { key: 'Escape' });
    esc();

    expect(ui().modals.codeTerminal).toBe(true);
    expect(screen.getByTestId('terminal-window')).toBeInTheDocument();
    expect(input.value).toBe('show devices');
  });

  it('a window open over the terminal closes, the terminal stays', () => {
    render(<App />);
    act(() => ui().openModal('codeTerminal'));
    act(() => ui().openModal('settings'));
    expect(windows()).toBe(1);

    fireEvent.keyDown(screen.getByLabelText('Riga di comando del terminale'), { key: 'Escape' });

    expect(windows()).toBe(0);
    expect(ui().modals.settings).toBe(false);
    expect(ui().modals.codeTerminal).toBe(true);
  });
});
