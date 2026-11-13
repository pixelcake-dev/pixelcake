/**
 * Terminal executor tests for routing, VLANs and firewall rules: each block
 * builds something on top of the sample network with terminal commands only
 * and checks both what the terminal prints and what the network then does.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMMAND_REFERENCE, executeCommand } from './executor';
import type { ExecutionResult, TerminalContext } from './executor';
import { NCL_VERSION } from './types';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import type { NetworkDevice, Port } from '@/types';

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
function transcript(command: string, context: TerminalContext = GLOBAL): string[] {
  const result = run(command, context);
  const live = result.liveTrace;
  return [
    ...result.lines.map(l => l.text),
    ...(live ? [...live.hopLines, ...live.finalLines].map(l => l.text) : []),
  ];
}

/** The line that gives the verdict of a ping or flow: the last one that is not a note */
function verdict(command: string, context: TerminalContext = GLOBAL): string {
  const lines = transcript(command, context).filter(
    text => !text.startsWith('  note:') && !text.startsWith('  dropped at:')
  );
  return lines[lines.length - 1];
}

function device(label: string): NetworkDevice {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

const portOf = (label: string, id: number): Port => {
  const found = device(label).ports?.find(p => p.id === id);
  if (!found) throw new Error(`no port ${id} on "${label}"`);
  return found;
};

function addGear(label: string, type: 'Router' | 'Firewall'): void {
  useNetworkStore.getState().addDevice({
    type,
    templateId: type === 'Router' ? 'tpl-router' : 'tpl-firewall',
    label,
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    portCount: 4,
    ports: [1, 2, 3, 4].map(id => ({ id, enabled: true, speed: 'auto', portType: 'lan' })),
  });
}

function addPc(label: string, ip: string, gateway: string): void {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    templateId: 'tpl-pc',
    label,
    ip,
    subnet: '255.255.255.0',
    gateway,
    position: { x: 0, y: 0 },
    nics: [{ id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip, subnet: '255.255.255.0', gateway }],
  });
}

beforeEach(() => {
  localStorage.clear();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createSampleTopology();
  store.loadTopology(sample.devices, sample.connections);
});

// ---------- routing ----------

describe('a second site, routed from the terminal', () => {
  /** Router-2 behind Router-1 on a /30, Branch-PC behind Router-2 */
  function cableBranch(): void {
    addGear('Router-2', 'Router');
    addPc('Branch-PC', '192.168.30.11', '192.168.30.1');
    expect(output('connect Router-1 to Router-2')).toEqual([
      'connected Router-1 (port 3) ↔ Router-2 (port 1)',
    ]);
    expect(output('connect Branch-PC to Router-2')).toEqual([
      'connected Branch-PC (eth0) ↔ Router-2 (port 2)',
    ]);
    expect(output('interface 3 ip 10.0.0.1/30 on Router-1')).toEqual([
      'port 3 on Router-1: 10.0.0.1 / 255.255.255.252',
    ]);
    expect(output('interface 1 ip 10.0.0.2/30 on Router-2')).toEqual([
      'port 1 on Router-2: 10.0.0.2 / 255.255.255.252',
    ]);
    expect(output('interface 2 ip 192.168.30.1/24 on Router-2')).toEqual([
      'port 2 on Router-2: 192.168.30.1 / 255.255.255.0',
    ]);
  }

  it('addresses router ports from the terminal', () => {
    cableBranch();
    expect(portOf('Router-1', 3)).toMatchObject({ ip: '10.0.0.1', subnet: '255.255.255.252' });
    expect(portOf('Router-2', 2)).toMatchObject({ ip: '192.168.30.1', subnet: '255.255.255.0' });
  });

  it('a ping fails until each router knows the way, first out and then back', () => {
    cableBranch();
    expect(verdict('ping Branch-PC from PC-1')).toBe(
      'Ping failed (blocked): request: Router-1 has no route to 192.168.30.11'
    );

    expect(output('add route 192.168.30.0/24 via 10.0.0.2 on Router-1')).toEqual([
      'Router-1: route to 192.168.30.0/24 via 10.0.0.2 added',
    ]);
    expect(verdict('ping Branch-PC from PC-1')).toBe(
      'Ping failed (blocked): reply: Router-2 has no route to 192.168.10.11'
    );

    // the next hop given by name: the address Router-1 has on a network they share
    expect(output('add route default via Router-1 on Router-2')).toEqual([
      'Router-2: route to default via 10.0.0.1 added',
      '  Router-1 → 10.0.0.1',
    ]);
    expect(verdict('ping Branch-PC from PC-1')).toBe('Reply from 192.168.30.11: hops=5 time=7ms');
  });

  it('shows every hop with the route it took', () => {
    cableBranch();
    run('add route 192.168.30.0/24 via 10.0.0.2 on Router-1');
    expect(transcript('trace Branch-PC from PC-1')).toEqual([
      'Tracing route to Branch-PC (192.168.30.11) from PC-1:',
      '  1  ○ PC-1 (PC)',
      '  2  ○ SW-Office (Switch)',
      '  3  ○ Router-1 (Router)  — routed: 192.168.30.0/24 via 10.0.0.2 (port 3)',
      '  4  ○ Router-2 (Router)  — routed: 192.168.30.0/24 is on port 2',
      '  5  ● Branch-PC (PC)',
      'Trace complete: destination reached.',
    ]);
  });

  it('prints the routing table the engine uses', () => {
    cableBranch();
    run('add route 192.168.30.0/24 via 10.0.0.2 on Router-1');
    run('set gateway of Router-1 to 10.0.0.2');
    expect(output('show routes of Router-1')).toEqual([
      'ROUTES of Router-1',
      'DESTINATION          VIA              OUT      KIND',
      '10.0.0.0/30          -                port 3   connected',
      '192.168.10.0/24      -                port 1   connected',
      '192.168.20.0/24      -                port 2   connected',
      '192.168.30.0/24      10.0.0.2         port 3   static',
      'default              10.0.0.2         port 3   default (gateway)',
    ]);
    // an end device has a table too: its network and its gateway
    expect(output('show routes of PC-1')).toEqual([
      'ROUTES of PC-1',
      'DESTINATION          VIA              OUT      KIND',
      '192.168.10.0/24      -                eth0     connected',
      'default              192.168.10.1     eth0     default (gateway)',
    ]);
  });

  it('the gateway of a router is its default route', () => {
    cableBranch();
    expect(output('set gateway of Router-1 to 10.0.0.2')).toEqual([
      'Router-1: gateway set to 10.0.0.2',
      '  the gateway of a router is its default route — "show routes Router-1"',
    ]);
    run('add route default via 10.0.0.1 on Router-2');
    expect(verdict('ping Branch-PC from PC-1')).toBe('Reply from 192.168.30.11: hops=5 time=7ms');
  });

  it('replaces the next hop of a route to the same network, and removes it', () => {
    cableBranch();
    run('add route 192.168.30.0/24 via 10.0.0.2 on Router-1');
    // the same network written with host bits is the same route
    expect(output('add route 192.168.30.7/24 via 192.168.20.10 on Router-1')).toEqual([
      'Router-1: route to 192.168.30.0/24 now goes via 192.168.20.10 (was 10.0.0.2)',
    ]);
    expect(device('Router-1').routes).toEqual([
      { id: 'route-1', destination: '192.168.30.0/24', nextHop: '192.168.20.10' },
    ]);

    expect(output('remove route 192.168.30.0/24 from Router-1')).toEqual([
      'Router-1: route to 192.168.30.0/24 removed',
    ]);
    expect(device('Router-1').routes ?? []).toEqual([]);
    expect(output('remove route 192.168.30.0/24 from Router-1')).toEqual([
      'Router-1 has no route to 192.168.30.0/24',
    ]);
  });

  it('adds a backup route after the main one, shows it as such, and removes one of the two', () => {
    cableBranch();
    run('add route 192.168.30.0/24 via 10.0.0.2 on Router-1');

    expect(output('add backup route 192.168.30.0/24 via 192.168.20.10 on Router-1')).toEqual([
      'Router-1: backup route to 192.168.30.0/24 via 192.168.20.10 added',
      '  used when the interface of the route via 10.0.0.2 has no working link',
    ]);
    expect(device('Router-1').routes).toEqual([
      { id: 'route-1', destination: '192.168.30.0/24', nextHop: '10.0.0.2' },
      { id: 'route-2', destination: '192.168.30.0/24', nextHop: '192.168.20.10' },
    ]);
    const table = output('show routes of Router-1');
    expect(table).toContain('192.168.30.0/24      10.0.0.2         port 3   static');
    expect(table).toContain('192.168.30.0/24      192.168.20.10    port 2   static, backup');

    // the main route is still the one used
    expect(transcript('trace Branch-PC from PC-1')).toContain(
      '  3  ○ Router-1 (Router)  — routed: 192.168.30.0/24 via 10.0.0.2 (port 3)'
    );

    // "add route" keeps meaning "the route to this network": it moves the main one
    expect(output('add route 192.168.30.0/24 via 192.168.20.10 on Router-1')).toEqual([
      'Router-1 already has a backup route to 192.168.30.0/24 via 192.168.20.10',
      '  remove it first: remove route 192.168.30.0/24 via 192.168.20.10 from Router-1',
    ]);
    expect(output('add backup route 192.168.30.0/24 via 192.168.20.10 on Router-1')).toEqual([
      'Router-1 already has a route to 192.168.30.0/24 via 192.168.20.10',
    ]);

    expect(output('remove route 192.168.30.0/24 via 10.9.9.9 from Router-1')).toEqual([
      'Router-1 has no route to 192.168.30.0/24 via 10.9.9.9',
    ]);
    expect(output('remove route 192.168.30.0/24 via 192.168.20.10 from Router-1')).toEqual([
      'Router-1: route to 192.168.30.0/24 via 192.168.20.10 removed',
    ]);
    expect(device('Router-1').routes).toEqual([
      { id: 'route-1', destination: '192.168.30.0/24', nextHop: '10.0.0.2' },
    ]);
  });

  it('a backup route with nothing to back up is simply the route; removing by network takes them all', () => {
    cableBranch();
    expect(output('add backup route 192.168.30.0/24 via 10.0.0.2 on Router-1')).toEqual([
      'Router-1: route to 192.168.30.0/24 via 10.0.0.2 added',
      '  it is the only route to 192.168.30.0/24: there is nothing to back up yet',
    ]);
    run('add backup route 192.168.30.0/24 via 192.168.20.10 on Router-1');
    expect(device('Router-1').routes).toHaveLength(2);

    expect(output('remove route 192.168.30.0/24 from Router-1')).toEqual([
      'Router-1: 2 routes to 192.168.30.0/24 removed',
    ]);
    expect(device('Router-1').routes ?? []).toEqual([]);
  });

  it('a backup default route waits behind the gateway of the router', () => {
    cableBranch();
    run('set gateway of Router-1 to 10.0.0.2');
    run('add backup route default via 192.168.20.10 on Router-1');

    const table = output('show routes of Router-1');
    // routes written by hand come before the gateway of the device
    expect(table.filter(row => row.startsWith('default'))).toEqual([
      'default              192.168.20.10    port 2   default',
      'default              10.0.0.2         port 3   default (gateway), backup',
    ]);
  });

  it('warns about a next hop the router cannot reach, and shows it in the table', () => {
    cableBranch();
    expect(output('add route 192.168.40.0/24 via 172.16.0.1 on Router-1')).toEqual([
      'Router-1: route to 192.168.40.0/24 via 172.16.0.1 added',
      '  warning: 172.16.0.1 is on none of the networks of Router-1: the route cannot be used yet',
    ]);
    expect(output('show routes of Router-1')).toContain(
      '192.168.40.0/24      172.16.0.1       ?        static  ✗ next hop on none of its networks'
    );
  });

  it('refuses what is not a route, saying what is expected', () => {
    cableBranch();
    expect(output('add route servers via 10.0.0.2 on Router-1')).toEqual([
      '"servers" is not a network: write it as 192.168.30.0/24, or "default"',
    ]);
    expect(output('add route 192.168.30.0/24 via nowhere on Router-1')).toEqual([
      '"nowhere" is not an address, nor a device on the canvas',
    ]);
    expect(output('add route 192.168.30.0/24 via Web-01 on Router-2')).toEqual([
      'Web-01 has no address on a network of Router-2: give the next hop as an address',
    ]);
    expect(output('add route 192.168.30.0/24 via 192.168.10.1 on PC-1')).toEqual([
      'PC-1 is a PC: routes belong on routers and firewalls',
      '  an end device has one way out, its gateway: set gateway of PC-1 to <address>',
    ]);
    expect(output('add route 192.168.30.0/24 via 10.0.0.2')).toEqual([
      'specify a device: "add route 192.168.30.0/24 via 10.0.0.2 on <device>"',
    ]);
    expect(device('Router-1').routes ?? []).toEqual([]);
  });

  it('acts on the device of the context when none is named', () => {
    cableBranch();
    const onRouter1: TerminalContext = { deviceLabel: 'Router-1' };
    expect(output('add route 192.168.30.0/24 via 10.0.0.2', onRouter1)).toEqual([
      'Router-1: route to 192.168.30.0/24 via 10.0.0.2 added',
    ]);
    expect(output('show routes', onRouter1)[0]).toBe('ROUTES of Router-1');
  });

  it('says that the routes of a router without addressed ports are not used', () => {
    addGear('Router-9', 'Router');
    expect(output('add route 10.0.0.0/8 via 192.168.10.1 on Router-9')).toEqual([
      'Router-9: route to 10.0.0.0/8 via 192.168.10.1 added',
      '  Router-9 has no interface addresses yet: its routes are not used until a port has one',
    ]);
    expect(output('show routes of Router-9').slice(0, 3)).toEqual([
      'ROUTES of Router-9',
      '  Router-9 has no interface addresses: it lets traffic through, its routes are not used',
      '  give a port its address with: interface <n> ip <address>/<prefix> on Router-9',
    ]);
  });
});

// ---------- addresses ----------

describe('addresses from the terminal', () => {
  it('pings the address that was typed, not the main address of its device', () => {
    expect(transcript('ping 192.168.20.1 from PC-1')).toEqual([
      'Pinging Router-1 (192.168.20.1) from PC-1...',
      'Reply from 192.168.20.1: hops=3 time=3ms',
    ]);
    expect(transcript('ping Router-1 from PC-1')[0]).toBe('Pinging Router-1 (192.168.10.1) from PC-1...');
  });

  it('sets the address of a device with a network card on the card', () => {
    expect(output('set ip of PC-1 to 192.168.10.50')).toEqual(['PC-1: ip set to 192.168.10.50']);
    expect(device('PC-1').ip).toBe('192.168.10.50');
    expect(device('PC-1').nics?.[0].ip).toBe('192.168.10.50');
    expect(verdict('ping 192.168.10.50 from PC-2')).toBe('Reply from 192.168.10.50: hops=3 time=3ms');
  });

  it('warns when the address is already somebody else\'s', () => {
    expect(output('set ip of PC-1 to 192.168.10.12')).toEqual([
      'PC-1: ip set to 192.168.10.12',
      '  warning: 192.168.10.12 is also the address of PC-2',
    ]);
  });

  it('configures a network card by name: address, gateway, state', () => {
    expect(output('interface eth0 ip 192.168.10.77/24 on PC-1')).toEqual([
      'interface eth0 on PC-1: 192.168.10.77 / 255.255.255.0',
    ]);
    expect(device('PC-1').ip).toBe('192.168.10.77'); // the device-level mirror follows

    expect(output('interface eth0 gateway none on PC-1')).toEqual(['interface eth0 on PC-1 has no gateway now']);
    expect(verdict('ping Web-01 from PC-1')).toBe(
      'Ping failed (blocked): request: no default gateway configured on PC-1'
    );
    expect(output('interface eth0 gateway 192.168.10.1 on PC-1')).toEqual([
      'interface eth0 on PC-1: gateway 192.168.10.1',
    ]);
    expect(verdict('ping Web-01 from PC-1')).toBe('Reply from 192.168.20.10: hops=5 time=7ms');

    expect(output('interface eth0 down on PC-1')).toEqual(['interface eth0 on PC-1 is now down']);
    expect(output('interface eth0 down on PC-1')).toEqual(['interface eth0 on PC-1 is already down']);
    expect(verdict('ping Web-01 from PC-1')).toBe(
      'Ping failed (blocked): request: interface eth0 on PC-1 is disabled'
    );
  });

  it('clears the address of a router port', () => {
    expect(output('interface 2 ip none on Router-1')).toEqual(['port 2 on Router-1 has no address now']);
    expect(portOf('Router-1', 2).ip).toBeUndefined();
    expect(portOf('Router-1', 2).subnet).toBeUndefined();
  });

  it('refuses addresses and interfaces that cannot be', () => {
    expect(output('interface 2 ip 10.0.0.300 on Router-1')).toEqual([
      '"10.0.0.300" is not a valid IPv4 address',
    ]);
    expect(output('interface 9 ip 10.0.0.1 on Router-1')).toEqual([
      'Router-1 has no interface "9" (it has: ports 1-4)',
    ]);
    expect(output('interface eth7 up on PC-1')).toEqual(['PC-1 has no interface "eth7" (it has: eth0)']);
    expect(output('interface 1 ip 192.168.10.3 on SW-Office')).toEqual([
      'SW-Office is a Switch: its ports carry no address',
      '  its own address is set with: set ip of SW-Office to <address>',
    ]);
    expect(output('interface 1 gateway 192.168.10.254 on Router-1')).toEqual([
      'port 1 on Router-1 is a port: ports have no gateway',
      '  the default route of Router-1 is: set gateway of Router-1 to <address>',
    ]);
  });
});

// ---------- VLANs ----------

describe('VLANs on switch ports, from the terminal', () => {
  it('isolates a port, then brings its neighbours and the uplink into the VLAN', () => {
    expect(output('interface 1 access 10 on SW-Office')).toEqual([
      'port 1 on SW-Office is now an access port in VLAN 10',
      '  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1',
    ]);
    expect(verdict('ping PC-2 from PC-1')).toBe(
      'Ping failed (blocked): request: VLAN 10 does not leave through port 2 on SW-Office: it is in the default VLAN 1'
    );

    expect(output('interface 2 access 10 on SW-Office')).toEqual([
      'port 2 on SW-Office is now an access port in VLAN 10',
    ]);
    expect(verdict('ping PC-2 from PC-1')).toBe('Reply from 192.168.10.12: hops=3 time=3ms');

    // the gateway is on the uplink, still in VLAN 1
    expect(verdict('ping Web-01 from PC-1')).toBe(
      'Ping failed (blocked): request: VLAN 10 does not leave through port 8 on SW-Office: it is in the default VLAN 1'
    );
    run('interface 8 access 10 on SW-Office');
    expect(verdict('ping Web-01 from PC-1')).toBe('Reply from 192.168.20.10: hops=5 time=7ms');
  });

  it('names the VLAN at the switch hop of a trace', () => {
    for (const port of [1, 2, 8]) run(`interface ${port} access 10 on SW-Office`);
    expect(transcript('trace Web-01 from PC-1').slice(1, 4)).toEqual([
      '  1  ○ PC-1 (PC)',
      '  2  ○ SW-Office (Switch)  — VLAN 10',
      '  3  ○ Router-1 (Router)  — routed: 192.168.20.0/24 is on port 2',
    ]);
  });

  it('a trunk towards a device that expects no tag is named as the problem', () => {
    for (const port of [1, 2]) run(`interface ${port} access 10 on SW-Office`);
    expect(output('interface 8 trunk 10,20 on SW-Office')).toEqual([
      'port 8 on SW-Office is now a trunk carrying VLANs [10,20]',
    ]);
    expect(portOf('SW-Office', 8)).toMatchObject({ portType: 'trunk', vlan: [10, 20] });
    expect(verdict('ping Web-01 from PC-1')).toBe(
      'Ping failed (blocked): request: Router-1 receives traffic tagged VLAN 10 ' +
        '(port 8 on SW-Office is a trunk) and does not expect a tag'
    );
  });

  it('lists the VLANs with the ports they live on', () => {
    expect(output('show vlans')).toEqual(['no VLANs configured (all traffic untagged)']);

    for (const port of [1, 2]) run(`interface ${port} access 10 on SW-Office`);
    run('interface 8 trunk 10,20 on SW-Office');
    run('interface 7 trunk all on SW-Office');
    run('add vlan 20 to SW-Servers');
    expect(output('show vlans')).toEqual([
      'VLAN   MEMBERS',
      '1      SW-Office (ports 3,4,5,6)',
      '10     SW-Office (ports 1,2; trunk 8)',
      '20     SW-Office (trunk 8), SW-Servers',
      '  SW-Office port 7 is a trunk for every VLAN',
    ]);
  });

  it('shows the VLAN of every port once the switch applies them', () => {
    const vlanColumn = () =>
      output('show ports of SW-Office')
        .slice(1)
        .map(row => row.trim().split(/\s+/)[3]);

    expect(vlanColumn()).toEqual(['-', '-', '-', '-', '-', '-', '-', '-']);
    run('interface 1 access 10 on SW-Office');
    run('interface 8 trunk 10,20 on SW-Office');
    run('interface 7 trunk all on SW-Office');
    expect(vlanColumn()).toEqual(['10', '1', '1', '1', '1', '1', 'all', '10,20']);
  });

  it('takes the VLAN off again, and says when the switch is back to plain forwarding', () => {
    run('interface 1 access 10 on SW-Office');
    run('interface 2 access 10 on SW-Office');
    expect(output('interface 1 default on SW-Office')).toEqual(['port 1 on SW-Office has no VLAN of its own now']);
    expect(portOf('SW-Office', 1).vlan).toBeUndefined();
    expect(output('interface 2 default on SW-Office')).toEqual([
      'port 2 on SW-Office has no VLAN of its own now',
      '  no port of SW-Office has a VLAN any more: it forwards everything as it comes',
    ]);
    expect(verdict('ping Web-01 from PC-1')).toBe('Reply from 192.168.20.10: hops=5 time=7ms');
  });

  it('a trunk for every VLAN is written without a list', () => {
    expect(output('interface 8 trunk all on SW-Office')).toEqual([
      'port 8 on SW-Office is now a trunk carrying every VLAN',
    ]);
    const port = portOf('SW-Office', 8);
    expect(port.portType).toBe('trunk');
    expect(port.vlan).toBeUndefined();
  });

  it('keeps VLANs to switch ports', () => {
    expect(output('interface eth0 access 10 on PC-1')).toEqual([
      'VLANs are set on the ports of a switch: PC-1 is a PC',
    ]);
    expect(output('interface 1 trunk 10,20 on Router-1')).toEqual([
      'VLANs are set on the ports of a switch: Router-1 is a Router',
    ]);
    expect(output('interface 9 access 10 on SW-Office')).toEqual([
      'SW-Office has no interface "9" (it has: ports 1-8)',
    ]);
  });
});

// ---------- firewall ----------

describe('a firewall at the edge, from the terminal', () => {
  /** Ext — FW-1 — Router-1: FW-1 port 1 trust towards the router, port 2 untrust towards Ext */
  function cableEdge(): void {
    addGear('FW-1', 'Firewall');
    addPc('Ext', '203.0.113.50', '203.0.113.1');
    // cabled before the ports get their zones: a zoned firewall is never bound by guess
    expect(output('connect Router-1 to FW-1')).toEqual(['connected Router-1 (port 3) ↔ FW-1 (port 1)']);
    expect(output('connect Ext to FW-1')).toEqual(['connected Ext (eth0) ↔ FW-1 (port 2)']);
    run('interface 3 ip 10.0.0.1/30 on Router-1');
    run('interface 1 ip 10.0.0.2/30 on FW-1');
    run('interface 2 ip 203.0.113.1/24 on FW-1');
    expect(output('interface 1 zone trust on FW-1')).toEqual(['port 1 on FW-1 is now in zone trust']);
    expect(output('interface 2 zone untrust on FW-1')).toEqual(['port 2 on FW-1 is now in zone untrust']);
    run('set gateway of Router-1 to 10.0.0.2');
    run('add route 192.168.0.0/16 via 10.0.0.1 on FW-1');
  }

  it('lets the inside out and keeps the outside out', () => {
    cableEdge();
    expect(verdict('ping Ext from PC-1')).toBe('Reply from 203.0.113.50: hops=5 time=7ms');
    expect(transcript('ping Web-01 from Ext')).toEqual([
      'Pinging Web-01 (192.168.20.10) from Ext...',
      'Ping failed (blocked): request: firewall policy on FW-1: untrust → trust denied',
      '  dropped at: FW-1',
    ]);
  });

  it('publishes the web server with one rule: web gets in, ping does not', () => {
    cableEdge();
    expect(output('add rule allow web from untrust to Web-01 on FW-1')).toEqual([
      'FW-1: rule 1 added — allow web from untrust to 192.168.20.10',
      '  Web-01 → 192.168.20.10',
    ]);

    expect(transcript('browse Web-01 from Ext')).toEqual([
      'Browsing Web-01 (192.168.20.10) from Ext...',
      '  ✓ HTTP request: Ext → Web-01',
      '  ✓ HTTP response: Web-01 → Ext',
      'Page received from Web-01',
      '  note: HTTP request: firewall FW-1: allowed by rule 1 (allow web from untrust to 192.168.20.10)',
      '  note: HTTP response: firewall FW-1: no rule matches, zone policy trust → untrust allowed',
    ]);
    expect(verdict('ping Web-01 from Ext')).toBe(
      'Ping failed (blocked): request: firewall FW-1: no rule matches, zone policy untrust → trust denied'
    );
    // the rule names the server: its neighbour stays closed
    expect(verdict('browse Mail-01 from Ext')).toBe(
      'Browse failed (blocked): HTTP request: firewall FW-1: no rule matches, zone policy untrust → trust denied'
    );
  });

  it('traces one service through the firewall, hop by hop', () => {
    cableEdge();
    run('add rule allow web from untrust to Web-01 on FW-1');
    const lines = transcript('trace Web-01 from Ext as web');
    expect(lines[0]).toBe('Tracing route to Web-01 (192.168.20.10) from Ext as web:');
    expect(lines).toContain(
      '  2  ○ FW-1 (Firewall)  — routed: 192.168.0.0/16 via 10.0.0.1 (port 1); ' +
        'firewall FW-1: allowed by rule 1 (allow web from untrust to 192.168.20.10)'
    );
    expect(lines[lines.length - 1]).toBe('Trace complete: destination reached.');

    // the same trace as a ping stops at the firewall
    expect(transcript('trace Web-01 from Ext')).toContain(
      '  2  ✗ FW-1 (Firewall)  — firewall FW-1: no rule matches, zone policy untrust → trust denied'
    );
  });

  it('a rule put first overrides the ones after it; removing it brings them back', () => {
    cableEdge();
    run('add rule allow web from untrust to Web-01 on FW-1');
    expect(output('add rule 1 deny any from 203.0.113.50 to any on FW-1')).toEqual([
      'FW-1: rule 1 added — deny any from 203.0.113.50 to any',
    ]);
    expect(device('FW-1').firewallRules?.map(r => r.action)).toEqual(['deny', 'allow']);
    expect(verdict('browse Web-01 from Ext')).toBe(
      'Browse failed (blocked): HTTP request: firewall FW-1: denied by rule 1 (deny any from 203.0.113.50 to any)'
    );

    expect(output('remove rule 1 from FW-1')).toEqual([
      'FW-1: rule 1 removed — deny any from 203.0.113.50 to any',
    ]);
    expect(verdict('browse Web-01 from Ext')).toBe('Page received from Web-01');
  });

  it('lists the rules in order, with what decides after them', () => {
    cableEdge();
    expect(output('show rules of FW-1')).toEqual([
      'RULES of FW-1 (the first that matches decides)',
      '  no rules',
      '  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed',
      '  the reply to an allowed flow always passes',
    ]);

    run('add rule allow web from untrust to Web-01 on FW-1');
    run('add rule deny from 203.0.113.0/24 to any on FW-1');
    expect(output('show rules of FW-1').slice(1, 3)).toEqual([
      '   1  allow web    from untrust            to 192.168.20.10',
      '   2  deny  any    from 203.0.113.0/24     to any',
    ]);
    expect(output('show rules of Router-1')).toEqual([
      'Router-1 is not a firewall and has no rules: it filters nothing',
    ]);
  });

  it('stores a network without its host bits and an address as it is', () => {
    cableEdge();
    run('add rule allow ping from 203.0.113.77/24 to 192.168.20.10 on FW-1');
    expect(device('FW-1').firewallRules).toEqual([
      { id: 'rule-1', action: 'allow', service: 'ping', source: '203.0.113.0/24', destination: '192.168.20.10' },
    ]);
  });

  it('says when a rule names a zone that no port is in', () => {
    cableEdge();
    expect(output('add rule allow web from untrust to dmz on FW-1')).toEqual([
      'FW-1: rule 1 added — allow web from untrust to dmz',
      '  no port of FW-1 is in zone dmz yet: interface <n> zone dmz on FW-1',
    ]);
  });

  it('refuses rules that cannot be, and positions that do not exist', () => {
    cableEdge();
    expect(output('add rule allow web from wan to Web-01 on FW-1')).toEqual([
      '"wan" is not any, a zone (trust, untrust, dmz), an address, a network or a device',
    ]);
    expect(output('add rule allow web from untrust to dmz on PC-1')).toEqual([
      'PC-1 is a PC: rules belong on firewalls',
    ]);
    expect(output('add rule 3 allow web from untrust to dmz on FW-1')).toEqual([
      'FW-1 has no rules yet: the first one goes at position 1',
    ]);
    expect(output('remove rule 1 from FW-1')).toEqual(['FW-1 has no rules']);
    run('add rule allow web from untrust to trust on FW-1');
    expect(output('add rule 4 deny from any to any on FW-1')).toEqual([
      'FW-1 has 1 rule: the position must be 1-2',
    ]);
    expect(output('remove rule 5 from FW-1')).toEqual(['FW-1 has no rule 5 (it has 1)']);
    expect(device('FW-1').firewallRules).toHaveLength(1);
  });

  it('keeps zones to firewall ports', () => {
    expect(output('interface 1 zone trust on Router-1')).toEqual([
      'security zones are set on the ports of a firewall: Router-1 is a Router',
    ]);
  });

  it('takes a port out of its zone', () => {
    cableEdge();
    expect(output('interface 2 zone none on FW-1')).toEqual(['port 2 on FW-1 is in no security zone now']);
    expect(portOf('FW-1', 2).securityZone).toBeUndefined();
  });
});

// ---------- flows ----------

describe('NAT, from the terminal', () => {
  // The sample of the welcome screen: a firewall that does NAT towards the
  // Internet and publishes the portal (web) and the mail server (email)
  beforeEach(() => {
    const store = useNetworkStore.getState();
    store.clearAllDevices();
    const sample = createCompanySample();
    store.loadTopology(sample.devices, sample.connections);
  });

  it('shows which interfaces translate and what is published', () => {
    expect(output('show nat FW-Edge')).toEqual([
      'NAT of FW-Edge',
      '  interface 3   what leaves by it takes the address 203.0.113.1',
      'FORWARDS (the first that matches is taken)',
      '   1  web    from interface 3   (203.0.113.1) to 172.16.0.10',
      '   2  email  from interface 3   (203.0.113.1) to 192.168.30.40',
    ]);
    expect(output('show nat Router-Core')).toEqual([
      'NAT of Router-Core',
      '  no interface does NAT: what leaves keeps its own address',
      'FORWARDS (the first that matches is taken)',
      '  none: from outside only the device itself is reached',
    ]);
    expect(output('show nat SW-Core')).toEqual(['SW-Core is a Switch: it translates no addresses']);
  });

  it('counts it in the configuration of the device, and only where there is some', () => {
    expect(output('show config FW-Edge')).toContain(
      '  nat:      on interface 3, 2 forwards — "show nat FW-Edge" for detail'
    );
    expect(output('show config Router-Core').join(' ')).not.toContain('nat:');
  });

  it('a trace shows the address a packet leaves with', () => {
    expect(transcript('trace Cliente-Remoto from PC-Vendite')).toEqual([
      'Tracing route to Cliente-Remoto (203.0.113.50) from PC-Vendite:',
      '  1  ○ PC-Vendite (PC)',
      '  2  ○ SW-Uffici (Switch)  — VLAN 10',
      '  3  ○ SW-Core (Switch)  — VLAN 10',
      '  4  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 4)',
      '  5  ○ FW-Edge (Firewall)  — routed: 203.0.113.0/24 is on port 3; ' +
        'firewall FW-Edge: no rule matches, zone policy trust → untrust allowed; ' +
        'NAT: source 192.168.10.12 → 203.0.113.1',
      '  6  ○ Internet (Cloud)  — Internet is not simulated: traffic assumed to pass',
      '  7  ● Cliente-Remoto (PC)',
      '  note: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed',
      '  note: Internet is not simulated: traffic assumed to pass',
      'Trace complete: destination reached.',
    ]);
  });

  it('switching NAT off on the port that faces the Internet cuts the inside off, and says why', () => {
    expect(verdict('ping Cliente-Remoto from PC-Vendite')).toBe('Reply from 203.0.113.50: hops=7 time=11ms');

    expect(output('interface 3 nat off on FW-Edge')).toEqual([
      'port 3 on FW-Edge no longer does NAT: what leaves by it keeps its own address',
    ]);
    expect(portOf('FW-Edge', 3).nat).toBeUndefined();
    expect(output('interface 3 nat off on FW-Edge')).toEqual(['port 3 on FW-Edge does no NAT already']);

    expect(transcript('ping Cliente-Remoto from PC-Vendite').slice(0, 3)).toEqual([
      'Pinging Cliente-Remoto (203.0.113.50) from PC-Vendite...',
      'Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.12 has to be ' +
        'translated before it goes out, and NAT is off on port 3 on FW-Edge',
      '  dropped at: Internet',
    ]);

    expect(output('interface 3 nat on FW-Edge')).toEqual([
      'port 3 on FW-Edge now does NAT: what leaves by it takes the address 203.0.113.1',
    ]);
    expect(portOf('FW-Edge', 3).nat).toBe(true);
    expect(output('interface 3 nat on on FW-Edge')).toEqual(['port 3 on FW-Edge already does NAT']);
    expect(verdict('ping Cliente-Remoto from PC-Vendite')).toBe('Reply from 203.0.113.50: hops=7 time=11ms');
  });

  it('NAT on a port without an address is written, with a warning', () => {
    expect(output('interface 4 nat on FW-Edge')).toEqual([
      'port 4 on FW-Edge now does NAT',
      '  it has no address yet: nothing is translated until it has one (interface 4 ip <address>)',
    ]);
    expect(portOf('FW-Edge', 4).nat).toBe(true);
    expect(output('show nat FW-Edge')).toContain('  interface 4   has no address: it translates nothing');
  });

  it('NAT belongs on the ports of a router or a firewall', () => {
    expect(output('interface 2 nat on SW-Core')).toEqual([
      'NAT is set on the ports of a router or a firewall: SW-Core is a Switch',
    ]);
    expect(output('interface eth0 nat on PC-Vendite')).toEqual([
      'NAT is set on the ports of a router or a firewall: PC-Vendite is a PC',
    ]);
    expect(portOf('SW-Core', 2).nat).toBeUndefined();
  });

  it('who is outside is sent to the address that publishes the server, and told so', () => {
    expect(transcript('browse Portale-Clienti from Cliente-Remoto')).toEqual([
      'Browsing Portale-Clienti (203.0.113.1) from Cliente-Remoto...',
      '  ✓ HTTP request: Cliente-Remoto → Portale-Clienti',
      '  ✓ HTTP response: Portale-Clienti → Cliente-Remoto',
      'Page received from Portale-Clienti',
      '  note: HTTP request: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)',
      '  note: HTTP request: Internet is not simulated: traffic assumed to pass',
      '  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)',
      '  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed',
      '  note: HTTP response: Internet is not simulated: traffic assumed to pass',
    ]);
    expect(transcript('trace Portale-Clienti from Cliente-Remoto as web')).toEqual([
      'Tracing route to Portale-Clienti (203.0.113.1) from Cliente-Remoto as web:',
      '  1  ○ Cliente-Remoto (PC)',
      '  2  ○ Internet (Cloud)  — Internet is not simulated: traffic assumed to pass',
      '  3  ○ FW-Edge (Firewall)  — NAT: destination 203.0.113.1 → 172.16.0.10 (port forward 1); ' +
        'routed: 172.16.0.0/24 is on port 2; ' +
        'firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)',
      '  4  ○ SW-DMZ (Switch)',
      '  5  ● Portale-Clienti (Server)',
      '  note: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)',
      '  note: Internet is not simulated: traffic assumed to pass',
      '  note: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)',
      'Trace complete: destination reached.',
    ]);
  });

  it('the public address, typed, is answered by the server it is published for', () => {
    expect(transcript('browse 203.0.113.1 from Cliente-Remoto').slice(0, 5)).toEqual([
      'Browsing Portale-Clienti (203.0.113.1) from Cliente-Remoto...',
      '  ✓ HTTP request: Cliente-Remoto → Portale-Clienti',
      '  ✓ HTTP response: Portale-Clienti → Cliente-Remoto',
      'Page received from Portale-Clienti',
      '  note: 203.0.113.1 is FW-Edge, which forwards web to Portale-Clienti (port forward 1)',
    ]);
  });

  it('a ping is not published: the name fails with the reason, the firewall itself answers', () => {
    expect(transcript('ping Portale-Clienti from Cliente-Remoto')).toEqual([
      'Pinging Portale-Clienti (172.16.0.10) from Cliente-Remoto...',
      'Ping failed (blocked): request: Internet does not carry private addresses: 172.16.0.10 is not ' +
        'reachable from outside: no port forward publishes it for ping',
      '  dropped at: Internet',
    ]);
    expect(transcript('ping FW-Edge from Cliente-Remoto')).toEqual([
      'Pinging FW-Edge (203.0.113.1) from Cliente-Remoto...',
      'Reply from 203.0.113.1: hops=3 time=3ms',
      '  note: request: FW-Edge is reached from outside at 203.0.113.1, its public address',
      '  note: request: Internet is not simulated: traffic assumed to pass',
      '  note: reply: Internet is not simulated: traffic assumed to pass',
    ]);
  });

  it('removing the forward closes the way in; writing it again, by the name of the server, opens it', () => {
    expect(output('remove forward 1 from FW-Edge')).toEqual([
      'FW-Edge: forward 1 removed — forward web from interface 3 to 172.16.0.10',
    ]);
    expect(verdict('browse Portale-Clienti from Cliente-Remoto')).toBe(
      'Browse failed (blocked): HTTP request: Internet does not carry private addresses: 172.16.0.10 is not ' +
        'reachable from outside: no port forward publishes it for web'
    );

    expect(output('add forward web from interface 3 to Portale-Clienti on FW-Edge')).toEqual([
      'FW-Edge: forward 2 added — forward web from interface 3 to 172.16.0.10',
      '  Portale-Clienti → 172.16.0.10',
      '  from outside it is reached at 203.0.113.1',
    ]);
    expect(device('FW-Edge').portForwards).toEqual([
      { id: 'forward-2', service: 'email', port: 3, to: '192.168.30.40', description: 'posta in arrivo' },
      { id: 'forward-1', service: 'web', port: 3, to: '172.16.0.10' },
    ]);
    expect(verdict('browse Portale-Clienti from Cliente-Remoto')).toBe('Page received from Portale-Clienti');
    expect(output('add forward web from interface 3 to 172.16.0.10 on FW-Edge')).toEqual([
      'FW-Edge already has it: forward 2',
    ]);
  });

  it('warns about a forward an earlier one hides, and about a firewall with no rule for it', () => {
    expect(output('add forward any from interface 3 to Srv-Auth on FW-Edge')).toEqual([
      'FW-Edge: forward 3 added — forward any from interface 3 to 192.168.30.10',
      '  Srv-Auth → 192.168.30.10',
      '  from outside it is reached at 203.0.113.1',
      '  warning: forward 1 comes first for the same interface and service',
      '  a firewall also needs a rule that lets it in: add rule allow any from untrust to 192.168.30.10 on FW-Edge',
    ]);
    // on a router there is nothing to remind: it does not filter
    expect(output('add forward web from interface 3 to 192.168.30.30 on Router-Core')).toEqual([
      'Router-Core: forward 1 added — forward web from interface 3 to 192.168.30.30',
      '  from outside it is reached at 192.168.30.1',
    ]);
  });

  it('refuses a forward that cannot work, and writes nothing', () => {
    const before = device('FW-Edge').portForwards;
    expect(output('add forward ping from port 9 to 172.16.0.10 on FW-Edge')).toEqual([
      'FW-Edge has no interface "9" (it has: ports 1-4)',
    ]);
    expect(output('add forward ping from interface 3 to nowhere on FW-Edge')).toEqual([
      '"nowhere" is not an address or a device',
    ]);
    expect(output('add forward ping from interface 3 to Internet on FW-Edge')).toEqual([
      'Internet has no address to forward to',
    ]);
    expect(output('add forward ping from interface 3 to 203.0.113.1 on FW-Edge')).toEqual([
      '203.0.113.1 is the address of interface 3 itself',
    ]);
    expect(output('add forward ping from interface 4 to 172.16.0.10 on FW-Edge')).toEqual([
      'interface 4 on FW-Edge has no address to publish',
    ]);
    expect(output('add forward web from interface 1 to 172.16.0.10 on SW-Core')).toEqual([
      'SW-Core is a Switch: forwards belong on routers and firewalls',
    ]);
    expect(output('add forward web from interface 3 to 172.16.0.10')).toEqual([
      'specify a device: "add forward web from interface 3 to 172.16.0.10 on <device>"',
    ]);
    expect(device('FW-Edge').portForwards).toEqual(before);
    expect(device('SW-Core').portForwards).toBeUndefined();
  });

  it('removes by number, and says when there is no such forward', () => {
    expect(output('remove forward 9 from FW-Edge')).toEqual(['FW-Edge has no forward 9 (it has 2)']);
    expect(output('remove forward 1 from SW-Core')).toEqual(['SW-Core has no forwards']);
    expect(output('remove forward 2 from FW-Edge')).toEqual([
      'FW-Edge: forward 2 removed — forward email from interface 3 to 192.168.30.40',
    ]);
    expect(output('remove forward 1 from FW-Edge')).toEqual([
      'FW-Edge: forward 1 removed — forward web from interface 3 to 172.16.0.10',
    ]);
    // the last one leaves the device without the list
    expect(device('FW-Edge').portForwards).toBeUndefined();
  });

  it('works in the context of the device', () => {
    const inFirewall: TerminalContext = { deviceLabel: 'FW-Edge' };
    expect(output('interface 3 nat off', inFirewall)).toEqual([
      'port 3 on FW-Edge no longer does NAT: what leaves by it keeps its own address',
    ]);
    expect(output('interface 3 nat', inFirewall)).toEqual([
      'port 3 on FW-Edge now does NAT: what leaves by it takes the address 203.0.113.1',
    ]);
    expect(output('show nat', inFirewall)[0]).toBe('NAT of FW-Edge');
    expect(output('remove forward 2', inFirewall)).toEqual([
      'FW-Edge: forward 2 removed — forward email from interface 3 to 192.168.30.40',
    ]);
    expect(output('add forward email from 3 to Mail', inFirewall)).toEqual([
      'FW-Edge: forward 2 added — forward email from interface 3 to 192.168.30.40',
      '  Mail → 192.168.30.40',
      '  from outside it is reached at 203.0.113.1',
    ]);
  });

  it('is in the help', () => {
    expect(output('help nat').map(row => row.split('  ')[0])).toEqual([
      'show routes | rules | nat [of] <device>',
      'interface <n> nat [off] on <device>',
    ]);
    expect(output('help forward')).toHaveLength(1);
    // the longest line of the reference still fits its column
    for (const [syntax] of COMMAND_REFERENCE) expect(syntax.length, syntax).toBeLessThanOrEqual(58);
  });
});

describe('browse, mail, download', () => {
  it('runs a whole exchange and reports each leg', () => {
    expect(transcript('browse Web-01 from PC-1')).toEqual([
      'Browsing Web-01 (192.168.20.10) from PC-1...',
      '  ✓ HTTP request: PC-1 → Web-01',
      '  ✓ HTTP response: Web-01 → PC-1',
      'Page received from Web-01',
    ]);
    expect(transcript('download Web-01 from PC-1').slice(1)).toEqual([
      '  ✓ download request: PC-1 → Web-01',
      '  ✓ download data: Web-01 → PC-1',
      'Download complete from Web-01',
    ]);
    expect(transcript('mail PC-2 from PC-1')).toEqual([
      'Mailing PC-2 (192.168.10.12) from PC-1...',
      '  ✓ SMTP submit: PC-1 → Mail-01',
      '  ✓ delivery: Mail-01 → PC-2',
      'Mail delivered to PC-2',
    ]);
  });

  it('animates the exchange in the colour of its flow', () => {
    expect(run('browse Web-01 from PC-1').liveTrace?.flowModel).toBe('web');
    expect(run('mail PC-2 from PC-1').liveTrace?.flowModel).toBe('email');
    expect(run('download Web-01 from PC-1').liveTrace?.flowModel).toBe('download');
    expect(run('trace Web-01 from PC-1 as web').liveTrace?.flowModel).toBe('web');
    expect(run('trace Web-01 from PC-1').liveTrace?.flowModel).toBe('ping');
  });

  it('marks the leg that failed and says where the packet was dropped', () => {
    run('interface eth0 gateway none on Web-01');
    expect(transcript('browse Web-01 from PC-1')).toEqual([
      'Browsing Web-01 (192.168.20.10) from PC-1...',
      '  ✓ HTTP request: PC-1 → Web-01',
      '  ✗ HTTP response: Web-01 → PC-1',
      'Browse failed (blocked): HTTP response: no default gateway configured on Web-01',
      '  dropped at: Web-01',
    ]);
  });

  it('uses the device of the context as the source', () => {
    expect(verdict('browse Web-01', { deviceLabel: 'PC-1' })).toBe('Page received from Web-01');
    expect(output('browse Web-01')).toEqual([
      'specify a source: "browse Web-01 from <device>" — or enter a device context with "use <device>"',
    ]);
  });
});

// ---------- help ----------

describe('help', () => {
  it('prints every line of the command reference', () => {
    const printed = output('help');
    // (the version is written once, in ./types: see executor.dhcp.test for what holds it to the reference)
    expect(printed[0]).toBe(`PixelCake terminal — NCL v${NCL_VERSION} (Network Command Language, vendor-neutral)`);
    for (const [syntax, description] of COMMAND_REFERENCE) {
      expect(printed.some(row => row.includes(syntax) && row.includes(description))).toBe(true);
    }
  });

  it('finds the commands about one word', () => {
    expect(output('help route').map(row => row.split('  ')[0])).toEqual([
      'show routes | rules | nat [of] <device>',
      'add route <network>|default via <next hop> on <device>',
      'add backup route <network> via <next hop> on <device>',
    ]);
    expect(output('help rule')).toHaveLength(2);
    expect(output('help zone')).toHaveLength(1);
  });

  it('documents only commands the parser accepts', () => {
    // one concrete command per reference line: none may come back as unknown
    const examples = [
      'ping Web-01 from PC-1',
      'trace Web-01 from PC-1 as web',
      'browse Web-01 from PC-1',
      'mail PC-2 from PC-1',
      'download Web-01 from PC-1',
      'show devices',
      'show vlans',
      'show connections',
      'show interfaces of PC-1',
      'show ip of PC-1',
      'show routes of Router-1',
      'show rules of Router-1',
      'show nat of Router-1',
      'show config PC-1',
      'show ports SW-Office',
      'show neighbors PC-1',
      'set name of PC-2 to PC-Two',
      'interface 4 down on SW-Office',
      'enable port 4 on SW-Office',
      'interface 4 ip 10.9.9.1/24 on Router-1',
      'interface 4 access 30 on SW-Office',
      'interface 5 trunk 30,40 on SW-Office',
      'interface 5 trunk all on SW-Office',
      'interface 4 default on SW-Office',
      'interface 4 nat on Router-1',
      'interface 4 nat off on Router-1',
      'add forward web from interface 1 to 192.168.20.10 on Router-1',
      'remove forward 1 from Router-1',
      'add route default via 192.168.20.10 on Router-1',
      'add backup route default via 192.168.10.11 on Router-1',
      'remove route default via 192.168.10.11 from Router-1',
      'remove route default from Router-1',
      'add vlan 30 to SW-Office',
      'remove vlan 30 from SW-Office',
      'connect SW-Office to SW-Servers',
      'disconnect SW-Office from SW-Servers',
      'use PC-1',
      'exit',
      'clear',
      'help ping',
    ];
    for (const example of examples) {
      const first = transcript(example)[0] ?? '';
      expect(first, example).not.toContain('unknown command');
    }
  });
});
