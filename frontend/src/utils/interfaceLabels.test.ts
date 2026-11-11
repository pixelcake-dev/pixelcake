import { describe, it, expect } from 'vitest';
import { interfaceLinks, listInterfaces } from '@/engine';
import type { NetworkConnection, NetworkDevice } from '@/types';
import { interfaceOptionLabel, interfaceShortLabel, linkPeerLabel } from './interfaceLabels';

function device(overrides: Partial<NetworkDevice> & { id: string }): NetworkDevice {
  return {
    type: 'PC',
    label: overrides.id,
    ip: '',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

const router = device({
  id: 'r1',
  label: 'Router-1',
  type: 'Router',
  ports: [
    { id: 1, enabled: true, name: 'LAN Uffici', ip: '192.168.10.1', subnet: '255.255.255.0' },
    { id: 2, enabled: true, name: 'Uplink' },
    { id: 3, enabled: true },
  ],
});

const pc = device({
  id: 'pc1',
  label: 'PC-1',
  nics: [
    {
      id: 'nic-1',
      name: 'eth0',
      enabled: true,
      speed: 'auto',
      ip: '192.168.10.11',
      subnet: '255.255.255.0',
      gateway: '192.168.10.1',
    },
    { id: 'nic-2', name: 'eth1', enabled: true, speed: 'auto', ip: '', subnet: '', gateway: '' },
  ],
});

describe('interface labels (Italian UI)', () => {
  it('labels picker entries: ports by number and name, NICs by name, address when set', () => {
    expect(listInterfaces(router).map(interfaceOptionLabel)).toEqual([
      'Porta 1 — LAN Uffici (192.168.10.1)',
      'Porta 2 — Uplink',
      'Porta 3',
    ]);
    expect(listInterfaces(pc).map(interfaceOptionLabel)).toEqual(['eth0 (192.168.10.11)', 'eth1']);
  });

  it('names an interface inside a sentence', () => {
    expect(listInterfaces(router).map(interfaceShortLabel)).toEqual([
      'porta 1',
      'porta 2',
      'porta 3',
    ]);
    expect(listInterfaces(pc).map(interfaceShortLabel)).toEqual(['eth0', 'eth1']);
  });

  it('describes what an interface is linked to', () => {
    const legacy = device({ id: 'old', label: 'Old-PC' });
    const connections: NetworkConnection[] = [
      { id: 'c1', source: 'pc1', target: 'r1', sourceNic: 'nic-1', targetPort: 1 },
      { id: 'c2', source: 'r1', target: 'old', sourcePort: 3 },
    ];
    const devices = [router, pc, legacy];

    const onRouter = interfaceLinks(router, devices, connections);
    const viaPort1 = onRouter.get('port:1');
    const viaPort3 = onRouter.get('port:3');
    expect(viaPort1 && linkPeerLabel(viaPort1)).toBe('PC-1 (eth0)');
    // far end not assigned to an interface: only the device is named
    expect(viaPort3 && linkPeerLabel(viaPort3)).toBe('Old-PC');

    const viaEth0 = interfaceLinks(pc, devices, connections).get('nic:nic-1');
    expect(viaEth0 && linkPeerLabel(viaEth0)).toBe('Router-1 (porta 1)');
  });
});
