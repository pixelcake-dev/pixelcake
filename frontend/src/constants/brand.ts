/**
 * The name of the application and what it is: written once here and read by
 * every place of the interface that shows them. The motto is a sentence, so
 * it is in the dictionaries (`common.brand.motto`), one for each language.
 *
 * `index.html` cannot read this file: its <title> repeats APP_TITLE by hand,
 * and a test (brand.test.tsx) fails when the two differ.
 */

/** Always written like this: one word, capital P and capital C */
export const APP_NAME = 'PixelCake';

/** What the application is, under its name */
export const APP_DESCRIPTOR = 'Visual Network Designer';

/** The title of the browser tab */
export const APP_TITLE = `${APP_NAME} - ${APP_DESCRIPTOR}`;

/**
 * The version of the application: the one of package.json, read when the app
 * is built (its `version` alone: nothing else of that file reaches the page)
 */
export const APP_VERSION: string = Object.values(
  import.meta.glob<string>('/package.json', { eager: true, import: 'version' })
)[0];
