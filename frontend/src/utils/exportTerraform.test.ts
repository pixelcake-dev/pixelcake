import { describe, it, expect, test } from 'vitest';
import { generateTerraform } from './exportTerraform';
import type { NetworkDevice, NetworkConnection, Port, NetworkInterfaceCard } from '@/types';

/** Count non-overlapping occurrences of a substring */
function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function makeDevice(overrides: Partial<NetworkDevice> = {}): NetworkDevice {
  return {
    id: 'dev-1',
    type: 'Switch',
    label: 'Device',
    ip: '',
    subnet: '',
    gateway: '',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makePort(overrides: Partial<Port> = {}): Port {
  return {
    id: 1,
    enabled: true,
    ...overrides,
  };
}

function makeNic(overrides: Partial<NetworkInterfaceCard> = {}): NetworkInterfaceCard {
  return {
    id: 'nic-1',
    name: 'eth0',
    enabled: true,
    speed: '1G',
    ip: '10.0.0.10',
    subnet: '255.255.255.0',
    gateway: '10.0.0.1',
    ...overrides,
  };
}

function makeConnection(overrides: Partial<NetworkConnection> = {}): NetworkConnection {
  return {
    id: 'conn-1',
    source: 'dev-1',
    target: 'dev-2',
    ...overrides,
  };
}

describe('generateTerraform', () => {
  describe('device resource blocks', () => {
    it('generates one resource block per device with sanitized resource names', () => {
      const devices = [
        makeDevice({ id: 'sw-1', type: 'Switch', label: 'Core Switch' }),
        makeDevice({ id: 'rt-1', type: 'Router', label: 'Edge Router #2' }),
        makeDevice({ id: 'srv-1', type: 'Server', label: 'Web Server' }),
      ];

      const output = generateTerraform(devices, []);

      expect(output).toContain('resource "network_switch" "core_switch" {');
      expect(output).toContain('resource "network_router" "edge_router_2" {');
      expect(output).toContain('resource "compute_instance" "web_server" {');
      // Exactly one resource block per device (3 devices, no connections)
      expect(countOccurrences(output, '\nresource "')).toBe(3);
    });

    it('includes device metadata and falls back to network_device for unknown types', () => {
      const devices = [
        makeDevice({
          id: 'x-1',
          type: 'Toaster',
          label: 'Smart Toaster',
          ip: '192.168.1.50',
          subnet: '255.255.255.0',
          gateway: '192.168.1.1',
          vendor: 'Acme',
        }),
      ];

      const output = generateTerraform(devices, [], 'My Project');

      expect(output).toContain('# Project: My Project');
      expect(output).toContain('resource "network_device" "smart_toaster" {');
      expect(output).toContain('name     = "Smart Toaster"');
      expect(output).toContain('type     = "Toaster"');
      expect(output).toContain('ip       = "192.168.1.50"');
      expect(output).toContain('vendor   = "Acme"');
    });
  });

  describe('ports and NICs', () => {
    it('emits a port block for each enabled switch port and skips disabled ports', () => {
      const devices = [
        makeDevice({
          id: 'sw-1',
          type: 'Switch',
          label: 'Access Switch',
          ports: [
            makePort({ id: 1, enabled: true, name: 'Uplink', speed: '10G', portType: 'trunk', vlan: [10, 20] }),
            makePort({ id: 2, enabled: false, name: 'Unused Port' }),
            makePort({ id: 3, enabled: true, name: 'Desk Drop', portType: 'access', vlan: 10, poe: true }),
          ],
        }),
      ];

      const output = generateTerraform(devices, []);

      expect(countOccurrences(output, '  port {')).toBe(2);
      // Enabled port 1 (trunk vlans serialized as a joined string)
      expect(output).toContain('    id = 1');
      expect(output).toContain('    name = "Uplink"');
      expect(output).toContain('    mode = "trunk"');
      expect(output).toContain('    vlan = "10, 20"');
      // Enabled port 3
      expect(output).toContain('    id = 3');
      expect(output).toContain('    vlan = 10');
      expect(output).toContain('    poe = true');
      // Disabled port 2 is skipped entirely
      expect(output).not.toContain('id = 2');
      expect(output).not.toContain('Unused Port');
    });

    it('uses "interface" blocks for Router ports and "security_port" for Firewall ports', () => {
      const devices = [
        makeDevice({
          id: 'rt-1',
          type: 'Router',
          label: 'WAN Router',
          ports: [makePort({ id: 1, portType: 'wan', nat: true })],
        }),
        makeDevice({
          id: 'fw-1',
          type: 'Firewall',
          label: 'Perimeter FW',
          ports: [makePort({ id: 1, portType: 'dmz', securityZone: 'dmz', ips: true })],
        }),
      ];

      const output = generateTerraform(devices, []);

      expect(output).toContain('  interface {');
      expect(output).toContain('    nat = true');
      expect(output).toContain('  security_port {');
      expect(output).toContain('    security_zone = "dmz"');
      expect(output).toContain('    ips_enabled = true');
    });

    it('emits network_interface blocks for enabled NICs and skips disabled ones', () => {
      const devices = [
        makeDevice({
          id: 'srv-1',
          type: 'Server',
          label: 'App Server',
          nics: [
            makeNic({ id: 'nic-1', name: 'eth0', ip: '10.0.0.10', mac: '02:AA:BB:CC:DD:01' }),
            makeNic({ id: 'nic-2', name: 'eth1', enabled: false, ip: '10.0.1.10' }),
          ],
        }),
      ];

      const output = generateTerraform(devices, []);

      expect(countOccurrences(output, '  network_interface {')).toBe(1);
      expect(output).toContain('    name = "eth0"');
      expect(output).toContain('    ip = "10.0.0.10"');
      expect(output).toContain('    subnet = "255.255.255.0"');
      expect(output).toContain('    gateway = "10.0.0.1"');
      expect(output).toContain('    mac_address = "02:AA:BB:CC:DD:01"');
      // Disabled NIC is skipped entirely
      expect(output).not.toContain('eth1');
      expect(output).not.toContain('10.0.1.10');
    });
  });

  describe('connection resources', () => {
    it('references source/target resource addresses in network_link resources', () => {
      const devices = [
        makeDevice({ id: 'sw-1', type: 'Switch', label: 'Core Switch' }),
        makeDevice({ id: 'srv-1', type: 'Server', label: 'Web Server' }),
      ];
      const connections = [
        makeConnection({
          id: 'c-1',
          source: 'sw-1',
          target: 'srv-1',
          type: 'access',
          bandwidth: '1Gbps',
          vlan: [10, 20],
        }),
      ];

      const output = generateTerraform(devices, connections);

      expect(output).toContain('resource "network_link" "core_switch_to_web_server" {');
      expect(output).toContain('  source = network_switch.core_switch.id');
      expect(output).toContain('  target = compute_instance.web_server.id');
      expect(output).toContain('  type   = "access"');
      expect(output).toContain('  bandwidth = "1Gbps"');
      expect(output).toContain('  vlan_ids = [10, 20]');
    });

    it('omits connections whose endpoints are not in the device list', () => {
      const devices = [makeDevice({ id: 'sw-1', type: 'Switch', label: 'Core Switch' })];
      const connections = [makeConnection({ source: 'sw-1', target: 'ghost-device' })];

      const output = generateTerraform(devices, connections);

      expect(output).not.toContain('network_link');
      // Quirk: the section header is emitted whenever connections.length > 0,
      // even if every connection was skipped as dangling.
      expect(output).toContain('# --- Network Links ---');
    });
  });

  describe('known bugs (pinned current behavior)', () => {
    // KNOWN BUG: sanitizeName maps both 'PC 1' and 'PC-1' to the same resource
    // name 'pc_1', producing two resource blocks with the identical Terraform
    // address compute_instance.pc_1 — invalid HCL (duplicate resource address).
    it('produces duplicate resource addresses when different labels sanitize to the same name', () => {
      const devices = [
        makeDevice({ id: 'pc-a', type: 'PC', label: 'PC 1' }),
        makeDevice({ id: 'pc-b', type: 'PC', label: 'PC-1' }),
      ];

      const output = generateTerraform(devices, []);

      expect(countOccurrences(output, 'resource "compute_instance" "pc_1" {')).toBe(2);
    });

    test.todo(
      'should deduplicate colliding resource names (e.g. suffix pc_1, pc_1_2 or include device id) so every resource address is unique',
    );

    // KNOWN BUG: device labels are interpolated into HCL without escaping, so a
    // label containing a double quote breaks the generated string literal.
    it('interpolates double quotes in labels unescaped into the HCL output', () => {
      const devices = [
        makeDevice({ id: 'sw-1', type: 'Switch', label: 'Core "Main" Switch' }),
      ];

      const output = generateTerraform(devices, []);

      // The raw quotes end up inside the HCL string literal, unescaped.
      expect(output).toContain('name     = "Core "Main" Switch"');
      expect(output).not.toContain('\\"Main\\"');
      // The sanitized resource name itself is fine (quotes stripped to underscores).
      expect(output).toContain('resource "network_switch" "core_main_switch" {');
    });

    test.todo(
      'should escape double quotes (and backslashes) in labels/descriptions when emitting HCL string literals',
    );
  });
});
