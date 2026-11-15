/**
 * Entry point for starting a flow simulation from the UI (SimulationPanel).
 *
 * Plans the flow per model (email via a mail server, web/download as
 * request+response round trip, ping as echo), evaluates every leg with the
 * network engine, and animates the result. On failure the successful prefix
 * is still animated so the packet visibly dies where the network would drop
 * it, and the reason is surfaced as a toast. The run is told how the
 * question ends: the device that answers, or the one it stops on, says so
 * with its lamp once the packet has got there.
 */

import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { useSimulationStore } from '@/store/simulationStore';
import { planAndEvaluateFlow } from '@/engine';
import { liveTopology } from '@/utils/liveTopology';
import { flowOutcome } from '@/utils/answerOutcome';
import { getT } from '@/i18n';
import type { FlowModelType } from '@/types';

/** Returns true when an animation was started */
export function runFlowSimulation(
  sourceId: string,
  targetId: string,
  flowModel: FlowModelType
): boolean {
  const topology = liveTopology();
  const { globalNetworkSettings } = useNetworkStore.getState();
  // (the words of the notices, in the language of the moment the simulation is asked for)
  const { notices } = getT().simulation;

  if (topology.devices.length < 2) {
    toast.warning(notices.addTwoDevices);
    return false;
  }
  if (!sourceId || !targetId) {
    toast.warning(notices.chooseBothEnds);
    return false;
  }
  if (sourceId === targetId) {
    toast.warning(notices.sameDevice);
    return false;
  }

  const result = planAndEvaluateFlow(flowModel, sourceId, targetId, topology, {
    emailMode: globalNetworkSettings.emailMode ?? 'auto',
  });
  const start = () =>
    useSimulationStore
      .getState()
      .startSimulation(
        result.animationPath,
        flowModel,
        result.animationLinks,
        flowOutcome(result, flowModel)
      );

  if (result.verdict === 'success') {
    start();
    return true;
  }

  // Failure: animate up to the drop point when there is a prefix to show;
  // a question that does not even leave says where it stops at once
  const started = result.animationPath.length >= 2;
  if (started) start();
  else useSimulationStore.getState().leaveAnswer(flowOutcome(result, flowModel));
  // (the reason is the engine's own, as it wrote it: in English in every language)
  toast.error(notices.failed(flowModel), {
    description: result.failureReason ?? notices.unknownReason,
  });
  return started;
}
