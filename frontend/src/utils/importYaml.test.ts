/**
 * Tests for importYaml.ts (parseYamlTopology), including round-trips
 * through exportYaml.ts (generateYaml).
 */

import { describe, it, expect } from 'vitest';
import { parseYamlTopology } from './importYaml';
import { generateYaml } from './exportYaml';
import type { NetworkDevice, NetworkConnection } from '@/types';

/** Minimal type-correct device factory */
function makeDevice(
  overrides: Partial<NetworkDevice> & Pick<NetworkDevice, 'id' | 'label'>,
): NetworkDevice {
  return {
    type: 'PC',
    ip: '',
    subnet: '',
    gateway: '',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

/** Minimal type-correct connection factory */
function makeConnection(
  overrides: Partial<NetworkConnection> & Pick<NetworkConnection, 'id' | 'source' | 'target'>,
): NetworkConnection {
  return { ...overrides };
}

/** Fixture: 4 devices (one with ports, one with NICs) + 2 connections */
function buildTopology(): { devices: NetworkDevice[]; connections: NetworkConnection[] } {
  const router = makeDevice({
    id: 'r1',
    label: 'Core-Router',
    type: 'Router',
    ip: '10.0.0.1',
    subnet: '255.255.255.0',
    position: { x: 999, y: -50 },
    portCount: 3,
    ports: [
      { id: 1, name: 'WAN Uplink', enabled: true, speed: '1G', portType: 'wan', nat: true },
      { id: 2, enabled: true, portType: 'lan', vlan: [10, 20] },
      // Disabled ports are exported too (enabled: false)
      { id: 3, enabled: false },
    ],
  });

  const sw = makeDevice({
    id: 's1',
    label: 'Access-Switch',
    type: 'Switch',
    ip: '10.0.0.2',
    position: { x: 123, y: 456 },
    vlan: [10, 20],
  });

  const pc = makeDevice({
    id: 'p1',
    label: 'Workstation-01',
    type: 'PC',
    position: { x: -10, y: 5 },
    nics: [
      {
        id: 'nic-1',
        name: 'eth0',
        enabled: true,
        speed: '1G',
        ip: '10.0.0.50',
        subnet: '255.255.255.0',
        gateway: '10.0.0.1',
        mac: '02:AA:BB:CC:DD:EE',
      },
    ],
  });

  const server = makeDevice({
    id: 'sv1',
    label: 'Web-Server',
    type: 'Server',
    ip: '10.0.0.10',
    position: { x: 4000, y: 4000 },
  });

  const connections = [
    makeConnection({
      id: 'c1',
      source: 'r1',
      target: 's1',
      type: 'uplink',
      bandwidth: '10Gbps',
      label: 'core-link',
    }),
    makeConnection({ id: 'c2', source: 's1', target: 'p1', type: 'access' }),
  ];

  return { devices: [router, sw, pc, server], connections };
}

describe('parseYamlTopology', () => {
  describe('round-trip via generateYaml', () => {
    it('preserves device count, types, labels and IPs', () => {
      const { devices, connections } = buildTopology();
      const yaml = generateYaml(devices, connections, 'RoundTrip');
      const result = parseYamlTopology(yaml);

      expect(result.warnings).toEqual([]);
      expect(result.devices).toHaveLength(4);
      expect(result.devices.map((d) => d.label)).toEqual([
        'Core-Router',
        'Access-Switch',
        'Workstation-01',
        'Web-Server',
      ]);
      expect(result.devices.map((d) => d.type)).toEqual(['Router', 'Switch', 'PC', 'Server']);
      // The PC has no top-level IP (empty string is skipped on export, defaulted on import)
      expect(result.devices.map((d) => d.ip)).toEqual(['10.0.0.1', '10.0.0.2', '', '10.0.0.10']);
      expect(result.devices[0].subnet).toBe('255.255.255.0');
      expect(result.devices[1].vlan).toEqual([10, 20]);
    });

    it('preserves every port, disabled ones included', () => {
      const { devices, connections } = buildTopology();
      const result = parseYamlTopology(generateYaml(devices, connections));

      const router = result.devices.find((d) => d.label === 'Core-Router');
      expect(router).toBeDefined();
      // Port 3 is disabled: it is exported as `enabled: false`, not dropped
      expect(router?.ports).toHaveLength(3);
      expect(router?.portCount).toBe(3);
      expect(router?.ports?.[0]).toMatchObject({
        id: 1,
        name: 'WAN Uplink',
        enabled: true,
        speed: '1G',
        portType: 'wan',
        nat: true,
      });
      expect(router?.ports?.[1]).toMatchObject({ id: 2, portType: 'lan', vlan: [10, 20] });
      expect(router?.ports?.[2]).toEqual({ id: 3, enabled: false });
    });

    it('preserves NICs (name, ip, subnet, gateway, mac)', () => {
      const { devices, connections } = buildTopology();
      const result = parseYamlTopology(generateYaml(devices, connections));

      const pc = result.devices.find((d) => d.label === 'Workstation-01');
      expect(pc?.nics).toHaveLength(1);
      expect(pc?.nics?.[0]).toMatchObject({
        name: 'eth0',
        enabled: true,
        speed: '1G',
        ip: '10.0.0.50',
        subnet: '255.255.255.0',
        gateway: '10.0.0.1',
        mac: '02:AA:BB:CC:DD:EE',
      });
    });

    it('preserves connection endpoints (resolved by device name) and metadata', () => {
      const { devices, connections } = buildTopology();
      const result = parseYamlTopology(generateYaml(devices, connections));

      expect(result.connections).toHaveLength(2);

      const byLabel = new Map(result.devices.map((d) => [d.label, d.id]));

      expect(result.connections[0]).toMatchObject({
        source: byLabel.get('Core-Router'),
        target: byLabel.get('Access-Switch'),
        type: 'uplink',
        bandwidth: '10Gbps',
        label: 'core-link',
      });
      expect(result.connections[1]).toMatchObject({
        source: byLabel.get('Access-Switch'),
        target: byLabel.get('Workstation-01'),
        type: 'access',
      });
    });

    it('preserves positions: the file says where each device is drawn', () => {
      const { devices, connections } = buildTopology();
      const result = parseYamlTopology(generateYaml(devices, connections));
      expect(result.devices.map((d) => d.position)).toEqual(devices.map((d) => d.position));
    });
  });

  describe('interfaces, bindings and templates (round-trip via generateYaml)', () => {
    /** Router (port 2 disabled, port 1 addressed) — Switch — Mail server with two NICs */
    function buildBoundTopology(): { devices: NetworkDevice[]; connections: NetworkConnection[] } {
      const router = makeDevice({
        id: 'r1',
        label: 'Edge',
        type: 'Router',
        templateId: 'tpl-router',
        ip: '10.0.0.1',
        ports: [
          { id: 1, enabled: true, portType: 'lan', ip: '10.0.0.1', subnet: '255.255.255.0' },
          { id: 2, enabled: false, portType: 'wan' },
        ],
      });
      const sw = makeDevice({
        id: 's1',
        label: 'Access',
        type: 'Switch',
        templateId: 'tpl-switch',
        ports: [
          { id: 1, enabled: true },
          { id: 2, enabled: true },
          { id: 3, enabled: false },
        ],
      });
      const mail = makeDevice({
        id: 'm1',
        label: 'Mail',
        type: 'Server',
        templateId: 'tpl-mailserver',
        ip: '10.0.0.20',
        nics: [
          { id: 'nic-1', name: 'eth0', enabled: false, speed: 'auto', ip: '', subnet: '', gateway: '' },
          {
            id: 'nic-2',
            name: 'eth1',
            enabled: true,
            speed: '1G',
            ip: '10.0.0.20',
            subnet: '255.255.255.0',
            gateway: '10.0.0.1',
          },
        ],
      });
      const connections = [
        makeConnection({ id: 'c1', source: 's1', target: 'r1', sourcePort: 3, targetPort: 1, type: 'uplink' }),
        makeConnection({ id: 'c2', source: 'm1', target: 's1', sourceNic: 'nic-2', targetPort: 2 }),
      ];
      return { devices: [router, sw, mail], connections };
    }

    it('writes bindings as source_port/target_port numbers and source_nic/target_nic names', () => {
      const { devices, connections } = buildBoundTopology();
      const yaml = generateYaml(devices, connections);

      expect(yaml).toContain(
        ['    - source: Access', '      target: Edge', '      source_port: 3', '      target_port: 1', '      type: uplink'].join('\n'),
      );
      expect(yaml).toContain(
        ['    - source: Mail', '      target: Access', '      source_nic: eth1', '      target_port: 2'].join('\n'),
      );
    });

    it('brings every binding back, resolving NIC names to the imported NIC ids', () => {
      const { devices, connections } = buildBoundTopology();
      const result = parseYamlTopology(generateYaml(devices, connections));

      expect(result.warnings).toEqual([]);
      const mail = result.devices.find((d) => d.label === 'Mail');
      const eth1 = mail?.nics?.find((n) => n.name === 'eth1');
      expect(eth1).toBeDefined();

      expect(result.connections[0]).toMatchObject({ sourcePort: 3, targetPort: 1 });
      expect(result.connections[0].sourceNic).toBeUndefined();
      expect(result.connections[1]).toMatchObject({ sourceNic: eth1?.id, targetPort: 2 });
      expect(result.connections[1].sourcePort).toBeUndefined();
    });

    it('keeps disabled ports and NICs, with their state', () => {
      const { devices, connections } = buildBoundTopology();
      const result = parseYamlTopology(generateYaml(devices, connections));

      const byLabel = (label: string) => result.devices.find((d) => d.label === label);
      expect(byLabel('Edge')?.ports?.map((p) => [p.id, p.enabled])).toEqual([
        [1, true],
        [2, false],
      ]);
      expect(byLabel('Access')?.ports?.map((p) => [p.id, p.enabled])).toEqual([
        [1, true],
        [2, true],
        [3, false],
      ]);
      expect(byLabel('Mail')?.nics?.map((n) => [n.name, n.enabled, n.ip])).toEqual([
        ['eth0', false, ''],
        ['eth1', true, '10.0.0.20'],
      ]);
    });

    it('keeps the L3 address of a port', () => {
      const { devices, connections } = buildBoundTopology();
      const result = parseYamlTopology(generateYaml(devices, connections));

      const edge = result.devices.find((d) => d.label === 'Edge');
      expect(edge?.ports?.[0]).toMatchObject({ id: 1, ip: '10.0.0.1', subnet: '255.255.255.0' });
      // a port without address gets no ip/subnet keys at all
      expect(edge?.ports?.[1]).toEqual({ id: 2, enabled: false, portType: 'wan' });
    });

    it('keeps the device templateId (what tells a Mail Server from a Server)', () => {
      const { devices, connections } = buildBoundTopology();
      const yaml = generateYaml(devices, connections);
      expect(yaml).toContain('      template_id: tpl-mailserver');

      const result = parseYamlTopology(yaml);
      expect(result.devices.map((d) => [d.label, d.type, d.templateId])).toEqual([
        ['Edge', 'Router', 'tpl-router'],
        ['Access', 'Switch', 'tpl-switch'],
        ['Mail', 'Server', 'tpl-mailserver'],
      ]);
    });

    it('does not export a binding that no longer resolves', () => {
      const { devices } = buildBoundTopology();
      const dangling = [
        makeConnection({ id: 'c1', source: 's1', target: 'r1', sourcePort: 9, targetNic: 'nic-1' }),
      ];
      const yaml = generateYaml(devices, dangling);
      expect(yaml).not.toContain('source_port');
      expect(yaml).not.toContain('target_nic');
      expect(parseYamlTopology(yaml).warnings).toEqual([]);
    });

    it('imports a file without bindings and without template ids as before', () => {
      const yaml = [
        'pixelcake:',
        '  devices:',
        '    - name: SW',
        '      type: Switch',
        '      ports:',
        '        - id: 1',
        '          enabled: true',
        '    - name: PC',
        '      type: PC',
        '  connections:',
        '    - source: PC',
        '      target: SW',
      ].join('\n');

      const result = parseYamlTopology(yaml);

      expect(result.warnings).toEqual([]);
      expect(result.devices[0].templateId).toBeUndefined();
      // No binding in the file: none invented here, the store binds on load
      expect(result.connections[0]).toEqual({ id: 'conn-0', source: 'dev-1', target: 'dev-0' });
    });
  });

  describe('bindings that cannot be honoured', () => {
    const header = [
      'pixelcake:',
      '  devices:',
      '    - name: SW',
      '      type: Switch',
      '      ports:',
      '        - id: 1',
      '          enabled: true',
      '        - id: 2',
      '          enabled: true',
      '    - name: PC-A',
      '      type: PC',
      '      nics:',
      '        - name: eth0',
      '          enabled: true',
      '    - name: PC-B',
      '      type: PC',
      '      nics:',
      '        - name: eth0',
      '          enabled: true',
      '  connections:',
    ];

    it('warns and leaves the end unbound when the port does not exist', () => {
      const yaml = [...header, '    - source: PC-A', '      target: SW', '      source_nic: eth0', '      target_port: 7'].join('\n');

      const result = parseYamlTopology(yaml);

      expect(result.warnings).toEqual([
        'Connessione 1: porta 7 non trovata su «SW», estremità non assegnata',
      ]);
      expect(result.connections).toHaveLength(1); // the link itself is kept
      expect(result.connections[0].sourceNic).toBe('nic-1');
      expect(result.connections[0].targetPort).toBeUndefined();
    });

    it('warns and leaves the end unbound when the NIC name does not exist', () => {
      const yaml = [...header, '    - source: PC-A', '      target: SW', '      source_nic: wlan0', '      target_port: 1'].join('\n');

      const result = parseYamlTopology(yaml);

      expect(result.warnings).toEqual([
        'Connessione 1: interfaccia «wlan0» non trovata su «PC-A», estremità non assegnata',
      ]);
      expect(result.connections[0].sourceNic).toBeUndefined();
      expect(result.connections[0].targetPort).toBe(1);
    });

    it('warns when a port is asked for on a device that has none', () => {
      const yaml = [...header, '    - source: PC-A', '      target: SW', '      source_port: 1', '      target_port: 1'].join('\n');

      const result = parseYamlTopology(yaml);

      expect(result.warnings).toEqual([
        'Connessione 1: porta 1 non trovata su «PC-A», estremità non assegnata',
      ]);
      expect(result.connections[0].sourcePort).toBeUndefined();
      expect(result.connections[0].targetPort).toBe(1);
    });

    it('gives an interface to the first connection that asks for it and warns about the second', () => {
      const yaml = [
        ...header,
        '    - source: PC-A',
        '      target: SW',
        '      source_nic: eth0',
        '      target_port: 2',
        '    - source: PC-B',
        '      target: SW',
        '      source_nic: eth0',
        '      target_port: 2',
      ].join('\n');

      const result = parseYamlTopology(yaml);

      expect(result.warnings).toEqual([
        'Connessione 2: porta 2 di «SW» già usata da un\'altra connessione, estremità non assegnata',
      ]);
      expect(result.connections[0]).toMatchObject({ sourceNic: 'nic-1', targetPort: 2 });
      // PC-B has its own eth0: only the contested switch port is refused
      expect(result.connections[1].sourceNic).toBe('nic-1');
      expect(result.connections[1].targetPort).toBeUndefined();
    });
  });

  describe('malformed input', () => {
    it('returns a parse-error warning instead of throwing on invalid YAML syntax', () => {
      const result = parseYamlTopology('a: [1, 2'); // unterminated flow sequence

      expect(result.devices).toEqual([]);
      expect(result.connections).toEqual([]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatch(/^Errore di lettura del file YAML: /);
    });

    it('does not throw on garbage flow-map input', () => {
      expect(() => parseYamlTopology('{{{ not: yaml')).not.toThrow();
      const result = parseYamlTopology('{{{ not: yaml');
      expect(result.devices).toEqual([]);
      expect(result.warnings[0]).toMatch(/^Errore di lettura del file YAML: /);
    });

    it('reports non-object YAML (plain scalar) as invalid data', () => {
      const result = parseYamlTopology('just a scalar');
      expect(result.devices).toEqual([]);
      expect(result.warnings).toEqual(['Il file YAML non contiene dati validi']);
    });

    it('reports empty input as invalid data', () => {
      const result = parseYamlTopology('');
      expect(result.devices).toEqual([]);
      expect(result.warnings).toEqual(['Il file YAML non contiene dati validi']);
    });

    it('reports a non-object pixelcake root as unrecognized structure', () => {
      const result = parseYamlTopology('pixelcake: 42');
      expect(result.devices).toEqual([]);
      expect(result.warnings).toEqual(['Struttura YAML non riconosciuta']);
    });

    it('warns when no devices are present', () => {
      const result = parseYamlTopology('pixelcake:\n  devices: []\n  connections: []\n');
      expect(result.devices).toEqual([]);
      expect(result.connections).toEqual([]);
      expect(result.warnings).toContain('Nessun dispositivo trovato nel file');
    });
  });

  describe('connections referencing unknown devices', () => {
    it('warns and skips connections whose source or target name does not exist', () => {
      const yaml = [
        'pixelcake:',
        '  devices:',
        '    - name: Real',
        '      type: PC',
        '  connections:',
        '    - source: Real',
        '      target: Ghost',
        '    - source: Phantom',
        '      target: Real',
      ].join('\n');

      const result = parseYamlTopology(yaml);

      expect(result.devices).toHaveLength(1);
      expect(result.connections).toEqual([]);
      expect(result.warnings).toContain('Connessione 1: dispositivo di destinazione «Ghost» non trovato');
      expect(result.warnings).toContain('Connessione 2: dispositivo di partenza «Phantom» non trovato');
    });
  });
});
