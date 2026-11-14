import type { Dictionary } from '../dictionary';

/** The NAT tab of a device */
export const nat: Dictionary['nat'] = {
  intro:
    'The Internet does not carry private addresses. A port with NAT enabled gives its own ' +
    'address to traffic that leaves through it, and the device takes the reply back to whoever ' +
    'asked. A port forward does the opposite: at the address of a port it publishes a service ' +
    'that is inside, so that it can be reached from outside.',

  /** The ports that give their address to what leaves by them */
  ports: {
    title: 'Ports with NAT',
    /** Followed by the button `goToPorts` */
    noAddressedPort:
      'No port has an address: NAT gives the address of the port to traffic that leaves through ' +
      'it, so it can only be enabled on a port that has one.',
    goToPorts: 'Go to the “Ports” tab',
    noneDoesNat: 'No port does NAT. Tick the port that leads out to the Internet.',
    natOn: (id: number) => `NAT on port ${id}`,
    /** Drawn with Rich: <port/> is the name of the port, <address/> its address */
    translates: '<port/>: traffic that leaves through it takes the address <address/>',
    /** Drawn with Rich, and followed by the button `giveAddress` */
    withoutAddress: '<port/>: <problem>it has no address, so it translates nothing.</problem>',
    giveAddress: 'Give it one',
    /** Drawn with Rich: <link> opens the “Ports” tab */
    onlyAddressed:
      'Only ports that have an address are listed. To give one to another port, go to the ' +
      '<link>“Ports” tab</link>.',
  },

  /** What is published from a port to an address inside */
  forwards: {
    /** The name of the section for a screen reader; `title` is its heading */
    label: 'Published services',
    title: 'Published services (port forwards)',
    none: 'No port forwards: only the device itself can be reached from outside.',
    columns: {
      number: 'No.',
      service: 'Service',
      arrivesOn: 'Arrives on port',
      goesTo: 'Goes to address',
      enabled: 'Enabled',
    },
    serviceOf: (n: number) => `Service of port forward ${n}`,
    portOf: (n: number) => `Arrival port of port forward ${n}`,
    /** In the list of ports, the port of a forward that has lost its address */
    portWithoutAddress: (id: number) => `Port ${id} (no address)`,
    insideAddressOf: (n: number) => `Inside address of port forward ${n}`,
    enabledOf: (n: number) => `Port forward ${n} enabled`,
    moveUp: 'Move up',
    moveUpNumbered: (n: number) => `Move port forward ${n} up`,
    moveDown: 'Move down',
    moveDownNumbered: (n: number) => `Move port forward ${n} down`,
    delete: 'Delete port forward',
    deleteNumbered: (n: number) => `Delete port forward ${n}`,
    add: 'Add port forward',
    nothingToPublish: 'No port has an address to publish: give one to a port in the “Ports” tab.',
  },

  reading: {
    title: 'How port forwards are read',
    text:
      'Port forwards are read top to bottom: the first that matches the service and the port is ' +
      'taken. Whoever is outside sends the request to the address of the port, and the reply ' +
      'comes back from that address: they never see the inside one.',
    onFirewall:
      'On a firewall a port forward says where the traffic goes, not that it may pass: a rule ' +
      'that allows it is needed too, written for the inside address (“Rules” tab).',
  },

  /** What is wrong with a forward as typed: under its row, and after “Port forward 2: ” on saving */
  problems: {
    portWithoutAddress: (id: number) =>
      `port ${id} has no address to publish: give it one in the “Ports” tab`,
    ownAddress: (address: string, id: number) => `${address} is the address of port ${id} itself`,
  },
};
