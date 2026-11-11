/**
 * Shared entry point for starting a flow simulation from the UI
 * (SimulationPanel and SimulationModal).
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
  const { devices, connections, globalNetworkSettings } = useNetworkStore.getState();

  if (devices.length < 2) {
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

  const result = planAndEvaluateFlow(
    flowModel,
    sourceId,
    targetId,
    { devices, connections },
    { emailMode: globalNetworkSettings.emailMode ?? 'auto' }
  );

  if (result.verdict === 'success') {
    useSimulationStore.getState().startSimulation(result.animationPath, flowModel);
    return true;
  }

  // Failure: animate up to the drop point when there is a prefix to show
  const started = result.animationPath.length >= 2;
  if (started) {
    useSimulationStore.getState().startSimulation(result.animationPath, flowModel);
  }
  toast.error(`Simulazione ${FLOW_LABELS[flowModel]} fallita`, {
    description: result.failureReason ?? 'motivo sconosciuto',
  });
  return started;
}
