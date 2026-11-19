/**
 * A sample network put on the board, in place of what is there: by the
 * sample entries of «Aggiungi» and by the welcome screen, after whatever
 * question they ask first.
 */

import { useNetworkStore } from '@/store/networkStore';
import { clearCanvasHistory } from '@/store/historyStore';
import { useGuideStore } from '@/store/guideStore';
import type { SampleNetwork } from './sampleNetwork';
import { firstTryOf } from './firstSteps';

export function loadSampleNetwork(sample: SampleNetwork): void {
  const network = useNetworkStore.getState();
  network.clearAllDevices();
  network.loadSample(sample);
  // (a new start for the board: the steps of the drawing it replaces are not
  // undone over it, as the settings of the project it brings could not be)
  clearCanvasHistory();
  // Whole in the window, whatever part of the board was on screen
  network.triggerFitView();
  // The first thing to try on it, once in a browser (after the tour, when one is due)
  const question = firstTryOf(sample);
  if (question) useGuideStore.getState().offerFirstTry(question);
}
