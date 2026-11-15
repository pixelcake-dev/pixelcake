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

export const routes = {
  intro:
    'Le reti a cui il dispositivo è collegato con una porta si raggiungono da sole. Qui si ' +
    'scrivono le reti che stanno dietro un altro router: il traffico per quella rete viene ' +
    'consegnato al prossimo salto. Il gateway della scheda «Generale» è la rotta predefinita, ' +
    "usata quando nessun'altra corrisponde.",
  backup:
    'Due rotte per la stessa rete: vale la prima. La seconda è di riserva e subentra quando la ' +
    'porta da cui esce la prima è spenta, o quando la sua linea è guasta (lo puoi simulare in ' +
    'modalità presentazione).',
  /** On a device none of whose ports has an address */
  noAddresses:
    'Nessuna porta di questo dispositivo ha un indirizzo: lascia passare il traffico senza ' +
    'instradarlo, e le rotte non vengono usate. Assegna un indirizzo alle porte nella scheda ' +
    '«Porte».',

  /** The routes a person writes */
  staticRoutes: {
    title: 'Rotte statiche',
    none: 'Nessuna rotta statica.',
    columns: {
      destination: 'Rete di destinazione',
      nextHop: 'Prossimo salto',
      note: 'Nota',
    },
    destinationOf: (n: number) => `Rete di destinazione della rotta ${n}`,
    nextHopOf: (n: number) => `Prossimo salto della rotta ${n}`,
    noteOf: (n: number) => `Nota della rotta ${n}`,
    notePlaceholder: 'es. sede di Milano',
    delete: 'Elimina la rotta',
    deleteNumbered: (n: number) => `Elimina la rotta ${n}`,
    add: 'Aggiungi rotta',
  },

  /** The table the engine reads, worked out from the whole window */
  table: {
    title: 'Tabella di instradamento',
    explanation:
      'È quella che il motore usa, con le modifiche di questa finestra non ancora salvate. Vince ' +
      'la riga più specifica.',
    empty: 'Nessuna riga: il dispositivo non ha indirizzi.',
    columns: {
      destination: 'Destinazione',
      nextHop: 'Prossimo salto',
      leavesBy: 'Esce da',
      kind: 'Tipo',
    },
    /** The last cell of a row: `statica, di riserva`, `predefinita (gateway)` */
    kind: ({ kind, fromGateway, backup, state }: TableRow) => {
      const name = { connected: 'collegata', static: 'statica', default: 'predefinita' }[kind];
      return (
        name +
        (fromGateway ? ' (gateway)' : '') +
        (backup ? ', di riserva' : '') +
        (state === 'unreachable' ? ': il prossimo salto non è su nessuna rete del dispositivo' : '') +
        (state === 'down' ? ' (interfaccia spenta)' : '')
      );
    },
  },

  /** What is wrong with a route as typed: under its row, and after «Rotta 2: » on saving */
  problems: {
    notANetwork: (value: string) =>
      `"${value}" non è una rete: scrivila come 192.168.30.0/24, oppure "default"`,
  },
};
