/** The menus a right click opens on the board */
export const contextMenu = {
  device: {
    details: 'Dettagli (Modifica)',
    console: 'Console',
    enclose: 'Racchiudi in un riquadro',
    deleteQuestion: {
      title: (name: string) => `Eliminare «${name}»?`,
      detail: 'Con il dispositivo vengono tolte anche le sue connessioni.',
    },
  },

  connection: {
    edit: 'Modifica Connessione',
    delete: 'Elimina Connessione',
    deleteQuestion: {
      title: 'Eliminare questa connessione?',
    },
  },

  area: {
    rename: 'Rinomina',
    colourGroup: 'Colore del riquadro',
    colour: 'Colore',
    /** The colours of the palette, in its order */
    colours: {
      slate: 'Ardesia',
      green: 'Verde',
      amber: 'Ocra',
      red: 'Rosso',
      violet: 'Viola',
      teal: 'Petrolio',
    },
    deleteQuestion: {
      /** `name` is empty for an area without a name */
      title: (name: string) => (name ? `Eliminare il riquadro «${name}»?` : 'Eliminare il riquadro?'),
      detail: 'I dispositivi che racchiude restano dove sono.',
    },
  },
};
