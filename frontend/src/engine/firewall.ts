/**
 * Network Engine — Firewall policy
 *
 * Decides whether a firewall lets a packet through, given the interface it
 * came in from and the one it leaves by:
 *
 *  1. the device's rules, top to bottom: the first enabled rule whose
 *     service, source and destination all match decides;
 *  2. when no rule matches, the zone policy: traffic towards a more trusted
 *     zone is denied (untrust → trust, untrust → dmz, dmz → trust), anything
 *     else is allowed;
 *  3. firewalls keep state: the reply to a flow the firewall itself saw, and
 *     allowed, passes whatever the rules say about new flows in that
 *     direction. A reply whose request went another way is, to this
 *     firewall, a packet like any other: its rules and zones decide.
 *
 * A router filters too when it carries rules: its access list. They are read
 * the same way; a router has no zones, and its list ends, as on real routers,
 * with an implicit deny: once it has a rule switched on, what no rule allows
 * is blocked. A router with no rules, or with all of them switched off,
 * filters nothing.
 *
 * Zones are a property of the firewall's ports, so a rule naming a zone can
 * only be evaluated when the link is attached to a port that is in a zone:
 * otherwise the rule is skipped and the verdict says which of the two is
 * missing.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { FirewallRule, NetworkDevice, Port, ServiceName } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
import { interfacePhrase } from './interfaces';
import type { DeviceInterface } from './interfaces';
import { networkContains, parseNetwork } from './addressing';

type Zone = NonNullable<Port['securityZone']>;

const ZONES: readonly string[] = ['trust', 'untrust', 'dmz'];

/** Zone transitions denied (ingress→egress) when no rule decides */
const DENIED_ZONE_TRANSITIONS = new Set(['untrust→trust', 'untrust→dmz', 'dmz→trust']);

/** The part of a packet a firewall looks at */
export interface Packet {
  sourceIp: string;
  destinationIp: string;
  service: ServiceName;
  /** The packet answers a flow that was just allowed in the other direction */
  returnTraffic: boolean;
  /**
   * For a reply: the devices its request went through. A firewall remembers
   * the flows it has seen itself, so the reply passes as a reply only the
   * firewalls in this set; any other judges it as a new packet. Undefined:
   * the request is taken to have crossed every firewall the reply meets.
   */
  requestPath?: ReadonlySet<string>;
}

/** What a firewall decided, in words fit for a trace */
export interface FirewallVerdict {
  allowed: boolean;
  /** The note of an allowed packet, or the reason of a denied one */
  text: string;
  /** Rules that could not be evaluated, each explained */
  skipped: string[];
}

/** True when the device is a firewall; anything else that filters is a router with rules */
function isFirewall(device: NetworkDevice): boolean {
  return device.type.toLowerCase().includes('firewall');
}

/** True when the device filters traffic: a firewall, or anything carrying rules */
export function filtersTraffic(device: NetworkDevice): boolean {
  return isFirewall(device) || (device.firewallRules ?? []).length > 0;
}

/** True when the text can be the source or destination of a rule */
export function isValidRuleEndpoint(text: string): boolean {
  const value = text.trim().toLowerCase();
  return value === 'any' || ZONES.includes(value) || parseNetwork(value) !== undefined;
}

/** A rule in the words of the terminal: `allow web from untrust to dmz` */
export function describeRule(rule: FirewallRule): string {
  return `${rule.action} ${rule.service} from ${rule.source} to ${rule.destination}`;
}

/** Outcome of matching one side of a rule: yes, no, or "needs a zone we do not know" */
type SideMatch = 'match' | 'no-match' | 'unknown-zone';

function matchSide(selector: string, ip: string, zone: Zone | undefined): SideMatch {
  const value = selector.trim().toLowerCase();
  if (value === 'any') return 'match';
  if (ZONES.includes(value)) {
    if (zone === undefined) return 'unknown-zone';
    return zone === value ? 'match' : 'no-match';
  }
  const network = parseNetwork(value);
  if (!network || !isValidIP(ip)) return 'no-match';
  return networkContains(network, ip) ? 'match' : 'no-match';
}

function zoneOf(iface: DeviceInterface | undefined): Zone | undefined {
  return iface?.kind === 'port' ? iface.port.securityZone : undefined;
}

/** Why one side of a crossing has no zone: the link end is not attached, or its interface is in none */
function whyNoZone(iface: DeviceInterface | undefined): string {
  return iface ? `${interfacePhrase(iface)} is in no zone` : 'the link is not attached to a port';
}

/**
 * The firewall's decision on a packet crossing `device` from `ingress` to
 * `egress` (either may be unknown: a link end not attached to a port).
 * Undefined when the device does not filter traffic at all.
 */
export function evaluateFirewall(
  device: NetworkDevice,
  ingress: DeviceInterface | undefined,
  egress: DeviceInterface | undefined,
  packet: Packet
): FirewallVerdict | undefined {
  if (!filtersTraffic(device)) return undefined;

  const rules = (device.firewallRules ?? []).filter(rule => rule.enabled !== false);
  const numberOf = (rule: FirewallRule) => (device.firewallRules ?? []).indexOf(rule) + 1;
  const ingressZone = zoneOf(ingress);
  const egressZone = zoneOf(egress);
  const skipped: string[] = [];
  /** `firewall FW-1`, or `router R-1` for a router that carries rules */
  const name = `${isFirewall(device) ? 'firewall' : 'router'} ${device.label}`;

  // What the policy says about a NEW flow
  let decision: { allowed: boolean; text: string; replyText: string } | undefined;

  for (const rule of rules) {
    if (rule.service !== 'any' && rule.service !== packet.service) continue;
    const source = matchSide(rule.source, packet.sourceIp, ingressZone);
    const destination = matchSide(rule.destination, packet.destinationIp, egressZone);
    if (source === 'no-match' || destination === 'no-match') continue;
    if (source === 'unknown-zone' || destination === 'unknown-zone') {
      const why = [
        ...(source === 'unknown-zone' ? [whyNoZone(ingress)] : []),
        ...(destination === 'unknown-zone' ? [whyNoZone(egress)] : []),
      ].filter((reason, index, all) => all.indexOf(reason) === index);
      skipped.push(
        `${name}: rule ${numberOf(rule)} names a zone` +
          (why.length === 1 ? ` and ${why[0]}` : `, ${why[0]} and ${why[1]}`) +
          ': skipped'
      );
      continue;
    }
    const what = `rule ${numberOf(rule)} (${describeRule(rule)})`;
    decision = {
      allowed: rule.action === 'allow',
      text: `${name}: ${rule.action === 'allow' ? 'allowed' : 'denied'} by ${what}`,
      replyText: `${name}: reply to an allowed flow passes ${what}`,
    };
    break;
  }

  if (!decision) {
    const hasRules = rules.length > 0;
    if (ingressZone && egressZone) {
      const transition = `${ingressZone} → ${egressZone}`;
      const denied = DENIED_ZONE_TRANSITIONS.has(`${ingressZone}→${egressZone}`);
      if (hasRules) {
        const policy = `${name}: no rule matches, zone policy ${transition}`;
        decision = {
          allowed: !denied,
          text: `${policy} ${denied ? 'denied' : 'allowed'}`,
          replyText: `${policy} allowed (reply to an allowed flow)`,
        };
      } else {
        decision = {
          allowed: !denied,
          text: denied
            ? `firewall policy on ${device.label}: ${transition} denied`
            : `firewall policy: ${transition} allowed`,
          replyText: `firewall policy: ${transition} allowed (reply to an allowed flow)`,
        };
      }
    } else if (!isFirewall(device) && hasRules) {
      // A router has no zones: its access list ends with an implicit deny,
      // as on real routers. What no rule allows is blocked
      decision = {
        allowed: false,
        text: `${name}: no rule allows it`,
        replyText: `${name}: no rule matches, allowed as the reply to an allowed flow`,
      };
    } else {
      // (a router whose rules are all switched off filters nothing, as one with none)
      const text = !isFirewall(device)
        ? `${name}: no rule is switched on: allowed`
        : hasRules
          ? `${name}: no rule matches and no zone binding: allowed`
          : `${name} has no zone binding: allowed`;
      decision = { allowed: true, text, replyText: text };
    }
  }

  if (!decision.allowed && packet.returnTraffic) {
    // A firewall knows the replies to the flows it has seen itself, and only those
    const sawRequest = packet.requestPath?.has(device.id) ?? true;
    if (sawRequest) return { allowed: true, text: decision.replyText, skipped };
    return { allowed: false, text: `${decision.text}, and it never saw the request`, skipped };
  }
  return { allowed: decision.allowed, text: decision.text, skipped };
}
