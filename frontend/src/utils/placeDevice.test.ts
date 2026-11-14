/**
 * firstFreePlace — where a device just added goes. The point of it: the
 * place is the one asked for, or the nearest free one, and it is the same
 * every time (it used to be drawn at random around the centre).
 */

import { describe, it, expect } from 'vitest';
import { firstFreePlace, type Place } from './placeDevice';

const CENTRE: Place = { x: 400, y: 300 };

/** Two devices are on top of each other when one cannot tell them apart */
const overlap = (a: Place, b: Place) => Math.abs(a.x - b.x) < 120 && Math.abs(a.y - b.y) < 90;

describe('firstFreePlace', () => {
  it('gives the place asked for when nothing is there', () => {
    expect(firstFreePlace(CENTRE, [])).toEqual(CENTRE);
    expect(firstFreePlace(CENTRE, [{ x: 2000, y: 2000 }])).toEqual(CENTRE);
  });

  it('gives the place to the right when the centre is taken, then the one below', () => {
    const second = firstFreePlace(CENTRE, [CENTRE]);
    expect(second.y).toBe(CENTRE.y);
    expect(second.x).toBeGreaterThan(CENTRE.x);

    const third = firstFreePlace(CENTRE, [CENTRE, second]);
    expect(third.x).toBe(CENTRE.x);
    expect(third.y).toBeGreaterThan(CENTRE.y);
  });

  it('a device a little off the centre takes the centre too', () => {
    const near = { x: CENTRE.x + 30, y: CENTRE.y - 20 };
    const place = firstFreePlace(CENTRE, [near]);
    expect(place).not.toEqual(CENTRE);
    expect(overlap(place, near)).toBe(false);
  });

  it('twenty devices added one after the other never land on top of each other', () => {
    const placed: Place[] = [];
    for (let i = 0; i < 20; i++) placed.push(firstFreePlace(CENTRE, placed));

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlap(placed[i], placed[j]), `${i} and ${j}`).toBe(false);
      }
    }
    // and they stay around the centre: the twentieth is within three places of it
    const last = placed[placed.length - 1];
    expect(Math.abs(last.x - CENTRE.x)).toBeLessThanOrEqual(3 * 170);
    expect(Math.abs(last.y - CENTRE.y)).toBeLessThanOrEqual(3 * 130);
  });

  it('gives the same place every time for the same drawing', () => {
    const taken = [CENTRE, { x: 570, y: 300 }, { x: 400, y: 430 }];
    const first = firstFreePlace(CENTRE, taken);
    for (let i = 0; i < 5; i++) expect(firstFreePlace(CENTRE, taken)).toEqual(first);
  });

  it('gives the centre all the same when everything around it is taken', () => {
    const crowd: Place[] = [];
    for (let dx = -13; dx <= 13; dx++) {
      for (let dy = -13; dy <= 13; dy++) crowd.push({ x: CENTRE.x + dx * 170, y: CENTRE.y + dy * 130 });
    }
    expect(firstFreePlace(CENTRE, crowd)).toEqual(CENTRE);
  });
});
