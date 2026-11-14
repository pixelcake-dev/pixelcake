import type { Dictionary } from '../dictionary';

/** Settings, advanced tab: figures and shortcuts */
export const advanced: Dictionary['advanced'] = {
  usage: {
    title: 'Usage statistics',
    intro: 'Statistics on the current use of the application.',
    devices: {
      title: 'Devices on the board',
      caption: 'Devices on the open board',
    },
    links: {
      title: 'Links on the board',
      caption: 'Active links between devices',
    },
    deviceTemplates: {
      title: 'Custom device templates',
      caption: 'Custom templates created',
    },
    linkTemplates: {
      title: 'Custom link templates',
      caption: 'Customised link templates',
    },
  },

  shortcuts: {
    title: 'Keyboard and mouse shortcuts',
    intro: 'Keyboard and mouse commands for working on the board.',
    /** What each shortcut does, and the keys (or the gesture) that do it */
    rows: {
      save: { action: 'Save the project to a file', keys: 'Ctrl + S' },
      copy: { action: 'Copy the selected devices', keys: 'Ctrl + C' },
      paste: { action: 'Paste the copied devices', keys: 'Ctrl + V' },
      delete: { action: 'Delete the selected devices, or the selected area', keys: 'Delete' },
      toggleSelection: { action: 'Add a device to the selection, or remove it', keys: 'Ctrl + click' },
      selectionBox: {
        action: 'Select several devices with a selection box',
        keys: 'Drag on empty space',
      },
      pan: { action: 'Move the view', keys: 'Right button + drag' },
      zoom: { action: 'Zoom', keys: 'Mouse wheel' },
    },
  },
};
