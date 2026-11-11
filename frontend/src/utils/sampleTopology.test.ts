/**
 * Structural tests for the sample network: the addressing plan, the bindings
 * of every link and the shape of the devices. Behaviour on top of it (ping,
 * web, email, failure cases) lives in engine/scenarios.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { createSampleTopology } from './sampleTopology';
import { areSameNetwork, isValidIP, isValidMAC } from './ipHelpers';
import { boundInterface, normalizeBindings, sanitizeBindings } from '@/engine';
import type { NetworkConnection, NetworkDevice } from '@/types';

function byLabel(devices: NetworkDevice[], label: string): NetworkDevice {
  const device = devices.find(d => d.label === label);
  if (!device) throw new Error(`sample has no device "${label}"`);
  return device;
}

/** "PC-1 eth0 ↔ SW-Office port 1" for one connection */
function describeLink(devices: NetworkDevice[], connection: NetworkConnection): string {
  const end = (deviceId: string, which: 'source' | 'target') => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return `${deviceId} ?`;
    return `${device.label} ${boundInterface(connection, device, which)?.label ?? 'unbound'}`;
  };
  return `${end(connection.source, 'source')} ↔ ${end(connection.target, 'target')}`;
}

describe('createSampleTopology', () => {
  it('returns the seven devices of the small office network', () => {
    const { devices } = createSampleTopology();
    expect(devices.map(d => [d.label, d.type, d.templateId])).toEqual([
      ['Router-1', 'Router', 'tpl-router'],
      ['SW-Office', 'Switch', 'tpl-switch'],
      ['SW-Servers', 'Switch', 'tpl-switch'],
      ['PC-1', 'PC', 'tpl-pc'],
      ['PC-2', 'PC', 'tpl-pc'],
      ['Web-01', 'Server', 'tpl-webserver'],
      ['Mail-01', 'Server', 'tpl-mailserver'],
    ]);
    expect(new Set(devices.map(d => d.id)).size).toBe(7);
  });

  it('is deterministic', () => {
    expect(createSampleTopology()).toEqual(createSampleTopology());
  });

  it('addresses the router ports and gives the switches a management address', () => {
    const { devices } = createSampleTopology();
    const router = byLabel(devices, 'Router-1');
    expect(router.ports?.filter(p => p.ip).map(p => [p.id, p.ip, p.subnet])).toEqual([
      [1, '192.168.10.1', '255.255.255.0'],
      [2, '192.168.20.1', '255.255.255.0'],
    ]);

    const office = byLabel(devices, 'SW-Office');
    expect([office.ip, office.gateway, office.ports?.length]).toEqual([
      '192.168.10.2',
      '192.168.10.1',
      8,
    ]);
    const servers = byLabel(devices, 'SW-Servers');
    expect([servers.ip, servers.gateway, servers.ports?.length]).toEqual([
      '192.168.20.2',
      '192.168.20.1',
      8,
    ]);
  });

  it('addresses end devices through eth0, mirrored on the device', () => {
    const { devices } = createSampleTopology();
    const expected: Array<[string, string, string]> = [
      ['PC-1', '192.168.10.11', '192.168.10.1'],
      ['PC-2', '192.168.10.12', '192.168.10.1'],
      ['Web-01', '192.168.20.10', '192.168.20.1'],
      ['Mail-01', '192.168.20.20', '192.168.20.1'],
    ];
    for (const [label, ip, gateway] of expected) {
      const device = byLabel(devices, label);
      expect(device.nics).toHaveLength(1);
      const [nic] = device.nics ?? [];
      expect([nic.name, nic.enabled, nic.ip, nic.subnet, nic.gateway]).toEqual([
        'eth0',
        true,
        ip,
        '255.255.255.0',
        gateway,
      ]);
      expect(isValidMAC(nic.mac ?? '')).toBe(true);
      expect([device.ip, device.subnet, device.gateway]).toEqual([ip, '255.255.255.0', gateway]);
    }
    const macs = devices.flatMap(d => (d.nics ?? []).map(n => n.mac));
    expect(new Set(macs).size).toBe(macs.length);
  });

  it('points every gateway at a router port on the same network', () => {
    const { devices } = createSampleTopology();
    const routerAddresses = (byLabel(devices, 'Router-1').ports ?? []).flatMap(p =>
      p.ip ? [p.ip] : []
    );
    for (const device of devices) {
      if (device.type === 'Router') continue;
      expect(isValidIP(device.ip)).toBe(true);
      expect(routerAddresses).toContain(device.gateway);
      expect(areSameNetwork(device.ip, device.gateway, device.subnet)).toBe(true);
    }
  });

  it('binds every link to a concrete interface on both ends', () => {
    const { devices, connections } = createSampleTopology();
    expect(connections.map(c => describeLink(devices, c))).toEqual([
      'PC-1 eth0 ↔ SW-Office port 1',
      'PC-2 eth0 ↔ SW-Office port 2',
      'SW-Office port 8 ↔ Router-1 port 1',
      'Router-1 port 2 ↔ SW-Servers port 8',
      'Web-01 eth0 ↔ SW-Servers port 1',
      'Mail-01 eth0 ↔ SW-Servers port 2',
    ]);
  });

  it('needs no repair: bindings are valid, unique and complete', () => {
    const { devices, connections } = createSampleTopology();
    expect(sanitizeBindings(devices, connections)).toBe(connections);
    expect(normalizeBindings(devices, connections)).toBe(connections);
  });

  it('keeps every interface enabled and hand-places the devices', () => {
    const { devices } = createSampleTopology();
    for (const device of devices) {
      expect((device.ports ?? []).every(p => p.enabled)).toBe(true);
      expect((device.nics ?? []).every(n => n.enabled)).toBe(true);
    }
    const positions = devices.map(d => `${d.position.x},${d.position.y}`);
    expect(new Set(positions).size).toBe(devices.length);
    // top-down: router above the switches, switches above the end devices
    const y = (label: string) => byLabel(devices, label).position.y;
    expect(y('Router-1')).toBeLessThan(y('SW-Office'));
    expect(y('SW-Office')).toBe(y('SW-Servers'));
    expect(y('SW-Office')).toBeLessThan(y('PC-1'));
    expect(new Set(['PC-1', 'PC-2', 'Web-01', 'Mail-01'].map(y)).size).toBe(1);
  });
});
