/**
 * The time in the terminal: what `ping` prints, the cable of every link in
 * `show connections`, and `link`, which sets the medium, the length and a
 * delay written by hand on the link between two devices. Parser and
 * executor, against the real stores loaded with the samples.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand } from './executor';
import type { ExecutionResult, TerminalContext } from './executor';
import { parse } from './parser';
import { useNetworkStore } from '@/store/networkStore';
import { setLanguage } from '@/i18n';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import type { SampleNetwork } from '@/utils/sampleNetwork';
import type { NetworkConnection } from '@/types';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const GLOBAL: TerminalContext = { deviceLabel: null };

/** Everything a command prints, in the order the terminal prints it */
function transcript(command: string): string[] {
  const result: ExecutionResult = executeCommand(command, GLOBAL);
  const live = result.liveTrace;
  return [
    ...result.lines,
    ...(live ? [...(live.lookup?.lines ?? []), ...live.hopLines, ...live.finalLines] : []),
  ].map((line) => line.text);
}

/** The line of an answer that says the time */
const reply = (command: string) => transcript(command).find((line) => line.startsWith('Reply from')) ?? transcript(command).join(' | ');

function load(sample: () => SampleNetwork) {
  setLanguage('en');
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  store.loadSample(sample());
}

/** The link between two devices, by their names */
function linkBetween(a: string, b: string): NetworkConnection {
  const { devices, connections } = useNetworkStore.getState();
  const id = (label: string) => devices.find((d) => d.label === label)!.id;
  const found = connections.find(
    (c) => (c.source === id(a) && c.target === id(b)) || (c.source === id(b) && c.target === id(a))
  );
  if (!found) throw new Error(`no link ${a} – ${b}`);
  return found;
}

describe('parse: link <A> to <B> …', () => {
  it('reads a medium, a length with its unit, a delay, in any order', () => {
    expect(parse('link R-HQ to R-Branch medium fibre length 600 km')).toEqual({
      kind: 'link-set',
      a: 'R-HQ',
      b: 'R-Branch',
      settings: [
        { what: 'medium', medium: 'fibre' },
        { what: 'length', metres: 600_000 },
      ],
    });
    expect(parse('link "Core Switch" to Edge Router delay 7 ms length 80m')).toEqual({
      kind: 'link-set',
      a: 'Core Switch',
      b: 'Edge Router',
      settings: [
        { what: 'delay', ms: 7 },
        { what: 'length', metres: 80 },
      ],
    });
  });

  it('leaves out "to" between two names of one word, as connect does', () => {
    expect(parse('link R1 R2 delay 0.5ms')).toEqual({ kind: 'link-set', a: 'R1', b: 'R2', settings: [{ what: 'delay', ms: 0.5 }] });
  });

  it('takes the instinctive names of a medium, and auto to work it out', () => {
    const medium = (word: string) => (parse(`link R1 R2 medium ${word}`) as { settings: unknown[] }).settings[0];
    expect(medium('fiber')).toEqual({ what: 'medium', medium: 'fibre' });
    expect(medium('Wi-Fi')).toEqual({ what: 'medium', medium: 'wifi' });
    expect(medium('4G')).toEqual({ what: 'medium', medium: 'mobile' });
    expect(medium('ethernet')).toEqual({ what: 'medium', medium: 'copper' });
    expect(medium('auto')).toEqual({ what: 'medium', medium: null });
  });

  it('clears a length with none and a delay with auto', () => {
    expect(parse('link R1 R2 length none delay auto')).toEqual({
      kind: 'link-set',
      a: 'R1',
      b: 'R2',
      settings: [
        { what: 'length', metres: null },
        { what: 'delay', ms: null },
      ],
    });
  });

  it('refuses what it cannot read, and says what it expected', () => {
    const hint = (input: string) => {
      const command = parse(input);
      return command.kind === 'unknown' ? command.suggestion : `parsed: ${JSON.stringify(command)}`;
    };
    expect(hint('link R1 R2')).toMatch(/^try: link <device A> to <device B>/);
    expect(hint('link R1 R2 medium banana')).toMatch(/^unknown medium "banana": copper, fibre, wifi/);
    expect(hint('link R1 R2 length 600')).toMatch(/^a length is written with its unit/);
    expect(hint('link R1 R2 length far km')).toMatch(/^"far" is not a length/);
    expect(hint('link R1 R2 delay soon')).toMatch(/^"soon" is not a delay/);
    expect(hint('link R1 R2 R3 medium fibre')).toMatch(/^write "to" between the two devices/);
    expect(hint('link R1 R2 medium fibre colour red')).toMatch(/^"colour" is not a setting of a link/);
  });
});

describe('ping prints the time of the request and of the reply', () => {
  beforeEach(() => load(createSampleTopology));

  it('under a millisecond on the office LAN, more through the router', () => {
    expect(reply('ping PC-2 from PC-1')).toBe('Reply from 192.168.10.12: hops=3 time=0.22ms');
    expect(reply('ping Web-01 from PC-1')).toBe('Reply from 192.168.20.10: hops=5 time=0.44ms');
  });

  it('a device that pings itself: the time of one end', () => {
    expect(reply('ping PC-1 from PC-1')).toBe('Reply from 192.168.10.11: hops=1 time=0.10ms');
  });

  it('a laptop on Wi-Fi takes the time of the air, without being told', () => {
    load(createCompanySample);
    expect(reply('ping Web-ERP from Laptop-1')).toBe('Reply from 192.168.30.30: hops=7 time=3.6ms');
    expect(reply('ping Web-ERP from PC-Sales')).toBe('Reply from 192.168.30.30: hops=6 time=0.46ms');
  });
});

describe('show connections: the cable of every link and its time, one way', () => {
  it('copper worked out on a drawing nobody set, what is set on the two sites', () => {
    load(createSampleTopology);
    expect(transcript('show connections of Router-1')).toEqual([
      'CONNECTIONS of Router-1 (2)',
      '  SW-Office ↔ Router-1  (uplink, 1 Gbps)  [port 8 ↔ port 1]  copper, automatic: 0.00ms',
      '  Router-1 ↔ SW-Servers  (uplink, 1 Gbps)  [port 2 ↔ port 8]  copper, automatic: 0.00ms',
    ]);
    load(createRedundancySample);
    expect(transcript('show connections of R-Backup')).toEqual([
      'CONNECTIONS of R-Backup (2)',
      '  R-HQ ↔ R-Backup  (uplink, 100 Mbps)  [port 3 ↔ port 1]  dsl: 8.0ms',
      '  R-Backup ↔ R-Branch  (uplink, 100 Mbps)  [port 2 ↔ port 3]  dsl: 8.0ms',
    ]);
    expect(transcript('show connections of R-HQ')).toContain(
      '  R-HQ ↔ R-Branch  (backbone, 1 Gbps)  [port 2 ↔ port 2]  fibre, 80 km: 0.40ms'
    );
  });
});

describe('link sets the cable of a link', () => {
  beforeEach(() => load(createRedundancySample));

  it('writes the medium and the length on the link, and says the time it takes now', () => {
    expect(transcript('link R-HQ to R-Branch medium fibre length 600 km')).toEqual([
      'R-HQ ↔ R-Branch: medium fibre, length 600 km',
      '  one way: 3.0ms (fibre, 600 km)',
    ]);
    expect(linkBetween('R-HQ', 'R-Branch')).toMatchObject({ medium: 'fibre', lengthM: 600_000 });
    expect(reply('ping PC-Branch-1 from PC-HQ-1')).toBe('Reply from 192.168.2.11: hops=7 time=6.7ms');
  });

  it('a delay written by hand takes the place of medium and length, and auto gives them back', () => {
    expect(transcript('link R-HQ to R-Branch delay 7 ms')).toEqual([
      'R-HQ ↔ R-Branch: delay 7.0ms written by hand',
      '  one way: 7.0ms (written by hand)',
    ]);
    expect(linkBetween('R-HQ', 'R-Branch').delayMs).toBe(7);
    expect(transcript('show connections of R-Branch')).toContain(
      '  R-HQ ↔ R-Branch  (backbone, 1 Gbps)  [port 2 ↔ port 2]  fibre, 80 km: 7.0ms written by hand'
    );
    expect(transcript('link R-HQ to R-Branch length 120 km')).toEqual([
      'R-HQ ↔ R-Branch: length 120 km',
      '  one way: 7.0ms (written by hand)',
      '  the delay written by hand takes the place of medium and length: "delay auto" to work them in',
    ]);
    expect(transcript('link R-HQ to R-Branch delay auto')).toEqual([
      'R-HQ ↔ R-Branch: delay worked out',
      '  one way: 0.60ms (fibre, 120 km)',
    ]);
    expect(linkBetween('R-HQ', 'R-Branch').delayMs).toBeUndefined();
  });

  it('auto and none take the medium and the length away', () => {
    expect(transcript('link R-Branch to R-HQ medium auto length none')).toEqual([
      'R-Branch ↔ R-HQ: medium automatic, no length',
      '  one way: 0.00ms (copper, automatic)',
    ]);
    const link = linkBetween('R-HQ', 'R-Branch');
    expect(link.medium).toBeUndefined();
    expect(link.lengthM).toBeUndefined();
  });

  it('changes the time and never the verdict: a satellite line is slow, and the packet still arrives', () => {
    const before = transcript('ping PC-Branch-1 from PC-HQ-1');
    executeCommand('link R-HQ to R-Branch medium satellite', GLOBAL);
    const after = transcript('ping PC-Branch-1 from PC-HQ-1');
    expect(after.filter((line) => !line.startsWith('Reply'))).toEqual(before.filter((line) => !line.startsWith('Reply')));
    expect(reply('ping PC-Branch-1 from PC-HQ-1')).toBe('Reply from 192.168.2.11: hops=7 time=561ms');
  });

  it('is one edit of the drawing, kept as the window keeps it', () => {
    const before = useNetworkStore.getState().connections;
    executeCommand('link R-HQ to R-Branch length 1.1 km', GLOBAL);
    const after = useNetworkStore.getState().connections;
    expect(after).not.toBe(before);
    // (a length is kept to the millimetre)
    expect(linkBetween('R-HQ', 'R-Branch').lengthM).toBe(1100);
  });

  it('refuses what it cannot set, and says why', () => {
    const before = useNetworkStore.getState().connections;
    expect(transcript('link PC-HQ-1 to PC-Branch-1 medium fibre')).toEqual([
      'PC-HQ-1 and PC-Branch-1 are not connected',
      '  connect them first: connect PC-HQ-1 to PC-Branch-1',
    ]);
    expect(transcript('link R-HQ to R-HQ medium fibre')).toEqual(['a link joins two devices: name the other end']);
    expect(transcript('link R-HQ to R-Branch length 0 m')).toEqual([
      'a cable is longer than 0 m, and at most 40000 km long: length 600 km, length 80 m',
    ]);
    expect(transcript('link R-HQ to R-Branch length 50000 km')).toEqual([
      'a cable is longer than 0 m, and at most 40000 km long: length 600 km, length 80 m',
    ]);
    expect(transcript('link R-HQ to R-Branch delay 20000')).toEqual([
      'a delay written on a link is from 0 to 10000 ms, one way',
    ]);
    expect(transcript('link R-HQ to R-Nowhere medium fibre')[0]).toBe('device not found: "R-Nowhere"');
    expect(useNetworkStore.getState().connections).toBe(before);
  });

  it('two devices joined by more than one cable: the window of the link says which', () => {
    load(createCompanySample);
    const before = useNetworkStore.getState().connections;
    expect(transcript('link Router-Core to SW-Core medium fibre')).toEqual([
      '2 links join Router-Core and SW-Core: the terminal cannot tell which one you mean',
      '  set it in the window of the link: right click on it, Edit link',
    ]);
    expect(useNetworkStore.getState().connections).toBe(before);
  });
});
