/**
 * A page of the documentation as a whole HTML document: the masthead of the
 * site, the navigation of every page, the page itself with its table of
 * contents, previous and next, the footer and the search window. Everything
 * it refers to is beside it (assets/, media/): a page asks nothing of any
 * other host. The addresses of other hosts in <head> (canonical, share
 * picture) are names for search engines and for whoever shares a link, not
 * requests.
 */

import { LANGUAGES, REPOSITORY, SHARE_IMAGE, SITE_URL, WEBSITE, CONTACT } from './config.mjs';
import { escapeHtml } from './markdown.mjs';
import { counterpart } from './source.mjs';
import { WORDS } from './words.mjs';

const LOCALE = { en: 'en_GB', it: 'it_IT' };

/** How many h2 headings a page needs before it gets a table of contents */
const TOC_FROM = 3;

/** A small arrow, drawn: the arrow is in neither of the two typefaces */
const ARROW_RIGHT =
  '<svg class="arrow" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true" focusable="false"><path d="M0 5h12M8 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const ARROW_LEFT =
  '<svg class="arrow" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true" focusable="false"><path d="M14 5H2M6 1L2 5l4 4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const SEARCH_ICON =
  '<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true" focusable="false"><circle cx="6.2" cy="6.2" r="4.7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.7 9.7L14 14" stroke="currentColor" stroke-width="1.5"/></svg>';

export function sectionTitle(model, sectionId, lang) {
  return model.sections.find((section) => section.id === sectionId)?.[lang] ?? sectionId;
}

/** The pages of one language, in the order of the navigation */
export function pagesOf(model, lang) {
  return model.pages.filter((page) => page.lang === lang);
}

function languageSwitch(model, page, root) {
  const words = WORDS[page.lang];
  const items = LANGUAGES.map((lang) => {
    const code = lang.toUpperCase();
    const name = lang === 'en' ? 'English' : 'Italiano';
    if (lang === page.lang) return `<span lang="${lang}" title="${name}" aria-current="true">${code}</span>`;
    const other = counterpart(model, page, lang) ?? model.pages.find((p) => p.lang === lang && p.id === 'index');
    return `<a href="${root}${other?.href ?? ''}" hreflang="${lang}" lang="${lang}" title="${name}" aria-label="${name}">${code}</a>`;
  });
  return `<div class="lang" role="group" aria-label="${escapeHtml(words.language)}">${items.join('')}</div>`;
}

function sidebar(model, page, root) {
  const words = WORDS[page.lang];
  const pages = pagesOf(model, page.lang);
  const link = (target) =>
    `<a href="${root}${target.href}"${target === page ? ' aria-current="page"' : ''}>${escapeHtml(target.title)}</a>`;
  const home = pages.find((p) => p.id === 'index');
  const groups = model.sections
    .map((section) => {
      const inSection = pages.filter((p) => p.section === section.id);
      if (inSection.length === 0) return '';
      const id = `nav-${section.id}`;
      return (
        `<div class="nav-group"><p class="label" id="${id}">${escapeHtml(section[page.lang])}</p>` +
        `<ul aria-labelledby="${id}">${inSection.map((p) => `<li>${link(p)}</li>`).join('')}</ul></div>`
      );
    })
    .join('');
  return (
    `<nav id="sidebar" class="sidebar" aria-label="${escapeHtml(words.navigation)}">` +
    (home ? `<p class="nav-home">${link(home)}</p>` : '') +
    groups +
    `<div class="sidebar-more"><a href="${WEBSITE[page.lang]}">${escapeHtml(words.website)}</a> <a href="${root}../">${escapeHtml(words.openApp)}</a></div>` +
    `</nav>`
  );
}

function tableOfContents(page) {
  const words = WORDS[page.lang];
  const h2 = page.headings.filter((heading) => heading.level === 2);
  if (h2.length < TOC_FROM) return '';
  const items = [];
  let open = false;
  for (const heading of page.headings.filter((h) => h.level === 2 || h.level === 3)) {
    if (heading.level === 2) {
      if (open) items.push('</ol></li>');
      else if (items.length > 0) items.push('</li>');
      open = false;
      items.push(`<li><a href="#${heading.id}">${escapeHtml(heading.text)}</a>`);
    } else {
      if (!open) items.push('<ol>');
      open = true;
      items.push(`<li><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`);
    }
  }
  if (open) items.push('</ol>');
  if (items.length > 0) items.push('</li>');
  return (
    `<nav class="toc" aria-labelledby="toc-title"><p class="label" id="toc-title">${escapeHtml(words.onThisPage)}</p>` +
    `<ol>${items.join('')}</ol></nav>`
  );
}

function pager(model, page, root) {
  const words = WORDS[page.lang];
  const pages = pagesOf(model, page.lang);
  const index = pages.indexOf(page);
  const previous = pages[index - 1];
  const next = pages[index + 1];
  if (!previous && !next) return '';
  const cell = (target, kind) =>
    target
      ? `<a class="pager-${kind}" href="${root}${target.href}" rel="${kind === 'previous' ? 'prev' : 'next'}">` +
        `<span class="label">${kind === 'previous' ? ARROW_LEFT : ''}${escapeHtml(words[kind])}${kind === 'next' ? ARROW_RIGHT : ''}</span>` +
        `<span class="pager-title">${escapeHtml(target.title)}</span></a>`
      : '<span></span>';
  return `<nav class="pager" aria-label="${escapeHtml(words.pager)}">${cell(previous, 'previous')}${cell(next, 'next')}</nav>`;
}

function footer(model, page, root) {
  const words = WORDS[page.lang];
  return (
    `<footer class="footer"><div class="page footer-grid">` +
    `<div class="col"><span class="label">PixelCake</span>${escapeHtml(words.motto)}</div>` +
    `<div class="col"><span class="label">${escapeHtml(words.source)}</span><a href="${REPOSITORY}" rel="noopener">${REPOSITORY.replace('https://', '')}</a><br>AGPL-3.0</div>` +
    `<div class="col"><span class="label">${escapeHtml(words.contact)}</span><a href="mailto:${CONTACT}">${CONTACT}</a></div>` +
    `<div class="col"><span class="label">${escapeHtml(words.language)}</span>${escapeHtml(words.languageNote)}${languageSwitch(model, page, root)}</div>` +
    `</div></footer>`
  );
}

function searchDialog(page, root) {
  const words = WORDS[page.lang];
  const texts = {
    loading: words.searchLoading,
    failed: words.searchFailed,
    hint: words.searchHint,
    one: words.searchCount(1),
    many: words.searchCount(2).replace('2', '{n}'),
    none: words.searchNone('{q}'),
  };
  return (
    `<dialog class="search-dialog" aria-labelledby="search-title" data-index="${root}search-${page.lang}.json" data-root="${root}" data-words="${escapeHtml(JSON.stringify(texts))}">` +
    `<div class="search-head" role="search"><h2 class="label" id="search-title">${escapeHtml(words.searchTitle)}</h2>` +
    `<input type="search" class="search-input" aria-labelledby="search-title" aria-describedby="search-status" aria-controls="search-results" placeholder="${escapeHtml(words.searchPlaceholder)}" autocomplete="off" spellcheck="false">` +
    `<button type="button" class="search-close">${escapeHtml(words.searchClose)}</button></div>` +
    `<p class="search-status" id="search-status" role="status" aria-live="polite"></p>` +
    `<ol class="search-results" id="search-results"></ol>` +
    `</dialog>`
  );
}

/**
 * The whole document of a page. `assets` names the files of assets/ with
 * the fingerprint that makes a browser fetch them again when they change.
 */
export function renderPage(model, page, { assets = {}, dev = false } = {}) {
  const words = WORDS[page.lang];
  const root = '../'.repeat(page.depth);
  const asset = (name) => `${root}assets/${assets[name] ?? name}`;
  const isHome = page.id === 'index';
  const title = isHome ? page.title : `${page.title} — ${words.siteTitle}`;
  const canonical = `${SITE_URL}${page.href}`;
  const alternates = LANGUAGES.map((lang) => {
    const other = lang === page.lang ? page : counterpart(model, page, lang);
    return other ? `<link rel="alternate" hreflang="${lang}" href="${SITE_URL}${other.href}">` : '';
  });
  const english = page.lang === LANGUAGES[0] ? page : counterpart(model, page, LANGUAGES[0]);
  if (english) alternates.push(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${english.href}">`);
  const otherLocales = LANGUAGES.filter((lang) => lang !== page.lang)
    .map((lang) => `<meta property="og:locale:alternate" content="${LOCALE[lang]}">`)
    .join('');
  const homeHref = pagesOf(model, page.lang).find((p) => p.id === 'index')?.href ?? '';
  const attributes = [
    `lang="${page.lang}"`,
    isHome && page.lang === LANGUAGES[0] ? 'data-italian-home="it/"' : '',
    dev ? 'data-dev-reload="/__docs/events"' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const shareAlt =
    page.lang === 'it'
      ? 'PixelCake: il disegno di rete che ti risponde.'
      : 'PixelCake: the network drawing that answers back.';

  return `<!doctype html>
<html ${attributes}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="${canonical}">
${alternates.join('\n')}
<link rel="icon" href="${root}../favicon.ico" sizes="48x48">
<link rel="icon" href="${root}../favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}../apple-touch-icon.png">
<meta property="og:type" content="${isHome ? 'website' : 'article'}">
<meta property="og:site_name" content="PixelCake">
<meta property="og:locale" content="${LOCALE[page.lang]}">${otherLocales}
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:image" content="${SHARE_IMAGE[page.lang]}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${escapeHtml(shareAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(page.description)}">
<meta name="twitter:image" content="${SHARE_IMAGE[page.lang]}">
<link rel="preload" href="${root}assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset('docs.css')}">
<script src="${asset('docs.js')}"></script>
</head>
<body>
<a class="skip" href="#main">${escapeHtml(words.skip)}</a>
<header class="masthead">
<div class="page masthead-grid">
<a class="brand" href="${root}${homeHref}" aria-label="${escapeHtml(words.homeLabel)}">
<img class="only-light" src="${root}assets/pixelcake-colore.svg" alt="" width="132" height="38">
<img class="only-dark" src="${root}assets/pixelcake-negativo.svg" alt="" width="132" height="38">
<span class="brand-docs">${escapeHtml(words.documentation)}</span>
</a>
<div class="tools">
<button type="button" class="search-open" aria-haspopup="dialog" aria-keyshortcuts="/">${SEARCH_ICON}<span class="search-word">${escapeHtml(words.search)}</span><kbd aria-hidden="true">/</kbd></button>
<button type="button" class="menu-toggle" aria-expanded="false" aria-controls="sidebar">${escapeHtml(words.contents)}</button>
<nav class="nav" aria-label="PixelCake">
<a class="nav-site" href="${WEBSITE[page.lang]}">${escapeHtml(words.website)}</a>
<button type="button" class="theme-toggle" data-light="${escapeHtml(words.light)}" data-dark="${escapeHtml(words.dark)}" data-to-light="${escapeHtml(words.toLight)}" data-to-dark="${escapeHtml(words.toDark)}">${escapeHtml(words.dark)}</button>
${languageSwitch(model, page, root)}
<a class="button nav-app" href="${root}../">${escapeHtml(words.openApp)}${ARROW_RIGHT}</a>
</nav>
</div>
</div>
</header>
<div class="page docs">
${sidebar(model, page, root)}
<main id="main" tabindex="-1">
<article class="article${page.headings.filter((h) => h.level === 2).length >= TOC_FROM ? ' has-toc' : ''}">
<header class="page-head">
${page.section ? `<p class="label crumb">${escapeHtml(sectionTitle(model, page.section, page.lang))}</p>` : ''}
<h1>${escapeHtml(page.title)}</h1>
${page.description ? `<p class="lead">${escapeHtml(page.description)}</p>` : ''}
</header>
${tableOfContents(page)}
<div class="prose">
${page.stub ? `<p class="stub-note" role="note">${escapeHtml(words.stub)}</p>\n` : ''}${page.html}
</div>
${pager(model, page, root)}
<p class="page-source"><a href="${REPOSITORY}/blob/main/documentation/${page.rel}" rel="noopener">${escapeHtml(words.sourceOfPage)}</a></p>
</article>
</main>
</div>
${footer(model, page, root)}
${searchDialog(page, root)}
<p class="toast" role="status" aria-live="polite"></p>
</body>
</html>
`;
}

/**
 * The index the search of one language reads: an entry for each page and
 * for each of its sections, with its words. What is still to be written is
 * left out.
 */
export function searchIndex(model, lang) {
  const entries = [];
  for (const page of pagesOf(model, lang)) {
    const section = page.section ? sectionTitle(model, page.section, lang) : '';
    for (const part of page.sections) {
      const text = part.text.join(' ').replace(/\s+/g, ' ').trim().slice(0, 600);
      if (!part.id) {
        entries.push({ t: page.title, s: section, u: page.href, h: '', x: [page.description, text].filter(Boolean).join(' ') });
      } else {
        entries.push({ t: page.title, s: section, u: `${page.href}#${part.id}`, h: part.heading, x: text });
      }
    }
  }
  return { lang, entries };
}
