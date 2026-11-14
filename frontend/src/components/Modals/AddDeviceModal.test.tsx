/**
 * AddDeviceModal tests — what a new device starts with. On an end device the
 * gateway of the project is its way out; on a router or firewall the gateway
 * is the DEFAULT ROUTE, which nobody chose yet: it must start empty.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
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
  vi.mocked(toast.error).mockClear();
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

describe('AddDeviceModal — the address of a new end device is typed where it is added', () => {
  const open = (type: string, templateId: string) => {
    useUIStore.getState().setAddDeviceType(type, templateId);
    useUIStore.getState().openModal('addDevice');
    return render(<AddDeviceModal />);
  };
  const last = () => {
    const devices = useNetworkStore.getState().devices;
    return devices[devices.length - 1];
  };
  const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));

  it('shows the address proposed for its card, with the mask and the gateway of the project, to be changed', () => {
    open('PC', 'tpl-pc');
    const network = screen.getByRole('group', { name: 'Rete · eth0' });
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('manual');
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.1.2');
    expect(screen.getByLabelText('Subnet Mask')).toHaveValue('255.255.255.0');
    expect(screen.getByLabelText('Gateway')).toHaveValue('192.168.1.1');
    expect(network).toHaveTextContent("L'indirizzo è proposto: il primo libero della rete del progetto.");

    fireEvent.change(screen.getByLabelText('Indirizzo IP'), { target: { value: ' 192.168.1.50 ' } });
    fireEvent.change(screen.getByLabelText('Server DNS'), { target: { value: '192.168.1.53' } });
    confirm();
    expect(last()).toMatchObject({ ip: '192.168.1.50', subnet: '255.255.255.0', gateway: '192.168.1.1' });
    expect(last().nics?.[0]).toMatchObject({ ip: '192.168.1.50', dns: '192.168.1.53', name: 'eth0' });
  });

  it('can be left to DHCP: the device is added with no address of its own', () => {
    open('PC', 'tpl-pc');
    // (even with the address that was proposed taken away: on DHCP none is asked for)
    fireEvent.change(screen.getByLabelText('Indirizzo IP'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });
    expect(screen.queryByLabelText('Indirizzo IP')).not.toBeInTheDocument();
    expect(screen.getByTestId('nic-lease')).toHaveTextContent(
      "L'indirizzo arriva dal server DHCP della rete a cui la scheda è collegata."
    );
    confirm();
    expect(toast.error).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ ip: '', gateway: '' });
    expect(last().nics?.[0]).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '' });
  });

  it('by hand an address is asked for, and a DNS server that is not an address is refused', () => {
    open('PC', 'tpl-pc');
    const before = useNetworkStore.getState().devices.length;
    fireEvent.change(screen.getByLabelText('Indirizzo IP'), { target: { value: '  ' } });
    confirm();
    expect(toast.error).toHaveBeenLastCalledWith('Nome e IP sono obbligatori');

    fireEvent.change(screen.getByLabelText('Indirizzo IP'), { target: { value: '192.168.1.50' } });
    fireEvent.change(screen.getByLabelText('Server DNS'), { target: { value: 'srv-auth' } });
    expect(screen.getByRole('alert')).toHaveTextContent('"srv-auth" non è un indirizzo IPv4 valido');
    confirm();
    expect(toast.error).toHaveBeenLastCalledWith(
      '"srv-auth" non è un indirizzo IPv4 valido: il server DNS si indica con il suo indirizzo'
    );
    expect(useNetworkStore.getState().devices).toHaveLength(before);
  });

  it('a switch is asked its own address, and how many ports it has', () => {
    open('Switch', 'tpl-switch');
    expect(screen.getByRole('group', { name: 'Rete' })).toBeInTheDocument();
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.1.2');
    expect(screen.getByLabelText('Subnet Mask')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Numero di Porte')).toHaveValue('24');
    fireEvent.change(screen.getByLabelText('Numero di Porte'), { target: { value: '8' } });
    confirm();
    expect(last().ports).toHaveLength(8);
    expect(last().portCount).toBe(8);
  });

  it('says what the device is, and asks a PC neither who made it nor where it is', () => {
    const pc = open('PC', 'tpl-pc');
    expect(screen.getByLabelText('Tipo')).toHaveTextContent('PC');
    expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument();
    pc.unmount();
    open('Server', 'tpl-mailserver');
    expect(screen.getByLabelText('Tipo')).toHaveTextContent(/Mail/);
    expect(screen.getByLabelText('Vendor')).toBeInTheDocument();
    expect(screen.getByLabelText('Posizione')).toBeInTheDocument();
  });
});
