/**
 * The list of shortcuts is one: the one Settings → Advanced shows is the one
 * the page of the documentation describes, and every key the code listens
 * to has a line in it. A key added to the program without a line fails here.
 */

import { describe, it, expect } from 'vitest';
import { dictionaryOf, type Language } from '@/i18n';
import { SHORTCUT_GROUPS, KEYS_HEARD } from './shortcuts';
import enPage from '../../../documentation/en/reference/shortcuts.md?raw';
import itPage from '../../../documentation/it/reference/shortcuts.md?raw';

const LANGUAGES: Language[] = ['it', 'en'];
const PAGES: Record<Language, string> = { en: enPage, it: itPage };

/** The page of the documentation, in sections: the anchor of each, and its table rows */
function docsTables(lang: Language): Record<string, string[]> {
  const page = PAGES[lang].replace(/\r\n/g, '\n');
  const sections: Record<string, string[]> = {};
  let current: string[] | null = null;
  for (const line of page.split('\n')) {
    const heading = /^## .*\{#([a-z-]+)\}\s*$/.exec(line);
    if (heading) {
      current = sections[heading[1]] = [];
      continue;
    }
    if (current && line.startsWith('|') && !/^\|[-| ]+\|$/.test(line)) current.push(line);
  }
  // (the first line of a table is its head)
  for (const rows of Object.values(sections)) rows.shift();
  return sections;
}

describe('the list of shortcuts', () => {
  const allRows = SHORTCUT_GROUPS.flatMap((group) => group.rows);

  it('holds every line of the dictionary once, and no line the dictionary does not have', () => {
    for (const language of LANGUAGES) {
      const written = Object.keys(dictionaryOf(language).advanced.shortcuts.rows).sort();
      expect([...allRows].sort(), language).toEqual(written);
    }
    expect(new Set(allRows).size).toBe(allRows.length);
  });

  it('has a title for each group, and an action and keys for each line, in both languages', () => {
    for (const language of LANGUAGES) {
      const { groups, rows } = dictionaryOf(language).advanced.shortcuts;
      for (const group of SHORTCUT_GROUPS) expect(groups[group.id], `${language} ${group.id}`).toBeTruthy();
      for (const id of allRows) {
        expect(rows[id].action, `${language} ${id}`).toBeTruthy();
        expect(rows[id].keys, `${language} ${id}`).toBeTruthy();
      }
    }
  });

  it.each(LANGUAGES)('is as long as the tables of the shortcuts page of the documentation, group by group (%s)', (lang) => {
    const tables = docsTables(lang);
    expect(Object.keys(tables).sort()).toEqual(SHORTCUT_GROUPS.map((group) => group.id).sort());
    for (const group of SHORTCUT_GROUPS) {
      expect(group.rows.length, `${lang} ${group.id}`).toBe(tables[group.id].length);
    }
  });

  it.each(LANGUAGES)('says each key as the page of the documentation does (%s)', (lang) => {
    const page = PAGES[lang];
    const { rows } = dictionaryOf(lang).advanced.shortcuts;
    for (const group of SHORTCUT_GROUPS.filter((entry) => entry.id !== 'pointer')) {
      for (const id of group.rows) {
        expect(page, `${lang} ${id}: ${rows[id].keys}`).toContain(rows[id].keys);
      }
    }
  });
});

describe('the keys the code listens to', () => {
  const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >;
  const heard = new Map<string, string[]>();
  for (const [file, source] of Object.entries(sources)) {
    if (/\.test\.tsx?$/.test(file) || file.startsWith('/src/test/')) continue;
    // `event.key === 'Escape'`, `e.key.toLowerCase() === 's'`, `case 'Enter':` after a switch on the key
    const patterns = [
      /\.key(?:\.toLowerCase\(\))?\s*[!=]==\s*'([^']+)'/g,
      /KeyCode=\{[^}]*'([A-Za-z]+)'/g,
      /KeyCode="([A-Za-z]+)"/g,
    ];
    // the letter of a Ctrl shortcut, read whatever Caps Lock says (utils/shortcutKey):
    // `shortcutLetter(event) !== 's'`, or `const letter = shortcutLetter(e)` then `letter === 'v'`
    if (source.includes('shortcutLetter(')) {
      patterns.push(/shortcutLetter\(\w+\)\s*[!=]==\s*'([a-z])'/g, /\bletter\s*[!=]==\s*'([a-z])'/g);
    }
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) heard.set(match[1], [...(heard.get(match[1]) ?? []), file]);
    }
  }

  it('each has a line of the list: a new key is to be listed, and said in the documentation', () => {
    const missing = [...heard.keys()].filter((key) => !(key in KEYS_HEARD));
    expect(missing).toEqual([]);
  });

  it('and the lines it points to are in the list', () => {
    const allRows = new Set<string>(SHORTCUT_GROUPS.flatMap((group) => group.rows));
    const unknown = Object.entries(KEYS_HEARD).flatMap(([key, rows]) =>
      rows.filter((row) => !allRows.has(row)).map((row) => `${key}: ${row}`)
    );
    expect(unknown).toEqual([]);
  });

  it('every key in the table is still listened to somewhere (a key taken out is taken out of the table)', () => {
    const gone = Object.keys(KEYS_HEARD).filter((key) => !heard.has(key));
    expect(gone).toEqual([]);
  });
});
