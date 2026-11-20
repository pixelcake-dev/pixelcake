import type { Dictionary } from '../dictionary';

/** The first steps of a visitor: the guided tour, and the first question of a sample */
export const guide: Dictionary['guide'] = {
  tour: {
    name: 'Guided tour',
    counter: (step: number, last: number) => `${step} of ${last}`,
    back: 'Back',
    next: 'Next',
    done: 'Done',
    skip: 'Skip',
    again: 'The tour opens again from the Help menu.',
    steps: {
      addDevice: {
        title: 'Add a device',
        text: 'Pick a PC, a switch, a router or a server: it appears in the first free place on the board.',
      },
      cable: {
        title: 'Join them with a cable',
        text: 'Drag from the edge of one device to another: the cable takes a free port at each end.',
      },
      ask: {
        title: 'Ask a question',
        text: 'Does this PC reach that server? Choose the source and the destination: the packet travels hop by hop and, if it stops, says why.',
      },
      terminal: {
        title: 'The terminal',
        text: 'The same questions, typed: ping, trace, show. Plain words, the same for every device.',
      },
      undo: {
        title: 'Undo and redo',
        text: (undo: string, redo: string) =>
          `Every change to the drawing is undone with ${undo} and made again with ${redo}. The Edit menu has both too.`,
      },
      save: {
        title: 'Save the project',
        text: 'File → Save writes the project to a file on your computer. It goes to no server.',
      },
      marker: {
        title: 'Annotation mode',
        text: 'Write by hand over the drawing: words, arrows, circles. Annotations show only while the mode is on (A key).',
      },
      present: {
        title: 'Present',
        text: 'Show the network to an audience: break a device or cut a cable and see what changes. The drawing stays as it is.',
      },
    },
  },

  firstTry: {
    title: 'A first question',
    question: (from: string, to: string) => `Does ${from} reach ${to}? Ask the terminal:`,
    run: 'Try it in the terminal',
    close: 'Close the suggestion',
  },
};
