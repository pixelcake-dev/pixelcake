/**
 * The drawing as a picture: where things go, what they look like, and that
 * what comes out is a document any program can open.
 */

import { describe, it, expect } from 'vitest';
import { Position, getSmoothStepPath } from 'reactflow';
import type { ConnectionTemplate, DeviceTemplate } from '@/types/network';
import { device, link } from '@/test/networkFixtures';
import { drawingMarkup } from '@/utils/deviceDrawing';
import styleSheet from '../index.css?raw';
import {
  ACCENTS,
  DEVICE_METRICS,
  DEVICE_STATE_COLORS,
  FAILED_TEXT_OPACITY,
  FAILURE_BADGE,
  MARK_COLORS,
  PALETTES,
  ROLE_TAG,
  approximateTextWidth,
  deviceSize,
  escapeXml,
  layoutDrawing,
  pixelSize,
  renderDrawingImage,
  scaledSvg,
  wrapText,
  type DrawingInput,
  type DrawingMarks,
  type ImageOptions,
  type TextMeasure,
} from './drawingImage';

/** Half the font size for each letter: easy to do by hand */
const measure: TextMeasure = (text, font) => text.length * font.size * 0.5;

const template = (overrides: Partial<DeviceTemplate> & { id: string }): DeviceTemplate => ({
  name: overrides.id,
  type: 'PC',
  icon: 'pc',
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

/**
 * Two computers one above the other, 104 × 94 each, joined bottom to top.
 * What is drawn of a computer starts 12.5 under the top of its frame, and
 * between 28.75 and 75.25 from its left side: a cable ends 3 off it.
 */
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
/** The drawing of a device, among what its group holds */
const pictureOf = (group: Element) =>
  [...group.children].find(child => (child.getAttribute('transform') ?? '').includes('scale(')) as Element;
/** What a device is drawn with: its three passes (whole, the upper layer, the cut) */
const passes = (group: Element) => [...pictureOf(group).children];
/** The frame drawn around a device, when one is */
const frameOf = (group: Element) =>
  [...group.children].find(child => child.tagName === 'rect' && child.getAttribute('fill') === 'none');
/** The colours something is filled with */
const fills = (scope: Element) =>
  [...new Set([...scope.querySelectorAll('[fill]')].map(shape => shape.getAttribute('fill')))].sort();
/** What is painted behind the name and the address of a device */
const behindTexts = (group: Element) => [...group.children].filter(child => child.tagName === 'rect');

describe('layoutDrawing — devices', () => {
  it('puts a device where the canvas has it', () => {
    const scene = layoutDrawing(
      input({ devices: [device({ id: 'a', ip: '10.0.0.1', position: { x: 100, y: 50 } })] })
    );
    expect(scene.devices[0].box).toEqual({ x: 100, y: 50, width: 104, height: 94 });
  });

  it('gives each the frame of a device: one width, a line less without an address', () => {
    // frame 2, room 6, drawing 48, 3 to the name, name 16, address 14, room 3, frame 2
    expect(deviceSize(true)).toEqual({ width: 104, height: 94 });
    expect(deviceSize(false)).toEqual({ width: 104, height: 80 });

    const boxes = layoutDrawing(
      input({
        devices: [
          device({ id: 'a', label: 'PC-1', ip: '10.0.0.1' }),
          device({ id: 'b', label: 'SW-1', ip: '' }),
          // a long name runs out of the frame: it does not widen it
          device({ id: 'c', label: 'x'.repeat(40), ip: '' }),
        ],
      })
    ).devices.map(({ box }) => [box.width, box.height]);
    expect(boxes).toEqual([
      [104, 94],
      [104, 80],
      [104, 80],
    ]);
  });

  it('shows a device with the drawing the canvas shows it with', () => {
    const scene = layoutDrawing(
      input({
        deviceTemplates: [
          template({ id: 'tpl-nas', type: 'Database', icon: 'mdi:nas' }),
          template({ id: 'custom-1', type: 'Server', icon: 'laptop', isCustom: true }),
          template({ id: 'custom-2', type: 'Router', icon: 'mdi:router', isCustom: true }),
        ],
        devices: [
          device({ id: 'a', type: 'Database', templateId: 'tpl-nas' }),
          device({ id: 'b', type: 'Server', templateId: 'custom-1' }),
          device({ id: 'c', type: 'Router', templateId: 'custom-2' }),
          device({ id: 'd', type: 'PC' }),
          device({ id: 'e', type: 'Switch', templateId: 'tpl-gone' }),
          device({ id: 'f', type: 'Quantum' as never }),
        ],
      })
    );
    expect(scene.devices.map(d => d.drawing)).toEqual([
      // a template the app comes with: its own drawing, whatever its icon says
      'nas',
      // a template that names a drawing
      'laptop',
      // one made before the drawings: the drawing of its type
      'router',
      // no template: the drawing of the type
      'pc',
      'switch',
      // and a plain machine for a type the app does not know
      'server',
    ]);
  });
});

describe('layoutDrawing — cables', () => {
  it('hangs a cable where the screen does: from under the address to just above what is drawn', () => {
    const scene = layoutDrawing(pair());
    const [onScreen] = getSmoothStepPath({
      sourceX: 52,
      sourceY: 94,
      sourcePosition: Position.Bottom,
      targetX: 52,
      targetY: 300 + 12.5,
      targetPosition: Position.Top,
    });
    expect(onScreen.startsWith('M52 94')).toBe(true);
    expect(scene.cables[0].path).toBe(onScreen);
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
    // from the right of the first drawing to the left of the second, at mid height of the drawing
    expect(scene.cables[0].path.startsWith('M75.25 32')).toBe(true);
    expect(scene.cables[0].path.endsWith('L428.75 32')).toBe(true);
  });

  it('ends on what is drawn of each device: a narrow drawing is reached further in than a wide one', () => {
    const scene = layoutDrawing(
      input({
        devices: [
          // a server is drawn narrow and tall, a switch wide and low
          device({ id: 'a', type: 'Server', position: { x: 0, y: 0 } }),
          device({ id: 'b', type: 'Switch', position: { x: 400, y: 0 } }),
        ],
        connections: [
          link('a', 'b', { id: 'side', sourceHandle: 'right', targetHandle: 'left' }),
          link('a', 'b', { id: 'top', sourceHandle: 'top', targetHandle: 'top' }),
        ],
      })
    );
    const [side, top] = scene.cables.map(cable => cable.path);
    // server: drawn from 34 to 94 of 128, from 10 down; switch: from 6 to 122, from 44 down
    expect(side.startsWith(`M${28 + 94 * 0.375 + 3} 32`)).toBe(true);
    expect(side.endsWith(`L${400 + 28 + 6 * 0.375 - 3} 32`)).toBe(true);
    expect(top.startsWith(`M52 ${8 + 10 * 0.375 - 3}`)).toBe(true);
    expect(top.endsWith(`L452 ${8 + 44 * 0.375 - 3}`)).toBe(true);
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
      expect(cable.path.startsWith('M52 12.5')).toBe(true);
      expect(cable.path.endsWith('L52 312.5')).toBe(true);
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
    // the middle of the cable: half way between y 94 and y 312.5
    // 16 letters × 6 = 96, + 8 of padding and 1 of border on each side
    expect(both.label?.box).toEqual({ x: 52 - 57, y: 203.25 - 21, width: 114, height: 42 });
    // 6 letters × 6 = 36 → 54 wide, one line → 26 high
    expect(speed.label?.box).toEqual({ x: 52 - 27, y: 203.25 - 13, width: 54, height: 26 });
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
    expect(scene.devices.map(d => [d.role, d.failed, d.drop, d.state])).toEqual([
      [null, false, false, 'rest'],
      [null, false, false, 'rest'],
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
    // and what the upper layer of each says: nothing, "it stops here", "off"
    expect(scene.devices.map(d => d.state)).toEqual(['rest', 'error', 'off']);
  });

  it('a broken device is not "where the packet stops": the one before it is', () => {
    const scene = triangle(
      marks({ failedDevices: ['b'], route: { links: [], arrives: false, dropDeviceId: 'b' } })
    );
    expect(scene.devices[1]).toMatchObject({ failed: true, drop: false, state: 'off' });
  });

  it('says which device an answer that arrives was asked of: that one, and only while it arrives', () => {
    const states = (given: DrawingMarks) => triangle(given).devices.map(d => d.state);
    const asked = { sourceId: 'a', targetId: 'c' };

    expect(states(marks({ ...asked, route: { links: ['ac'], arrives: true, dropDeviceId: null } }))).toEqual([
      'rest',
      'rest',
      'ok',
    ]);
    expect(states(marks({ ...asked, route: { links: ['ab'], arrives: false, dropDeviceId: 'b' } }))).toEqual([
      'rest',
      'error',
      'rest',
    ]);
    // a question with no answer on screen lights nothing
    expect(states(marks(asked))).toEqual(['rest', 'rest', 'rest']);
    // and a broken device is off even when the answer is said to arrive on it
    expect(
      states(marks({ ...asked, failedDevices: ['c'], route: { links: [], arrives: true, dropDeviceId: null } }))
    ).toEqual(['rest', 'rest', 'off']);
  });
});

describe('layoutDrawing — what the lamps say outside a presentation', () => {
  const states = (overrides: Partial<DrawingInput>) => layoutDrawing(pair(overrides)).devices.map(d => d.state);

  it('nothing, for a drawing nothing is said of', () => {
    expect(states({})).toEqual(['rest', 'rest']);
    expect(states({ waiting: [], answer: null })).toEqual(['rest', 'rest']);
  });

  it('a device that waits for an address nobody gave it is to be put right', () => {
    expect(states({ waiting: ['b'] })).toEqual(['rest', 'warning']);
    expect(states({ waiting: ['a', 'b', 'ghost'] })).toEqual(['warning', 'warning']);
  });

  it('the answer the last question left is on its device: where it arrives, where it stops', () => {
    expect(states({ answer: { arrives: true, deviceId: 'b' } })).toEqual(['rest', 'ok']);
    expect(states({ answer: { arrives: false, deviceId: 'a' } })).toEqual(['error', 'rest']);
    expect(states({ answer: { arrives: true, deviceId: 'ghost' } })).toEqual(['rest', 'rest']);
    // (the device it stops on is where the packet stops, as in a presentation)
    expect(layoutDrawing(pair({ answer: { arrives: false, deviceId: 'a' } })).devices[0].drop).toBe(true);
  });

  it('the answer is told before what is to be put right, as on the canvas', () => {
    expect(states({ waiting: ['a', 'b'], answer: { arrives: false, deviceId: 'b' } })).toEqual([
      'warning',
      'error',
    ]);
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
    expect(scene.bounds).toEqual({ x: -50, y: 20, width: 454, height: 474 });
  });

  it('holds a name, or an address, that runs out of the frame of its device', () => {
    const named = layoutDrawing(input({ devices: [device({ id: 'a', label: 'x'.repeat(30) })] }));
    // 30 letters × 6.25, and 4 of canvas at each end, around the middle of the frame (x 52)
    expect(named.bounds).toMatchObject({ x: 52 - 97.75, width: 195.5 });

    const addressed = layoutDrawing(input({ devices: [device({ id: 'a', ip: '1'.repeat(30) })] }));
    // 30 figures × 5.25, and the same 4
    expect(addressed.bounds).toMatchObject({ x: 52 - 82.75, width: 165.5 });
  });

  it('holds a cable that goes round the outside of its devices', () => {
    // top to top: the cable climbs above both
    const scene = layoutDrawing(
      input({
        devices: [
          device({ id: 'a', ip: '10.0.0.1', position: { x: 0, y: 0 } }),
          device({ id: 'b', ip: '10.0.0.2', position: { x: 300, y: 0 } }),
        ],
        connections: [link('a', 'b', { sourceHandle: 'top', targetHandle: 'top' })],
      })
    );
    expect(scene.bounds.y).toBeLessThan(0);
    expect(scene.bounds.height).toBe(94 - scene.bounds.y);
  });

  it('holds a label wider than everything else, and the badges of a presentation', () => {
    const wide = layoutDrawing(
      pair({
        connections: [
          link('a', 'b', { sourceHandle: 'bottom', targetHandle: 'top', label: 'x'.repeat(60) }),
        ],
      })
    );
    // 60 letters × 6 + 18 = 378, centred on x 52
    expect(wide.bounds.x).toBe(52 - 189);
    expect(wide.bounds.width).toBe(378);

    const marked = layoutDrawing(pair({ marks: marks({ sourceId: 'a', failedDevices: ['a'] }) }));
    // "DA" and the sign of a failure sit on the top of the frame, inside its two sides
    expect(marked.bounds).toMatchObject({ x: 0, y: -7, width: 104 });
  });
});

describe('renderDrawingImage — the document', () => {
  it('is one well-formed SVG of the size it declares, with nothing fetched from elsewhere', () => {
    const image = renderDrawingImage(pair(), LIGHT);
    const doc = parse(image.svg);

    // two devices 104 wide, 394 from top to bottom, 24 of margin all round
    expect(image).toMatchObject({ width: 152, height: 442 });
    expect(root(doc).getAttribute('width')).toBe('152');
    expect(root(doc).getAttribute('height')).toBe('442');
    expect(root(doc).getAttribute('viewBox')).toBe('0 0 152 442');
    expect(root(doc).namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(image.svg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
    // every colour is written in: nothing is left to a style sheet the picture does not have
    expect(image.svg).not.toContain('currentColor');
    expect(image.svg).not.toContain('class=');
    expect(image.svg).not.toContain('var(');
    expect(image.svg).not.toContain('NaN');
    expect(image.svg).not.toContain('undefined');
  });

  it('is the same for the same drawing', () => {
    expect(renderDrawingImage(pair(), LIGHT).svg).toBe(renderDrawingImage(pair(), LIGHT).svg);
  });

  it('draws each device as the canvas does: its drawing, its name, its address, and no box', () => {
    const doc = parse(renderDrawingImage(pair(), LIGHT).svg);
    const [first, second] = deviceGroups(doc);
    expect(texts(first)).toEqual(['A', '10.0.0.1']);
    expect(texts(second)).toEqual(['B', '10.0.0.2']);

    // the drawing is moved by the margin: the frame of the first device starts there
    expect(drawing(doc).getAttribute('transform')).toBe('translate(24 24)');
    // nothing is drawn around a device
    expect(first.querySelector('[stroke]')).toBeNull();

    // the drawing: 128 units drawn 48 wide, in the middle of the frame, 8 from its top
    expect(first.children[0].getAttribute('transform')).toBe('translate(28 8) scale(0.375)');
    expect(first.children[0]).toBe(pictureOf(first));
    const P = PALETTES.light;
    const [whole, upper, cut] = passes(first);
    // whole in the colour of the lower layer, then the upper layer over it,
    // then the cut; what is drawn on the device is the canvas
    expect(fills(whole)).toEqual([P.deviceLower, P.canvas].sort());
    expect(fills(upper)).toEqual([P.deviceUpper, P.canvas].sort());
    expect(fills(cut)).toEqual([P.canvas]);
    expect(whole.hasAttribute('clip-path')).toBe(false);
    expect(upper.getAttribute('clip-path')).toBe('url(#pc-pc-upper)');
    expect(cut.getAttribute('clip-path')).toBe('url(#pc-pc-cut)');

    // name and address in the middle under it, each with the canvas behind
    const [name, address] = [...first.querySelectorAll('text')];
    expect(name.getAttribute('x')).toBe('52');
    expect(name.getAttribute('text-anchor')).toBe('middle');
    expect(name.getAttribute('font-size')).toBe('12.5');
    expect(name.getAttribute('font-weight')).toBe('600');
    expect(name.getAttribute('fill')).toBe(P.text);
    expect(address.getAttribute('fill')).toBe(P.address);
    expect(address.getAttribute('font-size')).toBe('10.5');
    // (an address is in letters of equal width)
    expect(address.getAttribute('font-family')).toContain('monospace');
    expect(name.hasAttribute('font-family')).toBe(false);
    const attrs = (el: Element) => ['x', 'y', 'width', 'height', 'fill'].map(n => el.getAttribute(n));
    const [behindName, behindAddress] = behindTexts(first);
    // "A" is 6.25 wide, the address 42: 4 more at each end; the name 3 under the drawing
    expect(attrs(behindName)).toEqual(['44.88', '59', '14.25', '16', P.canvas]);
    expect(attrs(behindAddress)).toEqual(['27', '75', '50', '14', P.canvas]);
    expect(name.previousElementSibling).toBe(behindName);
    expect(address.previousElementSibling).toBe(behindAddress);
    // each text sits on its line
    expect(Number(name.getAttribute('y'))).toBeGreaterThan(59);
    expect(Number(name.getAttribute('y'))).toBeLessThan(59 + 16);
    expect(Number(address.getAttribute('y'))).toBeGreaterThan(75);
    expect(Number(address.getAttribute('y'))).toBeLessThan(94 - 3);
  });

  it('writes no address line for a device without one', () => {
    const doc = parse(
      renderDrawingImage(input({ devices: [device({ id: 'sw', label: 'SW-1', ip: '' })] }), LIGHT).svg
    );
    expect(texts(deviceGroups(doc)[0])).toEqual(['SW-1']);
    expect(behindTexts(deviceGroups(doc)[0])).toHaveLength(1);
  });

  it('gives each device its own drawing, as the app draws it', () => {
    const P = PALETTES.light;
    const colours = { lower: P.deviceLower, state: P.deviceUpper, ground: P.canvas };
    const image = renderDrawingImage(
      input({
        devices: [
          device({ id: '1', type: 'Router' }),
          device({ id: '2', type: 'Firewall' }),
          device({ id: '3', type: 'Server', templateId: 'tpl-mailserver' }),
        ],
        deviceTemplates: [template({ id: 'tpl-mailserver', type: 'Server', icon: 'mdi:email' })],
      }),
      LIGHT
    );
    for (const id of ['router', 'firewall', 'server-mail'] as const) {
      expect(image.svg).toContain(drawingMarkup(id, colours, 'pc'));
    }
    expect(image.svg).not.toContain(drawingMarkup('pc', colours, 'pc'));
  });

  it('has the two windows of a drawing once, whatever the number of its copies', () => {
    const doc = parse(
      renderDrawingImage(
        input({
          devices: [
            device({ id: '1', type: 'PC' }),
            device({ id: '2', type: 'Router' }),
            device({ id: '3', type: 'PC' }),
          ],
        }),
        LIGHT
      ).svg
    );
    const windows = [...doc.querySelectorAll('svg > defs > clipPath')];
    expect(windows.map(w => w.getAttribute('id'))).toEqual([
      'pc-pc-upper',
      'pc-pc-cut',
      'pc-router-upper',
      'pc-router-cut',
    ]);
    // the upper layer of a computer ends 40 from the top, the one of a router 46;
    // the cut is 5 high, half above and half below that line
    const rect = (w: Element) => ['y', 'width', 'height'].map(n => w.querySelector('rect')?.getAttribute(n));
    expect(windows.map(rect)).toEqual([
      [null, '128', '40'],
      ['37.5', '128', '5'],
      [null, '128', '46'],
      ['43.5', '128', '5'],
    ]);
    // nothing else has a name, and everything that looks through a window finds it
    expect([...doc.querySelectorAll('[id]')]).toHaveLength(4);
    const used = [...doc.querySelectorAll('[clip-path]')].map(el => el.getAttribute('clip-path'));
    expect(used).toEqual([
      'url(#pc-pc-upper)',
      'url(#pc-pc-cut)',
      'url(#pc-router-upper)',
      'url(#pc-router-cut)',
      'url(#pc-pc-upper)',
      'url(#pc-pc-cut)',
    ]);
    // and a picture of no device has no windows at all
    expect(parse(renderDrawingImage(input(), LIGHT).svg).querySelector('defs')).toBeNull();
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
    expect(escapeXml('a\u0000b\u0008c\u000Bd\u001Fe￾f')).toBe('abcdef');
    expect(escapeXml('tab\there\nnew — è 日本 🙂')).toBe('tab\there\nnew — è 日本 🙂');
    const doc = parse(
      renderDrawingImage(input({ devices: [device({ id: 'a', label: 'PC\u0001-\u00011' })] }), LIGHT).svg
    );
    expect(texts(deviceGroups(doc)[0])).toEqual(['PC-1']);
  });

  it('nothing a template says is copied into the picture: not its icon, not its colour', () => {
    const image = renderDrawingImage(
      input({
        devices: [device({ id: 'a', templateId: 'mine' })],
        deviceTemplates: [
          template({
            id: 'mine',
            type: 'PC',
            icon: '"/><script>alert(1)</script>',
            color: '#fff" onload="alert(1)',
            isCustom: true,
          }),
        ],
      }),
      LIGHT
    );
    const doc = parse(image.svg);
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('[onload]')).toBeNull();
    expect(image.svg).not.toContain('alert');
    // the device is shown with the drawing of its type, in the colours of the theme
    const [whole] = passes(deviceGroups(doc)[0]);
    expect(fills(whole)).toEqual([PALETTES.light.deviceLower, PALETTES.light.canvas].sort());
  });
});

describe('renderDrawingImage — theme and background', () => {
  const background = (doc: Document) => doc.querySelector('svg > rect');

  it('is light or dark as asked, whatever the screen shows', () => {
    const light = parse(renderDrawingImage(pair(), { theme: 'light' }).svg);
    const dark = parse(renderDrawingImage(pair(), { theme: 'dark' }).svg);

    expect(background(light)?.getAttribute('fill')).toBe('#ffffff');
    expect(background(dark)?.getAttribute('fill')).toBe('#111315');
    expect(['width', 'height'].map(n => background(dark)?.getAttribute(n))).toEqual(['152', '442']);

    const name = (doc: Document) => deviceGroups(doc)[0].querySelector('text')?.getAttribute('fill');
    expect(name(light)).toBe('#22313b');
    expect(name(dark)).toBe('#f4f6f8');
    expect(cablePaths(dark)[0].getAttribute('stroke')).toBe('#6f7c86');

    // the two layers of a drawing in the colours of the theme, and on them the canvas of the theme
    const layers = (doc: Document) => passes(deviceGroups(doc)[0]).map(fills);
    expect(layers(light)).toEqual([['#22313b', '#ffffff'], ['#5e8096', '#ffffff'], ['#ffffff']]);
    expect(layers(dark)).toEqual([['#111315', '#8fb0c6'], ['#111315', '#c9d8e2'], ['#111315']]);
    // and the canvas behind the name of a device
    expect(behindTexts(deviceGroups(dark)[0])[0].getAttribute('fill')).toBe('#111315');
  });

  it('has no background when asked for none: not behind the page, not behind the texts of a device', () => {
    const solid = renderDrawingImage(pair(), { theme: 'light' });
    const clear = renderDrawingImage(pair(), { theme: 'light', transparent: true });
    const behind = (image: { svg: string }) => deviceGroups(parse(image.svg)).flatMap(behindTexts);

    expect(background(parse(solid.svg))).not.toBeNull();
    expect(background(parse(clear.svg))).toBeNull();
    // a name and an address for each of the two devices
    expect(behind(solid)).toHaveLength(4);
    expect(behind(clear)).toHaveLength(0);

    // it is otherwise the same picture
    expect(clear).toMatchObject({ width: solid.width, height: solid.height });
    const stripped = solid.svg
      .replace('<rect width="152" height="442" fill="#ffffff"/>', '')
      .replace(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="1[46]" fill="#ffffff"\/>/g, '');
    expect(clear.svg).toBe(stripped);
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
    expect(drawing(parse(both.svg)).getAttribute('transform')).toBe(`translate(152 ${24 + 58})`);
  });

  it('gives texts room to be read: a narrow drawing sits in the middle of a wider page', () => {
    const image = renderDrawingImage(pair(), { theme: 'light', title: { name: 'Sede' } });
    // 360 for the text + the margins; the 104 of the drawing in the middle of it
    expect(image.width).toBe(360 + 48);
    expect(drawing(parse(image.svg)).getAttribute('transform')).toBe('translate(152 64)');
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
    // below the drawing (24 of margin + 394 of drawing), one under the other
    const ys = lines.map(line => Number(line.getAttribute('y')));
    expect(ys[0]).toBeGreaterThan(24 + 394);
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
    expect(image.height).toBeGreaterThan(442 + lines.length * 18);
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
  /** The colour of the upper layer of a device: its own, without the canvas drawn on it */
  const lamp = (group: Element, theme: 'light' | 'dark' = 'light') =>
    fills(passes(group)[1]).filter(colour => colour !== PALETTES[theme].canvas);

  it('marks the way of an answer that arrives, keeping the dashes of each cable', () => {
    const doc = presented(marks({ route: { links: ['ab', 'bc'], arrives: true, dropDeviceId: null } }));
    const [ab, bc, ac] = cablePaths(doc);
    expect(attrs(ab, LINE)).toEqual([MARK_COLORS.arrives, '5.5', '8 4', null]);
    expect(attrs(bc, LINE)).toEqual([MARK_COLORS.arrives, '4', null, null]);
    expect(attrs(ac, LINE)).toEqual([PALETTES.light.line, '2.5', null, '0.6']);
  });

  it('marks in another colour the way of an answer that stops, and lights in red the device it stops on', () => {
    const doc = presented(marks({ route: { links: ['ab'], arrives: false, dropDeviceId: 'b' } }));
    expect(attrs(cablePaths(doc)[0], LINE)).toEqual([MARK_COLORS.stops, '5.5', '8 4', null]);

    const [a, b, c] = deviceGroups(doc);
    expect(lamp(b)).toEqual([DEVICE_STATE_COLORS.error]);
    // the others are at rest; and of the drawing only the upper layer says it
    expect(lamp(a)).toEqual([PALETTES.light.deviceUpper]);
    expect(lamp(c)).toEqual([PALETTES.light.deviceUpper]);
    expect(fills(passes(b)[0])).toEqual(fills(passes(a)[0]));
    expect(fills(passes(b)[2])).toEqual(fills(passes(a)[2]));
    // its frame shows too, in the colour of its lamp: b is at (300, 0), 104 by 94,
    // and the line is 2 thick inside it. It is drawn first, under the rest
    const FRAME = ['x', 'y', 'width', 'height', 'rx', 'stroke', 'stroke-width'];
    expect(attrs(frameOf(b) as Element, FRAME)).toEqual(['301', '1', '102', '92', '2', DEVICE_STATE_COLORS.error, '2']);
    expect(b.children[0]).toBe(frameOf(b));
    expect(frameOf(a)).toBeUndefined();
    expect(frameOf(c)).toBeUndefined();
  });

  it('lights in green the device an answer that arrives was asked of, with its frame', () => {
    const doc = presented(
      marks({ sourceId: 'a', targetId: 'c', route: { links: ['ac'], arrives: true, dropDeviceId: null } })
    );
    const [a, b, c] = deviceGroups(doc);
    expect(lamp(c)).toEqual([DEVICE_STATE_COLORS.ok]);
    expect(attrs(frameOf(c) as Element, ['x', 'y', 'width', 'height', 'stroke'])).toEqual([
      '151',
      '301',
      '102',
      '92',
      DEVICE_STATE_COLORS.ok,
    ]);
    // the device it starts from keeps its tag and is otherwise at rest
    expect(lamp(a)).toEqual([PALETTES.light.deviceUpper]);
    expect(frameOf(a)).toBeUndefined();
    expect(lamp(b)).toEqual([PALETTES.light.deviceUpper]);
  });

  it('shows a cut cable broken up and red, with its mark instead of its label', () => {
    const doc = presented(marks({ failedConnections: ['ab'] }));
    expect(attrs(cablePaths(doc)[0], LINE)).toEqual([MARK_COLORS.failure, '4.5', '3 7', '0.9']);
    const labels = drawing(doc).children[1];
    expect(texts(labels)).toEqual([]);
    expect(labels.querySelector('circle')?.getAttribute('fill')).toBe(MARK_COLORS.failure);
    // the cross is drawn, not written: no font has to have the sign
    expect(labels.querySelector('path')?.getAttribute('stroke')).toBe('#ffffff');
  });

  it('shows a broken device with its lamp off, its texts faded and its sign, and its cables faded', () => {
    const doc = presented(marks({ failedDevices: ['b'] }));
    const [ab, bc, ac] = cablePaths(doc);
    expect(attrs(ab, LINE)).toEqual([PALETTES.light.line, '4', '3 7', '0.3']);
    expect(attrs(bc, LINE)).toEqual([PALETTES.light.line, '2.5', '3 7', '0.3']);
    expect(attrs(ac, LINE)).toEqual([PALETTES.light.line, '2.5', null, '0.6']);
    // the label of a faded cable stays
    expect(texts(drawing(doc).children[1])).toEqual(['1 Gbps']);

    const [a, b] = deviceGroups(doc);
    expect(lamp(b)).toEqual([DEVICE_STATE_COLORS.off]);
    // its name and its address fade; its drawing does not
    const faded = b.querySelector(`g[opacity="${FAILED_TEXT_OPACITY}"]`);
    expect(texts(faded as Element)).toEqual(['B', '10.0.0.2']);
    expect(b.children[0].hasAttribute('opacity')).toBe(false);
    // the sign, on the top of the frame at its right: 8 in from the side, 6 above the top
    const sign = b.querySelector('circle');
    expect(attrs(sign as Element, ['cx', 'cy', 'r', 'fill'])).toEqual(['384', '6', '12', MARK_COLORS.failure]);
    expect(sign?.nextElementSibling?.getAttribute('stroke')).toBe('#ffffff');
    // a working device has none of this
    expect(a.querySelector('circle')).toBeNull();
    expect(a.querySelector('[opacity]')).toBeNull();
    expect(lamp(a)).toEqual([PALETTES.light.deviceUpper]);
  });

  it('a state has the same colour in light and in dark', () => {
    const doc = presented(
      marks({ failedDevices: ['c'], route: { links: ['ab'], arrives: false, dropDeviceId: 'b' } }),
      { theme: 'dark' }
    );
    const [a, b, c] = deviceGroups(doc);
    expect(lamp(a, 'dark')).toEqual([PALETTES.dark.deviceUpper]);
    expect(lamp(b, 'dark')).toEqual([DEVICE_STATE_COLORS.error]);
    expect(lamp(c, 'dark')).toEqual([DEVICE_STATE_COLORS.off]);
  });

  it('outside a presentation: yellow for a device that waits for an address, and the answer left on the canvas', () => {
    const doc = parse(
      renderDrawingImage(pair({ waiting: ['a'], answer: { arrives: true, deviceId: 'b' } }), LIGHT).svg
    );
    const [a, b] = deviceGroups(doc);
    expect(lamp(a)).toEqual([DEVICE_STATE_COLORS.warning]);
    // (what is to be put right is said under the name: no frame for it)
    expect(frameOf(a)).toBeUndefined();
    expect(lamp(b)).toEqual([DEVICE_STATE_COLORS.ok]);
    expect(frameOf(b)?.getAttribute('stroke')).toBe(DEVICE_STATE_COLORS.ok);
    // and nothing of a presentation is drawn: no tag, no mark
    expect(doc.querySelector('[letter-spacing]')).toBeNull();
    expect(drawing(doc).querySelector('circle')).toBeNull();
  });

  it('labels the two ends of the question, in the colours of the theme', () => {
    // the mark: its letters, the colour under them, the colour they are written in
    const badges = (doc: Document) =>
      deviceGroups(doc).map(group => {
        // (a device can be called "A" too: the mark is the text set with its letters apart)
        const text = [...group.querySelectorAll('text')].find(t => t.hasAttribute('letter-spacing'));
        return text
          ? [text.textContent, text.previousElementSibling?.getAttribute('fill'), text.getAttribute('fill')]
          : null;
      });
    const asked = marks({ sourceId: 'a', targetId: 'c' });

    expect(badges(presented(asked))).toEqual([
      ['DA', ACCENTS.light.accent, ACCENTS.light.onAccent],
      null,
      ['A', ACCENTS.light.secondary, ACCENTS.light.onSecondary],
    ]);
    expect(badges(presented(asked, { theme: 'dark' }))).toEqual([
      ['DA', ACCENTS.dark.accent, ACCENTS.dark.onAccent],
      null,
      ['A', ACCENTS.dark.secondary, ACCENTS.dark.onSecondary],
    ]);
    expect(badges(presented(marks()))).toEqual([null, null, null]);

    // on the top of the frame at its left: 4 in from the side, 7 above the top, 16 high
    const tag = [...deviceGroups(presented(asked))[2].querySelectorAll('text')].find(t =>
      t.hasAttribute('letter-spacing')
    )?.previousElementSibling as Element;
    expect(attrs(tag, ['x', 'y', 'height'])).toEqual(['154', '293', '16']);
  });
});

describe('scaledSvg and pixelSize', () => {
  it('declares more pixels for the same drawing', () => {
    const image = renderDrawingImage(pair(), LIGHT);
    const doubled = scaledSvg(image, 2);
    const doc = parse(doubled);
    expect(root(doc).getAttribute('width')).toBe('304');
    expect(root(doc).getAttribute('height')).toBe('884');
    expect(root(doc).getAttribute('viewBox')).toBe('0 0 152 442');
    // nothing else changes
    expect(doubled.replace('width="304" height="884"', 'width="152" height="442"')).toBe(image.svg);
    expect(scaledSvg(image, 1)).toBe(image.svg);
  });

  it('gives whole pixels, one at least', () => {
    expect(pixelSize({ width: 168, height: 465 }, 3)).toEqual({ width: 504, height: 1395 });
    expect(pixelSize({ width: 101, height: 33 }, 0.5)).toEqual({ width: 51, height: 17 });
    expect(pixelSize({ width: 10, height: 10 }, 0.01)).toEqual({ width: 1, height: 1 });
    const image = renderDrawingImage(pair(), LIGHT);
    expect(root(parse(scaledSvg(image, 0.5))).getAttribute('width')).toBe('76');
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

  it('gives every letter of an address the same width, six tenths of its size', () => {
    const address = { size: 10, weight: 400, mono: true } as const;
    expect(approximateTextWidth('10.0.0.1', address)).toBe(48);
    expect(approximateTextWidth('iiii', address)).toBe(approximateTextWidth('MMMM', address));
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
  const px = (selector: string, property: string) => {
    const text = value(selector, property);
    expect(text).toMatch(/^-?[\d.]+px$/);
    return parseFloat(text);
  };
  /** #ddd and #DDDDDD are the same colour */
  const hex = (color: string) => {
    const code = color.replace('#', '').toLowerCase();
    return `#${code.length === 3 ? [...code].map(c => c + c).join('') : code}`;
  };

  it('the two themes have the colours of the picture', () => {
    const check = (selector: string, palette: (typeof PALETTES)['light']) => {
      expect(hex(value(selector, '--bg-canvas'))).toBe(palette.canvas);
      expect(hex(value(selector, '--border-color'))).toBe(palette.border);
      expect(hex(value(selector, '--text-color'))).toBe(palette.text);
      expect(hex(value(selector, '--text-color-light'))).toBe(palette.textLight);
      expect(hex(value(selector, '--line-color'))).toBe(palette.line);
      // the two layers of the drawing of a device
      expect(hex(value(selector, '--device-lower'))).toBe(palette.deviceLower);
      expect(hex(value(selector, '--device-upper'))).toBe(palette.deviceUpper);
      // the label of a cable: on screen it takes these four from the theme by name
      // (see the test of the colours of the interface), the picture repeats them
      expect(palette.pillFill).toBe(palette.canvas);
      expect(palette.pillBorder).toBe(palette.border);
      expect(palette.pillStrong).toBe(palette.text);
      expect(palette.pillSoft).toBe(palette.textLight);
      // and the address under the name of a device
      expect(palette.address).toBe(palette.textLight);
    };
    check(':root', PALETTES.light);
    check('.dark', PALETTES.dark);
    // on screen what is drawn on a device is the canvas, and so are the grounds of its texts
    expect(value(':root', '--device-ground')).toBe('var(--bg-canvas)');
    expect(value('.dark', '--device-ground')).toBe('var(--bg-canvas)');
    expect(value('.device-ip', 'color')).toBe('var(--text-color-light)');
    expect(value('.device-name', 'color')).toBe('var(--text-color)');
    expect(value('.presentation-verdict.tone-ok', 'color')).toBe(PALETTES.light.toneOk);
    expect(value('.presentation-verdict.tone-ko', 'color')).toBe(PALETTES.light.toneKo);
    expect(value('.presentation-verdict.tone-unknown', 'color')).toBe(PALETTES.light.toneUnknown);
    expect(value('.dark .presentation-verdict.tone-ok', 'color')).toBe(PALETTES.dark.toneOk);
    expect(value('.dark .presentation-verdict.tone-ko', 'color')).toBe(PALETTES.dark.toneKo);
    expect(value('.dark .presentation-verdict.tone-unknown', 'color')).toBe(PALETTES.dark.toneUnknown);
  });

  it('a state has on screen the colour it has in the picture, in light and in dark', () => {
    for (const theme of [':root', '.dark']) {
      for (const [state, colour] of Object.entries(DEVICE_STATE_COLORS)) {
        expect(hex(value(theme, `--state-${state}`))).toBe(colour);
      }
    }
  });

  it('the app, in light and in dark, has the accents of the picture', () => {
    const check = (selector: string, colors: (typeof ACCENTS)['light']) => {
      expect(value(selector, '--accent-color')).toBe(colors.accent);
      expect(value(selector, '--secondary-color')).toBe(colors.secondary);
      // what is written on each of the two can be read on it
      expect(value(selector, '--on-accent')).toBe(colors.onAccent);
      expect(value(selector, '--on-secondary')).toBe(colors.onSecondary);
    };
    check(':root', ACCENTS.light);
    check('.dark', ACCENTS.dark);
    // one set of colours, and nothing left that picks between sets
    expect(css).not.toContain('data-theme');
    expect(value('.device-role-source', 'background-color')).toBe('var(--accent-color)');
    expect(value('.device-role-target', 'background-color')).toBe('var(--secondary-color)');
    expect(value('.device-role', 'color')).toBe('var(--on-accent)');
    expect(value('.device-role-target', 'color')).toBe('var(--on-secondary)');
  });

  it('what a presentation hangs on a device is where the picture draws it', () => {
    // (the style sheet places them from the inside of the frame, the picture from its outside)
    const border = DEVICE_METRICS.border;
    expect(px('.device-role', 'left') + border).toBe(ROLE_TAG.left);
    expect(px('.device-role', 'top') + border).toBe(ROLE_TAG.top);
    // a line of 14 with 1 above and 1 below
    expect(value('.device-role', 'padding')).toBe('1px 8px');
    expect(px('.device-role', 'line-height') + 2).toBe(ROLE_TAG.height);
    expect(value('.device-role', 'font-size')).toBe('10px');
    expect(value('.device-role', 'letter-spacing')).toBe('0.04em');

    expect(px('.device-failed-badge', 'right') + border).toBe(FAILURE_BADGE.right);
    expect(px('.device-failed-badge', 'top') + border).toBe(FAILURE_BADGE.top);
    expect(px('.device-failed-badge', 'width')).toBe(2 * FAILURE_BADGE.radius);
    expect(px('.device-failed-badge', 'height')).toBe(2 * FAILURE_BADGE.radius);
  });

  it('a failure has the colours of the picture, and fades the texts of its device as much', () => {
    expect(value('.device-failed-badge', 'background-color')).toBe(MARK_COLORS.failure);
    expect(value('.edge-cut-mark', 'background-color')).toBe(MARK_COLORS.failure);
    // (one rule for the name and the address)
    expect(css).toContain(
      '\n.network-device.device-failed .device-name,\n.network-device.device-failed .device-ip {\n'
    );
    expect(value('.network-device.device-failed .device-ip', 'opacity')).toBe(String(FAILED_TEXT_OPACITY));
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

    const started = performance.now();
    const image = renderDrawingImage(input({ devices, connections }), LIGHT);
    const took = performance.now() - started;

    const doc = parse(image.svg);
    expect(deviceGroups(doc)).toHaveLength(400);
    expect(cablePaths(doc)).toHaveLength(399);
    // one pair of windows for the four hundred computers
    expect(doc.querySelectorAll('clipPath')).toHaveLength(2);
    expect(took).toBeLessThan(3000);
  });
});
