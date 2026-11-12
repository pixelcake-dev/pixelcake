/**
 * Simulated failures: a device that is down, a cable that is cut. What the
 * engine answers, where the packet dies, and when it finds another way.
 */

import { describe, it, expect } from 'vitest';
import { device, host, link, nic, port, route, switchWith, topo } from '@/test/networkFixtures';
import type { NetworkConnection, NetworkDevice } from '@/types';
import type { Failures, Topology, TraceResult } from './types';
import { deadInterfaces, hasFailures, isDeviceDown, isLinkCut, withFailures } from './failures';
import { planAndEvaluateFlow } from './flows';
import { traceRoute } from './trace';

const P2P = '255.255.255.252';

const broken = (devices: string[] = [], connections: string[] = []): Failures => ({ devices, connections });

/** A switch with `count` plain ports */
const sw = (id: string, count = 4): NetworkDevice =>
  switchWith(id, Array.from({ length: count }, (_, i) => port(i + 1)));

/** Cable from the NIC of an end device to a port */
const cable = (hostId: string, otherId: string, portId: number): NetworkConnection =>
  link(hostId, otherId, { sourceNic: 'nic-1', targetPort: portId });

/** Cable between two ports */
const wire = (a: string, portA: number, b: string, portB: number, id?: string): NetworkConnection =>
  link(a, b, { sourcePort: portA, targetPort: portB, ...(id ? { id } : {}) });

/** `PC-1 > SW-1 > PC-2` */
const way = (result: TraceResult) => result.hops.map(hop => hop.label).join(' > ');

/** pc1 ─ sw1 ─ pc2, and pc3 on the same switch */
function oneSwitch(): Topology {
  return topo(
    [host('pc1', '192.168.1.11'), host('pc2', '192.168.1.12'), host('pc3', '192.168.1.13'), sw('sw1')],
    [cable('pc1', 'sw1', 1), cable('pc2', 'sw1', 2), cable('pc3', 'sw1', 3)]
  );
}

/** pc1 ─ sw1 ═ sw2 ─ pc2: two cables between the switches, `up-a` drawn first */
function doubleUplink(): Topology {
  return topo(
    [host('pc1', '192.168.1.11'), host('pc2', '192.168.1.12'), sw('sw1'), sw('sw2')],
    [
      cable('pc1', 'sw1', 1),
      cable('pc2', 'sw2', 1),
      wire('sw1', 3, 'sw2', 3, 'up-a'),
      wire('sw1', 4, 'sw2', 4, 'up-b'),
    ]
  );
}

/** pc1 ─ sw1, pc2 ─ sw2, and sw1, sw2, sw3 closed in a ring */
function ring(): Topology {
  return topo(
    [host('pc1', '192.168.1.11'), host('pc2', '192.168.1.12'), sw('sw1'), sw('sw2'), sw('sw3')],
    [
      cable('pc1', 'sw1', 1),
      cable('pc2', 'sw2', 1),
      wire('sw1', 2, 'sw2', 2, 'direct'),
      wire('sw1', 3, 'sw3', 3, 'round-1'),
      wire('sw3', 4, 'sw2', 4, 'round-2'),
    ]
  );
}

/**
 * Two networks joined by a main line (r1 ─ r2) and a backup line (r1 ─ r3 ─ r2).
 * r1 and r2 each carry two routes to the other network, main line first.
 */
function twoLines(): Topology {
  return topo(
    [
      host('pcA', '192.168.1.10', '192.168.1.1'),
      host('pcB', '192.168.2.10', '192.168.2.1'),
      device({
        id: 'r1',
        type: 'Router',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: '255.255.255.0' }),
          port(2, { ip: '10.0.0.1', subnet: P2P }),
          port(3, { ip: '10.0.1.1', subnet: P2P }),
        ],
        routes: [route('192.168.2.0/24', '10.0.0.2'), route('192.168.2.0/24', '10.0.1.2')],
      }),
      device({
        id: 'r2',
        type: 'Router',
        ports: [
          port(1, { ip: '192.168.2.1', subnet: '255.255.255.0' }),
          port(2, { ip: '10.0.0.2', subnet: P2P }),
          port(3, { ip: '10.0.2.2', subnet: P2P }),
        ],
        routes: [route('192.168.1.0/24', '10.0.0.1'), route('192.168.1.0/24', '10.0.2.1')],
      }),
      device({
        id: 'r3',
        type: 'Router',
        ports: [port(1, { ip: '10.0.1.2', subnet: P2P }), port(2, { ip: '10.0.2.1', subnet: P2P })],
        routes: [route('192.168.1.0/24', '10.0.1.1'), route('192.168.2.0/24', '10.0.2.2')],
      }),
    ],
    [
      cable('pcA', 'r1', 1),
      cable('pcB', 'r2', 1),
      wire('r1', 2, 'r2', 2, 'main'),
      wire('r1', 3, 'r3', 1, 'backup-1'),
      wire('r3', 2, 'r2', 3, 'backup-2'),
    ]
  );
}

describe('withFailures / hasFailures', () => {
  const base = oneSwitch();

  it('leaves the topology without a failures field when there is nothing to break', () => {
    expect(withFailures(base, undefined)).toEqual({ devices: base.devices, connections: base.connections });
    expect('failures' in withFailures(base, broken())).toBe(false);
    expect(hasFailures(undefined)).toBe(false);
    expect(hasFailures(broken())).toBe(false);
    expect(hasFailures(broken(['sw1']))).toBe(true);
    expect(hasFailures(broken([], ['pc1--sw1']))).toBe(true);
  });

  it('keeps only what exists, once', () => {
    const applied = withFailures(base, broken(['sw1', 'ghost', 'sw1'], ['pc1--sw1', 'no-such-cable']));
    expect(applied.failures).toEqual({ devices: ['sw1'], connections: ['pc1--sw1'] });
    expect(isDeviceDown(applied, 'sw1')).toBe(true);
    expect(isDeviceDown(applied, 'pc1')).toBe(false);
    expect(isLinkCut(applied, 'pc1--sw1')).toBe(true);
    expect(isLinkCut(applied, 'pc2--sw1')).toBe(false);
  });

  it('drops a list made only of things that are not in the drawing', () => {
    expect('failures' in withFailures(base, broken(['ghost'], ['no-such-cable']))).toBe(false);
  });

  it('never changes the drawing', () => {
    const before = JSON.stringify(base);
    const applied = withFailures(base, broken(['sw1'], ['pc1--sw1']));
    traceRoute('pc1', 'pc2', applied);
    expect(JSON.stringify(base)).toBe(before);
    expect(applied.devices).toBe(base.devices);
    expect(applied.connections).toBe(base.connections);
  });

  it('takes failures away again when applied to a broken topology', () => {
    const applied = withFailures(base, broken(['sw1']));
    expect(traceRoute('pc1', 'pc2', withFailures(applied, undefined)).verdict).toBe('success');
  });
});

describe('a device that is down', () => {
  it('sends nothing: the trace stops on it', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(oneSwitch(), broken(['pc1'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('pc1 is down');
    expect(result.hops).toEqual([
      { deviceId: 'pc1', label: 'pc1', deviceType: 'PC', status: 'blocked', note: 'pc1 is down' },
    ]);
  });

  it('takes nothing: the packet dies on the last device before it', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(oneSwitch(), broken(['pc2'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('pc2 is down');
    expect(way(result)).toBe('pc1 > sw1');
    expect(result.hops[1]).toMatchObject({ status: 'blocked', note: 'pc2 is down' });
  });

  it('carries nothing for the others', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(oneSwitch(), broken(['sw1'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('sw1 is down');
    expect(way(result)).toBe('pc1');
  });

  it('changes nothing for traffic that does not go through it', () => {
    const intact = traceRoute('pc1', 'pc2', oneSwitch());
    const result = traceRoute('pc1', 'pc2', withFailures(oneSwitch(), broken(['pc3'])));
    expect(result).toEqual(intact);
    expect(result.verdict).toBe('success');
  });

  it('stops a whole exchange on the leg it breaks', () => {
    const flow = planAndEvaluateFlow('ping', 'pc1', 'pc2', withFailures(oneSwitch(), broken(['pc2'])));
    expect(flow.verdict).toBe('blocked');
    expect(flow.failureReason).toBe('request: pc2 is down');
    expect(flow.legs).toHaveLength(1);
    expect(flow.animationPath).toEqual(['pc1', 'sw1']);
  });
});

describe('a cable that is cut', () => {
  it('carries nothing, and the reason names it', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(oneSwitch(), broken([], ['pc2--sw1'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('link sw1–pc2 is down');
    expect(way(result)).toBe('pc1 > sw1');
  });

  it('is not the same as no cable at all: the two devices are still joined on the drawing', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(oneSwitch(), broken([], ['pc1--sw1'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('link pc1–sw1 is down');
  });

  it('is routed around when a second cable joins the same two switches', () => {
    const intact = traceRoute('pc1', 'pc2', doubleUplink());
    expect(intact.hops.map(hop => hop.viaConnectionId)).toEqual([undefined, 'pc1--sw1', 'up-a', 'pc2--sw2']);

    const result = traceRoute('pc1', 'pc2', withFailures(doubleUplink(), broken([], ['up-a'])));
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('pc1 > sw1 > sw2 > pc2');
    expect(result.hops.map(hop => hop.viaConnectionId)).toEqual([undefined, 'pc1--sw1', 'up-b', 'pc2--sw2']);
  });

  it('stops the traffic when both cables are cut', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(doubleUplink(), broken([], ['up-a', 'up-b'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('link sw1–sw2 is down');
    expect(way(result)).toBe('pc1 > sw1');
  });

  it('is routed around the long way in a ring of switches', () => {
    expect(way(traceRoute('pc1', 'pc2', ring()))).toBe('pc1 > sw1 > sw2 > pc2');

    const result = traceRoute('pc1', 'pc2', withFailures(ring(), broken([], ['direct'])));
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('pc1 > sw1 > sw3 > sw2 > pc2');
    expect(result.hops.map(hop => hop.viaConnectionId)).toEqual([
      undefined,
      'pc1--sw1',
      'round-1',
      'round-2',
      'pc2--sw2',
    ]);
  });

  it('with the ring cut twice there is no way left, and the cable on the short way is named', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(ring(), broken([], ['direct', 'round-2'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('link sw1–sw2 is down');
  });

  it('a switch of the ring that is down is routed around like a cut cable', () => {
    // pc2 is behind sw2: with sw3 down the direct cable still works
    const result = traceRoute('pc1', 'pc2', withFailures(ring(), broken(['sw3'])));
    expect(result).toEqual(traceRoute('pc1', 'pc2', ring()));
  });
});

describe('the cable each hop was reached by', () => {
  it('is on every hop but the first, also when the trace is blocked', () => {
    const result = traceRoute('pc1', 'pc2', withFailures(oneSwitch(), broken(['pc2'])));
    expect(result.hops.map(hop => hop.viaConnectionId)).toEqual([undefined, 'pc1--sw1']);
  });

  it('lines the animation up with the cables, one per stretch, there and back', () => {
    const flow = planAndEvaluateFlow('ping', 'pc1', 'pc2', withFailures(doubleUplink(), broken([], ['up-a'])));
    expect(flow.animationPath).toEqual(['pc1', 'sw1', 'sw2', 'pc2', 'sw2', 'sw1', 'pc1']);
    expect(flow.animationLinks).toEqual(['pc1--sw1', 'up-b', 'pc2--sw2', 'pc2--sw2', 'up-b', 'pc1--sw1']);
  });

  it('has no cables for an exchange that never leaves its source', () => {
    const flow = planAndEvaluateFlow('ping', 'pc1', 'pc2', withFailures(oneSwitch(), broken(['pc1'])));
    expect(flow.animationPath).toEqual(['pc1']);
    expect(flow.animationLinks).toEqual([]);
  });

  it('crosses routers too', () => {
    const result = traceRoute('pcA', 'pcB', twoLines());
    expect(result.hops.map(hop => hop.viaConnectionId)).toEqual([undefined, 'pcA--r1', 'main', 'pcB--r2']);
  });
});

describe('a route whose line is down', () => {
  it('uses the main line while it works', () => {
    const result = traceRoute('pcA', 'pcB', twoLines());
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('pcA > r1 > r2 > pcB');
    expect(result.notes).toEqual([]);
  });

  it('gives way to the next route for the same network, and says so', () => {
    const result = traceRoute('pcA', 'pcB', withFailures(twoLines(), broken([], ['main'])));
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('pcA > r1 > r3 > r2 > pcB');
    expect(result.hops[1].note).toBe('routed: 192.168.2.0/24 via 10.0.1.2 (port 3)');
    expect(result.notes).toEqual([
      'r1: the route 192.168.2.0/24 via 10.0.0.2 is unusable (link r1–r2 is down), ' +
        'the route 192.168.2.0/24 via 10.0.1.2 is used instead',
    ]);
  });

  it('comes back the same way: the other router has withdrawn its route too', () => {
    const flow = planAndEvaluateFlow('ping', 'pcA', 'pcB', withFailures(twoLines(), broken([], ['main'])));
    expect(flow.verdict).toBe('success');
    expect(flow.animationPath).toEqual(['pcA', 'r1', 'r3', 'r2', 'pcB', 'r2', 'r3', 'r1', 'pcA']);
    expect(flow.notes).toContain(
      'reply: r2: the route 192.168.1.0/24 via 10.0.0.1 is unusable (link r2–r1 is down), ' +
        'the route 192.168.1.0/24 via 10.0.2.1 is used instead'
    );
  });

  it('is withdrawn as well when the router at the other end of the cable is down', () => {
    const result = traceRoute('pcA', 'pcB', withFailures(twoLines(), broken(['r2'])));
    expect(result.verdict).toBe('blocked');
    // r1 falls back on the backup line; r3 has one route only, and it leads to r2
    expect(way(result)).toBe('pcA > r1 > r3');
    expect(result.failureReason).toBe('r2 is down');
    expect(result.notes[0]).toContain('is unusable (r2 is down)');
  });

  it('does not matter while it is the backup that breaks', () => {
    const intact = traceRoute('pcA', 'pcB', twoLines());
    expect(traceRoute('pcA', 'pcB', withFailures(twoLines(), broken(['r3'])))).toEqual(intact);
    expect(traceRoute('pcA', 'pcB', withFailures(twoLines(), broken([], ['backup-1'])))).toEqual(intact);
  });

  it('stays, and names the broken line, when no other route is left', () => {
    const result = traceRoute('pcA', 'pcB', withFailures(twoLines(), broken([], ['main', 'backup-1'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('link r1–r2 is down');
    expect(way(result)).toBe('pcA > r1');
    expect(result.notes).toEqual([]);
  });

  it('falls back from one default route to the next', () => {
    const drawing = topo(
      [
        host('pc', '192.168.1.10', '192.168.1.1'),
        host('srv', '8.8.8.8', '8.8.8.1'),
        device({
          id: 'edge',
          type: 'Router',
          ports: [
            port(1, { ip: '192.168.1.1', subnet: '255.255.255.0' }),
            port(2, { ip: '203.0.113.2', subnet: P2P }),
            port(3, { ip: '198.51.100.2', subnet: P2P }),
          ],
          routes: [route('0.0.0.0/0', '203.0.113.1'), route('0.0.0.0/0', '198.51.100.1')],
        }),
        device({
          id: 'ispA',
          type: 'Router',
          ports: [port(1, { ip: '203.0.113.1', subnet: P2P }), port(2, { ip: '8.8.8.1', subnet: '255.255.255.0' })],
        }),
        device({
          id: 'ispB',
          type: 'Router',
          ports: [port(1, { ip: '198.51.100.1', subnet: P2P }), port(2, { ip: '8.8.8.2', subnet: '255.255.255.0' })],
        }),
        sw('out'),
      ],
      [
        cable('pc', 'edge', 1),
        wire('edge', 2, 'ispA', 1, 'line-a'),
        wire('edge', 3, 'ispB', 1, 'line-b'),
        wire('ispA', 2, 'out', 1),
        wire('ispB', 2, 'out', 2),
        cable('srv', 'out', 3),
      ]
    );

    expect(way(traceRoute('pc', 'srv', drawing))).toBe('pc > edge > ispA > out > srv');

    const result = traceRoute('pc', 'srv', withFailures(drawing, broken([], ['line-a'])));
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('pc > edge > ispB > out > srv');
    expect(result.notes).toEqual([
      'edge: the default route via 203.0.113.1 is unusable (link edge–ispA is down), ' +
        'the default route via 198.51.100.1 is used instead',
    ]);
  });

  it('is kept while its cable works, even if the next router is dead behind a switch', () => {
    // r1 ─ mid ─ r2: r1 still has carrier on its port, so it keeps sending to
    // r2 and never tries its second route (a static route is not a probe)
    const drawing = topo(
      [
        host('pcA', '192.168.1.10', '192.168.1.1'),
        host('pcB', '192.168.2.10', '192.168.2.1'),
        device({
          id: 'r1',
          type: 'Router',
          ports: [
            port(1, { ip: '192.168.1.1', subnet: '255.255.255.0' }),
            port(2, { ip: '10.0.0.1', subnet: '255.255.255.0' }),
            port(3, { ip: '10.0.1.1', subnet: P2P }),
          ],
          routes: [route('192.168.2.0/24', '10.0.0.2'), route('192.168.2.0/24', '10.0.1.2')],
        }),
        device({
          id: 'r2',
          type: 'Router',
          ports: [
            port(1, { ip: '192.168.2.1', subnet: '255.255.255.0' }),
            port(2, { ip: '10.0.0.2', subnet: '255.255.255.0' }),
          ],
          routes: [route('192.168.1.0/24', '10.0.0.1')],
        }),
        device({
          id: 'r3',
          type: 'Router',
          ports: [port(1, { ip: '10.0.1.2', subnet: P2P }), port(2, { ip: '192.168.2.2', subnet: '255.255.255.0' })],
        }),
        sw('mid'),
        sw('far'),
      ],
      [
        cable('pcA', 'r1', 1),
        wire('r1', 2, 'mid', 1),
        wire('mid', 2, 'r2', 2),
        wire('r1', 3, 'r3', 1),
        wire('r2', 1, 'far', 1),
        wire('r3', 2, 'far', 2),
        cable('pcB', 'far', 3),
      ]
    );

    const result = traceRoute('pcA', 'pcB', withFailures(drawing, broken(['r2'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('r2 is down');
    expect(way(result)).toBe('pcA > r1 > mid');
    expect(result.notes).toEqual([]);
  });

  it('never sends elsewhere what belongs to a network the device is attached to', () => {
    // r2 has a default route, and pcB hangs off its port 1: with that cable
    // cut the answer is the cable, not a trip along the default route
    const base = twoLines();
    const drawing: Topology = {
      ...base,
      devices: base.devices.map(d => (d.id === 'r2' ? { ...d, gateway: '10.0.0.1' } : d)),
    };
    const result = traceRoute('pcA', 'pcB', withFailures(drawing, broken([], ['pcB--r2'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('link r2–pcB is down');
    expect(way(result)).toBe('pcA > r1 > r2');
    expect(result.notes).toEqual([]);
  });

  it('does not fall back on a wider network the device happens to be attached to', () => {
    // r1 reaches 10.9.0.0/16 through r2, and sits itself in 10.0.0.0/8 on
    // another port: with the line to r2 cut, the answer is the line, not a
    // search for 10.9.0.10 on the wide network
    const drawing = topo(
      [
        host('pcA', '192.168.1.10', '192.168.1.1'),
        host('pcB', '10.9.0.10', '10.9.0.1'),
        device({
          id: 'r1',
          type: 'Router',
          ports: [
            port(1, { ip: '192.168.1.1', subnet: '255.255.255.0' }),
            port(2, { ip: '172.16.0.1', subnet: P2P }),
            port(3, { ip: '10.0.0.1', subnet: '255.0.0.0' }),
          ],
          routes: [route('10.9.0.0/16', '172.16.0.2')],
        }),
        device({
          id: 'r2',
          type: 'Router',
          ports: [port(1, { ip: '10.9.0.1', subnet: '255.255.0.0' }), port(2, { ip: '172.16.0.2', subnet: P2P })],
          routes: [route('192.168.1.0/24', '172.16.0.1')],
        }),
        sw('wide'),
      ],
      [
        cable('pcA', 'r1', 1),
        wire('r1', 2, 'r2', 2, 'line'),
        wire('r1', 3, 'wide', 1),
        cable('pcB', 'r2', 1),
      ]
    );
    expect(traceRoute('pcA', 'pcB', drawing).verdict).toBe('success');

    const result = traceRoute('pcA', 'pcB', withFailures(drawing, broken([], ['line'])));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('link r1–r2 is down');
    expect(result.notes).toEqual([]);
  });

  it('works for an end device with two cards, each with its own gateway', () => {
    const drawing = topo(
      [
        device({
          id: 'srv',
          ip: '192.168.1.10',
          nics: [
            nic({ id: 'nic-1', name: 'eth0', ip: '192.168.1.10', gateway: '192.168.1.1' }),
            nic({ id: 'nic-2', name: 'eth1', ip: '192.168.9.10', gateway: '192.168.9.1' }),
          ],
        }),
        host('far', '10.9.9.9', '10.9.9.1'),
        device({
          id: 'gw1',
          type: 'Router',
          ports: [port(1, { ip: '192.168.1.1', subnet: '255.255.255.0' }), port(2, { ip: '10.9.9.1', subnet: '255.255.255.0' })],
        }),
        device({
          id: 'gw2',
          type: 'Router',
          ports: [port(1, { ip: '192.168.9.1', subnet: '255.255.255.0' }), port(2, { ip: '10.9.9.2', subnet: '255.255.255.0' })],
        }),
        sw('out'),
      ],
      [
        link('srv', 'gw1', { id: 'first', sourceNic: 'nic-1', targetPort: 1 }),
        link('srv', 'gw2', { id: 'second', sourceNic: 'nic-2', targetPort: 1 }),
        wire('gw1', 2, 'out', 1),
        wire('gw2', 2, 'out', 2),
        cable('far', 'out', 3),
      ]
    );
    expect(way(traceRoute('srv', 'far', drawing))).toBe('srv > gw1 > out > far');

    const result = traceRoute('srv', 'far', withFailures(drawing, broken([], ['first'])));
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('srv > gw2 > out > far');
    expect(result.notes[0]).toBe(
      'srv: the default route via 192.168.1.1 is unusable (link srv–gw1 is down), ' +
        'the default route via 192.168.9.1 is used instead'
    );
  });
});

describe('deadInterfaces', () => {
  const drawing = topo(
    [
      device({
        id: 'r1',
        type: 'Router',
        ports: [port(1, { ip: '10.0.0.1' }), port(2, { ip: '10.0.1.1' }), port(3, { ip: '10.0.2.1' }), port(4)],
      }),
      sw('a'),
      sw('b'),
      sw('c'),
    ],
    [
      wire('r1', 1, 'a', 1, 'one'),
      wire('r1', 2, 'b', 1, 'two-first'),
      wire('r1', 2, 'c', 1, 'two-second'),
      link('r1', 'c', { id: 'loose' }),
    ]
  );
  const r1 = drawing.devices[0];

  it('is empty when nothing is broken', () => {
    expect(deadInterfaces(r1, drawing).size).toBe(0);
    expect(deadInterfaces(r1, withFailures(drawing, broken())).size).toBe(0);
  });

  it('holds an interface whose only cable is cut, with the reason', () => {
    const dead = deadInterfaces(r1, withFailures(drawing, broken([], ['one'])));
    expect([...dead]).toEqual([['port:1', 'link r1–a is down']]);
  });

  it('holds an interface whose cable leads to a device that is down', () => {
    const dead = deadInterfaces(r1, withFailures(drawing, broken(['a'])));
    expect([...dead]).toEqual([['port:1', 'a is down']]);
  });

  it('keeps an interface alive while one of its cables works, whatever the order', () => {
    expect(deadInterfaces(r1, withFailures(drawing, broken([], ['two-first']))).size).toBe(0);
    expect(deadInterfaces(r1, withFailures(drawing, broken([], ['two-second']))).size).toBe(0);
    const both = deadInterfaces(r1, withFailures(drawing, broken([], ['two-first', 'two-second'])));
    expect([...both]).toEqual([['port:2', 'link r1–b is down']]);
  });

  it('says nothing of an interface with no cable, nor of a cable attached to no interface', () => {
    const dead = deadInterfaces(r1, withFailures(drawing, broken([], ['loose'])));
    expect(dead.size).toBe(0);
  });
});

describe('a device that only passes traffic on (the Internet symbol)', () => {
  /**
   * out ─ net ─ rA ─ lan ─ tgt
   *           └ rB ─┘
   * `out` points at a gateway that is not in the drawing: the symbol takes
   * the traffic and hands it to the router closest to the destination.
   */
  function twoDoors(): Topology {
    return topo(
      [
        host('out', '9.9.9.9', '9.9.9.254'),
        host('tgt', '192.168.1.10', '192.168.1.1'),
        device({
          id: 'net',
          type: 'Cloud',
          nics: [nic({ id: 'nic-1', name: 'eth0' }), nic({ id: 'nic-2', name: 'eth1' }), nic({ id: 'nic-3', name: 'eth2' })],
        }),
        device({
          id: 'rA',
          type: 'Router',
          ports: [port(1, { ip: '1.1.1.1', subnet: P2P }), port(2, { ip: '192.168.1.1', subnet: '255.255.255.0' })],
        }),
        device({
          id: 'rB',
          type: 'Router',
          ports: [port(1, { ip: '2.2.2.1', subnet: P2P }), port(2, { ip: '192.168.1.2', subnet: '255.255.255.0' })],
        }),
        sw('lan'),
      ],
      [
        link('out', 'net', { sourceNic: 'nic-1', targetNic: 'nic-1' }),
        link('net', 'rA', { sourceNic: 'nic-2', targetPort: 1 }),
        link('net', 'rB', { sourceNic: 'nic-3', targetPort: 1 }),
        wire('rA', 2, 'lan', 1, 'door-a'),
        wire('rB', 2, 'lan', 2, 'door-b'),
        cable('tgt', 'lan', 3),
      ]
    );
  }

  it('hands the packet to the first of two equally close routers', () => {
    const result = traceRoute('out', 'tgt', twoDoors());
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('out > net > rA > lan > tgt');
  });

  it('hands it to the router that still reaches the destination', () => {
    const result = traceRoute('out', 'tgt', withFailures(twoDoors(), broken([], ['door-a'])));
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('out > net > rB > lan > tgt');
  });

  it('does not hand it to a router that is down', () => {
    const result = traceRoute('out', 'tgt', withFailures(twoDoors(), broken(['rA'])));
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('out > net > rB > lan > tgt');
  });
});
