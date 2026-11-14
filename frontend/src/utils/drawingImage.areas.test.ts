/**
 * The areas of a canvas («riquadri») in the picture of the drawing: behind
 * everything else, as large as they were drawn, in the colours of the theme
 * the picture is made in, and with the numbers the style sheet draws them
 * with on screen.
 */

import { describe, it, expect } from 'vitest';
import type { CanvasArea } from '@/types';
import { device, link } from '@/test/networkFixtures';
import styleSheet from '../index.css?raw';
import { AREA_PALETTE, AREA_TINT } from './canvasAreas';
import {
  AREA_METRICS,
  layoutDrawing,
  renderDrawingImage,
  type DrawingInput,
  type TextMeasure,
} from './drawingImage';

/** Half the font size for each letter: easy to do by hand */
const measure: TextMeasure = (text, font) => text.length * font.size * 0.5;

const CORE: CanvasArea = {
  id: 'area-1',
  label: 'Core',
  color: 'violet',
  position: { x: -40, y: -60 },
  size: { width: 300, height: 260 },
};
const EDGE: CanvasArea = {
  id: 'area-2',
  label: 'Edge',
  color: 'teal',
  position: { x: 400, y: 0 },
  size: { width: 200, height: 120 },
};

/** Two devices one above the other, joined, with what the test adds */
const input = (overrides: Partial<DrawingInput> = {}): DrawingInput => ({
  devices: [
    device({ id: 'a', label: 'A', ip: '10.0.0.1', position: { x: 0, y: 0 } }),
    device({ id: 'b', label: 'B', ip: '10.0.0.2', position: { x: 0, y: 300 } }),
  ],
  connections: [link('a', 'b', { id: 'ab', sourceHandle: 'bottom', targetHandle: 'top' })],
  deviceTemplates: [],
  connectionTemplates: [],
  measureText: measure,
  ...overrides,
});

function parse(svg: string): Document {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
}

/** The groups of the drawing itself, in the order they are painted */
const groups = (doc: Document) => [...(doc.querySelector('svg > g') as SVGGElement).children];

describe('where the areas go in the picture', () => {
  it('each is as large as it was drawn, and the picture is large enough to hold them', () => {
    const without = layoutDrawing(input());
    const scene = layoutDrawing(input({ areas: [CORE, EDGE] }));

    expect(scene.areas.map((area) => [area.id, area.box])).toEqual([
      ['area-1', { x: -40, y: -60, width: 300, height: 260 }],
      ['area-2', { x: 400, y: 0, width: 200, height: 120 }],
    ]);
    // the first area sticks out above and to the left of the devices, the second to the right
    expect(without.bounds.x).toBeGreaterThan(-40);
    expect(scene.bounds.x).toBe(-40);
    expect(scene.bounds.y).toBe(-60);
    expect(scene.bounds.x + scene.bounds.width).toBe(600);
    // devices and cables are where they were
    expect(scene.devices).toEqual(without.devices);
    expect(scene.cables).toEqual(without.cables);
  });

  it('a drawing without areas is laid out as it always was', () => {
    expect(layoutDrawing(input()).areas).toEqual([]);
    expect(layoutDrawing(input({ areas: [] })).bounds).toEqual(layoutDrawing(input()).bounds);
  });

  it('a picture can be made of areas alone', () => {
    const scene = layoutDrawing(input({ devices: [], connections: [], areas: [EDGE] }));
    expect(scene.bounds).toEqual({ x: 400, y: 0, width: 200, height: 120 });
  });

  it('the label is written in capitals, and gives way to dots where the area is too narrow for it', () => {
    const label = (text: string, width = 300) =>
      layoutDrawing(input({ areas: [{ ...CORE, label: text, size: { width, height: 100 } }] })).areas[0].label;
    expect(label('Core')).toBe('CORE');
    expect(label('  Sala macchine ')).toBe('SALA MACCHINE');
    expect(label('')).toBe('');
    // a letter is 5.5 wide and 0.77 apart here: an area 120 wide leaves 99 for
    // the label, which is fifteen letters, the dots being one of them
    expect(label('Rete degli uffici del primo piano', 120)).toBe('RETE DEGLI UFF…');
    expect(label('Rete degli uffici del primo piano', 400)).toBe('RETE DEGLI UFFICI DEL PRIMO PIANO');
  });
});

describe('the areas in the picture', () => {
  it('are painted first, in a group of their own: cables and devices are over them', () => {
    const doc = parse(renderDrawingImage(input({ areas: [CORE, EDGE] }), { theme: 'light' }).svg);
    const [areas, cables, labels, ...devices] = groups(doc);

    expect(areas.querySelectorAll(':scope > g')).toHaveLength(2);
    expect(areas.querySelectorAll('rect')).toHaveLength(2);
    expect(cables.querySelectorAll('path')).toHaveLength(1);
    expect(labels.children).toHaveLength(0);
    expect(devices).toHaveLength(2);
    expect(devices[0].querySelector('text')?.textContent).toBe('A');
  });

  it.each([['light'], ['dark']] as const)(
    'each is a light tint of its colour inside a thin border of the same colour, in the %s theme',
    (theme) => {
      const doc = parse(renderDrawingImage(input({ areas: [CORE, EDGE] }), { theme }).svg);
      const rects = [...groups(doc)[0].querySelectorAll('rect')];

      expect(rects.map((rect) => rect.getAttribute('fill'))).toEqual([
        AREA_PALETTE[theme].violet,
        AREA_PALETTE[theme].teal,
      ]);
      for (const rect of rects) {
        expect(rect.getAttribute('stroke')).toBe(rect.getAttribute('fill'));
        expect(rect.getAttribute('fill-opacity')).toBe(String(AREA_TINT));
        expect(rect.getAttribute('stroke-width')).toBe('1.5');
        expect(rect.getAttribute('rx')).toBe('2.25');
      }
      // the border is inside the box of the area, as on screen
      expect(['x', 'y', 'width', 'height'].map((name) => Number(rects[1].getAttribute(name)))).toEqual([
        400.75, 0.75, 198.5, 118.5,
      ]);
    }
  );

  it('the label is in the corner, in the colour of the area, in small capitals set apart', () => {
    const doc = parse(renderDrawingImage(input({ areas: [EDGE] }), { theme: 'dark' }).svg);
    const text = groups(doc)[0].querySelector('text')!;

    expect(text.textContent).toBe('EDGE');
    expect(text.getAttribute('fill')).toBe(AREA_PALETTE.dark.teal);
    expect(text.getAttribute('font-size')).toBe('11');
    expect(text.getAttribute('font-weight')).toBe('600');
    expect(text.getAttribute('letter-spacing')).toBe('0.77');
    // from the inside of the border: 9 across, on a line of 18 that starts 4 down
    expect(Number(text.getAttribute('x'))).toBe(400 + 1.5 + 9);
    expect(Number(text.getAttribute('y'))).toBeCloseTo(0 + 1.5 + 4 + 9 + 11 * 0.36, 2);
    expect(text.getAttribute('text-anchor')).toBeNull();
  });

  it('an area without a label has none written', () => {
    const doc = parse(renderDrawingImage(input({ areas: [{ ...EDGE, label: '' }] }), { theme: 'light' }).svg);
    expect(groups(doc)[0].querySelector('text')).toBeNull();
    expect(groups(doc)[0].querySelectorAll('rect')).toHaveLength(1);
  });

  it('what was typed as a label is written as text, whatever it holds', () => {
    const svg = renderDrawingImage(input({ areas: [{ ...CORE, label: '<b>R&D</b> "x"' }] }), { theme: 'light' }).svg;
    const doc = parse(svg);
    expect(groups(doc)[0].querySelector('text')?.textContent).toBe('<B>R&D</B> "X"');
    expect(doc.querySelector('b')).toBeNull();
  });

  it('a colour the palette does not have is drawn in the first of the palette', () => {
    const odd = { ...EDGE, color: 'fucsia' } as unknown as CanvasArea;
    const doc = parse(renderDrawingImage(input({ areas: [odd] }), { theme: 'light' }).svg);
    expect(groups(doc)[0].querySelector('rect')?.getAttribute('fill')).toBe(AREA_PALETTE.light.slate);
  });

  it('a drawing without areas gives the picture it always gave', () => {
    const options = { theme: 'light' } as const;
    const plain = renderDrawingImage(input(), options);
    expect(renderDrawingImage(input({ areas: [] }), options)).toEqual(plain);
    expect(plain.svg).not.toContain('fill-opacity="0.1"');
    // and one with areas is the same picture with them behind, when they do not stick out
    // (the two devices are 104 wide)
    const inside: CanvasArea = { ...CORE, position: { x: 10, y: 10 }, size: { width: 90, height: 300 } };
    const withArea = renderDrawingImage(input({ areas: [inside] }), options);
    expect([withArea.width, withArea.height]).toEqual([plain.width, plain.height]);
    const areaGroup = /<g><g><rect [^>]*fill-opacity="0\.1"[^>]*\/><text [^>]*>CORE<\/text><\/g><\/g>/.exec(withArea.svg)?.[0];
    expect(areaGroup).toBeDefined();
    expect(withArea.svg.replace(areaGroup as string, '')).toBe(plain.svg);
  });
});

describe('the numbers of an area repeated from the style sheet', () => {
  const css = styleSheet.replace(/\r\n/g, '\n');
  const rule = (selector: string): string => {
    const start = css.indexOf(`\n${selector} {\n`);
    if (start === -1) throw new Error(`no rule "${selector}" in index.css`);
    return css.slice(start, css.indexOf('\n}', start));
  };
  const value = (selector: string, property: string): string => {
    const found = new RegExp(`\\n\\s*${property}:\\s*([^;]+);`).exec(rule(selector));
    if (!found) throw new Error(`no "${property}" in "${selector}"`);
    return found[1].trim();
  };

  it('its border, its corners and its tint', () => {
    const a = AREA_METRICS;
    expect(value('.area-node', 'border')).toBe(`${a.border}px solid currentColor`);
    expect(value('.area-node', 'border-radius')).toBe(`${a.radius}px`);
    expect(value('.area-node', 'background-color')).toBe(
      `color-mix(in srgb, currentColor ${AREA_TINT * 100}%, transparent)`
    );
  });

  it('its label: where it starts, its line, its letters', () => {
    const a = AREA_METRICS;
    // (the text starts after the padding of the label)
    const [, sidePadding] = value('.area-label', 'padding').split(' ');
    expect(parseFloat(value('.area-label', 'left')) + parseFloat(sidePadding)).toBe(a.labelLeft);
    expect(value('.area-label', 'top')).toBe(`${a.labelTop}px`);
    expect(value('.area-label', 'line-height')).toBe(`${a.labelLine}px`);
    expect(value('.area-label', 'font-size')).toBe(`${a.labelSize}px`);
    expect(value('.area-label', 'letter-spacing')).toBe(`${a.labelSpacing}em`);
    expect(value('.area-label', 'font-weight')).toBe('600');
    expect(value('.area-label', 'text-transform')).toBe('uppercase');
    // it takes the colour of its area, and ends in dots when it does not fit
    expect(value('.area-label', 'color')).toBe('inherit');
    expect(value('.area-label', 'text-overflow')).toBe('ellipsis');
  });
});
