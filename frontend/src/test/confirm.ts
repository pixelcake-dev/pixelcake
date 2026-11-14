/**
 * For tests: answer the questions the app asks in its own window
 * (store/confirmStore.ts), as a user would with a click on one of its two
 * buttons, and remember what was asked.
 *
 * The answer is given at once, but whoever asked goes on a moment later (it
 * waits on a promise): after the click that asks, a test waits with
 * `await settled()` before looking at what the answer did.
 */

import { act } from '@testing-library/react';
import { useConfirmStore, type ConfirmQuestion } from '@/store/confirmStore';

let stopAnswering: (() => void) | null = null;

export interface Answers {
  /** The questions asked so far, in order */
  asked: ConfirmQuestion[];
  /** Change the answer given from now on */
  say: (yes: boolean) => void;
}

/** From now to the end of the test, every question gets this answer */
export function answerConfirms(yes: boolean): Answers {
  stopAnswering?.();
  const asked: ConfirmQuestion[] = [];
  let answer = yes;
  stopAnswering = useConfirmStore.subscribe((state) => {
    if (!state.pending) return;
    asked.push(state.pending);
    state.answer(answer);
  });
  return {
    asked,
    say: (next) => {
      answer = next;
    },
  };
}

/** Let whoever asked a question go on with its answer */
export async function settled(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** After each test (see setup.ts): nobody answers any more, no question is left open */
export function resetConfirms(): void {
  stopAnswering?.();
  stopAnswering = null;
  useConfirmStore.getState().answer(false);
}
