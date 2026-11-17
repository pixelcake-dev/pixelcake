// "Bulk add": the window, one switch of 24 ports, three PCs and two servers,
// then the grid of new devices on the board, selected.
//
//   node tools/media/record.mjs --scenario building-bulk --lang en --formats mp4,png \
//     --out documentation/media/bulk-add --name bulk --app-port 4186 --chrome-port 9343

const WORDS = {
  en: { addDevice: 'Add device', bulk: 'Bulk add', addRow: 'Add Switch/Router/Firewall', switch: 'Switch', increase: 'Increase', add: 'Add (6)' },
  it: { addDevice: 'Aggiungi dispositivo', bulk: 'Aggiungi in blocco', addRow: 'Aggiungi Switch/Router/Firewall', switch: 'Switch', increase: 'Aumenta', add: 'Aggiungi (6)' },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const inWindow = (text) => ({ css: '.base-modal *', text });
  const plus = (nth) => ({ css: `.base-modal button[title="${w.increase}"]`, nth });
  const modalOpen = `!!document.querySelector('.base-modal')`;

  return {
    viewport: { width: 1200, height: 900 },
    setup: [{ do: 'move', to: { x: 700, y: 400 }, ms: 100 }, { do: 'hidePointer' }],
    steps: [
      { do: 'wait', ms: 900 },
      { do: 'click', to: `button[aria-label="${w.addDevice}"]`, ms: 600 },
      { do: 'click', to: { css: '.sidebar-panel *', text: w.bulk }, ms: 600 },
      { do: 'waitFor', until: modalOpen, after: 900 },

      // a switch of 24 ports, one of them
      { do: 'click', to: inWindow(w.addRow), ms: 600 },
      { do: 'click', to: inWindow(w.switch), ms: 500 },
      { do: 'click', to: '.base-modal .quantity-input', ms: 500 },
      { do: 'type', text: '1', delay: 120 },
      { do: 'wait', ms: 500 },

      // three PCs and two servers
      { do: 'click', to: plus(0), ms: 550 },
      { do: 'click', to: plus(0), ms: 250 },
      { do: 'click', to: plus(0), ms: 250 },
      { do: 'click', to: plus(1), ms: 450 },
      { do: 'click', to: plus(1), ms: 250 },
      { do: 'wait', ms: 1100 },

      // the grid appears where the board is looked at
      { do: 'click', to: inWindow(w.add), ms: 650 },
      { do: 'waitFor', until: `!${modalOpen}`, after: 400 },
      { do: 'click', to: '.sidebar-panel-close', ms: 450 },
      { do: 'move', to: { x: 1000, y: 600 }, ms: 500 },
      { do: 'hidePointer' },
      { do: 'wait', ms: 3000 },
    ],
  };
}
