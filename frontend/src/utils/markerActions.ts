/**
 * What the marker («Pennarello») does that asks the user first: clearing
 * everything written on the canvas. Kept out of the components, like
 * utils/areaActions.ts.
 */

import { useNetworkStore } from '@/store/networkStore';
import { askConfirm } from '@/store/confirmStore';
import { getT } from '@/i18n';

/**
 * Everything written on the canvas goes, after a question in the window of
 * the app. True when it went; nothing is asked on a canvas with nothing
 * written on it
 */
export async function clearWithQuestion(): Promise<boolean> {
  if (useNetworkStore.getState().marks.length === 0) return false;
  const words = getT().marker.clearQuestion;
  const yes = await askConfirm({
    title: words.title,
    detail: words.detail,
    confirmLabel: words.confirm,
    danger: true,
  });
  if (yes) useNetworkStore.getState().clearMarks();
  return yes;
}
