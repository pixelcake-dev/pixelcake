// Shared by the three scenarios of "Your first network" (getting-started-first-network-*.mjs):
// the words of the interface in the two languages and the steps they have in common.
// It is not a scenario itself.

export const WORDS = {
  en: {
    newProject: 'New project',
    createProject: 'Create project',
    projectName: 'First network',
    addDevice: 'Add device',
    simulation: 'Simulation',
    start: 'Start simulation',
    stop: 'Stop simulation',
    details: 'Details (edit)',
    rulesTab: 'Rules',
    addRule: 'Add rule',
    save: 'Save',
    cancel: 'Cancel',
    action: 'Action of rule 1',
    service: 'Service of rule 1',
    source: 'Source of rule 1',
    destination: 'Destination of rule 1',
    searchFirewall: 'Firewall',
  },
  it: {
    newProject: 'Nuovo progetto',
    createProject: 'Crea progetto',
    projectName: 'Prima rete',
    addDevice: 'Aggiungi dispositivo',
    simulation: 'Simulazione',
    start: 'Avvia simulazione',
    stop: 'Ferma simulazione',
    details: 'Dettagli (modifica)',
    rulesTab: 'Regole',
    addRule: 'Aggiungi regola',
    save: 'Salva',
    cancel: 'Annulla',
    action: 'Azione della regola 1',
    service: 'Servizio della regola 1',
    source: 'Partenza della regola 1',
    destination: 'Destinazione della regola 1',
    searchFirewall: 'Firewall',
  },
};

export const PC = 'PC-1';
export const SERVER = 'Server-1';
export const FIREWALL = 'Firewall-1';

/** Where the three devices stand: PC, firewall, server in a row, clear of the panel on the left */
export const SPOTS = { [PC]: { x: 470, y: 300 }, [FIREWALL]: { x: 720, y: 300 }, [SERVER]: { x: 970, y: 300 } };

export const VIEWPORT = { width: 1100, height: 660 };

const doneModal = `!document.querySelector('.base-modal')`;

/** The welcome screen, New project, a name, Create project */
export function createProject(w) {
  return [
    { do: 'wait', ms: 900 },
    { do: 'click', to: { css: 'button', text: w.newProject }, ms: 700 },
    { do: 'waitFor', until: `!!document.querySelector('.base-modal input')`, after: 400 },
    { do: 'click', to: '.base-modal input', ms: 450 },
    { do: 'type', text: w.projectName, delay: 60 },
    { do: 'wait', ms: 500 },
    { do: 'click', to: { css: 'button', text: w.createProject }, ms: 600 },
    { do: 'waitFor', until: doneModal, after: 700 },
  ];
}

/** A device chosen in the open panel and confirmed in the window that suggests its address */
const addFromList = (name, look = 500) => [
  { do: 'click', to: { css: '.sidebar-panel .device-list-name', text: name }, ms: 420 },
  { do: 'waitFor', until: `!!document.querySelector('.base-modal')`, after: look },
  { do: 'click', to: '.modal-actions button:last-of-type', ms: 450 },
  { do: 'waitFor', until: doneModal, after: 350 },
];

/** Add device, PC, Server, Firewall; the panel is closed again */
export function addThree(w) {
  return [
    { do: 'click', to: `button[aria-label="${w.addDevice}"]`, ms: 700 },
    { do: 'wait', ms: 400 },
    ...addFromList('PC', 1500),
    ...addFromList('Server', 900),
    { do: 'click', to: '.sidebar-panel input', ms: 450 },
    { do: 'type', text: w.searchFirewall, delay: 50 },
    ...addFromList('Firewall', 900),
    { do: 'click', to: '.sidebar-panel-close', ms: 400 },
  ];
}

/** The three devices put in a row */
export function arrange() {
  return [PC, SERVER, FIREWALL].map((name) => ({ do: 'drag', from: { device: name }, to: SPOTS[name], ms: 420, approach: 260, after: 100 }));
}

/** Two cables, from a side of a device to a side of the next */
export function cable() {
  return [
    { do: 'drag', from: { device: PC, handle: 'right' }, to: { device: FIREWALL, handle: 'left' }, ms: 650, approach: 330, after: 120 },
    { do: 'drag', from: { device: FIREWALL, handle: 'right' }, to: { device: SERVER, handle: 'left' }, ms: 650, approach: 330, after: 120 },
  ];
}

/** The whole drawing, for a scenario that starts from it (played in `setup`, which is not filmed) */
export function drawing(w) {
  return [...createProject(w), ...addThree(w), ...arrange(), ...cable(), { do: 'click', to: { x: 720, y: 520 }, ms: 200 }, { do: 'wait', ms: 300 }];
}

/** A right click on a device and the entry "Details (edit)" of its menu */
export function openDetails(w, device) {
  return [
    {
      do: 'call',
      fn: async (p) => {
        const at = await p.where({ device });
        await p.move(at, { ms: 600 });
        await p.press('right');
        await p.release('right');
      },
    },
    { do: 'click', to: { css: '.context-menu li', text: w.details }, ms: 450 },
    { do: 'waitFor', until: `!!document.querySelector('.base-modal')`, after: 700 },
  ];
}

/** A list (select) of the window: the next entry, by the keyboard */
export const chooseNext = (label) => [
  { do: 'click', to: `[aria-label="${label}"]`, ms: 450 },
  { do: 'key', key: 'ArrowDown', after: 120 },
  { do: 'key', key: 'Enter', after: 300 },
];

/** A field of the window holding `old`: its text taken away letter by letter, `text` typed in its place */
export const fillField = (label, old, text) => [
  { do: 'click', to: { css: `[aria-label="${label}"]`, at: [0.97, 0.5] }, ms: 450 },
  ...[...old].map(() => ({ do: 'key', key: 'Backspace', after: 40 })),
  { do: 'type', text, delay: 45 },
];

/** Start the simulation of the open panel and wait until the packet has gone all the way */
export function runSimulation(w, { holdAfter = 1500 } = {}) {
  const label = JSON.stringify(w.stop);
  return [
    { do: 'click', to: { css: 'button', text: w.start }, ms: 600 },
    { do: 'waitFor', until: `[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === ${label})`, timeout: 4000, after: 0 },
    { do: 'waitFor', until: `![...document.querySelectorAll('button')].some((b) => b.innerText.trim() === ${label})`, after: holdAfter },
  ];
}
