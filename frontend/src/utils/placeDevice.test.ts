/**
 * firstFreePlace — where a device just added goes. The point of it: the
 * place is the one asked for, or the nearest free one, and it is the same
 * every time (it used to be drawn at random around the centre).
 */

import { describe, it, expect } from 'vitest';
import { NEW_DEVICE_STEP, firstFreePlace, gridPlaces, type Place } from './placeDevice';
import { DEVICE_METRICS, deviceHeight } from './deviceGeometry';

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

describe('gridPlaces', () => {
  const START: Place = { x: 400, y: 300 };
  const columnsOf = (places: Place[]) => new Set(places.map((place) => place.x)).size;
  const rowsOf = (places: Place[]) => new Set(places.map((place) => place.y)).size;

  it('puts the devices in rows from the place asked for, as many columns as rows or one more', () => {
    const places = gridPlaces(7, START, []);
    expect(places[0]).toEqual(START);
    expect(places).toEqual([
      { x: 400, y: 300 },
      { x: 400 + NEW_DEVICE_STEP.x, y: 300 },
      { x: 400 + 2 * NEW_DEVICE_STEP.x, y: 300 },
      { x: 400, y: 300 + NEW_DEVICE_STEP.y },
      { x: 400 + NEW_DEVICE_STEP.x, y: 300 + NEW_DEVICE_STEP.y },
      { x: 400 + 2 * NEW_DEVICE_STEP.x, y: 300 + NEW_DEVICE_STEP.y },
      { x: 400, y: 300 + 2 * NEW_DEVICE_STEP.y },
    ]);
    for (const count of [1, 2, 4, 5, 9, 10, 21, 50]) {
      const grid = gridPlaces(count, START, []);
      expect(grid).toHaveLength(count);
      expect(columnsOf(grid) - rowsOf(grid)).toBeGreaterThanOrEqual(0);
      expect(columnsOf(grid) - rowsOf(grid)).toBeLessThanOrEqual(1);
    }
  });

  it('is the same every time: nothing is left to chance', () => {
    expect(gridPlaces(12, START, [])).toEqual(gridPlaces(12, START, []));
    expect(gridPlaces(12, START, []).every((place) => Number.isInteger(place.x) && Number.isInteger(place.y))).toBe(true);
    expect(gridPlaces(3, { x: 10.6, y: -4.4 }, [])[0]).toEqual({ x: 11, y: -4 });
  });

  it('spaces them for a device and its name: no two of them are on top of each other', () => {
    // the frame of a device is 104 by 94, and a name can run out of it on both sides
    expect(NEW_DEVICE_STEP.x).toBeGreaterThanOrEqual(DEVICE_METRICS.width + 40);
    expect(NEW_DEVICE_STEP.y).toBeGreaterThanOrEqual(deviceHeight(true) + 30);
    const grid = gridPlaces(30, START, []);
    for (const [index, place] of grid.entries()) {
      for (const other of grid.slice(index + 1)) expect(overlap(place, other)).toBe(false);
    }
  });

  it('skips a cell a device already is on, and goes on to the next', () => {
    const existing = [{ x: 400 + NEW_DEVICE_STEP.x + 20, y: 300 - 10 }];
    const places = gridPlaces(4, START, existing);
    expect(places).toEqual([
      { x: 400, y: 300 },
      // (the second cell is taken)
      { x: 400, y: 300 + NEW_DEVICE_STEP.y },
      { x: 400 + NEW_DEVICE_STEP.x, y: 300 + NEW_DEVICE_STEP.y },
      { x: 400, y: 300 + 2 * NEW_DEVICE_STEP.y },
    ]);
    for (const place of places) expect(overlap(place, existing[0])).toBe(false);
  });

  it('a second batch at the same place does not land on the first', () => {
    const first = gridPlaces(9, START, []);
    const second = gridPlaces(9, START, first);
    expect(second).toHaveLength(9);
    for (const place of second) {
      for (const before of first) expect(overlap(place, before)).toBe(false);
    }
  });

  it('nothing for nothing', () => {
    expect(gridPlaces(0, START, [])).toEqual([]);
  });
});
