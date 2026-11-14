/**
 * The colour of a device on the small map, by its type: a glance at the map
 * tells where the routers, the switches and the servers are, and so where to
 * go. These are colours of a kind of thing, as those of the cables are; the
 * orange of the look stays the mark of a state.
 */

export const MINI_MAP_COLOURS: Readonly<Record<string, string>> = {
  PC: '#3b82f6', // blue
  Switch: '#10b981', // green
  Router: '#f59e0b', // amber
  Server: '#8b5cf6', // violet
  Firewall: '#ef4444', // red
  AccessPoint: '#06b6d4', // cyan
  LoadBalancer: '#ec4899', // pink
  Database: '#f97316', // orange
  Cloud: '#6366f1', // indigo
};

/** A device of a type the map has no colour for */
export const MINI_MAP_FALLBACK = '#6b7280';

export function miniMapColour(type: string | undefined): string {
  return (type && MINI_MAP_COLOURS[type]) || MINI_MAP_FALLBACK;
}
