/**
 * Parser tests for simulated failures: `fail`, `repair` and `show failures`.
 */

import { describe, it, expect } from 'vitest';
import { parse } from './parser';
import type { Command } from './types';

const suggestion = (input: string) => {
  const command = parse(input);
  expect(command.kind).toBe('unknown');
  return (command as Extract<Command, { kind: 'unknown' }>).suggestion ?? '';
};

describe('parse — fail', () => {
  it('takes a device, of one word or several, quoted or not', () => {
    expect(parse('fail SW-Core')).toEqual({ kind: 'fail', target: { what: 'device', device: 'SW-Core' } });
    expect(parse('FAIL Core Switch HQ')).toEqual({
      kind: 'fail',
      target: { what: 'device', device: 'Core Switch HQ' },
    });
    expect(parse('fail "link 3"')).toEqual({ kind: 'fail', target: { what: 'device', device: 'link 3' } });
    expect(parse('fail the device SW-Core')).toEqual({
      kind: 'fail',
      target: { what: 'device', device: 'SW-Core' },
    });
  });

  it('takes no device inside a `use` context', () => {
    expect(parse('fail')).toEqual({ kind: 'fail', target: { what: 'device' } });
  });

  it('takes a cable between two devices', () => {
    expect(parse('fail link R-HQ to R-Branch')).toEqual({
      kind: 'fail',
      target: { what: 'link', a: 'R-HQ', b: 'R-Branch' },
    });
    expect(parse('fail link Core Switch from Edge Router')).toEqual({
      kind: 'fail',
      target: { what: 'link', a: 'Core Switch', b: 'Edge Router' },
    });
  });

  it('names which cable by an interface of the first device', () => {
    expect(parse('fail link R-HQ to R-Branch by 3')).toEqual({
      kind: 'fail',
      target: { what: 'link', a: 'R-HQ', b: 'R-Branch', by: '3' },
    });
    expect(parse('fail link R-HQ to R-Branch by port 3')).toEqual({
      kind: 'fail',
      target: { what: 'link', a: 'R-HQ', b: 'R-Branch', by: '3' },
    });
    expect(parse('fail link PC-1 to SW-1 by interface eth0')).toEqual({
      kind: 'fail',
      target: { what: 'link', a: 'PC-1', b: 'SW-1', by: 'eth0' },
    });
  });

  it('says what it expected when a cable is not complete', () => {
    expect(suggestion('fail link R-HQ')).toContain('fail link <device A> to <device B>');
    expect(suggestion('fail link')).toContain('fail link <device A> to <device B>');
    expect(suggestion('fail link R-HQ to')).toContain('fail link <device A> to <device B>');
    expect(suggestion('fail link R-HQ to R-Branch by')).toContain('[by <interface>]');
  });
});

describe('parse — repair', () => {
  it('takes a device', () => {
    expect(parse('repair SW-Core')).toEqual({ kind: 'repair', target: { what: 'device', device: 'SW-Core' } });
    expect(parse('repair')).toEqual({ kind: 'repair', target: { what: 'device' } });
  });

  it('takes a cable, named like `fail link`', () => {
    expect(parse('repair link R-HQ to R-Branch')).toEqual({
      kind: 'repair',
      target: { what: 'link', a: 'R-HQ', b: 'R-Branch' },
    });
    expect(parse('repair link R-HQ to R-Branch by 3')).toEqual({
      kind: 'repair',
      target: { what: 'link', a: 'R-HQ', b: 'R-Branch', by: '3' },
    });
    expect(suggestion('repair link R-HQ')).toContain('repair link <device A> to <device B>');
  });

  it('takes `all`, and a device called all only quoted', () => {
    expect(parse('repair all')).toEqual({ kind: 'repair', target: { what: 'all' } });
    expect(parse('REPAIR ALL')).toEqual({ kind: 'repair', target: { what: 'all' } });
    expect(parse('repair "all"')).toEqual({ kind: 'repair', target: { what: 'device', device: 'all' } });
  });

  it('does not take `all` for fail', () => {
    expect(parse('fail all')).toEqual({ kind: 'fail', target: { what: 'device', device: 'all' } });
  });
});

describe('parse — show failures', () => {
  it('is a show', () => {
    expect(parse('show failures')).toEqual({ kind: 'show', what: 'failures' });
    expect(parse('sh failures')).toEqual({ kind: 'show', what: 'failures' });
  });

  it('is suggested for a near miss', () => {
    expect(suggestion('show failure')).toBe('did you mean "show failures"?');
  });
});
