/**
 * What a new device starts with, whichever window makes it (utils/newDevice).
 *
 * Its name: the name of the template and the lowest number, from 1, that
 * leaves the name free. Its ports: plain ones, with nothing the engine acts
 * on. The two windows are tried, one against the other, in
 * components/Modals/BulkAddDeviceModal.same.test.tsx.
 */

import { describe, it, expect } from 'vitest';
import { isVlanAware, requiresExplicitBinding, resolveEndpoint } from '@/engine';
import type { NetworkDevice } from '@/types/network';
import { newDeviceName, newDevicePorts } from './newDevice';

/** Devices that have these names, and nothing else worth telling */
const called = (...labels: string[]): NetworkDevice[] =>
  labels.map((label, index) => ({
    id: `d${index}`,
    type: 'PC',
    label,
    ip: '',
    subnet: '',
    gateway: '',
    position: { x: 0, y: 0 },
  }));

describe('newDeviceName — the name a new device is proposed', () => {
  it('on an empty canvas: the name of the template and number 1', () => {
    expect(newDeviceName('PC', [])).toBe('PC-1');
    expect(newDeviceName('Switch', [])).toBe('Switch-1');
  });

  it('a dash for each run of spaces in the name of the template', () => {
    expect(newDeviceName('Web Server', [])).toBe('Web-Server-1');
    expect(newDeviceName('Storage S3', [])).toBe('Storage-S3-1');
    expect(newDeviceName('Switch  di \t Sede', [])).toBe('Switch-di-Sede-1');
  });

  it('the next number while the names follow one another', () => {
    expect(newDeviceName('PC', called('PC-1'))).toBe('PC-2');
    expect(newDeviceName('PC', called('PC-1', 'PC-2', 'PC-3'))).toBe('PC-4');
    // (whatever the order they are in)
    expect(newDeviceName('PC', called('PC-3', 'PC-1', 'PC-2'))).toBe('PC-4');
  });

  it('the lowest number a deletion left free, not the one after the highest', () => {
    expect(newDeviceName('PC', called('PC-1', 'PC-3'))).toBe('PC-2');
    expect(newDeviceName('PC', called('PC-2', 'PC-3'))).toBe('PC-1');
    expect(newDeviceName('PC', called('PC-1', 'PC-2', 'PC-4', 'PC-6'))).toBe('PC-3');
  });

  it('never a name that is taken, however many devices there are', () => {
    // (three devices: counting them gives «PC-3», the name one of them has)
    expect(newDeviceName('PC', called('PC-3', 'Reception', 'PC-1'))).toBe('PC-2');
    expect(newDeviceName('PC', called('PC-2', 'PC-1', 'Reception'))).toBe('PC-3');
  });

  it('the devices are not counted: those called otherwise leave number 1 free', () => {
    expect(newDeviceName('PC', called('Reception', 'Front-Desk', 'Lab'))).toBe('PC-1');
    // (devices of one type: two web servers, and the first DNS server is number 1)
    expect(newDeviceName('DNS Server', called('Web-Server-1', 'Web-Server-2'))).toBe('DNS-Server-1');
    expect(newDeviceName('Server', called('Web-Server-1', 'Web-Server-2'))).toBe('Server-1');
  });

  it('number 0 of a drawing made before is a name like any other: nothing starts from it', () => {
    expect(newDeviceName('PC', called('PC-0'))).toBe('PC-1');
    expect(newDeviceName('PC', called('PC-0', 'PC-1'))).toBe('PC-2');
  });

  it('a name is taken whatever its case', () => {
    expect(newDeviceName('PC', called('pc-1', 'Pc-2', 'pC-3'))).toBe('PC-4');
    expect(newDeviceName('Web Server', called('WEB-SERVER-1', 'web-server-2'))).toBe('Web-Server-3');
    // (and the name proposed keeps the case of the template)
    expect(newDeviceName('IoT Gateway', called('iot-gateway-1'))).toBe('IoT-Gateway-2');
  });

  it('spaces around a name do not make another name', () => {
    expect(newDeviceName('PC', called(' PC-1', 'PC-2 ', '\tpc-3\t'))).toBe('PC-4');
  });

  it('a name that only looks like it is another name', () => {
    expect(newDeviceName('PC', called('PC-10', 'PC-01', 'PC-1b', 'XPC-1', 'PC 1', 'PC_1', 'PC-1-1', 'PC1'))).toBe(
      'PC-1'
    );
    expect(newDeviceName('Server', called('Web-Server-1'))).toBe('Server-1');
  });

  it('numbers go on past 9 as numbers do', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => `PC-${index + 1}`);
    expect(newDeviceName('PC', called(...twelve))).toBe('PC-13');
    expect(newDeviceName('PC', called(...twelve.filter((name) => name !== 'PC-10')))).toBe('PC-10');
  });

  it('asked again with the name it gave among the devices, it gives the next: a row in bulk gets names in a row', () => {
    const devices = called('Web-Server-2', 'Srv-A');
    const row: string[] = [];
    for (let i = 0; i < 4; i++) {
      const name = newDeviceName('Web Server', [...devices, ...called(...row)]);
      row.push(name);
    }
    expect(row).toEqual(['Web-Server-1', 'Web-Server-3', 'Web-Server-4', 'Web-Server-5']);
  });

  it('the devices it is given are left as they are', () => {
    const devices = called('pc-1', ' PC-2 ');
    const before = JSON.stringify(devices);
    newDeviceName('PC', devices);
    expect(JSON.stringify(devices)).toBe(before);
  });

  it('is a name the terminal finds nobody by, while it finds somebody by every lower number', () => {
    const canvases = [
      called(),
      called('PC-1'),
      called('pc-1', ' PC-2 ', 'PC  3'),
      called('PC-0', 'PC-2', 'Pc-1', 'PC-4', 'Reception'),
      called('Web-Server-1', 'WEB-SERVER-2', 'web-server-3', 'PC-1'),
    ];
    for (const devices of canvases) {
      const topology = { devices, connections: [] };
      for (const template of ['PC', 'Web Server']) {
        const name = newDeviceName(template, devices);
        const about = `«${name}» among ${JSON.stringify(devices.map((d) => d.label))}`;
        expect(resolveEndpoint(name, topology), about).toBeUndefined();

        const [, base, number] = /^(.+)-(\d+)$/.exec(name)!;
        for (let lower = 1; lower < Number(number); lower++) {
          expect(resolveEndpoint(`${base}-${lower}`, topology), `${base}-${lower}, ${about}`).toBeDefined();
        }
      }
    }
  });
});

/** A device of a type with ports, as a window makes it */
const withPorts = (type: string, count: number): NetworkDevice => ({
  id: 'd0',
  type,
  label: `${type}-1`,
  ip: '',
  subnet: '',
  gateway: '',
  position: { x: 0, y: 0 },
  portCount: count,
  ports: newDevicePorts(count, type),
});

describe('newDevicePorts — the ports a new switch, router or firewall starts with', () => {
  it('as many as were chosen, numbered from 1', () => {
    for (const count of [1, 2, 5, 8, 24, 48]) {
      expect(newDevicePorts(count, 'Switch').map((port) => port.id)).toEqual(
        Array.from({ length: count }, (_, index) => index + 1)
      );
    }
    expect(newDevicePorts(0, 'Switch')).toEqual([]);
  });

  it('each on and at the speed the link finds: an access port on a switch, a LAN port on a router or a firewall', () => {
    expect(newDevicePorts(2, 'Switch')).toEqual([
      { id: 1, enabled: true, speed: 'auto', portType: 'access' },
      { id: 2, enabled: true, speed: 'auto', portType: 'access' },
    ]);
    for (const type of ['Router', 'Firewall']) {
      expect(newDevicePorts(2, type)).toEqual([
        { id: 1, enabled: true, speed: 'auto', portType: 'lan' },
        { id: 2, enabled: true, speed: 'auto', portType: 'lan' },
      ]);
    }
  });

  it('nothing else is written on any of them, whatever the type and the number', () => {
    for (const type of ['Switch', 'Router', 'Firewall']) {
      for (const count of [1, 2, 3, 16, 48]) {
        for (const port of newDevicePorts(count, type)) {
          expect(Object.keys(port).sort(), `${type}, ${count} ports, port ${port.id}`).toEqual([
            'enabled',
            'id',
            'portType',
            'speed',
          ]);
        }
      }
    }
  });

  it('a device of another type with ports has access ports, as the window that adds one gave it', () => {
    expect(newDevicePorts(2, 'Server').map((port) => port.portType)).toEqual(['access', 'access']);
  });

  it('nothing on them the engine acts on: a switch is not VLAN-aware, a firewall takes a cable on any port', () => {
    expect(isVlanAware(withPorts('Switch', 48))).toBe(false);
    expect(requiresExplicitBinding(withPorts('Firewall', 16))).toBe(false);
    for (const type of ['Router', 'Firewall']) {
      expect(newDevicePorts(16, type).filter((port) => port.nat || port.securityZone || port.ips)).toEqual([]);
    }
  });

  it('each port is its own: what is changed on one is on no other, nor on the next device', () => {
    const first = newDevicePorts(3, 'Switch');
    first[0].vlan = 10;
    first[1].enabled = false;
    expect(first[2]).toEqual({ id: 3, enabled: true, speed: 'auto', portType: 'access' });
    expect(newDevicePorts(3, 'Switch').slice(0, 2)).toEqual([
      { id: 1, enabled: true, speed: 'auto', portType: 'access' },
      { id: 2, enabled: true, speed: 'auto', portType: 'access' },
    ]);
  });
});
