/**
 * The DNS server of the project and the devices that are already drawn:
 * which of them ask nobody, and what giving them the server writes.
 */

import { describe, it, expect } from 'vitest';
import { lookup, withLeases } from '@/engine';
import { device, host, link, nic, port, switchWith } from '@/test/networkFixtures';
import { devicesWithoutDns, isEndDeviceKind, withDnsServer } from './defaultDns';

const MASK = '255.255.255.0';
const DNS = '192.168.1.53';

/**
 *   pc-a .11 (asks nobody)        pc-b .12 (asks 192.168.1.99)
 *   laptop (dhcp, lease with DNS) tablet (dhcp, lease without)
 *   srv .53 (records)             two-cards: eth0 dhcp, eth1 by hand
 *   all on one switch, with a router handing out .100–.199 and, with them,
 *   the DNS server .53
 */
function lab(poolHandsOutDns = true) {
  const devices = [
    host('pc-a', '192.168.1.11'),
    host('pc-b', '192.168.1.12', '', { nics: [nic({ ip: '192.168.1.12', dns: '192.168.1.99' })] }),
    device({ id: 'laptop', subnet: '', nics: [nic({ dhcp: true, subnet: '' })] }),
    host('srv', DNS, '', {
      type: 'Server',
      dnsRecords: [{ id: 'record-1', name: 'www.azienda.example', address: '192.168.1.80' }],
    }),
    switchWith('sw', [port(1), port(2), port(3), port(4), port(5)]),
    device({
      id: 'router',
      type: 'Router',
      ip: '192.168.1.1',
      ports: [
        port(1, {
          ip: '192.168.1.1',
          subnet: MASK,
          dhcpServer: {
            start: '192.168.1.100',
            end: '192.168.1.199',
            ...(poolHandsOutDns ? { dns: DNS } : {}),
          },
        }),
      ],
    }),
  ];
  const connections = [
    link('pc-a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
    link('pc-b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
    link('laptop', 'sw', { sourceNic: 'nic-1', targetPort: 3 }),
    link('srv', 'sw', { sourceNic: 'nic-1', targetPort: 4 }),
    link('sw', 'router', { sourcePort: 5, targetPort: 1 }),
  ];
  return { devices, connections };
}

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);

describe('isEndDeviceKind', () => {
  it.each([
    ['PC', 'tpl-pc'],
    ['PC', 'tpl-printer'],
    ['Server', 'tpl-server'],
    ['Server', 'tpl-dnsserver'],
    ['Database', 'tpl-nas'],
    ['Sensore', undefined],
  ])('%s (%s) is an end device', (type, templateId) => {
    expect(isEndDeviceKind(type, templateId)).toBe(true);
  });

  it.each([
    ['Router', 'tpl-router'],
    ['Firewall', 'tpl-firewall'],
    ['Switch', 'tpl-switch'],
    ['AccessPoint', 'tpl-accesspoint'],
    ['AccessPoint', 'tpl-iotgateway'],
    ['LoadBalancer', 'tpl-loadbalancer'],
    ['Cloud', 'tpl-cloud'],
  ])('%s (%s) carries the traffic of others: it is not', (type, templateId) => {
    expect(isEndDeviceKind(type, templateId)).toBe(false);
  });
});

describe('devicesWithoutDns', () => {
  it('lists the devices with a card written by hand that names no server', () => {
    const { devices, connections } = lab();
    // pc-b has one, the laptop gets one with its lease, the switch and the
    // router have no cards
    expect(ids(devicesWithoutDns(devices, connections))).toEqual(['pc-a', 'srv']);
  });

  it('leaves a device whose cards are all on DHCP alone, even when its lease brings no server', () => {
    const { devices, connections } = lab(false);
    // (the laptop has its address, and with it no server)
    const laptop = withLeases({ devices, connections }).devices.find((d) => d.id === 'laptop');
    expect(laptop?.nics?.[0]).toMatchObject({ dhcp: true, ip: '192.168.1.100' });
    expect(laptop?.nics?.[0].dns).toBeUndefined();
    expect(ids(devicesWithoutDns(devices, connections))).toEqual(['pc-a', 'srv']);
  });

  it('a device with two cards has a server when either names one, by hand or with a lease', () => {
    const { devices, connections } = lab();
    const twoCards = device({
      id: 'two-cards',
      subnet: '',
      nics: [
        nic({ id: 'nic-1', name: 'eth0', dhcp: true, subnet: '' }),
        nic({ id: 'nic-2', name: 'eth1', ip: '10.0.0.5' }),
      ],
    });
    const cabled = [...connections, link('two-cards', 'sw', { sourceNic: 'nic-1', targetPort: 6 })];
    const sw = switchWith('sw', [port(1), port(2), port(3), port(4), port(5), port(6)]);
    const all = [...devices.filter((d) => d.id !== 'sw'), sw, twoCards];
    // leased with a server: it has one
    expect(ids(devicesWithoutDns(all, cabled))).not.toContain('two-cards');
    // not cabled: no lease, and a card by hand that names nobody
    expect(ids(devicesWithoutDns(all, connections))).toContain('two-cards');
  });

  it('what carries traffic for others is never among them, card or not', () => {
    const carriers = [
      host('internet', '203.0.113.1', '', { type: 'Cloud', templateId: 'tpl-cloud', label: 'Internet' }),
      host('ap', '192.168.1.3', '', { type: 'AccessPoint' }),
      host('lb', '192.168.1.4', '', { type: 'LoadBalancer' }),
    ];
    expect(devicesWithoutDns([...carriers, host('pc', '192.168.1.11')], []).map((d) => d.id)).toEqual(['pc']);
  });

  it('a disabled card that names a server does not count: the device asks nobody', () => {
    const pc = host('pc', '192.168.1.11', '', {
      nics: [nic({ ip: '192.168.1.11', dns: DNS, enabled: false })],
    });
    expect(ids(devicesWithoutDns([pc], []))).toEqual(['pc']);
  });
});

describe('withDnsServer', () => {
  it('writes the server on the first card addressed by hand, and on that one only', () => {
    const twoCards = device({
      id: 'two-cards',
      nics: [
        nic({ id: 'nic-1', name: 'eth0', dhcp: true, subnet: '' }),
        nic({ id: 'nic-2', name: 'eth1', ip: '10.0.0.5' }),
        nic({ id: 'nic-3', name: 'eth2', ip: '10.0.1.5' }),
      ],
    });
    const given = withDnsServer(twoCards, DNS);
    expect(given.nics?.map((card) => card.dns)).toEqual([undefined, DNS, undefined]);
    expect(given.nics?.[0]).toBe(twoCards.nics?.[0]);
    // the device handed in is not touched
    expect(twoCards.nics?.[1].dns).toBeUndefined();
  });

  it('gives back the same device when it has no card to write on', () => {
    const laptop = device({ id: 'laptop', nics: [nic({ dhcp: true })] });
    const sw = switchWith('sw', [port(1)]);
    expect(withDnsServer(laptop, DNS)).toBe(laptop);
    expect(withDnsServer(sw, DNS)).toBe(sw);
  });

  it('given the server, the device resolves a name it could not before', () => {
    const { devices, connections } = lab();
    const before = lookup({ devices, connections }, 'pc-a', 'www.azienda.example');
    expect(before.address).toBeUndefined();

    const after = devices.map((d) => (d.id === 'pc-a' ? withDnsServer(d, DNS) : d));
    expect(lookup({ devices: after, connections }, 'pc-a', 'www.azienda.example').address).toBe(
      '192.168.1.80'
    );
    expect(ids(devicesWithoutDns(after, connections))).toEqual(['srv']);
  });
});
