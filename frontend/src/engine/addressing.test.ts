import { describe, it, expect } from 'vitest';
import { device, nic, port, route } from '@/test/networkFixtures';
import {
  formatNetwork,
  hasInterfaceAddresses,
  ipToNumber,
  l3Interfaces,
  lookupRoute,
  maskToPrefix,
  networkContains,
  networkOf,
  numberToIp,
  ownedAddresses,
  parseNetwork,
  prefixToMask,
  primaryAddress,
  routingTable,
} from './addressing';

const parsed = (text: string) => {
  const network = parseNetwork(text);
  return network ? formatNetwork(network) : undefined;
};

describe('IPv4 arithmetic', () => {
  it('converts addresses to numbers and back, the high ones included', () => {
    for (const ip of ['0.0.0.0', '10.0.0.1', '192.168.1.254', '203.0.113.9', '255.255.255.255']) {
      expect(numberToIp(ipToNumber(ip))).toBe(ip);
    }
    // No negative numbers for addresses above 127.255.255.255
    expect(ipToNumber('192.168.1.1')).toBeGreaterThan(0);
    expect(ipToNumber('255.255.255.255')).toBe(4294967295);
  });

  it('reads a mask as a prefix length, and refuses what is not a mask', () => {
    expect(maskToPrefix('255.255.255.0')).toBe(24);
    expect(maskToPrefix('255.255.255.252')).toBe(30);
    expect(maskToPrefix('255.255.0.0')).toBe(16);
    expect(maskToPrefix('0.0.0.0')).toBe(0);
    expect(maskToPrefix('255.255.255.255')).toBe(32);
    expect(maskToPrefix('255.0.255.0')).toBeUndefined();
    expect(maskToPrefix('24')).toBeUndefined();
    expect(maskToPrefix('')).toBeUndefined();
  });

  it('writes a prefix length as a mask', () => {
    expect(prefixToMask(24)).toBe('255.255.255.0');
    expect(prefixToMask(26)).toBe('255.255.255.192');
    expect(prefixToMask(0)).toBe('0.0.0.0');
    expect(prefixToMask(32)).toBe('255.255.255.255');
  });

  it('finds the network of an address; an unusable mask counts as /24', () => {
    expect(formatNetwork(networkOf('192.168.10.77', '255.255.255.0'))).toBe('192.168.10.0/24');
    expect(formatNetwork(networkOf('10.1.2.3', '255.255.0.0'))).toBe('10.1.0.0/16');
    expect(formatNetwork(networkOf('192.168.10.77', ''))).toBe('192.168.10.0/24');
    expect(formatNetwork(networkOf('192.168.10.77', '255.0.255.0'))).toBe('192.168.10.0/24');
  });

  it('tells whether an address is inside a network, at the edges too', () => {
    const p2p = parseNetwork('10.0.0.0/30');
    expect(p2p).toBeDefined();
    if (!p2p) return;
    expect(networkContains(p2p, '10.0.0.0')).toBe(true);
    expect(networkContains(p2p, '10.0.0.3')).toBe(true);
    expect(networkContains(p2p, '10.0.0.4')).toBe(false);

    const high = parseNetwork('203.0.113.0/24');
    expect(high && networkContains(high, '203.0.113.200')).toBe(true);
    expect(high && networkContains(high, '203.0.114.1')).toBe(false);

    const everything = parseNetwork('default');
    expect(everything && networkContains(everything, '255.255.255.255')).toBe(true);
    expect(everything && networkContains(everything, '1.2.3.4')).toBe(true);
  });
});

describe('parseNetwork', () => {
  it('reads a network in CIDR form', () => {
    expect(parsed('192.168.30.0/24')).toBe('192.168.30.0/24');
    expect(parsed(' 10.0.0.0/8 ')).toBe('10.0.0.0/8');
    expect(parsed('172.16.0.4/30')).toBe('172.16.0.4/30');
  });

  it('drops the host bits: an address with a prefix names its network', () => {
    expect(parsed('192.168.30.7/24')).toBe('192.168.30.0/24');
    expect(parsed('10.9.8.7/8')).toBe('10.0.0.0/8');
  });

  it('takes a bare address as a single host', () => {
    expect(parsed('192.168.30.7')).toBe('192.168.30.7/32');
  });

  it('knows the default route by name and by number', () => {
    expect(parsed('default')).toBe('default');
    expect(parsed('DEFAULT')).toBe('default');
    expect(parsed('0.0.0.0/0')).toBe('default');
  });

  it.each(['', 'servers', '192.168.1.0/33', '192.168.1.0/', '192.168.1/24', '1.2.3.4/24/1', '300.1.1.1/24', '10.0.0.0/2x', '10.0.0.0/-1'])(
    'refuses "%s"',
    text => {
      expect(parseNetwork(text)).toBeUndefined();
    }
  );
});

describe('l3Interfaces', () => {
  it('lists the addressed ports of a router, with their networks', () => {
    const router = device({
      id: 'r1',
      type: 'Router',
      ip: '192.168.10.1',
      gateway: '10.0.0.2',
      ports: [
        port(1, { ip: '192.168.10.1', subnet: '255.255.255.0' }),
        port(2, { ip: '10.0.0.1', subnet: '255.255.255.252' }),
        port(3),
      ],
    });
    const interfaces = l3Interfaces(router);
    expect(interfaces.map(i => [i.iface?.label, i.ip, formatNetwork(i.network), i.gateway])).toEqual([
      ['port 1', '192.168.10.1', '192.168.10.0/24', ''],
      ['port 2', '10.0.0.1', '10.0.0.0/30', ''],
    ]);
    expect(hasInterfaceAddresses(router)).toBe(true);
  });

  it('gives an addressed port without a mask a /24', () => {
    const router = device({ id: 'r1', type: 'Router', ports: [port(1, { ip: '10.1.2.3' })] });
    expect(formatNetwork(l3Interfaces(router)[0].network)).toBe('10.1.2.0/24');
  });

  it('reads NICs with their own gateway, never the device-level one', () => {
    const server = device({
      id: 'srv',
      ip: '192.168.1.5',
      gateway: '192.168.1.254', // stale leftover
      nics: [
        nic({ id: 'nic-1', name: 'eth0', ip: '192.168.1.5', gateway: '192.168.1.1' }),
        nic({ id: 'nic-2', name: 'eth1', ip: '10.0.0.5' }),
      ],
    });
    expect(l3Interfaces(server).map(i => [i.iface?.label, i.gateway])).toEqual([
      ['eth0', '192.168.1.1'],
      ['eth1', ''],
    ]);
  });

  it('falls back to the device-level address when no interface has one', () => {
    const legacy = device({ id: 'pc', ip: '192.168.1.10', gateway: '192.168.1.1', nics: [nic()] });
    const interfaces = l3Interfaces(legacy);
    expect(interfaces).toHaveLength(1);
    expect(interfaces[0]).toMatchObject({ ip: '192.168.1.10', gateway: '192.168.1.1', enabled: true });
    expect(interfaces[0].iface).toBeUndefined();
    expect(hasInterfaceAddresses(legacy)).toBe(false);
  });

  it('is empty for a device with no address anywhere', () => {
    expect(l3Interfaces(device({ id: 'pc' }))).toEqual([]);
  });
});

describe('primaryAddress and ownedAddresses', () => {
  it('a device with NICs is named by its first enabled NIC that has an address', () => {
    const pc = device({
      id: 'pc',
      ip: '192.168.1.99', // stale mirror
      nics: [
        nic({ id: 'nic-1', name: 'eth0', ip: '10.0.0.5', enabled: false }),
        nic({ id: 'nic-2', name: 'eth1', ip: '192.168.1.10' }),
      ],
    });
    expect(primaryAddress(pc)).toBe('192.168.1.10');
  });

  it('a router is named by its device-level (management) address', () => {
    const router = device({
      id: 'r1',
      type: 'Router',
      ip: '192.168.20.1',
      ports: [port(1, { ip: '192.168.10.1' }), port(2, { ip: '192.168.20.1' })],
    });
    expect(primaryAddress(router)).toBe('192.168.20.1');
  });

  it('a router without a device-level address is named by its first addressed port', () => {
    const router = device({ id: 'r1', type: 'Router', ports: [port(1), port(2, { ip: '10.0.0.1' })] });
    expect(primaryAddress(router)).toBe('10.0.0.1');
    expect(primaryAddress(device({ id: 'pc' }))).toBe('');
  });

  it('a device answers to every address it carries, once each', () => {
    const router = device({
      id: 'r1',
      type: 'Router',
      ip: '192.168.10.1',
      ports: [port(1, { ip: '192.168.10.1' }), port(2, { ip: '10.0.0.1' })],
    });
    expect(ownedAddresses(router)).toEqual(['192.168.10.1', '10.0.0.1']);

    const withLoopback = { ...router, ip: '172.16.0.1' };
    expect(ownedAddresses(withLoopback)).toEqual(['192.168.10.1', '10.0.0.1', '172.16.0.1']);
  });
});

describe('routingTable and lookupRoute', () => {
  const router = device({
    id: 'r1',
    type: 'Router',
    ip: '192.168.10.1',
    gateway: '10.0.0.2',
    ports: [
      port(1, { ip: '192.168.10.1', subnet: '255.255.255.0' }),
      port(2, { ip: '10.0.0.1', subnet: '255.255.255.252' }),
    ],
    routes: [route('192.168.30.0/24', '10.0.0.2'), route('192.168.0.0/16', '10.0.0.2')],
  });
  const describeTable = (dev = router) =>
    routingTable(dev).map(e => [formatNetwork(e.network), e.kind, e.nextHop, e.out?.iface?.label]);

  it('holds connected networks, static routes and the default, most specific first', () => {
    expect(describeTable()).toEqual([
      ['10.0.0.0/30', 'connected', undefined, 'port 2'],
      ['192.168.10.0/24', 'connected', undefined, 'port 1'],
      ['192.168.30.0/24', 'static', '10.0.0.2', 'port 2'],
      ['192.168.0.0/16', 'static', '10.0.0.2', 'port 2'],
      ['default', 'default', '10.0.0.2', 'port 2'],
    ]);
  });

  it('picks the most specific entry for an address', () => {
    const table = routingTable(router);
    const chosen = (ip: string) => {
      const entry = lookupRoute(table, ip);
      return entry ? formatNetwork(entry.network) : undefined;
    };
    expect(chosen('192.168.10.50')).toBe('192.168.10.0/24');
    expect(chosen('192.168.30.50')).toBe('192.168.30.0/24');
    expect(chosen('192.168.77.1')).toBe('192.168.0.0/16');
    expect(chosen('8.8.8.8')).toBe('default');
    expect(chosen('not an address')).toBeUndefined();
  });

  it('prefers a connected network to a static route for the same network', () => {
    const shadowed = { ...router, routes: [route('192.168.10.0/24', '10.0.0.2')] };
    expect(lookupRoute(routingTable(shadowed), '192.168.10.50')?.kind).toBe('connected');
  });

  it('has no entry for an unknown network when there is no default', () => {
    const noDefault = { ...router, gateway: '', routes: [] };
    expect(lookupRoute(routingTable(noDefault), '8.8.8.8')).toBeUndefined();
  });

  it('leaves the way out of a route empty when its next hop is on no connected network', () => {
    const lost = { ...router, gateway: '', routes: [route('192.168.30.0/24', '172.16.0.1')] };
    const entry = lookupRoute(routingTable(lost), '192.168.30.1');
    expect(entry?.nextHop).toBe('172.16.0.1');
    expect(entry?.out).toBeUndefined();
  });

  it('leaves out routes that are not a network and an address', () => {
    const broken = {
      ...router,
      gateway: '',
      routes: [route('servers', '10.0.0.2'), route('192.168.30.0/24', 'R2')],
    };
    expect(describeTable(broken).map(row => row[1])).toEqual(['connected', 'connected']);
  });

  it('ignores a gateway or a route that points at one of its own addresses', () => {
    // a route through yourself leads nowhere: "no route" is the honest answer
    const selfish = {
      ...router,
      gateway: '192.168.10.1',
      routes: [route('192.168.30.0/24', '10.0.0.1')],
    };
    expect(describeTable(selfish).map(row => row[1])).toEqual(['connected', 'connected']);
    expect(lookupRoute(routingTable(selfish), '192.168.30.5')).toBeUndefined();
  });

  it('gives an end device one default route per NIC that has a gateway', () => {
    const server = device({
      id: 'srv',
      gateway: '192.168.1.254', // device-level leftover: ignored
      nics: [
        nic({ id: 'nic-1', name: 'eth0', ip: '192.168.1.5', gateway: '192.168.1.1' }),
        nic({ id: 'nic-2', name: 'eth1', ip: '10.0.0.5' }),
      ],
    });
    expect(describeTable(server)).toEqual([
      ['192.168.1.0/24', 'connected', undefined, 'eth0'],
      ['10.0.0.0/24', 'connected', undefined, 'eth1'],
      ['default', 'default', '192.168.1.1', 'eth0'],
    ]);
  });

  it('gives no default route to a device whose NICs have no gateway, whatever the device says', () => {
    const pc = device({
      id: 'pc',
      gateway: '192.168.1.1',
      nics: [nic({ ip: '192.168.1.10' })],
    });
    expect(lookupRoute(routingTable(pc), '8.8.8.8')).toBeUndefined();
  });

  it('skips a route that leaves from a disabled interface when asked to', () => {
    const server = device({
      id: 'srv',
      nics: [
        nic({ id: 'nic-1', name: 'eth0', ip: '10.0.0.5', enabled: false }),
        nic({ id: 'nic-2', name: 'eth1', ip: '192.168.1.5', gateway: '192.168.1.1' }),
      ],
    });
    const table = routingTable(server);
    expect(lookupRoute(table, '10.0.0.9')?.out?.iface?.label).toBe('eth0');
    // eth0 is down: the storage network is reached through the gateway of eth1
    const live = lookupRoute(table, '10.0.0.9', { enabledOnly: true });
    expect(live?.kind).toBe('default');
    expect(live?.out?.iface?.label).toBe('eth1');
  });
});
