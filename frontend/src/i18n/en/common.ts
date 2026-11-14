import type { Dictionary } from '../dictionary';

/** Words shared by many screens: the motto, the usual buttons, how an interface is named */
export const common: Dictionary['common'] = {
  brand: {
    motto: 'Infrastructure, piece by piece',
  },

  /** A name, or the words of a control, quoted inside a sentence */
  quote: (text: string) => `“${text}”`,

  /** The switch between the languages of the interface */
  language: {
    label: 'Language',
  },

  actions: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    close: 'Close',
    add: 'Add',
  },

  /** The services a firewall rule or a port forward is about */
  services: {
    any: 'Any',
    ping: 'Ping',
    web: 'Web',
    email: 'Email',
    dns: 'DNS',
  },

  /** The tabs of the window of a device, as other screens name them */
  deviceTabs: {
    general: 'General',
    ports: 'Ports',
    cards: 'Network cards',
    routes: 'Routes',
    rules: 'Rules',
    nat: 'NAT',
    dhcp: 'DHCP',
    dns: 'DNS',
  },

  /** How a port or a network card is named in a list or in a sentence */
  interfaces: {
    port: (id: number) => `Port ${id}`,
    portNamed: (id: number, name: string) => `Port ${id} “${name}”`,
    portInSentence: (id: number) => `port ${id}`,
    card: (name: string) => `Card ${name}`,
    cardInSentence: (name: string) => `card ${name}`,
  },

  validation: {
    notIPv4: (value: string) => `"${value}" is not a valid IPv4 address`,
  },
};
