/**
 * The guide and presentation mode tell the same story: every name the guide
 * puts in «quotes» for presentation mode is on a control the app really has,
 * and what the guide says happens is what happens.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import DevicePanel from '@/components/Sidebar/DevicePanel';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import PresentationBar from '@/components/Presentation/PresentationBar';
import PresentationMenu from '@/components/Presentation/PresentationMenu';
import PresentationPanel from '@/components/Presentation/PresentationPanel';
import HelpModal from './HelpModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();
const id = (label: string) => network().devices.find(d => d.label === label)!.id;

/** The text of one step of the guide, by its title */
function step(title: string): string {
  useUIStore.getState().openHelp('guide');
  render(<HelpModal />);
  const text = screen.getByText(title).closest('li')?.textContent ?? '';
  cleanup();
  useUIStore.getState().closeModal('help');
  return text;
}

/** What a step puts in «quotes»: the names of controls */
const quoted = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map(match => match[1]);

beforeEach(() => {
  localStorage.clear();
  presentation().exit();
  useSimulationStore.getState().resetSimulation();
  createNewProject({ name: 'Guida' });
});

describe('the guide — "Presenta la rete"', () => {
  it('names controls that exist', () => {
    const names = quoted(step('Presenta la rete'));
    expect(names).toEqual(['Presenta', 'Parti da qui', 'Arriva qui', 'Da', 'A', 'Esci']);

    // the way in, on the menu bar, with the sample of the guide loaded from the panel it names
    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
    fireEvent.click(screen.getByRole('button', { name: /Due sedi: linea principale e di riserva/ }));
    cleanup();
    render(<TopMenuBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Presenta' }));
    expect(presentation().active).toBe(true);
    cleanup();

    // the menu of a device
    render(<PresentationMenu />);
    act(() => presentation().openMenu({ kind: 'device', id: id('PC-Sede-1'), x: 0, y: 0 }));
    expect(screen.getByRole('menuitem', { name: 'Parti da qui' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Arriva qui' })).toBeInTheDocument();
    cleanup();

    // the two menus of the panel, and the three kinds of exchange the guide lists
    render(<PresentationPanel />);
    expect(screen.getByRole('button', { name: /^Da / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^A / })).toBeInTheDocument();
    for (const kind of ['Ping', 'Web', 'Email']) {
      expect(screen.getByRole('button', { name: kind })).toBeInTheDocument();
    }
    cleanup();

    // the bar: pace, terminal, and the way out
    render(<PresentationBar />);
    expect(screen.getByRole('group', { name: 'Velocità del pacchetto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminale' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Esci' }));
    expect(presentation().active).toBe(false);
  });

  it('says the packet goes by itself once the two ends are chosen: it does', () => {
    expect(step('Presenta la rete')).toContain('il pacchetto parte da solo');

    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
    fireEvent.click(screen.getByRole('button', { name: /Due sedi: linea principale e di riserva/ }));
    cleanup();
    act(() => {
      presentation().enter();
    });
    render(<PresentationPanel />);

    act(() => presentation().setSource(id('PC-Sede-1')));
    expect(useSimulationStore.getState().isRunning).toBe(false);
    act(() => presentation().setTarget(id('Srv-File')));
    expect(useSimulationStore.getState().isRunning).toBe(true);
  });
});

describe('the guide — "Chiedi cosa succede se qualcosa si rompe"', () => {
  it('names controls that exist, and the sample it sends the reader to', () => {
    const text = step('Chiedi cosa succede se qualcosa si rompe');
    const names = quoted(text);
    expect(names).toEqual([
      'Simula un guasto',
      'Guasti simulati',
      'Due sedi: linea principale e di riserva',
    ]);

    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(names[2]) }));
    cleanup();
    act(() => {
      presentation().enter();
    });

    render(<PresentationMenu />);
    act(() => presentation().openMenu({ kind: 'device', id: id('SW-Core'), x: 0, y: 0 }));
    expect(screen.getByRole('menuitem', { name: names[0] })).toBeInTheDocument();
    cleanup();
    const cable = network().connections[0].id;
    render(<PresentationMenu />);
    act(() => presentation().openMenu({ kind: 'connection', id: cable, x: 0, y: 0 }));
    expect(screen.getByRole('menuitem', { name: names[0] })).toBeInTheDocument();
    cleanup();

    render(<PresentationPanel />);
    expect(screen.getByRole('region', { name: names[1] })).toBeInTheDocument();
  });

  it('says the drawing does not change and the failure is gone on the way out: so it is', () => {
    const text = step('Chiedi cosa succede se qualcosa si rompe');
    expect(text).toContain('Il disegno non cambia');
    expect(text).toContain("all'uscita il guasto sparisce");

    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
    fireEvent.click(screen.getByRole('button', { name: /Due sedi/ }));
    cleanup();
    const before = JSON.stringify([network().devices, network().connections]);
    act(() => {
      presentation().enter();
      presentation().toggleDeviceFailure(id('SW-Core'));
      presentation().toggleConnectionFailure(network().connections[0].id);
    });
    expect(JSON.stringify([network().devices, network().connections])).toBe(before);

    act(() => presentation().exit());
    act(() => {
      presentation().enter();
    });
    expect(presentation().failedDevices).toEqual([]);
    expect(presentation().failedConnections).toEqual([]);
  });

  it('says the panel counts what stops, what takes another way and what does not change: it shows the three', () => {
    const text = step('Chiedi cosa succede se qualcosa si rompe');
    expect(text).toContain('quante comunicazioni tra i dispositivi finali si interrompono');

    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
    fireEvent.click(screen.getByRole('button', { name: /Due sedi/ }));
    cleanup();
    act(() => {
      presentation().enter();
    });
    render(<PresentationPanel />);
    const ring = network().connections.find(
      c => [c.source, c.target].includes(id('SW-Core')) && [c.source, c.target].includes(id('SW-Piano-1'))
    )!;
    act(() => {
      presentation().toggleConnectionFailure(ring.id);
      presentation().toggleDeviceFailure(id('PC-Filiale-2'));
    });

    const failures = screen.getByRole('region', { name: 'Guasti simulati' });
    expect(failures).toHaveTextContent(/\d+ si interrompono/);
    expect(failures).toHaveTextContent(/\d+ passano da un'altra strada/);
    expect(failures).toHaveTextContent(/\d+ non cambiano/);
  });
});

describe('the guide — the samples and the backup route', () => {
  it('counts the samples the panel offers', () => {
    expect(step('Aggiungi i dispositivi')).toContain('cinque reti di esempio');

    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Esempi' }));
    const samples = screen.getAllByRole('button').filter(button => button.className.includes('sidebar-panel-item'));
    expect(samples).toHaveLength(5);
  });

  it('says a second route to the same network is a backup', () => {
    expect(step('Instrada tra le reti')).toContain('Una seconda rotta per la stessa rete è di riserva');
  });
});
