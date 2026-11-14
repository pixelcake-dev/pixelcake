/**
 * Packet Animation Logic Component
 * Moves the packet of a simulation along its path, one cable at a time, and
 * keeps simulationStore up to date. The drawing of the packet itself is done
 * by CustomEdge (SVG animateMotion), which reads the cable and the duration
 * from the store.
 *
 * One run at a time: a new `startSimulation`, a stop or an unmount cancels
 * the run in progress at once, so two packets never fight over the store.
 */

import { useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { useSimulationStore } from '@/store/simulationStore';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { END_PAUSE_MS, HOP_PAUSE_MS, edgeDuration, pickConnection } from '@/utils/packetTiming';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';

const PacketAnimation = () => {
  const reactFlowInstance = useReactFlow();

  const isRunning = useSimulationStore((state) => state.isRunning);
  const runId = useSimulationStore((state) => state.runId);

  useEffect(() => {
    if (!isRunning) return;

    const simulation = useSimulationStore.getState();
    const { path, links } = simulation;
    if (path.length < 2) {
      simulation.stopSimulation();
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    /** Resolves after `ms`, or never when the run is cancelled meanwhile */
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      });

    const animate = async () => {
      for (let i = 0; i < path.length - 1; i++) {
        const fromId = path[i];
        const toId = path[i + 1];
        const store = useSimulationStore.getState();
        const { speed } = store;

        store.setCurrentHop(i);
        store.setActiveDevice(fromId);

        const fromNode = reactFlowInstance.getNode(fromId);
        const toNode = reactFlowInstance.getNode(toId);
        const connection = pickConnection(
          useNetworkStore.getState().connections,
          fromId,
          toId,
          links[i],
          usePresentationStore.getState().failedConnections
        );
        // A device or a cable removed while the packet travels: skip the stretch
        if (!fromNode || !toNode || !connection) continue;

        const centre = (node: typeof fromNode) => ({
          x: node.position.x + (node.width ?? DEVICE_METRICS.width) / 2,
          y: node.position.y + (node.height ?? deviceHeight(true)) / 2,
        });
        const from = centre(fromNode);
        const to = centre(toNode);
        const duration = edgeDuration(Math.hypot(to.x - from.x, to.y - from.y), speed);

        // This starts the packet on the cable (CustomEdge)
        store.setCurrentConnection(connection.id, connection.source !== fromId, duration);
        await wait(duration);
        if (cancelled) return;

        // Arrived: stop a moment on every device that is not the last
        useSimulationStore.getState().setActiveDevice(toId);
        if (i < path.length - 2) {
          await wait(HOP_PAUSE_MS / speed);
          if (cancelled) return;
        }
      }

      useSimulationStore.getState().setCurrentConnection(null);
      await wait(END_PAUSE_MS / useSimulationStore.getState().speed);
      if (cancelled) return;
      useSimulationStore.getState().stopSimulation();
    };

    void animate();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRunning, runId, reactFlowInstance]);

  // This component only manages logic, no visual rendering
  return null;
};

export default PacketAnimation;
