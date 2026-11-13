/**
 * Two things about the interface that only the style sheet decides, and that
 * jsdom cannot see drawn: when the connection points of a device are visible,
 * and where the name of a sidebar button is placed. The rules are read from
 * the style sheet; how they look is checked by eye in the browser.
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

describe('the connection points of a device (style sheet)', () => {
  it('are hidden at rest: the drawing is not covered with marks', () => {
    expect(rule('.connect-point::after').opacity).toBe('0');
  });

  it('show on the device under the pointer and on a selected one', () => {
    const shown = rule('.react-flow__node:hover .connect-point::after,\n.react-flow__node.selected .connect-point::after');
    expect(shown.opacity).toBe('1 !important');
  });

  it('show on every device while a cable is being dragged', () => {
    expect(rule('body.react-flow-connecting .connect-point::after').opacity).toBe('1 !important');
  });

  it('can always be reached: the area that takes the pointer is not hidden with the mark', () => {
    const area = rule('.connect-point');
    expect(area.opacity).toBe('1 !important');
    expect(area['pointer-events']).toBe('all !important');
    // the mark itself never takes the pointer, shown or not
    expect(rule('.connect-point::after')['pointer-events']).toBe('none');
  });

  it('are not there at all while presenting', () => {
    const hidden = rule(
      '.presenting .react-flow__node .connect-point::after,\n.presenting .react-flow__node:hover .connect-point::after'
    );
    expect(hidden.display).toBe('none');
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
