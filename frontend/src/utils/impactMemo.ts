/**
 * The effect of simulated failures on the rest of the network: worked out
 * once, a slice at a time, and shared by the panel of the presentation and
 * the export window, whose caption says the same thing.
 *
 * The work is every pair of end devices, with nothing broken and with the
 * failures: on a large drawing a couple of seconds, even with the engine
 * working out once what the pairs share (engine/memo). Done in one go it
 * would hold the page that long. Here it is done in slices of a few
 * milliseconds, and the page draws between two of them (the packet of the
 * answer goes on moving):
 *
 *  - the answer to the question itself is not waited for: it is one
 *    exchange, worked out at once by the panel;
 *  - a new failure, a repair, another kind of exchange or another drawing
 *    stops what was being worked out for the old ones, at the next slice;
 *    the exchanges of the intact drawing do not depend on the failures, and
 *    go on for the new ones;
 *  - what is kept is keyed on what it was worked out from (the drawing as
 *    the store holds it, the kind of exchange, the failures): a result that
 *    comes late is only ever shown for what it was asked for.
 *
 * Why slices and not a Web Worker: the comparison needs every exchange of
 * the intact drawing (17,292 on the multinational, each with its whole way),
 * kept for every later failure. In a worker that table would live apart,
 * and every report, thousands of whole results, would be copied back into
 * the page: a copy that itself holds the page. In slices the panel and the
 * export window share the very result, a computation stops between two
 * slices, and it runs the same in the tests.
 *
 * Both ask with the drawing as the store holds it: the same arrays of
 * devices and cables are the same drawing (the store never changes them in
 * place). Kept for the last drawing only: the exchanges of the intact
 * drawing for each kind of exchange, and the reports of the last few sets of
 * failures. The answers are the engine's own (engine/impact), unchanged.
 */

import {
  assessImpact,
  compareFlows,
  createMemo,
  evaluateAllFlows,
  evaluateFlowInto,
  flowPairs,
  withFailures,
  withMemo,
} from '@/engine';
import type { Failures, FlowTable, ImpactOptions, ImpactReport, Topology } from '@/engine';
import type { NetworkConnection, NetworkDevice } from '@/types';

/** How many reports are kept for one drawing: failures are tried one after another */
const REPORTS_KEPT = 8;

/** How long one slice of the work holds the page, at most, in milliseconds */
const SLICE_MS = 8;

interface Kept {
  devices: readonly NetworkDevice[];
  connections: readonly NetworkConnection[];
  /** The intact drawing's exchanges, by kind of exchange and mail mode */
  baselines: Map<string, FlowTable>;
  /** The same, while they are being worked out */
  baselinesInWork: Map<string, Promise<FlowTable | null>>;
  /** The last reports, by kind of exchange, mail mode and failures (oldest first) */
  reports: Map<string, ImpactReport>;
  /** The same, while they are being worked out */
  reportsInWork: Map<string, Promise<ImpactReport | null>>;
}

let kept: Kept | null = null;

/** What was asked for last: the work in progress for anything else stops */
let wanted: {
  devices: readonly NetworkDevice[];
  connections: readonly NetworkConnection[];
  options: string;
  failures: string;
} | null = null;

const optionsKey = (options: ImpactOptions) => `${options.flow}|${options.emailMode ?? 'auto'}`;

/** The failures as they count: each once, in any order */
const failuresKey = (failures: Failures) =>
  `${[...new Set(failures.devices)].sort().join(',')}|${[...new Set(failures.connections)].sort().join(',')}`;

const sameDrawing = (memo: Kept, intact: Topology) =>
  memo.devices === intact.devices && memo.connections === intact.connections;

/** What is kept for this drawing: nothing yet when it is another one */
function keptFor(intact: Topology): Kept {
  if (!kept || !sameDrawing(kept, intact)) {
    kept = {
      devices: intact.devices,
      connections: intact.connections,
      baselines: new Map(),
      baselinesInWork: new Map(),
      reports: new Map(),
      reportsInWork: new Map(),
    };
  }
  return kept;
}

function keepReport(memo: Kept, key: string, report: ImpactReport): void {
  memo.reports.set(key, report);
  // (the oldest goes first: a Map keeps the order things were put in)
  if (memo.reports.size > REPORTS_KEPT) memo.reports.delete(memo.reports.keys().next().value!);
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

/**
 * What the failures do to every exchange of the drawing (engine/impact.ts),
 * worked out once, in one go (the page waits: see `workOutImpact`)
 */
export function impactOf(intact: Topology, failures: Failures, options: ImpactOptions): ImpactReport {
  const memo = keptFor(intact);
  const key = `${optionsKey(options)}|${failuresKey(failures)}`;
  const known = memo.reports.get(key);
  if (known) return known;
  const report = assessImpact(intact, failures, options, baselineOf(intact, options));
  keepReport(memo, key, report);
  return report;
}

/** The report, when it has been worked out already; nothing is worked out here */
export function knownImpact(intact: Topology, failures: Failures, options: ImpactOptions): ImpactReport | undefined {
  if (!kept || !sameDrawing(kept, intact)) return undefined;
  return kept.reports.get(`${optionsKey(options)}|${failuresKey(failures)}`);
}

/** Let the page draw before the next slice */
const giveBack = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Every exchange of `topo`, as evaluateAllFlows gives them (the same pairs,
 * in the same order, the same answers), worked out a slice at a time. Null
 * when `stop` says so between two slices.
 */
async function evaluateInSlices(
  topo: Topology,
  options: ImpactOptions,
  stop: () => boolean,
  sliceMs: number
): Promise<FlowTable | null> {
  // (what the pairs share is worked out once for the whole table, across the slices)
  const memo = createMemo();
  const pairs = withMemo(memo, () => flowPairs(topo));
  const table: FlowTable = new Map();
  let next = 0;
  while (next < pairs.length) {
    await giveBack();
    if (stop()) return null;
    const until = performance.now() + sliceMs;
    withMemo(memo, () => {
      do {
        evaluateFlowInto(table, topo, options, pairs[next]);
        next += 1;
      } while (next < pairs.length && performance.now() < until);
    });
  }
  return table;
}

/** The intact drawing's exchanges for this kind of exchange: kept, being worked out, or started now */
function baselineInSlices(memo: Kept, intact: Topology, options: ImpactOptions, sliceMs: number): Promise<FlowTable | null> {
  const key = optionsKey(options);
  const done = memo.baselines.get(key);
  if (done) return Promise.resolve(done);
  const inWork = memo.baselinesInWork.get(key);
  if (inWork) return inWork;

  // It stops only when this drawing or this kind of exchange is no longer asked for
  const unwanted = () =>
    wanted === null || wanted.devices !== intact.devices || wanted.connections !== intact.connections || wanted.options !== key;
  const work = evaluateInSlices(withFailures(intact, undefined), options, unwanted, sliceMs).then((table) => {
    if (memo.baselinesInWork.get(key) === work) memo.baselinesInWork.delete(key);
    if (table) memo.baselines.set(key, table);
    return table;
  });
  memo.baselinesInWork.set(key, work);
  return work;
}

/**
 * What the failures do to every exchange of the drawing, worked out a slice
 * at a time (see the header). Resolves with the report, the same one
 * `impactOf` gives and kept as it keeps it; with null when the work was
 * stopped because something else was asked for since. Asked twice for the
 * same thing (the panel and the export window), it is worked out once.
 *
 * `sliceMs` is how long a slice may hold the page (smaller in the tests, to
 * have many slices on a small drawing).
 */
export function workOutImpact(
  intact: Topology,
  failures: Failures,
  options: ImpactOptions,
  { sliceMs = SLICE_MS }: { sliceMs?: number } = {}
): Promise<ImpactReport | null> {
  const memo = keptFor(intact);
  const optionsPart = optionsKey(options);
  const failuresPart = failuresKey(failures);
  const key = `${optionsPart}|${failuresPart}`;
  // From now on this is what is wanted: the work for anything else stops
  wanted = { devices: intact.devices, connections: intact.connections, options: optionsPart, failures: failuresPart };

  const known = memo.reports.get(key);
  if (known) return Promise.resolve(known);
  const inWork = memo.reportsInWork.get(key);
  if (inWork) return inWork;

  const unwanted = () =>
    wanted === null ||
    wanted.devices !== intact.devices ||
    wanted.connections !== intact.connections ||
    wanted.options !== optionsPart ||
    wanted.failures !== failuresPart;
  const work = (async () => {
    const baseline = await baselineInSlices(memo, intact, options, sliceMs);
    if (!baseline || unwanted()) return null;
    const broken = await evaluateInSlices(withFailures(intact, failures), options, unwanted, sliceMs);
    if (!broken) return null;
    const report = compareFlows(withFailures(intact, undefined), baseline, broken);
    keepReport(memo, key, report);
    return report;
  })().finally(() => {
    if (memo.reportsInWork.get(key) === work) memo.reportsInWork.delete(key);
  });
  memo.reportsInWork.set(key, work);
  return work;
}

/** Nothing is asked for any more (every failure repaired): the work in progress stops */
export function stopImpactWork(): void {
  wanted = null;
}

/** Forgets everything kept, and stops the work in progress (for tests) */
export function forgetImpacts(): void {
  kept = null;
  wanted = null;
}
