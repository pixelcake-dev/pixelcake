import { describe, it, expect } from 'vitest';
import type { NetworkDevice, Port } from '@/types';
import { device, host, link, nic, port, switchWith, topo } from '@/test/networkFixtures';
import type { Topology } from './types';
import { forwardingRole } from './topology';
import { listInterfaces } from './interfaces';
import { broadcastReach } from './l2';
import { traceRoute } from './trace';
import { planAndEvaluateFlow } from './flows';

// ---------- who forwards what ----------

describe('forwardingRole', () => {
  it.each([
    ['Router', undefined, 'router'],
    ['Firewall', undefined, 'router'],
    ['Switch', undefined, 'bridge'],
    ['AccessPoint', undefined, 'bridge'],
    ['AccessPoint', 'tpl-iotgateway', 'bridge'],
    ['Cloud', undefined, 'passthrough'],
    ['LoadBalancer', undefined, 'passthrough'],
    ['PC', undefined, 'host'],
    ['Server', 'tpl-webserver', 'host'],
    ['Database', 'tpl-nas', 'host'],
    ['Printer', undefined, 'host'],
  ] as const)('%s (%s) is a %s', (type, templateId, role) => {
    expect(forwardingRole(device({ id: 'x', type, templateId }))).toBe(role);
  });

  it('an unknown device built with ports is taken for network gear', () => {
    expect(forwardingRole(device({ id: 'x', type: 'Media Converter', ports: [port(1), port(2)] }))).toBe(
      'bridge'
    );
  });
});

describe('devices in the way', () => {
  it('an end device does not carry traffic for others', () => {
    const t = topo(
      [
        host('pc1', '192.168.1.11', '', { label: 'PC-1' }),
        host('pc3', '192.168.1.13', '', { label: 'PC-3', nics: [nic({ ip: '192.168.1.13' }), nic({ id: 'nic-2', name: 'eth1' })] }),
        host('pc2', '192.168.1.12', '', { label: 'PC-2' }),
      ],
      [
        link('pc1', 'pc3', { sourceNic: 'nic-1', targetNic: 'nic-1' }),
        link('pc3', 'pc2', { sourceNic: 'nic-2', targetNic: 'nic-1' }),
      ]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-3 is an end device: it does not forward traffic for others'
    );
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['pc3', 'blocked'],
    ]);
  });

  it('a router does not pass traffic between two devices addressed in one network', () => {
    const t = topo(
      [
        host('pc1', '192.168.1.11', '192.168.1.1', { label: 'PC-1' }),
        device({
          id: 'r1',
          label: 'Router-1',
          type: 'Router',
          ip: '192.168.1.1',
          ports: [port(1, { ip: '192.168.1.1' }), port(2, { ip: '192.168.2.1' })],
        }),
        host('pc2', '192.168.1.12', '192.168.1.1', { label: 'PC-2' }),
      ],
      [
        link('pc1', 'r1', { sourceNic: 'nic-1', targetPort: 1 }),
        link('r1', 'pc2', { sourcePort: 2, targetNic: 'nic-1' }),
      ]
    );
    const result = traceRoute('pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'PC-2 (192.168.1.12) is addressed inside the network of PC-1 but sits behind Router-1: ' +
        'a router does not pass traffic within one network'
    );
    expect(result.hops[result.hops.length - 1]).toMatchObject({ deviceId: 'r1', status: 'blocked' });
  });

  it('an access point bridges like a switch', () => {
    const t = topo(
      [
        host('laptop', '192.168.1.50', '', { label: 'Laptop' }),
        device({ id: 'ap', label: 'AP-1', type: 'AccessPoint', ip: '192.168.1.3', nics: [nic({ ip: '192.168.1.3' })] }),
        switchWith('sw', [port(1), port(2)], { label: 'SW-1' }),
        host('srv', '192.168.1.20', '', { label: 'Server', type: 'Server' }),
      ],
      [
        link('laptop', 'ap', { sourceNic: 'nic-1' }),
        link('ap', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
        link('sw', 'srv', { sourcePort: 2, targetNic: 'nic-1' }),
      ]
    );
    const result = traceRoute('laptop', 'srv', t);
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => h.deviceId)).toEqual(['laptop', 'ap', 'sw', 'srv']);
  });

  it('a load balancer is crossed with a note: it is not simulated', () => {
    const t = topo(
      [
        host('pc1', '192.168.1.11', '', { label: 'PC-1' }),
        device({ id: 'lb', label: 'LB-1', type: 'LoadBalancer', ip: '192.168.1.5', nics: [nic({ ip: '192.168.1.5' }), nic({ id: 'nic-2', name: 'eth1' })] }),
        host('web', '192.168.1.20', '', { label: 'Web-01', type: 'Server' }),
      ],
      [
        link('pc1', 'lb', { sourceNic: 'nic-1', targetNic: 'nic-1' }),
        link('lb', 'web', { sourceNic: 'nic-2', targetNic: 'nic-1' }),
      ]
    );
    const through = traceRoute('pc1', 'web', t);
    expect(through.verdict).toBe('success');
    expect(through.notes).toEqual(['LB-1 is not simulated: traffic assumed to pass']);
    expect(through.hops[1]).toMatchObject({
      deviceId: 'lb',
      note: 'LB-1 is not simulated: traffic assumed to pass',
    });

    // reached on its own address it is a destination like any other
    const to = traceRoute('pc1', 'lb', t);
    expect(to.verdict).toBe('success');
    expect(to.notes).toEqual([]);
  });
});

// ---------- more than one way ----------

/**
 * PC-1 — SW-A ══ SW-B — PC-2, with a second way SW-A — SW-C — SW-B.
 * Ports: SW-A 1 = PC-1, 2 = SW-B, 3 = SW-C; SW-B 1 = PC-2, 2 = SW-A, 3 = SW-C.
 */
function triangle(swA: Record<number, Partial<Port>> = {}): Topology {
  const three = (ports: Record<number, Partial<Port>> = {}) => [1, 2, 3].map(id => port(id, ports[id]));
  return topo(
    [
      host('pc1', '192.168.1.11', '', { label: 'PC-1' }),
      host('pc2', '192.168.1.12', '', { label: 'PC-2' }),
      switchWith('swa', three(swA), { label: 'SW-A' }),
      switchWith('swb', three(), { label: 'SW-B' }),
      switchWith('swc', [port(1), port(2)], { label: 'SW-C' }),
    ],
    [
      link('pc1', 'swa', { sourceNic: 'nic-1', targetPort: 1 }),
      link('swa', 'swb', { sourcePort: 2, targetPort: 2 }),
      link('swa', 'swc', { sourcePort: 3, targetPort: 1 }),
      link('swc', 'swb', { sourcePort: 2, targetPort: 3 }),
      link('swb', 'pc2', { sourcePort: 1, targetNic: 'nic-1' }),
    ]
  );
}

describe('more than one way between two devices', () => {
  it('takes the shortest way that works', () => {
    const result = traceRoute('pc1', 'pc2', triangle());
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => h.deviceId)).toEqual(['pc1', 'swa', 'swb', 'pc2']);
  });

  it('goes round a port that is down when the drawing offers another way', () => {
    const result = traceRoute('pc1', 'pc2', triangle({ 2: { enabled: false } }));
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => h.deviceId)).toEqual(['pc1', 'swa', 'swc', 'swb', 'pc2']);
  });

  it('is blocked, at the device that drops it, when every way is down', () => {
    const result = traceRoute('pc1', 'pc2', triangle({ 2: { enabled: false }, 3: { enabled: false } }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('port 2 on SW-A is disabled');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['swa', 'blocked'],
    ]);
  });
});

// ---------- addresses ----------

describe('addresses on the wire', () => {
  it('notices an address used twice: the conflict is said before the packet leaves (see conflicts.test)', () => {
    const t = topo(
      [
        host('pc1', '192.168.1.11', '', { label: 'PC-1' }),
        host('pc2', '192.168.1.20', '', { label: 'PC-2' }),
        host('pc3', '192.168.1.20', '', { label: 'PC-3' }),
        switchWith('sw', [port(1), port(2), port(3)], { label: 'SW-1' }),
      ],
      [
        link('pc1', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
        link('pc2', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
        link('pc3', 'sw', { sourceNic: 'nic-1', targetPort: 3 }),
      ]
    );
    const result = traceRoute('pc1', 'pc3', t);
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe(
      'address conflict: 192.168.1.20 is on both PC-2 and PC-3, so the answer cannot be trusted'
    );
    expect(result.hops).toEqual([]);
  });

  /** A server with a NIC on the LAN (with the gateway) and one on a storage network */
  function twoNetworks(serverNics: Parameters<typeof nic>[0][] = [{}, {}]): Topology {
    const server = device({
      id: 'srv',
      label: 'Server',
      type: 'Server',
      ip: '192.168.1.5',
      nics: [
        nic({ id: 'nic-1', name: 'eth0', ip: '192.168.1.5', gateway: '192.168.1.1', ...serverNics[0] }),
        nic({ id: 'nic-2', name: 'eth1', ip: '10.0.0.5', ...serverNics[1] }),
      ],
    });
    return topo(
      [
        server,
        host('pc1', '192.168.1.11', '192.168.1.1', { label: 'PC-1' }),
        host('nas', '10.0.0.9', '', { label: 'NAS', type: 'Database' }),
      ],
      [
        link('srv', 'pc1', { sourceNic: 'nic-1', targetNic: 'nic-1' }),
        link('srv', 'nas', { id: 'storage', sourceNic: 'nic-2', targetNic: 'nic-1' }),
      ]
    );
  }

  it('a device with two NICs sends from the one on the destination network', () => {
    const toStorage = traceRoute('srv', 'nas', twoNetworks());
    expect(toStorage.verdict).toBe('success');
    expect(toStorage.sourceIp).toBe('10.0.0.5');

    const toLan = traceRoute('srv', 'pc1', twoNetworks());
    expect(toLan.verdict).toBe('success');
    expect(toLan.sourceIp).toBe('192.168.1.5');
  });

  it('a reply goes back to the address the request came from', () => {
    const exchange = planAndEvaluateFlow('ping', 'srv', 'nas', twoNetworks());
    expect(exchange.verdict).toBe('success');
    // not to 192.168.1.5, the address the server goes by, which the NAS could not reach
    expect(exchange.legs[1].trace.targetIp).toBe('10.0.0.5');
  });

  it('says so when the interface that should send has no cable', () => {
    const t = twoNetworks();
    const unplugged = topo(
      t.devices,
      t.connections.filter(c => c.id !== 'storage')
    );
    const withNasElsewhere = topo(
      unplugged.devices,
      [...unplugged.connections, link('pc1', 'nas', { targetNic: 'nic-1' })]
    );
    const result = traceRoute('srv', 'nas', withNasElsewhere);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('interface eth1 on Server has no cable attached');
    expect(result.hops.map(h => [h.deviceId, h.status])).toEqual([['srv', 'blocked']]);
  });

  it('falls back on its gateway when the interface on the destination network is down', () => {
    // eth1 down: 10.0.0.9 is now "somewhere else", reached through the gateway of eth0
    const result = traceRoute('srv', 'nas', twoNetworks([{}, { enabled: false }]));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'Server uses gateway 192.168.1.1: no device has that address on its network'
    );
  });
});

// ---------- the outside world ----------

/**
 * PC-1 — Router-1 ═ Internet ─ VPS
 * LAN 192.168.10.0/24; Router-1 port 2 (WAN) 203.0.113.2/30, default gateway
 * 203.0.113.1, which is nobody on the drawing; VPS 198.51.100.10.
 */
function withInternet(options: { routerGateway?: string; wan?: Partial<Port>; cloud?: Partial<NetworkDevice> } = {}): Topology {
  const { routerGateway = '203.0.113.1', wan = {}, cloud = {} } = options;
  return topo(
    [
      host('pc1', '192.168.10.11', '192.168.10.1', { label: 'PC-1' }),
      device({
        id: 'r1',
        label: 'Router-1',
        type: 'Router',
        ip: '192.168.10.1',
        gateway: routerGateway,
        ports: [
          port(1, { ip: '192.168.10.1' }),
          port(2, { ip: '203.0.113.2', subnet: '255.255.255.252', ...wan }),
        ],
      }),
      device({ id: 'inet', label: 'Internet', type: 'Cloud', templateId: 'tpl-cloud', nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })], ...cloud }),
      host('vps', '198.51.100.10', '198.51.100.1', { label: 'VPS', type: 'Server', templateId: 'tpl-vps' }),
    ],
    [
      link('pc1', 'r1', { sourceNic: 'nic-1', targetPort: 1 }),
      link('r1', 'inet', { sourcePort: 2, targetNic: 'nic-1' }),
      link('inet', 'vps', { sourceNic: 'nic-2', targetNic: 'nic-1' }),
    ]
  );
}

describe('the Internet symbol', () => {
  it('takes what is sent to a gateway that is not on the drawing, and says so', () => {
    const result = traceRoute('pc1', 'vps', withInternet({ wan: { nat: true } }));
    expect(result.verdict).toBe('success');
    expect(result.hops.map(h => [h.label, h.note])).toEqual([
      ['PC-1', undefined],
      ['Router-1', 'routed: default route via 203.0.113.1 (port 2); NAT: source 192.168.10.11 → 203.0.113.2'],
      ['Internet', undefined],
      ['VPS', undefined],
    ]);
    expect(result.notes).toEqual([
      '203.0.113.1 is not in the drawing: Internet assumed to take the traffic',
      'Internet is not simulated: traffic assumed to pass',
    ]);
  });

  it('brings the answer back to the router, which routes it properly', () => {
    const exchange = planAndEvaluateFlow('web', 'pc1', 'vps', withInternet({ wan: { nat: true } }));
    expect(exchange.verdict).toBe('success');
    expect(exchange.legs[1].trace.hops.map(h => [h.label, h.note])).toEqual([
      ['VPS', undefined],
      ['Internet', undefined],
      [
        'Router-1',
        'NAT: destination 203.0.113.2 → 192.168.10.11 (reply to a translated flow); ' +
          'routed: 192.168.10.0/24 is on port 1',
      ],
      ['PC-1', undefined],
    ]);
  });

  it('does not stand in for a missing default route', () => {
    const result = traceRoute('pc1', 'vps', withInternet({ routerGateway: '' }));
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('Router-1 has no route to 198.51.100.10');
  });

  it('does not carry the private address of the PC: the router has to translate it (see nat.test)', () => {
    const result = traceRoute('pc1', 'vps', withInternet());
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'Internet does not carry private addresses: 192.168.10.11 has to be translated before it ' +
        'goes out, and NAT is off on port 2 on Router-1'
    );
    expect(result.hops[result.hops.length - 1]).toMatchObject({ label: 'Internet', status: 'blocked' });
    // nothing says any more that NAT is drawn and not applied
    for (const t of [withInternet(), withInternet({ wan: { nat: true } })]) {
      expect(traceRoute('pc1', 'vps', t).notes.join(' ')).not.toContain('not simulated: addresses');
    }
  });

  it('is a destination like any other when it has an address', () => {
    const t = withInternet({ cloud: { nics: [nic({ ip: '203.0.113.1', subnet: '255.255.255.252' }), nic({ id: 'nic-2', name: 'eth1' })] } });
    const result = traceRoute('pc1', 'inet', t);
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
    expect(result.hops.map(h => h.label)).toEqual(['PC-1', 'Router-1', 'Internet']);
  });
});

// ---------- who hears a broadcast ----------

describe('broadcastReach', () => {
  const MASK = '255.255.255.0';
  /** `B eth0`, `R port 1`, `X ?` (cable not attached), sorted */
  const heard = (t: Topology, fromId: string, nicId = 'nic-1') => {
    const from = t.devices.find(d => d.id === fromId) as NetworkDevice;
    const egress = listInterfaces(from).find(iface => iface.key === `nic:${nicId}`);
    const reach = broadcastReach(t, from, egress);
    return {
      cabled: reach.cabled,
      who: reach.listeners.map(l => `${l.device.label} ${l.arrival?.label ?? '?'}`).sort(),
    };
  };
  const router = (ports: Port[]) => device({ id: 'r', label: 'R', type: 'Router', ports });

  /**
   *   A ─┐
   *   B ─┼─ SW ── port 1  R  port 2 ── Srv
   */
  function oneSwitch(switchPorts: Port[] = [port(1), port(2), port(3)]): Topology {
    return topo(
      [
        host('a', '192.168.1.11', '', { label: 'A' }),
        host('b', '192.168.1.12', '', { label: 'B' }),
        switchWith('sw', switchPorts, { label: 'SW' }),
        router([port(1, { ip: '192.168.1.1', subnet: MASK }), port(2, { ip: '10.0.0.1', subnet: MASK })]),
        host('srv', '10.0.0.10', '', { label: 'Srv' }),
      ],
      [
        link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
        link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
        link('sw', 'r', { sourcePort: 3, targetPort: 1 }),
        link('r', 'srv', { sourcePort: 2, targetNic: 'nic-1' }),
      ]
    );
  }

  it('is heard by the devices and the router port of the same network, and stops at the router', () => {
    expect(heard(oneSwitch(), 'a')).toEqual({ cabled: true, who: ['B eth0', 'R port 1'] });
    expect(heard(oneSwitch(), 'srv')).toEqual({ cabled: true, who: ['R port 2'] });
  });

  it('never starts from an interface with no cable', () => {
    const t = oneSwitch();
    t.connections.splice(0, 1);
    expect(heard(t, 'a')).toEqual({ cabled: false, who: [] });
  });

  it('is not heard through a port that is down, at either end', () => {
    expect(heard(oneSwitch([port(1), port(2, { enabled: false }), port(3)]), 'a').who).toEqual(['R port 1']);
    const t = oneSwitch();
    t.devices[1] = host('b', '192.168.1.12', '', { label: 'B', nics: [nic({ ip: '192.168.1.12', enabled: false })] });
    expect(heard(t, 'a').who).toEqual(['R port 1']);
  });

  it('stays in its VLAN', () => {
    const t = oneSwitch([port(1, { vlan: 10 }), port(2, { vlan: 20 }), port(3, { vlan: 10 })]);
    expect(heard(t, 'a').who).toEqual(['R port 1']);
    expect(heard(t, 'b').who).toEqual([]);
  });

  it('is not heard by a device that does not expect the tag it arrives with', () => {
    // port 3 is a trunk: what leaves towards the router is tagged VLAN 10
    const t = oneSwitch([port(1, { vlan: 10 }), port(2, { vlan: 10 }), port(3, { portType: 'trunk', vlan: [10] })]);
    expect(heard(t, 'a').who).toEqual(['B eth0']);
  });

  it('crosses switches and access points, and nothing else', () => {
    //  X ── AP ── SW ...   and   Y ── T (router without addresses) ── SW
    const t = oneSwitch([port(1), port(2), port(3), port(4), port(5)]);
    t.devices.push(
      host('x', '192.168.1.13', '', { label: 'X' }),
      device({ id: 'ap', label: 'AP', type: 'AccessPoint', nics: [nic(), nic({ id: 'nic-2', name: 'wlan0' })] }),
      host('y', '192.168.1.14', '', { label: 'Y' }),
      device({ id: 't', label: 'T', type: 'Router', ports: [port(1), port(2)] })
    );
    t.connections.push(
      link('x', 'ap', { sourceNic: 'nic-1', targetNic: 'nic-2' }),
      link('ap', 'sw', { sourceNic: 'nic-1', targetPort: 4 }),
      link('y', 't', { sourceNic: 'nic-1', targetPort: 1 }),
      link('t', 'sw', { sourcePort: 2, targetPort: 5 })
    );
    expect(heard(t, 'x').who).toEqual(['A eth0', 'B eth0', 'R port 1']);
    // Y is behind a router: nobody hears it, and it hears nobody
    expect(heard(t, 'y').who).toEqual([]);
    expect(heard(t, 'a').who).toEqual(['B eth0', 'R port 1', 'X eth0']);
  });

  it('does not cross a symbol that is not simulated', () => {
    const cloud = device({ id: 'wan', label: 'Linea', type: 'Cloud', nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })] });
    const t = topo(
      [host('a', '192.168.1.11', '', { label: 'A' }), cloud, host('b', '192.168.1.12', '', { label: 'B' })],
      [link('a', 'wan', { sourceNic: 'nic-1', targetNic: 'nic-1' }), link('wan', 'b', { sourceNic: 'nic-2', targetNic: 'nic-1' })]
    );
    expect(heard(t, 'a')).toEqual({ cabled: true, who: [] });
  });

  it('is not heard by the sender itself on a second card', () => {
    const t = oneSwitch([port(1), port(2), port(3), port(4)]);
    t.devices[0] = host('a', '192.168.1.11', '', {
      label: 'A',
      nics: [nic({ ip: '192.168.1.11' }), nic({ id: 'nic-2', name: 'eth1' })],
    });
    t.connections.push(link('a', 'sw', { id: 'a--sw-2', sourceNic: 'nic-2', targetPort: 4 }));
    expect(heard(t, 'a').who).toEqual(['B eth0', 'R port 1']);
    expect(heard(t, 'a', 'nic-2').who).toEqual(['B eth0', 'R port 1']);
  });

  it('names each interface once, and says when a cable is not attached to one', () => {
    //  A ── SW1 ══ SW2 ── H (two cables, neither attached on H)
    const t = topo(
      [
        host('a', '192.168.1.11', '', { label: 'A' }),
        switchWith('sw1', [port(1), port(2), port(3)], { label: 'SW1' }),
        switchWith('sw2', [port(1), port(2), port(3)], { label: 'SW2' }),
        host('h', '192.168.1.20', '', { label: 'H' }),
      ],
      [
        link('a', 'sw1', { sourceNic: 'nic-1', targetPort: 1 }),
        link('sw1', 'sw2', { sourcePort: 2, targetPort: 1 }),
        link('sw1', 'h', { sourcePort: 3 }),
        link('sw2', 'h', { sourcePort: 2 }),
      ]
    );
    expect(heard(t, 'a').who).toEqual(['H ?']);
  });
});
