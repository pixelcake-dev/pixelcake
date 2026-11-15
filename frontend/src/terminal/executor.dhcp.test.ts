/**
 * Terminal executor tests for DHCP: a pool on an interface, a card that takes
 * its address from it, what the `show` commands then say, and what the
 * network then does. Everything is built with terminal commands on top of the
 * small sample network:
 *
 *            Router-1
 *     port 1 /       \ port 2
 *   192.168.10.1     192.168.20.1
 *        |                |
 *    SW-Office        SW-Servers
 *     /     \          /      \
 *  PC-1    PC-2     Web-01   Mail-01
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMMAND_REFERENCE, executeCommand } from './executor';
import type { ExecutionResult, TerminalContext } from './executor';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import { setLanguage } from '@/i18n';
import languageReference from '../../../docs/terminal-commands.md?raw';
import { resolveDhcp } from '@/engine';
import type { NetworkDevice } from '@/types';


vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const GLOBAL: TerminalContext = { deviceLabel: null };

function run(command: string, context: TerminalContext = GLOBAL): ExecutionResult {
  return executeCommand(command, context);
}

/** Printed text of a command, one entry per line */
function output(command: string, context: TerminalContext = GLOBAL): string[] {
  return run(command, context).lines.map(l => l.text);
}

/** Everything a diagnostic ends up printing: header, hops, verdict, notes */
function transcript(command: string): string[] {
  const result = run(command);
  const live = result.liveTrace;
  return [...result.lines.map(l => l.text), ...(live ? [...live.hopLines, ...live.finalLines].map(l => l.text) : [])];
}

function device(label: string): NetworkDevice {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

const card = (label: string) => device(label).nics![0];
const leases = () => {
  const { devices, connections } = useNetworkStore.getState();
  const label = (id: string) => devices.find(d => d.id === id)?.label;
  return resolveDhcp({ devices, connections }).leases.map(lease => `${label(lease.deviceId)} ${lease.ip}`);
};

const OFFICE_POOL = 'interface 1 pool 192.168.10.100 to 192.168.10.199 on Router-1';

beforeEach(() => {
  localStorage.clear();
  usePresentationStore.getState().exit();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createSampleTopology();
  store.loadTopology(sample.devices, sample.connections);
});

describe('interface … pool', () => {
  it('makes a router port hand out a range, and says what it hands out with it', () => {
    expect(output(OFFICE_POOL)).toEqual([
      'port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.199: 100 addresses, gateway 192.168.10.1',
      '  no card on its network asks for an address yet: interface <name> dhcp on <device>',
    ]);
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({ start: '192.168.10.100', end: '192.168.10.199' });
    expect(device('Router-1').ports?.[1].dhcpServer).toBeUndefined();
  });

  it('says who got an address at once when cards were waiting for one', () => {
    run('interface eth0 dhcp on PC-1');
    run('interface eth0 dhcp on PC-2');
    expect(output(OFFICE_POOL)[1]).toBe('  leased now: PC-1 192.168.10.100, PC-2 192.168.10.101');
  });

  it('keeps a gateway that is written, and says when there is none to hand out', () => {
    expect(output('interface 1 pool 192.168.10.100-192.168.10.199 gateway 192.168.10.254 on Router-1')[0]).toBe(
      'port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.199: 100 addresses, gateway 192.168.10.254'
    );
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({
      start: '192.168.10.100',
      end: '192.168.10.199',
      gateway: '192.168.10.254',
    });
    // a server is not the gateway of its network
    expect(output('interface eth0 pool 192.168.20.50 to 192.168.20.50 on Web-01')[0]).toBe(
      'interface eth0 on Web-01 now hands out 192.168.20.50 to 192.168.20.50: 1 address, ' +
        'no gateway: its clients talk inside their network only'
    );
    expect(card('Web-01').dhcpServer).toEqual({ start: '192.168.20.50', end: '192.168.20.50' });
  });

  it('replaces the range that was there, and says nothing new of the same one', () => {
    run(OFFICE_POOL);
    expect(output(OFFICE_POOL)).toEqual(['port 1 on Router-1 already hands out 192.168.10.100 to 192.168.10.199']);
    run('interface 1 pool 192.168.10.50 to 192.168.10.59 on Router-1');
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({ start: '192.168.10.50', end: '192.168.10.59' });
    // the same range with another gateway is another pool
    expect(output('interface 1 pool 192.168.10.50 to 192.168.10.59 gateway 192.168.10.2 on Router-1')[0]).toContain(
      'gateway 192.168.10.2'
    );
  });

  it.each([
    ['interface 1 pool 192.168.20.100 to 192.168.20.199 on Router-1', '192.168.20.100 is outside 192.168.10.0/24, the network of port 1 on Router-1'],
    ['interface 1 pool 192.168.10.199 to 192.168.10.100 on Router-1', 'the range ends (192.168.10.100) before it starts (192.168.10.199)'],
    ['interface 1 pool ten to twenty on Router-1', '"ten" is not an address'],
    ['interface 1 pool 192.168.10.100 to 192.168.10.199 gateway 10.0.0.1 on Router-1', '10.0.0.1 is outside 192.168.10.0/24, the network of port 1 on Router-1'],
    ['interface 3 pool 192.168.30.100 to 192.168.30.199 on Router-1', 'port 3 on Router-1 has no address: a pool hands out the network of its interface'],
  ])('refuses "%s"', (command, reason) => {
    expect(output(command)).toEqual([reason]);
    expect(device('Router-1').ports?.some(p => p.dhcpServer)).toBe(false);
  });

  it('belongs on a router or firewall port, or on a card of a server', () => {
    const where = 'addresses are handed out by a port of a router or a firewall, or by a card of a server';
    expect(output('interface eth0 pool 192.168.10.100 to 192.168.10.199 on PC-1')).toEqual([`${where}: PC-1 is a PC`]);
    expect(output('interface 1 pool 192.168.10.100 to 192.168.10.199 on SW-Office')).toEqual([
      `${where}: SW-Office is a Switch`,
    ]);
    expect(output('interface 9 pool 192.168.10.100 to 192.168.10.199 on Router-1')).toEqual([
      'Router-1 has no interface "9" (it has: ports 1-4)',
    ]);
    expect(output('interface 1 pool 192.168.10.100 to 192.168.10.199')).toEqual([
      'specify a device: "interface 1 … on <device>"',
    ]);
  });

  it('works on the device of the context', () => {
    expect(output('interface 1 pool 192.168.10.100 to 192.168.10.199', { deviceLabel: 'Router-1' })[0]).toContain(
      'port 1 on Router-1 now hands out'
    );
  });

  it('warns of a second server on the same network, and of a port that is down', () => {
    run('interface 2 pool 192.168.20.100 to 192.168.20.110 on Router-1');
    run('interface eth0 dhcp on Mail-01');
    expect(output('interface eth0 pool 192.168.20.50 to 192.168.20.59 on Web-01')).toEqual([
      'interface eth0 on Web-01 now hands out 192.168.20.50 to 192.168.20.59: 10 addresses, ' +
        'no gateway: its clients talk inside their network only',
      '  no card on its network asks for an address yet: interface <name> dhcp on <device>',
      '  warning: two DHCP servers on one network: Router-1 port 2 and Web-01 eth0 — the first that has an address left answers',
    ]);

    run('interface 1 down on Router-1');
    expect(output(OFFICE_POOL)).toContain('  port 1 on Router-1 is down: it answers nobody until it is up');
  });

  it('"pool none" stops it, and names who is left without an address', () => {
    run(OFFICE_POOL);
    run('interface eth0 dhcp on PC-1');
    run('interface eth0 dhcp on PC-2');
    expect(output('interface 1 pool none on Router-1')).toEqual([
      'port 1 on Router-1 no longer hands out addresses',
      '  without an address now: PC-1, PC-2',
    ]);
    expect(device('Router-1').ports?.[0]).not.toHaveProperty('dhcpServer');
    expect(device('Router-1').ports?.[0].ip).toBe('192.168.10.1');
    expect(output('interface 1 pool none on Router-1')).toEqual(['port 1 on Router-1 hands out no addresses already']);
  });

  it('"pool none" does not name a card that another server now answers', () => {
    run('interface 2 pool 192.168.20.100 to 192.168.20.110 on Router-1');
    run('interface eth0 pool 192.168.20.50 to 192.168.20.59 on Web-01');
    run('interface eth0 dhcp on Mail-01');
    expect(leases()).toEqual(['Mail-01 192.168.20.100']);
    expect(output('interface 2 pool none on Router-1')).toEqual([
      'port 2 on Router-1 no longer hands out addresses',
    ]);
    expect(leases()).toEqual(['Mail-01 192.168.20.50']);
  });

  it('"pool none" names nobody when nobody had an address from it', () => {
    run(OFFICE_POOL);
    expect(output('interface 1 pool none on Router-1')).toEqual(['port 1 on Router-1 no longer hands out addresses']);
    run('interface eth0 pool 192.168.20.50 to 192.168.20.59 on Web-01');
    expect(output('interface eth0 pool none on Web-01')).toEqual([
      'interface eth0 on Web-01 no longer hands out addresses',
    ]);
    expect(card('Web-01')).not.toHaveProperty('dhcpServer');
  });
});

describe('interface … dhcp', () => {
  it('puts a card on DHCP: it keeps no address of its own and says the one it is leased', () => {
    run(OFFICE_POOL);
    expect(output('interface eth0 dhcp on PC-1')).toEqual([
      'interface eth0 on PC-1 now takes its address from DHCP',
      '  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 by Router-1 port 1',
    ]);
    expect(card('PC-1')).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '' });
    expect(device('PC-1')).toMatchObject({ ip: '', gateway: '' });
    expect(leases()).toEqual(['PC-1 192.168.10.100']);
  });

  it('says so when no server answers, and the card is on DHCP all the same', () => {
    expect(output('interface eth0 dhcp on PC-1')).toEqual([
      'interface eth0 on PC-1 now takes its address from DHCP',
      '  warning: no address yet: no DHCP server answers on its network',
    ]);
    expect(card('PC-1').dhcp).toBe(true);
    expect(transcript('ping Web-01 from PC-1')).toEqual([
      'Pinging Web-01 (192.168.20.10) from PC-1...',
      'Ping failed (error): request: PC-1 has no address: no DHCP server answers on its network',
    ]);
    expect(transcript('ping PC-1 from PC-2')).toEqual([
      'Pinging PC-1 (no ip) from PC-2...',
      'Ping failed (error): request: PC-1 has no address: no DHCP server answers on its network',
    ]);
  });

  it('says it again, with the lease, when the card is on DHCP already', () => {
    run(OFFICE_POOL);
    run('interface eth0 dhcp on PC-1');
    expect(output('interface eth0 dhcp on PC-1')).toEqual([
      'interface eth0 on PC-1 already takes its address from DHCP',
      '  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 by Router-1 port 1',
    ]);
  });

  it('"dhcp off" leaves the card without an address, and says how to give it one', () => {
    run(OFFICE_POOL);
    run('interface eth0 dhcp on PC-1');
    expect(output('interface eth0 dhcp off on PC-1')).toEqual([
      'interface eth0 on PC-1 no longer takes its address from DHCP: it has no address now',
      '  give it one: interface eth0 ip <address>/<prefix> on PC-1',
    ]);
    expect(card('PC-1')).not.toHaveProperty('dhcp');
    expect(card('PC-1').ip).toBe('');
    expect(output('interface eth0 dhcp off on PC-1')).toEqual([
      'interface eth0 on PC-1 does not take its address from DHCP',
    ]);
    expect(leases()).toEqual([]);
  });

  it('is for the cards of end devices: a port gets its address by hand', () => {
    expect(output('interface 1 dhcp on Router-1')).toEqual([
      'DHCP gives an address to the network cards of end devices: port 1 on Router-1 gets its own by hand',
      '  to hand out addresses from it: interface 1 pool <first> to <last> on Router-1',
    ]);
    expect(output('interface 1 dhcp on SW-Office')).toEqual([
      'DHCP gives an address to the network cards of end devices: port 1 on SW-Office gets its own by hand',
    ]);
  });

  it('a card that hands out addresses stops doing so when it asks for one', () => {
    run('interface eth0 pool 192.168.20.50 to 192.168.20.59 on Web-01');
    expect(output('interface eth0 dhcp on Web-01')).toEqual([
      'interface eth0 on Web-01 now takes its address from DHCP',
      '  warning: no address yet: no DHCP server answers on its network',
      '  interface eth0 on Web-01 no longer hands out addresses itself: a card cannot do both',
    ]);
    expect(card('Web-01')).not.toHaveProperty('dhcpServer');
    // and a card on DHCP cannot be given a pool
    expect(output('interface eth0 pool 192.168.20.50 to 192.168.20.59 on Web-01')).toEqual([
      'eth0 on Web-01 takes its own address from DHCP: it cannot hand out addresses too',
    ]);
  });
});

describe('a card on DHCP and the commands that write an address', () => {
  beforeEach(() => {
    run(OFFICE_POOL);
    run('interface eth0 dhcp on PC-1');
  });

  it('an address written by hand takes the card off DHCP', () => {
    expect(output('interface eth0 ip 192.168.10.50/24 on PC-1')).toEqual([
      'interface eth0 on PC-1: 192.168.10.50 / 255.255.255.0',
      '  interface eth0 on PC-1 no longer takes its address from DHCP',
    ]);
    expect(card('PC-1')).toMatchObject({ ip: '192.168.10.50', subnet: '255.255.255.0' });
    expect(card('PC-1')).not.toHaveProperty('dhcp');
    expect(device('PC-1').ip).toBe('192.168.10.50');
  });

  it('without a prefix the mask is /24: the card kept none of its own', () => {
    expect(output('interface eth0 ip 192.168.10.50 on PC-1')[0]).toBe(
      'interface eth0 on PC-1: 192.168.10.50 / 255.255.255.0'
    );
  });

  it('there is no address of its own to clear, and no gateway of its own to set', () => {
    expect(output('interface eth0 ip none on PC-1')).toEqual([
      'interface eth0 on PC-1 takes its address from DHCP: "interface eth0 dhcp off" to stop',
    ]);
    expect(output('interface eth0 gateway 192.168.10.254 on PC-1')).toEqual([
      'interface eth0 on PC-1 takes its address from DHCP: the gateway comes with the lease',
      '  it is the one of the pool: interface <n> pool <first> to <last> gateway <address> on <server>',
    ]);
    expect(output('interface eth0 gateway none on PC-1')[0]).toContain('the gateway comes with the lease');
    expect(card('PC-1')).toMatchObject({ dhcp: true, ip: '', gateway: '' });
  });

  it('"set ip" does the same as "interface … ip"; mask and gateway come with the lease', () => {
    expect(output('set gateway of PC-1 to 192.168.10.254')).toEqual([
      'PC-1 takes its address from DHCP: its gateway comes with the lease',
      '  to write its address by hand: set ip of PC-1 to <address>',
    ]);
    expect(output('set subnet of PC-1 to 255.255.0.0')[0]).toBe(
      'PC-1 takes its address from DHCP: its subnet comes with the lease'
    );
    expect(card('PC-1').dhcp).toBe(true);

    expect(output('set ip of PC-1 to 192.168.10.60')).toEqual([
      'PC-1: ip set to 192.168.10.60',
      '  PC-1 no longer takes its address from DHCP: mask 255.255.255.0, no gateway yet',
    ]);
    expect(card('PC-1')).toMatchObject({ ip: '192.168.10.60', subnet: '255.255.255.0', gateway: '' });
    expect(card('PC-1')).not.toHaveProperty('dhcp');
  });

  it('a name is set as for any device, and the card stays as it is kept', () => {
    expect(output('set name of PC-1 to Portatile')).toEqual(['PC-1 renamed to "Portatile"']);
    expect(card('Portatile')).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '' });
  });

  it('switching the card off and on never writes the leased address on it', () => {
    run('interface eth0 down on PC-1');
    expect(card('PC-1')).toMatchObject({ enabled: false, dhcp: true, ip: '' });
    expect(output('show dhcp PC-1')).toContain('  ✗ PC-1 eth0: interface eth0 is disabled');
    run('interface eth0 up on PC-1');
    expect(card('PC-1')).toMatchObject({ enabled: true, dhcp: true, ip: '', subnet: '', gateway: '' });
    expect(leases()).toEqual(['PC-1 192.168.10.100']);
  });
});

describe('a device on DHCP in the other commands', () => {
  beforeEach(() => {
    run(OFFICE_POOL);
    run('interface eth0 dhcp on PC-1');
  });

  it('pings and is pinged with the address it is leased', () => {
    expect(transcript('ping Web-01 from PC-1')).toEqual([
      'Pinging Web-01 (192.168.20.10) from PC-1...',
      'Reply from 192.168.20.10: hops=5 time=7ms',
    ]);
    expect(transcript('ping PC-1 from Web-01')[0]).toBe('Pinging PC-1 (192.168.10.100) from Web-01...');
    expect(transcript('trace PC-1 from PC-2')).toEqual([
      'Tracing route to PC-1 (192.168.10.100) from PC-2:',
      '  1  ○ PC-2 (PC)',
      '  2  ○ SW-Office (Switch)',
      '  3  ● PC-1 (PC)',
      'Trace complete: destination reached.',
    ]);
  });

  it('is found by the address it is leased, to look at and to change', () => {
    expect(transcript('ping 192.168.10.100 from PC-2')[0]).toBe('Pinging PC-1 (192.168.10.100) from PC-2...');
    expect(output('show ip 192.168.10.100')[0]).toBe('PC-1 — addressing');
    expect(run('use 192.168.10.100').context).toEqual({ deviceLabel: 'PC-1' });
    expect(output('set name of 192.168.10.100 to Portatile')).toEqual(['PC-1 renamed to "Portatile"']);
    expect(card('Portatile')).toMatchObject({ dhcp: true, ip: '' });
  });

  it('show devices is as wide as it always was while no address is leased', () => {
    run('interface eth0 dhcp off on PC-1');
    run('interface eth0 ip 192.168.10.11/24 on PC-1');
    expect(output('show devices').slice(0, 2)).toEqual([
      'DEVICE                   TYPE           IP               VLANS',
      'Router-1                 Router         192.168.10.1     -',
    ]);
  });

  it('show devices and show neighbors mark the address that is leased', () => {
    run('interface eth0 dhcp on Mail-01');
    expect(output('show devices')).toEqual([
      'DEVICE                   TYPE           IP                     VLANS',
      'Router-1                 Router         192.168.10.1           -',
      'SW-Office                Switch         192.168.10.2           -',
      'SW-Servers               Switch         192.168.20.2           -',
      'PC-1                     PC             192.168.10.100 (dhcp)  -',
      'PC-2                     PC             192.168.10.12          -',
      'Web-01                   Server         192.168.20.10          -',
      'Mail-01                  Server         - (dhcp)               -',
    ]);
    expect(output('show neighbors SW-Office')).toEqual([
      'NEIGHBORS of SW-Office (3)',
      '  PC-1                     PC             192.168.10.100 (dhcp)',
      '  PC-2                     PC             192.168.10.12',
      '  Router-1                 Router         192.168.10.1',
    ]);
  });

  it('show ip and show config say where the address of the card comes from', () => {
    expect(output('show ip PC-1')).toEqual([
      'PC-1 — addressing',
      '  ip:       192.168.10.100 (dhcp)',
      '  subnet:   255.255.255.0',
      '  gateway:  192.168.10.1',
      '  eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 (dhcp from Router-1 port 1)',
    ]);
    expect(output('show config PC-1')).toEqual([
      'PC-1 — PC',
      '  ip:       192.168.10.100 (dhcp)',
      '  subnet:   255.255.255.0',
      '  gateway:  192.168.10.1',
      '  vlans:    none (untagged)',
      '  nic eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 (dhcp from Router-1 port 1) ',
    ]);
    // a card with its address written by hand reads as it always did
    expect(output('show ip PC-2')).toEqual([
      'PC-2 — addressing',
      '  ip:       192.168.10.12',
      '  subnet:   255.255.255.0',
      '  gateway:  192.168.10.1',
      '  eth0: 192.168.10.12 / 255.255.255.0 gw 192.168.10.1',
    ]);
  });

  it('and why it has none, when it has none', () => {
    run('interface eth0 dhcp on Mail-01');
    expect(output('show ip Mail-01')).toEqual([
      'Mail-01 — addressing',
      '  ip:       - (dhcp)',
      '  subnet:   -',
      '  gateway:  -',
      '  eth0: no address (dhcp: no DHCP server answers on its network)',
    ]);
    expect(output('show config Mail-01')).toContain(
      '  nic eth0: no address (dhcp: no DHCP server answers on its network) '
    );
  });

  it('show interfaces says "dhcp" where a port says its zone', () => {
    expect(output('show interfaces PC-1')).toEqual([
      'IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK',
      'eth0       nic    up      192.168.10.100   -          dhcp       SW-Office (port 1)',
    ]);
    expect(output('show interfaces PC-2')[1]).toBe(
      'eth0       nic    up      192.168.10.12    -          -          SW-Office (port 2)'
    );
  });

  it('show config of the server says where it hands out addresses', () => {
    expect(output('show config Router-1')).toContain(
      '  dhcp:     hands out addresses on port 1 — "show dhcp Router-1" for detail'
    );
    expect(output('show config PC-2').join('\n')).not.toContain('dhcp');
  });

  it('a rule or a forward written by the name of the device says that its address is a leased one', () => {
    useNetworkStore.getState().addDevice({
      type: 'Firewall',
      templateId: 'tpl-firewall',
      label: 'FW',
      ip: '',
      subnet: '255.255.255.0',
      gateway: '',
      position: { x: 0, y: 0 },
      portCount: 2,
      ports: [1, 2].map(id => ({ id, enabled: true, speed: 'auto' as const, ip: `10.0.${id}.1`, subnet: '255.255.255.0' })),
    });
    expect(output('add rule allow web from PC-1 to Web-01 on FW')).toEqual([
      'FW: rule 1 added — allow web from 192.168.10.100 to 192.168.20.10',
      '  PC-1 → 192.168.10.100 (leased by DHCP: it changes if the drawing does)',
      '  Web-01 → 192.168.20.10',
    ]);
    expect(output('add forward web from interface 2 to PC-1 on FW').slice(0, 2)).toEqual([
      'FW: forward 1 added — forward web from interface 2 to 192.168.10.100',
      '  PC-1 → 192.168.10.100 (leased by DHCP: it changes if the drawing does)',
    ]);
  });

  it('a simulated failure does not take the address away', () => {
    const presentation = usePresentationStore.getState();
    presentation.enter();
    presentation.toggleDeviceFailure(device('Router-1').id);
    expect(output('show ip PC-1')[1]).toBe('  ip:       192.168.10.100 (dhcp)');
    expect(transcript('ping Web-01 from PC-1')).toContain(
      'Ping failed (blocked): request: Router-1 is down'
    );
    presentation.exit();
  });
});

describe('show dhcp', () => {
  it('says that there is none, and how to begin', () => {
    expect(output('show dhcp')).toEqual([
      'no DHCP in the drawing: no interface hands out addresses, no card asks for one',
      '  hand out addresses: interface <n> pool <first> to <last> on <router>',
      '  ask for one:        interface <name> dhcp on <device>',
    ]);
    expect(output('show dhcp Router-1')).toEqual([
      'Router-1 hands out no addresses and asks for none',
      '  hand out addresses: interface <n> pool <first> to <last> on Router-1',
    ]);
    expect(output('show dhcp PC-1')).toEqual([
      'PC-1 hands out no addresses and asks for none',
      '  ask for one:        interface eth0 dhcp on PC-1',
    ]);
    expect(output('show dhcp Web-01')).toEqual([
      'Web-01 hands out no addresses and asks for none',
      '  hand out addresses: interface <n> pool <first> to <last> on Web-01',
      '  ask for one:        interface eth0 dhcp on Web-01',
    ]);
    expect(output('show dhcp SW-Office')).toEqual(['SW-Office hands out no addresses and asks for none']);
  });

  it('lists pools, leases and who is left without, for the whole drawing', () => {
    run(OFFICE_POOL);
    run('interface 2 pool 192.168.20.100 to 192.168.20.100 on Router-1');
    for (const name of ['PC-1', 'PC-2', 'Web-01', 'Mail-01']) run(`interface eth0 dhcp on ${name}`);
    expect(output('show dhcp')).toEqual([
      'DHCP — 2 pools, 3 leases',
      'POOLS',
      '  Router-1 port 1        192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  2 leased, 98 free of 100',
      '  Router-1 port 2        192.168.20.100 – 192.168.20.100  gateway 192.168.20.1  1 leased, 0 free of 1',
      'LEASES',
      '  192.168.10.100   PC-1 eth0                from Router-1 port 1',
      '  192.168.10.101   PC-2 eth0                from Router-1 port 1',
      '  192.168.20.100   Web-01 eth0              from Router-1 port 2',
      'WITHOUT AN ADDRESS',
      '  ✗ Mail-01 eth0: the pool of Router-1 port 2 is used up: its one address is taken',
      '  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network',
    ]);
  });

  it('of one device: what it hands out, or what it was given', () => {
    run(OFFICE_POOL);
    run('interface eth0 dhcp on PC-1');
    run('interface eth0 dhcp on Mail-01');
    expect(output('show dhcp of Router-1')).toEqual([
      'DHCP of Router-1',
      'POOLS',
      '  Router-1 port 1        192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  1 leased, 99 free of 100',
      'LEASES',
      '  192.168.10.100   PC-1 eth0                from Router-1 port 1',
      '  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network',
    ]);
    expect(output('show dhcp PC-1')).toEqual([
      'DHCP of PC-1',
      'LEASES',
      '  192.168.10.100   PC-1 eth0                from Router-1 port 1',
      '  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network',
    ]);
    expect(output('show dhcp', { deviceLabel: 'Mail-01' })).toEqual([
      'DHCP of Mail-01',
      'WITHOUT AN ADDRESS',
      '  ✗ Mail-01 eth0: no DHCP server answers on its network',
      '  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network',
    ]);
    // one pool, one lease
    expect(output('show dhcp')[0]).toBe('DHCP — 1 pool, 1 lease');
  });

  it('says what is wrong with a pool, that its port is down, and that there are two servers', () => {
    run('interface 2 pool 192.168.20.100 to 192.168.20.110 on Router-1');
    run('interface eth0 pool 192.168.20.50 to 192.168.20.59 on Web-01');
    run('interface eth0 dhcp on Mail-01');
    expect(output('show dhcp')).toContain(
      '  warning: two DHCP servers on one network: Router-1 port 2 and Web-01 eth0 — the first that has an address left answers'
    );
    expect(output('show dhcp Web-01')).toContain(
      '  warning: two DHCP servers on one network: Router-1 port 2 and Web-01 eth0 — the first that has an address left answers'
    );
    expect(output('show dhcp PC-1').join('\n')).not.toContain('warning');

    // the address of the port changes under the pool: the pool no longer fits
    run('interface 2 ip 172.16.0.1/24 on Router-1');
    expect(output('show dhcp Router-1')).toContain(
      '  Router-1 port 2        192.168.20.100 – 192.168.20.110  ✗ 192.168.20.100 is outside 172.16.0.0/24, the network of port 2 on Router-1'
    );
    run('interface 2 ip 192.168.20.1/24 on Router-1');
    run('interface 2 down on Router-1');
    expect(output('show dhcp Router-1')).toContain(
      '  Router-1 port 2        192.168.20.100 – 192.168.20.110  gateway 192.168.20.1  0 leased, 11 free of 11  (interface down: it answers nobody)'
    );
  });
});

describe('help', () => {
  it('has the two commands and the show', () => {
    expect(output('help dhcp').map(row => row.split('  ')[0])).toEqual([
      'show dhcp [[of] <device>]',
      'interface <name> dhcp [off] on <device>',
      'interface <n> [dhcp] pool <first> to <last> on <device>',
    ]);
    expect(output('help pool')).toHaveLength(1);
    for (const [syntax] of COMMAND_REFERENCE) expect(syntax.length, syntax).toBeLessThanOrEqual(58);
  });

});

describe('the DHCP session of docs/terminal-commands.md', () => {
  /** The commands of the example, each with what the reference says it prints */
  function documentedSession(): Array<{ command: string; printed: string[] }> {
    const text = languageReference.replace(/\r\n/g, '\n');
    const start = text.indexOf('DHCP on the same sample:');
    const open = text.indexOf('```\n', start) + 4;
    const block = text.slice(open, text.indexOf('\n```', open)).split('\n');
    const session: Array<{ command: string; printed: string[] }> = [];
    for (const row of block) {
      const typed = /^pixelcake> (.+)$/.exec(row)?.[1];
      if (typed) session.push({ command: typed, printed: [] });
      else session[session.length - 1].printed.push(row);
    }
    return session;
  }

  it('is there, on the sample of the welcome screen loaded in English', () => {
    expect(languageReference).toContain('DHCP on the same sample:');
    expect(documentedSession().map(step => step.command)).toEqual([
      'show dhcp',
      'show ip Laptop-1',
      'interface eth0 dhcp on PC-Sales',
      'ping Web-ERP from PC-Sales',
      'interface 1 pool none on Router-Core',
      'ping Web-ERP from PC-Sales',
      'interface 1 pool 192.168.10.100 to 192.168.10.149 dns 192.168.30.10 on Router-Core',
      'show dhcp Router-Core',
    ]);
  });

  it('prints, command after command, exactly what the reference shows', () => {
    // The reference is in English, and so are the names of its sample
    setLanguage('en');
    const store = useNetworkStore.getState();
    store.clearAllDevices();
    const sample = createCompanySample();
    store.loadTopology(sample.devices, sample.connections);
    for (const { command, printed } of documentedSession()) {
      expect(transcript(command), command).toEqual(printed);
    }
  });
});
