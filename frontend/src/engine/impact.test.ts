/**
 * Impact of failures: which exchanges between end devices stop working,
 * which take another way, which do not notice.
 */

import { describe, it, expect } from 'vitest';
import { device, host, link, nic, port, rule, switchWith, topo } from '@/test/networkFixtures';
import type { NetworkConnection, NetworkDevice } from '@/types';
import type { Failures, Topology } from './types';
import { withFailures } from './failures';
import {
  assessImpact,
  compareFlows,
  evaluateAllFlows,
  flowKey,
  impactEndpoints,
  sameWay,
} from './impact';
import type { ImpactedFlow } from './impact';
import { planAndEvaluateFlow } from './flows';

const broken = (devices: string[] = [], connections: string[] = []): Failures => ({ devices, connections });

const sw = (id: string, count = 4): NetworkDevice =>
  switchWith(id, Array.from({ length: count }, (_, i) => port(i + 1)));

const cable = (hostId: string, otherId: string, portId: number): NetworkConnection =>
  link(hostId, otherId, { sourceNic: 'nic-1', targetPort: portId });

const wire = (a: string, portA: number, b: string, portB: number, id?: string): NetworkConnection =>
  link(a, b, { sourcePort: portA, targetPort: portB, ...(id ? { id } : {}) });

const pairs = (flows: ImpactedFlow[]) => flows.map(flow => `${flow.sourceId}>${flow.targetId}`).sort();

/** pc1 ─ sw1 ═ sw2 ─ pc2 (two cables between the switches), pc3 on sw1 */
function office(): Topology {
  return topo(
    [host('pc1', '192.168.1.11'), host('pc2', '192.168.1.12'), host('pc3', '192.168.1.13'), sw('sw1'), sw('sw2')],
    [
      cable('pc1', 'sw1', 1),
      cable('pc3', 'sw1', 2),
      cable('pc2', 'sw2', 1),
      wire('sw1', 3, 'sw2', 3, 'up-a'),
      wire('sw1', 4, 'sw2', 4, 'up-b'),
    ]
  );
}

describe('impactEndpoints', () => {
  it('takes the end devices with a usable address, in drawing order', () => {
    const drawing = topo([
      host('pc1', '192.168.1.11'),
      sw('sw1'),
      device({ id: 'r1', type: 'Router', ip: '192.168.1.1' }),
      host('noip', ''),
      host('badip', '999.1.1.1'),
      host('srv', '192.168.1.20', '', { type: 'Server' }),
    ]);
    expect(impactEndpoints(drawing).map(d => d.id)).toEqual(['pc1', 'srv']);
  });

  it('takes the symbol of the outside world only when it has an address', () => {
    const bare = device({ id: 'net', type: 'Cloud', nics: [nic()] });
    const addressed = device({ id: 'cloud', type: 'Cloud', ip: '8.8.8.8', nics: [nic({ ip: '8.8.8.8' })] });
    expect(impactEndpoints(topo([bare, addressed])).map(d => d.id)).toEqual(['cloud']);
  });
});

describe('evaluateAllFlows', () => {
  it('evaluates every ordered pair of end devices, and nothing else', () => {
    const table = evaluateAllFlows(office(), { flow: 'ping' });
    expect([...table.keys()].sort()).toEqual(
      ['pc1>pc2', 'pc1>pc3', 'pc2>pc1', 'pc2>pc3', 'pc3>pc1', 'pc3>pc2'].sort()
    );
    expect(table.get(flowKey('pc1', 'pc2'))).toMatchObject({ sourceId: 'pc1', targetId: 'pc2' });
    expect(table.get(flowKey('pc1', 'pc2'))?.result).toEqual(planAndEvaluateFlow('ping', 'pc1', 'pc2', office()));
  });

  it('is empty with fewer than two end devices', () => {
    expect(evaluateAllFlows(topo([host('pc1', '192.168.1.11'), sw('sw1')]), { flow: 'ping' }).size).toBe(0);
  });
});

describe('assessImpact', () => {
  it('counts nothing as touched when nothing is broken', () => {
    const report = assessImpact(office(), broken(), { flow: 'ping' });
    expect(report).toEqual({
      endpoints: ['pc1', 'pc2', 'pc3'],
      working: 6,
      broken: [],
      rerouted: [],
      unchanged: 6,
    });
  });

  it('a cable with a twin: nothing breaks, what crossed it takes the twin', () => {
    const report = assessImpact(office(), broken([], ['up-a']), { flow: 'ping' });
    expect(report.working).toBe(6);
    expect(report.broken).toEqual([]);
    expect(pairs(report.rerouted)).toEqual(['pc1>pc2', 'pc2>pc1', 'pc2>pc3', 'pc3>pc2']);
    expect(report.unchanged).toBe(2);
    expect(report.rerouted[0].after.animationLinks).toContain('up-b');
  });

  it('the twin that carried nothing: no one notices', () => {
    const report = assessImpact(office(), broken([], ['up-b']), { flow: 'ping' });
    expect(report.broken).toEqual([]);
    expect(report.rerouted).toEqual([]);
    expect(report.unchanged).toBe(6);
  });

  it('a switch that is down: what hangs off it is cut off, the rest goes on', () => {
    const report = assessImpact(office(), broken(['sw2']), { flow: 'ping' });
    expect(pairs(report.broken)).toEqual(['pc1>pc2', 'pc2>pc1', 'pc2>pc3', 'pc3>pc2']);
    expect(report.rerouted).toEqual([]);
    expect(report.unchanged).toBe(2);
    const lost = report.broken.find(flow => flow.sourceId === 'pc1');
    expect(lost?.after.failureReason).toBe('request: sw2 is down');
    // the cut-off device itself cannot even start
    const fromCutOff = report.broken.find(flow => flow.sourceId === 'pc2');
    expect(fromCutOff?.after.failureReason).toBe('request: sw2 is down');
  });

  it('an end device that is down: every exchange with it is lost, both ways', () => {
    const report = assessImpact(office(), broken(['pc3']), { flow: 'ping' });
    expect(pairs(report.broken)).toEqual(['pc1>pc3', 'pc2>pc3', 'pc3>pc1', 'pc3>pc2']);
    expect(report.unchanged).toBe(2);
  });

  it('adds up: working = broken + rerouted + unchanged', () => {
    for (const failures of [broken(['sw1']), broken([], ['up-a', 'up-b']), broken(['pc1'], ['up-a'])]) {
      const report = assessImpact(office(), failures, { flow: 'ping' });
      expect(report.broken.length + report.rerouted.length + report.unchanged).toBe(report.working);
    }
  });

  it('does not count what did not work to begin with', () => {
    // pc3 sits in another network with no router: it never reached anybody
    const drawing = office();
    const alone: Topology = {
      ...drawing,
      devices: drawing.devices.map(d => (d.id === 'pc3' ? host('pc3', '10.0.0.5') : d)),
    };
    const intact = assessImpact(alone, broken(), { flow: 'ping' });
    expect(intact.working).toBe(2);

    const report = assessImpact(alone, broken(['pc3']), { flow: 'ping' });
    expect(report.working).toBe(2);
    expect(report.broken).toEqual([]);
    expect(report.unchanged).toBe(2);
  });

  it('looks at the kind of exchange asked for: a firewall may pass web and not ping', () => {
    const drawing = topo(
      [
        host('out', '203.0.113.50', '203.0.113.1'),
        host('web', '172.16.0.10', '172.16.0.1', { type: 'Server' }),
        device({
          id: 'fw',
          type: 'Firewall',
          ports: [
            port(1, { ip: '203.0.113.1', subnet: '255.255.255.0', securityZone: 'untrust' }),
            port(2, { ip: '172.16.0.1', subnet: '255.255.255.0', securityZone: 'dmz' }),
          ],
          firewallRules: [rule('allow', 'web', 'untrust', 'dmz')],
        }),
      ],
      [cable('out', 'fw', 1), cable('web', 'fw', 2)]
    );
    // ping: only dmz → untrust is allowed by the zones; web: both
    expect(assessImpact(drawing, broken(), { flow: 'ping' }).working).toBe(1);
    expect(assessImpact(drawing, broken(), { flow: 'web' }).working).toBe(2);
    expect(pairs(assessImpact(drawing, broken(['fw']), { flow: 'web' }).broken)).toEqual(['out>web', 'web>out']);
  });

  it('accepts a table computed before, and gives the same report', () => {
    const drawing = office();
    const before = evaluateAllFlows(drawing, { flow: 'ping' });
    const failures = broken(['sw2']);
    expect(assessImpact(drawing, failures, { flow: 'ping' }, before)).toEqual(
      assessImpact(drawing, failures, { flow: 'ping' })
    );
  });

  it('ignores failures already in the topology it is given: the baseline is the intact drawing', () => {
    const already = withFailures(office(), broken(['sw2']));
    const report = assessImpact(already, broken(['sw2']), { flow: 'ping' });
    expect(report.working).toBe(6);
    expect(report.broken).toHaveLength(4);
  });
});

describe('sameWay / compareFlows', () => {
  it('tells two ways apart by their cables, not only by their devices', () => {
    const intact = planAndEvaluateFlow('ping', 'pc1', 'pc2', office());
    const detour = planAndEvaluateFlow('ping', 'pc1', 'pc2', withFailures(office(), broken([], ['up-a'])));
    expect(detour.animationPath).toEqual(intact.animationPath);
    expect(sameWay(intact, intact)).toBe(true);
    expect(sameWay(intact, detour)).toBe(false);
  });

  it('leaves out an exchange the second table does not hold', () => {
    const drawing = office();
    const before = evaluateAllFlows(drawing, { flow: 'ping' });
    const after = new Map(before);
    after.delete(flowKey('pc1', 'pc2'));
    expect(compareFlows(drawing, before, after).working).toBe(5);
  });
});
