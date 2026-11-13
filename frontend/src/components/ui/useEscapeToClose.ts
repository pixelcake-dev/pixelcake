/**
 * Esc closes what is open on top — one thing for each press of the key.
 *
 * Whatever Esc can close (a window, a list opened inside it) is on one list
 * while it is open, in the order it was opened, and a single listener closes
 * the last entry. So a list closes before the window it is in, a window
 * before the one under it, and a press never closes two of them. A native
 * list cannot be on that list (the page is not told when it opens): a press
 * on a `<select>` is spent on it, see below.
 *
 * A press that something else has already used is left alone: whoever uses
 * Esc for itself (an edit in place that is cancelled, say) marks the event
 * with `preventDefault()`, and so does this listener when it closes
 * something, for those that hear the key after it (the presentation bar).
 */

import { useEffect, useRef } from 'react';

type Close = () => void;

/** What is open now, the one on top last */
const openLayers: Close[] = [];

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  // A key held down is still one press; a text being composed keeps its Esc
  if (event.repeat || event.isComposing) return;
  if (event.defaultPrevented) return;
  const close = openLayers[openLayers.length - 1];
  if (!close) return;
  event.preventDefault();
  // A native list (a <select>) may be open under the key, and the page has
  // no way to tell. The press goes to the list: taking the keyboard away
  // from the field closes it. The window waits for the next press, so a
  // list that is dismissed never takes the window and its edits with it
  if (event.target instanceof HTMLSelectElement) {
    event.target.blur();
    return;
  }
  close();
}

// Registered once, when the module is loaded and so before any component is
// on screen: it hears the key before the listeners that components add to
// `window`, which can then tell that the press was used
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeyDown);
}

/**
 * While `isOpen`, Esc calls `onClose` — unless something opened after it is
 * still open: that one goes first.
 */
export function useEscapeToClose(isOpen: boolean, onClose: Close): void {
  // The place on the list says what is on top: it is taken once, when the
  // thing opens, and the handler of the latest render is the one called
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const close: Close = () => latest.current();
    openLayers.push(close);
    return () => {
      const index = openLayers.indexOf(close);
      if (index !== -1) openLayers.splice(index, 1);
    };
  }, [isOpen]);
}
