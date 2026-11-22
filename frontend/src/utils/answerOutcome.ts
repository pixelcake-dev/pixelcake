/**
 * Where an answer of the engine ends on the canvas: the device that
 * answers, or the one the question stops on. It is what a run of the packet
 * is told when it starts (store/simulationStore), so that the device says
 * it with its lamp once the packet has got there.
 *
 * Pure: no React, no stores.
 */

import type { FlowResult, TraceResult } from '@/engine';
import type { SimulationOutcome } from '@/store/simulationStore';
import type { FlowModelType } from '@/types';

/** The end of one trace: its last device, when the packet was delivered there or dropped there */
export function traceOutcome(trace: TraceResult): SimulationOutcome | null {
  const last = trace.hops[trace.hops.length - 1];
  if (!last) return null;
  if (trace.verdict === 'success') return { arrives: true, deviceId: last.deviceId };
  return last.status === 'blocked' ? { arrives: false, deviceId: last.deviceId } : null;
}

/**
 * The end of a whole exchange. One that arrives ends on the device that
 * answered: the far end of its first leg for a ping, a page, a file (asked
 * there, and the reply came back), of its last leg for a mail: the recipient,
 * which the mail it fetched comes back to (the server, for a mail sent to a
 * server). One that does not arrive ends where its last leg was dropped.
 */
export function flowOutcome(answer: FlowResult, flow: FlowModelType): SimulationOutcome | null {
  const last = answer.legs[answer.legs.length - 1];
  if (!last) return null;
  if (answer.verdict === 'success') {
    const reached = flow === 'email' ? last : answer.legs[0];
    return { arrives: true, deviceId: reached.toId };
  }
  const end = traceOutcome(last.trace);
  return end && !end.arrives ? end : null;
}
