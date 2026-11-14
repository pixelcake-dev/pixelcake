/**
 * Routes, firewall rules and port VLANs through the two file formats: the
 * project file (.pixelcake.json) and the YAML export/import. A network that
 * is saved and opened again must behave exactly as before.
 */

import { describe, it, expect } from 'vitest';
import type { NetworkDevice } from '@/types';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { ProjectFile } from '@/types';
import type { Topology } from '@/engine';
import { normalizeBindings, planAndEvaluateFlow, traceRoute } from '@/engine';
import { device, host, link, port, switchWith, topo } from '@/test/networkFixtures';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';
import { parseYamlTopology } from './importYaml';

/**
 * Two VLANs on one switch, a router with a port in each, a firewall towards
 * an outside host: every feature of the engine that lives in the data.
 */
function lab(): Topology {
  return topo(
    [
      host('pca', '192.168.10.11', '192.168.10.1', { label: 'PC-A' }),
      host('srv', '192.168.20.10', '192.168.20.1', { label: 'Web-01', type: 'Server', templateId: 'tpl-webserver' }),
      host('ext', '203.0.113.50', '203.0.113.1', { label: 'Ext' }),
      switchWith(
        'sw',
        [
          port(1, { portType: 'access', vlan: 10 }),
          port(2, { portType: 'access', vlan: 20 }),
          port(7, { portType: 'access', vlan: 10 }),
          port(8, { portType: 'access', vlan: 20 }),
        ],
        { label: 'SW-1', vlan: [10, 20] }
      ),
      device({
        id: 'r1',
        label: 'Router-1',
        type: 'Router',
        ip: '192.168.10.1',
        gateway: '10.0.0.2',
        ports: [
          port(1, { ip: '192.168.10.1', subnet: '255.255.255.0' }),
          port(2, { ip: '192.168.20.1', subnet: '255.255.255.0' }),
          port(3, { ip: '10.0.0.1', subnet: '255.255.255.252' }),
        ],
        routes: [{ id: 'route-1', destination: '172.16.0.0/16', nextHop: '10.0.0.2', description: 'lab' }],
      }),
      device({
        id: 'fw',
        label: 'FW-1',
        type: 'Firewall',
        ip: '10.0.0.2',
        ports: [
          port(1, { ip: '10.0.0.2', subnet: '255.255.255.252', securityZone: 'trust' }),
          port(2, { ip: '203.0.113.1', subnet: '255.255.255.0', securityZone: 'untrust' }),
        ],
        routes: [{ id: 'route-1', destination: '192.168.0.0/16', nextHop: '10.0.0.1' }],
        firewallRules: [
          { id: 'rule-1', action: 'deny', service: 'any', source: '203.0.113.66', destination: 'any', enabled: false },
          { id: 'rule-2', action: 'allow', service: 'web', source: 'untrust', destination: '192.168.20.10', description: 'sito' },
        ],
      }),
    ],
    [
      link('pca', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('srv', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('sw', 'r1', { id: 'up-10', sourcePort: 7, targetPort: 1 }),
      link('sw', 'r1', { id: 'up-20', sourcePort: 8, targetPort: 2 }),
      link('r1', 'fw', { sourcePort: 3, targetPort: 1 }),
      link('fw', 'ext', { sourcePort: 2, targetNic: 'nic-1' }),
    ]
  );
}

/** What the network does, as text: the things a file must not change */
function behaviour(t: Topology): string[] {
  const id = (label: string) => {
    const found = t.devices.find(d => d.label === label);
    if (!found) throw new Error(`no device "${label}"`);
    return found.id;
  };
  const say = (what: string, verdict: string, reason?: string) =>
    `${what}: ${verdict}${reason ? ` — ${reason}` : ''}`;
  const flow = (model: 'ping' | 'web', from: string, to: string) => {
    const result = planAndEvaluateFlow(model, id(from), id(to), t);
    return say(`${model} ${from} → ${to}`, result.verdict, result.failureReason);
  };
  const hops = traceRoute(id('PC-A'), id('Web-01'), t)
    .hops.map(h => `${h.label}${h.note ? ` (${h.note})` : ''}`)
    .join(' > ');
  return [
    flow('ping', 'PC-A', 'Web-01'),
    flow('web', 'Ext', 'Web-01'),
    flow('ping', 'Ext', 'Web-01'),
    flow('ping', 'PC-A', 'Ext'),
    `path: ${hops}`,
  ];
}

const EXPECTED = [
  'ping PC-A → Web-01: success',
  'web Ext → Web-01: success',
  'ping Ext → Web-01: blocked — request: firewall FW-1: no rule matches, zone policy untrust → trust denied',
  'ping PC-A → Ext: success',
  'path: PC-A > SW-1 (VLAN 10) > Router-1 (routed: 192.168.20.0/24 is on port 2) > SW-1 (VLAN 20) > Web-01',
];

function projectOf(t: Topology): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Lab',
    description: '',
    savedAt: '2026-11-12T10:00:00.000Z',
    settings: { ...DEFAULT_NETWORK_SETTINGS },
    activeCanvasId: 'canvas-1',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Canvas 1',
        devices: t.devices,
        connections: t.connections,
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 1,
        connectionCounter: 1,
      },
    ],
    templates: { devices: [], connections: [] },
  };
}

describe('the lab itself', () => {
  it('behaves as designed (the reference the files are held to)', () => {
    expect(behaviour(lab())).toEqual(EXPECTED);
  });
});

describe('routes, rules and VLANs in a project file', () => {
  it('come back exactly as they were saved', () => {
    const original = lab();
    const result = parseProjectFile(serializeProject(projectOf(original)));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;

    const [canvas] = result.project.canvases;
    expect(canvas.devices).toEqual(original.devices);
    expect(canvas.connections).toEqual(original.connections);
    expect(behaviour({ devices: canvas.devices, connections: canvas.connections })).toEqual(EXPECTED);
  });

  it('are written with their fields in a fixed order', () => {
    const text = serializeProject(projectOf(lab()));
    const saved = JSON.parse(text).canvases[0].devices.find((d: NetworkDevice) => d.id === 'fw');
    expect(Object.keys(saved.routes[0])).toEqual(['id', 'destination', 'nextHop']);
    expect(Object.keys(saved.firewallRules[0])).toEqual([
      'id',
      'action',
      'service',
      'source',
      'destination',
      'enabled',
    ]);
    // routes and rules come after the interfaces of the device
    const keys = Object.keys(saved);
    expect(keys.indexOf('routes')).toBeGreaterThan(keys.indexOf('ports'));
    expect(keys.indexOf('firewallRules')).toBeGreaterThan(keys.indexOf('routes'));
  });

  it('drops entries the engine could not read, keeps the good ones in order, and says so', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    const devices = damaged.canvases[0].devices;
    const fw = devices.find((d: NetworkDevice) => d.id === 'fw');
    const r1 = devices.find((d: NetworkDevice) => d.id === 'r1');
    fw.firewallRules = [
      { id: 'rule-9', action: 'maybe', service: 'web', source: 'any', destination: 'any' },
      fw.firewallRules[1],
      'allow everything',
      { id: 'rule-8', action: 'allow', service: 'ssh', source: 'any', destination: 'any' },
      { id: 'rule-7', action: 'allow', service: 'web', source: 'any' },
    ];
    fw.routes = 'via the router';
    r1.routes = [{ id: 'route-1', destination: '172.16.0.0/16' }, null];

    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opened = result.project.canvases[0].devices;
    const openedFw = opened.find(d => d.id === 'fw');
    expect(openedFw?.firewallRules).toEqual([lab().devices.find(d => d.id === 'fw')?.firewallRules?.[1]]);
    expect(openedFw?.routes).toBeUndefined();
    expect(opened.find(d => d.id === 'r1')?.routes).toBeUndefined();
    expect(result.warnings).toEqual(['Canvas «Canvas 1»: 2 dispositivi incompleti corretti.']);

    // nothing in the opened file can make a trace throw
    const t = { devices: opened, connections: result.project.canvases[0].connections };
    expect(() => behaviour(t)).not.toThrow();
  });
});

describe('routes, rules and VLANs through YAML', () => {
  function roundTrip(t: Topology) {
    const yaml = generateYaml(t.devices, t.connections, 'Lab');
    const result = parseYamlTopology(yaml);
    return {
      yaml,
      warnings: result.warnings,
      topology: {
        devices: result.devices,
        connections: normalizeBindings(result.devices, result.connections),
      },
    };
  }

  it('the network behaves the same after export and import', () => {
    const { warnings, topology } = roundTrip(lab());
    expect(warnings).toEqual([]);
    expect(behaviour(topology)).toEqual(EXPECTED);
  });

  it('routes and rules come back in the same order with the same content', () => {
    const { topology } = roundTrip(lab());
    const fw = topology.devices.find(d => d.label === 'FW-1');
    expect(fw?.routes).toEqual([{ id: 'route-1', destination: '192.168.0.0/16', nextHop: '10.0.0.1' }]);
    expect(fw?.firewallRules).toEqual(lab().devices.find(d => d.id === 'fw')?.firewallRules);
    const r1 = topology.devices.find(d => d.label === 'Router-1');
    expect(r1?.routes).toEqual([
      { id: 'route-1', destination: '172.16.0.0/16', nextHop: '10.0.0.2', description: 'lab' },
    ]);
    expect(r1?.gateway).toBe('10.0.0.2');
  });

  it('writes them the way a person would read them', () => {
    const { yaml } = roundTrip(lab());
    expect(yaml).toContain(
      ['      routes:', '        - destination: 192.168.0.0/16', '          via: 10.0.0.1'].join('\n')
    );
    expect(yaml).toContain(
      [
        '      firewall_rules:',
        '        - action: deny',
        '          service: any',
        '          from: 203.0.113.66',
        '          to: any',
        '          enabled: false',
        '        - action: allow',
        '          service: web',
        '          from: untrust',
        '          to: 192.168.20.10',
        '          description: sito',
      ].join('\n')
    );
  });

  it('writes nothing for a device without routes or rules', () => {
    const { yaml } = roundTrip(topo([host('pc', '192.168.1.10')]));
    expect(yaml).not.toContain('routes:');
    expect(yaml).not.toContain('firewall_rules:');
  });

  it('leaves out, with a warning, a route or a rule that is not complete', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: FW-1',
      '      type: Firewall',
      '      routes:',
      '        - destination: 192.168.0.0/16',
      '        - destination: 10.0.0.0/8',
      '          via: 10.0.0.1',
      '      firewall_rules:',
      '        - action: allow',
      '          service: web',
      '          from: untrust',
      '        - action: permit',
      '          from: any',
      '          to: any',
      '        - action: deny',
      '          from: any',
      '          to: any',
      '  connections: []',
    ].join('\n');
    const result = parseYamlTopology(yaml);
    expect(result.devices[0].routes).toEqual([
      { id: 'route-1', destination: '10.0.0.0/8', nextHop: '10.0.0.1' },
    ]);
    // a rule without a service is a rule for any service
    expect(result.devices[0].firewallRules).toEqual([
      { id: 'rule-1', action: 'deny', service: 'any', source: 'any', destination: 'any' },
    ]);
    expect(result.warnings).toEqual([
      'FW-1: rotta 1 senza destinazione o prossimo salto, ignorata',
      'FW-1: regola 1 incompleta o non valida, ignorata',
      'FW-1: regola 2 incompleta o non valida, ignorata',
    ]);
  });
});
