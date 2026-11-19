import type { Dictionary } from '../dictionary';
import { common } from './common';
import { formatCount } from '../numbers';

/** A number of things as English writes it ("14,891") */
const amount = (value: number) => formatCount('en', value);

/** The window of a device: its frame, the first tab, saving */

// The tabs a sentence sends to, named as the window names them
const portsTab = common.quote(common.deviceTabs.ports);
const cardsTab = common.quote(common.deviceTabs.cards);

export const inspector: Dictionary['inspector'] = {
  title: (deviceName: string) => `Edit: ${deviceName}`,

  /** Over the tabs: an address of the device, as it is in the form, that other devices have too */
  addressConflict: (address: string, devices: string[]) =>
    devices.length === 0
      ? ''
      : `Address conflict: ${address} is also on ${
          devices.length === 1 ? devices[0] : `${devices.slice(0, -1).join(', ')} and ${devices[devices.length - 1]}`
        }. While it is on more than one device, a question to or from this address has no answer ` +
        'you can trust.',

  /** The first tab: what the device is, how it is addressed */
  general: {
    identity: {
      legend: 'Identity',
      type: 'Type',
      name: 'Device name',
      /** Under the name, when another device of the board has it (whatever its case) */
      nameTaken: 'Another device already has this name',
      vendor: 'Vendor',
      vendorPlaceholder: 'e.g. Cisco, HP, Dell…',
      location: 'Location',
      locationPlaceholder: 'e.g. Rack 01, Office 102…',
      notes: 'Notes',
      notesPlaceholder: 'Free text. It also shows on the drawing when you hover over the device.',
    },

    network: {
      legend: 'Network',
      /** A device addressed through its cards: the group is about the first one */
      legendOfCard: (cardName: string) => `Network · ${cardName}`,
      gatewayDefaultRoute: 'Gateway (default route)',
      /** Under the address of a router or of a firewall */
      namedByAddress:
        'The address above is the one the device is known by; the networks it is attached to ' +
        'come from the addresses of its ports.',
      /** Under the address of the first card. `<peer/>` is what the card is linked to, `<tab>` opens the tab of the cards */
      firstCard: {
        linkedTo: 'Connected to <peer/>.',
        noCable: 'No cable attached.',
        onlyCard: `The name, speed and MAC of the card are in the <tab>${cardsTab} tab</tab>.`,
        firstOfSeveral: (count: number) =>
          `It is the first of ${amount(count)} cards, the one the device is known by: the others, and the name, speed and MAC of each, are in the <tab>${cardsTab} tab</tab>.`,
      },
    },

    vlans: {
      hintSwitch: `The VLANs the switch knows: the others are dropped. Empty: all of them. The VLAN of each port is chosen in the ${portsTab} tab.`,
      hintOther: 'The VLANs the device accepts tagged on a trunk port. Empty: untagged traffic only.',
    },

    /** The ports of a router or of a firewall, and those of a switch */
    portsInUse: 'Ports in use',
    ports: 'Ports',

    stp: {
      enabled: 'STP enabled',
      mode: 'STP mode',
      bridgePriority: 'Bridge priority',
      bridgePriorityHint: 'From 0 to 61440 in steps of 4096 (default 32768).',
      notSimulated: 'Spanning tree is for documentation only: the engine does not simulate it.',
    },
  },

  /** What the window answers when it does not do what was asked */
  toasts: {
    nameRequired: 'The name is required',
    nameAndIpRequired: 'Name and IP address are required',
    portsWithCable: (portIds: number[]) =>
      portIds.length === 1
        ? `Port ${portIds[0]} has a cable attached: detach it before removing the port`
        : `Ports ${portIds.join(', ')} have a cable attached: detach them before removing the ports`,
    /** A row of a tab that cannot be saved: which one, then what is wrong with it */
    routeProblem: (row: number, problem: string) => `Route ${row}: ${problem}`,
    ruleProblem: (row: number, problem: string) => `Rule ${row}: ${problem}`,
    forwardProblem: (row: number, problem: string) => `Port forward ${row}: ${problem}`,
    recordProblem: (row: number, problem: string) => `DNS record ${row}: ${problem}`,
  },
};
