import { describe, it, expect } from 'vitest';
import type { NetworkDevice, NetworkConnection } from '@/types';
import type { Topology } from './types';
import { planAndEvaluateFlow } from './flows';
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
  it('errors when source and target are the same device', () => {
    const result = planAndEvaluateFlow('ping', 'pc1', 'pc1', sameSubnetViaSwitch());
    expect(result.verdict).toBe('error');
    expect(result.failureReason).toBe('source and target are the same device');
    expect(result.legs).toEqual([]);
    expect(result.animationPath).toEqual([]);
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
  it('routes through the mail server on the happy path', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', mailViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mail1'],
      ['delivery', 'mail1', 'pc2'],
    ]);
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'mail1', 'sw1', 'pc2']);
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
    expect(result.legs[0].toId).toBe('mailNear');
    expect(result.legs[1].fromId).toBe('mailNear');
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

  it('sends a single delivery leg when the source IS the mail server', () => {
    const result = planAndEvaluateFlow('email', 'mail1', 'pc2', mailViaSwitch());
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['delivery', 'mail1', 'pc2'],
    ]);
  });

  it('includes hops up to the block when the delivery leg fails', () => {
    // Delivery leg crosses subnets but the mail server has no gateway and
    // there is no router: SMTP submit succeeds, delivery is blocked.
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
    expect(result.failureReason).toBe('delivery: no default gateway configured on Mail-1');
    expect(result.animationPath).toEqual(['pc1', 'mail1']); // blocked at mail1, joint deduped
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
  it('cloud mode relays through the internet exit with cloud purposes', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', cloudViaSwitch(), {
      emailMode: 'cloud',
    });
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP to cloud provider', 'pc1', 'gw1'],
      ['cloud delivery', 'gw1', 'pc2'],
    ]);
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'gw1', 'sw1', 'pc2']);
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
    expect(result.legs.map(l => l.purpose)).toEqual(['SMTP to cloud provider', 'cloud delivery']);
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
    expect(result.legs[1].fromId).toBe('gwNear');
  });

  it('explicit internal mode with a mail server matches the default behavior', () => {
    const result = planAndEvaluateFlow('email', 'pc1', 'pc2', mailViaSwitch(), {
      emailMode: 'internal',
    });
    expect(result.verdict).toBe('success');
    expect(result.legs.map(l => [l.purpose, l.fromId, l.toId])).toEqual([
      ['SMTP submit', 'pc1', 'mail1'],
      ['delivery', 'mail1', 'pc2'],
    ]);
    expect(result.animationPath).toEqual(['pc1', 'sw1', 'mail1', 'sw1', 'pc2']);
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
