import type { Dictionary } from '../dictionary';
import { formatCount } from '../numbers';

/** A number of things as English writes it ("14,891") */
const amount = (value: number) => formatCount('en', value);

/** `A`, `A and B`, `A, B and C` */
const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Of a long list of names, the first three and "N more" */
const shortList = (names: string[]) =>
  list(names.length > 4 ? [...names.slice(0, 3), `${amount(names.length - 3)} more`] : names);

/** What is written on the board itself: devices, cables, areas */
export const canvas: Dictionary['canvas'] = {
  /** Presentation mode: the marks on a device (the two ends of the question, a failure) */
  device: {
    from: 'From',
    to: 'To',
    failed: 'Simulated failure',
    /** For a screen reader: the note of a device, which the eye sees in a panel when the pointer rests on it */
    note: (text: string) => `Note: ${text}`,
    /** For a screen reader: what the colour of the lamp says of the answer (red, green) */
    stopsHere: 'Stops here',
    getsHere: 'Gets here',
    /** Under the name: an address that another device has too, and on a line of its own what is wrong with it */
    conflict: (address: string) => `${address}\nin conflict`,
  },

  /** Presentation mode: the mark on a cable that is cut */
  cable: {
    cut: 'Simulated failure: the cable is cut',
  },

  area: {
    /** What a new area is called until it is given its name */
    defaultName: 'Area',
    name: 'Area name',
    namePlaceholder: 'Name',
    unnamed: 'Unnamed',
    labelHint: 'Drag to move the area, double-click to rename it',
    /** Said when a new area is made while they were hidden from the View menu */
    shownAgain: 'The areas were hidden: they are shown again',
  },

  /** After a paste: the pasted end devices that asked DHCP for an address and got none */
  paste: {
    noAddress: (names: string[]) =>
      names.length === 1
        ? `${names[0]} asks DHCP for its address, and no DHCP server gave it one`
        : `${shortList(names)} ask DHCP for their address, and no DHCP server gave them one`,
    /** Pasted servers, routers, firewalls and switches keep the addresses of the originals: those now in conflict */
    keptAddresses: (names: string[], addresses: string[]) => {
      const who =
        names.length === 1
          ? `${names[0]} keeps the addresses of the original`
          : `${shortList(names)} keep the addresses of the originals`;
      if (addresses.length === 0) return who;
      return addresses.length === 1
        ? `${who}: ${addresses[0]} is now in conflict until you change it`
        : `${who}: ${shortList(addresses)} are now in conflict until you change them`;
    },
  },

  /** The Delete key, with more than one thing selected (one alone is asked about as in its menu) */
  deleteQuestion: {
    title: (deviceCount: number, connectionCount: number, areaCount: number) =>
      `Delete ${list(
        [
          deviceCount === 0 ? '' : deviceCount === 1 ? '1 device' : `${amount(deviceCount)} devices`,
          connectionCount === 0 ? '' : connectionCount === 1 ? '1 link' : `${amount(connectionCount)} links`,
          areaCount === 0 ? '' : areaCount === 1 ? '1 area' : `${amount(areaCount)} areas`,
        ].filter(Boolean)
      )}?`,
    /** When devices are among them */
    detail: 'The links of the devices go with them.',
  },
};
