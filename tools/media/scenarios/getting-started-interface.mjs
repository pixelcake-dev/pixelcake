// The picture of "The interface": the office sample on the board, the Simulation
// panel open on the left, the terminal after a ping, and ten parts of the screen
// marked with a number (the page names each one by its label). Only the poster is
// used: record it with --formats png, once per language and per theme.
//
// The numbers are drawn over the page by a small script, at the end, so that they
// sit on the real places of the parts (read from the page); the app is not touched.

const WORDS = {
  en: {
    addDevice: 'Add device',
    samples: 'Samples',
    sample: 'Office: two networks and a router',
    fit: 'Fit to window',
    view: 'View',
    simulation: 'Simulation',
    console: 'Console',
    closeTerminal: 'Close the terminal',
    terminalInput: 'Terminal input',
  },
  it: {
    addDevice: 'Aggiungi dispositivo',
    samples: 'Esempi',
    sample: 'Ufficio: due reti e un router',
    fit: 'Adatta alla finestra',
    view: 'Vista',
    simulation: 'Simulazione',
    console: 'Console',
    closeTerminal: 'Chiudi il terminale',
    terminalInput: 'Riga di comando del terminale',
  },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const input = `[aria-label="${w.terminalInput}"]`;

  // The parts, by number: where each is found on the page
  const draw = `
    const rect = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    const union = (list) => { const x = Math.min(...list.map((r) => r[0])), y = Math.min(...list.map((r) => r[1])), x2 = Math.max(...list.map((r) => r[0] + r[2])), y2 = Math.max(...list.map((r) => r[1] + r[3])); return [x, y, x2 - x, y2 - y]; };
    const bar = document.querySelector('.top-menubar');
    const items = [...document.querySelectorAll('.top-menubar .menu-item')].map(rect);
    const theme = bar.lastElementChild;
    // the board is what the panel leaves of the area under the bar
    const panel = rect(document.querySelector('.sidebar-panel'));
    const board = [panel[0] + panel[2], bar.getBoundingClientRect().bottom, window.innerWidth - panel[0] - panel[2], window.innerHeight - bar.getBoundingClientRect().bottom];
    const parts = [
      [1, union([rect(bar.querySelector('a')), ...items])],
      [2, rect(document.querySelector('.topbar-project'))],
      [3, rect(document.querySelector('.present-button'))],
      [4, rect(document.querySelector('.language-switch'))],
      [5, rect(theme)],
      [6, rect(document.querySelector('.sidebar'))],
      [7, rect(document.querySelector('.sidebar-panel'))],
      [8, board],
      [9, rect(document.querySelector('.react-flow__minimap'))],
      [10, rect(document.querySelector('[data-testid="terminal-window"]'))],
    ];
    // where the number sits, from the box: below the middle of a part of the bar,
    // at the top of a panel, beside the buttons and the small map
    const place = (n, x, y, width, height, size) => {
      if (n <= 5) return [x + width / 2 - size / 2, y + height - 3];
      if (n === 6) return [x + width / 2 - size / 2, y + 300];
      if (n === 7) return [x + width - size - 6, y + 54];
      if (n === 8) return [x + width - size - 8, y + 250];
      if (n === 9) return [x - size - 5, y + 2];
      return [x + width - size - 40, y + 5];
    };
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none';
    const accent = '#E8650A';
    const size = 22;
    for (const [n, [x, y, width, height]] of parts) {
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;border:2px solid ' + accent + ';border-radius:3px;left:' + (x - 1) + 'px;top:' + (y - 1) + 'px;width:' + (width + 2) + 'px;height:' + (height + 2) + 'px';
      const badge = document.createElement('div');
      badge.textContent = String(n);
      const [left, top] = place(n, x, y, width, height, size);
      badge.style.cssText = 'position:absolute;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + accent + ';color:#fff;font:700 13px/22px Inter,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;left:' + left + 'px;top:' + top + 'px';
      layer.append(box, badge);
    }
    document.body.append(layer);
    return true;
  `;

  const typed = (text) => [
    { do: 'type', text, delay: 25 },
    { do: 'key', key: 'Enter' },
  ];

  return {
    viewport: { width: 1100, height: 760 },
    welcome: true,
    // Prepared before the first frame: the terminal put at the bottom of the board
    // (opened, sized, moved, closed: the window keeps its place for the next time)
    setup: [
      { do: 'click', to: `button[aria-label="${w.console}"]`, ms: 100 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')` },
      { do: 'drag', from: '[data-testid="terminal-resize-handle"]', to: (p) => p.where('[data-testid="terminal-resize-handle"]').then((h) => ({ x: h.x - 190, y: h.y - 310 })), ms: 200, approach: 100 },
      { do: 'drag', from: { css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }, to: (p) => p.where({ css: '[data-testid="terminal-drag-handle"]', at: [0.3, 0.5] }).then((h) => ({ x: h.x + 70, y: h.y + 340 })), ms: 200, approach: 100 },
      { do: 'click', to: `[aria-label="${w.closeTerminal}"]`, ms: 100 },
    ],
    steps: [
      { do: 'click', to: `button[aria-label="${w.addDevice}"]`, ms: 200 },
      { do: 'click', to: { css: '.sidebar-panel button', text: w.samples }, ms: 200 },
      { do: 'click', to: { css: '.sidebar-panel *', text: w.sample }, ms: 200 },
      { do: 'wait', ms: 600 },
      { do: 'click', to: '.sidebar-panel-close', ms: 200 },
      // View → Fit to window: the pointer goes down inside the menu, not across the next one
      { do: 'move', to: { css: '.top-menubar .menu-item > span', text: w.view }, ms: 200 },
      { do: 'move', to: { css: 'li', text: w.fit, at: [0.1, 0.5] }, ms: 200 },
      { do: 'click', to: { css: 'li', text: w.fit }, ms: 200 },
      { do: 'wait', ms: 900 },
      { do: 'click', to: `button[aria-label="${w.simulation}"]`, ms: 200 },
      // The panel lies over the left of the board: the view is zoomed out a little, about its right edge,
      // so that the whole drawing stays clear of the panel (one turn of the wheel, as a hand would give it)
      { do: 'waitFor', until: `(() => { document.querySelector('.react-flow__pane').dispatchEvent(new WheelEvent('wheel', { deltaY: 330, clientX: 1060, clientY: 52, bubbles: true, cancelable: true })); return true; })()`, after: 900 },
      { do: 'click', to: `button[aria-label="${w.console}"]`, ms: 200 },
      { do: 'waitFor', until: `!!document.querySelector('${input}')`, after: 300 },
      ...typed('ping Web-01 from PC-1'),
      { do: 'waitFor', until: `document.querySelector('[data-testid="terminal-console"]').innerText.includes('Reply from')`, after: 1500 },
      { do: 'hidePointer' },
      { do: 'waitFor', until: `(() => { ${draw} })()`, after: 700 },
      { do: 'poster' },
      { do: 'wait', ms: 300 },
    ],
  };
}
