/**
 * What React Flow draws on the canvas by itself — the zoom buttons, the
 * small map, the credit — and the theme.
 *
 * jsdom does not lay a page out and does not paint: what can be checked
 * here is the style sheet (that those panels take the colours of the theme,
 * with selectors that outrank React Flow's own, and that the credit fits
 * under the zoom buttons) and that the three are on the canvas at all. How
 * they look is checked by eye in the browser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import styleSheet from '../../index.css?raw';
import flowSheet from 'reactflow/dist/style.css?raw';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import NetworkCanvas from './NetworkCanvas';

const clean = (sheet: string) => sheet.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
const ours = clean(styleSheet);
const theirs = clean(flowSheet);

/** The declarations of the first rule with exactly this selector */
function rule(sheet: string, selector: string): Record<string, string> {
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

/** The rules that put the theme on React Flow's panels, by what they dress */
const THEMED = [
  '.react-flow .react-flow__controls',
  '.react-flow .react-flow__controls-button',
  '.react-flow .react-flow__controls-button svg',
  '.react-flow .react-flow__controls-button:hover',
  '.react-flow .react-flow__controls-button:hover svg',
  '.react-flow .react-flow__minimap',
  '.react-flow .react-flow__minimap-mask',
  '.react-flow .react-flow__attribution',
  '.react-flow .react-flow__attribution a',
];

/** The variables that change with light and dark, and those of the colour themes */
const LIGHT_AND_DARK = [':root', '.dark'];
const COLOUR_THEMES = [
  'body[data-theme="pixelcake"]',
  '.dark body[data-theme="pixelcake"]',
  'body[data-theme="modern-tech"]',
  '.dark body[data-theme="modern-tech"]',
];

describe('the panels React Flow draws follow the theme (style sheet)', () => {
  it('React Flow colours them itself, in light colours only: that is what has to be outranked', () => {
    expect(rule(theirs, '.react-flow__controls-button').background).toBe('#fefefe');
    expect(rule(theirs, '.react-flow__controls-button:hover').background).toBe('#f4f4f4');
    expect(rule(theirs, '.react-flow__minimap')['background-color']).toBe('#fff');
    expect(rule(theirs, '.react-flow__attribution').background).toBe('rgba(255, 255, 255, 0.5)');
    expect(rule(theirs, '.react-flow__attribution a').color).toBe('#999');
  });

  it.each(THEMED)('%s takes every colour from the variables of the theme', selector => {
    // one class more than React Flow's own selector: its sheet comes later
    expect(selector.startsWith('.react-flow .react-flow__')).toBe(true);
    const declarations = rule(ours, selector);
    const colours = Object.entries(declarations).filter(([property]) =>
      /^(background|background-color|border|border-bottom|box-shadow|color|fill)$/.test(property)
    );

    expect(colours.length).toBeGreaterThan(0);
    for (const [property, value] of colours) {
      expect(value, `${selector} ${property}`).toMatch(/var\(--[a-z-]+\)/);
      expect(value, `${selector} ${property}`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    }
  });

  it('every variable they use has a value in light and in dark, and in both colour themes', () => {
    const used = new Set(
      THEMED.flatMap(selector => Object.values(rule(ours, selector)))
        .flatMap(value => [...value.matchAll(/var\((--[a-z-]+)\)/g)])
        .map(match => match[1])
    );
    expect([...used].sort()).toEqual([
      '--accent-color',
      '--accent-color-light',
      '--bg-canvas',
      '--bg-toolbar',
      '--border-color',
      '--shadow-color',
      '--text-color',
      '--text-color-light',
    ]);

    for (const variable of used) {
      const blocks = variable.startsWith('--accent') ? COLOUR_THEMES : LIGHT_AND_DARK;
      for (const block of blocks) {
        expect(rule(ours, block), `${variable} in ${block}`).toHaveProperty(variable);
      }
    }
  });

  it('the icons of the zoom buttons take a colour of the theme, also under the mouse', () => {
    expect(rule(ours, '.react-flow .react-flow__controls-button svg').fill).toBe('var(--text-color)');
    expect(rule(ours, '.react-flow .react-flow__controls-button:hover svg').fill).toBe(
      'var(--accent-color)'
    );
  });

  it('the view stays clear on the small map: only what is outside it is veiled', () => {
    // the veil is a see-through black in both themes, on the background of the map
    expect(rule(ours, '.react-flow .react-flow__minimap-mask').fill).toBe('var(--shadow-color)');
    expect(rule(ours, ':root')['--shadow-color']).toMatch(/^rgba\(0, 0, 0, 0\.\d+\)$/);
    expect(rule(ours, '.dark')['--shadow-color']).toMatch(/^rgba\(0, 0, 0, 0\.\d+\)$/);
  });

  it('the credit fits in the margin under the zoom buttons', () => {
    const px = (value: string) => {
      const found = /^(\d+(?:\.\d+)?)px/.exec(value);
      if (!found) throw new Error(`not a length in px: "${value}"`);
      return Number(found[1]);
    };
    const credit = { ...rule(theirs, '.react-flow__attribution'), ...rule(ours, '.react-flow .react-flow__attribution') };
    // the zoom buttons start this far from the bottom of the canvas...
    const margin = px(rule(theirs, '.react-flow__panel').margin);
    // ...and the credit, in the corner under them, is one line and its padding
    const lineHeight = Number(credit['line-height']);
    expect(Number.isFinite(lineHeight)).toBe(true);
    const height = px(credit['font-size']) * lineHeight + 2 * px(credit.padding);

    expect(margin).toBe(15);
    expect(height).toBeLessThan(margin);
  });
});

describe('the panels React Flow draws are on the canvas', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pixelcake-hide-welcome', 'true');
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    usePresentationStore.getState().exit();
    createNewProject({ name: 'Sede Milano' });
    useNetworkStore.getState().addDevice({
      type: 'PC',
      label: 'PC-1',
      ip: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      position: { x: 0, y: 0 },
    });
  });

  afterEach(() => {
    act(() => usePresentationStore.getState().exit());
    vi.unstubAllGlobals();
  });

  const renderCanvas = () =>
    render(
      <ReactFlowProvider>
        <NetworkCanvas />
      </ReactFlowProvider>
    );
  const credit = () => document.querySelector<HTMLAnchorElement>('.react-flow__attribution a');
  const zoomButtons = () => document.querySelectorAll('.react-flow__controls-button').length;

  it('while building: zoom buttons, small map, and the credit to React Flow', () => {
    renderCanvas();

    expect(zoomButtons()).toBe(4);
    expect(document.querySelector('.react-flow__minimap')).not.toBeNull();
    expect(document.querySelector('.react-flow__minimap-mask')).not.toBeNull();
    // the credit is never hidden: it is there, as a link, in the corner of the zoom buttons
    expect(credit()?.textContent).toBe('React Flow');
    expect(credit()?.href).toBe('https://reactflow.dev/');
    expect(credit()?.parentElement?.className).toContain('bottom left');
    // all of them inside the element the rules of the theme start from
    for (const panel of ['controls', 'minimap', 'attribution']) {
      expect(document.querySelector(`.react-flow .react-flow__${panel}`), panel).not.toBeNull();
    }
  });

  it('while presenting: the zoom buttons without the lock, no small map, the credit still', () => {
    act(() => usePresentationStore.getState().enter());
    renderCanvas();

    expect(zoomButtons()).toBe(3);
    expect(document.querySelector('.react-flow__minimap')).toBeNull();
    expect(credit()?.textContent).toBe('React Flow');
  });
});
