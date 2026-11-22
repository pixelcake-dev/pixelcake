/**
 * Breaking and repairing from the terminal: `fail`, `repair`, `show failures`.
 * The commands act on the failures of presentation mode, so the board, the
 * panel and the terminal always agree; outside it they do nothing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand } from './executor';
import type { TerminalContext } from './executor';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { setLanguage } from '@/i18n';
import { forgetImpacts } from '@/utils/impactMemo';
import { createRedundancySample } from '@/utils/sampleRedundancy';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();

/** What a command prints, line by line (a diagnostic's animated part included) */
function say(command: string, context: TerminalContext = { deviceLabel: null }): string[] {
  const result = executeCommand(command, context);
  const live = result.liveTrace;
  return [
    ...result.lines.map((l) => l.text),
    ...(live ? [...live.hopLines, ...live.finalLines].map((l) => l.text) : []),
  ];
}

const id = (label: string) => {
  const found = network().devices.find((d) => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};

const cable = (a: string, b: string) => {
  const [first, second] = [id(a), id(b)];
  const found = network().connections.find(
    (c) => (c.source === first && c.target === second) || (c.source === second && c.target === first)
  );
  if (!found) throw new Error(`no cable between "${a}" and "${b}"`);
  return found.id;
};

const PRESENT_FIRST =
  'failures are simulated in presentation mode: press "Present" in the menu bar, or choose View → "Presentation mode"';

beforeEach(() => {
  localStorage.clear();
  setLanguage('en');
  presentation().exit();
  forgetImpacts();
  const sample = createRedundancySample();
  network().clearAllDevices();
  network().loadTopology(sample.devices, sample.connections);
});

describe('fail and repair a device', () => {
  it('outside presentation mode they do nothing and say where failures are simulated', () => {
    for (const command of [
      'fail SW-Core',
      'repair SW-Core',
      'repair all',
      'fail link R-HQ to R-Branch',
      'show failures',
    ]) {
      expect(say(command), command).toEqual([PRESENT_FIRST]);
    }
    expect(presentation().failedDevices).toEqual([]);
    expect(presentation().failedConnections).toEqual([]);
  });

  it('says it in English even with the interface in Italian: the terminal speaks English', () => {
    setLanguage('it');
    expect(say('fail SW-Core')).toEqual([PRESENT_FIRST]);
  });

  it('breaks a device in presentation mode, in the words of the engine', () => {
    presentation().enter();
    expect(say('fail SW-Core')).toEqual(['SW-Core is down']);
    expect(presentation().failedDevices).toEqual([id('SW-Core')]);
  });

  it('is the very list the presentation panel shows', () => {
    presentation().enter();
    say('fail SW-Core');
    presentation().toggleDeviceFailure(id('Srv-File'));
    expect(say('repair Srv-File')).toEqual(['Srv-File is working again']);
    expect(presentation().failedDevices).toEqual([id('SW-Core')]);
  });

  it('says so, and changes nothing, for what is already down or not down', () => {
    presentation().enter();
    say('fail SW-Core');
    expect(say('fail SW-Core')).toEqual(['SW-Core is already down']);
    expect(presentation().failedDevices).toEqual([id('SW-Core')]);
    expect(say('repair SW-Floor-1')).toEqual(['SW-Floor-1 is not down']);
    expect(presentation().failedDevices).toEqual([id('SW-Core')]);
  });

  it('repairs a device', () => {
    presentation().enter();
    say('fail SW-Core');
    expect(say('repair SW-Core')).toEqual(['SW-Core is working again']);
    expect(presentation().failedDevices).toEqual([]);
  });

  it('gives the usual error for a name it does not know', () => {
    presentation().enter();
    expect(say('fail SW-Cor')).toEqual(['device not found: "SW-Cor"', '  did you mean "SW-Core"?']);
    expect(say('repair Nothing')[0]).toBe('device not found: "Nothing"');
    expect(presentation().failedDevices).toEqual([]);
  });

  it('works on the device of a `use` context when none is named', () => {
    presentation().enter();
    expect(say('fail', { deviceLabel: 'SW-Core' })).toEqual(['SW-Core is down']);
    expect(say('repair', { deviceLabel: 'SW-Core' })).toEqual(['SW-Core is working again']);
    expect(say('fail')).toEqual(['specify a device: "fail <device>"']);
  });

  it('finds a device by its address too, like any command', () => {
    presentation().enter();
    expect(say('fail 192.168.1.10')).toEqual(['Srv-File is down']);
  });

  it('does not touch the drawing, and is forgotten on leaving', () => {
    const before = JSON.stringify([network().devices, network().connections]);
    presentation().enter();
    say('fail SW-Core');
    say('fail link R-HQ to R-Branch');
    expect(JSON.stringify([network().devices, network().connections])).toBe(before);
    presentation().exit();
    expect(presentation().failedDevices).toEqual([]);
    expect(presentation().failedConnections).toEqual([]);
    expect(say('fail SW-Core')).toEqual([PRESENT_FIRST]);
  });
});

describe('fail and repair a link', () => {
  it('cuts the cable between two devices, in the words of the engine', () => {
    presentation().enter();
    expect(say('fail link R-HQ to R-Branch')).toEqual(['link R-HQ–R-Branch is down']);
    expect(presentation().failedConnections).toEqual([cable('R-HQ', 'R-Branch')]);
  });

  it('does not mind which end is named first, and the answer names them as typed', () => {
    presentation().enter();
    expect(say('fail link R-Branch to R-HQ')).toEqual(['link R-Branch–R-HQ is down']);
    expect(presentation().failedConnections).toEqual([cable('R-HQ', 'R-Branch')]);
    expect(say('fail link R-HQ to R-Branch')).toEqual(['link R-HQ–R-Branch is already down']);
  });

  it('repairs it, and says so when it was not cut', () => {
    presentation().enter();
    expect(say('repair link R-HQ to R-Branch')).toEqual(['link R-HQ–R-Branch is not down']);
    say('fail link R-HQ to R-Branch');
    expect(say('repair link R-HQ to R-Branch')).toEqual(['link R-HQ–R-Branch is working again']);
    expect(presentation().failedConnections).toEqual([]);
  });

  it('says so for a link that is not there', () => {
    presentation().enter();
    expect(say('fail link R-HQ to PC-Branch-1')).toEqual(['R-HQ and PC-Branch-1 are not connected']);
    expect(say('fail link R-HQ to R-HQ')).toEqual(['a link joins two different devices']);
    expect(say('fail link R-HQ to Nowhere')[0]).toBe('device not found: "Nowhere"');
    expect(presentation().failedConnections).toEqual([]);
  });

  it('with two cables between the same devices, says how to name each', () => {
    presentation().enter();
    network().addConnection({ source: id('SW-Core'), target: id('SW-Floor-1') });
    const first = say('fail link SW-Core to SW-Floor-1');
    expect(first[0]).toBe('2 links join SW-Core and SW-Floor-1: say which one by an interface of SW-Core');
    expect(first).toHaveLength(3);
    expect(first[1]).toMatch(/^ {2}fail link SW-Core to SW-Floor-1 by port \d+ {3}\[port \d+ ↔ port \d+\]$/);
    expect(presentation().failedConnections).toEqual([]);
    // (the same words for repair)
    expect(say('repair link SW-Core to SW-Floor-1')[1]).toContain('repair link SW-Core to SW-Floor-1 by port');
  });

  it('with two cables, `by` picks one, and the other stays up', () => {
    presentation().enter();
    network().addConnection({ source: id('SW-Core'), target: id('SW-Floor-1') });
    const [one, two] = network().connections.filter(
      (c) => [c.source, c.target].includes(id('SW-Core')) && [c.source, c.target].includes(id('SW-Floor-1'))
    );
    const portOf = (c: typeof one) => (c.source === id('SW-Core') ? c.sourcePort : c.targetPort);

    expect(say(`fail link SW-Core to SW-Floor-1 by ${portOf(two)}`)).toEqual(['link SW-Core–SW-Floor-1 is down']);
    expect(presentation().failedConnections).toEqual([two.id]);
    // the cut one is already down, the other is not
    expect(say(`fail link SW-Core to SW-Floor-1 by port ${portOf(two)}`)).toEqual([
      'link SW-Core–SW-Floor-1 is already down',
    ]);
    expect(say(`repair link SW-Core to SW-Floor-1 by ${portOf(one)}`)).toEqual([
      'link SW-Core–SW-Floor-1 is not down',
    ]);
    expect(say(`repair link SW-Core to SW-Floor-1 by ${portOf(two)}`)).toEqual([
      'link SW-Core–SW-Floor-1 is working again',
    ]);
    expect(presentation().failedConnections).toEqual([]);
  });

  it('refuses an interface that is not there, or that has no such cable', () => {
    presentation().enter();
    expect(say('fail link R-HQ to R-Branch by 99')[0]).toMatch(
      /^R-HQ has no interface "99" \(it has ports 1-\d+\)$/
    );
    expect(say('fail link R-HQ to R-Branch by 1')).toEqual(['no link between R-HQ and R-Branch on port 1']);
    expect(presentation().failedConnections).toEqual([]);
  });

  it('a cable that is cut is not a device that is down: they are two failures', () => {
    presentation().enter();
    say('fail link R-HQ to R-Branch');
    expect(say('repair R-HQ')).toEqual(['R-HQ is not down']);
    expect(presentation().failedConnections).toHaveLength(1);
  });
});

describe('repair all', () => {
  it('puts everything back, devices and cables', () => {
    presentation().enter();
    say('fail SW-Core');
    say('fail link R-HQ to R-Branch');
    expect(say('repair all')).toEqual(['everything is working again']);
    expect(presentation().failedDevices).toEqual([]);
    expect(presentation().failedConnections).toEqual([]);
  });

  it('says so when nothing is down', () => {
    presentation().enter();
    expect(say('repair all')).toEqual(['nothing is down']);
  });
});

describe('what a ping or a trace sees next', () => {
  it('a ping after `fail` is blocked at the device, and works again after `repair`', () => {
    presentation().enter();
    expect(say('ping Srv-File from PC-HQ-1').join('\n')).toContain('Reply from 192.168.1.10');
    say('fail SW-Core');
    expect(say('ping Srv-File from PC-HQ-1')).toContain('Ping failed (blocked): request: SW-Core is down');
    say('repair SW-Core');
    expect(say('ping Srv-File from PC-HQ-1').join('\n')).toContain('Reply from 192.168.1.10');
  });

  it('a trace after `fail link` takes the backup line and says why', () => {
    presentation().enter();
    say('fail link R-HQ to R-Branch');
    const lines = say('trace Srv-File from PC-Branch-1');
    expect(lines.some((line) => line.includes('R-Backup (Router)'))).toBe(true);
    expect(lines).toContain('Trace complete: destination reached.');
  });
});

describe('show failures', () => {
  it('says so when nothing is down', () => {
    presentation().enter();
    expect(say('show failures')).toEqual(['nothing is down']);
  });

  it('lists what is down, then what it does to the rest of the network', () => {
    presentation().enter();
    say('fail link R-HQ to R-Branch');
    expect(say('show failures')).toEqual([
      'FAILURES (1)',
      '  link R-HQ–R-Branch is down',
      'On the rest of the network',
      '  Ping between the 5 end devices: 20 exchanges that work without the failures.',
      '  None of them stop',
      '  12 take another path',
      '  8 do not change',
    ]);
  });

  it('counts the communications that stop when a device has no second way', () => {
    presentation().enter();
    say('fail SW-Core');
    say('fail link R-HQ to R-Branch');
    const lines = say('show failures');
    expect(lines.slice(0, 3)).toEqual(['FAILURES (2)', '  SW-Core is down', '  link R-HQ–R-Branch is down']);
    expect(lines).toContain('On the rest of the network');
    expect(lines.some((line) => /^ {2}\d+ stop$/.test(line))).toBe(true);
  });

  it('counts what stops, and what does not, for a device with no second way', () => {
    presentation().enter();
    say('fail Srv-File');
    expect(say('show failures')).toEqual([
      'FAILURES (1)',
      '  Srv-File is down',
      'On the rest of the network',
      '  Ping between the 5 end devices: 20 exchanges that work without the failures.',
      '  8 stop',
      '  12 do not change',
    ]);
  });

  it('follows the kind of exchange chosen in the presentation panel', () => {
    presentation().enter();
    presentation().setFlow('web');
    say('fail link R-HQ to R-Branch');
    expect(say('show failures').join('\n')).toContain('Web between the');
  });

  it('follows a repair', () => {
    presentation().enter();
    say('fail SW-Core');
    say('repair all');
    expect(say('show failures')).toEqual(['nothing is down']);
  });
});

describe('help and the unknown', () => {
  it('help lists the commands, and `help fail` finds them', () => {
    const all = say('help').join('\n');
    expect(all).toContain('fail <device> | fail link <A> to <B> [by <interface>]');
    expect(all).toContain('repair <device> | repair link <A> to <B> | repair all');
    expect(all).toContain('show failures');
    expect(say('help fail')[0]).toContain('fail <device>');
    expect(say('help repair')).toHaveLength(1);
  });

  it('a near miss of the verb is suggested', () => {
    expect(say('repiar SW-Core').join('\n')).toContain('repair');
  });
});
