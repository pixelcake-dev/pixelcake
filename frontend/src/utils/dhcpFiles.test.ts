/**
 * DHCP through the two file formats: the project file (.pixelcake.json) and
 * the YAML export/import. A card on DHCP and the pool of an interface must
 * come back as they were saved, the network must behave exactly as before,
 * and no file may ever carry the address a card happens to be leased.
 */

import { describe, it, expect } from 'vitest';
import type { DhcpPool, NetworkDevice } from '@/types';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { ProjectFile } from '@/types';
import type { Topology } from '@/engine';
import { normalizeBindings, planAndEvaluateFlow, resolveDhcp } from '@/engine';
import { device, host, link, nic, port, switchWith, topo } from '@/test/networkFixtures';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';
import { parseYamlTopology } from './importYaml';
import { generateTerraform } from './exportTerraform';

const MASK = '255.255.255.0';
const ROUTER_POOL: DhcpPool = { start: '192.168.1.100', end: '192.168.1.199' };
const SERVER_POOL: DhcpPool = { start: '10.0.0.50', end: '10.0.0.59', gateway: '10.0.0.1' };

/** A card on DHCP as a drawing keeps it: no address of its own */
const automatic = () => nic({ dhcp: true, subnet: '' });

/**
 *   A (dhcp) ─┐                                ┌─ Srv 10.0.0.10 (hands out 10.0.0.50–59)
 *             SW ── port 1  R  port 2 ── SW2 ──┤
 *   B .11   ──┘   (hands out .100–.199)        └─ C (dhcp)
 */
function lab(): Topology {
  const server = host('srv', '10.0.0.10', '10.0.0.1', { label: 'Srv', type: 'Server', templateId: 'tpl-dhcpserver' });
  server.nics![0].dhcpServer = SERVER_POOL;
  return topo(
    [
      device({ id: 'a', label: 'A', nics: [automatic()] }),
      host('b', '192.168.1.11', '192.168.1.1', { label: 'B' }),
      switchWith('sw', [port(1), port(2), port(3)], { label: 'SW' }),
      device({
        id: 'r',
        label: 'R',
        type: 'Router',
        ip: '192.168.1.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK, dhcpServer: ROUTER_POOL }),
          port(2, { ip: '10.0.0.1', subnet: MASK }),
        ],
      }),
      switchWith('sw2', [port(1), port(2), port(3)], { label: 'SW2' }),
      server,
      device({ id: 'c', label: 'C', nics: [automatic()] }),
    ],
    [
      link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('sw', 'r', { sourcePort: 3, targetPort: 1 }),
      link('r', 'sw2', { sourcePort: 2, targetPort: 1 }),
      link('srv', 'sw2', { sourceNic: 'nic-1', targetPort: 2 }),
      link('c', 'sw2', { sourceNic: 'nic-1', targetPort: 3 }),
    ]
  );
}

/** What DHCP does in the network, and what the network then does, as text */
function behaviour(t: Topology): string[] {
  const label = (id: string) => t.devices.find(d => d.id === id)?.label ?? id;
  const id = (name: string) => {
    const found = t.devices.find(d => d.label === name);
    if (!found) throw new Error(`no device "${name}"`);
    return found.id;
  };
  const dhcp = resolveDhcp(t);
  const flow = (from: string, to: string) => {
    const result = planAndEvaluateFlow('ping', id(from), id(to), t);
    return `ping ${from} → ${to}: ${result.verdict} [${result.legs[0]?.trace.sourceIp} → ${result.legs[0]?.trace.targetIp}]`;
  };
  return [
    ...dhcp.leases.map(
      lease => `${label(lease.deviceId)} ${lease.ip} / ${lease.mask} gw ${lease.gateway} from ${label(lease.server.deviceId)}`
    ),
    ...dhcp.unserved.map(entry => `${label(entry.deviceId)}: ${entry.reason}`),
    flow('A', 'C'),
    flow('C', 'B'),
  ];
}

const EXPECTED = [
  'A 192.168.1.100 / 255.255.255.0 gw 192.168.1.1 from R',
  'C 10.0.0.50 / 255.255.255.0 gw 10.0.0.1 from Srv',
  'ping A → C: success [192.168.1.100 → 10.0.0.50]',
  'ping C → B: success [10.0.0.50 → 192.168.1.11]',
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

const named = (devices: NetworkDevice[], label: string) => devices.find(d => d.label === label);
/** Every address written in a text, to look for one that should not be there */
const addressesIn = (text: string) => text.match(/\d+\.\d+\.\d+\.\d+/g) ?? [];

describe('the lab itself', () => {
  it('behaves as designed (the reference the files are held to)', () => {
    expect(behaviour(lab())).toEqual(EXPECTED);
  });
});

describe('DHCP in a project file', () => {
  it('comes back exactly as it was saved', () => {
    const original = lab();
    const result = parseProjectFile(serializeProject(projectOf(original)));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;

    const [canvas] = result.project.canvases;
    expect(canvas.devices).toEqual(original.devices);
    expect(named(canvas.devices, 'A')?.nics?.[0]).toMatchObject({ dhcp: true, ip: '', gateway: '' });
    expect(named(canvas.devices, 'R')?.ports?.map(p => p.dhcpServer)).toEqual([ROUTER_POOL, undefined]);
    expect(named(canvas.devices, 'Srv')?.nics?.[0].dhcpServer).toEqual(SERVER_POOL);
    expect(behaviour({ devices: canvas.devices, connections: canvas.connections })).toEqual(EXPECTED);
  });

  it('never carries a leased address', () => {
    const text = serializeProject(projectOf(lab()));
    for (const leased of ['192.168.1.100', '10.0.0.50']) {
      // (each is there once: as the first address of its pool)
      expect(addressesIn(text).filter(address => address === leased)).toHaveLength(1);
    }
  });

  it('is written with its fields in a fixed order: the range, then the gateway', () => {
    const devices = JSON.parse(serializeProject(projectOf(lab()))).canvases[0].devices as NetworkDevice[];
    const router = named(devices, 'R');
    const server = named(devices, 'Srv');
    const client = named(devices, 'A');
    expect(Object.keys(router?.ports?.[0] ?? {})).toEqual(['id', 'enabled', 'ip', 'subnet', 'dhcpServer']);
    expect(Object.keys(router?.ports?.[0].dhcpServer ?? {})).toEqual(['start', 'end']);
    expect(Object.keys(server?.nics?.[0].dhcpServer ?? {})).toEqual(['start', 'end', 'gateway']);
    expect(Object.keys(server?.nics?.[0] ?? {})).toEqual([
      'id', 'name', 'enabled', 'speed', 'ip', 'subnet', 'gateway', 'dhcpServer',
    ]);
    expect(Object.keys(client?.nics?.[0] ?? {})).toEqual([
      'id', 'name', 'enabled', 'speed', 'ip', 'subnet', 'gateway', 'dhcp',
    ]);
  });

  it('a device without DHCP is written without a word about it', () => {
    const text = serializeProject(projectOf(topo([host('pc', '192.168.1.10')])));
    expect(text).not.toContain('dhcp');
  });

  it('drops what the engine could not read, keeps the rest, and says so', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    const saved = damaged.canvases[0].devices;
    const router = saved.find((d: NetworkDevice) => d.id === 'r');
    router.ports[0].dhcpServer = { start: '192.168.1.100' };
    router.ports[1].dhcpServer = 'everything';
    const server = saved.find((d: NetworkDevice) => d.id === 'srv');
    server.nics[0].dhcpServer = { start: '10.0.0.50', end: '10.0.0.59', gateway: 5 };
    const client = saved.find((d: NetworkDevice) => d.id === 'a');
    client.nics[0].dhcp = 'yes';

    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opened = result.project.canvases[0].devices;
    expect(named(opened, 'R')?.ports).toEqual([
      { id: 1, enabled: true, ip: '192.168.1.1', subnet: MASK },
      { id: 2, enabled: true, ip: '10.0.0.1', subnet: MASK },
    ]);
    expect(named(opened, 'Srv')?.nics?.[0]).not.toHaveProperty('dhcpServer');
    expect(named(opened, 'Srv')?.nics?.[0].ip).toBe('10.0.0.10');
    expect(named(opened, 'A')?.nics?.[0]).not.toHaveProperty('dhcp');
    // C was not touched: it is not counted
    expect(named(opened, 'C')?.nics?.[0].dhcp).toBe(true);
    expect(result.warnings).toEqual(['Canvas "Canvas 1": 3 dispositivi incompleti corretti.']);
  });

  it('a card set to DHCP that carries an address in the file opens without it, and with no warning', () => {
    const stale = JSON.parse(serializeProject(projectOf(lab())));
    const client = stale.canvases[0].devices.find((d: NetworkDevice) => d.id === 'a');
    Object.assign(client, { ip: '192.168.1.77', gateway: '192.168.1.1' });
    Object.assign(client.nics[0], { ip: '192.168.1.77', subnet: MASK, gateway: '192.168.1.1' });

    const result = parseProjectFile(JSON.stringify(stale));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    const [canvas] = result.project.canvases;
    expect(named(canvas.devices, 'A')).toMatchObject({
      ip: '',
      gateway: '',
      nics: [{ dhcp: true, ip: '', subnet: '', gateway: '' }],
    });
    expect(behaviour({ devices: canvas.devices, connections: canvas.connections })).toEqual(EXPECTED);
  });

  it('a file written before DHCP existed opens with no warning, and nothing in it is on DHCP', () => {
    const older = JSON.parse(serializeProject(projectOf(topo([host('pc', '192.168.1.10'), host('srv', '192.168.1.20')]))));
    const result = parseProjectFile(JSON.stringify(older));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    expect(resolveDhcp(result.project.canvases[0])).toMatchObject({ leases: [], unserved: [], pools: [] });
  });
});

describe('DHCP through YAML', () => {
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

  it('the cards and the pools come back with the same content', () => {
    const { topology } = roundTrip(lab());
    expect(named(topology.devices, 'A')).toMatchObject({
      ip: '',
      gateway: '',
      nics: [{ dhcp: true, ip: '', subnet: '', gateway: '' }],
    });
    expect(named(topology.devices, 'B')?.nics?.[0]).not.toHaveProperty('dhcp');
    expect(named(topology.devices, 'R')?.ports?.map(p => p.dhcpServer)).toEqual([ROUTER_POOL, undefined]);
    expect(named(topology.devices, 'Srv')?.nics?.[0].dhcpServer).toEqual(SERVER_POOL);
  });

  it('writes them the way a person would read them', () => {
    const { yaml } = roundTrip(lab());
    expect(yaml).toContain(
      [
        '    - name: A',
        '      type: PC',
        '      nics:',
        '        - name: eth0',
        '          enabled: true',
        '          dhcp: true',
        '          speed: auto',
      ].join('\n')
    );
    expect(yaml).toContain(
      [
        '        - id: 1',
        '          enabled: true',
        '          ip: 192.168.1.1',
        '          subnet: 255.255.255.0',
        '          dhcp_server:',
        '            start: 192.168.1.100',
        '            end: 192.168.1.199',
      ].join('\n')
    );
    expect(yaml).toContain(
      [
        '          gateway: 10.0.0.1',
        '          dhcp_server:',
        '            start: 10.0.0.50',
        '            end: 10.0.0.59',
        '            gateway: 10.0.0.1',
      ].join('\n')
    );
  });

  it('never writes the address a card is leased, even when it is handed the drawing with its leases', () => {
    const leased = resolveDhcp(lab()).topology;
    expect(named(leased.devices, 'A')).toMatchObject({ ip: '192.168.1.100', subnet: MASK, gateway: '192.168.1.1' });
    const yaml = generateYaml(leased.devices, leased.connections, 'Lab');
    expect(yaml).toBe(generateYaml(lab().devices, lab().connections, 'Lab'));
    expect(addressesIn(yaml).filter(address => address === '192.168.1.100')).toHaveLength(1);
    expect(addressesIn(yaml).filter(address => address === '10.0.0.50')).toHaveLength(1);
  });

  it('writes nothing for a drawing without DHCP', () => {
    const { yaml } = roundTrip(topo([host('pc', '192.168.1.10')]));
    expect(yaml).not.toContain('dhcp');
  });

  it('a card with "dhcp: true" does not read the address written next to it, nor a pool', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: PC',
      '      type: PC',
      '      ip: 192.168.1.77',
      '      gateway: 192.168.1.1',
      '      nics:',
      '        - name: eth0',
      '          dhcp: true',
      '          ip: 192.168.1.77',
      '          subnet: 255.255.255.0',
      '          gateway: 192.168.1.1',
      '          dhcp_server:',
      '            start: 192.168.1.100',
      '            end: 192.168.1.110',
      '    - name: Other',
      '      type: PC',
      '      ip: 192.168.1.78',
      '      nics:',
      '        - name: eth0',
      '          dhcp: false',
      '          ip: 192.168.1.78',
      '  connections: []',
    ].join('\n');
    const result = parseYamlTopology(yaml);
    expect(result.warnings).toEqual([]);
    expect(result.devices[0]).toMatchObject({ ip: '', gateway: '' });
    expect(result.devices[0].nics?.[0]).toEqual({
      id: 'nic-1',
      name: 'eth0',
      enabled: true,
      speed: 'auto',
      ip: '',
      subnet: '',
      gateway: '',
      mac: undefined,
      description: undefined,
      dhcp: true,
    });
    // "dhcp: false" is a card like any other
    expect(result.devices[1]).toMatchObject({ ip: '192.168.1.78', nics: [{ ip: '192.168.1.78' }] });
    expect(result.devices[1].nics?.[0]).not.toHaveProperty('dhcp');
  });

  it('leaves out, with a warning, a pool without its two ends; a gateway is kept only when written', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: R',
      '      type: Router',
      '      ports:',
      '        - id: 1',
      '          ip: 192.168.1.1',
      '          dhcp_server:',
      '            start: 192.168.1.100',
      '        - id: 2',
      '          ip: 192.168.2.1',
      '          dhcp_server: yes',
      '        - id: 3',
      '          ip: 192.168.3.1',
      '          dhcp_server:',
      '            start: 192.168.3.100',
      '            end: 192.168.3.110',
      '            gateway: ""',
      '        - id: 4',
      '          ip: 192.168.4.1',
      '          dhcp_server:',
      '            end: 192.168.4.110',
      '    - name: Srv',
      '      type: Server',
      '      nics:',
      '        - name: ens3',
      '          ip: 10.0.0.10',
      '          dhcp_server:',
      '            end: 10.0.0.59',
      '        - name: ens4',
      '          ip: 10.0.1.10',
      '          dhcp_server:',
      '            start: 10.0.1.50',
      '            end: 10.0.1.59',
      '            gateway: 10.0.1.1',
      '  connections: []',
    ].join('\n');
    const result = parseYamlTopology(yaml);
    expect(result.devices[0].ports?.map(p => p.dhcpServer)).toEqual([
      undefined,
      undefined,
      { start: '192.168.3.100', end: '192.168.3.110' },
      undefined,
    ]);
    expect(result.devices[1].nics?.map(n => n.dhcpServer)).toEqual([
      undefined,
      { start: '10.0.1.50', end: '10.0.1.59', gateway: '10.0.1.1' },
    ]);
    expect(result.warnings).toEqual([
      'Port 1: server DHCP senza primo o ultimo indirizzo, ignorato',
      'Port 2: server DHCP senza primo o ultimo indirizzo, ignorato',
      'Port 4: server DHCP senza primo o ultimo indirizzo, ignorato',
      'Srv: ens3: server DHCP senza primo o ultimo indirizzo, ignorato',
    ]);
  });
});

describe('DHCP in the Terraform sketch', () => {
  it('says which card takes its address from DHCP and which interface hands some out', () => {
    const t = lab();
    const sketch = generateTerraform(t.devices, t.connections);
    expect(sketch).toContain('dhcp = true');
    expect(sketch).toContain('dhcp_pool = "192.168.1.100-192.168.1.199"');
    expect(sketch).toContain('dhcp_pool = "10.0.0.50-10.0.0.59"');
    expect(generateTerraform([host('pc', '192.168.1.10')], [])).not.toContain('dhcp');
  });
});
