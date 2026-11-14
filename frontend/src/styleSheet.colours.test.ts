/**
 * The colours of the interface, as rules that hold for every component:
 * a colour comes from the theme, by the name of one of its variables; every
 * variable that is used has a value, in light and in dark; and the few places
 * the exported picture copies are written the way the picture expects.
 * How it all looks is checked by eye in the browser.
 */

import { describe, it, expect } from 'vitest';
import styleSheet from './index.css?raw';

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The components, without their tests */
const components = Object.entries(sources).filter(
  ([path]) => path.endsWith('.tsx') && !path.endsWith('.test.tsx')
);

const sheet = styleSheet.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');

/** The variables a block of the style sheet gives a value to */
function variablesOf(selector: string): Set<string> {
  const names = new Set<string>();
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const block of sheet.matchAll(new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^{}]*)\\}`, 'g'))) {
    for (const declaration of block[1].matchAll(/(--[a-z0-9-]+)\s*:/g)) names.add(declaration[1]);
  }
  return names;
}

const light = variablesOf(':root');
const dark = variablesOf('.dark');

describe('the colours of the interface', () => {
  it('no component takes a colour from a fixed palette: the theme has one for it', () => {
    // text-gray-500, dark:bg-gray-800, border-red-200 and the like: they do not
    // follow the theme, and the exported picture cannot know them
    const palette =
      /\b(?:text|bg|border|ring|fill|stroke|from|to|via|divide|outline|decoration|shadow|accent|caret|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
    const found = components.flatMap(([path, text]) =>
      [...text.matchAll(palette)].map(match => `${path}: ${match[0]}`)
    );
    expect(found).toEqual([]);

    // and nothing styles the dark theme apart: the variables change, the classes do not
    const apart = components.flatMap(([path, text]) =>
      [...text.matchAll(/\bdark:[a-z[]/g)].map(() => path)
    );
    expect(apart).toEqual([]);
  });

  it('every variable a component or the style sheet uses has a value', () => {
    // (set by the code on the element that uses it, not by the theme)
    const setInPlace = new Set(['--animation-duration']);
    const used = new Map<string, string>();
    const written = Object.entries(sources).filter(([path]) => !/\.test\.tsx?$/.test(path));
    for (const [path, text] of [...written, ['index.css', sheet] as const]) {
      for (const match of text.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
        if (!used.has(match[1])) used.set(match[1], path);
      }
    }
    expect(used.size).toBeGreaterThan(20);

    const missing = [...used].filter(([name]) => !light.has(name) && !setInPlace.has(name));
    expect(missing).toEqual([]);
  });

  it('what the light theme sets, the dark one sets too', () => {
    // (the corners are the same in both)
    const same = new Set(['--radius', '--radius-small']);
    expect([...light].filter(name => !dark.has(name) && !same.has(name))).toEqual([]);
    expect([...dark].filter(name => !light.has(name))).toEqual([]);
  });

  it('the accent is one, the orange of the logo, in light and in dark', () => {
    const value = (selector: string, name: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const block = new RegExp(`(?:^|[};])\\s*${escaped}\\s*\\{([^{}]*)\\}`).exec(sheet);
      return new RegExp(`${name}:\\s*([^;]+);`).exec(block?.[1] ?? '')?.[1].trim();
    };
    expect(value(':root', '--accent-color')).toBe('#F07D2A');
    expect(value('.dark', '--accent-color')).toBe('#F07D2A');
    expect(value(':root', '--accent-color-rgb')).toBe('240, 125, 42');
    expect(value('.dark', '--accent-color-rgb')).toBe('240, 125, 42');
    // what is written on it is the graphite of the logo: white could not be read
    expect(value(':root', '--on-accent')).toBe('#22313b');
    expect(value('.dark', '--on-accent')).toBe('#22313b');
  });

  it('nothing white is written on the accent', () => {
    // (a fill of the accent takes --on-accent for what is written on it)
    const found = components.flatMap(([path, text]) =>
      [...text.matchAll(/bg-\[var\(--accent-color\)\][^'"`]*\btext-white\b|\btext-white\b[^'"`]*bg-\[var\(--accent-color\)\]/g)].map(
        () => path
      )
    );
    expect(found).toEqual([]);
  });

  it('the answer of presentation mode is not a filled block: a rule of its colour, no background', () => {
    for (const tone of ['ok', 'ko', 'unknown']) {
      const rule = new RegExp(`\\.presentation-verdict\\.tone-${tone}\\s*\\{([^{}]*)\\}`).exec(sheet)?.[1] ?? '';
      expect(rule, tone).toMatch(/color:/);
      expect(rule, tone).not.toMatch(/background/);
    }
    const box = /(?:^|[};])\s*\.presentation-verdict\s*\{([^{}]*)\}/.exec(sheet)?.[1] ?? '';
    expect(box).toMatch(/border-left:\s*3px solid currentColor/);
    expect(box).not.toMatch(/background/);
  });

  it('the label of a cable takes its four colours from the theme, as the picture draws it', () => {
    const edge = sources['/src/components/Canvas/CustomEdge.tsx'];
    const label = /className="edge-label[\s\S]*?<\/EdgeLabelRenderer>/.exec(edge)?.[0] ?? '';
    expect(label).toContain('bg-[var(--bg-canvas)]');
    expect(label).toContain('border-[var(--border-color)]');
    expect(label).toContain('text-[var(--text-color)]');
    expect(label).toContain('text-[var(--text-color-light)]');
  });

  it('the address under the name of a device has the colour the style sheet gives it', () => {
    // (a class of its own here would win over the style sheet in dark only,
    // and the picture would show another grey)
    const device = sources['/src/components/Canvas/NetworkDevice.tsx'];
    const address = /<span className="device-ip[^"]*">/.exec(device)?.[0] ?? '';
    expect(address).not.toBe('');
    expect(address).not.toMatch(/text-\[|text-(?:gray|slate)/);
  });
});
