/** The window of a device: its frame, the first tab, saving */

import { common } from './common';

// The tabs a sentence sends to, named as the window names them
const portsTab = common.quote(common.deviceTabs.ports);
const cardsTab = common.quote(common.deviceTabs.cards);

export const inspector = {
  title: (deviceName: string) => `Modifica: ${deviceName}`,

  /** The first tab: what the device is, how it is addressed */
  general: {
    identity: {
      legend: 'Identità',
      type: 'Tipo',
      name: 'Nome Dispositivo',
      vendor: 'Vendor',
      vendorPlaceholder: 'es. Cisco, HP, Dell...',
      location: 'Posizione',
      locationPlaceholder: 'es. Rack 01, Ufficio 102...',
      notes: 'Note',
      notesPlaceholder: 'Testo libero. Si legge anche sul disegno, fermando il puntatore sul dispositivo.',
    },

    network: {
      legend: 'Rete',
      /** A device addressed through its cards: the group is about the first one */
      legendOfCard: (cardName: string) => `Rete · ${cardName}`,
      gatewayDefaultRoute: 'Gateway (rotta predefinita)',
      /** Under the address of a router or of a firewall */
      namedByAddress:
        "L'indirizzo qui sopra è quello con cui il dispositivo viene nominato; le reti a cui è collegato sono gli indirizzi delle sue porte.",
      /** Under the address of the first card. `<peer/>` is what the card is linked to, `<tab>` opens the tab of the cards */
      firstCard: {
        linkedTo: 'Collegata a <peer/>.',
        noCable: 'Nessun cavo collegato.',
        onlyCard: `Nome, velocità e MAC della scheda sono nella <tab>scheda ${cardsTab}</tab>.`,
        firstOfSeveral: (count: number) =>
          `È la prima di ${count} schede, quella con cui il dispositivo viene nominato: le altre, e nome, velocità e MAC di ciascuna, sono nella <tab>scheda ${cardsTab}</tab>.`,
      },
    },

    vlans: {
      hintSwitch: `Le VLAN che lo switch conosce: le altre vengono scartate. Vuoto: tutte. La VLAN di ogni porta si sceglie nella scheda ${portsTab}.`,
      hintOther:
        'Le VLAN che il dispositivo accetta con etichetta su una porta trunk. Vuoto: solo traffico senza etichetta.',
    },

    /** The ports of a router or of a firewall, and those of a switch */
    portsInUse: 'Porte in uso',
    ports: 'Porte',

    stp: {
      enabled: 'STP attivo',
      mode: 'Modalità STP',
      bridgePriority: 'Priorità del bridge',
      bridgePriorityHint: 'Da 0 a 65535 a passi di 4096 (predefinita 32768)',
      notSimulated: 'Lo spanning tree resta come documentazione: il motore non lo simula.',
    },
  },

  /** What the window answers when it does not do what was asked */
  toasts: {
    lastCard: "Impossibile rimuovere l'ultima scheda di rete",
    nameRequired: 'Il nome è obbligatorio',
    nameAndIpRequired: 'Nome e IP sono obbligatori',
    portsWithCable: (portIds: number[]) =>
      portIds.length === 1
        ? `La porta ${portIds[0]} ha un cavo collegato: scollegalo prima di togliere la porta`
        : `Le porte ${portIds.join(', ')} hanno un cavo collegato: scollegali prima di togliere le porte`,
    /** A row of a tab that cannot be saved: which one, then what is wrong with it */
    routeProblem: (row: number, problem: string) => `Rotta ${row}: ${problem}`,
    ruleProblem: (row: number, problem: string) => `Regola ${row}: ${problem}`,
    forwardProblem: (row: number, problem: string) => `Inoltro ${row}: ${problem}`,
    recordProblem: (row: number, problem: string) => `Record DNS ${row}: ${problem}`,
  },
};
