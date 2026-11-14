import type { Dictionary } from '../dictionary';

/** The board as a picture: the window, the notices, what is written in the picture */
export const exportImage: Dictionary['exportImage'] = {
  title: 'Export picture',
  previewAlt: 'Preview of the picture',

  format: {
    legend: 'Format',
    hints: {
      png: 'For documents, slides and messages.',
      svg: 'Vector: it stays sharp at any size and can be edited in a drawing program.',
    },
  },

  size: {
    legend: 'Size',
    normal: 'Normal',
    large: 'Large',
    veryLarge: 'Very large',
    /** The pixels of the PNG; `reduced` when the browser cannot make it as large as asked */
    pixels: (width: number, height: number, reduced: boolean) => {
      const size = width * height === 1 ? '1 × 1 pixel' : `${width} × ${height} pixels`;
      return reduced ? `${size} (reduced: the largest the browser can create)` : size;
    },
  },

  theme: {
    legend: 'Theme',
    light: 'Light',
    dark: 'Dark',
  },

  content: {
    legend: 'Content',
    projectName: 'Project name at the top',
    questionAndAnswer: 'Question and answer under the drawing',
    failures: 'Simulated failures under the drawing',
    transparent: 'Transparent background',
  },

  /** Shown when the picture is made from a presentation */
  presentationNote:
    'The picture shows the drawing as it is now in the presentation, with the marks of the question and of the simulated failures.',
  pngFailed: 'The browser could not create the PNG picture. Try a smaller size, or the SVG format.',

  copy: 'Copy to clipboard',
  copyHint: 'Copy the picture (PNG) to paste it into a document or a message',
  copied: 'Copied',
  preparing: 'Preparing the PNG…',
  /** Where the browser asks where to save */
  save: (format: string) => `Save ${format}…`,
  /** Where it can only download */
  download: (format: string) => `Download ${format}`,

  /** Saving and copying a picture: what the app says afterwards */
  notices: {
    copied: 'Picture copied to clipboard',
    cannotCopy: 'Could not copy the picture',
    cannotCopyDetail: 'The browser did not allow it. You can save the picture to a file.',
    downloaded: (fileName: string) => `Picture downloaded as ${fileName}`,
    cannotChooseWhere: 'Could not choose where to save the picture',
    cannotSaveTo: (fileName: string) => `Could not save to "${fileName}"`,
    tryElsewhere: 'Try again with another file or another folder.',
    saved: 'Picture saved',
  },

  /** How the file picker names each kind of file */
  fileTypes: {
    png: 'PNG picture',
    svg: 'SVG picture',
  },

  /** In the name of a file, for a picture whose project and board leave nothing to write */
  fileName: 'drawing',

  /** Written into the picture, or said of it */
  picture: {
    /** The two ends of the question asked in a presentation */
    from: 'FROM',
    to: 'TO',
    /** What a picture without a title is called (the name a screen reader gives it) */
    untitled: 'Network',
    /** A cut cable, in the caption under the drawing; `name` is its two devices or its id */
    cable: (name: string) => `cable ${name}`,
  },
};
