/**
 * Whether the welcome screen is on the board now. NetworkCanvas draws it when
 * this is true; the first steps of a visitor (components/Guide/FirstSteps.tsx)
 * wait for it to be left.
 */

import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useMarkerStore } from '@/store/markerStore';

export function useWelcomeShown(): boolean {
  const showWelcomeScreen = useUIStore(state => state.showWelcomeScreen);
  const welcomeRequested = useUIStore(state => state.welcomeRequested);
  // (a canvas with an area drawn on it, or something written, is not an empty one)
  const empty = useNetworkStore(
    state => state.devices.length === 0 && state.areas.length === 0 && state.marks.length === 0
  );
  const canvasCount = useProjectStore(state => state.canvases.length);
  const presenting = usePresentationStore(state => state.active);
  const markerActive = useMarkerStore(state => state.active);

  // It shows by itself only on an empty project: one canvas with nothing on
  // it (an empty canvas added to a project is just an empty canvas). Asked
  // for from the Aiuto menu, it shows on any empty canvas
  return (
    !presenting &&
    !markerActive &&
    showWelcomeScreen &&
    empty &&
    (canvasCount === 1 || welcomeRequested)
  );
}
