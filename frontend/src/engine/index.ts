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
  normalizeAddressing,
  isL3Capable,
  isL3Type,
  isSwitchLike,
  isInternetLike,
  isPublicInternet,
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
  isBackupRoute,
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

export {
  describeForward,
  doesNat,
  forwardAddress,
  forwardProblem,
  isPrivateAddress,
  matchForward,
  natAddress,
  publications,
} from './nat';
export type { NatTranslation, NumberedForward, Publication } from './nat';
export type { Unroutable } from './l2';

export {
  leaseOf,
  poolAt,
  poolOf,
  poolProblem,
  resolveDhcp,
  servesDhcp,
  suggestedPool,
  unservedOf,
  withLeases,
} from './dhcp';
export type {
  DhcpLease,
  DhcpPoolState,
  DhcpResolution,
  DhcpServerRef,
  DhcpUnserved,
  PoolProblem,
  PoolProblemCode,
  UnservedCause,
} from './dhcp';

export { planAndEvaluateFlow, traceToDevice } from './flows';
export type { FlowLeg, FlowResult } from './flows';

export { dnsCardOf, dnsRecordsOf, hostNameKey, isHostName, lookup, servesDns } from './dns';
export type { DnsLookup } from './dns';

export {
  hasFailures,
  withFailures,
  isDeviceDown,
  isLinkCut,
  linkDownReason,
  deadInterfaces,
} from './failures';

export {
  flowKey,
  impactEndpoints,
  flowPairs,
  evaluateFlowInto,
  evaluateAllFlows,
  compareFlows,
  assessImpact,
  sameWay,
} from './impact';
export { createMemo, withMemo } from './memo';
export type { EngineMemo } from './memo';
export type {
  ImpactOptions,
  ImpactReport,
  ImpactedFlow,
  EvaluatedFlow,
  FlowTable,
} from './impact';

export type {
  Topology,
  Failures,
  Verdict,
  HopResult,
  TraceResult,
  PingResult,
  ResolvedEndpoint,
} from './types';
