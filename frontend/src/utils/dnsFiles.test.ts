/**
 * DNS through the two file formats: the project file (.pixelcake.json) and
 * the YAML export/import. The records of a server, the DNS server of a card,
 * the one a pool hands out, a rule and a forward for `dns` must come back as
 * they were saved, and the names must resolve exactly as before.
 */

import { describe, it, expect } from 'vitest';
import type { DnsRecord, NetworkDevice } from '@/types';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import type { ProjectFile } from '@/types';
import type { Topology } from '@/engine';
import { lookup, normalizeBindings, planAndEvaluateFlow, resolveDhcp } from '@/engine';
import { device, forward, host, link, nic, port, rule, switchWith, topo } from '@/test/networkFixtures';
import { DEFAULT_NETWORK_SETTINGS, parseProjectFile, serializeProject } from './projectFile';
import { generateYaml } from './exportYaml';
import { parseYamlTopology } from './importYaml';
import { generateTerraform } from './exportTerraform';

const MASK = '255.255.255.0';
const NS_IP = '10.0.0.53';
const RECORDS: DnsRecord[] = [
  { id: 'record-1', name: 'www.azienda.example', address: '10.0.0.80' },
  { id: 'record-2', name: 'posta.azienda.example', address: '10.0.0.25' },
];

/**
 *   A .11 (asks 10.0.0.53) ─┐
 *                           SW ── port 1  FW  port 2 ── NS 10.0.0.53 (records)
 *   B (dhcp)               ─┘   192.168.1.1 (untrust)   10.0.0.1 (dmz)
 *
 * FW hands out .100–.199 with itself as DNS server, and forwards dns from
 * port 1 to NS; one rule lets dns in, and nothing else.
 */
function lab(): Topology {
  return topo(
    [
      device({
        id: 'a',
        label: 'A',
        ip: '192.168.1.11',
        gateway: '192.168.1.1',
        nics: [nic({ ip: '192.168.1.11', gateway: '192.168.1.1', dns: NS_IP })],
      }),
      device({ id: 'b', label: 'B', subnet: '', nics: [nic({ dhcp: true, subnet: '' })] }),
      switchWith('sw', [port(1), port(2), port(3)], { label: 'SW' }),
      device({
        id: 'fw',
        label: 'FW',
        type: 'Firewall',
        ip: '192.168.1.1',
        ports: [
          port(1, {
            ip: '192.168.1.1',
            subnet: MASK,
            securityZone: 'untrust',
            dhcpServer: { start: '192.168.1.100', end: '192.168.1.199', dns: '192.168.1.1' },
          }),
          port(2, { ip: '10.0.0.1', subnet: MASK, securityZone: 'dmz' }),
        ],
        firewallRules: [rule('allow', 'dns', 'untrust', NS_IP, { id: 'rule-1' })],
        portForwards: [forward('dns', 1, NS_IP, { id: 'forward-1' })],
      }),
      host('ns', NS_IP, '10.0.0.1', { label: 'NS', type: 'Server', templateId: 'tpl-dnsserver', dnsRecords: RECORDS }),
    ],
    [
      link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('sw', 'fw', { sourcePort: 3, targetPort: 1 }),
      link('fw', 'ns', { sourcePort: 2, targetNic: 'nic-1' }),
    ]
  );
}

/** What the names of the network resolve to, and what the firewall then lets through, as text */
function behaviour(t: Topology): string[] {
  const id = (name: string) => {
    const found = t.devices.find(d => d.label === name);
    if (!found) throw new Error(`no device "${name}"`);
    return found.id;
  };
  const ask = (from: string, name: string) => {
    const result = lookup(t, id(from), name);
    return result.address
      ? `${from}: ${name} is ${result.address}, says ${result.server?.label} asked at ${result.serverIp}`
      : `${from}: ${result.failureReason}`;
  };
  return [
    ask('A', 'www.azienda.example'),
    ask('B', 'posta.azienda.example'),
    ask('A', 'intranet.azienda.example'),
    `ping A → NS: ${planAndEvaluateFlow('ping', id('A'), id('NS'), t).verdict}`,
  ];
}

const EXPECTED = [
  'A: www.azienda.example is 10.0.0.80, says NS asked at 10.0.0.53',
  'B: posta.azienda.example is 10.0.0.25, says NS asked at 192.168.1.1',
  'A: NS has no record for intranet.azienda.example',
  'ping A → NS: blocked',
];

function projectOf(t: Topology): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: 'Lab',
    description: '',
    savedAt: '2026-11-14T10:00:00.000Z',
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

describe('the lab itself', () => {
  it('behaves as designed (the reference the files are held to)', () => {
    expect(behaviour(lab())).toEqual(EXPECTED);
  });
});

describe('DNS in a project file', () => {
  it('comes back exactly as it was saved', () => {
    const original = lab();
    const result = parseProjectFile(serializeProject(projectOf(original)));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;

    const [canvas] = result.project.canvases;
    expect(canvas.devices).toEqual(original.devices);
    expect(named(canvas.devices, 'NS')?.dnsRecords).toEqual(RECORDS);
    expect(named(canvas.devices, 'A')?.nics?.[0].dns).toBe(NS_IP);
    expect(named(canvas.devices, 'FW')?.ports?.[0].dhcpServer?.dns).toBe('192.168.1.1');
    expect(named(canvas.devices, 'FW')?.firewallRules?.[0].service).toBe('dns');
    expect(named(canvas.devices, 'FW')?.portForwards?.[0].service).toBe('dns');
    expect(behaviour({ devices: canvas.devices, connections: canvas.connections })).toEqual(EXPECTED);
  });

  it('is written with its fields in a fixed order, however the drawing was put together', () => {
    const shuffled = lab();
    shuffled.devices = shuffled.devices.map(d =>
      d.id === 'ns'
        ? { dnsRecords: RECORDS.map(({ id, name, address }) => ({ address, name, id })), ...d }
        : d.id === 'a'
          ? { ...d, nics: d.nics?.map(({ dns, ...rest }) => ({ dns, ...rest })) }
          : d
    );
    const devices = JSON.parse(serializeProject(projectOf(shuffled))).canvases[0].devices as NetworkDevice[];
    const server = named(devices, 'NS');
    expect(Object.keys(server ?? {}).slice(-2)).toEqual(['nics', 'dnsRecords']);
    expect(server?.dnsRecords?.map(record => Object.keys(record))).toEqual([
      ['id', 'name', 'address'],
      ['id', 'name', 'address'],
    ]);
    expect(Object.keys(named(devices, 'A')?.nics?.[0] ?? {})).toEqual([
      'id', 'name', 'enabled', 'speed', 'ip', 'subnet', 'gateway', 'dns',
    ]);
    expect(Object.keys(named(devices, 'FW')?.ports?.[0].dhcpServer ?? {})).toEqual(['start', 'end', 'dns']);
    // the same text as the drawing put together the usual way
    expect(serializeProject(projectOf(shuffled))).toBe(serializeProject(projectOf(lab())));
  });

  it('a device without DNS is written without a word about it', () => {
    const text = serializeProject(projectOf(topo([host('pc', '192.168.1.10'), host('srv', '192.168.1.20', '', { type: 'Server' })])));
    expect(text.toLowerCase()).not.toContain('dns');
  });

  it('drops what the engine could not read, keeps the rest, and says so', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    const saved = damaged.canvases[0].devices;
    const server = saved.find((d: NetworkDevice) => d.id === 'ns');
    server.dnsRecords = [
      { id: 'record-1', name: 'www.azienda.example' },
      'posta.azienda.example',
      { id: 'record-3', name: 'nas.azienda.example', address: '10.0.0.82' },
      { id: 'record-4', name: 'db.azienda.example', address: 5 },
      { name: 'web.azienda.example', address: '10.0.0.83' },
      { id: 'record-6', name: '', address: '10.0.0.84' },
    ];
    const client = saved.find((d: NetworkDevice) => d.id === 'a');
    client.nics[0].dns = 53;
    const firewall = saved.find((d: NetworkDevice) => d.id === 'fw');
    firewall.ports[0].dhcpServer.dns = ['192.168.1.1'];

    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opened = result.project.canvases[0].devices;
    expect(named(opened, 'NS')?.dnsRecords).toEqual([
      { id: 'record-3', name: 'nas.azienda.example', address: '10.0.0.82' },
    ]);
    expect(named(opened, 'A')?.nics?.[0]).not.toHaveProperty('dns');
    expect(named(opened, 'A')?.nics?.[0].ip).toBe('192.168.1.11');
    // a pool that hands out something the engine cannot read is not a pool
    expect(named(opened, 'FW')?.ports?.[0]).not.toHaveProperty('dhcpServer');
    expect(named(opened, 'FW')?.ports?.[0].ip).toBe('192.168.1.1');
    expect(result.warnings).toEqual(['Canvas "Canvas 1": 3 dispositivi incompleti corretti.']);
  });

  it('a server left with no record that can be read has no list at all', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    damaged.canvases[0].devices.find((d: NetworkDevice) => d.id === 'ns').dnsRecords = 'www.azienda.example';
    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(named(result.project.canvases[0].devices, 'NS')).not.toHaveProperty('dnsRecords');
    expect(result.warnings).toEqual(['Canvas "Canvas 1": 1 dispositivo incompleto corretto.']);
  });

  it('a rule or a forward for a service that does not exist is still dropped', () => {
    const damaged = JSON.parse(serializeProject(projectOf(lab())));
    const firewall = damaged.canvases[0].devices.find((d: NetworkDevice) => d.id === 'fw');
    firewall.firewallRules[0].service = 'names';
    firewall.portForwards[0].service = 'names';
    const result = parseProjectFile(JSON.stringify(damaged));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opened = named(result.project.canvases[0].devices, 'FW');
    expect(opened).not.toHaveProperty('firewallRules');
    expect(opened).not.toHaveProperty('portForwards');
  });

  it('a card set to DHCP that carries a DNS server in the file opens without it, and with no warning', () => {
    const stale = JSON.parse(serializeProject(projectOf(lab())));
    const client = stale.canvases[0].devices.find((d: NetworkDevice) => d.id === 'b');
    client.nics[0].dns = '10.9.9.9';

    const result = parseProjectFile(JSON.stringify(stale));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    const [canvas] = result.project.canvases;
    expect(named(canvas.devices, 'B')?.nics?.[0]).not.toHaveProperty('dns');
    expect(behaviour({ devices: canvas.devices, connections: canvas.connections })).toEqual(EXPECTED);
  });

  it('a file written before DNS existed opens with no warning, and nothing in it asks or answers', () => {
    const before = topo([host('pc', '192.168.1.10'), host('srv', '192.168.1.20', '', { type: 'Server' })]);
    const older = JSON.parse(serializeProject(projectOf(before)));
    const result = parseProjectFile(JSON.stringify(older));
    expect(result).toMatchObject({ ok: true, warnings: [] });
    if (!result.ok) return;
    const [canvas] = result.project.canvases;
    expect(canvas.devices).toEqual(before.devices);
    expect(lookup(canvas, 'pc', 'www.azienda.example').failureReason).toBe(
      'pc has no DNS server: it cannot look up www.azienda.example'
    );
  });
});

describe('DNS through YAML', () => {
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

  it('the names resolve the same after export and import', () => {
    const { warnings, topology } = roundTrip(lab());
    expect(warnings).toEqual([]);
    expect(behaviour(topology)).toEqual(EXPECTED);
  });

  it('the records, the cards and the pool come back with the same content', () => {
    const { topology } = roundTrip(lab());
    expect(named(topology.devices, 'NS')?.dnsRecords).toEqual(RECORDS);
    expect(named(topology.devices, 'A')?.nics?.[0].dns).toBe(NS_IP);
    expect(named(topology.devices, 'B')?.nics?.[0]).not.toHaveProperty('dns');
    expect(named(topology.devices, 'NS')?.nics?.[0]).not.toHaveProperty('dns');
    expect(named(topology.devices, 'FW')?.ports?.map(p => p.dhcpServer)).toEqual([
      { start: '192.168.1.100', end: '192.168.1.199', dns: '192.168.1.1' },
      undefined,
    ]);
    expect(named(topology.devices, 'FW')).toMatchObject({
      firewallRules: [{ action: 'allow', service: 'dns', source: 'untrust', destination: NS_IP }],
      portForwards: [{ service: 'dns', port: 1, to: NS_IP }],
    });
    expect(named(topology.devices, 'A')).not.toHaveProperty('dnsRecords');
  });

  it('writes them the way a person would read them', () => {
    const { yaml } = roundTrip(lab());
    expect(yaml).toContain(
      [
        '          ip: 192.168.1.11',
        '          subnet: 255.255.255.0',
        '          gateway: 192.168.1.1',
        '          dns: 10.0.0.53',
        '          speed: auto',
      ].join('\n')
    );
    expect(yaml).toContain(
      [
        '          dhcp_server:',
        '            start: 192.168.1.100',
        '            end: 192.168.1.199',
        '            dns: 192.168.1.1',
      ].join('\n')
    );
    expect(yaml).toContain(
      [
        '      dns_records:',
        '        - name: www.azienda.example',
        '          address: 10.0.0.80',
        '        - name: posta.azienda.example',
        '          address: 10.0.0.25',
      ].join('\n')
    );
    expect(yaml).toContain('        - action: allow\n          service: dns\n');
    expect(yaml).toContain('        - service: dns\n          interface: 1\n');
  });

  it('never writes the DNS server that came with a lease', () => {
    const leased = resolveDhcp(lab()).topology;
    expect(named(leased.devices, 'B')?.nics?.[0]).toMatchObject({ ip: '192.168.1.100', dns: '192.168.1.1' });
    expect(generateYaml(leased.devices, leased.connections, 'Lab')).toBe(
      generateYaml(lab().devices, lab().connections, 'Lab')
    );
  });

  it('writes nothing for a drawing without DNS', () => {
    const { yaml } = roundTrip(topo([host('pc', '192.168.1.10'), host('srv', '192.168.1.20', '', { type: 'Server' })]));
    expect(yaml.toLowerCase()).not.toContain('dns');
  });

  it('a server with an empty list of records is written without one', () => {
    const empty = topo([host('srv', '192.168.1.20', '', { type: 'Server', dnsRecords: [] })]);
    expect(generateYaml(empty.devices, empty.connections, 'Lab')).not.toContain('dns_records');
  });

  it('leaves out, with a warning, a record without its name or its address', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: NS',
      '      type: Server',
      '      nics:',
      '        - name: eth0',
      '          ip: 10.0.0.53',
      '      dns_records:',
      '        - name: www.azienda.example',
      '          address: 10.0.0.80',
      '        - name: posta.azienda.example',
      '        - address: 10.0.0.81',
      '        - soltanto testo',
      '        - name: nas.azienda.example',
      '          address: 167772242',
      '        - name: ""',
      '          address: 10.0.0.83',
      '        - name: db.azienda.example',
      '          address: null',
      '    - name: Altro',
      '      type: Server',
      '      dns_records: nessuno',
      '  connections: []',
    ].join('\n');
    const result = parseYamlTopology(yaml);
    expect(result.devices[0].dnsRecords).toEqual([
      { id: 'record-1', name: 'www.azienda.example', address: '10.0.0.80' },
      // (a bare number where an address was meant is kept as text: the engine will not read it)
      { id: 'record-2', name: 'nas.azienda.example', address: '167772242' },
    ]);
    expect(result.devices[1]).not.toHaveProperty('dnsRecords');
    expect(result.warnings).toEqual([
      'NS: record DNS 2 senza nome o indirizzo, ignorato',
      'NS: record DNS 3 senza nome o indirizzo, ignorato',
      'NS: record DNS 4 senza nome o indirizzo, ignorato',
      'NS: record DNS 6 senza nome o indirizzo, ignorato',
      'NS: record DNS 7 senza nome o indirizzo, ignorato',
    ]);
  });

  it('a card with "dhcp: true" does not read the DNS server written next to it; a pool keeps one only when written', () => {
    const yaml = [
      'pixelcake:',
      '  devices:',
      '    - name: PC',
      '      type: PC',
      '      nics:',
      '        - name: eth0',
      '          dhcp: true',
      '          dns: 10.9.9.9',
      '        - name: eth1',
      '          ip: 192.168.1.78',
      '          dns: ""',
      '        - name: eth2',
      '          ip: 192.168.2.78',
      '          dns: 53',
      '    - name: R',
      '      type: Router',
      '      ports:',
      '        - id: 1',
      '          ip: 192.168.1.1',
      '          dhcp_server:',
      '            start: 192.168.1.100',
      '            end: 192.168.1.110',
      '            dns: ""',
      '        - id: 2',
      '          ip: 192.168.2.1',
      '          dhcp_server:',
      '            start: 192.168.2.100',
      '            end: 192.168.2.110',
      '            dns: 10.0.0.53',
      '        - id: 3',
      '          ip: 192.168.3.1',
      '          dhcp_server:',
      '            start: 192.168.3.100',
      '            end: 192.168.3.110',
      '            dns: null',
      '  connections: []',
    ].join('\n');
    const result = parseYamlTopology(yaml);
    expect(result.warnings).toEqual([]);
    for (const card of result.devices[0].nics ?? []) expect(card, card.name).not.toHaveProperty('dns');
    expect(result.devices[1].ports?.map(p => p.dhcpServer)).toEqual([
      { start: '192.168.1.100', end: '192.168.1.110' },
      { start: '192.168.2.100', end: '192.168.2.110', dns: '10.0.0.53' },
      { start: '192.168.3.100', end: '192.168.3.110' },
    ]);
  });
});

describe('DNS in the Terraform sketch', () => {
  it('says which server a card asks and which names a server keeps', () => {
    const t = lab();
    const sketch = generateTerraform(t.devices, t.connections);
    expect(sketch).toContain('    dns_server = "10.0.0.53"');
    expect(sketch).toContain('  dns_record {\n    name = "www.azienda.example"\n    address = "10.0.0.80"\n  }');
    expect(sketch.match(/dns_record \{/g)).toHaveLength(2);
    expect(sketch.match(/dns_server/g)).toHaveLength(1);
  });

  it('not the one that came with a lease, and nothing for a drawing without DNS', () => {
    const leased = resolveDhcp(lab()).topology;
    expect(generateTerraform(leased.devices, leased.connections).match(/dns_server/g)).toHaveLength(1);
    expect(generateTerraform([host('pc', '192.168.1.10')], []).toLowerCase()).not.toContain('dns');
  });
});
