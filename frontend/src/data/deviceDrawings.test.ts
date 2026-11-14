/**
 * The drawings of the devices as data are the files of
 * assets/device-drawings, shape by shape: nothing added, nothing left out,
 * nothing changed. When this fails after a file was touched, run
 * `pnpm drawings:build`.
 *
 * The files are read again here, on their own, not with the script that
 * wrote the data.
 */

import { describe, it, expect } from 'vitest';
import {
  DEVICE_DRAWINGS,
  DEVICE_DRAWING_CUT,
  DEVICE_DRAWING_IDS,
  DEVICE_DRAWING_SIZE,
} from './deviceDrawings';

const files = import.meta.glob<string>('/src/assets/device-drawings/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const idOf = (path: string) => path.replace(/^.*\//, '').replace(/\.svg$/, '');
const fileOf = (id: string) => Object.entries(files).find(([path]) => idOf(path) === id)?.[1] ?? '';

/** The colours written in the files: the lower layer, and what is drawn on the layers */
const LOWER = '#22313B';
const GROUND = '#FFFFFF';

interface Shape {
  tag: string;
  /** Its attributes but the one that colours it, in the order they are written */
  geometry: string;
  /** 'l' of the device itself, 'g' drawn on it */
  role: string;
}

function shapesOf(markup: string, roleOf: (attributes: string) => string): Shape[] {
  return [...markup.matchAll(/<(\w+)\b([^>]*?)\/>/g)].map((found) => ({
    tag: found[1],
    geometry: found[2]
      .replace(/\s*\b(?:fill|class)="[^"]*"/, '')
      .trim()
      .replace(/\s+/g, ' '),
    role: roleOf(found[2]),
  }));
}

/** The shapes of a file: what comes after its definitions, before its upper layer */
function shapesOfFile(text: string): Shape[] {
  const body = /<\/defs>(.*?)<g class="pc-stato"/s.exec(text)?.[1] ?? '';
  return shapesOf(body, (attributes) => {
    const fill = /\bfill="([^"]*)"/.exec(attributes)?.[1];
    return fill === LOWER ? 'l' : fill === GROUND ? 'g' : `? ${fill}`;
  });
}

const shapesOfData = (shapes: string): Shape[] =>
  shapesOf(shapes, (attributes) => /\bclass="([^"]*)"/.exec(attributes)?.[1] ?? '?');

describe('the drawings of the devices, as data', () => {
  it('are the 24 files, one drawing each, by the name of its file', () => {
    expect(Object.keys(files)).toHaveLength(24);
    expect(DEVICE_DRAWING_IDS).toEqual(Object.keys(files).map(idOf).sort());
    expect(Object.keys(DEVICE_DRAWINGS)).toEqual(DEVICE_DRAWING_IDS);
  });

  it.each(DEVICE_DRAWING_IDS)('%s: every shape of the file, in its order, with what it is', (id) => {
    const inFile = shapesOfFile(fileOf(id));
    expect(inFile.length).toBeGreaterThan(0);
    expect(inFile.map((shape) => shape.role).filter((role) => role.startsWith('?'))).toEqual([]);
    expect(shapesOfData(DEVICE_DRAWINGS[id].shapes)).toEqual(inFile);
  });

  it.each(DEVICE_DRAWING_IDS)('%s: the upper layer ends where the file ends it, and the cut is across that line', (id) => {
    const text = fileOf(id);
    const layer = Number(/<clipPath id="[^"]+"><rect width="128" height="([\d.]+)"\/>/.exec(text)?.[1]);
    expect(DEVICE_DRAWINGS[id].layer).toBe(layer);
    const cut = /<rect y="([\d.]+)" width="128" height="([\d.]+)" fill="#FFFFFF" mask=/.exec(text);
    expect(Number(cut?.[1])).toBe(layer - DEVICE_DRAWING_CUT / 2);
    expect(Number(cut?.[2])).toBe(DEVICE_DRAWING_CUT);
  });

  it('are made in a square of 128, and none is drawn outside it', () => {
    expect(DEVICE_DRAWING_SIZE).toBe(128);
    for (const id of DEVICE_DRAWING_IDS) {
      expect(fileOf(id), id).toContain('viewBox="0 0 128 128"');
      const [left, top, right, bottom] = DEVICE_DRAWINGS[id].ink;
      expect(left, id).toBeGreaterThanOrEqual(0);
      expect(top, id).toBeGreaterThanOrEqual(0);
      expect(right, id).toBeLessThanOrEqual(128);
      expect(bottom, id).toBeLessThanOrEqual(128);
      expect(right - left, id).toBeGreaterThan(40);
      expect(bottom - top, id).toBeGreaterThan(30);
      // the upper layer is a part of the drawing, not all of it and not nothing
      expect(DEVICE_DRAWINGS[id].layer, id).toBeGreaterThan(top);
      expect(DEVICE_DRAWINGS[id].layer, id).toBeLessThan(bottom);
    }
  });

  it('the box of what is drawn is the one of its shapes: a circle, a rectangle, an arc', () => {
    // a circle of radius 50 in (66, 66)
    expect(DEVICE_DRAWINGS.router.ink).toEqual([16, 16, 116, 116]);
    // a screen, its neck and its foot
    expect(DEVICE_DRAWINGS.pc.ink).toEqual([10, 20, 118, 114]);
    // one tall rectangle
    expect(DEVICE_DRAWINGS.server.ink).toEqual([34, 10, 94, 120]);
    // three circles and a base: the top of the largest circle is the top of the cloud
    expect(DEVICE_DRAWINGS.cloud.ink).toEqual([18, 30, 112, 102]);
    // two ellipses (cylinder ends) of 44 by 14 around (64, 26) and (64, 106)
    expect(DEVICE_DRAWINGS.database.ink).toEqual([20, 12, 108, 120]);
  });

  it('carry no colour, no name and nothing to refer to: the app gives the colours, and names the device itself', () => {
    for (const id of DEVICE_DRAWING_IDS) {
      const { shapes } = DEVICE_DRAWINGS[id];
      expect(shapes, id).not.toMatch(/\bfill="|#[0-9a-f]{3,6}\b|var\(|\bstyle=/i);
      expect(shapes, id).not.toMatch(/<title|\bid="|url\(|<defs|<mask|<clipPath|<script|href=/i);
      expect(shapes, id).toMatch(/^(<(rect|circle|ellipse|path) class="[lg]" [^<>]*\/>)+$/);
    }
  });
});
