/**
 * The effect of failures, worked out once for the panel of the presentation
 * and the export window: the same answers as the engine, never worked out
 * twice for the same drawing, failures and kind of exchange.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { assessImpact } from '@/engine';
import type { Failures } from '@/engine';
import { createRedundancySample } from './sampleRedundancy';
import { baselineOf, forgetImpacts, impactOf, knownImpact, stopImpactWork, workOutImpact } from './impactMemo';
import { createMultinationalSample } from './sampleMultinational';

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

/* ── the same, a slice at a time, the page going on between two slices ── */

// (a slice of no time at all: one pair at a time, many slices even on a small drawing)
const SLICES = { sliceMs: 0 };
const ping = { flow: 'ping' as const };
const main = cut('link-principale');
const backup = cut('link-riserva-filiale');

describe('workOutImpact', () => {
  it('gives the report the engine gives in one go, and keeps it for the panel and the picture alike', async () => {
    const report = await workOutImpact(drawing, main, ping, SLICES);
    expect(report).toEqual(assessImpact(drawing, main, ping));
    expect(knownImpact(drawing, main, ping)).toBe(report);
    expect(impactOf(drawing, main, ping)).toBe(report);
  });

  it('asked twice for the same thing, it is worked out once', async () => {
    const first = workOutImpact(drawing, main, ping, SLICES);
    const second = workOutImpact(drawing, cut('link-principale', 'link-principale'), ping, SLICES);
    expect(second).toBe(first);
    expect(await second).toBe(await first);
  });

  it('another failure asked for stops the work for the first, which is never kept', async () => {
    const first = workOutImpact(drawing, main, ping, SLICES);
    const second = workOutImpact(drawing, backup, ping, SLICES);
    expect(await first).toBeNull();
    expect(await second).toEqual(assessImpact(drawing, backup, ping));
    expect(knownImpact(drawing, main, ping)).toBeUndefined();
    expect(knownImpact(drawing, backup, ping)).toBe(await second);
  });

  it('so does another kind of exchange, another drawing, or nothing broken any more', async () => {
    const asPing = workOutImpact(drawing, main, ping, SLICES);
    const asWeb = workOutImpact(drawing, main, { flow: 'web' }, SLICES);
    expect(await asPing).toBeNull();
    // (the drawing changed: the store gives it new lists)
    const changed = { devices: [...drawing.devices], connections: [...drawing.connections] };
    const onChanged = workOutImpact(changed, main, ping, SLICES);
    expect(await asWeb).toBeNull();
    stopImpactWork();
    expect(await onChanged).toBeNull();
    expect(knownImpact(drawing, main, { flow: 'web' })).toBeUndefined();
    expect(knownImpact(changed, main, ping)).toBeUndefined();
  });

  it('a result that comes late never stands for what is asked now', async () => {
    // the first finishes, then the second is asked and is still being worked out
    const first = await workOutImpact(drawing, main, ping, SLICES);
    const second = workOutImpact(drawing, backup, ping, SLICES);
    // what is known now is the first for the first, and nothing yet for the second
    expect(knownImpact(drawing, main, ping)).toBe(first);
    expect(knownImpact(drawing, backup, ping)).toBeUndefined();
    const report = await second;
    expect(report).not.toEqual(first);
    expect(knownImpact(drawing, backup, ping)).toBe(report);
    expect(knownImpact(drawing, main, ping)).toBe(first);
  });

  it('on the multinational, the page is given back every few milliseconds, and the report is the one of the engine', async () => {
    const large = createMultinationalSample();
    const topo = { devices: large.devices, connections: large.connections };
    const failures = cut(large.connections.find((c) => c.source === 'r-mi-wan' && c.target === 'r-rm')!.id);
    // a timer that should run every millisecond: how long it ever waits is how long the page is held
    let last = performance.now();
    let longest = 0;
    const ticker = setInterval(() => {
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
    }, 1);
    try {
      const report = await workOutImpact(topo, failures, ping);
      expect(report).not.toBeNull();
      expect({ working: report!.working, broken: report!.broken.length, rerouted: report!.rerouted.length }).toEqual({
        working: 14891,
        broken: 0,
        rerouted: 4422,
      });
    } finally {
      clearInterval(ticker);
    }
    // (slices of 8 ms; a generous bound, for a busy machine)
    expect(longest).toBeLessThan(250);
  }, 120_000);
});
