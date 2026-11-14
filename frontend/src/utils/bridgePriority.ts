/**
 * The bridge priority of spanning tree: a multiple of 4096 from 0 to 61440
 * (sixteen values; the lower twelve bits of the number belong to the system
 * id). The window of a switch offers these and keeps nothing else.
 *
 * Pure: no React, no stores.
 */

export const BRIDGE_PRIORITY_STEP = 4096;
export const BRIDGE_PRIORITY_MAX = 61440;
export const BRIDGE_PRIORITY_DEFAULT = 32768;

/**
 * The valid priority nearest to a number: below 0 is 0, above 61440 is
 * 61440, in between the nearest multiple of 4096. What is not a number is
 * the default.
 */
export function nearestBridgePriority(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return BRIDGE_PRIORITY_DEFAULT;
  const stepped = Math.round(value / BRIDGE_PRIORITY_STEP) * BRIDGE_PRIORITY_STEP;
  return Math.min(BRIDGE_PRIORITY_MAX, Math.max(0, stepped));
}
