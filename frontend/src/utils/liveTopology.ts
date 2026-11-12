/**
 * The topology every question is asked of: the canvas on screen, plus the
 * failures simulated in presentation mode while it is on. The simulation
 * panel, the terminal and the presentation all read it from here, so they can
 * never give different answers about the same picture.
 */

import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { withFailures } from '@/engine';
import type { Failures, Topology } from '@/engine';

/** The failures simulated right now: none outside presentation mode */
export function liveFailures(): Failures {
  const { active, failedDevices, failedConnections } = usePresentationStore.getState();
  return active
    ? { devices: failedDevices, connections: failedConnections }
    : { devices: [], connections: [] };
}

export function liveTopology(): Topology {
  const { devices, connections } = useNetworkStore.getState();
  return withFailures({ devices, connections }, liveFailures());
}
