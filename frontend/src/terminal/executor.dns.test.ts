/**
 * Terminal executor tests for DNS: the records of a server, the DNS server a
 * card asks, the one a pool hands out, the lookup alone (`resolve`), a name
 * where a target goes, and what the `show` commands then say.
 *
 * The commands that write are tried on the small sample network:
 *
 *            Router-1
 *     port 1 /       \ port 2
 *   192.168.10.1     192.168.20.1
 *        |                |
 *    SW-Office        SW-Servers
 *     /     \          /      \
 *  PC-1    PC-2     Web-01   Mail-01
 *  .11     .12       .10       .20
 *
 * and the names on the company sample of the welcome screen, where Srv-Auth
 * keeps three of them and the offices and the laptops ask it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMMAND_REFERENCE, executeCommand } from './executor';
import type { ExecutionResult, TerminalContext } from './executor';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import type { NetworkDevice, NetworkInterfaceCard } from '@/types';

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

/** Everything a command ends up printing, in the order it is printed */
function transcript(command: string, context: TerminalContext = GLOBAL): string[] {
  const result = run(command, context);
  const live = result.liveTrace;
  return [
    ...result.lines.map(l => l.text),
    ...(live ? [...(live.lookup?.lines ?? []), ...live.hopLines, ...live.finalLines].map(l => l.text) : []),
  ];
}

function device(label: string): NetworkDevice {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

const card = (label: string) => device(label).nics![0];
const labelOf = (id: string) => useNetworkStore.getState().devices.find(d => d.id === id)?.label ?? id;
/** The devices an animation goes through, by label */
const way = (result: ExecutionResult) => (result.liveTrace?.animationPath ?? []).map(labelOf).join(' > ');

function loadCompany() {
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createCompanySample();
  store.loadTopology(sample.devices, sample.connections);
}

const WEB = '192.168.20.10';
const MAIL = '192.168.20.20';
const LIMITS =
  '  a name is looked up each time it is used: no cache, no second server, no forwarding to another server';

/** Web-01 answers for two names, and PC-1 asks it */
function smallWithDns() {
  run(`add record www.azienda.example ${WEB} on Web-01`);
  run(`add record posta.azienda.example ${MAIL} on Web-01`);
  run(`interface eth0 dns ${WEB} on PC-1`);
}

beforeEach(() => {
  localStorage.clear();
  usePresentationStore.getState().exit();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createSampleTopology();
  store.loadTopology(sample.devices, sample.connections);
});

describe('add record', () => {
  it('gives a server a name to answer for, kept the way names are compared', () => {
    expect(output(`add record WWW.Azienda.Example. ${WEB} on Web-01`)).toEqual([
      'Web-01: record 1 added — www.azienda.example is 192.168.20.10',
    ]);
    expect(device('Web-01').dnsRecords).toEqual([{ id: 'record-1', name: 'www.azienda.example', address: WEB }]);
    expect(output(`add record posta.azienda.example to ${MAIL} on Web-01`)).toEqual([
      'Web-01: record 2 added — posta.azienda.example is 192.168.20.20',
    ]);
    expect(device('Web-01').dnsRecords?.map(record => record.id)).toEqual(['record-1', 'record-2']);
    expect(device('Mail-01').dnsRecords).toBeUndefined();
  });

  it('takes a device for the address it has, and says which', () => {
    expect(output('add record posta.azienda.example Mail-01 on Web-01')).toEqual([
      'Web-01: record 1 added — posta.azienda.example is 192.168.20.20',
      '  Mail-01 → 192.168.20.20',
    ]);
    expect(device('Web-01').dnsRecords?.[0].address).toBe(MAIL);
  });

  it('says so when the address of the device is a leased one', () => {
    run('interface 1 pool 192.168.10.100 to 192.168.10.199 on Router-1');
    run('interface eth0 dhcp on PC-1');
    expect(output('add record pc.azienda.example PC-1 on Web-01')).toEqual([
      'Web-01: record 1 added — pc.azienda.example is 192.168.10.100',
      '  PC-1 → 192.168.10.100 (leased by DHCP: it changes if the drawing does)',
    ]);
  });

  it('a name has one address: adding it again changes the one it has, and the same again changes nothing', () => {
    smallWithDns();
    expect(output(`add record WWW.azienda.example ${MAIL} on Web-01`)).toEqual([
      'Web-01: record 1 — www.azienda.example is now 192.168.20.20 (was 192.168.20.10)',
    ]);
    expect(device('Web-01').dnsRecords).toEqual([
      { id: 'record-1', name: 'www.azienda.example', address: MAIL },
      { id: 'record-2', name: 'posta.azienda.example', address: MAIL },
    ]);
    expect(output(`add record posta.azienda.example ${MAIL} on Web-01`)).toEqual([
      'Web-01 already has it: record 2',
    ]);
    expect(device('Web-01').dnsRecords).toHaveLength(2);
  });

  it('finds a name that is there however it was written, and keeps it the way names are compared', () => {
    useNetworkStore.getState().updateDevice(device('Web-01').id, {
      dnsRecords: [{ id: 'record-1', name: 'WWW.Azienda.Example', address: WEB }],
    });
    expect(output(`add record www.azienda.example ${MAIL} on Web-01`)).toEqual([
      'Web-01: record 1 — www.azienda.example is now 192.168.20.20 (was 192.168.20.10)',
    ]);
    expect(device('Web-01').dnsRecords).toEqual([{ id: 'record-1', name: 'www.azienda.example', address: MAIL }]);
  });

  it('a new record takes the lowest id not in use', () => {
    smallWithDns();
    run('remove record 1 from Web-01');
    run(`add record nas.azienda.example ${WEB} on Web-01`);
    expect(device('Web-01').dnsRecords?.map(record => record.id)).toEqual(['record-2', 'record-1']);
  });

  it('works on the server of the context', () => {
    expect(output(`add record www.azienda.example ${WEB}`, { deviceLabel: 'Web-01' })).toEqual([
      'Web-01: record 1 added — www.azienda.example is 192.168.20.10',
    ]);
  });

  it.each([
    [`add record www.azienda.example ${WEB} on PC-1`, 'PC-1 is a PC: records are kept by servers'],
    [`add record www.azienda.example ${WEB} on Router-1`, 'Router-1 is a Router: records are kept by servers'],
    [`add record gestionale ${WEB} on Web-01`, '"gestionale" is not a host name: write it with a dot, as in www.company.example'],
    [`add record ${WEB} ${WEB} on Web-01`, '"192.168.20.10" is not a host name: write it with a dot, as in www.company.example'],
    ['add record www.azienda.example nowhere on Web-01', '"nowhere" is not an address or a device'],
    ['add record www.azienda.example 192.168.20.300 on Web-01', '"192.168.20.300" is not an address or a device'],
    [`add record www.azienda.example ${WEB}`, `specify a device: "add record www.azienda.example ${WEB} on <server>"`],
    [`add record www.azienda.example ${WEB} on Nobody`, 'device not found: "Nobody"'],
  ])('refuses "%s"', (command, reason) => {
    expect(output(command)).toEqual([reason]);
    expect(useNetworkStore.getState().devices.some(d => d.dnsRecords)).toBe(false);
  });

  it('refuses a device that has no address for the name to stand for', () => {
    run('interface eth0 dhcp on Mail-01');
    expect(output('add record posta.azienda.example Mail-01 on Web-01')).toEqual([
      'Mail-01 has no address for a name to stand for',
    ]);
  });
});

describe('remove record', () => {
  beforeEach(smallWithDns);

  it('by its place in the list', () => {
    expect(output('remove record 1 from Web-01')).toEqual([
      'Web-01: record 1 removed — www.azienda.example is 192.168.20.10',
    ]);
    expect(device('Web-01').dnsRecords).toEqual([{ id: 'record-2', name: 'posta.azienda.example', address: MAIL }]);
  });

  it('by its name, whatever the case; with the last one the list is gone', () => {
    expect(output('remove record POSTA.azienda.example. from Web-01')).toEqual([
      'Web-01: record 2 removed — posta.azienda.example is 192.168.20.20',
    ]);
    expect(output('remove record 1', { deviceLabel: 'Web-01' })).toEqual([
      'Web-01: record 1 removed — www.azienda.example is 192.168.20.10',
    ]);
    expect(device('Web-01').dnsRecords).toBeUndefined();
  });

  it('says what is there when the record is not', () => {
    expect(output('remove record 3 from Web-01')).toEqual(['Web-01 has no record 3 (it has 2)']);
    expect(output('remove record 0 from Web-01')).toEqual(['Web-01 has no record 0 (it has 2)']);
    expect(output('remove record Intranet.azienda.example from Web-01')).toEqual([
      'Web-01 has no record for intranet.azienda.example',
    ]);
    expect(output('remove record 1 from Mail-01')).toEqual(['Mail-01 has no records']);
    expect(output('remove record 1 from PC-1')).toEqual(['PC-1 is a PC: records are kept by servers']);
    expect(output('remove record 1')).toEqual(['specify a device: "remove record 1 from <server>"']);
    expect(device('Web-01').dnsRecords).toHaveLength(2);
  });
});

describe('interface … dns', () => {
  it('names the DNS server a card asks', () => {
    expect(output(`interface eth0 dns ${WEB} on PC-1`)).toEqual(['interface eth0 on PC-1: DNS server 192.168.20.10']);
    expect(card('PC-1')).toMatchObject({ ip: '192.168.10.11', dns: WEB });
    expect(card('PC-2')).not.toHaveProperty('dns');
    expect(output(`interface eth0 dns ${WEB} on PC-1`)).toEqual(['interface eth0 on PC-1 already asks 192.168.20.10']);
    expect(output(`interface eth0 dns ${MAIL}`, { deviceLabel: 'PC-1' })).toEqual([
      'interface eth0 on PC-1: DNS server 192.168.20.20',
    ]);
    expect(card('PC-1').dns).toBe(MAIL);
  });

  it('"dns none" is nobody', () => {
    run(`interface eth0 dns ${WEB} on PC-1`);
    expect(output('interface eth0 dns none on PC-1')).toEqual(['interface eth0 on PC-1 asks no DNS server now']);
    expect(card('PC-1')).not.toHaveProperty('dns');
    expect(card('PC-1').ip).toBe('192.168.10.11');
    expect(output('interface eth0 dns none on PC-1')).toEqual(['interface eth0 on PC-1 asks no DNS server already']);
  });

  it('has to be an address, on a network card', () => {
    expect(output('interface eth0 dns web-01 on PC-1')).toEqual(['"web-01" is not a valid IPv4 address']);
    expect(card('PC-1')).not.toHaveProperty('dns');
    expect(output(`interface 1 dns ${WEB} on Router-1`)).toEqual([
      'port 1 on Router-1 is a port: a DNS server is named on a network card',
    ]);
    expect(output('interface 1 dns none on SW-Office')).toEqual([
      'port 1 on SW-Office is a port: a DNS server is named on a network card',
    ]);
    expect(device('Router-1').ports?.[0]).not.toHaveProperty('dns');
  });

  it('a card on DHCP is not told: its DNS server comes with the lease', () => {
    run('interface eth0 dhcp on PC-1');
    const refusal = [
      'interface eth0 on PC-1 takes its address from DHCP: the DNS server comes with the lease',
      '  it is the one of the pool: interface <n> pool <first> to <last> dns <address> on <server>',
    ];
    expect(output(`interface eth0 dns ${WEB} on PC-1`)).toEqual(refusal);
    expect(output('interface eth0 dns none on PC-1')).toEqual(refusal);
    expect(card('PC-1')).not.toHaveProperty('dns');
  });

  it('a card put on DHCP keeps none of its own', () => {
    run(`interface eth0 dns ${WEB} on PC-1`);
    run('interface eth0 dhcp on PC-1');
    expect(card('PC-1')).toMatchObject({ dhcp: true, ip: '' });
    expect(card('PC-1')).not.toHaveProperty('dns');
  });
});

describe('interface … pool … dns', () => {
  const POOL = 'interface 1 pool 192.168.10.100 to 192.168.10.199';

  it('a pool hands out the DNS server it names, which may be on another network', () => {
    expect(output(`${POOL} dns ${WEB} on Router-1`)).toEqual([
      'port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.199: 100 addresses, gateway 192.168.10.1, DNS server 192.168.20.10',
      '  no card on its network asks for an address yet: interface <name> dhcp on <device>',
    ]);
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({
      start: '192.168.10.100',
      end: '192.168.10.199',
      dns: WEB,
    });
    expect(output(`${POOL} gateway 192.168.10.254 dns ${WEB} on Router-1`)[0]).toBe(
      'port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.199: 100 addresses, gateway 192.168.10.254, DNS server 192.168.20.10'
    );
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({
      start: '192.168.10.100',
      end: '192.168.10.199',
      gateway: '192.168.10.254',
      dns: WEB,
    });
  });

  it('the same pool again changes nothing; the same range without the DNS server is another pool', () => {
    run(`${POOL} dns ${WEB} on Router-1`);
    expect(output(`${POOL} dns ${WEB} on Router-1`)).toEqual([
      'port 1 on Router-1 already hands out 192.168.10.100 to 192.168.10.199',
    ]);
    expect(output(`${POOL} on Router-1`)[0]).toBe(
      'port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.199: 100 addresses, gateway 192.168.10.1'
    );
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({ start: '192.168.10.100', end: '192.168.10.199' });
    expect(output(`${POOL} dns ${MAIL} on Router-1`)[0]).toContain('DNS server 192.168.20.20');
  });

  it('refuses a DNS server that is not an address', () => {
    expect(output(`${POOL} dns web-01 on Router-1`)).toEqual(['"web-01" is not an address']);
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();
  });

  it('the card that takes a lease says the DNS server it came with, and so do show ip and show dhcp', () => {
    run(`${POOL} dns ${WEB} on Router-1`);
    expect(output('interface eth0 dhcp on PC-1')).toEqual([
      'interface eth0 on PC-1 now takes its address from DHCP',
      '  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10 by Router-1 port 1',
    ]);
    expect(output('show ip PC-1')[4]).toBe(
      '  eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10 (dhcp from Router-1 port 1)'
    );
    expect(output('show config PC-1')).toContain(
      '  nic eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10 (dhcp from Router-1 port 1)'
    );
    expect(output('show dhcp')[2]).toBe(
      '  Router-1 port 1        192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.20.10  1 leased, 99 free of 100'
    );
  });
});

describe('resolve', () => {
  beforeEach(smallWithDns);

  it('asks the DNS server of the device, across the network, and says what the name stands for', () => {
    const result = run('resolve www.azienda.example from PC-1');
    expect(result.lines.map(l => l.text)).toEqual([
      'Looking up www.azienda.example from PC-1 (DNS server 192.168.20.10)...',
    ]);
    expect(result.liveTrace?.finalLines.map(l => l.text)).toEqual([
      '  ✓ DNS request: PC-1 → Web-01',
      '  ✓ DNS reply: Web-01 → PC-1',
      'www.azienda.example is 192.168.20.10 (answered by Web-01)',
    ]);
    expect(result.liveTrace?.finalLines.map(l => l.tone)).toEqual(['normal', 'normal', 'success']);
    // the question travels on the drawing, there and back
    expect(way(result)).toBe(
      'PC-1 > SW-Office > Router-1 > SW-Servers > Web-01 > SW-Servers > Router-1 > SW-Office > PC-1'
    );
    expect(result.liveTrace?.animationLinks).toHaveLength(8);
    expect(result.liveTrace).toMatchObject({ flowModel: 'ping', hopLines: [] });
    expect(result.liveTrace?.lookup).toBeUndefined();
  });

  it('does not mind the case of the name, and is also "lookup" and "nslookup"', () => {
    const plain = transcript('resolve www.azienda.example from PC-1');
    expect(transcript('resolve WWW.Azienda.EXAMPLE. from PC-1')).toEqual(plain);
    expect(transcript('lookup www.azienda.example from PC-1')).toEqual(plain);
    expect(transcript('nslookup www.azienda.example', { deviceLabel: 'PC-1' })).toEqual(plain);
  });

  it('says that the server has no record for a name nobody wrote', () => {
    const result = run('resolve intranet.azienda.example from PC-1');
    expect(transcript('resolve intranet.azienda.example from PC-1')).toEqual([
      'Looking up intranet.azienda.example from PC-1 (DNS server 192.168.20.10)...',
      '  ✓ DNS request: PC-1 → Web-01',
      '  ✓ DNS reply: Web-01 → PC-1',
      'Lookup failed: Web-01 has no record for intranet.azienda.example',
    ]);
    expect(result.liveTrace?.finalLines.map(l => l.tone)).toEqual(['normal', 'normal', 'error']);
    expect(result.liveTrace?.animationPath).toHaveLength(9);
  });

  it('says so at once when the device has no DNS server: nothing travels', () => {
    const result = run('resolve www.azienda.example from PC-2');
    expect(result.lines.map(l => l.text)).toEqual([
      'Looking up www.azienda.example from PC-2...',
      'Lookup failed: PC-2 has no DNS server: it cannot look up www.azienda.example',
    ]);
    expect(result.lines.map(l => l.tone)).toEqual(['muted', 'error']);
    expect(result.liveTrace).toBeUndefined();
    expect(output('resolve www.azienda.example from Router-1')[1]).toBe(
      'Lookup failed: Router-1 has no DNS server: it cannot look up www.azienda.example'
    );
  });

  it('says when nobody has the address of the DNS server, and when who has it is not one', () => {
    run('interface eth0 dns 8.8.8.8 on PC-2');
    expect(transcript('resolve www.azienda.example from PC-2')).toEqual([
      'Looking up www.azienda.example from PC-2 (DNS server 8.8.8.8)...',
      'Lookup failed: PC-2 asks 8.8.8.8 for names, an address no device has',
    ]);
    run(`interface eth0 dns ${MAIL} on PC-2`);
    expect(transcript('resolve www.azienda.example from PC-2')).toEqual([
      'Looking up www.azienda.example from PC-2 (DNS server 192.168.20.20)...',
      '  ✓ DNS request: PC-2 → Mail-01',
      '  ✓ DNS reply: Mail-01 → PC-2',
      'Lookup failed: 192.168.20.20 is Mail-01, which is not a DNS server: it keeps no records',
    ]);
  });

  it('when the question does not arrive: the verdict and the reason of the trace, and where it stopped', () => {
    run('interface 2 down on Router-1');
    const result = run('resolve www.azienda.example from PC-1');
    expect(transcript('resolve www.azienda.example from PC-1')).toEqual([
      'Looking up www.azienda.example from PC-1 (DNS server 192.168.20.10)...',
      '  ✗ DNS request: PC-1 → Web-01',
      'Lookup failed (blocked): DNS request: port 2 on Router-1 is disabled',
      '  dropped at: Router-1',
    ]);
    // the question is seen to travel as far as it got
    expect(way(result)).toBe('PC-1 > SW-Office > Router-1');
    expect(result.liveTrace?.finalLines.map(l => l.tone)).toEqual(['error', 'error', 'muted']);
  });

  it('a question that never leaves the device is not animated', () => {
    run('interface eth0 gateway none on PC-1');
    const result = run('resolve www.azienda.example from PC-1');
    expect(result.lines.map(l => l.text)).toEqual([
      'Looking up www.azienda.example from PC-1 (DNS server 192.168.20.10)...',
      '  ✗ DNS request: PC-1 → Web-01',
      'Lookup failed (blocked): DNS request: no default gateway configured on PC-1',
      '  dropped at: PC-1',
    ]);
    expect(result.liveTrace).toBeUndefined();
  });

  it('a server that asks itself and then pings waits for nothing before the ping', () => {
    run(`interface eth0 dns ${WEB} on Web-01`);
    const result = run('ping posta.azienda.example from Web-01');
    expect(result.lines.map(l => l.text)).toEqual([
      'Looking up posta.azienda.example from Web-01 (DNS server 192.168.20.10)...',
      'posta.azienda.example is 192.168.20.20 (answered by Web-01 itself)',
      'Pinging Mail-01 (192.168.20.20) from Web-01...',
    ]);
    expect(way(result)).toBe('Web-01 > SW-Servers > Mail-01 > SW-Servers > Web-01');
    expect(result.liveTrace?.lookup).toBeUndefined();
    expect(result.liveTrace?.finalLines.map(l => l.text)).toEqual(['Reply from 192.168.20.20: hops=3 time=3ms']);
  });

  it('a server that is its own DNS server answers without sending anything', () => {
    run(`interface eth0 dns ${WEB} on Web-01`);
    const result = run('resolve posta.azienda.example from Web-01');
    expect(result.lines.map(l => l.text)).toEqual([
      'Looking up posta.azienda.example from Web-01 (DNS server 192.168.20.10)...',
      'posta.azienda.example is 192.168.20.20 (answered by Web-01 itself)',
    ]);
    expect(result.liveTrace).toBeUndefined();
  });

  it('needs a name and a device that asks', () => {
    expect(output('resolve www.azienda.example')).toEqual([
      'specify a source: "resolve www.azienda.example from <device>" — or enter a device context with "use <device>"',
    ]);
    expect(output('resolve gestionale from PC-1')).toEqual([
      '"gestionale" is not a host name: write it with a dot, as in www.company.example',
    ]);
    expect(output(`resolve ${WEB} from PC-1`)).toEqual([
      '"192.168.20.10" is not a host name: write it with a dot, as in www.company.example',
    ]);
    expect(output('resolve www.azienda.example from PC-9')[0]).toBe('device not found: "PC-9"');
  });

  it('a simulated failure breaks it like any other exchange', () => {
    const presentation = usePresentationStore.getState();
    presentation.enter();
    presentation.toggleDeviceFailure(device('Web-01').id);
    expect(transcript('resolve www.azienda.example from PC-1')).toContain(
      'Lookup failed (blocked): DNS request: Web-01 is down'
    );
    presentation.exit();
    expect(transcript('resolve www.azienda.example from PC-1')).toContain(
      'www.azienda.example is 192.168.20.10 (answered by Web-01)'
    );
  });
});

describe('a name where a target goes', () => {
  beforeEach(loadCompany);

  const LOOKUP = [
    '  ✓ DNS request: PC-Vendite → Srv-Auth',
    '  ✓ DNS reply: Srv-Auth → PC-Vendite',
    'gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)',
  ];
  const THERE = 'PC-Vendite > SW-Uffici > SW-Core > Router-Core > SW-Server';
  const BACK = 'SW-Server > Router-Core > SW-Core > SW-Uffici > PC-Vendite';

  it('ping: the name is looked up first, then the ping goes to the address it stands for', () => {
    const result = run('ping gestionale.azienda.example from PC-Vendite');
    expect(result.lines.map(l => l.text)).toEqual([
      'Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...',
    ]);
    // what the lookup found is printed when the question is back, before the ping leaves
    expect(result.liveTrace?.lookup).toEqual({
      hops: 10,
      lines: [...LOOKUP, 'Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...'].map(text =>
        expect.objectContaining({ text })
      ),
    });
    expect(result.liveTrace?.hopLines).toEqual([]);
    expect(result.liveTrace?.finalLines.map(l => l.text)).toEqual(['Reply from 192.168.30.30: hops=6 time=9ms']);
    // one animation: to the DNS server and back, then to the web server and back
    expect(way(result)).toBe(`${THERE} > Srv-Auth > ${BACK} > ${THERE.slice(13)} > Web-Gestionale > ${BACK}`);
    expect(result.liveTrace?.flowModel).toBe('ping');
  });

  it('every stretch of the animation is on the cable that joins its two devices', () => {
    const { liveTrace } = run('ping gestionale.azienda.example from PC-Vendite');
    const path = liveTrace?.animationPath ?? [];
    const links = liveTrace?.animationLinks ?? [];
    expect(links).toHaveLength(path.length - 1);
    const { connections } = useNetworkStore.getState();
    links.forEach((id, index) => {
      const cable = connections.find(connection => connection.id === id);
      expect([cable?.source, cable?.target].sort(), `stretch ${index}`).toEqual([path[index], path[index + 1]].sort());
    });
  });

  it('the ping is the one of the address typed by hand', () => {
    const named = run('ping gestionale.azienda.example from PC-Vendite').liveTrace;
    const typed = run('ping 192.168.30.30 from PC-Vendite');
    expect(named?.finalLines).toEqual(typed.liveTrace?.finalLines);
    expect(named?.lookup?.lines.slice(-1)).toEqual(typed.lines);
    expect(named?.animationPath.slice(10)).toEqual(typed.liveTrace?.animationPath);
    expect(named?.animationLinks?.slice(10)).toEqual(typed.liveTrace?.animationLinks);
    expect(typed.liveTrace?.lookup).toBeUndefined();
  });

  it('trace: its hops come after the lookup, each when the packet gets there', () => {
    const result = run('trace posta.azienda.example from Portatile-1');
    expect(result.lines.map(l => l.text)).toEqual([
      'Looking up posta.azienda.example from Portatile-1 (DNS server 192.168.30.10)...',
    ]);
    expect(result.liveTrace?.lookup?.hops).toBe(12);
    expect(result.liveTrace?.lookup?.lines.map(l => l.text)).toEqual([
      '  ✓ DNS request: Portatile-1 → Srv-Auth',
      '  ✓ DNS reply: Srv-Auth → Portatile-1',
      'posta.azienda.example is 192.168.30.40 (answered by Srv-Auth)',
      'Tracing route to Mail (192.168.30.40) from Portatile-1:',
    ]);
    expect(result.liveTrace?.hopLines.map(l => l.text)).toEqual([
      '  1  ○ Portatile-1 (PC)',
      '  2  ○ AP-Uffici (AccessPoint)',
      '  3  ○ SW-Uffici (Switch)  — VLAN 20',
      '  4  ○ SW-Core (Switch)  — VLAN 20',
      '  5  ○ Router-Core (Router)  — routed: 192.168.30.0/24 is on port 3',
      '  6  ○ SW-Server (Switch)  — VLAN 30',
      '  7  ● Mail (Server)',
    ]);
    expect(result.liveTrace?.finalLines.map(l => l.text)).toEqual(['Trace complete: destination reached.']);
    // 13 devices for the lookup, 7 for the trace, the laptop once between the two
    expect(result.liveTrace?.animationPath).toHaveLength(19);
    expect(labelOf(result.liveTrace?.animationPath[12] ?? '')).toBe('Portatile-1');
    expect(labelOf(result.liveTrace?.animationPath[18] ?? '')).toBe('Mail');
    expect(result.liveTrace?.animationLinks).toHaveLength(18);
    expect(result.liveTrace?.flowModel).toBe('ping');
    expect(run('trace posta.azienda.example from Portatile-1 as email').liveTrace?.flowModel).toBe('email');
  });

  it('browse, download and mail take a name the same way, each in the colour of its flow', () => {
    expect(transcript('browse portale.azienda.example from PC-Vendite')).toEqual([
      'Looking up portale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...',
      '  ✓ DNS request: PC-Vendite → Srv-Auth',
      '  ✓ DNS reply: Srv-Auth → PC-Vendite',
      'portale.azienda.example is 172.16.0.10 (answered by Srv-Auth)',
      'Browsing Portale-Clienti (172.16.0.10) from PC-Vendite...',
      '  ✓ HTTP request: PC-Vendite → Portale-Clienti',
      '  ✓ HTTP response: Portale-Clienti → PC-Vendite',
      'Page received from Portale-Clienti',
      '  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed',
      '  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)',
    ]);
    expect(run('browse portale.azienda.example from PC-Vendite').liveTrace).toMatchObject({
      flowModel: 'web',
      lookup: { hops: 10 },
    });
    expect(transcript('download gestionale.azienda.example from PC-Contabilità').slice(3)).toEqual([
      'gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)',
      'Downloading from Web-Gestionale (192.168.30.30) from PC-Contabilità...',
      '  ✓ download request: PC-Contabilità → Web-Gestionale',
      '  ✓ download data: Web-Gestionale → PC-Contabilità',
      'Download complete from Web-Gestionale',
    ]);
    expect(run('download gestionale.azienda.example from PC-Contabilità').liveTrace?.flowModel).toBe('download');
    expect(transcript('mail posta.azienda.example from PC-Vendite').slice(3)).toEqual([
      'posta.azienda.example is 192.168.30.40 (answered by Srv-Auth)',
      'Mailing Mail (192.168.30.40) from PC-Vendite...',
      '  ✓ SMTP submit: PC-Vendite → Mail',
      'Mail delivered to Mail',
    ]);
    expect(run('mail posta.azienda.example from PC-Vendite').liveTrace?.flowModel).toBe('email');
  });

  it('works from the device of the context, and from a laptop with the DNS server of its lease', () => {
    expect(transcript('ping gestionale.azienda.example', { deviceLabel: 'PC-Vendite' })).toEqual(
      transcript('ping gestionale.azienda.example from PC-Vendite')
    );
    expect(transcript('ping gestionale.azienda.example from Portatile-2').slice(-3)).toEqual([
      'gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)',
      'Pinging Web-Gestionale (192.168.30.30) from Portatile-2...',
      'Reply from 192.168.30.30: hops=7 time=11ms',
    ]);
  });

  it('when the lookup fails the command stops there, with the reason', () => {
    const result = run('browse intranet.azienda.example from PC-Vendite');
    expect(transcript('browse intranet.azienda.example from PC-Vendite')).toEqual([
      'Looking up intranet.azienda.example from PC-Vendite (DNS server 192.168.30.10)...',
      '  ✓ DNS request: PC-Vendite → Srv-Auth',
      '  ✓ DNS reply: Srv-Auth → PC-Vendite',
      'Lookup failed: Srv-Auth has no record for intranet.azienda.example',
    ]);
    // the question is animated, in the colour of the flow that did not start
    expect(way(result)).toBe(`${THERE} > Srv-Auth > ${BACK}`);
    expect(result.liveTrace).toMatchObject({ flowModel: 'web', hopLines: [] });
    expect(result.liveTrace?.lookup).toBeUndefined();
    expect(run('ping intranet.azienda.example from PC-Vendite').liveTrace?.flowModel).toBe('ping');
    expect(run('trace intranet.azienda.example from PC-Vendite as email').liveTrace?.flowModel).toBe('email');
  });

  it('a device with no DNS server gets the plain reason, and nothing travels', () => {
    for (const verb of ['ping', 'trace', 'browse', 'mail', 'download']) {
      const result = run(`${verb} portale.azienda.example from Cliente-Remoto`);
      expect(result.lines.map(l => l.text), verb).toEqual([
        'Looking up portale.azienda.example from Cliente-Remoto...',
        'Lookup failed: Cliente-Remoto has no DNS server: it cannot look up portale.azienda.example',
      ]);
      expect(result.liveTrace, verb).toBeUndefined();
    }
  });

  it('a name that stands for an address nobody has stops like an address nobody has', () => {
    run('add record fantasma.azienda.example 10.9.9.9 on Srv-Auth');
    expect(transcript('ping fantasma.azienda.example from PC-Vendite')).toEqual([
      'Looking up fantasma.azienda.example from PC-Vendite (DNS server 192.168.30.10)...',
      '  ✓ DNS request: PC-Vendite → Srv-Auth',
      '  ✓ DNS reply: Srv-Auth → PC-Vendite',
      'fantasma.azienda.example is 10.9.9.9 (answered by Srv-Auth)',
      'device not found: "10.9.9.9"',
    ]);
    expect(output('ping 10.9.9.9 from PC-Vendite')).toEqual(['device not found: "10.9.9.9"']);
  });

  it('a name that stands for a published address reaches the server the forward names', () => {
    run('add record www.azienda.example 203.0.113.1 on Srv-Auth');
    const named = transcript('browse www.azienda.example from PC-Vendite');
    expect(named.slice(3, 5)).toEqual([
      'www.azienda.example is 203.0.113.1 (answered by Srv-Auth)',
      'Browsing Portale-Clienti (203.0.113.1) from PC-Vendite...',
    ]);
    expect(named.slice(5)).toEqual(transcript('browse 203.0.113.1 from PC-Vendite').slice(1));
    expect(named).toContain(
      '  note: 203.0.113.1 is FW-Edge, which forwards web to Portale-Clienti (port forward 1)'
    );
  });

  it('a device is never looked up: its name comes first, even when it reads as a host name', () => {
    run('set name of NAS to nas.azienda.example');
    const result = run('ping nas.azienda.example from PC-Vendite');
    expect(result.lines.map(l => l.text)).toEqual(['Pinging nas.azienda.example (192.168.30.50) from PC-Vendite...']);
    expect(result.liveTrace?.lookup).toBeUndefined();
    // and neither is an address
    expect(run('ping 192.168.30.30 from PC-Vendite').lines.map(l => l.text)).toEqual([
      'Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...',
    ]);
  });

  it('what is neither a device nor a host name is still a device not found', () => {
    expect(output('ping qualcosa from PC-Vendite')).toEqual(['device not found: "qualcosa"']);
    expect(output('ping Web-Gestional from PC-Vendite')).toEqual([
      'device not found: "Web-Gestional"',
      '  did you mean "Web-Gestionale"?',
    ]);
    expect(output('ping gestionale.azienda.example')).toEqual([
      'specify a source: "ping gestionale.azienda.example from <device>" — or enter a device context with "use <device>"',
    ]);
    expect(output('ping gestionale.azienda.example from PC-Vendit')[0]).toBe('device not found: "PC-Vendit"');
  });

  it('a firewall on the way of the question decides as for any flow, and its notes are printed', () => {
    run('interface eth0 dns 192.168.30.10 on Portale-Clienti');
    expect(transcript('resolve posta.azienda.example from Portale-Clienti')).toEqual([
      'Looking up posta.azienda.example from Portale-Clienti (DNS server 192.168.30.10)...',
      '  ✗ DNS request: Portale-Clienti → Srv-Auth',
      'Lookup failed (blocked): DNS request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied',
      '  dropped at: FW-Edge',
    ]);
    expect(output('add rule allow dns from Portale-Clienti to Srv-Auth on FW-Edge')[0]).toBe(
      'FW-Edge: rule 4 added — allow dns from 172.16.0.10 to 192.168.30.10'
    );
    expect(transcript('resolve posta.azienda.example from Portale-Clienti')).toEqual([
      'Looking up posta.azienda.example from Portale-Clienti (DNS server 192.168.30.10)...',
      '  ✓ DNS request: Portale-Clienti → Srv-Auth',
      '  ✓ DNS reply: Srv-Auth → Portale-Clienti',
      'posta.azienda.example is 192.168.30.40 (answered by Srv-Auth)',
      '  note: DNS request: firewall FW-Edge: allowed by rule 4 (allow dns from 172.16.0.10 to 192.168.30.10)',
      '  note: DNS reply: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed',
    ]);
    // the rule is for dns alone
    expect(transcript('ping Srv-Auth from Portale-Clienti')[1]).toBe(
      'Ping failed (blocked): request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied'
    );
    expect(transcript('trace Srv-Auth from Portale-Clienti as dns').slice(-1)).toEqual([
      'Trace complete: destination reached.',
    ]);
    expect(run('trace Srv-Auth from Portale-Clienti as dns').lines.map(l => l.text)).toEqual([
      'Tracing route to Srv-Auth (192.168.30.10) from Portale-Clienti as dns:',
    ]);
  });

  it('with the DNS server down no name finds an address, and the addresses still answer', () => {
    const presentation = usePresentationStore.getState();
    presentation.enter();
    presentation.toggleDeviceFailure(device('Srv-Auth').id);
    expect(transcript('ping gestionale.azienda.example from PC-Vendite')).toEqual([
      'Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...',
      '  ✗ DNS request: PC-Vendite → Srv-Auth',
      'Lookup failed (blocked): DNS request: Srv-Auth is down',
      '  dropped at: SW-Server',
    ]);
    expect(transcript('ping Web-Gestionale from PC-Vendite')).toContain('Reply from 192.168.30.30: hops=6 time=9ms');
    presentation.exit();
  });
});

describe('show dns', () => {
  it('says that there is none, and how to begin', () => {
    expect(output('show dns')).toEqual([
      'no DNS in the drawing: no server keeps records, no card names a DNS server',
      '  keep a name:        add record <name> <address> on <server>',
      '  name a DNS server:  interface <name> dns <address> on <device>',
    ]);
  });

  it('of the whole drawing: the records of every server, and who asks whom', () => {
    loadCompany();
    expect(output('show dns')).toEqual([
      'DNS — 1 server, 3 records',
      'RECORDS of Srv-Auth (192.168.30.10)',
      '   1  gestionale.azienda.example       192.168.30.30',
      '   2  posta.azienda.example            192.168.30.40',
      '   3  portale.azienda.example          172.16.0.10',
      'WHO ASKS WHOM',
      '  PC-Contabilità eth0      192.168.30.10',
      '  PC-Vendite eth0          192.168.30.10',
      '  Stampante eth0           192.168.30.10',
      '  Portatile-1 eth0         192.168.30.10  (with its lease)',
      '  Portatile-2 eth0         192.168.30.10  (with its lease)',
      LIMITS,
    ]);
  });

  it('counts one server and one record as one, and lists a server nobody asks, or cards that ask nobody there', () => {
    run(`add record www.azienda.example ${WEB} on Web-01`);
    expect(output('show dns')).toEqual([
      'DNS — 1 server, 1 record',
      'RECORDS of Web-01 (192.168.20.10)',
      '   1  www.azienda.example              192.168.20.10',
      LIMITS,
    ]);
    run(`add record posta.azienda.example ${MAIL} on Mail-01`);
    expect(output('show dns')[0]).toBe('DNS — 2 servers, 2 records');
    run('remove record 1 from Web-01');
    run('remove record 1 from Mail-01');
    run('interface eth0 dns 8.8.8.8 on PC-2');
    expect(output('show dns')).toEqual([
      'DNS — 0 servers, 0 records',
      'WHO ASKS WHOM',
      `  ${'PC-2 eth0'.padEnd(24)} 8.8.8.8`,
      LIMITS,
    ]);
  });

  it('does not list records left on a device that is no server, and says when a server has no address', () => {
    useNetworkStore.getState().updateDevice(device('PC-2').id, {
      dnsRecords: [{ id: 'record-1', name: 'www.azienda.example', address: WEB }],
    });
    expect(output('show dns')[0]).toBe('no DNS in the drawing: no server keeps records, no card names a DNS server');
    expect(output('show dns PC-2').join('\n')).not.toContain('RECORDS');

    run(`add record www.azienda.example ${WEB} on Mail-01`);
    run('interface eth0 dhcp on Mail-01');
    expect(output('show dns').slice(0, 2)).toEqual(['DNS — 1 server, 1 record', 'RECORDS of Mail-01 (no address)']);
  });

  it('of a device that asks: the server of each card, who that is, and where it came from', () => {
    smallWithDns();
    expect(output('show dns PC-1')).toEqual(['DNS of PC-1', '  eth0: asks 192.168.20.10 (Web-01)', LIMITS]);
    expect(output('show dns', { deviceLabel: 'PC-1' })).toEqual(output('show dns of PC-1'));
    // an address nobody has
    run('interface eth0 dns 8.8.8.8 on PC-2');
    expect(output('show dns PC-2')).toEqual(['DNS of PC-2', '  eth0: asks 8.8.8.8 (no device has it)', LIMITS]);
  });

  it('of a device on DHCP: the server that came with the lease, or why there is none', () => {
    loadCompany();
    expect(output('show dns Portatile-1')).toEqual([
      'DNS of Portatile-1',
      '  eth0: asks 192.168.30.10 (Srv-Auth), handed out with its lease by Router-Core port 2',
      LIMITS,
    ]);
    run('interface 2 pool 192.168.20.100 to 192.168.20.199 on Router-Core');
    expect(output('show dns Portatile-1')).toEqual([
      'DNS of Portatile-1',
      '  eth0: asks nobody: the pool of Router-Core port 2 hands out no DNS server',
      LIMITS,
    ]);
    run('interface 2 pool none on Router-Core');
    expect(output('show dns Portatile-1')).toEqual(['DNS of Portatile-1', '  eth0: asks nobody: it has no lease', LIMITS]);
  });

  it('of a device that asks nobody: so, and how to name a server', () => {
    expect(output('show dns PC-2')).toEqual([
      'DNS of PC-2',
      '  eth0: asks nobody',
      '  name a DNS server: interface eth0 dns <address> on PC-2',
      LIMITS,
    ]);
    expect(output('show dns Router-1')).toEqual([
      'DNS of Router-1',
      '  Router-1 has no network card: it asks no DNS server',
    ]);
    expect(output('show dns SW-Office')).toEqual([
      'DNS of SW-Office',
      '  SW-Office has no network card: it asks no DNS server',
    ]);
  });

  it('of a server: the names it answers for, or how to give it one', () => {
    smallWithDns();
    expect(output('show dns Web-01')).toEqual([
      'DNS of Web-01',
      'RECORDS (it answers for these names, and for no other)',
      '   1  www.azienda.example              192.168.20.10',
      '   2  posta.azienda.example            192.168.20.20',
      '  eth0: asks nobody',
      '  name a DNS server: interface eth0 dns <address> on Web-01',
      LIMITS,
    ]);
    expect(output('show dns Mail-01').slice(0, 3)).toEqual([
      'DNS of Mail-01',
      'RECORDS (it answers for these names, and for no other)',
      '  none yet: add record <name> <address> on Mail-01',
    ]);
  });

  it('a device with several cards asks through the first enabled one that names a server', () => {
    const second: NetworkInterfaceCard = {
      id: 'nic-2',
      name: 'eth1',
      enabled: true,
      speed: 'auto',
      ip: '10.5.5.5',
      subnet: '255.255.255.0',
      gateway: '',
      dns: MAIL,
    };
    const third: NetworkInterfaceCard = { ...second, id: 'nic-3', name: 'eth2', ip: '10.6.6.6', dns: '8.8.8.8' };
    const pc = device('PC-2');
    useNetworkStore.getState().updateDevice(pc.id, { nics: [...(pc.nics ?? []), second, third] });
    expect(output('show dns PC-2')).toEqual([
      'DNS of PC-2',
      '  eth0: asks nobody',
      '  eth1: asks 192.168.20.20 (Mail-01)',
      '  eth2: asks 8.8.8.8 (no device has it)  (not asked: eth1 comes first)',
      LIMITS,
    ]);
    // only the card that is asked through stands out
    expect(run('show dns PC-2').lines.map(l => l.tone)).toEqual(['heading', 'muted', 'normal', 'muted', 'muted']);
    expect(output('show dns')).toContain(`  ${'PC-2 eth1'.padEnd(24)} 192.168.20.20`);
    expect(output('resolve www.azienda.example from PC-2')[0]).toBe(
      'Looking up www.azienda.example from PC-2 (DNS server 192.168.20.20)...'
    );

    run('interface eth1 down on PC-2');
    expect(output('show dns PC-2')).toEqual([
      'DNS of PC-2',
      '  eth0: asks nobody',
      '  eth1: asks 192.168.20.20 (Mail-01)  (not asked: the card is disabled)',
      '  eth2: asks 8.8.8.8 (no device has it)',
      LIMITS,
    ]);
    expect(output('show dns')).toContain(`  ${'PC-2 eth2'.padEnd(24)} 8.8.8.8`);
  });

  it('flags a record the engine does not read, instead of hiding it', () => {
    useNetworkStore.getState().updateDevice(device('Web-01').id, {
      dnsRecords: [
        { id: 'record-1', name: 'www.azienda.example', address: WEB },
        { id: 'record-2', name: 'gestionale', address: 'web-01' },
      ],
    });
    expect(output('show dns Web-01').slice(2, 4)).toEqual([
      `   1  ${'www.azienda.example'.padEnd(32)} 192.168.20.10`,
      `   2  ${'gestionale'.padEnd(32)} web-01  ✗ not a host name and an address: ignored`,
    ]);
    expect(output('show dns')[0]).toBe('DNS — 1 server, 2 records');
  });
});

describe('a card that asks a DNS server, and a server that answers, in the other commands', () => {
  beforeEach(smallWithDns);

  it('show ip and show config write the DNS server after the gateway, only where there is one', () => {
    expect(output('show ip PC-1')[4]).toBe('  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10');
    expect(output('show config PC-1')).toContain(
      '  nic eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10'
    );
    expect(output('show ip PC-2')[4]).toBe('  eth0: 192.168.10.12 / 255.255.255.0 gw 192.168.10.1');
    expect(output('show config PC-2').join('\n')).not.toContain('dns');
  });

  it('show config of a server says how many names it answers for', () => {
    expect(output('show config Web-01')).toContain('  dns:      answers for 2 names — "show dns Web-01" for detail');
    run('remove record 2 from Web-01');
    expect(output('show config Web-01')).toContain('  dns:      answers for 1 name — "show dns Web-01" for detail');
    expect(output('show config Mail-01').join('\n')).not.toContain('dns:');
  });
});

describe('help', () => {
  it('has the commands of DNS, and says that a name works as a target', () => {
    expect(output('help dns').map(row => row.split('  ')[0])).toEqual([
      'trace <target> [from <device>] [as web|email|dns]',
      'show dns [[of] <device>]',
      'interface <name> dns <address>|none on <device>',
    ]);
    expect(output('help record').map(row => row.split('  ')[0])).toEqual(['add record <name> <address> on <server>']);
    expect(output('help resolve').map(row => row.split('  ')[0])).toEqual(['resolve <name> [from <device>]']);
    expect(output('help').slice(-2)).toEqual([
      '  a host name (www.company.example) works as a target: the source asks its DNS server for the address first',
      '  every command explained, with examples: https://app.pixelcake.dev/docs/terminal/',
    ]);
    for (const [syntax] of COMMAND_REFERENCE) expect(syntax.length, syntax).toBeLessThanOrEqual(58);
  });
});

// The DNS session of docs/terminal-commands.md (a ```ncl block) is run by
// src/docs/docs.examples.test.ts, as every terminal example of the
// documentation is: what it prints must be what the page shows.
