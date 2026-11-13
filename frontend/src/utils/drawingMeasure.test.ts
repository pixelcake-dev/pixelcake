/**
 * What the picture of a drawing asks the browser: how large each device is on
 * screen, what its icon looks like, how wide a text is.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { addIcon } from '@iconify/react';
import { FONT_FAMILY, approximateTextWidth } from './drawingImage';
import { createTextMeasure, iconShapeOf, measureDeviceSizes } from './drawingMeasure';

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
    addNode(document.body, 'dev-0', { width: 120, height: 117 });
    addNode(document.body, 'dev-1', { width: 188, height: 101 });

    expect([...measureDeviceSizes()]).toEqual([
      ['dev-0', { width: 120, height: 117 }],
      ['dev-1', { width: 188, height: 101 }],
    ]);
  });

  it('gives a device its everyday size when the screen shows it with a thicker border', () => {
    addNode(document.body, 'selected', { width: 122, height: 119 }, { node: 'selected' });
    addNode(document.body, 'magnified', { width: 122, height: 119 }, { box: 'device-magnified' });
    addNode(document.body, 'plain', { width: 120, height: 117 }, { box: 'device-dimmed' });

    const sizes = measureDeviceSizes();
    expect(sizes.get('selected')).toEqual({ width: 120, height: 117 });
    expect(sizes.get('magnified')).toEqual({ width: 120, height: 117 });
    expect(sizes.get('plain')).toEqual({ width: 120, height: 117 });
  });

  it('leaves out what is not laid out yet, and what is not a device', () => {
    addNode(document.body, 'ready', { width: 120, height: 117 });
    addNode(document.body, 'not-yet', { width: 0, height: 0 });
    addNode(document.body, null, { width: 120, height: 117 });

    expect([...measureDeviceSizes().keys()]).toEqual(['ready']);
  });

  it('looks only where it is told to', () => {
    const one = document.createElement('div');
    const other = document.createElement('div');
    document.body.append(one, other);
    addNode(one, 'here', { width: 120, height: 117 });
    addNode(other, 'elsewhere', { width: 120, height: 117 });

    expect([...measureDeviceSizes(one).keys()]).toEqual(['here']);
    expect(measureDeviceSizes(document.createElement('div')).size).toBe(0);
  });
});

describe('iconShapeOf', () => {
  it('gives the shape of an icon shipped with the app', () => {
    const shape = iconShapeOf('mdi:router-network');
    expect(shape).toMatchObject({ width: 24, height: 24, left: 0, top: 0 });
    expect(shape?.body).toContain('<path');
  });

  it('has nothing for an icon the app does not have', () => {
    expect(iconShapeOf('nope:nothing-like-this')).toBeNull();
    expect(iconShapeOf('')).toBeNull();
  });

  it('refuses an icon that is more than a drawing', () => {
    addIcon('pctest:plain', { body: '<path d="M0 0h8v8H0z"/>', width: 8, height: 8 });
    addIcon('pctest:script', { body: '<script>alert(1)</script><path d="M0 0"/>', width: 8, height: 8 });
    addIcon('pctest:remote', { body: '<image href="https://example.com/x.png"/>', width: 8, height: 8 });

    expect(iconShapeOf('pctest:plain')).toEqual({
      body: '<path d="M0 0h8v8H0z"/>',
      width: 8,
      height: 8,
      left: 0,
      top: 0,
    });
    expect(iconShapeOf('pctest:script')).toBeNull();
    expect(iconShapeOf('pctest:remote')).toBeNull();
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
    expect(measure('R-Sede', { size: 14, weight: 600 })).toBe(42);
    expect(measure('10.0.0.1', { size: 12.24, weight: 400 })).toBe(56);
    expect(fonts).toEqual([`600 14px ${FONT_FAMILY}`, `400 12.24px ${FONT_FAMILY}`]);
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
