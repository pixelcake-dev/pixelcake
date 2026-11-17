/**
 * The documentation names the controls of the app by the labels they have.
 * A name between «guillemets» in an Italian page, or between “curly quotes”
 * in an English one, is the label of a control (a button, a tab, a menu
 * entry, a field) and must be a text of the app's dictionary of that
 * language: when a label changes in the app, the pages that quote it fail
 * here. Anything else is written otherwise: a name typed by the user, an
 * example, between "straight quotes" or as `code`. (The same rule as the
 * guide inside the app: see i18n/dictionaries.test.ts.)
 */

import { describe, it, expect } from 'vitest';
import { dictionaryOf } from '@/i18n';
import { leavesOf } from '@/test/italian';
import { loadDocs } from '../../scripts/docs/source.mjs';
import { WORDS } from '../../scripts/docs/words.mjs';
import { LANGUAGES } from '../../scripts/docs/config.mjs';

const model = loadDocs();

/**
 * What a page may put in the quotes of its language that is not the label of
 * a control, each with its reason, for instance
 *
 *   en: ['Internet'], // the name a Cloud symbol must have to stand for the Internet
 *
 * Keep it short: most of the time the word wants to be written as `code` or
 * in "straight quotes" instead. A word listed here that no page quotes any
 * more fails the last test below.
 */
const NOT_A_LABEL: Record<'en' | 'it', string[]> = {
  en: [],
  it: [],
};

const QUOTES = { en: '“', it: '«' } as const;
const OTHER = { en: '«', it: '“' } as const;

describe.each(LANGUAGES)('the labels quoted in the %s pages', (lang) => {
  const labels = new Set(
    leavesOf(dictionaryOf(lang))
      .filter((leaf) => !leaf.isFunction)
      .map((leaf) => leaf.text)
  );
  const pages = model.pages.filter((page) => page.lang === lang);

  it('are labels of the app, in the quotes of the language', () => {
    const unknown = pages.flatMap((page) =>
      page.quotes
        .filter((quote) => quote.mark === QUOTES[lang])
        .filter((quote) => !labels.has(quote.text) && !NOT_A_LABEL[lang].includes(quote.text))
        .map((quote) => `${page.rel}:${quote.line}  ${QUOTES[lang]}${quote.text}${lang === 'en' ? '”' : '»'}`)
    );
    expect(unknown).toEqual([]);
  });

  it('never in the quotes of the other language', () => {
    const wrong = pages.flatMap((page) =>
      page.quotes
        .filter((quote) => quote.mark === OTHER[lang])
        .map((quote) => `${page.rel}:${quote.line}  ${quote.text}`)
    );
    expect(wrong).toEqual([]);
  });

  it('are quoted at all: the pages that are written name the controls they speak of', () => {
    const quoted = pages.flatMap((page) => page.quotes.filter((quote) => !quote.todo));
    expect(quoted.length).toBeGreaterThan(5);
  });

  it('the exceptions are still used, so that the list hides nothing', () => {
    const used = new Set(pages.flatMap((page) => page.quotes.map((quote) => quote.text)));
    expect(NOT_A_LABEL[lang].filter((word) => !used.has(word))).toEqual([]);
  });
});

describe('the names of the sample networks the examples show', () => {
  it.each(LANGUAGES)('%s: are those of the panel of the samples', (lang) => {
    const titles = dictionaryOf(lang).devicePanel.samples;
    expect(WORDS[lang].samples).toEqual({
      company: titles.company.title,
      office: titles.office.title,
      site: titles.site.title,
      'two-sites': titles.twoSites.title,
      multinational: titles.multinational.title,
    });
  });
});
