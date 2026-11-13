/**
 * The drawing as a picture: where things go, what they look like, and that
 * what comes out is a document any program can open.
 */

import { describe, it, expect, vi } from 'vitest';
import { Position, getSmoothStepPath } from 'reactflow';
import type { ConnectionTemplate, DeviceTemplate } from '@/types/network';
import { device, link } from '@/test/networkFixtures';
import styleSheet from '../index.css?raw';
import {
  ACCENTS,
  DEVICE_METRICS,
  MARK_COLORS,
  PALETTES,
  approximateTextWidth,
  escapeXml,
  estimateDeviceSize,
  greyOf,
  isPlainDrawing,
  layoutDrawing,
  pixelSize,
  renderDrawingImage,
  scaledSvg,
  wrapText,
  type DrawingInput,
  type DrawingMarks,
  type IconShape,
  type ImageOptions,
  type TextMeasure,
} from './drawingImage';

/** Half the font size for each letter: easy to do by hand */
const measure: TextMeasure = (text, font) => text.length * font.size * 0.5;

const SQUARE: IconShape = {
  body: '<path fill="currentColor" d="M0 0h24v24H0z"/>',
  width: 24,
  height: 24,
  left: 0,
  top: 0,
};

const template = (overrides: Partial<DeviceTemplate> & { id: string }): DeviceTemplate => ({
  name: overrides.id,
  type: 'PC',
  icon: 'mdi:monitor',
  color: '#336699',
  isCustom: false,
  supportsVLAN: false,
  supportsSTP: false,
  supportsPorts: false,
  supportsNICs: true,
  ...overrides,
});

const cableTemplate = (
  overrides: Partial<ConnectionTemplate> & { type: string }
): ConnectionTemplate => ({
  id: `conn-${overrides.type}`,
  name: overrides.type,
  color: '#9333ea',
  lineStyle: 'solid',
  strokeWidth: 3,
  isCustom: false,
  ...overrides,
});

const input = (overrides: Partial<DrawingInput> = {}): DrawingInput => ({
  devices: [],
  connections: [],
  deviceTemplates: [],
  connectionTemplates: [],
  iconOf: () => SQUARE,
  measureText: measure,
  ...overrides,
});

const marks = (overrides: Partial<DrawingMarks> = {}): DrawingMarks => ({
  sourceId: null,
  targetId: null,
  failedDevices: [],
  failedConnections: [],
  route: null,
  ...overrides,
});

const LIGHT: ImageOptions = { theme: 'light' };

/** Two devices one above the other, 120 × 117 each, joined bottom to top */
const pair = (overrides: Partial<DrawingInput> = {}) =>
  input({
    devices: [
      device({ id: 'a', label: 'A', ip: '10.0.0.1', position: { x: 0, y: 0 } }),
      device({ id: 'b', label: 'B', ip: '10.0.0.2', position: { x: 0, y: 300 } }),
    ],
    connections: [link('a', 'b', { id: 'ab', sourceHandle: 'bottom', targetHandle: 'top' })],
    ...overrides,
  });

function parse(svg: string): Document {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
}

const root = (doc: Document) => doc.documentElement;
/** The group holding the drawing itself (cables, labels, devices) */
const drawing = (doc: Document) => doc.querySelector('svg > g') as SVGGElement;
const cablePaths = (doc: Document) => [...drawing(doc).children[0].querySelectorAll('path')];
const deviceGroups = (doc: Document) => [...drawing(doc).children].slice(2);
const texts = (scope: ParentNode) => [...scope.querySelectorAll('text')].map(t => t.textContent);

describe('layoutDrawing — devices', () => {
  it('puts a device where the canvas has it, with the size measured on screen', () => {
    const scene = layoutDrawing(
      input({
        devices: [device({ id: 'a', position: { x: 100, y: 50 } })],
        sizes: new Map([['a', { width: 143, height: 117 }]]),
      })
    );
    expect(scene.devices[0].box).toEqual({ x: 100, y: 50, width: 143, height: 117 });
  });

  it('works a missing size out from the texts, the way the style sheet lays a device out', () => {
    const size = (label: string, ip: string) => estimateDeviceSize(label, ip, measure);
    // short texts: the least width, and icon + name + address
    expect(size('PC-1', '10.0.0.1')).toEqual({ width: 120, height: 117 });
    // no address: one line less
    expect(size('SW-1', '')).toEqual({ width: 120, height: 101 });
    // a long name widens the box: 40 letters × 7 + border and padding on both sides
    expect(size('x'.repeat(40), '').width).toBe(40 * 7 + 24);

    const scene = layoutDrawing(input({ devices: [device({ id: 'a', label: 'PC-1', ip: '' })] }));
    expect(scene.devices[0].box).toMatchObject({ width: 120, height: 101 });
  });

  it('does not take "not on screen yet" for a size', () => {
    const scene = layoutDrawing(
      input({
        devices: [device({ id: 'a', ip: '10.0.0.1' })],
        sizes: new Map([['a', { width: 0, height: 0 }]]),
      })
    );
    expect(scene.devices[0].box).toMatchObject({ width: 120, height: 117 });
  });

  it('takes icon and colour from the template: by id, else by type, else the fallbacks', () => {
    const asked: string[] = [];
    const iconOf = (name: string) => {
      asked.push(name);
      return name === 'x:gone' ? null : SQUARE;
    };
    const scene = layoutDrawing(
      input({
        iconOf,
        deviceTemplates: [
          template({ id: 'tpl-pc', type: 'PC', icon: 'mdi:monitor', color: '#111111' }),
          template({ id: 'tpl-nas', type: 'Server', icon: 'mdi:nas', color: '#222222' }),
          template({ id: 'tpl-gone', type: 'Server', icon: 'x:gone', color: '#333333' }),
        ],
        devices: [
          device({ id: 'a', type: 'Server', templateId: 'tpl-nas' }),
          device({ id: 'b', type: 'PC' }),
          device({ id: 'c', type: 'Router' }),
          device({ id: 'd', type: 'Server', templateId: 'tpl-gone' }),
        ],
      })
    );
    expect(scene.devices.map(d => [d.iconName, d.color])).toEqual([
      ['mdi:nas', '#222222'],
      ['mdi:monitor', '#111111'],
      // no template for a router here: the icon of its type, the neutral colour
      ['mdi:router-network', '#5B7C8D'],
      ['x:gone', '#333333'],
    ]);
    // an icon the app does not have gives way to the "unknown" one
    expect(asked).toContain('mdi:help-circle-outline');
    expect(scene.devices[3].icon).toBe(SQUARE);
  });
});

describe('layoutDrawing — cables', () => {
  it('hangs a cable where the screen does, and carries it on to the two boxes', () => {
    const scene = layoutDrawing(pair());
    // on screen: from 12 below the first box to 12 above the second
    const [onScreen] = getSmoothStepPath({
      sourceX: 60,
      sourceY: 117 + 12,
      sourcePosition: Position.Bottom,
      targetX: 60,
      targetY: 300 - 12,
      targetPosition: Position.Top,
    });
    expect(onScreen.startsWith('M60 129')).toBe(true);
    // in the picture: the same line, from inside one border to inside the other
    expect(scene.cables[0].path).toBe(`M60 116L${onScreen.slice(1)}L60 301`);
  });

  it('uses the side each end names', () => {
    const scene = layoutDrawing(
      input({
        devices: [
          device({ id: 'a', ip: '10.0.0.1', position: { x: 0, y: 0 } }),
          device({ id: 'b', ip: '10.0.0.2', position: { x: 400, y: 0 } }),
        ],
        connections: [link('a', 'b', { sourceHandle: 'right', targetHandle: 'left' })],
      })
    );
    // right side of the first box (x 120) to left side of the second (x 400), at mid height
    expect(scene.cables[0].path.startsWith('M119 58.5L132 58.5')).toBe(true);
    expect(scene.cables[0].path.endsWith('L388 58.5L401 58.5')).toBe(true);
  });

  it('hangs an end that names no side, or a side that does not exist, on the top', () => {
    const scene = layoutDrawing(
      pair({
        connections: [
          link('a', 'b', { id: 'none', sourceHandle: null, targetHandle: undefined }),
          link('a', 'b', { id: 'odd', sourceHandle: 'north', targetHandle: 'top' }),
        ],
      })
    );
    for (const cable of scene.cables) {
      // from the top of the first box (y 0) to the top of the second (y 300)
      expect(cable.path.startsWith('M60 1L60 -12')).toBe(true);
      expect(cable.path.endsWith('L60 288L60 301')).toBe(true);
    }
  });

  it('leaves out a cable whose device is not in the drawing', () => {
    const scene = layoutDrawing(pair({ connections: [link('a', 'ghost'), link('ghost', 'b')] }));
    expect(scene.cables).toEqual([]);
  });

  it('takes width and dashes from the kind of cable; a plain line when it has none', () => {
    const scene = layoutDrawing(
      pair({
        connectionTemplates: [
          cableTemplate({ type: 'trunk', strokeWidth: 3.5 }),
          cableTemplate({ type: 'uplink', strokeWidth: 4, strokeDasharray: '8 4' }),
          cableTemplate({ type: 'access', strokeWidth: 2, strokeDasharray: 'none' }),
        ],
        connections: [
          link('a', 'b', { id: '1', type: 'trunk' }),
          link('a', 'b', { id: '2', type: 'uplink' }),
          link('a', 'b', { id: '3', type: 'access' }),
          link('a', 'b', { id: '4' }),
          // a kind no template describes (a file written by hand)
          link('a', 'b', { id: '5', type: 'backbone' }),
        ],
      })
    );
    expect(scene.cables.map(cable => [cable.width, cable.dash])).toEqual([
      [3.5, null],
      [4, '8 4'],
      [2, null],
      [2.5, null],
      [2.5, null],
    ]);
  });

  it('writes speed and name on a cable, in a box as wide as the longer of the two', () => {
    const scene = layoutDrawing(
      pair({
        connections: [
          link('a', 'b', {
            id: 'both',
            sourceHandle: 'bottom',
            targetHandle: 'top',
            bandwidth: '1 Gbps',
            label: 'Linea principale',
          }),
          link('a', 'b', { id: 'speed', sourceHandle: 'bottom', targetHandle: 'top', bandwidth: '1 Gbps' }),
          link('a', 'b', { id: 'bare', sourceHandle: 'bottom', targetHandle: 'top' }),
        ],
      })
    );
    const [both, speed, bare] = scene.cables;
    expect(both.label?.lines).toEqual([
      { text: '1 Gbps', strong: true },
      { text: 'Linea principale', strong: false },
    ]);
    // 16 letters × 6 = 96, + 8 of padding and 1 of border on each side
    expect(both.label?.box).toEqual({ x: 60 - 57, y: 208.5 - 21, width: 114, height: 42 });
    // 6 letters × 6 = 36 → 54 wide, one line → 26 high, on the middle of the cable
    expect(speed.label?.box).toEqual({ x: 60 - 27, y: 208.5 - 13, width: 54, height: 26 });
    expect(bare.label).toBeNull();
  });
});

describe('layoutDrawing — what presentation mode marks', () => {
  const triangle = (given: DrawingMarks) =>
    layoutDrawing(
      input({
        devices: [
          device({ id: 'a', position: { x: 0, y: 0 } }),
          device({ id: 'b', position: { x: 300, y: 0 } }),
          device({ id: 'c', position: { x: 150, y: 300 } }),
        ],
        connections: [
          link('a', 'b', { id: 'ab', bandwidth: '1 Gbps' }),
          link('b', 'c', { id: 'bc' }),
          link('a', 'c', { id: 'ac' }),
        ],
        marks: given,
      })
    );
  const looks = (given: DrawingMarks) => triangle(given).cables.map(cable => cable.look);

  it('marks nothing outside a presentation', () => {
    const scene = layoutDrawing(pair());
    expect(scene.cables[0].look).toBe('plain');
    expect(scene.devices.map(d => [d.role, d.failed, d.drop])).toEqual([
      [null, false, false],
      [null, false, false],
    ]);
  });

  it('marks the way of an answer in the colour of its outcome', () => {
    expect(looks(marks({ route: { links: ['ab', 'bc'], arrives: true, dropDeviceId: null } }))).toEqual([
      'arrives',
      'arrives',
      'plain',
    ]);
    expect(looks(marks({ route: { links: ['ab'], arrives: false, dropDeviceId: 'b' } }))).toEqual([
      'stops',
      'plain',
      'plain',
    ]);
  });

  it('a cut cable is a cut cable whatever else is true of it; then comes a broken device', () => {
    const everything = marks({
      failedConnections: ['ab'],
      failedDevices: ['c'],
      route: { links: ['ab', 'bc', 'ac'], arrives: false, dropDeviceId: 'a' },
    });
    expect(looks(everything)).toEqual(['cut', 'faded', 'faded']);
    // a cable into a broken device fades even when cut is not said of it
    expect(looks(marks({ failedDevices: ['a'] }))).toEqual(['faded', 'plain', 'faded']);
  });

  it('puts the mark of a cut where the label was, and drops the label', () => {
    const cut = triangle(marks({ failedConnections: ['ab'] })).cables[0];
    const whole = triangle(marks()).cables[0];
    expect(whole.label).not.toBeNull();
    expect(whole.cutMark).toBeNull();
    expect(cut.label).toBeNull();
    const centre = {
      x: (whole.label?.box.x ?? 0) + (whole.label?.box.width ?? 0) / 2,
      y: (whole.label?.box.y ?? 0) + (whole.label?.box.height ?? 0) / 2,
    };
    expect(cut.cutMark).toEqual(centre);
  });

  it('says which device the question starts from, ends on, is broken, stops the packet', () => {
    const scene = triangle(
      marks({
        sourceId: 'a',
        targetId: 'c',
        failedDevices: ['c'],
        route: { links: ['ab'], arrives: false, dropDeviceId: 'b' },
      })
    );
    expect(scene.devices.map(d => [d.id, d.role, d.failed, d.drop])).toEqual([
      ['a', 'source', false, false],
      ['b', null, false, true],
      ['c', 'target', true, false],
    ]);
  });

  it('a broken device is not "where the packet stops": the one before it is', () => {
    const scene = triangle(
      marks({ failedDevices: ['b'], route: { links: [], arrives: false, dropDeviceId: 'b' } })
    );
    expect(scene.devices[1]).toMatchObject({ failed: true, drop: false });
  });
});

describe('layoutDrawing — bounds', () => {
  it('is nothing for an empty drawing', () => {
    expect(layoutDrawing(input()).bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('holds the devices exactly when nothing sticks out of them', () => {
    const scene = layoutDrawing(
      input({
        devices: [
          device({ id: 'a', ip: '10.0.0.1', position: { x: -50, y: 20 } }),
          device({ id: 'b', ip: '10.0.0.2', position: { x: 300, y: 400 } }),
        ],
      })
    );
    expect(scene.bounds).toEqual({ x: -50, y: 20, width: 470, height: 497 });
  });

  it('holds a cable that goes round the outside of its devices', () => {
    // top to top: the cable climbs above both boxes
    const scene = layoutDrawing(
      input({
        devices: [
          device({ id: 'a', ip: '10.0.0.1', position: { x: 0, y: 0 } }),
          device({ id: 'b', ip: '10.0.0.2', position: { x: 300, y: 0 } }),
        ],
        connections: [link('a', 'b', { sourceHandle: 'top', targetHandle: 'top' })],
      })
    );
    expect(scene.bounds.y).toBeLessThan(-12);
    expect(scene.bounds.height).toBe(117 - scene.bounds.y);
  });

  it('holds a label wider than everything else, and the badges of a presentation', () => {
    const wide = layoutDrawing(
      pair({
        connections: [
          link('a', 'b', { sourceHandle: 'bottom', targetHandle: 'top', label: 'x'.repeat(60) }),
        ],
      })
    );
    // 60 letters × 6 + 18 = 378, centred on x 60
    expect(wide.bounds.x).toBe(60 - 189);
    expect(wide.bounds.width).toBe(378);

    const marked = layoutDrawing(pair({ marks: marks({ sourceId: 'a', failedDevices: ['a'] }) }));
    // "DA" sits up and to the left of its device, the sign of a failure up and to the right
    expect(marked.bounds).toMatchObject({ x: -6, y: -9, width: 6 + 120 + 8 });
  });
});

describe('renderDrawingImage — the document', () => {
  it('is one well-formed SVG of the size it declares, with nothing fetched from elsewhere', () => {
    const image = renderDrawingImage(pair(), LIGHT);
    const doc = parse(image.svg);

    // two boxes 120 wide, 417 from top to bottom, 24 of margin all round
    expect(image).toMatchObject({ width: 168, height: 465 });
    expect(root(doc).getAttribute('width')).toBe('168');
    expect(root(doc).getAttribute('height')).toBe('465');
    expect(root(doc).getAttribute('viewBox')).toBe('0 0 168 465');
    expect(root(doc).namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(image.svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
    expect(image.svg).not.toContain('currentColor');
    expect(image.svg).not.toContain('NaN');
    expect(image.svg).not.toContain('undefined');
  });

  it('is the same for the same drawing', () => {
    expect(renderDrawingImage(pair(), LIGHT).svg).toBe(renderDrawingImage(pair(), LIGHT).svg);
  });

  it('draws each device: box, icon in the colour of its template, name, address', () => {
    const doc = parse(
      renderDrawingImage(
        pair({ deviceTemplates: [template({ id: 'pc', type: 'PC', color: '#336699' })] }),
        LIGHT
      ).svg
    );
    const [first, second] = deviceGroups(doc);
    expect(texts(first)).toEqual(['A', '10.0.0.1']);
    expect(texts(second)).toEqual(['B', '10.0.0.2']);

    // the drawing is moved by the margin: the box of the first device starts there
    expect(drawing(doc).getAttribute('transform')).toBe('translate(24 24)');
    const box = first.querySelectorAll('rect')[1];
    expect(['x', 'y', 'width', 'height', 'rx'].map(name => box.getAttribute(name))).toEqual([
      '1',
      '1',
      '118',
      '115',
      '7',
    ]);
    expect(box.getAttribute('fill')).toBe(PALETTES.light.component);
    expect(box.getAttribute('stroke')).toBe(PALETTES.light.border);

    // the icon: 24 units drawn 48 wide, in the middle of the box, 12 from its top
    const icon = first.querySelector('g > g');
    expect(icon?.getAttribute('transform')).toBe('translate(36 12) scale(2)');
    expect(icon?.querySelector('path')?.getAttribute('fill')).toBe('#336699');

    // name and address centred under it
    const [name, address] = [...first.querySelectorAll('text')];
    expect(name.getAttribute('x')).toBe('60');
    expect(name.getAttribute('text-anchor')).toBe('middle');
    expect(name.getAttribute('font-weight')).toBe('600');
    expect(name.getAttribute('fill')).toBe(PALETTES.light.text);
    expect(address.getAttribute('fill')).toBe(PALETTES.light.address);
    expect(Number(address.getAttribute('y'))).toBeGreaterThan(Number(name.getAttribute('y')));
    expect(Number(address.getAttribute('y'))).toBeLessThan(117 - 12);
  });

  it('writes no address line for a device without one', () => {
    const doc = parse(
      renderDrawingImage(input({ devices: [device({ id: 'sw', label: 'SW-1', ip: '' })] }), LIGHT).svg
    );
    expect(texts(deviceGroups(doc)[0])).toEqual(['SW-1']);
  });

  it('keeps an icon that is not square in proportion, in the middle of its place', () => {
    const wide: IconShape = { body: '<path d="M0 0h32v16H0z"/>', width: 32, height: 16, left: 0, top: 0 };
    const doc = parse(
      renderDrawingImage(input({ devices: [device({ id: 'a' })], iconOf: () => wide }), LIGHT).svg
    );
    // 32 × 16 at scale 1.5 is 48 × 24: 12 down from the top of the square
    expect(deviceGroups(doc)[0].querySelector('g > g')?.getAttribute('transform')).toBe(
      'translate(36 24) scale(1.5)'
    );
  });

  it('draws the device even when no icon can be had', () => {
    const doc = parse(
      renderDrawingImage(input({ devices: [device({ id: 'a', label: 'PC' })], iconOf: () => null }), LIGHT)
        .svg
    );
    expect(texts(deviceGroups(doc)[0])).toEqual(['PC']);
    expect(deviceGroups(doc)[0].querySelector('g > g')).toBeNull();
  });

  it('keeps the ids inside one icon apart from those inside another', () => {
    const shaded = (name: string): IconShape => ({
      ...SQUARE,
      body: `<defs><linearGradient id="a"><stop offset="0"/></linearGradient></defs><path fill="url(#a)" d="${name}"/><use href="#a"/>`,
    });
    const doc = parse(
      renderDrawingImage(
        input({
          devices: [
            device({ id: '1', type: 'PC' }),
            device({ id: '2', type: 'Router' }),
            device({ id: '3', type: 'PC' }),
          ],
          deviceTemplates: [
            template({ id: 'pc', type: 'PC', icon: 'set:one' }),
            template({ id: 'router', type: 'Router', icon: 'set:two' }),
          ],
          iconOf: name => shaded(name === 'set:one' ? 'M1 1' : 'M2 2'),
        }),
        LIGHT
      ).svg
    );
    const gradients = [...doc.querySelectorAll('linearGradient')].map(g => g.getAttribute('id'));
    const fills = [...doc.querySelectorAll('path[d^="M1"], path[d^="M2"]')].map(p => p.getAttribute('fill'));
    expect(gradients).toEqual(['pc-i0-a', 'pc-i1-a', 'pc-i0-a']);
    expect(fills).toEqual(['url(#pc-i0-a)', 'url(#pc-i1-a)', 'url(#pc-i0-a)']);
    expect([...doc.querySelectorAll('use')].map(u => u.getAttribute('href'))).toEqual([
      '#pc-i0-a',
      '#pc-i1-a',
      '#pc-i0-a',
    ]);
  });

  it('draws each cable under the devices, as the screen shows it at rest', () => {
    const doc = parse(
      renderDrawingImage(
        pair({
          connectionTemplates: [cableTemplate({ type: 'uplink', strokeWidth: 4, strokeDasharray: '8 4' })],
          connections: [
            link('a', 'b', { id: '1', sourceHandle: 'bottom', targetHandle: 'top', type: 'uplink' }),
            link('a', 'b', { id: '2', sourceHandle: 'bottom', targetHandle: 'top' }),
          ],
        }),
        LIGHT
      ).svg
    );
    const [dashed, plain] = cablePaths(doc);
    expect(
      ['stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill'].map(n => dashed.getAttribute(n))
    ).toEqual([PALETTES.light.line, '4', '8 4', '0.6', 'none']);
    expect(plain.getAttribute('stroke-width')).toBe('2.5');
    expect(plain.hasAttribute('stroke-dasharray')).toBe(false);
    // cables first, then what is written on them, then the devices on top
    expect(drawing(doc).children[0].querySelectorAll('rect, text')).toHaveLength(0);
    expect(drawing(doc).children).toHaveLength(2 + 2);
  });

  it('writes on a cable what the canvas writes', () => {
    const doc = parse(
      renderDrawingImage(
        pair({
          connections: [
            link('a', 'b', {
              sourceHandle: 'bottom',
              targetHandle: 'top',
              bandwidth: '1 Gbps',
              label: 'Linea principale',
            }),
          ],
        }),
        LIGHT
      ).svg
    );
    const labels = drawing(doc).children[1];
    expect(texts(labels)).toEqual(['1 Gbps', 'Linea principale']);
    const [speed, name] = [...labels.querySelectorAll('text')];
    expect([speed.getAttribute('font-weight'), speed.getAttribute('fill')]).toEqual([
      '600',
      PALETTES.light.pillStrong,
    ]);
    expect([name.getAttribute('font-weight'), name.getAttribute('fill')]).toEqual([
      '400',
      PALETTES.light.pillSoft,
    ]);
    expect(labels.querySelector('rect')?.getAttribute('fill')).toBe(PALETTES.light.pillFill);
  });
});

describe('renderDrawingImage — what the user typed', () => {
  const nasty = 'R&D <core> "1" \'x\'';

  it('is written as text, never as markup', () => {
    const image = renderDrawingImage(
      pair({
        devices: [device({ id: 'a', label: nasty, ip: '<10.0.0.1>' }), device({ id: 'b', label: 'B' })],
        connections: [link('a', 'b', { bandwidth: nasty, label: '</svg><script>alert(1)</script>' })],
      }),
      { theme: 'light', title: { name: nasty, detail: nasty }, caption: { tone: 'ok', heading: nasty, lines: [nasty] } }
    );
    const doc = parse(image.svg);
    expect(doc.querySelector('script')).toBeNull();
    expect(texts(deviceGroups(doc)[0])).toEqual([nasty, '<10.0.0.1>']);
    expect(texts(drawing(doc).children[1])).toEqual([nasty, '</svg><script>alert(1)</script>']);
    expect(doc.querySelector('title')?.textContent).toBe(nasty);
    expect(root(doc).getAttribute('aria-label')).toBe(nasty);
  });

  it('loses the characters XML cannot hold, and nothing else', () => {
    expect(escapeXml('a\u0000b\u0008c\u000Bd\u001Fe\uFFFEf')).toBe('abcdef');
    expect(escapeXml('tab\there\nnew — è 日本 🙂')).toBe('tab\there\nnew — è 日本 🙂');
    const doc = parse(
      renderDrawingImage(input({ devices: [device({ id: 'a', label: 'PC\u0001-\u00011' })] }), LIGHT).svg
    );
    expect(texts(deviceGroups(doc)[0])).toEqual(['PC-1']);
  });

  it('a template colour that is not a colour cannot write attributes', () => {
    const doc = parse(
      renderDrawingImage(
        input({
          devices: [device({ id: 'a' })],
          deviceTemplates: [template({ id: 'pc', type: 'PC', color: '#fff" onload="alert(1)' })],
        }),
        LIGHT
      ).svg
    );
    const path = deviceGroups(doc)[0].querySelector('g > g path');
    expect(path?.getAttribute('fill')).toBe('#5B7C8D');
    expect(doc.querySelector('[onload]')).toBeNull();
  });

  it('accepts the colours a template can really have', () => {
    const fillOf = (color: string) =>
      parse(
        renderDrawingImage(
          input({
            devices: [device({ id: 'a' })],
            deviceTemplates: [template({ id: 'pc', type: 'PC', color })],
          }),
          LIGHT
        ).svg
      )
        .querySelector('svg > g > g g > path')
        ?.getAttribute('fill');
    expect(fillOf('#abc')).toBe('#abc');
    expect(fillOf('#A1B2C3')).toBe('#A1B2C3');
    expect(fillOf('rgb(10, 20, 30)')).toBe('rgb(10, 20, 30)');
    expect(fillOf('tomato')).toBe('tomato');
    expect(fillOf('url(#x)')).toBe('#5B7C8D');
  });
});

describe('renderDrawingImage — theme and background', () => {
  const background = (doc: Document) => doc.querySelector('svg > rect');

  it('is light or dark as asked, whatever the screen shows', () => {
    const light = parse(renderDrawingImage(pair(), { theme: 'light' }).svg);
    const dark = parse(renderDrawingImage(pair(), { theme: 'dark' }).svg);

    expect(background(light)?.getAttribute('fill')).toBe('#ffffff');
    expect(background(dark)?.getAttribute('fill')).toBe('#252525');
    expect(['width', 'height'].map(n => background(dark)?.getAttribute(n))).toEqual(['168', '465']);

    const name = (doc: Document) => deviceGroups(doc)[0].querySelector('text')?.getAttribute('fill');
    expect(name(light)).toBe('#222222');
    expect(name(dark)).toBe('#eeeeee');
    expect(cablePaths(dark)[0].getAttribute('stroke')).toBe('#777777');
  });

  it('has no background when asked for none, and is otherwise the same picture', () => {
    const solid = renderDrawingImage(pair(), { theme: 'light' });
    const clear = renderDrawingImage(pair(), { theme: 'light', transparent: true });
    expect(background(parse(clear.svg))).toBeNull();
    expect(clear.svg).toBe(solid.svg.replace('<rect width="168" height="465" fill="#ffffff"/>', ''));
    expect(clear).toMatchObject({ width: solid.width, height: solid.height });
  });
});

describe('renderDrawingImage — title and caption', () => {
  it('adds nothing around the drawing when asked for neither', () => {
    const doc = parse(renderDrawingImage(pair(), LIGHT).svg);
    expect(doc.querySelectorAll('svg > text')).toHaveLength(0);
    expect(doc.querySelectorAll('svg > circle')).toHaveLength(0);
  });

  it('writes the name of the project above the drawing, and the canvas under it', () => {
    const bare = renderDrawingImage(pair(), LIGHT);
    const named = renderDrawingImage(pair(), { theme: 'light', title: { name: 'Sede Milano' } });
    const both = renderDrawingImage(pair(), {
      theme: 'light',
      title: { name: 'Sede Milano', detail: 'Piano 2' },
    });

    expect(texts(parse(named.svg)).slice(0, 1)).toEqual(['Sede Milano']);
    const lines = [...parse(both.svg).querySelectorAll('svg > text')];
    expect(lines.map(line => line.textContent)).toEqual(['Sede Milano', 'Piano 2']);
    expect(lines[0].getAttribute('font-weight')).toBe('600');
    expect(lines[1].getAttribute('fill')).toBe(PALETTES.light.textLight);

    // the drawing moves down by the lines of the title and the space under them
    expect(named.height - bare.height).toBe(24 + 16);
    expect(both.height - bare.height).toBe(24 + 18 + 16);
    expect(drawing(parse(both.svg)).getAttribute('transform')).toBe(`translate(144 ${24 + 58})`);
  });

  it('gives texts room to be read: a narrow drawing sits in the middle of a wider page', () => {
    const image = renderDrawingImage(pair(), { theme: 'light', title: { name: 'Sede' } });
    // 360 for the text + the margins; the 120 of the drawing in the middle of it
    expect(image.width).toBe(360 + 48);
    expect(drawing(parse(image.svg)).getAttribute('transform')).toBe('translate(144 64)');
  });

  it('writes question and answer under the drawing, with a mark in the colour of the answer', () => {
    const caption = (tone: 'ok' | 'ko' | 'unknown' | null) =>
      parse(
        renderDrawingImage(pair(), {
          theme: 'light',
          caption: { tone, heading: 'Ping da A a B: arriva', lines: ['B risponde ad A.', 'Seconda riga.'] },
        }).svg
      );

    const ok = caption('ok');
    const lines = [...ok.querySelectorAll('svg > text')];
    expect(lines.map(line => line.textContent)).toEqual([
      'Ping da A a B: arriva',
      'B risponde ad A.',
      'Seconda riga.',
    ]);
    // below the drawing (24 of margin + 417 of drawing), one under the other
    const ys = lines.map(line => Number(line.getAttribute('y')));
    expect(ys[0]).toBeGreaterThan(24 + 417);
    expect(ys[1] - ys[0]).toBeGreaterThan(0);
    expect(ys[2] - ys[1]).toBe(18);
    expect(lines[0].getAttribute('font-weight')).toBe('600');

    const mark = (doc: Document) => doc.querySelector('svg > circle')?.getAttribute('fill');
    expect(mark(ok)).toBe(PALETTES.light.toneOk);
    expect(mark(caption('ko'))).toBe(PALETTES.light.toneKo);
    expect(mark(caption('unknown'))).toBe(PALETTES.light.toneUnknown);

    // no question, no answer to colour: no mark, and the text starts at the margin
    const plain = caption(null);
    expect(plain.querySelector('svg > circle')).toBeNull();
    expect(plain.querySelector('svg > text')?.getAttribute('x')).toBe('24');
    expect(lines[0].getAttribute('x')).toBe('42');
  });

  it('breaks a long caption into lines that fit the page', () => {
    const long = Array.from({ length: 40 }, (_, i) => `parola${i}`).join(' ');
    const image = renderDrawingImage(pair(), {
      theme: 'light',
      caption: { tone: 'ok', heading: 'Ping', lines: [long] },
    });
    const lines = [...parse(image.svg).querySelectorAll('svg > text')].slice(1);
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      expect(measure(line.textContent ?? '', { size: 12.5, weight: 400 })).toBeLessThanOrEqual(360 - 18);
    }
    // nothing lost, nothing added
    expect(lines.map(line => line.textContent).join(' ')).toBe(long);
    // and the page grows downwards to hold them
    expect(image.height).toBeGreaterThan(465 + lines.length * 18);
  });
});

describe('renderDrawingImage — a presentation', () => {
  const presented = (given: DrawingMarks, options: ImageOptions = LIGHT) =>
    parse(
      renderDrawingImage(
        input({
          devices: [
            device({ id: 'a', label: 'A', ip: '10.0.0.1', position: { x: 0, y: 0 } }),
            device({ id: 'b', label: 'B', ip: '10.0.0.2', position: { x: 300, y: 0 } }),
            device({ id: 'c', label: 'C', ip: '10.0.0.3', position: { x: 150, y: 300 } }),
          ],
          deviceTemplates: [template({ id: 'pc', type: 'PC', color: '#336699' })],
          connectionTemplates: [cableTemplate({ type: 'uplink', strokeWidth: 4, strokeDasharray: '8 4' })],
          connections: [
            link('a', 'b', { id: 'ab', sourceHandle: 'right', targetHandle: 'left', type: 'uplink', bandwidth: '1 Gbps' }),
            link('b', 'c', { id: 'bc', sourceHandle: 'bottom', targetHandle: 'top' }),
            link('a', 'c', { id: 'ac', sourceHandle: 'bottom', targetHandle: 'top' }),
          ],
          marks: given,
        }),
        options
      ).svg
    );
  const attrs = (el: Element, names: string[]) => names.map(name => el.getAttribute(name));
  const LINE = ['stroke', 'stroke-width', 'stroke-dasharray', 'opacity'];

  it('marks the way of an answer that arrives, keeping the dashes of each cable', () => {
    const doc = presented(marks({ route: { links: ['ab', 'bc'], arrives: true, dropDeviceId: null } }));
    const [ab, bc, ac] = cablePaths(doc);
    expect(attrs(ab, LINE)).toEqual([MARK_COLORS.arrives, '5.5', '8 4', null]);
    expect(attrs(bc, LINE)).toEqual([MARK_COLORS.arrives, '4', null, null]);
    expect(attrs(ac, LINE)).toEqual([PALETTES.light.line, '2.5', null, '0.6']);
  });

  it('marks in another colour the way of an answer that stops, and the device it stops on', () => {
    const doc = presented(marks({ route: { links: ['ab'], arrives: false, dropDeviceId: 'b' } }));
    expect(attrs(cablePaths(doc)[0], LINE)).toEqual([MARK_COLORS.stops, '5.5', '8 4', null]);

    const [a, b] = deviceGroups(doc);
    expect(b.querySelectorAll('rect')[1].getAttribute('stroke')).toBe(MARK_COLORS.stops);
    // the ring around it
    const ring = b.querySelectorAll('rect')[2];
    expect(attrs(ring, ['fill', 'stroke', 'stroke-width', 'stroke-opacity'])).toEqual([
      'none',
      MARK_COLORS.stops,
      '3',
      '0.4',
    ]);
    expect(a.querySelectorAll('rect')).toHaveLength(2);
  });

  it('shows a cut cable broken up and red, with its mark instead of its label', () => {
    const doc = presented(marks({ failedConnections: ['ab'] }));
    expect(attrs(cablePaths(doc)[0], LINE)).toEqual([MARK_COLORS.failure, '4.5', '3 7', '0.9']);
    const labels = drawing(doc).children[1];
    expect(texts(labels)).toEqual([]);
    expect(labels.querySelector('circle')?.getAttribute('fill')).toBe(MARK_COLORS.failure);
    // the cross is drawn, not written: no font has to have the sign
    expect(labels.querySelector('path')?.getAttribute('stroke')).toBe('#ffffff');
    expect(doc.querySelector('#pc-hatch')).toBeNull();
  });

  it('shows a broken device struck out, with its sign, and its cables faded', () => {
    const doc = presented(marks({ failedDevices: ['b'] }));
    const [ab, bc, ac] = cablePaths(doc);
    expect(attrs(ab, LINE)).toEqual([PALETTES.light.line, '4', '3 7', '0.3']);
    expect(attrs(bc, LINE)).toEqual([PALETTES.light.line, '2.5', '3 7', '0.3']);
    expect(attrs(ac, LINE)).toEqual([PALETTES.light.line, '2.5', null, '0.6']);
    // the label of a faded cable stays
    expect(texts(drawing(doc).children[1])).toEqual(['1 Gbps']);

    const [a, b] = deviceGroups(doc);
    const box = b.querySelectorAll('rect')[1];
    expect(attrs(box, ['stroke', 'stroke-dasharray'])).toEqual([MARK_COLORS.failure, '6 4']);
    expect(b.querySelectorAll('rect')[2].getAttribute('fill')).toBe('url(#pc-hatch)');
    expect(doc.querySelector('pattern#pc-hatch')).not.toBeNull();
    // what is inside is greyed out
    const content = b.querySelector('g > g[opacity="0.45"]');
    expect(texts(content as Element)).toEqual(['B', '10.0.0.2']);
    expect(content?.querySelector('path')?.getAttribute('fill')).toBe(greyOf('#336699'));
    // the sign, on the top right corner
    const sign = b.querySelector('circle');
    expect(attrs(sign as Element, ['cx', 'cy', 'r', 'fill'])).toEqual(['416', '4', '12', MARK_COLORS.failure]);
    // a working device has none of this
    expect(a.querySelector('circle')).toBeNull();
    expect(a.querySelector('[opacity="0.45"]')).toBeNull();
    expect(a.querySelector('path')?.getAttribute('fill')).toBe('#336699');
  });

  it('labels the two ends of the question, in the colours of the theme', () => {
    const badges = (doc: Document) =>
      deviceGroups(doc).map(group => {
        const text = [...group.querySelectorAll('text')].find(t => t.getAttribute('fill') === '#ffffff');
        return text ? [text.textContent, text.previousElementSibling?.getAttribute('fill')] : null;
      });
    const asked = marks({ sourceId: 'a', targetId: 'c' });

    expect(badges(presented(asked))).toEqual([
      ['DA', ACCENTS.pixelcake.light.accent],
      null,
      ['A', ACCENTS.pixelcake.light.secondary],
    ]);
    expect(badges(presented(asked, { theme: 'dark' }))).toEqual([
      ['DA', ACCENTS.pixelcake.dark.accent],
      null,
      ['A', ACCENTS.pixelcake.dark.secondary],
    ]);
    expect(badges(presented(asked, { theme: 'light', accent: 'modern-tech' }))).toEqual([
      ['DA', ACCENTS['modern-tech'].light.accent],
      null,
      ['A', ACCENTS['modern-tech'].light.secondary],
    ]);
    expect(badges(presented(marks()))).toEqual([null, null, null]);
  });
});

describe('scaledSvg and pixelSize', () => {
  it('declares more pixels for the same drawing', () => {
    const image = renderDrawingImage(pair(), LIGHT);
    const doubled = scaledSvg(image, 2);
    const doc = parse(doubled);
    expect(root(doc).getAttribute('width')).toBe('336');
    expect(root(doc).getAttribute('height')).toBe('930');
    expect(root(doc).getAttribute('viewBox')).toBe('0 0 168 465');
    // nothing else changes
    expect(doubled.replace('width="336" height="930"', 'width="168" height="465"')).toBe(image.svg);
    expect(scaledSvg(image, 1)).toBe(image.svg);
  });

  it('gives whole pixels, one at least', () => {
    expect(pixelSize({ width: 168, height: 465 }, 3)).toEqual({ width: 504, height: 1395 });
    expect(pixelSize({ width: 101, height: 33 }, 0.5)).toEqual({ width: 51, height: 17 });
    expect(pixelSize({ width: 10, height: 10 }, 0.01)).toEqual({ width: 1, height: 1 });
    const image = renderDrawingImage(pair(), LIGHT);
    expect(root(parse(scaledSvg(image, 0.5))).getAttribute('width')).toBe('84');
  });

  it('leaves alone a document it did not write', () => {
    expect(scaledSvg({ svg: '<svg width="1"/>', width: 10, height: 10 }, 2)).toBe('<svg width="1"/>');
  });
});

describe('wrapText', () => {
  const font = { size: 10, weight: 400 } as const; // 5 units a letter

  it('keeps on one line what fits', () => {
    expect(wrapText('uno due tre', 100, font, measure)).toEqual(['uno due tre']);
    expect(wrapText('', 100, font, measure)).toEqual([]);
    expect(wrapText('   ', 100, font, measure)).toEqual([]);
  });

  it('breaks between words, never wider than asked', () => {
    // 4 letters a word: "aaaa bbbb" is 45 wide, "aaaa bbbb cccc" 70
    expect(wrapText('aaaa bbbb cccc dddd', 50, font, measure)).toEqual(['aaaa bbbb', 'cccc dddd']);
    expect(wrapText('aaaa  bbbb\n cccc', 20, font, measure)).toEqual(['aaaa', 'bbbb', 'cccc']);
  });

  it('cuts a word longer than a line, keeping every letter', () => {
    expect(wrapText('abcdefghij', 20, font, measure)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrapText('ab abcdefghij z', 20, font, measure)).toEqual(['ab', 'abcd', 'efgh', 'ij z']);
  });

  it('always ends, even when nothing fits', () => {
    expect(wrapText('abc', 1, font, measure)).toEqual(['a', 'b', 'c']);
  });
});

describe('greyOf', () => {
  it('gives the grey of the same brightness', () => {
    expect(greyOf('#ffffff')).toBe('#ffffff');
    expect(greyOf('#000')).toBe('#000000');
    expect(greyOf('#ff0000')).toBe('#363636');
    expect(greyOf('#00ff00')).toBe('#b6b6b6');
    expect(greyOf('#5B7C8D')).toBe('#767676');
  });

  it('gives a middle grey for what is not a plain colour code', () => {
    expect(greyOf('tomato')).toBe('#888888');
    expect(greyOf('')).toBe('#888888');
  });
});

describe('isPlainDrawing', () => {
  it('lets through the shapes icons are made of', () => {
    expect(isPlainDrawing('<path fill="currentColor" d="M0 0h24v24H0z"/>')).toBe(true);
    expect(isPlainDrawing('<g fill="none" stroke="currentColor"><circle cx="1" cy="1" r="1"/></g>')).toBe(true);
    expect(
      isPlainDrawing('<defs><linearGradient id="a"/></defs><path fill="url(#a)"/><use href="#a"/>')
    ).toBe(true);
    expect(isPlainDrawing("<use xlink:href='#a'/>")).toBe(true);
    expect(isPlainDrawing('<path d="M0 0"><animate attributeName="d" dur="1s"/></path>')).toBe(true);
    expect(isPlainDrawing('<path d="M0 0"><animateTransform type="rotate"/></path>')).toBe(true);
  });

  it('stops whatever could run, restyle the document or reach outside it', () => {
    expect(isPlainDrawing('<script>alert(1)</script>')).toBe(false);
    expect(isPlainDrawing('< SCRIPT >x</script>')).toBe(false);
    expect(isPlainDrawing('<path onload="alert(1)"/>')).toBe(false);
    expect(isPlainDrawing('<path d="M0 0" onClick = "x()"/>')).toBe(false);
    expect(isPlainDrawing('<a href="#a"><path/></a>')).toBe(false);
    expect(isPlainDrawing('<style>*{fill:red}</style>')).toBe(false);
    expect(isPlainDrawing('<foreignObject><div/></foreignObject>')).toBe(false);
    expect(isPlainDrawing('<iframe/>')).toBe(false);
    expect(isPlainDrawing('<use href="https://example.com/x.svg#a"/>')).toBe(false);
    expect(isPlainDrawing("<image xlink:href='data:image/png;base64,AAAA'/>")).toBe(false);
    expect(isPlainDrawing('<image href=x.png />')).toBe(false);
    expect(isPlainDrawing('<set attributeName="href" to="javascript:alert(1)"/>')).toBe(false);
  });
});

describe('approximateTextWidth', () => {
  it('grows with the text, the size and the weight', () => {
    const regular = { size: 12, weight: 400 } as const;
    expect(approximateTextWidth('', regular)).toBe(0);
    expect(approximateTextWidth('abcd', regular)).toBe(2 * approximateTextWidth('ab', regular));
    expect(approximateTextWidth('ab', { size: 24, weight: 400 })).toBe(2 * approximateTextWidth('ab', regular));
    expect(approximateTextWidth('ab', { size: 12, weight: 600 })).toBeGreaterThan(
      approximateTextWidth('ab', regular)
    );
    // one sign, not two halves
    expect(approximateTextWidth('🙂', regular)).toBe(approximateTextWidth('a', regular));
  });
});

describe('the numbers repeated from the style sheet', () => {
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
  /** #ddd and #DDDDDD are the same colour */
  const hex = (color: string) => {
    const code = color.replace('#', '').toLowerCase();
    return `#${code.length === 3 ? [...code].map(c => c + c).join('') : code}`;
  };

  it('a device is laid out as the picture draws it', () => {
    const m = DEVICE_METRICS;
    expect(value('.network-device', 'padding')).toBe(`${m.padding}px`);
    expect(value('.network-device', 'border')).toBe(`${m.border}px solid var(--border-color)`);
    expect(value('.network-device', 'border-radius')).toBe(`${m.radius}px`);
    expect(value('.network-device', 'min-width')).toBe(`${m.minWidth}px`);
    expect(value('.network-device', 'background-color')).toBe('var(--bg-component)');
    expect(value('.network-device', 'box-shadow')).toBe('0 3px 6px var(--shadow-color)');
    expect(value('.device-icon', 'margin-bottom')).toBe(`${m.iconGap}px`);
    expect(value('.device-ip', 'margin-top')).toBe(`${m.ipGap}px`);
    // the address: 0.85 of the 0.9 em of the device, on the 16 px of the page
    expect(value('.network-device', 'font-size')).toBe('0.9em');
    expect(value('.device-ip', 'font-size')).toBe('0.85em');
    expect(Number((16 * 0.9 * 0.85).toFixed(2))).toBe(m.ipSize);
  });

  it('a cable hangs as far from its device as the picture takes it', () => {
    // a connection point is 28 wide and starts 14 outside the padding box of
    // the device, which is one border inside the device itself
    expect(value('.connect-point', 'width')).toBe('28px !important');
    expect(value('.connect-point-top', 'top')).toBe('-14px !important');
    expect(value('.connect-point-bottom', 'bottom')).toBe('-14px !important');
    expect(value('.connect-point-left', 'left')).toBe('-14px !important');
    expect(value('.connect-point-right', 'right')).toBe('-14px !important');
    expect(14 - DEVICE_METRICS.border).toBe(DEVICE_METRICS.handleReach);
  });

  it('the two themes have the colours of the picture', () => {
    const check = (selector: string, palette: (typeof PALETTES)['light']) => {
      expect(hex(value(selector, '--bg-canvas'))).toBe(palette.canvas);
      expect(hex(value(selector, '--bg-component'))).toBe(palette.component);
      expect(hex(value(selector, '--border-color'))).toBe(palette.border);
      expect(hex(value(selector, '--text-color'))).toBe(palette.text);
      expect(hex(value(selector, '--text-color-light'))).toBe(palette.textLight);
      expect(hex(value(selector, '--line-color'))).toBe(palette.line);
      expect(value(selector, '--shadow-color')).toBe(`rgba(0, 0, 0, ${palette.shadow})`);
    };
    check(':root', PALETTES.light);
    check('.dark', PALETTES.dark);
    expect(value('.device-icon', 'opacity')).toBe(String(PALETTES.light.iconOpacity));
    expect(value('.dark .device-icon', 'opacity')).toBe(String(PALETTES.dark.iconOpacity));
    expect(value('.presentation-verdict.tone-ok', 'color')).toBe(PALETTES.light.toneOk);
    expect(value('.presentation-verdict.tone-ko', 'color')).toBe(PALETTES.light.toneKo);
    expect(value('.presentation-verdict.tone-unknown', 'color')).toBe(PALETTES.light.toneUnknown);
    expect(value('.dark .presentation-verdict.tone-ok', 'color')).toBe(PALETTES.dark.toneOk);
    expect(value('.dark .presentation-verdict.tone-ko', 'color')).toBe(PALETTES.dark.toneKo);
    expect(value('.dark .presentation-verdict.tone-unknown', 'color')).toBe(PALETTES.dark.toneUnknown);
  });

  it('the themes of the app have the accents of the picture', () => {
    const check = (selector: string, colors: { accent: string; secondary: string }) => {
      expect(value(selector, '--accent-color')).toBe(colors.accent);
      expect(value(selector, '--secondary-color')).toBe(colors.secondary);
    };
    check('body[data-theme="pixelcake"]', ACCENTS.pixelcake.light);
    check('.dark body[data-theme="pixelcake"]', ACCENTS.pixelcake.dark);
    check('body[data-theme="modern-tech"]', ACCENTS['modern-tech'].light);
    check('.dark body[data-theme="modern-tech"]', ACCENTS['modern-tech'].dark);
    expect(value('.device-role-source', 'background-color')).toBe('var(--accent-color)');
    expect(value('.device-role-target', 'background-color')).toBe('var(--secondary-color)');
  });

  it('a failure and a stop have the colours of the picture', () => {
    expect(value('.network-device.device-failed', 'border-color')).toBe(MARK_COLORS.failure);
    expect(value('.device-failed-badge', 'background-color')).toBe(MARK_COLORS.failure);
    expect(value('.edge-cut-mark', 'background-color')).toBe(MARK_COLORS.failure);
    expect(value('.network-device.device-drop', 'border-color')).toBe(MARK_COLORS.stops);
    expect(value('.network-device.device-failed .device-content', 'opacity')).toBe('0.45');
  });
});

describe('a drawing of some size', () => {
  it('is laid out and written in a moment', () => {
    const devices = Array.from({ length: 400 }, (_, i) =>
      device({
        id: `d${i}`,
        label: `Dispositivo ${i}`,
        ip: `10.0.${Math.floor(i / 250)}.${i % 250}`,
        position: { x: (i % 20) * 180, y: Math.floor(i / 20) * 180 },
      })
    );
    const connections = devices.slice(1).map((d, i) => link(devices[i].id, d.id, { bandwidth: '1 Gbps' }));
    const iconOf = vi.fn(() => SQUARE);

    const started = performance.now();
    const image = renderDrawingImage(input({ devices, connections, iconOf }), LIGHT);
    const took = performance.now() - started;

    const doc = parse(image.svg);
    expect(deviceGroups(doc)).toHaveLength(400);
    expect(cablePaths(doc)).toHaveLength(399);
    expect(took).toBeLessThan(3000);
  });
});
