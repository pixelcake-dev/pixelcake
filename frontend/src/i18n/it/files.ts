/** Saving and opening a project file: notices and questions */
export const files = {
  /** How the file picker names the kind of file */
  fileType: 'Progetto PixelCake',

  saved: 'Progetto salvato su file',
  downloaded: (fileName: string) => `Progetto scaricato come ${fileName}`,
  cannotChooseWhere: 'Impossibile scegliere dove salvare il file',
  cannotSaveTo: (fileName: string) => `Impossibile salvare su "${fileName}"`,
  useSaveAs: 'Usa File → Salva con nome… per scegliere un altro file.',

  cannotRead: 'Impossibile leggere il file',
  cannotOpen: (fileName: string) => `Impossibile aprire "${fileName}"`,
  opened: (projectName: string) => `Progetto "${projectName}" aperto`,
  openedWithRepairs: (projectName: string) => `Progetto "${projectName}" aperto con alcune correzioni`,
  created: (projectName: string) => `Progetto "${projectName}" creato`,

  discardChanges: {
    title: 'Continuare senza salvare?',
    detail: 'Il progetto ha modifiche non ancora salvate su file: andranno perse.',
    confirm: 'Continua senza salvare',
  },

  storageFull:
    'Spazio del browser esaurito: le ultime modifiche non sono state memorizzate. ' +
    'Salva il progetto su file (File → Salva) per non perderle.',
};
