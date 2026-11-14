import type { Dictionary } from '../dictionary';

/** Small shared controls: search, pickers, the question window */
export const ui: Dictionary['ui'] = {
  /** The X that closes a window, for who cannot see it */
  closeWindow: 'Close window',
  /** The X that empties a search field, for who cannot see it */
  clearSearch: 'Clear search',

  /** What the logo is, for who cannot see it: with the name, or the symbol alone */
  logo: {
    withName: (appName: string) => `${appName} logo`,
    symbol: (appName: string) => `${appName} symbol`,
  },

  iconPicker: {
    placeholder: 'Select an icon',
    search: 'Search icons...',
    noResults: 'No icons found',
  },

  /** The list one searches in to choose an entry */
  searchableSelect: {
    placeholder: 'Select...',
    noResults: 'No results found',
  },
};
