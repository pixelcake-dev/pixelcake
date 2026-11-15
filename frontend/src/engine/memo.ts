/**
 * Network Engine — Working out once what the pairs of a drawing share
 *
 * Asked about every pair of end devices of one drawing (see ./impact), the
 * engine would work out again, for every pair, what does not change from
 * one pair to the next: the cables of each device, its routing table, the
 * distances on the drawing, the devices by id. A memo keeps them for the
 * length of one piece of work:
 *
 *  - it is in force only inside `withMemo`, around the work: outside it
 *    nothing is kept, and every question reads the drawing as it is at that
 *    moment, as before;
 *  - what it keeps is keyed on the very objects it was worked out from (the
 *    list of devices, the list of cables, the failures of a topology, a
 *    device): a topology with other cables or other failures, or a device
 *    changed (the store makes a new object for it), never meets what was
 *    worked out for another. A drawing must not be changed in place while a
 *    memo is in force on it, and nothing in the app does: a memo lasts one
 *    evaluation, and the store gives a changed drawing new objects.
 *
 * A value kept is the very value the function would compute again: the
 * answers of the engine are the same with a memo and without.
 *
 * Pure: no React, no Zustand; the memo in force is the only state, and it is
 * put back as it was when the work ends, whatever happens.
 */

import type { NetworkDevice } from '@/types';
import type { Failures, Topology } from './types';

/** One kind of value kept: the key that tells it from the others in a memo */
export type MemoSlot = { readonly name: string };

export interface EngineMemo {
  /** For each kind of value, its table */
  readonly tables: Map<MemoSlot, WeakMap<object, unknown>>;
}

/** An empty memo: nothing is worked out until it is asked for */
export function createMemo(): EngineMemo {
  return { tables: new Map() };
}

let inForce: EngineMemo | null = null;

/**
 * `work` with `memo` in force: what it asks of the engine is worked out once
 * and kept in `memo`. The memo in force before is put back afterwards.
 */
export function withMemo<T>(memo: EngineMemo, work: () => T): T {
  const before = inForce;
  inForce = memo;
  try {
    return work();
  } finally {
    inForce = before;
  }
}

/** A kind of value kept, named for what it is (the name is for reading only) */
export function memoSlot(name: string): MemoSlot {
  return { name };
}

function tableOf(memo: EngineMemo, slot: MemoSlot): WeakMap<object, unknown> {
  let table = memo.tables.get(slot);
  if (!table) {
    table = new WeakMap();
    memo.tables.set(slot, table);
  }
  return table;
}

/**
 * The value of `compute` for `key`: worked out once while a memo is in
 * force, every time without one.
 */
export function remembered<K extends object, V>(slot: MemoSlot, key: K, compute: () => V): V {
  const memo = inForce;
  if (!memo) return compute();
  const table = tableOf(memo, slot) as WeakMap<K, V>;
  if (table.has(key)) return table.get(key) as V;
  const value = compute();
  table.set(key, value);
  return value;
}

/** Stands for "no failures" where failures are part of a key */
const NO_FAILURES: Failures = { devices: [], connections: [] };

/**
 * What is kept for one topology: for its devices, its cables and its
 * failures, the very objects. Undefined without a memo in force.
 */
function topologyTable(slot: MemoSlot, topo: Topology): Map<string, unknown> | undefined {
  const memo = inForce;
  if (!memo) return undefined;
  const byDevices = tableOf(memo, slot) as WeakMap<object, WeakMap<object, WeakMap<object, Map<string, unknown>>>>;
  let byConnections = byDevices.get(topo.devices);
  if (!byConnections) {
    byConnections = new WeakMap();
    byDevices.set(topo.devices, byConnections);
  }
  let byFailures = byConnections.get(topo.connections);
  if (!byFailures) {
    byFailures = new WeakMap();
    byConnections.set(topo.connections, byFailures);
  }
  const failures = topo.failures ?? NO_FAILURES;
  let values = byFailures.get(failures);
  if (!values) {
    values = new Map();
    byFailures.set(failures, values);
  }
  return values;
}

/**
 * The value of `compute` for a topology (its devices, cables and failures)
 * and a `key` of its own (a device id, an option): worked out once while a
 * memo is in force, every time without one.
 */
export function rememberedFor<V>(slot: MemoSlot, topo: Topology, key: string, compute: () => V): V {
  const values = topologyTable(slot, topo);
  if (!values) return compute();
  if (values.has(key)) return values.get(key) as V;
  const value = compute();
  values.set(key, value);
  return value;
}

/** The value of `compute` for one device object: worked out once while a memo is in force */
export function rememberedForDevice<V>(slot: MemoSlot, device: NetworkDevice, compute: () => V): V {
  return remembered(slot, device, compute);
}
