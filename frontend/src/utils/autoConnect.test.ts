/**
 * The automatic connection (Vista → Collega i dispositivi senza cavo): only a
 * device with no cable gets one, never one that closes a loop. An end device
 * goes to the nearest switch of its own network (a laptop, a smartphone or a
 * tablet to an access point of it first), on a free port; a switch with no
 * uplink to the nearest router, firewall or core switch of its network.
 * Routers, firewalls and the Internet are cabled by hand, end devices are
 * never cabled together, and no cable gets a name. What is left alone is
 * said, with the reason.
 */
import { describe, it, expect } from 'vitest';
import type { NetworkConnection, NetworkDevice, Port } from '@/types';
import { device, host, nic, port, switchWith } from '@/test/networkFixtures';
import { normalizeBindings, requiresExplicitBinding } from '@/engine';
import { createSampleTopology } from './sampleTopology';
import { createPerimeterSample } from './samplePerimeter';
import { createCompanySample } from './sampleCompany';
import { createRedundancySample } from './sampleRedundancy';
import { connectLooseDevices } from './autoConnect';

const ports = (count: number): Port[] => Array.from({ length: count }, (_, index) => port(index + 1));
const at = (x: number, y: number) => ({ position: { x, y } });
const sw = (id: string, ip: string, x: number, y: number, count = 8, extra: Partial<NetworkDevice> = {}) =>
  switchWith(id, ports(count), { ip, subnet: '255.255.255.0', ...at(x, y), ...extra });
const pc = (id: string, ip: string, x: number, y: number, extra: Partial<NetworkDevice> = {}) =>
  host(id, ip, '', { ...at(x, y), ...extra });
const router = (id: string, x: number, y: number, portIps: string[]) =>
  device({
    id,
    type: 'Router',
    ip: portIps[0] ?? '',
    ...at(x, y),
    portCount: portIps.length,
    ports: portIps.map((ip, index) => port(index + 1, { ip, subnet: '255.255.255.0' })),
  });
const wire = (id: string, source: string, target: string): NetworkConnection => ({ id, source, target });

/** The cables made, as `source>target` */
const made = (result: ReturnType<typeof connectLooseDevices>) => result.connections.map((one) => `${one.source}>${one.target}`);
const leftAlone = (result: ReturnType<typeof connectLooseDevices>) =>
  Object.fromEntries(result.left.map((one) => [one.deviceId, one.reason]));

describe('only a device with no cable gets one', () => {
  it('a PC with a cable keeps it and gets no other; one with none is cabled', () => {
    const devices = [sw('SW-A', '10.0.0.2', 0, 0), sw('SW-B', '10.0.0.3', 300, 0), pc('PC-1', '10.0.0.11', 0, 200), pc('PC-2', '10.0.0.12', 300, 200)];
    const result = connectLooseDevices(devices, [wire('c1', 'SW-A', 'PC-1')], 1);
    expect(made(result)).toEqual(['SW-B>PC-2']);
  });

  it('never closes a loop: a switch already reached from the router, through its PC, gets no cable to it', () => {
    const devices = [
      router('R-1', 0, 0, ['10.0.0.1', '']),
      sw('SW-1', '10.0.0.2', 0, 200),
      pc('PC-1', '10.0.0.11', 0, 400, { nics: [nic({ id: 'nic-1', ip: '10.0.0.11' }), nic({ id: 'nic-2', name: 'eth1', ip: '' })] }),
    ];
    const result = connectLooseDevices(devices, [wire('c1', 'SW-1', 'PC-1'), wire('c2', 'R-1', 'PC-1')], 1);
    expect(made(result)).toEqual([]);
    expect(result.left).toEqual([]);
  });

  it('two switches cabled together with no router get one uplink between them, not one each', () => {
    const devices = [
      router('R-1', 0, 0, ['10.0.0.1', '', '']),
      sw('SW-A', '10.0.0.2', 0, 200),
      sw('SW-B', '10.0.0.3', 300, 200),
    ];
    const result = connectLooseDevices(devices, [wire('c1', 'SW-A', 'SW-B')], 1);
    expect(made(result)).toEqual(['R-1>SW-A']);
    expect(result.left).toEqual([]);
  });
});

describe('an end device', () => {
  it('goes to the nearest switch of its own network, not to a nearer one of another', () => {
    const devices = [sw('SW-Near', '10.1.0.2', 100, 0), sw('SW-Own', '10.0.0.2', 800, 0), pc('PC-1', '10.0.0.11', 100, 200)];
    expect(made(connectLooseDevices(devices, [], 1))).toEqual(['SW-Own>PC-1']);
  });

  it('a switch knows the networks of what is cabled to it, not only its own address', () => {
    const devices = [
      sw('SW-Mgmt', '10.99.0.2', 100, 0),
      pc('PC-Old', '192.168.10.10', 0, 200),
      sw('SW-Far', '10.0.0.2', 900, 0),
      pc('PC-New', '192.168.10.11', 150, 200),
    ];
    expect(made(connectLooseDevices(devices, [wire('c1', 'SW-Mgmt', 'PC-Old')], 1))).toEqual(['SW-Mgmt>PC-New']);
  });

  it('a device on DHCP, and a switch with no network to tell, are matched by distance alone', () => {
    const switches = [sw('SW-Near', '', 100, 0), sw('SW-Far', '10.0.0.2', 900, 0)];
    const leased = pc('PC-Dhcp', '', 120, 200, { nics: [nic({ id: 'nic-1', ip: '', dhcp: true })] });
    expect(made(connectLooseDevices([...switches, leased], [], 1))).toEqual(['SW-Near>PC-Dhcp']);
    // (a switch with no address and nothing cabled to it may be on the PC's network)
    expect(made(connectLooseDevices([...switches, pc('PC-1', '10.0.0.11', 120, 200)], [], 1))).toEqual(['SW-Near>PC-1']);
  });

  it('a switch with no address is on the network of the first device cabled to it, and no other', () => {
    const devices = [sw('SW-Blank', '', 0, 0), pc('PC-A', '10.0.0.11', 0, 150), pc('PC-B', '10.1.0.11', 40, 300)];
    const result = connectLooseDevices(devices, [], 1);
    expect(made(result)).toEqual(['SW-Blank>PC-A']);
    expect(leftAlone(result)).toEqual({ 'PC-B': 'noSwitch' });
  });

  it('takes a free port: a full switch is passed over, and with none free it is left alone and said why', () => {
    const full = [sw('SW-Full', '10.0.0.2', 0, 0, 1), pc('PC-0', '10.0.0.10', 0, 200)];
    const devices = [...full, sw('SW-Free', '10.0.0.3', 600, 0, 2), pc('PC-1', '10.0.0.11', 50, 200)];
    const result = connectLooseDevices(devices, [wire('c1', 'SW-Full', 'PC-0')], 1);
    expect(made(result)).toEqual(['SW-Free>PC-1']);
    expect(result.connections[0]).toMatchObject({ sourcePort: 1, targetNic: 'nic-1' });

    const none = connectLooseDevices([...full, pc('PC-1', '10.0.0.11', 50, 200)], [wire('c1', 'SW-Full', 'PC-0')], 1);
    expect(made(none)).toEqual([]);
    expect(leftAlone(none)).toEqual({ 'PC-1': 'noFreePort' });
  });

  it('with no switch of its network it is left alone, and said why', () => {
    const result = connectLooseDevices([sw('SW-1', '10.1.0.2', 0, 0), pc('PC-1', '10.0.0.11', 0, 200)], [], 1);
    expect(made(result)).toEqual([]);
    // (and the switch, with no cable and nowhere to go up to, as well)
    expect(leftAlone(result)).toEqual({ 'PC-1': 'noSwitch', 'SW-1': 'noUplink' });
  });

  it('a laptop goes to an access point of its network that has a card free for it, else to a switch', () => {
    // (the access point is cabled first: its first card is its cable to the switch)
    const ap = (cards: number) =>
      device({
        id: 'AP-1',
        type: 'AccessPoint',
        ip: '10.0.0.5',
        ...at(300, 0),
        nics: Array.from({ length: cards }, (_, index) => nic({ id: `nic-${index + 1}`, name: `wlan${index}` })),
      });
    const laptop = pc('Laptop-1', '10.0.0.21', 300, 200, { templateId: 'tpl-laptop' });
    const switchToo = sw('SW-1', '10.0.0.2', 0, 0);
    const both = connectLooseDevices([switchToo, ap(2), laptop], [], 1);
    expect(made(both)).toEqual(['SW-1>AP-1', 'AP-1>Laptop-1']);
    expect(both.connections[0]).toMatchObject({ targetNic: 'nic-1' });
    expect(both.connections[1]).toMatchObject({ sourceNic: 'nic-2', targetNic: 'nic-1' });
    // its one card is its own cable: nothing free for a laptop
    expect(made(connectLooseDevices([switchToo, ap(1), laptop], [wire('c1', 'SW-1', 'AP-1')], 1))).toEqual(['SW-1>Laptop-1']);
    // and with no switch either: said why
    const camera = pc('Camera-1', '10.0.0.30', 600, 0);
    expect(leftAlone(connectLooseDevices([ap(1), laptop, camera], [wire('c1', 'Camera-1', 'AP-1')], 1))).toEqual({
      'Laptop-1': 'noFreePort',
    });
  });

  it('a smartphone on DHCP goes to the nearest access point; a printer goes to a switch', () => {
    const ap = device({ id: 'AP-1', type: 'AccessPoint', templateId: 'tpl-accesspoint', ip: '10.0.0.5', ...at(0, 0), nics: [nic(), nic({ id: 'nic-2', name: 'wlan0' })] });
    const phone = pc('Phone-1', '', 20, 200, { templateId: 'tpl-smartphone', nics: [nic({ ip: '', dhcp: true })] });
    const printer = pc('Printer-1', '10.0.0.50', 0, 200, { templateId: 'tpl-printer' });
    const result = connectLooseDevices([sw('SW-1', '10.0.0.2', 400, 0), ap, phone, printer], [wire('c1', 'SW-1', 'AP-1')], 1);
    expect(made(result).sort()).toEqual(['AP-1>Phone-1', 'SW-1>Printer-1']);
  });

  it('a laptop goes to an access point, not to an IoT gateway', () => {
    const gateway = device({
      id: 'IoT-1',
      type: 'AccessPoint',
      templateId: 'tpl-iotgateway',
      ip: '10.0.0.6',
      ...at(300, 0),
      nics: [nic({ ip: '10.0.0.6' }), nic({ id: 'nic-2', name: 'wlan0' })],
    });
    const laptop = pc('Laptop-1', '10.0.0.21', 300, 200, { templateId: 'tpl-laptop' });
    const result = connectLooseDevices([sw('SW-1', '10.0.0.2', 0, 0), gateway, laptop], [wire('c1', 'SW-1', 'IoT-1')], 1);
    expect(made(result)).toEqual(['SW-1>Laptop-1']);
  });

  it('a card on DHCP goes by distance alone, whatever address it had last', () => {
    const leased = pc('PC-1', '192.168.99.50', 100, 200, { nics: [nic({ ip: '192.168.99.50', dhcp: true })] });
    expect(made(connectLooseDevices([sw('SW-1', '10.0.0.2', 100, 0), leased], [], 1))).toEqual(['SW-1>PC-1']);
  });

  it('an address with no mask written is taken with the mask of a /24', () => {
    const unmasked = pc('PC-1', '10.0.0.11', 0, 200, { subnet: '', nics: [nic({ ip: '10.0.0.11', subnet: '' })] });
    const result = connectLooseDevices([sw('SW-Other', '10.0.1.2', 0, 0), sw('SW-Own', '10.0.0.2', 600, 0), unmasked], [], 1);
    expect(made(result)).toEqual(['SW-Own>PC-1']);
  });

  it('the last free port goes to the nearest device', () => {
    const one = sw('SW-1', '10.0.0.2', 0, 0, 1);
    const result = connectLooseDevices([one, pc('PC-Far', '10.0.0.12', 0, 600), pc('PC-Near', '10.0.0.11', 0, 150)], [], 1);
    expect(made(result)).toEqual(['SW-1>PC-Near']);
    expect(leftAlone(result)).toEqual({ 'PC-Far': 'noFreePort' });
  });

  it('a device drawn with no interfaces still gets its cable, its end not bound', () => {
    const bare = device({ id: 'Old-1', type: 'Server', ip: '10.0.0.40', ...at(0, 200) });
    const result = connectLooseDevices([sw('SW-1', '10.0.0.2', 0, 0), bare], [], 1);
    expect(made(result)).toEqual(['SW-1>Old-1']);
    expect(result.connections[0].targetNic).toBeUndefined();
    expect(result.connections[0].targetPort).toBeUndefined();
  });

  it('the new ids follow the counter, past those taken', () => {
    const devices = [sw('SW-1', '10.0.0.2', 0, 0), pc('PC-1', '10.0.0.11', 0, 200), pc('PC-0', '10.0.0.10', 300, 200)];
    const result = connectLooseDevices(devices, [{ id: 'conn-1', source: 'SW-1', target: 'PC-0' }], 1);
    expect(result.connections.map((one) => one.id)).toEqual(['conn-2']);
    expect(result.nextCounter).toBe(3);
  });
});

describe('a switch with no uplink', () => {
  it('goes to the nearest router of its network, known by the devices cabled to it first', () => {
    const devices = [
      router('R-Other', 50, 0, ['10.9.0.1']),
      router('R-Own', 700, 0, ['10.0.0.1']),
      sw('SW-1', '', 50, 200),
      pc('PC-1', '10.0.0.11', 50, 400),
    ];
    const result = connectLooseDevices(devices, [], 1);
    expect(made(result)).toEqual(['SW-1>PC-1', 'R-Own>SW-1']);
    expect(result.connections.map((one) => one.type)).toEqual(['access', 'uplink']);
    expect(leftAlone(result)).toEqual({ 'R-Other': 'byHand' });
  });

  it('a switch with its devices but no uplink gets one; with nowhere to go up to it is not said', () => {
    const drawn = [sw('SW-1', '10.0.0.2', 0, 200), pc('PC-1', '10.0.0.11', 0, 400)];
    const cable = [wire('c1', 'SW-1', 'PC-1')];
    expect(made(connectLooseDevices([router('R-1', 0, 0, ['10.0.0.1']), ...drawn], cable, 1))).toEqual(['R-1>SW-1']);
    const result = connectLooseDevices(drawn, cable, 1);
    expect(result.connections).toEqual([]);
    expect(result.left).toEqual([]);
  });

  it('or to a core switch (one cabled to a router); with none in its network it is left alone', () => {
    const core = sw('SW-Core', '10.0.0.2', 0, 200);
    const devices = [router('R-1', 0, 0, ['10.0.0.1']), core, sw('SW-Floor', '10.0.0.3', 600, 400)];
    expect(made(connectLooseDevices(devices, [wire('c1', 'R-1', 'SW-Core')], 1))).toEqual(['SW-Core>SW-Floor']);

    const alone = connectLooseDevices([router('R-1', 0, 0, ['10.5.0.1']), sw('SW-1', '10.0.0.3', 0, 200)], [], 1);
    expect(leftAlone(alone)).toEqual({ 'SW-1': 'noUplink', 'R-1': 'byHand' });
  });

  it('a router is on the networks of all its ports, not only of its own address', () => {
    // its own address is the one towards the Internet; port 2 is the switch's gateway
    const result = connectLooseDevices([router('R-1', 0, 0, ['10.0.0.1', '192.168.10.1']), sw('SW-1', '192.168.10.2', 0, 200)], [], 1);
    expect(made(result)).toEqual(['R-1>SW-1']);
    expect(result.connections[0].sourcePort).toBe(2);
  });

  it('ports left in VLAN 1 are no VLANs set apart: the switch is on the network of its address', () => {
    const plain = switchWith('SW-1', vlanPorts({ 1: { vlan: 1 }, 2: { vlan: 1 } }), { ip: '10.1.0.2', ...at(0, 0) });
    const result = connectLooseDevices([plain, pc('PC-1', '10.0.0.11', 0, 200)], [], 1);
    expect(leftAlone(result)).toEqual({ 'PC-1': 'noSwitch', 'SW-1': 'noUplink' });
  });
});

describe('never automatic', () => {
  it('routers, firewalls and the Internet are cabled by hand: left alone, said why', () => {
    const devices = [
      router('R-1', 0, 0, ['10.0.0.1']),
      device({ id: 'FW-1', type: 'Firewall', ip: '10.0.0.254', ...at(300, 0), ports: ports(4) }),
      device({ id: 'Internet', type: 'Cloud', ...at(600, 0), nics: [nic()] }),
    ];
    const result = connectLooseDevices(devices, [], 1);
    expect(made(result)).toEqual([]);
    expect(leftAlone(result)).toEqual({ 'R-1': 'byHand', 'FW-1': 'byHand', Internet: 'byHand' });
  });

  it('end devices are never cabled together, two databases neither; no cable is given a name', () => {
    const devices = [
      device({ id: 'DB-1', type: 'Database', ip: '10.0.0.31', ...at(0, 200), nics: [nic({ ip: '10.0.0.31' })] }),
      device({ id: 'DB-2', type: 'Database', ip: '10.0.0.32', ...at(200, 200), nics: [nic({ ip: '10.0.0.32' })] }),
      pc('PC-1', '10.0.0.11', 400, 200),
    ];
    const result = connectLooseDevices(devices, [], 1);
    expect(made(result)).toEqual([]);
    expect(leftAlone(result)).toEqual({ 'DB-1': 'noSwitch', 'DB-2': 'noSwitch', 'PC-1': 'noSwitch' });

    const cabled = connectLooseDevices([sw('SW-1', '10.0.0.2', 200, 0), ...devices], [], 1);
    expect(cabled.connections.every((one) => one.label === undefined && one.bandwidth === undefined)).toBe(true);
    expect(made(cabled).sort()).toEqual(['SW-1>DB-1', 'SW-1>DB-2', 'SW-1>PC-1']);
  });

  it('a firewall with zones gets its cable, but its port is the user\'s to choose', () => {
    const fw = device({
      id: 'FW-1',
      type: 'Firewall',
      ip: '10.0.0.1',
      ...at(0, 0),
      ports: [port(1, { ip: '10.0.0.1', subnet: '255.255.255.0', securityZone: 'trust' }), port(2, { securityZone: 'untrust' })],
    });
    const result = connectLooseDevices([fw, sw('SW-1', '10.0.0.2', 0, 200)], [], 1);
    expect(made(result)).toEqual(['FW-1>SW-1']);
    expect(result.connections[0].sourcePort).toBeUndefined();
    // (the uplink of a switch: its last free port)
    expect(result.connections[0].targetPort).toBe(8);
  });

  it('a firewall with zones whose every port has a cable has no room left', () => {
    const fw = device({
      id: 'FW-1',
      type: 'Firewall',
      ip: '10.0.0.1',
      ...at(0, 0),
      ports: [port(1, { ip: '10.0.0.1', subnet: '255.255.255.0', securityZone: 'trust' })],
    });
    const taken: NetworkConnection = { id: 'c1', source: 'FW-1', target: 'PC-0', targetNic: 'nic-1' };
    const result = connectLooseDevices([fw, pc('PC-0', '10.0.0.5', 300, 0), sw('SW-1', '10.0.0.2', 0, 200)], [taken], 1);
    expect(made(result)).toEqual([]);
    expect(leftAlone(result)).toEqual({ 'SW-1': 'noFreePort' });
  });

  it('the sides of a new cable face each other, from the upper device down', () => {
    const result = connectLooseDevices([sw('SW-1', '10.0.0.2', 0, 0), pc('PC-1', '10.0.0.11', 30, 300)], [], 5);
    expect(result.connections[0]).toMatchObject({ id: 'conn-5', sourceHandle: 'bottom', targetHandle: 'top' });
  });
});

/** Ports in access mode, with what is set on some of them */
const vlanPorts = (set: Record<number, Partial<Port>>, count = 8): Port[] =>
  Array.from({ length: count }, (_, index) => port(index + 1, { portType: 'access', ...set[index + 1] }));
const bound = (id: string, source: string, sourcePort: number, target: string, targetPort: number): NetworkConnection => ({
  id,
  source,
  target,
  sourcePort,
  targetPort,
});
/** Which port of the upper device each new cable took, by the device it went to */
const portsTaken = (result: ReturnType<typeof connectLooseDevices>) =>
  Object.fromEntries(result.connections.map((one) => [one.target, one.sourcePort]));

describe('the port it takes', () => {
  // R-1 port 1 is the offices' gateway (VLAN 10), port 2 the Wi-Fi's (VLAN 20):
  // cabled to SW-V ports 7 and 8, which tells which network each VLAN is
  const gatewayRouter = () => router('R-1', 0, 0, ['192.168.10.1', '192.168.20.1', '']);
  const toTheRouter = [bound('c1', 'R-1', 1, 'SW-V', 7), bound('c2', 'R-1', 2, 'SW-V', 8)];

  it('an end device takes a free port of its VLAN, else one with nothing set on it', () => {
    const swv = switchWith('SW-V', vlanPorts({ 1: { vlan: 10 }, 2: { vlan: 10 }, 3: { vlan: 20 }, 7: { vlan: 10 }, 8: { vlan: 20 } }), {
      ip: '10.99.0.3',
      ...at(0, 200),
    });
    const ap = device({ id: 'AP-1', type: 'AccessPoint', ip: '192.168.20.2', ...at(20, 400), nics: [nic({ ip: '192.168.20.2' })] });
    const pcs = [1, 2, 3].map((n) => pc(`PC-${n}`, `192.168.10.1${n}`, 200 + n * 100, 400));
    const result = connectLooseDevices([gatewayRouter(), swv, ap, ...pcs], toTheRouter, 1);
    // the access point, nearest, does not take port 1: that one is in the offices' VLAN
    expect(portsTaken(result)).toEqual({ 'AP-1': 3, 'PC-1': 1, 'PC-2': 2, 'PC-3': 4 });
  });

  it('a switch with VLANs is on the networks of its VLANs: its own address is the one it is managed at', () => {
    // nothing cabled to it, and a plain switch of another network nearer
    const bare = switchWith('SW-V', vlanPorts({ 1: { vlan: 10 }, 2: { vlan: 20 } }), { ip: '10.99.0.3', ...at(600, 0) });
    const plain = sw('SW-Other', '192.168.99.2', 0, 0);
    expect(made(connectLooseDevices([plain, bare, pc('PC-1', '192.168.10.11', 100, 200)], [], 1))).toEqual(['SW-V>PC-1']);

    // its VLANs known from the cables of the switch it hangs from: the PC takes the port of its VLAN,
    // and a server of a network neither VLAN is on does not go there
    const core = switchWith('SW-V', vlanPorts({ 1: { portType: 'trunk', vlan: [10, 20] }, 7: { vlan: 10 }, 8: { vlan: 20 } }), {
      ip: '10.99.0.2',
      ...at(0, 200),
    });
    const floor = switchWith('SW-Floor', vlanPorts({ 1: { vlan: 20 }, 2: { vlan: 10 }, 8: { portType: 'trunk', vlan: [10, 20] } }), {
      ip: '10.99.0.4',
      ...at(400, 400),
    });
    const devices = [gatewayRouter(), core, floor, pc('PC-1', '192.168.10.11', 400, 600), pc('Srv-1', '192.168.30.10', 500, 600)];
    const result = connectLooseDevices(devices, [...toTheRouter, bound('c3', 'SW-V', 1, 'SW-Floor', 8)], 1);
    expect(made(result)).toEqual(['SW-Floor>PC-1']);
    expect(result.connections[0].sourcePort).toBe(2);
    expect(leftAlone(result)).toEqual({ 'Srv-1': 'noSwitch' });
  });

  it('a VLAN nothing tells the network of yet may be any: a server goes there, on that VLAN\'s port', () => {
    // VLAN 10 is the offices', by the PC on port 1; VLAN 20 has nothing cabled
    const swv = switchWith('SW-V', vlanPorts({ 1: { vlan: 10 }, 2: { vlan: 10 }, 3: { vlan: 20 } }), { ip: '10.99.0.3', ...at(0, 0) });
    const devices = [
      swv,
      sw('SW-Other', '192.168.99.2', 900, 0),
      pc('PC-1', '192.168.10.11', 0, 200),
      pc('Srv-1', '192.168.20.10', 100, 200),
    ];
    const toPc: NetworkConnection = { id: 'c1', source: 'SW-V', target: 'PC-1', sourcePort: 1, targetNic: 'nic-1' };
    const result = connectLooseDevices(devices, [toPc], 1);
    expect(made(result)).toEqual(['SW-V>Srv-1']);
    expect(result.connections[0].sourcePort).toBe(3);
  });

  it('what a VLAN is, learnt from a cable just added: the next device does not take that VLAN\'s port', () => {
    // nothing cabled: the PC, nearest, takes port 1 and so tells that VLAN 10 is the offices';
    // the access point of the Wi-Fi then passes over port 2
    const swv = switchWith('SW-V', vlanPorts({ 1: { vlan: 10 }, 2: { vlan: 10 }, 3: { vlan: 20 } }), { ip: '10.99.0.3', ...at(0, 0) });
    const ap = device({ id: 'AP-1', type: 'AccessPoint', ip: '192.168.20.2', ...at(0, 400), nics: [nic({ ip: '192.168.20.2' })] });
    const result = connectLooseDevices([swv, pc('PC-1', '192.168.10.11', 0, 150), ap], [], 1);
    expect(portsTaken(result)).toEqual({ 'PC-1': 1, 'AP-1': 3 });
  });

  it('a switch is on the networks of the VLANs its trunk carries', () => {
    const r1 = router('R-1', 0, 0, ['192.168.10.1', '192.168.20.1']);
    const core = switchWith('SW-Core', vlanPorts({ 1: { portType: 'trunk', vlan: [10, 20] }, 7: { vlan: 10 }, 8: { vlan: 20 } }), { ip: '10.99.0.2', ...at(0, 200) });
    // the floor switch has no access port in a VLAN: only its trunk tells its networks
    const floor = switchWith('SW-Floor', vlanPorts({ 8: { portType: 'trunk', vlan: [10, 20] } }), { ip: '10.99.0.5', ...at(800, 400) });
    const cables = [bound('c1', 'R-1', 1, 'SW-Core', 7), bound('c2', 'R-1', 2, 'SW-Core', 8), bound('c3', 'SW-Core', 1, 'SW-Floor', 8)];
    const result = connectLooseDevices([r1, core, floor, pc('PC-1', '192.168.10.11', 800, 600)], cables, 1);
    expect(made(result)).toEqual(['SW-Floor>PC-1']);
  });

  it('a trunk port tells no VLAN its network, even when it carries one VLAN alone', () => {
    // port 8, a trunk of VLAN 20 alone, is cabled to the offices' gateway: VLAN 20 is not the offices'
    const r1 = router('R-1', 0, 0, ['192.168.10.1']);
    const swv = switchWith('SW-V', vlanPorts({ 3: { vlan: 20 }, 8: { portType: 'trunk', vlan: [20] } }), { ip: '10.99.0.3', ...at(0, 200) });
    const result = connectLooseDevices([r1, swv, pc('PC-1', '192.168.10.11', 0, 400)], [bound('c1', 'R-1', 1, 'SW-V', 8)], 1);
    expect(result.connections[0].sourcePort).toBe(1);
  });

  it('a router gives the port with an address on the network of the switch, never one of another network', () => {
    const drawn = [sw('SW-1', '192.168.10.2', 0, 200), pc('PC-1', '192.168.10.11', 0, 400)];
    const r1 = router('R-1', 0, 0, ['192.168.30.1', '', '192.168.10.1']);
    const result = connectLooseDevices([r1, ...drawn], [wire('c1', 'SW-1', 'PC-1')], 1);
    expect(made(result)).toEqual(['R-1>SW-1']);
    // (and the switch its last free port: the uplinks at the end, the devices from port 1)
    expect(result.connections[0]).toMatchObject({ sourcePort: 3, targetPort: 8 });

    // its only free port is the gateway of another network: no room for the switch
    const r2 = router('R-2', 0, 0, ['192.168.30.1', '192.168.10.1']);
    const busy = [r2, sw('SW-1', '192.168.10.2', 0, 200), pc('PC-0', '192.168.10.5', 300, 200)];
    const toPc: NetworkConnection = { id: 'c1', source: 'R-2', target: 'PC-0', sourcePort: 2, targetNic: 'nic-1' };
    const full = connectLooseDevices(busy, [toPc], 1);
    expect(made(full)).toEqual([]);
    expect(leftAlone(full)).toEqual({ 'SW-1': 'noFreePort' });
  });

  it('an end device passes over a trunk port and a port turned off', () => {
    const swt = switchWith('SW-1', vlanPorts({ 1: { portType: 'trunk' }, 2: { enabled: false } }), { ip: '10.0.0.2', ...at(0, 0) });
    const result = connectLooseDevices([swt, pc('PC-1', '10.0.0.11', 0, 200)], [], 1);
    expect(result.connections[0].sourcePort).toBe(3);
  });

  it('the switch end of an uplink takes the port in the VLAN of the router port it is cabled to', () => {
    // VLAN 20 is known by SW-X, cabled to the Wi-Fi's gateway; SW-V and its PC have no way up
    const r1 = router('R-1', 0, 0, ['192.168.10.1', '192.168.20.1']);
    const other = switchWith('SW-X', vlanPorts({ 8: { vlan: 20 } }), { ip: '10.99.0.9', ...at(900, 200) });
    const swv = switchWith('SW-V', vlanPorts({ 1: { vlan: 10 }, 7: { vlan: 10 }, 8: { vlan: 20 } }), { ip: '10.99.0.3', ...at(0, 200) });
    const toPc: NetworkConnection = { id: 'c2', source: 'SW-V', target: 'PC-1', sourcePort: 1, targetNic: 'nic-1' };
    const result = connectLooseDevices([r1, other, swv, pc('PC-1', '192.168.10.11', 0, 400)], [bound('c1', 'R-1', 2, 'SW-X', 8), toPc], 1);
    expect(made(result)).toEqual(['R-1>SW-V']);
    expect(result.connections[0]).toMatchObject({ sourcePort: 1, targetPort: 7 });
  });

  it('between two switches: a trunk port where there is one, else the last free port', () => {
    const r1 = router('R-1', 0, 0, ['10.0.0.1']);
    const core = sw('SW-Core', '10.0.0.2', 0, 200);
    const floor = switchWith('SW-Floor', vlanPorts({ 3: { portType: 'trunk' } }), { ip: '10.0.0.3', ...at(0, 400) });
    const result = connectLooseDevices([r1, core, floor], [bound('c1', 'R-1', 1, 'SW-Core', 8)], 1);
    expect(made(result)).toEqual(['SW-Core>SW-Floor']);
    expect(result.connections[0]).toMatchObject({ sourcePort: 7, targetPort: 3, type: 'trunk' });
  });
});

describe('a group with no way up', () => {
  it('an access point with its Wi-Fi devices but no cable to a switch gets one, on the port it had', () => {
    const { devices, connections } = createCompanySample();
    const rest = connections.filter((one) => one.id !== 'link-ap-uffici');
    const result = connectLooseDevices(devices, rest, 1);
    expect(made(result)).toEqual(['sw-uffici>ap-uffici']);
    expect(result.connections[0]).toMatchObject({ sourcePort: 4, targetNic: 'nic-1' });
  });

  it('an access point cabled to a switch with no way up: the group goes up from its switch', () => {
    const r1 = router('R-1', 0, 0, ['10.0.0.1', '']);
    const core = sw('SW-Core', '10.0.0.2', 300, 0);
    // (a card free, and nearer to the core switch than its own switch is)
    const ap = device({
      id: 'AP-1',
      type: 'AccessPoint',
      ip: '10.0.0.5',
      ...at(300, 150),
      nics: [nic({ ip: '10.0.0.5' }), nic({ id: 'nic-2', name: 'wlan0' })],
    });
    const result = connectLooseDevices([r1, core, sw('SW-A', '10.0.0.3', 300, 400), ap], [bound('c1', 'R-1', 1, 'SW-Core', 8), wire('c2', 'SW-A', 'AP-1')], 1);
    expect(made(result)).toEqual(['SW-Core>SW-A']);
    expect(result.left).toEqual([]);
  });

  it('a switch with a way up gets no second one, not even to a router with no cable', () => {
    const result = connectLooseDevices(
      [router('R-1', 0, 0, ['10.0.0.1']), sw('SW-1', '10.0.0.2', 0, 200), router('R-2', 100, 300, ['10.0.0.254'])],
      [wire('c1', 'R-1', 'SW-1')],
      1
    );
    expect(made(result)).toEqual([]);
    expect(leftAlone(result)).toEqual({ 'R-2': 'byHand' });
  });

  it('the nearest group goes up first: it takes the last free port of the router', () => {
    // one free port on the router; the far switch, drawn first, goes up through the near one
    const devices = [router('R-1', 0, 0, ['10.0.0.1']), sw('SW-Far', '10.0.0.2', 0, 800), sw('SW-Near', '10.0.0.3', 0, 200)];
    expect(made(connectLooseDevices(devices, [], 1))).toEqual(['R-1>SW-Near', 'SW-Near>SW-Far']);
  });

  it('never to the Internet, even when it is nearer than the router', () => {
    const internet = device({ id: 'Internet', type: 'Cloud', ...at(0, 150), nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })] });
    const result = connectLooseDevices([router('R-1', 300, 0, ['10.0.0.1']), internet, sw('SW-1', '10.0.0.2', 0, 300)], [], 1);
    expect(made(result)).toEqual(['R-1>SW-1']);
    expect(leftAlone(result)).toEqual({ Internet: 'byHand' });
  });
});

describe('the samples, one cable taken away at a time', () => {
  const samples = {
    office: createSampleTopology,
    perimeter: createPerimeterSample,
    company: createCompanySample,
    twoSites: createRedundancySample,
  };
  const byHand = (device: NetworkDevice | undefined) => ['Router', 'Firewall', 'Cloud'].includes(device?.type ?? '');
  /** The two devices of a cable and the interfaces it is on: on a firewall with zones, none (the user's to choose) */
  const endsOn = (devices: NetworkDevice[]) => (one: NetworkConnection) => {
    const on = (id: string, iface: number | string | undefined) => {
      const device = devices.find((each) => each.id === id);
      return `${id}:${device && requiresExplicitBinding(device) ? 'chosen by the user' : String(iface)}`;
    };
    return [on(one.source, one.sourcePort ?? one.sourceNic), on(one.target, one.targetPort ?? one.targetNic)].sort().join(' — ');
  };

  it.each(Object.entries(samples))('%s: each cable comes back where it was, or to a nearer switch of its network', (_name, make) => {
    const { devices } = make();
    const connections = normalizeBindings(devices, make().connections);
    const named = (id: string) => devices.find((one) => one.id === id);
    const ends = endsOn(devices);
    const unlike: string[] = [];
    for (const cable of connections) {
      const rest = connections.filter((one) => one !== cable);
      const result = connectLooseDevices(devices, rest, 1000);
      const [source, target] = [named(cable.source), named(cable.target)];
      // never drawn automatically (the Internet, between routers and firewalls), or still reached another way
      const notOurs = source?.type === 'Cloud' || target?.type === 'Cloud' || (byHand(source) && byHand(target));
      const reached = (() => {
        const seen = new Set([cable.source]);
        const queue = [cable.source];
        while (queue.length > 0) {
          const id = queue.shift() as string;
          for (const one of rest) {
            const next = one.source === id ? one.target : one.target === id ? one.source : undefined;
            if (next && !seen.has(next)) {
              seen.add(next);
              queue.push(next);
            }
          }
        }
        return seen.has(cable.target);
      })();
      if (notOurs || reached) {
        if (result.connections.length > 0) unlike.push(`${cable.id}: ${made(result).join(', ')} added`);
        continue;
      }
      if (result.connections.length !== 1) {
        unlike.push(`${cable.id}: ${made(result).join(', ') || 'nothing'} added`);
        continue;
      }
      const [again] = result.connections;
      if (ends(again) === ends(cable)) continue;
      // an end device may go to a nearer switch of its network
      const device = named(again.target);
      const upper = named(again.source);
      const drawnTo = named(cable.source === again.target ? cable.target : cable.source);
      const nearer =
        device && upper && drawnTo && upper.type === 'Switch' && upper.id !== drawnTo.id &&
        Math.hypot(upper.position.x - device.position.x, upper.position.y - device.position.y) <
          Math.hypot(drawnTo.position.x - device.position.x, drawnTo.position.y - device.position.y);
      if (!nearer) unlike.push(`${cable.id}: ${ends(cable)} drawn, ${ends(again)} made`);
    }
    expect(unlike).toEqual([]);
  });
});
