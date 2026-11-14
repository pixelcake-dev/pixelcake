/**
 * The areas of a canvas («riquadri»), as far as they are arithmetic: how one
 * is named, numbered, coloured and placed, how a list of them is read from
 * outside, and the palette, which the style sheet, the exported picture and
 * the small map must all agree on.
 */

import { describe, it, expect } from 'vitest';
import styleSheet from '../index.css?raw';
import canvasSource from '../components/Canvas/NetworkCanvas.tsx?raw';
import { AREA_COLOURS } from '@/types';
import type { CanvasArea } from '@/types';
import {
  areaColourNames,
  AREA_DEFAULT_SIZE,
  AREA_LABEL_MAX_LENGTH,
  AREA_MARGIN,
  AREA_MIN_SIZE,
  AREA_PALETTE,
  AREA_TINT,
  areaAround,
  areaAt,
  isAreaColour,
  nextAreaColour,
  nextAreaId,
  readAreas,
  tidyAreaLabel,
} from './canvasAreas';
import { MINI_MAP_AREA_ALPHA, MINI_MAP_COLOURS, miniMapAreaColour } from './miniMapColour';

const area = (overrides: Partial<CanvasArea> = {}): CanvasArea => ({
  id: 'area-1',
  label: 'Core',
  color: 'slate',
  position: { x: 100, y: 50 },
  size: { width: 300, height: 200 },
  ...overrides,
});

describe('the label of an area', () => {
  it('is one line, with nothing around it', () => {
    expect(tidyAreaLabel('  Core  ')).toBe('Core');
    expect(tidyAreaLabel('Sala\n  macchine\t2')).toBe('Sala macchine 2');
    expect(tidyAreaLabel('   ')).toBe('');
  });

  it('is a word or two: no longer than the limit', () => {
    expect(AREA_LABEL_MAX_LENGTH).toBe(40);
    const long = 'Rete degli uffici del primo piano e del secondo piano';
    expect(tidyAreaLabel(long)).toBe('Rete degli uffici del primo piano e del');
    expect(tidyAreaLabel(long).length).toBeLessThanOrEqual(40);
  });
});

describe('the id of a new area', () => {
  it('is area-N, one above the highest in use', () => {
    expect(nextAreaId([])).toBe('area-1');
    expect(nextAreaId([{ id: 'area-1' }, { id: 'area-7' }, { id: 'area-3' }])).toBe('area-8');
    // ids of another shape do not count
    expect(nextAreaId([{ id: 'zona' }, { id: 'area-2b' }, { id: 'dev-9' }])).toBe('area-1');
  });
});

describe('the colour of a new area', () => {
  it('is the first of the palette no area of the canvas has', () => {
    expect(nextAreaColour([])).toBe('slate');
    expect(nextAreaColour([{ color: 'slate' }])).toBe('green');
    expect(nextAreaColour([{ color: 'green' }, { color: 'slate' }, { color: 'red' }])).toBe('amber');
  });

  it('once every colour is taken, the one used least', () => {
    const all = AREA_COLOURS.map((color) => ({ color }));
    expect(nextAreaColour(all)).toBe('slate');
    expect(nextAreaColour([...all, { color: 'slate' }])).toBe('green');
    expect(nextAreaColour([...all, { color: 'slate' }, { color: 'green' }, { color: 'amber' }])).toBe('red');
  });
});

describe('where an area goes', () => {
  it('added by itself: its default size, its middle where it is asked', () => {
    expect(areaAt({ x: 500, y: 400 })).toEqual({
      position: { x: 500 - AREA_DEFAULT_SIZE.width / 2, y: 400 - AREA_DEFAULT_SIZE.height / 2 },
      size: { width: 360, height: 240 },
    });
    // whole numbers, wherever the view is
    expect(areaAt({ x: 10.4, y: -20.6 }).position).toEqual({ x: -170, y: -141 });
  });

  it('around devices: what holds them all, with room on every side and more above, for the label', () => {
    const boxes = [
      { x: 100, y: 200, width: 120, height: 100 },
      { x: 400, y: 150, width: 140, height: 117 },
    ];
    expect(areaAround(boxes)).toEqual({
      position: { x: 100 - AREA_MARGIN.side, y: 150 - AREA_MARGIN.top },
      size: {
        width: 540 - 100 + 2 * AREA_MARGIN.side,
        height: 300 - 150 + AREA_MARGIN.top + AREA_MARGIN.bottom,
      },
    });
    expect(AREA_MARGIN.top).toBeGreaterThan(AREA_MARGIN.bottom);
  });

  it('around one small thing it is still as large as an area can be made', () => {
    const placed = areaAround([{ x: 0, y: 0, width: 10, height: 4 }]);
    expect(placed?.size).toEqual({ width: AREA_MIN_SIZE.width, height: AREA_MIN_SIZE.height });
  });

  it('around nothing there is no area', () => {
    expect(areaAround([])).toBeNull();
    expect(areaAround([{ x: Number.NaN, y: 0, width: 10, height: 10 }])).toBeNull();
  });
});

describe('a list of areas read from outside', () => {
  it('a list in good order comes back as it is', () => {
    const list = [area(), area({ id: 'area-2', label: '', color: 'teal', position: { x: -40.5, y: 0 } })];
    expect(readAreas(list)).toEqual({ areas: list, dropped: 0, repaired: 0 });
    expect(readAreas([])).toEqual({ areas: [], dropped: 0, repaired: 0 });
  });

  it('no list at all is no area, and nothing to say', () => {
    expect(readAreas(undefined)).toEqual({ areas: [], dropped: 0, repaired: 0 });
  });

  it.each([['Core'], [7], [null], [{ 0: area() }]])('what is not a list (%j) is no area, and counts as one left out', (value) => {
    expect(readAreas(value)).toEqual({ areas: [], dropped: 1, repaired: 0 });
  });

  it('an entry without a place or a size cannot be drawn: it is left out, the others are kept', () => {
    const good = area({ id: 'area-9' });
    const read = readAreas([
      'Core',
      null,
      { id: 'area-1', label: 'A' },
      area({ position: { x: 0 } as CanvasArea['position'] }),
      area({ position: { x: Number.NaN, y: 0 } }),
      area({ size: { width: 0, height: 100 } }),
      area({ size: { width: 100, height: -5 } }),
      area({ size: { width: '300', height: 200 } as unknown as CanvasArea['size'] }),
      good,
    ]);
    expect(read.areas).toEqual([good]);
    expect(read.dropped).toBe(8);
    expect(read.repaired).toBe(0);
  });

  it('the rest of an entry is completed: a colour of the palette, a tidy label, the smallest size at least', () => {
    const read = readAreas([
      { ...area(), color: 'fucsia' },
      { ...area({ id: 'area-2' }), label: 7 },
      area({ id: 'area-3', size: { width: 20, height: 30 } }),
      area({ id: 'area-4', label: '  Sala\nmacchine ' }),
    ]);
    expect(read.areas.map((a) => [a.id, a.label, a.color, a.size])).toEqual([
      ['area-1', 'Core', 'slate', { width: 300, height: 200 }],
      ['area-2', '', 'slate', { width: 300, height: 200 }],
      ['area-3', 'Core', 'slate', { width: 120, height: 80 }],
      ['area-4', 'Sala macchine', 'slate', { width: 300, height: 200 }],
    ]);
    // (a label only tidied is not a repair worth a word)
    expect(read).toMatchObject({ dropped: 0, repaired: 3 });
  });

  it('every area gets an id of its own: one missing or taken twice is given anew, after those of the file', () => {
    const read = readAreas([
      area({ id: 'area-2', label: 'A' }),
      area({ id: 'area-2', label: 'B' }),
      { ...area({ label: 'C' }), id: undefined },
      { ...area({ label: 'D' }), id: '  ' },
      area({ id: 'area-5', label: 'E' }),
    ]);
    expect(read.areas.map((a) => [a.label, a.id])).toEqual([
      ['A', 'area-2'],
      ['B', 'area-6'],
      ['C', 'area-7'],
      ['D', 'area-8'],
      ['E', 'area-5'],
    ]);
    expect(new Set(read.areas.map((a) => a.id)).size).toBe(5);
    expect(read.repaired).toBe(3);
  });

  it('what a file adds to an area is not kept', () => {
    const read = readAreas([{ ...area(), devices: ['dev-1'], opacity: 0.5 }]);
    expect(read.areas).toEqual([area()]);
  });
});

describe('the palette', () => {
  const sheet = styleSheet.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
  /** The declarations of the first rule with exactly this selector */
  const rule = (selector: string): string => {
    const start = sheet.indexOf(`\n${selector} {\n`);
    if (start === -1) throw new Error(`no rule "${selector}" in index.css`);
    return sheet.slice(start, sheet.indexOf('\n}', start));
  };
  const value = (selector: string, property: string): string => {
    const found = new RegExp(`\\n\\s*${property}:\\s*([^;]+);`).exec(rule(selector));
    if (!found) throw new Error(`no "${property}" in "${selector}"`);
    return found[1].trim();
  };

  it('is six calm colours, each with its name', () => {
    expect([...AREA_COLOURS]).toEqual(['slate', 'green', 'amber', 'red', 'violet', 'teal']);
    expect(Object.keys(areaColourNames())).toEqual([...AREA_COLOURS]);
    expect(Object.values(areaColourNames())).toEqual(['Ardesia', 'Verde', 'Ocra', 'Rosso', 'Viola', 'Petrolio']);
    for (const colour of AREA_COLOURS) expect(isAreaColour(colour)).toBe(true);
    for (const other of ['orange', 'Slate', '', 7, null]) expect(isAreaColour(other)).toBe(false);
  });

  it('has a value in the light theme and one in the dark, the same the style sheet has', () => {
    for (const colour of AREA_COLOURS) {
      expect(value(':root', `--area-${colour}`).toLowerCase(), `light ${colour}`).toBe(AREA_PALETTE.light[colour]);
      expect(value('.dark', `--area-${colour}`).toLowerCase(), `dark ${colour}`).toBe(AREA_PALETTE.dark[colour]);
      expect(AREA_PALETTE.light[colour]).not.toBe(AREA_PALETTE.dark[colour]);
      // and the class of an area takes it from the theme by name
      expect(value(`.area-${colour}`, 'color')).toBe(`var(--area-${colour})`);
    }
    expect(new Set(Object.values(AREA_PALETTE.light)).size).toBe(6);
    expect(new Set(Object.values(AREA_PALETTE.dark)).size).toBe(6);
  });

  it('none of its colours is the accent: the orange stays the mark of a state', () => {
    for (const colour of [...Object.values(AREA_PALETTE.light), ...Object.values(AREA_PALETTE.dark)]) {
      expect(colour).not.toBe('#f07d2a');
      expect(colour).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('an area is a light tint of its colour inside a thin border of the same colour', () => {
    expect(value('.area-node', 'border')).toBe('1.5px solid currentColor');
    expect(value('.area-node', 'background-color')).toBe(
      `color-mix(in srgb, currentColor ${AREA_TINT * 100}%, transparent)`
    );
    expect(AREA_TINT).toBe(0.1);
    // flat: no shadow, no gradient
    expect(rule('.area-node')).not.toMatch(/shadow|gradient/);
  });

  it('the label can be read on that tint, in both themes', () => {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const luminance = (c: number[]) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: number[], b: number[]) => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (high + 0.05) / (low + 0.05);
    };
    for (const [theme, selector] of [['light', ':root'], ['dark', '.dark']] as const) {
      const canvas = rgb(value(selector, '--bg-canvas'));
      for (const colour of AREA_COLOURS) {
        const ink = rgb(AREA_PALETTE[theme][colour]);
        const tint = canvas.map((v, i) => Math.round(v * (1 - AREA_TINT) + ink[i] * AREA_TINT));
        // what is asked of small text
        expect(contrast(ink, tint), `${theme} ${colour}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('on the small map an area is a faint rectangle of its colour, which is no colour of a device', () => {
    for (const colour of AREA_COLOURS) {
      expect(miniMapAreaColour(colour)).toBe(`${AREA_PALETTE.light[colour]}${MINI_MAP_AREA_ALPHA}`);
      expect(miniMapAreaColour(colour)).toMatch(/^#[0-9a-f]{8}$/);
      expect(Object.values(MINI_MAP_COLOURS)).not.toContain(miniMapAreaColour(colour));
    }
    // faint: less than a third of its colour
    expect(parseInt(MINI_MAP_AREA_ALPHA, 16) / 255).toBeLessThan(0.33);
    expect(miniMapAreaColour(undefined)).toBe(miniMapAreaColour('slate'));
    // and the canvas hands that colour to the map for an area, the colour of its type for a device
    expect(canvasSource).toMatch(/node\.type === AREA_NODE\s*\? miniMapAreaColour\(/);
  });

  it('the inside of an area lets the pointer through; its label, its border and its handles take it', () => {
    // (React Flow writes `pointer-events` on a node itself: only `!important` is over that)
    expect(value('.react-flow .react-flow__node-area', 'pointer-events')).toBe('none !important');
    expect(rule('.area-node')).not.toMatch(/pointer-events/);
    expect(value('button.area-label', 'pointer-events')).toBe('all');
    expect(value('.area-edge', 'pointer-events')).toBe('all');
    expect(value('.area-label-input', 'pointer-events')).toBe('all');
    expect(value('.area-node .react-flow__resize-control.area-resize-handle', 'pointer-events')).toBe('all');
    // while presenting nothing of it does
    const readonly = sheet.slice(sheet.indexOf('\n.area-node.readonly,\n.area-node.readonly * {'));
    expect(readonly.slice(0, readonly.indexOf('}'))).toMatch(/pointer-events:\s*none;/);
  });

  it('selected, an area is marked with the accent: around it, and on its handles', () => {
    expect(value('.area-node.selected', 'outline')).toBe('1.5px solid var(--accent-color)');
    expect(value('.area-node .react-flow__resize-control.area-resize-handle', 'border')).toBe(
      '1.5px solid var(--accent-color)'
    );
  });
});
