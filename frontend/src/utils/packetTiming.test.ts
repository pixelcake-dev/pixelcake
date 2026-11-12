import { describe, it, expect } from 'vitest';
import { link } from '@/test/networkFixtures';
import { edgeDuration, pickConnection } from './packetTiming';

describe('edgeDuration', () => {
  it('grows with the length of the cable, between a floor and a ceiling', () => {
    expect(edgeDuration(0, 1)).toBe(350);
    expect(edgeDuration(100, 1)).toBe(350);
    expect(edgeDuration(300, 1)).toBe(600);
    expect(edgeDuration(5000, 1)).toBe(1100);
  });

  it('is divided by the speed', () => {
    expect(edgeDuration(300, 2)).toBe(300);
    expect(edgeDuration(300, 0.5)).toBe(1200);
    expect(edgeDuration(0, 2)).toBe(175);
  });

  it('keeps a long exchange short: ten cables of a usual length in well under ten seconds', () => {
    const tenHops = 10 * edgeDuration(250, 1);
    expect(tenHops).toBeLessThanOrEqual(5000);
  });
});

describe('pickConnection', () => {
  const first = link('a', 'b', { id: 'first' });
  const second = link('b', 'a', { id: 'second' });
  const elsewhere = link('b', 'c', { id: 'elsewhere' });
  const all = [first, second, elsewhere];

  it('takes the cable the engine named, whichever way it was drawn', () => {
    expect(pickConnection(all, 'a', 'b', 'second')).toBe(second);
    expect(pickConnection(all, 'b', 'a', 'first')).toBe(first);
  });

  it('without a name takes the first cable between the two', () => {
    expect(pickConnection(all, 'a', 'b', undefined)).toBe(first);
    expect(pickConnection(all, 'a', 'b', '')).toBe(first);
  });

  it('does not take a named cable that joins two other devices, nor one that is gone', () => {
    expect(pickConnection(all, 'a', 'b', 'elsewhere')).toBe(first);
    expect(pickConnection(all, 'a', 'b', 'removed')).toBe(first);
  });

  it('without a name leaves a cut cable for one that works', () => {
    expect(pickConnection(all, 'a', 'b', undefined, ['first'])).toBe(second);
    // every cable cut: there is still something to draw the packet on
    expect(pickConnection(all, 'a', 'b', undefined, ['first', 'second'])).toBe(first);
  });

  it('finds nothing between two devices that are not joined', () => {
    expect(pickConnection(all, 'a', 'c', undefined)).toBeUndefined();
    expect(pickConnection(all, 'a', 'c', 'first')).toBeUndefined();
  });
});
