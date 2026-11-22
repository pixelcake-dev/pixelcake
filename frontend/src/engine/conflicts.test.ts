/**
 * An address on two devices at once: which pairs collide, and what a
 * question to or from that address answers.
 */

import { describe, it, expect } from 'vitest';
import type { NetworkDevice } from '@/types';
import { device, forward, host, link, nic, port, switchWith, topo } from '@/test/networkFixtures';
import type { Topology } from './types';
import { addressConflicts, addressesMeet, conflictOf, conflictReason } from './conflicts';
import { traceRoute } from './trace';
import { planAndEvaluateFlow } from './flows';

const MASK = '255.255.255.0';

/** Who `id` shares `ip` with, by name; undefined when it is in no conflict there */
const sharedWith = (t: Topology, id: string, ip: string) =>
  conflictOf(t, id, ip)?.map((d) => d.label);

/**
 *   PC-1 ─┐
 *  Srv-1 ─┼─ SW-1 ── R-1 (192.168.1.1)
 *  Srv-2 ─┘          (Srv-2 and Srv-1 have 192.168.1.10)
 */
function office(extra: NetworkDevice[] = [], cabled = true): Topology {
  return topo(
    [
      host('pc1', '192.168.1.20', '192.168.1.1', { label: 'PC-1' }),
      host('srv1', '192.168.1.10', '192.168.1.1', { label: 'Srv-1', type: 'Server' }),
      host('srv2', '192.168.1.10', '192.168.1.1', { label: 'Srv-2', type: 'Server' }),
      switchWith('sw1', [port(1), port(2), port(3), port(4)], { label: 'SW-1' }),
      device({ id: 'r1', label: 'R-1', type: 'Router', ip: '192.168.1.1', ports: [port(1, { ip: '192.168.1.1', subnet: MASK })] }),
      ...extra,
    ],
    [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 1 }),
      link('srv1', 'sw1', { sourceNic: 'nic-1', targetPort: 2 }),
      ...(cabled ? [link('srv2', 'sw1', { sourceNic: 'nic-1', targetPort: 3 })] : []),
      link('r1', 'sw1', { sourcePort: 1, targetPort: 4 }),
    ]
  );
}

/**
 * Two offices behind their own router, each with a server at 192.168.1.10,
 * joined only through the Internet:
 *
 *  Srv-A ── R-A ── Internet ── R-B ── Srv-B
 */
function twoOffices(internetLabel = 'Internet', publicB = '198.51.100.2'): Topology {
  return topo(
    [
      host('srv-a', '192.168.1.10', '192.168.1.1', { label: 'Srv-A', type: 'Server' }),
      device({
        id: 'r-a',
        label: 'R-A',
        type: 'Router',
        ports: [port(1, { ip: '192.168.1.1', subnet: MASK }), port(2, { ip: '203.0.113.2', subnet: MASK, nat: true })],
      }),
      device({ id: 'net', label: internetLabel, type: 'Cloud', templateId: 'tpl-cloud' }),
      device({
        id: 'r-b',
        label: 'R-B',
        type: 'Router',
        ports: [port(1, { ip: '192.168.1.1', subnet: MASK }), port(2, { ip: publicB, subnet: MASK, nat: true })],
      }),
      host('srv-b', '192.168.1.10', '192.168.1.1', { label: 'Srv-B', type: 'Server' }),
    ],
    [
      link('srv-a', 'r-a', { sourceNic: 'nic-1', targetPort: 1 }),
      link('r-a', 'net', { sourcePort: 2 }),
      link('net', 'r-b', { targetPort: 2 }),
      link('r-b', 'srv-b', { sourcePort: 1, targetNic: 'nic-1' }),
    ]
  );
}

describe('which addresses are in conflict', () => {
  it('two servers on one switch with one address: each names the other', () => {
    const t = office();
    expect(sharedWith(t, 'srv1', '192.168.1.10')).toEqual(['Srv-1', 'Srv-2']);
    expect(sharedWith(t, 'srv2', '192.168.1.10')).toEqual(['Srv-1', 'Srv-2']);
    // the others are not in conflict
    expect(sharedWith(t, 'pc1', '192.168.1.20')).toBeUndefined();
    expect(addressConflicts(t).list.map((c) => [c.ip, c.devices.map((d) => d.label)])).toEqual([
      ['192.168.1.10', ['Srv-1', 'Srv-2']],
    ]);
  });

  it('a copy not cabled yet collides with its original: it is to be plugged in next to it', () => {
    const t = office([], false);
    expect(sharedWith(t, 'srv2', '192.168.1.10')).toEqual(['Srv-1', 'Srv-2']);
  });

  it('a router port, a switch or a device-level address collide as a card does', () => {
    const t = office([
      device({ id: 'r2', label: 'R-2', type: 'Router', ports: [port(1, { ip: '192.168.1.1', subnet: MASK })] }),
      switchWith('sw2', [port(1)], { label: 'SW-2', ip: '192.168.1.20' }),
    ]);
    expect(sharedWith(t, 'r1', '192.168.1.1')).toEqual(['R-1', 'R-2']);
    expect(sharedWith(t, 'sw2', '192.168.1.20')).toEqual(['PC-1', 'SW-2']);
  });

  it('a private address on both sides of the Internet is no conflict: each is in a network of its own', () => {
    const t = twoOffices();
    expect(sharedWith(t, 'srv-a', '192.168.1.10')).toBeUndefined();
    expect(sharedWith(t, 'r-a', '192.168.1.1')).toBeUndefined();
    expect(addressConflicts(t).list).toEqual([]);
  });

  it('a public address is in conflict wherever it is, the Internet between or not', () => {
    const t = twoOffices('Internet', '203.0.113.2');
    expect(sharedWith(t, 'r-a', '203.0.113.2')).toEqual(['R-A', 'R-B']);
  });

  it('two Internet symbols are one Internet: the offices behind each are still apart', () => {
    const t = twoOffices();
    const split: Topology = {
      devices: [...t.devices, device({ id: 'net2', label: 'Internet B', type: 'Cloud', templateId: 'tpl-cloud' })],
      connections: t.connections.map((c) => (c.source === 'net' && c.target === 'r-b' ? { ...c, source: 'net2' } : c)),
    };
    expect(sharedWith(split, 'srv-a', '192.168.1.10')).toBeUndefined();
  });

  it('a cloud that is not the Internet (a carrier network) carries private addresses: they collide', () => {
    const t = twoOffices('MPLS');
    expect(sharedWith(t, 'srv-a', '192.168.1.10')).toEqual(['Srv-A', 'Srv-B']);
  });

  it('0.0.0.0, loopback addresses, empty fields, what is not an address and an interface switched off do not count', () => {
    const t = topo([
      host('a', '0.0.0.0', '', { label: 'A' }),
      host('b', '0.0.0.0', '', { label: 'B' }),
      host('c', '127.0.0.1', '', { label: 'C' }),
      host('d', '127.0.0.1', '', { label: 'D' }),
      host('e', 'not-an-ip', '', { label: 'E' }),
      host('f', 'not-an-ip', '', { label: 'F' }),
      host('g', '', '', { label: 'G' }),
      host('h', '', '', { label: 'H' }),
      host('i', '10.0.0.5', '', { label: 'I' }),
      device({ id: 'j', label: 'J', ip: '10.0.0.5', nics: [nic({ ip: '10.0.0.5', enabled: false })] }),
    ]);
    expect(addressConflicts(t).list).toEqual([]);
  });

  it('a device whose own address is the one of its card, or of its port, holds it once', () => {
    const t = office();
    // R-1 has 192.168.1.1 as its own address and on port 1
    expect(sharedWith(t, 'r1', '192.168.1.1')).toBeUndefined();
  });

  it('a lease never collides: a DHCP server hands out only addresses nobody has', () => {
    const router = device({
      id: 'r1',
      label: 'R-1',
      type: 'Router',
      ports: [port(1, { ip: '192.168.1.1', subnet: MASK, dhcpServer: { start: '192.168.1.10', end: '192.168.1.20' } })],
    });
    const t = topo(
      [
        router,
        switchWith('sw1', [port(1), port(2), port(3)], { label: 'SW-1' }),
        // written by hand inside the range
        host('srv1', '192.168.1.10', '192.168.1.1', { label: 'Srv-1', type: 'Server' }),
        device({ id: 'pc1', label: 'PC-1', nics: [nic({ dhcp: true })] }),
      ],
      [
        link('r1', 'sw1', { sourcePort: 1, targetPort: 1 }),
        link('srv1', 'sw1', { sourceNic: 'nic-1', targetPort: 2 }),
        link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 3 }),
      ]
    );
    expect(addressConflicts(t).list).toEqual([]);
    // (the PC was given the next address, and is reached at it)
    expect(planAndEvaluateFlow('ping', 'srv1', 'pc1', t).verdict).toBe('success');
  });

  it('three devices with one address: each names all three', () => {
    const t = office([host('srv3', '192.168.1.10', '', { label: 'Srv-3', type: 'Server' })]);
    expect(sharedWith(t, 'srv3', '192.168.1.10')).toEqual(['Srv-1', 'Srv-2', 'Srv-3']);
  });

  it('the reason names the address and the devices', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((label) => device({ id: label, label }));
    expect(conflictReason('10.0.0.5', [a, b])).toBe(
      'address conflict: 10.0.0.5 is on both A and B, so the answer cannot be trusted'
    );
    expect(conflictReason('10.0.0.5', [a, b, c])).toBe(
      'address conflict: 10.0.0.5 is on A, B and C, so the answer cannot be trusted'
    );
  });
});

describe('a question to or from an address in conflict', () => {
  const CONFLICT = 'address conflict: 192.168.1.10 is on both Srv-1 and Srv-2, so the answer cannot be trusted';

  it('to it: the question ends with the conflict, whichever of the two is asked', () => {
    const t = office();
    for (const target of ['srv1', 'srv2']) {
      const trace = traceRoute('pc1', target, t);
      expect(trace).toMatchObject({ verdict: 'error', failureReason: CONFLICT, hops: [] });
      const ping = planAndEvaluateFlow('ping', 'pc1', target, t);
      expect(ping).toMatchObject({ verdict: 'error', failureReason: `request: ${CONFLICT}` });
      expect(planAndEvaluateFlow('web', 'pc1', target, t).failureReason).toBe(`HTTP request: ${CONFLICT}`);
    }
  });

  it('to a copy not cabled yet: the conflict, before the missing cable', () => {
    const t = office([], false);
    expect(traceRoute('pc1', 'srv2', t)).toMatchObject({ verdict: 'error', failureReason: CONFLICT });
  });

  it('from it: the question ends with the conflict too', () => {
    const t = office();
    expect(traceRoute('srv1', 'pc1', t)).toMatchObject({ verdict: 'error', failureReason: CONFLICT });
    expect(planAndEvaluateFlow('ping', 'srv2', 'pc1', t).failureReason).toBe(`request: ${CONFLICT}`);
  });

  it('a device still pings itself: the packet does not leave it', () => {
    expect(planAndEvaluateFlow('ping', 'srv1', 'srv1', office()).verdict).toBe('success');
  });

  it('what does not go to the address, or come from it, is answered as before', () => {
    const t = office();
    expect(planAndEvaluateFlow('ping', 'pc1', 'r1', t).verdict).toBe('success');
  });

  it('a port forward to an address in conflict is dropped at the device that forwards', () => {
    const t = topo(
      [
        host('ext', '203.0.113.50', '203.0.113.1', { label: 'Ext' }),
        device({
          id: 'r1',
          label: 'R-1',
          type: 'Router',
          ports: [port(1, { ip: '203.0.113.1', subnet: MASK }), port(2, { ip: '192.168.1.1', subnet: MASK })],
          portForwards: [forward('web', 1, '192.168.1.10')],
        }),
        switchWith('sw1', [port(1), port(2), port(3)], { label: 'SW-1' }),
        host('srv1', '192.168.1.10', '192.168.1.1', { label: 'Srv-1', type: 'Server' }),
        host('srv2', '192.168.1.10', '192.168.1.1', { label: 'Srv-2', type: 'Server' }),
      ],
      [
        link('ext', 'r1', { sourceNic: 'nic-1', targetPort: 1 }),
        link('r1', 'sw1', { sourcePort: 2, targetPort: 1 }),
        link('srv1', 'sw1', { sourceNic: 'nic-1', targetPort: 2 }),
        link('srv2', 'sw1', { sourceNic: 'nic-1', targetPort: 3 }),
      ]
    );
    const trace = traceRoute('ext', 'r1', t, { service: 'web', targetIp: '203.0.113.1' });
    expect(trace.verdict).toBe('blocked');
    expect(trace.failureReason).toBe(CONFLICT);
    expect(trace.hops.at(-1)?.label).toBe('R-1');
  });

  it('once the copy has an address of its own, the conflict is gone', () => {
    const t = office();
    const changed: Topology = {
      ...t,
      devices: t.devices.map((d) =>
        d.id === 'srv2' ? { ...d, ip: '192.168.1.11', nics: [nic({ ip: '192.168.1.11', gateway: '192.168.1.1' })] } : d
      ),
    };
    expect(addressConflicts(changed).list).toEqual([]);
    expect(planAndEvaluateFlow('ping', 'pc1', 'srv1', changed).verdict).toBe('success');
    expect(planAndEvaluateFlow('ping', 'pc1', 'srv2', changed).verdict).toBe('success');
  });
});

describe('where two devices meet over an address', () => {
  it('is where a conflict would be: a private address not across the Internet, a public one everywhere', () => {
    const meet = addressesMeet(twoOffices());
    expect(meet('srv-a', 'srv-b', '192.168.1.10')).toBe(false);
    expect(meet('srv-a', 'r-a', '192.168.1.10')).toBe(true);
    expect(meet('srv-a', 'srv-b', '203.0.113.2')).toBe(true);
    // a device meets itself, and a carrier's network joins the two sides
    expect(meet('srv-a', 'srv-a', '192.168.1.10')).toBe(true);
    expect(addressesMeet(twoOffices('MPLS'))('srv-a', 'srv-b', '192.168.1.10')).toBe(true);
    // the very pairs the conflicts are counted on
    expect(addressConflicts(twoOffices()).list).toEqual([]);
    expect(addressConflicts(twoOffices('MPLS')).list.map((c) => c.ip)).toContain('192.168.1.10');
  });

  it('two devices not cabled to each other at all meet: one will be plugged in next to the other', () => {
    const t = office([], false);
    expect(addressesMeet(t)('srv1', 'srv2', '192.168.1.10')).toBe(true);
  });
});
