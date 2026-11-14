// Collects every icon name used in src/ and writes the icon data to
// src/data/bundledIcons.ts, so the app shows its icons without calling the
// Iconify API at run time. With the icons it writes what each set says of
// itself (its name, who made it, its licence) and the text of its licence to
// public/licenses/, so that the licences travel with the built app.
//
//   pnpm icons:bundle        (needs a network connection)
//
// Run it again after adding an icon to the code. A test fails when an icon
// used in src/ is missing from the generated file, and when a bundled set
// has no licence text. Test files are not scanned. Only the icon sets listed
// in ICON_SETS are collected: add the prefix here when using a new set.
//
// (The devices are not drawn with these icons: their drawings are the app's
// own, in src/assets/device-drawings.)

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICON_SETS = ['mdi', 'lucide'];
const API = 'https://api.iconify.design';
/** The text of a licence a set only names: the one its makers point to */
const LICENSE_TEXTS = { 'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0.txt' };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUTPUT = path.join(SRC, 'data', 'bundledIcons.ts');
const LICENSES = path.join(ROOT, 'public', 'licenses');
const NAME_PATTERN = new RegExp(
  `['"\`](${ICON_SETS.join('|')}):([a-z0-9]+(?:-[a-z0-9]+)*)['"\`]`,
  'g'
);

async function sourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(full)));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && full !== OUTPUT) {
      files.push(full);
    }
  }
  return files;
}

async function collectNames() {
  const bySet = new Map(ICON_SETS.map((prefix) => [prefix, new Set()]));
  for (const file of await sourceFiles(SRC)) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(NAME_PATTERN)) bySet.get(match[1]).add(match[2]);
  }
  return bySet;
}

function sortKeys(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return (await response.text()).replace(/\r\n/g, '\n');
}

async function fetchCollection(prefix, names) {
  const url = `${API}/${prefix}.json?icons=${[...names].sort().join(',')}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${prefix}: the Iconify API answered ${response.status}`);
  const data = await response.json();

  const known = new Set([...Object.keys(data.icons ?? {}), ...Object.keys(data.aliases ?? {})]);
  const missing = [...names].filter((name) => !known.has(name));
  if (missing.length > 0) {
    throw new Error(`${prefix}: no such icon: ${missing.join(', ')}`);
  }

  const collection = { prefix: data.prefix, icons: sortKeys(data.icons) };
  if (data.aliases && Object.keys(data.aliases).length > 0) collection.aliases = sortKeys(data.aliases);
  if (data.width) collection.width = data.width;
  if (data.height) collection.height = data.height;
  return collection;
}

/** The file of a repository on GitHub as plain text, from the address of its page */
function rawAddress(url) {
  const found = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url);
  if (!found) throw new Error(`not the page of a file on GitHub: ${url}`);
  return `https://raw.githubusercontent.com/${found[1]}/${found[2]}/${found[3]}`;
}

/**
 * What a set says of itself, and the text of its licence: the file its
 * makers keep, followed by the licence itself when that file only names it
 */
async function fetchLicense(prefix, info) {
  if (!info?.license?.url || !info.license.spdx) throw new Error(`${prefix}: the set names no licence`);
  let text = (await fetchText(rawAddress(info.license.url))).trimEnd();
  const named = LICENSE_TEXTS[info.license.spdx];
  if (named) text += `\n\n\n${(await fetchText(named)).trim()}`;
  const file = `licenses/icons-${prefix}.txt`;
  await writeFile(path.join(ROOT, 'public', file), `${text}\n`, 'utf8');
  return {
    prefix,
    name: info.name,
    author: info.author?.name ?? '',
    license: info.license.title,
    spdx: info.license.spdx,
    file,
  };
}

const bySet = await collectNames();
const used = [...bySet].filter(([, names]) => names.size > 0);
const about = await (await fetch(`${API}/collections?prefixes=${used.map(([prefix]) => prefix).join(',')}`)).json();
await mkdir(LICENSES, { recursive: true });

const collections = [];
const sets = [];
let total = 0;
for (const [prefix, names] of used) {
  collections.push(await fetchCollection(prefix, names));
  sets.push(await fetchLicense(prefix, about[prefix]));
  total += names.size;
  console.log(`${prefix}: ${names.size} icons, ${sets.at(-1).license}`);
}

const banner =
  '// Generated by scripts/bundle-icons.mjs (pnpm icons:bundle). Do not edit by hand.\n' +
  '// Icon data comes from the Iconify API; each set keeps its own licence, whose text\n' +
  '// is in public/licenses/ and travels with the built app. See README.\n';
const body =
  "import type { IconifyJSON } from '@iconify/react';\n\n" +
  `export const BUNDLED_ICON_SETS: string[] = ${JSON.stringify(used.map(([prefix]) => prefix))};\n\n` +
  '/** What each bundled set says of itself, and the file its licence is in (from the root of the app) */\n' +
  'export const BUNDLED_ICON_SET_INFO: Array<{\n' +
  '  prefix: string;\n  name: string;\n  author: string;\n  license: string;\n  spdx: string;\n  file: string;\n' +
  `}> = ${JSON.stringify(sets, null, 2)};\n\n` +
  `export const BUNDLED_ICON_COLLECTIONS: IconifyJSON[] = ${JSON.stringify(collections, null, 2)};\n`;
await writeFile(OUTPUT, banner + body, 'utf8');
console.log(`${total} icons written to ${path.relative(ROOT, OUTPUT)}`);
