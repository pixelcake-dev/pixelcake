/** The window that adds a device, and the one that adds many */
export const addDevice = {
  /** In both windows: the type of a device, and a number of ports to choose from a list */
  type: 'Tipo',
  ports: (count: number) => `${count} porte`,

  /** The window that adds one device, of the type picked in the panel */
  title: (typeName: string) => `Aggiungi Nuovo ${typeName}`,
  nameAndAddressRequired: 'Nome e IP sono obbligatori',

  identity: {
    legend: 'Identità',
    name: 'Nome Dispositivo',
    namePlaceholder: (type: string) => `es. ${type}-Ufficio-01`,
    vendor: 'Vendor',
    vendorPlaceholder: 'es. Cisco, HP...',
    location: 'Posizione',
    locationPlaceholder: 'es. Rack 01...',
    portCount: 'Numero di Porte',
    portCountHint: 'Si può cambiare anche dopo.',
  },

  network: {
    legend: 'Rete',
    legendOfCard: (cardName: string) => `Rete · ${cardName}`,
    /** Under the address of the card of an end device; `withDns` when the project gives it a DNS server */
    cardHint: (withDns: boolean) =>
      "L'indirizzo è proposto: il primo libero della rete del progetto. " +
      (withDns
        ? 'Subnet mask, gateway e server DNS sono quelli delle Impostazioni → Rete.'
        : 'Subnet mask e gateway sono quelli delle Impostazioni → Rete.'),
    ipAddress: 'Indirizzo IP',
    ipAddressHint: 'Proposto: il primo libero.',
    subnetMask: 'Subnet Mask',
    gateway: 'Gateway',
    /** On a router or a firewall, in place of the gateway */
    setLater:
      'Gli indirizzi delle porte, le rotte e la rotta predefinita si impostano dopo, nella scheda del dispositivo.',
  },

  /** The window that adds many devices at once */
  bulk: {
    title: 'Aggiungi Dispositivi in Blocco',
    searchPlaceholder: 'Cerca per tipo o configurazione...',
    noDevicesFor: (query: string) => `Nessun dispositivo trovato per "${query}"`,

    configurableHeading: 'DISPOSITIVI CONFIGURABILI',
    standardHeading: 'DISPOSITIVI STANDARD (1 NIC di default)',
    columns: {
      configuration: 'Configurazione',
      quantity: 'Quantità',
      actions: 'Azioni',
      controls: 'Controlli',
    },
    addRow: 'Aggiungi Switch/Router/Firewall',
    removeRow: 'Rimuovi riga',
    decrease: 'Diminuisci',
    increase: 'Aumenta',
    total: 'Totale Dispositivi:',

    selectAtLeastOne: 'Seleziona almeno un dispositivo da aggiungere.',
    added: (count: number) =>
      count === 1 ? '1 dispositivo aggiunto' : `${count} dispositivi aggiunti`,
  },
};
