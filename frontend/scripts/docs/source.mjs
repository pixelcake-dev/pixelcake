/**
 * The documentation as a whole: every page of documentation/<language>/,
 * read, parsed and put in the order of the navigation, and what is wrong
 * with it. The generator writes pages from this; the tests read the same
 * model, so that what is checked is what is published.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  ANCHOR_PATTERN,
  DOCS_DIR,
  FIXTURES_DIR,
  LANGUAGES,
  MEDIA_DIR,
  MEDIA_MAX_BYTES,
  SAMPLE_NAMES,
  SECTIONS_FILE,
  STUBS_FILE,
} from './config.mjs';
import { createMarkdown, mediaKind, parseInfo, parseSession, resolveLink, variant } from './markdown.mjs';

/** Every .md file under a folder, as paths relative to it with forward slashes */
function markdownFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return markdownFiles(path.join(dir, entry.name), rel);
      return entry.name.endsWith('.md') ? [rel] : [];
    })
    .sort();
}

/** The front matter between the two `---` lines at the top, and how many lines it takes */
export function splitFrontMatter(text) {
  const source = text.replace(/\r\n/g, '\n').replace(/^﻿/, '');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return { data: null, body: source, offset: 0, error: 'no front matter: the page starts with a block between two "---" lines' };
  try {
    const data = YAML.parse(match[1]) ?? {};
    return { data, body: source.slice(match[0].length), offset: match[0].split('\n').length - 1, error: null };
  } catch (error) {
    return { data: null, body: source.slice(match[0].length), offset: match[0].split('\n').length - 1, error: `front matter is not valid YAML: ${error.message}` };
  }
}

/** `building/vlans.md` → `building/vlans/`; `index.md` → `` ; `terminal/index.md` → `terminal/` */
function urlOf(rel) {
  const noExt = rel.replace(/\.md$/, '');
  if (noExt === 'index') return '';
  return `${noExt.replace(/\/index$/, '')}/`;
}

export function readSections() {
  const data = JSON.parse(fs.readFileSync(SECTIONS_FILE, 'utf8'));
  return data.sections;
}

/** The pages allowed to be unfinished: `building/devices`, one per line, `#` for a comment */
export function readStubs() {
  if (!fs.existsSync(STUBS_FILE)) return [];
  return fs
    .readFileSync(STUBS_FILE, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean);
}

/** Read every page of both languages */
export function loadDocs() {
  const sections = readSections();
  const sectionIds = sections.map((section) => section.id);
  const md = createMarkdown();
  const pages = [];

  for (const lang of LANGUAGES) {
    const langDir = path.join(DOCS_DIR, lang);
    for (const rel of markdownFiles(langDir)) {
      const file = path.join(langDir, rel);
      const id = rel.replace(/\.md$/, '');
      const url = urlOf(rel);
      const parts = rel.split('/');
      const section = parts.length > 1 ? parts[0] : null;
      pages.push({
        lang,
        id,
        rel: `${lang}/${rel}`,
        file,
        section,
        url,
        href: lang === LANGUAGES[0] ? url : `${lang}/${url}`,
        depth: (lang === LANGUAGES[0] ? 0 : 1) + url.split('/').filter(Boolean).length,
      });
    }
  }

  const pageByFile = new Map(pages.map((page) => [page.file, page]));

  for (const page of pages) {
    const { data, body, offset, error } = splitFrontMatter(fs.readFileSync(page.file, 'utf8'));
    const env = {
      page,
      pageByFile,
      rootRel: '../'.repeat(page.depth),
      offset,
      problems: [],
      headings: [],
      todos: [],
      code: [],
      quotes: [],
      inlineCode: [],
      links: [],
      images: [],
      sections: [],
    };
    if (error) env.problems.push({ kind: 'front-matter', line: 1, message: error });
    const meta = data ?? {};
    for (const key of ['title', 'description']) {
      if (typeof meta[key] !== 'string' || meta[key].trim() === '') {
        env.problems.push({ kind: 'front-matter', line: 1, message: `front matter: "${key}" is missing` });
      }
    }
    if (page.section !== null && !Number.isFinite(meta.order)) {
      env.problems.push({ kind: 'front-matter', line: 1, message: 'front matter: "order" (a number) is missing' });
    }
    if (page.section !== null && !sectionIds.includes(page.section)) {
      env.problems.push({ kind: 'section', line: 1, message: `"${page.section}" is not a section of sections.json` });
    }
    if (page.section === null && page.id !== 'index') {
      env.problems.push({ kind: 'section', line: 1, message: 'a page lives in the folder of its section' });
    }
    const unknownKeys = Object.keys(meta).filter((key) => !['title', 'description', 'order'].includes(key));
    if (unknownKeys.length > 0) {
      env.problems.push({ kind: 'front-matter', line: 1, message: `front matter: unknown ${unknownKeys.map((key) => `"${key}"`).join(', ')} (title, description, order)` });
    }

    page.title = String(meta.title ?? page.id).trim();
    page.description = String(meta.description ?? '').trim();
    page.order = Number.isFinite(meta.order) ? meta.order : 0;
    page.html = md.render(body, env);
    page.headings = env.headings;
    page.todos = env.todos;
    page.code = env.code;
    page.quotes = env.quotes;
    page.inlineCode = env.inlineCode;
    page.links = env.links;
    page.images = env.images;
    page.sections = env.sections;
    page.problems = env.problems;
    page.stub = env.todos.length > 0 || emptySections(env.sections).length > 0;
  }

  // The order of the navigation: the home of each language, then the sections, each by `order`
  const ordered = [];
  for (const lang of LANGUAGES) {
    const ofLang = pages.filter((page) => page.lang === lang);
    const home = ofLang.find((page) => page.id === 'index');
    if (home) ordered.push(home);
    for (const sectionId of sectionIds) {
      ordered.push(
        ...ofLang
          .filter((page) => page.section === sectionId)
          .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      );
    }
  }
  for (const page of pages) if (!ordered.includes(page)) ordered.push(page);

  return { sections, pages: ordered, pageByFile };
}

/** The sections of a page that have nothing in them (a heading followed by a heading of its level or above) */
export function emptySections(sections) {
  const headed = sections.filter((section) => section.level);
  return headed.filter((section, index) => {
    const next = headed[index + 1];
    const hasChildren = next !== undefined && next.level > section.level;
    return section.body === 0 && !hasChildren;
  });
}

/** The page of the same path in another language */
export function counterpart(model, page, lang) {
  return model.pages.find((other) => other.lang === lang && other.id === page.id) ?? null;
}

/**
 * What is wrong with the documentation, by kind. The build stops on any of
 * them; each test looks at its own kind.
 *
 *   front-matter, section, anchor, heading, callout   the page itself (from parsing)
 *   pair       a page that is in one language only
 *   anchors    the anchors of a page differ from those of the same page in the other language
 *   duplicate  two headings of a page with one anchor
 *   link       a link to a page, an anchor or a file that is not there
 *   media      a picture without its file, alt text or caption; a video without its poster
 *   terminal   a block with a prompt that is not a terminal example, or an example that names no sample
 */
export function checkDocs(model) {
  const problems = [];
  const add = (page, kind, line, message) => problems.push({ kind, file: page.rel, line, message });

  for (const page of model.pages) {
    for (const problem of page.problems) add(page, problem.kind, problem.line, problem.message);

    // Both languages
    for (const lang of LANGUAGES) {
      if (lang === page.lang) continue;
      const other = counterpart(model, page, lang);
      if (!other) {
        add(page, 'pair', 1, `there is no ${lang}/${page.id}.md: every page exists in both languages`);
        continue;
      }
      const mine = page.headings.map((heading) => `${'#'.repeat(heading.level)} {#${heading.id}}`);
      const theirs = other.headings.map((heading) => `${'#'.repeat(heading.level)} {#${heading.id}}`);
      if (mine.join('\n') !== theirs.join('\n') && page.lang === LANGUAGES[0]) {
        add(page, 'anchors', 1, `the headings differ from ${other.rel}: here ${mine.join(', ') || 'none'}; there ${theirs.join(', ') || 'none'}`);
      }
    }

    const seen = new Set();
    for (const heading of page.headings) {
      if (seen.has(heading.id)) add(page, 'duplicate', heading.line, `two headings have the anchor "${heading.id}"`);
      seen.add(heading.id);
    }

    // Links
    for (const link of page.links) {
      const target = resolveLink(link.href, page);
      if (target.kind === 'external') {
        if (!/^(https:|mailto:)/.test(link.href)) add(page, 'link', link.line, `${link.href}: an address of the web starts with https://`);
        continue;
      }
      if (target.kind === 'bad') {
        add(page, 'link', link.line, `${link.href}: a link leads to a page (.md), an anchor (#…) or a file of documentation/media`);
        continue;
      }
      if (target.kind === 'media') {
        if (!fs.existsSync(target.file)) add(page, 'link', link.line, `${link.href}: there is no such file`);
        continue;
      }
      const other = model.pageByFile.get(target.file);
      if (!other) {
        add(page, 'link', link.line, `${link.href}: there is no such page`);
        continue;
      }
      if (other.lang !== page.lang) add(page, 'link', link.line, `${link.href}: a page links to pages of its own language`);
      if (target.anchor && !other.headings.some((heading) => heading.id === target.anchor)) {
        add(page, 'link', link.line, `${link.href}: ${other.rel} has no heading with the anchor "${target.anchor}"`);
      }
    }

    // Pictures, animations, videos
    for (const image of page.images) {
      const target = resolveLink(image.src, page);
      if (target.kind !== 'media') {
        add(page, 'media', image.line, `${image.src}: pictures are files of documentation/media, written relative to the page`);
        continue;
      }
      if (!fs.existsSync(target.file)) {
        add(page, 'media', image.line, `${image.src}: there is no such file`);
        continue;
      }
      const kind = mediaKind(target.file);
      if (kind === 'other') add(page, 'media', image.line, `${image.src}: a picture is .png, .jpg, .svg, .webp or .gif; a video .mp4 or .webm`);
      if (!image.alt) add(page, 'media', image.line, `${image.src}: the words between [ ] say what the picture shows, for who cannot see it`);
      if (!image.figure) add(page, 'media', image.line, `${image.src}: a picture stands alone in its paragraph, with an empty line before and after`);
      else if (!image.caption) add(page, 'media', image.line, `${image.src}: a figure has a caption, between quotes after the file: ![…](${image.src} "Caption")`);
      if (kind === 'video' && !fs.existsSync(variant(target.file, '.poster', '.png'))) {
        add(page, 'media', image.line, `${image.src}: a video has a poster, ${path.basename(variant(target.file, '.poster', '.png'))}, next to it`);
      }
    }

    // Terminal examples
    for (const block of page.code) {
      const { steps } = parseSession(block.content);
      if (block.lang !== 'ncl') {
        if (steps.some((step) => step.prompt === 'pixelcake')) {
          add(page, 'terminal', block.line, 'a block with "pixelcake>" is a terminal example: open it with ```ncl sample=<name>, and the tests will run it');
        }
        continue;
      }
      const info = parseInfo(block.info);
      if (info.flags.includes('continue')) continue;
      if (!info.attrs.sample && !info.attrs.fixture) {
        add(page, 'terminal', block.line, `a terminal example says what it runs on: \`\`\`ncl sample=<${SAMPLE_NAMES.join('|')}> or fixture=<name>`);
      } else if (info.attrs.sample && !SAMPLE_NAMES.includes(info.attrs.sample)) {
        add(page, 'terminal', block.line, `"${info.attrs.sample}" is not a sample: ${SAMPLE_NAMES.join(', ')}`);
      } else if (info.attrs.fixture && !fs.existsSync(path.join(FIXTURES_DIR, `${info.attrs.fixture}.pixelcake.json`))) {
        add(page, 'terminal', block.line, `there is no documentation/fixtures/${info.attrs.fixture}.pixelcake.json`);
      }
      if (info.attrs.lang && !LANGUAGES.includes(info.attrs.lang)) {
        add(page, 'terminal', block.line, `"lang=${info.attrs.lang}": the sample is loaded in ${LANGUAGES.join(' or ')}`);
      }
    }
  }

  // Files of media too large to be served
  for (const file of allFiles(MEDIA_DIR)) {
    const size = fs.statSync(file).size;
    if (size > MEDIA_MAX_BYTES) {
      problems.push({ kind: 'media', file: path.relative(DOCS_DIR, file).split(path.sep).join('/'), line: 1, message: `${Math.round(size / 1024 / 1024)} MB: a file of media is ${MEDIA_MAX_BYTES / 1024 / 1024} MB at most` });
    }
  }

  return problems;
}

/** Every file under a folder */
export function allFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? allFiles(full) : [full];
  });
}

/** A problem as one line: `en/building/vlans.md:12  the message` */
export function formatProblem(problem) {
  return `${problem.file}:${problem.line}  ${problem.message}`;
}

export { ANCHOR_PATTERN };
