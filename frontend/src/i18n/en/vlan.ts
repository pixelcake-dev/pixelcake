import type { Dictionary } from '../dictionary';

/** VLANs: the field, the names of the project */

const example = (value: string) => `e.g. ${value}`;

export const vlan: Dictionary['vlan'] = {
  /** A VLAN in a list of numbers, with the name the project gave it: `10 “Offices”` */
  numberAndName: (id: number, name: string) => `${id} “${name}”`,

  /** The field that takes several VLAN numbers, each shown as a tag */
  input: {
    placeholder: example('10, 20, 30'),
    outOfRange: 'A VLAN must be between 1 and 4094',
    duplicate: 'VLAN already in the list',
    remove: (id: number) => `Remove VLAN ${id}`,
    hint: 'Press Enter or comma to add a VLAN (1-4094)',
  },

  /** The table of the VLANs of the project and of their names (Settings → Network) */
  names: {
    title: 'VLANs of the project',
    name: 'Name',
    onThisCanvas: 'On this board',
    remove: 'Remove',
    newNumber: 'Number of the new VLAN',
    numberPlaceholder: example('30'),
    nameOf: (id: string) => `Name of VLAN ${id}`,
    newName: 'Name of the new VLAN',
    /** In the empty name of a VLAN the drawing uses */
    unnamed: 'no name',
    namePlaceholder: example('Offices'),
    inUse: 'in use',
    notUsed: 'not used',
    removeNameOf: (id: string) => `Remove the name of VLAN ${id}`,
    removeNew: 'Remove the new VLAN',
    none: 'No VLAN has a name, and this board uses none.',
    add: 'Add VLAN',

    /** What is wrong with a row */
    problems: {
      numberMissing: (name: string) => `The number of VLAN “${name}” is missing`,
      notAVlan: (typed: string) => `"${typed}" is not a VLAN: the number goes from 1 to 4094`,
      nameMissing: (id: number) => `The name of VLAN ${id} is missing`,
      duplicate: (id: number) => `VLAN ${id} is already in the list`,
    },
  },
};
