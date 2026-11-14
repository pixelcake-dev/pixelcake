import type { Dictionary } from '../dictionary';

/** The menu bar */
export const menu: Dictionary['menu'] = {
  file: {
    title: 'File',
    newProject: 'New project…',
    open: 'Open…',
    save: 'Save',
    saveAs: 'Save as…',
    exportPicture: 'Export picture…',
  },

  edit: {
    title: 'Edit',
    copy: 'Copy',
    paste: 'Paste',
    enclose: 'Enclose in an area',
  },

  view: {
    title: 'View',
    fit: 'Fit to window',
    presentation: 'Presentation mode',
    autoLayout: 'Network auto-layout',
    layouts: {
      hierarchicalVertical: 'Hierarchical, vertical',
      hierarchicalHorizontal: 'Hierarchical, horizontal',
      subnetVertical: 'Grouped by subnet, vertical',
      subnetHorizontal: 'Grouped by subnet, horizontal',
    },
    autoConnect: 'Network auto-connect',
    magnify: 'Magnify',
    magnifyDevices: 'Devices',
    magnifyConnections: 'Links',
    resetMagnify: 'Reset magnification',
    animation: 'Network animation',
  },

  help: {
    title: 'Help',
    guide: 'Guide',
    commands: 'Terminal commands',
    welcome: 'Show the welcome screen',
    about: 'About',
  },

  /** The name of the open project, in the middle of the bar */
  project: {
    hint: 'Open project. Click to open the Explorer: name, boards, saving',
    unsavedChanges: 'Changes not saved to a file',
  },

  present: 'Present',
  presentHint: 'Show the drawing: ask the network a question, simulate a failure',

  lightTheme: 'Switch to light theme',
  darkTheme: 'Switch to dark theme',

  /** What an entry says when it has nothing to act on */
  notices: {
    nothingToArrange: 'No devices on the board: there is nothing to arrange.',
    needTwoToConnect: 'At least two devices are needed to connect them automatically.',
    welcomeNeedsEmptyCanvas:
      'The welcome screen only shows on an empty board. ' +
      'The drawing was not touched. To see it again, switch to an empty board or create a new one.',
    nothingToExport: 'The board is empty: there is nothing to export.',
    nothingToPresent: 'The board is empty: there is nothing to present.',
    nothingToFit: 'No devices on the board: there is nothing to bring into view.',
    selectBeforeCopy: 'Select at least one device before copying.',
    nothingToPaste: 'There is nothing to paste: copy one or more devices first.',
  },
};
