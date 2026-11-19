/** The marker («Pennarello»): writing and drawing by hand on the canvas */
export const marker = {
  /** Its name: the button on the menu bar and on the bar of the presentation, the entry of the View menu, its tools */
  name: 'Pennarello',
  /** What the button says under the pointer */
  hint: 'Pennarello: scrivi e disegna a mano sul canvas (P)',
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
  clearHint: 'Cancella tutto quello che è scritto su questo canvas',
  close: 'Chiudi il pennarello',
  /** While presenting: what is written is the presenter's, and goes with the presentation */
  presenting: 'Solo per questa presentazione',
  presentingHint: "Quello che scrivi ora non cambia il canvas e sparisce quando esci dalla presentazione",
  clearPresenterHint: 'Cancella quello che hai scritto durante la presentazione',
  clearQuestion: {
    title: 'Cancellare tutto quello che è scritto sul canvas?',
    detail: 'Ogni segno del pennarello su questo canvas viene tolto. Dispositivi, cavi e riquadri restano.',
    confirm: 'Cancella',
  },
  /** The field the words are typed in, where the canvas was clicked */
  text: {
    label: 'Testo da scrivere sul canvas',
    placeholder: 'Scrivi, poi Invio',
  },
};
