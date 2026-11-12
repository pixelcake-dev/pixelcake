/**
 * Entry point for starting a flow simulation from the UI (SimulationPanel).
 *
 * Plans the flow per model (email via a mail server, web/download as
 * request+response round trip, ping as echo), evaluates every leg with the
 * network engine, and animates the result. On failure the successful prefix
 * is still animated so the packet visibly dies where the network would drop
 * it, and the reason is surfaced as a toast.
 */

import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useSimulationStore } from '@/store/simulationStore';
import { planAndEvaluateFlow } from '@/engine';
import { liveTopology } from '@/utils/liveTopology';
import type { FlowModelType } from '@/types';

const FLOW_LABELS: Record<FlowModelType, string> = {
  ping: 'Ping',
  email: 'Email',
  web: 'Web',
  download: 'Download',
};

/** Returns true when an animation was started */
export function runFlowSimulation(
  sourceId: string,
  targetId: string,
  flowModel: FlowModelType
): boolean {
  const topology = liveTopology();
  const { globalNetworkSettings } = useNetworkStore.getState();

  if (topology.devices.length < 2) {
    toast.warning('Aggiungi almeno due dispositivi per avviare una simulazione.');
    return false;
  }
  if (!sourceId || !targetId) {
    toast.warning('Seleziona dispositivo di partenza e destinazione.');
    return false;
  }
  if (sourceId === targetId) {
    toast.warning('Il dispositivo di partenza e destinazione non possono coincidere.');
    return false;
  }

  const result = planAndEvaluateFlow(flowModel, sourceId, targetId, topology, {
    emailMode: globalNetworkSettings.emailMode ?? 'auto',
  });
  const start = () =>
    useSimulationStore
      .getState()
      .startSimulation(result.animationPath, flowModel, result.animationLinks);

  if (result.verdict === 'success') {
    start();
    return true;
  }

  // Failure: animate up to the drop point when there is a prefix to show
  const started = result.animationPath.length >= 2;
  if (started) start();
  toast.error(`Simulazione ${FLOW_LABELS[flowModel]} fallita`, {
    description: result.failureReason ?? 'motivo sconosciuto',
  });
  return started;
}
