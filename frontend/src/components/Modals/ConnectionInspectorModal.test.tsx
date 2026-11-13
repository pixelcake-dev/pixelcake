/**
 * ConnectionInspectorModal tests — the interface pickers: one select per link
 * end listing the device's ports/NICs, interfaces used by another link shown
 * disabled with "(in uso)", a "Non assegnata" option, and saving writing the
 * four binding fields. Runs against the real stores with the sample network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import type { NetworkConnection, NetworkDevice } from '@/types';
import { expectSpacedApart } from '@/test/formLayout';
import ConnectionInspectorModal from './ConnectionInspectorModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function device(label: string): NetworkDevice {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

/** The (live) connection between two devices, by label */
function connection(sourceLabel: string, targetLabel: string): NetworkConnection {
  const source = device(sourceLabel).id;
  const target = device(targetLabel).id;
  const found = useNetworkStore
    .getState()
    .connections.find(c => c.source === source && c.target === target);
  if (!found) throw new Error(`no connection ${sourceLabel} → ${targetLabel}`);
  return found;
}

/** Open the inspector on a connection, as the canvas context menu does */
function openInspector(sourceLabel: string, targetLabel: string) {
  useUIStore.getState().setInspectorConnection(connection(sourceLabel, targetLabel));
  useUIStore.getState().openModal('connectionInspector');
  render(<ConnectionInspectorModal />);
}

function select(label: string): HTMLSelectElement {
  return screen.getByLabelText<HTMLSelectElement>(label);
}

/** [text, disabled] for every option of a select */
function options(el: HTMLSelectElement): Array<[string, boolean]> {
  return Array.from(el.options).map(o => [o.textContent ?? '', o.disabled]);
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
}

describe('ConnectionInspectorModal — interfaces', () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useNetworkStore.getState();
    store.clearAllDevices();
    const sample = createSampleTopology();
    store.loadTopology(sample.devices, sample.connections);
    useUIStore.getState().closeModal('connectionInspector');
    useUIStore.getState().setInspectorConnection(null);
  });

  it('no label is glued to the field above it: bandwidth and label are spaced', () => {
    openInspector('PC-1', 'SW-Office');

    const fields = ['Bandwidth (es: 1Gbps, 100Mbps)', 'Etichetta Custom'].map(label =>
      screen.getByLabelText(label)
    );
    expectSpacedApart(fields);
    // and the group under them does not start right against the second one
    expect(fields[1].closest('[class*="gap-"]')?.className).toMatch(/(^|\s)mb-4(\s|$)/);
  });

  it('shows one picker per end, with the interface each end is attached to', () => {
    openInspector('PC-1', 'SW-Office');

    const onPc = select('Interfaccia su PC-1');
    const onSwitch = select('Interfaccia su SW-Office');
    expect(onPc.value).toBe('nic:nic-1');
    expect(onPc.selectedOptions[0].textContent).toBe('eth0 (192.168.10.11)');
    expect(onSwitch.value).toBe('port:1');
    expect(onSwitch.selectedOptions[0].textContent).toBe('Porta 1 — PC-1');
  });

  it('lists every interface, with the ones used by another link disabled and marked "(in uso)"', () => {
    openInspector('PC-1', 'SW-Office');

    expect(options(select('Interfaccia su PC-1'))).toEqual([['eth0 (192.168.10.11)', false]]);
    expect(options(select('Interfaccia su SW-Office'))).toEqual([
      ['Porta 1 — PC-1', false], // this link's own port stays selectable
      ['Porta 2 — PC-2 (in uso)', true],
      ['Porta 3', false],
      ['Porta 4', false],
      ['Porta 5', false],
      ['Porta 6', false],
      ['Porta 7', false],
      ['Porta 8 — Uplink (in uso)', true],
    ]);
  });

  it('shows the address of router ports', () => {
    openInspector('SW-Office', 'Router-1');

    expect(options(select('Interfaccia su Router-1'))).toEqual([
      ['Porta 1 — LAN Uffici (192.168.10.1)', false],
      ['Porta 2 — LAN Server (192.168.20.1) (in uso)', true],
      ['Porta 3', false],
      ['Porta 4', false],
    ]);
  });

  it('flags disabled interfaces in the list', () => {
    const sw = device('SW-Office');
    useNetworkStore.getState().updateDevice(sw.id, {
      ports: (sw.ports ?? []).map(p => (p.id === 5 ? { ...p, enabled: false } : p)),
    });
    openInspector('PC-1', 'SW-Office');

    const texts = options(select('Interfaccia su SW-Office')).map(([text]) => text);
    expect(texts).toContain('Porta 5 — disabilitata');
  });

  it('saving writes the chosen interfaces to the connection and closes the modal', () => {
    openInspector('PC-1', 'SW-Office');

    fireEvent.change(select('Interfaccia su SW-Office'), { target: { value: 'port:5' } });
    save();

    const saved = connection('PC-1', 'SW-Office');
    expect(saved.targetPort).toBe(5);
    expect(saved.targetNic).toBeUndefined();
    expect(saved.sourceNic).toBe('nic-1');
    expect(saved.sourcePort).toBeUndefined();
    // the rest of the link is untouched
    expect(saved).toMatchObject({ type: 'access', bandwidth: '1 Gbps' });
    expect(useUIStore.getState().modals.connectionInspector).toBe(false);
  });

  // A bound end would be bound again at the next load, so detaching it is
  // not offered: the link can only be moved to another interface
  it('does not offer "Non assegnata" for an end that is attached to an interface', () => {
    openInspector('PC-1', 'SW-Office');

    const texts = [
      ...options(select('Interfaccia su PC-1')),
      ...options(select('Interfaccia su SW-Office')),
    ].map(([text]) => text);
    expect(texts).not.toContain('Non assegnata');
  });

  it('a freed interface becomes available to the other links', () => {
    openInspector('PC-1', 'SW-Office');
    fireEvent.change(select('Interfaccia su SW-Office'), { target: { value: 'port:5' } });
    save();
    cleanup(); // one modal instance at a time

    openInspector('PC-2', 'SW-Office');
    const table = options(select('Interfaccia su SW-Office'));
    expect(table).toContainEqual(['Porta 1 — PC-1', false]); // freed
    expect(table).toContainEqual(['Porta 5 (in uso)', true]); // now PC-1's
  });

  it('cancelling changes nothing', () => {
    openInspector('PC-1', 'SW-Office');
    const before = useNetworkStore.getState().connections;

    fireEvent.change(select('Interfaccia su SW-Office'), { target: { value: 'port:5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    expect(useNetworkStore.getState().connections).toBe(before);
  });

  it('shows an unbound end as "Non assegnata" and a device without interfaces as a disabled picker', () => {
    useNetworkStore.getState().addDevice({
      type: 'PC',
      label: 'Legacy',
      ip: '192.168.10.50',
      subnet: '255.255.255.0',
      gateway: '192.168.10.1',
      position: { x: 0, y: 0 },
    });
    useNetworkStore
      .getState()
      .addConnection({ source: device('Legacy').id, target: device('SW-Office').id });
    openInspector('Legacy', 'SW-Office');

    const onLegacy = select('Interfaccia su Legacy');
    expect(onLegacy.disabled).toBe(true);
    expect(onLegacy.value).toBe('');
    expect(options(onLegacy)).toEqual([['Non assegnata', false]]);
    expect(select('Interfaccia su SW-Office').value).toBe('port:3');
  });

  it('renders nothing while closed', () => {
    useUIStore.getState().setInspectorConnection(connection('PC-1', 'SW-Office'));
    render(<ConnectionInspectorModal />);
    expect(screen.queryByText('Interfacce')).not.toBeInTheDocument();
  });
});
