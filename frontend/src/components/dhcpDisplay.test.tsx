/**
 * A device on DHCP is shown with the address it is leased wherever a device
 * is shown with its address: on the drawing, in the menus that list devices,
 * in the window of a cable. Runs against the real stores with the small
 * sample network:
 *
 *            Router-1 (hands out 192.168.10.100–199 on port 1)
 *     port 1 /       \ port 2
 *    SW-Office        SW-Servers
 *     /     \          /      \
 *  PC-1    PC-2     Web-01   Mail-01
 *  (dhcp)  .10.12   .20.10   (dhcp, and no server on its network)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import type { DhcpPool, NetworkDevice } from '@/types';
import NetworkCanvas from './Canvas/NetworkCanvas';
import SimulationPanel from './Sidebar/SimulationPanel';
import PresentationPanel from './Presentation/PresentationPanel';
import PresentationMenu from './Presentation/PresentationMenu';
import ConnectionInspectorModal from './Modals/ConnectionInspectorModal';

vi.mock('@/utils/runSimulation', () => ({ runFlowSimulation: vi.fn(() => true) }));

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();

function device(label: string): NetworkDevice {
  const found = network().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

function setPool(pool: DhcpPool | undefined) {
  const router = device('Router-1');
  network().updateDevice(router.id, {
    ports: router.ports?.map(p => (p.id === 1 ? { ...p, dhcpServer: pool } : p)),
  });
}

function setAutomatic(label: string) {
  const d = device(label);
  network().updateDevice(d.id, { nics: d.nics?.map(nic => ({ ...nic, dhcp: true })) });
}

/** What the drawing writes under the name of a device */
const underTheName = (label: string) =>
  screen.getByText(label, { selector: '.device-name' }).closest('.react-flow__node')?.querySelector('.device-ip')
    ?.textContent;

beforeEach(() => {
  localStorage.clear();
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
  presentation().exit();
  network().clearAllDevices();
  const sample = createSampleTopology();
  network().loadTopology(sample.devices, sample.connections);
  setPool({ start: '192.168.10.100', end: '192.168.10.199' });
  setAutomatic('PC-1');
  setAutomatic('Mail-01');
});

afterEach(() => {
  act(() => presentation().exit());
  useUIStore.getState().closeModal('connectionInspector');
  vi.unstubAllGlobals();
});

describe('the drawing', () => {
  const renderCanvas = () =>
    render(
      <ReactFlowProvider>
        <NetworkCanvas />
      </ReactFlowProvider>
    );

  it('writes the leased address under a device on DHCP, and says when there is none', () => {
    renderCanvas();
    expect(underTheName('PC-1')).toBe('192.168.10.100 · DHCP');
    expect(underTheName('Mail-01')).toBe('DHCP: nessun indirizzo');
    // an address written by hand is shown as it always was
    expect(underTheName('PC-2')).toBe('192.168.10.12');
    expect(underTheName('Router-1')).toBe('192.168.10.1');
  });

  it('follows the drawing: another range, another address, at once', () => {
    renderCanvas();
    act(() => setPool({ start: '192.168.10.150', end: '192.168.10.199' }));
    expect(underTheName('PC-1')).toBe('192.168.10.150 · DHCP');
    act(() => setPool(undefined));
    expect(underTheName('PC-1')).toBe('DHCP: nessun indirizzo');
  });

  it('hands the window of the device the device as it is kept, not as it is shown', () => {
    renderCanvas();
    fireEvent.doubleClick(screen.getByText('PC-1', { selector: '.device-name' }));
    const opened = useUIStore.getState().inspectorDevice;
    expect(opened?.nics?.[0]).toMatchObject({ dhcp: true, ip: '', gateway: '' });
    expect(opened?.ip).toBe('');
    act(() => useUIStore.getState().closeModal('inspector'));
  });
});

describe('the menus that list devices', () => {
  it('the simulation panel names its two ends with the address each has', () => {
    render(<SimulationPanel />);
    // it proposes the first PC and the first server
    expect(screen.getByRole('button', { name: /^Partenza/ })).toHaveTextContent('PC-1 (192.168.10.100 · DHCP)');
    expect(screen.getByRole('button', { name: /^Destinazione/ })).toHaveTextContent('Web-01 (192.168.20.10)');

    fireEvent.click(screen.getByRole('button', { name: /^Destinazione/ }));
    expect(screen.getByRole('button', { name: 'Mail-01 (DHCP: nessun indirizzo)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PC-2 (192.168.10.12)' })).toBeInTheDocument();
  });

  it('the presentation panel does the same', () => {
    act(() => presentation().enter());
    render(<PresentationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^Da / }));
    expect(screen.getByRole('button', { name: 'PC-1 (192.168.10.100 · DHCP)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mail-01 (DHCP: nessun indirizzo)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PC-2 (192.168.10.12)' })).toBeInTheDocument();
  });

  it('the menu of a device in a presentation says its kind and its address', () => {
    act(() => presentation().enter());
    render(<PresentationMenu />);
    act(() => presentation().openMenu({ kind: 'device', id: device('PC-1').id, x: 10, y: 10 }));
    expect(screen.getByRole('menu', { name: 'PC-1' })).toHaveTextContent('PC · 192.168.10.100 · DHCP');
    act(() => presentation().openMenu({ kind: 'device', id: device('PC-2').id, x: 10, y: 10 }));
    expect(screen.getByRole('menu', { name: 'PC-2' })).toHaveTextContent('PC · 192.168.10.12');
  });
});

describe('the window of a cable', () => {
  it('lists the card of a device on DHCP with the address it is leased', () => {
    const [pc, sw] = [device('PC-1'), device('SW-Office')];
    const cable = network().connections.find(c => c.source === pc.id || c.target === pc.id);
    if (!cable) throw new Error('PC-1 has no cable');
    useUIStore.getState().setInspectorConnection(cable);
    useUIStore.getState().openModal('connectionInspector');
    render(<ConnectionInspectorModal />);

    const cards = screen.getByLabelText<HTMLSelectElement>('Interfaccia su PC-1');
    expect(Array.from(cards.options).map(option => option.textContent)).toContain('eth0 (192.168.10.100 · DHCP)');

    // saving keeps the cable on the card: only its key is written
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    const saved = network().connections.find(c => c.id === cable.id);
    expect([saved?.sourceNic, saved?.targetNic]).toContain('nic-1');
    expect(device('PC-1').nics?.[0]).toMatchObject({ dhcp: true, ip: '' });
    expect(sw.label).toBe('SW-Office');
  });
});
