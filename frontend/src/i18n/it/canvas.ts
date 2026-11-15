/** What is written on the board itself: devices, cables, areas */
export const canvas = {
  /** Presentation mode: the marks on a device (the two ends of the question, a failure) */
  device: {
    from: 'Da',
    to: 'A',
    failed: 'Guasto simulato',
    /** For a screen reader: the note of a device, which the eye sees in a panel when the pointer rests on it */
    note: (text: string) => `Nota: ${text}`,
    /** For a screen reader: what the colour of the lamp says of the answer (red, green) */
    stopsHere: 'Qui si ferma',
    getsHere: 'Qui arriva',
  },

  /** Presentation mode: the mark on a cable that is cut */
  cable: {
    cut: 'Guasto simulato: il cavo è interrotto',
  },

  area: {
    /** What a new area is called until it is given its name */
    defaultName: 'Riquadro',
    name: 'Nome del riquadro',
    namePlaceholder: 'Nome',
    unnamed: 'Senza nome',
    labelHint: 'Trascina per spostare il riquadro, doppio clic per rinominarlo',
    /** Said when a new area is made while they were hidden from the View menu */
    shownAgain: 'I riquadri erano nascosti: ora si vedono di nuovo',
  },
};
