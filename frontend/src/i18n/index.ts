/**
 * The words of the interface, in the language the user chose.
 *
 *   const t = useT();            // in a component: drawn again when the language changes
 *   <button>{t.common.actions.save}</button>
 *
 *   toast.success(getT().files.saved);   // outside React: read at the moment of the call
 *
 * A text that carries a value is a function (`t.explorer.devices(3)`), so
 * plurals and the order of the words are plain TypeScript in each language.
 * Never keep a text in a constant of a module: it would stay in the language
 * the page was loaded in.
 */

import { it } from './it';
import { en } from './en';
import type { Dictionary } from './dictionary';
import { getLanguage, useLanguage, type Language } from './language';

export type { Dictionary } from './dictionary';
export {
  LANGUAGES,
  LANGUAGE_KEY,
  LANGUAGE_NAMES,
  getLanguage,
  setLanguage,
  useLanguage,
  type Language,
} from './language';

const DICTIONARIES: Record<Language, Dictionary> = { it, en };

/** The dictionary of a language (for tests and for whoever needs both) */
export function dictionaryOf(language: Language): Dictionary {
  return DICTIONARIES[language];
}

/** The words of the interface right now, for code outside React */
export function getT(): Dictionary {
  return DICTIONARIES[getLanguage()];
}

/** The words of the interface; the component is drawn again when the language changes */
export function useT(): Dictionary {
  return DICTIONARIES[useLanguage()];
}
