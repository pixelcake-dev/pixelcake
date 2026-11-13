/**
 * Parser tests for DHCP: a card that takes its address from a server
 * (`interface <name> dhcp`), the pool of an interface (`interface <n> pool`),
 * and `show dhcp`.
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import type { Command } from './types';

const suggestion = (input: string) => {
  const command = parse(input);
  expect(command.kind).toBe('unknown');
  return (command as Extract<Command, { kind: 'unknown' }>).suggestion ?? '';
};

describe('parse — interface … dhcp', () => {
  it('switches it on with the bare word, with or without a device', () => {
    expect(parse('interface eth0 dhcp on PC-1')).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'dhcp', on: true },
      device: 'PC-1',
    });
    expect(parse('interface eth0 dhcp')).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'dhcp', on: true },
    });
    // "on" as the value and "on" before the device read the same
    expect(parse('interface eth0 dhcp on on PC-1')).toEqual(parse('interface eth0 dhcp on PC-1'));
    expect(parse('INTERFACE eth0 DHCP ON Meeting Room PC')).toMatchObject({
      setting: { what: 'dhcp', on: true },
      device: 'Meeting Room PC',
    });
  });

  it.each(['off', 'none', 'no', 'disable'])('switches it off with "%s"', word => {
    expect(parse(`interface eth0 dhcp ${word} on PC-1`)).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'dhcp', on: false },
      device: 'PC-1',
    });
    expect(parse(`interface eth0 dhcp ${word}`)).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: { what: 'dhcp', on: false },
    });
  });

  it('a device called like the word that switches it off is quoted', () => {
    expect(parse('interface eth0 dhcp on "off"')).toMatchObject({
      setting: { what: 'dhcp', on: true },
      device: 'off',
    });
    expect(parse('interface eth0 dhcp "none"')).toMatchObject({ setting: { what: 'dhcp', on: true }, device: 'none' });
  });
});

describe('parse — interface … pool', () => {
  const pool = (input: string) => {
    const command = parse(input);
    expect(command.kind).toBe('interface-set');
    return command as Extract<Command, { kind: 'interface-set' }>;
  };

  it('reads the range, from its first address to its last', () => {
    expect(parse('interface 2 pool 192.168.20.100 to 192.168.20.199 on Router-Core')).toEqual({
      kind: 'interface-set',
      iface: '2',
      setting: { what: 'pool', pool: { start: '192.168.20.100', end: '192.168.20.199' } },
      device: 'Router-Core',
    });
  });

  it.each([
    'interface 2 pool 192.168.20.100-192.168.20.199 on Router-Core',
    'interface 2 pool 192.168.20.100 - 192.168.20.199 on Router-Core',
    'interface 2 pool 192.168.20.100 192.168.20.199 on Router-Core',
    'interface 2 dhcp pool 192.168.20.100 to 192.168.20.199 on Router-Core',
    'interface 2 dhcp server 192.168.20.100 to 192.168.20.199 on Router-Core',
    'interface 2 POOL 192.168.20.100 TO 192.168.20.199 of Router-Core',
  ])('also as "%s"', input => {
    expect(parse(input)).toEqual(parse('interface 2 pool 192.168.20.100 to 192.168.20.199 on Router-Core'));
  });

  it('reads the gateway handed out, when one is written', () => {
    expect(pool('interface eth0 pool 192.168.1.100 to 192.168.1.199 gateway 192.168.1.1 on Srv-DHCP')).toEqual({
      kind: 'interface-set',
      iface: 'eth0',
      setting: {
        what: 'pool',
        pool: { start: '192.168.1.100', end: '192.168.1.199', gateway: '192.168.1.1' },
      },
      device: 'Srv-DHCP',
    });
    expect(pool('interface eth0 pool 192.168.1.100-192.168.1.199 gw 192.168.1.1').setting).toEqual({
      what: 'pool',
      pool: { start: '192.168.1.100', end: '192.168.1.199', gateway: '192.168.1.1' },
    });
  });

  it('works without a device, for the device of the context', () => {
    expect(parse('interface 1 pool 10.0.0.10 to 10.0.0.20')).toEqual({
      kind: 'interface-set',
      iface: '1',
      setting: { what: 'pool', pool: { start: '10.0.0.10', end: '10.0.0.20' } },
    });
  });

  it.each(['none', 'clear', 'off'])('stops it with "pool %s"', word => {
    expect(parse(`interface 2 pool ${word} on Router-Core`)).toEqual({
      kind: 'interface-set',
      iface: '2',
      setting: { what: 'pool', pool: null },
      device: 'Router-Core',
    });
    expect(parse(`interface 2 dhcp pool ${word}`)).toEqual({
      kind: 'interface-set',
      iface: '2',
      setting: { what: 'pool', pool: null },
    });
  });

  it('leaves it to the executor to say whether the two are addresses', () => {
    expect(pool('interface 2 pool first to last on R').setting).toEqual({
      what: 'pool',
      pool: { start: 'first', end: 'last' },
    });
  });

  it('asks for the two ends when one is missing', () => {
    const hint = 'try: interface <n> pool <first> to <last> [gateway <address>] [on] <device> — or "pool none" to stop';
    expect(suggestion('interface 2 pool')).toBe(hint);
    expect(suggestion('interface 2 pool 192.168.20.100')).toBe(`a pool goes from its first address to its last — ${hint}`);
    expect(suggestion('interface 2 pool 192.168.20.100 to')).toBe(`a pool goes from its first address to its last — ${hint}`);
    expect(suggestion('interface 2 pool 192.168.20.100 on Router-Core')).toBe(
      `a pool goes from its first address to its last — ${hint}`
    );
    expect(suggestion('interface 2 pool 192.168.20.100 gateway 192.168.20.1')).toBe(
      `a pool goes from its first address to its last — ${hint}`
    );
    expect(suggestion('interface 2 pool 192.168.20.100 to 192.168.20.199 gateway')).toBe(hint);
  });

  it('is named among the settings of an interface', () => {
    expect(suggestion('interface 2 speed 10')).toContain('dhcp [off], pool <first> to <last>|none');
  });
});

describe('parse — show dhcp', () => {
  it('of the whole drawing, or of one device', () => {
    expect(parse('show dhcp')).toEqual({ kind: 'show', what: 'dhcp' });
    expect(parse('show dhcp Router-Core')).toEqual({ kind: 'show', what: 'dhcp', device: 'Router-Core' });
    expect(parse('show dhcp of Router-Core')).toEqual({ kind: 'show', what: 'dhcp', device: 'Router-Core' });
    expect(parse('sh dhcp on Portatile-1')).toEqual({ kind: 'show', what: 'dhcp', device: 'Portatile-1' });
  });

  it('is in the list of what can be shown, and is what a slip of the finger meant', () => {
    expect(suggestion('show')).toContain('| nat | dhcp');
    expect(suggestion('show dhpc')).toBe('did you mean "show dhcp"?');
  });
});
