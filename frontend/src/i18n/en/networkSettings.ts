import type { Dictionary } from '../dictionary';

/** Settings, network tab: what a new device starts from */

const example = (value: string) => `e.g. ${value}`;

/** `PC-1, PC-2 and Srv-1`; after the first four, how many more */
const listOf = (names: string[]) => {
  const shown = names.slice(0, 4);
  const more = names.length - shown.length;
  if (more > 0) return `${shown.join(', ')} and ${more === 1 ? 'one more' : `${more} more`}`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
};

export const networkSettings: Dictionary['networkSettings'] = {
  title: 'Global network settings',
  intro: 'They apply to the whole project. Changing them does not affect existing devices.',

  newDevices: {
    legend: 'New devices',
    network: 'Network',
    networkPlaceholder: example('192.168.1.0'),
    mask: 'Default subnet mask',
    maskPlaceholder: example('255.255.255.0'),
    gateway: 'Default gateway',
    gatewayPlaceholder: example('192.168.1.1'),
    dns: 'Default DNS server',
    dnsPlaceholder: 'optional',
    hint:
      'The first free address of this network is suggested for a new device, with this subnet ' +
      'mask and this gateway. A router or a firewall starts without a gateway: its default route ' +
      'is chosen in its window. The DNS server, if there is one, is written on the network card ' +
      'of new PCs, servers and the other end devices.',
  },

  /** Under a field that must not be left empty */
  required: 'Required',

  /** The DNS server of the project, offered to the devices of the board that ask nobody */
  assignDns: {
    /** `names`: the devices that ask nobody */
    missing: (names: string[]) =>
      names.length === 1
        ? `On this board ${names[0]} has no DNS server.`
        : `On this board ${names.length} devices have no DNS server.`,
    button: (server: string) => `Assign ${server}`,
    question: {
      title: (server: string, names: string[]) =>
        names.length === 1
          ? `Assign the DNS server ${server} to ${names[0]}?`
          : `Assign the DNS server ${server} to ${names.length} devices?`,
      detail: (names: string[]) =>
        (names.length === 1
          ? 'It is written on its network card.'
          : `It is written on the network card of ${listOf(names)}.`) +
        ' A device that already has a DNS server keeps it, and cards on DHCP are not touched: ' +
        'theirs comes with the address.',
      confirm: 'Assign',
    },
    /** `names`: the devices it was written on */
    done: (names: string[]) =>
      names.length === 1
        ? `DNS server assigned to ${names[0]}`
        : `DNS server assigned to ${names.length} devices`,
  },

  /** Over the table of the VLANs of the project */
  vlansHint:
    'A name for each VLAN, written once: it appears next to the number wherever the VLAN is ' +
    'shown, in the window of a switch and in the settings of its ports. The VLANs used on this ' +
    'board are already in the list. A row left without a name is not saved.',

  simulation: {
    legend: 'Simulation',
    emailMode: 'Email mode (SMTP)',
    auto: 'Auto (detect automatically)',
    internal: 'Internal mail server',
    hint:
      'Decides how emails travel in a simulation: through an internal mail server, or through an ' +
      'external service (Cloud), out through the Internet.',
  },

  save: 'Save network settings',
  allRequired: 'All fields are required',
  saved: 'Network settings saved',
};
