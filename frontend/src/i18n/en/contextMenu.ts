import type { Dictionary } from '../dictionary';

/** The menus a right click opens on the board */
export const contextMenu: Dictionary['contextMenu'] = {
  device: {
    details: 'Details (edit)',
    console: 'Console',
    enclose: 'Enclose in an area',
    deleteQuestion: {
      title: (name: string) => `Delete “${name}”?`,
      detail: 'Its links are removed with the device.',
    },
  },

  connection: {
    edit: 'Edit link',
    delete: 'Delete link',
    deleteQuestion: {
      title: 'Delete this link?',
    },
  },

  area: {
    rename: 'Rename',
    colourGroup: 'Colour of the area',
    colour: 'Colour',
    /** The colours of the palette, in its order */
    colours: {
      slate: 'Slate',
      green: 'Green',
      amber: 'Ochre',
      red: 'Red',
      violet: 'Purple',
      teal: 'Teal',
    },
    deleteQuestion: {
      /** `name` is empty for an area without a name */
      title: (name: string) => (name ? `Delete the area “${name}”?` : 'Delete the area?'),
      detail: 'The devices it is drawn around stay where they are.',
    },
  },
};
