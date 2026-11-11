import { describe, it, expect } from 'vitest';
import type { NetworkDevice, NetworkConnection, NetworkInterfaceCard } from '@/types';
import type { Topology } from './types';
import {
  buildAdjacency,
  resolveEndpoint,
  suggestEndpoint,
  primaryIp,
  mirrorPrimaryNic,
  primaryMask,
  primaryGateway,
  isL3Capable,
  isSwitchLike,
} from './topology';

// ---------- fixture factories ----------

function device(overrides: Partial<NetworkDevice> & { id: string }): NetworkDevice {
  return {
    type: 'PC',
    label: overrides.id,
    ip: '',
    subnet: '',
    gateway: '',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function nic(
  id: string,
  ip: string,
  overrides: Partial<NetworkInterfaceCard> = {}
): NetworkInterfaceCard {
  return {
    id,
    name: 'eth0',
    enabled: true,
    speed: '1G',
    ip,
    subnet: '255.255.255.0',
    gateway: '',
    ...overrides,
  };
}

function link(
  source: string,
  target: string,
  overrides: Partial<NetworkConnection> = {}
): NetworkConnection {
  return { id: `${source}--${target}`, source, target, ...overrides };
}

function topo(devices: NetworkDevice[], connections: NetworkConnection[] = []): Topology {
  return { devices, connections };
}

// ---------- buildAdjacency ----------

describe('buildAdjacency', () => {
  it('builds bidirectional entries and empty lists for isolated devices', () => {
    const c = link('a', 'b');
    const t = topo([device({ id: 'a' }), device({ id: 'b' }), device({ id: 'c' })], [c]);
    const adjacency = buildAdjacency(t);

    expect(adjacency.get('a')).toEqual([{ neighborId: 'b', connection: c }]);
    expect(adjacency.get('b')).toEqual([{ neighborId: 'a', connection: c }]);
    expect(adjacency.get('c')).toEqual([]);
  });

  it('skips connections referencing unknown devices', () => {
    const t = topo([device({ id: 'a' })], [link('a', 'ghost')]);
    expect(buildAdjacency(t).get('a')).toEqual([]);
  });
});

// ---------- resolveEndpoint ----------

describe('resolveEndpoint', () => {
  const pc = device({ id: 'dev-1', label: 'PC Sales 1', ip: '192.168.1.10' });
  const sw = device({ id: 'dev-2', label: 'Core Switch HQ', type: 'Switch', ip: '192.168.1.2' });
  const server = device({
    id: 'dev-3',
    label: 'Web-01',
    type: 'Server',
    ip: '',
    nics: [
      nic('nic-1', '10.0.0.5', { enabled: false }),
      nic('nic-2', '10.0.0.6'),
    ],
  });
  const t = topo([pc, sw, server]);

  it('matches by exact device id', () => {
    const resolved = resolveEndpoint('dev-2', t);
    expect(resolved?.device).toBe(sw);
    expect(resolved?.ip).toBe('192.168.1.2');
  });

  it('matches multi-word labels case-insensitively with extra whitespace', () => {
    const resolved = resolveEndpoint('  core  switch hq ', t);
    expect(resolved?.device).toBe(sw);
  });

  it('matches by device.ip and returns that ip', () => {
    const resolved = resolveEndpoint('192.168.1.10', t);
    expect(resolved?.device).toBe(pc);
    expect(resolved?.ip).toBe('192.168.1.10');
  });

  it('matches by enabled NIC ip but not by disabled NIC ip', () => {
    expect(resolveEndpoint('10.0.0.5', t)).toBeUndefined(); // disabled NIC
    const resolved = resolveEndpoint('10.0.0.6', t);
    expect(resolved?.device).toBe(server);
    expect(resolved?.ip).toBe('10.0.0.6');
  });

  it('returns undefined on a miss and for empty queries', () => {
    expect(resolveEndpoint('nope', t)).toBeUndefined();
    expect(resolveEndpoint('   ', t)).toBeUndefined();
  });
});

// ---------- suggestEndpoint ----------

describe('suggestEndpoint', () => {
  const t = topo([
    device({ id: 'd1', label: 'PC Sales 1' }),
    device({ id: 'd2', label: 'Core Switch HQ' }),
    device({ id: 'd3', label: 'Web-01' }),
  ]);

  it('suggests the closest label for a typo', () => {
    expect(suggestEndpoint('Web-10', t)).toBe('Web-01');
    expect(suggestEndpoint('core swich hq', t)).toBe('Core Switch HQ');
  });

  it('returns undefined for gibberish or empty topology', () => {
    expect(suggestEndpoint('zzzzzzzzzzzz', t)).toBeUndefined();
    expect(suggestEndpoint('Web-01', topo([]))).toBeUndefined();
  });
});

// ---------- per-device helpers ----------

describe('device helpers', () => {
  it('primaryIp prefers device.ip, falls back to first enabled NIC, else empty', () => {
    expect(primaryIp(device({ id: 'a', ip: '1.2.3.4' }))).toBe('1.2.3.4');
    expect(
      primaryIp(
        device({
          id: 'b',
          nics: [nic('nic-1', '9.9.9.9', { enabled: false }), nic('nic-2', '10.0.0.1')],
        })
      )
    ).toBe('10.0.0.1');
    expect(primaryIp(device({ id: 'c' }))).toBe('');
  });

  it('primaryMask falls back to NIC subnet then /24', () => {
    expect(primaryMask(device({ id: 'a', subnet: '255.255.0.0' }))).toBe('255.255.0.0');
    expect(
      primaryMask(device({ id: 'b', nics: [nic('nic-1', '10.0.0.1', { subnet: '255.255.255.128' })] }))
    ).toBe('255.255.255.128');
    expect(primaryMask(device({ id: 'c' }))).toBe('255.255.255.0');
  });

  it('primaryGateway falls back to NIC gateway then empty string', () => {
    expect(primaryGateway(device({ id: 'a', gateway: '10.0.0.254' }))).toBe('10.0.0.254');
    expect(
      primaryGateway(device({ id: 'b', nics: [nic('nic-1', '10.0.0.1', { gateway: '10.0.0.1' })] }))
    ).toBe('10.0.0.1');
    expect(primaryGateway(device({ id: 'c' }))).toBe('');
  });

  it('mirrorPrimaryNic copies the first NIC addressing onto the device', () => {
    const stale = device({
      id: 'a',
      ip: '192.168.1.10',
      gateway: '192.168.1.1',
      nics: [nic('nic-1', '10.0.0.5', { subnet: '255.255.0.0', gateway: '10.0.0.1' })],
    });

    const mirrored = mirrorPrimaryNic(stale);

    expect(mirrored).toMatchObject({ ip: '10.0.0.5', subnet: '255.255.0.0', gateway: '10.0.0.1' });
    expect(stale.ip).toBe('192.168.1.10'); // input untouched
  });

  it('mirrorPrimaryNic mirrors an empty NIC gateway too (the NIC is the source of truth)', () => {
    const mirrored = mirrorPrimaryNic(
      device({
        id: 'a',
        ip: '10.0.0.5',
        gateway: '10.0.0.1',
        nics: [nic('nic-1', '10.0.0.5', { gateway: '' })],
      })
    );

    expect(mirrored.gateway).toBe('');
  });

  it('mirrorPrimaryNic returns the same object when there is nothing to do', () => {
    const inSync = device({
      id: 'a',
      ip: '10.0.0.5',
      subnet: '255.255.255.0',
      gateway: '',
      nics: [nic('nic-1', '10.0.0.5')],
    });
    const noNics = device({ id: 'b', type: 'Switch', ip: '10.0.0.2' });
    const nicWithoutIp = device({ id: 'c', ip: '10.0.0.9', nics: [nic('nic-1', '')] });

    expect(mirrorPrimaryNic(inSync)).toBe(inSync);
    expect(mirrorPrimaryNic(noNics)).toBe(noNics);
    expect(mirrorPrimaryNic(nicWithoutIp)).toBe(nicWithoutIp);
  });

  it('isL3Capable and isSwitchLike match type case-insensitively', () => {
    expect(isL3Capable(device({ id: 'a', type: 'Router' }))).toBe(true);
    expect(isL3Capable(device({ id: 'b', type: 'NextGen FIREWALL' }))).toBe(true);
    expect(isL3Capable(device({ id: 'c', type: 'Switch' }))).toBe(false);
    expect(isSwitchLike(device({ id: 'd', type: 'core-switch' }))).toBe(true);
    expect(isSwitchLike(device({ id: 'e', type: 'PC' }))).toBe(false);
  });
});
