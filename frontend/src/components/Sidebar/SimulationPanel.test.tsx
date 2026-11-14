/**
 * SimulationPanel tests — the panel says what to send and between which
 * devices, and has one button that sends it. The button is a button (it was
 * drawn like a row of a menu, above the fields it depends on), and the panel
 * does not repeat its own title.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useSimulationStore } from '@/store/simulationStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import { runFlowSimulation } from '@/utils/runSimulation';
import SimulationPanel from './SimulationPanel';

vi.mock('@/utils/runSimulation', () => ({ runFlowSimulation: vi.fn(() => true) }));

const start = () => screen.getByRole('button', { name: 'Avvia simulazione' });

/** The id the store gave to the device with this name */
const idOf = (label: string) => {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};

function loadSample() {
  const sample = createSampleTopology();
  useNetworkStore.getState().loadTopology(sample.devices, sample.connections);
  // (the store gives the devices ids of its own)
  return { devices: useNetworkStore.getState().devices };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useNetworkStore.getState().clearAllDevices();
  useSimulationStore.getState().stopSimulation();
});

describe('SimulationPanel', () => {
  it('does not repeat the title of the panel it is in', () => {
    loadSample();
    const { container } = render(<SimulationPanel />);

    expect(container.querySelector('.sidebar-section-title')).toBeNull();
    expect(screen.queryByText(/^simulazione$/i)).toBeNull();
  });

  it('has the button after the fields it sends: from, to, what', () => {
    loadSample();
    render(<SimulationPanel />);

    const inOrder = [
      screen.getByRole('button', { name: /Partenza/ }),
      screen.getByRole('button', { name: /Destinazione/ }),
      screen.getByLabelText('Tipo di traffico'),
      start(),
    ];
    for (let i = 1; i < inOrder.length; i++) {
      expect(
        inOrder[i - 1].compareDocumentPosition(inOrder[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        `item ${i} comes after item ${i - 1}`
      ).toBeTruthy();
    }
  });

  it('the button is the main one of the panel, as wide as the panel', () => {
    loadSample();
    render(<SimulationPanel />);

    // (the main button of the interface is a block of ink)
    expect(start().className).toContain('bg-[var(--text-color)]');
    expect(start().className).toContain('w-full');
    expect(start().className).not.toContain('sidebar-panel-item');
  });

  it('sends the chosen exchange between the chosen devices', () => {
    const { devices } = loadSample();
    render(<SimulationPanel />);

    fireEvent.change(screen.getByLabelText('Tipo di traffico'), { target: { value: 'web' } });
    fireEvent.click(start());

    // The panel proposes the first PC and the first server of the drawing,
    // not its first two devices (a router and a switch, here)
    expect(devices.slice(0, 2).map(d => d.label)).toEqual(['Router-1', 'SW-Office']);
    expect(runFlowSimulation).toHaveBeenCalledTimes(1);
    expect(runFlowSimulation).toHaveBeenCalledWith(idOf('PC-1'), idOf('Web-01'), 'web');
  });

  it('on the sample of the welcome screen proposes a question that has an answer worth seeing', () => {
    const sample = createCompanySample();
    useNetworkStore.getState().loadTopology(sample.devices, sample.connections);
    render(<SimulationPanel />);

    expect(screen.getByRole('button', { name: /Partenza/ })).toHaveTextContent(
      'PC-Contabilità (192.168.10.11)'
    );
    expect(screen.getByRole('button', { name: /Destinazione/ })).toHaveTextContent(
      'Srv-Auth (192.168.30.10)'
    );

    fireEvent.click(start());
    expect(runFlowSimulation).toHaveBeenCalledWith(idOf('PC-Contabilità'), idOf('Srv-Auth'), 'ping');
  });

  it('a drawing with no PC and no server gets its first two devices', () => {
    const add = (label: string, type: 'Switch' | 'Router') =>
      useNetworkStore.getState().addDevice({
        type,
        label,
        ip: '',
        subnet: '255.255.255.0',
        gateway: '',
        position: { x: 0, y: 0 },
      });
    add('SW-1', 'Switch');
    add('R-1', 'Router');
    add('SW-2', 'Switch');
    render(<SimulationPanel />);

    fireEvent.click(start());

    expect(runFlowSimulation).toHaveBeenCalledWith(idOf('SW-1'), idOf('R-1'), 'ping');
    // a device without an address is named alone, with no empty brackets
    expect(screen.getByRole('button', { name: /Partenza/ }).textContent).not.toContain('(');
  });

  it('proposes again when what was chosen is no longer in the drawing', () => {
    loadSample();
    render(<SimulationPanel />);
    const gone = idOf('Web-01');

    act(() => {
      useNetworkStore.getState().removeDevice(gone);
    });
    fireEvent.click(start());

    // the next server of the drawing takes the place of the one that was removed
    expect(runFlowSimulation).toHaveBeenCalledTimes(1);
    expect(runFlowSimulation).toHaveBeenCalledWith(idOf('PC-1'), idOf('Mail-01'), 'ping');
  });

  it('keeps what the user chose while it is in the drawing', () => {
    loadSample();
    render(<SimulationPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Destinazione/ }));
    fireEvent.click(screen.getByText(/^Mail-01/));
    act(() => {
      useNetworkStore.getState().addDevice({
        type: 'Server',
        label: 'Srv-Nuovo',
        ip: '192.168.20.99',
        subnet: '255.255.255.0',
        gateway: '192.168.20.1',
        position: { x: 0, y: 0 },
      });
    });
    fireEvent.click(start());

    expect(runFlowSimulation).toHaveBeenCalledWith(idOf('PC-1'), idOf('Mail-01'), 'ping');
  });

  it('cannot be pressed, and says why, until the drawing has two devices', () => {
    render(<SimulationPanel />);

    expect(start()).toBeDisabled();
    expect(screen.getByText('Servono almeno due dispositivi sul canvas.')).toBeInTheDocument();
    fireEvent.click(start());
    expect(runFlowSimulation).not.toHaveBeenCalled();

    act(() => {
      loadSample();
    });

    expect(start()).toBeEnabled();
    expect(screen.queryByText('Servono almeno due dispositivi sul canvas.')).toBeNull();
  });

  it('while a packet is travelling it is the button that stops it', () => {
    const { devices } = loadSample();
    render(<SimulationPanel />);

    act(() => {
      useSimulationStore.getState().startSimulation([devices[0].id, devices[1].id], 'ping');
    });

    const stop = screen.getByRole('button', { name: 'Ferma simulazione' });
    expect(screen.queryByRole('button', { name: 'Avvia simulazione' })).toBeNull();
    expect(stop).toBeEnabled();
    expect(stop.className).toContain('bg-[var(--danger-color)]');

    fireEvent.click(stop);

    expect(useSimulationStore.getState().isRunning).toBe(false);
    expect(runFlowSimulation).not.toHaveBeenCalled();
    expect(start()).toBeInTheDocument();
  });
});
