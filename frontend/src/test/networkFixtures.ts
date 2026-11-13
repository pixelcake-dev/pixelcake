/**
 * Small factories for network topologies in tests: only what a test cares
 * about is written, the rest gets a neutral default.
 */

import type {
  FirewallRule,
  NetworkConnection,
  NetworkDevice,
  NetworkInterfaceCard,
  Port,
  PortForward,
  StaticRoute,
} from '@/types';
import type { Topology } from '@/engine';

export function device(overrides: Partial<NetworkDevice> & { id: string }): NetworkDevice {
  return {
    type: 'PC',
    label: overrides.id,
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

export function port(id: number, overrides: Partial<Port> = {}): Port {
  return { id, enabled: true, ...overrides };
}

export function nic(overrides: Partial<NetworkInterfaceCard> = {}): NetworkInterfaceCard {
  return {
    id: 'nic-1',
    name: 'eth0',
    enabled: true,
    speed: 'auto',
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    ...overrides,
  };
}

export function link(
  source: string,
  target: string,
  overrides: Partial<NetworkConnection> = {}
): NetworkConnection {
  return { id: `${source}--${target}`, source, target, ...overrides };
}

export function topo(devices: NetworkDevice[], connections: NetworkConnection[] = []): Topology {
  return { devices, connections };
}

/** An end device with one NIC (eth0), the way the app creates it */
export function host(
  id: string,
  ip: string,
  gateway = '',
  overrides: Partial<NetworkDevice> = {}
): NetworkDevice {
  return device({ id, label: id, ip, gateway, nics: [nic({ ip, gateway })], ...overrides });
}

/** A switch with the given ports */
export function switchWith(
  id: string,
  ports: Port[],
  overrides: Partial<NetworkDevice> = {}
): NetworkDevice {
  return device({ id, label: id, type: 'Switch', ports, ...overrides });
}

let routeCounter = 0;
/** A static route; ids are unique within a test run */
export function route(destination: string, nextHop: string): StaticRoute {
  routeCounter += 1;
  return { id: `route-${routeCounter}`, destination, nextHop };
}

let ruleCounter = 0;
/** A firewall rule: `rule('allow', 'web', 'untrust', 'dmz')` */
export function rule(
  action: FirewallRule['action'],
  service: FirewallRule['service'],
  source: string,
  destination: string,
  overrides: Partial<FirewallRule> = {}
): FirewallRule {
  ruleCounter += 1;
  return { id: `rule-${ruleCounter}`, action, service, source, destination, ...overrides };
}

let forwardCounter = 0;
/** A port forward: `forward('web', 2, '192.168.1.20')` */
export function forward(
  service: PortForward['service'],
  port: number,
  to: string,
  overrides: Partial<PortForward> = {}
): PortForward {
  forwardCounter += 1;
  return { id: `forward-${forwardCounter}`, service, port, to, ...overrides };
}
