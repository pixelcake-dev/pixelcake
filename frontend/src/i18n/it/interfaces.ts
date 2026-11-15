/** Ports and network cards: their editors, lists, summaries and what is wrong with one */

import { common } from './common';

// The tabs a sentence sends to, named as the window names them
const portsTab = common.quote(common.deviceTabs.ports);
const natTab = common.quote(common.deviceTabs.nat);

export const interfaces = {
  /** What to type in a field, by example: an address, a number */
  example: (value: string) => `es. ${value}`,

  /** Labels that a port, a card and the first tab of the window share */
  fields: {
    ipAddress: 'Indirizzo IP',
    subnetMask: 'Subnet mask',
    gateway: 'Gateway',
    dnsServer: 'Server DNS',
    linkSpeed: 'Velocità',
    notes: 'Note / descrizione',
  },

  /** What a port or a card is linked to */
  link: {
    /** The label in front of what is at the other end of the cable */
    linkedTo: 'Collegata a',
    linkedToPeer: (peer: string) => `Collegata a ${peer}`,
    noCable: 'Nessun cavo collegato',
    /** The other end, when its device is not in the drawing */
    unknownDevice: 'dispositivo sconosciuto',
  },

  /** The tab of the ports: how many there are, which one is open */
  portsTab: {
    summary: (linked: number, total: number) => {
      const linkedPorts = linked === 1 ? 'porta collegata' : 'porte collegate';
      return `${linked} ${linkedPorts} su ${total}. Scegli una porta per vederne e cambiarne le impostazioni.`;
    },
    count: 'Numero di porte',
    countOption: (count: number) => (count === 1 ? '1 porta' : `${count} porte`),
    nonePicked: 'Scegli una porta per vederne e cambiarne le impostazioni.',
    none: 'Nessuna porta configurata per questo dispositivo.',
  },

  /** The settings of a port */
  port: {
    /** What a port is called until it is given a name */
    defaultName: (id: number) => `Porta ${id}`,
    enabled: 'Porta attiva',
    name: 'Nome della porta (facoltativo)',
    mode: 'Modalità della porta',
    modes: {
      access: 'Access (dispositivo finale)',
      trunk: 'Trunk (tra switch)',
      wan: 'WAN (Wide Area Network)',
      lan: 'LAN (Local Area Network)',
      dmz: 'DMZ (zona demilitarizzata)',
    },
    /** On a router and on a firewall the mode of a port decides nothing */
    modeHint: 'Solo descrittiva: non cambia il comportamento della porta.',
    modeHintFirewall:
      'Solo descrittiva: non cambia il comportamento della porta. Per il firewall conta la zona di sicurezza.',

    /** A switch: the VLAN of the port */
    vlan: {
      labelAccess: 'VLAN (singola)',
      labelTrunk: 'VLAN (separate da virgola)',
      hintAccess:
        'La porta appartiene a questa VLAN (numero da 1 a 4094). Vuoto: nessuna VLAN propria. Appena una porta dello switch ha una VLAN, quelle senza sono nella VLAN 1.',
      hintTrunk:
        'Le VLAN che la porta trasporta con etichetta (numeri da 1 a 4094). Vuoto: tutte. Appena una porta dello switch ha una VLAN, quelle senza sono nella VLAN 1.',
      /** Several VLANs as typed, each with the name the project gave it: `VLAN 10 «Uffici», 20` */
      typedList: (vlans: readonly string[]) => `VLAN ${vlans.join(', ')}`,
    },
    poe: 'PoE attivo (Power over Ethernet)',

    /** A router, a firewall: the address of the port, what leaves by it */
    addressHint: (defaultMask: string) =>
      `È il gateway dei dispositivi collegati a questa porta. Lascia vuoto se la porta non ha indirizzo; senza subnet mask vale ${defaultMask}.`,
    zone: 'Zona di sicurezza',
    zones: {
      none: 'Nessuna',
      trust: 'Trust (rete fidata)',
      untrust: 'Untrust (rete non fidata)',
      dmz: 'DMZ (zona demilitarizzata)',
    },
    nat: 'NAT attivo',
    natHint: `Con il NAT ciò che esce da questa porta prende il suo indirizzo: serve verso Internet, che non trasporta gli indirizzi privati. I servizi da raggiungere da fuori si pubblicano nella scheda ${natTab}.`,
    natWithoutAddress: 'La porta non ha un indirizzo: finché non ne ha uno il NAT non traduce nulla.',
    /** Under the gateway that the DHCP server of the port hands out */
    dhcpGatewayHint: "Vuoto: l'indirizzo di questa porta.",
    ips: 'IPS/IDS attivo (Intrusion Prevention/Detection)',
    ipsHint: 'Resta come documentazione: il motore non lo simula.',
    notesPlaceholder: 'es. Uplink a core switch, Server VLAN 10…',
  },

  /** The grid of the ports */
  grid: {
    /** What a port says under the pointer: its name, its VLAN when it has one, what it is linked to */
    title: (name: string, vlan: string, linkedTo: string | undefined) =>
      [name, vlan, linkedTo ? `collegata a ${linkedTo}` : ''].filter(Boolean).join(' — '),
    poe: 'PoE attivo',
  },

  /** The VLANs of a trunk port in a few words */
  vlanOfPort: {
    trunkAll: 'trunk: tutte le VLAN',
    /** Each VLAN comes with the name the project gave it: `trunk: VLAN 10 «Uffici», 20` */
    trunk: (vlans: readonly string[]) => `trunk: VLAN ${vlans.join(', ')}`,
  },

  /** The ports of a device at a glance, on the first tab of its window */
  overview: {
    openPortsTab: `Apri la scheda ${portsTab}`,

    /** A router, a firewall: the ports in use */
    noneInUse: (portCount: number) => {
      const notAttached = 'il dispositivo non è ancora collegato a nessuna rete.';
      if (portCount === 1) return `La porta non ha né un indirizzo né un cavo: ${notAttached}`;
      return `Nessuna delle ${portCount} porte ha un indirizzo o un cavo: ${notAttached}`;
    },
    columns: {
      port: 'Porta',
      address: 'Indirizzo',
      zone: 'Zona',
      linkedTo: 'Collegata a',
      does: 'Ruolo',
    },
    /** What a port does, besides NAT */
    does: {
      dhcpServer: 'server DHCP',
      disabled: 'disabilitata',
    },
    spare: (count: number) =>
      count === 1
        ? "Un'altra porta è libera: senza indirizzo e senza cavo."
        : `Altre ${count} porte sono libere: senza indirizzo e senza cavo.`,

    /** A switch: how many ports, and how they are split among the VLANs */
    switchCounts: (total: number, linked: number, disabled: number) =>
      [
        total === 1 ? '1 porta' : `${total} porte`,
        linked === 1 ? `${linked} collegata` : `${linked} collegate`,
        ...(disabled === 0 ? [] : [disabled === 1 ? `${disabled} disabilitata` : `${disabled} disabilitate`]),
      ].join(' · ') + '.',
    /** `<vlan/>` is the VLAN with its name, `<ports/>` the numbers of the ports in it */
    vlanPorts: (portCount: number): string =>
      portCount === 1 ? '<vlan/>: porta <ports/>' : '<vlan/>: porte <ports/>',
    /** `<port/>` is the number of the trunk port, `<vlans/>` the VLANs it lists (none: it carries them all) */
    trunk: (vlanCount: number): string =>
      vlanCount === 0
        ? '<trunk>Trunk</trunk>: porta <port/>, trasporta tutte le VLAN'
        : vlanCount === 1
          ? '<trunk>Trunk</trunk>: porta <port/>, trasporta la VLAN <vlans/>'
          : '<trunk>Trunk</trunk>: porta <port/>, trasporta le VLAN <vlans/>',
    noVlans: 'Nessuna porta ha una VLAN: tutte le porte sono nella stessa rete.',
  },

  /** The settings of a network card */
  card: {
    enabled: 'Scheda attiva',
    name: "Nome dell'interfaccia",
    namePlaceholder: 'es. eth0, eth1, ens192…',
    mac: 'Indirizzo MAC',
    generateMac: 'Genera un MAC',
    /** Under the gateway that the DHCP server of the card hands out */
    dhcpGatewayHint: "Vuoto: nessun gateway. Di solito è l'indirizzo del router.",
    notesPlaceholder: 'es. Connessione primaria, connessione di riserva…',

    /** Where the card takes its address from, and the address */
    address: {
      source: 'Indirizzo',
      manual: 'Manuale',
      automatic: 'Automatico (DHCP)',
      leased: 'Indirizzo assegnato',
      /** What came with the leased address; a gateway or a DNS server may be missing */
      leaseDetails: (subnet: string, gateway: string, dns: string | undefined) => {
        const none = 'nessuno';
        return `Subnet mask ${subnet} · gateway ${gateway || none} · server DNS ${dns || none}`;
      },
      fromDhcpServer: "L'indirizzo arriva dal server DHCP della rete a cui la scheda è collegata.",
      automaticHint:
        'Indirizzo, subnet mask e gateway li assegna un server DHCP della stessa rete: una porta ' +
        'di router o firewall, o un server, con «Server DHCP attivo». Si calcolano dal disegno, ' +
        "sempre allo stesso modo. Il server DNS arriva con l'indirizzo, se quel server ne " +
        'consegna uno.',
      dnsHint:
        "L'indirizzo del server a cui la scheda chiede a quale indirizzo corrisponde un nome. Vuoto: nessuno, e un nome usato al posto di un indirizzo non trova risposta.",
    },
  },

  /** The list of the cards of a device */
  cards: {
    none: 'Nessuna scheda di rete: senza una scheda il dispositivo non si collega a nulla.',
    noAddress: 'nessun indirizzo',
    noMac: 'MAC non indicato',
    disabled: 'Disabilitata',
    remove: 'Elimina scheda',
    removeNamed: (name: string) => `Elimina la scheda ${name}`,
    add: 'Aggiungi scheda',
  },

  /** What is wrong with a port or a card as typed */
  problems: {
    notSubnetMask: (value: string) => `"${value}" non è una subnet mask valida`,
    addressOrNoMask: 'Inserisci un indirizzo IP oppure svuota la subnet mask',
    notVlan: (value: string | number) => `${value} non è una VLAN: il numero va da 1 a 4094`,
    accessPortOneVlan: 'Una porta di accesso sta in una sola VLAN: per più VLAN serve un trunk',
    cardNeedsName: 'La scheda deve avere un nome, per esempio eth0',
    /** The notice that refuses to save the device: which port or card, then what is wrong with it */
    ofPort: (id: number, problem: string) => `Porta ${id}: ${problem}`,
    ofCard: (name: string, problem: string) => `Scheda ${name}: ${problem}`,
    sameCardName: (name: string) => `Due schede si chiamano ${name}: ogni scheda ha un nome suo`,
  },
};
