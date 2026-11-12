/**
 * Everything presentation mode shows, worked out from the drawing, the
 * question and the simulated failures — and the two things that follow from
 * it: the way of the answer marked on the canvas, the packet set off again
 * whenever the question or the failures change.
 *
 * Used once, by PresentationPanel.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import {
  assessImpact,
  evaluateAllFlows,
  hasFailures,
  planAndEvaluateFlow,
  withFailures,
} from '@/engine';
import type { Failures, FlowResult, ImpactReport, Topology } from '@/engine';
import { routeOf } from '@/utils/presentation';

export interface PresentationAnswer {
  /** The answer to the question, with the failures applied; null with no question */
  answer: FlowResult | null;
  /** The answer the same question gets with nothing broken; null with no failures */
  intactAnswer: FlowResult | null;
  /** What the failures do to every exchange of the drawing; null with no failures */
  impact: ImpactReport | null;
  /**
   * How far the packet of this answer has got, as a position in its
   * animation; null when it is not travelling (the whole answer is shown)
   */
  reached: number | null;
}

export function usePresentationAnswer(): PresentationAnswer {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const canvasRevision = useNetworkStore((state) => state.canvasRevision);
  const emailMode = useNetworkStore((state) => state.globalNetworkSettings.emailMode ?? 'auto');

  const sourceId = usePresentationStore((state) => state.sourceId);
  const targetId = usePresentationStore((state) => state.targetId);
  const flow = usePresentationStore((state) => state.flow);
  const failedDevices = usePresentationStore((state) => state.failedDevices);
  const failedConnections = usePresentationStore((state) => state.failedConnections);
  const replaySeq = usePresentationStore((state) => state.replaySeq);

  const intact: Topology = useMemo(() => ({ devices, connections }), [devices, connections]);
  const failures: Failures = useMemo(
    () => ({ devices: failedDevices, connections: failedConnections }),
    [failedDevices, failedConnections]
  );
  const isBroken = hasFailures(failures);
  /** A question needs two different devices */
  const question = useMemo(
    () =>
      sourceId !== null && targetId !== null && sourceId !== targetId ? { sourceId, targetId } : null,
    [sourceId, targetId]
  );

  const answer = useMemo(
    () =>
      question
        ? planAndEvaluateFlow(flow, question.sourceId, question.targetId, withFailures(intact, failures), {
            emailMode,
          })
        : null,
    [question, flow, intact, failures, emailMode]
  );

  const intactAnswer = useMemo(
    () =>
      question && isBroken
        ? planAndEvaluateFlow(flow, question.sourceId, question.targetId, intact, { emailMode })
        : null,
    [question, isBroken, flow, intact, emailMode]
  );

  // The exchanges of the intact drawing are evaluated once per drawing and
  // kind of exchange, not at every failure
  const baseline = useMemo(
    () => (isBroken ? evaluateAllFlows(intact, { flow, emailMode }) : null),
    [isBroken, intact, flow, emailMode]
  );
  const impact = useMemo(
    () => (baseline ? assessImpact(intact, failures, { flow, emailMode }, baseline) : null),
    [baseline, intact, failures, flow, emailMode]
  );

  // Another canvas came on screen: question and failures belonged to the old one
  const seenRevision = useRef(canvasRevision);
  useEffect(() => {
    if (seenRevision.current === canvasRevision) return;
    seenRevision.current = canvasRevision;
    usePresentationStore.getState().resetCanvasState();
  }, [canvasRevision]);

  // A device or a cable removed (from the terminal): forget it
  useEffect(() => {
    usePresentationStore.getState().prune(
      devices.map((device) => device.id),
      connections.map((connection) => connection.id)
    );
  }, [devices, connections]);

  // The way of the answer, for the canvas to mark
  useEffect(() => {
    usePresentationStore.getState().setRoute(routeOf(answer));
  }, [answer]);

  // Set the packet off whenever the question or the failures change, or the
  // presenter asks to see it again. An answer that changes for another reason
  // (the drawing edited from the terminal) is shown without a new run.
  const playKey = [
    sourceId,
    targetId,
    flow,
    failedDevices.join(','),
    failedConnections.join(','),
    replaySeq,
  ].join('|');
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (played.current === playKey) return;
    played.current = playKey;
    const simulation = useSimulationStore.getState();
    if (answer && answer.animationPath.length >= 2) {
      simulation.startSimulation(answer.animationPath, flow, answer.animationLinks);
    } else if (simulation.isRunning) {
      simulation.stopSimulation();
    }
  }, [playKey, answer, flow]);

  // The run on the canvas is this answer's when it travels on this very path
  const reached = useSimulationStore((state) => {
    if (!answer || !state.isRunning || state.path !== answer.animationPath) return null;
    const next = state.currentHop + 1;
    return state.activeDeviceId === state.path[next] ? next : state.currentHop;
  });

  return { answer, intactAnswer, impact, reached };
}
