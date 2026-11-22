import { describe, it, expect } from 'vitest';
import type { NetworkDevice, NetworkConnection } from '@/types';
import type { Topology } from './types';
import { cloudMailbox, planAndEvaluateFlow } from './flows';
import { withFailures } from './failures';
import { traceRoute } from './trace';

// ---------- fixture factories ----------

function device(overrides: Partial<NetworkDevice> & { id: string }): NetworkDevice {
  return {
    type: 'PC',
    label: overrides.id,
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function link(
  source: string,
  target: string,
  overrides: Partial<NetworkConnection> = {}
): NetworkConnection {
  return { id: `${source}--${target}`, source, target, ...overrides };
}

function topo(devices: NetworkDevice[], connections: NetworkConnection[] = []): Topology {
  return { devices, connections };
}

/** PC-1 — SW-1 — PC-2, all on 192.168.1.0/24 */
function sameSubnetViaSwitch(): Topology {
  return topo(
    [
      device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
      device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2' }),
      device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
    ],
    [link('pc1', 'sw1'), link('sw1', 'pc2')]
  );
}

/**
 * PC-1 — SW-1 — Internet-GW and SW-1 — PC-2, all on 192.168.1.0/24.
 * The gateway is a plain Router matched as internet exit via its LABEL.
 */
function cloudViaSwitch(): Topology {
  return topo(
    [
      device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
      device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2' }),
      device({ id: 'gw1', label: 'Internet-GW', type: 'Router', ip: '192.168.1.1' }),
      device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
    ],
    [link('pc1', 'sw1'), link('sw1', 'gw1'), link('sw1', 'pc2')]
  );
}

/** PC-1 — SW-1 — MAIL-1 and SW-1 — PC-2, all on 192.168.1.0/24 */
function mailViaSwitch(): Topology {
  return topo(
    [
      device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
      device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2' }),
      device({
        id: 'mail1',
        label: 'Mail-1',
        type: 'Server',
        templateId: 'tpl-mailserver',
        ip: '192.168.1.30',
      }),
      device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
    ],
    [link('pc1', 'sw1'), link('sw1', 'mail1'), link('sw1', 'pc2')]
  );
}

// ---------- common guards ----------

describe('planAndEvaluateFlow guards', () => {
  it.each(['web', 'download', 'email'] as const)(
    'errors on %s when source and target are the same device',
    model => {
      const result = planAndEvaluateFlow(model, 'pc1', 'pc1', sameSubnetViaSwitch());
      expect(result.verdict).toBe('error');
      expect(result.failureReason).toBe('source and target are the same device');
      expect(result.legs).toEqual([]);
      expect(result.animationPath).toEqual([]);
    }
  );

  it('answers a ping from a device to itself without the packet leaving it (loopback)', () => {
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc1', sameSubnetViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.trace.verdict, l.trace.hops.map(h => h.deviceId)])).toEqual([
      ['request', 'success', ['pc1']],
      ['reply', 'success', ['pc1']],
    ]);
    expect(result.animationPath).toEqual(['pc1']);
    expect(result.animationLinks).toEqual([]);
    // as a trace from the device to itself does
    expect(traceRoute('pc1', 'pc1', sameSubnetViaSwitch()).verdict).toBe('success');
  });

  it('a ping from a device to itself still needs the device to have an address', () => {
    const t = sameSubnetViaSwitch();
    const bare: Topology = {
      ...t,
      devices: t.devices.map(d => (d.id === 'pc1' ? { ...d, ip: '' } : d)),
    };
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc1', bare);
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe('request: PC-1 has no IP address configured');
    expect(traceRoute('pc1', 'pc1', bare).failureReason).toBe('PC-1 has no IP address configured');
  });

  it('stops after the first failing leg (legs.length === 1)', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [] // no physical path: the request leg fails immediately
    );
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('unreachable');
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].purpose).toBe('request');
    expect(result.failureReason).toBe('request: no physical path between PC-1 and PC-2');
  });
});

// ---------- ping ----------

describe('planAndEvaluateFlow ping', () => {
  it('evaluates a round trip and concatenates the animation path without a duplicated joint', () => {
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc2', sameSubnetViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['request', 'pc1', 'pc2'],
      ['reply', 'pc2', 'pc1'],
    ]);
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'pc2', 'sw1', 'pc1']);
    expect(result.failureReason).toBeUndefined();
  });

  it('surfaces a reply-leg failure on asymmetric gateway config', () => {
    // Cross-subnet via router; only the TARGET lacks a gateway, so the
    // request succeeds but the reply is blocked at its source (pc2).
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10', gateway: '192.168.1.1' }),
        device({ id: 'r1', label: 'Router-1', type: 'Router', ip: '192.168.1.1' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.2.10' }), // no gateway
      ],
      [link('pc1', 'r1'), link('r1', 'pc2')]
    );
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0].trace.verdict).toBe('success');
    expect(result.legs[1].trace.verdict).toBe('blocked');
    expect(result.failureReason).toBe('reply: no default gateway configured on PC-2');
    // failing leg contributes its hops up to the block; pc2 joint not repeated
    expect(result.animationPath).toEqual(['pc1', 'r1', 'pc2']);
  });

  it('prefixes aggregated leg notes with the leg purpose', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2', vlan: [20] }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'sw1'), link('sw1', 'pc2')]
    );
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    expect(result.notes).toContain('request: untagged traffic through Switch-0');
    expect(result.notes).toContain('reply: untagged traffic through Switch-0');
  });
});

// ---------- web / download ----------

describe('planAndEvaluateFlow web', () => {
  it('runs HTTP request and HTTP response legs', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({
          id: 'web1',
          label: 'Web-1',
          type: 'Server',
          templateId: 'tpl-webserver',
          ip: '192.168.1.80',
        }),
      ],
      [link('pc1', 'web1')]
    );
    const result = planAndEvaluateFlow('web', 'pc1', 'web1', t);
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => l.purpose)).toEqual(['HTTP request', 'HTTP response']);
    expect(result.animationPath).toEqual(['pc1', 'web1', 'pc1']);
    // server-like target: no "not a server-type device" note
    expect(result.notes.some(n => n.includes('not a server-type device'))).toBe(false);
  });

  it('notes when the target is not a server-type device', () => {
    const result = planAndEvaluateFlow('web', 'pc1', 'pc2', sameSubnetViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.notes).toContain('target PC-2 is not a server-type device');
  });
});

describe('planAndEvaluateFlow download', () => {
  it('uses download request / download data purposes', () => {
    const result = planAndEvaluateFlow('download', 'pc1', 'pc2', sameSubnetViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => l.purpose)).toEqual(['download request', 'download data']);
  });
});

// ---------- email ----------

describe('planAndEvaluateFlow email', () => {
  it('goes to the mail server, where the recipient fetches it: submit, fetch request, fetch reply', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', mailViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mail1'],
      ['fetch request', 'pc2', 'mail1'],
      ['fetch reply', 'mail1', 'pc2'],
    ]);
    // the fetch starts on the recipient: no cable between the end of the submit and its start ('')
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'mail1', 'pc2', 'sw1', 'mail1', 'sw1', 'pc2']);
    expect(result.animationLinks).toEqual([
      'pc1--sw1',
      'sw1--mail1',
      '',
      'sw1--pc2',
      'sw1--mail1',
      'sw1--mail1',
      'sw1--pc2',
    ]);
  });

  /**
   * PC-1 (port 1), PC-2 (port 2) and Mail-1 (port 3) on one network, each on
   * a port of FW-1, a firewall without addresses that applies its zones
   */
  function zonedMail(zones: { pc2: 'trust' | 'dmz'; mail: 'trust' | 'dmz' }): Topology {
    return topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
        device({
          id: 'fw1',
          label: 'FW-1',
          type: 'Firewall',
          ports: [
            { id: 1, enabled: true, securityZone: 'trust' },
            { id: 2, enabled: true, securityZone: zones.pc2 },
            { id: 3, enabled: true, securityZone: zones.mail },
          ],
        }),
        device({ id: 'mail1', label: 'Mail-1', type: 'Server', templateId: 'tpl-mailserver', ip: '192.168.1.30' }),
      ],
      [
        link('pc1', 'fw1', { targetPort: 1 }),
        link('pc2', 'fw1', { targetPort: 2 }),
        link('fw1', 'mail1', { sourcePort: 3 }),
      ]
    );
  }

  it('a mail server in the DMZ is fetched from, as a page is: the reply passes the firewall that saw the request', () => {
    const mail = planAndEvaluateFlow('email', 'pc1', 'pc2', zonedMail({ pc2: 'trust', mail: 'dmz' }));
    expect(mail.verdict).toBe('success');
    expect(mail.notes).toEqual([
      'SMTP submit: firewall policy: trust → dmz allowed',
      'fetch request: firewall policy: trust → dmz allowed',
      'fetch reply: firewall policy: dmz → trust allowed (reply to an allowed flow)',
    ]);
    // the same as a page from the same server
    expect(planAndEvaluateFlow('web', 'pc2', 'mail1', zonedMail({ pc2: 'trust', mail: 'dmz' })).verdict).toBe('success');
  });

  it('a recipient that may not open a flow to its server does not get its mail', () => {
    const mail = planAndEvaluateFlow('email', 'pc1', 'pc2', zonedMail({ pc2: 'dmz', mail: 'trust' }));
    expect(mail.verdict).toBe('blocked');
    expect(mail.legs.map(l => [l.purpose, l.trace.verdict])).toEqual([
      ['SMTP submit', 'success'],
      ['fetch request', 'blocked'],
    ]);
    expect(mail.failureReason).toBe('fetch request: firewall policy on FW-1: dmz → trust denied');
  });

  it('errors when no mail server exists in the network (internal mode)', () => {
    // Explicit 'internal': under the default 'auto' this topology (no mail
    // server AND no internet exit) reports the combined error instead.
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', sameSubnetViaSwitch(), {
      emailMode: 'internal',
    });
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe(
      'no mail server in the network — add a Mail Server device to deliver email'
    );
    expect(result.legs).toEqual([]);
    expect(result.animationPath).toEqual([]);
  });

  it('picks the mail server with the fewest BFS hops from the source', () => {
    // mailFar is FIRST in device order but 3 hops away; mailNear is 1 hop.
    const t = topo(
      [
        device({
          id: 'mailFar',
          label: 'Mail-Far',
          type: 'Server',
          templateId: 'tpl-mailserver',
          ip: '192.168.1.31',
        }),
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({
          id: 'mailNear',
          label: 'Mail-Near',
          type: 'Server',
          templateId: 'tpl-mailserver',
          ip: '192.168.1.30',
        }),
        device({ id: 'sw1', label: 'Switch-1', type: 'Switch', ip: '192.168.1.2' }),
        device({ id: 'sw2', label: 'Switch-2', type: 'Switch', ip: '192.168.1.3' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [
        link('pc1', 'mailNear'),
        link('pc1', 'sw1'),
        link('sw1', 'sw2'),
        link('sw2', 'mailFar'),
        link('mailNear', 'pc2'),
      ]
    );
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mailNear'],
      ['fetch request', 'pc2', 'mailNear'],
      ['fetch reply', 'mailNear', 'pc2'],
    ]);
  });

  it('relays the mail from the server of the sender to the server of the recipient, when they are two', () => {
    //  PC-1 ─ Mail-A ─ SW ─ Mail-B ─ PC-2: each PC fetches from the server nearest to it
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'mailA', label: 'Mail-A', type: 'Server', templateId: 'tpl-mailserver', ip: '192.168.1.31' }),
        device({ id: 'sw', label: 'SW', type: 'Switch', ip: '192.168.1.2' }),
        device({ id: 'mailB', label: 'Mail-B', type: 'Server', templateId: 'tpl-mailserver', ip: '192.168.1.32' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'mailA'), link('mailA', 'sw'), link('sw', 'mailB'), link('mailB', 'pc2')]
    );
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mailA'],
      ['SMTP relay', 'mailA', 'mailB'],
      ['fetch request', 'pc2', 'mailB'],
      ['fetch reply', 'mailB', 'pc2'],
    ]);
    // a mail to a server that is not the sender's is relayed to it, and nobody fetches it
    expect(planAndEvaluateFlow('email', 'pc1', 'mailB', t).legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mailA'],
      ['SMTP relay', 'mailA', 'mailB'],
    ]);
  });

  it('skips unreachable mail servers when choosing', () => {
    // mailIsolated is first in device order but has no links at all.
    const t = topo(
      [
        device({
          id: 'mailIsolated',
          label: 'Mail-Isolated',
          type: 'Server',
          templateId: 'tpl-mailserver',
          ip: '192.168.1.31',
        }),
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({
          id: 'mail1',
          label: 'Mail-1',
          type: 'Server',
          templateId: 'tpl-mailserver',
          ip: '192.168.1.30',
        }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'mail1'), link('mail1', 'pc2')]
    );
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    expect(result.legs[0].toId).toBe('mail1');
  });

  it('sends a single SMTP submit leg when the target IS the mail server', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'mail1', mailViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mail1'],
    ]);
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'mail1']);
  });

  it('submits nothing when the source IS the mail server: the recipient fetches', () => {
    const result = planAndEvaluateFlow('email', 'mail1', 'pc2', mailViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['fetch request', 'pc2', 'mail1'],
      ['fetch reply', 'mail1', 'pc2'],
    ]);
  });

  it('includes hops up to the block when the fetch fails', () => {
    // The recipient is on another subnet, with no router and no gateway:
    // SMTP submit succeeds, the fetch request is blocked on the recipient.
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({
          id: 'mail1',
          label: 'Mail-1',
          type: 'Server',
          templateId: 'tpl-mailserver',
          ip: '192.168.1.30',
        }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.2.10' }),
      ],
      [link('pc1', 'mail1'), link('mail1', 'pc2')]
    );
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('blocked');
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0].trace.verdict).toBe('success');
    expect(result.failureReason).toBe('fetch request: no default gateway configured on PC-2');
    // blocked where the fetch starts, on the recipient: no cable of the way leads there
    expect(result.animationPath).toEqual(['pc1', 'mail1', 'pc2']);
    expect(result.animationLinks).toEqual(['pc1--mail1', '']);
  });

  it('matches mail servers by type when no templateId is set', () => {
    const t = topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'mx', label: 'MX', type: 'Mail Server', ip: '192.168.1.30' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'mx'), link('mx', 'pc2')]
    );
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', t);
    expect(result.verdict).toBe('success');
    expect(result.legs[0].toId).toBe('mx');
  });
});

// ---------- email modes (internal / cloud / auto) ----------

describe('planAndEvaluateFlow email modes', () => {
  it('cloud mode goes through the internet exit with cloud purposes', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', cloudViaSwitch(), {
      emailMode: 'cloud',
    });
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP to cloud provider', 'pc1', 'gw1'],
      ['cloud fetch request', 'pc2', 'gw1'],
      ['cloud fetch reply', 'gw1', 'pc2'],
    ]);
    // (a device named for the exit stands for the provider, at its own address)
    expect(result.legs.map(l => l.trace.targetIp)).toEqual(['192.168.1.1', '192.168.1.1', '192.168.1.20']);
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'gw1', 'pc2', 'sw1', 'gw1', 'sw1', 'pc2']);
  });

  it('cloud mode errors when the network has no internet exit', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', sameSubnetViaSwitch(), {
      emailMode: 'cloud',
    });
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe(
      'no internet exit in the network — cloud email needs an Internet gateway or Cloud device'
    );
    expect(result.legs).toEqual([]);
    expect(result.animationPath).toEqual([]);
  });

  it('auto falls back to cloud email with a note when no mail server exists', () => {
    // Default options → 'auto': no mail server here, but Internet-GW exists.
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', cloudViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => l.purpose)).toEqual([
      'SMTP to cloud provider',
      'cloud fetch request',
      'cloud fetch reply',
    ]);
    expect(result.notes).toContain('no internal mail server: using cloud email via Internet-GW');
  });

  it('auto errors with the combined message when neither relay exists', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', sameSubnetViaSwitch());
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe(
      'no mail server and no internet exit — add a Mail Server device or an Internet/Cloud gateway (or set the email mode in the network settings)'
    );
    expect(result.legs).toEqual([]);
    expect(result.animationPath).toEqual([]);
  });

  it('internal mode ignores the internet exit', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', cloudViaSwitch(), {
      emailMode: 'internal',
    });
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe(
      'no mail server in the network — add a Mail Server device to deliver email'
    );
    expect(result.legs).toEqual([]);
  });

  it('cloud mode picks the internet exit with the fewest BFS hops from the source', () => {
    // gwFar is FIRST in device order but 3 hops away; gwNear is 1 hop.
    const t = topo(
      [
        device({ id: 'gwFar', label: 'ISP-Far', type: 'Router', ip: '192.168.1.5' }),
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'gwNear', label: 'Internet-Near', type: 'Router', ip: '192.168.1.1' }),
        device({ id: 'sw1', label: 'Switch-1', type: 'Switch', ip: '192.168.1.2' }),
        device({ id: 'sw2', label: 'Switch-2', type: 'Switch', ip: '192.168.1.3' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [
        link('pc1', 'gwNear'),
        link('pc1', 'sw1'),
        link('sw1', 'sw2'),
        link('sw2', 'gwFar'),
        link('gwNear', 'pc2'),
      ]
    );
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', t, { emailMode: 'cloud' });
    expect(result.verdict).toBe('success');
    expect(result.legs[0].toId).toBe('gwNear');
    // (and the recipient fetches from the exit nearest to it)
    expect(result.legs[1]).toMatchObject({ fromId: 'pc2', toId: 'gwNear' });
  });

  it('explicit internal mode with a mail server matches the default behavior', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', mailViaSwitch(), {
      emailMode: 'internal',
    });
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mail1'],
      ['fetch request', 'pc2', 'mail1'],
      ['fetch reply', 'mail1', 'pc2'],
    ]);
    expect(result.notes.some(n => n.includes('using cloud email'))).toBe(false);
  });

  it('sends a single leg when the target IS the internet exit in cloud mode', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'gw1', cloudViaSwitch(), {
      emailMode: 'cloud',
    });
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP to cloud provider', 'pc1', 'gw1'],
    ]);
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'gw1']);
  });
});

describe('planAndEvaluateFlow email: which device is the internet exit', () => {
  /** PC-1 — SW-1 — PC-2, and on SW-1 a device of `type` named `label` */
  function withDevice(label: string, type: string): Topology {
    return topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({ id: 'sw1', label: 'Switch-0', type: 'Switch', ip: '192.168.1.2' }),
        device({ id: 'other', label, type, ip: '192.168.1.1' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'sw1'), link('sw1', 'other'), link('sw1', 'pc2')]
    );
  }

  it.each([
    ['Display-1', 'PC'],
    ['Cloudy-Lab', 'Server'],
    ['Swan', 'Router'],
    ['Internetwork-Core', 'Router'],
  ])('is not a device whose name only holds the word inside another word: %s', (label, type) => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', withDevice(label, type), {
      emailMode: 'cloud',
    });
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe(
      'no internet exit in the network — cloud email needs an Internet gateway or Cloud device'
    );
  });

  it.each([
    ['ISP-Router', 'Router'],
    ['R-WAN', 'Router'],
    ['WAN1', 'Router'],
    ['Edge Internet', 'Firewall'],
  ])('is a device whose name has the word on its own, when no device is a Cloud: %s', (label, type) => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', withDevice(label, type), {
      emailMode: 'cloud',
    });
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.fromId, l.toId])).toEqual([
      ['pc1', 'other'],
      ['pc2', 'other'],
      ['other', 'pc2'],
    ]);
  });

  it('is a Cloud device by its kind, whatever its name', () => {
    const t = withDevice('Provider', 'Cloud');
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', t, { emailMode: 'cloud' });
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.fromId, l.toId])).toEqual([
      ['pc1', 'other'],
      ['pc2', 'other'],
      ['other', 'pc2'],
    ]);
  });
});

// ---------- round trips through a zone-bound firewall ----------

describe('planAndEvaluateFlow through a firewall with security zones', () => {
  /** PC-1 (trust side) — FW-1 — Server (untrust side), same subnet */
  function zonedFirewall(): Topology {
    return topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.1.10' }),
        device({
          id: 'fw1',
          label: 'FW-1',
          type: 'Firewall',
          ip: '192.168.1.1',
          ports: [
            { id: 1, enabled: true, securityZone: 'trust' },
            { id: 2, enabled: true, securityZone: 'untrust' },
          ],
        }),
        device({ id: 'srv', label: 'Server', type: 'Server', ip: '192.168.1.20' }),
      ],
      [link('pc1', 'fw1', { targetPort: 1 }), link('fw1', 'srv', { sourcePort: 2 })]
    );
  }

  // Firewalls keep state. Every link is bound to a port now, so the zone
  // table runs on real links: without this, any round trip that leaves
  // through an untrust port would be allowed out and denied on the way back.
  it.each(['ping', 'web', 'download'] as const)(
    '%s from trust to untrust: the reply to the allowed request passes',
    model => {
      const result = planAndEvaluateFlow(model, 'pc1', 'srv', zonedFirewall());

      expect(result.verdict).toBe('success');
      expect(result.legs.map(l => l.trace.verdict)).toEqual(['success', 'success']);
      expect(result.notes.some(n => n.endsWith('firewall policy: trust → untrust allowed'))).toBe(
        true
      );
      expect(
        result.notes.some(n =>
          n.endsWith('firewall policy: untrust → trust allowed (reply to an allowed flow)')
        )
      ).toBe(true);
    }
  );

  it('a flow STARTED from untrust towards trust is still denied, on its request leg', () => {
    const result = planAndEvaluateFlow('ping', 'srv', 'pc1', zonedFirewall());

    expect(result.verdict).toBe('blocked');
    expect(result.legs.map(l => [l.purpose, l.trace.verdict])).toEqual([['request', 'blocked']]);
    expect(result.failureReason).toBe('request: firewall policy on FW-1: untrust → trust denied');
  });

  it('a one-way trace from untrust to trust is a new flow: denied', () => {
    const trace = traceRoute('srv', 'pc1', zonedFirewall());

    expect(trace.verdict).toBe('blocked');
    expect(trace.failureReason).toBe('firewall policy on FW-1: untrust → trust denied');
  });
});

// ---------- the mailbox of a cloud provider ----------

describe('planAndEvaluateFlow email: the mailbox of a cloud provider', () => {
  /**
   * PC-1 — R-1 ═ Internet ─ VPS, and PC-2 behind R-1 too. R-1 does NAT on its
   * WAN port, 203.0.113.2/24; the Internet symbol has no address.
   */
  function outside(symbol: Partial<NetworkDevice> = {}): Topology {
    return topo(
      [
        device({ id: 'pc1', label: 'PC-1', ip: '192.168.10.11', gateway: '192.168.10.1' }),
        device({ id: 'pc2', label: 'PC-2', ip: '192.168.10.12', gateway: '192.168.10.1' }),
        device({
          id: 'r1',
          label: 'R-1',
          type: 'Router',
          ports: [
            { id: 1, enabled: true, ip: '192.168.10.1', subnet: '255.255.255.0' },
            { id: 2, enabled: true, ip: '203.0.113.2', subnet: '255.255.255.0', nat: true },
            { id: 3, enabled: true },
          ],
        }),
        device({ id: 'inet', label: 'Internet', type: 'Cloud', templateId: 'tpl-cloud', ...symbol }),
        device({ id: 'vps', label: 'VPS', type: 'Server', ip: '203.0.113.254', gateway: '203.0.113.2' }),
      ],
      [
        link('pc1', 'r1', { targetPort: 1 }),
        link('pc2', 'r1', { targetPort: 1 }),
        link('r1', 'inet', { sourcePort: 2 }),
        link('inet', 'vps'),
      ]
    );
  }

  it('is beyond an Internet symbol that has no address: an address of the outside nobody has', () => {
    const t = outside();
    const inet = t.devices.find(d => d.id === 'inet') as NetworkDevice;
    // the outside is 203.0.113.0/24, where R-1 faces the symbol; .254 is the VPS
    expect(cloudMailbox(inet, t)).toBe('203.0.113.253');
    const mail = planAndEvaluateFlow('email', 'pc1', 'pc2', t, { emailMode: 'cloud' });
    expect(mail.verdict).toBe('success');
    expect(mail.legs.map(l => [l.purpose, l.trace.targetIp, l.trace.seenSourceIp])).toEqual([
      ['SMTP to cloud provider', '203.0.113.253', '203.0.113.2'],
      ['cloud fetch request', '203.0.113.253', '203.0.113.2'],
      ['cloud fetch reply', '203.0.113.2', undefined],
    ]);
    // the symbol takes it, and what is beyond it is not simulated: the notes say so
    expect(mail.legs[0].trace.hops.map(h => [h.label, h.status])).toEqual([
      ['PC-1', 'forwarded'],
      ['R-1', 'forwarded'],
      ['Internet', 'delivered'],
    ]);
    expect(mail.notes).toContain('the cloud mailbox is beyond Internet, at 203.0.113.253: the provider is not simulated');
    expect(mail.notes).toContain(
      'SMTP to cloud provider: 203.0.113.253 is not in the drawing: Internet assumed to take the traffic'
    );
    // the reply that brings the mail is translated back by R-1
    expect(mail.legs[2].trace.reachedIp).toBe('192.168.10.12');
  });

  it('is in 192.0.2.0/24, kept for examples, when no public address is next to the symbol', () => {
    const t = outside();
    const unaddressed = topo(
      t.devices.map(d =>
        d.id === 'r1' ? { ...d, ports: d.ports?.map(p => (p.id === 2 ? { ...p, ip: '10.0.0.2' } : p)) } : d
      ).filter(d => d.id !== 'vps'),
      t.connections.filter(c => c.target !== 'vps')
    );
    expect(cloudMailbox(unaddressed.devices.find(d => d.id === 'inet') as NetworkDevice, unaddressed)).toBe(
      '192.0.2.254'
    );
  });

  it('does not move when something breaks: it is worked out from the drawing as it is set', () => {
    const t = outside();
    const inet = t.devices.find(d => d.id === 'inet') as NetworkDevice;
    const cut = withFailures(t, { devices: [], connections: ['r1--inet'] });
    expect(cloudMailbox(inet, cut)).toBe('203.0.113.253');
    const mail = planAndEvaluateFlow('email', 'pc1', 'pc2', cut, { emailMode: 'cloud' });
    expect(mail.verdict).toBe('blocked');
    expect(mail.failureReason).toMatch(/^SMTP to cloud provider: link R-1–Internet is down/);
  });

  it('is the address of a symbol that has one, and of a device named for the exit', () => {
    const t = outside({ ip: '203.0.113.200', subnet: '255.255.255.0' });
    const inet = t.devices.find(d => d.id === 'inet') as NetworkDevice;
    expect(cloudMailbox(inet, t)).toBeUndefined();
    expect(planAndEvaluateFlow('email', 'pc1', 'pc2', t, { emailMode: 'cloud' }).legs[0].trace.targetIp).toBe(
      '203.0.113.200'
    );
    expect(cloudMailbox(device({ id: 'x', label: 'ISP-Router', type: 'Router' }), t)).toBeUndefined();
  });

  it('is on the Internet: with an Internet symbol drawn, a Cloud of another name or a router named WAN is no exit', () => {
    const t = outside();
    const more = topo(
      [
        ...t.devices,
        device({ id: 'mpls', label: 'MPLS', type: 'Cloud', templateId: 'tpl-cloud' }),
        device({ id: 'wan', label: 'R-WAN', type: 'Router', ip: '192.168.10.2' }),
      ],
      [...t.connections, link('pc1', 'mpls'), link('pc1', 'wan')]
    );
    const mail = planAndEvaluateFlow('email', 'pc1', 'pc2', more, { emailMode: 'cloud' });
    expect(mail.legs.map(l => l.toId)).toEqual(['inet', 'inet', 'pc2']);
    expect(mail.verdict).toBe('success');
  });
});
