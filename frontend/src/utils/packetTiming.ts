/**
 * How the animated packet moves: how long a cable takes, how long it stops
 * on a device, and which cable it takes between two devices. Pure helpers
 * for PacketAnimation.
 */

import type { NetworkConnection } from '@/types';

/** Milliseconds per canvas unit of cable, at normal speed */
const MS_PER_UNIT = 2;
/** A short cable still takes this long: the eye must see the packet leave and arrive */
const MIN_EDGE_MS = 350;
/** A long cable is not a long wait */
const MAX_EDGE_MS = 1100;
/** Stop on each device crossed, at normal speed */
export const HOP_PAUSE_MS = 220;
/** Stop on the last device before the packet goes away, at normal speed */
export const END_PAUSE_MS = 450;

/** How long the packet takes between two points `distance` canvas units apart */
export function edgeDuration(distance: number, speed: number): number {
  const base = Math.min(Math.max(distance * MS_PER_UNIT, MIN_EDGE_MS), MAX_EDGE_MS);
  return Math.round(base / speed);
}

/**
 * The cable the packet takes from `fromId` to `toId`: the one the engine
 * named when it joins the two, else the first cable between them that is not
 * cut, else the first one.
 */
export function pickConnection(
  connections: NetworkConnection[],
  fromId: string,
  toId: string,
  linkId: string | undefined,
  cutIds: string[] = []
): NetworkConnection | undefined {
  const joins = (connection: NetworkConnection) =>
    (connection.source === fromId && connection.target === toId) ||
    (connection.source === toId && connection.target === fromId);

  if (linkId) {
    const named = connections.find(connection => connection.id === linkId);
    if (named && joins(named)) return named;
  }
  const between = connections.filter(joins);
  return between.find(connection => !cutIds.includes(connection.id)) ?? between[0];
}
