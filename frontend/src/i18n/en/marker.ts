import type { Dictionary } from '../dictionary';

import { formatCount } from '../numbers';

const amount = (value: number) => formatCount('en', value);

/** Annotation mode: writing and drawing by hand on the board; what is written is the annotations */
export const marker: Dictionary['marker'] = {
  name: 'Annotation mode',
  nameCount: (count) =>
    `Annotation mode, ${count === 1 ? '1 annotation hidden' : `${amount(count)} annotations hidden`}`,
  hint: 'Annotation mode: write and draw by hand on the board (A)',
  hintHidden: (count) =>
    `Annotation mode (A): ${count === 1 ? '1 annotation hidden' : `${amount(count)} annotations hidden`}`,
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
  clearHint: 'Clear every annotation on this board',
  close: 'Leave annotation mode',
  notInImage: 'Annotations are not in the image: annotation mode is off.',
  clearQuestion: {
    title: 'Clear every annotation on the board?',
    detail: 'Every annotation written by hand on this board goes. Devices, cables and areas stay.',
    confirm: 'Clear',
  },
  text: {
    label: 'Words to write on the board',
    placeholder: 'Type, then Enter',
  },
};
