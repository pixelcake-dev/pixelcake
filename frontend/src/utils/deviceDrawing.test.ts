/**
 * The drawing of a device outside the canvas of the app: which one a device
 * has among the templates of a project, and a drawing as markup with its
 * colours written in, which is what the exported picture is made of.
 * (Which drawing a template has is in components/ui/DeviceDrawing.test.tsx.)
 */

import { describe, it, expect } from 'vitest';
import { DEVICE_DRAWINGS, DEVICE_DRAWING_IDS } from '@/data/deviceDrawings';
import {
  deviceState,
  drawingMarkup,
  drawingOfDevice,
  drawingWindows,
  type DeviceFacts,
} from './deviceDrawing';

const COLOURS = { lower: '#111111', state: '#222222', ground: '#eeeeee' };

describe('the one state the upper layer of a device tells', () => {
  it('is nothing when nothing is true of the device', () => {
    expect(deviceState({})).toBe('rest');
    expect(
      deviceState({ failed: false, stopsHere: false, arrivesHere: false, selected: false, waiting: false })
    ).toBe('rest');
  });

  it('is each thing when it alone is true', () => {
    expect(deviceState({ failed: true })).toBe('off');
    expect(deviceState({ stopsHere: true })).toBe('error');
    expect(deviceState({ arrivesHere: true })).toBe('ok');
    expect(deviceState({ selected: true })).toBe('selected');
    expect(deviceState({ waiting: true })).toBe('warning');
  });

  it('when more is true: off, then where the answer stops, where it arrives, selected, to be put right', () => {
    const order: Array<[keyof DeviceFacts, string]> = [
      ['failed', 'off'],
      ['stopsHere', 'error'],
      ['arrivesHere', 'ok'],
      ['selected', 'selected'],
      ['waiting', 'warning'],
    ];
    // each wins over all that come after it, however many of them are true
    order.forEach(([fact, state], index) => {
      const facts: DeviceFacts = { [fact]: true };
      for (const [later] of order.slice(index + 1)) {
        expect(deviceState({ [fact]: true, [later]: true })).toBe(state);
        facts[later] = true;
      }
      expect(deviceState(facts)).toBe(state);
    });
  });
});

function parse(markup: string): Element {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    'image/svg+xml'
  );
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc.documentElement;
}

const shapeCount = (markup: string) => (markup.match(/<(rect|circle|ellipse|path)\b/g) ?? []).length;

describe('the drawing of a device among the templates of a project', () => {
  const templates = [
    { id: 'custom-1', type: 'Server', icon: 'laptop' },
    { id: 'tpl-server', type: 'Server', icon: 'mdi:server' },
    { id: 'tpl-nas', type: 'Database', icon: 'mdi:nas' },
  ];

  it('is the one of the template it was made from', () => {
    expect(drawingOfDevice({ type: 'Database', templateId: 'tpl-nas' }, templates)).toBe('nas');
    expect(drawingOfDevice({ type: 'Server', templateId: 'tpl-server' }, templates)).toBe('server');
    expect(drawingOfDevice({ type: 'Server', templateId: 'custom-1' }, templates)).toBe('laptop');
  });

  it('with no template, the one of the first template of its type, as the canvas has always chosen', () => {
    expect(drawingOfDevice({ type: 'Server' }, templates)).toBe('laptop');
    expect(drawingOfDevice({ type: 'Database' }, templates)).toBe('nas');
  });

  it('with a template that is not there, or no template of its type, the one of its type', () => {
    expect(drawingOfDevice({ type: 'Router', templateId: 'tpl-of-another-file' }, templates)).toBe('router');
    expect(drawingOfDevice({ type: 'Firewall' }, templates)).toBe('firewall');
    expect(drawingOfDevice({ type: 'Firewall' }, [])).toBe('firewall');
    // and a plain machine for a type the app does not know
    expect(drawingOfDevice({ type: 'Quantum' }, templates)).toBe('server');
  });
});

describe('a drawing as markup, with its colours written in', () => {
  it('is its shapes three times: whole, through the window of the upper layer, through the one of the cut', () => {
    const drawn = parse(drawingMarkup('router', COLOURS, 'doc'));
    const [whole, upper, cut] = [...drawn.children];
    expect([...drawn.children].map((pass) => pass.tagName)).toEqual(['g', 'g', 'g']);

    const shapes = shapeCount(DEVICE_DRAWINGS.router.shapes);
    expect(shapes).toBeGreaterThan(1);
    for (const pass of [whole, upper, cut]) expect(pass.children).toHaveLength(shapes);

    expect(whole.hasAttribute('clip-path')).toBe(false);
    expect(upper.getAttribute('clip-path')).toBe('url(#doc-router-upper)');
    expect(cut.getAttribute('clip-path')).toBe('url(#doc-router-cut)');
  });

  it('the lower layer, the state and the ground are where the drawing has its layers and what is on them', () => {
    const fills = (pass: Element) => [...pass.children].map((shape) => shape.getAttribute('fill'));
    const kinds = [...DEVICE_DRAWINGS.pc.shapes.matchAll(/class="([lg])"/g)].map((found) => found[1]);
    // a computer: its case, the screen cut out of it, its neck, its foot
    expect(kinds).toEqual(['l', 'g', 'l', 'l']);

    const [whole, upper, cut] = [...parse(drawingMarkup('pc', COLOURS, 'doc')).children];
    expect(fills(whole)).toEqual(['#111111', '#eeeeee', '#111111', '#111111']);
    expect(fills(upper)).toEqual(['#222222', '#eeeeee', '#222222', '#222222']);
    // the cut is the ground all through
    expect(fills(cut)).toEqual(['#eeeeee', '#eeeeee', '#eeeeee', '#eeeeee']);
  });

  it.each(DEVICE_DRAWING_IDS)('%s: nothing is left to a style sheet, and nothing but its own shapes is there', (id) => {
    const markup = drawingMarkup(id, COLOURS, 'doc');
    expect(markup).not.toContain('class=');
    expect(markup).not.toContain('var(');
    expect(markup).not.toContain('currentColor');
    expect(shapeCount(markup)).toBe(3 * shapeCount(DEVICE_DRAWINGS[id].shapes));
    const drawn = parse(markup);
    for (const shape of drawn.querySelectorAll('rect, circle, ellipse, path')) {
      expect(['#111111', '#222222', '#eeeeee']).toContain(shape.getAttribute('fill'));
    }
    // the same shapes, with a colour where the kind of each was
    const colourless = (text: string) => text.replace(/ (?:class|fill)="[^"]*"/g, '');
    expect(colourless(drawn.children[0].innerHTML.replace(/ xmlns="[^"]*"/g, ''))).toBe(
      colourless(parse(DEVICE_DRAWINGS[id].shapes).innerHTML.replace(/ xmlns="[^"]*"/g, ''))
    );
  });
});

describe('the two windows of a drawing', () => {
  it('are named after the drawing: one as high as its upper layer, one 5 high around the end of it', () => {
    const defs = parse(drawingWindows('router', 'doc'));
    const [upper, cut] = [...defs.children];
    expect([...defs.children].map((window) => [window.tagName, window.getAttribute('id')])).toEqual([
      ['clipPath', 'doc-router-upper'],
      ['clipPath', 'doc-router-cut'],
    ]);
    const box = (window: Element) =>
      ['x', 'y', 'width', 'height'].map((name) => window.querySelector('rect')?.getAttribute(name));
    // the upper layer of a router ends 46 from the top
    expect(DEVICE_DRAWINGS.router.layer).toBe(46);
    expect(box(upper)).toEqual([null, null, '128', '46']);
    expect(box(cut)).toEqual([null, '43.5', '128', '5']);
  });

  it.each(DEVICE_DRAWING_IDS)('%s: what it looks through is what the document has for it', (id) => {
    const windows = [...parse(drawingWindows(id, 'p')).children].map((window) => window.getAttribute('id'));
    const used = [...drawingMarkup(id, COLOURS, 'p').matchAll(/clip-path="url\(#([^)]+)\)"/g)].map(
      (found) => found[1]
    );
    expect(used).toEqual(windows);
    expect(windows).toEqual([`p-${id}-upper`, `p-${id}-cut`]);
  });

  it('two drawings never share a window, nor two documents a name', () => {
    const names = DEVICE_DRAWING_IDS.flatMap((id) =>
      [...drawingWindows(id, 'p').matchAll(/id="([^"]+)"/g)].map((found) => found[1])
    );
    expect(new Set(names).size).toBe(2 * DEVICE_DRAWING_IDS.length);
    expect(drawingWindows('pc', 'a')).not.toBe(drawingWindows('pc', 'b'));
  });
});
