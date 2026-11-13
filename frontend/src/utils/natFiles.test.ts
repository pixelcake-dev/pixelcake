/**
 * Address translation through the two file formats: the project file
 * (.pixelcake.json) and the YAML export/import. NAT on a port and the port
 * forwards of a device must come back as they were saved, and the network
 * must behave exactly as before.
 */

import { describe, it, expect } from 'vitest';
import type { NetworkDevice, PortForward } from '@/types';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { ProjectFile } from '@/types';
import type { Topology } from '@/engine';
import { normalizeBindings, planAndEvaluateFlow } from '@/engine';
import { device, host, link, nic, port, rule, switchWith, topo } from '@/test/networkFixtures';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';
import { parseYamlTopology } from './importYaml';

const MASK = '255.255.255.0';

const FORWARDS: PortForward[] = [
  { id: 'forward-1', service: 'web', port: 2, to: '192.168.1.20' },
  { id: 'forward-2', service: 'email', port: 2, to: '192.168.1.10', enabled: false, description: 'posta' },
];

/**
 * A server behind a firewall that does NAT towards the Internet and publishes
 * it for web:
 *
 *   PC ─┐
 *       SW ── port 1  FW  port 2 (NAT) ── Internet ── Ext
 *   Srv ┘
 */
function lab(): Topology {
  return topo(
    [
      host('pc', '192.168.1.10', '192.168.1.1', { label: 'PC' }),
      host('srv', '192.168.1.20', '192.168.1.1', { label: 'Srv', type: 'Server', templateId: 'tpl-webserver' }),
      switchWith('sw', [port(1), port(2), port(3)], { label: 'SW' }),
      device({
        id: 'fw',
        label: 'FW',
        type: 'Firewall',
        ip: '192.168.1.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK, securityZone: 'trust' }),
          port(2, { ip: '203.0.113.2', subnet: MASK, securityZone: 'untrust', nat: true }),
        ],
        firewallRules: [{ ...rule('allow', 'web', 'untrust', '192.168.1.20'), id: 'rule-1' }],
        portForwards: FORWARDS,
      }),
      device({
        id: 'inet',
        label: 'Internet',
        type: 'Cloud',
        templateId: 'tpl-cloud',
        nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })],
      }),
      host('ext', '203.0.113.50', '203.0.113.2', { label: 'Ext' }),
    ],
    [
      link('pc', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('srv', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('sw', 'fw', { sourcePort: 3, targetPort: 1 }),
      link('fw', 'inet', { sourcePort: 2, targetNic: 'nic-1' }),
      link('inet', 'ext', { sourceNic: 'nic-2', targetNic: 'nic-1' }),
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
  const flow = (model: 'ping' | 'web', from: string, to: string) => {
    const result = planAndEvaluateFlow(model, id(from), id(to), t);
    const request = result.legs[0]?.trace;
    const addresses = request ? ` [${request.sourceIp} → ${request.targetIp}, seen as ${request.seenSourceIp ?? '='}, reached ${request.reachedIp ?? '='}]` : '';
    return `${model} ${from} → ${to}: ${result.verdict}${result.failureReason ? ` — ${result.failureReason}` : ''}${addresses}`;
  };
  return [flow('ping', 'PC', 'Ext'), flow('web', 'Ext', 'Srv'), flow('ping', 'Ext', 'Srv')];
}

const EXPECTED = [
  'ping PC → Ext: success [192.168.1.10 → 203.0.113.50, seen as 203.0.113.2, reached =]',
  'web Ext → Srv: success [203.0.113.50 → 203.0.113.2, seen as =, reached 192.168.1.20]',
  'ping Ext → Srv: blocked — request: Internet does not carry private addresses: 192.168.1.20 is not ' +
    'reachable from outside: no port forward publishes it for ping [203.0.113.50 → 192.168.1.20, seen as =, reached =]',
];

function projectOf(t: Topology): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Lab',
    description: '',
    savedAt: '2026-11-13T10:00:00.000Z',
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

const firewallOf = (devices: NetworkDevice[]) => devices.find(d => d.label === 'FW');

describe('the lab itself', () => {
  it('behaves as designed (the reference the files are held to)', () => {
    expect(behaviour(lab())).toEqual(EXPECTED);
  });
});

describe('NAT and port forwards in a project file', () => {
  it('come back exactly as they were saved', () => {
    const original = lab();
    const result = parseProjectFile(serializeProject(projectOf(original)));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;

    const [canvas] = result.project.canvases;
    expect(canvas.devices).toEqual(original.devices);
    expect(firewallOf(canvas.devices)?.portForwards).toEqual(FORWARDS);
    expect(firewallOf(canvas.devices)?.ports?.map(p => p.nat)).toEqual([undefined, true]);
    expect(behaviour({ devices: canvas.devices, connections: canvas.connections })).toEqual(EXPECTED);
  });

  it('are written with their fields in a fixed order, after the rules', () => {
    const saved = JSON.parse(serializeProject(projectOf(lab()))).canvases[0].devices.find(
      (d: NetworkDevice) => d.id === 'fw'
    );
    expect(Object.keys(saved.portForwards[0])).toEqual(['id', 'service', 'port', 'to']);
    expect(Object.keys(saved.portForwards[1])).toEqual(['id', 'service', 'port', 'to', 'enabled', 'description']);
    const keys = Object.keys(saved);
    expect(keys.indexOf('portForwards')).toBeGreaterThan(keys.indexOf('firewallRules'));
    expect(keys[keys.length - 1]).toBe('portForwards');
  });

  it('a device without forwards is written without the list', () => {
    const text = serializeProject(projectOf(topo([host('pc', '192.168.1.10')])));
    expect(text).not.toContain('portForwards');
  });

  it('drops the forwards the engine could not read, keeps the good ones in order, and says so', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    const fw = damaged.canvases[0].devices.find((d: NetworkDevice) => d.id === 'fw');
    fw.portForwards = [
      { id: 'forward-9', service: 'ssh', port: 2, to: '192.168.1.20' },
      { id: 'forward-8', service: 'web', port: '2', to: '192.168.1.20' },
      FORWARDS[1],
      { id: 'forward-7', service: 'web', port: 2.5, to: '192.168.1.20' },
      { id: 'forward-6', service: 'web', port: 2 },
      'web to the server',
      { service: 'web', port: 2, to: '192.168.1.20' },
      FORWARDS[0],
    ];

    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(firewallOf(result.project.canvases[0].devices)?.portForwards).toEqual([FORWARDS[1], FORWARDS[0]]);
    expect(result.warnings).toEqual(['Canvas "Canvas 1": 1 dispositivo incompleto corretto.']);
  });

  it('a list that is no list at all is left out, and nothing else is touched', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    const fw = damaged.canvases[0].devices.find((d: NetworkDevice) => d.id === 'fw');
    fw.portForwards = 'everything to the server';

    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opened = firewallOf(result.project.canvases[0].devices);
    expect(opened?.portForwards).toBeUndefined();
    expect(opened?.firewallRules).toHaveLength(1);
    expect(opened?.ports?.[1].nat).toBe(true);
  });

  it('a file written before forwards existed opens with no warning', () => {
    const older = JSON.parse(serializeProject(projectOf(lab())));
    for (const d of older.canvases[0].devices) delete d.portForwards;

    const result = parseProjectFile(JSON.stringify(older));
    expect(result).toMatchObject({ ok: true, warnings: [] });
  });
});

describe('NAT and port forwards through YAML', () => {
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

  it('the forwards come back in the same order with the same content, and NAT on its port', () => {
    const { topology } = roundTrip(lab());
    const fw = firewallOf(topology.devices);
    expect(fw?.portForwards).toEqual(FORWARDS);
    expect(fw?.ports?.map(p => p.nat === true)).toEqual([false, true]);
  });

  it('writes them the way a person would read them', () => {
    const { yaml } = roundTrip(lab());
    expect(yaml).toContain(
      [
        '      port_forwards:',
        '        - service: web',
        '          interface: 2',
        '          to: 192.168.1.20',
        '        - service: email',
        '          interface: 2',
        '          to: 192.168.1.10',
        '          enabled: false',
        '          description: posta',
      ].join('\n')
    );
    expect(yaml).toContain('nat: true');
    // after the rules of the same device
    expect(yaml.indexOf('port_forwards:')).toBeGreaterThan(yaml.indexOf('firewall_rules:'));
  });

  it('writes nothing for a device without forwards', () => {
    const { yaml } = roundTrip(topo([host('pc', '192.168.1.10')]));
    expect(yaml).not.toContain('port_forwards:');
  });

  it('leaves out, with a warning, a forward that is not complete', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: FW',
      '      type: Firewall',
      '      port_forwards:',
      '        - service: web',
      '          interface: 2',
      '        - service: web',
      '          interface: two',
      '          to: 192.168.1.20',
      '        - service: ssh',
      '          interface: 2',
      '          to: 192.168.1.20',
      '        - interface: 2',
      '          to: 192.168.1.20',
      '        - service: email',
      '          interface: 3',
      '          to: 192.168.1.10',
      '          enabled: false',
      '  connections: []',
    ].join('\n');
    const result = parseYamlTopology(yaml);

    // a forward without a service is a forward for any service
    expect(result.devices[0].portForwards).toEqual([
      { id: 'forward-1', service: 'any', port: 2, to: '192.168.1.20' },
      { id: 'forward-2', service: 'email', port: 3, to: '192.168.1.10', enabled: false },
    ]);
    expect(result.warnings).toEqual([
      'FW: inoltro 1 incompleto o non valido, ignorato',
      'FW: inoltro 2 incompleto o non valido, ignorato',
      'FW: inoltro 3 incompleto o non valido, ignorato',
    ]);
  });
});
