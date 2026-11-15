/** Words shared by many screens: the motto, the usual buttons, how an interface is named */
export const common = {
  brand: {
    motto: 'Una rete, un pezzo alla volta',
  },

  /** A name, or the words of a control, quoted inside a sentence */
  quote: (text: string) => `«${text}»`,

  /** The switch between the languages of the interface */
  language: {
    label: 'Lingua',
  },

  actions: {
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    close: 'Chiudi',
    add: 'Aggiungi',
  },

  /** The services a firewall rule or a port forward is about */
  services: {
    any: 'Qualsiasi',
    ping: 'Ping',
    web: 'Web',
    email: 'Email',
    dns: 'DNS',
  },

  /** The tabs of the window of a device, as other screens name them */
  deviceTabs: {
    general: 'Generale',
    ports: 'Porte',
    cards: 'Schede di rete',
    routes: 'Rotte',
    rules: 'Regole',
    nat: 'NAT',
    dhcp: 'DHCP',
    dns: 'DNS',
  },

  /** How a port or a network card is named in a list or in a sentence */
  interfaces: {
    port: (id: number) => `Porta ${id}`,
    portNamed: (id: number, name: string) => `Porta ${id} «${name}»`,
    portInSentence: (id: number) => `porta ${id}`,
    card: (name: string) => `Scheda ${name}`,
    cardInSentence: (name: string) => `scheda ${name}`,
  },

  validation: {
    notIPv4: (value: string) => `"${value}" non è un indirizzo IPv4 valido`,
  },
};
