/** The NAT tab of a device */
export const nat = {
  intro:
    'Internet non trasporta gli indirizzi privati. Una porta con il NAT attivo dà il proprio ' +
    'indirizzo a ciò che esce da lì, e il dispositivo riporta la risposta a chi aveva chiesto. ' +
    "Un inoltro fa il contrario: pubblica sull'indirizzo di una porta un servizio che sta " +
    'dentro, perché sia raggiungibile da fuori.',

  /** The ports that give their address to what leaves by them */
  ports: {
    title: 'Porte con NAT',
    /** Followed by the button `goToPorts` */
    noAddressedPort:
      "Nessuna porta ha un indirizzo: il NAT dà a ciò che esce l'indirizzo della porta, quindi " +
      'si attiva su una porta che ne ha uno.',
    goToPorts: 'Vai alla scheda «Porte»',
    noneDoesNat: 'Nessuna porta fa NAT. Spunta la porta da cui si esce verso Internet.',
    natOn: (id: number) => `NAT sulla porta ${id}`,
    /** Drawn with Rich: <port/> is the name of the port, <address/> its address */
    translates: "<port/>: ciò che esce prende l'indirizzo <address/>",
    /** Drawn with Rich, and followed by the button `giveAddress` */
    withoutAddress: '<port/>: <problem>non ha un indirizzo, quindi non traduce nulla.</problem>',
    giveAddress: 'Dagliene uno',
    /** Drawn with Rich: <link> opens the «Porte» tab */
    onlyAddressed:
      "Sono elencate le porte che hanno un indirizzo. Per darne uno a un'altra: " +
      '<link>scheda «Porte»</link>.',
  },

  /** What is published from a port to an address inside */
  forwards: {
    /** The name of the section for a screen reader; `title` is its heading */
    label: 'Servizi pubblicati',
    title: 'Servizi pubblicati (port forward)',
    none: 'Nessun inoltro: da fuori si raggiunge soltanto il dispositivo stesso.',
    columns: {
      number: 'N.',
      service: 'Servizio',
      arrivesOn: 'Arriva sulla porta',
      goesTo: "Va all'indirizzo",
      enabled: 'Attivo',
    },
    serviceOf: (n: number) => `Servizio dell'inoltro ${n}`,
    portOf: (n: number) => `Porta dell'inoltro ${n}`,
    /** In the list of ports, the port of a forward that has lost its address */
    portWithoutAddress: (id: number) => `Porta ${id} (senza indirizzo)`,
    insideAddressOf: (n: number) => `Indirizzo interno dell'inoltro ${n}`,
    enabledOf: (n: number) => `Inoltro ${n} attivo`,
    moveUp: 'Sposta in su',
    moveUpNumbered: (n: number) => `Sposta in su l'inoltro ${n}`,
    moveDown: 'Sposta in giù',
    moveDownNumbered: (n: number) => `Sposta in giù l'inoltro ${n}`,
    delete: "Elimina l'inoltro",
    deleteNumbered: (n: number) => `Elimina l'inoltro ${n}`,
    add: 'Aggiungi inoltro',
    nothingToPublish:
      'Nessuna porta ha un indirizzo da pubblicare: dagliene uno nella scheda «Porte».',
  },

  reading: {
    title: 'Come si leggono gli inoltri',
    text:
      "Gli inoltri si leggono dall'alto in basso: vale il primo che corrisponde per servizio e " +
      "porta. Chi è fuori chiede all'indirizzo della porta, e la risposta gli torna da " +
      "quell'indirizzo: quello interno non lo vede mai.",
    onFirewall:
      "Su un firewall l'inoltro dice dove va il traffico, non che può passare: serve anche una " +
      "regola che lo permetta, scritta per l'indirizzo interno (scheda «Regole»).",
  },

  /** What is wrong with a forward as typed: under its row, and after «Inoltro 2: » on saving */
  problems: {
    portWithoutAddress: (id: number) =>
      `la porta ${id} non ha un indirizzo da pubblicare: dagliene uno nella scheda «Porte»`,
    ownAddress: (address: string, id: number) => `${address} è l'indirizzo della porta ${id} stessa`,
  },
};
