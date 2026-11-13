/**
 * DNS — a name in place of an address: which server a device asks, the round
 * trip the question makes, and what comes back.
 *
 * The network of most tests:
 *
 *   A .11 (asks NS) ─┐                              ┌─ NS  10.0.0.53 (records)
 *                    SW ── port 1  R  port 2 ── SW2 ┤
 *   B (dhcp)        ─┘   192.168.1.1   10.0.0.1     └─ Web 10.0.0.80
 *
 * R hands out 192.168.1.100–192.168.1.102 on port 1, with NS as DNS server.
 */

import { describe, it, expect } from 'vitest';
import type { DhcpPool, DnsRecord, FirewallRule, NetworkDevice, PortForward } from '@/types';
import { device, forward, host, link, nic, port, rule, switchWith, topo } from '@/test/networkFixtures';
import type { Topology } from './types';
import { listInterfaces } from './interfaces';
import { planAndEvaluateFlow } from './flows';
import { withFailures } from './failures';
import { normalizeAddressing } from './topology';
import { leaseOf, poolProblem, resolveDhcp, withLeases } from './dhcp';
import { dnsCardOf, dnsRecordsOf, hostNameKey, isHostName, lookup, servesDns } from './dns';

const MASK = '255.255.255.0';
const NS_IP = '10.0.0.53';
const POOL: DhcpPool = { start: '192.168.1.100', end: '192.168.1.102', dns: NS_IP };
const RECORDS: DnsRecord[] = [
  { id: 'record-1', name: 'www.azienda.example', address: '10.0.0.80' },
  { id: 'record-2', name: 'Posta.Azienda.Example', address: '10.0.0.25' },
];

/** An end device with its address written by hand, and the DNS server it asks */
function pc(id: string, ip: string, gateway: string, dns?: string): NetworkDevice {
  return device({
    id,
    label: id.toUpperCase(),
    ip,
    gateway,
    nics: [nic({ ip, gateway, ...(dns ? { dns } : {}) })],
  });
}

function nameServer(overrides: Partial<NetworkDevice> = {}): NetworkDevice {
  return host('ns', NS_IP, '10.0.0.1', {
    label: 'NS',
    type: 'Server',
    templateId: 'tpl-dnsserver',
    dnsRecords: RECORDS,
    ...overrides,
  });
}

interface LabOptions {
  pool?: DhcpPool;
  a?: NetworkDevice;
  ns?: NetworkDevice;
}

function lab(options: LabOptions = {}): Topology {
  const { pool = POOL, a = pc('a', '192.168.1.11', '192.168.1.1', NS_IP), ns = nameServer() } = options;
  return topo(
    [
      a,
      device({ id: 'b', label: 'B', subnet: '', nics: [nic({ dhcp: true, subnet: '' })] }),
      switchWith('sw', [port(1), port(2), port(3)], { label: 'SW' }),
      device({
        id: 'r',
        label: 'R',
        type: 'Router',
        ip: '192.168.1.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK, dhcpServer: pool }),
          port(2, { ip: '10.0.0.1', subnet: MASK }),
        ],
      }),
      switchWith('sw2', [port(1), port(2), port(3)], { label: 'SW2' }),
      ns,
      host('web', '10.0.0.80', '10.0.0.1', { label: 'Web', type: 'Server', templateId: 'tpl-webserver' }),
    ],
    [
      link('a', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('b', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('sw', 'r', { sourcePort: 3, targetPort: 1 }),
      link('r', 'sw2', { sourcePort: 2, targetPort: 1 }),
      link('ns', 'sw2', { sourceNic: 'nic-1', targetPort: 2 }),
      link('web', 'sw2', { sourceNic: 'nic-1', targetPort: 3 }),
    ]
  );
}

/**
 *   A .11 ── port 1  FW  port 2 ── NS
 *        192.168.1.1    10.0.0.1 (dmz)
 */
function guarded(
  zone: 'trust' | 'untrust',
  rules: FirewallRule[] = [],
  forwards: PortForward[] = [],
  asks = NS_IP
): Topology {
  return topo(
    [
      pc('a', '192.168.1.11', '192.168.1.1', asks),
      device({
        id: 'fw',
        label: 'FW',
        type: 'Firewall',
        ip: '192.168.1.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK, securityZone: zone }),
          port(2, { ip: '10.0.0.1', subnet: MASK, securityZone: 'dmz' }),
        ],
        firewallRules: rules,
        portForwards: forwards,
      }),
      nameServer(),
    ],
    [
      link('a', 'fw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('fw', 'ns', { sourcePort: 2, targetNic: 'nic-1' }),
    ]
  );
}

describe('a host name', () => {
  it.each(['www.azienda.example', 'a.b', 'srv-1.lan', 'WWW.Azienda.Example', ' www.azienda.example ', 'www.azienda.example.', 'x1.y2.z3a'])(
    'is "%s"',
    name => {
      expect(isHostName(name)).toBe(true);
    }
  );

  it.each([
    ['', 'nothing'],
    ['gestionale', 'a single word: a name has a dot'],
    ['192.168.1.1', 'an address'],
    ['10.1', 'numbers: the last part is never one'],
    ['www..example', 'an empty part'],
    ['.example', 'a dot in front'],
    ['-www.example', 'a hyphen in front of a part'],
    ['www-.example', 'a hyphen at the end of a part'],
    ['my server.example', 'a space'],
    ['www_1.example', 'an underscore'],
    ['www.example..', 'two dots at the end'],
    [`${'a'.repeat(64)}.example`, 'a part longer than 63'],
    [`${Array.from({ length: 51 }, () => 'abcd').join('.')}`, 'longer than 253 in all'],
  ])('is not "%s" (%s)', name => {
    expect(isHostName(name)).toBe(false);
  });

  it('may be as long as 253 characters, in parts of 63', () => {
    const part = 'a'.repeat(63);
    expect(isHostName(`${part}.example`)).toBe(true);
    // 50 parts of four letters and the dots between them: 249, then ".abc"
    expect(isHostName(`${Array.from({ length: 50 }, () => 'abcd').join('.')}.abc`)).toBe(true);
  });

  it('is compared in lower case, without spaces around it or the dot that closes it', () => {
    expect(hostNameKey('  WWW.Azienda.Example. ')).toBe('www.azienda.example');
    expect(hostNameKey('www.azienda.example')).toBe('www.azienda.example');
  });
});

describe('who keeps records, and who asks whom', () => {
  it('a server keeps records, whatever kind of server; nothing else does', () => {
    expect(servesDns(nameServer())).toBe(true);
    expect(servesDns(device({ id: 's', type: 'Server', templateId: 'tpl-webserver' }))).toBe(true);
    for (const type of ['PC', 'Router', 'Firewall', 'Switch', 'Database']) {
      expect(servesDns(device({ id: 'x', type })), type).toBe(false);
    }
  });

  it('the records of a server are those the engine can read, in their order', () => {
    const records: DnsRecord[] = [
      { id: 'record-1', name: 'www.azienda.example', address: '10.0.0.80' },
      { id: 'record-2', name: 'gestionale', address: '10.0.0.81' },
      { id: 'record-3', name: 'posta.azienda.example', address: 'da qualche parte' },
      { id: 'record-4', name: 'nas.azienda.example', address: '10.0.0.82' },
    ];
    expect(dnsRecordsOf(nameServer({ dnsRecords: records })).map(record => record.id)).toEqual(['record-1', 'record-4']);
    expect(dnsRecordsOf(nameServer({ dnsRecords: undefined }))).toEqual([]);
    // records left on a device that is no server are not read
    expect(dnsRecordsOf(device({ id: 'x', type: 'PC', dnsRecords: RECORDS }))).toEqual([]);
  });

  it('a device asks through its first enabled card that names a server', () => {
    const cards = [
      nic({ id: 'nic-1', name: 'eth0' }),
      nic({ id: 'nic-2', name: 'eth1', dns: '10.0.0.1', enabled: false }),
      nic({ id: 'nic-3', name: 'eth2', dns: '10.0.0.2' }),
      nic({ id: 'nic-4', name: 'eth3', dns: '10.0.0.3' }),
    ];
    expect(dnsCardOf(device({ id: 'x', nics: cards }))?.id).toBe('nic-3');
    expect(dnsCardOf(device({ id: 'x', nics: [cards[0], cards[1]] }))).toBeUndefined();
    expect(dnsCardOf(device({ id: 'x', nics: [nic({ dns: '' })] }))).toBeUndefined();
    // a router has ports, no cards
    expect(dnsCardOf(device({ id: 'r', type: 'Router', ports: [port(1)] }))).toBeUndefined();
  });
});

describe('a lookup', () => {
  it('asks the DNS server of the device across the network, and comes back with the address', () => {
    const result = lookup(lab(), 'a', 'www.azienda.example');
    expect(result).toMatchObject({
      name: 'www.azienda.example',
      address: '10.0.0.80',
      serverIp: NS_IP,
    });
    expect(result.failureReason).toBeUndefined();
    expect(result.server?.id).toBe('ns');
    expect(result.trip?.verdict).toBe('success');
    expect(result.trip?.legs.map(leg => `${leg.purpose}: ${leg.fromId} → ${leg.toId}`)).toEqual([
      'DNS request: a → ns',
      'DNS reply: ns → a',
    ]);
    expect(result.trip?.animationPath).toEqual(['a', 'sw', 'r', 'sw2', 'ns', 'sw2', 'r', 'sw', 'a']);
    expect(result.trip?.animationLinks).toHaveLength(8);
  });

  it('is sent to the address of the server and answered from it, as dns', () => {
    const [request, reply] = lookup(lab(), 'a', 'www.azienda.example').trip?.legs ?? [];
    expect([request.trace.sourceIp, request.trace.targetIp]).toEqual(['192.168.1.11', NS_IP]);
    expect([reply.trace.sourceIp, reply.trace.targetIp]).toEqual([NS_IP, '192.168.1.11']);
  });

  it('does not mind the case of a name, on either side, nor a dot at its end', () => {
    expect(lookup(lab(), 'a', 'WWW.AZIENDA.example.').address).toBe('10.0.0.80');
    // the record is written "Posta.Azienda.Example"
    expect(lookup(lab(), 'a', 'posta.azienda.example')).toMatchObject({
      name: 'posta.azienda.example',
      address: '10.0.0.25',
    });
  });

  it('gives the first record of a name, when a list has it twice', () => {
    const twice: DnsRecord[] = [...RECORDS, { id: 'record-3', name: 'www.azienda.example', address: '10.0.0.99' }];
    expect(lookup(lab({ ns: nameServer({ dnsRecords: twice }) }), 'a', 'www.azienda.example').address).toBe('10.0.0.80');
  });

  it('a server that is its own DNS server sends nothing, and answers', () => {
    const ns = nameServer();
    ns.nics![0].dns = NS_IP;
    const result = lookup(lab({ ns }), 'ns', 'www.azienda.example');
    expect(result).toMatchObject({ address: '10.0.0.80', serverIp: NS_IP });
    expect(result.server?.id).toBe('ns');
    expect(result.trip).toBeUndefined();
  });

  it('is the same every time', () => {
    const t = lab();
    expect(lookup(t, 'a', 'www.azienda.example')).toEqual(lookup(t, 'a', 'www.azienda.example'));
  });
});

describe('a lookup that fails says why', () => {
  it('the device has no DNS server', () => {
    const t = lab({ a: pc('a', '192.168.1.11', '192.168.1.1') });
    expect(lookup(t, 'a', 'www.azienda.example')).toEqual({
      name: 'www.azienda.example',
      failureReason: 'A has no DNS server: it cannot look up www.azienda.example',
    });
    // a router, a switch: no cards, nobody to ask
    expect(lookup(lab(), 'r', 'www.azienda.example').failureReason).toBe(
      'R has no DNS server: it cannot look up www.azienda.example'
    );
    expect(lookup(lab(), 'sw', 'Www.Azienda.Example').failureReason).toBe(
      'SW has no DNS server: it cannot look up www.azienda.example'
    );
  });

  it('the device is not in the drawing', () => {
    expect(lookup(lab(), 'nobody', 'www.azienda.example')).toEqual({
      name: 'www.azienda.example',
      failureReason: 'source device "nobody" not found',
    });
  });

  it('no device has the address of the DNS server', () => {
    const t = lab({ a: pc('a', '192.168.1.11', '192.168.1.1', '8.8.8.8') });
    expect(lookup(t, 'a', 'www.azienda.example')).toEqual({
      name: 'www.azienda.example',
      serverIp: '8.8.8.8',
      failureReason: 'A asks 8.8.8.8 for names, an address no device has',
    });
  });

  it('the address is of a device that is not a DNS server', () => {
    const result = lookup(lab({ a: pc('a', '192.168.1.11', '192.168.1.1', '10.0.0.80') }), 'a', 'www.azienda.example');
    // Web is a server, and could keep records
    expect(result.failureReason).toBe('10.0.0.80 is Web, which is not a DNS server: it keeps no records');
    expect(result.address).toBeUndefined();
    expect(result.server?.id).toBe('web');
    // the question did travel
    expect(result.trip?.verdict).toBe('success');

    const router = lookup(lab({ a: pc('a', '192.168.1.11', '192.168.1.1', '192.168.1.1') }), 'a', 'www.azienda.example');
    expect(router.failureReason).toBe('192.168.1.1 is R, which is not a DNS server');
  });

  it('a server whose records cannot be read is not a DNS server', () => {
    const ns = nameServer({ dnsRecords: [{ id: 'record-1', name: 'www', address: '10.0.0.80' }] });
    expect(lookup(lab({ ns }), 'a', 'www.azienda.example').failureReason).toBe(
      '10.0.0.53 is NS, which is not a DNS server: it keeps no records'
    );
  });

  it('the server has no record for the name', () => {
    const result = lookup(lab(), 'a', 'Intranet.azienda.example');
    expect(result.failureReason).toBe('NS has no record for intranet.azienda.example');
    expect(result.address).toBeUndefined();
    expect(result.server?.id).toBe('ns');
    expect(result.trip?.verdict).toBe('success');
  });

  it('the request does not arrive: the reason of the trace, with the leg it is about', () => {
    const cut = lab();
    cut.connections = cut.connections.filter(connection => connection.source !== 'ns');
    const result = lookup(cut, 'a', 'www.azienda.example');
    expect(result.failureReason).toBe('DNS request: no physical path between A and NS');
    expect(result.trip?.verdict).toBe('unreachable');
    expect(result.address).toBeUndefined();
    expect(result.server).toBeUndefined();
  });

  it('the reply does not come back', () => {
    const ns = host('ns', NS_IP, '', { label: 'NS', type: 'Server', dnsRecords: RECORDS });
    const result = lookup(lab({ ns }), 'a', 'www.azienda.example');
    expect(result.failureReason).toBe('DNS reply: no default gateway configured on NS');
    expect(result.trip?.verdict).toBe('blocked');
    expect(result.address).toBeUndefined();
    expect(result.trip?.legs.map(leg => leg.trace.verdict)).toEqual(['success', 'blocked']);
  });

  it('a simulated failure breaks a lookup like any other exchange', () => {
    const down = withFailures(lab(), { devices: ['ns'], connections: [] });
    expect(lookup(down, 'a', 'www.azienda.example').failureReason).toBe('DNS request: NS is down');
    const cut = withFailures(lab(), { devices: [], connections: ['sw--r'] });
    expect(lookup(cut, 'a', 'www.azienda.example').failureReason).toBe('DNS request: link SW–R is down');
    // and with nothing broken the same drawing answers
    expect(lookup(withFailures(lab(), { devices: [], connections: [] }), 'a', 'www.azienda.example').address).toBe('10.0.0.80');
  });
});

describe('dns is a service a firewall can tell apart', () => {
  it('the zone policy decides when no rule names it', () => {
    expect(lookup(guarded('trust'), 'a', 'www.azienda.example').address).toBe('10.0.0.80');
    const denied = lookup(guarded('untrust'), 'a', 'www.azienda.example');
    expect(denied.failureReason).toBe('DNS request: firewall policy on FW: untrust → dmz denied');
    expect(denied.trip?.verdict).toBe('blocked');
  });

  it('a rule for dns lets the lookup through, and nothing else', () => {
    const t = guarded('untrust', [rule('allow', 'dns', 'untrust', NS_IP)]);
    expect(lookup(t, 'a', 'www.azienda.example').address).toBe('10.0.0.80');
    expect(planAndEvaluateFlow('ping', 'a', 'ns', t).failureReason).toBe(
      'request: firewall FW: no rule matches, zone policy untrust → dmz denied'
    );
  });

  it('a rule against dns stops the lookup, and nothing else', () => {
    const t = guarded('trust', [rule('deny', 'dns', 'any', 'any')]);
    expect(lookup(t, 'a', 'www.azienda.example').failureReason).toBe(
      'DNS request: firewall FW: denied by rule 1 (deny dns from any to any)'
    );
    expect(planAndEvaluateFlow('ping', 'a', 'ns', t).verdict).toBe('success');
  });

  it('a rule for another service says nothing about dns, a rule for any does', () => {
    expect(lookup(guarded('untrust', [rule('allow', 'web', 'untrust', NS_IP)]), 'a', 'www.azienda.example').address).toBeUndefined();
    expect(lookup(guarded('untrust', [rule('allow', 'any', 'untrust', NS_IP)]), 'a', 'www.azienda.example').address).toBe('10.0.0.80');
  });

  it('the reply to a lookup that was let in passes', () => {
    // nothing lets the DMZ open a flow towards the outside network by rule: the reply still passes
    const t = guarded('untrust', [rule('allow', 'dns', 'untrust', NS_IP), rule('deny', 'any', 'dmz', 'any')]);
    expect(lookup(t, 'a', 'www.azienda.example').address).toBe('10.0.0.80');
  });
});

describe('a DNS server behind a port forward', () => {
  const published = (forwards: PortForward[]) =>
    guarded('untrust', [rule('allow', 'dns', 'untrust', NS_IP)], forwards, '192.168.1.1');

  it('is asked at the address of the port, and the server inside answers', () => {
    const result = lookup(published([forward('dns', 1, NS_IP)]), 'a', 'www.azienda.example');
    expect(result).toMatchObject({ address: '10.0.0.80', serverIp: '192.168.1.1' });
    expect(result.server?.id).toBe('ns');
    expect(result.trip?.legs.map(leg => `${leg.fromId} → ${leg.toId}`)).toEqual(['a → ns', 'ns → a']);
    expect(result.trip?.notes).toContain('192.168.1.1 is FW, which forwards dns to NS (port forward 1)');
    // the device never sees the address inside
    expect(result.trip?.legs[1].trace.seenSourceIp).toBe('192.168.1.1');
  });

  it('a forward for any service covers dns, a forward for another does not', () => {
    expect(lookup(published([forward('any', 1, NS_IP)]), 'a', 'www.azienda.example').address).toBe('10.0.0.80');
    expect(lookup(published([forward('web', 1, NS_IP)]), 'a', 'www.azienda.example').failureReason).toBe(
      '192.168.1.1 is FW, which is not a DNS server'
    );
  });

  it('a server inside that keeps no records is named for what it is', () => {
    const t = published([forward('dns', 1, NS_IP)]);
    t.devices = t.devices.map(d => (d.id === 'ns' ? { ...d, dnsRecords: [] } : d));
    expect(lookup(t, 'a', 'www.azienda.example').failureReason).toBe('NS is not a DNS server: it keeps no records');
  });
});

describe('the DNS server that comes with a lease', () => {
  it('is handed out by the pool that names one, and the card then asks it', () => {
    const t = lab();
    expect(leaseOf(resolveDhcp(t), 'b', 'nic-1')).toEqual({
      deviceId: 'b',
      nicId: 'nic-1',
      ip: '192.168.1.100',
      mask: MASK,
      gateway: '192.168.1.1',
      dns: NS_IP,
      server: { deviceId: 'r', interfaceKey: 'port:1' },
    });
    const leased = withLeases(t).devices.find(d => d.id === 'b');
    expect(leased?.nics?.[0]).toMatchObject({ ip: '192.168.1.100', dns: NS_IP });
    expect(lookup(t, 'b', 'www.azienda.example')).toMatchObject({ address: '10.0.0.80', serverIp: NS_IP });
    expect(lookup(t, 'b', 'www.azienda.example').trip?.legs[0].trace.sourceIp).toBe('192.168.1.100');
  });

  it('is nobody when the pool names none: the card has an address and no DNS server', () => {
    const t = lab({ pool: { start: '192.168.1.100', end: '192.168.1.102' } });
    expect(leaseOf(resolveDhcp(t), 'b', 'nic-1')).toEqual({
      deviceId: 'b',
      nicId: 'nic-1',
      ip: '192.168.1.100',
      mask: MASK,
      gateway: '192.168.1.1',
      server: { deviceId: 'r', interfaceKey: 'port:1' },
    });
    expect(leaseOf(resolveDhcp(t), 'b', 'nic-1')).not.toHaveProperty('dns');
    const leased = withLeases(t).devices.find(d => d.id === 'b');
    expect(leased?.nics?.[0]).not.toHaveProperty('dns');
    expect(lookup(t, 'b', 'www.azienda.example').failureReason).toBe(
      'B has no DNS server: it cannot look up www.azienda.example'
    );
  });

  it('a card on DHCP keeps no DNS server of its own: what was typed before is dropped', () => {
    const stale = device({ id: 'b', label: 'B', subnet: '', nics: [nic({ dhcp: true, subnet: '', dns: '10.9.9.9' })] });
    const kept = normalizeAddressing(stale);
    expect(kept.nics?.[0]).not.toHaveProperty('dns');
    expect(kept.nics?.[0]).toMatchObject({ dhcp: true, ip: '' });
    // a card with its address written by hand keeps the one written with it
    const manual = pc('a', '192.168.1.11', '192.168.1.1', NS_IP);
    expect(normalizeAddressing(manual)).toBe(manual);
    // and a card on DHCP that carries nothing is left as it is
    const clean = device({ id: 'c', subnet: '', nics: [nic({ dhcp: true, subnet: '' })] });
    expect(normalizeAddressing(clean)).toBe(clean);

    // in a drawing, the stale one is not asked: the one of the lease is
    const t = lab();
    t.devices = t.devices.map(d => (d.id === 'b' ? stale : d));
    expect(lookup(t, 'b', 'www.azienda.example').serverIp).toBe(NS_IP);
  });

  it('a card left without a lease has no DNS server either', () => {
    const t = lab();
    t.connections = t.connections.filter(connection => connection.source !== 'b');
    expect(lookup(t, 'b', 'www.azienda.example').failureReason).toBe(
      'B has no DNS server: it cannot look up www.azienda.example'
    );
  });

  it('a pool may name a DNS server on any network, but it has to be an address', () => {
    const [router] = lab().devices.filter(d => d.id === 'r');
    const [lan] = listInterfaces(router);
    expect(poolProblem(router, lan, POOL)).toBeUndefined();
    expect(poolProblem(router, lan, { ...POOL, dns: 'ns.azienda.example' })).toEqual({
      code: 'invalid',
      value: 'ns.azienda.example',
      text: '"ns.azienda.example" is not an address',
    });
    // a pool that cannot work hands out nothing
    const broken = lab({ pool: { ...POOL, dns: 'ns' } });
    expect(resolveDhcp(broken).leases).toEqual([]);
    expect(resolveDhcp(broken).pools[0].problem?.code).toBe('invalid');
  });
});

describe('a drawing without DNS', () => {
  it('answers as it always did: nothing asks, nothing is looked up', () => {
    const old = lab({
      pool: { start: '192.168.1.100', end: '192.168.1.102' },
      a: pc('a', '192.168.1.11', '192.168.1.1'),
      ns: host('ns', NS_IP, '10.0.0.1', { label: 'NS', type: 'Server' }),
    });
    const flow = planAndEvaluateFlow('ping', 'a', 'ns', old);
    expect(flow.verdict).toBe('success');
    expect(flow.legs.map(leg => leg.purpose)).toEqual(['request', 'reply']);
    expect(flow.animationPath).toEqual(['a', 'sw', 'r', 'sw2', 'ns', 'sw2', 'r', 'sw', 'a']);
    expect(planAndEvaluateFlow('ping', 'b', 'web', old).legs[0].trace.sourceIp).toBe('192.168.1.100');
  });
});
