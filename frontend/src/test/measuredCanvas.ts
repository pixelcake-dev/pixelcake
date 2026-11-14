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

interface Size {
  width: number;
  height: number;
}

/** The size every node of the canvas is given */
export const NODE_SIZE: Size = { width: 70, height: 68 };
/** The size of the canvas itself */
export const CANVAS_SIZE: Size = { width: 1000, height: 600 };

export interface Measurements {
  /** How many times React Flow has asked for the size of a node so far */
  asked: () => number;
  /** Give a node another size and tell whoever watches it, as a browser does when it grows */
  resize: (node: Element, size: Size) => void;
}

/**
 * Stub what the canvas needs of a browser, sizes included. Undone with
 * `vi.unstubAllGlobals()` and `vi.restoreAllMocks()` at the end of the test.
 */
export function stubMeasuringBrowser(): Measurements {
  let asked = 0;
  const resized = new WeakMap<Element, Size>();
  const watchers = new Set<{ tell: (target: Element) => void; targets: Set<Element> }>();

  const sizeOf = (element: HTMLElement, side: keyof Size): number => {
    const own = resized.get(element);
    if (own) return own[side];
    // (a node that is given a size in its style, as an area is, has that one)
    if (element.classList.contains('react-flow__node')) return parseFloat(element.style[side]) || NODE_SIZE[side];
    if (element.classList.contains('react-flow__renderer')) return CANVAS_SIZE[side];
    return 0;
  };

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
  // The canvas has a place on the page too: React Flow moves the view by
  // itself while something is dragged near its border, and a canvas of no
  // size is all border
  const placeOf = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.classList.contains('react-flow')) return placeOf.call(this);
    return new DOMRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);
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
      private readonly watcher: { tell: (target: Element) => void; targets: Set<Element> };

      constructor(report: ResizeObserverCallback) {
        this.watcher = {
          targets: new Set(),
          tell: (target) => report([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver),
        };
        watchers.add(this.watcher);
      }

      observe(target: Element) {
        if (target.classList.contains('react-flow__node')) asked++;
        this.watcher.targets.add(target);
        // (a browser reports the first size a moment later, not at once)
        setTimeout(() => {
          if (this.watcher.targets.has(target) && target.isConnected) this.watcher.tell(target);
        }, 0);
      }

      unobserve(target: Element) {
        this.watcher.targets.delete(target);
      }

      disconnect() {
        this.watcher.targets.clear();
        watchers.delete(this.watcher);
      }
    }
  );

  return {
    asked: () => asked,
    resize: (node, size) => {
      resized.set(node, size);
      watchers.forEach((watcher) => {
        if (watcher.targets.has(node)) watcher.tell(node);
      });
    },
  };
}
