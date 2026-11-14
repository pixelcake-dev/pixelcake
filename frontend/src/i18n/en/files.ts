import type { Dictionary } from '../dictionary';

/** Saving and opening a project file: notices and questions */
export const files: Dictionary['files'] = {
  /** How the file picker names the kind of file */
  fileType: 'PixelCake project',

  saved: 'Project saved to a file',
  downloaded: (fileName: string) => `Project downloaded as ${fileName}`,
  cannotChooseWhere: 'Could not open the save dialog',
  cannotSaveTo: (fileName: string) => `Could not save to “${fileName}”`,
  useSaveAs: 'Use File → Save as… to choose another file.',

  cannotRead: 'Could not read the file',
  cannotOpen: (fileName: string) => `Could not open “${fileName}”`,
  opened: (projectName: string) => `Project “${projectName}” opened`,
  openedWithRepairs: (projectName: string) => `Project “${projectName}” opened with some repairs`,
  created: (projectName: string) => `Project “${projectName}” created`,

  discardChanges: {
    title: 'Continue without saving?',
    detail: 'The project has changes not yet saved to a file: they will be lost.',
    confirm: 'Continue without saving',
  },

  storageFull:
    'Browser storage is full: your latest changes were not saved there. Save the project to a ' +
    'file (File → Save) so that you do not lose them.',
};
