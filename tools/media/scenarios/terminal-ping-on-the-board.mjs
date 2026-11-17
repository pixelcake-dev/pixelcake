// The video of the terminal overview: a ping is typed, the packet travels on
// the board from the PC to the server and the lines of the answer appear as it
// reaches each device; then a trace is typed.
//
// The board (a PC, a switch and a server, cabled in a row) is made before the
// first frame, from the Add panel and with the pointer, as the screen of the
// README is; the terminal window is sized and put under the row, then closed
// (it keeps its place for the next time it opens).

const WORDS = {
  en: {
    addDevice: 'Add device',
    console: 'Console',
    closeTerminal: 'Close the terminal',
    terminalInput: 'Terminal input',
    pc: 'PC',
    switch: 'Switch',
    server: 'Server',
  },
  it: {
    addDevice: 'Aggiungi dispositivo',
    console: 'Console',
    closeTerminal: 'Chiudi il terminale',
    terminalInput: 'Riga di comando del terminale',
    pc: 'PC',
    switch: 'Switch',
    server: 'Server',
  },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const sidebar = (label) => `button[aria-label="${label}"]`;
  const input = `[aria-label="${w.terminalInput}"]`;
  const screen = '[data-testid="terminal-console"]';
  /** The prompt is back and the console says `text` */
  const answered = (text) =>
    `!!document.querySelector('${input}') && document.querySelector('${screen}').innerText.includes(${JSON.stringify(text)})`;

  // the devices, named the way the app names them
  const PC = 'PC-1';
  const SWITCH = 'Switch-1';
  const SERVER = 'Server-1';

  /** Click a device of the list, let the window of its address be seen, press Add */
  const addFromList = (name) => [
    { do: 'click', to: { css: '.sidebar-panel .device-list-name', text: name }, ms: 200 },
    { do: 'waitFor', until: `!!document.querySelector('.base-modal')`, after: 200 },
    { do: 'click', to: '.modal-actions button:last-of-type', ms: 200 },
    { do: 'waitFor', until: `!document.querySelector('.base-modal')`, after: 200 },
  ];

  return {
    viewport: { width: 1000, height: 620 },
    everyNthFrame: 1,

    setup: [
      { do: 'click', to: sidebar(w.addDevice), ms: 200 },
      ...addFromList(w.pc),
      ...addFromList(w.switch),
      ...addFromList(w.server),
      { do: 'click', to: '.sidebar-panel-close', ms: 200 },
      // a row: PC, switch, server
      { do: 'drag', from: { device: PC }, to: { x: 210, y: 165 }, ms: 300, approach: 200, after: 100 },
      { do: 'drag', from: { device: SERVER }, to: { x: 830, y: 165 }, ms: 300, approach: 200, after: 100 },
      { do: 'drag', from: { device: SWITCH }, to: { x: 520, y: 165 }, ms: 300, approach: 200, after: 100 },
      { do: 'drag', from: { device: PC, handle: 'right' }, to: { device: SWITCH, handle: 'left' }, ms: 400, approach: 200, after: 100 },
      { do: 'drag', from: { device: SWITCH, handle: 'right' }, to: { device: SERVER, handle: 'left' }, ms: 400, approach: 200, after: 100 },
      // the terminal window, smaller and under the row
      { do: 'click', to: sidebar(w.console), ms: 200 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')` },
      { do: 'drag', from: '[data-testid="terminal-resize-handle"]', to: (p) => p.where('[data-testid="terminal-resize-handle"]').then((h) => ({ x: h.x - 20, y: h.y - 164 })), ms: 300, approach: 200 },
      { do: 'drag', from: { css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }, to: (p) => p.where({ css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }).then((h) => ({ x: h.x - 76, y: h.y + 176 })), ms: 300, approach: 200 },
      { do: 'click', to: `button[aria-label="${w.closeTerminal}"]`, ms: 200 },
      { do: 'move', to: { x: 660, y: 200 }, ms: 100 },
      { do: 'hidePointer' },
    ],

    steps: [
      { do: 'wait', ms: 900 },

      // open the terminal from the bar on the left
      { do: 'click', to: sidebar(w.console), ms: 700 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')`, after: 500 },

      // a ping: the packet travels, the lines come as it reaches each device
      { do: 'speed', factor: 2 },
      { do: 'type', text: `ping ${SERVER} from ${PC}`, delay: 45 },
      { do: 'speed', factor: 1 },
      { do: 'key', key: 'Enter' },
      { do: 'waitFor', until: answered('Reply from') },
      { do: 'wait', ms: 1200 },

      // a trace of the same way, hop by hop
      { do: 'speed', factor: 2 },
      { do: 'type', text: `trace ${SERVER} from ${PC}`, delay: 45 },
      { do: 'speed', factor: 1 },
      { do: 'key', key: 'Enter' },
      { do: 'waitFor', until: answered('Trace complete') },
      { do: 'wait', ms: 400 },
      { do: 'poster' },
      { do: 'wait', ms: 2200 },
    ],
  };
}
