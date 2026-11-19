/**
 * What the board says after a paste: the pasted end devices that asked for
 * an address and got none, and the servers, routers, firewalls and switches
 * that keep the addresses of the originals, with those now in conflict.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toast } from 'sonner';
import { useNetworkStore } from '@/store/networkStore';
import { device, host, nic, port, switchWith } from '@/test/networkFixtures';
import type { NetworkDevice } from '@/types';
import { pasteAndTell } from './pasteActions';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const MASK = '255.255.255.0';
const store = () => useNetworkStore.getState();
const said = () => [...vi.mocked(toast.warning).mock.calls, ...vi.mocked(toast.info).mock.calls].map((call) => call[0]);

function draw(devices: NetworkDevice[]) {
  useNetworkStore.setState({
    devices,
    connections: [],
    areas: [],
    deviceCounter: devices.length,
    connectionCounter: 0,
    selectedDeviceIds: [],
    selectedAreaIds: [],
    selectedAreaId: null,
    clipboard: null,
  });
}

function copyPaste(ids: string[]) {
  store().selectMultipleDevices(ids);
  store().copySelection();
  pasteAndTell();
}

beforeEach(() => {
  localStorage.clear();
  store().clearAllDevices();
  vi.mocked(toast.warning).mockClear();
  vi.mocked(toast.info).mockClear();
});

describe('the notice after a paste', () => {
  it('a server keeps the address of the original, now in conflict: the notice names the copy and the address', () => {
    draw([device({ id: 'Srv-1', type: 'Server', ip: '192.168.1.10', nics: [nic({ ip: '192.168.1.10' })] })]);

    copyPaste(['Srv-1']);

    expect(said()).toEqual(['Srv-2 tiene gli indirizzi dell\'originale: 192.168.1.10 ora è in conflitto, finché non lo cambi']);
    expect(vi.mocked(toast.warning)).toHaveBeenCalledTimes(1);
  });

  it('a router, a firewall and a switch together: one notice, every address now in conflict', () => {
    draw([
      device({ id: 'R-1', type: 'Router', ports: [port(1, { ip: '192.168.1.1', subnet: MASK }), port(2, { ip: '10.0.0.1', subnet: MASK })] }),
      device({ id: 'FW-1', type: 'Firewall', ports: [port(1, { ip: '192.168.1.254', subnet: MASK })] }),
      switchWith('SW-1', [port(1)], { ip: '192.168.1.250' }),
    ]);

    copyPaste(['R-1', 'FW-1', 'SW-1']);

    expect(said()).toEqual([
      'R-2, FW-2 e SW-2 tengono gli indirizzi degli originali: 192.168.1.1, 10.0.0.1, 192.168.1.254 e 192.168.1.250 ' +
        'ora sono in conflitto, finché non li cambi',
    ]);
  });

  it('a switch with no address of its own, and a PC that goes on DHCP, keep nothing: no notice of addresses', () => {
    draw([switchWith('SW-1', [port(1)]), host('PC-1', '192.168.1.20', '192.168.1.1')]);

    copyPaste(['SW-1', 'PC-1']);

    // (the PC asked DHCP for an address, and nobody gave it one: that is said instead)
    expect(said()).toEqual(['PC-2 chiede l\'indirizzo al DHCP, e nessun server DHCP gliene ha dato uno']);
  });

  it('pasted where the original is not, the copy keeps its addresses and nothing is in conflict', () => {
    draw([device({ id: 'Srv-1', type: 'Server', ip: '192.168.1.10', nics: [nic({ ip: '192.168.1.10' })] })]);
    store().selectMultipleDevices(['Srv-1']);
    store().copySelection();
    // the original goes: the copy is the only one with its address
    store().removeDevice('Srv-1');

    pasteAndTell();

    expect(said()).toEqual(['Srv-1 tiene gli indirizzi dell\'originale']);
    expect(vi.mocked(toast.info)).toHaveBeenCalledTimes(1);
  });
});
