/**
 * Vista → Collega i dispositivi senza cavo says afterwards what it did: how
 * many cables it added, and which devices it left alone and why, in the
 * language of the interface. With nothing to do it says so, and changes
 * nothing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import type { NetworkDevice } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createSampleTopology } from '@/utils/sampleTopology';
import { setLanguage } from '@/i18n';
import { device, host } from '@/test/networkFixtures';
import TopMenuBar from './TopMenuBar';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const at = (x: number, y: number) => ({ position: { x, y } });
/** A device of a network none of the office's switches is on */
const stranger = (id: string, x: number): NetworkDevice => host(id, '10.5.0.9', '', at(x, 900));
const connect = () => fireEvent.click(screen.getByText('Collega i dispositivi senza cavo'));
/** Every cable of the device with this name taken away */
const unplug = (label: string) => {
  const id = network().devices.find((one) => one.label === label)?.id;
  for (const one of network().connections.filter((cable) => cable.source === id || cable.target === id)) {
    network().removeConnection(one.id);
  }
};

beforeEach(() => {
  localStorage.clear();
  createNewProject({ name: 'Ufficio' });
  network().loadSample(createSampleTopology());
  network().markSaved();
  // (creating the project said so: only what the entry says is looked at)
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.info).mockClear();
  vi.mocked(toast.warning).mockClear();
});

afterEach(() => {
  act(() => setLanguage('it'));
});

describe('Vista → Collega i dispositivi senza cavo', () => {
  it('says how many cables it added', () => {
    unplug('PC-1');
    unplug('Web-01');
    render(<TopMenuBar />);

    connect();

    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.success).mock.calls[0][0]).toBe('Aggiunti 2 cavi');
    expect(vi.mocked(toast.success).mock.calls[0][1]).toBeUndefined();
    expect(network().hasUnsavedChanges).toBe(true);
  });

  it('and which devices it left alone, and why', () => {
    unplug('PC-1');
    network().loadTopology(
      [...network().devices, stranger('PC-9', 0), device({ id: 'Router-9', type: 'Router', ...at(300, 900) })],
      network().connections
    );
    render(<TopMenuBar />);

    connect();

    expect(toast.success).toHaveBeenCalledWith('Aggiunto 1 cavo', {
      description: 'PC-9: nessuno switch nella stessa rete. Router-9: router, firewall e Internet si collegano a mano.',
      duration: 8000,
    });
  });

  it('a long list of names ends in «e altri N»', () => {
    const strangers = Array.from({ length: 6 }, (_, index) => stranger(`PC-${index + 11}`, index * 150));
    network().loadTopology([...network().devices, ...strangers], network().connections);
    network().markSaved();
    render(<TopMenuBar />);

    connect();

    expect(toast.warning).toHaveBeenCalledWith('Nessun cavo aggiunto', {
      description: 'PC-11, PC-12, PC-13 e altri 3: nessuno switch nella stessa rete.',
      duration: 8000,
    });
    // (nothing was added: nothing changed)
    expect(network().hasUnsavedChanges).toBe(false);
  });

  it('with every device cabled it says so, and changes nothing', () => {
    const before = network().connections;
    render(<TopMenuBar />);

    connect();

    expect(toast.info).toHaveBeenCalledWith('Ogni dispositivo ha già il suo cavo');
    expect(network().connections).toBe(before);
    expect(network().hasUnsavedChanges).toBe(false);
  });

  it('speaks English when the interface does', () => {
    unplug('PC-1');
    network().loadTopology([...network().devices, stranger('PC-9', 0)], network().connections);
    act(() => setLanguage('en'));
    render(<TopMenuBar />);

    fireEvent.click(screen.getByText('Connect devices with no cable'));

    expect(toast.success).toHaveBeenCalledWith('1 cable added', {
      description: 'PC-9: no switch on the same network.',
      duration: 8000,
    });
  });
});
