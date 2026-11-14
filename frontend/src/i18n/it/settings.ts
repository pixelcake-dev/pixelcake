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
    title: "Impostazioni dell'Aspetto",
    intro: 'Interfaccia chiara o scura. La scelta resta salvata in questo browser.',
    darkMode: 'Tema Scuro',
    /** The switch says which of the two is on, and what a click does */
    modeOn: (mode: 'light' | 'dark'): string =>
      mode === 'dark' ? 'Tema Scuro Attivo' : 'Tema Chiaro Attivo',
    switchTo: (mode: 'light' | 'dark'): string =>
      mode === 'dark' ? 'Clicca per passare al tema scuro' : 'Clicca per passare al tema chiaro',
    language: 'Lingua',
    languageHint: "L'interfaccia cambia subito. La scelta resta salvata in questo browser.",
  },
};
