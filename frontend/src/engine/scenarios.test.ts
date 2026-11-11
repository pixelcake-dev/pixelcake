/**
 * Acceptance scenarios for the interface-level model, run against the sample
 * network (utils/sampleTopology.ts):
 *
 *   PC-1, PC-2 — SW-Office — Router-1 — SW-Servers — Web-01, Mail-01
 *   192.168.10.0/24 (gw .10.1 = Router-1 port 1) | 192.168.20.0/24 (gw .20.1 = port 2)
 *
 * Scenarios 1–7 are written once and run twice: on the sample as built, and
 * on the sample after a YAML export/import round trip (scenario 8), which
 * must give the same verdicts and the same reasons. Scenario 9 covers data
 * saved before interfaces could be bound or addressed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NetworkConnection, NetworkDevice, NetworkInterfaceCard, Port } from '@/types';
import type { Topology } from './types';
import type { FlowResult } from './flows';
import { planAndEvaluateFlow } from './flows';
import { boundInterface, isEndBound, normalizeBindings } from './interfaces';
import { createSampleTopology } from '@/utils/sampleTopology';
import { generateYaml } from '@/utils/exportYaml';
import { parseYamlTopology } from '@/utils/importYaml';
import { useNetworkStore } from '@/store/networkStore';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

// ---------- helpers (everything addresses devices by LABEL, so the same
// scenario runs on topologies whose ids differ, e.g. after an import) ----------

function device(topo: Topology, label: string): NetworkDevice {
  const found = topo.devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}" in the topology`);
  return found;
}

function editDevice(
  topo: Topology,
  label: string,
  edit: (d: NetworkDevice) => NetworkDevice
): Topology {
  const target = device(topo, label);
  return {
    devices: topo.devices.map(d => (d === target ? edit(d) : d)),
    connections: topo.connections,
  };
}

function editNic(
  topo: Topology,
  label: string,
  nicName: string,
  patch: Partial<NetworkInterfaceCard>
): Topology {
  return editDevice(topo, label, d => ({
    ...d,
    nics: (d.nics ?? []).map(n => (n.name === nicName ? { ...n, ...patch } : n)),
  }));
}

function editPort(topo: Topology, label: string, portId: number, patch: Partial<Port>): Topology {
  return editDevice(topo, label, d => ({
    ...d,
    ports: (d.ports ?? []).map(p => (p.id === portId ? { ...p, ...patch } : p)),
  }));
}

function flow(
  model: 'ping' | 'web' | 'email',
  topo: Topology,
  from: string,
  to: string,
  options?: { emailMode: 'internal' | 'cloud' | 'auto' }
): FlowResult {
  return planAndEvaluateFlow(model, device(topo, from).id, device(topo, to).id, topo, options);
}

const ping = (topo: Topology, from: string, to: string) => flow('ping', topo, from, to);

/** Labels of the hops of one leg, in order */
const hopLabels = (result: FlowResult, leg: number): string[] =>
  result.legs[leg].trace.hops.map(h => h.label);

/** The hop where the flow was dropped */
function blockedHop(result: FlowResult) {
  return result.legs.flatMap(l => l.trace.hops).find(h => h.status === 'blocked');
}

/** Device labels along the animation path */
function animationLabels(result: FlowResult, topo: Topology): string[] {
  return result.animationPath.map(id => topo.devices.find(d => d.id === id)?.label ?? id);
}

/** "PC-1 eth0 ↔ SW-Office port 1" for every link */
function linkTable(topo: Topology): string[] {
  const end = (connection: NetworkConnection, which: 'source' | 'target') => {
    const dev = topo.devices.find(d => d.id === connection[which]);
    if (!dev) return '?';
    return `${dev.label} ${boundInterface(connection, dev, which)?.label ?? 'unbound'}`;
  };
  return topo.connections.map(c => `${end(c, 'source')} ↔ ${end(c, 'target')}`);
}

/** Export to YAML and import back, the way "Importa (sostituisci)" loads it */
function yamlRoundTrip(topo: Topology): Topology {
  const result = parseYamlTopology(generateYaml(topo.devices, topo.connections, 'Sample'));
  expect(result.warnings).toEqual([]);
  return {
    devices: result.devices,
    connections: normalizeBindings(result.devices, result.connections),
  };
}

const REQUEST_PATH = ['PC-1', 'SW-Office', 'Router-1', 'SW-Servers', 'Web-01'];

// ---------- scenarios 1–7 ----------

function describeScenarios(title: string, load: () => Topology) {
  describe(title, () => {
    it('1. ping PC-1 → PC-2 succeeds on the office LAN', () => {
      const topo = load();
      const result = ping(topo, 'PC-1', 'PC-2');
      expect(result.verdict).toBe('success');
      expect(hopLabels(result, 0)).toEqual(['PC-1', 'SW-Office', 'PC-2']);
      expect(hopLabels(result, 1)).toEqual(['PC-2', 'SW-Office', 'PC-1']);
      expect(result.notes).toEqual([]);
    });

    it('2. ping PC-1 ↔ Web-01 succeeds both ways, routed at Router-1, nothing unverified', () => {
      const topo = load();

      const out = ping(topo, 'PC-1', 'Web-01');
      expect(out.verdict).toBe('success');
      expect(hopLabels(out, 0)).toEqual(REQUEST_PATH);
      expect(hopLabels(out, 1)).toEqual([...REQUEST_PATH].reverse());
      for (const leg of out.legs) {
        const routerHop = leg.trace.hops.find(h => h.label === 'Router-1');
        expect(routerHop?.status).toBe('forwarded');
        expect(routerHop?.note).toContain('routed between subnets');
      }
      expect(out.notes.filter(n => n.includes('no port binding'))).toEqual([]);
      // one router, addressed and bound end to end: no assumption left to note
      expect(out.notes).toEqual([]);

      const back = ping(topo, 'Web-01', 'PC-1');
      expect(back.verdict).toBe('success');
      expect(hopLabels(back, 0)).toEqual([...REQUEST_PATH].reverse());
      expect(back.notes).toEqual([]);
    });

    it('3a. web PC-1 → Web-01 succeeds', () => {
      const topo = load();
      const result = flow('web', topo, 'PC-1', 'Web-01');
      expect(result.verdict).toBe('success');
      expect(result.legs.map(l => l.purpose)).toEqual(['HTTP request', 'HTTP response']);
      expect(result.notes).toEqual([]);
    });

    it('3b. email PC-1 → PC-2 in internal mode is relayed by Mail-01', () => {
      const topo = load();
      const result = flow('email', topo, 'PC-1', 'PC-2', { emailMode: 'internal' });
      expect(result.verdict).toBe('success');
      expect(
        result.legs.map(l => [
          l.purpose,
          topo.devices.find(d => d.id === l.fromId)?.label,
          topo.devices.find(d => d.id === l.toId)?.label,
        ])
      ).toEqual([
        ['SMTP submit', 'PC-1', 'Mail-01'],
        ['delivery', 'Mail-01', 'PC-2'],
      ]);
      expect(animationLabels(result, topo)).toEqual([
        'PC-1',
        'SW-Office',
        'Router-1',
        'SW-Servers',
        'Mail-01',
        'SW-Servers',
        'Router-1',
        'SW-Office',
        'PC-2',
      ]);
    });

    describe('4. PC-1 gateway changed to 192.168.10.254', () => {
      const WRONG = '192.168.10.254';
      const variants: Array<[string, (t: Topology) => Topology]> = [
        // The Inspector edits the NIC and leaves the device-level mirror alone
        ['on eth0 only (Inspector)', t => editNic(t, 'PC-1', 'eth0', { gateway: WRONG })],
        [
          'on eth0 and on the device (terminal)',
          t =>
            editDevice(editNic(t, 'PC-1', 'eth0', { gateway: WRONG }), 'PC-1', d => ({
              ...d,
              gateway: WRONG,
            })),
        ],
      ];

      it.each(variants)('%s: blocked at PC-1, naming both addresses', (_name, change) => {
        const topo = change(load());
        const result = ping(topo, 'PC-1', 'Web-01');

        expect(result.verdict).toBe('blocked');
        expect(result.failureReason).toBe(
          'request: PC-1 uses gateway 192.168.10.254, but Router-1 port 1 on its network is 192.168.10.1'
        );
        expect(result.legs).toHaveLength(1);
        expect(result.legs[0].trace.hops.map(h => [h.label, h.status])).toEqual([
          ['PC-1', 'blocked'],
        ]);

        // the wrong gateway only matters when leaving the subnet
        expect(ping(topo, 'PC-1', 'PC-2').verdict).toBe('success');
      });
    });

    it('5. Router-1 port 2 disabled: PC-1 → Web-01 is blocked at Router-1', () => {
      const topo = editPort(load(), 'Router-1', 2, { enabled: false });
      const result = ping(topo, 'PC-1', 'Web-01');

      expect(result.verdict).toBe('blocked');
      expect(result.failureReason).toBe('request: port 2 on Router-1 is disabled');
      expect(blockedHop(result)?.label).toBe('Router-1');
      expect(result.legs[0].trace.hops.map(h => [h.label, h.status])).toEqual([
        ['PC-1', 'forwarded'],
        ['SW-Office', 'forwarded'],
        ['Router-1', 'blocked'],
      ]);
      // the office LAN does not go through that port
      expect(ping(topo, 'PC-1', 'PC-2').verdict).toBe('success');
    });

    it('6. Web-01 eth0 disabled: PC-1 → Web-01 is blocked, naming eth0 and Web-01', () => {
      const topo = editNic(load(), 'Web-01', 'eth0', { enabled: false });
      const result = ping(topo, 'PC-1', 'Web-01');

      expect(result.verdict).toBe('blocked');
      expect(result.failureReason).toBe('request: interface eth0 on Web-01 is disabled');
      expect(blockedHop(result)?.label).toBe('Web-01');
      expect(hopLabels(result, 0)).toEqual(REQUEST_PATH);

      // and Web-01 cannot send through its disabled NIC either
      const fromServer = ping(topo, 'Web-01', 'PC-1');
      expect(fromServer.verdict).toBe('blocked');
      expect(fromServer.failureReason).toBe('request: interface eth0 on Web-01 is disabled');
      expect(blockedHop(fromServer)?.label).toBe('Web-01');
    });

    describe('7. Web-01 gateway removed', () => {
      const variants: Array<[string, (t: Topology) => Topology]> = [
        ['on eth0 only (Inspector)', t => editNic(t, 'Web-01', 'eth0', { gateway: '' })],
        [
          'on eth0 and on the device',
          t =>
            editDevice(editNic(t, 'Web-01', 'eth0', { gateway: '' }), 'Web-01', d => ({
              ...d,
              gateway: '',
            })),
        ],
      ];

      it.each(variants)('%s: the request arrives, the reply has no way back', (_name, change) => {
        const topo = change(load());
        const result = ping(topo, 'PC-1', 'Web-01');

        expect(result.verdict).toBe('blocked');
        expect(result.legs.map(l => [l.purpose, l.trace.verdict])).toEqual([
          ['request', 'success'],
          ['reply', 'blocked'],
        ]);
        expect(result.failureReason).toBe('reply: no default gateway configured on Web-01');
        expect(blockedHop(result)?.label).toBe('Web-01');
      });
    });
  });
}

describeScenarios('sample network', () => createSampleTopology());

// ---------- scenario 8 ----------

describe('8. YAML export → import of the sample network', () => {
  it('brings back the same links on the same interfaces, with nothing to repair', () => {
    const original = createSampleTopology();
    const result = parseYamlTopology(
      generateYaml(original.devices, original.connections, 'Sample')
    );

    expect(result.warnings).toEqual([]);
    expect(linkTable(result)).toEqual(linkTable(original));
    expect(linkTable(result).some(row => row.includes('unbound'))).toBe(false);
    // already complete and valid: loading it changes nothing
    expect(normalizeBindings(result.devices, result.connections)).toBe(result.connections);
  });
});

describeScenarios('sample network after a YAML export → import round trip (scenario 8)', () =>
  yamlRoundTrip(createSampleTopology())
);

// ---------- scenario 9 ----------

describe('9. data saved before interfaces could be bound or addressed', () => {
  /** The sample as an older version would have stored it: no bindings, no port addresses */
  function oldFormatSample(): Topology {
    const { devices, connections } = createSampleTopology();
    return {
      devices: devices.map(d => ({
        ...d,
        ports: d.ports?.map(p => {
          const old: Port = { ...p };
          delete old.ip;
          delete old.subnet;
          return old;
        }),
      })),
      connections: connections.map(c => {
        const old: NetworkConnection = { ...c };
        delete old.sourcePort;
        delete old.targetPort;
        delete old.sourceNic;
        delete old.targetNic;
        return old;
      }),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    useNetworkStore.getState().clearAllDevices();
  });

  it('the fixture really is unbound and unaddressed', () => {
    const old = oldFormatSample();
    expect(old.connections.some(c => isEndBound(c, 'source') || isEndBound(c, 'target'))).toBe(
      false
    );
    expect(old.devices.flatMap(d => d.ports ?? []).some(p => p.ip !== undefined)).toBe(false);
  });

  it('still loads, gets every link bound and pings across the router with a "gateway not verified" note', () => {
    const old = oldFormatSample();

    useNetworkStore.getState().loadTopology(old.devices, old.connections);
    const { devices, connections } = useNetworkStore.getState();
    const topo: Topology = { devices, connections };

    // loaded as is: same devices, same links
    expect(devices.map(d => d.label)).toEqual(old.devices.map(d => d.label));
    expect(connections).toHaveLength(old.connections.length);

    // every link end now sits on its own interface
    const table = linkTable(topo);
    expect(table.some(row => row.includes('unbound'))).toBe(false);
    const claimed = table.flatMap(row => row.split(' ↔ '));
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(table).toEqual([
      'PC-1 eth0 ↔ SW-Office port 1',
      'PC-2 eth0 ↔ SW-Office port 2',
      'SW-Office port 3 ↔ Router-1 port 1',
      'Router-1 port 2 ↔ SW-Servers port 1',
      'Web-01 eth0 ↔ SW-Servers port 2',
      'Mail-01 eth0 ↔ SW-Servers port 3',
    ]);

    // cross-subnet ping works as before, and says what it could not check
    const result = ping(topo, 'PC-1', 'Web-01');
    expect(result.verdict).toBe('success');
    expect(hopLabels(result, 0)).toEqual(REQUEST_PATH);
    expect(result.notes).toEqual([
      'request: Router-1 has no interface addresses: gateway not verified',
      'reply: Router-1 has no interface addresses: gateway not verified',
    ]);
    expect(result.notes.some(n => n.includes('no port binding'))).toBe(false);
  });

  it('a wrong gateway is not caught on old data (nothing to verify it against), but a missing one still is', () => {
    const old = oldFormatSample();
    const loaded: Topology = {
      devices: old.devices,
      connections: normalizeBindings(old.devices, old.connections),
    };

    const wrong = editNic(loaded, 'PC-1', 'eth0', { gateway: '192.168.10.254' });
    const unverified = ping(wrong, 'PC-1', 'Web-01');
    expect(unverified.verdict).toBe('success');
    expect(unverified.notes).toContain(
      'request: Router-1 has no interface addresses: gateway not verified'
    );

    const missing = editNic(loaded, 'PC-1', 'eth0', { gateway: '' });
    const blocked = ping(missing, 'PC-1', 'Web-01');
    expect(blocked.verdict).toBe('blocked');
    expect(blocked.failureReason).toBe('request: no default gateway configured on PC-1');
  });
});
