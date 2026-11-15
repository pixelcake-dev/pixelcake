/**
 * The effect of simulated failures on the rest of the network, worked out
 * once and asked for twice: by the panel of the presentation and by the
 * export window, whose caption says the same thing. On a large drawing the
 * work takes seconds (every pair of end devices, with nothing broken and
 * with the failures), and the export window used to do it all again.
 *
 * Both ask with the drawing as the store holds it: the same arrays of
 * devices and cables are the same drawing (the store never changes them in
 * place). Kept, for the last drawing only: the exchanges of the intact
 * drawing for each kind of exchange (what every set of failures is compared
 * with) and the reports of the last few sets of failures. The answers are
 * the engine's own, unchanged.
 */

import { assessImpact, evaluateAllFlows, withFailures } from '@/engine';
import type { Failures, FlowTable, ImpactOptions, ImpactReport, Topology } from '@/engine';
import type { NetworkConnection, NetworkDevice } from '@/types';

/** How many reports are kept for one drawing: failures are tried one after another */
const REPORTS_KEPT = 8;

interface Kept {
  devices: readonly NetworkDevice[];
  connections: readonly NetworkConnection[];
  /** The intact drawing's exchanges, by kind of exchange and mail mode */
  baselines: Map<string, FlowTable>;
  /** The last reports, by kind of exchange, mail mode and failures (oldest first) */
  reports: Map<string, ImpactReport>;
}

let kept: Kept | null = null;

const optionsKey = (options: ImpactOptions) => `${options.flow}|${options.emailMode ?? 'auto'}`;

/** The failures as they count: each once, in any order */
const failuresKey = (failures: Failures) =>
  `${[...new Set(failures.devices)].sort().join(',')}|${[...new Set(failures.connections)].sort().join(',')}`;

/** What is kept for this drawing: nothing yet when it is another one */
function keptFor(intact: Topology): Kept {
  if (!kept || kept.devices !== intact.devices || kept.connections !== intact.connections) {
    kept = { devices: intact.devices, connections: intact.connections, baselines: new Map(), reports: new Map() };
  }
  return kept;
}

/** Every exchange of the intact drawing, for this kind of exchange: worked out once per drawing */
export function baselineOf(intact: Topology, options: ImpactOptions): FlowTable {
  const memo = keptFor(intact);
  const key = optionsKey(options);
  let baseline = memo.baselines.get(key);
  if (!baseline) {
    baseline = evaluateAllFlows(withFailures(intact, undefined), options);
    memo.baselines.set(key, baseline);
  }
  return baseline;
}

/** What the failures do to every exchange of the drawing (engine/impact.ts), worked out once */
export function impactOf(intact: Topology, failures: Failures, options: ImpactOptions): ImpactReport {
  const memo = keptFor(intact);
  const key = `${optionsKey(options)}|${failuresKey(failures)}`;
  const known = memo.reports.get(key);
  if (known) return known;
  const report = assessImpact(intact, failures, options, baselineOf(intact, options));
  memo.reports.set(key, report);
  // (the oldest goes first: a Map keeps the order things were put in)
  if (memo.reports.size > REPORTS_KEPT) memo.reports.delete(memo.reports.keys().next().value!);
  return report;
}

/** Forgets everything kept (for tests) */
export function forgetImpacts(): void {
  kept = null;
}
