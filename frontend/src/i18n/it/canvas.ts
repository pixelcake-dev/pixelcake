import { formatCount } from '../numbers';

/** A number of things as Italian writes it («14.891») */
const amount = (value: number) => formatCount('it', value);

/** `A`, `A e B`, `A, B e C` */
const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;

/** Of a long list of names, the first three and «altri N» */
const shortList = (names: string[]) =>
  list(names.length > 4 ? [...names.slice(0, 3), `altri ${amount(names.length - 3)}`] : names);

/** What is written on the board itself: devices, cables, areas */
export const canvas = {
  /** Presentation mode: the marks on a device (the two ends of the question, a failure) */
  device: {
    from: 'Da',
    to: 'A',
    failed: 'Guasto simulato',
    /** For a screen reader: the note of a device, which the eye sees in a panel when the pointer rests on it */
    note: (text: string) => `Nota: ${text}`,
    /** For a screen reader: what the colour of the lamp says of the answer (red, green) */
    stopsHere: 'Qui si ferma',
    getsHere: 'Qui arriva',
    /** Under the name: an address that another device has too */
    conflict: (address: string) => `${address} · in conflitto`,
  },

  /** Presentation mode: the mark on a cable that is cut */
  cable: {
    cut: 'Guasto simulato: il cavo è interrotto',
  },

  area: {
    /** What a new area is called until it is given its name */
    defaultName: 'Riquadro',
    name: 'Nome del riquadro',
    namePlaceholder: 'Nome',
    unnamed: 'Senza nome',
    labelHint: 'Trascina per spostare il riquadro, doppio clic per rinominarlo',
    /** Said when a new area is made while they were hidden from the View menu */
    shownAgain: 'I riquadri erano nascosti: ora si vedono di nuovo',
  },

  /** After a paste: the pasted end devices that asked DHCP for an address and got none */
  paste: {
    noAddress: (names: string[]) =>
      names.length === 1
        ? `${names[0]} chiede l'indirizzo al DHCP, e nessun server DHCP gliene ha dato uno`
        : `${shortList(names)} chiedono l'indirizzo al DHCP, e nessun server DHCP ne ha dato loro uno`,
    /** Pasted servers, routers, firewalls and switches keep the addresses of the originals: those now in conflict */
    keptAddresses: (names: string[], addresses: string[]) => {
      const who =
        names.length === 1
          ? `${names[0]} tiene gli indirizzi dell'originale`
          : `${shortList(names)} tengono gli indirizzi degli originali`;
      if (addresses.length === 0) return who;
      return addresses.length === 1
        ? `${who}: ${addresses[0]} ora è in conflitto, finché non lo cambi`
        : `${who}: ${shortList(addresses)} ora sono in conflitto, finché non li cambi`;
    },
  },

  /** The Delete key, with more than one thing selected (one alone is asked about as in its menu) */
  deleteQuestion: {
    title: (deviceCount: number, connectionCount: number, areaCount: number) =>
      `Eliminare ${list(
        [
          deviceCount === 0 ? '' : deviceCount === 1 ? '1 dispositivo' : `${amount(deviceCount)} dispositivi`,
          connectionCount === 0
            ? ''
            : connectionCount === 1
              ? '1 connessione'
              : `${amount(connectionCount)} connessioni`,
          areaCount === 0 ? '' : areaCount === 1 ? '1 riquadro' : `${amount(areaCount)} riquadri`,
        ].filter(Boolean)
      )}?`,
    /** When devices are among them */
    detail: 'Con i dispositivi vengono tolte anche le loro connessioni.',
  },
};
