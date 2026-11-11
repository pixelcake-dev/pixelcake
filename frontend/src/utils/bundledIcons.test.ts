/**
 * The app must show its icons without the network: every icon name written
 * in the source has to be in the generated bundle. When this fails after
 * adding an icon, run `pnpm icons:bundle`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { iconLoaded } from '@iconify/react';
import { BUNDLED_ICON_COLLECTIONS, BUNDLED_ICON_SETS } from '@/data/bundledIcons';
import { registerBundledIcons } from '@/utils/bundledIcons';
import { COMMON_NETWORK_ICONS } from '@/data/commonIcons';
import { useTemplateStore } from '@/store/templateStore';

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Same rule as scripts/bundle-icons.mjs: 'set:name' string literals, test files excluded */
function iconNamesInSource(): Map<string, string> {
  const pattern = new RegExp(
    `['"\`]((?:${BUNDLED_ICON_SETS.join('|')}):[a-z0-9]+(?:-[a-z0-9]+)*)['"\`]`,
    'g'
  );
  const found = new Map<string, string>();
  for (const [file, text] of Object.entries(sources)) {
    if (file.endsWith('/data/bundledIcons.ts') || /\.test\.tsx?$/.test(file)) continue;
    for (const match of text.matchAll(pattern)) {
      if (!found.has(match[1])) found.set(match[1], file);
    }
  }
  return found;
}

function bundledNames(): Set<string> {
  const names = new Set<string>();
  for (const collection of BUNDLED_ICON_COLLECTIONS) {
    for (const name of Object.keys(collection.icons)) names.add(`${collection.prefix}:${name}`);
    for (const name of Object.keys(collection.aliases ?? {})) names.add(`${collection.prefix}:${name}`);
  }
  return names;
}

describe('bundled icons', () => {
  beforeAll(() => {
    registerBundledIcons();
  });

  it('finds icon names in the source (the scan itself works)', () => {
    const used = iconNamesInSource();
    expect(used.size).toBeGreaterThan(50);
    expect(used.has('mdi:router-network')).toBe(true);
  });

  it('contains every icon name used in the source', () => {
    const bundled = bundledNames();
    const missing = [...iconNamesInSource()]
      .filter(([name]) => !bundled.has(name))
      .map(([name, file]) => `${name} (${file})`);
    expect(missing).toEqual([]);
  });

  it('makes the icon of every built-in device template available offline', () => {
    const missing = useTemplateStore
      .getState()
      .templates.filter((template) => !iconLoaded(template.icon))
      .map((template) => `${template.name}: ${template.icon}`);
    expect(missing).toEqual([]);
  });

  it('makes every icon offered by the icon picker available offline', () => {
    const missing = COMMON_NETWORK_ICONS.filter((icon) => !iconLoaded(icon.name)).map(
      (icon) => icon.name
    );
    expect(missing).toEqual([]);
  });

  it('does not report an unknown icon as loaded', () => {
    expect(iconLoaded('mdi:this-icon-does-not-exist')).toBe(false);
  });
});
