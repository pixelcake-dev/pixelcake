/**
 * Copy and paste on the board: what a pasted device is given anew so that
 * the copy is a device of its own, as a new device would be.
 *
 *  - a name of its own: the first free one of the same family (`PC-1` gives
 *    the first free `PC-n`), by the rule that names a new device;
 *  - a MAC address of its own on every network card;
 *  - an end device that is not a server asks for its address: its cards go
 *    on DHCP, and without a DHCP server it stays without one, as a real PC
 *    plugged in would;
 *  - the areas selected with the devices come along, in the same places
 *    around them.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStore } from './networkStore';
import { addressConflicts, resolveDhcp } from '@/engine';
import { device, host, link, nic, port, switchWith } from '@/test/networkFixtures';
import type { CanvasArea, NetworkDevice } from '@/types';

const MASK = '255.255.255.0';
const MAC = /^02(:[0-9A-F]{2}){5}$/;
const store = () => useNetworkStore.getState();
const labels = () => store().devices.map((d) => d.label);
const named = (label: string) => {
  const found = store().devices.find((d) => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

/** Put a drawing on the canvas as it is (ids included) */
function draw(devices: NetworkDevice[], connections = [] as ReturnType<typeof link>[], areas: CanvasArea[] = []) {
  useNetworkStore.setState({
    devices,
    connections,
    areas,
    deviceCounter: devices.length,
    connectionCounter: connections.length,
    selectedDeviceIds: [],
    selectedAreaIds: [],
    selectedAreaId: null,
    clipboard: null,
  });
}

/** Select these devices (and areas), copy, paste */
function copyPaste(deviceIds: string[], areaIds: string[] = []) {
  store().selectMultipleDevices(deviceIds);
  if (areaIds.length > 0) store().setSelectedAreas(areaIds);
  store().copySelection();
  return store().paste();
}

const pc = (id: string, ip: string, overrides: Partial<NetworkDevice> = {}) =>
  host(id, ip, '192.168.1.1', {
    nics: [nic({ ip, gateway: '192.168.1.1', mac: '02:AA:AA:AA:AA:01', dns: '192.168.1.53' })],
    ...overrides,
  });

beforeEach(() => {
  localStorage.clear();
  store().clearAllDevices();
});

describe('the name of a pasted device', () => {
  it('pasting PC-1 gives the first free PC-n', () => {
    draw([pc('PC-1', '192.168.1.2'), pc('PC-2', '192.168.1.3')]);

    copyPaste(['PC-1']);
    expect(labels()).toEqual(['PC-1', 'PC-2', 'PC-3']);

    // a name freed by a deletion is given again
    store().removeDevice('PC-1');
    copyPaste(['PC-2']);
    expect(labels()).toEqual(['PC-2', 'PC-3', 'PC-1']);
  });

  it('two devices pasted together take two names, each the first free one', () => {
    draw([pc('PC-1', '192.168.1.2'), pc('PC-2', '192.168.1.3'), switchWith('SW-1', [port(1)])]);

    copyPaste(['PC-1', 'PC-2', 'SW-1']);

    expect(labels().slice(3)).toEqual(['PC-3', 'PC-4', 'SW-2']);
  });

  it('keeps the family of the name, case and all: Web-Server-2 gives Web-Server-1 when it is free', () => {
    draw([
      device({ id: 'a', label: 'Web-Server-2', type: 'Server' }),
      device({ id: 'b', label: 'pc-vendite-1' }),
    ]);

    copyPaste(['a', 'b']);

    expect(labels().slice(2)).toEqual(['Web-Server-1', 'pc-vendite-2']);
  });

  it('a name without a number gets one: Reception gives Reception-1', () => {
    draw([pc('Reception', '192.168.1.2')]);

    copyPaste(['Reception']);

    expect(labels()).toEqual(['Reception', 'Reception-1']);
  });
});

describe('the network cards of a pasted device', () => {
  it('each gets a MAC address of its own, in the format of the app', () => {
    const server = device({
      id: 'Srv-1',
      type: 'Server',
      ip: '192.168.1.10',
      nics: [
        nic({ id: 'nic-1', name: 'eth0', ip: '192.168.1.10', mac: '02:BB:BB:BB:BB:01' }),
        nic({ id: 'nic-2', name: 'eth1', ip: '10.0.0.10', mac: '02:BB:BB:BB:BB:02' }),
      ],
    });
    draw([pc('PC-1', '192.168.1.2'), server]);

    copyPaste(['PC-1', 'Srv-1']);

    const before = new Set(['02:AA:AA:AA:AA:01', '02:BB:BB:BB:BB:01', '02:BB:BB:BB:BB:02']);
    const pasted = store().devices.slice(2).flatMap((d) => d.nics ?? []);
    expect(pasted).toHaveLength(3);
    for (const card of pasted) {
      expect(card.mac).toMatch(MAC);
      expect(before.has(card.mac!)).toBe(false);
    }
    expect(new Set(pasted.map((card) => card.mac)).size).toBe(3);
    // the originals keep theirs
    expect(named('PC-1').nics?.[0].mac).toBe('02:AA:AA:AA:AA:01');
  });

  it('a card that had no MAC gets one too', () => {
    draw([host('PC-1', '192.168.1.2')]);

    copyPaste(['PC-1']);

    expect(named('PC-2').nics?.[0].mac).toMatch(MAC);
  });
});

describe('a pasted end device asks for its address', () => {
  it('the cards of a pasted PC, laptop or printer go on DHCP, and keep no address of their own', () => {
    draw([
      pc('PC-1', '192.168.1.2'),
      pc('Laptop-1', '192.168.1.3', { templateId: 'tpl-laptop' }),
      pc('Printer-1', '192.168.1.4', { templateId: 'tpl-printer' }),
    ]);

    copyPaste(['PC-1', 'Laptop-1', 'Printer-1']);

    for (const label of ['PC-2', 'Laptop-2', 'Printer-2']) {
      expect(named(label).nics?.[0]).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '' });
      expect(named(label).nics?.[0].dns).toBeUndefined();
      expect(named(label)).toMatchObject({ ip: '', subnet: '', gateway: '' });
    }
    // the originals are as they were
    expect(named('PC-1').nics?.[0]).toMatchObject({ ip: '192.168.1.2', gateway: '192.168.1.1' });
    expect(named('PC-1').nics?.[0].dhcp).toBeUndefined();
  });

  it('with no DHCP server in its network it stays without an address, and the engine says why', () => {
    draw([pc('PC-1', '192.168.1.2')]);

    copyPaste(['PC-1']);

    const pasted = named('PC-2');
    const dhcp = resolveDhcp({ devices: store().devices, connections: store().connections });
    expect(dhcp.leases.filter((lease) => lease.deviceId === pasted.id)).toEqual([]);
    expect(dhcp.unserved.map((entry) => entry.deviceId)).toEqual([pasted.id]);
  });

  it('copied with the switch of a DHCP server, it is given an address by it', () => {
    const router = device({
      id: 'R-1',
      label: 'R-1',
      type: 'Router',
      ports: [port(1, { ip: '192.168.1.1', subnet: MASK, dhcpServer: { start: '192.168.1.100', end: '192.168.1.110' } })],
    });
    draw(
      [router, switchWith('SW-1', [port(1), port(2), port(3)]), pc('PC-1', '192.168.1.2')],
      [
        link('R-1', 'SW-1', { sourcePort: 1, targetPort: 1 }),
        link('SW-1', 'PC-1', { sourcePort: 2, targetNic: 'nic-1' }),
      ]
    );
    // the pasted PC is cabled to the switch, as one would plug it in
    copyPaste(['PC-1']);
    store().addConnection({ source: 'SW-1', target: named('PC-2').id, sourcePort: 3 });

    const dhcp = resolveDhcp({ devices: store().devices, connections: store().connections });
    expect(dhcp.leases.find((lease) => lease.deviceId === named('PC-2').id)?.ip).toBe('192.168.1.100');
  });

  it('servers, databases, routers, firewalls and switches keep their addresses, which are then in conflict with the originals', () => {
    const server = device({ id: 'Srv-1', label: 'Srv-1', type: 'Server', ip: '192.168.1.10', nics: [nic({ ip: '192.168.1.10' })] });
    const nas = device({ id: 'NAS-1', label: 'NAS-1', type: 'Database', templateId: 'tpl-nas', ip: '192.168.1.11', nics: [nic({ ip: '192.168.1.11' })] });
    const router = device({ id: 'R-1', label: 'R-1', type: 'Router', ports: [port(1, { ip: '192.168.1.1', subnet: MASK })] });
    const firewall = device({ id: 'FW-1', label: 'FW-1', type: 'Firewall', ports: [port(1, { ip: '192.168.1.254', subnet: MASK })] });
    const sw = switchWith('SW-1', [port(1)], { ip: '192.168.1.250' });
    draw([server, nas, router, firewall, sw]);

    copyPaste(['Srv-1', 'NAS-1', 'R-1', 'FW-1', 'SW-1']);

    expect(named('Srv-2').nics?.[0]).toMatchObject({ ip: '192.168.1.10' });
    expect(named('Srv-2').nics?.[0].dhcp).toBeUndefined();
    expect(named('NAS-2').nics?.[0]).toMatchObject({ ip: '192.168.1.11' });
    expect(named('R-2').ports?.[0]).toMatchObject({ ip: '192.168.1.1' });
    expect(named('FW-2').ports?.[0]).toMatchObject({ ip: '192.168.1.254' });
    expect(named('SW-2').ip).toBe('192.168.1.250');

    // as when a real machine is cloned: each address is now on two devices, until it is changed
    const conflicts = addressConflicts({ devices: store().devices, connections: store().connections });
    expect(conflicts.list.map((c) => [c.ip, c.devices.map((d) => d.label)])).toEqual([
      ['192.168.1.10', ['Srv-1', 'Srv-2']],
      ['192.168.1.11', ['NAS-1', 'NAS-2']],
      ['192.168.1.1', ['R-1', 'R-2']],
      ['192.168.1.254', ['FW-1', 'FW-2']],
      ['192.168.1.250', ['SW-1', 'SW-2']],
    ]);
    store().updateDevice(named('Srv-2').id, { ip: '192.168.1.12', nics: [nic({ ip: '192.168.1.12' })] });
    expect(
      addressConflicts({ devices: store().devices, connections: store().connections }).list.map((c) => c.ip)
    ).not.toContain('192.168.1.10');
  });

  it('paste() says which pasted devices went on DHCP', () => {
    draw([pc('PC-1', '192.168.1.2'), device({ id: 'Srv-1', type: 'Server', nics: [nic({ ip: '192.168.1.10' })] })]);

    const result = copyPaste(['PC-1', 'Srv-1']);

    expect(result.pasted).toEqual([named('PC-2').id, named('Srv-2').id]);
    expect(result.onDhcp).toEqual([named('PC-2').id]);
  });
});

describe('areas copied and pasted with the devices', () => {
  const office: CanvasArea = {
    id: 'area-1',
    label: 'Uffici',
    color: 'green',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 200 },
  };

  it('a selected area comes along: a new id, the same label and colour, in the same place around its devices', () => {
    draw(
      [pc('PC-1', '192.168.1.2', { position: { x: 40, y: 60 } }), pc('PC-2', '192.168.1.3', { position: { x: 220, y: 60 } })],
      [],
      [office]
    );

    copyPaste(['PC-1', 'PC-2'], ['area-1']);

    expect(store().areas).toHaveLength(2);
    const pasted = store().areas[1];
    expect(pasted).toMatchObject({ label: 'Uffici', color: 'green', size: office.size });
    expect(pasted.id).not.toBe('area-1');
    // the devices are where they were in the area
    const shift = { x: pasted.position.x - office.position.x, y: pasted.position.y - office.position.y };
    expect(shift.x).toBeGreaterThan(0);
    expect(named('PC-3').position).toEqual({ x: 40 + shift.x, y: 60 + shift.y });
    expect(named('PC-4').position).toEqual({ x: 220 + shift.x, y: 60 + shift.y });
  });

  it('an area alone can be copied and pasted', () => {
    draw([], [], [office]);

    store().setSelectedAreas(['area-1']);
    store().copySelection();
    store().paste();

    expect(store().areas.map((area) => area.label)).toEqual(['Uffici', 'Uffici']);
    expect(new Set(store().areas.map((area) => area.id)).size).toBe(2);
    // pasted again, it goes past the copy that is there
    store().paste();
    expect(store().areas.map((area) => area.position)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
    ]);
  });

  it('an area that is not selected stays out of the copy', () => {
    draw([pc('PC-1', '192.168.1.2', { position: { x: 40, y: 60 } })], [], [office]);

    copyPaste(['PC-1']);

    expect(store().areas).toHaveLength(1);
  });
});

describe('pasting again', () => {
  it('each paste goes further on, so that copies are never one on top of the other', () => {
    draw([pc('PC-1', '192.168.1.2', { position: { x: 100, y: 100 } })]);
    store().selectMultipleDevices(['PC-1']);
    store().copySelection();

    store().paste();
    store().paste();

    expect(store().devices.map((d) => d.position)).toEqual([
      { x: 100, y: 100 },
      { x: 150, y: 150 },
      { x: 200, y: 200 },
    ]);
    // a new copy of the same device goes past the copies that are there
    store().selectMultipleDevices(['PC-1']);
    store().copySelection();
    store().paste();
    expect(store().devices[3].position).toEqual({ x: 250, y: 250 });
  });

  it('a copy whose place is free goes one step from the original, whatever was pasted before', () => {
    draw([pc('PC-1', '192.168.1.2', { position: { x: 100, y: 100 } })]);
    store().selectMultipleDevices(['PC-1']);
    store().copySelection();
    store().paste();
    // the copy is moved away: its place is free again
    store().updateDevice(store().devices[1].id, { position: { x: 600, y: 100 } });

    store().paste();

    expect(store().devices[2].position).toEqual({ x: 150, y: 150 });
  });
});
