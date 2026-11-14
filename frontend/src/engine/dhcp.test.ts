/**
 * DHCP — which address a card set to "automatic" gets, from which server, and
 * what the rest of the engine makes of it.
 *
 * The network of nearly every test:
 *
 *   A (dhcp) ─┐
 *   B (dhcp) ─┼─ SW ── port 1  R  port 2 ── Srv
 *   C .101  ──┘     192.168.1.1   10.0.0.1   10.0.0.10
 *
 * R hands out 192.168.1.100–192.168.1.102 on port 1.
 */

import { describe, it, expect } from 'vitest';
import type { DhcpPool, NetworkConnection, NetworkDevice, Port } from '@/types';
import { device, host, link, nic, port, switchWith, topo } from '@/test/networkFixtures';
import type { Topology } from './types';
import { listInterfaces } from './interfaces';
import { traceRoute } from './trace';
import { planAndEvaluateFlow, traceToDevice } from './flows';
import { impactEndpoints } from './impact';
import { withFailures } from './failures';
import {
  leaseOf,
  noLeaseReason,
  poolAt,
  poolOf,
  poolProblem,
  resolveDhcp,
  servesDhcp,
  suggestedPool,
  unservedOf,
  withLeases,
} from './dhcp';

const MASK = '255.255.255.0';
const POOL: DhcpPool = { start: '192.168.1.100', end: '192.168.1.102' };

/** An end device whose one card takes its address from DHCP */
function client(id: string, overrides: Partial<NetworkDevice> = {}): NetworkDevice {
  return device({ id, label: id.toUpperCase(), nics: [nic({ dhcp: true, subnet: '' })], ...overrides });
}

interface LabOptions {
  pool?: DhcpPool | null;
  /** Settings of the router port that faces the clients */
  lan?: Partial<Port>;
  /** Ports of the switch: 1 A, 2 B, 3 C, 4 the router */
  switchPorts?: Port[];
  /** Extra devices and cables */
  more?: NetworkDevice[];
  moreLinks?: NetworkConnection[];
  a?: Partial<NetworkDevice>;
}

function lab(options: LabOptions = {}): Topology {
  const { pool = POOL, lan = {}, switchPorts, more = [], moreLinks = [], a = {} } = options;
  return topo(
    [
      client('a', a),
      client('b'),
      host('c', '192.168.1.101', '192.168.1.1', { label: 'C' }),
      switchWith('sw', switchPorts ?? [port(1), port(2), port(3), port(4), port(5), port(6)], { label: 'SW' }),
      device({
        id: 'r',
        label: 'R',
        type: 'Router',
        ip: '192.168.1.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK, ...(pool ? { dhcpServer: pool } : {}), ...lan }),
          port(2, { ip: '10.0.0.1', subnet: MASK }),
        ],
      }),
      host('srv', '10.0.0.10', '10.0.0.1', { label: 'Srv', type: 'Server', templateId: 'tpl-webserver' }),
      ...more,
    ],
    [
      link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('c', 'sw', { sourceNic: 'nic-1', targetPort: 3 }),
      link('sw', 'r', { sourcePort: 4, targetPort: 1 }),
      link('r', 'srv', { sourcePort: 2, targetNic: 'nic-1' }),
      ...moreLinks,
    ]
  );
}

const leasedIp = (t: Topology, id: string, nicId = 'nic-1') => leaseOf(resolveDhcp(t), id, nicId)?.ip;
const whyNot = (t: Topology, id: string, nicId = 'nic-1') => unservedOf(resolveDhcp(t), id, nicId);
const byId = (t: Topology, id: string) => {
  const found = t.devices.find(d => d.id === id);
  if (!found) throw new Error(`no device "${id}"`);
  return found;
};

describe('a lease', () => {
  it('goes to every card on DHCP in drawing order, the lowest address nobody has', () => {
    const resolution = resolveDhcp(lab());
    // .101 is written by hand on C: it is skipped
    expect(resolution.leases.map(lease => `${lease.deviceId} ${lease.ip}`)).toEqual([
      'a 192.168.1.100',
      'b 192.168.1.102',
    ]);
    expect(resolution.unserved).toEqual([]);
    expect(resolution.warnings).toEqual([]);
  });

  it('carries the mask of the interface that serves and, on a router, its address as gateway', () => {
    const t = lab({ lan: { ip: '192.168.1.1', subnet: '255.255.255.128' }, pool: { start: '192.168.1.100', end: '192.168.1.102' } });
    expect(leaseOf(resolveDhcp(t), 'a', 'nic-1')).toEqual({
      deviceId: 'a',
      nicId: 'nic-1',
      ip: '192.168.1.100',
      mask: '255.255.255.128',
      gateway: '192.168.1.1',
      server: { deviceId: 'r', interfaceKey: 'port:1' },
    });
  });

  it('carries /24 when the interface that serves has no mask written', () => {
    const t = lab({ lan: { subnet: undefined } });
    expect(leaseOf(resolveDhcp(t), 'a', 'nic-1')).toMatchObject({ ip: '192.168.1.100', mask: MASK });
    expect(resolveDhcp(t).pools[0].mask).toBe(MASK);
  });

  it('carries the gateway written in the pool instead, when one is', () => {
    const t = lab({ pool: { ...POOL, gateway: '192.168.1.254' } });
    expect(leaseOf(resolveDhcp(t), 'a', 'nic-1')?.gateway).toBe('192.168.1.254');
  });

  it('is the same every time, and for the drawing it was worked out from', () => {
    const t = lab();
    expect(resolveDhcp(t)).toBe(resolveDhcp(t));
    // another drawing with the same content: worked out again, same leases
    const again = lab();
    expect(resolveDhcp(again)).not.toBe(resolveDhcp(t));
    expect(resolveDhcp(again).leases).toEqual(resolveDhcp(t).leases);
  });

  it('is worked out again for the same devices with other cables', () => {
    const t = lab();
    expect(leasedIp(t, 'a')).toBe('192.168.1.100');
    // A unplugged: same list of devices, another list of cables
    const unplugged = { devices: t.devices, connections: t.connections.slice(1) };
    expect(whyNot(unplugged, 'a')?.cause).toBe('no-cable');
    expect(leasedIp(unplugged, 'b')).toBe('192.168.1.100');
    // and back
    expect(leasedIp(t, 'a')).toBe('192.168.1.100');
  });

  it('a drawing without DHCP is never kept: put on DHCP in place, it is read again', () => {
    //  X (no address) ── R, asked a first time before anything is on DHCP
    const r = device({ id: 'r', label: 'R', type: 'Router', ports: [port(1, { ip: '192.168.1.1', subnet: MASK })] });
    const x = device({ id: 'x', label: 'X', nics: [nic({ subnet: '' })] });
    const t = topo([x, r], [link('x', 'r', { sourceNic: 'nic-1', targetPort: 1 })]);
    expect(withLeases(t)).toBe(t);
    expect(traceRoute('x', 'r', t).failureReason).toBe('X has no IP address configured');

    // the same objects, changed where they are (as a test does, and the application never)
    x.nics![0].dhcp = true;
    r.ports![0].dhcpServer = POOL;
    expect(byId(withLeases(t), 'x').ip).toBe('192.168.1.100');
    expect(traceRoute('x', 'r', t)).toMatchObject({ verdict: 'success', sourceIp: '192.168.1.100' });
  });

  it('moves when an address is written by hand in the range', () => {
    const more = [host('d', '192.168.1.100', '192.168.1.1', { label: 'D' })];
    const t = lab({ more, moreLinks: [link('d', 'sw', { sourceNic: 'nic-1', targetPort: 5 })] });
    expect(leasedIp(t, 'a')).toBe('192.168.1.102');
    expect(whyNot(t, 'b')?.cause).toBe('used-up');
  });

  it('is not an address written by hand anywhere in the drawing, even on another network', () => {
    // Srv is on the other side of the router, with an address of the range
    const t = lab();
    byId(t, 'srv').nics![0].ip = '192.168.1.100';
    expect(leasedIp(t, 'a')).toBe('192.168.1.102');
  });

  it('is never the address of the network, its broadcast address, the gateway or the server itself', () => {
    const t = lab({
      lan: { ip: '192.168.1.2', subnet: '255.255.255.248' },
      pool: { start: '192.168.1.0', end: '192.168.1.7', gateway: '192.168.1.1' },
    });
    byId(t, 'c').nics![0].ip = '192.168.1.6';
    // .0 network, .1 gateway, .2 the port, .6 written by hand, .7 broadcast
    const resolution = resolveDhcp(t);
    expect(resolution.leases.map(lease => lease.ip)).toEqual(['192.168.1.3', '192.168.1.4']);
    const [pool] = resolution.pools;
    // eight addresses in the range; network, broadcast and gateway are never given
    expect(pool.size).toBe(5);
    // of those five, .2 and .6 are written by hand and two are leased
    expect(pool.free).toBe(1);
  });

  it('does not read what the card carries of its own', () => {
    const stale = nic({ dhcp: true, ip: '10.9.9.9', subnet: '255.0.0.0', gateway: '10.9.9.1' });
    const t = lab({ a: { ip: '10.9.9.9', gateway: '10.9.9.1', nics: [stale] } });
    expect(leasedIp(t, 'a')).toBe('192.168.1.100');
    const a = byId(withLeases(t), 'a');
    expect(a.nics![0]).toMatchObject({ ip: '192.168.1.100', subnet: MASK, gateway: '192.168.1.1' });
    expect(a).toMatchObject({ ip: '192.168.1.100', gateway: '192.168.1.1' });
    // and 10.9.9.9 is nobody's: it is not kept away from anything
    expect(traceRoute('c', 'a', t, { targetIp: '10.9.9.9' }).verdict).not.toBe('success');
  });

  it('an address left on a card set to DHCP is not one written by hand: it can be leased', () => {
    // B still carries the first address of the range from before it went on DHCP
    const t = lab();
    Object.assign(byId(t, 'b'), { ip: '192.168.1.100' });
    Object.assign(byId(t, 'b').nics![0], { ip: '192.168.1.100', subnet: MASK });
    expect(resolveDhcp(t).leases.map(lease => `${lease.deviceId} ${lease.ip}`)).toEqual([
      'a 192.168.1.100',
      'b 192.168.1.102',
    ]);
  });
});

describe('the drawing with the leases filled in', () => {
  it('gives the card its address, mask and gateway, and the device its mirror', () => {
    const t = lab();
    const leased = withLeases(t);
    expect(byId(leased, 'b')).toMatchObject({
      ip: '192.168.1.102',
      subnet: MASK,
      gateway: '192.168.1.1',
      nics: [{ dhcp: true, ip: '192.168.1.102', subnet: MASK, gateway: '192.168.1.1' }],
    });
    // the drawing itself is not touched
    expect(byId(t, 'b').nics![0]).toMatchObject({ dhcp: true, ip: '', gateway: '' });
    expect(byId(t, 'b').ip).toBe('');
  });

  it('keeps every device that has no card on DHCP exactly as it is', () => {
    const t = lab();
    const leased = withLeases(t);
    for (const id of ['c', 'sw', 'r', 'srv']) expect(byId(leased, id)).toBe(byId(t, id));
    expect(leased.connections).toBe(t.connections);
  });

  it('is the drawing itself when no card is on DHCP', () => {
    const t = topo([host('x', '10.0.0.1'), host('y', '10.0.0.2')], [link('x', 'y')]);
    expect(withLeases(t)).toBe(t);
    expect(resolveDhcp(t).topology.devices).toBe(t.devices);
    expect(resolveDhcp(t)).toMatchObject({ leases: [], unserved: [], pools: [], warnings: [] });
  });

  it('is itself when asked again', () => {
    const leased = withLeases(lab());
    expect(withLeases(leased)).toBe(leased);
    expect(resolveDhcp(leased).topology.devices).toBe(leased.devices);
  });

  it('leaves a card without a lease with no address at all, and its device too', () => {
    const t = lab({ pool: null });
    expect(byId(withLeases(t), 'a')).toMatchObject({ ip: '', gateway: '', nics: [{ ip: '', subnet: '', gateway: '' }] });
  });

  it('a device with two cards on DHCP has a lease for each, or a reason for each', () => {
    //  D: eth0 on the switch, eth1 with no cable
    const two = device({
      id: 'd',
      label: 'D',
      nics: [nic({ dhcp: true, subnet: '' }), nic({ id: 'nic-2', name: 'eth1', dhcp: true, subnet: '' })],
    });
    const t = lab({
      pool: { start: '192.168.1.100', end: '192.168.1.110' },
      more: [two],
      moreLinks: [link('d', 'sw', { sourceNic: 'nic-1', targetPort: 5 })],
    });
    const resolution = resolveDhcp(t);
    expect(leaseOf(resolution, 'd', 'nic-1')?.ip).toBe('192.168.1.103');
    expect(leaseOf(resolution, 'd', 'nic-2')).toBeUndefined();
    expect(unservedOf(resolution, 'd', 'nic-1')).toBeUndefined();
    expect(unservedOf(resolution, 'd', 'nic-2')?.cause).toBe('no-cable');
    // both on the switch: one address each, in the order of the cards
    const both = lab({
      pool: { start: '192.168.1.100', end: '192.168.1.110' },
      more: [two],
      moreLinks: [
        link('d', 'sw', { sourceNic: 'nic-1', targetPort: 5 }),
        link('d', 'sw', { id: 'd--sw-2', sourceNic: 'nic-2', targetPort: 6 }),
      ],
    });
    expect(leaseOf(resolveDhcp(both), 'd', 'nic-1')?.ip).toBe('192.168.1.103');
    expect(leaseOf(resolveDhcp(both), 'd', 'nic-2')?.ip).toBe('192.168.1.104');
  });

  it('a device whose first card has no address keeps the one it has at device level, whatever its second card', () => {
    // (the shape of a device drawn before cards carried addresses)
    const second = nic({ id: 'nic-2', name: 'eth1', dhcp: true, subnet: '' });
    const more = [device({ id: 'd', label: 'D', ip: '10.0.0.20', gateway: '10.0.0.1', nics: [nic(), second] })];
    const t = lab({
      pool: { start: '192.168.1.100', end: '192.168.1.110' },
      more,
      moreLinks: [link('d', 'sw', { sourceNic: 'nic-2', targetPort: 5 })],
    });
    const d = byId(withLeases(t), 'd');
    expect(d).toMatchObject({ ip: '10.0.0.20', gateway: '10.0.0.1' });
    expect(d.nics![1].ip).toBe('192.168.1.103');
  });

  it('follows the first card only: a second card on DHCP does not move the device-level address', () => {
    const second = nic({ id: 'nic-2', name: 'eth1', dhcp: true, subnet: '' });
    const more = [device({ id: 'd', label: 'D', ip: '10.0.0.20', gateway: '10.0.0.1', nics: [nic({ ip: '10.0.0.20', gateway: '10.0.0.1' }), second] })];
    const t = lab({
      pool: { start: '192.168.1.100', end: '192.168.1.110' },
      more,
      moreLinks: [link('d', 'sw', { sourceNic: 'nic-2', targetPort: 5 })],
    });
    const d = byId(withLeases(t), 'd');
    expect(d).toMatchObject({ ip: '10.0.0.20', gateway: '10.0.0.1' });
    expect(d.nics![0]).toBe(byId(t, 'd').nics![0]);
    expect(d.nics![1]).toMatchObject({ ip: '192.168.1.103', subnet: MASK, gateway: '192.168.1.1' });
  });
});

describe('the rest of the engine reads the lease', () => {
  it('a device on DHCP reaches another network through the gateway it was given', () => {
    const result = traceRoute('a', 'srv', lab());
    expect(result).toMatchObject({ verdict: 'success', sourceIp: '192.168.1.100', targetIp: '10.0.0.10' });
    expect(result.hops.map(hop => hop.label)).toEqual(['A', 'SW', 'R', 'Srv']);
  });

  it('a device named as the destination is aimed at the address it was given', () => {
    const flow = planAndEvaluateFlow('ping', 'srv', 'b', lab());
    expect(flow.verdict).toBe('success');
    expect(flow.legs[0].trace.targetIp).toBe('192.168.1.102');
    expect(traceToDevice('c', 'a', lab()).trace).toMatchObject({ verdict: 'success', targetIp: '192.168.1.100' });
  });

  it('a device behind the Internet is aimed at its public address, also when that one is leased', () => {
    //  Ext ── Internet ── ISP (hands out 203.0.113.100–110) ── eth1 Srv eth0 192.168.1.20
    //  Srv is named by its first address, a private one: from outside it is its second card that answers
    const t = topo(
      [
        host('ext', '203.0.113.50', '203.0.113.1', { label: 'Ext' }),
        device({ id: 'inet', label: 'Internet', type: 'Cloud', templateId: 'tpl-cloud', nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })] }),
        switchWith('sw', [port(1), port(2), port(3)], { label: 'SW' }),
        device({
          id: 'isp',
          label: 'ISP',
          type: 'Router',
          ports: [port(1, { ip: '203.0.113.1', subnet: MASK, dhcpServer: { start: '203.0.113.100', end: '203.0.113.110' } })],
        }),
        device({
          id: 'srv',
          label: 'Srv',
          type: 'Server',
          ip: '192.168.1.20',
          nics: [nic({ ip: '192.168.1.20' }), nic({ id: 'nic-2', name: 'eth1', dhcp: true, subnet: '' })],
        }),
      ],
      [
        link('ext', 'inet', { sourceNic: 'nic-1', targetNic: 'nic-1' }),
        link('inet', 'sw', { sourceNic: 'nic-2', targetPort: 1 }),
        link('sw', 'isp', { sourcePort: 2, targetPort: 1 }),
        link('sw', 'srv', { sourcePort: 3, targetNic: 'nic-2' }),
      ]
    );
    expect(leasedIp(t, 'srv', 'nic-2')).toBe('203.0.113.100');
    const { trace, note } = traceToDevice('ext', 'srv', t);
    expect(trace).toMatchObject({ verdict: 'success', targetIp: '203.0.113.100' });
    expect(note).toBe('Srv is reached from outside at 203.0.113.100, its public address');
  });

  it('a pool without a gateway on a server leaves its clients inside their network', () => {
    const server = host('dh', '192.168.1.5', '192.168.1.1', { label: 'DH', type: 'Server', templateId: 'tpl-dhcpserver' });
    server.nics![0].dhcpServer = POOL;
    const t = lab({ pool: null, more: [server], moreLinks: [link('dh', 'sw', { sourceNic: 'nic-1', targetPort: 5 })] });
    expect(leaseOf(resolveDhcp(t), 'a', 'nic-1')).toMatchObject({ ip: '192.168.1.100', gateway: '' });
    expect(traceRoute('a', 'c', t).verdict).toBe('success');
    expect(traceRoute('a', 'srv', t)).toMatchObject({
      verdict: 'blocked',
      failureReason: 'no default gateway configured on A',
    });
  });

  it('a card that got no address says why, as the source and as the destination', () => {
    const t = lab({ pool: null });
    const why = 'A has no address: no DHCP server answers on its network';
    expect(traceRoute('a', 'srv', t)).toMatchObject({ verdict: 'error', failureReason: why, hops: [] });
    expect(traceRoute('srv', 'a', t)).toMatchObject({ verdict: 'error', failureReason: why });
    expect(planAndEvaluateFlow('web', 'a', 'srv', t)).toMatchObject({
      verdict: 'error',
      failureReason: `HTTP request: ${why}`,
    });
    expect(noLeaseReason(t, byId(t, 'a'))).toBe(why);
  });

  it('a device with no address and no card on DHCP keeps the old words', () => {
    const t = topo([device({ id: 'x', label: 'X', nics: [nic()] }), host('y', '10.0.0.2')], [link('x', 'y')]);
    expect(traceRoute('x', 'y', t).failureReason).toBe('X has no IP address configured');
    expect(noLeaseReason(t, byId(t, 'x'))).toBeUndefined();
    // a device on DHCP that did get its address has nothing to say either
    expect(noLeaseReason(lab(), byId(lab(), 'a'))).toBeUndefined();
  });

  it('the devices exchanges are counted between include those with a leased address', () => {
    expect(impactEndpoints(lab()).map(d => d.id)).toEqual(['a', 'b', 'c', 'srv']);
    expect(impactEndpoints(lab({ pool: null })).map(d => d.id)).toEqual(['c', 'srv']);
  });
});

describe('who answers whom', () => {
  it('a card with no pool on its network has no address', () => {
    expect(whyNot(lab({ pool: null }), 'a')).toEqual({
      deviceId: 'a',
      nicId: 'nic-1',
      cause: 'no-server',
      reason: 'no DHCP server answers on its network',
    });
  });

  it('a router does not pass the request on: a pool on another network does not answer', () => {
    // the pool is on the far side of R
    const t = lab({ pool: null });
    byId(t, 'r').ports![1].dhcpServer = { start: '10.0.0.100', end: '10.0.0.110' };
    expect(whyNot(t, 'a')?.cause).toBe('no-server');
    // while a card on that side is served
    const more = [client('e')];
    const there = lab({ pool: null, more, moreLinks: [link('e', 'r', { sourceNic: 'nic-1', targetPort: 3 })] });
    byId(there, 'r').ports!.push(port(3, { ip: '172.16.0.1', subnet: MASK, dhcpServer: { start: '172.16.0.50', end: '172.16.0.60' } }));
    expect(leasedIp(there, 'e')).toBe('172.16.0.50');
  });

  it('nor does a router without interface addresses, which lets addressed traffic through', () => {
    //  X (dhcp) ── T (router, no port addresses) ── DH (server with a pool)
    const server = host('dh', '192.168.5.5', '', { label: 'DH', type: 'Server' });
    server.nics![0].dhcpServer = { start: '192.168.5.100', end: '192.168.5.110' };
    const build = (x: NetworkDevice) =>
      topo(
        [x, device({ id: 't', label: 'T', type: 'Router', ip: '192.168.5.1', ports: [port(1), port(2)] }), server],
        [link('x', 't', { sourceNic: 'nic-1', targetPort: 1 }), link('t', 'dh', { sourcePort: 2, targetNic: 'nic-1' })]
      );
    expect(whyNot(build(client('x')), 'x')?.cause).toBe('no-server');
    // (the same cables carry a ping between two addresses written by hand)
    expect(traceRoute('x', 'dh', build(host('x', '192.168.5.9'))).verdict).toBe('success');
  });

  it('nor does a symbol that is not simulated', () => {
    const server = host('dh', '192.168.5.5', '', { label: 'DH', type: 'Server' });
    server.nics![0].dhcpServer = { start: '192.168.5.100', end: '192.168.5.110' };
    const cloud = device({ id: 'wan', label: 'Linea', type: 'Cloud', templateId: 'tpl-cloud', nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })] });
    const t = topo(
      [client('x'), cloud, server],
      [link('x', 'wan', { sourceNic: 'nic-1', targetNic: 'nic-1' }), link('wan', 'dh', { sourceNic: 'nic-2', targetNic: 'nic-1' })]
    );
    expect(whyNot(t, 'x')?.cause).toBe('no-server');
  });

  it('an access point and a second switch in between are the same network', () => {
    //  X (dhcp) ── AP ── SW2 ── SW (port 5)
    const ap = device({ id: 'ap', label: 'AP', type: 'AccessPoint', nics: [nic(), nic({ id: 'nic-2', name: 'wlan0' })] });
    const t = lab({
      more: [client('x'), ap, switchWith('sw2', [port(1), port(2)], { label: 'SW2' })],
      moreLinks: [
        link('x', 'ap', { sourceNic: 'nic-1', targetNic: 'nic-2' }),
        link('ap', 'sw2', { sourceNic: 'nic-1', targetPort: 1 }),
        link('sw2', 'sw', { sourcePort: 2, targetPort: 5 }),
      ],
    });
    // A and B come first in the drawing: X gets what is left
    expect(resolveDhcp(t).leases.map(lease => lease.deviceId)).toEqual(['a', 'b']);
    expect(whyNot(t, 'x')?.cause).toBe('used-up');
    const wider = lab({
      pool: { start: '192.168.1.100', end: '192.168.1.110' },
      more: [client('x'), ap, switchWith('sw2', [port(1), port(2)], { label: 'SW2' })],
      moreLinks: [
        link('x', 'ap', { sourceNic: 'nic-1', targetNic: 'nic-2' }),
        link('ap', 'sw2', { sourceNic: 'nic-1', targetPort: 1 }),
        link('sw2', 'sw', { sourcePort: 2, targetPort: 5 }),
      ],
    });
    expect(leasedIp(wider, 'x')).toBe('192.168.1.103');
  });

  it('VLAN by VLAN: each card is served by the pool of its own VLAN', () => {
    //  A in VLAN 10, B in VLAN 20; the router has a port in each
    const t = topo(
      [
        client('a'),
        client('b'),
        client('n'),
        switchWith(
          'sw',
          [port(1, { vlan: 10 }), port(2, { vlan: 20 }), port(3, { vlan: 30 }), port(7, { vlan: 10 }), port(8, { vlan: 20 })],
          { label: 'SW' }
        ),
        device({
          id: 'r',
          label: 'R',
          type: 'Router',
          ports: [
            port(1, { ip: '192.168.10.1', subnet: MASK, dhcpServer: { start: '192.168.10.100', end: '192.168.10.199' } }),
            port(2, { ip: '192.168.20.1', subnet: MASK, dhcpServer: { start: '192.168.20.100', end: '192.168.20.199' } }),
          ],
        }),
      ],
      [
        link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
        link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
        link('n', 'sw', { sourceNic: 'nic-1', targetPort: 3 }),
        link('sw', 'r', { sourcePort: 7, targetPort: 1 }),
        link('sw', 'r', { id: 'sw--r-20', sourcePort: 8, targetPort: 2 }),
      ]
    );
    const resolution = resolveDhcp(t);
    expect(leaseOf(resolution, 'a', 'nic-1')).toMatchObject({ ip: '192.168.10.100', gateway: '192.168.10.1', server: { interfaceKey: 'port:1' } });
    expect(leaseOf(resolution, 'b', 'nic-1')).toMatchObject({ ip: '192.168.20.100', gateway: '192.168.20.1', server: { interfaceKey: 'port:2' } });
    // VLAN 30 has no router port: nobody answers there
    expect(unservedOf(resolution, 'n', 'nic-1')?.cause).toBe('no-server');
    expect(resolution.warnings).toEqual([]);
    // and the two then talk through the router
    expect(traceRoute('a', 'b', t).hops.map(hop => hop.label)).toEqual(['A', 'SW', 'R', 'SW', 'B']);
  });

  it('a server answers the cards of its own network, with the gateway its pool names', () => {
    const server = host('dh', '192.168.1.5', '192.168.1.1', { label: 'DH', type: 'Server', templateId: 'tpl-dhcpserver' });
    server.nics![0].dhcpServer = { ...POOL, gateway: '192.168.1.1' };
    const t = lab({ pool: null, more: [server], moreLinks: [link('dh', 'sw', { sourceNic: 'nic-1', targetPort: 5 })] });
    expect(leaseOf(resolveDhcp(t), 'a', 'nic-1')).toMatchObject({
      ip: '192.168.1.100',
      gateway: '192.168.1.1',
      server: { deviceId: 'dh', interfaceKey: 'nic:nic-1' },
    });
    expect(traceRoute('a', 'srv', t).verdict).toBe('success');
  });

  it('a pool on a device that is neither a router, a firewall nor a server is not read', () => {
    const pc = host('dh', '192.168.1.5', '192.168.1.1', { label: 'DH' });
    pc.nics![0].dhcpServer = POOL;
    const t = lab({ pool: null, more: [pc], moreLinks: [link('dh', 'sw', { sourceNic: 'nic-1', targetPort: 5 })] });
    expect(resolveDhcp(t).pools).toEqual([]);
    expect(whyNot(t, 'a')?.cause).toBe('no-server');
    expect(servesDhcp(pc)).toBe(false);
    for (const type of ['Router', 'Firewall', 'Server']) expect(servesDhcp(device({ id: 'x', type })), type).toBe(true);
    for (const type of ['PC', 'Switch', 'Database', 'AccessPoint']) expect(servesDhcp(device({ id: 'x', type })), type).toBe(false);
  });

  it('with two servers on one network the first in the drawing answers, and a warning names both', () => {
    const server = host('dh', '192.168.1.5', '192.168.1.1', { label: 'DH', type: 'Server' });
    server.nics![0].dhcpServer = { start: '192.168.1.200', end: '192.168.1.210' };
    const t = lab({ more: [server], moreLinks: [link('dh', 'sw', { sourceNic: 'nic-1', targetPort: 5 })] });
    const resolution = resolveDhcp(t);
    // R comes before DH in the drawing
    expect(resolution.leases.map(lease => `${lease.deviceId} ${lease.ip} ${lease.server.deviceId}`)).toEqual([
      'a 192.168.1.100 r',
      'b 192.168.1.102 r',
    ]);
    expect(resolution.warnings).toEqual([
      'two DHCP servers on one network: R port 1 and DH eth0 — the first that has an address left answers',
    ]);
  });

  it('and when the first has nothing left the second answers', () => {
    const server = host('dh', '192.168.1.5', '192.168.1.1', { label: 'DH', type: 'Server' });
    server.nics![0].dhcpServer = { start: '192.168.1.200', end: '192.168.1.210' };
    const t = lab({
      pool: { start: '192.168.1.100', end: '192.168.1.100' },
      more: [server],
      moreLinks: [link('dh', 'sw', { sourceNic: 'nic-1', targetPort: 5 })],
    });
    expect(resolveDhcp(t).leases.map(lease => `${lease.deviceId} ${lease.ip} ${lease.server.deviceId}`)).toEqual([
      'a 192.168.1.100 r',
      'b 192.168.1.200 dh',
    ]);
  });

  it('three servers are named as three', () => {
    const one = host('d1', '192.168.1.5', '', { label: 'D1', type: 'Server' });
    one.nics![0].dhcpServer = { start: '192.168.1.200', end: '192.168.1.210' };
    const two = host('d2', '192.168.1.6', '', { label: 'D2', type: 'Server' });
    two.nics![0].dhcpServer = { start: '192.168.1.220', end: '192.168.1.230' };
    const t = lab({
      more: [one, two],
      moreLinks: [link('d1', 'sw', { sourceNic: 'nic-1', targetPort: 5 }), link('d2', 'sw', { sourceNic: 'nic-1', targetPort: 6 })],
    });
    expect(resolveDhcp(t).warnings).toEqual([
      '3 DHCP servers on one network: R port 1, D1 eth0 and D2 eth0 — the first that has an address left answers',
    ]);
  });
});

describe('a card that gets nothing', () => {
  it('because the pool is used up', () => {
    const t = lab({ pool: { start: '192.168.1.100', end: '192.168.1.101' } });
    // .101 is C's: one address to give, and A takes it
    expect(leasedIp(t, 'a')).toBe('192.168.1.100');
    expect(whyNot(t, 'b')).toEqual({
      deviceId: 'b',
      nicId: 'nic-1',
      cause: 'used-up',
      reason: 'the pool of R port 1 is used up: 2 addresses, all taken',
      server: { deviceId: 'r', interfaceKey: 'port:1' },
    });
    expect(traceRoute('b', 'srv', t).failureReason).toBe(
      'B has no address: the pool of R port 1 is used up: 2 addresses, all taken'
    );
    expect(resolveDhcp(t).pools[0]).toMatchObject({ size: 2, free: 0 });
  });

  it('one address is not "addresses", and a range with nothing to give says so', () => {
    const t = lab({ pool: { start: '192.168.1.100', end: '192.168.1.100' } });
    expect(whyNot(t, 'b')?.reason).toBe('the pool of R port 1 is used up: its one address is taken');
    // the range is the address of the network alone: it is never given
    const none = lab({ pool: { start: '192.168.1.0', end: '192.168.1.0' } });
    expect(whyNot(none, 'a')).toMatchObject({
      cause: 'used-up',
      reason: 'the pool of R port 1 has no address to give',
    });
  });

  it('because its card is disabled, or has no cable', () => {
    const off = lab({ a: { nics: [nic({ dhcp: true, enabled: false })] } });
    expect(whyNot(off, 'a')).toMatchObject({ cause: 'disabled', reason: 'interface eth0 is disabled' });
    // (the next card is served as if the first were not there)
    expect(leasedIp(off, 'b')).toBe('192.168.1.100');

    const loose = lab();
    loose.connections.splice(0, 1);
    expect(whyNot(loose, 'a')).toMatchObject({ cause: 'no-cable', reason: 'interface eth0 has no cable attached' });
  });

  it('because something on the way is down: the port of the server, a port of the switch', () => {
    expect(whyNot(lab({ lan: { enabled: false } }), 'a')?.cause).toBe('no-server');
    const ports = [port(1), port(2), port(3), port(4, { enabled: false })];
    expect(whyNot(lab({ switchPorts: ports }), 'a')?.cause).toBe('no-server');
    // one switch port down cuts one card only
    const one = [port(1, { enabled: false }), port(2), port(3), port(4)];
    expect(whyNot(lab({ switchPorts: one }), 'a')?.cause).toBe('no-server');
    expect(leasedIp(lab({ switchPorts: one }), 'b')).toBe('192.168.1.100');
  });

  it('because the cable to the server is not attached to one of its interfaces', () => {
    const t = lab();
    const cable = t.connections.find(c => c.id === 'sw--r');
    delete cable!.targetPort;
    expect(whyNot(t, 'a')).toEqual({
      deviceId: 'a',
      nicId: 'nic-1',
      cause: 'unattached',
      reason: 'the cable to R is not attached to one of its interfaces: which pool answers is not known',
      server: { deviceId: 'r', interfaceKey: 'port:1' },
    });
  });

  it('because its device routes: a router does not take its addresses from DHCP', () => {
    const router = device({ id: 'x', label: 'X', type: 'Router', nics: [nic({ dhcp: true })], ports: [port(1)] });
    const t = lab({ more: [router], moreLinks: [link('x', 'sw', { sourceNic: 'nic-1', targetPort: 5 })] });
    expect(whyNot(t, 'x')).toMatchObject({ cause: 'routes', reason: 'a router does not take its addresses from DHCP' });
  });

  it('because the pool that hears it cannot work as written', () => {
    const t = lab({ pool: { start: '192.168.1.120', end: '192.168.1.110' } });
    expect(whyNot(t, 'a')).toMatchObject({
      cause: 'unusable',
      reason: 'the pool of R port 1 cannot be used: the range ends (192.168.1.110) before it starts (192.168.1.120)',
      server: { deviceId: 'r', interfaceKey: 'port:1' },
    });
    expect(resolveDhcp(t).pools[0]).toMatchObject({ size: 0, free: 0, leases: [], mask: '', gateway: '' });
  });

  it('a pool that cannot work does not stop another one from answering', () => {
    const server = host('dh', '192.168.1.5', '', { label: 'DH', type: 'Server' });
    server.nics![0].dhcpServer = { start: '192.168.1.200', end: '192.168.1.210' };
    const t = lab({
      pool: { start: '192.168.1.120', end: '192.168.1.110' },
      more: [server],
      moreLinks: [link('dh', 'sw', { sourceNic: 'nic-1', targetPort: 5 })],
    });
    expect(leaseOf(resolveDhcp(t), 'a', 'nic-1')).toMatchObject({ ip: '192.168.1.200', server: { deviceId: 'dh' } });
    // one server that works: nothing to warn about
    expect(resolveDhcp(t).warnings).toEqual([]);
  });
});

describe('a pool as written', () => {
  const router = (lan: Partial<Port>) =>
    device({ id: 'r', label: 'R', type: 'Router', ports: [port(1, { ip: '192.168.1.1', subnet: MASK, ...lan })] });
  const problemOf = (pool: DhcpPool, lan: Partial<Port> = {}) => {
    const r = router(lan);
    return poolProblem(r, listInterfaces(r)[0], pool);
  };

  it('is fine inside the network of its interface', () => {
    expect(problemOf(POOL)).toBeUndefined();
    expect(problemOf({ start: '192.168.1.1', end: '192.168.1.254', gateway: '192.168.1.1' })).toBeUndefined();
    expect(problemOf({ start: '192.168.1.50', end: '192.168.1.50' })).toBeUndefined();
  });

  it('needs an interface with an address', () => {
    expect(problemOf(POOL, { ip: undefined })).toEqual({
      code: 'no-address',
      text: 'port 1 on R has no address: a pool hands out the network of its interface',
    });
    expect(problemOf(POOL, { ip: 'x.y' })?.code).toBe('no-address');
  });

  it('needs addresses, of the network of the interface, in order', () => {
    expect(problemOf({ start: 'abc', end: '192.168.1.110' })).toEqual({
      code: 'invalid',
      value: 'abc',
      text: '"abc" is not an address',
    });
    expect(problemOf({ start: '192.168.1.100', end: '' })).toMatchObject({ code: 'invalid', value: '' });
    expect(problemOf({ start: '192.168.2.100', end: '192.168.2.110' })).toEqual({
      code: 'outside',
      value: '192.168.2.100',
      network: '192.168.1.0/24',
      text: '192.168.2.100 is outside 192.168.1.0/24, the network of port 1 on R',
    });
    expect(problemOf({ start: '192.168.1.100', end: '192.168.2.110' })).toMatchObject({ code: 'outside', value: '192.168.2.110' });
    expect(problemOf({ start: '192.168.1.110', end: '192.168.1.100' })).toEqual({
      code: 'reversed',
      text: 'the range ends (192.168.1.100) before it starts (192.168.1.110)',
    });
  });

  it('needs its gateway, when it names one, to be an address of that network', () => {
    expect(problemOf({ ...POOL, gateway: 'gw' })).toMatchObject({ code: 'invalid', value: 'gw' });
    expect(problemOf({ ...POOL, gateway: '10.0.0.1' })).toMatchObject({ code: 'outside', value: '10.0.0.1' });
  });

  it('uses the mask of the interface: the same range is outside a smaller network', () => {
    expect(problemOf({ start: '192.168.1.130', end: '192.168.1.140' }, { subnet: '255.255.255.128' })).toMatchObject({
      code: 'outside',
      text: '192.168.1.130 is outside 192.168.1.0/25, the network of port 1 on R',
    });
    // no mask on the port: /24
    expect(problemOf(POOL, { subnet: undefined })).toBeUndefined();
  });

  it('cannot be on a card that takes its own address from DHCP', () => {
    const server = device({ id: 's', label: 'S', type: 'Server', nics: [nic({ dhcp: true, dhcpServer: POOL })] });
    expect(poolProblem(server, listInterfaces(server)[0], POOL)).toEqual({
      code: 'client',
      text: 'eth0 on S takes its own address from DHCP: it cannot hand out addresses too',
    });
  });

  it('is listed with its state, in drawing order, ports before cards', () => {
    const server = host('dh', '192.168.1.5', '', { label: 'DH', type: 'Server' });
    server.nics![0].dhcpServer = { start: '192.168.1.200', end: '192.168.1.203', gateway: '192.168.1.1' };
    const t = lab({ more: [server], moreLinks: [link('dh', 'sw', { sourceNic: 'nic-1', targetPort: 5 })] });
    const resolution = resolveDhcp(t);
    expect(resolution.pools.map(pool => [pool.name, pool.mask, pool.gateway, pool.size, pool.free, pool.leases.length])).toEqual([
      // .100-.102: three, C has one by hand, two are leased
      ['R port 1', MASK, '192.168.1.1', 3, 0, 2],
      // .200-.203: four to give, nobody took any
      ['DH eth0', MASK, '192.168.1.1', 4, 4, 0],
    ]);
    expect(poolAt(resolution, { deviceId: 'dh', interfaceKey: 'nic:nic-1' })?.name).toBe('DH eth0');
    expect(poolAt(resolution, { deviceId: 'dh', interfaceKey: 'nic:nic-9' })).toBeUndefined();
    expect(poolAt(resolution, { deviceId: 'nobody', interfaceKey: 'port:1' })).toBeUndefined();
  });

  it('is read from the interface it is on, a port or a card', () => {
    const r = byId(lab(), 'r');
    const [one, two] = listInterfaces(r);
    expect(poolOf(one)).toEqual(POOL);
    expect(poolOf(two)).toBeUndefined();
    const server = device({ id: 's', type: 'Server', nics: [nic({ ip: '10.0.0.5', dhcpServer: POOL }), nic({ id: 'nic-2' })] });
    expect(listInterfaces(server).map(poolOf)).toEqual([POOL, undefined]);
  });

  it('a point-to-point network has no network and broadcast address to keep back', () => {
    const r = device({
      id: 'r',
      label: 'R',
      type: 'Router',
      ports: [port(1, { ip: '10.0.0.0', subnet: '255.255.255.254', dhcpServer: { start: '10.0.0.0', end: '10.0.0.1' } })],
    });
    const t = topo([client('x'), r], [link('x', 'r', { sourceNic: 'nic-1', targetPort: 1 })]);
    // two addresses: one is the port itself (the gateway), the other is given
    expect(resolveDhcp(t).pools[0]).toMatchObject({ size: 1, free: 0 });
    expect(leasedIp(t, 'x')).toBe('10.0.0.1');
  });
});

describe('simulated failures', () => {
  it('do not change a lease: a device keeps the address it had', () => {
    const t = lab();
    const broken = withFailures(t, { devices: ['r'], connections: [] });
    expect(resolveDhcp(broken)).toBe(resolveDhcp(t));
    const leased = withLeases(broken);
    expect(leased.failures).toEqual({ devices: ['r'], connections: [] });
    expect(byId(leased, 'a').ip).toBe('192.168.1.100');
    // what fails is the way, and the reason says so
    expect(traceRoute('a', 'srv', broken)).toMatchObject({ verdict: 'blocked', failureReason: 'R is down' });
    // inside its network the device still talks, with the address it had
    expect(traceRoute('a', 'c', broken)).toMatchObject({ verdict: 'success', sourceIp: '192.168.1.100' });
  });

  it('nor does a cut cable between a card and its server', () => {
    const t = lab();
    const cut = withFailures(t, { devices: [], connections: ['a--sw'] });
    expect(byId(withLeases(cut), 'a').ip).toBe('192.168.1.100');
    expect(traceRoute('a', 'c', cut)).toMatchObject({ verdict: 'blocked', failureReason: 'link A–SW is down' });
  });
});

describe('a range to start from', () => {
  const on = (lan: Partial<Port>) => {
    const r = device({ id: 'r', label: 'R', type: 'Router', ports: [port(1, lan)] });
    return { r, iface: listInterfaces(r)[0] };
  };
  const suggestion = (lan: Partial<Port>) => suggestedPool(on(lan).iface);

  it('is .100 to .199 on a /24', () => {
    expect(suggestion({ ip: '192.168.1.1', subnet: MASK })).toEqual({ start: '192.168.1.100', end: '192.168.1.199' });
    // no mask written: the default one, as everywhere
    expect(suggestion({ ip: '192.168.1.1' })).toEqual({ start: '192.168.1.100', end: '192.168.1.199' });
  });

  it('stays next to the address of the interface in a larger network', () => {
    expect(suggestion({ ip: '10.0.5.1', subnet: '255.0.0.0' })).toEqual({ start: '10.0.5.100', end: '10.0.5.199' });
    expect(suggestion({ ip: '172.16.3.254', subnet: '255.255.0.0' })).toEqual({
      start: '172.16.3.100',
      end: '172.16.3.199',
    });
  });

  it('is the upper half of a smaller network', () => {
    // /26: hosts .1 to .62
    expect(suggestion({ ip: '192.168.1.1', subnet: '255.255.255.192' })).toEqual({
      start: '192.168.1.32',
      end: '192.168.1.62',
    });
    // /28 in the middle of a network: hosts .17 to .30
    expect(suggestion({ ip: '192.168.1.17', subnet: '255.255.255.240' })).toEqual({
      start: '192.168.1.24',
      end: '192.168.1.30',
    });
  });

  it('leaves the address of the interface out when it is at an end of the range', () => {
    expect(suggestion({ ip: '192.168.1.62', subnet: '255.255.255.192' })).toEqual({
      start: '192.168.1.32',
      end: '192.168.1.61',
    });
    expect(suggestion({ ip: '192.168.1.32', subnet: '255.255.255.192' })).toEqual({
      start: '192.168.1.33',
      end: '192.168.1.62',
    });
    expect(suggestion({ ip: '192.168.1.100', subnet: MASK })).toEqual({ start: '192.168.1.101', end: '192.168.1.199' });
    expect(suggestion({ ip: '192.168.1.199', subnet: MASK })).toEqual({ start: '192.168.1.100', end: '192.168.1.198' });
  });

  it('on a network of two addresses is the one that is not the interface', () => {
    expect(suggestion({ ip: '10.0.0.1', subnet: '255.255.255.252' })).toEqual({ start: '10.0.0.2', end: '10.0.0.2' });
    expect(suggestion({ ip: '10.0.0.2', subnet: '255.255.255.252' })).toEqual({ start: '10.0.0.1', end: '10.0.0.1' });
  });

  it('is nothing where no address can be handed out', () => {
    expect(suggestion({})).toBeUndefined();
    expect(suggestion({ ip: 'x.y', subnet: MASK })).toBeUndefined();
    expect(suggestion({ ip: '10.0.0.1', subnet: '255.255.255.254' })).toBeUndefined();
    expect(suggestion({ ip: '10.0.0.1', subnet: '255.255.255.255' })).toBeUndefined();
    // a card that takes its own address from DHCP
    const server = device({ id: 's', type: 'Server', nics: [nic({ ip: '10.0.0.10', dhcp: true })] });
    expect(suggestedPool(listInterfaces(server)[0])).toBeUndefined();
  });

  it('always gives a range that can work', () => {
    const masks = ['255.0.0.0', '255.255.0.0', MASK, '255.255.255.128', '255.255.255.192', '255.255.255.240', '255.255.255.252'];
    const addresses = ['10.0.0.1', '10.0.0.2', '10.0.0.100', '10.0.0.126', '10.0.0.199', '10.0.0.254', '10.9.8.7'];
    for (const subnet of masks) {
      for (const ip of addresses) {
        const { r, iface } = on({ ip, subnet });
        const pool = suggestedPool(iface);
        // (an address that is the network's own or its broadcast address is not one of an interface)
        if (!pool) continue;
        expect(poolProblem(r, iface, pool), `${ip} ${subnet}`).toBeUndefined();
        expect(pool.start === ip && pool.end === ip, `${ip} ${subnet}`).toBe(false);
      }
    }
  });

  it('hands out its addresses when it is put on the port', () => {
    const { leases } = resolveDhcp(lab({ pool: suggestedPool(on({ ip: '192.168.1.1', subnet: MASK }).iface) }));
    expect(leases.map(lease => lease.ip)).toEqual(['192.168.1.100', '192.168.1.102']);
  });
});
