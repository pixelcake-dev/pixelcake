import type { Dictionary } from '../dictionary';

/** The sidebar and its panels' frames */
export const sidebar: Dictionary['sidebar'] = {
  /** The six buttons: the name each one carries, and shows beside it */
  buttons: {
    explorer: 'Explorer',
    simulation: 'Simulation',
    addDevice: 'Add device',
    console: 'Console',
    importExport: 'Import/Export',
    settings: 'Settings',
  },

  /** The title of each panel */
  panels: {
    simulation: 'Simulation',
    devices: 'Add',
    explorer: 'Explorer',
  },
};
