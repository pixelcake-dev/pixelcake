/**
 * runFlowSimulation — the simulation started from the side panel: what it
 * refuses, what it animates, and that it asks its question of the same
 * topology as everything else (failures simulated in a presentation included).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { createRedundancySample } from './sampleRedundancy';
import { runFlowSimulation } from './runSimulation';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const simulation = () => useSimulationStore.getState();
const presentation = () => usePresentationStore.getState();

const id = (label: string) => {
  const found = network().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};

const cable = (a: string, b: string) => {
  const [first, second] = [id(a), id(b)];
  const found = network().connections.find(
    c => (c.source === first && c.target === second) || (c.source === second && c.target === first)
  );
  if (!found) throw new Error(`no cable between "${a}" and "${b}"`);
  return found.id;
};

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.warning).mockClear();
  localStorage.clear();
  presentation().exit();
  simulation().resetSimulation();
  const sample = createRedundancySample();
  network().clearAllDevices();
  network().loadTopology(sample.devices, sample.connections);
});

describe('runFlowSimulation', () => {
  it('animates an exchange that works, on the cables the engine took', () => {
    expect(runFlowSimulation(id('PC-Sede-1'), id('Srv-File'), 'ping')).toBe(true);

    expect(simulation().isRunning).toBe(true);
    expect(simulation().flowModel).toBe('ping');
    expect(simulation().path).toEqual(
      ['PC-Sede-1', 'SW-Piano-1', 'SW-Core', 'Srv-File', 'SW-Core', 'SW-Piano-1', 'PC-Sede-1'].map(id)
    );
    expect(simulation().links).toHaveLength(6);
    expect(simulation().links[1]).toBe(cable('SW-Piano-1', 'SW-Core'));
    expect(toast.error).not.toHaveBeenCalled();
    // the run knows how the question ends: the server answers. Nothing is on the canvas yet
    expect(simulation().outcome).toEqual({ arrives: true, deviceId: id('Srv-File') });
    expect(simulation().answer).toBeNull();
  });

  it('refuses a question with a missing end, or from a device to itself, and says why', () => {
    expect(runFlowSimulation('', id('Srv-File'), 'ping')).toBe(false);
    expect(runFlowSimulation(id('Srv-File'), id('Srv-File'), 'ping')).toBe(false);
    expect(toast.warning).toHaveBeenCalledTimes(2);
    expect(simulation().isRunning).toBe(false);
  });

  it('refuses to simulate on a canvas with fewer than two devices', () => {
    network().clearAllDevices();
    expect(runFlowSimulation('a', 'b', 'ping')).toBe(false);
    expect(toast.warning).toHaveBeenCalledWith('Aggiungi almeno due dispositivi per avviare una simulazione.');
  });

  it('animates a failing exchange as far as it gets, and gives the reason', () => {
    // a port switched off: a configuration, not a simulated failure
    const core = network().devices.find(d => d.label === 'SW-Core')!;
    network().updateDevice(core.id, {
      ports: core.ports?.map(p => (p.id === 1 ? { ...p, enabled: false } : p)),
    });

    expect(runFlowSimulation(id('PC-Sede-1'), id('Srv-File'), 'ping')).toBe(true);

    expect(simulation().path).toEqual(['PC-Sede-1', 'SW-Piano-1', 'SW-Core'].map(id));
    expect(simulation().links).toHaveLength(2);
    // and where it stops, for the device to say once the packet is there
    expect(simulation().outcome).toEqual({ arrives: false, deviceId: id('SW-Core') });
    expect(simulation().answer).toBeNull();
    expect(toast.error).toHaveBeenCalledWith('Simulazione Ping fallita', {
      description: 'request: port 1 on SW-Core is disabled',
    });
  });

  it('starts nothing when the packet cannot even leave', () => {
    const pc = network().devices.find(d => d.label === 'PC-Sede-1')!;
    network().updateDevice(pc.id, { nics: pc.nics?.map(n => ({ ...n, enabled: false })) });

    expect(runFlowSimulation(id('PC-Sede-1'), id('Srv-File'), 'ping')).toBe(false);
    expect(simulation().isRunning).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
    // nothing travels: the device the question stops on says so at once
    expect(simulation().answer).toEqual({ arrives: false, deviceId: id('PC-Sede-1') });
  });

  it('sees the failures simulated in a presentation, and only while it lasts', () => {
    presentation().enter();
    presentation().toggleDeviceFailure(id('SW-Core'));

    expect(runFlowSimulation(id('PC-Sede-1'), id('Srv-File'), 'ping')).toBe(true);
    expect(simulation().path).toEqual(['PC-Sede-1', 'SW-Piano-1'].map(id));
    expect(toast.error).toHaveBeenCalledWith('Simulazione Ping fallita', {
      description: 'request: SW-Core is down',
    });

    presentation().exit();
    vi.mocked(toast.error).mockClear();
    expect(runFlowSimulation(id('PC-Sede-1'), id('Srv-File'), 'ping')).toBe(true);
    expect(simulation().path).toHaveLength(7);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
