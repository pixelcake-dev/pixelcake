import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import type { Command } from './types';

/** Narrowing helper: assert the parsed kind and return the narrowed command. */
function expectKind<K extends Command['kind']>(input: string, kind: K): Extract<Command, { kind: K }> {
  const cmd = parse(input);
  expect(cmd.kind).toBe(kind);
  return cmd as Extract<Command, { kind: K }>;
}

describe('parse — empty input', () => {
  it('returns empty for the empty string', () => {
    expect(parse('')).toEqual({ kind: 'empty' });
  });

  it('returns empty for whitespace-only input', () => {
    expect(parse('   \t  ')).toEqual({ kind: 'empty' });
  });
});

describe('parse — ping', () => {
  it('parses a simple ping', () => {
    expect(parse('ping Web-01')).toEqual({ kind: 'ping', target: 'Web-01' });
  });

  it('is case-insensitive on the verb but preserves argument case', () => {
    expect(parse('PING web-01')).toEqual({ kind: 'ping', target: 'web-01' });
  });

  it('tolerates extra spaces and joins multi-word targets', () => {
    expect(parse('  ping   PC   Sales   1  ')).toEqual({ kind: 'ping', target: 'PC Sales 1' });
  });

  it('splits target and source on the from role marker', () => {
    expect(parse('ping PC Sales 1 from Core Switch HQ')).toEqual({
      kind: 'ping',
      target: 'PC Sales 1',
      from: 'Core Switch HQ',
    });
  });

  it('accepts an IP address as target', () => {
    expect(parse('ping 192.168.1.5')).toEqual({ kind: 'ping', target: '192.168.1.5' });
  });

  it('accepts quoted device names verbatim', () => {
    expect(parse('ping "PC 1" from "Core Switch"')).toEqual({
      kind: 'ping',
      target: 'PC 1',
      from: 'Core Switch',
    });
  });

  it('drops leading articles around device names', () => {
    expect(parse('ping the Web Server from the Core Router')).toEqual({
      kind: 'ping',
      target: 'Web Server',
      from: 'Core Router',
    });
  });

  it('rejects a bare ping with a usage hint in suggestion', () => {
    const cmd = expectKind('ping', 'unknown');
    expect(cmd.suggestion).toContain('ping <target>');
  });

  it('rejects ping with from but no source device', () => {
    const cmd = expectKind('ping Web-01 from', 'unknown');
    expect(cmd.suggestion).toContain('ping <target>');
  });
});

describe('parse — trace and aliases', () => {
  it('parses trace with from', () => {
    expect(parse('trace DB Primary from PC-1')).toEqual({
      kind: 'trace',
      target: 'DB Primary',
      from: 'PC-1',
    });
  });

  it('maps traceroute to trace', () => {
    expect(parse('traceroute Web-01')).toEqual({ kind: 'trace', target: 'Web-01' });
  });

  it('maps tracert to trace', () => {
    expect(parse('tracert Web-01 from PC 2')).toEqual({
      kind: 'trace',
      target: 'Web-01',
      from: 'PC 2',
    });
  });
});

describe('parse — show', () => {
  it('parses show devices without device argument', () => {
    expect(parse('show devices')).toEqual({ kind: 'show', what: 'devices' });
  });

  it('maps the sh alias to show', () => {
    expect(parse('sh vlans')).toEqual({ kind: 'show', what: 'vlans' });
  });

  it('parses show config of a multi-word device', () => {
    expect(parse('show config of Core Switch HQ')).toEqual({
      kind: 'show',
      what: 'config',
      device: 'Core Switch HQ',
    });
  });

  it('treats of as optional', () => {
    expect(parse('show config Switch-0')).toEqual({
      kind: 'show',
      what: 'config',
      device: 'Switch-0',
    });
  });

  it('drops the article after of', () => {
    expect(parse('show ports of the Core Switch')).toEqual({
      kind: 'show',
      what: 'ports',
      device: 'Core Switch',
    });
  });

  it('parses show neighbors and show connections with a device', () => {
    expect(parse('show neighbors PC-1')).toEqual({ kind: 'show', what: 'neighbors', device: 'PC-1' });
    expect(parse('show connections of PC-1')).toEqual({
      kind: 'show',
      what: 'connections',
      device: 'PC-1',
    });
  });

  it('rejects an unknown show target with a close suggestion', () => {
    const cmd = expectKind('show vlan', 'unknown');
    expect(cmd.suggestion).toContain('show vlans');
  });

  it('rejects a garbage show target with the target list', () => {
    const cmd = expectKind('show elephants', 'unknown');
    expect(cmd.suggestion).toContain('devices');
  });

  it('rejects a bare show with a usage hint', () => {
    const cmd = expectKind('show', 'unknown');
    expect(cmd.suggestion).toContain('show devices');
  });

  it('maps ls and list to show devices', () => {
    expect(parse('ls')).toEqual({ kind: 'show', what: 'devices' });
    expect(parse('list')).toEqual({ kind: 'show', what: 'devices' });
  });
});

describe('parse — show interfaces / show ip (NCL unified forms)', () => {
  it('parses show interfaces without a device (context style)', () => {
    expect(parse('show interfaces')).toEqual({ kind: 'show', what: 'interfaces' });
  });

  it('parses show interfaces of a multi-word device', () => {
    expect(parse('show interfaces of Core Switch HQ')).toEqual({
      kind: 'show',
      what: 'interfaces',
      device: 'Core Switch HQ',
    });
  });

  it('accepts the sh alias and treats of as optional for interfaces', () => {
    expect(parse('sh interfaces PC-1')).toEqual({
      kind: 'show',
      what: 'interfaces',
      device: 'PC-1',
    });
  });

  it('suggests show interfaces for the singular typo', () => {
    const cmd = expectKind('show interface PC-1', 'unknown');
    expect(cmd.suggestion).toContain('show interfaces');
  });

  it('parses show ip without and with a device', () => {
    expect(parse('show ip')).toEqual({ kind: 'show', what: 'ip' });
    expect(parse('show ip of PC Sales 1')).toEqual({
      kind: 'show',
      what: 'ip',
      device: 'PC Sales 1',
    });
  });
});

describe('parse — set', () => {
  it('parses the full form with of and to', () => {
    expect(parse('set ip of PC-1 to 192.168.1.99')).toEqual({
      kind: 'set',
      property: 'ip',
      device: 'PC-1',
      value: '192.168.1.99',
    });
  });

  it('parses a multi-word device between of and to', () => {
    expect(parse('set ip PC Sales 1 to 10.0.0.5')).toEqual({
      kind: 'set',
      property: 'ip',
      device: 'PC Sales 1',
      value: '10.0.0.5',
    });
  });

  it('handles device-context style with device omitted', () => {
    expect(parse('set ip 192.168.1.5')).toEqual({
      kind: 'set',
      property: 'ip',
      value: '192.168.1.5',
    });
  });

  it('treats to as optional for scalar values', () => {
    expect(parse('set gateway of PC 1 10.0.0.1')).toEqual({
      kind: 'set',
      property: 'gateway',
      device: 'PC 1',
      value: '10.0.0.1',
    });
  });

  it('parses set subnet', () => {
    expect(parse('set subnet of Web-01 to 255.255.255.0')).toEqual({
      kind: 'set',
      property: 'subnet',
      device: 'Web-01',
      value: '255.255.255.0',
    });
  });

  it('takes everything after to as the value for set name', () => {
    expect(parse('set name of PC-1 to Office PC 3')).toEqual({
      kind: 'set',
      property: 'name',
      device: 'PC-1',
      value: 'Office PC 3',
    });
  });

  it('treats set name without to as a device-context rename', () => {
    expect(parse('set name New Name')).toEqual({
      kind: 'set',
      property: 'name',
      value: 'New Name',
    });
  });

  it('handles fully uppercase input', () => {
    expect(parse('SET IP OF pc-1 TO 10.0.0.1')).toEqual({
      kind: 'set',
      property: 'ip',
      device: 'pc-1',
      value: '10.0.0.1',
    });
  });

  it('rejects an unknown property with a usage hint', () => {
    const cmd = expectKind('set color of PC-1 to red', 'unknown');
    expect(cmd.suggestion).toContain('set ip|gateway|subnet|name');
  });

  it('rejects a bare set and a set with no value', () => {
    expect(expectKind('set', 'unknown').suggestion).toContain('set ip|gateway|subnet|name');
    expect(expectKind('set ip', 'unknown').suggestion).toContain('set ip|gateway|subnet|name');
    expect(expectKind('set ip PC-1 to', 'unknown').suggestion).toContain('set ip|gateway|subnet|name');
  });
});

describe('parse — vlan add/remove', () => {
  it('parses add vlan with to and a multi-word device', () => {
    expect(parse('add vlan 20 to SW Floor 1')).toEqual({
      kind: 'vlan-add',
      vlanId: 20,
      device: 'SW Floor 1',
    });
  });

  it('treats to as optional', () => {
    expect(parse('add vlan 30 Switch-0')).toEqual({
      kind: 'vlan-add',
      vlanId: 30,
      device: 'Switch-0',
    });
  });

  it('allows the device to be omitted (context style)', () => {
    expect(parse('add vlan 10')).toEqual({ kind: 'vlan-add', vlanId: 10 });
  });

  it('parses remove vlan from a device', () => {
    expect(parse('remove vlan 20 from SW Floor 1')).toEqual({
      kind: 'vlan-remove',
      vlanId: 20,
      device: 'SW Floor 1',
    });
  });

  it('maps delete to vlan-remove', () => {
    expect(parse('delete vlan 20 from Switch-0')).toEqual({
      kind: 'vlan-remove',
      vlanId: 20,
      device: 'Switch-0',
    });
  });

  it('rejects a non-integer vlan id with a hint', () => {
    const cmd = expectKind('add vlan ten to Switch-0', 'unknown');
    expect(cmd.suggestion).toContain('number');
  });

  it('rejects add without the vlan keyword', () => {
    const cmd = expectKind('add 20 to Switch-0', 'unknown');
    expect(cmd.suggestion).toContain('add vlan');
  });

  it('rejects add vlan without an id', () => {
    const cmd = expectKind('add vlan', 'unknown');
    expect(cmd.suggestion).toContain('add vlan');
  });
});

describe('parse — connect/disconnect', () => {
  it('parses connect with to', () => {
    expect(parse('connect PC-1 to Switch-0')).toEqual({
      kind: 'connect',
      a: 'PC-1',
      b: 'Switch-0',
    });
  });

  it('parses multi-word endpoints around to', () => {
    expect(parse('connect PC Sales 1 to Core Switch HQ')).toEqual({
      kind: 'connect',
      a: 'PC Sales 1',
      b: 'Core Switch HQ',
    });
  });

  it('accepts exactly two tokens without to', () => {
    expect(parse('connect PC-1 Switch-0')).toEqual({ kind: 'connect', a: 'PC-1', b: 'Switch-0' });
  });

  it('accepts two quoted names without to', () => {
    expect(parse('connect "PC 1" "Core Switch"')).toEqual({
      kind: 'connect',
      a: 'PC 1',
      b: 'Core Switch',
    });
  });

  it('rejects an ambiguous connect without to and asks for it', () => {
    const cmd = expectKind('connect PC Sales 1 Switch-0', 'unknown');
    expect(cmd.suggestion).toContain('to');
  });

  it('is case-insensitive on the to marker', () => {
    expect(parse('CONNECT pc-1 TO switch-0')).toEqual({
      kind: 'connect',
      a: 'pc-1',
      b: 'switch-0',
    });
  });

  it('parses disconnect with from', () => {
    expect(parse('disconnect PC-1 from Switch-0')).toEqual({
      kind: 'disconnect',
      a: 'PC-1',
      b: 'Switch-0',
    });
  });

  it('also accepts to in disconnect', () => {
    expect(parse('disconnect PC-1 to Switch-0')).toEqual({
      kind: 'disconnect',
      a: 'PC-1',
      b: 'Switch-0',
    });
  });

  it('rejects connect with a missing endpoint', () => {
    expect(expectKind('connect to Switch-0', 'unknown').suggestion).toContain('connect');
    expect(expectKind('connect PC-1 to', 'unknown').suggestion).toContain('connect');
  });
});

describe('parse — enable/disable port', () => {
  it('parses enable port with the on device separator', () => {
    expect(parse('enable port 3 on Switch-0')).toEqual({
      kind: 'port-enable',
      port: 3,
      device: 'Switch-0',
    });
  });

  it('parses disable port on a multi-word device', () => {
    expect(parse('disable port 12 on Core Switch HQ')).toEqual({
      kind: 'port-disable',
      port: 12,
      device: 'Core Switch HQ',
    });
  });

  it('allows the device to be omitted (context style)', () => {
    expect(parse('enable port 3')).toEqual({ kind: 'port-enable', port: 3 });
  });

  it('rejects a non-integer port number with a hint', () => {
    const cmd = expectKind('enable port three on Switch-0', 'unknown');
    expect(cmd.suggestion).toContain('number');
  });

  it('rejects a bare disable port', () => {
    const cmd = expectKind('disable port', 'unknown');
    expect(cmd.suggestion).toContain('disable port <n>');
  });

  it('rejects enable without the port keyword', () => {
    const cmd = expectKind('enable 3 on Switch-0', 'unknown');
    expect(cmd.suggestion).toContain('enable port <n>');
  });
});

describe('parse — interface up/down (canonical NCL form)', () => {
  it('parses interface up as port-enable', () => {
    expect(parse('interface 3 up on Switch-0')).toEqual({
      kind: 'port-enable',
      port: 3,
      device: 'Switch-0',
    });
  });

  it('parses interface down as port-disable with a multi-word device after on', () => {
    expect(parse('interface 12 down on Core Switch HQ')).toEqual({
      kind: 'port-disable',
      port: 12,
      device: 'Core Switch HQ',
    });
  });

  it('treats on as optional', () => {
    expect(parse('interface 3 down Switch-0')).toEqual({
      kind: 'port-disable',
      port: 3,
      device: 'Switch-0',
    });
  });

  it('allows the device to be omitted (context style)', () => {
    expect(parse('interface 5 up')).toEqual({ kind: 'port-enable', port: 5 });
  });

  it('strips device noise after on', () => {
    expect(parse('interface 3 up on device Switch-0')).toEqual({
      kind: 'port-enable',
      port: 3,
      device: 'Switch-0',
    });
  });

  it('rejects a missing up|down with a usage hint', () => {
    const cmd = expectKind('interface 3 on Switch-0', 'unknown');
    expect(cmd.suggestion).toContain('up|down');
    expect(expectKind('interface 3', 'unknown').suggestion).toContain('up|down');
  });

  it('takes a word in place of the number for the name of a network card', () => {
    // whether the device has such an interface is for the executor to say
    expect(parse('interface three up on Switch-0')).toEqual({
      kind: 'interface-set',
      iface: 'three',
      setting: { what: 'state', up: true },
      device: 'Switch-0',
    });
  });

  it('rejects a bare interface with the usage hint', () => {
    const cmd = expectKind('interface', 'unknown');
    expect(cmd.suggestion).toContain('interface <n> up|down');
  });
});

describe('parse — session commands', () => {
  it('parses use with a multi-word device', () => {
    expect(parse('use PC Sales 1')).toEqual({ kind: 'use', device: 'PC Sales 1' });
  });

  it('rejects a bare use', () => {
    expect(expectKind('use', 'unknown').suggestion).toContain('use <device>');
  });

  it('parses exit and its quit alias', () => {
    expect(parse('exit')).toEqual({ kind: 'exit' });
    expect(parse('quit')).toEqual({ kind: 'exit' });
  });

  it('parses clear and its cls alias', () => {
    expect(parse('clear')).toEqual({ kind: 'clear' });
    expect(parse('CLS')).toEqual({ kind: 'clear' });
  });

  it('parses help without a topic', () => {
    expect(parse('help')).toEqual({ kind: 'help' });
  });

  it('passes the help topic through', () => {
    expect(parse('help ping')).toEqual({ kind: 'help', topic: 'ping' });
    expect(parse('help show devices')).toEqual({ kind: 'help', topic: 'show devices' });
  });

  it('maps ? to help', () => {
    expect(parse('?')).toEqual({ kind: 'help' });
    expect(parse('? trace')).toEqual({ kind: 'help', topic: 'trace' });
  });
});

describe('parse — leading device/host noise stripping', () => {
  it('strips a leading device noun in use', () => {
    expect(parse('use device Core-Switch-HQ')).toEqual({ kind: 'use', device: 'Core-Switch-HQ' });
  });

  it('strips device/host after from in ping', () => {
    expect(parse('ping Web-01 from device Core-1')).toEqual({
      kind: 'ping',
      target: 'Web-01',
      from: 'Core-1',
    });
    expect(parse('ping device Web-01 from host Core-1')).toEqual({
      kind: 'ping',
      target: 'Web-01',
      from: 'Core-1',
    });
  });

  it('strips a leading host noun before an IP target', () => {
    expect(parse('ping host 192.168.1.5')).toEqual({ kind: 'ping', target: '192.168.1.5' });
  });

  it('strips article + noise combinations', () => {
    expect(parse('ping the device Web Server')).toEqual({ kind: 'ping', target: 'Web Server' });
  });

  it('strips device after of in show and set', () => {
    expect(parse('show config of device PC-1')).toEqual({
      kind: 'show',
      what: 'config',
      device: 'PC-1',
    });
    expect(parse('set ip of device PC-1 to 10.0.0.9')).toEqual({
      kind: 'set',
      property: 'ip',
      device: 'PC-1',
      value: '10.0.0.9',
    });
  });

  it('strips device on both connect endpoints and after to/on in vlan/port', () => {
    expect(parse('connect device PC-1 to device Switch-0')).toEqual({
      kind: 'connect',
      a: 'PC-1',
      b: 'Switch-0',
    });
    expect(parse('add vlan 20 to device SW Floor 1')).toEqual({
      kind: 'vlan-add',
      vlanId: 20,
      device: 'SW Floor 1',
    });
    expect(parse('enable port 3 on device Switch-0')).toEqual({
      kind: 'port-enable',
      port: 3,
      device: 'Switch-0',
    });
  });

  it('never strips quoted names — a device literally named "Device Room AP" survives', () => {
    expect(parse('use "Device Room AP"')).toEqual({ kind: 'use', device: 'Device Room AP' });
    expect(parse('ping "device room ap"')).toEqual({ kind: 'ping', target: 'device room ap' });
  });

  it('KNOWN LIMITATION: an unquoted name starting with device/host loses its head', () => {
    // "Device Room AP" typed unquoted is indistinguishable from noise + name;
    // stripping yields "room ap" — acceptable, users quote such names.
    expect(parse('use device room ap')).toEqual({ kind: 'use', device: 'room ap' });
  });

  it('never strips device/host mid-name', () => {
    expect(parse('ping Meeting Room Host from PC-1')).toEqual({
      kind: 'ping',
      target: 'Meeting Room Host',
      from: 'PC-1',
    });
    expect(parse('use Web device 01')).toEqual({ kind: 'use', device: 'Web device 01' });
  });
});

describe('parse — ipconfig/ifconfig aliases', () => {
  it('maps bare ipconfig and ifconfig to show ip', () => {
    expect(parse('ipconfig')).toEqual({ kind: 'show', what: 'ip' });
    expect(parse('ifconfig')).toEqual({ kind: 'show', what: 'ip' });
  });

  it('accepts trailing device tokens', () => {
    expect(parse('ipconfig pc-1')).toEqual({ kind: 'show', what: 'ip', device: 'pc-1' });
    expect(parse('ifconfig Core Switch HQ')).toEqual({
      kind: 'show',
      what: 'ip',
      device: 'Core Switch HQ',
    });
  });

  it('is case-insensitive and strips of/device noise before the name', () => {
    expect(parse('IPCONFIG of device PC-1')).toEqual({
      kind: 'show',
      what: 'ip',
      device: 'PC-1',
    });
  });

  it('suggests ipconfig for a close typo', () => {
    const cmd = expectKind('ipconfg pc-1', 'unknown');
    expect(cmd.suggestion).toBe('ipconfig');
  });
});

describe('parse — unknown verbs and garbage', () => {
  it('suggests the closest verb for a typo (distance <= 2)', () => {
    expect(parse('pnig Web-01')).toEqual({
      kind: 'unknown',
      input: 'pnig Web-01',
      suggestion: 'ping',
    });
  });

  it('suggests show for shwo', () => {
    const cmd = expectKind('shwo devices', 'unknown');
    expect(cmd.suggestion).toBe('show');
  });

  it('suggests connect for conect', () => {
    const cmd = expectKind('conect A to B', 'unknown');
    expect(cmd.suggestion).toBe('connect');
  });

  it('gives no suggestion when nothing is within distance 2', () => {
    expect(parse('xyzzyfoo bar')).toEqual({ kind: 'unknown', input: 'xyzzyfoo bar' });
  });

  it('preserves the trimmed original input on unknown', () => {
    const cmd = expectKind('   frobnicate everything   ', 'unknown');
    expect(cmd.input).toBe('frobnicate everything');
  });
});
