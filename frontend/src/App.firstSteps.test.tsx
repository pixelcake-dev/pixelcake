/**
 * The first steps of a visitor, through the whole app: on a first visit the
 * guided tour starts once the welcome screen is left, never over a window;
 * the company sample, once loaded, suggests a first question, after the tour
 * and never on top of it, and asks it in the terminal in one click. Each is
 * seen once in a browser: a reload shows neither again. Aiuto → «Tour
 * guidato» takes the tour again whenever asked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { guideAtStart, useGuideStore } from '@/store/guideStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { FIRST_TRY_SEEN_KEY, TOUR_SEEN_KEY } from '@/utils/firstSteps';
import { setLanguage } from '@/i18n';
import App from './App';

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

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

/** A browser opened on the app: what it keeps is read as at start-up */
function startVisit() {
  act(() => useGuideStore.setState(guideAtStart()));
  useUIStore.setState(state => ({
    showWelcomeScreen: localStorage.getItem('pixelcake-hide-welcome') !== 'true',
    welcomeRequested: false,
    activeSidebarPanel: null,
    modals: Object.fromEntries(
      Object.keys(state.modals).map(name => [name, false])
    ) as typeof state.modals,
  }));
}

const tour = () => screen.queryByRole('dialog', { name: 'Aggiungi un dispositivo' });
const hint = () => screen.queryByRole('region', { name: 'Una prima domanda' });

beforeEach(() => {
  localStorage.clear();
  stubBrowser();
  createNewProject({ name: 'Prima visita' });
  useNetworkStore.getState().markSaved();
  usePresentationStore.getState().exit();
  useSimulationStore.getState().resetSimulation();
  startVisit();
});

afterEach(() => {
  act(() => {
    useGuideStore.getState().closeTour();
    usePresentationStore.getState().exit();
    useSimulationStore.getState().resetSimulation();
  });
  vi.unstubAllGlobals();
});

describe('the first steps of a visitor', () => {
  it('a first visit: the tour once the welcome screen is left, then the first question of the sample, then neither again', () => {
    const { unmount } = render(<App />);
    // the welcome screen comes first, alone
    expect(screen.getByText('Carica la rete di esempio')).toBeInTheDocument();
    expect(tour()).toBeNull();

    fireEvent.click(screen.getByText('Carica la rete di esempio'));

    // the tour, and the question of the sample waits behind it
    expect(tour()).not.toBeNull();
    expect(hint()).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    const shown = hint();
    expect(shown).not.toBeNull();
    expect(shown).toHaveTextContent('PC-Vendite raggiunge Web-Gestionale?');
    expect(shown).toHaveTextContent('ping Web-Gestionale from PC-Vendite');
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('true');
    expect(localStorage.getItem(FIRST_TRY_SEEN_KEY)).toBe('true');

    // one click: the terminal opens and asks it, the packet sets off on the board
    fireEvent.click(screen.getByRole('button', { name: 'Prova nel terminale' }));

    expect(hint()).toBeNull();
    const output = screen.getByLabelText('Output del terminale');
    expect(output).toHaveTextContent('pixelcake> ping Web-Gestionale from PC-Vendite');
    expect(output).toHaveTextContent('Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...');
    expect(useSimulationStore.getState().isRunning).toBe(true);

    // a reload, the board emptied, the sample loaded again: neither comes back
    unmount();
    act(() => {
      useSimulationStore.getState().resetSimulation();
      useNetworkStore.getState().clearAllDevices();
    });
    startVisit();
    render(<App />);
    fireEvent.click(screen.getByText('Carica la rete di esempio'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(hint()).toBeNull();
  });

  it('a new project from the welcome screen: the tour waits for its window to close', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Nuovo progetto'));
    // (whether to drop what is not saved is asked first, and nothing is: the window opens a moment later)
    await act(async () => {});
    expect(useUIStore.getState().modals.newProject).toBe(true);
    expect(tour()).toBeNull();

    fireEvent.change(screen.getByLabelText('Nome del progetto'), { target: { value: 'Sede' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crea progetto' }));

    expect(useUIStore.getState().modals.newProject).toBe(false);
    expect(tour()).not.toBeNull();
  });

  it('a visitor who drew before the tour existed is not given it; the first question still comes with the sample', () => {
    localStorage.setItem(
      'pixelcake-network-v2',
      JSON.stringify({
        state: { devices: [{ id: 'dev-1', type: 'PC', label: 'PC-1', position: { x: 0, y: 0 } }] },
        version: 0,
      })
    );
    startVisit();
    render(<App />);

    fireEvent.click(screen.getByText('Carica la rete di esempio'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(hint()).toHaveTextContent('ping Web-Gestionale from PC-Vendite');
  });

  it('Aiuto → «Tour guidato» takes the tour again, from its first step, whenever asked', () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    localStorage.setItem('pixelcake-hide-welcome', 'true');
    startVisit();
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByText('Tour guidato'));
    expect(tour()).not.toBeNull();
    expect(screen.getByRole('dialog')).toHaveTextContent('1 di 8');

    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));
    fireEvent.click(screen.getByText('Tour guidato'));
    expect(tour()).not.toBeNull();
  });

  it('from the panel «Esempi» too, in the names of the language the sample is loaded in', () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    localStorage.setItem('pixelcake-hide-welcome', 'true');
    setLanguage('en');
    startVisit();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Add device' }));
    fireEvent.click(screen.getByRole('button', { name: 'Samples' }));
    fireEvent.click(screen.getByText('Company: offices, Wi-Fi, servers and DMZ'));

    const shown = screen.getByRole('region', { name: 'A first question' });
    expect(shown).toHaveTextContent('Does PC-Sales reach Web-ERP?');
    expect(shown).toHaveTextContent('ping Web-ERP from PC-Sales');
    expect(screen.getByRole('button', { name: 'Try it in the terminal' })).toBeInTheDocument();
  });

  it('is put away with its cross and not shown again; nor is it shown while presenting, or once its devices are gone', () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    startVisit();
    render(<App />);
    fireEvent.click(screen.getByText('Carica la rete di esempio'));
    expect(hint()).not.toBeNull();

    // presenting: the board is for the audience
    act(() => {
      usePresentationStore.getState().enter();
    });
    expect(hint()).toBeNull();
    act(() => usePresentationStore.getState().exit());
    expect(hint()).not.toBeNull();

    // the devices it names leave the board: it goes with them
    act(() => useNetworkStore.getState().clearAllDevices());
    expect(hint()).toBeNull();
    expect(useGuideStore.getState().firstTry).toBeNull();
  });

  it('closed with its cross, it does not come back when the sample is loaded again', () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    startVisit();
    render(<App />);
    fireEvent.click(screen.getByText('Carica la rete di esempio'));

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi il suggerimento' }));
    expect(hint()).toBeNull();

    // the same sample again, from the panel «Esempi» over an empty board
    act(() => useNetworkStore.getState().clearAllDevices());
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi dispositivo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
    fireEvent.click(screen.getByText('Azienda: uffici, Wi-Fi, server e DMZ'));
    expect(useNetworkStore.getState().devices).toHaveLength(20);
    expect(hint()).toBeNull();
  });
});
