/**
 * Markdown as the documentation writes it: plain CommonMark with tables, and
 * a few conventions of its own (see documentation/WRITING.md).
 *
 *   ## A heading {#its-anchor}       every heading names its anchor, the
 *                                    same in both languages
 *   > [!NOTE] / [!TIP] / [!WARNING]  a box beside the text; [!LIMITS] says
 *   > [!LIMITS] / [!TODO]            what is not simulated; [!TODO] marks
 *                                    what is still to be written
 *   ![Alt](../../media/x.png "Caption")   alone in its paragraph: a figure.
 *                                    .gif is an animation, .mp4 / .webm a
 *                                    video (with x.poster.png); x.dark.png
 *                                    is shown in the dark theme
 *   ```ncl sample=company            a terminal session, run by the tests
 *   [Text](../building/vlans.md#x)   a link to another page, as a file
 *
 * Nothing here reads the disk but to find the variants of a picture and its
 * size. The words of the frame come from words.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { ANCHOR_PATTERN, MEDIA_DIR } from './config.mjs';
import { WORDS } from './words.mjs';

export const CALLOUTS = ['note', 'tip', 'warning', 'limits', 'todo'];
const HEADING_ANCHOR = /\s*\{#([^}]*)\}\s*$/;
const CALLOUT_MARK = /^\[!([A-Za-z]+)\][ \t]*/;
const EXTERNAL = /^[a-z][a-z0-9+.-]*:/i;
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif']);

/** What a terminal prompt looks like: `pixelcake> ` or, inside `use <device>`, `PC-1> ` */
export const PROMPT_LINE = /^([\p{L}\p{N}_.-]+(?: [\p{L}\p{N}_.-]+)*)> (.*)$/u;

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `ncl sample=company continue` → { lang: 'ncl', attrs: { sample: 'company' }, flags: ['continue'] } */
export function parseInfo(info) {
  const [lang = '', ...rest] = info.trim().split(/\s+/).filter(Boolean);
  const attrs = {};
  const flags = [];
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq > 0) attrs[part.slice(0, eq)] = part.slice(eq + 1);
    else flags.push(part);
  }
  return { lang: lang.toLowerCase(), attrs, flags };
}

/**
 * A terminal session as a page shows it: lines typed at a prompt, each with
 * what the terminal printed under it. Lines before the first prompt are kept
 * apart (a session starts with a command).
 */
export function parseSession(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const steps = [];
  const before = [];
  lines.forEach((text, index) => {
    const match = PROMPT_LINE.exec(text);
    if (match) steps.push({ prompt: match[1], command: match[2], output: [], line: index });
    else if (steps.length > 0) steps[steps.length - 1].output.push(text);
    else before.push(text);
  });
  return { steps, before };
}

/**
 * The fenced blocks of any Markdown text, with the line each opens on
 * (1-based): for a file outside documentation/ whose examples are run too.
 */
export function fencesOf(text) {
  return new MarkdownIt()
    .parse(text.replace(/\r\n/g, '\n'), {})
    .filter((token) => token.type === 'fence')
    .map((token) => ({ info: token.info, ...parseInfo(token.info), content: token.content, line: (token.map?.[0] ?? 0) + 1 }));
}

/** A heading's words as plain text */
function inlineText(token) {
  return (token.children ?? [])
    .map((child) => (child.type === 'softbreak' || child.type === 'hardbreak' ? ' ' : child.content ?? ''))
    .join('')
    .trim();
}

/** An anchor made from words, for a heading that forgot to name its own */
export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ── the size of a picture, so that the page does not jump when it arrives ── */

export function imageSize(file) {
  try {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.svg') {
      const text = fs.readFileSync(file, 'utf8').slice(0, 2000);
      const svg = /<svg\b[^>]*>/i.exec(text)?.[0] ?? '';
      const width = /\swidth="([\d.]+)(?:px)?"/.exec(svg)?.[1];
      const height = /\sheight="([\d.]+)(?:px)?"/.exec(svg)?.[1];
      if (width && height) return { width: Math.round(+width), height: Math.round(+height) };
      const box = /viewBox="[\d.-]+[ ,]+[\d.-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(svg);
      return box ? { width: Math.round(+box[1]), height: Math.round(+box[2]) } : null;
    }
    const head = Buffer.alloc(32);
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, head, 0, 32, 0);
    fs.closeSync(fd);
    if (ext === '.png' && head.toString('ascii', 1, 4) === 'PNG') {
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    }
    if (ext === '.gif' && head.toString('ascii', 0, 3) === 'GIF') {
      return { width: head.readUInt16LE(6), height: head.readUInt16LE(8) };
    }
  } catch {
    // (no size: the picture is still shown)
  }
  return null;
}

/* ── where a link or a picture leads ──────────────────────────────────── */

/**
 * A link as written in a page of `page.lang`: another page (a .md file, with
 * or without an anchor), an anchor of this page, a file of media, or an
 * address of the web. Paths are relative to the file of the page.
 */
export function resolveLink(href, page) {
  if (href.startsWith('#')) return { kind: 'anchor', file: page.file, anchor: href.slice(1) };
  if (EXTERNAL.test(href)) return { kind: 'external' };
  const [pathPart, anchor] = href.split('#');
  const target = path.resolve(path.dirname(page.file), decodeURIComponent(pathPart));
  if (target.endsWith('.md')) return { kind: 'page', file: target, anchor: anchor ?? null };
  const media = path.relative(MEDIA_DIR, target);
  if (!media.startsWith('..') && !path.isAbsolute(media)) {
    return { kind: 'media', file: target, media: media.split(path.sep).join('/') };
  }
  return { kind: 'bad', file: target };
}

/** The kind of a file of media, by its extension */
export function mediaKind(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.gif') return 'gif';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'other';
}

/** `x.png` → `x.dark.png`; `x.mp4` → `x.poster.png` */
export function variant(file, suffix, extension = path.extname(file)) {
  return file.slice(0, file.length - path.extname(file).length) + suffix + extension;
}

/* ── the rules added to markdown-it ────────────────────────────────────── */

/** `## Words {#anchor}`: the anchor taken off the words and given to the heading */
function headingAnchors(state) {
  const { tokens, env } = state;
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open.type !== 'heading_open') continue;
    const inline = tokens[i + 1];
    const children = inline.children ?? [];
    const last = [...children].reverse().find((child) => child.type === 'text');
    const match = last ? HEADING_ANCHOR.exec(last.content) : null;
    let id;
    if (match) {
      id = match[1].trim();
      last.content = last.content.slice(0, match.index);
      inline.content = inline.content.replace(HEADING_ANCHOR, '');
    }
    const text = inlineText(inline);
    const level = Number(open.tag.slice(1));
    const line = (open.map?.[0] ?? 0) + 1 + env.offset;
    if (!id) {
      id = slugify(text);
      env.problems.push({ kind: 'anchor', line, message: `heading "${text}" has no anchor: write it as "${open.markup} ${text} {#${id}}"` });
    } else if (!ANCHOR_PATTERN.test(id)) {
      env.problems.push({ kind: 'anchor', line, message: `anchor "${id}" of "${text}": use lower case letters, digits and single dashes` });
    }
    if (level === 1) {
      env.problems.push({ kind: 'heading', line, message: `"# ${text}": the title of a page is in its front matter; sections start at "##"` });
    }
    open.attrSet('id', id);
    open.meta = { ...(open.meta ?? {}), id };
    env.headings.push({ level, id, text, line });
  }
}

/** `> [!NOTE]` at the start of a quote: a box of that kind */
function callouts(state) {
  const { tokens, env } = state;
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open.type !== 'blockquote_open') continue;
    const inline = tokens[i + 2];
    if (tokens[i + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') continue;
    const match = CALLOUT_MARK.exec(inline.content);
    if (!match) continue;
    const kind = match[1].toLowerCase();
    const line = (open.map?.[0] ?? 0) + 1 + env.offset;
    if (!CALLOUTS.includes(kind)) {
      env.problems.push({ kind: 'callout', line, message: `[!${match[1]}] is not a kind of box: ${CALLOUTS.map((c) => `[!${c.toUpperCase()}]`).join(', ')}` });
      continue;
    }
    // The mark is taken off the words, with the line break after it
    inline.content = inline.content.slice(match[0].length).replace(/^\n/, '');
    const children = inline.children ?? [];
    const first = children[0];
    if (first?.type === 'text') {
      first.content = first.content.replace(CALLOUT_MARK, '');
      if (first.content === '') {
        children.shift();
        if (children[0]?.type === 'softbreak') children.shift();
      }
    }
    if (children.length === 0) {
      tokens[i + 1].hidden = true;
      tokens[i + 3].hidden = true;
    }
    // Its end: the closing token at the same depth
    let depth = 0;
    for (let j = i; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_open') depth++;
      if (tokens[j].type === 'blockquote_close' && --depth === 0) {
        tokens[j].meta = { callout: kind };
        break;
      }
    }
    open.meta = { callout: kind };
    if (kind === 'todo') env.todos.push({ line });
  }
}

/** A paragraph that holds one picture and nothing else: a figure */
function figures(state) {
  const { tokens } = state;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'paragraph_open' || tokens[i].hidden) continue;
    const inline = tokens[i + 1];
    const children = (inline.children ?? []).filter((child) => !(child.type === 'text' && child.content.trim() === '') && child.type !== 'softbreak');
    if (children.length === 1 && children[0].type === 'image') {
      tokens[i].meta = { figure: true };
      tokens[i + 2].meta = { figure: true };
      children[0].meta = { figure: true };
    }
  }
}

/**
 * What the checks and the search need: the links, pictures and code blocks
 * with their lines, the words in quotes, the text of each section
 */
function collect(state) {
  const { tokens, env } = state;
  let section = { id: '', heading: '', text: [] };
  env.sections.push(section);
  let todoDepth = 0;
  let quoteDepth = 0;
  let headingOpen = null;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const line = (token.map?.[0] ?? 0) + 1 + env.offset;
    if (token.type === 'blockquote_open') {
      quoteDepth++;
      if (token.meta?.callout === 'todo' && todoDepth === 0) todoDepth = quoteDepth;
    }
    if (token.type === 'blockquote_close') {
      if (todoDepth === quoteDepth) todoDepth = 0;
      quoteDepth--;
    }
    if (token.type === 'heading_open') {
      headingOpen = token;
      if (token.tag === 'h2' || token.tag === 'h3') {
        section = { id: token.meta.id, heading: inlineText(tokens[i + 1]), text: [], line, level: Number(token.tag.slice(1)), body: 0 };
        env.sections.push(section);
      }
    }
    if (token.type === 'heading_close') headingOpen = null;
    if (token.type === 'fence' || token.type === 'code_block') {
      const info = parseInfo(token.info ?? '');
      env.code.push({ info: token.info ?? '', ...info, content: token.content, line });
      if (!todoDepth) section.body++;
      if (info.lang === 'ncl') {
        const commands = parseSession(token.content).steps.map((step) => step.command);
        if (!todoDepth) section.text.push(commands.join(' · '));
      } else if (!todoDepth) {
        section.text.push(token.content.slice(0, 200));
      }
      continue;
    }
    if (token.type !== 'inline') continue;
    if (!headingOpen && !todoDepth && token.content.trim() !== '') section.body++;
    let plain = '';
    for (const child of token.children ?? []) {
      if (child.type === 'text') {
        plain += child.content;
        for (const quote of child.content.matchAll(/“([^”]+)”|«([^»]+)»/g)) {
          env.quotes.push({ text: quote[1] ?? quote[2], mark: quote[1] !== undefined ? '“' : '«', line, todo: todoDepth > 0 });
        }
      } else if (child.type === 'code_inline') {
        plain += child.content;
        env.inlineCode.push({ content: child.content, line, todo: todoDepth > 0 });
      } else if (child.type === 'softbreak' || child.type === 'hardbreak') {
        plain += ' ';
      } else if (child.type === 'link_open') {
        env.links.push({ href: child.attrGet('href'), line, todo: todoDepth > 0 });
      } else if (child.type === 'image') {
        for (const quote of (child.attrGet('title') ?? '').matchAll(/“([^”]+)”|«([^»]+)»/g)) {
          env.quotes.push({ text: quote[1] ?? quote[2], mark: quote[1] !== undefined ? '“' : '«', line, todo: todoDepth > 0 });
        }
        env.images.push({
          src: child.attrGet('src'),
          alt: inlineText(child),
          caption: child.attrGet('title') ?? '',
          figure: child.meta?.figure === true,
          line,
        });
        plain += inlineText(child);
      }
    }
    if (!headingOpen && !todoDepth) section.text.push(plain);
  }
}

/* ── how each piece is written out ─────────────────────────────────────── */

/** The address of a page, of an anchor or of a file of media, as seen from the page being written */
function hrefFor(href, env) {
  const target = resolveLink(href, env.page);
  if (target.kind === 'anchor' || target.kind === 'external' || target.kind === 'bad') return href;
  if (target.kind === 'media') return `${env.rootRel}media/${target.media}`;
  const other = env.pageByFile.get(target.file);
  if (!other) return href;
  return `${env.rootRel}${other.href}${target.anchor ? `#${target.anchor}` : ''}`;
}

function mediaUrl(file, env) {
  return `${env.rootRel}media/${path.relative(MEDIA_DIR, file).split(path.sep).join('/')}`;
}

function sizeAttributes(file) {
  const size = imageSize(file);
  return size ? ` width="${size.width}" height="${size.height}"` : '';
}

function renderMedia(token, env) {
  const words = WORDS[env.page.lang];
  const src = token.attrGet('src');
  const alt = inlineText(token);
  const caption = token.attrGet('title') ?? '';
  const target = resolveLink(src, env.page);
  const file = target.file ?? '';
  const kind = target.kind === 'media' ? mediaKind(file) : 'image';
  const url = target.kind === 'media' ? mediaUrl(file, env) : escapeHtml(src);
  const figure = token.meta?.figure === true;
  let html;

  if (kind === 'video') {
    const poster = variant(file, '.poster', '.png');
    const sources = [];
    const webm = variant(file, '', '.webm');
    const mp4 = variant(file, '', '.mp4');
    if (fs.existsSync(webm)) sources.push(`<source src="${mediaUrl(webm, env)}" type="video/webm">`);
    if (fs.existsSync(mp4)) sources.push(`<source src="${mediaUrl(mp4, env)}" type="video/mp4">`);
    if (sources.length === 0) sources.push(`<source src="${url}">`);
    html =
      `<div class="video" data-video data-play="${escapeHtml(words.playVideo)}" data-pause="${escapeHtml(words.pauseVideo)}">` +
      `<video controls muted loop playsinline preload="none" poster="${mediaUrl(poster, env)}"${sizeAttributes(poster)} aria-label="${escapeHtml(alt)}">` +
      sources.join('') +
      `</video></div>`;
  } else {
    const dark = variant(file, '.dark');
    const lazy = ' loading="lazy" decoding="async"';
    const animation =
      kind === 'gif' && fs.existsSync(variant(file, '.poster', '.png'))
        ? ` data-animation data-poster="${mediaUrl(variant(file, '.poster', '.png'), env)}" data-play="${escapeHtml(words.playAnimation)}" data-pause="${escapeHtml(words.pauseAnimation)}"`
        : '';
    if (target.kind === 'media' && fs.existsSync(dark)) {
      html =
        `<img class="only-light" src="${url}" alt="${escapeHtml(alt)}"${sizeAttributes(file)}${lazy}${animation}>` +
        `<img class="only-dark" src="${mediaUrl(dark, env)}" alt="${escapeHtml(alt)}"${sizeAttributes(dark)}${lazy}${animation ? animation.replace(mediaUrl(variant(file, '.poster', '.png'), env), mediaUrl(variant(dark, '.poster', '.png'), env)) : ''}>`;
    } else {
      html = `<img src="${url}" alt="${escapeHtml(alt)}"${target.kind === 'media' ? sizeAttributes(file) : ''}${lazy}${animation}>`;
    }
  }
  if (!figure) return html;
  return `<div class="shot">${html}</div>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}`;
}

/** The colour a line of the terminal is shown in (as the app's terminal does, roughly) */
function toneOf(text) {
  if (/^(?:Ping|Trace|Browse|Mail|Download|Lookup) failed\b|^\s*✗|^\s*dropped at:|^no such |^unknown |^error\b/.test(text)) return 'bad';
  if (/^Reply from |^Trace complete: destination reached|^Page received|^Mail delivered|^Download complete|^\s*✓/.test(text)) return 'good';
  if (/^\s+note:/.test(text)) return 'dim';
  return '';
}

function renderTerminal(token, env) {
  const words = WORDS[env.page.lang];
  const { attrs, flags } = parseInfo(token.info);
  const { steps, before } = parseSession(token.content);
  const lines = [...before.map((text) => escapeHtml(text))];
  for (const step of steps) {
    lines.push(`<span class="prompt">${escapeHtml(step.prompt)}&gt; </span><span class="cmd">${escapeHtml(step.command)}</span>`);
    for (const text of step.output) {
      const tone = toneOf(text);
      lines.push(tone ? `<span class="${tone}">${escapeHtml(text)}</span>` : escapeHtml(text));
    }
  }
  let strap = '';
  if (!flags.includes('continue')) {
    if (attrs.fixture) strap = words.onFixture(attrs.fixture);
    else if (attrs.sample === 'empty') strap = words.emptyBoard;
    else if (attrs.sample && words.samples[attrs.sample]) strap = words.onSample(words.samples[attrs.sample]);
    // (the example runs in presentation mode, where failures are simulated)
    if (strap && flags.includes('presentation')) strap += `, ${words.inPresentation}`;
  }
  const commands = steps.map((step) => step.command).join('\n');
  // The bar of the window, as the terminal of the app has: what the example runs on, and the copy button
  return (
    `<div class="code terminal">` +
    `<div class="terminal-bar"><span><span class="terminal-title">${escapeHtml(words.terminal)}</span>` +
    (strap ? `<span class="terminal-sample">${escapeHtml(strap)}</span>` : '') +
    `</span>` +
    `<button type="button" class="copy" data-copy="${escapeHtml(commands)}" aria-label="${escapeHtml(words.copyCommands)}" data-copied="${escapeHtml(words.copied)}">${escapeHtml(words.copy)}</button></div>` +
    `<pre tabindex="0" aria-label="${escapeHtml(words.terminal)}"><code>${lines.join('\n')}</code></pre>` +
    `</div>\n`
  );
}

function renderCode(token, env) {
  const words = WORDS[env.page.lang];
  const { lang } = parseInfo(token.info ?? '');
  if (lang === 'ncl') return renderTerminal(token, env);
  const content = token.content.replace(/\n$/, '');
  return (
    `<div class="code">` +
    `<pre tabindex="0" aria-label="${escapeHtml(words.codeBlock)}"><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(content)}</code></pre>` +
    `<button type="button" class="copy" data-copy="${escapeHtml(content)}" aria-label="${escapeHtml(words.copyCode)}" data-copied="${escapeHtml(words.copied)}">${escapeHtml(words.copy)}</button>` +
    `</div>\n`
  );
}

/** The markdown-it the documentation is written in */
export function createMarkdown() {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  md.core.ruler.push('pixelcake_anchors', headingAnchors);
  md.core.ruler.push('pixelcake_callouts', callouts);
  md.core.ruler.push('pixelcake_figures', figures);
  md.core.ruler.push('pixelcake_collect', collect);

  const rules = md.renderer.rules;
  const self = (tokens, idx, options, env, renderer) => renderer.renderToken(tokens, idx, options);

  rules.heading_close = (tokens, idx, options, env, renderer) => {
    const open = tokens[idx - 2];
    const id = open.meta?.id;
    const level = Number(open.tag.slice(1));
    if (!id || level < 2) return renderer.renderToken(tokens, idx, options);
    const words = WORDS[env.page.lang];
    return `<a class="anchor" href="#${escapeHtml(id)}" aria-label="${escapeHtml(words.copyLink)}" data-copied="${escapeHtml(words.linkCopied)}"><span aria-hidden="true">#</span></a></${open.tag}>\n`;
  };

  rules.blockquote_open = (tokens, idx, options, env, renderer) => {
    const kind = tokens[idx].meta?.callout;
    if (!kind) return renderer.renderToken(tokens, idx, options);
    const title = WORDS[env.page.lang].callouts[kind];
    return `<div class="callout callout-${kind}" role="note"><p class="callout-title">${escapeHtml(title)}</p>\n`;
  };
  rules.blockquote_close = (tokens, idx, options, env, renderer) =>
    tokens[idx].meta?.callout ? '</div>\n' : renderer.renderToken(tokens, idx, options);

  rules.paragraph_open = (tokens, idx, options, env, renderer) =>
    tokens[idx].meta?.figure ? '<figure class="figure">' : self(tokens, idx, options, env, renderer);
  rules.paragraph_close = (tokens, idx, options, env, renderer) =>
    tokens[idx].meta?.figure ? '</figure>\n' : self(tokens, idx, options, env, renderer);

  rules.image = (tokens, idx, options, env) => renderMedia(tokens[idx], env);
  rules.fence = (tokens, idx, options, env) => renderCode(tokens[idx], env);
  rules.code_block = (tokens, idx, options, env) => renderCode(tokens[idx], env);

  rules.link_open = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx];
    const href = token.attrGet('href') ?? '';
    token.attrSet('href', hrefFor(href, env));
    if (EXTERNAL.test(href) && !href.startsWith('mailto:')) token.attrSet('rel', 'noopener');
    return renderer.renderToken(tokens, idx, options);
  };

  rules.table_open = (tokens, idx, options, env, renderer) =>
    `<div class="table-wrap" tabindex="0" role="region" aria-label="${escapeHtml(WORDS[env.page.lang].table)}">` +
    renderer.renderToken(tokens, idx, options);
  rules.table_close = (tokens, idx, options, env, renderer) => renderer.renderToken(tokens, idx, options) + '</div>\n';

  return md;
}
