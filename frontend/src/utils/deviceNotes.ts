/**
 * The note of a device: free text, of as many lines as it takes, written in
 * its window and shown when the pointer rests on the device.
 *
 * Pure: no React, no stores.
 */

/** How long a note can be typed */
export const NOTES_MAX_LENGTH = 2000;

/**
 * A note as a device keeps it: line ends made one kind, nothing around it,
 * and no note at all (undefined) when nothing is left. What is not text is
 * no note.
 */
export function tidyNotes(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.replace(/\r\n?/g, '\n').trim();
  return text === '' ? undefined : text;
}
