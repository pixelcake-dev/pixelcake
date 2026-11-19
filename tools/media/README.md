# Recorder for GIFs and videos of the app

A small tool that plays a **scenario** on the built app, with a real pointer and
keyboard, and records the screen. It makes a GIF, an MP4 and a PNG poster of the
same take, in English or Italian, in the light or the dark theme. It is how
`docs/demo.gif` at the top of the main README was made, and it is meant for the
GIFs and videos of the documentation.

Nothing is faked: the scenario only moves the pointer, presses, drags and types,
through Chrome's debugging protocol, and the app answers as it always does. The
page is read (to find where a button is, or to wait until the app has answered),
never driven by calling the app's code.

## Needs

- Node 22 or newer (it uses the `WebSocket` and `fetch` of Node itself; no package to install)
- Google Chrome (a window is never opened: it runs with `--headless=new`, with a
  profile folder of its own that is removed at the end)
- `ffmpeg` on the `PATH`
- the app built: `pnpm build` in `frontend`

## Run

From the root of the repository:

```sh
node tools/media/record.mjs --build --out media-out
```

That builds the app, starts `vite preview` on port 4184 (if nothing answers there
yet), plays the scenario `readme-demo` in English and the light theme, and writes
into `media-out/`:

| file | what |
|---|---|
| `readme-demo.en.gif` | the GIF (two passes: `palettegen`, then `paletteuse`) |
| `readme-demo.en.mp4` | H.264, `yuv420p`, `+faststart` |
| `readme-demo.en.poster.png` | the poster: the frame marked by the scenario's `poster` step (else the last) |

Other runs:

```sh
node tools/media/record.mjs --lang it --out media-out            # the Italian one
node tools/media/record.mjs --theme dark --formats gif --out x    # dark, GIF only
node tools/media/record.mjs --scenario path/to/mine.mjs --out x   # a scenario of your own
```

Options (`--help` lists them): `--scenario`, `--lang en|it`, `--theme light|dark`,
`--out`, `--name`, `--formats gif,mp4,png`, `--fps` (GIF, default 20),
`--gif-width` (scale the GIF; default is as recorded, which is the sharpest),
`--dither` (default `sierra2_4a`; `bayer` and `none` are smaller),
`--app-port` (4184), `--chrome-port` (9341), `--chrome`, `--work`, `--build`,
`--keep-frames`, `--reencode`.

Chrome is found at `$CHROME_PATH`, else at `C:/Program Files/Google/Chrome/Application/chrome.exe`;
`--chrome` overrides both. The app's storage is cleaned the careful way: only the
keys that start with `pixelcake-` are removed, never the whole `localStorage`.

`--keep-frames --work <folder>` keeps the raw frames and their times; with
`--reencode --work <folder>` the files are made again from them (a different fps,
width or dither) without recording. `MEDIA_DEBUG=1` prints how long each step took.

## How it records

The screen is captured with `Page.startScreencast`: a frame every time the page
repaints, each with its own time. The times are kept and ffmpeg is given every
frame with the exact duration it was on screen, so the timing is even whatever
the load of the machine. The viewport has a fixed size (the scenario's) and a
device scale factor of 1, and the GIF is that size, not scaled, so the text is
sharp.

The pointer is drawn by the tool: headless Chrome has none. An arrow follows the
mouse events of the page, and a ring opens at each press.

## A scenario

A scenario is a module that exports a function of `{ lang, theme }` and returns
the viewport, a `setup` (played before the recording starts: the pointer moves,
but nothing is filmed) and the `steps` (filmed). Both are lists of steps.

```js
export default function scenario({ lang }) {
  return {
    viewport: { width: 1000, height: 620 },
    setup: [],
    steps: [
      { do: 'wait', ms: 1000 },
      { do: 'click', to: 'button[aria-label="Add device"]' },        // a CSS selector
      { do: 'speed', factor: 2 },                                     // the next stretch plays twice as fast
      { do: 'click', to: { css: '.device-list-name', text: 'PC' } },  // by its text
      { do: 'waitFor', until: `!!document.querySelector('.base-modal')`, after: 400 },
      { do: 'click', to: '.modal-actions button:last-of-type' },
      { do: 'speed', factor: 1 },
      { do: 'drag', from: { device: 'PC-1' }, to: { x: 300, y: 160 } },
      { do: 'drag', from: { device: 'PC-1', handle: 'right' }, to: { device: 'Firewall-1', handle: 'left' } },
      { do: 'type', text: 'ping Server-1 from PC-1', delay: 40 },
      { do: 'key', key: 'Enter' },
      { do: 'poster' },                                              // the poster is this frame
      { do: 'wait', ms: 2000 },                                       // held at the end, then it loops
    ],
  };
}
```

Other keys of the returned object: `welcome: true` shows the welcome screen (it is
hidden by default, so the board starts empty), `storage: { key: 'value' }` sets
more keys before the app loads, `tailHold` adds seconds to the last frame.

The profile of a run is new, so to the app it is a first visit. The two things a
first visit brings up by themselves, the guided tour (once the welcome screen is
left) and the first question of the company sample (once it is loaded), are marked
as seen before the app loads (`pixelcake-tour-seen`, `pixelcake-first-try-seen`):
neither is ever filmed. A scenario that wants to film the tour opens it from
Help → “Guided tour”.

### Steps

| step | what it does |
|---|---|
| `wait` / hold: `{ ms }` | nothing happens; the frame stays on screen |
| `move`: `{ to, ms }` | the pointer glides there (ease in and out) in `ms` of real time |
| `click`: `{ to, ms }` | glide, press, release |
| `drag`: `{ from, to, via?, ms, approach }` | glide to `from`, press, glide (through the `via` points) to `to`, release |
| `type`: `{ text, delay }` | key by key, into the focused field |
| `key`: `{ key, modifiers? }` | `Enter`, `Tab`, `Escape`, `Backspace`, `ArrowUp`..., or a letter; modifiers: 1 alt, 2 control, 8 shift |
| `waitFor`: `{ until, timeout?, after? }` | wait until a JavaScript expression, read in the page, is true |
| `speed`: `{ factor }` | from here on the video runs `factor` times faster (a stretch is not cut, it is played quickly); `1` goes back |
| `poster` | the frame on screen now is the poster |
| `hidePointer` | the arrow is hidden until the pointer moves again |
| `call`: `{ fn }` | your own function, given the player |

### Targets

A target (`to`, `from`, `via`) is one of:

- `{ x, y }`, a point of the viewport;
- `'css selector'`, the first visible element that matches;
- `{ css, text, nth, at }`, the elements of `css` (default every one) whose text is exactly `text`,
  the `nth` one; `at: [0.3, 0.5]` aims at a fraction of the box instead of its middle;
- `{ device: 'PC-1' }`, a device of the board by its name, or with `handle: 'top' | 'right' | 'bottom' | 'left'`, one of its four connection points;
- an async function `(player) => point`.

A target that does not appear within 8 seconds stops the run with the number of
the step that was waiting for it.

### Writing one that reads well

- A filmed pointer is slower than a hand: give moves 400 to 700 ms and keep a
  beat (`after`) after a click so the result is seen.
- Speed up what is boring (forms, typing a long command), never what is the point
  (the packet travelling, the answer): hold those for a second or two.
- Prepare in `setup` what cannot be shown briefly (here: a window of the terminal
  put where it does not cover the drawing), and say so in a comment.
- Words of the interface are in the language asked for: keep a small table per
  language, as `scenarios/readme-demo.mjs` does.
- Look at the result frame by frame (for example
  `ffmpeg -i x.gif -vf "fps=2,scale=400:-1,tile=5x6" -frames:v 1 sheet.png`).

## Files

- `record.mjs` the command line: starts everything, runs, encodes, cleans up
- `browser.mjs` Chrome, the debugging protocol, the drawn pointer, the screencast
- `player.mjs` the steps and the targets
- `encode.mjs` the timeline and ffmpeg (GIF, MP4, poster)
- `scenarios/readme-demo.mjs` the GIF of the README: a PC, a server and a firewall are added and cabled, a ping arrives, a rule is added to the firewall, the same ping is stopped
