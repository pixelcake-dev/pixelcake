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
