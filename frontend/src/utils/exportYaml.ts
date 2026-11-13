/**
 * YAML Export Utility
 * Generates YAML topology from PixelCake devices and connections
 * Uses manual serialization — no external dependencies
 */

import type {
  DhcpPool,
  DnsRecord,
  FirewallRule,
  NetworkDevice,
  NetworkConnection,
  NetworkInterfaceCard,
  Port,
  PortForward,
  StaticRoute,
} from '@/types';
import { boundInterface } from '@/engine/interfaces';
import type { ConnectionEnd } from '@/engine/interfaces';

/** Escape a YAML string value (wrap in quotes if needed) */
function yamlValue(val: string | number | boolean | undefined | null): string {
  if (val === undefined || val === null) return '""';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  // Wrap in quotes if string contains special chars or is empty
  const s = String(val);
  if (s === '' || /[:#[\]{}&*!|>'"%@`,?]/.test(s) || s.trim() !== s) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

/** Indent a line */
function indent(level: number): string {
  return '  '.repeat(level);
}

/**
 * The DHCP server of an interface (a port, or a card of a server) as YAML
 * lines: the range it hands out, then the gateway and the DNS server when
 * one is written
 */
function serializePool(pool: DhcpPool, level: number): string[] {
  const lines = [
    `${indent(level)}  dhcp_server:`,
    `${indent(level)}    start: ${yamlValue(pool.start)}`,
    `${indent(level)}    end: ${yamlValue(pool.end)}`,
  ];
  if (pool.gateway) lines.push(`${indent(level)}    gateway: ${yamlValue(pool.gateway)}`);
  if (pool.dns) lines.push(`${indent(level)}    dns: ${yamlValue(pool.dns)}`);
  return lines;
}

/** Serialize a port to YAML lines */
function serializePort(port: Port, level: number): string[] {
  const lines: string[] = [];
  lines.push(`${indent(level)}- id: ${port.id}`);
  if (port.name) lines.push(`${indent(level)}  name: ${yamlValue(port.name)}`);
  lines.push(`${indent(level)}  enabled: ${port.enabled}`);
  if (port.ip) lines.push(`${indent(level)}  ip: ${yamlValue(port.ip)}`);
  if (port.subnet) lines.push(`${indent(level)}  subnet: ${yamlValue(port.subnet)}`);
  if (port.speed) lines.push(`${indent(level)}  speed: ${yamlValue(port.speed)}`);
  if (port.portType) lines.push(`${indent(level)}  mode: ${yamlValue(port.portType)}`);
  if (port.vlan !== undefined) {
    if (Array.isArray(port.vlan)) {
      lines.push(`${indent(level)}  vlan: [${port.vlan.join(', ')}]`);
    } else {
      lines.push(`${indent(level)}  vlan: ${port.vlan}`);
    }
  }
  if (port.poe) lines.push(`${indent(level)}  poe: true`);
  if (port.nat) lines.push(`${indent(level)}  nat: true`);
  if (port.dhcpServer) lines.push(...serializePool(port.dhcpServer, level));
  if (port.securityZone) lines.push(`${indent(level)}  security_zone: ${yamlValue(port.securityZone)}`);
  if (port.ips) lines.push(`${indent(level)}  ips: true`);
  if (port.description) lines.push(`${indent(level)}  description: ${yamlValue(port.description)}`);
  return lines;
}

/** Serialize a NIC to YAML lines */
function serializeNic(nic: NetworkInterfaceCard, level: number): string[] {
  const lines: string[] = [];
  lines.push(`${indent(level)}- name: ${yamlValue(nic.name)}`);
  lines.push(`${indent(level)}  enabled: ${nic.enabled}`);
  if (nic.dhcp) {
    // The address comes from a DHCP server: the file says so, and never
    // the address the card happens to be leased, nor the DNS server that
    // came with it
    lines.push(`${indent(level)}  dhcp: true`);
  } else {
    if (nic.ip) lines.push(`${indent(level)}  ip: ${yamlValue(nic.ip)}`);
    if (nic.subnet) lines.push(`${indent(level)}  subnet: ${yamlValue(nic.subnet)}`);
    if (nic.gateway) lines.push(`${indent(level)}  gateway: ${yamlValue(nic.gateway)}`);
    if (nic.dns) lines.push(`${indent(level)}  dns: ${yamlValue(nic.dns)}`);
    if (nic.dhcpServer) lines.push(...serializePool(nic.dhcpServer, level));
  }
  if (nic.speed) lines.push(`${indent(level)}  speed: ${yamlValue(nic.speed)}`);
  if (nic.mac) lines.push(`${indent(level)}  mac: ${yamlValue(nic.mac)}`);
  if (nic.description) lines.push(`${indent(level)}  description: ${yamlValue(nic.description)}`);
  return lines;
}

/** Serialize a static route to YAML lines */
function serializeRoute(route: StaticRoute, level: number): string[] {
  const lines: string[] = [];
  lines.push(`${indent(level)}- destination: ${yamlValue(route.destination)}`);
  lines.push(`${indent(level)}  via: ${yamlValue(route.nextHop)}`);
  if (route.description) lines.push(`${indent(level)}  description: ${yamlValue(route.description)}`);
  return lines;
}

/** Serialize a firewall rule to YAML lines (rules are written in order: the order is the policy) */
function serializeRule(rule: FirewallRule, level: number): string[] {
  const lines: string[] = [];
  lines.push(`${indent(level)}- action: ${yamlValue(rule.action)}`);
  lines.push(`${indent(level)}  service: ${yamlValue(rule.service)}`);
  lines.push(`${indent(level)}  from: ${yamlValue(rule.source)}`);
  lines.push(`${indent(level)}  to: ${yamlValue(rule.destination)}`);
  if (rule.enabled === false) lines.push(`${indent(level)}  enabled: false`);
  if (rule.description) lines.push(`${indent(level)}  description: ${yamlValue(rule.description)}`);
  return lines;
}

/** Serialize a port forward to YAML lines (in order: the first that matches is taken) */
function serializeForward(forward: PortForward, level: number): string[] {
  const lines: string[] = [];
  lines.push(`${indent(level)}- service: ${yamlValue(forward.service)}`);
  lines.push(`${indent(level)}  interface: ${forward.port}`);
  lines.push(`${indent(level)}  to: ${yamlValue(forward.to)}`);
  if (forward.enabled === false) lines.push(`${indent(level)}  enabled: false`);
  if (forward.description) {
    lines.push(`${indent(level)}  description: ${yamlValue(forward.description)}`);
  }
  return lines;
}

/** Serialize a DNS record to YAML lines: a name and the address it stands for */
function serializeRecord(record: DnsRecord, level: number): string[] {
  return [
    `${indent(level)}- name: ${yamlValue(record.name)}`,
    `${indent(level)}  address: ${yamlValue(record.address)}`,
  ];
}

/** Serialize a device to YAML lines */
function serializeDevice(device: NetworkDevice, level: number): string[] {
  const lines: string[] = [];
  lines.push(`${indent(level)}- name: ${yamlValue(device.label)}`);
  lines.push(`${indent(level)}  type: ${yamlValue(device.type)}`);
  // The template tells specializations of one type apart (Mail Server vs Server)
  if (device.templateId) lines.push(`${indent(level)}  template_id: ${yamlValue(device.templateId)}`);
  // (a device whose first card is on DHCP has no addressing of its own to write)
  if (device.nics?.[0]?.dhcp !== true) {
    if (device.ip) lines.push(`${indent(level)}  ip: ${yamlValue(device.ip)}`);
    if (device.subnet) lines.push(`${indent(level)}  subnet: ${yamlValue(device.subnet)}`);
    if (device.gateway) lines.push(`${indent(level)}  gateway: ${yamlValue(device.gateway)}`);
  }
  if (device.vendor) lines.push(`${indent(level)}  vendor: ${yamlValue(device.vendor)}`);
  if (device.location) lines.push(`${indent(level)}  location: ${yamlValue(device.location)}`);

  // VLAN
  if (device.vlan && device.vlan.length > 0) {
    lines.push(`${indent(level)}  vlan: [${device.vlan.join(', ')}]`);
  }

  // STP
  if (device.stp?.enabled) {
    lines.push(`${indent(level)}  stp:`);
    lines.push(`${indent(level)}    enabled: true`);
    if (device.stp.mode) lines.push(`${indent(level)}    mode: ${yamlValue(device.stp.mode)}`);
    if (device.stp.priority !== undefined) lines.push(`${indent(level)}    priority: ${device.stp.priority}`);
  }

  // Ports: all of them. A disabled port is still a port (enabled: false);
  // dropping it would lose its state and break the links bound to it
  if (device.ports && device.ports.length > 0) {
    lines.push(`${indent(level)}  ports:`);
    for (const port of device.ports) {
      lines.push(...serializePort(port, level + 2));
    }
  }

  // NICs: all of them, disabled ones included
  if (device.nics && device.nics.length > 0) {
    lines.push(`${indent(level)}  nics:`);
    for (const nic of device.nics) {
      lines.push(...serializeNic(nic, level + 2));
    }
  }

  // Static routes
  if (device.routes && device.routes.length > 0) {
    lines.push(`${indent(level)}  routes:`);
    for (const route of device.routes) {
      lines.push(...serializeRoute(route, level + 2));
    }
  }

  // Firewall rules, first to last
  if (device.firewallRules && device.firewallRules.length > 0) {
    lines.push(`${indent(level)}  firewall_rules:`);
    for (const rule of device.firewallRules) {
      lines.push(...serializeRule(rule, level + 2));
    }
  }

  // Port forwards, first to last (source NAT is written on each port: `nat`)
  if (device.portForwards && device.portForwards.length > 0) {
    lines.push(`${indent(level)}  port_forwards:`);
    for (const forward of device.portForwards) {
      lines.push(...serializeForward(forward, level + 2));
    }
  }

  // DNS records of a server
  if (device.dnsRecords && device.dnsRecords.length > 0) {
    lines.push(`${indent(level)}  dns_records:`);
    for (const record of device.dnsRecords) {
      lines.push(...serializeRecord(record, level + 2));
    }
  }

  return lines;
}

/**
 * The interface one end of a connection is bound to, as YAML lines:
 * `source_port: 3` for a port, `source_nic: eth0` (the NIC NAME) for a NIC.
 * Nothing for an unbound end or a binding that no longer resolves.
 */
function serializeBinding(
  conn: NetworkConnection,
  device: NetworkDevice,
  end: ConnectionEnd,
  level: number,
): string[] {
  const iface = boundInterface(conn, device, end);
  if (!iface) return [];
  return iface.kind === 'port'
    ? [`${indent(level)}  ${end}_port: ${iface.port.id}`]
    : [`${indent(level)}  ${end}_nic: ${yamlValue(iface.nic.name)}`];
}

/** Serialize a connection to YAML lines */
function serializeConnection(
  conn: NetworkConnection,
  devices: NetworkDevice[],
  level: number,
): string[] {
  const sourceDevice = devices.find((d) => d.id === conn.source);
  const targetDevice = devices.find((d) => d.id === conn.target);
  if (!sourceDevice || !targetDevice) return [];

  const lines: string[] = [];
  lines.push(`${indent(level)}- source: ${yamlValue(sourceDevice.label)}`);
  lines.push(`${indent(level)}  target: ${yamlValue(targetDevice.label)}`);
  lines.push(...serializeBinding(conn, sourceDevice, 'source', level));
  lines.push(...serializeBinding(conn, targetDevice, 'target', level));
  if (conn.type) lines.push(`${indent(level)}  type: ${yamlValue(conn.type)}`);
  if (conn.bandwidth) lines.push(`${indent(level)}  bandwidth: ${yamlValue(conn.bandwidth)}`);
  if (conn.label) lines.push(`${indent(level)}  label: ${yamlValue(conn.label)}`);
  if (conn.vlan && conn.vlan.length > 0) {
    lines.push(`${indent(level)}  vlan: [${conn.vlan.join(', ')}]`);
  }
  if (conn.stpPortState) lines.push(`${indent(level)}  stp_state: ${yamlValue(conn.stpPortState)}`);

  return lines;
}

/**
 * Generate YAML from PixelCake topology
 */
export function generateYaml(
  devices: NetworkDevice[],
  connections: NetworkConnection[],
  projectName?: string,
): string {
  const now = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  // Header comment
  lines.push('# PixelCake Topology Export');
  lines.push(`# Generated: ${now}`);
  lines.push(`# Devices: ${devices.length} | Connections: ${connections.length}`);
  lines.push('');

  // Root
  lines.push('pixelcake:');
  lines.push('  version: "1.0"');
  lines.push(`  project: ${yamlValue(projectName || 'Untitled')}`);
  lines.push(`  exported: ${yamlValue(now)}`);
  lines.push('');

  // Devices
  lines.push('  devices:');
  if (devices.length === 0) {
    lines.push('    []');
  } else {
    for (const device of devices) {
      lines.push(...serializeDevice(device, 2));
    }
  }
  lines.push('');

  // Connections
  lines.push('  connections:');
  if (connections.length === 0) {
    lines.push('    []');
  } else {
    for (const conn of connections) {
      const connLines = serializeConnection(conn, devices, 2);
      if (connLines.length > 0) {
        lines.push(...connLines);
      }
    }
  }

  return lines.join('\n') + '\n';
}
