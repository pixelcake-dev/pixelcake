/** The Explorer panel: the project and its canvases */

const devices = (count: number) => (count === 1 ? '1 dispositivo' : `${count} dispositivi`);

export const explorer = {
  devices,

  projectName: 'Nome del progetto',
  renameProject: 'Rinomina progetto',
  projectDescription: 'Descrizione del progetto',
  descriptionPlaceholder: 'Descrizione…',
  editDescription: 'Modifica descrizione',
  addDescription: 'Aggiungi una descrizione…',
  unsavedChanges: 'Modifiche non salvate su file',

  heading: 'Canvas',
  canvasName: (name: string) => `Nome del canvas ${name}`,
  renameCanvas: 'Rinomina canvas',
  renameCanvasNamed: (name: string) => `Rinomina canvas ${name}`,
  deleteCanvas: 'Elimina canvas',
  deleteCanvasNamed: (name: string) => `Elimina canvas ${name}`,
  deleteCanvasQuestion: {
    title: (name: string) => `Eliminare il canvas «${name}»?`,
    detail: (count: number) => `Contiene ${devices(count)}: il suo contenuto andrà perso.`,
  },

  newCanvas: 'Nuovo canvas',
  newCanvasPlaceholder: 'Nome del canvas…',
  newCanvasName: 'Nome del nuovo canvas',
  createCanvas: 'Crea canvas',
  cancelNewCanvas: 'Annulla nuovo canvas',

  saveToFile: 'Salva su file',
  openFile: 'Apri file…',
};
