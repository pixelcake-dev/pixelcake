import { describe, it, expect } from 'vitest';
import type { NetworkDevice, Port } from '@/types';
import { device, host, link, port, switchWith, topo } from '@/test/networkFixtures';
import type { Topology } from './types';
import { describePortVlan, isVlanAware, portVlanMode } from './vlan';
import { traceRoute } from './trace';
import { planAndEvaluateFlow } from './flows';

// ---------- how a port reads its configuration ----------

describe('portVlanMode', () => {
  it('an untouched port is an access port in the default VLAN', () => {
    expect(portVlanMode(port(1))).toEqual({ kind: 'access', vlan: 1, explicit: false });
    expect(portVlanMode(port(1, { portType: 'access' }))).toEqual({ kind: 'access', vlan: 1, explicit: false });
    expect(portVlanMode(port(1, { vlan: [] }))).toEqual({ kind: 'access', vlan: 1, explicit: false });
    expect(portVlanMode(undefined)).toEqual({ kind: 'access', vlan: 1, explicit: false });
  });

  it('a number is an access VLAN, a list is a trunk', () => {
    expect(portVlanMode(port(1, { vlan: 10 }))).toEqual({ kind: 'access', vlan: 10, explicit: true });
    expect(portVlanMode(port(1, { portType: 'trunk', vlan: [10, 20] }))).toEqual({
      kind: 'trunk',
      vlans: [10, 20],
    });
  });

  it('a trunk without a list carries every VLAN', () => {
    expect(portVlanMode(port(1, { portType: 'trunk' }))).toEqual({ kind: 'trunk', vlans: [] });
  });

  it('reads the odd combinations the way they were meant', () => {
    // a single VLAN typed on a trunk, a one-entry list left on an access port
    expect(portVlanMode(port(1, { portType: 'trunk', vlan: 10 }))).toEqual({ kind: 'trunk', vlans: [10] });
    expect(portVlanMode(port(1, { portType: 'access', vlan: [10] }))).toEqual({
      kind: 'access',
      vlan: 10,
      explicit: true,
    });
    expect(portVlanMode(port(1, { portType: 'access', vlan: [10, 20] }))).toEqual({
      kind: 'trunk',
      vlans: [10, 20],
    });
  });

  it('describes a port for a message', () => {
    expect(describePortVlan(portVlanMode(port(1)))).toBe('in the default VLAN 1');
    expect(describePortVlan(portVlanMode(port(1, { vlan: 10 })))).toBe('an access port in VLAN 10');
    expect(describePortVlan(portVlanMode(port(1, { portType: 'trunk', vlan: [10, 20] })))).toBe(
      'a trunk carrying VLANs [10,20]'
    );
    expect(describePortVlan(portVlanMode(port(1, { portType: 'trunk' })))).toBe(
      'a trunk carrying every VLAN'
    );
  });
});

describe('isVlanAware', () => {
  it('a switch applies VLANs port by port once one of its ports has a VLAN', () => {
    expect(isVlanAware(switchWith('sw', [port(1), port(2, { portType: 'trunk' })]))).toBe(false);
    expect(isVlanAware(switchWith('sw', [port(1), port(2, { vlan: 10 })]))).toBe(true);
    expect(isVlanAware(switchWith('sw', [port(1, { vlan: [] })]))).toBe(false);
    // the device-level list alone does not make it VLAN-aware
    expect(isVlanAware(switchWith('sw', [port(1)], { vlan: [10] }))).toBe(false);
  });
});

// ---------- one switch ----------

/** PC-1, PC-2, PC-3 on ports 1, 2, 3 of SW-1, one subnet */
function oneSwitch(ports: Record<number, Partial<Port>> = {}, sw: Partial<NetworkDevice> = {}): Topology {
  return topo(
    [
      host('pc1', '192.168.1.11', '', { label: 'PC-1' }),
      host('pc2', '192.168.1.12', '', { label: 'PC-2' }),
      host('pc3', '192.168.1.13', '', { label: 'PC-3' }),
      switchWith(
        'sw1',
        [1, 2, 3, 4].map(id => port(id, ports[id])),
        { label: 'SW-1', ip: '192.168.1.2', ...sw }
      ),
    ],
    [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 1 }),
      link('pc2', 'sw1', { sourceNic: 'nic-1', targetPort: 2 }),
      link('pc3', 'sw1', { sourceNic: 'nic-1', targetPort: 3 }),
    ]
  );
}

describe('VLANs on one switch', () => {
  it('without any VLAN every port talks to every other, and the trace says nothing about VLANs', () => {
    const result = traceRoute('pc1', 'pc3', oneSwitch());
    expect(result.verdict).toBe('success');
    expect(result.hops[1].note).toBeUndefined();
    expect(result.notes).toEqual([]);
  });

  it('two ports in the same VLAN talk, and the switch hop names the VLAN', () => {
    const result = traceRoute('pc1', 'pc2', oneSwitch({ 1: { vlan: 10 }, 2: { vlan: 10 } }));
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => [h.deviceId, h.note])).toEqual([
      ['pc1', undefined],
      ['sw1', 'VLAN 10'],
      ['pc2', undefined],
    ]);
    expect(result.notes).toEqual([]);
  });

  it('two ports in different VLANs are isolated, both ways', () => {
    const t = oneSwitch({ 1: { vlan: 10 }, 2: { vlan: 20 } });

    const out = traceRoute('pc1', 'pc2', t);
    expect(out.verdict).toBe('blocked');
    expect(out.failureReason).toBe(
      'VLAN 10 does not leave through port 2 on SW-1: it is an access port in VLAN 20'
    );
    expect(out.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['sw1', 'blocked'],
    ]);

    expect(traceRoute('pc2', 'pc1', t).failureReason).toBe(
      'VLAN 20 does not leave through port 1 on SW-1: it is an access port in VLAN 10'
    );
  });

  it('once a port has a VLAN, the ports nobody touched are in VLAN 1', () => {
    const t = oneSwitch({ 1: { vlan: 10 }, 2: { vlan: 10 } });

    const fromVlan = traceRoute('pc1', 'pc3', t);
    expect(fromVlan.verdict).toBe('blocked');
    expect(fromVlan.failureReason).toBe(
      'VLAN 10 does not leave through port 3 on SW-1: it is in the default VLAN 1'
    );

    const fromDefault = traceRoute('pc3', 'pc1', t);
    expect(fromDefault.failureReason).toBe(
      'VLAN 1 does not leave through port 1 on SW-1: it is an access port in VLAN 10'
    );
  });

  it('a ping fails on the request, not on the reply, when the VLANs differ', () => {
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc2', oneSwitch({ 1: { vlan: 10 }, 2: { vlan: 20 } }));
    expect(result.verdict).toBe('blocked');
    expect(result.legs).toHaveLength(1);
  });

  it('drops a VLAN that the switch does not have in its own list', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      oneSwitch({ 1: { vlan: 10 }, 2: { vlan: 10 } }, { vlan: [20, 30] })
    );
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('VLAN 10 is not defined on SW-1 (it carries [20,30])');
  });

  it('the default VLAN exists on every switch, whatever its list says', () => {
    const t = oneSwitch({ 1: { vlan: 10 } }, { vlan: [10] });
    expect(traceRoute('pc2', 'pc3', t).verdict).toBe('success'); // both in VLAN 1
  });

  it('answers on its own address in VLAN 1 only', () => {
    const t = oneSwitch({ 1: { vlan: 10 } });

    expect(traceRoute('pc3', 'sw1', t).verdict).toBe('success');

    const fromVlan10 = traceRoute('pc1', 'sw1', t);
    expect(fromVlan10.verdict).toBe('blocked');
    expect(fromVlan10.failureReason).toBe(
      'SW-1 answers on 192.168.1.2 in VLAN 1 only: the traffic reaches it in VLAN 10'
    );

    // and speaks from VLAN 1
    expect(traceRoute('sw1', 'pc3', t).verdict).toBe('success');
    expect(traceRoute('sw1', 'pc1', t).failureReason).toBe(
      'VLAN 1 does not leave through port 1 on SW-1: it is an access port in VLAN 10'
    );
  });

  it('a device that declares its own VLAN must sit on a port of that VLAN', () => {
    const t = oneSwitch({ 1: { vlan: 10 }, 2: { vlan: 10 } });
    const declared = (vlan: number[]): Topology =>
      topo(
        t.devices.map(d => (d.id === 'pc1' ? { ...d, vlan } : d)),
        t.connections
      );

    expect(traceRoute('pc1', 'pc2', declared([10])).verdict).toBe('success');

    const wrong = traceRoute('pc1', 'pc2', declared([20]));
    expect(wrong.verdict).toBe('blocked');
    expect(wrong.failureReason).toBe(
      'VLAN mismatch: PC-1 is in VLAN [20] but port 1 on SW-1 is an access port in VLAN 10'
    );
    // and it is told the same when it is the one receiving
    expect(traceRoute('pc2', 'pc1', declared([20])).failureReason).toBe(
      'VLAN mismatch: PC-1 is in VLAN [20] but port 1 on SW-1 is an access port in VLAN 10'
    );
  });
});

// ---------- device-level VLANs only (no port has one) ----------

describe('VLANs declared on devices, switch without port VLANs', () => {
  it('two devices that declare different VLANs do not talk', () => {
    const t = oneSwitch();
    const declared = topo(
      t.devices.map(d => (d.id === 'pc1' ? { ...d, vlan: [10] } : d.id === 'pc2' ? { ...d, vlan: [20] } : d)),
      t.connections
    );

    const result = traceRoute('pc1', 'pc2', declared);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('VLAN mismatch: PC-1 is in VLAN [10], PC-2 in VLAN [20]');
    expect(result.hops[result.hops.length - 1]).toMatchObject({ deviceId: 'pc2', status: 'blocked' });

    // a device that declares nothing takes what arrives
    expect(traceRoute('pc1', 'pc3', declared).verdict).toBe('success');
  });
});

// ---------- two switches ----------

/** PC-1 — SW-A port 1 … SW-A port 8 — SW-B port 8 … SW-B port 1 — PC-2 */
function twoSwitches(
  a: Record<number, Partial<Port>>,
  b: Record<number, Partial<Port>>,
  swB: Partial<NetworkDevice> = {}
): Topology {
  return topo(
    [
      host('pc1', '192.168.1.11', '', { label: 'PC-1' }),
      host('pc2', '192.168.1.12', '', { label: 'PC-2' }),
      switchWith('swa', [port(1, a[1]), port(8, a[8])], { label: 'SW-A' }),
      switchWith('swb', [port(1, b[1]), port(8, b[8])], { label: 'SW-B', ...swB }),
    ],
    [
      link('pc1', 'swa', { sourceNic: 'nic-1', targetPort: 1 }),
      link('swa', 'swb', { sourcePort: 8, targetPort: 8 }),
      link('swb', 'pc2', { sourcePort: 1, targetNic: 'nic-1' }),
    ]
  );
}

const access10 = { vlan: 10 };
const trunk = (...vlans: number[]): Partial<Port> => ({ portType: 'trunk', vlan: vlans });

describe('VLANs across two switches', () => {
  it('a trunk carries the VLAN from one switch to the other', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      twoSwitches({ 1: access10, 8: trunk(10, 20) }, { 1: access10, 8: trunk(10, 20) })
    );
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => [h.deviceId, h.note])).toEqual([
      ['pc1', undefined],
      ['swa', 'VLAN 10'],
      ['swb', 'VLAN 10'],
      ['pc2', undefined],
    ]);
  });

  it('a trunk without a list carries it too', () => {
    const all: Partial<Port> = { portType: 'trunk' };
    const result = traceRoute('pc1', 'pc2', twoSwitches({ 1: access10, 8: all }, { 1: access10, 8: all }));
    expect(result.verdict).toBe('success');
  });

  it('the uplink left as it was stops the VLAN at the first switch', () => {
    const result = traceRoute('pc1', 'pc2', twoSwitches({ 1: access10 }, { 1: access10, 8: trunk(10) }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'VLAN 10 does not leave through port 8 on SW-A: it is in the default VLAN 1'
    );
    expect(result.hops[result.hops.length - 1]).toMatchObject({ deviceId: 'swa', status: 'blocked' });
  });

  it('names the port on the way to the destination, not a neighbour that is in another VLAN', () => {
    // PC-3 sits on SW-A in VLAN 20, cabled before the uplink: its port also
    // refuses VLAN 10, but it has nothing to do with reaching PC-2
    const base = twoSwitches({ 1: access10 }, { 1: access10, 8: trunk(10) });
    const swa = base.devices.find(d => d.id === 'swa');
    const t = topo(
      [
        ...base.devices.map(d =>
          d.id === 'swa' ? { ...d, ports: [...(swa?.ports ?? []), port(2, { vlan: 20 })] } : d
        ),
        host('pc3', '192.168.1.13', '', { label: 'PC-3' }),
      ],
      [
        base.connections[0],
        link('pc3', 'swa', { sourceNic: 'nic-1', targetPort: 2 }),
        ...base.connections.slice(1),
      ]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.failureReason).toBe(
      'VLAN 10 does not leave through port 8 on SW-A: it is in the default VLAN 1'
    );
  });

  it('a trunk that does not list the VLAN stops it', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      twoSwitches({ 1: access10, 8: trunk(20) }, { 1: access10, 8: trunk(10, 20) })
    );
    expect(result.failureReason).toBe(
      'VLAN 10 does not leave through port 8 on SW-A: it is a trunk carrying VLANs [20]'
    );
  });

  it('the far end of the trunk must carry the VLAN as well', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      twoSwitches({ 1: access10, 8: trunk(10, 20) }, { 1: access10, 8: trunk(20) })
    );
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'port 8 on SW-B is a trunk carrying VLANs [20]: VLAN 10 is not carried'
    );
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['swa', 'forwarded'],
      ['swb', 'blocked'],
    ]);
  });

  it('an access port drops traffic that arrives tagged with another VLAN', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      twoSwitches({ 1: access10, 8: trunk(10) }, { 1: access10, 8: { vlan: 30 } })
    );
    expect(result.failureReason).toBe(
      'port 8 on SW-B is an access port in VLAN 30: it drops traffic tagged VLAN 10'
    );
  });

  it('the second switch must know the VLAN', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      twoSwitches({ 1: access10, 8: trunk(10) }, { 1: access10, 8: trunk(10) }, { vlan: [20] })
    );
    expect(result.failureReason).toBe('VLAN 10 is not defined on SW-B (it carries [20])');
  });

  it('two access ports facing each other join their VLANs, as cabled', () => {
    // untagged on the cable: VLAN 10 on SW-A continues as VLAN 20 on SW-B
    const result = traceRoute(
      'pc1',
      'pc2',
      twoSwitches({ 1: access10, 8: access10 }, { 1: { vlan: 20 }, 8: { vlan: 20 } })
    );
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => h.note)).toEqual([undefined, 'VLAN 10', 'VLAN 20', undefined]);
  });

  it('the default VLAN crosses a trunk untagged and lands in the default VLAN', () => {
    // PC-1 on an untouched port of a VLAN-aware switch, PC-2 likewise
    const result = traceRoute('pc1', 'pc2', twoSwitches({ 8: trunk(1, 10) }, { 8: trunk(1, 10) }));
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => h.note)).toEqual([undefined, 'VLAN 1', 'VLAN 1', undefined]);
  });

  it('a device plugged into a trunk gets tagged traffic it does not expect', () => {
    // SW-B has no port VLAN: it hands the tagged frame to PC-2 as it is
    const result = traceRoute('pc1', 'pc2', twoSwitches({ 1: access10, 8: trunk(10) }, {}));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-2 receives traffic tagged VLAN 10 (port 8 on SW-A is a trunk) and does not expect a tag'
    );
    expect(result.hops[result.hops.length - 1]).toMatchObject({ deviceId: 'pc2', status: 'blocked' });
  });
});

// ---------- routing between VLANs ----------

/**
 * One switch, two VLANs, one router with a port in each:
 * PC-A (VLAN 10, 192.168.10.11) and PC-B (VLAN 20, 192.168.20.11);
 * Router-1 port 1 = 192.168.10.1 ↔ SW port 7, port 2 = 192.168.20.1 ↔ SW port 8.
 */
function interVlan(swPorts: Record<number, Partial<Port>>): Topology {
  return topo(
    [
      host('pca', '192.168.10.11', '192.168.10.1', { label: 'PC-A' }),
      host('pcb', '192.168.20.11', '192.168.20.1', { label: 'PC-B' }),
      switchWith(
        'sw',
        [1, 2, 7, 8].map(id => port(id, swPorts[id])),
        { label: 'SW-1' }
      ),
      device({
        id: 'r1',
        label: 'Router-1',
        type: 'Router',
        ip: '192.168.10.1',
        ports: [port(1, { ip: '192.168.10.1' }), port(2, { ip: '192.168.20.1' })],
      }),
    ],
    [
      link('pca', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('pcb', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('sw', 'r1', { id: 'uplink-10', sourcePort: 7, targetPort: 1 }),
      link('sw', 'r1', { id: 'uplink-20', sourcePort: 8, targetPort: 2 }),
    ]
  );
}

describe('routing between VLANs', () => {
  const cabled = { 1: { vlan: 10 }, 2: { vlan: 20 }, 7: { vlan: 10 }, 8: { vlan: 20 } };

  it('goes up to the router in one VLAN and comes back down in the other', () => {
    const result = traceRoute('pca', 'pcb', interVlan(cabled));
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => [h.label, h.note])).toEqual([
      ['PC-A', undefined],
      ['SW-1', 'VLAN 10'],
      ['Router-1', 'routed: 192.168.20.0/24 is on port 2'],
      ['SW-1', 'VLAN 20'],
      ['PC-B', undefined],
    ]);
    expect(planAndEvaluateFlow('ping', 'pca', 'pcb', interVlan(cabled)).verdict).toBe('success');
  });

  it('names the port of the router that is in the wrong VLAN', () => {
    // the cable of the 192.168.20.1 port went into a VLAN 10 port
    const result = traceRoute('pcb', 'pca', interVlan({ ...cabled, 8: { vlan: 10 } }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'VLAN 20 does not leave through port 8 on SW-1: it is an access port in VLAN 10'
    );
    expect(result.hops.map(h => [h.label, h.status])).toEqual([
      ['PC-B', 'forwarded'],
      ['SW-1', 'blocked'],
    ]);
  });

  it('a router port on a trunk needs the router to declare the VLANs it serves', () => {
    // one cable, a trunk: without sub-interfaces only a declared VLAN gets through
    const stick = (routerVlans: number[] | undefined): Topology => {
      const t = interVlan({ 1: { vlan: 10 }, 2: { vlan: 20 }, 7: { portType: 'trunk', vlan: [10, 20] } });
      return topo(
        t.devices.map(d => (d.id === 'r1' ? { ...d, vlan: routerVlans } : d)),
        t.connections.filter(c => c.id !== 'uplink-20')
      );
    };

    const undeclared = traceRoute('pca', 'r1', stick(undefined));
    expect(undeclared.verdict).toBe('blocked');
    expect(undeclared.failureReason).toBe(
      'Router-1 receives traffic tagged VLAN 10 (port 7 on SW-1 is a trunk) and does not expect a tag'
    );

    const declared = planAndEvaluateFlow('ping', 'pca', 'r1', stick([10, 20]));
    expect(declared.verdict).toBe('success');
    expect(declared.legs[1].trace.hops.map(h => [h.label, h.note])).toEqual([
      ['Router-1', undefined],
      ['SW-1', 'VLAN 10'],
      ['PC-A', undefined],
    ]);
  });
});
