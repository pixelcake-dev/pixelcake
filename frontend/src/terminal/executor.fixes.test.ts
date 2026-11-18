/**
 * Small terminal fixes of 0.9.1: the mask of `set subnet` is checked, a
 * rename inside `use` is followed, `show interfaces` says the security zone,
 * a route that is already there says so, `show config` has no trailing
 * spaces, a name is never taken twice, and a name two devices share is
 * refused instead of silently taking the first.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand } from './executor';
import type { ExecutionResult, TerminalContext } from './executor';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import type { NetworkDevice } from '@/types';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const GLOBAL: TerminalContext = { deviceLabel: null };

const run = (command: string, context: TerminalContext = GLOBAL): ExecutionResult =>
  executeCommand(command, context);
const output = (command: string, context: TerminalContext = GLOBAL): string[] =>
  run(command, context).lines.map(l => l.text);
const device = (label: string): NetworkDevice => {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

function addPc(label: string, ip: string): void {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    templateId: 'tpl-pc',
    label,
    ip,
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
  });
}

function addFirewall(label: string): void {
  useNetworkStore.getState().addDevice({
    type: 'Firewall',
    templateId: 'tpl-firewall',
    label,
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    portCount: 4,
    ports: [1, 2, 3, 4].map(id => ({ id, enabled: true, speed: 'auto', portType: 'lan' })),
  });
}

beforeEach(() => {
  localStorage.clear();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createSampleTopology();
  store.loadTopology(sample.devices, sample.connections);
});

describe('set subnet', () => {
  it('refuses text that is not a mask and writes nothing', () => {
    const before = device('PC-1').subnet;
    expect(output('set subnet of PC-1 to banana')).toEqual([
      '"banana" is not a valid subnet mask',
      '  write it as 255.255.255.0 or as /24',
    ]);
    expect(device('PC-1').subnet).toBe(before);
    expect(output('set subnet of PC-1 to 255.0.255.0')[0]).toBe('"255.0.255.0" is not a valid subnet mask');
  });

  it('takes a dotted mask and a /prefix', () => {
    expect(output('set subnet of PC-1 to 255.255.0.0')).toEqual(['PC-1: subnet set to 255.255.0.0']);
    expect(device('PC-1').nics?.[0].subnet).toBe('255.255.0.0');
    expect(output('set subnet of PC-1 to /25')).toEqual(['PC-1: subnet set to 255.255.255.128']);
    expect(device('PC-1').subnet).toBe('255.255.255.128');
  });
});

describe('a rename inside use', () => {
  it('moves the context to the new name', () => {
    const inside: TerminalContext = { deviceLabel: 'PC-1' };
    const result = run('set name Desk', inside);
    expect(result.lines.map(l => l.text)).toEqual(['PC-1 renamed to "Desk"']);
    expect(result.context).toEqual({ deviceLabel: 'Desk' });
    expect(output('show ip', result.context)[0]).toContain('Desk');
  });

  it('leaves the context alone when another device is renamed', () => {
    const inside: TerminalContext = { deviceLabel: 'PC-1' };
    expect(run('set name of PC-2 to Desk', inside).context).toEqual(inside);
  });
});

describe('show interfaces — security zone', () => {
  it('says the zone of a firewall port, and - where there is none', () => {
    addFirewall('FW-1');
    run('interface 1 zone trust on FW-1');
    run('interface 2 zone untrust on FW-1');
    const rows = output('show interfaces FW-1').slice(1).map(r => r.trim().split(/\s+/));
    expect(rows.map(r => r[5])).toEqual(['trust', 'untrust', '-', '-']);
  });

  it('keeps the mode of a switch port', () => {
    const row = output('show interfaces SW-Office')[1].trim().split(/\s+/);
    expect(['access', 'trunk']).toContain(row[5]);
  });
});

describe('a route that is already there', () => {
  it('says nothing changed', () => {
    run('add route 192.168.30.0/24 via 192.168.20.10 on Router-1');
    const routes = device('Router-1').routes;
    expect(output('add route 192.168.30.0/24 via 192.168.20.10 on Router-1')[0]).toBe(
      'Router-1: route to 192.168.30.0/24 via 192.168.20.10 is already there, nothing changed'
    );
    expect(device('Router-1').routes).toEqual(routes);
  });
});

describe('show config', () => {
  it('has no space at the end of a line', () => {
    for (const label of ['PC-1', 'Router-1', 'SW-Office', 'Web-01']) {
      for (const text of output(`show config ${label}`)) expect(text).toBe(text.trimEnd());
    }
  });
});

describe('set name — a name is taken once', () => {
  it('refuses the name of another device, in any case', () => {
    expect(output('set name of PC-1 to pc-2')).toEqual([
      'the name "pc-2" is taken by another device: choose another one',
    ]);
    expect(device('PC-1').label).toBe('PC-1');
  });

  it('allows the case of its own name to change', () => {
    expect(output('set name of PC-1 to pc-1')).toEqual(['PC-1 renamed to "pc-1"']);
    expect(device('pc-1').id).toBeDefined();
  });
});

describe('two devices with one name', () => {
  beforeEach(() => {
    addPc('Twin', '192.168.10.50');
    addPc('twin', '192.168.10.51');
  });

  it('refuses a command that names them and says how many there are', () => {
    expect(output('show config Twin')).toEqual([
      '2 devices are called "Twin": rename one of them (set name of <device> to <name>) and ask again',
    ]);
    expect(output('ping Twin from PC-1')[0]).toContain('2 devices are called "Twin"');
    expect(output('ping PC-1 from Twin')[0]).toContain('2 devices are called "Twin"');
  });

  it('does not enter them with use', () => {
    const result = run('use twin');
    expect(result.context).toEqual(GLOBAL);
    expect(result.lines[0].text).toContain('2 devices are called "twin"');
  });

  it('an address still names one of them', () => {
    expect(output('show config 192.168.10.50')[0]).toContain('Twin');
  });
});
