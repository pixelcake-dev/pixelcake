import { formatCount } from '../numbers';

const amount = (value: number) => formatCount('it', value);

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
    /** From where the traffic leaves the network down (vertical) or across (horizontal) */
    layouts: {
      vertical: 'Verticale',
      horizontal: 'Orizzontale',
    },
    /** A cable for each device that has none, and nothing else */
    autoConnect: 'Collega i dispositivi senza cavo',
    magnify: 'Ingrandisci',
    magnifyDevices: 'Dispositivi',
    magnifyConnections: 'Connessioni',
    resetMagnify: 'Ripristina ingrandimento',
    animation: 'Animazione rete',
    /** The areas drawn behind the devices, shown or hidden: a preference of this browser */
    areas: 'Mostra i riquadri',
  },

  help: {
    title: 'Aiuto',
    guide: 'Guida',
    commands: 'Comandi del terminale',
    welcome: 'Mostra la schermata di benvenuto',
    about: 'Informazioni',
    site: 'Il sito di PixelCake',
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

  /** Asked before the automatic layout: it moves every device, and cannot be undone */
  layoutQuestion: {
    title: 'Disporre di nuovo il disegno?',
    detail:
      'Ogni dispositivo sarà spostato e i riquadri saranno ridisegnati intorno ai loro dispositivi. ' +
      'Non si può annullare.',
    confirm: 'Disponi',
  },

  /** Said after Vista → Collega i dispositivi senza cavo */
  connectNotice: {
    added: (count: number) => (count === 1 ? 'Aggiunto 1 cavo' : `Aggiunti ${amount(count)} cavi`),
    noneAdded: 'Nessun cavo aggiunto',
    allCabled: 'Ogni dispositivo ha già il suo cavo',
    /** Why a device was left with no cable: after its name, «PC-7: …» */
    reasons: {
      noSwitch: 'nessuno switch nella stessa rete',
      noUplink: 'nessun router, firewall o core switch nella stessa rete',
      noFreePort: 'nessuna porta libera',
      loop: 'un altro cavo chiuderebbe un anello',
      byHand: 'router, firewall e Internet si collegano a mano',
    },
    /** After the first three names of a list of five or more */
    more: (count: number) => `e altri ${amount(count)}`,
  },

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
