/**
 * An address is read in one pass now (the engine reads addresses many
 * times for every question): `isValidIP` and `ipToNumber` say exactly what
 * the regular expression and the split said before, on every kind of text.
 */

import { describe, it, expect } from 'vitest';
import { isValidIP } from '@/utils/ipHelpers';
import { ipToNumber } from './addressing';

/** What isValidIP was: a regular expression, then each group no more than 255 */
function validBefore(ip: string): boolean {
  const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  return match.slice(1).every((octet) => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

/** What ipToNumber was */
function numberBefore(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

/** Texts of every kind, the same every run (a small linear congruential generator) */
function texts(): string[] {
  const out = [
    '', '.', '...', '0.0.0.0', '255.255.255.255', '256.1.1.1', '1.2.3', '1.2.3.4.', '.1.2.3.4', '1.2.3.4.5',
    '01.002.000.9', '1..2.3', '1.2.3.4 ', ' 1.2.3.4', '1.2.3.4\n', '1.2.3.-4', '1.2.3.+4', '1.2.3.0x1', '1.2.3.4e1',
    '١.٢.٣.٤', '1.2.3.1000', '999.999.999.999', '10.0.0.255', '192.168.1.1/24', 'default', 'abc', '1.2.3.04',
  ];
  let seed = 12345;
  const next = (n: number) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed % n;
  };
  const pieces = ['0', '1', '9', '25', '255', '256', '300', '007', '1000', '', 'a', ' ', '-1', '+', 'x'];
  for (let i = 0; i < 20000; i++) {
    const groups = 1 + next(6);
    out.push(Array.from({ length: groups }, () => pieces[next(pieces.length)]).join(next(10) === 0 ? ',' : '.'));
  }
  return out;
}

describe('an address read in one pass', () => {
  it('isValidIP says what the regular expression said, on every text', () => {
    const differ = texts().filter((text) => isValidIP(text) !== validBefore(text));
    expect(differ).toEqual([]);
  });

  it('ipToNumber gives the number the split gave, on every text, valid or not', () => {
    const differ = texts().filter((text) => !Object.is(ipToNumber(text), numberBefore(text)));
    expect(differ).toEqual([]);
    expect(ipToNumber('192.168.10.1')).toBe(3232238081);
  });
});
