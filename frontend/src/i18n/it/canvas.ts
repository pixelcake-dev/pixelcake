/** What is written on the board itself: devices, cables, areas */
export const canvas = {
  /** Presentation mode: the marks on a device (the two ends of the question, a failure) */
  device: {
    from: 'Da',
    to: 'A',
    failed: 'Guasto simulato',
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
  },
};
