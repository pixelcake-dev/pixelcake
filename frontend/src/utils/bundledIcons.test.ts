/**
 * The app must show its icons without the network: every icon name written
 * in the source has to be in the generated bundle. When this fails after
 * adding an icon, run `pnpm icons:bundle`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { iconLoaded } from '@iconify/react';
import { BUNDLED_ICON_COLLECTIONS, BUNDLED_ICON_SETS } from '@/data/bundledIcons';
import { registerBundledIcons } from '@/utils/bundledIcons';
import { useTemplateStore } from '@/store/templateStore';
import { isDrawingId } from '@/utils/deviceDrawing';

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
    expect(used.size).toBeGreaterThan(15);
    expect(used.has('mdi:license')).toBe(true);
    expect(used.has('lucide:folder')).toBe(true);
  });

  it('contains every icon name used in the source', () => {
    const bundled = bundledNames();
    const missing = [...iconNamesInSource()]
      .filter(([name]) => !bundled.has(name))
      .map(([name, file]) => `${name} (${file})`);
    expect(missing).toEqual([]);
  });

  it('no device is drawn with an icon of a set: every template the app comes with names its drawing', () => {
    const named = useTemplateStore.getState().templates.map((template) => [template.id, template.icon]);
    expect(named.filter(([, icon]) => !isDrawingId(icon))).toEqual([]);
  });

  it('bundles only the sets the source uses, every one of them', () => {
    const used = new Set([...iconNamesInSource().keys()].map((name) => name.split(':')[0]));
    expect([...used].sort()).toEqual([...BUNDLED_ICON_SETS].sort());
    expect(BUNDLED_ICON_COLLECTIONS.map((collection) => collection.prefix)).toEqual(BUNDLED_ICON_SETS);
  });

  it('bundles no icon the source does not use, but what a used one is made from', () => {
    const used = new Set(iconNamesInSource().keys());
    // (a name can be another name of an icon: the icon it stands for comes with it)
    for (const collection of BUNDLED_ICON_COLLECTIONS) {
      for (const [name, alias] of Object.entries(collection.aliases ?? {})) {
        if (used.has(`${collection.prefix}:${name}`)) used.add(`${collection.prefix}:${alias.parent}`);
      }
    }
    expect([...bundledNames()].filter((name) => !used.has(name))).toEqual([]);
  });

  it('does not report an unknown icon as loaded', () => {
    expect(iconLoaded('mdi:this-icon-does-not-exist')).toBe(false);
  });
});
