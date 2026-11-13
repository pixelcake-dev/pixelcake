/**
 * Network Engine — Impact of failures
 *
 * "What stops working if this breaks?" Every exchange between two end
 * devices of the drawing is evaluated twice, with everything working and
 * with the failures applied, and the two outcomes are compared:
 *
 *  - broken:    it worked, it no longer does (with the reason)
 *  - rerouted:  it still works, along other cables
 *  - unchanged: it works exactly as before
 *
 * An exchange that did not work to begin with is not counted: a failure
 * cannot break it. Exchanges are ordered pairs (A → B is not B → A: a
 * firewall may let one through and not the other).
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { EmailMode, FlowModelType, NetworkDevice } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Failures, Topology } from './types';
import { primaryAddress } from './addressing';
import { withFailures } from './failures';
import { planAndEvaluateFlow } from './flows';
import type { FlowResult } from './flows';
import { forwardingRole, isInternetLike } from './topology';
import { withLeases } from './dhcp';

export interface ImpactOptions {
  /** The kind of exchange evaluated between every two end devices */
  flow: FlowModelType;
  emailMode?: EmailMode;
}

/** One evaluated exchange */
export interface EvaluatedFlow {
  sourceId: string;
  targetId: string;
  result: FlowResult;
}

/** Every evaluated exchange, by `flowKey(sourceId, targetId)` */
export type FlowTable = Map<string, EvaluatedFlow>;

/** One exchange a failure touched */
export interface ImpactedFlow {
  sourceId: string;
  targetId: string;
  /** How it goes with the failures applied */
  after: FlowResult;
}

export interface ImpactReport {
  /** Ids of the end devices the report is about, in drawing order */
  endpoints: string[];
  /** Exchanges that worked with nothing broken */
  working: number;
  /** Of those, the ones that no longer work */
  broken: ImpactedFlow[];
  /** Of those, the ones that still work along other cables */
  rerouted: ImpactedFlow[];
  /** Of those, the ones that work exactly as before */
  unchanged: number;
}

export function flowKey(sourceId: string, targetId: string): string {
  return `${sourceId}>${targetId}`;
}

/**
 * The devices exchanges are evaluated between: the end devices of the
 * drawing (they never carry traffic for others) and the symbols that stand
 * for the outside world, as long as they have a usable address.
 */
export function impactEndpoints(topo: Topology): NetworkDevice[] {
  // (a card on DHCP counts with the address it is leased: see ./dhcp)
  return withLeases(topo).devices.filter(device => {
    const isEndpoint = forwardingRole(device) === 'host' || isInternetLike(device);
    return isEndpoint && isValidIP(primaryAddress(device));
  });
}

/** Evaluate the exchange between every two end devices of `topo` */
export function evaluateAllFlows(topo: Topology, options: ImpactOptions): FlowTable {
  const endpoints = impactEndpoints(topo);
  const table: FlowTable = new Map();
  for (const source of endpoints) {
    for (const target of endpoints) {
      if (source.id === target.id) continue;
      table.set(flowKey(source.id, target.id), {
        sourceId: source.id,
        targetId: target.id,
        result: planAndEvaluateFlow(options.flow, source.id, target.id, topo, {
          emailMode: options.emailMode,
        }),
      });
    }
  }
  return table;
}

/** True when the two outcomes travel on the same cables through the same devices */
export function sameWay(a: FlowResult, b: FlowResult): boolean {
  return (
    a.animationPath.length === b.animationPath.length &&
    a.animationPath.every((id, index) => id === b.animationPath[index]) &&
    a.animationLinks.every((id, index) => id === b.animationLinks[index])
  );
}

/** Compare the exchanges of a drawing before and after some failures */
export function compareFlows(topo: Topology, before: FlowTable, after: FlowTable): ImpactReport {
  const report: ImpactReport = {
    endpoints: impactEndpoints(topo).map(device => device.id),
    working: 0,
    broken: [],
    rerouted: [],
    unchanged: 0,
  };

  for (const [key, was] of before) {
    if (was.result.verdict !== 'success') continue;
    const now = after.get(key)?.result;
    if (!now) continue;
    report.working += 1;

    const { sourceId, targetId } = was;
    if (now.verdict !== 'success') report.broken.push({ sourceId, targetId, after: now });
    else if (!sameWay(was.result, now)) report.rerouted.push({ sourceId, targetId, after: now });
    else report.unchanged += 1;
  }
  return report;
}

/**
 * What `failures` do to the exchanges of `topo`. `before` is the table of the
 * drawing with nothing broken, when the caller already has it.
 */
export function assessImpact(
  topo: Topology,
  failures: Failures,
  options: ImpactOptions,
  before?: FlowTable
): ImpactReport {
  const intact = withFailures(topo, undefined);
  const baseline = before ?? evaluateAllFlows(intact, options);
  const broken = evaluateAllFlows(withFailures(topo, failures), options);
  return compareFlows(intact, baseline, broken);
}
