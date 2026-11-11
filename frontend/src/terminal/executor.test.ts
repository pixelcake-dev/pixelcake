/**
 * Terminal executor tests for the interface-level output: the interfaces a
 * `connect` used, NIC bindings in `show connections`, port addresses and
 * link peers in `show interfaces` / `show ports`, and configuration commands
 * reaching the interface the engine reads.
 *
 * The executor is the one terminal layer that touches the stores, so these
 * run against the real networkStore loaded with the sample network.
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

function run(command: string, context: TerminalContext = GLOBAL): ExecutionResult {
  return executeCommand(command, context);
}

/** Printed text of a command, one entry per line */
function output(command: string, context: TerminalContext = GLOBAL): string[] {
  return run(command, context).lines.map(l => l.text);
}

/** A table row split on whitespace (columns are space-padded) */
function cells(row: string): string[] {
  return row.trim().split(/\s+/);
}

function device(label: string): NetworkDevice {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

function addPc(label: string, ip: string, withNic = true): void {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    templateId: 'tpl-pc',
    label,
    ip,
    subnet: '255.255.255.0',
    gateway: '192.168.10.1',
    position: { x: 0, y: 0 },
    nics: withNic
      ? [
          {
            id: 'nic-1',
            name: 'eth0',
            enabled: true,
            speed: 'auto',
            ip,
            subnet: '255.255.255.0',
            gateway: '192.168.10.1',
          },
        ]
      : undefined,
  });
}

describe('terminal executor — interfaces', () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useNetworkStore.getState();
    store.clearAllDevices();
    const sample = createSampleTopology();
    store.loadTopology(sample.devices, sample.connections);
  });

  // ---------- connect ----------

  describe('connect', () => {
    it('reports the interface used on each end', () => {
      addPc('PC-3', '192.168.10.13');

      expect(output('connect PC-3 to SW-Office')).toEqual([
        'connected PC-3 (eth0) ↔ SW-Office (port 3)',
      ]);

      const created = useNetworkStore.getState().connections.at(-1);
      expect(created).toMatchObject({
        source: device('PC-3').id,
        target: device('SW-Office').id,
        sourceNic: 'nic-1',
        targetPort: 3,
      });
    });

    it('reports port ↔ port between two switches, lowest free port on each', () => {
      expect(output('connect SW-Office to SW-Servers')).toEqual([
        'connected SW-Office (port 3) ↔ SW-Servers (port 3)',
      ]);
    });

    it('says so when an end could not be bound because every interface is taken', () => {
      // PC-1 has a single NIC, already linked to SW-Office
      expect(output('connect PC-1 to SW-Servers')).toEqual([
        'connected PC-1 (unbound) ↔ SW-Servers (port 3)',
        '  PC-1 has no free interface: that end is not bound, per-port rules are skipped there',
      ]);
    });

    it('says so when a device has no interfaces at all', () => {
      addPc('Legacy', '192.168.10.50', false);

      expect(output('connect Legacy to SW-Office')).toEqual([
        'connected Legacy (unbound) ↔ SW-Office (port 3)',
        '  Legacy has no interfaces: that end is not bound, per-port rules are skipped there',
      ]);
    });

    it('still refuses a duplicate link without touching the bindings', () => {
      const before = useNetworkStore.getState().connections;
      expect(output('connect PC-1 to SW-Office')).toEqual([
        'PC-1 and SW-Office are already connected',
      ]);
      expect(useNetworkStore.getState().connections).toBe(before);
    });
  });

  // ---------- show connections ----------

  describe('show connections', () => {
    it('prints the interface on both ends, NICs by name and ports by number', () => {
      expect(output('show connections')).toEqual([
        'CONNECTIONS (6)',
        '  PC-1 ↔ SW-Office  (access, 1 Gbps)  [eth0 ↔ port 1]',
        '  PC-2 ↔ SW-Office  (access, 1 Gbps)  [eth0 ↔ port 2]',
        '  SW-Office ↔ Router-1  (uplink, 1 Gbps)  [port 8 ↔ port 1]',
        '  Router-1 ↔ SW-Servers  (uplink, 1 Gbps)  [port 2 ↔ port 8]',
        '  Web-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 1]',
        '  Mail-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 2]',
      ]);
    });

    it('filters by device', () => {
      expect(output('show connections of Router-1')).toEqual([
        'CONNECTIONS of Router-1 (2)',
        '  SW-Office ↔ Router-1  (uplink, 1 Gbps)  [port 8 ↔ port 1]',
        '  Router-1 ↔ SW-Servers  (uplink, 1 Gbps)  [port 2 ↔ port 8]',
      ]);
    });

    it('marks an unbound end with "?" and omits the bracket when neither end is bound', () => {
      run('connect PC-1 to SW-Servers'); // PC-1 end stays unbound
      addPc('Legacy-A', '192.168.10.50', false);
      addPc('Legacy-B', '192.168.10.51', false);
      run('connect Legacy-A to Legacy-B');

      const lines = output('show connections');
      expect(lines).toContain('  PC-1 ↔ SW-Servers  [? ↔ port 3]');
      expect(lines).toContain('  Legacy-A ↔ Legacy-B');
    });
  });

  // ---------- show interfaces / show ports ----------

  describe('show interfaces', () => {
    it('shows the port address and the peer of each linked port', () => {
      const [header, ...rows] = output('show interfaces Router-1');

      expect(cells(header)).toEqual(['IFACE', 'KIND', 'STATE', 'IP', 'VLAN', 'MODE-ZONE', 'LINK']);
      expect(rows.map(cells)).toEqual([
        ['1', 'port', 'up', '192.168.10.1', '-', 'lan', 'SW-Office', '(port', '8)'],
        ['2', 'port', 'up', '192.168.20.1', '-', 'lan', 'SW-Servers', '(port', '8)'],
        ['3', 'port', 'up', '-', '-', 'lan', '-'],
        ['4', 'port', 'up', '-', '-', 'lan', '-'],
      ]);
      expect(rows[0].endsWith('SW-Office (port 8)')).toBe(true);
    });

    it('shows the peer of a NIC', () => {
      const rows = output('show interfaces of PC-1').slice(1);
      expect(rows).toHaveLength(1);
      expect(cells(rows[0])).toEqual([
        'eth0',
        'nic',
        'up',
        '192.168.10.11',
        '-',
        '-',
        'SW-Office',
        '(port',
        '1)',
      ]);
    });

    it('shows NIC peers by interface name on a switch', () => {
      const rows = output('show interfaces SW-Servers').slice(1);
      expect(rows[0].endsWith('Web-01 (eth0)')).toBe(true);
      expect(rows[1].endsWith('Mail-01 (eth0)')).toBe(true);
      expect(rows[7].endsWith('Router-1 (port 2)')).toBe(true);
      expect(cells(rows[2]).at(-1)).toBe('-'); // port 3 is free
    });

    it('shows only the device name when the peer end is not bound', () => {
      run('connect PC-1 to SW-Servers'); // PC-1 has no free NIC
      const rows = output('show interfaces SW-Servers').slice(1);
      expect(rows[2].endsWith(' PC-1')).toBe(true);
    });

    it('keeps the state of a disabled interface visible next to its link', () => {
      run('interface 2 down on Router-1');
      const row = output('show interfaces Router-1')[2];
      expect(cells(row).slice(0, 4)).toEqual(['2', 'port', 'down', '192.168.20.1']);
      expect(row.endsWith('SW-Servers (port 8)')).toBe(true);
    });
  });

  describe('show ports', () => {
    it('adds the IP and LINK columns', () => {
      const [header, ...rows] = output('show ports Router-1');

      expect(cells(header)).toEqual(['PORT', 'STATE', 'MODE', 'VLAN', 'ZONE', 'IP', 'LINK']);
      expect(rows.map(cells)).toEqual([
        ['1', 'up', 'lan', '-', '-', '192.168.10.1', 'SW-Office', '(port', '8)'],
        ['2', 'up', 'lan', '-', '-', '192.168.20.1', 'SW-Servers', '(port', '8)'],
        ['3', 'up', 'lan', '-', '-', '-', '-'],
        ['4', 'up', 'lan', '-', '-', '-', '-'],
      ]);
    });

    it('still reports devices without ports', () => {
      expect(output('show ports PC-1')).toEqual(['PC-1 has no configurable ports']);
    });
  });

  describe('show ip', () => {
    it('lists the addressed ports of a router', () => {
      expect(output('show ip Router-1')).toEqual([
        'Router-1 — addressing',
        '  ip:       192.168.10.1',
        '  subnet:   255.255.255.0',
        '  gateway:  -',
        '  port 1: 192.168.10.1 / 255.255.255.0',
        '  port 2: 192.168.20.1 / 255.255.255.0',
      ]);
    });
  });

  // ---------- configuration reaches the interface the engine reads ----------

  describe('set gateway on a device with NICs', () => {
    it('writes the primary NIC too, so the simulation sees the change', () => {
      expect(output('set gateway of PC-1 to 192.168.10.254')).toEqual([
        'PC-1: gateway set to 192.168.10.254',
      ]);

      const pc1 = device('PC-1');
      expect(pc1.gateway).toBe('192.168.10.254');
      expect(pc1.nics?.[0].gateway).toBe('192.168.10.254');
      // the link stays on eth0
      expect(output('show connections of PC-1')[1]).toBe(
        '  PC-1 ↔ SW-Office  (access, 1 Gbps)  [eth0 ↔ port 1]'
      );

      const result = run('ping Web-01 from PC-1');
      const printed = [...result.lines, ...(result.liveTrace?.finalLines ?? [])].map(l => l.text);
      expect(printed).toContain(
        'Ping failed (blocked): request: PC-1 uses gateway 192.168.10.254, but Router-1 port 1 on its network is 192.168.10.1'
      );
      expect(printed).toContain('  dropped at: PC-1');
    });

    it('a correct gateway pings across the router with nothing left unverified', () => {
      const result = run('ping Web-01 from PC-1');
      const final = (result.liveTrace?.finalLines ?? []).map(l => l.text);
      expect(final).toEqual(['Reply from 192.168.20.10: hops=5 time=7ms']);
    });
  });

  describe('trace', () => {
    it('names the disabled interface that dropped the packet', () => {
      const web = device('Web-01');
      useNetworkStore.getState().updateDevice(web.id, {
        nics: (web.nics ?? []).map(n => ({ ...n, enabled: false })),
      });

      const result = run('trace Web-01 from PC-1');
      const final = (result.liveTrace?.finalLines ?? []).map(l => l.text);
      expect(final).toEqual(['Trace failed (blocked): interface eth0 on Web-01 is disabled']);
      const hops = (result.liveTrace?.hopLines ?? []).map(l => l.text);
      expect(hops.at(-1)).toContain('✗ Web-01 (Server)');
    });
  });
});
