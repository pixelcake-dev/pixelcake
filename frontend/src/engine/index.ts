/**
 * Network Engine — Public API
 *
 * Pure, deterministic reachability engine over the canvas topology.
 * No React, no Zustand, no side effects.
 */

export {
  buildAdjacency,
  resolveEndpoint,
  suggestEndpoint,
  primaryIp,
  primaryMask,
  primaryGateway,
  mirrorPrimaryNic,
  isL3Capable,
  isSwitchLike,
} from './topology';
export type { AdjacencyEntry } from './topology';

export {
  listInterfaces,
  interfacePhrase,
  connectionEndOn,
  isEndBound,
  boundInterface,
  bindingFor,
  interfaceLinks,
  usedInterfaceKeys,
  firstFreeInterface,
  requiresExplicitBinding,
  bindConnection,
  bindUnboundConnections,
  sanitizeBindings,
  normalizeBindings,
} from './interfaces';
export type {
  ConnectionEnd,
  ConnectionBinding,
  DeviceInterface,
  PortInterface,
  NicInterface,
  InterfaceLink,
} from './interfaces';

export { traceRoute, ping } from './trace';

export { planAndEvaluateFlow } from './flows';
export type { FlowLeg, FlowResult } from './flows';

export type {
  Topology,
  Verdict,
  HopResult,
  TraceResult,
  PingResult,
  ResolvedEndpoint,
} from './types';
