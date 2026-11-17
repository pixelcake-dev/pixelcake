/**
 * The pages the generator writes (scripts/docs/render.mjs): what every page
 * carries in its head for search engines and for whoever shares a link, the
 * frame a reader moves in (masthead, navigation, table of contents, previous
 * and next, language switch), and that nothing in a page is fetched from
 * another host.
 */

import { describe, it, expect } from 'vitest';
import { loadDocs, counterpart } from '../../scripts/docs/source.mjs';
import { renderPage, searchIndex, pagesOf } from '../../scripts/docs/render.mjs';
import { LANGUAGES, SHARE_IMAGE, SITE_URL } from '../../scripts/docs/config.mjs';

const model = loadDocs();
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const pageOf = (lang: 'en' | 'it', id: string) => {
  const page = model.pages.find((one) => one.lang === lang && one.id === id);
  if (!page) throw new Error(`no ${lang}/${id}`);
  return page;
};
const attr = (doc: Document, selector: string, name: string) => doc.querySelector(selector)?.getAttribute(name) ?? null;

describe.each(LANGUAGES)('a page of the documentation (%s)', (lang) => {
  const page = pageOf(lang, 'building/vlans');
  const doc = parse(renderPage(model, page));
  const other = counterpart(model, page, lang === 'en' ? 'it' : 'en')!;

  it('says its language, its title, what it is about and where it lives', () => {
    expect(doc.documentElement.getAttribute('lang')).toBe(lang);
    expect(doc.title).toContain(page.title);
    expect(attr(doc, 'meta[name="description"]', 'content')).toBe(page.description);
    expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe(`${SITE_URL}${page.href}`);
  });

  it('names the same page in the other language, and the English one as the default', () => {
    expect(attr(doc, `link[rel="alternate"][hreflang="${lang}"]`, 'href')).toBe(`${SITE_URL}${page.href}`);
    expect(attr(doc, `link[rel="alternate"][hreflang="${other.lang}"]`, 'href')).toBe(`${SITE_URL}${other.href}`);
    expect(attr(doc, 'link[rel="alternate"][hreflang="x-default"]', 'href')).toBe(`${SITE_URL}${pageOf('en', page.id).href}`);
  });

  it('is shared with the picture of the site, in its language', () => {
    expect(attr(doc, 'meta[property="og:image"]', 'content')).toBe(SHARE_IMAGE[lang]);
    expect(attr(doc, 'meta[property="og:title"]', 'content')).toContain(page.title);
    expect(attr(doc, 'meta[property="og:url"]', 'content')).toBe(`${SITE_URL}${page.href}`);
    expect(attr(doc, 'meta[property="og:locale"]', 'content')).toBe(lang === 'en' ? 'en_GB' : 'it_IT');
    expect(attr(doc, 'meta[name="twitter:card"]', 'content')).toBe('summary_large_image');
  });

  it('has its landmarks, and a way to skip to the page', () => {
    expect(doc.querySelectorAll('header.masthead').length).toBe(1);
    expect(doc.querySelectorAll('main#main').length).toBe(1);
    expect(doc.querySelectorAll('footer').length).toBe(1);
    expect(doc.querySelector('nav#sidebar')?.getAttribute('aria-label')).toBeTruthy();
    expect(doc.querySelector('a.skip')?.getAttribute('href')).toBe('#main');
    expect(doc.querySelectorAll('h1').length).toBe(1);
    expect(doc.querySelector('h1')?.textContent).toBe(page.title);
  });

  it('marks itself in the navigation, which holds every page of its language', () => {
    const links = [...doc.querySelectorAll('#sidebar a[href]')].filter((a) => !a.closest('.sidebar-more'));
    expect(links.length).toBe(pagesOf(model, lang).length);
    const current = doc.querySelectorAll('#sidebar [aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].textContent).toBe(page.title);
  });

  it('leads to the same page in the other language from its switch', () => {
    const link = doc.querySelector(`.masthead .lang a[hreflang="${other.lang}"]`);
    expect(link?.getAttribute('href')).toBe(`../../${lang === 'en' ? '' : '../'}${other.href}`);
    expect(doc.querySelector('.masthead .lang [aria-current]')?.textContent).toBe(lang.toUpperCase());
  });

  it('has a table of contents of its sections, and a link on each heading', () => {
    const toc = [...doc.querySelectorAll('nav.toc a')].map((a) => a.getAttribute('href'));
    const headings = page.headings.filter((heading) => heading.level <= 3).map((heading) => `#${heading.id}`);
    expect(toc).toEqual(headings);
    for (const heading of doc.querySelectorAll('.prose h2, .prose h3')) {
      expect(heading.querySelector('a.anchor')?.getAttribute('href')).toBe(`#${heading.id}`);
    }
  });

  it('leads to the previous and the next page', () => {
    const pages = pagesOf(model, lang);
    const index = pages.indexOf(page);
    const root = '../'.repeat(page.depth);
    expect(attr(doc, '.pager a[rel="prev"]', 'href')).toBe(`${root}${pages[index - 1].href}`);
    expect(attr(doc, '.pager a[rel="next"]', 'href')).toBe(`${root}${pages[index + 1].href}`);
  });

  it('shows its figure with a caption, in both themes', () => {
    const figure = doc.querySelector('figure.figure');
    expect(figure?.querySelector('img.only-light')?.getAttribute('alt')).toBeTruthy();
    expect(figure?.querySelector('img.only-dark')?.getAttribute('src')).toMatch(/\.dark\.svg$/);
    expect(figure?.querySelector('figcaption')?.textContent).toBeTruthy();
  });

  it('shows a terminal example as the terminal does, with a button that copies its commands', () => {
    const block = doc.querySelector('.code.terminal');
    expect(block?.querySelector('.prompt')?.textContent).toBe('pixelcake> ');
    expect(block?.querySelector('.cmd')?.textContent).toBe('interface 1 access 10 on SW-Office');
    expect(block?.querySelector('button.copy')?.getAttribute('data-copy')).toContain('interface 1 access 10 on SW-Office');
  });

  it('a box of limits has its title in the language of the page', () => {
    expect(doc.querySelector('.callout-limits .callout-title')?.textContent).toBe(lang === 'en' ? 'Limits' : 'Limiti');
  });
});

describe('the home of the documentation', () => {
  it.each(LANGUAGES)('%s: shows its video with a poster, playing only when the script lets it', (lang) => {
    const doc = parse(renderPage(model, pageOf(lang, 'index')));
    const video = doc.querySelector('[data-video] video');
    expect(video?.getAttribute('poster')).toMatch(new RegExp(`home/firewall-ping\\.${lang}\\.poster\\.png$`));
    expect(video?.hasAttribute('muted')).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
    // (the script starts it, unless the visitor asked for less motion; without the script it has its controls)
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.querySelector('source[type="video/mp4"]')?.getAttribute('src')).toMatch(/\.mp4$/);
  });

  it('the English one sends a first visit of an Italian browser to the Italian one, and only it does', () => {
    expect(parse(renderPage(model, pageOf('en', 'index'))).documentElement.getAttribute('data-italian-home')).toBe('it/');
    expect(parse(renderPage(model, pageOf('it', 'index'))).documentElement.hasAttribute('data-italian-home')).toBe(false);
    expect(parse(renderPage(model, pageOf('en', 'building/vlans'))).documentElement.hasAttribute('data-italian-home')).toBe(false);
  });
});

describe('every page', () => {
  it('asks nothing of another host: styles, scripts, fonts, pictures and videos are beside it', () => {
    const outside: string[] = [];
    for (const page of model.pages) {
      const doc = parse(renderPage(model, page));
      const loaded = [
        ...[...doc.querySelectorAll('script[src], img[src], source[src], video[src], iframe[src]')].map((node) => node.getAttribute('src')),
        ...[...doc.querySelectorAll('video[poster]')].map((node) => node.getAttribute('poster')),
        ...[...doc.querySelectorAll('link[rel="stylesheet"], link[rel="preload"], link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map((node) => node.getAttribute('href')),
      ];
      for (const url of loaded) {
        if (url === null || /^(?:[a-z]+:)?\/\//i.test(url)) outside.push(`${page.rel}: ${url}`);
      }
      expect(doc.querySelectorAll('style[src], object, embed').length).toBe(0);
    }
    expect(outside).toEqual([]);
  });

  it('a stub says it is one, a written page does not', () => {
    for (const page of model.pages) {
      const doc = parse(renderPage(model, page));
      expect(doc.querySelector('.stub-note') !== null, page.rel).toBe(page.stub);
    }
  });
});

describe('the search index', () => {
  it.each(LANGUAGES)('%s: has every page and every section, each leading to its anchor', (lang) => {
    const { entries } = searchIndex(model, lang);
    for (const page of pagesOf(model, lang)) {
      expect(entries.some((entry) => entry.u === page.href), page.rel).toBe(true);
      for (const heading of page.headings.filter((h) => h.level <= 3)) {
        expect(entries.some((entry) => entry.u === `${page.href}#${heading.id}` && entry.h === heading.text), `${page.rel}#${heading.id}`).toBe(true);
      }
    }
  });

  it('finds a command by what it is typed as, and leaves out what is still to be written', () => {
    const { entries } = searchIndex(model, 'en');
    const trunk = entries.find((entry) => entry.u === 'terminal/interfaces-and-vlans/#trunk');
    expect(trunk?.x).toContain('interface 8 trunk 10 on SW-Offices');
    const stub = entries.find((entry) => entry.u === 'building/devices/#kinds');
    expect(stub?.x).not.toMatch(/End devices, network devices/);
  });
});
