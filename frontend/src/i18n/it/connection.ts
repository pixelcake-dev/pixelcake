/** A link: its window and the types of link */
export const connection = {
  /** The two devices of the link, by name; one that is no longer there has none */
  title: (source: string | undefined, target: string | undefined) =>
    `Modifica connessione: ${source || 'sconosciuto'} → ${target || 'sconosciuto'}`,

  interfaces: {
    legend: 'Interfacce',
    on: (deviceName: string | undefined) => `Interfaccia su ${deviceName ?? 'dispositivo sconosciuto'}`,
    notAssigned: 'Non assegnata',
    /** An entry of the list: the interface as it is named elsewhere, and what keeps it from being chosen */
    option: (label: string, state: { enabled: boolean; inUse: boolean }) =>
      `${label}${state.enabled ? '' : ' — disabilitata'}${state.inUse ? ' (in uso)' : ''}`,
    note:
      'Stato della porta, zona di sicurezza e gateway vengono verificati solo sulle ' +
      "estremità assegnate a un'interfaccia.",
  },

  type: 'Tipo di connessione',
  noType: 'Nessuno (predefinito)',
  colourPreview: 'Anteprima del colore',
  bandwidth: 'Banda (es. 1 Gbps, 100 Mbps)',
  label: 'Etichetta personalizzata',
  labelPlaceholder: 'Etichetta facoltativa',
  customColour: 'Colore personalizzato (facoltativo)',
  customColourNote: 'Il colore personalizzato sovrascrive il colore del tipo.',

  /** The cable the link stands for: what it is, how long, and the time a packet takes on it */
  cable: {
    legend: 'Cavo',
    medium: 'Mezzo',
    /** The entries of the list, the first one worked out from the two ends */
    media: {
      auto: 'Automatico',
      copper: 'Rame (Ethernet)',
      fibre: 'Fibra ottica',
      wifi: 'Wi-Fi',
      dsl: 'DSL verso il provider',
      ftth: 'Fibra verso il provider (FTTH)',
      mobile: 'Rete mobile 4G/5G',
      satellite: 'Satellite (geostazionario)',
    },
    mediumNote: 'Automatico: Wi-Fi tra un portatile, uno smartphone o un tablet e un access point, rame negli altri casi.',
    length: 'Lunghezza',
    unit: 'Unità',
    lengthPlaceholder: 'nessuna',
    delay: 'Ritardo (ms)',
    delayPlaceholder: 'automatico',
    delayNote: 'Vuoto: dal mezzo e dalla lunghezza. Scritto a mano, in un verso, prende il loro posto.',
    oneWay: 'Ritardo in un verso',
    /** A number the engine wrote, with a point, written with the decimal comma */
    decimal: (value: string) => value.replace('.', ','),
    /** `time` is written by the engine, with a point: it is given its comma here */
    computed: (time: string, why: string) => `${time.replace('.', ',')} ms: ${why}`,
    /** What the time comes from: the medium, then the length (`length` also from the engine) */
    why: {
      written: 'scritto a mano',
      medium: {
        copper: 'rame',
        fibre: 'fibra',
        wifi: 'Wi-Fi',
        dsl: 'DSL',
        ftth: 'FTTH',
        mobile: 'rete mobile',
        satellite: 'satellite',
      },
      automatic: (medium: string) => `${medium} (automatico)`,
      withLength: (medium: string, length: string) => `${medium}, ${length.replace('.', ',')}`,
    },
    problems: {
      notLength: 'Scrivi un numero maggiore di 0, come 600 o 0,5',
      tooLong: 'Un cavo è lungo al massimo 40.000 km',
      notDelay: 'Scrivi i millisecondi con un numero, come 7 o 0,5',
      tooSlow: 'Un ritardo scritto a mano è al massimo di 10.000 ms',
    },
  },
};
