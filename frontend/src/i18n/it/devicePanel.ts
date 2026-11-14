/** The panel that adds devices and loads the sample networks */
export const devicePanel = {
  tabs: {
    devices: 'Dispositivi',
    samples: 'Esempi',
  },

  searchPlaceholder: 'Cerca dispositivo…',
  noDevicesFor: (query: string) => `Nessun dispositivo trovato per "${query}"`,
  bulkAdd: 'Aggiungi in Blocco',
  area: {
    name: 'Riquadro',
    description: "Un'area con un nome, dietro a un gruppo di dispositivi",
  },

  /** What a device of each built-in type is, under its name in the list; `other` for the rest */
  descriptions: {
    pc: 'Dispositivo finale per gli utenti',
    switch: 'Collega i dispositivi di una rete locale',
    router: 'Gateway e routing tra reti',
    server: 'Server applicativo o dati',
    firewall: 'Protezione e sicurezza di rete',
    accessPoint: 'Punto di accesso Wi-Fi',
    loadBalancer: 'Bilanciatore di carico',
    database: 'Server database',
    cloud: 'Servizio cloud o virtuale',
    other: 'Dispositivo di rete',
  },
  /** The same for a template made by the user, of the type it is built on */
  customTemplate: (type: string) => `Template personalizzato (${type})`,

  /** The tab of the sample networks */
  samples: {
    intro: 'Reti di esempio già configurate. Caricarne una sostituisce il canvas aperto.',
    company: {
      title: 'Azienda: uffici, Wi-Fi, server e DMZ',
      description: 'La rete di esempio: VLAN su un trunk, access point, firewall con tre regole',
    },
    office: {
      title: 'Ufficio: due reti e un router',
      description: 'Per cominciare: ping, web, email',
    },
    site: {
      title: 'Sede: VLAN, DMZ e firewall',
      description: 'Due VLAN, rotte, zone e una regola che pubblica un sito',
    },
    twoSites: {
      title: 'Due sedi: linea principale e di riserva',
      description: "Per provare i guasti: quasi ogni cavo ha un'altra strada",
    },
    /** Asked before a sample takes the place of a drawing */
    replaceQuestion: {
      title: 'Caricare la rete di esempio?',
      detail: "Prende il posto di quello che c'è sul canvas.",
      confirm: 'Carica',
    },
  },
};
