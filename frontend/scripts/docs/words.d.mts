/** Types of words.mjs, for the tests that read the documentation (src/docs) */

export interface DocWords {
  /** The titles of the sample networks, as the app names them */
  samples: Record<string, string>;
  callouts: Record<string, string>;
  [word: string]: unknown;
}

export const WORDS: { en: DocWords; it: DocWords };
