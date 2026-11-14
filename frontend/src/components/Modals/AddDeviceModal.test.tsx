/**
 * AddDeviceModal tests — what a new device starts with. On an end device the
 * gateway of the project is its way out; on a router or firewall the gateway
 * is the DEFAULT ROUTE, which nobody chose yet: it must start empty.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { bulkAddDevices } from '@/utils/bulkDeviceHelpers';
import { routingTable } from '@/engine';
import AddDeviceModal from './AddDeviceModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** Add one device of a template through the modal, as the device panel does */
function add(type: string, templateId: string) {
  useUIStore.getState().setAddDeviceType(type, templateId);
  useUIStore.getState().openModal('addDevice');
  const view = render(<AddDeviceModal />);
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
  view.unmount();
  const devices = useNetworkStore.getState().devices;
  return devices[devices.length - 1];
}

beforeEach(() => {
  localStorage.clear();
  useNetworkStore.getState().clearAllDevices();
  useNetworkStore.getState().setGlobalNetworkSettings({
    ipClass: '192.168.1.0',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
  });
});

describe('AddDeviceModal — the gateway of a new device', () => {
  it('an end device gets the gateway of the project, on its network card', () => {
    const pc = add('PC', 'tpl-pc');
    expect(pc.gateway).toBe('192.168.1.1');
    expect(pc.nics?.[0].gateway).toBe('192.168.1.1');
  });

  it.each([
    ['Router', 'tpl-router'],
    ['Firewall', 'tpl-firewall'],
  ])('a %s starts without a gateway: its default route is not chosen for it', (type, templateId) => {
    const device = add(type, templateId);
    expect(device.gateway).toBe('');
    expect(routingTable(device).filter(entry => entry.kind === 'default')).toEqual([]);
  });

  it('says where the routes of a router are set, in place of the gateway field', () => {
    useUIStore.getState().setAddDeviceType('Router', 'tpl-router');
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    expect(screen.queryByLabelText('Gateway')).not.toBeInTheDocument();
    expect(screen.getByText(/le rotte e la rotta predefinita si impostano dopo/)).toBeInTheDocument();
  });

  it('a switch keeps the gateway: it is an end device for its own address', () => {
    expect(add('Switch', 'tpl-switch').gateway).toBe('192.168.1.1');
  });

  it('gives a router routed ports, a switch access ports', () => {
    expect(add('Router', 'tpl-router').ports?.every(port => port.portType === 'lan')).toBe(true);
    expect(add('Switch', 'tpl-switch').ports?.every(port => port.portType === 'access')).toBe(true);
  });
});

describe('AddDeviceModal — where a new device appears', () => {
  it('in the middle of what the user is looking at, wherever the view was moved', () => {
    const near = (value: number, target: number) => Math.abs(value - target) <= 130;
    const centre = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // view untouched: the centre of the window
    const first = add('PC', 'tpl-pc');
    expect(near(first.position.x, centre.x)).toBe(true);
    expect(near(first.position.y, centre.y)).toBe(true);

    // view moved far away and zoomed out: the device follows it
    useNetworkStore.getState().setViewport({ x: -4000, y: -3000, zoom: 0.5 });
    const second = add('PC', 'tpl-pc');
    expect(near(second.position.x, (centre.x + 4000) / 0.5)).toBe(true);
    expect(near(second.position.y, (centre.y + 3000) / 0.5)).toBe(true);
  });

  it('never on top of the one added before, and always in the same place: nothing is left to chance', () => {
    const first = add('PC', 'tpl-pc');
    const second = add('PC', 'tpl-pc');
    const third = add('Switch', 'tpl-switch');
    const apart = (a: typeof first, b: typeof first) =>
      Math.abs(a.position.x - b.position.x) >= 120 || Math.abs(a.position.y - b.position.y) >= 90;
    expect(apart(first, second)).toBe(true);
    expect(apart(first, third)).toBe(true);
    expect(apart(second, third)).toBe(true);

    // the same three again, on an empty canvas: the same three places
    const before = [first, second, third].map((device) => device.position);
    useNetworkStore.getState().clearAllDevices();
    const again = [add('PC', 'tpl-pc'), add('PC', 'tpl-pc'), add('Switch', 'tpl-switch')];
    expect(again.map((device) => device.position)).toEqual(before);
  });

  it('is the selected device, alone: it is found at once', () => {
    const first = add('PC', 'tpl-pc');
    expect(useNetworkStore.getState().selectedDeviceIds).toEqual([first.id]);

    const second = add('Server', 'tpl-server');
    expect(useNetworkStore.getState().selectedDeviceIds).toEqual([second.id]);
  });
});

describe('bulk add — the gateway of new routers and firewalls', () => {
  it('is left empty too, while switches and end devices keep it', () => {
    const { globalNetworkSettings, addDevice } = useNetworkStore.getState();
    const rows = (['Router', 'Firewall', 'Switch'] as const).map((templateType, index) => ({
      id: `row-${index}`,
      templateType,
      quantity: 1,
      portCount: 8,
    }));
    bulkAddDevices(
      rows,
      { PC: 1 },
      [],
      globalNetworkSettings,
      useTemplateStore.getState().templates,
      addDevice
    );

    const gateways = Object.fromEntries(
      useNetworkStore.getState().devices.map(device => [device.type, device.gateway])
    );
    expect(gateways).toEqual({
      Router: '',
      Firewall: '',
      Switch: '192.168.1.1',
      PC: '192.168.1.1',
    });
  });
});
