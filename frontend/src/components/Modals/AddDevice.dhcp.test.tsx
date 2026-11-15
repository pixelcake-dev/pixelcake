/**
 * A new device is proposed an address nobody has: not one written by hand,
 * and not one a card on DHCP is leased. One by one (AddDeviceModal), in bulk
 * (BulkAddDeviceModal). And a device on DHCP is laid out and cabled by the
 * cables and the switches there are, as any other.
 *
 *            Router-1 (hands out 192.168.10.3–9 on port 1)
 *     port 1 /       \ port 2
 *    SW-Office        SW-Servers
 *     /     \          /      \
 *  PC-1    PC-2     Web-01   Mail-01
 *  (dhcp: .3)  .12
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { arrangeDrawing } from '@/utils/autoLayout';
import { connectLooseDevices } from '@/utils/autoConnect';
import { resolveDhcp } from '@/engine';
import type { NetworkDevice } from '@/types';
import AddDeviceModal from './AddDeviceModal';
import BulkAddDeviceModal from './BulkAddDeviceModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const store = () => useNetworkStore.getState();
const named = (label: string): NetworkDevice => {
  const found = store().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

beforeEach(() => {
  localStorage.clear();
  store().clearAllDevices();
  // the network of the offices is the one new devices are addressed in
  store().setGlobalNetworkSettings({ ipClass: '192.168.10.0', subnet: '255.255.255.0', gateway: '192.168.10.1' });
  const sample = createSampleTopology();
  store().loadTopology(sample.devices, sample.connections);
  const router = named('Router-1');
  store().updateDevice(router.id, {
    ports: router.ports?.map(p =>
      p.id === 1 ? { ...p, dhcpServer: { start: '192.168.10.3', end: '192.168.10.9' } } : p
    ),
  });
  const pc = named('PC-1');
  store().updateDevice(pc.id, { nics: pc.nics?.map(card => ({ ...card, dhcp: true })) });
});

describe('the address proposed for a new device', () => {
  it('the lab: .1 and .2 are written by hand, .3 is leased to PC-1', () => {
    const { devices, connections } = store();
    expect(resolveDhcp({ devices, connections }).leases.map(lease => lease.ip)).toEqual(['192.168.10.3']);
    expect(named('Router-1').ip).toBe('192.168.10.1');
    expect(named('SW-Office').ip).toBe('192.168.10.2');
  });

  it('one device: the first address nobody has, leased ones included', () => {
    useUIStore.getState().setAddDeviceType('PC', 'tpl-pc');
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    const added = store().devices[store().devices.length - 1];
    expect(added).toMatchObject({ ip: '192.168.10.4', nics: [{ ip: '192.168.10.4' }] });
    // PC-1 keeps the address it had
    const { devices, connections } = store();
    expect(resolveDhcp({ devices, connections }).leases.map(lease => lease.ip)).toEqual(['192.168.10.3']);
  });

  it('in bulk: the same, one after the other', () => {
    useUIStore.getState().openModal('bulkAddDevice');
    render(<BulkAddDeviceModal />);
    const row = screen.getByText('PC', { selector: '.type-cell span' }).closest('tr');
    if (!row) throw new Error('no row for PC');
    const more = row.querySelector<HTMLButtonElement>('button[title="Aumenta"]');
    if (!more) throw new Error('no button to add one');
    fireEvent.click(more);
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi (2)' }));
    const added = store().devices.slice(-2).map(d => d.ip);
    expect(added).toEqual(['192.168.10.4', '192.168.10.5']);
  });
});

describe('the layout and a device on DHCP', () => {
  it('lays it out by its cables, as any other: under the switch it is cabled to', () => {
    const { devices, connections, areas } = store();
    const laid = arrangeDrawing({ devices, connections, areas }).devices;
    const y = (label: string) => laid.find(d => d.label === label)?.position.y ?? Number.NaN;
    expect(y('PC-1')).toBeGreaterThan(y('SW-Office'));
    expect(y('PC-1')).toBe(y('PC-2'));
    // what the layout hands back is the drawing as it is kept
    expect(laid.find(d => d.label === 'PC-1')).toMatchObject({ ip: '', nics: [{ dhcp: true, ip: '' }] });
  });

  it('with its cable gone, the automatic connection takes it to the nearest switch, as any other', () => {
    // (it has no address of its own to tell its network by)
    const { devices, connections, connectionCounter } = store();
    const pc = named('PC-1');
    const rest = connections.filter(c => c.source !== pc.id && c.target !== pc.id);
    const { connections: added, left } = connectLooseDevices(devices, rest, connectionCounter);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ source: named('SW-Office').id, target: pc.id, type: 'access' });
    expect(left).toEqual([]);
  });
});
