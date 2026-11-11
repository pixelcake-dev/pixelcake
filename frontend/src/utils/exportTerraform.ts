/**
 * Terraform HCL Export Utility
 * Generates Terraform configuration from PixelCake topology
 */

import type { NetworkDevice, NetworkConnection } from '@/types';

/** Sanitize a label into a valid Terraform resource name */
function sanitizeName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Map device types to Terraform resource types */
function getResourceType(type: string): string {
  const typeMap: Record<string, string> = {
    Switch: 'network_switch',
    Router: 'network_router',
    Firewall: 'network_firewall',
    Server: 'compute_instance',
    PC: 'compute_instance',
    Database: 'compute_instance',
    Cloud: 'cloud_network',
    AccessPoint: 'network_appliance',
    LoadBalancer: 'network_appliance',
  };
  return typeMap[type] || 'network_device';
}

/** Format a HCL block with proper indentation */
function hclBlock(indent: number, name: string, entries: [string, string | number | boolean][]): string {
  const pad = '  '.repeat(indent);
  const innerPad = '  '.repeat(indent + 1);
  const lines = entries
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => {
      if (typeof v === 'string') return `${innerPad}${k} = "${v}"`;
      return `${innerPad}${k} = ${v}`;
    });
  if (lines.length === 0) return '';
  return `${pad}${name} {\n${lines.join('\n')}\n${pad}}`;
}

/** Generate port blocks for Switch/Router/Firewall */
function generatePortBlocks(device: NetworkDevice): string {
  if (!device.ports || device.ports.length === 0) return '';

  const lines: string[] = [];
  for (const port of device.ports) {
    if (!port.enabled) continue;

    const entries: [string, string | number | boolean][] = [
      ['id', port.id],
      ['name', port.name || `port-${port.id}`],
      ['speed', port.speed || 'auto'],
    ];

    if (port.portType) entries.push(['mode', port.portType]);
    if (port.poe) entries.push(['poe', true]);
    if (port.nat) entries.push(['nat', true]);
    if (port.securityZone) entries.push(['security_zone', port.securityZone]);
    if (port.ips) entries.push(['ips_enabled', true]);

    if (port.vlan !== undefined) {
      if (Array.isArray(port.vlan)) {
        entries.push(['vlan', port.vlan.join(', ')]);
      } else {
        entries.push(['vlan', port.vlan]);
      }
    }

    if (port.description) entries.push(['description', port.description]);

    const blockName = device.type === 'Firewall' ? 'security_port' :
                      device.type === 'Router' ? 'interface' : 'port';
    const block = hclBlock(1, blockName, entries);
    if (block) lines.push(block);
  }

  return lines.join('\n\n');
}

/** Generate NIC blocks for PC/Server/Database/Cloud/etc. */
function generateNicBlocks(device: NetworkDevice): string {
  if (!device.nics || device.nics.length === 0) return '';

  const lines: string[] = [];
  for (const nic of device.nics) {
    if (!nic.enabled) continue;

    const entries: [string, string | number | boolean][] = [
      ['name', nic.name],
      ['ip', nic.ip],
      ['subnet', nic.subnet],
      ['gateway', nic.gateway],
      ['speed', nic.speed || 'auto'],
    ];

    if (nic.mac) entries.push(['mac_address', nic.mac]);
    if (nic.description) entries.push(['description', nic.description]);

    const block = hclBlock(1, 'network_interface', entries);
    if (block) lines.push(block);
  }

  return lines.join('\n\n');
}

/** Generate a single device resource */
function generateDeviceResource(device: NetworkDevice): string {
  const resourceType = getResourceType(device.type);
  const resourceName = sanitizeName(device.label);

  const lines: string[] = [];
  lines.push(`resource "${resourceType}" "${resourceName}" {`);
  lines.push(`  name     = "${device.label}"`);
  lines.push(`  type     = "${device.type}"`);

  if (device.ip) lines.push(`  ip       = "${device.ip}"`);
  if (device.subnet) lines.push(`  subnet   = "${device.subnet}"`);
  if (device.gateway) lines.push(`  gateway  = "${device.gateway}"`);
  if (device.vendor) lines.push(`  vendor   = "${device.vendor}"`);
  if (device.location) lines.push(`  location = "${device.location}"`);

  // VLAN configuration
  if (device.vlan && device.vlan.length > 0) {
    lines.push(`  vlan_ids = [${device.vlan.join(', ')}]`);
  }

  // STP configuration
  if (device.stp?.enabled) {
    const stpEntries: [string, string | number | boolean][] = [
      ['enabled', true],
    ];
    if (device.stp.mode) stpEntries.push(['mode', device.stp.mode]);
    if (device.stp.priority !== undefined) stpEntries.push(['priority', device.stp.priority]);
    const stpBlock = hclBlock(1, 'stp', stpEntries);
    if (stpBlock) lines.push('');
    if (stpBlock) lines.push(stpBlock);
  }

  // Port blocks (Switch/Router/Firewall)
  const portBlocks = generatePortBlocks(device);
  if (portBlocks) {
    lines.push('');
    lines.push(portBlocks);
  }

  // NIC blocks (PC/Server/Database/Cloud/etc.)
  const nicBlocks = generateNicBlocks(device);
  if (nicBlocks) {
    lines.push('');
    lines.push(nicBlocks);
  }

  lines.push('}');
  return lines.join('\n');
}

/** Generate connection resource */
function generateConnectionResource(
  conn: NetworkConnection,
  devices: NetworkDevice[],
): string {
  const sourceDevice = devices.find((d) => d.id === conn.source);
  const targetDevice = devices.find((d) => d.id === conn.target);

  if (!sourceDevice || !targetDevice) return '';

  const sourceName = sanitizeName(sourceDevice.label);
  const targetName = sanitizeName(targetDevice.label);
  const connName = `${sourceName}_to_${targetName}`;

  const lines: string[] = [];
  lines.push(`resource "network_link" "${connName}" {`);
  lines.push(`  source = ${getResourceType(sourceDevice.type)}.${sourceName}.id`);
  lines.push(`  target = ${getResourceType(targetDevice.type)}.${targetName}.id`);

  if (conn.type) lines.push(`  type   = "${conn.type}"`);
  if (conn.bandwidth) lines.push(`  bandwidth = "${conn.bandwidth}"`);
  if (conn.label) lines.push(`  label  = "${conn.label}"`);

  if (conn.vlan && conn.vlan.length > 0) {
    lines.push(`  vlan_ids = [${conn.vlan.join(', ')}]`);
  }

  if (conn.stpPortState) lines.push(`  stp_state = "${conn.stpPortState}"`);

  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate Terraform HCL from PixelCake topology
 */
export function generateTerraform(
  devices: NetworkDevice[],
  connections: NetworkConnection[],
  projectName?: string,
): string {
  const now = new Date().toISOString().split('T')[0];
  const sections: string[] = [];

  // Header
  sections.push(`# ============================================`);
  sections.push(`# PixelCake Infrastructure as Code`);
  sections.push(`# Project: ${projectName || 'Untitled'}`);
  sections.push(`# Generated: ${now}`);
  sections.push(`# Devices: ${devices.length} | Connections: ${connections.length}`);
  sections.push(`# ============================================`);
  sections.push('');

  // Locals block
  const uniqueSubnets = [...new Set(devices.map((d) => d.subnet).filter(Boolean))];
  const uniqueGateways = [...new Set(devices.map((d) => d.gateway).filter(Boolean))];
  sections.push('locals {');
  sections.push(`  project_name = "${projectName || 'pixelcake-topology'}"`);
  if (uniqueSubnets.length > 0) {
    sections.push(`  subnets      = [${uniqueSubnets.map((s) => `"${s}"`).join(', ')}]`);
  }
  if (uniqueGateways.length > 0) {
    sections.push(`  gateways     = [${uniqueGateways.map((g) => `"${g}"`).join(', ')}]`);
  }
  sections.push('}');
  sections.push('');

  // Group devices by type
  const devicesByType = new Map<string, NetworkDevice[]>();
  for (const device of devices) {
    const group = devicesByType.get(device.type) || [];
    group.push(device);
    devicesByType.set(device.type, group);
  }

  // Generate device resources grouped by type
  for (const [type, typeDevices] of devicesByType) {
    sections.push(`# --- ${type}${typeDevices.length > 1 ? 's' : ''} ---`);
    sections.push('');
    for (const device of typeDevices) {
      sections.push(generateDeviceResource(device));
      sections.push('');
    }
  }

  // Generate connection resources
  if (connections.length > 0) {
    sections.push('# --- Network Links ---');
    sections.push('');
    for (const conn of connections) {
      const resource = generateConnectionResource(conn, devices);
      if (resource) {
        sections.push(resource);
        sections.push('');
      }
    }
  }

  return sections.join('\n').trimEnd() + '\n';
}
