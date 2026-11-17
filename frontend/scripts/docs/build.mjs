/**
 * Write the documentation into a folder (frontend/dist/docs by default):
 * every page as <path>/index.html, the style sheet, the script, the fonts and
 * the logo in assets/, the files of documentation/media in media/, and one
 * search index per language.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR, FRONTEND_DIR, LANGUAGES, MEDIA_DIR, OUT_DIR } from './config.mjs';
import { checkDocs, loadDocs } from './source.mjs';
import { renderPage, searchIndex } from './render.mjs';

/** The fonts of the interface, from the packages the app bundles them from */
const FONTS = [
  '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
  '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2',
];

const LOGOS = {
  'pixelcake-colore.svg': 'src/assets/pixelcake-orizzontale-colore.svg',
  'pixelcake-negativo.svg': 'src/assets/pixelcake-orizzontale-negativo.svg',
};

function copyTree(from, to) {
  if (!fs.existsSync(from)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      count += copyTree(source, target);
    } else {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(source, target);
      count++;
    }
  }
  return count;
}

/** A short fingerprint of a file, so that a browser fetches it again when it changes */
function fingerprint(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
}

/**
 * Build the documentation. Returns the model, the problems found (the
 * caller decides whether they stop it) and how many pages were written.
 */
export function buildDocs({ outDir = OUT_DIR, dev = false } = {}) {
  const model = loadDocs();
  const problems = checkDocs(model);

  fs.rmSync(outDir, { recursive: true, force: true });
  const assetsOut = path.join(outDir, 'assets');
  fs.mkdirSync(path.join(assetsOut, 'fonts'), { recursive: true });

  const assets = {};
  for (const name of ['docs.css', 'docs.js']) {
    const source = path.join(ASSETS_DIR, name);
    fs.copyFileSync(source, path.join(assetsOut, name));
    assets[name] = `${name}?v=${fingerprint(source)}`;
  }
  for (const font of FONTS) {
    fs.copyFileSync(path.join(FRONTEND_DIR, 'node_modules', font), path.join(assetsOut, 'fonts', path.basename(font)));
  }
  for (const [name, source] of Object.entries(LOGOS)) {
    fs.copyFileSync(path.join(FRONTEND_DIR, source), path.join(assetsOut, name));
  }
  const media = copyTree(MEDIA_DIR, path.join(outDir, 'media'));

  for (const page of model.pages) {
    const dir = path.join(outDir, page.href);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), renderPage(model, page, { assets, dev }));
  }
  for (const lang of LANGUAGES) {
    fs.writeFileSync(path.join(outDir, `search-${lang}.json`), JSON.stringify(searchIndex(model, lang)));
  }

  return { model, problems, pages: model.pages.length, media };
}
