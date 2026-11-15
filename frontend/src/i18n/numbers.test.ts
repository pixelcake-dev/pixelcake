/**
 * A number of things is written as the language of the interface writes it:
 * «14.891» in Italian, "14,891" in English. Every entry of the dictionaries
 * that takes a number of things is called with one in plurals.test.ts; here
 * the helper itself, and the numbers the windows write on their own.
 */

import { describe, it, expect } from 'vitest';
import { dictionaryOf } from '@/i18n';
import { formatCount } from './numbers';

describe('formatCount', () => {
  it('groups the thousands as each language does', () => {
    expect(formatCount('it', 14891)).toBe('14.891');
    expect(formatCount('en', 14891)).toBe('14,891');
    expect(formatCount('it', 1000000)).toBe('1.000.000');
    expect(formatCount('en', 1000000)).toBe('1,000,000');
  });

  it('Italian groups the digits from five on, English from four', () => {
    expect(formatCount('it', 4422)).toBe('4422');
    expect(formatCount('en', 4422)).toBe('4,422');
  });

  it('a small number is written as it is', () => {
    for (const language of ['it', 'en'] as const) {
      expect([0, 1, 2, 999].map((value) => formatCount(language, value))).toEqual(['0', '1', '2', '999']);
    }
  });
});

describe('the numbers the windows write on their own', () => {
  it('common.count writes a number of things in the language of the dictionary', () => {
    expect(dictionaryOf('it').common.count(14891)).toBe('14.891');
    expect(dictionaryOf('en').common.count(14891)).toBe('14,891');
  });

  it('the size of a picture is written the same way', () => {
    expect(dictionaryOf('it').exportImage.size.pixels(14891, 9000, false)).toBe('14.891 × 9000 pixel');
    expect(dictionaryOf('en').exportImage.size.pixels(14891, 9000, false)).toBe('14,891 × 9,000 pixels');
  });

  it('a number that names one thing is not a count, and is not grouped', () => {
    expect(dictionaryOf('en').common.interfaces.port(14891)).toBe('Port 14891');
    expect(dictionaryOf('it').firewall.deleteNumbered(14891)).toBe('Elimina la regola 14891');
  });
});
