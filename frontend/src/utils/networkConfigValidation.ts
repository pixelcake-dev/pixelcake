/**
 * Validation of what a person types for a static route or a firewall rule,
 * with the reason in Italian for the forms that show it. The engine has its
 * own tolerance (it leaves out what it cannot read); the forms refuse it
 * before it is saved.
 */

import { isValidRuleEndpoint, parseNetwork } from '@/engine';
import { isValidIP } from '@/utils/ipHelpers';
import type { FirewallRule, StaticRoute } from '@/types';

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
