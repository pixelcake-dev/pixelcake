// The window "Export image", opened from the bar of the presentation on the
// "Two sites" sample, with a question asked (a PC of the head office, a PC of
// the branch) and the main line cut: the picture shows the failure and, under
// the drawing, the question, the answer and what the failure does to the rest
// of the network. The poster is the screenshot used by the documentation.
//
// The sample is loaded and the presentation entered before the first frame.

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
    exportImage: 'Export image',
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
    exportImage: 'Esporta immagine',
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
  const onDevice = (device, text) => [
    { do: 'click', to: { device }, ms: 300 },
    { do: 'click', to: menuItem(text), ms: 250 },
  ];

  return {
    viewport: { width: 1200, height: 860 },
    setup: [
      { do: 'click', to: `button[aria-label="${w.addDevice}"]`, ms: 100 },
      { do: 'click', to: { css: `${panel} button, ${panel} [role="tab"]`, text: w.samples }, ms: 100 },
      { do: 'click', to: { css: `${panel} *`, text: w.sample }, ms: 100 },
      { do: 'wait', ms: 400 },
      { do: 'click', to: '.sidebar-panel-close', ms: 100 },
      { do: 'click', to: { css: 'button', text: w.present }, ms: 100 },
      { do: 'wait', ms: 1000 },
      ...onDevice(w.source, w.startHere),
      ...onDevice(w.target, w.arriveHere),
      { do: 'wait', ms: 600 },
      { do: 'click', to: async (p) => {
          const a = await p.where({ device: w.hq, handle: 'right' });
          const b = await p.where({ device: w.branch, handle: 'left' });
          return { x: a.x + (b.x - a.x) * 0.3, y: a.y };
        }, ms: 300 },
      { do: 'click', to: menuItem(w.failure), ms: 250 },
      { do: 'wait', ms: 2500 },
    ],

    steps: [
      { do: 'click', to: `button[aria-label="${w.exportImage}"]`, ms: 500 },
      { do: 'waitFor', until: `!!document.querySelector('.export-image img')`, after: 1500 },
      { do: 'hidePointer' },
      { do: 'wait', ms: 300 },
      { do: 'poster' },
      { do: 'wait', ms: 400 },
    ],
  };
}
