import type { Dictionary } from '../dictionary';

/** The marker: writing and drawing by hand on the board */
export const marker: Dictionary['marker'] = {
  name: 'Marker',
  hint: 'Marker: write and draw by hand on the board (P)',
  groups: {
    tool: 'Tool',
    colour: 'Colour',
    width: 'Thickness',
  },
  tools: {
    pen: 'Pen',
    text: 'Text',
    arrow: 'Arrow',
    ellipse: 'Circle',
    tick: 'Tick',
    cross: 'Cross',
    eraser: 'Eraser',
  },
  colours: {
    accent: 'Orange',
    red: 'Red',
    green: 'Green',
    ink: 'Ink',
  },
  widths: {
    thin: 'Thin',
    thick: 'Thick',
  },
  clear: 'Clear all',
  clearHint: 'Clear everything written on this board',
  close: 'Close the marker',
  presenting: 'Only for this presentation',
  presentingHint: 'What you write now does not change the board, and is gone when you leave the presentation',
  clearPresenterHint: 'Clear what you wrote during the presentation',
  clearQuestion: {
    title: 'Clear everything written on the board?',
    detail: 'Every mark of the marker on this board goes. Devices, cables and areas stay.',
    confirm: 'Clear',
  },
  text: {
    label: 'Words to write on the board',
    placeholder: 'Type, then Enter',
  },
};
