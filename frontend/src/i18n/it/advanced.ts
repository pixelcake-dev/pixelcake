/** Settings, advanced tab: figures and shortcuts */
export const advanced = {
  usage: {
    title: 'Statistiche di utilizzo',
    intro: "Statistiche sull'utilizzo corrente dell'applicazione.",
    devices: {
      title: 'Dispositivi sul canvas',
      caption: 'Dispositivi sul canvas aperto',
    },
    links: {
      title: 'Connessioni sul canvas',
      caption: 'Connessioni tra dispositivi',
    },
    deviceTemplates: {
      title: 'Template di dispositivi personalizzati',
      caption: 'Template personalizzati creati',
    },
    linkTemplates: {
      title: 'Template di connessioni personalizzati',
      caption: 'Template di connessioni creati',
    },
  },

  shortcuts: {
    title: 'Scorciatoie da tastiera e mouse',
    intro:
      "Tutti i tasti e i gesti dell'app, come su Windows e Linux. Su un Mac, per salvare, annullare, ripetere, copiare e incollare Ctrl diventa Cmd; l'elenco con i tasti del Mac è nella documentazione.",
    /** The groups: the sections of the page of the documentation */
    groups: {
      board: 'Sul canvas',
      pointer: 'Con il puntatore',
      windows: 'Nelle finestre',
      terminal: 'Nel terminale',
      presenting: 'Durante la presentazione',
      marker: 'Con il pennarello',
    },
    /** What each shortcut does, and the keys (or the gesture) that do it */
    rows: {
      save: { action: 'Salva il progetto su file', keys: 'Ctrl + S' },
      undo: { action: "Annulla l'ultima modifica del disegno", keys: 'Ctrl + Z' },
      redo: { action: 'Ripeti la modifica annullata', keys: 'Ctrl + Y, Ctrl + Maiusc + Z' },
      copy: { action: 'Copia i dispositivi e i riquadri selezionati', keys: 'Ctrl + C' },
      paste: { action: 'Incolla i dispositivi e i riquadri copiati', keys: 'Ctrl + V' },
      delete: {
        action: 'Elimina i dispositivi, i cavi e i riquadri selezionati (chiede prima conferma)',
        keys: 'Canc',
      },
      toggleSelection: {
        action: 'Aggiungi o togli dalla selezione un dispositivo, o un riquadro (sul nome o sul bordo)',
        keys: 'Ctrl + clic',
      },
      selectionBox: {
        action: 'Seleziona più dispositivi e riquadri con un riquadro di selezione',
        keys: "Trascina su un'area vuota",
      },
      pan: { action: 'Sposta la vista', keys: 'Tasto destro + trascina' },
      zoom: { action: 'Fai zoom', keys: 'Rotellina del mouse' },
      zoomPoint: { action: 'Ingrandisci su un punto', keys: "Doppio clic su un'area vuota" },
      moveDevice: { action: 'Sposta un dispositivo', keys: 'Trascinalo' },
      nudge: { action: 'Sposta di poco il dispositivo selezionato', keys: 'Tasti freccia' },
      nudgeFar: { action: 'Spostalo di più', keys: 'Maiusc + tasti freccia' },
      release: { action: 'Togli la selezione', keys: 'Esc' },
      focusNext: { action: 'Sposta il focus della tastiera tra i cavi e i dispositivi', keys: 'Tab' },
      focusSelect: { action: 'Seleziona il dispositivo che ha il focus', keys: 'Invio' },

      openDevice: { action: 'Apri la finestra di un dispositivo', keys: 'Doppio clic' },
      deviceMenu: { action: 'Apri il menu di un dispositivo', keys: 'Clic destro sul dispositivo' },
      cableMenu: { action: 'Apri il menu di un cavo', keys: 'Clic destro sul cavo' },
      drawCable: {
        action: 'Traccia un cavo',
        keys: 'Trascina dal bordo di un dispositivo a un altro',
      },
      readNote: { action: 'Leggi la nota di un dispositivo', keys: 'Fermati sul dispositivo con il puntatore' },
      selectArea: { action: 'Seleziona un riquadro', keys: 'Clic sul suo nome o sul suo bordo' },
      moveArea: {
        action: 'Sposta un riquadro o ridimensionalo',
        keys: 'Trascina il suo nome, il suo bordo o una maniglia',
      },
      renameArea: { action: 'Rinomina un riquadro', keys: 'Doppio clic sul nome, o Invio' },
      areaMenu: { action: 'Apri il menu di un riquadro', keys: 'Clic destro sul riquadro' },
      renameProject: {
        action: 'Rinomina il progetto o un canvas',
        keys: "Doppio clic sul nome nell'Explorer",
      },

      closeWindow: { action: 'Chiudi la finestra in primo piano', keys: 'Esc' },
      confirm: { action: 'Conferma una domanda, o un nome che stai modificando', keys: 'Invio' },
      nextField: { action: 'Passa al campo successivo o al precedente', keys: 'Tab, Maiusc + Tab' },
      vlans: { action: 'Aggiungi la VLAN scritta, nel campo delle VLAN di un dispositivo', keys: 'Invio o virgola' },

      run: { action: 'Esegui il comando', keys: 'Invio' },
      history: { action: 'Scorri i comandi della sessione', keys: 'Freccia su, freccia giù' },
      interrupt: { action: 'Ferma un ping o un trace in corso', keys: 'Ctrl + C' },
      closeTerminal: {
        action: 'Chiudi il terminale (un ping o un trace in corso si ferma prima)',
        keys: 'Esc',
      },

      leavePresentation: { action: 'Esci dalla presentazione', keys: 'Esc' },
      askOrBreak: { action: 'Fai una domanda o simula un guasto', keys: 'Clic su un dispositivo o su un cavo' },
      presentationView: { action: 'Sposta la vista', keys: 'Trascina con il tasto sinistro' },

      markerToggle: { action: 'Attiva o disattiva il pennarello, anche durante la presentazione', keys: 'P' },
      markerOff: { action: 'Disattiva il pennarello', keys: 'Esc' },
      markerText: { action: 'Scrivi sul canvas le parole digitate (Esc le lascia perdere)', keys: 'Invio' },
      markerNewLine: { action: 'Vai a capo nelle parole', keys: 'Maiusc + Invio' },
      markerView: { action: 'Sposta la vista mentre scrivi', keys: 'Tasto destro + trascina, rotellina del mouse' },
    },
  },
};
