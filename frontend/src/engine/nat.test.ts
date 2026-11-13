/**
 * Address translation — what a router or a firewall does to the addresses of
 * a packet, and what the Internet does with private ones.
 *
 * The network of nearly every test:
 *
 *   PC  192.168.1.10 ─┐
 *                     SW ── port 1  GW  port 2 ── Internet ── Ext
 *   Srv 192.168.1.20 ─┘   192.168.1.1  203.0.113.2          203.0.113.50
 *
 * GW is a router (a firewall where the test says so) with NAT on port 2.
 */

import { describe, it, expect } from 'vitest';
import type { FirewallRule, NetworkDevice, Port, PortForward } from '@/types';
import { device, forward, host, link, nic, port, rule, switchWith, topo } from '@/test/networkFixtures';
import type { Topology, TraceResult } from './types';
import { boundInterface } from './interfaces';
import { isPublicInternet } from './topology';
import { traceRoute } from './trace';
import { planAndEvaluateFlow } from './flows';
import {
  describeForward,
  doesNat,
  forwardAddress,
  forwardProblem,
  isPrivateAddress,
  matchForward,
  natAddress,
  publications,
} from './nat';

const MASK = '255.255.255.0';

interface SiteOptions {
  /** NAT on the port that faces the Internet (default: on) */
  nat?: boolean;
  wan?: Partial<Port>;
  forwards?: PortForward[];
  rules?: FirewallRule[];
  firewall?: boolean;
  /** Name of the Cloud symbol (default: Internet) */
  cloud?: string;
}

function site(options: SiteOptions = {}): Topology {
  const { nat = true, wan = {}, forwards, rules, firewall = false, cloud = 'Internet' } = options;
  return topo(
    [
      host('pc', '192.168.1.10', '192.168.1.1', { label: 'PC' }),
      host('srv', '192.168.1.20', '192.168.1.1', { label: 'Srv', type: 'Server', templateId: 'tpl-webserver' }),
      switchWith('sw', [port(1), port(2), port(3)], { label: 'SW' }),
      device({
        id: 'gw',
        label: 'GW',
        type: firewall ? 'Firewall' : 'Router',
        ip: '192.168.1.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK, ...(firewall ? { securityZone: 'trust' as const } : {}) }),
          port(2, {
            ip: '203.0.113.2',
            subnet: MASK,
            nat,
            ...(firewall ? { securityZone: 'untrust' as const } : {}),
            ...wan,
          }),
        ],
        portForwards: forwards,
        firewallRules: rules,
      }),
      device({
        id: 'inet',
        label: cloud,
        type: 'Cloud',
        templateId: 'tpl-cloud',
        nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })],
      }),
      host('ext', '203.0.113.50', '203.0.113.2', { label: 'Ext' }),
    ],
    [
      link('pc', 'sw', { sourceNic: 'nic-1', targetPort: 1 }),
      link('srv', 'sw', { sourceNic: 'nic-1', targetPort: 2 }),
      link('sw', 'gw', { sourcePort: 3, targetPort: 1 }),
      link('gw', 'inet', { sourcePort: 2, targetNic: 'nic-1' }),
      link('inet', 'ext', { sourceNic: 'nic-2', targetNic: 'nic-1' }),
    ]
  );
}

/** "GW (routed: …; NAT: …)" for every hop */
const way = (trace: TraceResult): string[] =>
  trace.hops.map(hop => (hop.note ? `${hop.label} (${hop.note})` : hop.label));

const gw = (t: Topology): NetworkDevice => t.devices.find(d => d.id === 'gw') as NetworkDevice;

// ---------- the pieces ----------

describe('isPrivateAddress', () => {
  it.each([
    ['10.0.0.1', true],
    ['10.255.255.254', true],
    ['172.16.0.10', true],
    ['172.31.255.1', true],
    ['192.168.1.20', true],
    ['169.254.10.1', true],
    ['172.15.0.1', false],
    ['172.32.0.1', false],
    ['192.167.1.1', false],
    ['192.169.1.1', false],
    ['11.0.0.1', false],
    ['203.0.113.2', false],
    ['198.51.100.10', false],
    ['8.8.8.8', false],
    ['', false],
    ['not an address', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe('isPublicInternet', () => {
  it.each([
    ['Internet', 'Cloud', 'tpl-cloud', true],
    ['internet', 'Cloud', 'tpl-cloud', true],
    ['Internet (ISP)', 'Cloud', 'tpl-cloud', true],
    ['Cloud-1', 'Cloud', 'tpl-cloud', false],
    ['MPLS', 'Cloud', 'tpl-cloud', false],
    ['WAN', 'Cloud', undefined, false],
    // a name is not enough: it has to be a Cloud symbol
    ['Internet', 'Router', 'tpl-router', false],
    ['Internet', 'PC', 'tpl-pc', false],
  ] as const)('%s (%s) → %s', (label, type, templateId, expected) => {
    expect(isPublicInternet(device({ id: 'x', label, type, templateId }))).toBe(expected);
  });
});

describe('a port that does NAT', () => {
  const t = site();
  const wanLink = t.connections.find(c => c.id === 'gw--inet');
  const lanLink = t.connections.find(c => c.id === 'sw--gw');
  const wan = wanLink && boundInterface(wanLink, gw(t), 'source');
  const lan = lanLink && boundInterface(lanLink, gw(t), 'target');

  it('is a port with NAT switched on: it gives its address to what leaves by it', () => {
    expect(doesNat(wan)).toBe(true);
    expect(natAddress(wan)).toBe('203.0.113.2');
    expect(doesNat(lan)).toBe(false);
    expect(natAddress(lan)).toBeUndefined();
    expect(doesNat(undefined)).toBe(false);
    expect(natAddress(undefined)).toBeUndefined();
  });

  it('has nothing to give when it has no address, or not a valid one', () => {
    for (const ip of ['', 'dhcp']) {
      const bare = site({ wan: { ip } });
      const link = bare.connections.find(c => c.id === 'gw--inet');
      const iface = link && boundInterface(link, gw(bare), 'source');
      expect(doesNat(iface), ip).toBe(true);
      expect(natAddress(iface), ip).toBeUndefined();
    }
  });

  it('a network card never does NAT', () => {
    const pc = t.devices.find(d => d.id === 'pc') as NetworkDevice;
    const card = boundInterface(t.connections[0], pc, 'source');
    expect(card?.kind).toBe('nic');
    expect(doesNat(card)).toBe(false);
  });
});

describe('port forwards', () => {
  const web = forward('web', 2, '192.168.1.20');

  it('a forward takes what is addressed to its port, for its service', () => {
    const device = gw(site({ forwards: [web] }));
    expect(matchForward(device, 'web', '203.0.113.2')).toEqual({ forward: web, number: 1 });
    expect(matchForward(device, 'ping', '203.0.113.2')).toBeUndefined();
    expect(matchForward(device, 'email', '203.0.113.2')).toBeUndefined();
    // the address of another port is not the one it publishes
    expect(matchForward(device, 'web', '192.168.1.1')).toBeUndefined();
    expect(matchForward(device, 'web', '203.0.113.50')).toBeUndefined();
  });

  it('"any" takes every service', () => {
    const device = gw(site({ forwards: [forward('any', 2, '192.168.1.20')] }));
    for (const service of ['ping', 'web', 'email'] as const) {
      expect(matchForward(device, service, '203.0.113.2')?.number, service).toBe(1);
    }
  });

  it('the first that matches is taken, and it says its place in the list', () => {
    const mail = forward('email', 2, '192.168.1.10');
    const second = forward('web', 2, '192.168.1.10');
    const device = gw(site({ forwards: [mail, web, second] }));
    expect(matchForward(device, 'web', '203.0.113.2')).toEqual({ forward: web, number: 2 });
    expect(matchForward(device, 'email', '203.0.113.2')).toEqual({ forward: mail, number: 1 });
  });

  it('a disabled forward, or one that cannot work, is passed over', () => {
    const off = forward('web', 2, '192.168.1.10', { enabled: false });
    const nowhere = forward('web', 2, 'somewhere');
    const noPort = forward('web', 7, '192.168.1.10');
    const device = gw(site({ forwards: [off, nowhere, noPort, web] }));
    expect(matchForward(device, 'web', '203.0.113.2')).toEqual({ forward: web, number: 4 });
  });

  it('publishes nothing from a port without an address', () => {
    const device = gw(site({ forwards: [web], wan: { ip: '' } }));
    expect(forwardAddress(device, web)).toBeUndefined();
    expect(matchForward(device, 'web', '203.0.113.2')).toBeUndefined();
  });

  it('a device with no forwards matches nothing', () => {
    expect(matchForward(gw(site()), 'web', '203.0.113.2')).toBeUndefined();
  });

  it('reads like the command that writes it', () => {
    expect(describeForward(web)).toBe('forward web from interface 2 to 192.168.1.20');
    expect(describeForward(forward('any', 3, '10.0.0.5'))).toBe('forward any from interface 3 to 10.0.0.5');
  });

  it('says where an inside address is published, service by service', () => {
    const mail = forward('email', 2, '192.168.1.20');
    const other = forward('web', 2, '192.168.1.10');
    const t = site({ forwards: [other, web, mail] });

    expect(publications(t, '192.168.1.20', 'web').map(p => [p.device.label, p.number, p.address])).toEqual([
      ['GW', 2, '203.0.113.2'],
    ]);
    expect(publications(t, '192.168.1.20', 'email').map(p => p.number)).toEqual([3]);
    expect(publications(t, '192.168.1.20', 'ping')).toEqual([]);
    expect(publications(t, '192.168.1.99', 'web')).toEqual([]);
    expect(publications(site({ forwards: [{ ...web, enabled: false }] }), '192.168.1.20', 'web')).toEqual([]);
    expect(publications(site({ forwards: [web], wan: { ip: '' } }), '192.168.1.20', 'web')).toEqual([]);
  });

  it('says why a forward cannot work as written', () => {
    const device = gw(site({ forwards: [web] }));
    expect(forwardProblem(device, web)).toBeUndefined();
    expect(forwardProblem(device, forward('web', 9, '192.168.1.20'))).toBe('GW has no interface 9');
    expect(forwardProblem(device, forward('web', 2, 'srv'))).toBe('srv is not a valid address');
    expect(forwardProblem(device, forward('web', 2, '203.0.113.2'))).toBe(
      '203.0.113.2 is the address of interface 2 itself'
    );
    expect(forwardProblem(gw(site({ wan: { ip: '' } })), web)).toBe(
      'interface 2 on GW has no address to publish'
    );
  });
});

// ---------- going out ----------

describe('source NAT: going out', () => {
  it('a packet from inside leaves with the address of the NAT port', () => {
    const result = traceRoute('pc', 'ext', site());

    expect(result.verdict).toBe('success');
    expect(way(result)).toEqual([
      'PC',
      'SW',
      'GW (routed: 203.0.113.0/24 is on port 2; NAT: source 192.168.1.10 → 203.0.113.2)',
      'Internet (Internet is not simulated: traffic assumed to pass)',
      'Ext',
    ]);
    // as sent, and as the destination saw it
    expect(result.sourceIp).toBe('192.168.1.10');
    expect(result.targetIp).toBe('203.0.113.50');
    expect(result.seenSourceIp).toBe('203.0.113.2');
    expect(result.reachedIp).toBeUndefined();
    expect(result.translations).toEqual([
      { deviceId: 'gw', kind: 'source', inside: '192.168.1.10', outside: '203.0.113.2' },
    ]);
  });

  it('the reply comes back to that address, and the device sends it on to the real sender', () => {
    const exchange = planAndEvaluateFlow('ping', 'pc', 'ext', site());

    expect(exchange.verdict).toBe('success');
    const reply = exchange.legs[1].trace;
    expect(reply.sourceIp).toBe('203.0.113.50');
    expect(reply.targetIp).toBe('203.0.113.2');
    expect(reply.reachedIp).toBe('192.168.1.10');
    expect(way(reply)).toEqual([
      'Ext',
      'Internet (Internet is not simulated: traffic assumed to pass)',
      'GW (NAT: destination 203.0.113.2 → 192.168.1.10 (reply to a translated flow); routed: 192.168.1.0/24 is on port 1)',
      'SW',
      'PC',
    ]);
    // a reply is not a flow of its own: the device remembers nothing new
    expect(reply.translations).toBeUndefined();
  });

  it('without the memory of the flow the same packet stops at the device: it is for the device', () => {
    // The reply, sent as a packet of its own
    const stray = traceRoute('ext', 'pc', site(), { returnTraffic: true, targetIp: '203.0.113.2' });
    expect(stray.verdict).toBe('success');
    expect(way(stray)).toEqual([
      'Ext',
      'Internet (Internet is not simulated: traffic assumed to pass)',
      'GW',
    ]);
  });

  it('what the device sends itself is not translated', () => {
    const result = traceRoute('gw', 'ext', site());
    expect(result.verdict).toBe('success');
    expect(result.sourceIp).toBe('203.0.113.2');
    expect(result.seenSourceIp).toBeUndefined();
    expect(result.translations).toBeUndefined();
    expect(way(result)[0]).toBe('GW');
  });

  it('with NAT off the Internet refuses the private source, and the reason names the port', () => {
    const result = traceRoute('pc', 'ext', site({ nat: false }));

    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'Internet does not carry private addresses: 192.168.1.10 has to be translated before it ' +
        'goes out, and NAT is off on port 2 on GW'
    );
    expect(result.unroutable).toEqual({ role: 'source', address: '192.168.1.10' });
    expect(result.hops.map(h => [h.label, h.status])).toEqual([
      ['PC', 'forwarded'],
      ['SW', 'forwarded'],
      ['GW', 'forwarded'],
      ['Internet', 'blocked'],
    ]);
  });

  it('NAT on a port without an address translates nothing, and says so', () => {
    // A router with no address on its ports lets traffic through unverified:
    // PC ── port 1  R  port 2 (NAT) ── Srv
    const t = topo(
      [
        host('pc', '192.168.1.10', '192.168.1.1', { label: 'PC' }),
        device({
          id: 'r',
          label: 'R',
          type: 'Router',
          ip: '192.168.1.1',
          ports: [port(1), port(2, { nat: true })],
        }),
        host('srv', '192.168.2.20', '192.168.2.1', { label: 'Srv', type: 'Server' }),
      ],
      [
        link('pc', 'r', { sourceNic: 'nic-1', targetPort: 1 }),
        link('r', 'srv', { sourcePort: 2, targetNic: 'nic-1' }),
      ]
    );
    const result = traceRoute('pc', 'srv', t);

    expect(result.verdict).toBe('success');
    expect(result.translations).toBeUndefined();
    expect(result.seenSourceIp).toBeUndefined();
    expect(result.notes).toContain('NAT on R port 2 has no address to translate to: not applied');
  });

  it('a Cloud symbol that is not the Internet carries private addresses, as a private line does', () => {
    const result = traceRoute('pc', 'ext', site({ nat: false, cloud: 'MPLS' }));
    expect(result.verdict).toBe('success');
    expect(result.notes).toEqual(['MPLS is not simulated: traffic assumed to pass']);
    expect(result.seenSourceIp).toBeUndefined();
  });

  it('public addresses cross the Internet with no NAT at all', () => {
    // The device talks from its own public address
    const exchange = planAndEvaluateFlow('ping', 'gw', 'ext', site({ nat: false }));
    expect(exchange.verdict).toBe('success');
  });
});

describe('source NAT and the firewall of the same device', () => {
  it('its rules see the real source: the translation comes after them', () => {
    const t = site({ firewall: true, rules: [rule('deny', 'ping', '192.168.1.10', 'any')] });

    const denied = traceRoute('pc', 'ext', t);
    expect(denied.verdict).toBe('blocked');
    expect(denied.failureReason).toBe(
      'firewall GW: denied by rule 1 (deny ping from 192.168.1.10 to any)'
    );
    expect(denied.translations).toBeUndefined();

    // the server is not named by the rule: it goes out, translated
    const allowed = traceRoute('srv', 'ext', t);
    expect(allowed.verdict).toBe('success');
    expect(allowed.seenSourceIp).toBe('203.0.113.2');
  });

  it('a rule written for the translated address matches nothing', () => {
    const t = site({ firewall: true, rules: [rule('deny', 'ping', '203.0.113.2', 'any')] });
    expect(traceRoute('pc', 'ext', t).verdict).toBe('success');
  });

  it('the reply passes the firewall as the reply it is, after it is translated back', () => {
    const exchange = planAndEvaluateFlow('ping', 'pc', 'ext', site({ firewall: true }));
    expect(exchange.verdict).toBe('success');
    expect(way(exchange.legs[1].trace)[2]).toBe(
      'GW (NAT: destination 203.0.113.2 → 192.168.1.10 (reply to a translated flow); ' +
        'routed: 192.168.1.0/24 is on port 1; ' +
        'firewall policy: untrust → trust allowed (reply to an allowed flow))'
    );
  });
});

describe('source NAT: a reply is never translated as a new flow', () => {
  /**
   * NAT on the port that faces the PCs (as the routers added in bulk have it
   * on port 1): PC ── port 1 (NAT)  R  port 2 ── Srv
   */
  const inside = topo(
    [
      host('pc', '192.168.1.10', '192.168.1.1', { label: 'PC' }),
      device({
        id: 'r',
        label: 'R',
        type: 'Router',
        ip: '192.168.1.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK, nat: true }),
          port(2, { ip: '192.168.2.1', subnet: MASK }),
        ],
      }),
      host('srv', '192.168.2.20', '192.168.2.1', { label: 'Srv', type: 'Server' }),
    ],
    [
      link('pc', 'r', { sourceNic: 'nic-1', targetPort: 1 }),
      link('r', 'srv', { sourcePort: 2, targetNic: 'nic-1' }),
    ]
  );

  it('a flow that came in by the NAT port is answered with the real addresses', () => {
    const exchange = planAndEvaluateFlow('ping', 'pc', 'srv', inside);
    expect(exchange.verdict).toBe('success');
    expect(exchange.legs[0].trace.translations).toBeUndefined();
    expect(way(exchange.legs[1].trace)).toEqual(['Srv', 'R (routed: 192.168.1.0/24 is on port 1)', 'PC']);
    expect(exchange.legs[1].trace.seenSourceIp).toBeUndefined();
  });

  it('a new flow that leaves by it is translated, and its reply finds the way back', () => {
    const exchange = planAndEvaluateFlow('ping', 'srv', 'pc', inside);
    expect(exchange.verdict).toBe('success');
    expect(way(exchange.legs[0].trace)).toEqual([
      'Srv',
      'R (routed: 192.168.1.0/24 is on port 1; NAT: source 192.168.2.20 → 192.168.1.1)',
      'PC',
    ]);
    expect(way(exchange.legs[1].trace)).toEqual([
      'PC',
      'R (NAT: destination 192.168.1.1 → 192.168.2.20 (reply to a translated flow); routed: 192.168.2.0/24 is on port 2)',
      'Srv',
    ]);
  });
});

describe('source NAT twice on the way', () => {
  /** PC ── R-In (NAT on port 2) ── R-Out (NAT on port 2) ── Internet ── Ext */
  const double = topo(
    [
      host('pc', '192.168.1.10', '192.168.1.1', { label: 'PC' }),
      device({
        id: 'in',
        label: 'R-In',
        type: 'Router',
        ip: '192.168.1.1',
        gateway: '10.0.0.1',
        ports: [
          port(1, { ip: '192.168.1.1', subnet: MASK }),
          port(2, { ip: '10.0.0.2', subnet: MASK, nat: true }),
        ],
      }),
      device({
        id: 'out',
        label: 'R-Out',
        type: 'Router',
        ip: '10.0.0.1',
        ports: [
          port(1, { ip: '10.0.0.1', subnet: MASK }),
          port(2, { ip: '203.0.113.2', subnet: MASK, nat: true }),
        ],
      }),
      device({ id: 'inet', label: 'Internet', type: 'Cloud', templateId: 'tpl-cloud', nics: [nic(), nic({ id: 'nic-2', name: 'eth1' })] }),
      host('ext', '203.0.113.50', '203.0.113.2', { label: 'Ext' }),
    ],
    [
      link('pc', 'in', { sourceNic: 'nic-1', targetPort: 1 }),
      link('in', 'out', { sourcePort: 2, targetPort: 1 }),
      link('out', 'inet', { sourcePort: 2, targetNic: 'nic-1' }),
      link('inet', 'ext', { sourceNic: 'nic-2', targetNic: 'nic-1' }),
    ]
  );

  it('each device translates what reaches it, and the reply is translated back in turn', () => {
    const exchange = planAndEvaluateFlow('ping', 'pc', 'ext', double);
    expect(exchange.verdict).toBe('success');

    const request = exchange.legs[0].trace;
    expect(request.seenSourceIp).toBe('203.0.113.2');
    expect(request.translations).toEqual([
      { deviceId: 'in', kind: 'source', inside: '192.168.1.10', outside: '10.0.0.2' },
      { deviceId: 'out', kind: 'source', inside: '10.0.0.2', outside: '203.0.113.2' },
    ]);

    const reply = exchange.legs[1].trace;
    expect(reply.reachedIp).toBe('192.168.1.10');
    expect(way(reply)).toEqual([
      'Ext',
      'Internet (Internet is not simulated: traffic assumed to pass)',
      'R-Out (NAT: destination 203.0.113.2 → 10.0.0.2 (reply to a translated flow); routed: 10.0.0.0/24 is on port 1)',
      'R-In (NAT: destination 10.0.0.2 → 192.168.1.10 (reply to a translated flow); routed: 192.168.1.0/24 is on port 1)',
      'PC',
    ]);
  });
});

// ---------- coming in ----------

describe('port forward: coming in', () => {
  const published = () => site({ forwards: [forward('web', 2, '192.168.1.20')] });

  it('who is outside reaches the server at the address that publishes it', () => {
    const exchange = planAndEvaluateFlow('web', 'ext', 'srv', published());

    expect(exchange.verdict).toBe('success');
    const request = exchange.legs[0].trace;
    expect(request.sourceIp).toBe('203.0.113.50');
    expect(request.targetIp).toBe('203.0.113.2');
    expect(request.reachedIp).toBe('192.168.1.20');
    expect(request.seenSourceIp).toBeUndefined();
    expect(request.translations).toEqual([
      { deviceId: 'gw', kind: 'forward', inside: '192.168.1.20', outside: '203.0.113.2' },
    ]);
    expect(way(request)).toEqual([
      'Ext',
      'Internet (Internet is not simulated: traffic assumed to pass)',
      'GW (NAT: destination 203.0.113.2 → 192.168.1.20 (port forward 1); routed: 192.168.1.0/24 is on port 1)',
      'SW',
      'Srv',
    ]);
    expect(exchange.notes[0]).toBe(
      'HTTP request: Srv is behind NAT: reached at 203.0.113.2, where GW publishes it (port forward 1)'
    );
  });

  it('the answer leaves with the address that was asked, not with the one inside', () => {
    const exchange = planAndEvaluateFlow('web', 'ext', 'srv', published());
    const response = exchange.legs[1].trace;

    expect(response.sourceIp).toBe('192.168.1.20');
    expect(response.targetIp).toBe('203.0.113.50');
    expect(response.seenSourceIp).toBe('203.0.113.2');
    expect(way(response)).toEqual([
      'Srv',
      'SW',
      'GW (routed: 203.0.113.0/24 is on port 2; NAT: source 192.168.1.20 → 203.0.113.2 (reply to a forwarded flow))',
      'Internet (Internet is not simulated: traffic assumed to pass)',
      'Ext',
    ]);
  });

  it('the address inside is not a way in: the Internet does not carry it, and the reason says where to go', () => {
    const typed = planAndEvaluateFlow('web', 'ext', 'srv', published(), { targetIp: '192.168.1.20' });

    expect(typed.verdict).toBe('blocked');
    expect(typed.failureReason).toBe(
      'HTTP request: Internet does not carry private addresses: 192.168.1.20 is reached from ' +
        'outside at 203.0.113.2, where GW publishes it (port forward 1)'
    );
    // an address that was typed is the address aimed at: nothing is tried in its place
    expect(typed.legs).toHaveLength(1);
    expect(typed.legs[0].trace.targetIp).toBe('192.168.1.20');
    expect(typed.legs[0].trace.unroutable).toEqual({ role: 'destination', address: '192.168.1.20' });
  });

  it('a typed public address is forwarded like any packet that arrives for it', () => {
    const typed = traceRoute('ext', 'gw', published(), { service: 'web', targetIp: '203.0.113.2' });
    expect(typed.verdict).toBe('success');
    expect(typed.hops.map(h => h.label)).toEqual(['Ext', 'Internet', 'GW', 'SW', 'Srv']);
    expect(typed.reachedIp).toBe('192.168.1.20');
  });

  it('a whole exchange with the public address typed is answered by the server, from that address', () => {
    const exchange = planAndEvaluateFlow('web', 'ext', 'gw', published(), { targetIp: '203.0.113.2' });

    expect(exchange.verdict).toBe('success');
    // planned to the device the forward names, and answered from it
    expect(exchange.legs.map(leg => [leg.fromId, leg.toId])).toEqual([
      ['ext', 'srv'],
      ['srv', 'ext'],
    ]);
    expect(exchange.notes[0]).toBe('203.0.113.2 is GW, which forwards web to Srv (port forward 1)');
    expect(exchange.notes.join(' ')).not.toContain('not a server-type device');
    expect(way(exchange.legs[1].trace)[0]).toBe('Srv');
    expect(exchange.legs[1].trace.seenSourceIp).toBe('203.0.113.2');
  });

  it('a ping typed at the public address is for the device, unless ping is forwarded too', () => {
    const atDevice = planAndEvaluateFlow('ping', 'ext', 'gw', published(), { targetIp: '203.0.113.2' });
    expect(atDevice.verdict).toBe('success');
    expect(atDevice.legs.map(leg => [leg.fromId, leg.toId])).toEqual([
      ['ext', 'gw'],
      ['gw', 'ext'],
    ]);
    expect(atDevice.notes).toEqual([
      'request: Internet is not simulated: traffic assumed to pass',
      'reply: Internet is not simulated: traffic assumed to pass',
    ]);

    const everything = site({ forwards: [forward('any', 2, '192.168.1.20')] });
    const forwarded = planAndEvaluateFlow('ping', 'ext', 'gw', everything, { targetIp: '203.0.113.2' });
    expect(forwarded.verdict).toBe('success');
    expect(forwarded.legs.map(leg => [leg.fromId, leg.toId])).toEqual([
      ['ext', 'srv'],
      ['srv', 'ext'],
    ]);
  });

  it('a reply leaves from the device the request was delivered to', () => {
    // a forward that changes under the same address between two services
    const t = site({ forwards: [forward('web', 2, '192.168.1.20'), forward('email', 2, '192.168.1.10')] });
    const mail = planAndEvaluateFlow('ping', 'ext', 'gw', t, { targetIp: '203.0.113.2' });
    expect(mail.legs[1].fromId).toBe('gw');
    const web = planAndEvaluateFlow('web', 'ext', 'gw', t, { targetIp: '203.0.113.2' });
    expect(web.legs[1].fromId).toBe('srv');
  });

  it('a service that is not forwarded does not get in', () => {
    const ping = planAndEvaluateFlow('ping', 'ext', 'srv', published());
    expect(ping.verdict).toBe('blocked');
    expect(ping.failureReason).toBe(
      'request: Internet does not carry private addresses: 192.168.1.20 is not reachable from ' +
        'outside: no port forward publishes it for ping'
    );
    // aimed at the public address, a ping is for the device itself: it answers
    const atDevice = traceRoute('ext', 'gw', published(), { service: 'ping', targetIp: '203.0.113.2' });
    expect(atDevice.verdict).toBe('success');
    expect(atDevice.hops.map(h => h.label)).toEqual(['Ext', 'Internet', 'GW']);
    expect(atDevice.reachedIp).toBeUndefined();
  });

  it('"any" forwards a ping too', () => {
    const exchange = planAndEvaluateFlow('ping', 'ext', 'srv', site({ forwards: [forward('any', 2, '192.168.1.20')] }));
    expect(exchange.verdict).toBe('success');
    expect(exchange.legs[0].trace.hops.map(h => h.label)).toEqual(['Ext', 'Internet', 'GW', 'SW', 'Srv']);
  });

  it('a device that is not published is not reachable, with or without NAT on the port', () => {
    for (const nat of [true, false]) {
      const result = planAndEvaluateFlow('web', 'ext', 'srv', site({ nat }));
      expect(result.verdict, String(nat)).toBe('blocked');
      expect(result.failureReason, String(nat)).toBe(
        'HTTP request: Internet does not carry private addresses: 192.168.1.20 is not reachable ' +
          'from outside: no port forward publishes it for web'
      );
    }
  });

  it('a forward works on a port that does no source NAT, for what comes in', () => {
    const t = site({ nat: false, forwards: [forward('web', 2, '192.168.1.20')] });
    const exchange = planAndEvaluateFlow('web', 'ext', 'srv', t);
    expect(exchange.verdict).toBe('success');
    // the answer still leaves with the address that was asked
    expect(exchange.legs[1].trace.seenSourceIp).toBe('203.0.113.2');
  });

  it('a forward to an address nobody has drops the packet at the device, and says so', () => {
    const result = traceRoute('ext', 'gw', site({ forwards: [forward('web', 2, '192.168.1.99')] }), {
      service: 'web',
      targetIp: '203.0.113.2',
    });
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe(
      'GW sends 203.0.113.2 on to 192.168.1.99 (port forward 1), an address no device has'
    );
    expect(result.hops[result.hops.length - 1]).toMatchObject({ label: 'GW', status: 'blocked' });
  });

  it('a device is reached at its own public address when it is named by the one it has inside', () => {
    const exchange = planAndEvaluateFlow('ping', 'ext', 'gw', site());
    expect(exchange.verdict).toBe('success');
    expect(exchange.legs[0].trace.targetIp).toBe('203.0.113.2');
    expect(exchange.notes[0]).toBe('request: GW is reached from outside at 203.0.113.2, its public address');
  });
});

describe('port forward and the firewall of the same device', () => {
  const web = () => forward('web', 2, '192.168.1.20');

  it('the forward says where the traffic goes; a rule has to say that it may', () => {
    const closed = planAndEvaluateFlow('web', 'ext', 'srv', site({ firewall: true, forwards: [web()] }));
    expect(closed.verdict).toBe('blocked');
    expect(closed.failureReason).toBe('HTTP request: firewall policy on GW: untrust → trust denied');

    const open = planAndEvaluateFlow(
      'web',
      'ext',
      'srv',
      site({ firewall: true, forwards: [web()], rules: [rule('allow', 'web', 'untrust', '192.168.1.20')] })
    );
    expect(open.verdict).toBe('success');
  });

  it('the rule names the real destination: the translation comes before it', () => {
    const t = site({
      firewall: true,
      forwards: [web()],
      rules: [rule('allow', 'web', 'untrust', '192.168.1.20')],
    });
    expect(way(planAndEvaluateFlow('web', 'ext', 'srv', t).legs[0].trace)[2]).toBe(
      'GW (NAT: destination 203.0.113.2 → 192.168.1.20 (port forward 1); ' +
        'routed: 192.168.1.0/24 is on port 1; ' +
        'firewall GW: allowed by rule 1 (allow web from untrust to 192.168.1.20))'
    );

    // a rule written for the public address does not open the way
    const wrong = site({
      firewall: true,
      forwards: [web()],
      rules: [rule('allow', 'web', 'untrust', '203.0.113.2')],
    });
    expect(planAndEvaluateFlow('web', 'ext', 'srv', wrong).verdict).toBe('blocked');
  });
});
