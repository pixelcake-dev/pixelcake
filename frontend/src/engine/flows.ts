/**
 * Network Engine — Flow models
 *
 * Turns a FlowModelType ('ping' | 'email' | 'web' | 'download') into a plan of
 * one or more LEGS and evaluates each leg with traceRoute. This gives every
 * model realistic semantics instead of a single BFS line:
 *
 *  - ping:     request src→dst, then reply dst→src (asymmetric configs surface)
 *  - web:      HTTP request src→dst, HTTP response dst→src
 *  - download: download request src→dst, download data dst→src (a download
 *              is web traffic to a firewall)
 *  - email:    src→relay, relay→dst — the relay depends on the email mode:
 *              'internal' uses the nearest mail server, 'cloud' uses the
 *              nearest internet exit (Internet/Cloud/WAN/ISP device), and
 *              'auto' (default) prefers internal, falling back to cloud.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { EmailMode, FlowModelType, NetworkDevice, ServiceName } from '@/types';
import type { Topology, TraceResult, Verdict } from './types';
import { buildAdjacency } from './topology';
import { traceRoute } from './trace';
import type { TraceOptions } from './trace';
import { isPrivateAddress, matchForward, publications } from './nat';
import { ownedAddresses } from './addressing';

/** One evaluated segment of a flow (e.g. the SMTP submit leg of an email) */
export interface FlowLeg {
  fromId: string;
  toId: string;
  /** What this leg represents, e.g. 'SMTP submit', 'HTTP response' */
  purpose: string;
  trace: TraceResult;
}

/** Aggregate outcome of a multi-leg flow evaluation */
export interface FlowResult {
  /** 'success' only when ALL legs succeed */
  verdict: Verdict;
  /** Legs in evaluation order; evaluation stops after the first failing leg */
  legs: FlowLeg[];
  /**
   * Device-id sequence across legs for the canvas animation: concatenated leg
   * hop ids with the duplicated joint node between consecutive legs dropped.
   * A failing leg contributes its hops up to the block.
   */
  animationPath: string[];
  /**
   * The cables the animation travels on: `animationLinks[i]` is the id of the
   * connection between `animationPath[i]` and `animationPath[i + 1]` ('' when
   * the engine does not know it). Two devices can be joined by more than one
   * cable, and only the engine knows which one the packet took.
   */
  animationLinks: string[];
  /** Failure of the failing leg, prefixed with its purpose */
  failureReason?: string;
  /** Aggregated leg notes, each prefixed with the leg purpose */
  notes: string[];
}

/** Substrings (lowercase) that mark a device as server-like for web/download */
const SERVER_LIKE_TOKENS = ['server', 'web', 'database', 'cloud', 'mail', 'proxy', 'vps'];

/** Case-insensitive haystack of the identity fields the classifiers match on */
function identityText(device: NetworkDevice): string {
  return `${device.type} ${device.templateId ?? ''}`.toLowerCase();
}

/** True when the device can plausibly serve web/download traffic */
function isServerLike(device: NetworkDevice): boolean {
  const text = identityText(device);
  return SERVER_LIKE_TOKENS.some(token => text.includes(token));
}

/** True when the device is a mail server (templateId or type contains 'mail') */
function isMailServer(device: NetworkDevice): boolean {
  return identityText(device).includes('mail');
}

/** Substrings (lowercase) that mark a device as the network's internet exit */
const INTERNET_EDGE_TOKENS = ['internet', 'cloud', 'wan', 'isp'];

/** True when the device is an internet exit (type, templateId or label match) */
function isInternetEdge(device: NetworkDevice): boolean {
  const text = `${identityText(device)} ${device.label.toLowerCase()}`;
  return INTERNET_EDGE_TOKENS.some(token => text.includes(token));
}

/** BFS hop distances from `sourceId` to every reachable device */
function bfsDistances(sourceId: string, topo: Topology): Map<string, number> {
  const adjacency = buildAdjacency(topo);
  const distances = new Map<string, number>([[sourceId, 0]]);
  const queue: string[] = [sourceId];
  let head = 0;
  while (head < queue.length) {
    const currentId = queue[head++];
    const currentDistance = distances.get(currentId) ?? 0;
    for (const { neighborId } of adjacency.get(currentId) ?? []) {
      if (distances.has(neighborId)) continue;
      distances.set(neighborId, currentDistance + 1);
      queue.push(neighborId);
    }
  }
  return distances;
}

/** A leg to evaluate: endpoints plus the purpose used to prefix its output */
interface LegPlan {
  fromId: string;
  toId: string;
  purpose: string;
  /** What the leg is to a firewall */
  service: ServiceName;
  /** Address to aim at, when not the primary address of the device */
  targetIp?: string;
  /**
   * This leg answers the previous one (ping reply, HTTP response). It is only
   * evaluated when that leg succeeded, so firewalls treat it as the return
   * traffic of an allowed flow.
   */
  returnTraffic?: boolean;
}

/** Terminal FlowResult for plan-level errors (no legs evaluated) */
function flowError(failureReason: string): FlowResult {
  return {
    verdict: 'error',
    legs: [],
    animationPath: [],
    animationLinks: [],
    failureReason,
    notes: [],
  };
}

/**
 * One packet from a device to another, aimed as its sender would aim it.
 *
 * A device behind NAT is not reached from outside at its own address: the
 * Internet does not carry it. Who is outside aims at the device's own public
 * address, when it has one (a firewall named by the address it has inside),
 * else at the address a port forward publishes it at. The note says which.
 *
 * An address given in `options.targetIp` is the address aimed at, and nothing
 * is tried in its place; a reply goes where its request came from.
 */
export function traceToDevice(
  fromId: string,
  toId: string,
  topo: Topology,
  options: TraceOptions = {}
): { trace: TraceResult; note?: string } {
  const trace = traceRoute(fromId, toId, topo, options);
  if (
    options.returnTraffic ||
    options.targetIp !== undefined ||
    trace.unroutable?.role !== 'destination'
  ) {
    return { trace };
  }

  const target = topo.devices.find(d => d.id === toId);
  const name = target?.label ?? toId;
  const own = target ? ownedAddresses(target).find(ip => !isPrivateAddress(ip)) : undefined;
  if (own) {
    return {
      trace: traceRoute(fromId, toId, topo, { ...options, targetIp: own }),
      note: `${name} is reached from outside at ${own}, its public address`,
    };
  }
  const [published] = publications(topo, trace.unroutable.address, options.service ?? 'ping');
  if (published) {
    return {
      trace: traceRoute(fromId, toId, topo, { ...options, targetIp: published.address }),
      note:
        `${name} is behind NAT: reached at ${published.address}, where ` +
        `${published.device.label} publishes it (port forward ${published.number})`,
    };
  }
  return { trace };
}

/**
 * Evaluate planned legs in order with traceRoute, stopping after the first
 * failing leg, and aggregate hops/notes/failure into a FlowResult.
 */
function evaluateLegs(plans: LegPlan[], topo: Topology, planNotes: string[]): FlowResult {
  const legs: FlowLeg[] = [];
  const animationPath: string[] = [];
  const animationLinks: string[] = [];
  const notes: string[] = [...planNotes];

  let previous: TraceResult | undefined;
  for (const plan of plans) {
    // A reply goes back to the address the request was seen to come from,
    // and leaves from the address the request ended up at: with NAT on the
    // way these are not the two the request was sent with. The NAT devices
    // translate it back by what they remember of the request
    const reply = plan.returnTraffic ? previous : undefined;
    const options: TraceOptions = {
      returnTraffic: plan.returnTraffic,
      service: plan.service,
      targetIp: reply ? (reply.seenSourceIp ?? reply.sourceIp) : plan.targetIp,
      sourceIp: reply ? (reply.reachedIp ?? reply.targetIp) : undefined,
      natState: reply?.translations,
    };
    // The reply leaves from the device the request was delivered to
    const delivered = reply?.verdict === 'success' ? reply.hops[reply.hops.length - 1] : undefined;
    const fromId = delivered?.deviceId ?? plan.fromId;
    // (a device behind NAT is aimed at where it is reached from outside)
    const { trace, note } = traceToDevice(fromId, plan.toId, topo, options);
    if (note) notes.push(`${plan.purpose}: ${note}`);
    previous = trace;
    legs.push({ fromId, toId: plan.toId, purpose: plan.purpose, trace });

    for (const hop of trace.hops) {
      // Consecutive legs share their joint device (leg N ends where leg N+1
      // starts): skip it so the animation does not stutter on the joint.
      if (animationPath[animationPath.length - 1] === hop.deviceId) continue;
      if (animationPath.length > 0) animationLinks.push(hop.viaConnectionId ?? '');
      animationPath.push(hop.deviceId);
    }
    for (const note of trace.notes) {
      notes.push(`${plan.purpose}: ${note}`);
    }

    if (trace.verdict !== 'success') {
      return {
        verdict: trace.verdict,
        legs,
        animationPath,
        animationLinks,
        failureReason: `${plan.purpose}: ${trace.failureReason ?? 'failed'}`,
        notes,
      };
    }
  }

  return { verdict: 'success', legs, animationPath, animationLinks, notes };
}

/**
 * Candidate with the fewest BFS hops from `sourceId`. Unreachable candidates
 * lose; ties resolve to the first in device order (strict < keeps it).
 * Assumes `candidates` is non-empty.
 */
function nearestByHops(
  candidates: NetworkDevice[],
  sourceId: string,
  topo: Topology
): NetworkDevice {
  const distances = bfsDistances(sourceId, topo);
  let chosen = candidates[0];
  let chosenDistance = distances.get(chosen.id) ?? Infinity;
  for (const candidate of candidates.slice(1)) {
    const distance = distances.get(candidate.id) ?? Infinity;
    if (distance < chosenDistance) {
      chosen = candidate;
      chosenDistance = distance;
    }
  }
  return chosen;
}

/** How email routes through a relay: classifier plus per-leg purposes */
interface EmailRelayKind {
  isRelay: (device: NetworkDevice) => boolean;
  submitPurpose: string;
  deliveryPurpose: string;
}

/** Internal email: relay through a mail server */
const INTERNAL_RELAY: EmailRelayKind = {
  isRelay: isMailServer,
  submitPurpose: 'SMTP submit',
  deliveryPurpose: 'delivery',
};

/** Cloud email: relay through the internet exit (Internet/Cloud/WAN/ISP) */
const CLOUD_RELAY: EmailRelayKind = {
  isRelay: isInternetEdge,
  submitPurpose: 'SMTP to cloud provider',
  deliveryPurpose: 'cloud delivery',
};

const NO_MAIL_SERVER_ERROR =
  'no mail server in the network — add a Mail Server device to deliver email';
const NO_INTERNET_EXIT_ERROR =
  'no internet exit in the network — cloud email needs an Internet gateway or Cloud device';
const NO_EMAIL_RELAY_ERROR =
  'no mail server and no internet exit — add a Mail Server device or an Internet/Cloud gateway (or set the email mode in the network settings)';

/**
 * Plan src→relay→dst through the nearest relay (BFS hops from source) of the
 * given kind, or a single leg when an endpoint already IS a relay (target →
 * submit purpose, source → delivery purpose). Returns undefined when the
 * topology has no relay of this kind so the caller can fall back ('auto') or
 * emit a mode-specific error. `note` builds an extra plan note from the
 * device the flow relays through (used by the auto→cloud fallback).
 */
function planEmailViaRelay(
  sourceId: string,
  targetId: string,
  topo: Topology,
  kind: EmailRelayKind,
  note?: (relay: NetworkDevice) => string
): FlowResult | undefined {
  const source = topo.devices.find(d => d.id === sourceId);
  const target = topo.devices.find(d => d.id === targetId);

  // Special cases: an endpoint already is the relay → single leg.
  if (target && kind.isRelay(target)) {
    return evaluateLegs(
      [{ fromId: sourceId, toId: targetId, purpose: kind.submitPurpose, service: 'email' }],
      topo,
      note ? [note(target)] : []
    );
  }
  if (source && kind.isRelay(source)) {
    return evaluateLegs(
      [{ fromId: sourceId, toId: targetId, purpose: kind.deliveryPurpose, service: 'email' }],
      topo,
      note ? [note(source)] : []
    );
  }

  const relays = topo.devices.filter(kind.isRelay);
  if (relays.length === 0) return undefined;

  const chosen = nearestByHops(relays, sourceId, topo);
  return evaluateLegs(
    [
      { fromId: sourceId, toId: chosen.id, purpose: kind.submitPurpose, service: 'email' },
      { fromId: chosen.id, toId: targetId, purpose: kind.deliveryPurpose, service: 'email' },
    ],
    topo,
    note ? [note(chosen)] : []
  );
}

/** Email plan: the relay kind depends on the configured email mode */
function planEmail(
  sourceId: string,
  targetId: string,
  topo: Topology,
  emailMode: EmailMode
): FlowResult {
  switch (emailMode) {
    case 'internal':
      return (
        planEmailViaRelay(sourceId, targetId, topo, INTERNAL_RELAY) ??
        flowError(NO_MAIL_SERVER_ERROR)
      );
    case 'cloud':
      return (
        planEmailViaRelay(sourceId, targetId, topo, CLOUD_RELAY) ??
        flowError(NO_INTERNET_EXIT_ERROR)
      );
    case 'auto':
      return (
        planEmailViaRelay(sourceId, targetId, topo, INTERNAL_RELAY) ??
        planEmailViaRelay(
          sourceId,
          targetId,
          topo,
          CLOUD_RELAY,
          relay => `no internal mail server: using cloud email via ${relay.label}`
        ) ??
        flowError(NO_EMAIL_RELAY_ERROR)
      );
  }
}

/**
 * The device that answers a request aimed at `targetIp`. An address a device
 * publishes for the service belongs to that device, and what arrives for it
 * is sent on: the flow is planned to, and answered from, the device the port
 * forward names. The note says so.
 */
function answering(
  targetId: string,
  targetIp: string | undefined,
  service: ServiceName,
  topo: Topology
): { targetId: string; notes: string[] } {
  if (targetIp === undefined) return { targetId, notes: [] };
  const owner = topo.devices.find(d => ownedAddresses(d).includes(targetIp));
  const match = owner ? matchForward(owner, service, targetIp) : undefined;
  const inside = match
    ? topo.devices.find(d => ownedAddresses(d).includes(match.forward.to))
    : undefined;
  if (!owner || !match || !inside || inside.id === owner.id) return { targetId, notes: [] };
  return {
    targetId: inside.id,
    notes: [
      `${targetIp} is ${owner.label}, which forwards ${service} to ${inside.label} ` +
        `(port forward ${match.number})`,
    ],
  };
}

/** Request/response plan shared by web and download */
function planRequestResponse(
  sourceId: string,
  targetId: string,
  topo: Topology,
  requestPurpose: string,
  responsePurpose: string,
  targetIp: string | undefined
): FlowResult {
  const aimed = answering(targetId, targetIp, 'web', topo);
  const target = topo.devices.find(d => d.id === aimed.targetId);
  const planNotes: string[] = [...aimed.notes];
  if (target && !isServerLike(target)) {
    planNotes.push(`target ${target.label} is not a server-type device`);
  }
  return evaluateLegs(
    [
      { fromId: sourceId, toId: aimed.targetId, purpose: requestPurpose, service: 'web', targetIp },
      {
        fromId: aimed.targetId,
        toId: sourceId,
        purpose: responsePurpose,
        service: 'web',
        returnTraffic: true,
      },
    ],
    topo,
    planNotes
  );
}

/**
 * Plan the legs a flow model implies and evaluate them against the topology.
 * Endpoint validation (missing device, missing/invalid IP) is delegated to
 * traceRoute and propagates through the first leg.
 * `options.emailMode` selects the email relay strategy (default 'auto').
 * `options.targetIp` aims a ping, web or download request at one address of
 * the target instead of its primary one (an email goes through its relay).
 */
export function planAndEvaluateFlow(
  model: FlowModelType,
  sourceId: string,
  targetId: string,
  topo: Topology,
  options?: { emailMode?: EmailMode; targetIp?: string }
): FlowResult {
  if (sourceId === targetId) {
    return flowError('source and target are the same device');
  }

  switch (model) {
    case 'ping': {
      const aimed = answering(targetId, options?.targetIp, 'ping', topo);
      return evaluateLegs(
        [
          {
            fromId: sourceId,
            toId: aimed.targetId,
            purpose: 'request',
            service: 'ping',
            targetIp: options?.targetIp,
          },
          {
            fromId: aimed.targetId,
            toId: sourceId,
            purpose: 'reply',
            service: 'ping',
            returnTraffic: true,
          },
        ],
        topo,
        aimed.notes
      );
    }
    case 'web':
      return planRequestResponse(
        sourceId,
        targetId,
        topo,
        'HTTP request',
        'HTTP response',
        options?.targetIp
      );
    case 'download':
      return planRequestResponse(
        sourceId,
        targetId,
        topo,
        'download request',
        'download data',
        options?.targetIp
      );
    case 'email':
      return planEmail(sourceId, targetId, topo, options?.emailMode ?? 'auto');
  }
}
