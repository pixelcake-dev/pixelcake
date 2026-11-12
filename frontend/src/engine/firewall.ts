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
 *  3. firewalls keep state: the reply to a flow that was allowed passes
 *     whatever the rules say about new flows in that direction.
 *
 * Zones are a property of the firewall's ports, so a rule naming a zone can
 * only be evaluated when the link is attached to a port: otherwise the rule
 * is skipped and the verdict says so.
 *
 * Pure and deterministic: no React, no Zustand, no side effects.
 */

import type { FirewallRule, NetworkDevice, Port, ServiceName } from '@/types';
import { isValidIP } from '@/utils/ipHelpers';
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
}

/** What a firewall decided, in words fit for a trace */
export interface FirewallVerdict {
  allowed: boolean;
  /** The note of an allowed packet, or the reason of a denied one */
  text: string;
  /** Rules that could not be evaluated, each explained */
  skipped: string[];
}

/** True when the device filters traffic: a firewall, or anything carrying rules */
export function filtersTraffic(device: NetworkDevice): boolean {
  return (
    device.type.toLowerCase().includes('firewall') || (device.firewallRules ?? []).length > 0
  );
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

  // What the policy says about a NEW flow
  let decision: { allowed: boolean; text: string; replyText: string } | undefined;

  for (const rule of rules) {
    if (rule.service !== 'any' && rule.service !== packet.service) continue;
    const source = matchSide(rule.source, packet.sourceIp, ingressZone);
    const destination = matchSide(rule.destination, packet.destinationIp, egressZone);
    if (source === 'no-match' || destination === 'no-match') continue;
    if (source === 'unknown-zone' || destination === 'unknown-zone') {
      skipped.push(
        `firewall ${device.label}: rule ${numberOf(rule)} names a zone and the link is not ` +
          `attached to a port: skipped`
      );
      continue;
    }
    const what = `rule ${numberOf(rule)} (${describeRule(rule)})`;
    decision = {
      allowed: rule.action === 'allow',
      text: `firewall ${device.label}: ${rule.action === 'allow' ? 'allowed' : 'denied'} by ${what}`,
      replyText: `firewall ${device.label}: reply to an allowed flow passes ${what}`,
    };
    break;
  }

  if (!decision) {
    const hasRules = rules.length > 0;
    if (ingressZone && egressZone) {
      const transition = `${ingressZone} → ${egressZone}`;
      const denied = DENIED_ZONE_TRANSITIONS.has(`${ingressZone}→${egressZone}`);
      if (hasRules) {
        const policy = `firewall ${device.label}: no rule matches, zone policy ${transition}`;
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
    } else {
      const text = hasRules
        ? `firewall ${device.label}: no rule matches and no zone binding: allowed`
        : `firewall ${device.label} has no zone binding: allowed`;
      decision = { allowed: true, text, replyText: text };
    }
  }

  if (!decision.allowed && packet.returnTraffic) {
    return { allowed: true, text: decision.replyText, skipped };
  }
  return { allowed: decision.allowed, text: decision.text, skipped };
}
