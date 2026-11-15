/**
 * Validation of what a person types for a static route, a firewall rule, a
 * port forward or a DNS record, with the reason for the forms that show it,
 * in the language of the interface at the moment of the call (a component
 * that shows a reason calls `useT()`, so that it is drawn again when the
 * language changes). The engine has its own tolerance (it leaves out what it
 * cannot read); the forms refuse it before it is saved.
 */

import { hostNameKey, isHostName, isValidRuleEndpoint, parseNetwork } from '@/engine';
import { isValidIP } from '@/utils/ipHelpers';
import { getT } from '@/i18n';
import type { DnsRecord, FirewallRule, Port, PortForward, StaticRoute } from '@/types';

/** True for a route row left completely empty: it is dropped on save, not an error */
export function isBlankRoute(route: StaticRoute): boolean {
  return !route.destination.trim() && !route.nextHop.trim();
}

/** What is wrong with a route as typed; undefined when it is fine (or blank) */
export function routeProblem(route: StaticRoute): string | undefined {
  if (isBlankRoute(route)) return undefined;
  const t = getT();
  if (!parseNetwork(route.destination)) return t.routes.problems.notANetwork(route.destination);
  if (!isValidIP(route.nextHop.trim())) return t.common.validation.notIPv4(route.nextHop);
  return undefined;
}

/** What is wrong with a rule as typed; undefined when it is fine */
export function ruleProblem(rule: FirewallRule): string | undefined {
  for (const [side, value] of [
    ['source', rule.source],
    ['destination', rule.destination],
  ] as const) {
    if (!isValidRuleEndpoint(value)) return getT().firewall.problems.invalidEndpoint(side, value);
  }
  return undefined;
}

/** True for a forward row whose address was never typed: it is dropped on save, not an error */
export function isBlankForward(forward: PortForward): boolean {
  return !forward.to.trim();
}

/**
 * What is wrong with a port forward as typed, given the ports of its device;
 * undefined when it is fine (or blank)
 */
export function forwardProblemText(forward: PortForward, ports: Port[]): string | undefined {
  if (isBlankForward(forward)) return undefined;
  const t = getT();
  const to = forward.to.trim();
  if (!isValidIP(to)) return t.common.validation.notIPv4(forward.to);
  const port = ports.find((candidate) => candidate.id === forward.port);
  if (!port?.ip || !isValidIP(port.ip)) return t.nat.problems.portWithoutAddress(forward.port);
  if (port.ip === to) return t.nat.problems.ownAddress(to, forward.port);
  return undefined;
}

/** True for a record row left completely empty: it is dropped on save, not an error */
export function isBlankRecord(record: DnsRecord): boolean {
  return !record.name.trim() && !record.address.trim();
}

/** A record as it is kept: the name as names are compared, the address trimmed */
export function tidyRecord(record: DnsRecord): DnsRecord {
  return { ...record, name: hostNameKey(record.name), address: record.address.trim() };
}

/**
 * What is wrong with a DNS record as typed, given the list it is in;
 * undefined when it is fine (or blank). A name may be in a list once: the
 * second row that carries it is the one refused.
 */
export function recordProblem(record: DnsRecord, records: DnsRecord[]): string | undefined {
  if (isBlankRecord(record)) return undefined;
  const t = getT();
  const { name, address } = tidyRecord(record);
  if (!name) return t.dns.problems.missingName;
  if (!isHostName(name)) return t.dns.problems.invalidName(record.name.trim());
  if (!address) return t.dns.problems.missingAddress;
  if (!isValidIP(address)) return t.common.validation.notIPv4(address);
  const first = records.findIndex((other) => hostNameKey(other.name) === name);
  if (first !== -1 && records[first] !== record) return t.dns.problems.duplicateName(name, first + 1);
  return undefined;
}

/**
 * What is wrong with the DNS server typed on a network card; undefined when
 * it is fine (or empty: a card may ask nobody)
 */
export function dnsServerProblem(text: string): string | undefined {
  const value = text.trim();
  if (!value || isValidIP(value)) return undefined;
  return getT().dns.problems.serverNotAnAddress(value);
}
