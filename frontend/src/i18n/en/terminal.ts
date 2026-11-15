import type { Dictionary } from '../dictionary';

/** The window around the terminal (the terminal itself speaks English) */
export const terminal: Dictionary['terminal'] = {
  /** The name of the window: written on its bar, and what a screen reader calls it */
  title: 'Terminal',
  close: 'Close the terminal',
  /** What a screen reader calls the two parts of the terminal */
  output: 'Terminal output',
  input: 'Terminal input',
};
