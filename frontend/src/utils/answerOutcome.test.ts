/**
 * Where an answer of the engine ends on the canvas: the device that answers,
 * or the one the question stops on. Asked of the engine itself, on the
 * sample with two sites.
 */

import { describe, it, expect } from 'vitest';
import { planAndEvaluateFlow, traceToDevice, withFailures } from '@/engine';
import type { Topology } from '@/engine';
import { createRedundancySample } from './sampleRedundancy';
import { flowOutcome, traceOutcome } from './answerOutcome';

const sample = createRedundancySample();
const intact: Topology = { devices: sample.devices, connections: sample.connections };
const id = (label: string) => {
  const found = intact.devices.find((device) => device.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};
/** The drawing with these devices taken as broken */
const without = (...labels: string[]) => withFailures(intact, { devices: labels.map(id), connections: [] });

describe('flowOutcome', () => {
  it('a ping that arrives ends on the device that answered, not on the one the reply comes back to', () => {
    const answer = planAndEvaluateFlow('ping', id('PC-Filiale-1'), id('Srv-File'), intact);
    expect(answer.verdict).toBe('success');
    // (the packet itself ends its round trip where it started)
    expect(answer.animationPath.at(-1)).toBe(id('PC-Filiale-1'));

    expect(flowOutcome(answer, 'ping')).toEqual({ arrives: true, deviceId: id('Srv-File') });
  });

  it('a page that arrives ends on the server it was asked of', () => {
    const answer = planAndEvaluateFlow('web', id('PC-Sede-1'), id('Srv-File'), intact);
    expect(answer.verdict).toBe('success');

    expect(flowOutcome(answer, 'web')).toEqual({ arrives: true, deviceId: id('Srv-File') });
  });

  it('one that does not arrive ends on the device it was dropped on', () => {
    const answer = planAndEvaluateFlow('ping', id('PC-Filiale-1'), id('Srv-File'), without('SW-Core'));
    expect(answer.verdict).not.toBe('success');

    // (a broken device is where the packet stops for the one before it)
    expect(flowOutcome(answer, 'ping')).toEqual({ arrives: false, deviceId: id('R-Sede') });
  });

  it('one that stops on the way back ends where the reply was dropped', () => {
    const there = planAndEvaluateFlow('ping', id('PC-Sede-1'), id('Srv-File'), intact);
    // the same answer, with its reply dropped on the first device after the server
    const back = there.legs[1];
    const hops = back.trace.hops.slice(0, 2).map((hop, index) =>
      index === 1 ? { ...hop, status: 'blocked' as const } : hop
    );
    const answer = {
      ...there,
      verdict: 'blocked' as const,
      legs: [there.legs[0], { ...back, trace: { ...back.trace, verdict: 'blocked' as const, hops } }],
    };

    expect(flowOutcome(answer, 'ping')).toEqual({ arrives: false, deviceId: hops[1].deviceId });
    expect(hops[1].deviceId).not.toBe(id('Srv-File'));
  });

  it('a mail that arrives ends on who it was written to: the last leg, not the first', () => {
    const arrived = { verdict: 'success' as const, hops: [], notes: [] };
    const mail = {
      verdict: 'success' as const,
      legs: [
        { fromId: 'pc', toId: 'mail', purpose: 'SMTP submit', trace: arrived },
        { fromId: 'mail', toId: 'laptop', purpose: 'delivery', trace: arrived },
      ],
      animationPath: ['pc', 'mail', 'laptop'],
      animationLinks: ['', ''],
      notes: [],
    };

    expect(flowOutcome(mail, 'email')).toEqual({ arrives: true, deviceId: 'laptop' });
    // (the same two legs read as a page would end on the first)
    expect(flowOutcome(mail, 'web')).toEqual({ arrives: true, deviceId: 'mail' });
  });

  it('is nothing for an answer with no leg, or one that failed without a device to say it of', () => {
    const empty = { verdict: 'error' as const, legs: [], animationPath: [], animationLinks: [], notes: [] };
    expect(flowOutcome(empty, 'ping')).toBeNull();

    const nowhere = {
      ...empty,
      legs: [{ fromId: 'a', toId: 'b', purpose: 'request', trace: { verdict: 'error' as const, hops: [], notes: [] } }],
    };
    expect(flowOutcome(nowhere, 'ping')).toBeNull();
  });
});

describe('traceOutcome', () => {
  it('a trace that arrives ends on its last device', () => {
    const { trace } = traceToDevice(id('PC-Filiale-1'), id('Srv-File'), intact);
    expect(trace.verdict).toBe('success');

    expect(traceOutcome(trace)).toEqual({ arrives: true, deviceId: id('Srv-File') });
  });

  it('one that is dropped ends on the device that dropped it', () => {
    const { trace } = traceToDevice(id('PC-Filiale-1'), id('Srv-File'), without('SW-Core'));

    expect(traceOutcome(trace)).toEqual({ arrives: false, deviceId: id('R-Sede') });
  });

  it('one that stops on the very device it starts from ends there', () => {
    const pc = intact.devices.find((device) => device.label === 'PC-Sede-1')!;
    const unplugged: Topology = {
      ...intact,
      devices: intact.devices.map((device) =>
        device.id === pc.id ? { ...pc, nics: pc.nics?.map((nic) => ({ ...nic, enabled: false })) } : device
      ),
    };
    const { trace } = traceToDevice(pc.id, id('Srv-File'), unplugged);

    expect(trace.hops).toHaveLength(1);
    expect(traceOutcome(trace)).toEqual({ arrives: false, deviceId: pc.id });
  });

  it('is nothing for a trace that went nowhere', () => {
    expect(traceOutcome({ verdict: 'error', hops: [], notes: [] })).toBeNull();
    // (a last device that is neither where it arrived nor where it was dropped)
    const { trace } = traceToDevice(id('PC-Filiale-1'), id('Srv-File'), intact);
    expect(traceOutcome({ ...trace, verdict: 'blocked' })).toBeNull();
  });
});
