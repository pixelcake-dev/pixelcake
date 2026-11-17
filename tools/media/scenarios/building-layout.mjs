// "Automatic layout and connection": the sample network of a site is laid
// out horizontally, then vertically again. The areas follow their devices.
//
//   node tools/media/record.mjs --scenario building-layout --lang en --formats mp4,png \
//     --out documentation/media/layout-and-connection --name layout --app-port 4186 --chrome-port 9343

const WORDS = {
  en: {
    addDevice: 'Add device',
    samples: 'Samples',
    company: 'Site: VLANs, DMZ and firewall',
    view: 'View',
    autoLayout: 'Auto-layout',
    horizontal: 'Horizontal',
    vertical: 'Vertical',
    confirm: 'Lay out',
  },
  it: {
    addDevice: 'Aggiungi dispositivo',
    samples: 'Esempi',
    company: 'Sede: VLAN, DMZ e firewall',
    view: 'Vista',
    autoLayout: 'Disposizione automatica',
    horizontal: 'Orizzontale',
    vertical: 'Verticale',
    confirm: 'Disponi',
  },
};

export default function scenario({ lang }) {
  const w = WORDS[lang];
  const sidebar = (label) => `button[aria-label="${label}"]`;
  const menu = (label) => ({ css: '.menu-item > span', text: label });
  const entry = (label) => ({ css: '.dropdown-content li, .nested-dropdown li', text: label });
  const dialogGone = `!document.querySelector('.confirm-dialog, [role="alertdialog"], .base-modal')`;

  /** View → Auto-layout → <direction>, then the question, then the result */
  const layOut = (direction) => [
    { do: 'click', to: menu(w.view), ms: 600 },
    { do: 'move', to: entry(w.autoLayout), ms: 450 },
    // (into the submenu along the line of its first entry, then down: a straight line to the second would leave the menu)
    { do: 'move', to: entry(w.vertical), ms: 350 },
    { do: 'click', to: entry(direction), ms: 400 },
    { do: 'wait', ms: 1100 },
    { do: 'click', to: { css: 'button', text: w.confirm }, ms: 550 },
    { do: 'waitFor', until: dialogGone, after: 300 },
    { do: 'move', to: { x: 600, y: 660 }, ms: 400 },
    { do: 'wait', ms: 2600 },
  ];

  return {
    viewport: { width: 1200, height: 700 },
    // Prepared before the first frame: the site sample on the board, the panel put away
    setup: [
      { do: 'click', to: sidebar(w.addDevice), ms: 200 },
      { do: 'click', to: { css: '.sidebar-panel button', text: w.samples }, ms: 200 },
      { do: 'click', to: { css: '.sidebar-panel *', text: w.company }, ms: 200 },
      { do: 'wait', ms: 1200 },
      { do: 'click', to: '.sidebar-panel-close', ms: 200 },
      { do: 'wait', ms: 800 },
      { do: 'move', to: { x: 600, y: 660 }, ms: 100 },
      { do: 'hidePointer' },
    ],
    steps: [
      { do: 'wait', ms: 1200 },
      ...layOut(w.horizontal),
      { do: 'wait', ms: 600 },
      ...layOut(w.vertical),
      { do: 'wait', ms: 1200 },
    ],
  };
}
