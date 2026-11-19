/** The first steps of a visitor: the guided tour, and the first question of a sample */
export const guide = {
  tour: {
    /** Its name: on the balloon, and the entry of the Aiuto menu that takes it again */
    name: 'Tour guidato',
    /** Which step, and the number of the last one */
    counter: (step: number, last: number) => `${step} di ${last}`,
    back: 'Indietro',
    next: 'Avanti',
    done: 'Fine',
    skip: 'Salta',
    /** Under the last step */
    again: 'Il tour si riapre dal menu Aiuto.',
    /** One sentence or two for each step, beside the part of the screen it names */
    steps: {
      addDevice: {
        title: 'Aggiungi un dispositivo',
        text: 'Scegli un PC, uno switch, un router o un server: compare nel primo posto libero del canvas.',
      },
      cable: {
        title: 'Collega con un cavo',
        text: 'Trascina dal bordo di un dispositivo fino a un altro: il cavo prende una porta libera a ogni capo.',
      },
      ask: {
        title: 'Fai una domanda',
        text: 'Questo PC raggiunge quel server? Scegli partenza e destinazione: il pacchetto attraversa la rete passo dopo passo e, se si ferma, dice perché.',
      },
      terminal: {
        title: 'Il terminale',
        text: 'Le stesse domande, scritte: ping, trace, show. Comandi in parole semplici, uguali per ogni dispositivo.',
      },
      undo: {
        title: 'Annulla e ripeti',
        /** The keys as the Edit menu shows them (Ctrl+Z, or ⌘Z on a Mac) */
        text: (undo: string, redo: string) =>
          `Ogni modifica del disegno si annulla con ${undo} e si ripete con ${redo}. Li trovi anche nel menu Modifica.`,
      },
      save: {
        title: 'Salva il progetto',
        text: 'File → Salva scrive il progetto in un file sul tuo computer. Non va su nessun server.',
      },
      marker: {
        title: 'Il pennarello',
        text: 'Scrivi a mano sopra il disegno, come su una lavagna: parole, frecce, cerchi. Si prende anche con il tasto P.',
      },
      present: {
        title: 'Presenta',
        text: "Mostra la rete a chi ascolta: rompi un dispositivo o taglia un cavo e guarda cosa cambia. Il disegno resta com'è.",
      },
    },
  },

  /** The first question of the sample just loaded, suggested once */
  firstTry: {
    title: 'Una prima domanda',
    /** The two devices are named as they are on the board */
    question: (from: string, to: string) => `${from} raggiunge ${to}? Chiedilo al terminale:`,
    run: 'Prova nel terminale',
    close: 'Chiudi il suggerimento',
  },
};
