/**
 * Parser tests for DNS: the lookup alone (`resolve <name>`), the records of
 * a server (`add record`, `remove record`), the DNS server of a card
 * (`interface <name> dns`), the one a pool hands out (`pool … dns`),
 * `show dns`, and `dns` among the services.
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import type { Command } from './types';

const suggestion = (input: string) => {
  const command = parse(input);
  expect(command.kind).toBe('unknown');
  return (command as Extract<Command, { kind: 'unknown' }>).suggestion ?? '';
};

describe('parse — resolve', () => {
  it('takes a name and, when given, the device that asks', () => {
    expect(parse('resolve www.azienda.example from PC-1')).toEqual({
      kind: 'resolve',
      name: 'www.azienda.example',
      from: 'PC-1',
    });
    expect(parse('resolve www.azienda.example')).toEqual({ kind: 'resolve', name: 'www.azienda.example' });
    expect(parse('RESOLVE www.azienda.example FROM Meeting Room PC')).toEqual({
      kind: 'resolve',
      name: 'www.azienda.example',
      from: 'Meeting Room PC',
    });
  });

  it.each(['lookup', 'nslookup'])('is also "%s"', verb => {
    expect(parse(`${verb} www.azienda.example from PC-1`)).toEqual(parse('resolve www.azienda.example from PC-1'));
  });

  it('says what it should have been when the name or the device is missing', () => {
    expect(suggestion('resolve')).toBe('try: resolve <name> [from <device>]');
    expect(suggestion('resolve from PC-1')).toBe('try: resolve <name> [from <device>]');
    expect(suggestion('resolve www.azienda.example from')).toBe('try: resolve <name> [from <device>]');
  });

  it('is suggested for a verb typed nearly right', () => {
    expect(suggestion('resolv www.azienda.example')).toBe('resolve');
    expect(suggestion('nslokup www.azienda.example')).toBe('nslookup');
    expect(suggestion('lokup www.azienda.example')).toBe('lookup');
  });
});

describe('parse — a name where a target goes', () => {
  it('is handed on as typed: what it stands for is for the executor to find out', () => {
    expect(parse('ping www.azienda.example from PC-1')).toEqual({
      kind: 'ping',
      target: 'www.azienda.example',
      from: 'PC-1',
    });
    expect(parse('trace www.azienda.example from PC-1 as web')).toEqual({
      kind: 'trace',
      target: 'www.azienda.example',
      from: 'PC-1',
      service: 'web',
    });
    expect(parse('browse www.azienda.example')).toEqual({ kind: 'flow', model: 'web', target: 'www.azienda.example' });
  });
});

describe('parse — interface … dns', () => {
  it('names the DNS server of a card, with or without a device', () => {
    expect(parse('interface eth0 dns 192.168.30.10 on PC-1')).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'dns', address: '192.168.30.10' },
      device: 'PC-1',
    });
    expect(parse('interface eth0 dns 192.168.30.10')).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'dns', address: '192.168.30.10' },
    });
    expect(parse('INTERFACE eth0 DNS 192.168.30.10 Meeting Room PC')).toMatchObject({
      setting: { what: 'dns', address: '192.168.30.10' },
      device: 'Meeting Room PC',
    });
  });

  it.each(['none', 'clear', 'NONE'])('"%s" is nobody', word => {
    expect(parse(`interface eth0 dns ${word} on PC-1`)).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'dns', address: null },
      device: 'PC-1',
    });
  });

  it('hands on what is typed: whether it is an address is for the executor to say', () => {
    expect(parse('interface eth0 dns srv-auth on PC-1')).toMatchObject({
      setting: { what: 'dns', address: 'srv-auth' },
    });
    // a quoted word is never "none"
    expect(parse('interface eth0 dns "none" on PC-1')).toMatchObject({ setting: { what: 'dns', address: 'none' } });
  });

  it('says what it should have been when the address is missing', () => {
    expect(suggestion('interface eth0 dns')).toBe(
      'try: interface <name> dns <address> [on] <device> — or "dns none"'
    );
    expect(suggestion('interface eth0 wins 10.0.0.1')).toContain('pool <first> to <last>|none, dns <address>|none');
  });
});

describe('parse — interface … pool … dns', () => {
  const pool = (input: string) => {
    const command = parse(input);
    if (command.kind !== 'interface-set' || command.setting.what !== 'pool') throw new Error(`not a pool: ${input}`);
    return { pool: command.setting.pool, device: command.device };
  };

  it('a pool may name the DNS server it hands out', () => {
    expect(pool('interface 1 pool 192.168.10.100 to 192.168.10.199 dns 192.168.30.10 on Router-1')).toEqual({
      pool: { start: '192.168.10.100', end: '192.168.10.199', dns: '192.168.30.10' },
      device: 'Router-1',
    });
    expect(pool('interface 1 pool 192.168.10.100-192.168.10.199 DNS 192.168.30.10')).toEqual({
      pool: { start: '192.168.10.100', end: '192.168.10.199', dns: '192.168.30.10' },
      device: undefined,
    });
    expect(pool('interface 1 dhcp pool 192.168.10.100 192.168.10.199 dns 192.168.30.10 Router-1')).toEqual({
      pool: { start: '192.168.10.100', end: '192.168.10.199', dns: '192.168.30.10' },
      device: 'Router-1',
    });
  });

  it('with a gateway too, in either order', () => {
    const both = { start: '192.168.10.100', end: '192.168.10.199', gateway: '192.168.10.254', dns: '192.168.30.10' };
    expect(pool('interface 1 pool 192.168.10.100 to 192.168.10.199 gateway 192.168.10.254 dns 192.168.30.10 on R')).toEqual({
      pool: both,
      device: 'R',
    });
    expect(pool('interface 1 pool 192.168.10.100 to 192.168.10.199 dns 192.168.30.10 gw 192.168.10.254 on R')).toEqual({
      pool: both,
      device: 'R',
    });
  });

  it('a pool without one is as it was', () => {
    expect(pool('interface 1 pool 192.168.10.100 to 192.168.10.199 on Router-1')).toEqual({
      pool: { start: '192.168.10.100', end: '192.168.10.199' },
      device: 'Router-1',
    });
    expect(pool('interface 1 pool 192.168.10.100 to 192.168.10.199 gateway 192.168.10.254 on Router-1')).toEqual({
      pool: { start: '192.168.10.100', end: '192.168.10.199', gateway: '192.168.10.254' },
      device: 'Router-1',
    });
  });

  it('a device whose name starts like the word, or is quoted, is still the device', () => {
    expect(pool('interface 1 pool 192.168.10.100 to 192.168.10.199 DNS-Server')).toEqual({
      pool: { start: '192.168.10.100', end: '192.168.10.199' },
      device: 'DNS-Server',
    });
    expect(pool('interface 1 pool 192.168.10.100 to 192.168.10.199 "dns"')).toEqual({
      pool: { start: '192.168.10.100', end: '192.168.10.199' },
      device: 'dns',
    });
  });

  it('says what it should have been when the address of the DNS server, or the end of the range, is missing', () => {
    const hint =
      'try: interface <n> pool <first> to <last> [gateway <address>] [dns <address>] [on] <device> — or "pool none" to stop';
    expect(suggestion('interface 1 pool 192.168.10.100 to 192.168.10.199 dns')).toBe(hint);
    expect(suggestion('interface 1 pool 192.168.10.100 to 192.168.10.199 gateway 192.168.10.254 dns')).toBe(hint);
    expect(suggestion('interface 1 pool 192.168.10.100 dns 192.168.30.10')).toBe(
      `a pool goes from its first address to its last — ${hint}`
    );
  });
});

describe('parse — add record', () => {
  it('takes a name, an address and the server', () => {
    expect(parse('add record www.azienda.example 192.168.30.30 on Srv-Auth')).toEqual({
      kind: 'record-add',
      name: 'www.azienda.example',
      address: '192.168.30.30',
      device: 'Srv-Auth',
    });
    // in a device context the server is left out
    expect(parse('add record www.azienda.example 192.168.30.30')).toEqual({
      kind: 'record-add',
      name: 'www.azienda.example',
      address: '192.168.30.30',
    });
  });

  it('"to", "is" and "at" between the two are noise', () => {
    const plain = parse('add record www.azienda.example 192.168.30.30 on Srv-Auth');
    for (const word of ['to', 'is', 'at', 'TO']) {
      expect(parse(`add record www.azienda.example ${word} 192.168.30.30 on Srv-Auth`), word).toEqual(plain);
    }
  });

  it('the address may be a device, of more than one word: the last "on" splits it from the server', () => {
    expect(parse('add record www.azienda.example Web Server 1 on DNS Server')).toEqual({
      kind: 'record-add',
      name: 'www.azienda.example',
      address: 'Web Server 1',
      device: 'DNS Server',
    });
    expect(parse('add record www.azienda.example "Server on the roof" on the DNS Server')).toEqual({
      kind: 'record-add',
      name: 'www.azienda.example',
      address: 'Server on the roof',
      device: 'DNS Server',
    });
    expect(parse('add record www.azienda.example Web-01')).toMatchObject({ address: 'Web-01' });
    // of several, the last one
    expect(parse('add record www.azienda.example Server on the roof on DNS Server')).toEqual({
      kind: 'record-add',
      name: 'www.azienda.example',
      address: 'Server on the roof',
      device: 'DNS Server',
    });
    // a server called "on" is quoted, and is not taken for the word
    expect(parse('add record www.azienda.example Web-01 on "on"')).toEqual({
      kind: 'record-add',
      name: 'www.azienda.example',
      address: 'Web-01',
      device: 'on',
    });
  });

  it('says what it should have been when a part is missing', () => {
    const usage = 'try: add record <name> <address> [on <server>]';
    expect(suggestion('add record')).toBe(usage);
    expect(suggestion('add record www.azienda.example')).toBe(usage);
    expect(suggestion('add record www.azienda.example on Srv-Auth')).toBe(usage);
    expect(suggestion('add record www.azienda.example 192.168.30.30 on')).toBe(usage);
  });
});

describe('parse — remove record', () => {
  it('takes the place of a record or its name, and the server', () => {
    expect(parse('remove record 2 from Srv-Auth')).toEqual({ kind: 'record-remove', record: '2', device: 'Srv-Auth' });
    expect(parse('remove record www.azienda.example from Srv-Auth')).toEqual({
      kind: 'record-remove',
      record: 'www.azienda.example',
      device: 'Srv-Auth',
    });
    expect(parse('delete record 2 on the DNS Server')).toEqual({ kind: 'record-remove', record: '2', device: 'DNS Server' });
    expect(parse('remove record 2')).toEqual({ kind: 'record-remove', record: '2' });
  });

  it('says what it should have been when nothing follows', () => {
    expect(suggestion('remove record')).toBe('try: remove record <n>|<name> [from <server>]');
  });
});

describe('parse — add and remove say that records are there', () => {
  it('in the list of what can be added and removed', () => {
    expect(suggestion('add something')).toContain('add record <name> <address> [on <server>]');
    expect(suggestion('remove something')).toContain('remove record <n>|<name> [from <server>]');
  });
});

describe('parse — show dns', () => {
  it('of the whole drawing, or of one device', () => {
    expect(parse('show dns')).toEqual({ kind: 'show', what: 'dns' });
    expect(parse('show dns of Srv-Auth')).toEqual({ kind: 'show', what: 'dns', device: 'Srv-Auth' });
    expect(parse('sh dns Srv-Auth')).toEqual({ kind: 'show', what: 'dns', device: 'Srv-Auth' });
  });

  it('is in the list, and suggested for a near miss', () => {
    expect(suggestion('show')).toMatch(/\| dhcp \| dns$/);
    expect(suggestion('show dsn')).toBe('did you mean "show dns"?');
  });
});

describe('parse — dns among the services', () => {
  it('a trace can be made as dns', () => {
    expect(parse('trace Srv-Auth from PC-1 as dns')).toEqual({
      kind: 'trace',
      target: 'Srv-Auth',
      from: 'PC-1',
      service: 'dns',
    });
    expect(suggestion('trace Srv-Auth from PC-1 as names')).toBe(
      'unknown service "names" — try: trace <target> [from <device>] [as ping|web|email|dns]'
    );
  });

  it('a rule and a forward can be for dns, and say so when the service is not one', () => {
    expect(parse('add rule allow dns from untrust to 192.168.30.10 on FW-1')).toMatchObject({
      kind: 'rule-add',
      service: 'dns',
      destination: '192.168.30.10',
    });
    expect(parse('add forward dns from interface 3 to 192.168.30.10 on FW-1')).toMatchObject({
      kind: 'forward-add',
      service: 'dns',
      to: '192.168.30.10',
    });
    expect(suggestion('add rule allow names from any to any')).toContain(
      'unknown service "names" (ping, web, email, dns or any)'
    );
    expect(suggestion('add forward names from interface 3 to 192.168.30.10')).toContain(
      'unknown service "names" (ping, web, email, dns or any)'
    );
  });
});
