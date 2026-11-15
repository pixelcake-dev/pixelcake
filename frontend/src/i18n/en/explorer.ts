import type { Dictionary } from '../dictionary';

/** The Explorer panel: the project and its boards */

const devices = (count: number) => (count === 1 ? '1 device' : `${count} devices`);

export const explorer: Dictionary['explorer'] = {
  devices,

  projectName: 'Project name',
  renameProject: 'Rename project',
  projectDescription: 'Project description',
  descriptionPlaceholder: 'Description…',
  editDescription: 'Edit description',
  addDescription: 'Add a description…',
  unsavedChanges: 'Changes not saved to a file',

  heading: 'Boards',
  canvasName: (name: string) => `Name of the board ${name}`,
  renameCanvas: 'Rename board',
  renameCanvasNamed: (name: string) => `Rename board ${name}`,
  deleteCanvas: 'Delete board',
  deleteCanvasNamed: (name: string) => `Delete board ${name}`,
  deleteCanvasQuestion: {
    title: (name: string) => `Delete the board “${name}”?`,
    detail: (count: number) => `It contains ${devices(count)}, which will be lost.`,
  },

  newCanvas: 'New board',
  newCanvasPlaceholder: 'Board name…',
  newCanvasName: 'New board name',
  createCanvas: 'Create board',
  cancelNewCanvas: 'Cancel new board',

  saveToFile: 'Save to file',
  openFile: 'Open file…',
};
