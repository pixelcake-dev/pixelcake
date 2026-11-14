/**
 * For tests of the canvas that need devices with a size.
 *
 * jsdom lays nothing out, so React Flow never learns how large a node is,
 * and without sizes it takes every node as inside any selection box, draws
 * no cable, no rectangle around a selection, and fits no view. Here every
 * node is as large as NODE_SIZE says, and React Flow is told so the way a
 * browser tells it: through the observer it sets on each node, a moment
 * after it asks.
 */

import { vi } from 'vitest';

/** The size every node of the canvas is given */
export const NODE_SIZE = { width: 70, height: 68 };
/** The size of the canvas itself */
export const CANVAS_SIZE = { width: 1000, height: 600 };

export interface Measurements {
  /** How many times React Flow has asked for the size of a node so far */
  asked: () => number;
}

function sizeOf(element: HTMLElement, side: 'width' | 'height'): number {
  if (element.classList.contains('react-flow__node')) return NODE_SIZE[side];
  if (element.classList.contains('react-flow__renderer')) return CANVAS_SIZE[side];
  return 0;
}

/**
 * Stub what the canvas needs of a browser, sizes included. Undone with
 * `vi.unstubAllGlobals()` and `vi.restoreAllMocks()` at the end of the test.
 */
export function stubMeasuringBrowser(): Measurements {
  let asked = 0;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return sizeOf(this, 'width');
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return sizeOf(this, 'height');
  });
  // (React Flow reads the zoom of the view from the transform of the drawing)
  vi.stubGlobal(
    'DOMMatrixReadOnly',
    class {
      m22 = 1;
    }
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly report: ResizeObserverCallback;
      private watching = true;

      constructor(report: ResizeObserverCallback) {
        this.report = report;
      }

      observe(target: Element) {
        if (target.classList.contains('react-flow__node')) asked++;
        setTimeout(() => {
          if (!this.watching || !target.isConnected) return;
          this.report([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }, 0);
      }

      unobserve() {}

      disconnect() {
        this.watching = false;
      }
    }
  );
  return { asked: () => asked };
}
