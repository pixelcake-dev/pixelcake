import type { Dictionary } from '../dictionary';
import { common } from './common';

/** Ports and network cards: their editors, lists, summaries and what is wrong with one */

// The tabs a sentence sends to, named as the window names them
const portsTab = common.quote(common.deviceTabs.ports);
const natTab = common.quote(common.deviceTabs.nat);

export const interfaces: Dictionary['interfaces'] = {
  /** What to type in a field, by example: an address, a number */
  example: (value: string) => `e.g. ${value}`,

  /** Labels that a port, a card and the first tab of the window share */
  fields: {
    ipAddress: 'IP address',
    subnetMask: 'Subnet mask',
    gateway: 'Gateway',
    dnsServer: 'DNS server',
    linkSpeed: 'Link speed',
    notes: 'Notes / description',
  },

  /** What a port or a card is linked to */
  link: {
    /** The label in front of what is at the other end of the cable */
    linkedTo: 'Connected to',
    linkedToPeer: (peer: string) => `Connected to ${peer}`,
    noCable: 'No cable attached',
    /** The other end, when its device is not in the drawing */
    unknownDevice: 'unknown device',
  },

  /** The tab of the ports: how many there are, which one is open */
  portsTab: {
    summary: (linked: number, total: number) => {
      const ports = total === 1 ? 'port' : 'ports';
      return `${linked} of ${total} ${ports} connected. Choose a port to see and change its settings.`;
    },
    count: 'Number of ports',
    countOption: (count: number) => (count === 1 ? '1 port' : `${count} ports`),
    nonePicked: 'Choose a port to see and change its settings.',
    none: 'No ports configured for this device.',
  },

  /** The settings of a port */
  port: {
    /** What a port is called until it is given a name */
    defaultName: (id: number) => `Port ${id}`,
    enabled: 'Port enabled',
    name: 'Port name (optional)',
    mode: 'Port mode',
    modes: {
      access: 'Access (end device)',
      trunk: 'Trunk (between switches)',
      wan: 'WAN (wide area network)',
      lan: 'LAN (local area network)',
      dmz: 'DMZ (demilitarised zone)',
    },
    /** On a router and on a firewall the mode of a port decides nothing */
    modeHint: 'Descriptive only: it does not change how the port behaves.',
    modeHintFirewall:
      'Descriptive only: it does not change how the port behaves. For the firewall, what counts is the security zone.',

    /** A switch: the VLAN of the port */
    vlan: {
      labelAccess: 'VLAN (single)',
      labelTrunk: 'VLANs (comma-separated)',
      hintAccess:
        'The port is in this VLAN (a number from 1 to 4094). Empty: no VLAN of its own. Once a port of the switch has a VLAN, those without one are in VLAN 1.',
      hintTrunk:
        'The VLANs the port carries tagged (numbers from 1 to 4094). Empty: all of them. Once a port of the switch has a VLAN, those without one are in VLAN 1.',
      /** Several VLANs as typed, each with the name the project gave it: `VLANs 10 “Offices”, 20` */
      typedList: (vlans: readonly string[]) =>
        vlans.length === 1 ? `VLAN ${vlans[0]}` : `VLANs ${vlans.join(', ')}`,
    },
    poe: 'PoE enabled (Power over Ethernet)',

    /** A router, a firewall: the address of the port, what leaves by it */
    addressHint: (defaultMask: string) =>
      `This is the gateway for the devices connected to this port. Leave it empty if the port has no address; without a subnet mask, ${defaultMask} is used.`,
    zone: 'Security zone',
    zones: {
      none: 'None',
      trust: 'Trust (trusted network)',
      untrust: 'Untrust (not trusted)',
      dmz: 'DMZ (demilitarised zone)',
    },
    nat: 'NAT enabled',
    natHint: `With NAT, traffic that leaves through this port takes the port’s address. Enable it on the port that faces the Internet, which does not carry private addresses. Services that must be reachable from outside are published in the ${natTab} tab.`,
    natWithoutAddress: 'The port has no address: until it has one, NAT translates nothing.',
    /** Under the gateway that the DHCP server of the port hands out */
    dhcpGatewayHint: 'Empty: the address of this port.',
    ips: 'IPS/IDS enabled (intrusion prevention/detection)',
    ipsHint: 'For documentation only: the engine does not simulate it.',
    notesPlaceholder: 'e.g. Uplink to core switch, server VLAN 10…',
  },

  /** The grid of the ports */
  grid: {
    /** What a port says under the pointer: its name, its VLAN when it has one, what it is linked to */
    title: (name: string, vlan: string, linkedTo: string | undefined) =>
      [name, vlan, linkedTo ? `connected to ${linkedTo}` : ''].filter(Boolean).join(' — '),
    poe: 'PoE enabled',
  },

  /** The VLANs of a trunk port in a few words */
  vlanOfPort: {
    trunkAll: 'trunk: all VLANs',
    /** Each VLAN comes with the name the project gave it: `trunk: VLANs 10 “Offices”, 20` */
    trunk: (vlans: readonly string[]) =>
      vlans.length === 1 ? `trunk: VLAN ${vlans[0]}` : `trunk: VLANs ${vlans.join(', ')}`,
  },

  /** The ports of a device at a glance, on the first tab of its window */
  overview: {
    openPortsTab: `Open the ${portsTab} tab`,

    /** A router, a firewall: the ports in use */
    noneInUse: (portCount: number) => {
      const notAttached = 'the device is not attached to any network yet.';
      if (portCount === 1) return `The port has no address and no cable: ${notAttached}`;
      if (portCount === 2) return `Neither of the 2 ports has an address or a cable: ${notAttached}`;
      return `None of the ${portCount} ports has an address or a cable: ${notAttached}`;
    },
    columns: {
      port: 'Port',
      address: 'Address',
      zone: 'Zone',
      linkedTo: 'Connected to',
      does: 'Role',
    },
    /** What a port does, besides NAT */
    does: {
      dhcpServer: 'DHCP server',
      disabled: 'disabled',
    },
    spare: (count: number) =>
      count === 1
        ? 'One more port is free: no address and no cable.'
        : `${count} more ports are free: no address and no cable.`,

    /** A switch: how many ports, and how they are split among the VLANs */
    switchCounts: (total: number, linked: number, disabled: number) =>
      [
        total === 1 ? '1 port' : `${total} ports`,
        `${linked} connected`,
        ...(disabled === 0 ? [] : [`${disabled} disabled`]),
      ].join(' · ') + '.',
    /** `<vlan/>` is the VLAN with its name, `<ports/>` the numbers of the ports in it */
    vlanPorts: (portCount: number): string =>
      portCount === 1 ? '<vlan/>: port <ports/>' : '<vlan/>: ports <ports/>',
    /** `<port/>` is the number of the trunk port, `<vlans/>` the VLANs it lists (none: it carries them all) */
    trunk: (vlanCount: number): string =>
      vlanCount === 0
        ? '<trunk>Trunk</trunk>: port <port/>, carries all VLANs'
        : vlanCount === 1
          ? '<trunk>Trunk</trunk>: port <port/>, carries VLAN <vlans/>'
          : '<trunk>Trunk</trunk>: port <port/>, carries VLANs <vlans/>',
    noVlans: 'No port has a VLAN: all the ports are on the same network.',
  },

  /** The settings of a network card */
  card: {
    enabled: 'Card enabled',
    name: 'Interface name',
    namePlaceholder: 'e.g. eth0, eth1, ens192…',
    mac: 'MAC address',
    generateMac: 'Generate a MAC address',
    /** Under the gateway that the DHCP server of the card hands out */
    dhcpGatewayHint: 'Empty: no gateway. It is usually the address of the router.',
    notesPlaceholder: 'e.g. Primary link, backup link…',

    /** Where the card takes its address from, and the address */
    address: {
      source: 'Address',
      manual: 'Manual',
      automatic: 'Automatic (DHCP)',
      leased: 'Leased address',
      /** What came with the leased address; a gateway or a DNS server may be missing */
      leaseDetails: (subnet: string, gateway: string, dns: string | undefined) => {
        const none = 'none';
        return `Subnet mask ${subnet} · gateway ${gateway || none} · DNS server ${dns || none}`;
      },
      fromDhcpServer: 'The address comes from the DHCP server of the network the card is attached to.',
      automaticHint:
        'The address, subnet mask and gateway are handed out by a DHCP server on the same ' +
        'network: a router or firewall port, or a server, with “DHCP server enabled”. They are ' +
        'worked out from the drawing, the same way every time. The DNS server comes with the ' +
        'address, if that server hands one out.',
      dnsHint:
        'The address of the server the card asks to turn a name into an address. Empty: none, ' +
        'and a name used in place of an address cannot be resolved.',
    },
  },

  /** The list of the cards of a device */
  cards: {
    none: 'No network card: without a card the device connects to nothing.',
    noAddress: 'no address',
    noMac: 'MAC not set',
    disabled: 'Disabled',
    remove: 'Delete card',
    removeNamed: (name: string) => `Delete card ${name}`,
    add: 'Add card',
  },

  /** What is wrong with a port or a card as typed */
  problems: {
    notSubnetMask: (value: string) => `"${value}" is not a valid subnet mask`,
    addressOrNoMask: 'Enter an IP address or clear the subnet mask',
    notVlan: (value: string | number) => `${value} is not a valid VLAN: the number must be between 1 and 4094`,
    accessPortOneVlan: 'An access port is in one VLAN only: several VLANs need a trunk',
    cardNeedsName: 'The card needs a name, for example eth0',
    /** The notice that refuses to save the device: which port or card, then what is wrong with it */
    ofPort: (id: number, problem: string) => `Port ${id}: ${problem}`,
    ofCard: (name: string, problem: string) => `Card ${name}: ${problem}`,
    sameCardName: (name: string) => `Two cards are called ${name}: each card needs its own name`,
  },
};
