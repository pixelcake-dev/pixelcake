import type { Dictionary } from '../dictionary';

/** The DNS tab of a server */
export const dns: Dictionary['dns'] = {
  /** (the words between backticks are a command of the terminal: drawn as code) */
  intro:
    'A DNS server says which address a name stands for. It answers only for the names ' +
    'written below. A name is used in the terminal in place of an address, for example ' +
    '`ping www.azienda.example from PC-1`: first the question goes to the DNS server, crossing ' +
    'the network like any other exchange, and it can stop in the same ways; then the ping goes ' +
    'to the address received.',

  records: {
    /** How the list is named for who cannot see it */
    label: 'DNS records',
    title: 'Known names',
    none: 'No names: until it has at least one, this device does not answer as a DNS server.',
    number: 'No.',
    name: 'Name',
    address: 'Address',
    nameOf: (row: number) => `Name of record ${row}`,
    addressOf: (row: number) => `Address of record ${row}`,
    delete: 'Delete record',
    deleteRow: (row: number) => `Delete record ${row}`,
    add: 'Add record',
  },

  asking: {
    /** How the notes are named for who cannot see them */
    label: 'Who asks this server',
    how:
      'Each device decides whom to ask, on its own network card: the “DNS server” field with ' +
      'the address written by hand, or “DNS server handed out” in the DHCP server that gives it ' +
      'its address.',
    /** (`<address/>` is where the addresses of the server are drawn) */
    address: 'The address of this server is <address/>.',
    noAddress: 'This server has no address: nobody can ask it anything.',
    limits:
      'Upper and lower case do not matter in names, and a name has one address only. Not ' +
      'simulated: a second DNS server to fall back on, passing the question on to other servers ' +
      '(the server answers only for its own names), the caching of answers and their expiry, ' +
      'reverse lookup, aliases and wildcard names. The simulation and the presentation choose ' +
      'devices from menus and do not use names.',
  },

  /** What is wrong with a record as typed, or with the DNS server written on a network card */
  problems: {
    missingName: 'the name is missing',
    invalidName: (name: string) =>
      `"${name}" is not a valid name: letters, digits and hyphens, with at least one dot, as in www.azienda.example`,
    missingAddress: 'the address the name stands for is missing',
    duplicateName: (name: string, record: number) =>
      `the name ${name} is already in record ${record}: a name has one address only`,
    serverNotAnAddress: (value: string) =>
      `"${value}" is not a valid IPv4 address: a DNS server is given by its address`,
  },
};
