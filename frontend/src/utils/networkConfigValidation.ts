/**
 * Validation of what a person types for a static route, a firewall rule or a
 * port forward, with the reason in Italian for the forms that show it. The
 * engine has its own tolerance (it leaves out what it cannot read); the forms
 * refuse it before it is saved.
 */

import { isValidRuleEndpoint, parseNetwork } from '@/engine';
import { isValidIP } from '@/utils/ipHelpers';
import type { FirewallRule, Port, PortForward, StaticRoute } from '@/types';

/** True for a route row left completely empty: it is dropped on save, not an error */
export function isBlankRoute(route: StaticRoute): boolean {
  return !route.destination.trim() && !route.nextHop.trim();
}

/** What is wrong with a route as typed; undefined when it is fine (or blank) */
export function routeProblem(route: StaticRoute): string | undefined {
  if (isBlankRoute(route)) return undefined;
  if (!parseNetwork(route.destination)) {
    return `"${route.destination}" non è una rete: scrivila come 192.168.30.0/24, oppure "default"`;
  }
  if (!isValidIP(route.nextHop.trim())) {
    return `"${route.nextHop}" non è un indirizzo IPv4 valido`;
  }
  return undefined;
}

/** What is wrong with a rule as typed; undefined when it is fine */
export function ruleProblem(rule: FirewallRule): string | undefined {
  for (const [side, value] of [
    ['Da', rule.source],
    ['A', rule.destination],
  ] as const) {
    if (!isValidRuleEndpoint(value)) {
      return `«${side}»: "${value}" non è any, una zona (trust, untrust, dmz), un indirizzo o una rete`;
    }
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
  const to = forward.to.trim();
  if (!isValidIP(to)) return `"${forward.to}" non è un indirizzo IPv4 valido`;
  const port = ports.find((candidate) => candidate.id === forward.port);
  if (!port?.ip || !isValidIP(port.ip)) {
    return `la porta ${forward.port} non ha un indirizzo da pubblicare: dagliene uno nella scheda «Porte»`;
  }
  if (port.ip === to) return `${to} è l'indirizzo della porta ${forward.port} stessa`;
  return undefined;
}
