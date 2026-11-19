/**
 * What is written with the marker, in the exported image: over everything
 * else, drawn as the screen draws it (the same wobble, the same colours, in
 * the light theme and in the dark), inside the picture, and with the
 * handwriting the image carries in itself.
 */

import { describe, it, expect } from 'vitest';
import type { CanvasMark } from '@/types';
import { device } from '@/test/networkFixtures';
import { MARK_PALETTE, MARK_STROKE } from './canvasMarks';
import { drawMark } from './handDrawing';
import { layoutDrawing, renderDrawingImage, type DrawingInput, type TextMeasure } from './drawingImage';

const measure: TextMeasure = (text, font) => text.length * font.size * 0.5;

const input = (overrides: Partial<DrawingInput> = {}): DrawingInput => ({
  devices: [device({ id: 'a', label: 'A', ip: '10.0.0.1', position: { x: 0, y: 0 } })],
  connections: [],
  deviceTemplates: [],
  connectionTemplates: [],
  measureText: measure,
  ...overrides,
});

const RING: CanvasMark = {
  id: 'mark-1',
  kind: 'ellipse',
  color: 'red',
  width: 'thick',
  points: [-20, -20, 140, 120],
  seed: 5,
};
const WORDS: CanvasMark = {
  id: 'mark-2',
  kind: 'text',
  color: 'ink',
  width: 'thin',
  points: [400, 300],
  text: 'Guasto <qui> & là',
  seed: 8,
};

function parse(svg: string): Document {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
}

/** The group of the drawing, and in it the last group: the marks */
const marksGroup = (doc: Document) => {
  const drawing = doc.querySelector('svg > g') as SVGGElement;
  return drawing.lastElementChild as SVGGElement;
};

describe('the marks in the exported image', () => {
  it('are drawn last, over the devices, each path as the screen draws it', () => {
    const doc = parse(renderDrawingImage(input({ writing: [RING] }), { theme: 'light' }).svg);
    const group = marksGroup(doc);
    const paths = [...group.querySelectorAll('path')];

    expect(paths.map((path) => path.getAttribute('d'))).toEqual(drawMark(RING).paths);
    expect(paths[0].getAttribute('stroke')).toBe(MARK_PALETTE.light.red);
    expect(paths[0].getAttribute('stroke-width')).toBe(String(MARK_STROKE.thick));
    expect(paths[0].getAttribute('fill')).toBe('none');
    expect(paths[0].getAttribute('stroke-linecap')).toBe('round');
  });

  it('take the colours of the theme of the image: the ink is dark on light, light on dark', () => {
    const ink = { ...RING, color: 'ink' as const };
    for (const theme of ['light', 'dark'] as const) {
      const doc = parse(renderDrawingImage(input({ writing: [ink] }), { theme }).svg);
      expect(marksGroup(doc).querySelector('path')?.getAttribute('stroke')).toBe(MARK_PALETTE[theme].ink);
    }
  });

  it('words are written as text, safe, in the handwriting, with the canvas around their letters', () => {
    const doc = parse(renderDrawingImage(input({ writing: [WORDS] }), { theme: 'dark' }).svg);
    const text = marksGroup(doc).querySelector('text');

    expect(text?.textContent).toBe('Guasto <qui> & là');
    expect(text?.getAttribute('font-family')).toContain('Caveat');
    expect(text?.getAttribute('fill')).toBe(MARK_PALETTE.dark.ink);
    // (a halo of the canvas, so the words read over a cable)
    expect(text?.getAttribute('paint-order')).toBe('stroke');
    expect(text?.getAttribute('stroke')).toBe('#111315');
  });

  it('on a picture with no background the words have no halo', () => {
    const doc = parse(renderDrawingImage(input({ writing: [WORDS] }), { theme: 'light', transparent: true }).svg);
    expect(marksGroup(doc).querySelector('text')?.hasAttribute('stroke')).toBe(false);
  });

  it('a mark far from the devices is inside the picture: the picture grows to hold it', () => {
    const without = layoutDrawing(input()).bounds;
    const withWords = layoutDrawing(input({ writing: [WORDS] })).bounds;

    expect(withWords.x + withWords.width).toBeGreaterThan(without.x + without.width);
    // (the words start at 300 and take a line of 26 at least)
    expect(withWords.y + withWords.height).toBeGreaterThan(300 + 26);
    const ringed = layoutDrawing(input({ writing: [RING] })).bounds;
    expect(ringed.x).toBeLessThan(-20);
    expect(ringed.y).toBeLessThan(-20);
  });

  it('carries the handwriting in itself when it is given, and only when there are words', () => {
    const font = 'data:font/woff2;base64,AAAA';
    const withWords = renderDrawingImage(input({ writing: [WORDS], handFont: font }), { theme: 'light' }).svg;
    const withoutWords = renderDrawingImage(input({ writing: [RING], handFont: font }), { theme: 'light' }).svg;

    expect(withWords).toContain('@font-face');
    expect(withWords).toContain(font);
    expect(withoutWords).not.toContain('@font-face');
    parse(withWords);
  });

  it('a drawing without marks is drawn as before: no group for them', () => {
    const doc = parse(renderDrawingImage(input(), { theme: 'light' }).svg);
    const drawing = doc.querySelector('svg > g') as SVGGElement;
    // (cables, labels, the device)
    expect(drawing.children).toHaveLength(3);
  });
});
