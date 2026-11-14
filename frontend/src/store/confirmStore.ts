/**
 * A question with a yes and a no, asked in a window of the app
 * (components/ui/ConfirmDialog.tsx). It took the place of the browser's own
 * confirmation box, which stops the whole page and looks like nothing else
 * here.
 *
 * `askConfirm` gives a promise: whoever asks goes on when the user has
 * pressed one of the two buttons, or Esc, which is a no.
 */

import { create } from 'zustand';

export interface ConfirmQuestion {
  /** The question, in one line */
  title: string;
  /** What saying yes brings with it, when there is something to add */
  detail?: string;
  /** The word on the button that says yes: the action itself («Elimina») */
  confirmLabel: string;
  /** Saying yes loses something: the button says so with its colour */
  danger?: boolean;
}

interface ConfirmStore {
  /** The question on screen, if any */
  pending: ConfirmQuestion | null;
  ask: (question: ConfirmQuestion) => Promise<boolean>;
  answer: (yes: boolean) => void;
}

/** Who is waiting for the answer to the question on screen */
let waiting: ((yes: boolean) => void) | null = null;

export const useConfirmStore = create<ConfirmStore>()((set) => ({
  pending: null,

  ask: (question) => {
    // One question at a time: a new one is a no to the one still open
    waiting?.(false);
    return new Promise<boolean>((resolve) => {
      waiting = resolve;
      set({ pending: question });
    });
  },

  answer: (yes) => {
    const resolve = waiting;
    waiting = null;
    set({ pending: null });
    resolve?.(yes);
  },
}));

/** Ask, and wait for the yes or the no */
export function askConfirm(question: ConfirmQuestion): Promise<boolean> {
  return useConfirmStore.getState().ask(question);
}
