/** Small shared controls: search, pickers, the question window */
export const ui = {
  /** The X that closes a window, for who cannot see it */
  closeWindow: 'Close modal',
  /** The X that empties a search field, for who cannot see it */
  clearSearch: 'Clear search',

  /** What the logo is, for who cannot see it: with the name, or the symbol alone */
  logo: {
    withName: (appName: string) => `${appName} Logo`,
    symbol: (appName: string) => `${appName} Icon`,
  },

  iconPicker: {
    placeholder: 'Select icon',
    search: 'Cerca icone...',
    noResults: 'Nessuna icona trovata',
  },

  /** The list one searches in to choose an entry */
  searchableSelect: {
    placeholder: 'Seleziona...',
    noResults: 'Nessun risultato trovato',
  },
};
