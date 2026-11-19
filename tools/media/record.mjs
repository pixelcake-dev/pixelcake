// Records a scenario on the built app and makes a GIF, an MP4 and a poster.
// See README.md in this folder.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { killTree, sleep, startBrowser, startRecording } from './browser.mjs';
import { encode, timeline } from './encode.mjs';
import { createPlayer } from './player.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '..', '..', 'frontend');

const { values: opt } = parseArgs({
  options: {
    scenario: { type: 'string', default: 'readme-demo' },
    lang: { type: 'string', default: 'en' },
    theme: { type: 'string', default: 'light' },
    out: { type: 'string', default: resolve(process.cwd(), 'media-out') },
    name: { type: 'string' },
    formats: { type: 'string', default: 'gif,mp4,png' },
    fps: { type: 'string', default: '20' },
    'gif-width': { type: 'string' },
    dither: { type: 'string', default: 'sierra2_4a' },
    'app-port': { type: 'string', default: '4184' },
    'chrome-port': { type: 'string', default: '9341' },
    chrome: { type: 'string' },
    work: { type: 'string' },
    build: { type: 'boolean', default: false },
    'keep-frames': { type: 'boolean', default: false },
    reencode: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (opt.help) {
  console.log(`usage: node tools/media/record.mjs [options]
  --scenario <name|file>   scenario in tools/media/scenarios (default readme-demo) or a path
  --lang en|it             language of the interface (default en)
  --theme light|dark       theme (default light)
  --out <folder>           where the results go (default ./media-out)
  --name <base>            base of the file names (default the scenario name)
  --formats gif,mp4,png    what to make (default all three)
  --fps <n>                frames per second of the GIF (default 20)
  --gif-width <px>         scale the GIF to this width (default: as recorded)
  --dither <name>          paletteuse dither: sierra2_4a (default), bayer, floyd_steinberg, none
  --app-port, --chrome-port   ports of the preview of the build and of Chrome (4184, 9341)
  --chrome <path>          Chrome (else $CHROME_PATH, else the Windows default)
  --work <folder>          folder for frames and the profile (default a temporary one)
  --build                  run "pnpm build" in frontend first
  --keep-frames            keep the raw frames (and their times) in the work folder
  --reencode               make the files again from the frames kept in --work, without recording`);
  process.exit(0);
}
if (!['en', 'it'].includes(opt.lang) || !['light', 'dark'].includes(opt.theme)) {
  console.error('--lang is en or it, --theme is light or dark');
  process.exit(2);
}

const appUrl = `http://127.0.0.1:${opt['app-port']}/`;
const scenarioFile = existsSync(opt.scenario) ? resolve(opt.scenario) : join(here, 'scenarios', opt.scenario.replace(/\.mjs$/, '') + '.mjs');
const base = opt.name ?? opt.scenario.replace(/^.*[\\/]/, '').replace(/\.mjs$/, '');
const out = isAbsolute(opt.out) ? opt.out : resolve(process.cwd(), opt.out);
const work = opt.work ? resolve(opt.work) : join(tmpdir(), 'pixelcake-media-' + Date.now());
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });

let preview = null;
let browser = null;
const cleanup = async () => {
  if (browser) await browser.close();
  if (preview) killTree(preview.pid);
};
process.on('SIGINT', () => cleanup().finally(() => process.exit(130)));

const answers = async () => {
  try {
    return (await fetch(appUrl)).ok;
  } catch {
    return false;
  }
};

try {
  if (opt.build) {
    console.log('building the app...');
    const built = spawnSync('pnpm', ['build'], { cwd: frontend, shell: true, stdio: 'inherit' });
    if (built.status !== 0) throw new Error('pnpm build failed');
  }
  if (opt.reencode) {
    const kept = JSON.parse(readFileSync(join(work, 'timed.json'), 'utf-8'));
    const made = encode({ ...kept, workDir: work, outBase: join(out, `${base}.${opt.lang}${opt.theme === 'dark' ? '.dark' : ''}`), formats: opt.formats.split(','), fps: Number(opt.fps), gifWidth: opt['gif-width'] ? Number(opt['gif-width']) : undefined, dither: opt.dither });
    console.log(`duration ${made.duration.toFixed(1)} s`);
    for (const kind of ['gif', 'mp4', 'png']) if (made[kind]) console.log(`${kind}: ${made[kind].file}  ${(made[kind].bytes / 1024).toFixed(0)} KB`);
    process.exit(0);
  }
  if (!(await answers())) {
    if (!existsSync(join(frontend, 'dist'))) throw new Error('frontend/dist does not exist: run with --build (or "pnpm build" in frontend)');
    console.log(`starting the preview of the build on ${appUrl}`);
    preview = spawn('pnpm', ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', opt['app-port'], '--strictPort'], { cwd: frontend, shell: true, stdio: 'ignore' });
    for (let i = 0; i < 100 && !(await answers()); i++) await sleep(200);
    if (!(await answers())) throw new Error('the preview did not start');
  }

  const scenario = (await import(pathToFileURL(scenarioFile).href)).default({ lang: opt.lang, theme: opt.theme });
  const { width, height } = scenario.viewport ?? { width: 1000, height: 620 };

  browser = await startBrowser({
    port: Number(opt['chrome-port']),
    width,
    height,
    profileDir: join(work, 'profile'),
    chrome: opt.chrome,
    theme: opt.theme,
  });
  const { send, run } = browser;

  // A clean start: only the keys of the app are removed, never the whole storage
  await send('Page.navigate', { url: appUrl });
  await sleep(1500);
  await run(`
    Object.keys(localStorage).filter((k) => k.startsWith('pixelcake-')).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('pixelcake-language', ${JSON.stringify(opt.lang)});
    ${scenario.welcome ? '' : `localStorage.setItem('pixelcake-hide-welcome', 'true');`}
    // (a new profile is a first visit: the guided tour and the first question
    // of the company sample are marked as seen, so that neither is filmed)
    localStorage.setItem('pixelcake-tour-seen', 'true');
    localStorage.setItem('pixelcake-first-try-seen', 'true');
    for (const [k, v] of Object.entries(${JSON.stringify(scenario.storage ?? {})})) localStorage.setItem(k, v);
  `);
  await send('Page.navigate', { url: appUrl });
  await run(`const t0 = Date.now(); while (!document.querySelector('.react-flow') && Date.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50)); await document.fonts.ready; await new Promise((r) => setTimeout(r, 800));`);

  const player = createPlayer(browser);
  await player.play(scenario.setup ?? [], 'setup');
  await sleep(400);

  // the recording
  const frames = startRecording(browser, join(work, 'frames'), Number(scenario.everyNthFrame ?? 1));
  await frames.ready;
  const startWall = Date.now();
  await sleep(400);
  if (frames.frames.length === 0) await player.handlers.move({ to: { x: player.pointer.x + 1, y: player.pointer.y }, ms: 40 });
  await player.play(scenario.steps, 'step');
  await sleep(150);
  const endWall = Date.now();
  await frames.stop();
  if (browser.pageErrors.length) console.log('the page said: ' + [...new Set(browser.pageErrors)].slice(0, 5).join(' | '));

  // browser clock -> Node clock, by the frame that came with the least delay
  const skew = Math.min(...frames.frames.map((f) => f.at - f.arrived));
  const wallOf = (f) => f.at - skew;
  const timed = timeline({ frames: frames.frames, wallOf, speeds: player.speeds, startWall, endWall });
  const seconds = timed.reduce((s, f) => s + f.duration, 0);
  console.log(`${frames.frames.length} frames captured over ${((endWall - startWall) / 1000).toFixed(1)} s, ${seconds.toFixed(1)} s of video`);

  const posterWall = player.posterAt ?? undefined;
  const tailHold = scenario.tailHold ?? 0;
  if (opt['keep-frames']) writeFileSync(join(work, 'timed.json'), JSON.stringify({ timed, posterWall, tailHold }));
  const made = encode({
    timed,
    workDir: work,
    outBase: join(out, `${base}.${opt.lang}${opt.theme === 'dark' ? '.dark' : ''}`),
    formats: opt.formats.split(','),
    fps: Number(opt.fps),
    gifWidth: opt['gif-width'] ? Number(opt['gif-width']) : undefined,
    dither: opt.dither,
    posterWall: player.posterAt ?? undefined,
    tailHold: scenario.tailHold ?? 0,
  });
  console.log(`duration ${made.duration.toFixed(1)} s`);
  for (const kind of ['gif', 'mp4', 'png']) if (made[kind]) console.log(`${kind}: ${made[kind].file}  ${(made[kind].bytes / 1024).toFixed(0)} KB`);
  if (!opt['keep-frames']) rmSync(join(work, 'frames'), { recursive: true, force: true });
  else console.log(`frames kept in ${join(work, 'frames')} (${readdirSync(join(work, 'frames')).length})`);
} catch (error) {
  console.error('FAILED: ' + error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
