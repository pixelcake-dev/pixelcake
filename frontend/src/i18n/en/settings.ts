import type { Dictionary } from '../dictionary';

/** The settings window: its frame and the appearance tab */
export const settings: Dictionary['settings'] = {
  title: 'Settings',

  tabs: {
    network: 'Network',
    appearance: 'Appearance',
    templates: 'Templates',
    advanced: 'Advanced',
  },

  appearance: {
    title: 'Appearance settings',
    intro: 'Light or dark interface. The choice is kept in this browser.',
    darkMode: 'Dark mode',
    /** The switch says which of the two is on, and what a click does */
    modeOn: (mode: 'light' | 'dark'): string => (mode === 'dark' ? 'Dark mode on' : 'Light mode on'),
    switchTo: (mode: 'light' | 'dark'): string =>
      mode === 'dark' ? 'Click to switch to dark mode' : 'Click to switch to light mode',
    language: 'Language',
    languageHint: 'The interface changes at once. The choice is kept in this browser.',
  },
};
