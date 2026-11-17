/**
 * Where the documentation is, where it goes, and the few constants that the
 * generator, the preview and the tests share.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** frontend/ */
export const FRONTEND_DIR = path.resolve(here, '../..');
/** The sources: documentation/ at the root of the repository */
export const DOCS_DIR = path.resolve(FRONTEND_DIR, '../documentation');
/** Pictures, animations and videos, shared by the two languages */
export const MEDIA_DIR = path.join(DOCS_DIR, 'media');
/** Short projects a terminal example can start from (`ncl fixture=<name>`) */
export const FIXTURES_DIR = path.join(DOCS_DIR, 'fixtures');
/** The pages allowed to be unfinished, one per line */
export const STUBS_FILE = path.join(DOCS_DIR, 'stubs.txt');
/** The sections, in the order of the navigation */
export const SECTIONS_FILE = path.join(DOCS_DIR, 'sections.json');
/** The style sheet and the script of the pages, and the fonts they use */
export const ASSETS_DIR = path.join(here, 'assets');
/** The app is built to frontend/dist; the documentation goes inside it */
export const OUT_DIR = path.join(FRONTEND_DIR, 'dist', 'docs');

/** The languages, the first one at the root of /docs/ and the default for search engines */
export const LANGUAGES = /** @type {const} */ (['en', 'it']);

/** Where the documentation is published */
export const SITE_URL = 'https://app.pixelcake.dev/docs/';
export const APP_URL = 'https://app.pixelcake.dev/';
/** The site of PixelCake, in each language */
export const WEBSITE = { en: 'https://pixelcake.dev/', it: 'https://pixelcake.dev/it/' };
/** The picture a link to a page shows when it is shared (made by the site) */
export const SHARE_IMAGE = {
  en: 'https://pixelcake.dev/assets/share-en.png',
  it: 'https://pixelcake.dev/assets/share-it.png',
};
export const REPOSITORY = 'https://github.com/pixelcake-dev/pixelcake';
export const CONTACT = 'pixelcake.dev@gmail.com';

/** The sample networks a terminal example can start from: `ncl sample=<name>` */
export const SAMPLE_NAMES = ['company', 'office', 'site', 'two-sites', 'multinational', 'empty'];

/** Above this size a file of media is refused: it would make the pages slow */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;

/** An anchor: lower case words joined by single dashes */
export const ANCHOR_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
