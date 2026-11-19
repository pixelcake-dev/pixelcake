/**
 * The first steps of a visitor, one at a time (store/guideStore.ts):
 *
 * 1. On a first visit the guided tour starts once the welcome screen is left,
 *    whichever way it is left, as soon as no window, question, presentation
 *    or marker is in its way (a new project waits for its window).
 * 2. The first question a sample suggests waits for the tour: never on top
 *    of it, nor over a window, the welcome screen, a presentation or the
 *    marker. It goes when the devices it names leave the board.
 *
 * Mounted in the board's area: the question is drawn over the top of the
 * board; the tour over everything.
 */

import { useEffect, useState } from 'react';
import { useGuideStore } from '@/store/guideStore';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useMarkerStore } from '@/store/markerStore';
import { useConfirmStore } from '@/store/confirmStore';
import { useWelcomeShown } from '@/components/useWelcomeShown';
import GuidedTour from './GuidedTour';
import FirstTryHint from './FirstTryHint';

const FirstSteps = () => {
  const welcomeShown = useWelcomeShown();
  const tourDue = useGuideStore(state => state.tourDue);
  const tourOpen = useGuideStore(state => state.tourStep !== null);
  const openTour = useGuideStore(state => state.openTour);
  const firstTry = useGuideStore(state => state.firstTry);
  const dismissFirstTry = useGuideStore(state => state.dismissFirstTry);
  const presenting = usePresentationStore(state => state.active);
  const markerActive = useMarkerStore(state => state.active);
  const asking = useConfirmStore(state => state.pending !== null);
  // (the terminal floats beside the board: it is not a window in the way)
  const windowOpen = useUIStore(state =>
    Object.entries(state.modals).some(([name, isOpen]) => isOpen && name !== 'codeTerminal')
  );
  const namesOnBoard = useNetworkStore(state =>
    firstTry
      ? state.devices.some(device => device.label === firstTry.from) &&
        state.devices.some(device => device.label === firstTry.to)
      : false
  );

  // Whether the welcome screen has been on the board in this visit
  const [welcomeWasShown, setWelcomeWasShown] = useState(welcomeShown);
  useEffect(() => {
    if (welcomeShown) setWelcomeWasShown(true);
  }, [welcomeShown]);

  const quiet = !presenting && !markerActive && !asking && !windowOpen;
  const welcomeLeft = welcomeWasShown && !welcomeShown;
  // The tour is on screen, or on its way: what comes after it waits
  const tourComing = tourOpen || (tourDue && welcomeWasShown);

  useEffect(() => {
    if (tourDue && welcomeLeft && quiet && !tourOpen) openTour();
  }, [tourDue, welcomeLeft, quiet, tourOpen, openTour]);

  // The question is about devices of the board: gone with them
  useEffect(() => {
    if (firstTry && !namesOnBoard) dismissFirstTry();
  }, [firstTry, namesOnBoard, dismissFirstTry]);

  const showFirstTry = firstTry !== null && namesOnBoard && !tourComing && !welcomeShown && quiet;

  return (
    <>
      <GuidedTour />
      {showFirstTry && <FirstTryHint question={firstTry} />}
    </>
  );
};

export default FirstSteps;
