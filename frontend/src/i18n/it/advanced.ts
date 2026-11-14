/** Settings, advanced tab: figures and shortcuts */
export const advanced = {
  usage: {
    title: 'Statistiche Utilizzo',
    intro: "Statistiche sull'utilizzo corrente dell'applicazione.",
    devices: {
      title: 'Dispositivi nel Canvas',
      caption: 'Dispositivi nel canvas aperto',
    },
    links: {
      title: 'Connessioni nel Canvas',
      caption: 'Connessioni attive tra dispositivi',
    },
    deviceTemplates: {
      title: 'Template Dispositivi Custom',
      caption: 'Template personalizzati creati',
    },
    linkTemplates: {
      title: 'Template Connessioni Custom',
      caption: 'Template connessioni personalizzati',
    },
  },

  shortcuts: {
    title: 'Scorciatoie da Tastiera e Mouse',
    intro: 'Comandi da tastiera e da mouse per lavorare sul canvas.',
    /** What each shortcut does, and the keys (or the gesture) that do it */
    rows: {
      save: { action: 'Salva il progetto su file', keys: 'Ctrl + S' },
      copy: { action: 'Copia i dispositivi selezionati', keys: 'Ctrl + C' },
      paste: { action: 'Incolla i dispositivi copiati', keys: 'Ctrl + V' },
      delete: { action: 'Elimina i dispositivi selezionati, o il riquadro selezionato', keys: 'Canc' },
      toggleSelection: { action: 'Aggiungi o togli un dispositivo dalla selezione', keys: 'Ctrl + Clic' },
      selectionBox: {
        action: 'Seleziona più dispositivi con un riquadro di selezione',
        keys: "Trascina su un'area vuota",
      },
      pan: { action: 'Sposta la vista', keys: 'Tasto destro + trascina' },
      zoom: { action: 'Zoom', keys: 'Rotellina del mouse' },
    },
  },
};
