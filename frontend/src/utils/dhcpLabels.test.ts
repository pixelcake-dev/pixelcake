/**
 * The Italian words for DHCP: the address shown for a device, where a lease
 * comes from, why a card has none, what is wrong with a pool as typed.
 */

import { describe, it, expect } from 'vitest';
import type { DhcpPool, NetworkDevice } from '@/types';
import { listInterfaces, poolProblem, resolveDhcp } from '@/engine';
import type { Topology } from '@/engine';
import { device, host, link, nic, port, switchWith, topo } from '@/test/networkFixtures';
import {
  BLANK_POOL_ERROR,
  NO_LEASE_LABEL,
  cardLeaseText,
  firstPoolProblem,
  isBlankPool,
  leaseText,
  nicPoolProblemText,
  poolProblemLabel,
  poolProblemText,
  portPoolProblemText,
  serverLabel,
  shownAddress,
  tidyPool,
  unservedText,
} from './dhcpLabels';

const MASK = '255.255.255.0';
const POOL: DhcpPool = { start: '192.168.1.100', end: '192.168.1.100' };

const client = (id: string, overrides: Partial<NetworkDevice> = {}) =>
  device({ id, label: id.toUpperCase(), nics: [nic({ dhcp: true, subnet: '' })], ...overrides });

/**
 *   A (dhcp) ─┐
 *   B (dhcp) ─┼─ SW ── port 1  R
 *   C .50   ──┘
 */
function lab(pool: DhcpPool | null = POOL, more: NetworkDevice[] = []): Topology {
  return topo(
    [
      client('a'),
      client('b'),
      host('c', '192.168.1.50', '192.168.1.1', { label: 'C' }),
      switchWith('sw', [port(1), port(2), port(3), port(4), port(5)], { label: 'SW' }),
      device({
        id: 'r',
        label: 'R',
        type: 'Router',
        ip: '192.168.1.1',
        ports: [port(1, { ip: '192.168.1.1', subnet: MASK, ...(pool ? { dhcpServer: pool } : {}) })],
      }),
      ...more,
    ],
    [
      link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('c', 'sw', { sourceNic: 'nic-1', targetPort: 3 }),
      link('sw', 'r', { sourcePort: 4, targetPort: 1 }),
      ...more.map(d => link(d.id, 'sw', { sourceNic: 'nic-1', targetPort: 5 })),
    ]
  );
}

const byId = (t: Topology, id: string) => t.devices.find(d => d.id === id) as NetworkDevice;
const whyNot = (t: Topology, id: string) => {
  const dhcp = resolveDhcp(t);
  const entry = dhcp.unserved.find(u => u.deviceId === id);
  if (!entry) throw new Error(`${id} is served`);
  return unservedText(entry, dhcp);
};

describe('the address shown for a device', () => {
  it('is the leased one, marked, for a device whose first card is on DHCP', () => {
    const t = lab();
    expect(shownAddress(byId(t, 'a'), resolveDhcp(t))).toBe('192.168.1.100 · DHCP');
  });

  it('says so when the card got none', () => {
    const t = lab();
    expect(shownAddress(byId(t, 'b'), resolveDhcp(t))).toBe('DHCP: nessun indirizzo');
    expect(NO_LEASE_LABEL).toBe('DHCP: nessun indirizzo');
  });

  it('is the one written by hand for everybody else, empty when there is none', () => {
    const t = lab();
    const dhcp = resolveDhcp(t);
    expect(shownAddress(byId(t, 'c'), dhcp)).toBe('192.168.1.50');
    expect(shownAddress(byId(t, 'r'), dhcp)).toBe('192.168.1.1');
    expect(shownAddress(device({ id: 'x', nics: [nic()] }), dhcp)).toBe('');
    // a second card on DHCP does not change what the device is shown with
    const two = device({ id: 'y', ip: '10.0.0.5', nics: [nic({ ip: '10.0.0.5' }), nic({ id: 'nic-2', dhcp: true })] });
    expect(shownAddress(two, dhcp)).toBe('10.0.0.5');
  });
});

describe('where a lease comes from', () => {
  it('names the device and its interface, a port or a card', () => {
    const t = lab();
    const dhcp = resolveDhcp(t);
    expect(serverLabel(dhcp.pools[0])).toBe('R, porta 1');
    expect(leaseText(dhcp.leases[0], dhcp)).toBe('192.168.1.100 da R, porta 1');
    expect(cardLeaseText(dhcp, 'a', 'nic-1')).toEqual({ leased: true, text: '192.168.1.100 da R, porta 1' });

    const server = host('dh', '192.168.1.5', '', { label: 'DH', type: 'Server' });
    server.nics![0].dhcpServer = { start: '192.168.1.200', end: '192.168.1.210' };
    const withServer = resolveDhcp(lab(null, [server]));
    expect(leaseText(withServer.leases[0], withServer)).toBe('192.168.1.200 da DH, eth0');
  });

  it('is the bare address when the pool is not in what it is asked of', () => {
    const dhcp = resolveDhcp(lab());
    const elsewhere = { ...dhcp.leases[0], server: { deviceId: 'gone', interfaceKey: 'port:1' } };
    expect(leaseText(elsewhere, dhcp)).toBe('192.168.1.100');
  });
});

describe('why a card has no address', () => {
  it('no server on its network', () => {
    expect(whyNot(lab(null), 'a')).toBe('nessun server DHCP risponde sulla sua rete');
    expect(cardLeaseText(resolveDhcp(lab(null)), 'a', 'nic-1')).toEqual({
      leased: false,
      text: 'Nessun indirizzo: nessun server DHCP risponde sulla sua rete',
    });
  });

  it('the pool is used up: its one address, its many, or none to give at all', () => {
    expect(whyNot(lab(), 'b')).toBe('l\'intervallo di R, porta 1 è esaurito: il suo unico indirizzo è già preso');
    // .50 is C's: two addresses in the range, A takes the other
    expect(whyNot(lab({ start: '192.168.1.50', end: '192.168.1.51' }), 'b')).toBe(
      'l\'intervallo di R, porta 1 è esaurito: 2 indirizzi, tutti presi'
    );
    expect(whyNot(lab({ start: '192.168.1.0', end: '192.168.1.0' }), 'a')).toBe(
      'l\'intervallo di R, porta 1 non ha indirizzi da assegnare'
    );
  });

  it('the pool cannot work as written', () => {
    expect(whyNot(lab({ start: '192.168.1.120', end: '192.168.1.110' }), 'a')).toBe(
      'l\'intervallo di R, porta 1 non è utilizzabile: ' +
        'l\'ultimo indirizzo (192.168.1.110) viene prima del primo (192.168.1.120)'
    );
  });

  it('the card is disabled, has no cable, or belongs to a router', () => {
    const off = lab();
    byId(off, 'a').nics![0].enabled = false;
    expect(whyNot(off, 'a')).toBe('la scheda è disabilitata');

    const loose = lab();
    loose.connections.splice(0, 1);
    expect(whyNot(loose, 'a')).toBe('alla scheda non è collegato nessun cavo');

    const routes = lab(POOL, [device({ id: 'x', label: 'X', type: 'Router', nics: [nic({ dhcp: true })] })]);
    expect(whyNot(routes, 'x')).toBe('un router o un firewall non prende i propri indirizzi dal DHCP');
  });

  it('the cable to the server is not attached to one of its ports', () => {
    const t = lab();
    delete t.connections[3].targetPort;
    expect(whyNot(t, 'a')).toBe(
      'il cavo verso R non è assegnato a una delle sue porte: non si sa quale intervallo risponde'
    );
  });

  it('has words even when the pool a cause is about is not there to be named', () => {
    const dhcp = resolveDhcp(lab());
    const gone = { deviceId: 'gone', interfaceKey: 'port:1' };
    const card = { deviceId: 'b', nicId: 'nic-1', reason: '' };
    expect(unservedText({ ...card, cause: 'used-up', server: gone }, dhcp)).toBe('l\'intervallo che risponde è esaurito');
    expect(unservedText({ ...card, cause: 'unusable', server: gone }, dhcp)).toBe(
      'l\'intervallo che risponde non è utilizzabile'
    );
    expect(unservedText({ ...card, cause: 'unattached' }, dhcp)).toBe(
      'il cavo verso il server non è assegnato a una delle sue porte: non si sa quale intervallo risponde'
    );
    // a card nobody has anything to say about
    expect(cardLeaseText(dhcp, 'c', 'nic-1')).toEqual({ leased: false, text: 'Nessun indirizzo' });
  });
});

describe('what is wrong with a pool as typed', () => {
  const router = (lan = {}) =>
    device({ id: 'r', label: 'R', type: 'Router', ports: [port(1, { ip: '192.168.1.1', subnet: MASK, ...lan })] });
  const problem = (pool: DhcpPool, lan = {}) => {
    const r = router(lan);
    return poolProblemText(r, listInterfaces(r)[0], pool);
  };

  it('nothing, when it is fine or was never typed', () => {
    expect(problem({ start: '192.168.1.100', end: '192.168.1.199' })).toBeUndefined();
    expect(problem({ start: '', end: '' })).toBeUndefined();
    expect(problem({ start: ' ', end: '', gateway: ' ' })).toBeUndefined();
  });

  it('is said in Italian, about the port or about the card', () => {
    expect(problem({ start: '192.168.1.100', end: '' })).toBe('servono il primo e l\'ultimo indirizzo');
    expect(problem({ start: '', end: '', gateway: '192.168.1.1' })).toBe('servono il primo e l\'ultimo indirizzo');
    expect(problem({ start: 'x', end: '192.168.1.199' })).toBe('"x" non è un indirizzo IPv4 valido');
    expect(problem({ start: '10.0.0.1', end: '10.0.0.9' })).toBe(
      '10.0.0.1 è fuori dalla rete della porta (192.168.1.0/24)'
    );
    expect(problem({ start: '192.168.1.9', end: '192.168.1.1' })).toBe(
      'l\'ultimo indirizzo (192.168.1.1) viene prima del primo (192.168.1.9)'
    );
    expect(problem(POOL, { ip: undefined })).toBe(
      'la porta non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete'
    );

    const card = nic({ ip: '192.168.1.5' });
    expect(nicPoolProblemText(card, { start: '10.0.0.1', end: '10.0.0.9' })).toBe(
      '10.0.0.1 è fuori dalla rete della scheda (192.168.1.0/24)'
    );
    expect(nicPoolProblemText(nic(), POOL)).toBe(
      'la scheda non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete'
    );
    expect(nicPoolProblemText(nic({ dhcp: true }), POOL)).toBe(
      'la scheda prende il proprio indirizzo dal DHCP: non può anche assegnarne'
    );
    expect(nicPoolProblemText(card, POOL)).toBeUndefined();
  });

  it('is checked on what is typed, spaces aside', () => {
    expect(problem({ start: ' 192.168.1.100 ', end: ' 192.168.1.199 ', gateway: ' 192.168.1.1 ' })).toBeUndefined();
    expect(portPoolProblemText('Router', port(1, { ip: '192.168.1.1' }), POOL)).toBeUndefined();
    expect(portPoolProblemText('Router', port(1), POOL)).toContain('la porta non ha un indirizzo');
  });

  it('the label of a problem is the same words, given the problem the engine found', () => {
    const r = router();
    const [iface] = listInterfaces(r);
    const pool = { start: '192.168.1.9', end: '192.168.1.1' };
    const found = poolProblem(r, iface, pool);
    expect(found && poolProblemLabel(found, iface, pool)).toBe(problem(pool));
  });

  it('a pool is kept tidy: trimmed, and with a gateway only when one was typed', () => {
    expect(tidyPool({ start: ' 192.168.1.100 ', end: '192.168.1.199 ', gateway: '  ' })).toEqual({
      start: '192.168.1.100',
      end: '192.168.1.199',
    });
    expect(tidyPool({ start: '192.168.1.100', end: '192.168.1.199', gateway: ' 192.168.1.1 ' })).toEqual({
      start: '192.168.1.100',
      end: '192.168.1.199',
      gateway: '192.168.1.1',
    });
    expect(isBlankPool({ start: '', end: '' })).toBe(true);
    expect(isBlankPool({ start: '', end: '192.168.1.1' })).toBe(false);
    expect(isBlankPool({ start: '192.168.1.1', end: '' })).toBe(false);
    expect(isBlankPool({ start: '', end: '', gateway: '192.168.1.1' })).toBe(false);
    expect(BLANK_POOL_ERROR).toContain('togli la spunta');
  });

  it('the first pool of a device that cannot work is named by its port or its card', () => {
    const good = router({ dhcpServer: POOL });
    expect(firstPoolProblem(good)).toBeUndefined();
    expect(firstPoolProblem(router())).toBeUndefined();

    const bad = device({
      id: 'r',
      type: 'Router',
      ports: [
        port(1, { ip: '192.168.1.1', subnet: MASK, dhcpServer: POOL }),
        port(2, { ip: '10.0.0.1', subnet: MASK, dhcpServer: POOL }),
        port(3, { dhcpServer: POOL }),
      ],
    });
    expect(firstPoolProblem(bad)).toBe(
      'Porta 2, server DHCP: 192.168.1.100 è fuori dalla rete della porta (10.0.0.0/24)'
    );
    const server = device({ id: 's', type: 'Server', nics: [nic({ name: 'ens3', dhcpServer: POOL })] });
    expect(firstPoolProblem(server)).toBe(
      'Scheda ens3, server DHCP: la scheda non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete'
    );
  });
});
