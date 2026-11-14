/** Presentation mode: bar, panel, menu, and the sentences of an answer */

/** What the failures do to the exchanges between end devices, in numbers */
export interface ImpactCounts {
  /** The name of the exchange that was measured: Ping, Web, Email */
  flowName: string;
  /** How many end devices the exchanges are between */
  endpoints: number;
  /** How many exchanges work with nothing broken */
  working: number;
  broken: number;
  rerouted: number;
  unchanged: number;
}

/** `A`, `A e B`, `A, B e C` */
const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;

const exchanges = (count: number) => (count === 1 ? '1 comunicazione' : `${count} comunicazioni`);

const takeAnotherWay = (count: number) => `${count} ${count === 1 ? 'passa' : 'passano'} da un'altra strada`;

const doNotChange = (count: number) => `${count} ${count === 1 ? 'non cambia' : 'non cambiano'}`;

/** The answer in a word or two, by its colour: it arrives, it does not, it cannot be tried */
const headlines = {
  ok: 'Arriva',
  ko: 'Non arriva',
  unknown: 'Non si può provare',
};

const failuresNamed = (names: string[]) =>
  `${names.length === 1 ? 'Guasto simulato' : 'Guasti simulati'}: ${list(names)}`;

export const presentation = {
  list,
  exchanges,

  /** What each exchange is, under the pointer (their names are in `common.services`) */
  flowHints: {
    ping: 'Una domanda e la sua risposta: il modo più semplice per sapere se due dispositivi si vedono',
    web: 'La richiesta di una pagina e la pagina che torna indietro',
    email: "Un'email: dal mittente al server di posta, dal server al destinatario",
  },

  /** The legs of an exchange (the engine names them in English) */
  legs: {
    request: 'Andata',
    reply: 'Ritorno',
    httpRequest: 'Richiesta della pagina',
    httpResponse: 'Risposta del server',
    downloadRequest: 'Richiesta del file',
    downloadData: 'Arrivo del file',
    smtpSubmit: 'Invio al server di posta',
    delivery: 'Consegna al destinatario',
    smtpToCloud: 'Invio al servizio di posta esterno',
    cloudDelivery: 'Consegna dal servizio esterno',
  },

  /** The bar that takes the place of the menu bar */
  bar: {
    badge: 'Presentazione',
    canvases: 'Canvas del progetto',
    packetSpeed: 'Velocità del pacchetto',
    speeds: {
      slow: 'Lenta',
      normal: 'Normale',
      fast: 'Veloce',
    },
    terminal: 'Terminale',
    exportPicture: 'Esporta immagine',
    fullScreen: 'Schermo intero',
    exitFullScreen: 'Esci dallo schermo intero',
    lightTheme: 'Passa al tema chiaro',
    darkTheme: 'Passa al tema scuro',
    exit: 'Esci',
  },

  /** The panel next to the board */
  panel: {
    label: 'Pannello della presentazione',
    open: 'Apri il pannello',
    close: 'Chiudi il pannello',
  },

  question: {
    heading: 'Domanda',
    from: 'Da',
    to: 'A',
    fromPlaceholder: 'Da dove parte…',
    toPlaceholder: 'Dove arriva…',
    swapEnds: 'Inverti partenza e destinazione',
    exchangeType: 'Tipo di traffico',
    stop: 'Ferma',
    showAgain: 'Mostra di nuovo',
  },

  answer: {
    heading: 'Risposta',
    chooseTarget: 'Ora scegli dove arriva.',
    chooseSource: 'Ora scegli da dove parte.',
    chooseBoth:
      'Scegli da dove parte e dove arriva: con i due menu qui sopra, oppure con un clic su un dispositivo del disegno.',
    reasonHint: 'Il motivo, come lo dà il motore',

    headlines,
    /** It arrives: what happened, in the words of each exchange */
    arrives: {
      ping: (source: string, target: string) => `${target} risponde a ${source}.`,
      web: (source: string, target: string) => `${source} apre la pagina di ${target}.`,
      email: (source: string, target: string) => `L'email di ${source} arriva a ${target}.`,
    },
    cannotTry: 'Manca qualcosa per fare la prova.',
    noCable: 'Nessun percorso di cavi collega i due dispositivi.',
    lost: 'Il pacchetto si perde per strada.',
    /** `leg` is the title of the leg it happens on */
    neverLeaves: (device: string, leg: string) => `Non esce nemmeno da ${device} (${leg.toLowerCase()}).`,
    stopsAt: (device: string, leg: string) => `Si ferma su ${device} (${leg.toLowerCase()}).`,
  },

  /** The answer next to the one the same question gets with nothing broken */
  comparison: {
    untouched: 'I guasti non toccano questo percorso: va come prima.',
    anotherWay: "Arriva lo stesso, per un'altra strada.",
    anotherWayThrough: (devices: string[]) =>
      `Arriva lo stesso, per un'altra strada: ora passa da ${list(devices)}.`,
    arrivedBefore: 'Senza guasti arrivava.',
    didNotArriveBefore: 'Senza guasti non arrivava.',
    neverArrived: 'Non arrivava nemmeno senza guasti.',
  },

  failures: {
    heading: 'Guasti simulati',
    hint: 'Cosa succede se si rompe? Clic su un dispositivo o su un cavo del disegno, poi «Simula un guasto». Il disegno non viene modificato.',
    repair: 'Ripara',
    repairDevice: (name: string) => `Ripara ${name}`,
    repairCable: (name: string) => `Ripara il cavo ${name}`,
    /** How a cut cable is named in the list of the failures */
    cable: (name: string) => `cavo ${name}`,
    repairAll: 'Ripara tutto',
  },

  /** What the failures do to the exchanges between end devices */
  impact: {
    heading: 'Sul resto della rete',
    tooFewEndDevices:
      "Per misurare l'effetto servono almeno due dispositivi finali (PC, server…) con un indirizzo.",
    nothingWorked: (flowName: string) =>
      `Con ${flowName} nessuna comunicazione tra i dispositivi finali funzionava già prima dei guasti.`,
    scope: (flowName: string, endpoints: number, working: number) =>
      `${flowName} tra i ${endpoints} dispositivi finali: ${exchanges(working)} che senza guasti ${working === 1 ? 'funziona' : 'funzionano'}.`,
    stop: (count: number) =>
      count === 0 ? 'Nessuna si interrompe' : `${count} ${count === 1 ? 'si interrompe' : 'si interrompono'}`,
    takeAnotherWay,
    doNotChange,
    shortestWay:
      'Il motore prende la strada più corta che funziona; protocolli come lo spanning tree non sono simulati.',

    show: (source: string, target: string) => `Mostra da ${source} a ${target}`,
    andMore: (count: number) => (count === 1 ? 'e un altro' : `e altri ${count}`),
    andMoreDevices: (count: number) => (count === 1 ? 'e un altro dispositivo' : `e altri ${count} dispositivi`),
    showAll: 'Mostra tutto',
    showLess: 'Mostra meno',

    /** The whole of it in one sentence, for the caption of a picture */
    sentence: ({ flowName, endpoints, working, broken, rerouted, unchanged }: ImpactCounts) => {
      const parts = [
        broken === 0
          ? working === 1
            ? "l'unica comunicazione non si interrompe"
            : `nessuna delle ${working} comunicazioni si interrompe`
          : working === 1
            ? "l'unica comunicazione si interrompe"
            : `${broken} ${broken === 1 ? 'comunicazione' : 'comunicazioni'} su ${working} ${broken === 1 ? 'si interrompe' : 'si interrompono'}`,
      ];
      if (rerouted > 0) parts.push(takeAnotherWay(rerouted));
      if (unchanged > 0 && working > 1) parts.push(doNotChange(unchanged));
      return `Sul resto della rete (${flowName} tra i ${endpoints} dispositivi finali): ${parts.join(', ')}.`;
    },
  },

  /** The way of the packet, hop by hop */
  path: {
    heading: 'Percorso',
    /** A reply that comes back the way the request went: `<leg/>` is the title of the leg */
    retraced: '<leg/> <same>per la stessa strada</same>',
    engineNotes: 'Note del motore',
  },

  /** The small menu a click on a device or on a cable opens */
  menu: {
    startHere: 'Parti da qui',
    arriveHere: 'Arriva qui',
    simulateFailure: 'Simula un guasto',
    repair: 'Ripara',
    cable: (name: string) => `Cavo ${name}`,
    repairCable: 'Ripara il cavo',
  },

  /** What a picture of the presentation says under the drawing */
  caption: {
    heading: (flowName: string, source: string, target: string, tone: keyof typeof headlines) =>
      `${flowName} da ${source} a ${target}: ${headlines[tone].toLowerCase()}`,
    /** The reason is the engine's own */
    reason: (reason: string) => `Motivo: ${reason}`,
    /** The simulated failures as a heading, and as a line */
    failures: failuresNamed,
    failuresLine: (names: string[]) => `${failuresNamed(names)}.`,
  },
};
