/**
 * A new device is proposed an address nobody has: not one written by hand,
 * and not one a card on DHCP is leased. One by one (AddDeviceModal), in bulk
 * (BulkAddDeviceModal), and when the layout groups devices by their network.
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
import { applySubnetGroupedLayout, getConnectionType } from '@/utils/autoLayout';
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
  it('groups it with the network of the address it is leased', () => {
    // a second building, so that there are two groups to tell apart
    store().addDevice({
      type: 'PC',
      label: 'PC-Altrove',
      ip: '10.20.0.5',
      subnet: '255.255.255.0',
      gateway: '10.20.0.1',
      position: { x: 0, y: 0 },
    });
    const { devices, connections } = store();
    const laid = applySubnetGroupedLayout(devices, connections).devices;
    const x = (label: string) => laid.find(d => d.label === label)?.position.x ?? Number.NaN;
    // PC-1 is drawn among the devices of 192.168.x.x, left of the other building
    expect(x('PC-1')).toBeLessThan(x('PC-Altrove'));
    expect(Math.abs(x('PC-1') - x('PC-2'))).toBeLessThan(x('PC-Altrove') - x('PC-2'));
    // what the layout hands back is the drawing as it is kept
    expect(laid.find(d => d.label === 'PC-1')).toMatchObject({ ip: '', nics: [{ dhcp: true, ip: '' }] });
  });

  it('does not take a cable to it for a line between two buildings', () => {
    // (it has no address of its own to tell a building by)
    expect(getConnectionType(named('SW-Office'), named('PC-1'))).toBe(
      getConnectionType(named('SW-Office'), named('PC-2'))
    );
    expect(getConnectionType(named('SW-Office'), named('PC-1'))).not.toBe('backbone');
  });
});
