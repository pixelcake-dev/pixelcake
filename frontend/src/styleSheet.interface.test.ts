/**
 * Two things about the interface that only the style sheet decides, and that
 * jsdom cannot see drawn: where a cable starts and ends on a device, with
 * the frame that shows around it, and where the name of a sidebar button is
 * placed. The rules are read from the style sheet (the numbers of a device
 * are in utils/deviceGeometry.test.ts); how they look is checked by eye in
 * the browser.
 */

import { describe, it, expect } from 'vitest';
import styleSheet from './index.css?raw';

const sheet = styleSheet.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule with exactly this selector */
function rule(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^{}]*)\\}`).exec(sheet);
  if (!found) throw new Error(`no rule "${selector}"`);
  return Object.fromEntries(
    found[1]
      .split(';')
      .map(declaration => declaration.trim())
      .filter(Boolean)
      .map(declaration => {
        const colon = declaration.indexOf(':');
        return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
      })
  );
}

describe('where a cable starts and ends on a device (style sheet)', () => {
  it('there are no marks on the sides of a device: a connection point is a place, not a thing to look at', () => {
    const point = rule('.react-flow .connect-point');
    expect(point.background).toBe('transparent');
    expect(point.border).toBe('none');
    // and the point itself never takes the pointer
    expect(point['pointer-events']).toBe('none');
  });

  it('the band along each side takes the press, and says so with the pointer; it is never hidden', () => {
    const band = rule('.connect-point::before');
    expect(band['pointer-events']).toBe('auto');
    expect(band.cursor).toBe('crosshair');
    expect(Object.keys(band).sort()).toEqual(['cursor', 'pointer-events']);
    // (band and side are there at all: something with no content is not drawn)
    expect(rule('.connect-point::before,\n.connect-point::after')).toEqual({
      content: "''",
      position: 'absolute',
    });
  });

  it('the side of the frame turns orange only while the pointer is on its band', () => {
    const side = rule('.connect-point::after');
    expect(side['background-color']).toBe('var(--accent-color)');
    expect(side.opacity).toBe('0');
    // (it never takes the pointer from the band under it)
    expect(side['pointer-events']).toBe('none');
    expect(rule('.connect-point:hover::after')).toEqual({ opacity: '1' });
  });

  it('the frame is not seen at rest; it shows under the pointer, with the focus of the keyboard, selected, dragged', () => {
    expect(rule('.network-device').border).toBe('2px solid transparent');
    expect(rule('.react-flow__node:hover .network-device')).toEqual({ 'border-color': 'var(--border-color)' });
    // the focus of the keyboard: the frame in the ink of the theme, instead of the outline of the browser
    expect(rule('.react-flow__node:focus-visible')).toEqual({ outline: 'none' });
    expect(rule('.react-flow__node:focus-visible .network-device')).toEqual({ 'border-color': 'var(--text-color)' });
    expect(rule('.react-flow__node.selected .network-device')['border-color']).toBe(
      'var(--accent-color) !important'
    );
    expect(rule('.react-flow__node.dragging .network-device')).toEqual({ 'border-color': 'var(--accent-color)' });
  });

  it('while a cable is pulled every device shows its frame, and the band under the pointer is tinted', () => {
    expect(rule('body.react-flow-connecting .network-device')).toEqual({ 'border-color': 'var(--border-color)' });
    expect(rule('body.react-flow-connecting .connect-point:hover::before')['background-color']).toBe(
      'rgba(var(--accent-color-rgb), 0.12)'
    );
  });

  it('while presenting nothing starts a cable: the bands go, the points stay for the cables that hang on them', () => {
    expect(rule('.presenting .connect-point::before')).toEqual({ display: 'none' });
    expect(() => rule('.presenting .connect-point')).toThrow();
    expect(sheet).not.toMatch(/\.presenting[^{]*\.connect-point\s*[,{]/);
  });

  it('the texts of a device never take the pointer: a press on them is a press on the device', () => {
    expect(rule('.device-content')['pointer-events']).toBe('none');
  });
});

describe('the name of a sidebar button (style sheet)', () => {
  const layer = (selector: string) => Number(rule(selector)['z-index'].split(';')[0].split(' ')[0]);

  it('is placed on the page, at the point the button gives it, and never takes the pointer', () => {
    const name = rule('.sidebar-tooltip');
    expect(name.position).toBe('fixed');
    expect(name.transform).toBe('translateY(-50%)');
    expect(name['pointer-events']).toBe('none');
    expect(name['white-space']).toBe('nowrap');
  });

  it('is above the panel a button opens and above the menu bar', () => {
    expect(layer('.sidebar-tooltip')).toBeGreaterThan(layer('.sidebar-panel'));
    expect(layer('.sidebar-tooltip')).toBeGreaterThan(layer('.top-menubar'));
  });

  it('takes its colours from the theme, turned round, so it stands out in light and in dark', () => {
    const name = rule('.sidebar-tooltip');
    expect(name['background-color']).toBe('var(--text-color)');
    expect(name.color).toBe('var(--bg-canvas)');
  });
});
