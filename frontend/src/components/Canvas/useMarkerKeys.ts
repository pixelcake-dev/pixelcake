/**
 * The keys of the marker («Pennarello»): P takes it up and puts it away,
 * while building and while presenting; Esc puts it away. Not while a field
 * is typed in, not while a window is open over the board (the terminal
 * floats beside it and is not one), not with Ctrl, Cmd, Alt or Shift.
 *
 * A press of Esc that puts the marker away is marked as used: the
 * presentation is left only at the next one.
 */

import { useEffect } from 'react';
import { useMarkerStore } from '@/store/markerStore';
import { useConfirmStore } from '@/store/confirmStore';
import { useUIStore } from '@/store/uiStore';
import { plainLetter } from '@/utils/shortcutKey';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** True while a window is open over the board, the question included */
function windowOpen(): boolean {
  if (useConfirmStore.getState().pending) return true;
  const { codeTerminal, ...windows } = useUIStore.getState().modals;
  void codeTerminal;
  return Object.values(windows).some(Boolean);
}

export function useMarkerKeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (isTyping(event.target) || windowOpen()) return;
      const marker = useMarkerStore.getState();
      if (event.key === 'Escape') {
        if (!marker.active) return;
        event.preventDefault();
        marker.setActive(false);
        return;
      }
      if (plainLetter(event) === 'p') {
        event.preventDefault();
        marker.toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
