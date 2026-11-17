// The GIF at the top of the README: three devices are added and cabled, a ping
// from the PC reaches the server, a firewall rule is added, and the same ping
// stops at the firewall, with the reason.
//
// Why these three devices: a firewall that sits between two devices of one
// network and has no addresses on its ports passes traffic as a bridge, and its
// rules, written with addresses (not zones), are applied all the same. So the
// addresses the "Add" window suggests are already the right ones, and the
// only configuration the story needs is the rule itself.

const WORDS = {
  en: {
    addDevice: 'Add device',
    console: 'Console',
    closeTerminal: 'Close the terminal',
    terminalInput: 'Terminal input',
    searchPlaceholder: 'Search devices...',
    pc: 'PC',
    firewall: 'Firewall',
    server: 'Server',
  },
  it: {
    addDevice: 'Aggiungi dispositivo',
    console: 'Console',
    closeTerminal: 'Chiudi il terminale',
    terminalInput: 'Riga di comando del terminale',
    searchPlaceholder: 'Cerca dispositivo',
    pc: 'PC',
    firewall: 'Firewall',
    server: 'Server',
  },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const sidebar = (label) => `button[aria-label="${label}"]`;
  const input = `[aria-label="${w.terminalInput}"]`;
  const screen = '[data-testid="terminal-console"]';
  /** The prompt is back and the console says `text` */
  const answered = (text) => `!!document.querySelector('${input}') && document.querySelector('${screen}').innerText.includes(${JSON.stringify(text)})`;

  // the devices, named the way the app names them
  const PC = 'PC-1';
  const SERVER = 'Server-1';
  const FIREWALL = 'Firewall-1';

  /** Click a device of the list, let the window of its address be seen, press Add */
  const addFromList = (name, look = 500) => [
    { do: 'click', to: { css: '.sidebar-panel .device-list-name', text: name }, ms: 420 },
    { do: 'waitFor', until: `!!document.querySelector('.base-modal')`, after: look },
    { do: 'click', to: '.modal-actions button:last-of-type', ms: 450 },
    { do: 'waitFor', until: `!document.querySelector('.base-modal')`, after: 350 },
  ];

  return {
    viewport: { width: 1000, height: 620 },
    // fewer frames than the screen draws: the picture is the same, the work is less
    everyNthFrame: 1,

    // Prepared before the first frame: the terminal window put where it will not
    // cover the drawing (it is opened, sized, moved and closed; the window keeps
    // its place for the next time it opens)
    setup: [
      { do: 'click', to: sidebar(w.console), ms: 200 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')` },
      // resize: the grip at the bottom right corner, up and to the left
      { do: 'drag', from: '[data-testid="terminal-resize-handle"]', to: (p) => p.where('[data-testid="terminal-resize-handle"]').then((h) => ({ x: h.x - 20, y: h.y - 164 })), ms: 300, approach: 200 },
      // move: the title bar, to the lower left
      { do: 'drag', from: { css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }, to: (p) => p.where({ css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }).then((h) => ({ x: h.x - 76, y: h.y + 176 })), ms: 300, approach: 200 },
      { do: 'click', to: `button[aria-label="${w.closeTerminal}"]`, ms: 200 },
      { do: 'move', to: { x: 660, y: 200 }, ms: 100 },
      { do: 'hidePointer' },
    ],

    steps: [
      // 1. an empty board
      { do: 'wait', ms: 700 },

      // 2. three devices, from the panel
      { do: 'click', to: sidebar(w.addDevice), ms: 700 },
      { do: 'speed', factor: 2 },
      ...addFromList(w.pc, 800),
      ...addFromList(w.server, 250),
      { do: 'click', to: '.sidebar-panel input', ms: 450 },
      { do: 'type', text: w.firewall, delay: 50 },
      ...addFromList(w.firewall, 250),
      { do: 'click', to: '.sidebar-panel-close', ms: 400 },

      // laid out in a row: PC, firewall, server
      { do: 'drag', from: { device: PC }, to: { x: 210, y: 165 }, ms: 420, approach: 260, after: 100 },
      { do: 'drag', from: { device: SERVER }, to: { x: 830, y: 165 }, ms: 420, approach: 260, after: 100 },
      { do: 'drag', from: { device: FIREWALL }, to: { x: 520, y: 165 }, ms: 420, approach: 260, after: 100 },
      { do: 'speed', factor: 1 },
      { do: 'wait', ms: 200 },

      // 3. cables, pulled from a side of a device to a side of the next
      { do: 'drag', from: { device: PC, handle: 'right' }, to: { device: FIREWALL, handle: 'left' }, ms: 650, approach: 330, after: 120 },
      { do: 'drag', from: { device: FIREWALL, handle: 'right' }, to: { device: SERVER, handle: 'left' }, ms: 650, approach: 330, after: 120 },
      { do: 'wait', ms: 250 },

      // 4. a ping that arrives
      { do: 'click', to: sidebar(w.console), ms: 700 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')`, after: 300 },
      { do: 'speed', factor: 2 },
      { do: 'type', text: `ping ${SERVER} from ${PC}`, delay: 38 },
      { do: 'speed', factor: 1 },
      { do: 'key', key: 'Enter' },
      { do: 'waitFor', until: answered('Reply from') },
      { do: 'wait', ms: 900 },

      // 5. the firewall is made to block it
      { do: 'speed', factor: 2 },
      { do: 'type', text: `add rule deny ping from ${PC} to ${SERVER} on ${FIREWALL}`, delay: 38 },
      { do: 'key', key: 'Enter' },
      { do: 'speed', factor: 1 },
      { do: 'wait', ms: 600 },

      // 6. the same ping stops at the firewall
      { do: 'speed', factor: 1.5 },
      { do: 'type', text: `ping ${SERVER} from ${PC}`, delay: 38 },
      { do: 'speed', factor: 1 },
      { do: 'key', key: 'Enter' },
      { do: 'waitFor', until: answered('dropped at') },
      { do: 'wait', ms: 400 },
      { do: 'poster' },
      { do: 'wait', ms: 2000 },
    ],
  };
}
