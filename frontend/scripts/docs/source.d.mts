/** Types of source.mjs, for the tests that read the documentation (src/docs) */

import type { FenceInfo } from './markdown.mjs';

export type DocLanguage = 'en' | 'it';

export interface DocProblem {
  kind: string;
  /** Relative to documentation/: `en/building/vlans.md` */
  file: string;
  line: number;
  message: string;
}

export interface DocHeading {
  level: number;
  id: string;
  text: string;
  line: number;
}

export interface DocCode extends FenceInfo {
  info: string;
  content: string;
  line: number;
}

export interface DocQuote {
  text: string;
  mark: '“' | '«';
  line: number;
  /** Inside a [!TODO] box */
  todo: boolean;
}

export interface DocInlineCode {
  content: string;
  line: number;
  todo: boolean;
}

export interface DocLink {
  href: string;
  line: number;
  todo: boolean;
}

export interface DocImage {
  src: string;
  alt: string;
  caption: string;
  figure: boolean;
  line: number;
}

export interface DocSection {
  /** Empty for the words before the first heading */
  id: string;
  heading: string;
  text: string[];
  line?: number;
  level?: number;
  /** How many paragraphs, lists, tables or blocks it has (a [!TODO] box does not count) */
  body?: number;
}

export interface DocPage {
  lang: DocLanguage;
  /** The file without `.md`, relative to the folder of its language: `building/vlans`, `index` */
  id: string;
  /** Relative to documentation/: `en/building/vlans.md` */
  rel: string;
  file: string;
  section: string | null;
  /** Relative to the folder of its language: `building/vlans/` */
  url: string;
  /** Relative to the root of the documentation: `it/building/vlans/` */
  href: string;
  depth: number;
  title: string;
  description: string;
  order: number;
  html: string;
  headings: DocHeading[];
  todos: Array<{ line: number }>;
  code: DocCode[];
  quotes: DocQuote[];
  inlineCode: DocInlineCode[];
  links: DocLink[];
  images: DocImage[];
  sections: DocSection[];
  problems: Array<{ kind: string; line: number; message: string }>;
  /** Has a [!TODO] box or a section with nothing in it */
  stub: boolean;
}

export interface DocSectionInfo {
  id: string;
  en: string;
  it: string;
}

export interface DocModel {
  sections: DocSectionInfo[];
  pages: DocPage[];
  pageByFile: Map<string, DocPage>;
}

export function loadDocs(): DocModel;
export function checkDocs(model: DocModel): DocProblem[];
export function readStubs(): string[];
export function readSections(): DocSectionInfo[];
export function emptySections(sections: DocSection[]): DocSection[];
export function counterpart(model: DocModel, page: DocPage, lang: DocLanguage): DocPage | null;
export function formatProblem(problem: DocProblem): string;
export function allFiles(dir: string): string[];
export function splitFrontMatter(text: string): {
  data: Record<string, unknown> | null;
  body: string;
  offset: number;
  error: string | null;
};
