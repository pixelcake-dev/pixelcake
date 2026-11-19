/**
 * The handwriting of the marker, for the exported image. A picture shown as
 * an image cannot use the fonts of the page: it carries the font in itself,
 * as a `data:` address. The file is the one the app bundles (Caveat, its
 * Latin letters, the weight the marker writes with), read from the app
 * itself once, when an image with words is made.
 */

import fontUrl from '@fontsource/caveat/files/caveat-latin-600-normal.woff2?url';

let loading: Promise<string | null> | null = null;

/** The font as a `data:` address, or null when it cannot be read (the image then writes with what the computer has) */
export function loadHandFont(): Promise<string | null> {
  loading ??= readFont().catch(() => null);
  return loading;
}

async function readFont(): Promise<string | null> {
  const response = await fetch(fontUrl);
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  // (in slices: one call with every byte would be too many arguments)
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return `data:font/woff2;base64,${btoa(binary)}`;
}
