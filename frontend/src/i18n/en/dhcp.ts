import type { Dictionary } from '../dictionary';
import { common } from './common';

/** DHCP: the tab, the pool of a port or card, the labels of a lease */

/** What a range is on: a port of a router or of a firewall, a card of a server */
type Kind = 'port' | 'card';

const unit = (kind: Kind) => (kind === 'port' ? 'port' : 'card');

/** The tab of the window of the device where its ports, or its cards, are set */
const tabOf = (kind: Kind) => (kind === 'port' ? common.deviceTabs.ports : common.deviceTabs.cards);

const example = (value: string) => `e.g. ${value}`;

export const dhcp: Dictionary['dhcp'] = {
  /** In place of the address of a card on DHCP that got none */
  noLease: 'DHCP: no address',
  /** A leased address and the interface it comes from: `192.168.20.100 from Router-Core, port 2` */
  leaseFrom: (address: string, server: string) => `${address} from ${server}`,
  /** A card on DHCP that has no address, with the reason when there is one (see `unserved`) */
  noAddress: (reason?: string) => (reason ? `No address: ${reason}` : 'No address'),

  /** The two ends of a range: the same fields in the tab and in the panel of an interface */
  firstAddress: 'First address',
  firstAddressPlaceholder: example('192.168.10.100'),
  lastAddress: 'Last address',
  lastAddressPlaceholder: example('192.168.10.199'),
  /** Under the fields of a range nobody typed yet */
  blankRange: 'Type the first and the last address to hand out: a range left empty is not saved.',
  /** Said when the server is switched on and nothing was typed */
  blankRangeError: 'Type the first and the last address to hand out, or untick the DHCP server',

  /** What is wrong with a range as typed: the words that follow “Cannot be used: ” or the name of the interface */
  rangeProblem: {
    client: 'the card takes its own address from DHCP: it cannot hand out addresses too',
    noAddress: (kind: Kind) =>
      `the ${unit(kind)} has no address: the addresses to hand out are those of its network`,
    endsMissing: 'the first and the last address are needed',
    outside: (address: string, kind: Kind, network: string) =>
      `${address} is outside the network of the ${unit(kind)} (${network})`,
    reversed: (first: string, last: string) =>
      `the last address (${last}) comes before the first (${first})`,
  },
  /** The range that stops a device from being saved, in a notice: `Port 2, DHCP server: …` */
  rangeProblemOn: (iface: string, problem: string) => `${iface}, DHCP server: ${problem}`,

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
      range.gateway ? `Gateway handed out ${range.gateway}` : 'No gateway handed out',
      ...(range.dns ? [`DNS server handed out ${range.dns}`] : []),
      `${range.leased} leased, ${range.free} free of ${range.size}`,
      ...(range.disabled ? [`${unit(range.disabled)} disabled: it does not answer`] : []),
    ].join(' · '),

  /** Why a card on DHCP has no address: the words that follow “No address: ” */
  unserved: {
    routes: 'a router or a firewall does not take its addresses from DHCP',
    disabled: 'the card is disabled',
    noCable: 'no cable is attached to the card',
    noServer: 'no DHCP server answers on its network',
    /** `server`: the device the cable goes to, when it is known */
    unattached: (server?: string) =>
      `the cable to ${server ?? 'the server'} is not attached to one of its ports: ` +
      'which range answers is not known',
    unusable: (server: string, problem: string) =>
      `the range of ${server} cannot be used: ${problem}`,
    unusableUnnamed: 'the range that answers cannot be used',
    usedUp: (server: string, size: number) =>
      `the range of ${server} is used up: ` +
      (size === 1 ? 'its only address is already taken' : `${size} addresses, all taken`),
    usedUpUnnamed: 'the range that answers is used up',
    /** A range with no address in it that can be given */
    empty: (server: string) => `the range of ${server} has no addresses to hand out`,
  },

  /** The “DHCP” tab of the window of a device */
  panel: {
    intro:
      'A DHCP server hands out an address, a subnet mask and a gateway to the devices of its ' +
      'network whose card is set to “Automatic (DHCP)”, and the DNS server to ask for names when ' +
      'the range names one. The addresses are worked out from the drawing, the same way every ' +
      'time: the devices are served in the order they appear, and each takes the first free ' +
      'address.',

    ranges: {
      title: 'Address ranges',
      noneAddressed: (kind: Kind) =>
        `No ${unit(kind)} has an address: a range hands out the addresses of the network of its ` +
        `${unit(kind)}, so it is switched on for a ${unit(kind)} that has one.`,
      goToTab: (kind: Kind) => `Go to the “${tabOf(kind)}” tab`,
      noneServing: (kind: Kind) =>
        `No ${unit(kind)} hands out addresses. Tick the ${unit(kind)} of the network to give them to: ` +
        'the range is suggested, and can be changed.',
      /** The tick of an interface; `iface` as a sentence names it: `port 2`, `card eth0` */
      serverOn: (iface: string) => `DHCP server on ${iface}`,
      /** A field with the interface it is of: two interfaces have the same four fields */
      fieldOf: (field: string, iface: string) => `${field}, ${iface}`,
      gateway: 'Gateway handed out',
      dns: 'DNS server handed out',
      /** In an empty field: nothing is handed out */
      none: 'none',
      unusable: (problem: string) => `Cannot be used: ${problem}.`,
      giveItOne: 'Give it one',
      client: 'It takes its own address from DHCP: it cannot hand out addresses too.',
      noAddress: 'It has no address: the addresses to hand out are those of its network.',
      /** Under the list, when ports without an address are left out of it */
      onlyAddressed: (kind: Kind) =>
        'The ports that have an address are listed. To give one to another port, go to the ' +
        `<link>“${tabOf(kind)}” tab</link>.`,
    },

    leases: {
      title: 'Leased addresses',
      none:
        'No address leased: no device of these networks has its card set to ' +
        '“Automatic (DHCP)”.',
      address: 'Address',
      device: 'Device',
      card: 'Card',
      server: 'Handed out by',
    },

    warnings: {
      title: 'Warnings',
      unserved: (device: string, card: string, reason: string) =>
        `${device} (${card}) is left without an address: ${reason}.`,
      rivals: (servers: string[]) =>
        `${servers.length === 2 ? 'Two' : servers.length} DHCP servers on the same network: ` +
        `${servers.join('; ')}. The first that has a free address answers.`,
    },

    notSimulated:
      'A simulated failure in a presentation does not take the address away from whoever had it. ' +
      'Not simulated: the relay to other networks, reservations and lease times.',
  },

  /** The DHCP server in the panel of one port or of one card */
  server: {
    enabled: 'DHCP server enabled',
    enabledHint:
      'The devices of this network whose card is set to “Automatic (DHCP)” take their address, ' +
      'subnet mask and gateway from here; the addresses written by hand in the drawing are ' +
      `skipped. Who took which address is shown in the “${common.deviceTabs.dhcp}” tab.`,
    gateway: 'Gateway handed out (optional)',
    gatewayPlaceholder: example('192.168.10.1'),
    dns: 'DNS server handed out (optional)',
    dnsPlaceholder: example('192.168.30.10'),
    dnsHint: 'Empty: none. It can be on another network.',
  },
};
