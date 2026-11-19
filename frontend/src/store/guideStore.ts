/**
 * The first steps of a visitor: the guided tour and the first question a
 * sample suggests (components/Guide/). What is due is read from this browser
 * when the page starts (utils/firstSteps.ts), before anything of this visit is
 * written; what has been shown is written back at once, through
 * utils/safeStorage, so that a reload never shows it again.
 *
 * Not persisted as a store: two keys of the browser, `pixelcake-tour-seen`
 * and `pixelcake-first-try-seen`.
 */

import { create } from 'zustand';
import { TOUR_STEPS } from '@/data/tourSteps';
import {
  FIRST_TRY_SEEN_KEY,
  TOUR_SEEN_KEY,
  firstStepsAtStart,
  type FirstTry,
} from '@/utils/firstSteps';
import { readStored, writeStored } from '@/utils/safeStorage';

interface GuideState {
  /** A first visit: the tour starts by itself once the welcome screen is left */
  tourDue: boolean;
  /** The step of the tour on screen (from 0), or null while it is closed */
  tourStep: number | null;
  /** The first question may still be suggested in this browser */
  firstTryDue: boolean;
  /** The first question of the sample just loaded, waiting to be shown or on screen */
  firstTry: FirstTry | null;

  /** Open the tour on its first step (by itself on a first visit, or from Aiuto → «Tour guidato») */
  openTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  /** Close it, at any step («Salta», Esc, «Fine») */
  closeTour: () => void;

  /** A sample was loaded that suggests a question: it waits for its turn (once in a browser) */
  offerFirstTry: (question: FirstTry) => void;
  /** The question is on screen: it is not suggested again in this browser */
  firstTryShown: () => void;
  /** Put away: closed, used, or its devices are gone */
  dismissFirstTry: () => void;
}

/** What a visit starts with, read from this browser */
export function guideAtStart(): Pick<
  GuideState,
  'tourDue' | 'tourStep' | 'firstTryDue' | 'firstTry'
> {
  const { tourDue, firstTryDue } = firstStepsAtStart(readStored);
  return { tourDue, tourStep: null, firstTryDue, firstTry: null };
}

export const useGuideStore = create<GuideState>()((set, get) => ({
  ...guideAtStart(),

  openTour: () => {
    // (shown once by itself: whatever happens next, it is not forced again)
    writeStored(TOUR_SEEN_KEY, 'true');
    set({ tourStep: 0, tourDue: false });
  },

  nextStep: () => {
    const { tourStep } = get();
    if (tourStep === null) return;
    set({ tourStep: Math.min(tourStep + 1, TOUR_STEPS.length - 1) });
  },

  previousStep: () => {
    const { tourStep } = get();
    if (tourStep === null) return;
    set({ tourStep: Math.max(tourStep - 1, 0) });
  },

  closeTour: () => {
    if (get().tourStep !== null) set({ tourStep: null });
  },

  offerFirstTry: question => {
    if (!get().firstTryDue) return;
    set({ firstTry: question });
  },

  firstTryShown: () => {
    writeStored(FIRST_TRY_SEEN_KEY, 'true');
    set({ firstTryDue: false });
  },

  dismissFirstTry: () => {
    if (get().firstTry !== null) set({ firstTry: null });
  },
}));
