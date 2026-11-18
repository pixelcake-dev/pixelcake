import type { Dictionary } from '../dictionary';
import { formatCount } from '../numbers';

const amount = (value: number) => formatCount('en', value);

/** The menu bar */
export const menu: Dictionary['menu'] = {
  file: {
    title: 'File',
    newProject: 'New project…',
    open: 'Open…',
    save: 'Save',
    saveAs: 'Save as…',
    exportPicture: 'Export image…',
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
    autoLayout: 'Auto-layout',
    /** From where the traffic leaves the network down (vertical) or across (horizontal) */
    layouts: {
      vertical: 'Vertical',
      horizontal: 'Horizontal',
    },
    /** A cable for each device that has none, and nothing else */
    autoConnect: 'Connect devices with no cable',
    magnify: 'Magnify',
    magnifyDevices: 'Devices',
    magnifyConnections: 'Links',
    resetMagnify: 'Reset magnification',
    animation: 'Animation',
    /** The areas drawn behind the devices, shown or hidden: a preference of this browser */
    areas: 'Show areas',
  },

  help: {
    title: 'Help',
    guide: 'Guide',
    docs: 'Documentation',
    commands: 'Terminal commands',
    welcome: 'Show the welcome screen',
    about: 'About',
    site: 'The PixelCake website',
  },

  /** The name of the open project, in the middle of the bar */
  project: {
    hint: 'Current project. Click to open the Explorer: name, boards, saving',
    unsavedChanges: 'Changes not saved to a file',
  },

  present: 'Present',
  presentHint: 'Show the drawing: ask the network a question, simulate a failure',

  lightTheme: 'Switch to light theme',
  darkTheme: 'Switch to dark theme',

  /** Asked before the automatic layout: it moves every device, and cannot be undone */
  layoutQuestion: {
    title: 'Lay the drawing out again?',
    detail: 'Every device will be moved, and the areas drawn again around their devices. This cannot be undone.',
    confirm: 'Lay out',
  },

  /** Said after View → Connect devices with no cable */
  connectNotice: {
    added: (count: number) => (count === 1 ? '1 cable added' : `${amount(count)} cables added`),
    noneAdded: 'No cable added',
    allCabled: 'Every device already has its cable',
    /** Why a device was left with no cable: after its name, “PC-7: …” */
    reasons: {
      noSwitch: 'no switch on the same network',
      noUplink: 'no router, firewall or core switch on the same network',
      noFreePort: 'no free port',
      loop: 'another cable would close a loop',
      byHand: 'routers, firewalls and the Internet are cabled by hand',
    },
    /** After the first three names of a list of five or more */
    more: (count: number) => `and ${amount(count)} more`,
  },

  /** What an entry says when it has nothing to act on */
  notices: {
    nothingToArrange: 'No devices on the board: there is nothing to arrange',
    needTwoToConnect: 'At least two devices are needed to connect them',
    welcomeNeedsEmptyCanvas:
      'The welcome screen only shows on an empty board. The drawing has not been changed. To see ' +
      'it again, switch to an empty board or create a new one.',
    nothingToExport: 'The board is empty: there is nothing to export',
    nothingToPresent: 'The board is empty: there is nothing to present',
    nothingToFit: 'No devices on the board: there is nothing to bring into view',
    selectBeforeCopy: 'Select at least one device or area before copying',
    nothingToPaste: 'There is nothing to paste: copy devices or areas first',
  },
};
