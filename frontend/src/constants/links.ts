/**
 * External Links Constants
 * URLs for the GitHub repository and its issues, and for the site
 */

import type { Language } from '@/i18n/language';

export const GITHUB_REPO = 'https://github.com/pixelcake-dev/pixelcake';
export const GITHUB_ISSUES = `${GITHUB_REPO}/issues`;

/** The site of PixelCake, in the language the interface is in */
export function siteUrl(language: Language): string {
  return language === 'it' ? 'https://pixelcake.dev/it/' : 'https://pixelcake.dev/';
}

/**
 * The documentation, in the language the interface is in: published with the
 * app, under docs/ (docs/it/ in Italian), so the address is the app's own.
 * `page` is the path of a page in it, `terminal` for the terminal reference.
 */
export function docsUrl(language: Language, page = ''): string {
  return `${import.meta.env.BASE_URL}docs/${language === 'it' ? 'it/' : ''}${page ? `${page}/` : ''}`;
}