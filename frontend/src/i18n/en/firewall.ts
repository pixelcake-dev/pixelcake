import type { Dictionary } from '../dictionary';

/** The rules tab of a firewall, and of a router */
export const firewall: Dictionary['firewall'] = {
  /** Drawn with Rich: the words between backticks are shown as code */
  intro:
    'Rules are read top to bottom: the first that matches decides. In “From” and “To” write ' +
    '`any`, a zone (`trust`, `untrust`, `dmz`), an address or a network such as ' +
    '`192.168.10.0/24`.',

  title: 'Firewall rules',
  none: 'No rules: only the zone policy below decides.',
  columns: {
    number: 'No.',
    action: 'Action',
    service: 'Service',
    from: 'From',
    to: 'To',
    enabled: 'Enabled',
  },
  actions: {
    allow: 'Allow',
    deny: 'Deny',
  },
  actionOf: (n: number) => `Action of rule ${n}`,
  serviceOf: (n: number) => `Service of rule ${n}`,
  sourceOf: (n: number) => `Source of rule ${n}`,
  destinationOf: (n: number) => `Destination of rule ${n}`,
  enabledOf: (n: number) => `Rule ${n} enabled`,
  moveUp: 'Move up',
  moveUpNumbered: (n: number) => `Move rule ${n} up`,
  moveDown: 'Move down',
  moveDownNumbered: (n: number) => `Move rule ${n} down`,
  delete: 'Delete rule',
  deleteNumbered: (n: number) => `Delete rule ${n}`,
  add: 'Add rule',

  /** Rules name zones no port is in (`trust`, `untrust`, `dmz`: written as they are typed) */
  unusedZones: (zones: readonly string[]) =>
    (zones.length === 1
      ? `No port is in zone ${zones[0]}: the rules that name it never match.`
      : `No port is in zones ${zones.join(', ')}: the rules that name them never match.`) +
    ' The zone of a port is chosen in the “Ports” tab.',

  noMatch: {
    title: 'When no rule matches',
    text:
      'The zone policy decides: traffic towards a more trusted zone is denied (untrust → trust, ' +
      'untrust → dmz, dmz → trust); everything else is allowed. The reply to a flow this ' +
      'firewall allowed passes; a reply whose request it never saw is judged like any other ' +
      'packet.',
  },

  /** The same tab on a router: its rules are its access list, and it has no zones */
  router: {
    /** Drawn with Rich: the words between backticks are shown as code */
    intro:
      'Rules are read top to bottom: the first that matches decides. In “From” and “To” write ' +
      '`any`, an address or a network such as `192.168.10.0/24`.',
    title: 'Router rules',
    none: 'No rules: the router lets everything through.',
    noMatch:
      'Everything is allowed: a router has no security zones. The reply to a flow the router ' +
      'allowed passes; a reply whose request it never saw is judged like any other packet.',
    /** Rules of a router name zones (`trust`, `untrust`, `dmz`: written as they are typed) */
    zonesNeverMatch: (zones: readonly string[]) =>
      'Zones belong to the ports of a firewall: on a router the rules that name ' +
      (zones.length === 1 ? `the zone ${zones[0]}` : `the zones ${zones.join(', ')}`) +
      ' never match.',
  },

  /** What is wrong with a rule as typed: under its row, and after “Rule 2: ” on saving */
  problems: {
    /** The side is named as its column is: “From”, “To” */
    invalidEndpoint: (side: 'source' | 'destination', value: string) =>
      `“${side === 'source' ? 'From' : 'To'}”: "${value}" must be “any”, a zone (trust, untrust, dmz), an address or a network`,
  },
};
