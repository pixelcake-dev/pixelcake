/** Types of render.mjs, for the tests that read the documentation (src/docs) */

import type { DocLanguage, DocModel, DocPage } from './source.mjs';

export interface SearchEntry {
  /** The title of the page */
  t: string;
  /** The title of its section of the navigation */
  s: string;
  /** Its address, relative to the root of the documentation, with the anchor of the heading */
  u: string;
  /** The heading, empty for the page itself */
  h: string;
  /** Its words */
  x: string;
}

export function renderPage(model: DocModel, page: DocPage, options?: { assets?: Record<string, string>; dev?: boolean }): string;
export function searchIndex(model: DocModel, lang: DocLanguage): { lang: DocLanguage; entries: SearchEntry[] };
export function pagesOf(model: DocModel, lang: DocLanguage): DocPage[];
export function sectionTitle(model: DocModel, sectionId: string, lang: DocLanguage): string;
