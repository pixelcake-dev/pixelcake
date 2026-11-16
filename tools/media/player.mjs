// Plays a scenario (a list of steps) on a page of the browser, with real mouse
// and keyboard events sent over the debugging protocol. Nothing of the app's
// own code is called: the page is only read, to find where things are.
import { sleep } from './browser.mjs';

const BUTTONS = { left: 1, right: 2, middle: 4 };
const KEYS = {
  Enter: { code: 'Enter', vk: 13 },
  Tab: { code: 'Tab', vk: 9 },
  Escape: { code: 'Escape', vk: 27 },
  Backspace: { code: 'Backspace', vk: 8 },
  Delete: { code: 'Delete', vk: 46 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function createPlayer(browser) {
  const { send, run } = browser;
  let pointer = { x: 0, y: 0 };
  /** [{ at: wall clock ms, factor }]: how much faster the time of the video runs from then on */
  const speeds = [{ at: 0, factor: 1 }];
  let posterAt = null;

  const mouse = (type, x, y, { button = 'left', held = false } = {}) =>
    send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' && !held ? 'none' : button,
      buttons: type === 'mouseReleased' || (type === 'mouseMoved' && !held) ? 0 : BUTTONS[button],
      clickCount: type === 'mouseMoved' ? 0 : 1,
    });

  /**
   * Where a target is on the screen, as { x, y } (its middle, or the fraction
   * `at` of its box). A target is:
   *   { x, y }                        a point
   *   'css selector'                  the first visible element matching
   *   { css, text, nth, at }          elements matching css (default every element) whose own
   *                                   text, trimmed, is exactly `text`; the nth one (default 0)
   *   { device: 'PC-1', handle: 'right', at }   a device of the board by its name, or one of
   *                                   its four connection points (top, right, bottom, left)
   *   async (page) => point           anything else
   * It waits for the element to appear (up to `timeout` ms).
   */
  async function where(target, timeout = 8000) {
    if (typeof target === 'function') return where(await target(api), timeout);
    if (typeof target === 'string') target = { css: target };
    if (typeof target.x === 'number' && typeof target.y === 'number') return { x: target.x, y: target.y };
    const spec = JSON.stringify(target);
    const found = await run(`
      const spec = ${spec};
      const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const pick = () => {
        if (spec.device !== undefined) {
          const node = [...document.querySelectorAll('.react-flow__node')].find((n) => n.querySelector('.device-name')?.textContent.trim() === spec.device);
          if (!node) return null;
          if (spec.handle) return node.querySelector('.connect-point-' + spec.handle);
          return node.querySelector('.network-device') ?? node;
        }
        let list = [...document.querySelectorAll(spec.css ?? '*')].filter(visible);
        if (spec.text !== undefined) {
          const own = (e) => [...e.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
          list = list.filter((e) => (e.children.length === 0 ? e.textContent.trim() : own(e) || e.textContent.trim()) === spec.text);
          // the innermost one when a parent says the same
          list = list.filter((e) => !list.some((o) => o !== e && e.contains(o)));
        }
        return list[spec.nth ?? 0] ?? null;
      };
      const t0 = Date.now();
      let el = pick();
      while (!el && Date.now() - t0 < ${timeout}) { await new Promise((r) => setTimeout(r, 60)); el = pick(); }
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const at = spec.at ?? [0.5, 0.5];
      return { x: r.x + r.width * at[0], y: r.y + r.height * at[1] };
    `);
    if (!found) throw new Error('target not found: ' + spec);
    return found;
  }

  /** The pointer glides to a place (ease in and out) in `ms` of real time, as fast as events can be sent */
  async function move(to, { ms = 600, held = false, button = 'left' } = {}) {
    const from = pointer;
    const t0 = Date.now();
    for (;;) {
      const elapsed = Date.now() - t0;
      const k = ease(Math.min(1, elapsed / ms));
      await mouse('mouseMoved', from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, { held, button });
      if (elapsed >= ms) break;
    }
    pointer = { x: to.x, y: to.y };
  }

  async function press(button = 'left') {
    await mouse('mousePressed', pointer.x, pointer.y, { button });
  }
  async function release(button = 'left') {
    await mouse('mouseReleased', pointer.x, pointer.y, { button });
  }

  const handlers = {
    async wait(s) {
      await sleep(s.ms);
    },
    async move(s) {
      await move(await where(s.to), { ms: s.ms });
    },
    async click(s) {
      await move(await where(s.to), { ms: s.ms ?? 600 });
      await sleep(s.before ?? 90);
      await press();
      await sleep(s.down ?? 80);
      await release();
      await sleep(s.after ?? 150);
    },
    /** Press on `from`, glide (through `via` points, if any) to `to`, release */
    async drag(s) {
      await move(await where(s.from), { ms: s.approach ?? 500 });
      await sleep(90);
      await press();
      await sleep(80);
      for (const via of s.via ?? []) await move(await where(via), { ms: (s.ms ?? 800) / ((s.via?.length ?? 0) + 1), held: true });
      await move(await where(s.to), { ms: (s.ms ?? 800) / ((s.via?.length ?? 0) + 1), held: true });
      await sleep(s.hold ?? 120);
      await release();
      await sleep(s.after ?? 200);
    },
    /** Type into the focused field, key by key */
    async type(s) {
      for (const ch of s.text) {
        const t0 = Date.now();
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
        await sleep(Math.max(0, (s.delay ?? 45) - (Date.now() - t0)));
      }
      await sleep(s.after ?? 100);
    },
    async key(s) {
      const letter = /^[a-z]$/i.test(s.key);
      const k = KEYS[s.key] ?? (letter ? { code: 'Key' + s.key.toUpperCase(), vk: s.key.toUpperCase().charCodeAt(0) } : { code: s.key, vk: 0 });
      // modifiers: 1 alt, 2 control, 4 meta, 8 shift
      const modifiers = s.modifiers ?? 0;
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: s.key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: s.key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers });
      await sleep(s.after ?? 150);
    },
    /** Wait until an expression, read in the page, is true (a way to wait for the app, never to drive it) */
    async waitFor(s) {
      const ok = await run(`const t0 = Date.now(); while (Date.now() - t0 < ${s.timeout ?? 20000}) { if (${s.until}) return true; await new Promise((r) => setTimeout(r, 50)); } return false;`);
      if (!ok) throw new Error('timed out waiting for: ' + s.until);
      if (s.after) await sleep(s.after);
    },
    /** Time of the video runs `factor` times faster from here (1 to go back to normal) */
    async speed(s) {
      speeds.push({ at: Date.now(), factor: s.factor });
    },
    /** The frame shown at this moment is the poster */
    async poster() {
      posterAt = Date.now();
    },
    async hidePointer() {
      await run(`window.__mediaPointer?.hide()`);
    },
    /** Anything else: your own function, given the player */
    async call(s) {
      await s.fn(api);
    },
  };

  handlers.hold = handlers.wait;

  async function play(steps, label = 'step') {
    for (const [i, step] of steps.entries()) {
      const handler = handlers[step.do];
      if (!handler) throw new Error(`${label} ${i}: unknown step "${step.do}"`);
      const t0 = Date.now();
      try {
        await handler(step);
        if (process.env.MEDIA_DEBUG) console.log(`${label} ${i} ${step.do} ${Date.now() - t0} ms`);
      } catch (error) {
        throw new Error(`${label} ${i} (${step.do}): ${error.message}`);
      }
    }
  }

  const api = { where, move, press, release, play, handlers, speeds, get posterAt() { return posterAt; }, get pointer() { return pointer; } };
  return api;
}
