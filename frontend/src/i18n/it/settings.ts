/** The settings window: its frame and the appearance tab */
export const settings = {
  title: 'Impostazioni',

  tabs: {
    network: 'Rete',
    appearance: 'Aspetto',
    templates: 'Template',
    advanced: 'Avanzate',
  },

  appearance: {
    title: 'Impostazioni Aspetto',
    intro: 'Interfaccia chiara o scura. La scelta resta salvata in questo browser.',
    darkMode: 'Modalità Scura',
    /** The switch says which of the two is on, and what a click does */
    modeOn: (mode: 'light' | 'dark'): string =>
      mode === 'dark' ? 'Modalità Scura Attiva' : 'Modalità Chiara Attiva',
    switchTo: (mode: 'light' | 'dark'): string =>
      mode === 'dark' ? 'Clicca per passare alla modalità scura' : 'Clicca per passare alla modalità chiara',
    language: 'Lingua',
    languageHint: "L'interfaccia cambia subito. La scelta resta salvata in questo browser.",
  },
};
