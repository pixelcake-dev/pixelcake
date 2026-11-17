// The picture of "What PixelCake is": the company sample on the board. A ping from the
// sales PC reaches the web server of the management software; the gateway of the PC
// is then set to an address nobody has, and the same ping stops at the PC, which is
// left red on the board (the terminal is put away to show the whole drawing). Only the poster is used: record it with
// --formats png, once per language and per theme.

const WORDS = {
  en: {
    load: 'Load the sample network',
    console: 'Console',
    closeTerminal: 'Close the terminal',
    terminalInput: 'Terminal input',
    pc: 'PC-Sales',
    server: 'Web-ERP',
    view: 'View',
    fit: 'Fit to window',
  },
  it: {
    load: 'Carica la rete di esempio',
    console: 'Console',
    closeTerminal: 'Chiudi il terminale',
    terminalInput: 'Riga di comando del terminale',
    pc: 'PC-Vendite',
    server: 'Web-Gestionale',
    view: 'Vista',
    fit: 'Adatta alla finestra',
  },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const input = `[aria-label="${w.terminalInput}"]`;
  const screen = '[data-testid="terminal-console"]';
  const said = (text) => `!!document.querySelector('${input}') && document.querySelector('${screen}').innerText.includes(${JSON.stringify(text)})`;
  const typed = (text) => [
    { do: 'type', text, delay: 20 },
    { do: 'key', key: 'Enter' },
  ];

  return {
    viewport: { width: 1100, height: 700 },
    welcome: true,
    // Prepared before the first frame: the terminal made wide and low, and put at the bottom of the board
    setup: [
      { do: 'click', to: `button[aria-label="${w.console}"]`, ms: 100 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')` },
      { do: 'drag', from: '[data-testid="terminal-resize-handle"]', to: (p) => p.where('[data-testid="terminal-resize-handle"]').then((h) => ({ x: h.x + 100, y: h.y - 290 })), ms: 200, approach: 100 },
      { do: 'drag', from: { css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }, to: (p) => p.where({ css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }).then((h) => ({ x: h.x - 20, y: h.y + 420 })), ms: 200, approach: 100 },
      { do: 'click', to: `[aria-label="${w.closeTerminal}"]`, ms: 100 },
    ],
    steps: [
      { do: 'click', to: { css: 'button', text: w.load }, ms: 200 },
      { do: 'wait', ms: 1200 },
      // View → Fit to window: the pointer goes down inside the menu, not across the next one
      { do: 'move', to: { css: '.top-menubar .menu-item > span', text: w.view }, ms: 200 },
      { do: 'move', to: { css: 'li', text: w.fit, at: [0.1, 0.5] }, ms: 200 },
      { do: 'click', to: { css: 'li', text: w.fit }, ms: 200 },
      { do: 'wait', ms: 900 },
      { do: 'click', to: `button[aria-label="${w.console}"]`, ms: 200 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')`, after: 300 },
      ...typed(`ping ${w.server} from ${w.pc}`),
      { do: 'waitFor', until: said('Reply from'), after: 600 },
      ...typed(`set gateway of ${w.pc} to 192.168.10.254`),
      { do: 'wait', ms: 300 },
      ...typed(`ping ${w.server} from ${w.pc}`),
      { do: 'waitFor', until: said('dropped at'), after: 1500 },
      // the terminal is put away: the board keeps the answer, the PC where the packet stopped is red
      { do: 'click', to: `[aria-label="${w.closeTerminal}"]`, ms: 300 },
      { do: 'wait', ms: 600 },
      { do: 'hidePointer' },
      { do: 'poster' },
      { do: 'wait', ms: 300 },
    ],
  };
}
