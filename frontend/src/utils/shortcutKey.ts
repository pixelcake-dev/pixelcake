/**
 * The letter of a keyboard shortcut made with Ctrl (Cmd on a Mac): Ctrl+C,
 * Ctrl+V, Ctrl+S.
 *
 * `event.key` is what the key writes: a capital letter with Caps Lock on, a
 * letter of another alphabet on a keyboard that is not Latin. The shortcut is
 * the same key all the same, so the letter is read in lower case, and from
 * the place of the key (`event.code`, KeyC) when what it writes is not a
 * Latin letter. With Shift or Alt it is another shortcut, which belongs to
 * the browser (Ctrl+Shift+V pastes plain text): there is no letter then.
 */
export function shortcutLetter(event: KeyboardEvent): string | null {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return null;
  if (/^[a-z]$/i.test(event.key)) return event.key.toLowerCase();
  const place = /^Key([A-Z])$/.exec(event.code ?? '');
  return place ? place[1].toLowerCase() : null;
}
