/** The rules tab of a firewall, and of a router */
export const firewall = {
  /** Drawn with Rich: the words between backticks are shown as code */
  intro:
    "Le regole si leggono dall'alto in basso: decide la prima che corrisponde. In «Da» e «A» " +
    'si scrive `any` (qualsiasi), una zona (`trust`, `untrust`, `dmz`), un indirizzo o una rete ' +
    'come `192.168.10.0/24`.',

  title: 'Regole del firewall',
  none: 'Nessuna regola: decide soltanto la politica delle zone, qui sotto.',
  columns: {
    number: 'N.',
    action: 'Azione',
    service: 'Servizio',
    from: 'Da',
    to: 'A',
    enabled: 'Attiva',
  },
  actions: {
    allow: 'Permetti',
    deny: 'Nega',
  },
  actionOf: (n: number) => `Azione della regola ${n}`,
  serviceOf: (n: number) => `Servizio della regola ${n}`,
  sourceOf: (n: number) => `Partenza della regola ${n}`,
  destinationOf: (n: number) => `Destinazione della regola ${n}`,
  enabledOf: (n: number) => `Regola ${n} attiva`,
  moveUp: 'Sposta in su',
  moveUpNumbered: (n: number) => `Sposta in su la regola ${n}`,
  moveDown: 'Sposta in giù',
  moveDownNumbered: (n: number) => `Sposta in giù la regola ${n}`,
  delete: 'Elimina la regola',
  deleteNumbered: (n: number) => `Elimina la regola ${n}`,
  add: 'Aggiungi regola',

  /** Rules name zones no port is in (`trust`, `untrust`, `dmz`: written as they are typed) */
  unusedZones: (zones: readonly string[]) =>
    (zones.length === 1
      ? `Nessuna porta è nella zona ${zones[0]}: le regole che la nominano non corrispondono mai.`
      : `Nessuna porta è nelle zone ${zones.join(', ')}: le regole che le nominano non corrispondono mai.`) +
    ' La zona di una porta si sceglie nella scheda «Porte».',

  noMatch: {
    title: 'Quando nessuna regola corrisponde',
    text:
      'Decide la politica delle zone: il traffico verso una zona più fidata è negato (untrust → ' +
      'trust, untrust → dmz, dmz → trust), tutto il resto è permesso. La risposta a un flusso ' +
      'che il firewall ha permesso passa; una risposta di cui non ha visto la richiesta viene ' +
      'giudicata come ogni altro pacchetto.',
  },

  /** The same tab on a router: its rules are its access list, and it has no zones */
  router: {
    /** Drawn with Rich: the words between backticks are shown as code */
    intro:
      "Le regole si leggono dall'alto in basso: decide la prima che corrisponde. In «Da» e «A» " +
      'si scrive `any` (qualsiasi), un indirizzo o una rete come `192.168.10.0/24`.',
    title: 'Regole del router',
    none: 'Nessuna regola: il router lascia passare tutto.',
    noMatch:
      'È permesso tutto: un router non ha zone di sicurezza. La risposta a un flusso che il ' +
      'router ha permesso passa; una risposta di cui non ha visto la richiesta viene giudicata ' +
      'come ogni altro pacchetto.',
    /** Rules of a router name zones (`trust`, `untrust`, `dmz`: written as they are typed) */
    zonesNeverMatch: (zones: readonly string[]) =>
      `Le zone sono delle porte di un firewall: su un router le regole che nominano ${zones.join(', ')} ` +
      'non corrispondono mai.',
  },

  /** What is wrong with a rule as typed: under its row, and after «Regola 2: » on saving */
  problems: {
    /** The side is named as its column is: «Da», «A» */
    invalidEndpoint: (side: 'source' | 'destination', value: string) =>
      `«${side === 'source' ? 'Da' : 'A'}»: "${value}" non è any, una zona (trust, untrust, dmz), un indirizzo o una rete`,
  },
};
