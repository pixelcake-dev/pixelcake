/**
 * The window that adds devices in bulk has a long list between a search
 * field and its two buttons. jsdom lays nothing out, so what keeps the
 * buttons on screen is read from the source: the list is given a height that
 * depends on the height of the window of the browser, not a fixed one. That
 * the buttons are reached on a low window is checked by eye in the browser.
 */

import { describe, it, expect } from 'vitest';
import source from './BulkAddDeviceModal.tsx?raw';

describe('BulkAddDeviceModal (layout)', () => {
  it('the list takes what the browser window leaves it: the buttons under it stay in the dialog', () => {
    const found = /autoHeightMax=(?:\{([^}]*)\}|"([^"]*)")/.exec(source);
    expect(found).not.toBeNull();
    const value = found?.[1] ?? found?.[2] ?? '';

    // never more than 500px, and never more than the dialog (85vh at most) has
    // left once its title, search field, total and buttons are in
    const parts = /^min\(500px, calc\(85vh - (\d+)px\)\)$/.exec(value);
    expect(parts, value).not.toBeNull();
    expect(Number(parts?.[1])).toBeGreaterThanOrEqual(234);
  });
});
