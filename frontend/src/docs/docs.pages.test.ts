/**
 * The documentation holds together: every page in both languages with the
 * same anchors, every link and picture leading somewhere, every page
 * finished unless it is listed as unfinished.
 *
 * The checks are those of the generator (scripts/docs/source.mjs,
 * `checkDocs`), which also refuses to build documentation that fails them:
 * what is tested is what is published. Each test looks at one kind of
 * problem, and says where it is: `en/building/vlans.md:12  the message`.
 */

import { describe, it, expect } from 'vitest';
import { checkDocs, emptySections, formatProblem, loadDocs, readStubs } from '../../scripts/docs/source.mjs';
import { LANGUAGES } from '../../scripts/docs/config.mjs';
import stubsFile from '../../../documentation/stubs.txt?raw';

const model = loadDocs();
const problems = checkDocs(model);
const of = (...kinds: string[]) => problems.filter((problem) => kinds.includes(problem.kind)).map(formatProblem);

describe('the pages of the documentation', () => {
  it('are there, in every section, in both languages', () => {
    for (const lang of LANGUAGES) {
      const pages = model.pages.filter((page) => page.lang === lang);
      expect(pages.length, lang).toBeGreaterThan(30);
      expect(pages.some((page) => page.id === 'index'), `${lang}: the home`).toBe(true);
      for (const section of model.sections) {
        expect(pages.some((page) => page.section === section.id), `${lang}: ${section.id}`).toBe(true);
      }
    }
  });

  it('each has its front matter: a title, a description, and its place in its section', () => {
    expect(of('front-matter', 'section')).toEqual([]);
  });

  it('each exists in both languages, with the same headings and anchors, in the same order', () => {
    expect(of('pair', 'anchors')).toEqual([]);
  });

  it('every heading names its anchor ({#lower-case-words}), once in its page, and no page writes its own title as # heading', () => {
    expect(of('anchor', 'duplicate', 'heading')).toEqual([]);
  });

  it('every box is of a known kind: [!NOTE], [!TIP], [!WARNING], [!LIMITS], [!TODO]', () => {
    expect(of('callout')).toEqual([]);
  });

  it('every link leads to a page, an anchor or a file that exists', () => {
    expect(of('link')).toEqual([]);
  });

  it('every picture, animation and video exists, says what it shows and has its caption; a video its poster', () => {
    expect(of('media')).toEqual([]);
  });

  it('every block that shows the terminal is an example the tests run, on a sample or a project that exists', () => {
    expect(of('terminal')).toEqual([]);
  });

  it('every kind of problem the generator knows is looked at by one of the tests above', () => {
    const looked = ['front-matter', 'section', 'pair', 'anchors', 'anchor', 'duplicate', 'heading', 'callout', 'link', 'media', 'terminal'];
    expect(problems.filter((problem) => !looked.includes(problem.kind)).map(formatProblem)).toEqual([]);
  });

  it('the order of a section is the order of its pages, the same in both languages', () => {
    const orderOf = (lang: string) =>
      model.pages.filter((page) => page.lang === lang).map((page) => `${page.id} (${page.order})`);
    expect(orderOf('it')).toEqual(orderOf('en'));
    for (const lang of LANGUAGES) {
      for (const section of model.sections) {
        const orders = model.pages.filter((page) => page.lang === lang && page.section === section.id).map((page) => page.order);
        expect(new Set(orders).size, `${lang}/${section.id}: two pages with one order`).toBe(orders.length);
      }
    }
  });
});

/* ── unfinished pages ──────────────────────────────────────────────────── */

describe('a page still to be written', () => {
  const stubs = readStubs();
  const ids = new Set(model.pages.map((page) => page.id));

  it('is listed in documentation/stubs.txt, which the writers empty as they go', () => {
    const unlisted = model.pages
      .filter((page) => page.stub && !stubs.includes(page.id))
      .map((page) => {
        const empty = emptySections(page.sections).map((section) => `"${section.heading}" has nothing under it (line ${section.line})`);
        const todo = page.todos.map((todo) => `a [!TODO] box at line ${todo.line}`);
        return `${page.rel}: ${[...todo, ...empty].join('; ')}`;
      });
    expect(unlisted, 'finish them, or list them in documentation/stubs.txt').toEqual([]);
  });

  it('leaves the list once it is written, in both languages', () => {
    const finished = stubs.filter((id) => ids.has(id) && !model.pages.some((page) => page.id === id && page.stub));
    expect(finished, 'these are written: take them off documentation/stubs.txt').toEqual([]);
  });

  it('is a page that exists, listed once', () => {
    expect(stubs.filter((id) => !ids.has(id))).toEqual([]);
    expect(stubs.length).toBe(new Set(stubs).size);
  });

  it('the list exists, and says what it is for', () => {
    expect(stubsFile).toMatch(/^#/);
  });
});
