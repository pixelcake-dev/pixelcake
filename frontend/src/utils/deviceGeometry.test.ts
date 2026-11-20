/**
 * A device on the canvas, in numbers: that they are the ones the style sheet
 * lays a device out with, and that a cable ends next to what is drawn, on
 * each side, for every drawing.
 */

import { describe, it, expect } from 'vitest';
import { DEVICE_DRAWINGS, DEVICE_DRAWING_IDS } from '@/data/deviceDrawings';
import styleSheet from '../index.css?raw';
import { DEVICE_METRICS, addressLines, cableEnd, cableRun, deviceHeight, drawingPlace, type Side } from './deviceGeometry';

const css = styleSheet.replace(/\r\n/g, '\n');
/** The declarations of the first rule with exactly this selector */
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

const m = DEVICE_METRICS;
const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];

describe('the frame of a device', () => {
  it('is 104 wide for every device, and as high as what it shows', () => {
    // frame 2, room 6, drawing 48, 3 to the name, name 16, room 3, frame 2
    expect(deviceHeight(false)).toBe(80);
    // and a line of 14 for the address
    expect(deviceHeight(true)).toBe(94);
    // and one more for the words said of the address (in conflict), under it
    expect(deviceHeight(true, 2)).toBe(108);
    expect(deviceHeight(false, 2)).toBe(80);
    expect(m.width).toBe(104);
  });

  it('breaks the lines under the name where the text says so, never by the width of the frame', () => {
    expect(addressLines('')).toEqual([]);
    expect(addressLines('192.168.100.100')).toEqual(['192.168.100.100']);
    expect(addressLines('192.168.100.100\nin conflict')).toEqual(['192.168.100.100', 'in conflict']);
    // (an address leased by DHCP stays on one line: the layouts make room for it)
    expect(addressLines('192.168.100.100 · DHCP')).toHaveLength(1);
  });

  it('has its drawing in the middle, under the room at the top', () => {
    expect(drawingPlace()).toEqual({ x: 28, y: 8 });
    expect(drawingPlace().x * 2 + m.icon).toBe(m.width);
  });

  it('is laid out by the style sheet with the same numbers', () => {
    expect(value('.network-device', 'width')).toBe(`${m.width}px`);
    expect(value('.network-device', 'border')).toBe(`${m.border}px solid transparent`);
    expect(value('.network-device', 'border-radius')).toBe(`${m.radius}px`);
    expect(value('.network-device', 'padding')).toBe(
      `${m.paddingTop}px ${m.paddingX}px ${m.paddingBottom}px`
    );
    // no box: nothing behind the drawing, nothing around it at rest, no shadow
    expect(value('.network-device', 'background-color')).toBe('transparent');
    expect(value('.network-device', 'box-shadow')).toBe('none');

    // the name, then the address, each on a line of its own height
    expect(value('.device-name', 'margin-top')).toBe(`${m.iconGap}px`);
    expect(value('.device-name', 'font-size')).toBe(`${m.nameSize}px`);
    expect(value('.device-name', 'line-height')).toBe(`${m.nameLine}px`);
    expect(value('.device-name', 'font-weight')).toBe('600');
    expect(value('.device-ip', 'font-size')).toBe(`${m.ipSize}px`);
    expect(value('.device-ip', 'line-height')).toBe(`${m.ipLine}px`);
    expect(value('.device-ip', 'font-family')).toContain('monospace');
    // each is one line with the canvas behind it, a little wider than its letters
    const both = '.device-name,\n.device-ip';
    expect(value(both, 'padding')).toBe(`0 ${m.textPad}px`);
    expect(value(both, 'background-color')).toBe('var(--bg-canvas)');
    expect(value(both, 'white-space')).toBe('nowrap');
    // the words said of an address are on a line of their own: the text has the break, the line keeps it
    expect(value('.network-device .device-ip', 'white-space')).toBe('pre');
  });

  it('tells the style sheet how high it is, for what is placed along its sides', () => {
    expect(value('.network-device', '--frame-height')).toBe(`${deviceHeight(false)}px`);
    expect(value('.network-device.device-with-address', '--frame-height')).toBe(
      `${deviceHeight(true)}px`
    );
    expect(value('.network-device.device-address-lines', '--frame-height')).toBe(
      `${deviceHeight(true, 2)}px`
    );
  });
});

describe('where a cable ends on a device', () => {
  it('a computer: 3 above what is drawn, 3 at its left, 3 at its right, and under its address', () => {
    // a computer is drawn from 10 to 118 across and from 20 down, of 128: at 48 that is 3.75, 44.25, 7.5
    expect(cableEnd('pc', 'top', 94)).toEqual({ x: 52, y: 8 + 7.5 - 3 });
    expect(cableEnd('pc', 'left', 94)).toEqual({ x: 28 + 3.75 - 3, y: 32 });
    expect(cableEnd('pc', 'right', 94)).toEqual({ x: 28 + 44.25 + 3, y: 32 });
    expect(cableEnd('pc', 'bottom', 94)).toEqual({ x: 52, y: 94 });
    // (a device with no address is lower: the cable ends under its name)
    expect(cableEnd('pc', 'bottom', 80)).toEqual({ x: 52, y: 80 });
  });

  it('each drawing has its own shape: a server is reached further in than a switch, a switch lower', () => {
    expect(cableEnd('server', 'left', 94).x).toBeGreaterThan(cableEnd('switch', 'left', 94).x + 10);
    expect(cableEnd('server', 'right', 94).x).toBeLessThan(cableEnd('switch', 'right', 94).x - 10);
    expect(cableEnd('switch', 'top', 94).y).toBeGreaterThan(cableEnd('server', 'top', 94).y + 10);
  });

  it.each(DEVICE_DRAWING_IDS)('%s: on each side, a little off what is drawn and inside the frame', (id) => {
    const [left, top, right] = DEVICE_DRAWINGS[id].ink;
    const scale = m.icon / 128;
    const place = drawingPlace();
    const end = (side: Side) => cableEnd(id, side, 94);

    // in the middle of the frame above and below, at mid height of the drawing at the sides
    expect(end('top').x).toBe(m.width / 2);
    expect(end('bottom').x).toBe(m.width / 2);
    expect(end('left').y).toBe(place.y + m.icon / 2);
    expect(end('right').y).toBe(place.y + m.icon / 2);

    // 3 off what is drawn
    expect(end('top').y).toBeCloseTo(place.y + top * scale - m.cableGap, 2);
    expect(end('left').x).toBeCloseTo(place.x + left * scale - m.cableGap, 2);
    expect(end('right').x).toBeCloseTo(place.x + right * scale + m.cableGap, 2);
    expect(end('bottom').y).toBe(94);

    // never outside the frame, where nothing could take the cable
    for (const side of SIDES) {
      expect(end(side).x).toBeGreaterThanOrEqual(0);
      expect(end(side).x).toBeLessThanOrEqual(m.width);
      expect(end(side).y).toBeGreaterThanOrEqual(0);
      expect(end(side).y).toBeLessThanOrEqual(94);
    }
    // and to two decimals: what a style and a path can carry
    for (const side of SIDES) {
      expect(Number(end(side).x.toFixed(2))).toBe(end(side).x);
      expect(Number(end(side).y.toFixed(2))).toBe(end(side).y);
    }
  });
});

describe('the marks and the bands of the four sides (style sheet)', () => {
  /** How deep the band along a side is */
  const BAND = 12;

  it('the mark a cable ends on is 8 long and 2 thick, along its side', () => {
    const across = '.react-flow .connect-point-top,\n.react-flow .connect-point-bottom';
    const upright = '.react-flow .connect-point-left,\n.react-flow .connect-point-right';
    expect([value(across, 'width'), value(across, 'height')]).toEqual(['8px', '2px']);
    expect([value(upright, 'width'), value(upright, 'height')]).toEqual(['2px', '8px']);
  });

  it('a band is placed from the frame, wherever the mark is: as long as its side, 12 deep', () => {
    // (the mark is placed from the inside of the frame, which is its border further in)
    const fromLeft = `calc(-${m.border}px - var(--at-x))`;
    const fromTop = `calc(-${m.border}px - var(--at-y))`;

    expect(value('.connect-point-top::before', 'left')).toBe(fromLeft);
    expect(value('.connect-point-top::before', 'top')).toBe(fromTop);
    expect(value('.connect-point-top::before', 'width')).toBe(`${m.width}px`);
    expect(value('.connect-point-top::before', 'height')).toBe(`${BAND}px`);

    // (the mark of the bottom is on the bottom of the frame already)
    expect(value('.connect-point-bottom::before', 'left')).toBe(fromLeft);
    expect(value('.connect-point-bottom::before', 'bottom')).toBe('0');
    expect(value('.connect-point-bottom::before', 'width')).toBe(`${m.width}px`);
    expect(value('.connect-point-bottom::before', 'height')).toBe(`${BAND}px`);

    // the two at the sides run between the other two
    const between = `calc(${BAND - m.border}px - var(--at-y))`;
    const long = `calc(var(--frame-height) - ${2 * BAND}px)`;
    expect(value('.connect-point-left::before', 'left')).toBe(fromLeft);
    expect(value('.connect-point-left::before', 'top')).toBe(between);
    expect(value('.connect-point-left::before', 'width')).toBe(`${BAND}px`);
    expect(value('.connect-point-left::before', 'height')).toBe(long);
    expect(value('.connect-point-right::before', 'left')).toBe(
      `calc(${m.width - BAND - m.border}px - var(--at-x))`
    );
    expect(value('.connect-point-right::before', 'top')).toBe(between);
    expect(value('.connect-point-right::before', 'width')).toBe(`${BAND}px`);
    expect(value('.connect-point-right::before', 'height')).toBe(long);
  });

  it('the side that turns orange is the side of the frame: as long, as thick, in the same place', () => {
    const fromLeft = `calc(-${m.border}px - var(--at-x))`;
    const fromTop = `calc(-${m.border}px - var(--at-y))`;
    const thick = `${m.border}px`;

    expect(value('.connect-point-top::after', 'left')).toBe(fromLeft);
    expect(value('.connect-point-top::after', 'top')).toBe(fromTop);
    expect(value('.connect-point-top::after', 'width')).toBe(`${m.width}px`);
    expect(value('.connect-point-top::after', 'height')).toBe(thick);

    expect(value('.connect-point-bottom::after', 'left')).toBe(fromLeft);
    expect(value('.connect-point-bottom::after', 'bottom')).toBe('0');
    expect(value('.connect-point-bottom::after', 'width')).toBe(`${m.width}px`);
    expect(value('.connect-point-bottom::after', 'height')).toBe(thick);

    expect(value('.connect-point-left::after', 'left')).toBe(fromLeft);
    expect(value('.connect-point-left::after', 'top')).toBe(fromTop);
    expect(value('.connect-point-left::after', 'width')).toBe(thick);
    expect(value('.connect-point-left::after', 'height')).toBe('var(--frame-height)');

    expect(value('.connect-point-right::after', 'left')).toBe(
      `calc(${m.width - 2 * m.border}px - var(--at-x))`
    );
    expect(value('.connect-point-right::after', 'top')).toBe(fromTop);
    expect(value('.connect-point-right::after', 'width')).toBe(thick);
    expect(value('.connect-point-right::after', 'height')).toBe('var(--frame-height)');
  });

  it('while a cable is pulled the four bands cover the whole frame between them', () => {
    const connecting = (side: Side) => `body.react-flow-connecting .connect-point-${side}::before`;
    // the top one comes down to 36, the two at the sides are the 24 under it, half the frame each
    const top = parseFloat(value(connecting('top'), 'height'));
    expect(top).toBe(36);
    expect(value(connecting('left'), 'top')).toBe(`calc(${top - m.border}px - var(--at-y))`);
    expect(value(connecting('right'), 'top')).toBe(`calc(${top - m.border}px - var(--at-y))`);
    expect(value(connecting('left'), 'width')).toBe(`${m.width / 2}px`);
    expect(value(connecting('right'), 'width')).toBe(`${m.width / 2}px`);
    expect(value(connecting('right'), 'left')).toBe(
      `calc(${m.width / 2 - m.border}px - var(--at-x))`
    );
    const sides = parseFloat(value(connecting('left'), 'height'));
    expect(value(connecting('right'), 'height')).toBe(`${sides}px`);
    // and the bottom one takes what is left, down to the bottom of the frame
    expect(value(connecting('bottom'), 'height')).toBe(
      `calc(var(--frame-height) - ${top + sides}px)`
    );
    // (which is something even for the lowest frame)
    expect(deviceHeight(false) - (top + sides)).toBeGreaterThanOrEqual(BAND);
  });
});

describe('the middle run of a cable', () => {
  const frame = (x: number, y: number, height = deviceHeight(true)) => ({ x, y, width: DEVICE_METRICS.width, height });

  it('is halfway between the two frames, whatever is drawn in them: a switch and a row of devices share one line', () => {
    const switchFrame = frame(300, 0);
    // the ends of five different drawings are each at its own height...
    const drawings = ['server', 'database', 'server-web', 'server-mail', 'nas'] as const;
    const tops = drawings.map((drawing) => cableEnd(drawing, 'top', deviceHeight(true)).y);
    expect(new Set(tops).size).toBeGreaterThan(1);
    // ...and the run of each cable, from the bottom of the switch to the top of its device, is the same
    const runs = drawings.map((_, index) => cableRun(switchFrame, 'bottom', frame(index * 136, 200), 'top'));
    expect(runs.every((run) => run.centerY === (deviceHeight(true) + 200) / 2)).toBe(true);
    expect(runs.every((run) => run.centerX === undefined)).toBe(true);
    // the other way round, and on the sides
    expect(cableRun(frame(0, 200), 'top', switchFrame, 'bottom')).toEqual({ centerY: (deviceHeight(true) + 200) / 2 });
    expect(cableRun(frame(0, 0), 'right', frame(300, 40), 'left')).toEqual({ centerX: (DEVICE_METRICS.width + 300) / 2 });
    expect(cableRun(frame(300, 40), 'left', frame(0, 0), 'right')).toEqual({ centerX: (DEVICE_METRICS.width + 300) / 2 });
  });

  it('is React Flow\'s own where the sides do not face each other, or the frames do not leave room between them', () => {
    expect(cableRun(frame(0, 0), 'bottom', frame(300, 200), 'left')).toEqual({});
    expect(cableRun(frame(0, 0), 'top', frame(300, 0), 'top')).toEqual({});
    // (the device under the switch, but higher than its bottom: no room for a run between them)
    expect(cableRun(frame(0, 0), 'bottom', frame(300, 50), 'top')).toEqual({});
    expect(cableRun(frame(0, 0), 'right', frame(60, 200), 'left')).toEqual({});
  });
});
