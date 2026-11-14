/** Small shared controls: search, pickers, the question window */
export const ui = {
  /** The X that closes a window, for who cannot see it */
  closeWindow: 'Chiudi la finestra',
  /** The X that empties a search field, for who cannot see it */
  clearSearch: 'Cancella la ricerca',

  /** What the logo is, for who cannot see it: with the name, or the symbol alone */
  logo: {
    withName: (appName: string) => `Logo di ${appName}`,
    symbol: (appName: string) => `Simbolo di ${appName}`,
  },

  iconPicker: {
    placeholder: "Seleziona un'icona",
    search: 'Cerca icone…',
    noResults: 'Nessuna icona trovata',
  },

  /** The list one searches in to choose an entry */
  searchableSelect: {
    placeholder: 'Seleziona…',
    noResults: 'Nessun risultato trovato',
  },
};
