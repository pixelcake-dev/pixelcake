import { useEffect, useState } from 'react';
import type { Failures, ImpactOptions, ImpactReport, Topology } from '@/engine';
import { knownImpact, stopImpactWork, workOutImpact } from './impactMemo';

/**
 * The effect of the failures on the rest of the network, for a component:
 * the report when it is known, and whether it is being worked out (a slice
 * at a time, the page going on meanwhile: see ./impactMemo). `options` null
 * asks for nothing (no failure): what was being worked out stops.
 *
 * `intact`, `failures` and `options` are to be the same objects from one
 * render to the next while they do not change (useMemo): another object is
 * another question.
 */
export function useImpact(
  intact: Topology,
  failures: Failures,
  options: ImpactOptions | null
): { report: ImpactReport | null; computing: boolean } {
  // (a report that has come: the component draws again, and finds it known)
  const [, setArrived] = useState(0);
  const known = options ? knownImpact(intact, failures, options) : undefined;

  useEffect(() => {
    if (!options) {
      stopImpactWork();
      return;
    }
    if (known) return;
    let current = true;
    void workOutImpact(intact, failures, options).then((report) => {
      // (one that was stopped, or asked for what is no longer on screen, changes nothing)
      if (current && report) setArrived((count) => count + 1);
    });
    return () => {
      current = false;
    };
  }, [intact, failures, options, known]);

  return { report: known ?? null, computing: options !== null && known === undefined };
}
