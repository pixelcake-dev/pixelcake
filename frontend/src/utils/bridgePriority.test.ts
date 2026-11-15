import { describe, it, expect } from 'vitest';
import {
  BRIDGE_PRIORITY_DEFAULT,
  BRIDGE_PRIORITY_MAX,
  BRIDGE_PRIORITY_STEP,
  nearestBridgePriority,
} from './bridgePriority';
import { dictionaryOf } from '@/i18n';

describe('the bridge priority', () => {
  it('has sixteen values: the multiples of 4096 from 0 to 61440', () => {
    const values = Array.from({ length: 70000 }, (_, n) => n).filter(n => nearestBridgePriority(n) === n);
    expect(values).toHaveLength(16);
    expect(values[0]).toBe(0);
    expect(values[15]).toBe(BRIDGE_PRIORITY_MAX);
    expect(values.every(n => n % BRIDGE_PRIORITY_STEP === 0)).toBe(true);
    expect(values).toContain(BRIDGE_PRIORITY_DEFAULT);
  });

  it('a number in between becomes the nearest of them', () => {
    expect(nearestBridgePriority(1)).toBe(0);
    expect(nearestBridgePriority(2047)).toBe(0);
    expect(nearestBridgePriority(2048)).toBe(4096);
    expect(nearestBridgePriority(5000)).toBe(4096);
    expect(nearestBridgePriority(32768)).toBe(32768);
    expect(nearestBridgePriority(40000)).toBe(40960);
  });

  it('a number outside becomes the nearest end', () => {
    expect(nearestBridgePriority(-1)).toBe(0);
    expect(nearestBridgePriority(-5000)).toBe(0);
    expect(nearestBridgePriority(61441)).toBe(61440);
    expect(nearestBridgePriority(65535)).toBe(61440);
    expect(nearestBridgePriority(1e9)).toBe(61440);
  });

  it('what is not a number is the default', () => {
    for (const value of [NaN, Infinity, undefined, null, '4096', {}]) {
      expect(nearestBridgePriority(value)).toBe(BRIDGE_PRIORITY_DEFAULT);
    }
  });

  it('the note under the field says these numbers, in both languages', () => {
    for (const language of ['it', 'en'] as const) {
      const hint = dictionaryOf(language).inspector.general.stp.bridgePriorityHint;
      const numbers = (hint.match(/\d+/g) ?? []).map(Number);
      expect(numbers, language).toEqual([0, BRIDGE_PRIORITY_MAX, BRIDGE_PRIORITY_STEP, BRIDGE_PRIORITY_DEFAULT]);
    }
  });
});
