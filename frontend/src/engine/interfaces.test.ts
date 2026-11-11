import { describe, it, expect } from 'vitest';
import type { NetworkDevice, NetworkConnection, NetworkInterfaceCard, Port } from '@/types';
import {
  listInterfaces,
  interfacePhrase,
  connectionEndOn,
  isEndBound,
  boundInterface,
  bindingFor,
  interfaceLinks,
  usedInterfaceKeys,
  firstFreeInterface,
  requiresExplicitBinding,
  bindConnection,
  bindUnboundConnections,
  sanitizeBindings,
  normalizeBindings,
} from './interfaces';

// ---------- fixture factories ----------

function port(id: number, overrides: Partial<Port> = {}): Port {
  return { id, enabled: true, ...overrides };
}

function ports(count: number): Port[] {
  return Array.from({ length: count }, (_, i) => port(i + 1));
}

function nic(
  id: string,
  name: string,
  overrides: Partial<NetworkInterfaceCard> = {}
): NetworkInterfaceCard {
  return {
    id,
    name,
    enabled: true,
    speed: 'auto',
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    ...overrides,
  };
}

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

function sw(id: string, portCount = 4): NetworkDevice {
  return device({ id, type: 'Switch', ports: ports(portCount) });
}

function pc(id: string): NetworkDevice {
  return device({ id, nics: [nic('nic-1', 'eth0', { ip: '192.168.1.10' })] });
}

function link(
  source: string,
  target: string,
  overrides: Partial<NetworkConnection> = {}
): NetworkConnection {
  return { id: `${source}--${target}`, source, target, ...overrides };
}

/** Every `deviceId|interfaceKey` claimed by the connections, duplicates kept */
function claims(devices: NetworkDevice[], connections: NetworkConnection[]): string[] {
  const out: string[] = [];
  for (const connection of connections) {
    for (const end of ['source', 'target'] as const) {
      const dev = devices.find(d => d.id === connection[end]);
      const iface = dev ? boundInterface(connection, dev, end) : undefined;
      if (dev && iface) out.push(`${dev.id}|${iface.key}`);
    }
  }
  return out;
}

// ---------- unified listing ----------

describe('listInterfaces', () => {
  it('lists ports first, then NICs, in a unified shape', () => {
    const dev = device({
      id: 'r1',
      type: 'Router',
      ports: [port(1, { ip: '10.0.0.1', subnet: '255.255.255.0' }), port(2, { enabled: false })],
      nics: [nic('nic-1', 'mgmt0', { ip: '172.16.0.5' })],
    });

    expect(
      listInterfaces(dev).map(i => [i.kind, i.key, i.label, i.enabled, i.ip, i.subnet])
    ).toEqual([
      ['port', 'port:1', 'port 1', true, '10.0.0.1', '255.255.255.0'],
      ['port', 'port:2', 'port 2', false, '', ''],
      ['nic', 'nic:nic-1', 'mgmt0', true, '172.16.0.5', '255.255.255.0'],
    ]);
  });

  it('returns an empty list for a device without ports or NICs', () => {
    expect(listInterfaces(device({ id: 'legacy' }))).toEqual([]);
  });

  it('names interfaces for failure messages: "port N" vs "interface <name>"', () => {
    const [p] = listInterfaces(sw('sw1'));
    const [n] = listInterfaces(pc('pc1'));
    expect(interfacePhrase(p)).toBe('port 1');
    expect(interfacePhrase(n)).toBe('interface eth0');
  });
});

// ---------- resolving a binding ----------

describe('boundInterface', () => {
  const sw1 = sw('sw1');
  const pc1 = pc('pc1');

  it('resolves the port or NIC bound on the device side of the link', () => {
    const c = link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 3 });
    expect(boundInterface(c, pc1)?.key).toBe('nic:nic-1');
    expect(boundInterface(c, sw1)?.key).toBe('port:3');
  });

  it('returns undefined for an unbound end, a foreign device or a missing interface', () => {
    expect(boundInterface(link('pc1', 'sw1'), sw1)).toBeUndefined();
    expect(boundInterface(link('pc1', 'sw1', { targetPort: 3 }), sw('other'))).toBeUndefined();
    expect(boundInterface(link('pc1', 'sw1', { targetPort: 99 }), sw1)).toBeUndefined();
    expect(boundInterface(link('pc1', 'sw1', { sourceNic: 'nic-9' }), pc1)).toBeUndefined();
  });

  it('never resolves a binding against the wrong kind of interface', () => {
    // a port id on a NIC-only device / a NIC id on a port-only device
    expect(boundInterface(link('pc1', 'sw1', { sourcePort: 1 }), pc1)).toBeUndefined();
    expect(boundInterface(link('pc1', 'sw1', { targetNic: 'nic-1' }), sw1)).toBeUndefined();
  });

  it('distinguishes the two ends of a self-loop when the end is given', () => {
    const loop = link('sw1', 'sw1', { sourcePort: 1, targetPort: 2 });
    expect(boundInterface(loop, sw1)?.key).toBe('port:1'); // source wins by default
    expect(boundInterface(loop, sw1, 'target')?.key).toBe('port:2');
  });

  it('connectionEndOn / isEndBound describe a link end', () => {
    const c = link('pc1', 'sw1', { sourceNic: 'nic-1' });
    expect(connectionEndOn(c, 'pc1')).toBe('source');
    expect(connectionEndOn(c, 'sw1')).toBe('target');
    expect(connectionEndOn(c, 'nope')).toBeUndefined();
    expect(isEndBound(c, 'source')).toBe(true);
    expect(isEndBound(c, 'target')).toBe(false);
  });

  it('bindingFor writes one field per end and clears the other', () => {
    const [p3] = listInterfaces(device({ id: 'x', ports: [port(3)] }));
    const [eth0] = listInterfaces(pc('pc1'));
    expect(bindingFor('source', p3)).toEqual({ sourcePort: 3, sourceNic: undefined });
    expect(bindingFor('target', eth0)).toEqual({ targetPort: undefined, targetNic: 'nic-1' });
    expect(bindingFor('target', undefined)).toEqual({
      targetPort: undefined,
      targetNic: undefined,
    });
    // the cleared field is an own key, so a store merge really removes it
    expect(Object.keys(bindingFor('source', eth0)).sort()).toEqual(['sourceNic', 'sourcePort']);
  });
});

// ---------- used / free interfaces ----------

describe('usedInterfaceKeys', () => {
  const sw1 = sw('sw1');

  it('collects the interfaces of a device that links already use', () => {
    const connections = [
      link('pc1', 'sw1', { targetPort: 2 }),
      link('sw1', 'pc2', { sourcePort: 4 }),
      link('pc3', 'sw1'), // unbound: uses nothing
      link('pc4', 'sw1', { targetPort: 99 }), // dangling: uses nothing
    ];
    expect([...usedInterfaceKeys(sw1, connections)].sort()).toEqual(['port:2', 'port:4']);
  });

  it('can leave out the connection being edited', () => {
    const connections = [
      link('pc1', 'sw1', { targetPort: 2 }),
      link('sw1', 'pc2', { sourcePort: 4 }),
    ];
    expect([...usedInterfaceKeys(sw1, connections, 'pc1--sw1')]).toEqual(['port:4']);
  });
});

describe('interfaceLinks', () => {
  it('maps each used interface to its link, peer device and peer interface', () => {
    const sw1 = sw('sw1');
    const pc1 = pc('pc1');
    const legacy = device({ id: 'legacy' });
    const c1 = link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 2 });
    const c2 = link('sw1', 'legacy', { sourcePort: 3 });

    const links = interfaceLinks(sw1, [sw1, pc1, legacy], [c1, c2]);
    expect([...links.keys()]).toEqual(['port:2', 'port:3']);

    const viaPort2 = links.get('port:2');
    expect(viaPort2?.connection).toBe(c1);
    expect(viaPort2?.end).toBe('target');
    expect(viaPort2?.peer).toBe(pc1);
    expect(viaPort2?.peerInterface?.label).toBe('eth0');

    const viaPort3 = links.get('port:3');
    expect(viaPort3?.peer).toBe(legacy);
    expect(viaPort3?.peerInterface).toBeUndefined(); // peer end is unbound
  });
});

describe('firstFreeInterface', () => {
  it('picks the lowest-numbered free enabled port', () => {
    const sw1 = sw('sw1');
    expect(firstFreeInterface(sw1, [])?.key).toBe('port:1');
    expect(
      firstFreeInterface(sw1, [
        link('a', 'sw1', { targetPort: 1 }),
        link('sw1', 'b', { sourcePort: 2 }),
      ])?.key
    ).toBe('port:3');
  });

  it('goes by port number, not by array position', () => {
    const shuffled = device({ id: 'sw1', type: 'Switch', ports: [port(3), port(1), port(2)] });
    expect(firstFreeInterface(shuffled, [])?.key).toBe('port:1');
  });

  it('skips disabled ports while an enabled one is free', () => {
    const dev = device({
      id: 'sw1',
      type: 'Switch',
      ports: [port(1, { enabled: false }), port(2), port(3)],
    });
    expect(firstFreeInterface(dev, [])?.key).toBe('port:2');
  });

  it('falls back to the first free interface when every free one is disabled', () => {
    const dev = device({
      id: 'sw1',
      type: 'Switch',
      ports: [port(1), port(2, { enabled: false }), port(3, { enabled: false })],
    });
    expect(firstFreeInterface(dev, [link('a', 'sw1', { targetPort: 1 })])?.key).toBe('port:2');
  });

  it('picks the first free enabled NIC in array order', () => {
    const dev = device({
      id: 'srv',
      nics: [nic('nic-1', 'eth0', { enabled: false }), nic('nic-2', 'eth1'), nic('nic-3', 'eth2')],
    });
    expect(firstFreeInterface(dev, [])?.key).toBe('nic:nic-2');
    expect(firstFreeInterface(dev, [link('srv', 'x', { sourceNic: 'nic-2' })])?.key).toBe(
      'nic:nic-3'
    );
  });

  it('returns nothing when the device has no interfaces or none is free', () => {
    expect(firstFreeInterface(device({ id: 'legacy' }), [])).toBeUndefined();
    const single = pc('pc1');
    expect(firstFreeInterface(single, [link('pc1', 'x', { sourceNic: 'nic-1' })])).toBeUndefined();
  });
});

// ---------- binding one connection ----------

describe('bindConnection', () => {
  it('fills both missing ends with the first free interface of each device', () => {
    const devices = [pc('pc1'), sw('sw1')];
    const bound = bindConnection(link('pc1', 'sw1'), devices, []);
    expect(bound).toMatchObject({ sourceNic: 'nic-1', targetPort: 1 });
    expect(bound.sourcePort).toBeUndefined();
    expect(bound.targetNic).toBeUndefined();
  });

  it('avoids interfaces the other connections already use', () => {
    const devices = [pc('pc1'), pc('pc2'), sw('sw1')];
    const first = bindConnection(link('pc1', 'sw1'), devices, []);
    const second = bindConnection(link('pc2', 'sw1'), devices, [first]);
    expect(first.targetPort).toBe(1);
    expect(second.targetPort).toBe(2);
  });

  it('never overwrites an existing binding, even a dangling one', () => {
    const devices = [pc('pc1'), sw('sw1')];
    const explicit = bindConnection(link('pc1', 'sw1', { targetPort: 4 }), devices, []);
    expect(explicit).toMatchObject({ sourceNic: 'nic-1', targetPort: 4 });

    const dangling = bindConnection(link('pc1', 'sw1', { targetPort: 99 }), devices, []);
    expect(dangling.targetPort).toBe(99);
  });

  it('leaves an end unbound when its device has no interface or none is free', () => {
    const devices = [device({ id: 'legacy' }), pc('pc1'), pc('pc2')];
    const noInterfaces = bindConnection(link('legacy', 'pc1'), devices, []);
    expect(isEndBound(noInterfaces, 'source')).toBe(false);
    expect(noInterfaces.targetNic).toBe('nic-1');

    // pc1's only NIC is now taken: the next link to pc1 stays unbound there
    const noneFree = bindConnection(link('pc2', 'pc1'), devices, [noInterfaces]);
    expect(noneFree.sourceNic).toBe('nic-1');
    expect(isEndBound(noneFree, 'target')).toBe(false);
  });

  it('returns the same object when there is nothing to bind', () => {
    const devices = [pc('pc1'), sw('sw1')];
    const already = link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 2 });
    expect(bindConnection(already, devices, [])).toBe(already);
  });

  it('does not mutate its input and ignores its own entry in the list', () => {
    const devices = [pc('pc1'), sw('sw1')];
    const original = link('pc1', 'sw1');
    const bound = bindConnection(original, devices, [original]);
    expect(original).toEqual({ id: 'pc1--sw1', source: 'pc1', target: 'sw1' });
    expect(bound).not.toBe(original);
    expect(bound.targetPort).toBe(1);
  });

  it('gives the two ends of a self-loop two different interfaces', () => {
    const bound = bindConnection(link('sw1', 'sw1'), [sw('sw1')], []);
    expect(bound).toMatchObject({ sourcePort: 1, targetPort: 2 });
  });
});

// ---------- binding a whole topology ----------

describe('bindUnboundConnections', () => {
  const devices = [sw('sw1', 4), pc('pc1'), pc('pc2'), pc('pc3')];

  it('binds every link in connection order, lowest free port first', () => {
    const bound = bindUnboundConnections(devices, [
      link('pc1', 'sw1'),
      link('sw1', 'pc2'),
      link('pc3', 'sw1'),
    ]);
    expect(bound).toMatchObject([
      { sourceNic: 'nic-1', targetPort: 1 },
      { sourcePort: 2, targetNic: 'nic-1' },
      { sourceNic: 'nic-1', targetPort: 3 },
    ]);
  });

  it('reserves explicit bindings before auto-binding earlier links', () => {
    // The second link explicitly holds port 1: the first, unbound one must
    // not be auto-bound onto it just because it comes first.
    const bound = bindUnboundConnections(devices, [
      link('pc1', 'sw1'),
      link('pc2', 'sw1', { targetPort: 1 }),
    ]);
    expect(bound[0].targetPort).toBe(2);
    expect(bound[1].targetPort).toBe(1);
  });

  it('never puts two links on the same interface', () => {
    const many = [sw('core', 8), sw('sw-a', 4), sw('sw-b', 4), pc('pc1'), pc('pc2'), pc('pc3')];
    const bound = bindUnboundConnections(many, [
      link('core', 'sw-a'),
      link('core', 'sw-b', { sourcePort: 1 }),
      link('sw-a', 'pc1'),
      link('sw-a', 'pc2'),
      link('sw-b', 'pc3'),
      link('sw-a', 'sw-b'),
    ]);
    const all = claims(many, bound);
    expect(all).toHaveLength(12); // every end bound
    expect(new Set(all).size).toBe(all.length); // no interface claimed twice
  });

  it('is deterministic and idempotent', () => {
    const connections = [link('pc1', 'sw1'), link('sw1', 'pc2'), link('pc3', 'sw1')];
    const once = bindUnboundConnections(devices, connections);
    const again = bindUnboundConnections(devices, connections);
    expect(again).toEqual(once);
    // a second pass over its own output is a no-op and says so by identity
    expect(bindUnboundConnections(devices, once)).toBe(once);
  });

  it('leaves the surplus links unbound when a device runs out of interfaces', () => {
    const tiny = [sw('sw1', 1), pc('pc1'), pc('pc2')];
    const bound = bindUnboundConnections(tiny, [link('pc1', 'sw1'), link('pc2', 'sw1')]);
    expect(bound[0]).toMatchObject({ sourceNic: 'nic-1', targetPort: 1 });
    expect(bound[1].sourceNic).toBe('nic-1');
    expect(isEndBound(bound[1], 'target')).toBe(false);
  });

  it('keeps already-bound connections by identity and does not mutate the input', () => {
    const kept = link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 1 });
    const loose = link('pc2', 'sw1');
    const input = [kept, loose];
    const bound = bindUnboundConnections(devices, input);
    expect(bound).not.toBe(input);
    expect(bound[0]).toBe(kept);
    expect(loose).toEqual({ id: 'pc2--sw1', source: 'pc2', target: 'sw1' });
  });

  it('ignores links that reference a missing device', () => {
    const input = [link('ghost', 'sw1')];
    const bound = bindUnboundConnections(devices, input);
    expect(isEndBound(bound[0], 'source')).toBe(false);
    expect(bound[0].targetPort).toBe(1);
  });
});

// ---------- sanitising ----------

describe('sanitizeBindings', () => {
  it('unbinds links that pointed at ports removed by a port count shrink', () => {
    const before = [sw('sw1', 8), pc('pc1'), pc('pc2'), pc('pc3')];
    const connections = [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 2 }),
      link('pc2', 'sw1', { sourceNic: 'nic-1', targetPort: 7 }),
      link('pc3', 'sw1', { sourceNic: 'nic-1', targetPort: 8 }),
    ];
    expect(sanitizeBindings(before, connections)).toBe(connections); // all valid: no-op

    const after = [sw('sw1', 4), ...before.slice(1)];
    const sanitized = sanitizeBindings(after, connections);
    expect(sanitized[0]).toBe(connections[0]); // port 2 survives
    expect(isEndBound(sanitized[1], 'target')).toBe(false);
    expect(isEndBound(sanitized[2], 'target')).toBe(false);
    // the surviving ends of the shrunk links keep their NIC binding
    expect(sanitized[1].sourceNic).toBe('nic-1');
    expect('targetPort' in sanitized[1]).toBe(false);
  });

  it('unbinds links that pointed at a removed NIC', () => {
    const srv = device({ id: 'srv', nics: [nic('nic-1', 'eth0')] });
    const connections = [link('srv', 'sw1', { sourceNic: 'nic-2', targetPort: 1 })];
    const sanitized = sanitizeBindings([srv, sw('sw1')], connections);
    expect(isEndBound(sanitized[0], 'source')).toBe(false);
    expect(sanitized[0].targetPort).toBe(1);
  });

  it('keeps the first claim and unbinds the later one when two links share an interface', () => {
    const devices = [sw('sw1'), pc('pc1'), pc('pc2')];
    const connections = [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 1 }),
      link('pc2', 'sw1', { sourceNic: 'nic-1', targetPort: 1 }),
    ];
    const sanitized = sanitizeBindings(devices, connections);
    expect(sanitized[0]).toBe(connections[0]);
    expect(isEndBound(sanitized[1], 'target')).toBe(false);
    expect(sanitized[1].sourceNic).toBe('nic-1'); // pc2's own NIC is not contested
  });

  it('unbinds the second end of a self-loop that reuses the same port', () => {
    const sanitized = sanitizeBindings(
      [sw('sw1')],
      [link('sw1', 'sw1', { sourcePort: 1, targetPort: 1 })]
    );
    expect(sanitized[0].sourcePort).toBe(1);
    expect(isEndBound(sanitized[0], 'target')).toBe(false);
  });

  it('keeps only the binding that resolves when an end carries both a port and a NIC', () => {
    const connections = [link('pc1', 'sw1', { sourcePort: 3, sourceNic: 'nic-1', targetPort: 1 })];
    const sanitized = sanitizeBindings([pc('pc1'), sw('sw1')], connections);
    expect(sanitized[0].sourceNic).toBe('nic-1');
    expect('sourcePort' in sanitized[0]).toBe(false);
  });

  it('drops bindings on links whose device is gone, without touching the input', () => {
    const connections = [link('ghost', 'sw1', { sourcePort: 1, targetPort: 1 })];
    const sanitized = sanitizeBindings([sw('sw1')], connections);
    expect(isEndBound(sanitized[0], 'source')).toBe(false);
    expect(sanitized[0].targetPort).toBe(1);
    expect(connections[0].sourcePort).toBe(1); // input untouched
  });
});

// ---------- sanitise + bind in one step (what every load runs) ----------

describe('normalizeBindings', () => {
  const devices = [sw('sw1', 4), pc('pc1'), pc('pc2'), pc('pc3')];

  it('restores the one-link-per-interface invariant on messy data', () => {
    const messy = [
      link('pc1', 'sw1', { targetPort: 1 }),
      link('pc2', 'sw1', { targetPort: 1 }), // duplicate claim
      link('pc3', 'sw1', { targetPort: 9 }), // port does not exist
    ];
    const bound = normalizeBindings(devices, messy);
    const all = claims(devices, bound);
    expect(all).toHaveLength(6);
    expect(new Set(all).size).toBe(6);
    expect(bound.map(c => c.targetPort)).toEqual([1, 2, 3]);
  });

  it('binds data that was saved without any binding', () => {
    const bound = normalizeBindings(devices, [link('pc1', 'sw1'), link('pc2', 'sw1')]);
    expect(bound).toMatchObject([
      { sourceNic: 'nic-1', targetPort: 1 },
      { sourceNic: 'nic-1', targetPort: 2 },
    ]);
  });

  it('is a no-op, by identity, on a topology that is already complete and valid', () => {
    const complete = [
      link('pc1', 'sw1', { sourceNic: 'nic-1', targetPort: 3 }),
      link('pc2', 'sw1', { sourceNic: 'nic-1', targetPort: 1 }),
    ];
    expect(normalizeBindings(devices, complete)).toBe(complete);
  });
});

// ---------- firewalls with security zones ----------

describe('zoned firewalls are never bound automatically', () => {
  // Each port of a zoned firewall stands for a policy (untrust / dmz / trust):
  // picking one for the user would be picking the policy for them
  const zonedFirewall = device({
    id: 'fw1',
    type: 'Firewall',
    ports: [
      port(1, { securityZone: 'untrust' }),
      port(2, { securityZone: 'dmz' }),
      port(3, { securityZone: 'trust' }),
    ],
  });
  const plainFirewall = device({ id: 'fw2', type: 'Firewall', ports: ports(3) });
  const devices = [zonedFirewall, plainFirewall, sw('sw1')];

  it('tells the two kinds of firewall apart', () => {
    expect(requiresExplicitBinding(zonedFirewall)).toBe(true);
    expect(requiresExplicitBinding(plainFirewall)).toBe(false);
    expect(requiresExplicitBinding(sw('sw1'))).toBe(false);
  });

  it('offers no free interface on a zoned firewall', () => {
    expect(firstFreeInterface(zonedFirewall, [])).toBeUndefined();
    expect(firstFreeInterface(plainFirewall, [])?.key).toBe('port:1');
  });

  it('a new link leaves the zoned firewall end unbound and binds the other end', () => {
    const bound = bindConnection(link('sw1', 'fw1'), devices, []);

    expect(bound.sourcePort).toBe(1);
    expect(isEndBound(bound, 'target')).toBe(false);
  });

  it('loading old data does not guess a zone either, and stays stable across loads', () => {
    const old = [link('sw1', 'fw1'), link('fw1', 'fw2')];

    const once = normalizeBindings(devices, old);
    const twice = normalizeBindings(devices, once);

    expect(isEndBound(once[0], 'target')).toBe(false); // on fw1
    expect(isEndBound(once[1], 'source')).toBe(false); // on fw1
    expect(once[1].targetPort).toBe(1); // the plain firewall is bound as usual
    expect(twice).toBe(once);
  });

  it('a port chosen by the user on a zoned firewall is kept', () => {
    const chosen = [link('sw1', 'fw1', { targetPort: 3 })];

    const result = normalizeBindings(devices, chosen);

    expect(result[0].targetPort).toBe(3);
    expect(result[0].sourcePort).toBe(1);
  });
});
