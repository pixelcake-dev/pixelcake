// A Chrome without a window, driven over the debugging protocol with real
// pointer and keyboard events, with a profile of its own (nothing of the
// user's browser is read or changed). It also draws a visible pointer on the
// page and records the screen as timed frames.
//
// Used by record.mjs; see README.md in this folder.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const DEFAULT_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** Kill a process and its children (a Chrome has many), on any system */
export function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

/**
 * The pointer: a small arrow that follows the mouse events of the page, and a
 * ring that opens at every press. Headless Chrome draws no pointer of its own.
 */
const POINTER_SCRIPT = `
(() => {
  if (window.__mediaPointer) return;
  const make = () => {
    if (!document.documentElement) return setTimeout(make, 5);
    const host = document.createElement('div');
    host.id = '__media-pointer';
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    host.innerHTML = '<svg id="__media-arrow" width="24" height="30" viewBox="0 0 24 30" style="position:absolute;left:0;top:0;display:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))"><path d="M2 1 L2 22 L7.4 17.2 L11 26 L14.6 24.4 L11 15.8 L18.4 15.8 Z" fill="#fff" stroke="#111" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(host);
    const arrow = host.firstChild;
    const place = (x, y) => { arrow.style.display = 'block'; arrow.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
    const ring = (x, y) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;left:' + (x - 6) + 'px;top:' + (y - 6) + 'px;width:12px;height:12px;border-radius:50%;border:3px solid #ff5a1f;box-sizing:border-box;pointer-events:none;z-index:2147483647;';
      document.documentElement.appendChild(r);
      const a = r.animate([{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(3.2)', opacity: 0 }], { duration: 420, easing: 'ease-out' });
      a.onfinish = () => r.remove();
    };
    for (const type of ['mousemove', 'mousedown', 'mouseup', 'pointermove', 'pointerdown'])
      window.addEventListener(type, (e) => { place(e.clientX, e.clientY); if (type === 'mousedown') ring(e.clientX, e.clientY); }, true);
    window.__mediaPointer = { place, hide: () => { arrow.style.display = 'none'; } };
  };
  make();
})();
`;

/**
 * Start the browser.
 * @param {object} o
 * @param {number} o.port       debugging port
 * @param {number} o.width      viewport width (CSS px; device scale factor is 1)
 * @param {number} o.height     viewport height
 * @param {string} o.profileDir folder for the profile of this run (made, then removed)
 * @param {string} [o.chrome]   path of chrome (else $CHROME_PATH, else the Windows default)
 * @param {'light'|'dark'} [o.theme]
 */
export async function startBrowser({ port, width, height, profileDir, chrome, theme = 'light' }) {
  const chromePath = chrome ?? process.env.CHROME_PATH ?? DEFAULT_CHROME;
  mkdirSync(profileDir, { recursive: true });
  const child = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      `--window-size=${width},${height}`,
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  let socketUrl;
  for (let i = 0; i < 100 && !socketUrl; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      socketUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    if (!socketUrl) await sleep(200);
  }
  if (!socketUrl) {
    killTree(child.pid);
    throw new Error('Chrome did not start (is CHROME_PATH right? port ' + port + ' free?)');
  }
  const ws = new WebSocket(socketUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let nextId = 1;
  const waiting = new Map();
  const listeners = new Map();
  const pageErrors = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails?.exception?.description ?? 'exception');
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      pageErrors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    }
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      for (const fn of listeners.get(message.method) ?? []) fn(message.params);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: POINTER_SCRIPT });

  /** Run async code in the page and give back its value */
  async function run(body) {
    const result = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    try {
      ws.close();
    } catch {
      // gone already
    }
    killTree(child.pid);
    await sleep(700);
    for (let i = 0; i < 5; i++) {
      try {
        rmSync(profileDir, { recursive: true, force: true });
        break;
      } catch {
        await sleep(500);
      }
    }
  }

  return { send, on, run, close, pageErrors, port };
}

/** A recording: frames of the screen with their times (screencast) */
export function startRecording(browser, framesDir, everyNthFrame = 1) {
  mkdirSync(framesDir, { recursive: true });
  const frames = []; // { file, at } (at: ms, on the clock of the browser)
  let count = 0;
  let live = true;
  const writes = [];
  browser.on('Page.screencastFrame', (p) => {
    // acknowledge at once, or the browser stops sending
    browser.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {});
    if (!live) return;
    const file = join(framesDir, String(count++).padStart(6, '0') + '.png');
    frames.push({ file, at: p.metadata.timestamp * 1000, arrived: Date.now() });
    writeFileSync(file, Buffer.from(p.data, 'base64'));
  });
  const ready = browser.send('Page.startScreencast', { format: 'png', everyNthFrame });
  return {
    frames,
    ready,
    async stop() {
      live = false;
      await browser.send('Page.stopScreencast').catch(() => {});
      await Promise.all(writes);
      return frames;
    },
  };
}

export const tmp = (name) => join(tmpdir(), name);
