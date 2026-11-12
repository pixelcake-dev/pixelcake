/**
 * The third sample network (two sites, a main and a backup line, a ring of
 * switches): its structure, and what happens when its parts break. If one of
 * these answers changes, either the engine or the sample is wrong.
 */

import { describe, it, expect } from 'vitest';
import { createRedundancySample } from './sampleRedundancy';
import { isValidIP, isValidMAC } from './ipHelpers';
import {
  assessImpact,
  boundInterface,
  formatNetwork,
  isVlanAware,
  normalizeBindings,
  planAndEvaluateFlow,
  routingTable,
  sanitizeBindings,
  withFailures,
} from '@/engine';
import type { Failures, FlowResult, ImpactedFlow } from '@/engine';
import type { NetworkDevice } from '@/types';

const sample = createRedundancySample();

function device(label: string): NetworkDevice {
  const found = sample.devices.find(d => d.label === label);
  if (!found) throw new Error(`sample has no device "${label}"`);
  return found;
}

const labelOf = (id: string) => sample.devices.find(d => d.id === id)?.label ?? id;

/** Failures by device label and by cable id */
const broken = (devices: string[] = [], connections: string[] = []): Failures => ({
  devices: devices.map(label => device(label).id),
  connections,
});

function ask(from: string, to: string, failures?: Failures): FlowResult {
  return planAndEvaluateFlow('ping', device(from).id, device(to).id, withFailures(sample, failures));
}

/** The devices of the first leg, by label */
const way = (result: FlowResult) => result.legs[0].trace.hops.map(h => h.label).join(' > ');

const pairs = (flows: ImpactedFlow[]) =>
  flows.map(flow => `${labelOf(flow.sourceId)} > ${labelOf(flow.targetId)}`).sort();

const table = (label: string) =>
  routingTable(device(label)).map(e => [formatNetwork(e.network), e.kind, e.nextHop ?? '-', e.out?.iface?.label]);

describe('createRedundancySample — structure', () => {
  it('is deterministic and its ids are unique', () => {
    expect(createRedundancySample()).toEqual(createRedundancySample());
    expect(sample.devices).toHaveLength(12);
    expect(sample.connections).toHaveLength(13);
    expect(new Set(sample.devices.map(d => d.id)).size).toBe(sample.devices.length);
    expect(new Set(sample.devices.map(d => d.label)).size).toBe(sample.devices.length);
    expect(new Set(sample.connections.map(c => c.id)).size).toBe(sample.connections.length);
  });

  it('has every link attached to an interface at both ends, with nothing to repair', () => {
    for (const connection of sample.connections) {
      const source = sample.devices.find(d => d.id === connection.source);
      const target = sample.devices.find(d => d.id === connection.target);
      expect(source && boundInterface(connection, source, 'source'), connection.id).toBeDefined();
      expect(target && boundInterface(connection, target, 'target'), connection.id).toBeDefined();
    }
    expect(sanitizeBindings(sample.devices, sample.connections)).toBe(sample.connections);
    expect(normalizeBindings(sample.devices, sample.connections)).toBe(sample.connections);
  });

  it('never plugs two cables into the same port or card', () => {
    const used = new Set<string>();
    for (const connection of sample.connections) {
      for (const end of ['source', 'target'] as const) {
        const owner = sample.devices.find(d => d.id === connection[end]);
        const iface = owner && boundInterface(connection, owner, end);
        const key = `${connection[end]}/${iface?.key}`;
        expect(used.has(key), key).toBe(false);
        used.add(key);
      }
    }
  });

  it('carries only valid addresses and MACs', () => {
    for (const d of sample.devices) {
      for (const ip of [d.ip, d.gateway, ...(d.ports ?? []).map(p => p.ip ?? '')]) {
        if (ip) expect(isValidIP(ip), `${d.label} ${ip}`).toBe(true);
      }
      for (const card of d.nics ?? []) {
        if (card.ip) expect(isValidIP(card.ip), `${d.label} ${card.name}`).toBe(true);
        expect(card.mac !== undefined && isValidMAC(card.mac), `${d.label} ${card.name}`).toBe(true);
      }
    }
  });

  it('has plain switches: this sample is about ways round, not about VLANs', () => {
    for (const label of ['SW-Core', 'SW-Piano-1', 'SW-Piano-2', 'SW-Filiale']) {
      expect(isVlanAware(device(label)), label).toBe(false);
    }
  });

  it('gives each site router two routes to the other site, main line first', () => {
    expect(table('R-Sede')).toEqual([
      ['10.0.0.0/30', 'connected', '-', 'port 2'],
      ['10.0.1.0/30', 'connected', '-', 'port 3'],
      ['192.168.1.0/24', 'connected', '-', 'port 1'],
      ['192.168.2.0/24', 'static', '10.0.0.2', 'port 2'],
      ['192.168.2.0/24', 'static', '10.0.1.2', 'port 3'],
    ]);
    expect(table('R-Filiale')).toEqual([
      ['10.0.0.0/30', 'connected', '-', 'port 2'],
      ['10.0.2.0/30', 'connected', '-', 'port 3'],
      ['192.168.2.0/24', 'connected', '-', 'port 1'],
      ['192.168.1.0/24', 'static', '10.0.0.1', 'port 2'],
      ['192.168.1.0/24', 'static', '10.0.2.1', 'port 3'],
    ]);
    expect(table('R-Riserva')).toEqual([
      ['10.0.1.0/30', 'connected', '-', 'port 1'],
      ['10.0.2.0/30', 'connected', '-', 'port 2'],
      ['192.168.1.0/24', 'static', '10.0.1.1', 'port 1'],
      ['192.168.2.0/24', 'static', '10.0.2.2', 'port 2'],
    ]);
  });
});

describe('createRedundancySample — with everything working', () => {
  it('every end device reaches every other, with nothing left to assume', () => {
    const report = assessImpact(sample, broken(), { flow: 'ping' });
    expect(report.endpoints.map(labelOf)).toEqual([
      'Srv-File',
      'PC-Sede-1',
      'PC-Sede-2',
      'PC-Filiale-1',
      'PC-Filiale-2',
    ]);
    expect(report.working).toBe(20);
    expect(report.unchanged).toBe(20);

    for (const from of report.endpoints) {
      for (const to of report.endpoints) {
        if (from === to) continue;
        expect(planAndEvaluateFlow('ping', from, to, sample).notes, `${labelOf(from)} > ${labelOf(to)}`).toEqual([]);
      }
    }
  });

  it('the branch reaches the file server over the main line', () => {
    const result = ask('PC-Filiale-1', 'Srv-File');
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('PC-Filiale-1 > SW-Filiale > R-Filiale > R-Sede > SW-Core > Srv-File');
    expect(result.animationLinks).toContain('link-principale');
  });

  it('a PC of the main site reaches the file server by the short side of the ring', () => {
    expect(way(ask('PC-Sede-1', 'Srv-File'))).toBe('PC-Sede-1 > SW-Piano-1 > SW-Core > Srv-File');
  });
});

describe('createRedundancySample — what happens if this breaks', () => {
  it('the main line: the two sites talk over the backup line, nothing is lost', () => {
    const failures = broken([], ['link-principale']);
    const result = ask('PC-Filiale-1', 'Srv-File', failures);
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('PC-Filiale-1 > SW-Filiale > R-Filiale > R-Riserva > R-Sede > SW-Core > Srv-File');
    expect(result.notes).toEqual([
      'request: R-Filiale: the route 192.168.1.0/24 via 10.0.0.1 is unusable (link R-Filiale–R-Sede is down), ' +
        'the route 192.168.1.0/24 via 10.0.2.1 is used instead',
      'reply: R-Sede: the route 192.168.2.0/24 via 10.0.0.2 is unusable (link R-Sede–R-Filiale is down), ' +
        'the route 192.168.2.0/24 via 10.0.1.2 is used instead',
    ]);

    const report = assessImpact(sample, failures, { flow: 'ping' });
    expect(report.broken).toEqual([]);
    // 3 end devices at the main site × 2 at the branch, both ways
    expect(report.rerouted).toHaveLength(12);
    expect(report.unchanged).toBe(8);
  });

  it('the backup router: no one notices while the main line works', () => {
    const report = assessImpact(sample, broken(['R-Riserva']), { flow: 'ping' });
    expect(report.broken).toEqual([]);
    expect(report.rerouted).toEqual([]);
    expect(report.unchanged).toBe(20);
  });

  it('both lines: the sites are cut off from each other, each still works inside', () => {
    const failures = broken([], ['link-principale', 'link-riserva-filiale']);
    const result = ask('PC-Sede-1', 'PC-Filiale-1', failures);
    expect(result.verdict).toBe('blocked');
    expect(result.failureReason).toBe('request: link R-Riserva–R-Filiale is down');

    const report = assessImpact(sample, failures, { flow: 'ping' });
    expect(report.broken).toHaveLength(12);
    expect(report.unchanged).toBe(8);
  });

  it('a cable of the ring: the floor goes round the other way', () => {
    const failures = broken([], ['link-core-piano-1']);
    const result = ask('PC-Sede-1', 'Srv-File', failures);
    expect(result.verdict).toBe('success');
    expect(way(result)).toBe('PC-Sede-1 > SW-Piano-1 > SW-Piano-2 > SW-Core > Srv-File');

    const report = assessImpact(sample, failures, { flow: 'ping' });
    expect(report.broken).toEqual([]);
    // everything PC-Sede-1 exchanges with what is beyond SW-Core
    expect(pairs(report.rerouted)).toEqual(
      [
        'PC-Sede-1 > Srv-File',
        'Srv-File > PC-Sede-1',
        'PC-Sede-1 > PC-Filiale-1',
        'PC-Filiale-1 > PC-Sede-1',
        'PC-Sede-1 > PC-Filiale-2',
        'PC-Filiale-2 > PC-Sede-1',
      ].sort()
    );
  });

  it('the core switch has no second way: only the two floors still see each other', () => {
    const failures = broken(['SW-Core']);
    expect(ask('PC-Sede-1', 'Srv-File', failures).failureReason).toBe('request: SW-Core is down');
    // the two floors are joined directly: they never went through the core
    expect(ask('PC-Sede-1', 'PC-Sede-2', failures)).toEqual(ask('PC-Sede-1', 'PC-Sede-2'));
    expect(way(ask('PC-Sede-1', 'PC-Sede-2', failures))).toBe('PC-Sede-1 > SW-Piano-1 > SW-Piano-2 > PC-Sede-2');

    const report = assessImpact(sample, failures, { flow: 'ping' });
    // the file server with the 4 others, the 2 PCs of the site with the 2 of the branch
    expect(report.broken).toHaveLength(16);
    expect(report.rerouted).toEqual([]);
    // the two floors between them, the two PCs of the branch between them
    expect(report.unchanged).toBe(4);
    expect(pairs(report.broken)).not.toContain('PC-Sede-1 > PC-Sede-2');
    expect(pairs(report.broken)).not.toContain('PC-Filiale-1 > PC-Filiale-2');
  });

  it('the router of a site: the site is alone, inside it everything goes on', () => {
    const report = assessImpact(sample, broken(['R-Filiale']), { flow: 'ping' });
    expect(report.broken).toHaveLength(12);
    expect(report.rerouted).toEqual([]);
    expect(report.unchanged).toBe(8);
    expect(ask('PC-Filiale-1', 'PC-Filiale-2', broken(['R-Filiale'])).verdict).toBe('success');
  });

  it('the file server: every exchange with it is lost, and only those', () => {
    const report = assessImpact(sample, broken(['Srv-File']), { flow: 'ping' });
    expect(report.broken).toHaveLength(8);
    expect(report.broken.every(flow => [flow.sourceId, flow.targetId].includes('srv-file'))).toBe(true);
    expect(report.unchanged).toBe(12);
  });

  it('the cable of one PC: that PC alone is cut off', () => {
    const report = assessImpact(sample, broken([], ['link-pc-sede-2']), { flow: 'ping' });
    expect(report.broken).toHaveLength(8);
    expect(report.broken.every(flow => [flow.sourceId, flow.targetId].includes('pc-sede-2'))).toBe(true);
  });
});
