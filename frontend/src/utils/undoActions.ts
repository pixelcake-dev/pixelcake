/**
 * Undo and redo from the keyboard, and the presses of the pointer that make
 * a drag one step (store/historyStore.ts keeps the history).
 *
 * Ctrl+Z undoes; Ctrl+Y and Ctrl+Shift+Z redo; Cmd on a Mac. The letter is
 * read whatever Caps Lock and the layout of the keyboard say
 * (utils/shortcutKey). While a field has the keyboard (a text field, a text
 * area, the line of the terminal) the keys are the browser's: they undo the
 * text. Nothing happens while presenting, nor while a window or a question
 * is open over the board; the terminal floats beside it, and is not one.
 */

import { beginGesture, endGesture, redo, undo } from '@/store/historyStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useConfirmStore } from '@/store/confirmStore';
import { useUIStore } from '@/store/uiStore';
import { isApple, shortcutLetter } from './shortcutKey';

/** The keys of undo and redo as the Edit menu shows them, beside its entries */
export function undoKeys(): { undo: string; redo: string } {
  return isApple() ? { undo: '⌘Z', redo: '⇧⌘Z' } : { undo: 'Ctrl+Z', redo: 'Ctrl+Y' };
}

/** True when a key pressed there is for the text being typed */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** A window open over the board, or a question: the keys are theirs */
function windowOpen(): boolean {
  if (useConfirmStore.getState().pending) return true;
  const { codeTerminal, ...windows } = useUIStore.getState().modals;
  void codeTerminal;
  return Object.values(windows).some(Boolean);
}

/** Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, and the presses of the pointer, anywhere in the app; returns the cleanup */
export function registerUndoShortcuts(): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const letter = shortcutLetter(event, { withShift: true });
    const action =
      letter === 'z' ? (event.shiftKey ? redo : undo) : letter === 'y' && !event.shiftKey ? redo : null;
    if (!action) return;
    if (isTyping(event.target)) return;
    if (usePresentationStore.getState().active || windowOpen()) return;
    // (never the browser's own: there is no text to undo on the board)
    event.preventDefault();
    action();
  };

  // A press of the pointer, anywhere: what the drawing is given until it is
  // let go is one step. Taken before anything else hears the press
  const onPress = (event: PointerEvent) => beginGesture(event.pointerId ?? 0);
  const onRelease = (event: PointerEvent) => endGesture(event.pointerId ?? 0);
  // (the page lost the focus with the button held: the release may never come)
  const onLeave = () => endGesture();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pointerdown', onPress, true);
  window.addEventListener('pointerup', onRelease, true);
  window.addEventListener('pointercancel', onRelease, true);
  window.addEventListener('blur', onLeave);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pointerdown', onPress, true);
    window.removeEventListener('pointerup', onRelease, true);
    window.removeEventListener('pointercancel', onRelease, true);
    window.removeEventListener('blur', onLeave);
  };
}
