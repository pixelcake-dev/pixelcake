/**
 * The drawing never keeps an address on a card that takes its own from DHCP:
 * whatever way a device comes into the store, such a card is kept empty, and
 * the device-level mirror of a first card on DHCP with it. So a leased
 * address can never be mistaken for one written by hand, not even if what
 * the engine worked out is handed back to the store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStore } from './networkStore';
import { resolveDhcp } from '@/engine';
import { device, host, link, nic, port, switchWith } from '@/test/networkFixtures';
import type { NetworkDevice } from '@/types';

const MASK = '255.255.255.0';
const store = () => useNetworkStore.getState();
const named = (label: string) => {
  const found = store().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

/** A card on DHCP that still carries an address, as a careless hand or an old file may leave it */
const staleCard = () => nic({ dhcp: true, ip: '192.168.1.77', subnet: MASK, gateway: '192.168.1.1' });
const stale = (label: string): NetworkDevice =>
  device({ id: label.toLowerCase(), label, ip: '192.168.1.77', gateway: '192.168.1.1', nics: [staleCard()] });

const EMPTY_CARD = { dhcp: true, ip: '', subnet: '', gateway: '' };

function expectEmpty(label: string) {
  expect(named(label).nics?.[0]).toMatchObject(EMPTY_CARD);
  expect(named(label)).toMatchObject({ ip: '', gateway: '' });
}

beforeEach(() => {
  localStorage.clear();
  store().clearAllDevices();
});

describe('a card on DHCP in the store', () => {
  it('is kept empty when its device is added', () => {
    store().addDevice(stale('PC'));
    expectEmpty('PC');
  });

  it('is kept empty when a drawing is loaded, or put on screen as a canvas', () => {
    store().loadTopology([stale('PC')], []);
    expectEmpty('PC');

    store().replaceCanvas('canvas-9', {
      devices: [stale('Laptop')],
      connections: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      deviceCounter: 1,
      connectionCounter: 0,
    });
    expectEmpty('Laptop');
  });

  it('is emptied when a card with an address is switched to DHCP', () => {
    store().loadTopology([host('pc', '192.168.1.10', '192.168.1.1', { label: 'PC' })], []);
    const pc = named('PC');
    store().updateDevice(pc.id, { nics: pc.nics?.map(card => ({ ...card, dhcp: true })) });
    expectEmpty('PC');
  });

  it('keeps the card written by hand next to it as it is', () => {
    const two = device({
      id: 'srv',
      label: 'Srv',
      ip: '10.0.0.5',
      nics: [nic({ ip: '10.0.0.5', gateway: '10.0.0.1' }), { ...staleCard(), id: 'nic-2', name: 'eth1' }],
    });
    store().loadTopology([two], []);
    expect(named('Srv').nics).toMatchObject([{ ip: '10.0.0.5', gateway: '10.0.0.1' }, EMPTY_CARD]);
    expect(named('Srv')).toMatchObject({ ip: '10.0.0.5', gateway: '10.0.0.1' });
  });

  it('is emptied again if what the engine worked out is written back', () => {
    store().loadTopology(
      [
        device({ id: 'pc', label: 'PC', nics: [nic({ dhcp: true, subnet: '' })] }),
        switchWith('sw', [port(1), port(2)], { label: 'SW' }),
        device({
          id: 'r',
          label: 'R',
          type: 'Router',
          ports: [port(1, { ip: '192.168.1.1', subnet: MASK, dhcpServer: { start: '192.168.1.100', end: '192.168.1.110' } })],
        }),
      ],
      [link('pc', 'sw', { sourceNic: 'nic-1', targetPort: 1 }), link('sw', 'r', { sourcePort: 2, targetPort: 1 })]
    );
    const { devices, connections } = store();
    const leased = resolveDhcp({ devices, connections }).topology.devices.find(d => d.label === 'PC');
    expect(leased).toMatchObject({ ip: '192.168.1.100', nics: [{ ip: '192.168.1.100', gateway: '192.168.1.1' }] });

    // the device as the engine sees it, saved as if it were the drawing
    store().updateDevice(named('PC').id, { ...leased });
    expectEmpty('PC');
    // and the engine still gives it the same address
    const again = store();
    expect(resolveDhcp({ devices: again.devices, connections: again.connections }).leases).toMatchObject([
      { ip: '192.168.1.100' },
    ]);
  });
});
