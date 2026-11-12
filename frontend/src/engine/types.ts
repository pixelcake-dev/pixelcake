/**
 * Network Engine — Types
 *
 * The engine is a PURE TypeScript module: no React, no Zustand, no side
 * effects. It interprets the topology data the canvas already captures
 * (addresses, routes, VLANs, port state, firewall rules and zones) and
 * produces verdicts with human-readable reasons. Nothing in it depends on the
 * browser, so it can run anywhere unchanged, and its inputs map 1:1 to the
 * future Terraform export.
 */

import type { NetworkDevice, NetworkConnection } from '@/types';

/** Immutable snapshot of the topology the engine evaluates against */
export interface Topology {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
}

/** Outcome of a reachability evaluation */
export type Verdict = 'success' | 'blocked' | 'unreachable' | 'error';

/** What happened at a single device along the path */
export interface HopResult {
  deviceId: string;
  label: string;
  deviceType: string;
  /** forwarded = transit hop, delivered = final destination, blocked = drop */
  status: 'forwarded' | 'delivered' | 'blocked';
  /** Short English note, e.g. "routed to subnet 10.0.2.0" or "VLAN 10 ok" */
  note?: string;
}

export interface TraceResult {
  verdict: Verdict;
  /** Hops in order, source first. Empty on 'error'. */
  hops: HopResult[];
  /** Human-readable English reason, present when verdict !== 'success' */
  failureReason?: string;
  /** Non-fatal observations (e.g. "firewall has no zone config: allowed") */
  notes: string[];
  /** Address the packet was sent from (set once both endpoints are valid) */
  sourceIp?: string;
  /** Address the packet was sent to (set once both endpoints are valid) */
  targetIp?: string;
}

export interface PingResult extends TraceResult {
  /** Simulated round-trip time in ms (derived from hop count), when successful */
  rttMs?: number;
}

/**
 * Endpoint resolution: a terminal argument ("web-01", "192.168.1.5") resolved
 * against the topology by label (case-insensitive), device id, device.ip or
 * any enabled NIC ip.
 */
export interface ResolvedEndpoint {
  device: NetworkDevice;
  /** The concrete IP the query matched or the device's primary IP ('' if none) */
  ip: string;
}
