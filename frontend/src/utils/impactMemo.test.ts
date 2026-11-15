/**
 * The effect of failures, worked out once for the panel of the presentation
 * and the export window: the same answers as the engine, never worked out
 * twice for the same drawing, failures and kind of exchange.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { assessImpact } from '@/engine';
import type { Failures } from '@/engine';
import { createRedundancySample } from './sampleRedundancy';
import { baselineOf, forgetImpacts, impactOf } from './impactMemo';

const sample = createRedundancySample();
const drawing = { devices: sample.devices, connections: sample.connections };
const cut = (...connections: string[]): Failures => ({ devices: [], connections });

beforeEach(() => forgetImpacts());

describe('impactOf', () => {
  it('answers as the engine does', () => {
    for (const failures of [cut('link-principale'), cut('link-principale', 'link-riserva-filiale'), { devices: ['sw-core'], connections: [] }]) {
      expect(impactOf(drawing, failures, { flow: 'ping' })).toEqual(assessImpact(drawing, failures, { flow: 'ping' }));
    }
    expect(impactOf(drawing, cut('link-principale'), { flow: 'web' })).toEqual(
      assessImpact(drawing, cut('link-principale'), { flow: 'web' })
    );
  });

  it('works it out once for the same drawing, failures and kind of exchange, as the export window asks after the panel', () => {
    const first = impactOf(drawing, cut('link-principale', 'link-riserva-filiale'), { flow: 'ping' });
    // the same failures in another order, one twice, the drawing in another wrapper: the same report
    const again = impactOf(
      { devices: sample.devices, connections: sample.connections },
      cut('link-riserva-filiale', 'link-principale', 'link-principale'),
      { flow: 'ping', emailMode: 'auto' }
    );
    expect(again).toBe(first);
    // another kind of exchange, other failures: a report of their own
    expect(impactOf(drawing, cut('link-principale', 'link-riserva-filiale'), { flow: 'web' })).not.toBe(first);
    expect(impactOf(drawing, cut('link-principale'), { flow: 'ping' })).not.toBe(first);
    // and the intact drawing is evaluated once for each kind of exchange
    expect(baselineOf(drawing, { flow: 'ping' })).toBe(baselineOf(drawing, { flow: 'ping' }));
    expect(baselineOf(drawing, { flow: 'web' })).not.toBe(baselineOf(drawing, { flow: 'ping' }));
  });

  it('a drawing changed is another drawing: its effect is worked out again', () => {
    const before = impactOf(drawing, cut('link-principale'), { flow: 'ping' });
    // (the store makes new arrays when anything changes: here, the backup router gone)
    const changed = {
      devices: sample.devices.filter((device) => device.id !== 'r-riserva'),
      connections: sample.connections.filter((connection) => connection.source !== 'r-riserva' && connection.target !== 'r-riserva'),
    };
    const after = impactOf(changed, cut('link-principale'), { flow: 'ping' });
    expect(after).not.toBe(before);
    expect(after).toEqual(assessImpact(changed, cut('link-principale'), { flow: 'ping' }));
    expect(after.broken.length).toBeGreaterThan(0);
    expect(before.broken).toEqual([]);
  });

  it('keeps the last few reports only', () => {
    const cables = sample.connections.map((connection) => connection.id);
    const first = impactOf(drawing, cut(cables[0]), { flow: 'ping' });
    for (const id of cables.slice(1, 9)) impactOf(drawing, cut(id), { flow: 'ping' });
    expect(impactOf(drawing, cut(cables[8]), { flow: 'ping' })).toBe(impactOf(drawing, cut(cables[8]), { flow: 'ping' }));
    // the first is the oldest of nine: forgotten, and worked out again the same
    const again = impactOf(drawing, cut(cables[0]), { flow: 'ping' });
    expect(again).not.toBe(first);
    expect(again).toEqual(first);
  });
});
