// Presentation mode on the "Two sites" sample: a PC of the head office asks
// whether it reaches a PC of the branch (it does); the main line is cut (it
// still does, by the backup line, and the panel says how many exchanges take
// another path); then the backup router is taken down too (it no longer does,
// and the panel counts what stops). Nothing in the drawing changes.
//
// The sample is loaded and the presentation entered before the first frame
// (the setup is not filmed): the recording starts on the board of the
// presentation, with the panel open and no question asked.

const WORDS = {
  en: {
    addDevice: 'Add device',
    samples: 'Samples',
    sample: 'Two sites: main line and backup line',
    present: 'Present',
    fast: 'Fast',
    startHere: 'Start here',
    arriveHere: 'Arrive here',
    failure: 'Simulate a failure',
    stop: 'Stop',
    again: 'Show again',
    source: 'PC-HQ-1',
    target: 'PC-Branch-1',
    backup: 'R-Backup',
    hq: 'R-HQ',
    branch: 'R-Branch',
  },
  it: {
    addDevice: 'Aggiungi dispositivo',
    samples: 'Esempi',
    sample: 'Due sedi: linea principale e di riserva',
    present: 'Presenta',
    fast: 'Veloce',
    startHere: 'Parti da qui',
    arriveHere: 'Arriva qui',
    failure: 'Simula un guasto',
    stop: 'Ferma',
    again: 'Mostra di nuovo',
    source: 'PC-Sede-1',
    target: 'PC-Filiale-1',
    backup: 'R-Riserva',
    hq: 'R-Sede',
    branch: 'R-Filiale',
  },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const panel = '.sidebar-panel';
  const menuItem = (text) => ({ css: '.presentation-menu button', text });
  /** The packet is through: the button of the question says "Stop" while it travels */
  const through = `![...document.querySelectorAll('.presentation-panel button')].some((b) => b.textContent.trim() === ${JSON.stringify(w.stop)})`;
  /** The question is over: "Show again" is there, and the button is not "Stop" */
  const over = `[...document.querySelectorAll('.presentation-panel button')].some((b) => b.textContent.trim() === ${JSON.stringify(w.again)}) && ${through}`;
  const travelling = `[...document.querySelectorAll('.presentation-panel button')].some((b) => b.textContent.trim() === ${JSON.stringify(w.stop)})`;

  /** Click a device, then an entry of the small menu it opens */
  const onDevice = (device, text) => [
    { do: 'click', to: { device }, ms: 550 },
    { do: 'click', to: menuItem(text), ms: 400 },
  ];
  const waitForPacket = [
    { do: 'waitFor', until: travelling, timeout: 5000 },
    { do: 'waitFor', until: through, timeout: 40000 },
  ];

  return {
    viewport: { width: 1200, height: 780 },
    everyNthFrame: 1,

    setup: [
      { do: 'click', to: `button[aria-label="${w.addDevice}"]`, ms: 200 },
      { do: 'click', to: { css: `${panel} button, ${panel} [role="tab"]`, text: w.samples }, ms: 200 },
      { do: 'click', to: { css: `${panel} *`, text: w.sample }, ms: 200 },
      { do: 'wait', ms: 500 },
      { do: 'click', to: '.sidebar-panel-close', ms: 200 },
      { do: 'click', to: { css: 'button', text: w.present }, ms: 200 },
      { do: 'wait', ms: 1200 },
      { do: 'move', to: { x: 760, y: 420 }, ms: 100 },
      { do: 'hidePointer' },
    ],

    steps: [
      { do: 'wait', ms: 600 },
      { do: 'click', to: { css: '.presentation-bar button', text: w.fast }, ms: 600 },
      { do: 'speed', factor: 1.5 },
      ...onDevice(w.source, w.startHere),
      ...onDevice(w.target, w.arriveHere),
      { do: 'speed', factor: 1 },
      ...waitForPacket,
      { do: 'wait', ms: 1300 },

      // the main line is cut: a point on the dotted cable between the two routers
      // (a third of the way from the first, clear of the label in the middle)
      { do: 'click', to: async (p) => {
          const a = await p.where({ device: w.hq, handle: 'right' });
          const b = await p.where({ device: w.branch, handle: 'left' });
          return { x: a.x + (b.x - a.x) * 0.3, y: a.y };
        }, ms: 600 },
      { do: 'click', to: menuItem(w.failure), ms: 450 },
      ...waitForPacket,
      { do: 'wait', ms: 1500 },

      // the backup router goes down too
      ...onDevice(w.backup, w.failure),
      { do: 'wait', ms: 800 },
      ...waitForPacket,
      { do: 'waitFor', until: over, timeout: 40000, after: 600 },
      { do: 'poster' },
      { do: 'wait', ms: 2400 },
    ],
  };
}
