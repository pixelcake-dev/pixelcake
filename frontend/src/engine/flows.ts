/**
 * Network Engine — Flow models
 *
 * Turns a FlowModelType ('ping' | 'email' | 'web' | 'download') into a plan of
 * one or more LEGS and evaluates each leg with traceRoute. This gives every
 * model realistic semantics instead of a single BFS line:
 *
 *  - ping:     request src→dst, then reply dst→src (asymmetric configs surface);
 *              a device pinging itself answers without the packet leaving it
 *  - web:      HTTP request src→dst, HTTP response dst→src
 *  - download: download request src→dst, download data dst→src (a download
 *              is web traffic to a firewall)
 *  - email:    the sender submits the mail to its mail server, and the
 *              recipient fetches it from its own: a request to the server
 *              and the reply that brings the mail, as in real networks,
 *              where nobody pushes mail to a desk. Between two servers the
 *              mail is relayed, server to server (SMTP: a push). The servers
 *              depend on the email mode: 'internal' uses the mail server
 *              nearest to each end, 'cloud' the mailbox of a provider beyond
 *              the nearest internet exit (see internetExits, cloudMailbox),
 *              and 'auto' (default) prefers internal, falling back to cloud.
 *
 * A reply carries the devices its request went through: a firewall lets it
 * pass as a reply only when it saw the request (see ./firewall).
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type {
  EmailMode,
  FlowModelType,
  NetworkConnection,
  NetworkDevice,
  ServiceName,
} from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import type { Topology, TraceResult, Verdict } from './types';
import { buildAdjacency, isInternetLike, isPublicInternet } from './topology';
import { traceRoute } from './trace';
import type { TraceOptions } from './trace';
import { isPrivateAddress, matchForward, publications } from './nat';
import {
  DEFAULT_MASK,
  networkOf,
  numberToIp,
  ownedAddresses,
  parseNetwork,
  primaryAddress,
} from './addressing';
import type { Network } from './addressing';
import { withLeases } from './dhcp';
import { broadcastReach } from './l2';

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
   * connection between `animationPath[i]` and `animationPath[i + 1]`, '' where
   * a leg starts on another device than the one the leg before it ended on
   * (the recipient of a mail fetches it from its server): no cable, the
   * packet goes on from there. Two devices can be joined by more than one
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

/** Words (lowercase) that name a device as the network's internet exit */
const INTERNET_EXIT_WORDS = new Set(['internet', 'cloud', 'wan', 'isp']);

/** True when one of the words of the name (its runs of letters) names an internet exit */
function namedAsInternetExit(device: NetworkDevice): boolean {
  return (device.label.toLowerCase().match(/[a-z]+/g) ?? []).some(word => INTERNET_EXIT_WORDS.has(word));
}

/**
 * The devices cloud email can leave by. The mailbox of a provider is on the
 * Internet: when the drawing has an Internet symbol (see isPublicInternet),
 * the exits are the Internet symbols, and nothing else. A drawing without one
 * leaves by any Cloud symbol, by its kind (type or template), or by a device
 * whose name has one of the words Internet, Cloud, WAN or ISP on its own
 * (`ISP-Router`, `R-WAN`, `WAN1`; never `Display-1` or `Swan`). The nearest
 * of them is used.
 */
function internetExits(topo: Topology): NetworkDevice[] {
  const internet = topo.devices.filter(isPublicInternet);
  if (internet.length > 0) return internet;
  return topo.devices.filter(device => isInternetLike(device) || namedAsInternetExit(device));
}

/** A network kept for examples (RFC 5737): the outside, when the drawing names none */
const EXAMPLE_OUTSIDE = parseNetwork('192.0.2.0/24') as Network;

/** The highest address of `network` for a device that nobody has; undefined when there is none */
function highestFree(network: Network, owned: Set<string>): string | undefined {
  // (a network of one or two addresses has no room beside who is on it)
  if (network.prefix > 30) return undefined;
  const size = 2 ** (32 - network.prefix);
  for (let address = network.address + size - 2; address > network.address; address--) {
    const ip = numberToIp(address);
    if (!owned.has(ip)) return ip;
  }
  return undefined;
}

/** The mailbox beyond each exit ('' for none), for a drawing, for as long as the drawing is around */
const mailboxes = new WeakMap<
  NetworkDevice[],
  { connections: NetworkConnection[]; byExit: Map<string, string> }
>();

/**
 * Where the mailbox of a cloud provider is, beyond an Internet or Cloud
 * symbol that has no address of its own: an address of the outside, as the
 * drawing has it, that no device has. The packet is aimed there and routed
 * as anything for the Internet is; the symbol takes it (see ./l2), and what
 * is beyond it is not simulated. The outside is the network of the first
 * public address next to the symbol (on the same layer 2 network: a port of
 * the router or of the firewall that faces it, a device drawn on it), else
 * 192.0.2.0/24; the address is the highest of that network that nobody has.
 * It is worked out from the drawing with everything working, leases
 * included, so that a simulated failure does not move it.
 *
 * Undefined for a symbol that has an address, and for a device named for
 * the exit: each stands for the provider, at its own address.
 */
export function cloudMailbox(exit: NetworkDevice, topo: Topology): string | undefined {
  if (!isInternetLike(exit)) return undefined;
  const kept = mailboxes.get(topo.devices);
  const byExit =
    kept && kept.connections === topo.connections ? kept.byExit : new Map<string, string>();
  if (byExit !== kept?.byExit) mailboxes.set(topo.devices, { connections: topo.connections, byExit });
  const known = byExit.get(exit.id);
  if (known !== undefined) return known || undefined;

  // (the drawing as it is set: no failures, the leases filled in)
  const drawing = withLeases({ devices: topo.devices, connections: topo.connections });
  const symbol = drawing.devices.find(device => device.id === exit.id) ?? exit;
  let mailbox: string | undefined;
  if (!isValidIP(primaryAddress(symbol))) {
    const owned = new Set(drawing.devices.flatMap(device => ownedAddresses(device)));
    const outside = broadcastReach(drawing, symbol).listeners.flatMap(({ device, arrival }) => {
      const ip = arrival ? arrival.ip : device.ip;
      const mask = (arrival ? arrival.subnet : device.subnet) || DEFAULT_MASK;
      return isValidIP(ip) && !isPrivateAddress(ip) ? [networkOf(ip, mask)] : [];
    });
    for (const network of [...outside, EXAMPLE_OUTSIDE]) {
      mailbox = highestFree(network, owned);
      if (mailbox) break;
    }
  }
  byExit.set(exit.id, mailbox ?? '');
  return mailbox;
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
 * is tried in its place (a reply always has one: where its request came from).
 */
export function traceToDevice(
  fromId: string,
  toId: string,
  drawing: Topology,
  options: TraceOptions = {}
): { trace: TraceResult; note?: string } {
  // A card on DHCP has the address it is leased (see ./dhcp)
  const topo = withLeases(drawing);
  const trace = traceRoute(fromId, toId, topo, options);
  if (options.targetIp !== undefined || trace.unroutable?.role !== 'destination') {
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
    // translate it back by what they remember of the request, and a firewall
    // lets it pass as a reply only if the request went through it
    const reply = plan.returnTraffic ? previous : undefined;
    const options: TraceOptions = {
      returnTraffic: plan.returnTraffic,
      service: plan.service,
      targetIp: reply ? (reply.seenSourceIp ?? reply.sourceIp) : plan.targetIp,
      sourceIp: reply ? (reply.reachedIp ?? reply.targetIp) : undefined,
      natState: reply?.translations,
      requestPath: reply?.hops.map(hop => hop.deviceId),
    };
    // (a device behind NAT is aimed at where it is reached from outside)
    const { trace, note } = traceToDevice(plan.fromId, plan.toId, topo, options);
    if (note) notes.push(`${plan.purpose}: ${note}`);
    previous = trace;
    legs.push({ fromId: plan.fromId, toId: plan.toId, purpose: plan.purpose, trace });

    for (const hop of trace.hops) {
      // Consecutive legs mostly share their joint device (leg N ends where
      // leg N+1 starts): skip it so the animation does not stutter on the
      // joint. A leg that starts elsewhere (the fetch of a mail, on the
      // recipient) is joined by no cable: ''
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

/** Where a kind of email keeps the mail, and what its legs are called */
interface MailKind {
  /** The devices of the topology that keep the mail */
  servers: (topo: Topology) => NetworkDevice[];
  /** From the sender to its server */
  submitPurpose: string;
  /**
   * From the server of the sender to the server of the recipient, when they
   * are two: SMTP pushes it. None for the cloud: one provider, beyond any exit
   */
  relayPurpose?: string;
  /** From the recipient to its server, and the reply that brings the mail */
  fetchPurpose: string;
  fetchReplyPurpose: string;
  /** The address a leg to a server is aimed at; undefined: the server's own */
  aim?: (server: NetworkDevice, topo: Topology) => string | undefined;
}

/** Internal email: through the mail servers of the drawing */
const INTERNAL_MAIL: MailKind = {
  servers: topo => topo.devices.filter(isMailServer),
  submitPurpose: 'SMTP submit',
  relayPurpose: 'SMTP relay',
  fetchPurpose: 'fetch request',
  fetchReplyPurpose: 'fetch reply',
};

/** Cloud email: through the mailbox of a provider, past the internet exit (see internetExits) */
const CLOUD_MAIL: MailKind = {
  servers: internetExits,
  submitPurpose: 'SMTP to cloud provider',
  fetchPurpose: 'cloud fetch request',
  fetchReplyPurpose: 'cloud fetch reply',
  aim: cloudMailbox,
};

const NO_MAIL_SERVER_ERROR =
  'no mail server in the network — add a Mail Server device to deliver email';
const NO_INTERNET_EXIT_ERROR =
  'no internet exit in the network — cloud email needs an Internet gateway or Cloud device';
const NO_EMAIL_RELAY_ERROR =
  'no mail server and no internet exit — add a Mail Server device or an Internet/Cloud gateway (or set the email mode in the network settings)';

/**
 * Plan an email through the servers of one kind, and evaluate it: the sender
 * submits it to its server, the server relays it to the server of the
 * recipient when that is another one, and the recipient fetches it (a
 * request, then the reply that brings the mail back on its own way). The
 * server of a device is the device itself when it is one, else the one
 * with the fewest hops from it. A leg a device would send to itself is
 * left out: a server that sends a mail submits nothing, a server that
 * receives one fetches nothing. Returns undefined when the topology has no
 * server of this kind, so the caller can fall back ('auto') or emit a
 * mode-specific error. `note` builds an extra plan note from the server of
 * the sender (used by the auto→cloud fallback).
 */
function planEmailVia(
  sourceId: string,
  targetId: string,
  topo: Topology,
  kind: MailKind,
  note?: (server: NetworkDevice) => string
): FlowResult | undefined {
  const servers = kind.servers(topo);
  if (servers.length === 0) return undefined;
  const serverOf = (deviceId: string): NetworkDevice =>
    servers.find(server => server.id === deviceId) ?? nearestByHops(servers, deviceId, topo);
  const outgoing = serverOf(sourceId);
  const incoming = serverOf(targetId);

  const notes = note ? [note(outgoing)] : [];
  /** Where a leg to `server` is aimed; a mailbox beyond a symbol says so once */
  const aimAt = (server: NetworkDevice): string | undefined => {
    const address = kind.aim?.(server, topo);
    const said = `the cloud mailbox is beyond ${server.label}, at ${address}: the provider is not simulated`;
    if (address !== undefined && !notes.includes(said)) notes.push(said);
    return address;
  };

  const leg =(fromId: string, toId: string, purpose: string, targetIp?: string): LegPlan => ({
    fromId,
    toId,
    purpose,
    service: 'email',
    targetIp,
  });
  const plans: LegPlan[] = [];
  if (outgoing.id !== sourceId) {
    plans.push(leg(sourceId, outgoing.id, kind.submitPurpose, aimAt(outgoing)));
  }
  if (kind.relayPurpose && incoming.id !== outgoing.id) {
    plans.push(leg(outgoing.id, incoming.id, kind.relayPurpose));
  }
  if (incoming.id !== targetId) {
    plans.push(leg(targetId, incoming.id, kind.fetchPurpose, aimAt(incoming)), {
      ...leg(incoming.id, targetId, kind.fetchReplyPurpose),
      returnTraffic: true,
    });
  }
  // (a mail from one exit to another: sent to the provider, as it always was)
  if (plans.length === 0) {
    plans.push(leg(sourceId, targetId, kind.submitPurpose, aimAt(incoming)));
  }
  return evaluateLegs(plans, topo, notes);
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
        planEmailVia(sourceId, targetId, topo, INTERNAL_MAIL) ??
        flowError(NO_MAIL_SERVER_ERROR)
      );
    case 'cloud':
      return (
        planEmailVia(sourceId, targetId, topo, CLOUD_MAIL) ??
        flowError(NO_INTERNET_EXIT_ERROR)
      );
    case 'auto':
      return (
        planEmailVia(sourceId, targetId, topo, INTERNAL_MAIL) ??
        planEmailVia(
          sourceId,
          targetId,
          topo,
          CLOUD_MAIL,
          server => `no internal mail server: using cloud email via ${server.label}`
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

/**
 * A request and its reply for one service, between two devices: the plan of
 * a ping, and of a DNS lookup (see ./dns). `targetIp` aims the request at
 * one address of the target; an address the target publishes for the service
 * is answered by the device its port forward names.
 */
export function planRoundTrip(
  sourceId: string,
  targetId: string,
  topo: Topology,
  service: ServiceName,
  requestPurpose: string,
  replyPurpose: string,
  targetIp: string | undefined
): FlowResult {
  const aimed = answering(targetId, targetIp, service, topo);
  return evaluateLegs(
    [
      { fromId: sourceId, toId: aimed.targetId, purpose: requestPurpose, service, targetIp },
      { fromId: aimed.targetId, toId: sourceId, purpose: replyPurpose, service, returnTraffic: true },
    ],
    topo,
    aimed.notes
  );
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
  // A device that pings itself answers without the packet leaving it
  // (loopback), as a trace to itself does; the other exchanges need two
  if (sourceId === targetId && model !== 'ping') {
    return flowError('source and target are the same device');
  }

  switch (model) {
    case 'ping':
      return planRoundTrip(sourceId, targetId, topo, 'ping', 'request', 'reply', options?.targetIp);
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
