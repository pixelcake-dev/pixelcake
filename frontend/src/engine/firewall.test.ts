import { describe, it, expect } from 'vitest';
import type { FirewallRule, NetworkDevice, Port, ServiceName } from '@/types';
import { device, host, link, port, rule, topo } from '@/test/networkFixtures';
import type { Topology } from './types';
import { listInterfaces } from './interfaces';
import { describeRule, evaluateFirewall, filtersTraffic, isValidRuleEndpoint } from './firewall';
import type { Packet } from './firewall';
import { traceRoute } from './trace';
import { planAndEvaluateFlow } from './flows';

// ---------- the policy on its own ----------

const ZONED_PORTS: Port[] = [
  port(1, { securityZone: 'trust' }),
  port(2, { securityZone: 'dmz' }),
  port(3, { securityZone: 'untrust' }),
  port(4),
];

function firewall(rules: FirewallRule[] = [], overrides: Partial<NetworkDevice> = {}) {
  return device({
    id: 'fw',
    label: 'FW-1',
    type: 'Firewall',
    ports: ZONED_PORTS,
    firewallRules: rules,
    ...overrides,
  });
}

function packet(overrides: Partial<Packet> = {}): Packet {
  return {
    sourceIp: '203.0.113.50',
    destinationIp: '172.16.0.10',
    service: 'ping',
    returnTraffic: false,
    ...overrides,
  };
}

/** Decision for a packet crossing `fw` from port `ingress` to port `egress` */
function decide(fw: NetworkDevice, ingress: number | undefined, egress: number | undefined, p: Packet) {
  const iface = (id: number | undefined) =>
    listInterfaces(fw).find(candidate => candidate.kind === 'port' && candidate.port.id === id);
  return evaluateFirewall(fw, iface(ingress), iface(egress), p);
}

describe('evaluateFirewall: zone policy, no rules', () => {
  it.each([
    [3, 1, 'untrust → trust'],
    [3, 2, 'untrust → dmz'],
    [2, 1, 'dmz → trust'],
  ])('denies a new flow towards a more trusted zone (port %i → port %i)', (ingress, egress, transition) => {
    const verdict = decide(firewall(), ingress, egress, packet());
    expect(verdict).toMatchObject({
      allowed: false,
      text: `firewall policy on FW-1: ${transition} denied`,
    });
  });

  it.each([
    [1, 3, 'trust → untrust'],
    [1, 2, 'trust → dmz'],
    [2, 3, 'dmz → untrust'],
  ])('allows a flow towards a less trusted zone (port %i → port %i)', (ingress, egress, transition) => {
    const verdict = decide(firewall(), ingress, egress, packet());
    expect(verdict).toMatchObject({ allowed: true, text: `firewall policy: ${transition} allowed` });
  });

  it('lets the reply to an allowed flow back in', () => {
    const verdict = decide(firewall(), 3, 1, packet({ returnTraffic: true }));
    expect(verdict).toMatchObject({
      allowed: true,
      text: 'firewall policy: untrust → trust allowed (reply to an allowed flow)',
    });
  });

  it('allows, and says why, when a side is not on a zoned port', () => {
    for (const [ingress, egress] of [
      [1, 4],
      [undefined, 3],
      [undefined, undefined],
    ] as const) {
      expect(decide(firewall(), ingress, egress, packet())).toMatchObject({
        allowed: true,
        text: 'firewall FW-1 has no zone binding: allowed',
      });
    }
  });
});

describe('evaluateFirewall: rules', () => {
  it('a rule opens what the zone policy would deny, for its service only', () => {
    const fw = firewall([rule('allow', 'web', 'untrust', 'dmz')]);

    expect(decide(fw, 3, 2, packet({ service: 'web' }))).toMatchObject({
      allowed: true,
      text: 'firewall FW-1: allowed by rule 1 (allow web from untrust to dmz)',
    });
    expect(decide(fw, 3, 2, packet({ service: 'ping' }))).toMatchObject({
      allowed: false,
      text: 'firewall FW-1: no rule matches, zone policy untrust → dmz denied',
    });
    expect(decide(fw, 3, 2, packet({ service: 'email' }))).toMatchObject({ allowed: false });
  });

  it('a rule closes what the zone policy would allow', () => {
    const fw = firewall([rule('deny', 'any', 'trust', 'untrust')]);
    expect(decide(fw, 1, 3, packet())).toMatchObject({
      allowed: false,
      text: 'firewall FW-1: denied by rule 1 (deny any from trust to untrust)',
    });
    // another pair of zones: no rule matches, the zone policy decides
    expect(decide(fw, 1, 2, packet())).toMatchObject({
      allowed: true,
      text: 'firewall FW-1: no rule matches, zone policy trust → dmz allowed',
    });
  });

  it('the first rule that matches decides: order matters', () => {
    const denyOne = rule('deny', 'any', '192.168.10.11', 'any');
    const allowAll = rule('allow', 'any', 'trust', 'any');
    const fromPc1 = packet({ sourceIp: '192.168.10.11' });
    const fromPc2 = packet({ sourceIp: '192.168.10.12' });

    const strict = firewall([denyOne, allowAll]);
    expect(decide(strict, 1, 3, fromPc1)).toMatchObject({
      allowed: false,
      text: 'firewall FW-1: denied by rule 1 (deny any from 192.168.10.11 to any)',
    });
    expect(decide(strict, 1, 3, fromPc2)).toMatchObject({
      allowed: true,
      text: 'firewall FW-1: allowed by rule 2 (allow any from trust to any)',
    });

    const shadowed = firewall([allowAll, denyOne]);
    expect(decide(shadowed, 1, 3, fromPc1)).toMatchObject({
      allowed: true,
      text: 'firewall FW-1: allowed by rule 1 (allow any from trust to any)',
    });
  });

  it('matches addresses and networks on either side', () => {
    const fw = firewall([rule('allow', 'web', '203.0.113.0/24', '172.16.0.10')]);
    const web = (overrides: Partial<Packet>) => decide(fw, 3, 2, packet({ service: 'web', ...overrides }));

    expect(web({})?.allowed).toBe(true);
    expect(web({ sourceIp: '203.0.113.200' })?.allowed).toBe(true);
    expect(web({ sourceIp: '198.51.100.7' })?.allowed).toBe(false); // other network
    expect(web({ destinationIp: '172.16.0.11' })?.allowed).toBe(false); // other server
  });

  it('skips a disabled rule and keeps numbering rules by their place in the list', () => {
    const fw = firewall([
      rule('deny', 'any', 'any', 'any', { enabled: false }),
      rule('allow', 'ping', 'untrust', 'dmz'),
    ]);
    expect(decide(fw, 3, 2, packet())).toMatchObject({
      allowed: true,
      text: 'firewall FW-1: allowed by rule 2 (allow ping from untrust to dmz)',
    });
  });

  it('lets the reply to an allowed flow through a deny rule, and says which', () => {
    const fw = firewall([rule('deny', 'any', 'untrust', 'any')]);
    expect(decide(fw, 3, 1, packet({ returnTraffic: true }))).toMatchObject({
      allowed: true,
      text: 'firewall FW-1: reply to an allowed flow passes rule 1 (deny any from untrust to any)',
    });
    expect(decide(fw, 3, 1, packet())?.allowed).toBe(false);
  });

  it('cannot apply a rule that names a zone when the link is not on a port: it is skipped, with a note', () => {
    const fw = firewall([rule('deny', 'any', 'untrust', 'any')]);
    const verdict = decide(fw, undefined, 1, packet());
    expect(verdict).toMatchObject({
      allowed: true,
      text: 'firewall FW-1: no rule matches and no zone binding: allowed',
      skipped: [
        'firewall FW-1: rule 1 names a zone and the link is not attached to a port: skipped',
      ],
    });
  });

  it('says that the port is in no zone, not that the link is detached, when the port has none', () => {
    // port 4 is attached, and its zone is «None»
    const fw = firewall([rule('deny', 'any', 'untrust', 'any')]);
    expect(decide(fw, 4, 1, packet())?.skipped).toEqual([
      'firewall FW-1: rule 1 names a zone and port 4 is in no zone: skipped',
    ]);
    const outwards = firewall([rule('deny', 'any', 'any', 'untrust')]);
    expect(decide(outwards, 1, 4, packet())?.skipped).toEqual([
      'firewall FW-1: rule 1 names a zone and port 4 is in no zone: skipped',
    ]);
  });

  it('names both reasons when each side of the rule misses its zone for its own', () => {
    const fw = firewall([rule('deny', 'any', 'untrust', 'trust')]);
    expect(decide(fw, undefined, 4, packet())?.skipped).toEqual([
      'firewall FW-1: rule 1 names a zone, the link is not attached to a port and port 4 is in no zone: skipped',
    ]);
  });

  it('still applies rules written with addresses when the zones are unknown', () => {
    const fw = firewall([rule('deny', 'any', '203.0.113.50', 'any')]);
    expect(decide(fw, undefined, undefined, packet())).toMatchObject({
      allowed: false,
      text: 'firewall FW-1: denied by rule 1 (deny any from 203.0.113.50 to any)',
      skipped: [],
    });
  });
});

describe('who filters, and what a rule may name', () => {
  it('a firewall always filters; another device only when it carries rules', () => {
    const router = device({ id: 'r1', type: 'Router' });
    expect(filtersTraffic(firewall())).toBe(true);
    expect(filtersTraffic(router)).toBe(false);
    expect(filtersTraffic({ ...router, firewallRules: [rule('deny', 'any', 'any', 'any')] })).toBe(true);

    expect(evaluateFirewall(router, undefined, undefined, packet())).toBeUndefined();
  });

  /** A router with two ports and these rules, and its port `id` */
  function routerWith(rules: FirewallRule[]) {
    const router = device({ id: 'r1', label: 'R1', type: 'Router', ports: [port(1), port(2)], firewallRules: rules });
    const iface = (id: number) =>
      listInterfaces(router).find(candidate => candidate.kind === 'port' && candidate.port.id === id);
    return { router, iface };
  }

  it('a router with rules is named as a router, and blocks what no rule allows, as a real access list', () => {
    const { router, iface } = routerWith([rule('deny', 'ping', 'any', '172.16.0.10')]);
    expect(evaluateFirewall(router, iface(1), iface(2), packet())).toEqual({
      allowed: false,
      text: 'router R1: denied by rule 1 (deny ping from any to 172.16.0.10)',
      skipped: [],
    });
    expect(evaluateFirewall(router, iface(1), iface(2), packet({ service: 'web' }))).toEqual({
      allowed: false,
      text: 'router R1: no rule allows it',
      skipped: [],
    });
  });

  it('a router lets through what one of its rules allows, and the reply to a flow it allowed', () => {
    const { router, iface } = routerWith([rule('allow', 'web', 'any', '172.16.0.10')]);
    expect(evaluateFirewall(router, iface(1), iface(2), packet({ service: 'web' }))).toMatchObject({
      allowed: true,
      text: 'router R1: allowed by rule 1 (allow web from any to 172.16.0.10)',
    });
    // the response matches no rule: it passes as the reply of a flow the router saw
    const response = packet({ service: 'web', sourceIp: '172.16.0.10', destinationIp: '203.0.113.50', returnTraffic: true });
    expect(evaluateFirewall(router, iface(2), iface(1), response)).toMatchObject({
      allowed: true,
      text: 'router R1: no rule matches, allowed as the reply to an allowed flow',
    });
    // a reply whose request went another way is a new packet: nothing allows it
    expect(
      evaluateFirewall(router, iface(2), iface(1), { ...response, requestPath: new Set(['other']) })
    ).toMatchObject({ allowed: false, text: 'router R1: no rule allows it, and it never saw the request' });
  });

  it('a router whose rules are all switched off lets everything through, as one with none', () => {
    const { router, iface } = routerWith([rule('allow', 'web', 'any', '172.16.0.10', { enabled: false })]);
    expect(evaluateFirewall(router, iface(1), iface(2), packet())).toEqual({
      allowed: true,
      text: 'router R1: no rule is switched on: allowed',
      skipped: [],
    });
  });

  it('accepts any, a zone, an address or a network as source and destination', () => {
    for (const ok of ['any', 'ANY', 'trust', 'untrust', 'dmz', '10.0.0.5', '10.0.0.0/24']) {
      expect(isValidRuleEndpoint(ok)).toBe(true);
    }
    for (const bad of ['', 'internet', 'lan', '10.0.0.0/40', 'Web-01']) {
      expect(isValidRuleEndpoint(bad)).toBe(false);
    }
  });

  it('describes a rule in the words of the terminal', () => {
    expect(describeRule(rule('allow', 'web', 'untrust', '172.16.0.10'))).toBe(
      'allow web from untrust to 172.16.0.10'
    );
  });
});

// ---------- a routed firewall on the path ----------

/**
 * PC-1 (trust, 192.168.10.0/24) ─┐
 * Web-01 (dmz, 172.16.0.0/24)  ──┼─ FW-1, one addressed port per zone
 * Ext (untrust, 203.0.113.0/24) ─┘
 */
function perimeter(rules: FirewallRule[] = []): Topology {
  return topo(
    [
      host('pc1', '192.168.10.11', '192.168.10.1', { label: 'PC-1' }),
      host('web', '172.16.0.10', '172.16.0.1', { label: 'Web-01', type: 'Server' }),
      host('ext', '203.0.113.50', '203.0.113.1', { label: 'Ext' }),
      device({
        id: 'fw',
        label: 'FW-1',
        type: 'Firewall',
        ip: '192.168.10.1',
        ports: [
          port(1, { securityZone: 'trust', ip: '192.168.10.1' }),
          port(2, { securityZone: 'dmz', ip: '172.16.0.1' }),
          port(3, { securityZone: 'untrust', ip: '203.0.113.1' }),
        ],
        firewallRules: rules,
      }),
    ],
    [
      link('pc1', 'fw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('web', 'fw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('ext', 'fw', { sourceNic: 'nic-1', targetPort: 3 }),
    ]
  );
}

const trace = (t: Topology, from: string, to: string, service: ServiceName = 'ping') =>
  traceRoute(from, to, t, { service });

describe('traceRoute through a routed firewall', () => {
  it('routes like a router and applies the zone policy: outside cannot open a flow inwards', () => {
    const inwards = trace(perimeter(), 'ext', 'web');
    expect(inwards.verdict).toBe('blocked');
    expect(inwards.failureReason).toBe('firewall policy on FW-1: untrust → dmz denied');
    expect(inwards.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['ext', 'forwarded'],
      ['fw', 'blocked'],
    ]);

    const outwards = trace(perimeter(), 'pc1', 'ext');
    expect(outwards.verdict).toBe('success');
    expect(outwards.hops[1].note).toBe(
      'routed: 203.0.113.0/24 is on port 3; firewall policy: trust → untrust allowed'
    );
    expect(outwards.notes).toEqual(['firewall policy: trust → untrust allowed']);
  });

  it('publishes one service of one server and nothing else', () => {
    const published = perimeter([rule('allow', 'web', 'untrust', '172.16.0.10')]);

    const web = trace(published, 'ext', 'web', 'web');
    expect(web.verdict).toBe('success');
    expect(web.notes).toEqual([
      'firewall FW-1: allowed by rule 1 (allow web from untrust to 172.16.0.10)',
    ]);

    const ping = trace(published, 'ext', 'web', 'ping');
    expect(ping.verdict).toBe('blocked');
    expect(ping.failureReason).toBe(
      'firewall FW-1: no rule matches, zone policy untrust → dmz denied'
    );

    // the rule names the server: the LAN stays closed
    expect(trace(published, 'ext', 'pc1', 'web').verdict).toBe('blocked');
  });

  it('a whole web exchange passes on that rule: the response is the reply to an allowed flow', () => {
    const published = perimeter([rule('allow', 'web', 'untrust', '172.16.0.10')]);
    const exchange = planAndEvaluateFlow('web', 'ext', 'web', published);
    expect(exchange.verdict).toBe('success');
    expect(exchange.legs.map(l => [l.purpose, l.trace.verdict])).toEqual([
      ['HTTP request', 'success'],
      ['HTTP response', 'success'],
    ]);

    const echo = planAndEvaluateFlow('ping', 'ext', 'web', published);
    expect(echo.verdict).toBe('blocked');
    expect(echo.failureReason).toBe(
      'request: firewall FW-1: no rule matches, zone policy untrust → dmz denied'
    );
  });

  it('a download is web traffic to the firewall; an email is not', () => {
    const published = perimeter([rule('allow', 'web', 'untrust', 'dmz')]);
    expect(planAndEvaluateFlow('download', 'ext', 'web', published).verdict).toBe('success');

    const mail = perimeter([rule('allow', 'email', 'untrust', 'dmz')]);
    expect(planAndEvaluateFlow('download', 'ext', 'web', mail).verdict).toBe('blocked');
  });

  it('a deny rule stops one machine while its neighbours get out', () => {
    const t = perimeter([rule('deny', 'any', '192.168.10.11', 'any')]);
    const result = trace(t, 'pc1', 'ext');
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'firewall FW-1: denied by rule 1 (deny any from 192.168.10.11 to any)'
    );
  });

  it('does not filter traffic addressed to the firewall itself', () => {
    // FW-1 by name is 192.168.10.1, its trust side, reached from outside
    const result = trace(perimeter([rule('deny', 'any', 'any', 'any')]), 'ext', 'fw');
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual([]);
    expect(result.hops.map(h => h.deviceId)).toEqual(['ext', 'fw']);
  });

  it('matches the reply against the addresses of the request', () => {
    // trust → dmz is allowed by the zone policy; the response would be a
    // denied dmz → trust flow if it were not the reply
    const exchange = planAndEvaluateFlow('web', 'pc1', 'web', perimeter());
    expect(exchange.verdict).toBe('success');
    expect(exchange.notes).toEqual([
      'HTTP request: firewall policy: trust → dmz allowed',
      'HTTP response: firewall policy: dmz → trust allowed (reply to an allowed flow)',
    ]);
    expect(exchange.legs[1].trace.sourceIp).toBe('172.16.0.10');
    expect(exchange.legs[1].trace.targetIp).toBe('192.168.10.11');
  });
});

// ---------- a router with rules on the path ----------

describe('traceRoute through a router with rules', () => {
  /** PC-1 (192.168.1.0/24) ── R-1 ── Srv (192.168.2.0/24) */
  function routed(rules: FirewallRule[]): Topology {
    return topo(
      [
        host('pc1', '192.168.1.10', '192.168.1.1', { label: 'PC-1' }),
        device({
          id: 'r1',
          label: 'R-1',
          type: 'Router',
          ports: [port(1, { ip: '192.168.1.1' }), port(2, { ip: '192.168.2.1' })],
          firewallRules: rules,
        }),
        host('srv', '192.168.2.10', '192.168.2.1', { label: 'Srv', type: 'Server' }),
      ],
      [
        link('pc1', 'r1', { sourceNic: 'nic-1', targetPort: 1 }),
        link('r1', 'srv', { sourcePort: 2, targetNic: 'nic-1' }),
      ]
    );
  }

  it('with no rules it routes everything', () => {
    expect(planAndEvaluateFlow('ping', 'pc1', 'srv', routed([])).verdict).toBe('success');
  });

  it('with one rule that allows the web, the web passes both ways and a ping stops at the router', () => {
    const t = routed([rule('allow', 'web', '192.168.1.0/24', '192.168.2.10')]);

    const web = planAndEvaluateFlow('web', 'pc1', 'srv', t);
    expect(web.verdict).toBe('success');
    expect(web.notes).toEqual([
      'HTTP request: router R-1: allowed by rule 1 (allow web from 192.168.1.0/24 to 192.168.2.10)',
      'HTTP response: router R-1: no rule matches, allowed as the reply to an allowed flow',
    ]);

    const ping = planAndEvaluateFlow('ping', 'pc1', 'srv', t);
    expect(ping.verdict).toBe('blocked');
    expect(ping.failureReason).toBe('request: router R-1: no rule allows it');
    expect(ping.legs[0].trace.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['r1', 'blocked'],
    ]);
  });
});

// ---------- a firewall without addresses: transparent ----------

describe('traceRoute through a transparent firewall with rules', () => {
  /** PC-1 — FW-1 — Server, one network; the firewall ports carry zones, no addresses */
  function bridged(rules: FirewallRule[]): Topology {
    return topo(
      [
        host('pc1', '192.168.1.10', '', { label: 'PC-1' }),
        device({
          id: 'fw',
          label: 'FW-1',
          type: 'Firewall',
          ip: '192.168.1.1',
          ports: [port(1, { securityZone: 'untrust' }), port(2, { securityZone: 'trust' })],
          firewallRules: rules,
        }),
        host('srv', '192.168.1.20', '', { label: 'Server', type: 'Server' }),
      ],
      [
        link('pc1', 'fw', { sourceNic: 'nic-1', targetPort: 1 }),
        link('fw', 'srv', { sourcePort: 2, targetNic: 'nic-1' }),
      ]
    );
  }

  it('applies its rules between the two ports the traffic crosses', () => {
    const t = bridged([rule('allow', 'web', 'untrust', '192.168.1.20')]);

    const web = trace(t, 'pc1', 'srv', 'web');
    expect(web.verdict).toBe('success');
    expect(web.hops[1].note).toBe(
      'firewall FW-1: allowed by rule 1 (allow web from untrust to 192.168.1.20)'
    );

    const ping = trace(t, 'pc1', 'srv', 'ping');
    expect(ping.verdict).toBe('blocked');
    expect(ping.failureReason).toBe(
      'firewall FW-1: no rule matches, zone policy untrust → trust denied'
    );
    expect(ping.hops.map(h => [h.deviceId, h.status])).toEqual([
      ['pc1', 'forwarded'],
      ['fw', 'blocked'],
    ]);
  });
});

// ---------- each firewall remembers the flows it has seen ----------

describe('a reply and the firewalls its request did not cross', () => {
  const P2P = '255.255.255.252';

  /**
   * pcA ─ r1 ─ fwA ─ r2 ─ pcB, and r1 ─ fwB ─ r2 beside it. The request
   * goes through fwA, the reply comes back through fwB: each router sends
   * the other network by its own firewall. Both firewalls deny ping from
   * the network of pcB to the network of pcA.
   */
  function twoFirewalls(): Topology {
    const denyInwards = () => [rule('deny', 'ping', '192.168.2.0/24', '192.168.1.0/24')];
    return topo(
      [
        host('pcA', '192.168.1.10', '192.168.1.1'),
        host('pcB', '192.168.2.10', '192.168.2.1'),
        device({
          id: 'r1',
          type: 'Router',
          ports: [
            port(1, { ip: '192.168.1.1' }),
            port(2, { ip: '10.0.0.1', subnet: P2P }),
            port(3, { ip: '10.0.1.1', subnet: P2P }),
          ],
          routes: [{ id: 'r1-1', destination: '192.168.2.0/24', nextHop: '10.0.0.2' }],
        }),
        device({
          id: 'fwA',
          type: 'Firewall',
          ports: [port(1, { ip: '10.0.0.2', subnet: P2P }), port(2, { ip: '10.0.2.1', subnet: P2P })],
          routes: [
            { id: 'fwA-1', destination: '192.168.1.0/24', nextHop: '10.0.0.1' },
            { id: 'fwA-2', destination: '192.168.2.0/24', nextHop: '10.0.2.2' },
          ],
          firewallRules: denyInwards(),
        }),
        device({
          id: 'fwB',
          type: 'Firewall',
          ports: [port(1, { ip: '10.0.1.2', subnet: P2P }), port(2, { ip: '10.0.3.1', subnet: P2P })],
          routes: [
            { id: 'fwB-1', destination: '192.168.1.0/24', nextHop: '10.0.1.1' },
            { id: 'fwB-2', destination: '192.168.2.0/24', nextHop: '10.0.3.2' },
          ],
          firewallRules: denyInwards(),
        }),
        device({
          id: 'r2',
          type: 'Router',
          ports: [
            port(1, { ip: '192.168.2.1' }),
            port(2, { ip: '10.0.2.2', subnet: P2P }),
            port(3, { ip: '10.0.3.2', subnet: P2P }),
          ],
          routes: [{ id: 'r2-1', destination: '192.168.1.0/24', nextHop: '10.0.3.1' }],
        }),
      ],
      [
        link('pcA', 'r1', { sourceNic: 'nic-1', targetPort: 1 }),
        link('r1', 'fwA', { sourcePort: 2, targetPort: 1 }),
        link('fwA', 'r2', { sourcePort: 2, targetPort: 2 }),
        link('r1', 'fwB', { sourcePort: 3, targetPort: 1 }),
        link('fwB', 'r2', { sourcePort: 2, targetPort: 3 }),
        link('pcB', 'r2', { sourceNic: 'nic-1', targetPort: 1 }),
      ]
    );
  }

  it('is a new packet to a firewall that never saw the request: its rules apply', () => {
    const flow = planAndEvaluateFlow('ping', 'pcA', 'pcB', twoFirewalls());
    expect(flow.legs.map(leg => [leg.purpose, leg.trace.verdict])).toEqual([
      ['request', 'success'],
      ['reply', 'blocked'],
    ]);
    expect(flow.legs[0].trace.hops.map(h => h.deviceId)).toEqual(['pcA', 'r1', 'fwA', 'r2', 'pcB']);
    expect(flow.failureReason).toBe(
      'reply: firewall fwB: denied by rule 1 (deny ping from 192.168.2.0/24 to 192.168.1.0/24), ' +
        'and it never saw the request'
    );
    expect(flow.animationPath).toEqual(['pcA', 'r1', 'fwA', 'r2', 'pcB', 'r2', 'fwB']);
  });

  it('passes the firewall that saw the request, whatever its rules say about a new flow', () => {
    // Both routers send by fwA: the reply comes back the way the request went
    const base = twoFirewalls();
    const symmetric: Topology = {
      ...base,
      devices: base.devices.map(d =>
        d.id === 'r2' ? { ...d, routes: [{ id: 'r2-1', destination: '192.168.1.0/24', nextHop: '10.0.2.1' }] } : d
      ),
    };
    const flow = planAndEvaluateFlow('ping', 'pcA', 'pcB', symmetric);
    expect(flow.verdict).toBe('success');
    expect(flow.notes).toContain(
      'reply: firewall fwA: reply to an allowed flow passes rule 1 (deny ping from 192.168.2.0/24 to 192.168.1.0/24)'
    );
  });

  it('is judged by every firewall on its way: one that saw the request lets it pass, the next does not', () => {
    // the reply crosses fwB after nothing else; fwA saw the request only
    const packet = (seen: string[]): Packet => ({
      sourceIp: '192.168.2.10',
      destinationIp: '192.168.1.10',
      service: 'ping',
      returnTraffic: true,
      requestPath: new Set(seen),
    });
    const fwB = twoFirewalls().devices.find(d => d.id === 'fwB') as NetworkDevice;
    expect(evaluateFirewall(fwB, undefined, undefined, packet(['fwB']))?.allowed).toBe(true);
    expect(evaluateFirewall(fwB, undefined, undefined, packet(['fwA']))).toMatchObject({
      allowed: false,
      text:
        'firewall fwB: denied by rule 1 (deny ping from 192.168.2.0/24 to 192.168.1.0/24), ' +
        'and it never saw the request',
    });
  });
});
