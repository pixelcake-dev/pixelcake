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
    intro: 'Light or dark interface. Your choice is saved in this browser.',
    darkMode: 'Dark theme',
    /** The switch says which of the two is on, and what a click does */
    modeOn: (mode: 'light' | 'dark'): string => (mode === 'dark' ? 'Dark theme on' : 'Light theme on'),
    switchTo: (mode: 'light' | 'dark'): string =>
      mode === 'dark' ? 'Click to switch to the dark theme' : 'Click to switch to the light theme',
    language: 'Language',
    languageHint: 'The interface changes at once. Your choice is saved in this browser.',
  },
};
