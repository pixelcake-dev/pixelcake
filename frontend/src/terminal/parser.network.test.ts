/**
 * Parser tests for the network configuration grammar: routes, firewall rules,
 * per-interface settings, the flow verbs and `trace … as <service>`.
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import type { Command } from './types';
import languageReference from '../../../docs/terminal-commands.md?raw';

function expectKind<K extends Command['kind']>(input: string, kind: K) {
  const cmd = parse(input);
  expect(cmd.kind).toBe(kind);
  return cmd as Extract<Command, { kind: K }>;
}

const suggestion = (input: string) => expectKind(input, 'unknown').suggestion ?? '';

describe('parse — trace as a service', () => {
  it('reads the service after "as"', () => {
    expect(parse('trace Web-01 from PC-1 as web')).toEqual({
      kind: 'trace',
      target: 'Web-01',
      from: 'PC-1',
      service: 'web',
    });
    expect(parse('trace Mail Server from PC-1 as email')).toEqual({
      kind: 'trace',
      target: 'Mail Server',
      from: 'PC-1',
      service: 'email',
    });
  });

  it('works without a source, for the device context', () => {
    expect(parse('trace Web-01 as web')).toEqual({ kind: 'trace', target: 'Web-01', service: 'web' });
  });

  it('accepts the names people use for the same services', () => {
    expect(expectKind('trace X as http', 'trace').service).toBe('web');
    expect(expectKind('trace X as https', 'trace').service).toBe('web');
    expect(expectKind('trace X as smtp', 'trace').service).toBe('email');
    expect(expectKind('trace X as mail', 'trace').service).toBe('email');
    expect(expectKind('trace X as icmp', 'trace').service).toBe('ping');
  });

  it('carries no service when none is asked for', () => {
    expect(parse('trace Web-01 from PC-1')).toEqual({ kind: 'trace', target: 'Web-01', from: 'PC-1' });
  });

  it('refuses a service it does not know, naming the ones it does', () => {
    expect(suggestion('trace Web-01 from PC-1 as ssh')).toContain('unknown service "ssh"');
    expect(suggestion('trace Web-01 from PC-1 as ssh')).toContain('as ping|web|email');
  });

  it('keeps a device whose name ends in "as …" when it is quoted', () => {
    expect(parse('trace "Server as web" from PC-1')).toEqual({
      kind: 'trace',
      target: 'Server as web',
      from: 'PC-1',
    });
  });

  it('does not offer "as" to ping', () => {
    // for ping the words are part of the target name
    expect(parse('ping Web-01 as web')).toEqual({ kind: 'ping', target: 'Web-01 as web' });
  });
});

describe('parse — browse, mail, download', () => {
  it('parses each verb with target and source', () => {
    expect(parse('browse Web-01 from PC-1')).toEqual({
      kind: 'flow',
      model: 'web',
      target: 'Web-01',
      from: 'PC-1',
    });
    expect(parse('mail PC-2 from PC-1')).toEqual({ kind: 'flow', model: 'email', target: 'PC-2', from: 'PC-1' });
    expect(parse('download File Server from PC-1')).toEqual({
      kind: 'flow',
      model: 'download',
      target: 'File Server',
      from: 'PC-1',
    });
  });

  it('accepts "to" before the target and no source', () => {
    expect(parse('mail to PC-2')).toEqual({ kind: 'flow', model: 'email', target: 'PC-2' });
  });

  it('maps the instinctive aliases', () => {
    expect(expectKind('web Web-01', 'flow').model).toBe('web');
    expect(expectKind('curl Web-01', 'flow').model).toBe('web');
    expect(expectKind('email PC-2', 'flow').model).toBe('email');
    expect(expectKind('wget Web-01', 'flow').model).toBe('download');
  });

  it('answers a bare verb with its usage', () => {
    expect(suggestion('browse')).toBe('try: browse <target> [from <device>]');
    expect(suggestion('mail from PC-1')).toBe('try: mail <target> [from <device>]');
    expect(suggestion('wget')).toBe('try: download <target> [from <device>]');
  });

  it('suggests the verb for a near miss', () => {
    expect(suggestion('brwose Web-01')).toBe('browse');
    expect(suggestion('downlaod Web-01')).toBe('download');
  });
});

describe('parse — show routes / rules', () => {
  it('parses both with and without a device', () => {
    expect(parse('show routes of Router-1')).toEqual({ kind: 'show', what: 'routes', device: 'Router-1' });
    expect(parse('show routes')).toEqual({ kind: 'show', what: 'routes' });
    expect(parse('show rules FW-1')).toEqual({ kind: 'show', what: 'rules', device: 'FW-1' });
  });

  it('suggests the plural for the singular', () => {
    expect(suggestion('show route Router-1')).toContain('show routes');
    expect(suggestion('show rule FW-1')).toContain('show rules');
  });
});

describe('parse — add / remove route', () => {
  it('parses a route with its next hop and device', () => {
    expect(parse('add route 192.168.30.0/24 via 10.0.0.2 on Router-1')).toEqual({
      kind: 'route-add',
      destination: '192.168.30.0/24',
      nextHop: '10.0.0.2',
      device: 'Router-1',
    });
  });

  it('accepts default, a multi-word device and the device context', () => {
    expect(parse('add route default via 10.0.0.2 on Core Router HQ')).toEqual({
      kind: 'route-add',
      destination: 'default',
      nextHop: '10.0.0.2',
      device: 'Core Router HQ',
    });
    expect(parse('add route 10.0.0.0/8 via 192.168.1.254')).toEqual({
      kind: 'route-add',
      destination: '10.0.0.0/8',
      nextHop: '192.168.1.254',
    });
  });

  it('accepts "to" before the network, as people say it', () => {
    expect(expectKind('add route to 10.0.0.0/8 via 192.168.1.254 on R1', 'route-add').destination).toBe(
      '10.0.0.0/8'
    );
  });

  it('leaves the values as typed: the executor says what is wrong with them', () => {
    expect(parse('add route servers via R2 on R1')).toEqual({
      kind: 'route-add',
      destination: 'servers',
      nextHop: 'R2',
      device: 'R1',
    });
  });

  it('asks for the next hop when it is missing', () => {
    const usage = 'try: add route <network>|default via <next hop> [on <device>]';
    expect(suggestion('add route 192.168.30.0/24')).toBe(usage);
    expect(suggestion('add route 192.168.30.0/24 via')).toBe(usage);
    expect(suggestion('add route via 10.0.0.2')).toBe(usage);
    expect(suggestion('add route')).toBe(usage);
  });

  it('parses a backup route like a route, marked as such', () => {
    expect(parse('add backup route 192.168.30.0/24 via 10.0.1.2 on Router-1')).toEqual({
      kind: 'route-add',
      destination: '192.168.30.0/24',
      nextHop: '10.0.1.2',
      device: 'Router-1',
      backup: true,
    });
    expect(parse('add backup route default via 198.51.100.1')).toEqual({
      kind: 'route-add',
      destination: 'default',
      nextHop: '198.51.100.1',
      backup: true,
    });
    // a plain route carries no such mark
    expect(parse('add route default via 198.51.100.1')).not.toHaveProperty('backup');
  });

  it('answers an incomplete backup route with its own form', () => {
    const usage = 'try: add backup route <network>|default via <next hop> [on <device>]';
    expect(suggestion('add backup route 192.168.30.0/24')).toBe(usage);
    expect(suggestion('add backup route')).toBe(usage);
    // "backup" alone is not a thing to add
    expect(suggestion('add backup 192.168.30.0/24 via 10.0.0.2')).toContain('add route');
  });

  it('removes one route of several by its next hop', () => {
    expect(parse('remove route 192.168.30.0/24 via 10.0.1.2 from Router-1')).toEqual({
      kind: 'route-remove',
      destination: '192.168.30.0/24',
      nextHop: '10.0.1.2',
      device: 'Router-1',
    });
    expect(parse('remove route default via 198.51.100.1')).toEqual({
      kind: 'route-remove',
      destination: 'default',
      nextHop: '198.51.100.1',
    });
    expect(suggestion('remove route default via')).toBe(
      'try: remove route <network>|default [via <next hop>] [from <device>]'
    );
    expect(suggestion('remove backup route default')).toBe(
      'try: remove route <network>|default via <next hop> [from <device>]'
    );
  });

  it('removes a route by its network', () => {
    expect(parse('remove route 192.168.30.0/24 from Router-1')).toEqual({
      kind: 'route-remove',
      destination: '192.168.30.0/24',
      device: 'Router-1',
    });
    expect(parse('delete route default')).toEqual({ kind: 'route-remove', destination: 'default' });
    expect(suggestion('remove route')).toContain('remove route <network>');
  });
});

describe('parse — add / remove rule', () => {
  it('parses action, service, both sides and the firewall', () => {
    expect(parse('add rule allow web from untrust to dmz on FW-1')).toEqual({
      kind: 'rule-add',
      action: 'allow',
      service: 'web',
      source: 'untrust',
      destination: 'dmz',
      device: 'FW-1',
    });
  });

  it('takes addresses, networks and device names on either side', () => {
    expect(parse('add rule deny any from 192.168.10.0/24 to Web Server 1 on Edge FW')).toEqual({
      kind: 'rule-add',
      action: 'deny',
      service: 'any',
      source: '192.168.10.0/24',
      destination: 'Web Server 1',
      device: 'Edge FW',
    });
  });

  it('means "any service" when none is written', () => {
    expect(parse('add rule deny from untrust to trust')).toEqual({
      kind: 'rule-add',
      action: 'deny',
      service: 'any',
      source: 'untrust',
      destination: 'trust',
    });
  });

  it('puts the rule at a position when one is given', () => {
    expect(parse('add rule 1 allow email from any to 172.16.0.20 on FW-1')).toEqual({
      kind: 'rule-add',
      position: 1,
      action: 'allow',
      service: 'email',
      source: 'any',
      destination: '172.16.0.20',
      device: 'FW-1',
    });
  });

  it('accepts permit/block and the other names of the services', () => {
    expect(expectKind('add rule permit http from any to dmz', 'rule-add')).toMatchObject({
      action: 'allow',
      service: 'web',
    });
    expect(expectKind('add rule block smtp from any to any', 'rule-add')).toMatchObject({
      action: 'deny',
      service: 'email',
    });
    expect(expectKind('add rule allow all from trust to any', 'rule-add').service).toBe('any');
  });

  it('splits destination and firewall at the last "on"', () => {
    expect(parse('add rule allow web from any to "Server on rack 2" on FW-1')).toMatchObject({
      destination: 'Server on rack 2',
      device: 'FW-1',
    });
  });

  it('explains what is missing', () => {
    expect(suggestion('add rule web from untrust to dmz')).toContain('a rule starts with allow or deny');
    expect(suggestion('add rule allow ssh from untrust to dmz')).toContain('unknown service "ssh"');
    expect(suggestion('add rule allow web untrust to dmz')).toContain('add rule [<position>] allow|deny');
    expect(suggestion('add rule allow web from untrust')).toContain('add rule [<position>] allow|deny');
    expect(suggestion('add rule allow web from to dmz')).toContain('add rule [<position>] allow|deny');
    expect(suggestion('add rule allow web from untrust to dmz on')).toContain('add rule [<position>] allow|deny');
    expect(suggestion('add rule 0 allow web from any to any')).toContain('positions start at 1');
  });

  it('removes a rule by its number', () => {
    expect(parse('remove rule 2 from FW-1')).toEqual({ kind: 'rule-remove', position: 2, device: 'FW-1' });
    expect(parse('delete rule 1')).toEqual({ kind: 'rule-remove', position: 1 });
    expect(suggestion('remove rule')).toBe('try: remove rule <n> [from <device>]');
    expect(suggestion('remove rule first from FW-1')).toContain('rule number must be a number');
  });
});

describe('parse — add / remove without a known noun', () => {
  it('lists what can be added or removed', () => {
    for (const input of ['add', 'add 20 to Switch-0', 'add device PC-9']) {
      const hint = suggestion(input);
      expect(hint).toContain('add vlan');
      expect(hint).toContain('add route');
      expect(hint).toContain('add rule');
    }
    expect(suggestion('remove everything')).toContain('remove route');
  });
});

describe('parse — interface settings', () => {
  it('names a network card as well as a port number', () => {
    expect(parse('interface eth0 down on Web-01')).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'state', up: false },
      device: 'Web-01',
    });
    // a port number keeps mapping onto the port commands
    expect(parse('interface 3 down on SW-1')).toEqual({ kind: 'port-disable', port: 3, device: 'SW-1' });
  });

  it('sets an address, with or without a prefix length', () => {
    expect(parse('interface 2 ip 10.0.0.1/30 on Router-1')).toEqual({
      kind: 'interface-set',
      iface: '2',
      setting: { what: 'ip', address: '10.0.0.1', prefix: 30 },
      device: 'Router-1',
    });
    expect(parse('interface eth1 ip 10.0.0.5')).toEqual({
      kind: 'interface-set',
      iface: 'eth1',
      setting: { what: 'ip', address: '10.0.0.5' },
    });
    expect(expectKind('interface 2 address 10.0.0.1/30', 'interface-set').setting).toEqual({
      what: 'ip',
      address: '10.0.0.1',
      prefix: 30,
    });
  });

  it('clears an address with none', () => {
    expect(expectKind('interface 2 ip none on Router-1', 'interface-set').setting).toEqual({
      what: 'ip',
      address: null,
    });
  });

  it('refuses a prefix length that is not one', () => {
    expect(suggestion('interface 2 ip 10.0.0.1/33 on R1')).toContain('"/33" is not a prefix length');
    expect(suggestion('interface 2 ip 10.0.0.1/ on R1')).toContain('is not a prefix length');
    expect(suggestion('interface 2 ip')).toContain('interface <n> ip <address>');
  });

  it('sets and clears the gateway of a network card', () => {
    expect(expectKind('interface eth0 gateway 192.168.1.1 on PC-1', 'interface-set')).toMatchObject({
      setting: { what: 'gateway', address: '192.168.1.1' },
      device: 'PC-1',
    });
    expect(expectKind('interface eth0 gateway none', 'interface-set').setting).toEqual({
      what: 'gateway',
      address: null,
    });
  });

  it('makes a switch port an access port', () => {
    expect(parse('interface 3 access 10 on SW Floor 1')).toEqual({
      kind: 'interface-set',
      iface: '3',
      setting: { what: 'access', vlan: 10 },
      device: 'SW Floor 1',
    });
    expect(suggestion('interface 3 access ten on SW-1')).toContain('VLAN id must be a number from 1 to 4094');
    expect(suggestion('interface 3 access 4095 on SW-1')).toContain('VLAN id must be a number from 1 to 4094');
    expect(suggestion('interface 3 access')).toContain('interface <n> access <vlan>');
  });

  it('makes a switch port a trunk, however the list is typed', () => {
    const trunk = (input: string) => expectKind(input, 'interface-set');
    expect(trunk('interface 8 trunk 10,20,30 on SW-1')).toEqual({
      kind: 'interface-set',
      iface: '8',
      setting: { what: 'trunk', vlans: [10, 20, 30] },
      device: 'SW-1',
    });
    expect(trunk('interface 8 trunk 10, 20, 30 on SW-1')).toMatchObject({
      setting: { what: 'trunk', vlans: [10, 20, 30] },
      device: 'SW-1',
    });
    expect(trunk('interface 8 trunk 10 20 10').setting).toEqual({ what: 'trunk', vlans: [10, 20] });
  });

  it('a trunk for every VLAN: "all", or no list', () => {
    expect(expectKind('interface 8 trunk all on SW-1', 'interface-set')).toMatchObject({
      setting: { what: 'trunk', vlans: [] },
      device: 'SW-1',
    });
    expect(expectKind('interface 8 trunk on SW-1', 'interface-set')).toMatchObject({
      setting: { what: 'trunk', vlans: [] },
      device: 'SW-1',
    });
    expect(suggestion('interface 8 trunk 10,5000 on SW-1')).toContain('got "5000"');
  });

  it('takes the VLAN off a port with "default"', () => {
    expect(parse('interface 3 default on SW-1')).toEqual({
      kind: 'interface-set',
      iface: '3',
      setting: { what: 'no-vlan' },
      device: 'SW-1',
    });
  });

  it('puts a firewall port in a zone, or in none', () => {
    expect(expectKind('interface 1 zone trust on FW-1', 'interface-set')).toMatchObject({
      setting: { what: 'zone', zone: 'trust' },
      device: 'FW-1',
    });
    expect(expectKind('interface 1 zone none', 'interface-set').setting).toEqual({ what: 'zone', zone: null });
    expect(suggestion('interface 1 zone lan on FW-1')).toContain('unknown zone "lan"');
  });

  it('lists the settings when the word after the interface is not one', () => {
    const hint = suggestion('interface 3 speed 1G on SW-1');
    expect(hint).toContain('up|down');
    expect(hint).toContain('access <vlan>');
    expect(hint).toContain('zone trust|untrust|dmz|none');
  });
});

describe('docs/terminal-commands.md', () => {
  // every command typed at a prompt in the examples of the reference
  const typed = languageReference
    .split('\n')
    .map(line => /^(?:pixelcake|[\w-]+)> (.+)$/.exec(line.trim())?.[1])
    .filter((command): command is string => command !== undefined);

  it('has examples to check', () => {
    expect(typed.length).toBeGreaterThan(25);
  });

  it.each(typed)('the example "%s" is a command the parser accepts', command => {
    expect(parse(command).kind).not.toBe('unknown');
  });
});
