/**
 * Bundled icons
 * The icons the app uses are shipped with it (src/data/bundledIcons.ts), so
 * they render without a request to the Iconify API. Every icon name is
 * written in the source, and a test holds that each is in the bundle: none
 * is looked up online. (The devices are not drawn with these icons: their
 * drawings are the app's own, see components/ui/DeviceDrawing.tsx.)
 */

import { addCollection } from '@iconify/react';
import { BUNDLED_ICON_COLLECTIONS } from '@/data/bundledIcons';

/** Register the shipped icons. Safe to call more than once. */
export function registerBundledIcons(): void {
  for (const collection of BUNDLED_ICON_COLLECTIONS) {
    addCollection(collection);
  }
}
