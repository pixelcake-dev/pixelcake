import type { Dictionary } from '../dictionary';

/** The routes tab of a device */

/** What the last cell of a row of the routing table is told about its route */
interface TableRow {
  kind: 'connected' | 'static' | 'default';
  /** The default route that is the gateway of the device, not a route written in the tab */
  fromGateway: boolean;
  /** A second route to a network that has one already */
  backup: boolean;
  /** `unreachable`: the next hop is on no network of the device; `down`: its interface is off */
  state: 'usable' | 'unreachable' | 'down';
}

export const routes: Dictionary['routes'] = {
  intro:
    'The networks the device is attached to through a port are reached on their own. The ' +
    'networks that lie behind another router are written here: traffic for such a network is ' +
    'handed to the next hop. The gateway in the “General” tab is the default route, used when ' +
    'no other route matches.',
  backup:
    'Two routes to the same network: the first is the one used. The second is a backup and ' +
    'takes over when the port the first leaves by is down, or when its line has failed (you ' +
    'can simulate that in presentation mode).',
  /** On a device none of whose ports has an address */
  noAddresses:
    'No port of this device has an address: it lets traffic through without routing it, and ' +
    'its routes are not used. Give the ports an address in the “Ports” tab.',

  /** The routes a person writes */
  staticRoutes: {
    title: 'Static routes',
    none: 'No static routes.',
    columns: {
      destination: 'Destination network',
      nextHop: 'Next hop',
      note: 'Note',
    },
    destinationOf: (n: number) => `Destination network of route ${n}`,
    nextHopOf: (n: number) => `Next hop of route ${n}`,
    noteOf: (n: number) => `Note of route ${n}`,
    notePlaceholder: 'e.g. Milan site',
    delete: 'Delete route',
    deleteNumbered: (n: number) => `Delete route ${n}`,
    add: 'Add route',
  },

  /** The table the engine reads, worked out from the whole window */
  table: {
    title: 'Routing table',
    explanation:
      'It is the one the engine uses, with the changes made in this window that are not saved ' +
      'yet. The most specific row wins.',
    empty: 'No rows: the device has no addresses.',
    columns: {
      destination: 'Destination',
      nextHop: 'Next hop',
      leavesBy: 'Leaves by',
      kind: 'Kind',
    },
    /** The last cell of a row: `static, backup`, `default (gateway)` */
    kind: ({ kind, fromGateway, backup, state }: TableRow) => {
      const name = { connected: 'connected', static: 'static', default: 'default' }[kind];
      return (
        name +
        (fromGateway ? ' (gateway)' : '') +
        (backup ? ', backup' : '') +
        (state === 'unreachable' ? ": the next hop is on none of the device's networks" : '') +
        (state === 'down' ? ' (interface down)' : '')
      );
    },
  },

  /** What is wrong with a route as typed: under its row, and after “Route 2: ” on saving */
  problems: {
    notANetwork: (value: string) =>
      `"${value}" is not a network: write it as 192.168.30.0/24, or "default"`,
  },
};
