/**
 * The language of the interface: which one it is, how it is chosen at
 * start-up, where the choice is kept.
 *
 * At start-up, in this order:
 *   1. `?lang=it` or `?lang=en` in the address: it is taken, remembered, and
 *      removed from the address (so that a later choice made with the switch
 *      is not undone by a reload);
 *   2. the choice remembered in this browser;
 *   3. the languages of the browser, in the order the user prefers them: the
 *      first one the interface speaks. English when it speaks none of them.
 *
 * Only a choice is remembered (the switch, the address): a language that was
 * detected is detected again at the next visit.
 */

import { create } from 'zustand';

export type Language = 'it' | 'en';

/** The languages of the interface, in the order the switch shows them */
export const LANGUAGES: readonly Language[] = ['it', 'en'];

/** Each language is named in itself, whatever the language of the interface */
export const LANGUAGE_NAMES: Record<Language, string> = { it: 'Italiano', en: 'English' };

/** The language of a visitor whose browser speaks none of ours */
export const FALLBACK_LANGUAGE: Language = 'en';

/** Where the choice is kept (localStorage): `it` or `en` */
export const LANGUAGE_KEY = 'pixelcake-language';

/** The parameter of the address that chooses the language: `?lang=en` */
export const LANGUAGE_PARAMETER = 'lang';

function asLanguage(value: string | null | undefined): Language | null {
  if (!value) return null;
  // `it`, `IT`, `it-IT`, `it_CH`… are all Italian
  const code = value.trim().toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.find((language) => language === code) ?? null;
}

function remember(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Storage full or refused (private window): the choice lasts for this visit
  }
}

function remembered(): Language | null {
  try {
    return asLanguage(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return null;
  }
}

/** `?lang=` of the address, taken out of it once read */
function fromAddress(): Language | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(LANGUAGE_PARAMETER)) return null;
  const language = asLanguage(url.searchParams.get(LANGUAGE_PARAMETER));
  url.searchParams.delete(LANGUAGE_PARAMETER);
  try {
    window.history.replaceState(window.history.state, '', url);
  } catch {
    // The address stays as it was: the parameter is read again at a reload
  }
  return language;
}

/** The first language of the browser that the interface speaks */
export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return FALLBACK_LANGUAGE;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const language = asLanguage(tag);
    if (language) return language;
  }
  return FALLBACK_LANGUAGE;
}

function startLanguage(): Language {
  const asked = fromAddress();
  if (asked) {
    remember(asked);
    return asked;
  }
  return remembered() ?? detectLanguage();
}

/** `<html lang>` says which language the page is in: screen readers read with it */
function tellThePage(language: Language): void {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

interface LanguageState {
  language: Language;
}

export const useLanguageStore = create<LanguageState>(() => ({ language: startLanguage() }));

tellThePage(useLanguageStore.getState().language);

/** The language of the interface right now (for code outside React) */
export function getLanguage(): Language {
  return useLanguageStore.getState().language;
}

/** The language of the interface; the component is drawn again when it changes */
export function useLanguage(): Language {
  return useLanguageStore((state) => state.language);
}

/** Choose the language: the whole interface follows at once, and the choice is remembered */
export function setLanguage(language: Language): void {
  remember(language);
  tellThePage(language);
  useLanguageStore.setState({ language });
}
