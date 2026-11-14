import { describe, it, expect } from 'vitest';
import type { Port } from '@/types';
import { isPortInUse, portAddressText, portRanges, summariseSwitch } from './portSummary';

const port = (id: number, overrides: Partial<Port> = {}): Port => ({ id, enabled: true, ...overrides });
const NONE = new Map<number, string>();

describe('a list of port numbers', () => {
  it('writes runs as ranges, and two in a row as two numbers', () => {
    expect(portRanges([1, 2, 3, 4])).toBe('1–4');
    expect(portRanges([1, 2])).toBe('1, 2');
    expect(portRanges([7])).toBe('7');
    expect(portRanges([4, 1, 2, 3, 7, 9, 10, 11, 10])).toBe('1–4, 7, 9–11');
    expect(portRanges([])).toBe('');
  });
});

describe('the ports of a switch at a glance', () => {
  it('with no VLAN on any port it applies none', () => {
    const summary = summariseSwitch([port(1), port(2, { enabled: false }), port(3)], new Map([[1, 'PC-1 (eth0)']]));
    expect(summary).toEqual({ total: 3, linked: 1, disabled: 1, vlanAware: false, vlans: [], trunks: [] });
  });

  it('a trunk that carries everything does not make it apply VLANs', () => {
    const summary = summariseSwitch([port(1), port(2, { portType: 'trunk' })], NONE);
    expect(summary.vlanAware).toBe(false);
    expect(summary.vlans).toEqual([]);
    expect(summary.trunks).toEqual([{ port: 2, vlans: [] }]);
  });

  it('with a VLAN on one port, the ports without one are in VLAN 1, as the engine has it', () => {
    const summary = summariseSwitch(
      [
        port(1, { portType: 'access', vlan: 10 }),
        port(2, { portType: 'access', vlan: 10 }),
        port(3, { portType: 'access', vlan: 20 }),
        port(4),
        port(5),
        port(8, { portType: 'trunk', vlan: [20, 10] }),
      ],
      NONE
    );
    expect(summary.vlanAware).toBe(true);
    expect(summary.vlans).toEqual([
      { vlan: 1, ports: [4, 5] },
      { vlan: 10, ports: [1, 2] },
      { vlan: 20, ports: [3] },
    ]);
    expect(summary.trunks).toEqual([{ port: 8, vlans: [10, 20] }]);
  });

  it('a trunk with a list alone makes it apply VLANs', () => {
    const summary = summariseSwitch([port(1), port(2, { portType: 'trunk', vlan: [30] })], NONE);
    expect(summary.vlanAware).toBe(true);
    expect(summary.vlans).toEqual([{ vlan: 1, ports: [1] }]);
  });
});

describe('the ports of a router or firewall at a glance', () => {
  it('writes an address with the length of its mask', () => {
    expect(portAddressText(port(1, { ip: '192.168.10.1', subnet: '255.255.255.0' }))).toBe('192.168.10.1/24');
    expect(portAddressText(port(1, { ip: ' 10.0.0.1 ', subnet: '255.255.255.252' }))).toBe('10.0.0.1/30');
    // no mask written: the one the port is kept with
    expect(portAddressText(port(1, { ip: '10.0.0.1' }))).toBe('10.0.0.1/24');
    // a mask that is not one: the address alone
    expect(portAddressText(port(1, { ip: '10.0.0.1', subnet: '255.255.255' }))).toBe('10.0.0.1');
    expect(portAddressText(port(1))).toBe('');
    expect(portAddressText(port(1, { ip: 'abc' }))).toBe('');
  });

  it('a port is in use when it has an address, a cable, NAT or a DHCP server', () => {
    expect(isPortInUse(port(1), NONE)).toBe(false);
    expect(isPortInUse(port(1, { name: 'Riserva', enabled: false }), NONE)).toBe(false);
    expect(isPortInUse(port(1, { ip: '10.0.0.1' }), NONE)).toBe(true);
    expect(isPortInUse(port(1), new Map([[1, 'SW-Core (porta 7)']]))).toBe(true);
    expect(isPortInUse(port(1, { nat: true }), NONE)).toBe(true);
    expect(isPortInUse(port(1, { dhcpServer: { start: '', end: '' } }), NONE)).toBe(true);
  });
});
