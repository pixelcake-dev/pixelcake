/**
 * What the app bundles from others besides the icon sets (which are in
 * data/bundledIcons.ts): the typefaces of the interface, the two of its
 * text and the handwriting of the marker («Pennarello»). The text of
 * each licence is in public/licenses/ and travels with the built app;
 * `pnpm licenses:fonts` (scripts/font-licenses.mjs) writes it from the
 * package the typeface comes from, and a test holds the two together.
 */

export interface BundledFont {
  name: string;
  /** The copyright notice, as the project of the typeface writes it */
  notice: string;
  license: string;
  /** The text of its licence, from the root of the app */
  file: string;
}

export const BUNDLED_FONTS: readonly BundledFont[] = [
  {
    name: 'Inter',
    notice: 'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)',
    license: 'SIL OFL 1.1',
    file: 'licenses/inter.txt',
  },
  {
    name: 'JetBrains Mono',
    notice: 'Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)',
    license: 'SIL OFL 1.1',
    file: 'licenses/jetbrains-mono.txt',
  },
  {
    name: 'Caveat',
    notice: 'Copyright 2014 The Caveat Project Authors (https://github.com/googlefonts/caveat)',
    license: 'SIL OFL 1.1',
    file: 'licenses/caveat.txt',
  },
];
