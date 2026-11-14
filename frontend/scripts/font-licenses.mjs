// Writes the licence texts of the two typefaces of the interface to
// public/licenses/, so that they travel with the built app as the SIL Open
// Font License asks: the font files are bundled, and so is their licence.
//
//   pnpm licenses:fonts
//
// The texts are the LICENSE files of the two packages the fonts come from.
// Each opens with a line that repeats the copyright notice once for every
// font file of the package: here it is the one notice, as the projects
// write it. A test fails when what is in public/licenses/ is not what this
// script would write: run it again after updating the packages.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The typefaces bundled with the app: the package each comes from, the file its licence is written to */
export const FONT_LICENSES = [
  {
    name: 'Inter',
    source: 'node_modules/@fontsource-variable/inter/LICENSE',
    file: 'public/licenses/inter.txt',
    notice: 'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)',
  },
  {
    name: 'JetBrains Mono',
    source: 'node_modules/@fontsource/jetbrains-mono/LICENSE',
    file: 'public/licenses/jetbrains-mono.txt',
    notice: 'Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)',
  },
];

/**
 * The licence of a typeface as it is shipped: the text of its package with
 * the first line reduced to the one copyright notice. Throws when that line
 * is not made of the notice, which would mean the package changed hands.
 */
export function shippedLicense(text, notice) {
  const [first, ...rest] = text.replace(/\r\n/g, '\n').split('\n');
  if (!first.startsWith(notice)) {
    throw new Error(`the licence does not open with "${notice}" any more: read it before shipping it`);
  }
  return [notice, ...rest].join('\n');
}

export async function fontLicenses(root = ROOT) {
  const written = [];
  for (const font of FONT_LICENSES) {
    const text = await readFile(path.join(root, font.source), 'utf8');
    written.push({ ...font, text: shippedLicense(text, font.notice) });
  }
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const font of await fontLicenses()) {
    const target = path.join(ROOT, font.file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, font.text, 'utf8');
    console.log(`${font.name}: ${font.file}`);
  }
}
