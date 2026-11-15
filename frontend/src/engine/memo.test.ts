/**
 * What the engine works out once for all the pairs of a drawing (./memo)
 * never answers for another drawing: after each change a person can make,
 * the answers of an evaluation of every pair are those of each pair asked
 * alone, outside any memo, on the drawing as it is now. Each change is made
 * as the store makes it (new objects: here even inside one memo kept from
 * before the change) and in place (the same objects changed: a new
 * evaluation, a new memo).
 */

import { describe, it, expect } from 'vitest';
import type { FlowModelType, NetworkConnection, NetworkDevice } from '@/types';
import { createCompanySample } from '@/utils/sampleCompany';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { createMemo, withMemo } from './memo';
import { evaluateAllFlows, evaluateFlowInto, flowPairs } from './impact';
import type { FlowTable } from './impact';
import { planAndEvaluateFlow } from './flows';
import { withFailures } from './failures';
import type { EngineMemo } from './memo';
import type { Topology } from './types';

const FLOWS: FlowModelType[] = ['ping', 'web'];

/** Every answer of the drawing, each pair asked alone with no memo: what is true now */
function alone(topo: Topology): string[] {
  return FLOWS.flatMap((flow) =>
    flowPairs(topo).map(([s, t]) => `${flow} ${s}>${t} ${JSON.stringify(planAndEvaluateFlow(flow, s, t, topo))}`)
  );
}

/** Every answer of the drawing as one evaluation of all the pairs gives it, inside `memo` */
function together(topo: Topology, memo: EngineMemo): string[] {
  return withMemo(memo, () =>
    FLOWS.flatMap((flow) => {
      const table: FlowTable = new Map();
      for (const pair of flowPairs(topo)) evaluateFlowInto(table, topo, { flow }, pair);
      return [...table.values()].map((entry) => `${flow} ${entry.sourceId}>${entry.targetId} ${JSON.stringify(entry.result)}`);
    })
  );
}

/** The same through evaluateAllFlows, which opens a memo of its own */
function evaluated(topo: Topology): string[] {
  return FLOWS.flatMap((flow) =>
    [...evaluateAllFlows(topo, { flow }).values()].map(
      (entry) => `${flow} ${entry.sourceId}>${entry.targetId} ${JSON.stringify(entry.result)}`
    )
  );
}

const drawing = (): Topology => {
  const sample = createCompanySample();
  return { devices: sample.devices, connections: sample.connections };
};

/** A device changed as the store changes it: a new object, in a new list */
function changed(topo: Topology, id: string, change: (device: NetworkDevice) => NetworkDevice): Topology {
  return { ...topo, devices: topo.devices.map((device) => (device.id === id ? change(device) : device)) };
}

const device = (topo: Topology, id: string) => topo.devices.find((one) => one.id === id)!;

/**
 * Each change: the drawing before, the drawing after as the store makes it,
 * and the same change made in place on a drawing of its own
 */
const CHANGES: Array<[string, () => Topology, (before: Topology) => Topology, (topo: Topology) => void]> = [
  [
    'an address edited',
    drawing,
    (before) =>
      changed(before, 'db-gestionale', (one) => ({
        ...one,
        ip: '192.168.99.20',
        nics: one.nics!.map((nic, index) => (index === 0 ? { ...nic, ip: '192.168.99.20' } : nic)),
      })),
    (topo) => {
      const one = device(topo, 'db-gestionale');
      one.ip = '192.168.99.20';
      one.nics![0].ip = '192.168.99.20';
    },
  ],
  [
    'a cable added',
    () => {
      const topo = drawing();
      return { ...topo, connections: topo.connections.filter((c) => c.id !== 'link-pc-vendite') };
    },
    (before) => ({ ...before, connections: [...before.connections, drawing().connections.find((c) => c.id === 'link-pc-vendite')!] }),
    (topo) => {
      topo.connections.push(drawing().connections.find((c) => c.id === 'link-pc-vendite') as NetworkConnection);
    },
  ],
  [
    'a cable taken away',
    drawing,
    (before) => ({ ...before, connections: before.connections.filter((c) => c.id !== 'link-trunk-uffici') }),
    (topo) => {
      topo.connections.splice(topo.connections.findIndex((c) => c.id === 'link-trunk-uffici'), 1);
    },
  ],
  [
    'a cable cut (a simulated failure)',
    drawing,
    (before) => withFailures(before, { devices: [], connections: ['link-trunk-uffici'] }),
    (topo) => {
      topo.failures = { devices: [], connections: ['link-trunk-uffici'] };
    },
  ],
  [
    'a port disabled',
    drawing,
    (before) =>
      changed(before, 'sw-uffici', (one) => ({
        ...one,
        ports: one.ports!.map((port) => (port.id === 1 ? { ...port, enabled: false } : port)),
      })),
    (topo) => {
      device(topo, 'sw-uffici').ports!.find((port) => port.id === 1)!.enabled = false;
    },
  ],
  [
    'a rule added to the firewall',
    drawing,
    (before) =>
      changed(before, 'fw-edge', (one) => ({
        ...one,
        firewallRules: [
          { id: 'rule-0', action: 'deny', service: 'any', source: 'any', destination: 'any' },
          ...(one.firewallRules ?? []),
        ],
      })),
    (topo) => {
      device(topo, 'fw-edge').firewallRules!.unshift({ id: 'rule-0', action: 'deny', service: 'any', source: 'any', destination: 'any' });
    },
  ],
  [
    'a failure added, then taken away',
    drawing,
    (before) => withFailures(before, { devices: ['router-core'], connections: [] }),
    (topo) => {
      topo.failures = { devices: ['router-core'], connections: [] };
    },
  ],
];

describe('the memo of an evaluation never answers for another drawing', () => {
  it.each(CHANGES)('%s, as the store makes it: one memo for both drawings', (_, before, after) => {
    const a = before();
    const b = after(a);
    const memo = createMemo();
    const truthA = alone(a);
    const truthB = alone(b);
    // (the change is one that changes answers: otherwise the test would prove nothing)
    expect(truthB).not.toEqual(truthA);
    // before, after, and before again, in the one memo
    expect(together(a, memo)).toEqual(truthA);
    expect(together(b, memo)).toEqual(truthB);
    expect(together(a, memo)).toEqual(truthA);
    // and as the effect of a failure asks it
    expect(evaluated(b)).toEqual(truthB);
  });

  it.each(CHANGES)('%s, in place: the next evaluation sees it', (_, before, __, inPlace) => {
    const topo = before();
    const first = evaluated(topo);
    expect(first).toEqual(alone(topo));
    inPlace(topo);
    const second = evaluated(topo);
    expect(second).toEqual(alone(topo));
    expect(second).not.toEqual(first);
  });

  it('a failure taken away: the drawing answers again as with nothing broken, in the same memo', () => {
    const topo = drawing();
    const memo = createMemo();
    const intact = together(topo, memo);
    const broken = together(withFailures(topo, { devices: ['router-core'], connections: [] }), memo);
    expect(broken).not.toEqual(intact);
    expect(together(withFailures(topo, undefined), memo)).toEqual(intact);
    expect(together(withFailures(topo, { devices: [], connections: [] }), memo)).toEqual(intact);
  });

  it('one set of failures, then another, in the same memo: each answers for itself', () => {
    const sample = createRedundancySample();
    const topo = { devices: sample.devices, connections: sample.connections };
    const memo = createMemo();
    const main = withFailures(topo, { devices: [], connections: ['link-principale'] });
    const backup = withFailures(topo, { devices: [], connections: ['link-riserva-filiale'] });
    const both = withFailures(topo, { devices: [], connections: ['link-principale', 'link-riserva-filiale'] });
    for (const broken of [main, backup, both, main]) {
      expect(together(broken, memo)).toEqual(alone(broken));
    }
    expect(alone(main)).not.toEqual(alone(backup));
    expect(alone(both)).not.toEqual(alone(main));
  });

  it('outside a memo nothing is kept: a question asked alone reads the drawing as it is', () => {
    const topo = drawing();
    const before = planAndEvaluateFlow('ping', 'pc-contabilita', 'db-gestionale', topo);
    device(topo, 'db-gestionale').nics![0].ip = '192.168.99.20';
    device(topo, 'db-gestionale').ip = '192.168.99.20';
    const after = planAndEvaluateFlow('ping', 'pc-contabilita', 'db-gestionale', topo);
    expect(after).not.toEqual(before);
  });
});
