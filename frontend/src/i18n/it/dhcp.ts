import { common } from './common';
import { formatCount } from '../numbers';

/** A number of things as Italian writes it («14.891») */
const amount = (value: number) => formatCount('it', value);

/** DHCP: the tab, the pool of a port or card, the labels of a lease */

/** What a range is on: a port of a router or of a firewall, a card of a server */
type Kind = 'port' | 'card';

const unit = (kind: Kind) => (kind === 'port' ? 'porta' : 'scheda');

/** The tab of the window of the device where its ports, or its cards, are set */
const tabOf = (kind: Kind) => (kind === 'port' ? common.deviceTabs.ports : common.deviceTabs.cards);

const example = (value: string) => `es. ${value}`;

export const dhcp = {
  /** In place of the address of a card on DHCP that got none */
  noLease: 'DHCP: nessun indirizzo',
  /** A leased address and the interface it comes from: `192.168.20.100 da Router-Core, porta 2` */
  leaseFrom: (address: string, server: string) => `${address} da ${server}`,
  /** A card on DHCP that has no address, with the reason when there is one (see `unserved`) */
  noAddress: (reason?: string) => (reason ? `Nessun indirizzo: ${reason}` : 'Nessun indirizzo'),

  /** The two ends of a range: the same fields in the tab and in the panel of an interface */
  firstAddress: 'Primo indirizzo',
  firstAddressPlaceholder: example('192.168.10.100'),
  lastAddress: 'Ultimo indirizzo',
  lastAddressPlaceholder: example('192.168.10.199'),
  /** Under the fields of a range nobody typed yet */
  blankRange:
    "Scrivi il primo e l'ultimo indirizzo da assegnare: un intervallo lasciato vuoto non viene salvato.",
  /** Said when the server is switched on and nothing was typed */
  blankRangeError:
    "Scrivi il primo e l'ultimo indirizzo da assegnare, oppure togli la spunta al server DHCP",

  /** What is wrong with a range as typed: the words that follow «Non utilizzabile: » or the name of the interface */
  rangeProblem: {
    client: 'la scheda prende il proprio indirizzo dal DHCP: non può anche assegnarne',
    noAddress: (kind: Kind) =>
      `la ${unit(kind)} non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete`,
    endsMissing: "servono il primo e l'ultimo indirizzo",
    outside: (address: string, kind: Kind, network: string) =>
      `${address} è fuori dalla rete della ${unit(kind)} (${network})`,
    reversed: (first: string, last: string) =>
      `l'ultimo indirizzo (${last}) viene prima del primo (${first})`,
  },
  /** The range that stops a device from being saved, in a notice: `Porta 2, server DHCP: …` */
  rangeProblemOn: (iface: string, problem: string) => `${iface}, server DHCP: ${problem}`,

  /** What a range that works hands out, and how much of it is taken */
  rangeStatus: (range: {
    gateway?: string;
    dns?: string;
    leased: number;
    free: number;
    size: number;
    /** The interface of the range, when it is disabled */
    disabled?: Kind;
  }) =>
    [
      range.gateway ? `Gateway consegnato ${range.gateway}` : 'Nessun gateway consegnato',
      ...(range.dns ? [`server DNS consegnato ${range.dns}`] : []),
      `${amount(range.leased)} ${range.leased === 1 ? 'assegnato' : 'assegnati'}, ` +
        `${amount(range.free)} ${range.free === 1 ? 'libero' : 'liberi'} su ${amount(range.size)}`,
      ...(range.disabled ? [`${unit(range.disabled)} disabilitata: non risponde`] : []),
    ].join(' · '),

  /** Why a card on DHCP has no address: the words that follow «Nessun indirizzo: » */
  unserved: {
    routes: 'un router o un firewall non prende i propri indirizzi dal DHCP',
    disabled: 'la scheda è disabilitata',
    noCable: 'alla scheda non è collegato nessun cavo',
    noServer: 'nessun server DHCP risponde sulla sua rete',
    /** `server`: the device the cable goes to, when it is known */
    unattached: (server?: string) =>
      `il cavo verso ${server ?? 'il server'} non è assegnato a una delle sue porte: ` +
      'non si sa quale intervallo risponde',
    unusable: (server: string, problem: string) =>
      `l'intervallo di ${server} non è utilizzabile: ${problem}`,
    unusableUnnamed: "l'intervallo che risponde non è utilizzabile",
    usedUp: (server: string, size: number) =>
      `l'intervallo di ${server} è esaurito: ` +
      (size === 1 ? 'il suo unico indirizzo è già preso' : `${amount(size)} indirizzi, tutti presi`),
    usedUpUnnamed: "l'intervallo che risponde è esaurito",
    /** A range with no address in it that can be given */
    empty: (server: string) => `l'intervallo di ${server} non ha indirizzi da assegnare`,
  },

  /** The «DHCP» tab of the window of a device */
  panel: {
    intro:
      'Un server DHCP dà indirizzo, subnet mask e gateway ai dispositivi della sua rete che hanno ' +
      'la scheda su «Automatico (DHCP)», e il server DNS a cui chiedere i nomi quando ' +
      "l'intervallo ne indica uno. Gli indirizzi si calcolano dal disegno, sempre allo " +
      "stesso modo: i dispositivi vengono serviti nell'ordine in cui compaiono, e ciascuno " +
      'prende il primo indirizzo libero.',

    ranges: {
      title: 'Intervalli di indirizzi',
      noneAddressed: (kind: Kind) =>
        `Nessuna ${unit(kind)} ha un indirizzo: un intervallo distribuisce gli indirizzi della rete ` +
        `della sua ${unit(kind)}, quindi si attiva su una ${unit(kind)} che ne ha uno.`,
      goToTab: (kind: Kind) => `Vai alla scheda «${tabOf(kind)}»`,
      noneServing: (kind: Kind) =>
        `Nessuna ${unit(kind)} assegna indirizzi. Spunta la ${unit(kind)} della rete a cui darli: ` +
        "l'intervallo viene proposto, e si può cambiare.",
      /** The tick of an interface; `iface` as a sentence names it: `porta 2`, `scheda eth0` */
      serverOn: (iface: string) => `Server DHCP sulla ${iface}`,
      /** A field with the interface it is of: two interfaces have the same four fields */
      fieldOf: (field: string, iface: string) => `${field}, ${iface}`,
      gateway: 'Gateway consegnato',
      dns: 'Server DNS consegnato',
      /** In an empty field: nothing is handed out */
      none: 'nessuno',
      unusable: (problem: string) => `Non utilizzabile: ${problem}.`,
      giveItOne: 'Dagliene uno',
      client: 'Prende il proprio indirizzo dal DHCP: non può anche assegnarne.',
      noAddress: 'Non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete.',
      /** Under the list, when ports without an address are left out of it */
      onlyAddressed: (kind: Kind) =>
        `Sono elencate solo le ${kind === 'port' ? 'porte' : 'schede'} che hanno un indirizzo. ` +
        `Per darne uno a un'altra: <link>scheda «${tabOf(kind)}»</link>.`,
    },

    leases: {
      title: 'Indirizzi assegnati',
      none:
        'Nessun indirizzo assegnato: nessun dispositivo di queste reti ha la scheda su ' +
        '«Automatico (DHCP)».',
      address: 'Indirizzo',
      device: 'Dispositivo',
      card: 'Scheda',
      server: 'Assegnato da',
    },

    warnings: {
      title: 'Avvisi',
      unserved: (device: string, card: string, reason: string) =>
        `${device} (${card}) resta senza indirizzo: ${reason}.`,
      rivals: (servers: string[]) =>
        `${servers.length === 2 ? 'Due' : amount(servers.length)} server DHCP sulla stessa rete: ` +
        `${servers.join('; ')}. Risponde il primo che ha un indirizzo libero.`,
    },

    notSimulated:
      "Un guasto simulato in presentazione non toglie l'indirizzo a chi lo aveva. Non sono " +
      'simulati il relay verso altre reti, le prenotazioni e le scadenze.',
  },

  /** The DHCP server in the panel of one port or of one card */
  server: {
    enabled: 'Server DHCP attivo',
    enabledHint:
      'I dispositivi di questa rete con la scheda su «Automatico (DHCP)» prendono da qui ' +
      'indirizzo, subnet mask e gateway; gli indirizzi scritti a mano nel disegno vengono ' +
      `saltati. Chi ha preso quale indirizzo si vede nella scheda «${common.deviceTabs.dhcp}».`,
    gateway: 'Gateway consegnato (facoltativo)',
    gatewayPlaceholder: example('192.168.10.1'),
    dns: 'Server DNS consegnato (facoltativo)',
    dnsPlaceholder: example('192.168.30.10'),
    dnsHint: "Vuoto: nessuno. Può stare in un'altra rete.",
  },
};
