/**
 * A sample network put on the board, in place of what is there: by the
 * sample entries of «Aggiungi» and by the welcome screen, after whatever
 * question they ask first.
 */

import { useNetworkStore } from '@/store/networkStore';
import { clearCanvasHistory } from '@/store/historyStore';
import type { SampleNetwork } from './sampleNetwork';

export function loadSampleNetwork(sample: SampleNetwork): void {
  const network = useNetworkStore.getState();
  network.clearAllDevices();
  network.loadSample(sample);
  // (a new start for the board: the steps of the drawing it replaces are not
  // undone over it, as the settings of the project it brings could not be)
  clearCanvasHistory();
  // Whole in the window, whatever part of the board was on screen
  network.triggerFitView();
}
