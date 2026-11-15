import type { Dictionary } from '../dictionary';

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
  },
};
