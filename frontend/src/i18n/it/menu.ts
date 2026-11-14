/** The menu bar */
export const menu = {
  file: {
    title: 'File',
    newProject: 'Nuovo progetto…',
    open: 'Apri…',
    save: 'Salva',
    saveAs: 'Salva con nome…',
    exportPicture: 'Esporta immagine…',
  },

  edit: {
    title: 'Modifica',
    copy: 'Copia',
    paste: 'Incolla',
    enclose: 'Racchiudi in un riquadro',
  },

  view: {
    title: 'Vista',
    fit: 'Adatta alla finestra',
    presentation: 'Modalità presentazione',
    autoLayout: 'Disposizione automatica',
    layouts: {
      hierarchicalVertical: 'Gerarchica, verticale',
      hierarchicalHorizontal: 'Gerarchica, orizzontale',
      subnetVertical: 'Per subnet, verticale',
      subnetHorizontal: 'Per subnet, orizzontale',
    },
    autoConnect: 'Connessione automatica',
    magnify: 'Ingrandisci',
    magnifyDevices: 'Dispositivi',
    magnifyConnections: 'Connessioni',
    resetMagnify: 'Ripristina ingrandimento',
    animation: 'Animazione rete',
  },

  help: {
    title: 'Aiuto',
    guide: 'Guida',
    commands: 'Comandi del terminale',
    welcome: 'Mostra la schermata di benvenuto',
    about: 'Informazioni',
  },

  /** The name of the open project, in the middle of the bar */
  project: {
    hint: "Progetto aperto. Clic per aprire l'Explorer: nome, canvas, salvataggio",
    unsavedChanges: 'Modifiche non salvate su file',
  },

  present: 'Presenta',
  presentHint: 'Mostra il disegno: fai una domanda alla rete, simula un guasto',

  lightTheme: 'Passa al tema chiaro',
  darkTheme: 'Passa al tema scuro',

  /** What an entry says when it has nothing to act on */
  notices: {
    nothingToArrange: "Nessun dispositivo sul canvas: non c'è nulla da disporre",
    needTwoToConnect: 'Servono almeno due dispositivi per collegarli automaticamente',
    welcomeNeedsEmptyCanvas:
      'La schermata di benvenuto compare solo su un canvas vuoto. ' +
      'Il disegno non è stato toccato. Per rivederla passa a un canvas vuoto o creane uno nuovo.',
    nothingToExport: "Il canvas è vuoto: non c'è nulla da esportare",
    nothingToPresent: "Il canvas è vuoto: non c'è nulla da presentare",
    nothingToFit: "Nessun dispositivo sul canvas: non c'è nulla da inquadrare",
    selectBeforeCopy: 'Seleziona almeno un dispositivo prima di copiare',
    nothingToPaste: "Non c'è nulla da incollare: copia prima uno o più dispositivi",
  },
};
