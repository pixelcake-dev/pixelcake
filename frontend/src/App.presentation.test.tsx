/**
 * The whole app, in and out of presentation mode: the tools for building
 * give way to the tools for showing and come back, and the drawing is the
 * same on the way out as on the way in.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import App from './App';

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();

const id = (label: string) => network().devices.find(d => d.label === label)!.id;
const nodeOf = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('.react-flow__node')].find(
    node => node.querySelector('.device-name')?.textContent === label
  )!;

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

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pixelcake-hide-welcome', 'true');
  stubBrowser();
  presentation().exit();
  useSimulationStore.getState().resetSimulation();
  createNewProject({ name: 'Due sedi' });
  const sample = createRedundancySample();
  network().loadTopology(sample.devices, sample.connections);
  network().markSaved();
  useUIStore.setState({ activeSidebarPanel: null });
});

afterEach(() => {
  act(() => presentation().exit());
  vi.unstubAllGlobals();
});

describe('App — presentation mode', () => {
  it('swaps the building tools for the presentation, and back', () => {
    render(<App />);
    expect(document.querySelector('.top-menubar')).not.toBeNull();
    expect(document.querySelector('.sidebar')).not.toBeNull();
    expect(document.querySelector('.presentation-bar')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Presenta/ }));

    expect(document.querySelector('.top-menubar')).toBeNull();
    expect(document.querySelector('.sidebar')).toBeNull();
    expect(document.querySelector('.presentation-bar')).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Pannello della presentazione' })).toBeInTheDocument();
    expect(document.querySelector('.app-container')?.className).toContain('presenting');
    // the drawing is still there, whole
    expect(document.querySelectorAll('.react-flow__node')).toHaveLength(12);

    fireEvent.click(screen.getByRole('button', { name: /Esci/ }));

    expect(document.querySelector('.top-menubar')).not.toBeNull();
    expect(document.querySelector('.sidebar')).not.toBeNull();
    expect(document.querySelector('.presentation-bar')).toBeNull();
    expect(document.querySelector('.app-container')?.className).not.toContain('presenting');
  });

  it('a whole presentation by clicks: ask, break, see, repair, leave — and the drawing is untouched', () => {
    render(<App />);
    const before = JSON.stringify([network().devices, network().connections, network().viewport]);
    fireEvent.click(screen.getByRole('button', { name: /Presenta/ }));

    // ask from PC-Filiale-1 to Srv-File, through the menus on the devices
    fireEvent.click(nodeOf('PC-Filiale-1'), { clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Parti da qui' }));
    fireEvent.click(nodeOf('Srv-File'), { clientX: 60, clientY: 60 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Arriva qui' }));

    expect(screen.getByRole('status')).toHaveTextContent('Srv-File risponde a PC-Filiale-1.');
    expect(nodeOf('PC-Filiale-1').querySelector('.device-role')?.textContent).toBe('Da');
    expect(nodeOf('Srv-File').querySelector('.device-role')?.textContent).toBe('A');
    expect(useSimulationStore.getState().isRunning).toBe(true);

    // break the router of the main site
    fireEvent.click(nodeOf('R-Sede'), { clientX: 70, clientY: 70 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Simula un guasto' }));

    expect(screen.getByRole('status')).toHaveTextContent('Non arriva');
    expect(screen.getByText('Senza guasti arrivava.')).toBeInTheDocument();
    expect(nodeOf('R-Sede').querySelector('.network-device')?.className).toContain('device-failed');
    const failures = screen.getByRole('region', { name: 'Guasti simulati' });
    expect(within(failures).getByRole('button', { name: 'Ripara R-Sede' })).toBeInTheDocument();
    expect(failures).toHaveTextContent('12 si interrompono');

    // repair it from its own menu
    fireEvent.click(nodeOf('R-Sede'), { clientX: 70, clientY: 70 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ripara' }));
    expect(screen.getByRole('status')).toHaveTextContent('Arriva');
    expect(document.querySelector('.device-failed')).toBeNull();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(presentation().active).toBe(false);
    expect(JSON.stringify([network().devices, network().connections, network().viewport])).toBe(before);
    expect(network().hasUnsavedChanges).toBe(false);
    expect(document.querySelector('.device-role, .device-failed, .presentation-menu')).toBeNull();
  });

  it('opens the terminal from the presentation, and the terminal sees the simulated failure', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Presenta/ }));
    act(() => presentation().toggleDeviceFailure(id('SW-Core')));

    fireEvent.click(screen.getByRole('button', { name: 'Terminale' }));
    const input = screen.getByLabelText<HTMLInputElement>('Riga di comando del terminale');
    fireEvent.change(input, { target: { value: 'ping Srv-File from PC-Sede-1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // the packet goes as far as it gets; stop it to have the verdict printed
    act(() => useSimulationStore.getState().stopSimulation());

    expect(screen.getByText('Ping failed (blocked): request: SW-Core is down')).toBeInTheDocument();
    // Esc with the terminal open does not end the presentation
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(presentation().active).toBe(true);
  });

  it('does not enter on an empty canvas', () => {
    act(() => network().clearAllDevices());
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Presenta/ }));

    expect(presentation().active).toBe(false);
    expect(document.querySelector('.top-menubar')).not.toBeNull();
  });
});
