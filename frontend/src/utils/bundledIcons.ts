/**
 * Bundled icons
 * The icons the app uses are shipped with it (src/data/bundledIcons.ts), so
 * they render without a request to the Iconify API. An icon outside that
 * list (a custom template with a hand-typed icon name) is still looked up
 * online by the Icon component.
 */

import { addCollection } from '@iconify/react';
import { BUNDLED_ICON_COLLECTIONS } from '@/data/bundledIcons';

/** Register the shipped icons. Safe to call more than once. */
export function registerBundledIcons(): void {
  for (const collection of BUNDLED_ICON_COLLECTIONS) {
    addCollection(collection);
  }
}
