/** The board as a picture: the window, the notices, what is written in the picture */
export const exportImage = {
  title: 'Esporta immagine',
  previewAlt: "Anteprima dell'immagine",

  format: {
    legend: 'Formato',
    hints: {
      png: 'Per documenti, presentazioni e messaggi.',
      svg: 'Vettoriale: si ingrandisce senza sgranare e si può ritoccare con un programma di disegno.',
    },
  },

  size: {
    legend: 'Dimensione',
    normal: 'Normale',
    large: 'Grande',
    veryLarge: 'Molto grande',
    /** The pixels of the PNG; `reduced` when the browser cannot make it as large as asked */
    pixels: (width: number, height: number, reduced: boolean) => {
      const size = `${width} × ${height} pixel`;
      return reduced ? `${size} (ridotta: è il massimo che il browser riesce a creare)` : size;
    },
  },

  theme: {
    legend: 'Tema',
    light: 'Chiaro',
    dark: 'Scuro',
  },

  content: {
    legend: 'Contenuto',
    projectName: 'Nome del progetto in alto',
    questionAndAnswer: 'Domanda e risposta sotto il disegno',
    failures: 'Guasti simulati sotto il disegno',
    transparent: 'Sfondo trasparente',
  },

  /** Shown when the picture is made from a presentation */
  presentationNote:
    "L'immagine mostra il disegno com'è ora nella presentazione, con i segni della domanda e dei guasti simulati.",
  pngFailed:
    "Il browser non è riuscito a creare l'immagine PNG. Prova una dimensione più piccola, oppure il formato SVG.",

  copy: 'Copia negli appunti',
  copyHint: "Copia l'immagine (PNG) per incollarla in un documento o in un messaggio",
  copied: 'Copiata',
  preparing: 'Preparo il PNG…',
  /** While the effect of the failures, written under the picture, is being worked out */
  waitingForEffect: "Calcolo l'effetto dei guasti…",
  /** Where the browser asks where to save */
  save: (format: string) => `Salva ${format}…`,
  /** Where it can only download */
  download: (format: string) => `Scarica ${format}`,

  /** Saving and copying a picture: what the app says afterwards */
  notices: {
    copied: 'Immagine copiata negli appunti',
    cannotCopy: "Impossibile copiare l'immagine",
    cannotCopyDetail: 'Il browser non lo ha permesso. Puoi salvarla su file.',
    downloaded: (fileName: string) => `Immagine scaricata come ${fileName}`,
    cannotChooseWhere: 'Impossibile aprire la finestra di salvataggio',
    cannotSaveTo: (fileName: string) => `Impossibile salvare su «${fileName}»`,
    tryElsewhere: "Riprova scegliendo un altro file o un'altra cartella.",
    saved: 'Immagine salvata',
  },

  /** How the file picker names each kind of file */
  fileTypes: {
    png: 'Immagine PNG',
    svg: 'Immagine SVG',
  },

  /** In the name of a file, for a picture whose project and canvas leave nothing to write */
  fileName: 'disegno',

  /** Written into the picture, or said of it */
  picture: {
    /** The two ends of the question asked in a presentation */
    from: 'DA',
    to: 'A',
    /** What a picture without a title is called (the name a screen reader gives it) */
    untitled: 'Rete',
    /** A cut cable, in the caption under the drawing; `name` is its two devices or its id */
    cable: (name: string) => `cavo ${name}`,
  },
};
