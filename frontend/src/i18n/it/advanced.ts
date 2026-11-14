/** Settings, advanced tab: figures and shortcuts */
export const advanced = {
  usage: {
    title: 'Statistiche di Utilizzo',
    intro: "Statistiche sull'utilizzo corrente dell'applicazione.",
    devices: {
      title: 'Dispositivi sul Canvas',
      caption: 'Dispositivi sul canvas aperto',
    },
    links: {
      title: 'Connessioni sul Canvas',
      caption: 'Connessioni tra dispositivi',
    },
    deviceTemplates: {
      title: 'Template di Dispositivi Personalizzati',
      caption: 'Template personalizzati creati',
    },
    linkTemplates: {
      title: 'Template di Connessioni Personalizzati',
      caption: 'Template di connessioni creati',
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
      toggleSelection: { action: 'Aggiungi o togli un dispositivo dalla selezione', keys:
        'Ctrl + clic' },
      selectionBox: {
        action: 'Seleziona più dispositivi con un riquadro di selezione',
        keys: "Trascina su un'area vuota",
      },
      pan: { action: 'Sposta la vista', keys: 'Tasto destro + trascina' },
      zoom: { action: 'Zoom', keys: 'Rotellina del mouse' },
    },
  },
};
