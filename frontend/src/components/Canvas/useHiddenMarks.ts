/**
 * How many notes («appunti») are hidden: those of the canvas while annotation
 * mode is off, none while it is on. The buttons of the mode show it, so that
 * notes out of sight are not forgotten.
 */

import { useMarkerStore } from '@/store/markerStore';
import { useNetworkStore } from '@/store/networkStore';

export function useHiddenMarks(): number {
  const active = useMarkerStore((state) => state.active);
  const count = useNetworkStore((state) => state.marks.length);
  return active ? 0 : count;
}
