/**
 * The terminal while presenting: a failure simulated on the canvas is there
 * for the commands too, so what is typed agrees with what is drawn; and the
 * packet a command sets off travels on the very cables the engine took.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand } from './executor';
import type { ExecutionResult } from './executor';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createRedundancySample } from '@/utils/sampleRedundancy';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();

const run = (command: string): ExecutionResult => executeCommand(command, { deviceLabel: null });

/** Everything a diagnostic ends up printing */
function transcript(command: string): string[] {
  const result = run(command);
  const live = result.liveTrace;
  return [
    ...result.lines.map(l => l.text),
    ...(live ? [...live.hopLines, ...live.finalLines].map(l => l.text) : []),
  ];
}

const id = (label: string) => {
  const found = network().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};

const cable = (a: string, b: string) => {
  const [first, second] = [id(a), id(b)];
  const found = network().connections.find(
    c => (c.source === first && c.target === second) || (c.source === second && c.target === first)
  );
  if (!found) throw new Error(`no cable between "${a}" and "${b}"`);
  return found.id;
};

beforeEach(() => {
  localStorage.clear();
  presentation().exit();
  const sample = createRedundancySample();
  network().clearAllDevices();
  network().loadTopology(sample.devices, sample.connections);
});

describe('terminal — simulated failures', () => {
  it('a ping sees a device that is down in the presentation', () => {
    expect(transcript('ping Srv-File from PC-Sede-1').join('\n')).toContain('Reply from 192.168.1.10');

    presentation().enter();
    presentation().toggleDeviceFailure(id('SW-Core'));

    const lines = transcript('ping Srv-File from PC-Sede-1');
    expect(lines).toContain('Ping failed (blocked): request: SW-Core is down');
    expect(lines).toContain('  dropped at: SW-Piano-1');
  });

  it('a trace takes the backup line when the main one is cut, and says why', () => {
    presentation().enter();
    presentation().toggleConnectionFailure(cable('R-Sede', 'R-Filiale'));

    const lines = transcript('trace Srv-File from PC-Filiale-1');
    expect(lines.some(line => line.includes('R-Riserva (Router)'))).toBe(true);
    expect(lines).toContain(
      '  note: R-Filiale: the route 192.168.1.0/24 via 10.0.0.1 is unusable (link R-Filiale–R-Sede is down), ' +
        'the route 192.168.1.0/24 via 10.0.2.1 is used instead'
    );
    expect(lines).toContain('Trace complete: destination reached.');
  });

  it('a whole exchange sees it too', () => {
    presentation().enter();
    presentation().toggleDeviceFailure(id('Srv-File'));

    expect(transcript('browse Srv-File from PC-Sede-1')).toContain(
      'Browse failed (blocked): HTTP request: Srv-File is down'
    );
  });

  it('once the presentation is over the failures are gone for the terminal as well', () => {
    presentation().enter();
    presentation().toggleDeviceFailure(id('SW-Core'));
    presentation().exit();

    expect(transcript('ping Srv-File from PC-Sede-1').join('\n')).toContain('Reply from 192.168.1.10');
  });

  it('failures left in the store do nothing outside presentation mode', () => {
    usePresentationStore.setState({ failedDevices: [id('SW-Core')] });
    expect(transcript('ping Srv-File from PC-Sede-1').join('\n')).toContain('Reply from 192.168.1.10');
    usePresentationStore.setState({ failedDevices: [] });
  });

  it('a configuration command still finds a device that is taken as down', () => {
    presentation().enter();
    presentation().toggleDeviceFailure(id('SW-Core'));

    const result = run('show interfaces on SW-Core');
    expect(result.lines.map(l => l.text).join('\n')).not.toContain('device not found');
    // and it never touches the list of failures
    expect(presentation().failedDevices).toEqual([id('SW-Core')]);
  });
});

describe('terminal — the cables of the animation', () => {
  it('a ping hands over the cables of both ways, one per stretch', () => {
    const live = run('ping Srv-File from PC-Sede-1').liveTrace;
    expect(live?.animationPath).toHaveLength(7);
    expect(live?.animationLinks).toEqual(
      [
        ['PC-Sede-1', 'SW-Piano-1'],
        ['SW-Piano-1', 'SW-Core'],
        ['SW-Core', 'Srv-File'],
        ['SW-Core', 'Srv-File'],
        ['SW-Piano-1', 'SW-Core'],
        ['PC-Sede-1', 'SW-Piano-1'],
      ].map(([a, b]) => cable(a, b))
    );
  });

  it('a trace hands over the cable each hop was reached by', () => {
    const live = run('trace Srv-File from PC-Sede-1').liveTrace;
    expect(live?.animationPath).toEqual(['PC-Sede-1', 'SW-Piano-1', 'SW-Core', 'Srv-File'].map(id));
    expect(live?.animationLinks).toEqual(
      [
        ['PC-Sede-1', 'SW-Piano-1'],
        ['SW-Piano-1', 'SW-Core'],
        ['SW-Core', 'Srv-File'],
      ].map(([a, b]) => cable(a, b))
    );
  });

  it('a whole exchange does too, and the list is as long as the path needs', () => {
    for (const command of ['browse Srv-File from PC-Filiale-1', 'download Srv-File from PC-Filiale-1']) {
      const live = run(command).liveTrace;
      expect(live?.animationLinks, command).toHaveLength((live?.animationPath.length ?? 0) - 1);
      expect(live?.animationLinks?.every(link => link !== ''), command).toBe(true);
    }
  });
});
