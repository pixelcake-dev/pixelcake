import { describe, it, expect } from 'vitest';
import type { NetworkDevice, NetworkConnection, NetworkInterfaceCard, Port } from '@/types';
import type { Topology } from './types';
import { traceRoute, ping } from './trace';

// ---------- fixture factories ----------

function device(overrides: Partial<NetworkDevice> & { id: string }): NetworkDevice {
  return {
    type: 'PC',
    label: overrides.id,
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function port(id: number, overrides: Partial<Port> = {}): Port {
  return { id, enabled: true, ...overrides };
}

function nic(overrides: Partial<NetworkInterfaceCard> = {}): NetworkInterfaceCard {
  return {
    id: 'nic-1',
    name: 'eth0',
    enabled: true,
    speed: 'auto',
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    ...overrides,
  };
}

function link(
  source: string,
  target: string,
  overrides: Partial<NetworkConnection> = {}
): NetworkConnection {
  return { id: `${source}--${target}`, source, target, ...overrides };
}

function topo(devices: NetworkDevice[], connections: NetworkConnection[] = []): Topology {
  return { devices, connections };
}

/** PC-1 — SW-1 — PC-2, all on 192.168.1.0/24 */
function sameSubnetViaSwitch(
  swOverrides: Partial<NetworkDevice> = {},
  linkOverrides: [Partial<NetworkConnection>, Partial<NetworkConnection>] = [{}, {}]
): Topology {
  return topo(
    [
      device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
      device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2', ...swOverrides }),
      device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
    ],
    [link('pc1', 'sw1', linkOverrides[0]), link('sw1', 'pc2', linkOverrides[1])]
  );
}

// ---------- endpoint validation ----------

describe('traceRoute endpoint validation', () => {
  it('errors when source or target does not exist', () => {
    const t = topo([device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' })]);
    const missingTarget = traceRoute('pc1', 'ghost', t);
    expect(missingTarget.verdict).toBe('error');
    expect(missingTarget.failureReason).toContain('ghost');
    expect(missingTarget.hops).toEqual([]);

    const missingSource = traceRoute('ghost', 'pc1', t);
    expect(missingSource.verdict).toBe('error');
  });

  it('errors when an endpoint has no IP configured', () => {
    const t = topo(
      [device({ id: 'pc1', label: 'PC-1' }), device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' })],
      [link('pc1', 'pc2')]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe('PC-1 has no IP address configured');
  });
});

// ---------- physical path ----------

describe('traceRoute physical path', () => {
  it('reports unreachable for partitioned topologies', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
        device({ id: 'pc3', label: 'PC-3', ip: '192.168.1.30' }),
      ],
      [link('pc1', 'pc3')] // pc2 is isolated
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('unreachable');
    expect(result.failureReason).toBe('no physical path between PC-1 and PC-2');
  });
});

// ---------- L2 same-subnet delivery ----------

describe('traceRoute L2 delivery', () => {
  it('delivers same-subnet traffic through a switch', () => {
    const result = traceRoute('pc1', 'pc2', sameSubnetViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['sw1', 'forwarded'],
      ['pc2', 'delivered'],
    ]);
    expect(result.failureReason).toBeUndefined();
  });

  it('blocks on VLAN mismatch at a tagged switch', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10', vlan: [10] }),
        device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2', vlan: [20, 30] }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20', vlan: [10] }),
      ],
      [link('pc1', 'sw1'), link('sw1', 'pc2')]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'VLAN mismatch on Switch-0: traffic VLANs [10] not allowed (device carries [20,30])'
    );
    const last = result.hops[result.hops.length - 1];
    expect(last.deviceId).toBe('sw1');
    expect(last.status).toBe('blocked');
  });

  it('forwards when traffic VLANs intersect the switch VLANs', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10', vlan: [10] }),
        device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2', vlan: [10, 20] }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'sw1'), link('sw1', 'pc2')]
    );
    expect(traceRoute('pc1', 'pc2', t).verdict).toBe('success');
  });

  it('lets untagged traffic through a tagged switch with a note', () => {
    const result = traceRoute('pc1', 'pc2', sameSubnetViaSwitch({ vlan: [20, 30] }));
    expect(result.verdict).toBe('success');
    expect(result.notes).toContain('untagged traffic through Switch-0');
    expect(result.hops[1].note).toContain('untagged traffic through Switch-0');
  });
});

// ---------- L3 routing ----------

describe('traceRoute L3 routing', () => {
  it('blocks cross-subnet traffic when no router is on the path', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10', gateway: '192.168.1.1' }),
        device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.2.10' }),
      ],
      [link('pc1', 'sw1'), link('sw1', 'pc2')]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'no router between subnets 192.168.1.0 and 192.168.2.0 — L2 devices cannot route'
    );
    // blocked at the last hop before the target
    const last = result.hops[result.hops.length - 1];
    expect(last.deviceId).toBe('sw1');
    expect(last.status).toBe('blocked');
  });

  it('routes cross-subnet traffic through a router', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10', gateway: '192.168.1.1' }),
        device({ id: 'r1', label: 'Router-1', type: 'Router', ip: '192.168.1.1' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.2.10', gateway: '192.168.2.1' }),
      ],
      [link('pc1', 'r1'), link('r1', 'pc2')]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    // Router-1 has no addressed port: it lets the packet through unverified
    expect(result.hops[1].note).toBe('routing assumed');
    expect(result.notes).toContain(
      'Router-1 has no interface addresses: gateway and routing not verified'
    );
  });

  it('blocks cross-subnet traffic at the source when no gateway is configured', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }), // no gateway
        device({ id: 'r1', label: 'Router-1', type: 'Router', ip: '192.168.1.1' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.2.10' }),
      ],
      [link('pc1', 'r1'), link('r1', 'pc2')]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('no default gateway configured on PC-1');
    expect(result.hops).toHaveLength(1);
    expect(result.hops[0].deviceId).toBe('pc1');
    expect(result.hops[0].status).toBe('blocked');
  });
});

// ---------- port bindings ----------

describe('traceRoute port bindings', () => {
  it('blocks at a device whose bound port is disabled', () => {
    const t = sameSubnetViaSwitch(
      { ports: [port(3, { enabled: false })] },
      [{}, { sourcePort: 3 }] // sw1 → pc2 leaves via disabled port 3
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('port 3 on Switch-0 is disabled');
    const last = result.hops[result.hops.length - 1];
    expect(last.deviceId).toBe('sw1');
    expect(last.status).toBe('blocked');
  });

  it('blocks at the receiving device when its bound port is disabled', () => {
    const t = sameSubnetViaSwitch(
      { ports: [port(5, { enabled: false })] },
      [{ targetPort: 5 }, {}] // pc1 → sw1 arrives on disabled port 5
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('port 5 on Switch-0 is disabled');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['sw1', 'blocked'],
    ]);
  });

  it('forwards through enabled bound ports without notes', () => {
    const t = sameSubnetViaSwitch(
      { ports: [port(1), port(2)] },
      [{ targetPort: 1 }, { sourcePort: 2 }]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
  });

  it('adds exactly one deduped note for unbound links', () => {
    const result = traceRoute('pc1', 'pc2', sameSubnetViaSwitch()); // both links unbound
    expect(result.verdict).toBe('success');
    const unboundNotes = result.notes.filter(n => n.includes('has no port binding'));
    expect(unboundNotes).toEqual(['link PC-1–Switch-0 has no port binding: per-port rules skipped']);
  });
});

// ---------- NIC bindings ----------

/** PC-1 (eth0) — SW-1 (ports 1, 2) — PC-2 (eth0), fully bound, 192.168.1.0/24 */
function boundLan(
  pc1Nic: Partial<NetworkInterfaceCard> = {},
  pc2Nic: Partial<NetworkInterfaceCard> = {}
): Topology {
  return topo(
    [
      device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10', nics: [nic({ ip: '192.168.1.10', ...pc1Nic })] }),
      device({ id: 'sw1', label: 'SW-1', type: 'Switch', ip: '192.168.1.2', ports: [port(1), port(2)] }),
      device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20', nics: [nic({ ip: '192.168.1.20', ...pc2Nic })] }),
    ],
    [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 1 }),
      link('sw1', 'pc2', { sourcePort: 2, targetNic: 'nic-1' }),
    ]
  );
}

describe('traceRoute NIC bindings', () => {
  it('forwards through enabled bound NICs and ports without any note', () => {
    const result = traceRoute('pc1', 'pc2', boundLan());
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
  });

  it('blocks at the source when the NIC its link is bound to is disabled', () => {
    const result = traceRoute('pc1', 'pc2', boundLan({ enabled: false }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('interface eth0 on PC-1 is disabled');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([['pc1', 'blocked']]);
  });

  it('blocks at the receiving device when its bound NIC is disabled', () => {
    const result = traceRoute('pc1', 'pc2', boundLan({}, { enabled: false }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('interface eth0 on PC-2 is disabled');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['sw1', 'forwarded'],
      ['pc2', 'blocked'],
    ]);
  });

  it('ignores a disabled NIC that no link is bound to', () => {
    const t = boundLan();
    const spare = nic({ id: 'nic-2', name: 'eth1', ip: '10.0.0.5', enabled: false });
    const withSpare = topo(
      t.devices.map(d => (d.id === 'pc1' ? { ...d, nics: [...(d.nics ?? []), spare] } : d)),
      t.connections
    );
    expect(traceRoute('pc1', 'pc2', withSpare).verdict).toBe('success');
  });

  it('notes a half-bound link when the unbound end has interfaces to choose from', () => {
    const t = boundLan();
    const halfBound = topo(t.devices, [
      link('pc1', 'sw1', { sourceNic: 'nic-1' }), // SW-1 side not bound
      t.connections[1],
    ]);
    const result = traceRoute('pc1', 'pc2', halfBound);
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([
      'link PC-1–SW-1 has no port binding on SW-1: per-port rules skipped',
    ]);
  });

  it('treats a binding to a port that no longer exists as unbound', () => {
    const t = boundLan();
    const dangling = topo(t.devices, [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 9 }),
      t.connections[1],
    ]);
    const result = traceRoute('pc1', 'pc2', dangling);
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([
      'link PC-1–SW-1 has no port binding on SW-1: per-port rules skipped',
    ]);
  });
});

// ---------- endpoint addressing ----------

describe('traceRoute endpoint addressing', () => {
  it('uses the bound NIC, not the stale device-level mirror, to decide the subnet', () => {
    // Device-level fields still say 192.168.1.x; eth0 was moved to 10.0.0.x
    const t = boundLan({ ip: '10.0.0.10' });
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('no default gateway configured on PC-1');
  });

  it('uses the gateway of the bound NIC even when it is empty', () => {
    // cross-subnet target; the device-level gateway is a stale leftover
    const t = boundLan({ gateway: '' }, { ip: '192.168.2.20' });
    const stale = topo(
      t.devices.map(d => (d.id === 'pc1' ? { ...d, gateway: '192.168.1.1' } : d)),
      t.connections
    );
    const result = traceRoute('pc1', 'pc2', stale);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('no default gateway configured on PC-1');
  });

  it('uses the mask of the bound NIC', () => {
    // /16 on both NICs: 192.168.1.10 and 192.168.2.20 are one network
    const t = boundLan({ subnet: '255.255.0.0' }, { ip: '192.168.2.20', subnet: '255.255.0.0' });
    expect(traceRoute('pc1', 'pc2', t).verdict).toBe('success');
  });

  it('falls back to the primary addressing when the bound NIC has no IP', () => {
    const t = boundLan({ ip: '' });
    expect(traceRoute('pc1', 'pc2', t).verdict).toBe('success'); // device.ip 192.168.1.10
  });

  it('validates the address actually used', () => {
    const result = traceRoute('pc1', 'pc2', boundLan({ ip: '999.1.1.1' }));
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe('PC-1 has an invalid IP address (999.1.1.1)');
  });
});

// ---------- gateway verification ----------

/**
 * PC-1 (eth0 192.168.10.11) — Router-1 (ports 1..3) — PC-2 (eth0 192.168.20.11)
 * with every link bound: PC-1 ↔ port 1, PC-2 ↔ port 2.
 */
function routedTopo(options: {
  pc1Gateway?: string;
  pc2Gateway?: string;
  routerPorts?: Port[];
  pc1Link?: Partial<NetworkConnection>;
}): Topology {
  const {
    pc1Gateway = '192.168.10.1',
    pc2Gateway = '192.168.20.1',
    routerPorts = [
      port(1, { ip: '192.168.10.1', subnet: '255.255.255.0' }),
      port(2, { ip: '192.168.20.1', subnet: '255.255.255.0' }),
      port(3),
    ],
    pc1Link = { sourceNic: 'nic-1', targetPort: 1 },
  } = options;
  return topo(
    [
      device({
        id: 'pc1',
        label: 'PC-1',
        ip: '192.168.10.11',
        gateway: pc1Gateway,
        nics: [nic({ ip: '192.168.10.11', gateway: pc1Gateway })],
      }),
      device({ id: 'r1', label: 'Router-1', type: 'Router', ip: '192.168.10.1', ports: routerPorts }),
      device({
        id: 'pc2',
        label: 'PC-2',
        ip: '192.168.20.11',
        gateway: pc2Gateway,
        nics: [nic({ ip: '192.168.20.11', gateway: pc2Gateway })],
      }),
    ],
    [link('pc1', 'r1', pc1Link), link('r1', 'pc2', { sourcePort: 2, targetNic: 'nic-1' })]
  );
}

describe('traceRoute gateway verification', () => {
  it('passes without notes when the gateway is the router port the packet arrives on', () => {
    const result = traceRoute('pc1', 'pc2', routedTopo({}));
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
    expect(result.hops[1].note).toBe('routed: 192.168.20.0/24 is on port 2');
  });

  it('blocks at the source when the gateway is not the address of that port', () => {
    const result = traceRoute('pc1', 'pc2', routedTopo({ pc1Gateway: '192.168.10.254' }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-1 uses gateway 192.168.10.254, but Router-1 port 1 on its network is 192.168.10.1'
    );
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([['pc1', 'blocked']]);
  });

  it('does not accept the address of ANOTHER port of the router as gateway', () => {
    // 192.168.20.1 is Router-1 port 2: a real router address, but not on PC-1's network
    const result = traceRoute('pc1', 'pc2', routedTopo({ pc1Gateway: '192.168.20.1' }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-1 uses gateway 192.168.20.1, but Router-1 port 1 on its network is 192.168.10.1'
    );
  });

  it('blocks when the arrival port is addressed outside the source network', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      routedTopo({
        routerPorts: [
          port(1, { ip: '10.0.0.1', subnet: '255.255.255.0' }),
          port(2, { ip: '192.168.20.1', subnet: '255.255.255.0' }),
        ],
      })
    );
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-1 uses gateway 192.168.10.1, but Router-1 port 1 is 10.0.0.1, outside its network 192.168.10.0'
    );
  });

  it('blocks when the arrival port has no address while the router has others', () => {
    // PC-1 is plugged into port 3, which carries no IP
    const result = traceRoute(
      'pc1',
      'pc2',
      routedTopo({ pc1Link: { sourceNic: 'nic-1', targetPort: 3 } })
    );
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-1 uses gateway 192.168.10.1, but Router-1 port 3 on its link has no IP address'
    );
  });

  it('still requires a gateway before anything else', () => {
    const result = traceRoute('pc1', 'pc2', routedTopo({ pc1Gateway: '' }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('no default gateway configured on PC-1');
  });

  it('keeps the old behaviour, with a note, when the router has no interface addresses', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      routedTopo({ pc1Gateway: '192.168.10.254', routerPorts: [port(1), port(2)] })
    );
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([
      'Router-1 has no interface addresses: gateway and routing not verified',
    ]);
  });

  it('cannot verify, and says so, when the link is not bound on the router side', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      routedTopo({ pc1Gateway: '192.168.10.254', pc1Link: { sourceNic: 'nic-1' } })
    );
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([
      'link PC-1–Router-1 has no port binding on Router-1: gateway not verified',
      'link PC-1–Router-1 has no port binding on Router-1: per-port rules skipped',
    ]);
  });

  it('verifies the gateway when the router itself is the target', () => {
    // Router-1's own address is 192.168.10.1: reaching it from the 192.168.20.0
    // network still goes through the gateway on port 2
    expect(traceRoute('pc2', 'r1', routedTopo({})).verdict).toBe('success');

    const wrong = traceRoute('pc2', 'r1', routedTopo({ pc2Gateway: '192.168.20.99' }));
    expect(wrong.verdict).toBe('blocked');
    expect(wrong.failureReason).toBe(
      'PC-2 uses gateway 192.168.20.99, but Router-1 port 2 on its network is 192.168.20.1'
    );
  });

  it('does not involve the gateway for traffic that stays in the subnet', () => {
    // PC-1 pings the router address on its own network with a wrong gateway
    const result = traceRoute('pc1', 'r1', routedTopo({ pc1Gateway: '192.168.10.254' }));
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
  });

  it('lets a router reach a directly attached network from its own port, no gateway needed', () => {
    // Router-1 has no gateway; it leaves through port 2 = 192.168.20.1
    const result = traceRoute('r1', 'pc2', routedTopo({}));
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
  });
});

// ---------- more than one router ----------

describe('traceRoute across several routers', () => {
  /**
   * PC-1 — R1 — R2 — PC-2 (and PC-3 on a port of R2 that has no address):
   * 192.168.10.0/24 | 10.0.0.0/24 | 192.168.30.0/24, everything bound.
   */
  function twoRouters(
    options: {
      pc1Gateway?: string;
      r1?: Partial<NetworkDevice>;
      r2?: Partial<NetworkDevice>;
    } = {}
  ): Topology {
    const { pc1Gateway = '192.168.10.1', r1 = {}, r2 = {} } = options;
    return topo(
      [
        device({
          id: 'pc1',
          label: 'PC-1',
          ip: '192.168.10.11',
          nics: [nic({ ip: '192.168.10.11', gateway: pc1Gateway })],
        }),
        device({
          id: 'r1',
          label: 'R1',
          type: 'Router',
          ip: '192.168.10.1',
          ports: [port(1, { ip: '192.168.10.1' }), port(2, { ip: '10.0.0.1' })],
          ...r1,
        }),
        device({
          id: 'r2',
          label: 'R2',
          type: 'Router',
          ip: '192.168.30.1',
          ports: [port(1, { ip: '10.0.0.2' }), port(2, { ip: '192.168.30.1' }), port(3)],
          ...r2,
        }),
        device({
          id: 'pc2',
          label: 'PC-2',
          ip: '192.168.30.11',
          nics: [nic({ ip: '192.168.30.11', gateway: '192.168.30.1' })],
        }),
        device({
          id: 'pc3',
          label: 'PC-3',
          ip: '192.168.99.11',
          nics: [nic({ ip: '192.168.99.11', gateway: '192.168.99.1' })],
        }),
      ],
      [
        link('pc1', 'r1', { sourceNic: 'nic-1', targetPort: 1 }),
        link('r1', 'r2', { sourcePort: 2, targetPort: 1 }),
        link('r2', 'pc2', { sourcePort: 2, targetNic: 'nic-1' }),
        link('r2', 'pc3', { sourcePort: 3, targetNic: 'nic-1' }),
      ]
    );
  }

  const toServers = { id: 'route-1', destination: '192.168.30.0/24', nextHop: '10.0.0.2' };
  const toOffices = { id: 'route-1', destination: '192.168.10.0/24', nextHop: '10.0.0.1' };

  it('stops at the first router when it has no route to the destination', () => {
    const result = traceRoute('pc1', 'pc2', twoRouters());
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('R1 has no route to 192.168.30.11');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['r1', 'blocked'],
    ]);
  });

  it('follows a static route to the next router, and every router says how it routed', () => {
    const result = traceRoute('pc1', 'pc2', twoRouters({ r1: { routes: [toServers] } }));
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
    expect(result.hops.map(h => [h.deviceId, h.note])).toEqual([
      ['pc1', undefined],
      ['r1', 'routed: 192.168.30.0/24 via 10.0.0.2 (port 2)'],
      ['r2', 'routed: 192.168.30.0/24 is on port 2'],
      ['pc2', undefined],
    ]);
  });

  it('the way back needs a route of its own', () => {
    const oneWay = twoRouters({ r1: { routes: [toServers] } });
    const back = traceRoute('pc2', 'pc1', oneWay);
    expect(back.verdict).toBe('blocked');
    expect(back.failureReason).toBe('R2 has no route to 192.168.10.11');

    const bothWays = twoRouters({ r1: { routes: [toServers] }, r2: { routes: [toOffices] } });
    expect(traceRoute('pc2', 'pc1', bothWays).verdict).toBe('success');
  });

  it("uses the router's gateway as its default route", () => {
    const result = traceRoute('pc1', 'pc2', twoRouters({ r1: { gateway: '10.0.0.2' } }));
    expect(result.verdict).toBe('success');
    expect(result.hops[1].note).toBe('routed: default route via 10.0.0.2 (port 2)');
  });

  it('prefers the most specific route to the default one', () => {
    // The default points at an address nobody has; the /24 route is the one used
    const result = traceRoute(
      'pc1',
      'pc2',
      twoRouters({ r1: { gateway: '10.0.0.99', routes: [toServers] } })
    );
    expect(result.verdict).toBe('success');
    expect(result.hops[1].note).toBe('routed: 192.168.30.0/24 via 10.0.0.2 (port 2)');
  });

  it('accepts "default" as the destination of a static route', () => {
    const viaDefault = { id: 'route-1', destination: 'default', nextHop: '10.0.0.2' };
    const result = traceRoute('pc1', 'pc2', twoRouters({ r1: { routes: [viaDefault] } }));
    expect(result.verdict).toBe('success');
    expect(result.hops[1].note).toBe('routed: default route via 10.0.0.2 (port 2)');
  });

  it('blocks when the next hop of a route is on none of the router networks', () => {
    const lost = { id: 'route-1', destination: '192.168.30.0/24', nextHop: '172.16.0.1' };
    const result = traceRoute('pc1', 'pc2', twoRouters({ r1: { routes: [lost] } }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'R1 cannot use the route 192.168.30.0/24 via 172.16.0.1: that address is on none of its networks'
    );
    expect(result.hops[result.hops.length - 1]).toMatchObject({ deviceId: 'r1', status: 'blocked' });
  });

  it('blocks when nobody has the next hop address, naming who is there instead', () => {
    const wrong = { id: 'route-1', destination: '192.168.30.0/24', nextHop: '10.0.0.9' };
    const result = traceRoute('pc1', 'pc2', twoRouters({ r1: { routes: [wrong] } }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'R1 routes 192.168.30.0/24 via 10.0.0.9, but R2 port 1 on its network is 10.0.0.2'
    );
    expect(result.hops[result.hops.length - 1]).toMatchObject({ deviceId: 'r1', status: 'blocked' });
  });

  it('ignores a route that is not written as a network and an address', () => {
    const broken = [
      { id: 'route-1', destination: 'servers', nextHop: '10.0.0.2' },
      { id: 'route-2', destination: '192.168.30.0/24', nextHop: 'R2' },
    ];
    const result = traceRoute('pc1', 'pc2', twoRouters({ r1: { routes: broken } }));
    expect(result.failureReason).toBe('R1 has no route to 192.168.30.11');
  });

  it('detects a routing loop instead of going round forever', () => {
    // PC-3 hangs off a port of R2 that has no address: R2 sends 192.168.99.0/24
    // back to R1, whose default route points at R2 again
    const loop = twoRouters({
      r1: { gateway: '10.0.0.2' },
      r2: { routes: [{ id: 'route-1', destination: '192.168.99.0/24', nextHop: '10.0.0.1' }] },
    });
    const result = traceRoute('pc1', 'pc3', loop);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('routing loop: the packet comes back to R1');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['r1', 'forwarded'],
      ['r2', 'forwarded'],
      ['r1', 'blocked'],
    ]);
  });

  it('checks the gateway of the source against the first router', () => {
    const result = traceRoute(
      'pc1',
      'pc2',
      twoRouters({ pc1Gateway: '192.168.10.99', r1: { routes: [toServers] } })
    );
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-1 uses gateway 192.168.10.99, but R1 port 1 on its network is 192.168.10.1'
    );
  });

  it('reports the addresses the packet used', () => {
    const result = traceRoute('pc1', 'pc2', twoRouters({ r1: { routes: [toServers] } }));
    expect(result.sourceIp).toBe('192.168.10.11');
    expect(result.targetIp).toBe('192.168.30.11');
  });

  it('aims at one address of the target when asked to', () => {
    const routed = twoRouters({ r1: { routes: [toServers] }, r2: { routes: [toOffices] } });
    // R2 by name is its primary address 192.168.30.1; 10.0.0.2 is its other side
    const far = traceRoute('pc1', 'r2', routed);
    expect(far.targetIp).toBe('192.168.30.1');
    expect(far.verdict).toBe('success');

    const near = traceRoute('pc1', 'r2', twoRouters(), { targetIp: '10.0.0.2' });
    expect(near.targetIp).toBe('10.0.0.2');
    expect(near.verdict).toBe('success'); // R1 is attached to 10.0.0.0/24: no route needed
    expect(near.hops.map(h => h.deviceId)).toEqual(['pc1', 'r1', 'r2']);
  });
});

// ---------- firewall zones ----------

/** PC-1 — FW-1 — PC-2 with the firewall side of each link optionally bound */
function firewallTopo(fwPorts: Port[], bindIngress?: number, bindEgress?: number): Topology {
  return topo(
    [
      device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
      device({ id: 'fw1', label: 'FW-1', type: 'Firewall', ip: '192.168.1.1', ports: fwPorts }),
      device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
    ],
    [
      link('pc1', 'fw1', bindIngress !== undefined ? { targetPort: bindIngress } : {}),
      link('fw1', 'pc2', bindEgress !== undefined ? { sourcePort: bindEgress } : {}),
    ]
  );
}

describe('traceRoute firewall zones', () => {
  it('denies untrust → trust through a zone-bound firewall', () => {
    const t = firewallTopo(
      [port(1, { securityZone: 'untrust' }), port(2, { securityZone: 'trust' })],
      1,
      2
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('firewall policy on FW-1: untrust → trust denied');
    const last = result.hops[result.hops.length - 1];
    expect(last.deviceId).toBe('fw1');
    expect(last.status).toBe('blocked');
  });

  it('allows trust → untrust with an explicit note', () => {
    const t = firewallTopo(
      [port(1, { securityZone: 'trust' }), port(2, { securityZone: 'untrust' })],
      1,
      2
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    expect(result.notes).toContain('firewall policy: trust → untrust allowed');
  });

  it('allows traffic through a firewall without zone bindings, with a note', () => {
    const result = traceRoute('pc1', 'pc2', firewallTopo([port(1), port(2)]));
    expect(result.verdict).toBe('success');
    expect(result.notes).toContain('firewall FW-1 has no zone binding: allowed');
  });
});

// ---------- ping ----------

describe('ping', () => {
  it('computes a deterministic rtt from intermediate hop count', () => {
    const viaSwitch = ping('pc1', 'pc2', sameSubnetViaSwitch());
    expect(viaSwitch.verdict).toBe('success');
    expect(viaSwitch.rttMs).toBe(3); // 1 + 2 * 1 intermediate hop

    const direct = ping('pc1', 'pc2', topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'pc2')]
    ));
    expect(direct.rttMs).toBe(1); // no intermediate hops
  });

  it('omits rtt when the trace fails', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [] // no links
    );
    const result = ping('pc1', 'pc2', t);
    expect(result.verdict).toBe('unreachable');
    expect(result.rttMs).toBeUndefined();
  });
});
