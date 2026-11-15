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
  AREA_GAP,
  AREA_LABEL_ROOM,
  AREA_MARGIN,
  AREA_MIN_MARGIN,
  AREA_MIN_SIZE,
  AREA_PALETTE,
  AREA_TINT,
  areaAround,
  areaAt,
  areaEdgeBands,
  areaEdgeOutside,
  AREA_EDGE_BAND,
  AREA_EDGE_MIN,
  isAreaColour,
  nextAreaColour,
  nextAreaId,
  readAreas,
  tidyAreaLabel,
} from './canvasAreas';
import type { AreaBox } from './canvasAreas';
import { DEVICE_METRICS, ROLE_TAG } from './drawingImage';
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

describe('an area around devices, among what is near', () => {
  const M = AREA_MARGIN;
  const least = AREA_MIN_MARGIN;
  const GAP = AREA_GAP;
  /** A device on the canvas: its frame, 104 by 94 */
  const at = (x: number, y: number): AreaBox => ({ x, y, width: 104, height: 94 });
  /** The edges of a placed area */
  const edges = (placed: ReturnType<typeof areaAround>) => {
    if (!placed) throw new Error('no area');
    return {
      left: placed.position.x,
      top: placed.position.y,
      right: placed.position.x + placed.size.width,
      bottom: placed.position.y + placed.size.height,
    };
  };
  const boxOf = (placed: ReturnType<typeof areaAround>): AreaBox => {
    if (!placed) throw new Error('no area');
    return { ...placed.position, ...placed.size };
  };
  /** A row of three devices, 200 apart, from (0, y): its frames go from 0 to 504 across */
  const row = (y: number) => [at(0, y), at(200, y), at(400, y)];
  /** The area the same devices get with nothing near */
  const alone = (boxes: AreaBox[]) => edges(areaAround(boxes));
  const today = (boxes: AreaBox[]) => ({ ...areaAround(boxes), overlaps: true });

  it('the room follows the frame of a device: its label above, and the tag of a presentation under it', () => {
    // the label of an area takes 24 at its top (its border, 4, a line of 18)
    expect(AREA_LABEL_ROOM).toBeGreaterThanOrEqual(1.5 + 4 + 18);
    expect(least.top).toBeGreaterThanOrEqual(AREA_LABEL_ROOM);
    // a tag hangs above the top of a device: with the whole room it is under the label
    expect(M.top + ROLE_TAG.top).toBeGreaterThanOrEqual(AREA_LABEL_ROOM);
    // the frame of a device has room of its own around the drawing: the sides need less than it
    expect(M.side).toBeLessThan((DEVICE_METRICS.width - DEVICE_METRICS.icon) / 2);
    for (const side of ['side', 'top', 'bottom'] as const) {
      expect(least[side]).toBeGreaterThan(0);
      expect(least[side]).toBeLessThan(M[side]);
    }
  });

  it('with nothing near it, it has its whole room, and overlaps nothing', () => {
    const placed = areaAround(row(0), { areas: [], devices: [] });
    expect(placed).toEqual({ ...areaAround(row(0)), overlaps: false });
    expect(edges(placed)).toEqual({ left: -M.side, top: -M.top, right: 504 + M.side, bottom: 94 + M.bottom });
  });

  it('two rows close to each other: the area of the lower one gives way above, and leaves a gap', () => {
    const upper = areaAround(row(0));
    const y = 94 + M.bottom + GAP + least.top + 2;
    // with its whole room the area of the lower row would cover the edge of the other
    expect(alone(row(y)).top).toBeLessThan(edges(upper).bottom);

    const placed = areaAround(row(y), { areas: [boxOf(upper)] });

    expect(placed?.overlaps).toBe(false);
    expect(edges(placed).top).toBe(edges(upper).bottom + GAP);
    // only that side gives way, and its label still fits
    expect({ ...edges(placed), top: 0 }).toEqual({ ...alone(row(y)), top: 0 });
    expect(y - edges(placed).top).toBeGreaterThanOrEqual(least.top);
  });

  it('the other way round: the area of the upper row gives way under it', () => {
    const y = 94 + least.bottom + GAP + M.top + 2;
    const lower = areaAround(row(y));
    expect(alone(row(0)).bottom).toBeGreaterThan(edges(lower).top);

    const placed = areaAround(row(0), { areas: [boxOf(lower)] });

    expect(placed?.overlaps).toBe(false);
    expect(edges(placed).bottom).toBe(edges(lower).top - GAP);
    expect({ ...edges(placed), bottom: 0 }).toEqual({ ...alone(row(0)), bottom: 0 });
  });

  it('a device that is not to be in it: the side towards it gives way, and the area does not cover it', () => {
    const outside = at(504 + least.side + GAP + 2, 0);
    expect(alone(row(0)).right).toBeGreaterThan(outside.x);

    const placed = areaAround(row(0), { devices: [outside] });

    expect(placed?.overlaps).toBe(false);
    expect(edges(placed).right).toBe(outside.x - GAP);
    expect({ ...edges(placed), right: 0 }).toEqual({ ...alone(row(0)), right: 0 });
  });

  it('what is near at a corner: one side gives way, the one that gives up less', () => {
    // above and to the right: giving way on the right would cost 8, above 2
    const corner = { x: 504 + GAP + M.side - 8, y: -400, width: 104, height: 400 - (M.top + GAP - 2) };
    const cornerBottom = corner.y + corner.height;
    const placed = areaAround(row(0), { devices: [corner] });

    expect(placed?.overlaps).toBe(false);
    expect(edges(placed).top).toBe(cornerBottom + GAP);
    expect(-edges(placed).top).toBe(M.top - 2);
    expect(edges(placed).right).toBe(alone(row(0)).right);

    // the same, with no room to give above: it gives way on the right
    const lower = { ...corner, height: corner.height + 20 };
    const sideways = areaAround(row(0), { devices: [lower] });
    expect(sideways?.overlaps).toBe(false);
    expect(edges(sideways).right).toBe(corner.x - GAP);
    expect(edges(sideways).top).toBe(alone(row(0)).top);
  });

  it('what is far enough changes nothing', () => {
    const far = at(504 + M.side + GAP, 0);
    const under = { x: 0, y: 94 + M.bottom + GAP, width: 500, height: 100 };
    expect(areaAround(row(0), { devices: [far], areas: [under] })).toEqual({
      ...areaAround(row(0)),
      overlaps: false,
    });
  });

  it('inside another area: it stays inside it, clear of its sides and under its label', () => {
    const big = { x: -12, y: -58, width: 504 + 24, height: 58 + 94 + 12 };
    const placed = areaAround(row(0), { areas: [big] });

    expect(placed?.overlaps).toBe(false);
    expect(edges(placed)).toEqual({
      left: -12 + GAP,
      top: -58 + AREA_LABEL_ROOM + GAP,
      right: 516 - GAP,
      bottom: 106 - GAP,
    });
  });

  it('inside another area, beside its label: above it needs only the gap', () => {
    const big = { x: -12, y: -58, width: 528, height: 164 };
    // the last device of the row alone: its area starts at 384, where the label of the big one is not
    const beside = areaAround([at(400, 0)], { areas: [{ ...big, labelReach: 60 }] });
    expect(beside?.overlaps).toBe(false);
    expect(edges(beside).top).toBe(-M.top);
    expect(edges(beside).left).toBe(400 - M.side);
    // where the label reaches as far, it goes under it
    const under = areaAround([at(400, 0)], { areas: [{ ...big, labelReach: 400 }] });
    expect(edges(under).top).toBe(-58 + AREA_LABEL_ROOM + GAP);
    // and a label of which nothing is known is taken to reach across the whole area
    expect(areaAround([at(400, 0)], { areas: [big] })).toEqual(under);
  });

  it('around another area: that is nesting, and it keeps its whole room', () => {
    const small = { x: 190, y: -20, width: 124, height: 128 };
    expect(areaAround(row(0), { areas: [small] })).toEqual({ ...areaAround(row(0)), overlaps: false });
    // (a device inside the small one is in it, not near the new one)
    expect(areaAround(row(0), { areas: [small], devices: [at(200, 0)] })?.overlaps).toBe(false);
  });

  it('where even the least room cannot keep it clear, it is made with its whole room, and says so', () => {
    // a device not to be in it, among the ones that are
    expect(areaAround(row(0), { devices: [at(300, 0)] })).toEqual(today(row(0)));
    // another area across the devices
    expect(areaAround(row(0), { areas: [{ x: 150, y: -50, width: 200, height: 300 }] })).toEqual(today(row(0)));
    // something closer than the least room and the gap
    expect(areaAround(row(0), { devices: [at(504 + GAP, 0)] })).toEqual(today(row(0)));
    // an area whose bottom is too close above for the label
    expect(areaAround(row(0), { areas: [{ x: 0, y: -60, width: 504, height: 40 }] })).toEqual(today(row(0)));
    // inside another area, too close under its label
    const tight = { x: -12, y: -(AREA_LABEL_ROOM + GAP + least.top - 4), width: 528, height: 200 };
    expect(areaAround(row(0), { areas: [tight] })).toEqual(today(row(0)));
  });

  it('around another area, it does not give way across it', () => {
    const small = { x: 400, y: -30, width: 116, height: 120 };
    // a device far below changes nothing
    expect(areaAround(row(0), { areas: [small], devices: [at(516, 200)] })?.overlaps).toBe(false);
    // one on the right would make it give way across the small one: it does not
    expect(areaAround(row(0), { areas: [small], devices: [at(516, 0)] })).toEqual(today(row(0)));
  });

  it('what cannot be read is left out', () => {
    const bad = { x: Number.NaN, y: 0, width: 10, height: 10 };
    expect(areaAround(row(0), { areas: [bad], devices: [bad] })).toEqual({
      ...areaAround(row(0)),
      overlaps: false,
    });
  });
});

describe('the band that takes an area by its border', () => {
  const device = (x: number, y: number) => ({ x, y, width: 104, height: 94 });
  const AREA = { x: 0, y: 0, width: 400, height: 300 };

  it('is never wider than a third of the room between that side and its devices, nor narrower than the least', () => {
    // the devices 16 from the sides, 40 from the top: the room of an area drawn around them
    const bands = areaEdgeBands(AREA, [device(16, 40), device(280, 190)]);
    expect(bands).toEqual({ left: 5.3, top: 9, right: 5.3, bottom: 5.3 });
    // an area that gave way to 10 on the left, to its least (4) under
    const tight = areaEdgeBands(AREA, [device(10, 40), device(200, 202)]);
    expect(tight.left).toBeCloseTo(10 / 3, 1);
    expect(tight.bottom).toBe(AREA_EDGE_MIN);
    for (const [side, room] of [['left', 10], ['top', 40], ['right', 96], ['bottom', 4]] as const) {
      expect(tight[side], side).toBeLessThanOrEqual(Math.max(room / 3, AREA_EDGE_MIN));
      expect(tight[side], side).toBeGreaterThanOrEqual(AREA_EDGE_MIN);
      expect(tight[side], side).toBeLessThanOrEqual(AREA_EDGE_BAND.width);
    }
  });

  it('without a device inside, or with one that is only partly in, a side keeps the whole band', () => {
    expect(areaEdgeBands(AREA, [])).toEqual({ left: 9, top: 9, right: 9, bottom: 9 });
    // (one across the left side is no device of the area)
    expect(areaEdgeBands(AREA, [device(-50, 100)])).toEqual({ left: 9, top: 9, right: 9, bottom: 9 });
    expect(areaEdgeBands(AREA, [{ x: Number.NaN, y: 0, width: 10, height: 10 }]).left).toBe(9);
  });

  it('lies across the line as the whole band does: more of it outside than inside', () => {
    expect(areaEdgeOutside(AREA_EDGE_BAND.width)).toBe(AREA_EDGE_BAND.outside);
    expect(areaEdgeOutside(3)).toBeCloseTo(1.7, 5);
    // the whole band is the one of the style sheet
    expect(styleSheet).toMatch(/\.area-edge-top,\s*\.area-edge-bottom \{[^}]*height: 9px;/);
    expect(styleSheet).toMatch(/\.area-edge-top \{\s*top: -5px;/);
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
      overlaps: false,
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
