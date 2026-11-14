/**
 * What is asked of the browser about the drawing on screen: how large each
 * device is, how wide a text is.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { FONT_FAMILY, MONO_FONT_FAMILY, approximateTextWidth } from './drawingImage';
import { createTextMeasure, measureDeviceSizes } from './drawingMeasure';

/** A device as React Flow puts it on the page; jsdom lays nothing out, so sizes are given */
function addNode(
  parent: HTMLElement,
  id: string | null,
  size: { width: number; height: number },
  classes: { node?: string; box?: string } = {}
) {
  const node = document.createElement('div');
  node.className = `react-flow__node ${classes.node ?? ''}`;
  if (id !== null) node.dataset.id = id;
  const box = document.createElement('div');
  box.className = `network-device ${classes.box ?? ''}`;
  Object.defineProperty(box, 'offsetWidth', { value: size.width });
  Object.defineProperty(box, 'offsetHeight', { value: size.height });
  node.appendChild(box);
  parent.appendChild(node);
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('measureDeviceSizes', () => {
  it('reads the size of every device on the canvas', () => {
    addNode(document.body, 'dev-0', { width: 104, height: 94 });
    addNode(document.body, 'dev-1', { width: 104, height: 80 });

    expect([...measureDeviceSizes()]).toEqual([
      ['dev-0', { width: 104, height: 94 }],
      ['dev-1', { width: 104, height: 80 }],
    ]);
  });

  it('takes the frame as it is: a selected device, or one picked out, is as large as any other', () => {
    addNode(document.body, 'selected', { width: 104, height: 94 }, { node: 'selected' });
    addNode(document.body, 'magnified', { width: 104, height: 94 }, { box: 'device-magnified' });
    addNode(document.body, 'plain', { width: 104, height: 94 }, { box: 'device-dimmed' });

    const sizes = measureDeviceSizes();
    expect(sizes.get('selected')).toEqual({ width: 104, height: 94 });
    expect(sizes.get('magnified')).toEqual({ width: 104, height: 94 });
    expect(sizes.get('plain')).toEqual({ width: 104, height: 94 });
  });

  it('leaves out what is not laid out yet, and what is not a device', () => {
    addNode(document.body, 'ready', { width: 104, height: 94 });
    addNode(document.body, 'not-yet', { width: 0, height: 0 });
    addNode(document.body, null, { width: 104, height: 94 });

    expect([...measureDeviceSizes().keys()]).toEqual(['ready']);
  });

  it('looks only where it is told to', () => {
    const one = document.createElement('div');
    const other = document.createElement('div');
    document.body.append(one, other);
    addNode(one, 'here', { width: 104, height: 94 });
    addNode(other, 'elsewhere', { width: 104, height: 94 });

    expect([...measureDeviceSizes(one).keys()]).toEqual(['here']);
    expect(measureDeviceSizes(document.createElement('div')).size).toBe(0);
  });
});

describe('createTextMeasure', () => {
  it('estimates where there is nothing to measure with, without even asking', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    expect(createTextMeasure()).toBe(approximateTextWidth);
    expect(getContext).not.toHaveBeenCalled();
  });

  it('measures with the browser, in the font the picture is written in', () => {
    const fonts: string[] = [];
    const context = {
      set font(value: string) {
        fonts.push(value);
      },
      measureText: (text: string) => ({ width: text.length * 7 }),
    };
    vi.stubGlobal('CanvasRenderingContext2D', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );

    const measure = createTextMeasure();
    expect(measure('R-Sede', { size: 12.5, weight: 600 })).toBe(42);
    // an address is written in the letters of equal width
    expect(measure('10.0.0.1', { size: 10.5, weight: 400, mono: true })).toBe(56);
    expect(measure('1 Gbps', { size: 12, weight: 400, mono: false })).toBe(42);
    expect(fonts).toEqual([
      `600 12.5px ${FONT_FAMILY}`,
      `400 10.5px ${MONO_FONT_FAMILY}`,
      `400 12px ${FONT_FAMILY}`,
    ]);
  });

  it('estimates when the browser has a canvas but will not draw on it', () => {
    vi.stubGlobal('CanvasRenderingContext2D', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(createTextMeasure()).toBe(approximateTextWidth);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('no canvas today');
    });
    expect(createTextMeasure()).toBe(approximateTextWidth);
  });
});
