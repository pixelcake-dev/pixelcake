/**
 * The time of a question: each term of the sum (a cable by its medium and
 * its length, a delay written by hand, a device crossed, a Cloud symbol, the
 * two ends), the medium worked out for Wi-Fi, a reply that comes back by
 * another way, how a time is written, and the orders of magnitude a network
 * engineer expects: a LAN under a millisecond, the Internet in tens, a
 * satellite in hundreds.
 */

import { describe, it, expect } from 'vitest';
import { device, host, link, nic, port, route, switchWith, topo } from '@/test/networkFixtures';
import type { NetworkConnection, NetworkDevice } from '@/types';
import type { Topology } from './types';
import {
  CARRIER_MS,
  END_DEVICE_MS,
  FORWARDING_MS,
  MEDIUM_MS,
  crossingMs,
  describeLinkDelay,
  formatLength,
  formatMs,
  linkDelay,
  linkMedium,
  pathMs,
  roundTripMs,
} from './latency';
import { planAndEvaluateFlow } from './flows';
import { traceRoute } from './trace';

const MASK = '255.255.255.0';
const P2P = '255.255.255.252';

/** The round trip of a ping, as the terminal prints it, and the flow it comes from */
function ping(topology: Topology, from: string, to: string) {
  const flow = planAndEvaluateFlow('ping', from, to, topology);
  expect(flow.verdict, flow.failureReason).toBe('success');
  const [request, reply] = flow.legs;
  return { ms: roundTripMs(request.trace, reply.trace, topology), flow };
}

const pc = (id: string) => host(id, '192.168.1.10');
const laptop = (id: string) => host(id, '192.168.1.11', '', { templateId: 'tpl-laptop' });
/** An access point: its first card to the network, its second on the air */
const ap = (id: string) =>
  device({ id, type: 'AccessPoint', templateId: 'tpl-accesspoint', nics: [nic(), nic({ id: 'nic-2', name: 'wlan0' })] });

/** A link with nothing set on its cable, between two devices that are not there: copper, automatic */
const bare = (overrides: Partial<NetworkConnection> = {}) => link('a', 'b', overrides);

describe('the time of a link', () => {
  it('is nothing on a copper cable with no length: the medium of a link nobody set', () => {
    expect(linkDelay(bare(), pc('a'), pc('b'))).toEqual({ ms: 0, medium: 'copper', automatic: true, written: false });
  });

  it('takes 5 µs for every km of cable, copper or fibre', () => {
    expect(linkDelay(bare({ medium: 'fibre', lengthM: 600_000 }), undefined, undefined).ms).toBeCloseTo(3, 9);
    expect(linkDelay(bare({ medium: 'copper', lengthM: 100 }), undefined, undefined).ms).toBeCloseTo(0.0005, 9);
    expect(linkDelay(bare({ lengthM: 2000 }), undefined, undefined).ms).toBeCloseTo(0.01, 9);
  });

  it('takes the time of its medium, with the length on top', () => {
    const of = (medium: NetworkConnection['medium'], lengthM?: number) =>
      linkDelay(bare({ medium, ...(lengthM ? { lengthM } : {}) }), undefined, undefined).ms;
    expect(of('wifi')).toBe(1.5);
    expect(of('dsl')).toBe(8);
    expect(of('ftth')).toBe(1.5);
    expect(of('mobile')).toBe(15);
    expect(of('satellite')).toBe(280);
    expect(of('dsl', 3000)).toBeCloseTo(8.015, 9);
    expect(MEDIUM_MS).toEqual({ copper: 0, fibre: 0, wifi: 1.5, dsl: 8, ftth: 1.5, mobile: 15, satellite: 280 });
  });

  it('a delay written by hand wins over the medium and the length, 0 included', () => {
    const written = linkDelay(bare({ medium: 'fibre', lengthM: 600_000, delayMs: 7 }), undefined, undefined);
    expect(written).toEqual({ ms: 7, medium: 'fibre', automatic: false, lengthM: 600_000, written: true });
    expect(linkDelay(bare({ medium: 'satellite', delayMs: 0 }), undefined, undefined).ms).toBe(0);
    expect(describeLinkDelay(written)).toBe('written by hand');
  });

  it('reads nothing it could not use: an unknown medium, a length or a delay that is no number', () => {
    const odd = bare({ medium: 'banana', lengthM: -5, delayMs: Number.NaN } as unknown as NetworkConnection);
    expect(linkDelay(odd, undefined, undefined)).toEqual({ ms: 0, medium: 'copper', automatic: true, written: false });
  });

  it('works the medium out: Wi-Fi between a laptop, a smartphone or a tablet and an access point', () => {
    for (const templateId of ['tpl-laptop', 'tpl-smartphone', 'tpl-tablet']) {
      const mobile = host('m', '192.168.1.11', '', { templateId });
      expect(linkMedium(bare(), mobile, ap('ap'))).toEqual({ medium: 'wifi', automatic: true });
      // (whichever end the cable was drawn from)
      expect(linkMedium(bare(), ap('ap'), mobile)).toEqual({ medium: 'wifi', automatic: true });
    }
    expect(linkDelay(bare(), laptop('l'), ap('ap')).ms).toBe(1.5);
  });

  it('copper otherwise: a PC on an access point, a laptop on a switch or on an IoT gateway', () => {
    const iot = device({ id: 'iot', type: 'AccessPoint', templateId: 'tpl-iotgateway', nics: [nic()] });
    expect(linkMedium(bare(), pc('p'), ap('ap')).medium).toBe('copper');
    expect(linkMedium(bare(), laptop('l'), switchWith('sw', [port(1)])).medium).toBe('copper');
    expect(linkMedium(bare(), laptop('l'), iot).medium).toBe('copper');
  });

  it('a medium chosen is kept: a laptop cabled to its access point is on copper', () => {
    expect(linkMedium(bare({ medium: 'copper' }), laptop('l'), ap('ap'))).toEqual({ medium: 'copper', automatic: false });
  });
});

describe('the time of a device crossed', () => {
  it('is the time it takes to pass the packet on, or the network a Cloud symbol stands for', () => {
    const of = (overrides: Partial<NetworkDevice>) => crossingMs(device({ id: 'x', ...overrides }));
    expect(of({ type: 'Switch' })).toBe(FORWARDING_MS.switch);
    expect(of({ type: 'AccessPoint', templateId: 'tpl-accesspoint' })).toBe(FORWARDING_MS.accessPoint);
    expect(of({ type: 'Router' })).toBe(FORWARDING_MS.router);
    expect(of({ type: 'Firewall' })).toBe(FORWARDING_MS.firewall);
    expect(of({ type: 'LoadBalancer' })).toBe(FORWARDING_MS.loadBalancer);
    expect(of({ type: 'Cloud', label: 'Internet' })).toBe(CARRIER_MS.internet);
    expect(of({ type: 'Cloud', label: 'MPLS' })).toBe(CARRIER_MS.carrier);
    expect(of({ type: 'PC' })).toBe(0);
    expect([FORWARDING_MS.switch, FORWARDING_MS.accessPoint, FORWARDING_MS.router, FORWARDING_MS.firewall]).toEqual([
      0.01, 0.05, 0.1, 0.2,
    ]);
    expect([CARRIER_MS.internet, CARRIER_MS.carrier]).toEqual([10, 4]);
  });
});

/** pc1 ─ sw1 ─ pc2 on one network; the cables as given */
function oneSwitch(cables: Partial<NetworkConnection>[] = [{}, {}]): Topology {
  return topo(
    [host('pc1', '192.168.1.11'), host('pc2', '192.168.1.12'), switchWith('sw1', [port(1), port(2)])],
    [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 1, ...cables[0] }),
      link('pc2', 'sw1', { sourceNic: 'nic-1', targetPort: 2, ...cables[1] }),
    ]
  );
}

/**
 * Two sites: pc-a ─ sw-a ─ r-a … r-b ─ sw-b ─ pc-b, on public networks (the
 * Internet carries them). Port 2 of each router is on 203.0.113.0/24, the
 * network the routers reach each other on; what joins the two ports is
 * `between`, with the devices it needs.
 */
function twoSites(between: NetworkConnection[], middle: NetworkDevice[] = []): Topology {
  const router = (id: string, lan: string, other: string, wan: string, peer: string) =>
    device({
      id,
      type: 'Router',
      ip: `${lan}.1`,
      ports: [port(1, { ip: `${lan}.1`, subnet: MASK }), port(2, { ip: wan, subnet: MASK })],
      routes: [route(`${other}.0/24`, peer)],
    });
  return topo(
    [
      host('pc-a', '198.51.100.10', '198.51.100.1'),
      switchWith('sw-a', [port(1), port(2)]),
      router('r-a', '198.51.100', '192.0.2', '203.0.113.1', '203.0.113.2'),
      ...middle,
      router('r-b', '192.0.2', '198.51.100', '203.0.113.2', '203.0.113.1'),
      switchWith('sw-b', [port(1), port(2)]),
      host('pc-b', '192.0.2.10', '192.0.2.1'),
    ],
    [
      link('pc-a', 'sw-a', { sourceNic: 'nic-1', targetPort: 1 }),
      link('sw-a', 'r-a', { sourcePort: 2, targetPort: 1 }),
      ...between,
      link('r-b', 'sw-b', { sourcePort: 1, targetPort: 2 }),
      link('pc-b', 'sw-b', { sourceNic: 'nic-1', targetPort: 1 }),
    ]
  );
}

/** A Cloud symbol with two cards, as the samples draw one */
const cloud = (id: string, label: string) =>
  device({ id, type: 'Cloud', templateId: 'tpl-cloud', label, nics: [nic({ id: 'nic-1' }), nic({ id: 'nic-2', name: 'eth1' })] });

/** r-a ─ <cloud> ─ r-b, each cable as given */
const across = (cloudId: string, toA: Partial<NetworkConnection>, toB: Partial<NetworkConnection>) => [
  link('r-a', cloudId, { sourcePort: 2, targetNic: 'nic-1', ...toA }),
  link(cloudId, 'r-b', { sourceNic: 'nic-2', targetPort: 2, ...toB }),
];

describe('the time of a path, one way', () => {
  it('adds every cable and every device crossed, not the two ends', () => {
    const sites = twoSites([link('r-a', 'r-b', { sourcePort: 2, targetPort: 2, medium: 'fibre', lengthM: 600_000 })]);
    const trace = traceRoute('pc-a', 'pc-b', sites);
    expect(trace.hops.map((hop) => hop.deviceId)).toEqual(['pc-a', 'sw-a', 'r-a', 'r-b', 'sw-b', 'pc-b']);
    // two switches, two routers, 600 km of fibre
    expect(pathMs(trace, sites)).toBeCloseTo(0.01 + 0.1 + 3 + 0.1 + 0.01, 9);
  });

  it('is nothing for a packet that never leaves its device', () => {
    const t = oneSwitch();
    expect(pathMs(traceRoute('pc1', 'pc1', t), t)).toBe(0);
  });
});

describe('the time of an exchange', () => {
  it('is the request, the reply, and the two end devices once', () => {
    const t = oneSwitch();
    const { ms, flow } = ping(t, 'pc1', 'pc2');
    const [request, reply] = flow.legs;
    expect(ms).toBeCloseTo(pathMs(request.trace, t) + pathMs(reply.trace, t) + 2 * END_DEVICE_MS, 9);
    expect(ms).toBeCloseTo(0.01 + 0.01 + 0.2, 9);
  });

  it('a device that asks itself is counted once', () => {
    expect(ping(oneSwitch(), 'pc1', 'pc1').ms).toBe(END_DEVICE_MS);
  });

  it('a reply that comes back by another way takes the time of its own way', () => {
    // r-a sends to r-b by the main line; r-b answers by the backup line through r-c
    const main = link('r-a', 'r-b', { id: 'main', sourcePort: 2, targetPort: 2, medium: 'fibre', lengthM: 100_000 });
    const sites = twoSites([
      main,
      link('r-a', 'r-c', { id: 'backup-a', sourcePort: 3, targetPort: 1, medium: 'mobile' }),
      link('r-c', 'r-b', { id: 'backup-b', sourcePort: 2, targetPort: 3, medium: 'mobile' }),
    ], [
      device({
        id: 'r-c',
        type: 'Router',
        ports: [port(1, { ip: '10.0.1.2', subnet: P2P }), port(2, { ip: '10.0.2.1', subnet: P2P })],
        routes: [route('198.51.100.0/24', '10.0.1.1'), route('192.0.2.0/24', '10.0.2.2')],
      }),
    ]);
    const ra = sites.devices.find((d) => d.id === 'r-a')!;
    const rb = sites.devices.find((d) => d.id === 'r-b')!;
    ra.ports!.push(port(3, { ip: '10.0.1.1', subnet: P2P }));
    rb.ports!.push(port(3, { ip: '10.0.2.2', subnet: P2P }));
    rb.routes = [route('198.51.100.0/24', '10.0.2.1')];

    const { ms, flow } = ping(sites, 'pc-a', 'pc-b');
    const [request, reply] = flow.legs;
    expect(request.trace.hops.map((hop) => hop.deviceId)).toContain('r-b');
    expect(request.trace.hops.map((hop) => hop.deviceId)).not.toContain('r-c');
    expect(reply.trace.hops.map((hop) => hop.deviceId)).toContain('r-c');
    const there = pathMs(request.trace, sites);
    const back = pathMs(reply.trace, sites);
    expect(there).toBeCloseTo(0.5 + 0.22, 9);
    expect(back).toBeCloseTo(15 + 15 + 0.32, 9);
    expect(ms).toBeCloseTo(there + back + 0.2, 9);
  });

  it('is the same at every reply, and the same on the same drawing', () => {
    const sites = twoSites(across('inet', { medium: 'dsl' }, { medium: 'ftth' }), [cloud('inet', 'Internet')]);
    const times = Array.from({ length: 5 }, () => ping(sites, 'pc-a', 'pc-b').ms);
    expect(new Set(times).size).toBe(1);
  });

  it('changes no verdict and no path: a satellite is slow, not broken', () => {
    const plain = twoSites(across('inet', {}, {}), [cloud('inet', 'Internet')]);
    const slow = twoSites(across('inet', { medium: 'satellite' }, {}), [cloud('inet', 'Internet')]);
    const before = planAndEvaluateFlow('ping', 'pc-a', 'pc-b', plain);
    const after = planAndEvaluateFlow('ping', 'pc-a', 'pc-b', slow);
    expect(after).toEqual(before);
  });
});

describe('the orders of magnitude a network engineer expects', () => {
  it('two PCs on one switch: 0.1 to 0.3 ms', () => {
    const { ms } = ping(oneSwitch(), 'pc1', 'pc2');
    expect(ms).toBeGreaterThanOrEqual(0.1);
    expect(ms).toBeLessThanOrEqual(0.3);
  });

  it('a PC to a server through a router: under a millisecond, more than on one switch', () => {
    const t = topo(
      [
        host('pc', '192.168.10.11', '192.168.10.1'),
        switchWith('sw-1', [port(1), port(2)]),
        device({
          id: 'r',
          type: 'Router',
          ports: [port(1, { ip: '192.168.10.1', subnet: MASK }), port(2, { ip: '192.168.20.1', subnet: MASK })],
        }),
        switchWith('sw-2', [port(1), port(2)]),
        host('srv', '192.168.20.10', '192.168.20.1', { type: 'Server' }),
      ],
      [
        link('pc', 'sw-1', { sourceNic: 'nic-1', targetPort: 1 }),
        link('sw-1', 'r', { sourcePort: 2, targetPort: 1 }),
        link('r', 'sw-2', { sourcePort: 2, targetPort: 2 }),
        link('srv', 'sw-2', { sourceNic: 'nic-1', targetPort: 1 }),
      ]
    );
    const { ms } = ping(t, 'pc', 'srv');
    expect(ms).toBeGreaterThanOrEqual(0.4);
    expect(ms).toBeLessThan(1);
  });

  it('a laptop on Wi-Fi to a server: 3 to 4 ms, without a medium set', () => {
    const t = topo(
      [
        laptop('lap'),
        ap('ap'),
        switchWith('sw', [port(1), port(2)]),
        host('srv', '192.168.1.20', '', { type: 'Server' }),
      ],
      [
        link('lap', 'ap', { sourceNic: 'nic-1', targetNic: 'nic-2' }),
        link('ap', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
        link('srv', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      ]
    );
    const { ms } = ping(t, 'lap', 'srv');
    expect(ms).toBeGreaterThanOrEqual(3);
    expect(ms).toBeLessThanOrEqual(4);
  });

  it('two sites over the Internet, one on DSL and one on FTTH: about 40 ms', () => {
    const sites = twoSites(across('inet', { medium: 'dsl' }, { medium: 'ftth' }), [cloud('inet', 'Internet')]);
    const { ms } = ping(sites, 'pc-a', 'pc-b');
    expect(ms).toBeGreaterThanOrEqual(35);
    expect(ms).toBeLessThanOrEqual(45);
    expect(formatMs(ms)).toBe('40');
  });

  it('Milan to Rome on a 600 km fibre line: 6 to 8 ms', () => {
    const sites = twoSites([link('r-a', 'r-b', { sourcePort: 2, targetPort: 2, medium: 'fibre', lengthM: 600_000 })]);
    const { ms } = ping(sites, 'pc-a', 'pc-b');
    expect(ms).toBeGreaterThanOrEqual(6);
    expect(ms).toBeLessThanOrEqual(8);
  });

  it('Milan to Rome over MPLS: about 14 ms', () => {
    const sites = twoSites(
      across('mpls', { medium: 'fibre', lengthM: 5_000 }, { medium: 'fibre', lengthM: 575_000 }),
      [cloud('mpls', 'MPLS')]
    );
    const { ms } = ping(sites, 'pc-a', 'pc-b');
    expect(ms).toBeGreaterThanOrEqual(13);
    expect(ms).toBeLessThanOrEqual(15);
  });

  it('a site on a geostationary satellite: about 600 ms', () => {
    const sites = twoSites(across('inet', { medium: 'satellite' }, { medium: 'fibre' }), [cloud('inet', 'Internet')]);
    const { ms } = ping(sites, 'pc-a', 'pc-b');
    expect(ms).toBeGreaterThanOrEqual(550);
    expect(ms).toBeLessThanOrEqual(650);
  });
});

describe('how a time is written', () => {
  it('under 1 ms with two decimals, up to 10 ms with one, from 10 ms whole', () => {
    expect(formatMs(0)).toBe('0.00');
    expect(formatMs(0.24)).toBe('0.24');
    expect(formatMs(0.1 + 0.2)).toBe('0.30');
    expect(formatMs(0.994)).toBe('0.99');
    expect(formatMs(0.996)).toBe('1.0');
    expect(formatMs(7.44)).toBe('7.4');
    expect(formatMs(9.94)).toBe('9.9');
    expect(formatMs(9.96)).toBe('10');
    expect(formatMs(38.4)).toBe('38');
    expect(formatMs(583.7)).toBe('584');
  });

  it('a length in metres under a km, in km from there', () => {
    expect(formatLength(80)).toBe('80 m');
    expect(formatLength(999)).toBe('999 m');
    expect(formatLength(1000)).toBe('1 km');
    expect(formatLength(1500)).toBe('1.5 km');
    expect(formatLength(12_345)).toBe('12.3 km');
    expect(formatLength(600_000)).toBe('600 km');
  });

  it('what a time comes from, in the words of the terminal', () => {
    expect(describeLinkDelay(linkDelay(bare({ medium: 'fibre', lengthM: 600_000 }), undefined, undefined))).toBe('fibre, 600 km');
    expect(describeLinkDelay(linkDelay(bare(), laptop('l'), ap('ap')))).toBe('wifi, automatic');
    expect(describeLinkDelay(linkDelay(bare(), pc('a'), pc('b')))).toBe('copper, automatic');
  });
});
