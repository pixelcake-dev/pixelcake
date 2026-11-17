#!/usr/bin/env node
/**
 * The documentation, from documentation/ to frontend/dist/docs.
 *
 *   node scripts/build-docs.mjs          build once (part of `pnpm build`); a problem stops it
 *   node scripts/build-docs.mjs --dev    build, then again at every change, and serve it at
 *                                        http://127.0.0.1:5180/docs/ with the page reloading
 *                                        by itself (`pnpm docs:dev`; --port <n> for another port)
 *
 * The terminal examples are not run here: `pnpm docs:test` runs them, with
 * every other check of the documentation (see documentation/WRITING.md).
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { buildDocs } from './docs/build.mjs';
import { ASSETS_DIR, DOCS_DIR, FRONTEND_DIR, OUT_DIR } from './docs/config.mjs';
import { formatProblem } from './docs/source.mjs';

const args = process.argv.slice(2);
const dev = args.includes('--dev');
const portArg = args.indexOf('--port');
const port = portArg >= 0 ? Number(args[portArg + 1]) : 5180;

function build() {
  const started = Date.now();
  const { problems, pages, media } = buildDocs({ dev });
  for (const problem of problems) console.error(`  ✗ ${formatProblem(problem)}`);
  const verdict = problems.length === 0 ? 'no problems' : `${problems.length} problem${problems.length === 1 ? '' : 's'}`;
  console.log(`docs: ${pages} pages, ${media} files of media, ${verdict} (${Date.now() - started} ms) → ${path.relative(FRONTEND_DIR, OUT_DIR)}`);
  return problems;
}

if (!dev) {
  const problems = build();
  if (problems.length > 0) process.exit(1);
} else {
  serve();
}

/* ── the preview while writing ───────────────────────────────────────── */

function serve() {
  const listeners = new Set();
  const rebuild = () => {
    try {
      build();
    } catch (error) {
      console.error(`docs: the build failed: ${error.stack ?? error}`);
    }
    for (const response of listeners) response.write('data: reload\n\n');
  };
  rebuild();

  let timer = null;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 150);
  };
  fs.watch(DOCS_DIR, { recursive: true }, later);
  fs.watch(ASSETS_DIR, { recursive: true }, later);

  const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
  };

  const sendFile = (response, file) => {
    response.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  };

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/__docs/events') {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      response.write('retry: 1000\n\n');
      listeners.add(response);
      request.on('close', () => listeners.delete(response));
      return;
    }
    if (pathname === '/' || pathname === '/docs') {
      response.writeHead(302, { location: '/docs/' });
      response.end();
      return;
    }
    if (pathname.startsWith('/docs/')) {
      let file = path.join(OUT_DIR, pathname.slice('/docs/'.length));
      if (!file.startsWith(OUT_DIR)) {
        response.writeHead(403).end();
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(302, { location: `${pathname}/` });
          response.end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      if (fs.existsSync(file)) return sendFile(response, file);
    } else {
      // The icons of the app, which the pages name from one folder up
      const file = path.join(FRONTEND_DIR, 'public', pathname);
      if (file.startsWith(path.join(FRONTEND_DIR, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return sendFile(response, file);
      }
    }
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(pathname.startsWith('/docs/') ? 'Not found.' : 'Only the documentation is served here: the app runs with `pnpm dev`.');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`docs: http://127.0.0.1:${port}/docs/ (it/ for Italian) — rebuilt at every change, Ctrl+C to stop`);
    console.log('docs: a change to the generator itself (scripts/docs/*.mjs) needs a restart');
  });
}
