/**
 * The name of the application, what it is, and its motto: written once here
 * and read by every place of the interface that shows them.
 *
 * `index.html` cannot read this file: its <title> repeats APP_TITLE by hand,
 * and a test (brand.test.tsx) fails when the two differ.
 */

/** Always written like this: one word, capital P and capital C */
export const APP_NAME = 'PixelCake';

/** What the application is, under its name */
export const APP_DESCRIPTOR = 'Visual Network Designer';

/** The motto, in the language of the interface (README.md keeps the English one) */
export const APP_MOTTO = 'Una rete, un pezzo alla volta';

/** The title of the browser tab */
export const APP_TITLE = `${APP_NAME} - ${APP_DESCRIPTOR}`;
