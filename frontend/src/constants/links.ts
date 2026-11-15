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