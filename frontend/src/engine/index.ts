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
  isL3Type,
  isSwitchLike,
  isInternetLike,
  forwardingRole,
} from './topology';
export type { AdjacencyEntry, ForwardingRole } from './topology';

export {
  DEFAULT_MASK,
  parseNetwork,
  formatNetwork,
  canonicalNetwork,
  networkContains,
  maskToPrefix,
  prefixToMask,
  l3Interfaces,
  primaryAddress,
  ownedAddresses,
  hasInterfaceAddresses,
  routingTable,
  lookupRoute,
} from './addressing';
export type { Network, L3Interface, RouteEntry, RouteKind } from './addressing';

export { DEFAULT_VLAN, isVlanAware, portVlanMode, describePortVlan } from './vlan';
export type { PortVlanMode } from './vlan';

export { evaluateFirewall, filtersTraffic, describeRule, isValidRuleEndpoint } from './firewall';
export type { Packet, FirewallVerdict } from './firewall';

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
export type { TraceOptions } from './trace';

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
