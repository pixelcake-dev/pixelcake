/** The DNS tab of a server */
export const dns = {
  /** (the words between backticks are a command of the terminal: drawn as code) */
  intro:
    'Un server DNS dice a quale indirizzo corrisponde un nome. Risponde soltanto per i nomi ' +
    'scritti qui sotto. Un nome si usa nel terminale al posto di un indirizzo, per esempio ' +
    '`ping www.azienda.example from PC-1`: prima parte la ' +
    'domanda al server DNS, che attraversa la rete come ogni altro scambio e può fermarsi ' +
    "allo stesso modo, poi il ping va all'indirizzo ricevuto.",

  records: {
    /** How the list is named for who cannot see it */
    label: 'Record DNS',
    title: 'Nomi conosciuti',
    none:
      'Nessun nome: finché non ne ha almeno uno, questo dispositivo non risponde come server ' +
      'DNS.',
    number: 'N.',
    name: 'Nome',
    address: 'Indirizzo',
    /** A name as the field of a record expects it */
    namePlaceholder: 'www.azienda.example',
    nameOf: (row: number) => `Nome del record ${row}`,
    addressOf: (row: number) => `Indirizzo del record ${row}`,
    delete: 'Elimina il record',
    deleteRow: (row: number) => `Elimina il record ${row}`,
    add: 'Aggiungi record',
  },

  asking: {
    /** How the notes are named for who cannot see them */
    label: 'Chi chiede a questo server',
    how:
      'A chi chiedere lo decide ogni dispositivo, sulla propria scheda di rete: il campo «Server ' +
      "DNS» con l'indirizzo scritto a mano, oppure «Server DNS consegnato» nel server DHCP " +
      "che gli dà l'indirizzo.",
    /** (`<address/>` is where the addresses of the server are drawn) */
    address: "L'indirizzo di questo server è <address/>.",
    noAddress: 'Questo server non ha un indirizzo: nessuno può chiedergli nulla.',
    limits:
      'Maiuscole e minuscole nei nomi non contano, e un nome ha un solo indirizzo. Non sono ' +
      "simulati: un secondo server DNS di riserva, l'inoltro della domanda ad altri server " +
      '(il server risponde solo per i propri nomi), la memoria delle risposte e le scadenze, la ' +
      'ricerca inversa, gli alias e i nomi jolly. La simulazione e la presentazione scelgono i ' +
      'dispositivi dai menu e non usano i nomi.',
  },

  /** What is wrong with a record as typed, or with the DNS server written on a network card */
  problems: {
    missingName: 'manca il nome',
    invalidName: (name: string) =>
      `"${name}" non è un nome valido: lettere, cifre e trattini, con almeno un punto, come www.azienda.example`,
    missingAddress: "manca l'indirizzo a cui corrisponde il nome",
    duplicateName: (name: string, record: number) =>
      `il nome ${name} è già nel record ${record}: un nome ha un solo indirizzo`,
    serverNotAnAddress: (value: string) =>
      `"${value}" non è un indirizzo IPv4 valido: il server DNS si indica con il suo indirizzo`,
  },
};
