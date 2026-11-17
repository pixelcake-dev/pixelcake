// A question asked from the simulation panel, twice, on the "Site" sample:
// a ping from a PC of the offices to a server of the internal network, which
// arrives (the server's lamp turns green), then a ping from the public web
// server to the same server, which the firewall stops (its lamp turns red, and
// a notice gives the reason).
//
// The sample is loaded before the first frame (the setup is not filmed): the
// recording starts on the board with the panel closed.

const WORDS = {
  en: {
    simulation: 'Simulation',
    addDevice: 'Add device',
    samples: 'Samples',
    site: 'Site: VLANs, DMZ and firewall',
    start: 'Start simulation',
    stop: 'Stop simulation',
    source: 'PC-Office-1 (192.168.10.11)',
    web: 'Web-Public (172.16.0.10)',
    internal: 'Srv-Internal (192.168.20.10)',
    closePanel: '.sidebar-panel-close',
  },
  it: {
    simulation: 'Simulazione',
    addDevice: 'Aggiungi dispositivo',
    samples: 'Esempi',
    site: 'Sede: VLAN, DMZ e firewall',
    start: 'Avvia simulazione',
    stop: 'Ferma simulazione',
    source: 'PC-Uffici-1 (192.168.10.11)',
    web: 'Web-Pubblico (172.16.0.10)',
    internal: 'Srv-Interno (192.168.20.10)',
    closePanel: '.sidebar-panel-close',
  },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const sidebar = (label) => `button[aria-label="${label}"]`;
  const panel = '.sidebar-panel';
  const pick = (text) => ({ css: `${panel} button`, text });
  const buttonSays = (text) =>
    `[...document.querySelectorAll('${panel} button.btn, ${panel} button')].some((b) => b.textContent.trim() === ${JSON.stringify(text)})`;

  /** Open a drop-down of the panel and click an entry of it */
  const choose = (n, text) => [
    { do: 'click', to: { css: `${panel} button[aria-haspopup="listbox"]`, nth: n }, ms: 450 },
    { do: 'type', text: text.split(' ')[0], delay: 25 },
    { do: 'click', to: pick(text), ms: 450 },
  ];

  /** Start, then wait for the packet to be through */
  const ask = () => [
    { do: 'click', to: { css: `${panel} button`, text: w.start }, ms: 450 },
    { do: 'waitFor', until: buttonSays(w.stop), timeout: 4000 },
    { do: 'waitFor', until: buttonSays(w.start), timeout: 30000 },
  ];

  return {
    viewport: { width: 1100, height: 660 },
    everyNthFrame: 1,

    // Prepared before the first frame: the sample loaded, the panel closed
    setup: [
      { do: 'click', to: sidebar(w.addDevice), ms: 200 },
      { do: 'click', to: { css: `${panel} button, ${panel} [role="tab"]`, text: w.samples }, ms: 200 },
      { do: 'click', to: { css: `${panel} *`, text: w.site }, ms: 200 },
      { do: 'wait', ms: 500 },
      { do: 'click', to: w.closePanel, ms: 200 },
      { do: 'move', to: { x: 700, y: 560 }, ms: 100 },
      { do: 'hidePointer' },
    ],

    steps: [
      { do: 'wait', ms: 900 },
      { do: 'click', to: sidebar(w.simulation), ms: 700 },
      { do: 'wait', ms: 400 },
      { do: 'speed', factor: 2 },
      ...choose(0, w.source),
      ...choose(1, w.internal),
      { do: 'speed', factor: 1 },
      { do: 'wait', ms: 300 },
      ...ask(),
      { do: 'wait', ms: 1500 },

      { do: 'speed', factor: 2 },
      ...choose(0, w.web),
      { do: 'speed', factor: 1 },
      { do: 'wait', ms: 300 },
      ...ask(),
      { do: 'wait', ms: 600 },
      { do: 'poster' },
      { do: 'wait', ms: 2800 },
    ],
  };
}
