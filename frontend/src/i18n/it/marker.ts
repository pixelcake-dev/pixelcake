import { formatCount } from '../numbers';

const amount = (value: number) => formatCount('it', value);

/** Annotation mode («Modalità appunti»): writing and drawing by hand on the canvas; what is written is the «appunti» */
export const marker = {
  /** Its name: the button on the menu bar and on the bar of the presentation, the entry of the View menu, its tools */
  name: 'Modalità appunti',
  /** Its name with the notes hidden while it is off: what the buttons are called for who cannot see their number */
  nameCount: (count: number) =>
    `Modalità appunti, ${count === 1 ? '1 appunto nascosto' : `${amount(count)} appunti nascosti`}`,
  /** What the button says under the pointer */
  hint: 'Modalità appunti: scrivi e disegna a mano sul canvas (A)',
  /** What it says under the pointer when the mode is off and there are notes */
  hintHidden: (count: number) =>
    `Modalità appunti (A): ${count === 1 ? '1 appunto nascosto' : `${amount(count)} appunti nascosti`}`,
  /** The groups of its tools, for who cannot see them */
  groups: {
    tool: 'Strumento',
    colour: 'Colore',
    width: 'Spessore',
  },
  tools: {
    pen: 'Penna',
    text: 'Testo',
    arrow: 'Freccia',
    ellipse: 'Cerchio',
    tick: 'Spunta',
    cross: 'Croce',
    eraser: 'Gomma',
  },
  colours: {
    accent: 'Arancione',
    red: 'Rosso',
    green: 'Verde',
    ink: 'Inchiostro',
  },
  widths: {
    thin: 'Sottile',
    thick: 'Spesso',
  },
  clear: 'Cancella tutto',
  clearHint: 'Cancella tutti gli appunti di questo canvas',
  close: 'Esci dalla modalità appunti',
  /** In the window that saves the image: the notes are left out while the mode is off */
  notInImage: "Gli appunti non sono nell'immagine: la modalità appunti è spenta.",
  clearQuestion: {
    title: 'Cancellare tutti gli appunti del canvas?',
    detail: 'Ogni appunto scritto a mano su questo canvas viene tolto. Dispositivi, cavi e riquadri restano.',
    confirm: 'Cancella',
  },
  /** The field the words are typed in, where the canvas was clicked */
  text: {
    label: 'Testo da scrivere sul canvas',
    placeholder: 'Scrivi, poi Invio',
  },
};
