// "Cables and links": a PC and a switch are added, a cable is pulled from the
// side of one to the other, and the window of the link shows the port and the
// card it was attached to.
//
//   node tools/media/record.mjs --scenario building-cables --lang en --formats mp4,png \
//     --out documentation/media/cables --name draw --app-port 4186 --chrome-port 9343

const WORDS = {
  en: { addDevice: 'Add device', pc: 'PC', switch: 'Switch', edit: 'Edit link', cancel: 'Cancel' },
  it: { addDevice: 'Aggiungi dispositivo', pc: 'PC', switch: 'Switch', edit: 'Modifica connessione', cancel: 'Annulla' },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const PC = 'PC-1';
  const SWITCH = 'Switch-1';
  const addFromList = (name) => [
    { do: 'click', to: { css: '.sidebar-panel .device-list-name', text: name }, ms: 420 },
    { do: 'waitFor', until: `!!document.querySelector('.base-modal')`, after: 350 },
    { do: 'click', to: '.modal-actions button:last-of-type', ms: 450 },
    { do: 'waitFor', until: `!document.querySelector('.base-modal')`, after: 350 },
  ];
  return {
    viewport: { width: 1000, height: 780 },
    setup: [{ do: 'move', to: { x: 700, y: 420 }, ms: 100 }, { do: 'hidePointer' }],
    steps: [
      { do: 'wait', ms: 700 },
      { do: 'click', to: `button[aria-label="${w.addDevice}"]`, ms: 600 },
      { do: 'speed', factor: 2 },
      ...addFromList(w.pc),
      ...addFromList(w.switch),
      { do: 'click', to: '.sidebar-panel-close', ms: 400 },
      { do: 'drag', from: { device: PC }, to: { x: 230, y: 250 }, ms: 420, approach: 260, after: 100 },
      { do: 'drag', from: { device: SWITCH }, to: { x: 700, y: 250 }, ms: 420, approach: 260, after: 100 },
      { do: 'speed', factor: 1 },
      { do: 'wait', ms: 500 },

      // the side of the PC under the pointer turns orange; pulled to the switch
      // (the band of the frame along the right side takes the press: 12 units deep)
      { do: 'move', to: { device: PC, at: [0.94, 0.5] }, ms: 700 },
      { do: 'wait', ms: 900 },
      { do: 'drag', from: { device: PC, at: [0.94, 0.5] }, to: { device: SWITCH, at: [0.3, 0.5] }, ms: 900, approach: 10, after: 600 },
      { do: 'wait', ms: 900 },

      // the window of the link: each end on its own interface
      { do: 'move', to: { x: 465, y: 235 }, ms: 700 },
      { do: 'call', fn: async (p) => { await p.press('right'); await p.release('right'); } },
      { do: 'wait', ms: 500 },
      { do: 'click', to: { css: '*', text: w.edit }, ms: 500 },
      { do: 'waitFor', until: `!!document.querySelector('.base-modal')`, after: 1400 },
      { do: 'poster' },
      { do: 'wait', ms: 1400 },
      { do: 'click', to: { css: '.base-modal button', text: w.cancel }, ms: 600 },
      { do: 'wait', ms: 600 },
    ],
  };
}
