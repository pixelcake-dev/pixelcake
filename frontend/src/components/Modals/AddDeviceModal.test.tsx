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
    dns: undefined,
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
  beforeEach(() => {
    useNetworkStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
  });

  // (jsdom has no canvas on the page: the view is the window, 1024 by 768)
  const inView = (place: { x: number; y: number }) => {
    const { x, y, zoom } = useNetworkStore.getState().viewport;
    return (
      place.x >= -x / zoom &&
      place.y >= -y / zoom &&
      place.x + 104 <= (window.innerWidth - x) / zoom &&
      place.y + 94 <= (window.innerHeight - y) / zoom
    );
  };

  it('in the first free place of what the user is looking at, from its top left, wherever the view was moved', () => {
    // view untouched: the first place of the grid of the board inside it
    const first = add('PC', 'tpl-pc');
    expect(first.position).toEqual({ x: 160, y: 130 });
    expect(inView(first.position)).toBe(true);

    // view moved far away and zoomed out: the device follows it
    useNetworkStore.getState().setViewport({ x: -4000, y: -3000, zoom: 0.5 });
    const second = add('PC', 'tpl-pc');
    expect(inView(second.position)).toBe(true);
    expect(second.position).toEqual({ x: 8160, y: 6110 });
  });

  it('one after the other along a row: never on top of each other, and the same places for the same drawing', () => {
    const added = [add('PC', 'tpl-pc'), add('PC', 'tpl-pc'), add('Switch', 'tpl-switch')];
    expect(added.map((device) => device.position)).toEqual([
      { x: 160, y: 130 },
      { x: 320, y: 130 },
      { x: 480, y: 130 },
    ]);

    // the same three again, on an empty canvas: the same three places
    useNetworkStore.getState().clearAllDevices();
    const again = [add('PC', 'tpl-pc'), add('PC', 'tpl-pc'), add('Switch', 'tpl-switch')];
    expect(again.map((device) => device.position)).toEqual(added.map((device) => device.position));
  });

  it('a place a device was moved away from is the next one taken', () => {
    const first = add('PC', 'tpl-pc');
    add('PC', 'tpl-pc');
    useNetworkStore.getState().updateDevice(first.id, { position: { x: 600, y: 500 } });

    expect(add('PC', 'tpl-pc').position).toEqual({ x: 160, y: 130 });
  });

  it('with no free place left in view, the nearest free one to its middle, and the view is brought to it', () => {
    // every place of the view taken
    const { addDevice } = useNetworkStore.getState();
    for (let y = 130; y + 94 <= 744; y += 130) {
      for (let x = 160; x + 104 <= 1000; x += 160) {
        addDevice({ type: 'PC', label: `PC-${x}-${y}`, ip: '', subnet: '', gateway: '', position: { x, y } });
      }
    }
    const before = useNetworkStore.getState().fitViewRequest;

    const device = add('PC', 'tpl-pc');

    expect(inView(device.position)).toBe(false);
    expect(useNetworkStore.getState().fitViewRequest).toBe(before + 1);
    expect(useNetworkStore.getState().fitViewNodes).toEqual([device.id]);
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
    const rows = (['tpl-router', 'tpl-firewall', 'tpl-switch'] as const).map((templateId, index) => ({
      id: `row-${index}`,
      templateId,
      quantity: 1,
      portCount: 8,
    }));
    bulkAddDevices(
      rows,
      { 'tpl-pc': 1 },
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

describe('the DNS server of the project on a new device', () => {
  const DNS = '192.168.1.53';
  const useServer = () => useNetworkStore.getState().setGlobalNetworkSettings({ dns: DNS });

  it.each([
    ['PC', 'tpl-pc'],
    ['Server', 'tpl-server'],
    ['Server', 'tpl-mailserver'],
    ['Database', 'tpl-database'],
  ])('the card of a new %s (%s) starts with it', (type, templateId) => {
    useServer();
    expect(add(type, templateId).nics?.map(card => card.dns)).toEqual([DNS]);
  });

  it('is shown in the window, where it can be changed or taken away before adding', () => {
    useServer();
    useUIStore.getState().setAddDeviceType('PC', 'tpl-pc');
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    expect(screen.getByLabelText('Server DNS')).toHaveValue(DNS);
    expect(screen.getByRole('group', { name: 'Rete · eth0' })).toHaveTextContent(
      'Subnet mask, gateway e server DNS sono quelli delle Impostazioni → Rete.'
    );

    fireEvent.change(screen.getByLabelText('Server DNS'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    const devices = useNetworkStore.getState().devices;
    expect(devices[devices.length - 1].nics?.[0].dns).toBeUndefined();
  });

  it('a card left to DHCP does not keep it: its server comes with the address', () => {
    useServer();
    useUIStore.getState().setAddDeviceType('PC', 'tpl-pc');
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    const devices = useNetworkStore.getState().devices;
    expect(devices[devices.length - 1].nics?.[0]).toMatchObject({ dhcp: true });
    expect(devices[devices.length - 1].nics?.[0].dns).toBeUndefined();
  });

  it('without one in the project a new card names no server, and the window does not speak of it', () => {
    expect('dns' in (add('PC', 'tpl-pc').nics?.[0] ?? {})).toBe(false);
    useUIStore.getState().setAddDeviceType('PC', 'tpl-pc');
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    expect(screen.getByLabelText('Server DNS')).toHaveValue('');
    expect(screen.getByRole('group', { name: 'Rete · eth0' })).toHaveTextContent(
      'Subnet mask e gateway sono quelli delle Impostazioni → Rete.'
    );
  });

  it.each([
    ['AccessPoint', 'tpl-accesspoint'],
    ['LoadBalancer', 'tpl-loadbalancer'],
    ['Cloud', 'tpl-cloud'],
  ])('a %s has a card but is not an end device: its card starts without', (type, templateId) => {
    useServer();
    const device = add(type, templateId);
    expect(device.nics).toHaveLength(1);
    expect('dns' in (device.nics?.[0] ?? {})).toBe(false);

    useUIStore.getState().setAddDeviceType(type, templateId);
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    expect(screen.getByRole('group', { name: 'Rete · eth0' })).toHaveTextContent(
      'Subnet mask e gateway sono quelli delle Impostazioni → Rete.'
    );
  });

  it.each([
    ['Router', 'tpl-router'],
    ['Firewall', 'tpl-firewall'],
    ['Switch', 'tpl-switch'],
  ])('a %s has no card: nothing of it is written on the device', (type, templateId) => {
    useServer();
    const device = add(type, templateId);
    expect(device.nics).toBeUndefined();
    expect(JSON.stringify(device)).not.toContain(DNS);
  });

  it('bulk add: the cards of the end devices start with it, switches and routers have none', () => {
    useServer();
    const { globalNetworkSettings, addDevice } = useNetworkStore.getState();
    const rows = (['tpl-router', 'tpl-switch'] as const).map((templateId, index) => ({
      id: `row-${index}`,
      templateId,
      quantity: 1,
      portCount: 8,
    }));
    bulkAddDevices(
      rows,
      { 'tpl-pc': 2, 'tpl-server': 1, 'tpl-cloud': 1, 'tpl-accesspoint': 1 },
      [],
      globalNetworkSettings,
      useTemplateStore.getState().templates,
      addDevice
    );

    const cards = useNetworkStore.getState().devices.map(device => [device.type, device.nics?.map(card => card.dns)]);
    expect(cards).toEqual([
      ['Router', undefined],
      ['Switch', undefined],
      ['PC', [DNS]],
      ['PC', [DNS]],
      ['Server', [DNS]],
      ['Cloud', [undefined]],
      ['AccessPoint', [undefined]],
    ]);
    expect(JSON.stringify(useNetworkStore.getState().devices.filter(d => !d.nics))).not.toContain(DNS);
  });

  it('bulk add without one in the project: no card names a server', () => {
    const { globalNetworkSettings, addDevice } = useNetworkStore.getState();
    bulkAddDevices([], { 'tpl-pc': 1 }, [], globalNetworkSettings, useTemplateStore.getState().templates, addDevice);
    expect('dns' in (useNetworkStore.getState().devices[0].nics?.[0] ?? {})).toBe(false);
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
    expect(screen.getByLabelText('Subnet mask')).toHaveValue('255.255.255.0');
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
    expect(screen.getByLabelText('Subnet mask')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Numero di porte')).toHaveValue('24');
    fireEvent.change(screen.getByLabelText('Numero di porte'), { target: { value: '8' } });
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

describe('AddDeviceModal — the name of a new device is proposed, to be changed', () => {
  /** The name the window shows for a new device of a template; `typed` replaces it, and the device is added */
  const addNamed = (type: string, templateId: string, typed?: string) => {
    useUIStore.getState().setAddDeviceType(type, templateId);
    useUIStore.getState().openModal('addDevice');
    const view = render(<AddDeviceModal />);
    const shown = screen.getByLabelText<HTMLInputElement>(/^Nome del dispositivo/).value;
    if (typed !== undefined) {
      fireEvent.change(screen.getByLabelText(/^Nome del dispositivo/), { target: { value: typed } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    view.unmount();
    return shown;
  };
  const labels = () => useNetworkStore.getState().devices.map((device) => device.label);

  it('the name of the template and the lowest number that is free, from 1', () => {
    expect(addNamed('PC', 'tpl-pc')).toBe('PC-1');
    expect(addNamed('PC', 'tpl-pc')).toBe('PC-2');
    // (the number is of the template: a printer is of the type of a PC)
    expect(addNamed('PC', 'tpl-printer')).toBe('Printer-1');
    expect(addNamed('Server', 'tpl-mailserver')).toBe('Mail-Server-1');
    expect(labels()).toEqual(['PC-1', 'PC-2', 'Printer-1', 'Mail-Server-1']);
  });

  it('what is typed in its place is the name of the device, and the next proposal does not repeat it', () => {
    expect(addNamed('PC', 'tpl-pc', 'Reception')).toBe('PC-1');
    expect(labels()).toEqual(['Reception']);

    // a name of the kind the window proposes, typed by hand and in small letters
    expect(addNamed('PC', 'tpl-pc', 'pc-1')).toBe('PC-1');
    expect(addNamed('PC', 'tpl-pc')).toBe('PC-2');
    expect(labels()).toEqual(['Reception', 'pc-1', 'PC-2']);
  });

  it('a name another device has is an error under the field, and nothing is added until it is changed', () => {
    addNamed('PC', 'tpl-pc', 'Reception');
    useUIStore.getState().setAddDeviceType('Server', 'tpl-server');
    useUIStore.getState().openModal('addDevice');
    render(<AddDeviceModal />);
    const field = () => screen.getByLabelText(/^Nome del dispositivo/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // the same name, whatever its case and the spaces around it
    fireEvent.change(field(), { target: { value: '  reception ' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Un altro dispositivo ha già questo nome');
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    expect(labels()).toEqual(['Reception']);
    // the window stays open, with the name as it was typed
    expect(field()).toHaveValue('  reception ');

    fireEvent.change(field(), { target: { value: 'Reception-2' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));
    expect(labels()).toEqual(['Reception', 'Reception-2']);
  });
});
