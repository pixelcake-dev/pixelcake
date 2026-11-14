/**
 * InspectorModal tests — the first screen of the window, which is made for
 * the device it is about, and the one form behind every tab: ports and cards
 * are typed straight into it and saved with the device. Runs against the
 * real stores with the small sample network:
 *
 *            Router-1
 *     port 1 /       \ port 2
 *   192.168.10.1     192.168.20.1
 *        |                |
 *    SW-Office        SW-Servers
 *     /     \          /      \
 *  PC-1    PC-2     Web-01   Mail-01
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import type { NetworkDevice, Port } from '@/types';
import InspectorModal from './InspectorModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const store = () => useNetworkStore.getState();

function device(label: string): NetworkDevice {
  const found = store().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

/** Open the inspector on a device, as a double click on the canvas does */
function openInspector(label: string) {
  cleanup();
  useUIStore.getState().setInspectorDevice(device(label));
  useUIStore.getState().openModal('inspector');
  render(<InspectorModal />);
}

const tabNames = () => Array.from(document.querySelectorAll('.tab-header')).map(tab => tab.textContent);
const openedTab = () => document.querySelector('.tab-header.active');
const openTab = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
const selectPort = (id: number) => fireEvent.click(screen.getByText(String(id), { selector: '.port-number' }));
/** The sections of the first screen, by the name over each */
const sections = () => screen.getAllByRole('group').map(group => group.querySelector('legend')?.textContent);
const section = (name: string) => screen.getByRole('group', { name });
const setPorts = (label: string, change: (port: Port) => Port) => {
  const d = device(label);
  store().updateDevice(d.id, { ports: d.ports?.map(change) });
};

function addFirewall(ports: Port[]): void {
  store().addDevice({
    type: 'Firewall',
    templateId: 'tpl-firewall',
    label: 'FW-1',
    ip: '10.0.0.2',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    portCount: ports.length,
    ports,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(toast.error).mockClear();
  store().clearAllDevices();
  const sample = createSampleTopology();
  store().loadTopology(sample.devices, sample.connections);
  useUIStore.getState().closeModal('inspector');
});

describe('InspectorModal — the first screen of an end device', () => {
  it('is what the device is and how it is addressed, with the address typed there', () => {
    openInspector('PC-1');
    expect(tabNames()).toEqual(['Generale', 'Schede di rete (1)']);
    expect(sections()).toEqual(['Identità', 'Rete · eth0']);

    const identity = section('Identità');
    expect(within(identity).getByLabelText('Tipo')).toHaveTextContent('PC');
    expect(within(identity).getByLabelText('Nome del dispositivo')).toHaveValue('PC-1');
    // a PC is not asked who made it or where it is
    expect(within(identity).queryByLabelText('Vendor')).not.toBeInTheDocument();

    const network = section('Rete · eth0');
    expect(within(network).getByLabelText('Indirizzo')).toHaveValue('manual');
    expect(within(network).getByLabelText('Indirizzo IP')).toHaveValue('192.168.10.11');
    expect(within(network).getByLabelText('Subnet mask')).toHaveValue('255.255.255.0');
    expect(within(network).getByLabelText('Gateway')).toHaveValue('192.168.10.1');
    expect(within(network).getByLabelText('Server DNS')).toHaveValue('');
    expect(network).toHaveTextContent(/Collegata a SW-Office \(porta \d+\)\./);
  });

  it('an address typed on the first screen is the one of the card, and is saved with the device', () => {
    openInspector('PC-1');
    type('Indirizzo IP', ' 192.168.10.50 ');
    // it is one form: the card shows it too
    openTab(/^Schede di rete/);
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue(' 192.168.10.50 ');
    expect(screen.getByText(' 192.168.10.50 ', { selector: '.nic-address', normalizer: text => text })).toBeInTheDocument();
    // nothing reaches the drawing before the device is saved
    expect(device('PC-1').nics?.[0].ip).toBe('192.168.10.11');

    save();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('PC-1').nics?.[0].ip).toBe('192.168.10.50');
    expect(device('PC-1').ip).toBe('192.168.10.50');
  });

  it('sends to «Schede di rete» for the rest of the card', () => {
    openInspector('PC-1');
    fireEvent.click(screen.getByRole('button', { name: 'scheda «Schede di rete»' }));
    expect(openedTab()).toHaveTextContent(/^Schede di rete/);
    // a device with one card shows its settings at once
    expect(screen.getByLabelText('Nome dell\'interfaccia')).toHaveValue('eth0');
    expect(screen.getByLabelText('Indirizzo MAC')).toBeInTheDocument();
  });

  it('a server is also asked who made it and where it is, and has its tabs', () => {
    openInspector('Web-01');
    expect(tabNames()).toEqual(['Generale', 'Schede di rete (1)', 'DHCP', 'DNS']);
    const identity = section('Identità');
    expect(within(identity).getByLabelText('Vendor')).toBeInTheDocument();
    expect(within(identity).getByLabelText('Posizione')).toBeInTheDocument();
    expect(sections()).toEqual(['Identità', 'Rete · eth0']);
  });

  it('a name is asked for', () => {
    openInspector('PC-1');
    type('Nome del dispositivo', '  ');
    save();
    expect(toast.error).toHaveBeenCalledWith('Il nome è obbligatorio');
    expect(device('PC-1').label).toBe('PC-1');
  });
});

describe('InspectorModal — the first screen of a switch', () => {
  it('has its address, its VLANs, how its ports are split, and the spanning tree last', () => {
    openInspector('SW-Office');
    expect(tabNames()[0]).toBe('Generale');
    expect(tabNames()[1]).toMatch(/^Porte \(\d+\)$/);
    expect(sections()).toEqual(['Identità', 'Rete', 'VLAN', 'Porte', 'Spanning tree']);
    expect(within(section('Rete')).getByLabelText('Indirizzo IP')).toHaveValue(device('SW-Office').ip);
    expect(within(section('Spanning tree')).getByLabelText('STP attivo')).not.toBeChecked();
    expect(section('Spanning tree')).toHaveTextContent('il motore non lo simula');
  });

  it('the bridge priority goes from 0 to 61440 in steps of 4096, and nothing else is kept', () => {
    openInspector('SW-Office');
    fireEvent.click(within(section('Spanning tree')).getByLabelText('STP attivo'));
    const field = () => within(section('Spanning tree')).getByLabelText('Priorità del bridge');
    expect(field()).toHaveAttribute('min', '0');
    expect(field()).toHaveAttribute('max', '61440');
    expect(field()).toHaveAttribute('step', '4096');
    expect(field()).toHaveValue(32768);
    expect(section('Spanning tree')).toHaveTextContent('Da 0 a 61440 a passi di 4096 (predefinita 32768)');

    // Past the last value: leaving the field brings it back to the last one
    fireEvent.change(field(), { target: { value: '65535' } });
    fireEvent.blur(field());
    expect(field()).toHaveValue(61440);

    // Between two steps, and saved without leaving the field: the nearest step is kept
    fireEvent.change(field(), { target: { value: '5000' } });
    save();
    expect(device('SW-Office').stp).toMatchObject({ enabled: true, priority: 4096 });

    // 0 is a priority (the lowest), not an empty field
    openInspector('SW-Office');
    expect(field()).toHaveValue(4096);
    fireEvent.change(field(), { target: { value: '0' } });
    save();
    expect(device('SW-Office').stp?.priority).toBe(0);
    openInspector('SW-Office');
    expect(field()).toHaveValue(0);

    // An empty field is the default
    fireEvent.change(field(), { target: { value: '' } });
    save();
    expect(device('SW-Office').stp?.priority).toBe(32768);
  });

  it('with no VLAN on its ports says they are one network, and counts them', () => {
    setPorts('SW-Office', port => ({ ...port, vlan: undefined, portType: 'access' }));
    openInspector('SW-Office');
    const total = device('SW-Office').ports?.length ?? 0;
    const ports = section('Porte');
    expect(ports).toHaveTextContent(new RegExp(`${total} porte · \\d+ collegate\\.`));
    expect(ports).toHaveTextContent('Nessuna porta ha una VLAN: tutte le porte sono nella stessa rete.');
  });

  it('with VLANs says which ports are in each, and what the trunks carry, as the engine reads them', () => {
    setPorts('SW-Office', port => {
      if (port.id <= 2) return { ...port, portType: 'access', vlan: 10 };
      if (port.id === 3) return { ...port, portType: 'access', vlan: 20 };
      if (port.id === 8) return { ...port, portType: 'trunk', vlan: [20, 10] };
      return { ...port, portType: 'access', vlan: undefined };
    });
    openInspector('SW-Office');
    const lines = within(section('Porte')).getAllByRole('listitem').map(item => item.textContent);
    expect(lines.slice(0, 3)).toEqual(['VLAN 1: porte 4–7', 'VLAN 10: porte 1, 2', 'VLAN 20: porta 3']);
    expect(lines).toContain('Trunk: porta 8, trasporta le VLAN 10, 20');
  });

  it('the summary follows the ports as they are typed, and opens «Porte»', () => {
    setPorts('SW-Office', port => ({ ...port, vlan: undefined, portType: 'access' }));
    openInspector('SW-Office');
    fireEvent.click(within(section('Porte')).getByRole('button', { name: 'Apri la scheda «Porte»' }));
    expect(openedTab()).toHaveTextContent(/^Porte/);
    selectPort(1);
    type('VLAN (singola)', '30');
    openTab('Generale');
    expect(within(section('Porte')).getAllByRole('listitem').map(item => item.textContent)).toContain('VLAN 30: porta 1');
  });
});

describe('InspectorModal — the first screen of a router or a firewall', () => {
  it('lists the ports in use of a router: address, link, what each does', () => {
    setPorts('Router-1', port =>
      port.id === 1
        ? { ...port, dhcpServer: { start: '192.168.10.100', end: '192.168.10.199' } }
        : port.id === 2
          ? { ...port, nat: true, enabled: false }
          : port
    );
    openInspector('Router-1');
    // a router is not asked about the spanning tree, whatever its template says
    expect(sections()).toEqual(['Identità', 'Rete', 'VLAN', 'Porte in uso']);
    const table = within(section('Porte in uso')).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
      'Porta',
      'Indirizzo',
      'Collegata a',
      'Ruolo',
    ]);
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getAllByRole('cell').map(cell => cell.textContent));
    expect(rows).toEqual([
      ['Porta 1 «LAN Uffici»', '192.168.10.1/24', expect.stringMatching(/^SW-Office \(porta \d+\)$/), 'server DHCP'],
      ['Porta 2 «LAN Server»', '192.168.20.1/24', expect.stringMatching(/^SW-Servers \(porta \d+\)$/), 'NAT · disabilitata'],
    ]);
    const spare = (device('Router-1').ports?.length ?? 0) - 2;
    expect(section('Porte in uso')).toHaveTextContent(`Altre ${spare} porte sono libere: senza indirizzo e senza cavo.`);
  });

  it('the name of a port opens that port in «Porte»', () => {
    openInspector('Router-1');
    fireEvent.click(screen.getByRole('button', { name: 'Porta 2 «LAN Server»' }));
    expect(openedTab()).toHaveTextContent(/^Porte/);
    expect(screen.getByRole('heading', { name: 'Porta 2 «LAN Server»' })).toBeInTheDocument();
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.20.1');
  });

  it('follows the form: an address typed on a port is in the list at once', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(3);
    type('Indirizzo IP', '10.0.0.1');
    type('Subnet mask', '255.255.255.252');
    openTab('Generale');
    expect(section('Porte in uso')).toHaveTextContent('10.0.0.1/30');
  });

  it('of a firewall shows the zone of each port too', () => {
    addFirewall([
      { id: 1, enabled: true, speed: 'auto', portType: 'lan', securityZone: 'trust', ip: '10.0.0.2', subnet: '255.255.255.252' },
      { id: 2, enabled: true, speed: 'auto', portType: 'wan', securityZone: 'untrust', ip: '203.0.113.1', nat: true },
      { id: 3, enabled: true, speed: 'auto', portType: 'lan', ip: '172.16.0.1', subnet: '255.255.0.0' },
      { id: 4, enabled: true, speed: 'auto', portType: 'lan' },
    ]);
    openInspector('FW-1');
    const table = within(section('Porte in uso')).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
      'Porta',
      'Indirizzo',
      'Zona',
      'Collegata a',
      'Ruolo',
    ]);
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getAllByRole('cell').map(cell => cell.textContent));
    expect(rows).toEqual([
      ['Porta 1', '10.0.0.2/30', 'Trust', '—', '—'],
      ['Porta 2', '203.0.113.1/24', 'Untrust', '—', 'NAT'],
      ['Porta 3', '172.16.0.1/16', '—', '—', '—'],
    ]);
    expect(section('Porte in uso')).toHaveTextContent("Un'altra porta è libera: senza indirizzo e senza cavo.");
  });

  it('with no port in use says so, and sends to «Porte»', () => {
    addFirewall([
      { id: 1, enabled: true, speed: 'auto', portType: 'lan' },
      { id: 2, enabled: true, speed: 'auto', portType: 'wan' },
    ]);
    openInspector('FW-1');
    const used = section('Porte in uso');
    expect(used).toHaveTextContent('Nessuna delle 2 porte ha un indirizzo o un cavo');
    expect(within(used).queryByRole('table')).toBeNull();
    fireEvent.click(within(used).getByRole('button', { name: 'Apri la scheda «Porte»' }));
    expect(openedTab()).toHaveTextContent(/^Porte/);
  });
});

describe('InspectorModal — ports are typed straight into the form', () => {
  it('there is one «Salva»: what is typed on a port is saved with the device', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(3);
    expect(screen.getAllByRole('button', { name: 'Salva' })).toHaveLength(1);
    type('Nome della porta (facoltativo)', ' Internet ');
    type('Indirizzo IP', '203.0.113.2');
    fireEvent.click(screen.getByLabelText('NAT attivo'));
    // nothing reaches the drawing before the device is saved
    expect(device('Router-1').ports?.[2].ip).toBeUndefined();

    save();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Router-1').ports?.[2]).toMatchObject({
      name: 'Internet',
      ip: '203.0.113.2',
      subnet: '255.255.255.0',
      nat: true,
    });
  });

  it('what is typed on a port stays when another port is picked, and when another tab is opened', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(3);
    type('Nome della porta (facoltativo)', 'Internet');
    selectPort(4);
    expect(screen.getByLabelText('Nome della porta (facoltativo)')).toHaveValue('');
    openTab('Generale');
    openTab(/^Porte/);
    selectPort(3);
    expect(screen.getByLabelText('Nome della porta (facoltativo)')).toHaveValue('Internet');
  });

  it('an address that is not one is said under its field, and the device is not saved with it', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(3);
    type('Indirizzo IP', 'abc');
    expect(screen.getByRole('alert')).toHaveTextContent('"abc" non è un indirizzo IPv4 valido');

    save();
    expect(toast.error).toHaveBeenCalledWith('Porta 3: "abc" non è un indirizzo IPv4 valido');
    expect(device('Router-1').ports?.[2].ip).toBeUndefined();
    expect(useUIStore.getState().modals.inspector).toBe(true);
  });

  it('«Annulla» leaves the device as it was', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    type('Indirizzo IP', '10.1.1.1');
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(device('Router-1').ports?.[0].ip).toBe('192.168.10.1');
  });

  it('a port that is off can still be picked, to be switched on again', () => {
    setPorts('Router-1', port => (port.id === 2 ? { ...port, enabled: false } : port));
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(2);
    expect(screen.getByLabelText('Porta attiva')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Porta attiva'));
    save();
    expect(device('Router-1').ports?.[1].enabled).toBe(true);
  });
});

describe('InspectorModal — the number of ports', () => {
  const count = () => screen.getByLabelText<HTMLSelectElement>('Numero di porte');
  const boxes = () => document.querySelectorAll('.port-box').length;

  it('offers the sizes the device can be made with, and the one it has', () => {
    openInspector('SW-Office');
    openTab(/^Porte/);
    const total = device('SW-Office').ports?.length ?? 0;
    expect(count().value).toBe(String(total));
    const options = Array.from(count().options).map(option => Number(option.value));
    expect(options).toEqual([...new Set([5, 8, 16, 24, 48, total])].sort((a, b) => a - b));
  });

  it('more ports are added at the end, as the device is made with, and saved with it', () => {
    openInspector('SW-Office');
    openTab(/^Porte/);
    const before = device('SW-Office').ports ?? [];
    fireEvent.change(count(), { target: { value: '48' } });
    expect(boxes()).toBe(48);
    expect(screen.getByRole('button', { name: 'Porte (48)' })).toBeInTheDocument();
    expect(device('SW-Office').ports).toHaveLength(before.length);

    save();
    const after = device('SW-Office');
    expect(after.ports).toHaveLength(48);
    expect(after.portCount).toBe(48);
    // those it had are as they were; the new ones are plain access ports
    expect(after.ports?.slice(0, before.length)).toEqual(before);
    expect(after.ports?.[47]).toEqual({ id: 48, enabled: true, speed: 'auto', portType: 'access' });
  });

  it('a new port of a router is a LAN port', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    const before = device('Router-1').ports?.length ?? 0;
    fireEvent.change(count(), { target: { value: '16' } });
    save();
    expect(device('Router-1').ports).toHaveLength(16);
    expect(device('Router-1').ports?.[before]).toEqual({ id: before + 1, enabled: true, speed: 'auto', portType: 'lan' });
  });

  it('fewer ports: the last ones go, when no cable is on them', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(4);
    fireEvent.change(count(), { target: { value: '2' } });
    expect(toast.error).not.toHaveBeenCalled();
    expect(boxes()).toBe(2);
    // the port that was open is gone: nothing is open
    expect(screen.getByText('Scegli una porta per vederne e cambiarne le impostazioni.')).toBeInTheDocument();

    save();
    expect(device('Router-1').ports?.map(port => port.id)).toEqual([1, 2]);
    expect(device('Router-1').portCount).toBe(2);
  });

  it('a port with a cable on it is not taken away: it says which, and nothing changes', () => {
    // a cable on the last port of the router
    const router = device('Router-1');
    const last = router.ports?.length ?? 0;
    store().addDevice({
      type: 'PC',
      templateId: 'tpl-pc',
      label: 'Ext',
      ip: '10.0.0.5',
      subnet: '255.255.255.0',
      gateway: '',
      position: { x: 0, y: 0 },
      nics: [{ id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip: '10.0.0.5', subnet: '255.255.255.0', gateway: '' }],
    });
    store().addConnection({ source: device('Ext').id, target: router.id, sourceNic: 'nic-1', targetPort: last });

    openInspector('Router-1');
    openTab(/^Porte/);
    fireEvent.change(count(), { target: { value: '2' } });
    expect(toast.error).toHaveBeenCalledWith(
      `La porta ${last} ha un cavo collegato: scollegalo prima di togliere la porta`
    );
    expect(boxes()).toBe(last);
    expect(count().value).toBe(String(last));
  });

  it('a device saved without touching the number keeps the one it had written', () => {
    const before = device('Router-1').portCount;
    openInspector('Router-1');
    type('Nome del dispositivo', 'Router-A');
    save();
    expect(device('Router-A').portCount).toBe(before);
  });
});

describe('InspectorModal — the cards of a device', () => {
  const rowNames = () => Array.from(document.querySelectorAll('.nic-name')).map(cell => cell.textContent);

  it('a card is added, opens to be set, and is saved with the device', () => {
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi scheda' }));
    expect(rowNames()).toEqual(['eth0', 'eth1']);
    expect(screen.getByRole('button', { name: 'Schede di rete (2)' })).toBeInTheDocument();
    // the new card is the one open
    expect(screen.getByLabelText('Nome dell\'interfaccia')).toHaveValue('eth1');
    type('Indirizzo IP', '10.0.0.10');

    save();
    expect(toast.error).not.toHaveBeenCalled();
    const cards = device('Web-01').nics ?? [];
    expect(cards.map(card => card.name)).toEqual(['eth0', 'eth1']);
    expect(cards[1]).toMatchObject({ id: 'nic-2', ip: '10.0.0.10', enabled: true });
    // the device is still named by its first card
    expect(device('Web-01').ip).toBe('192.168.20.10');
  });

  it('two cards may not have one name', () => {
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi scheda' }));
    type('Nome dell\'interfaccia', 'eth0');
    save();
    expect(toast.error).toHaveBeenCalledWith('Due schede si chiamano eth0: ogni scheda ha un nome suo');
    expect(device('Web-01').nics).toHaveLength(1);
  });

  it('a card is taken away, and the one left cannot be', () => {
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi scheda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Elimina la scheda eth1' }));
    expect(rowNames()).toEqual(['eth0']);
    expect(screen.queryByRole('button', { name: /^Elimina la scheda/ })).not.toBeInTheDocument();
  });

  it('the first screen says that the first of several cards is the one the device is named by', () => {
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi scheda' }));
    openTab('Generale');
    expect(section('Rete · eth0')).toHaveTextContent('È la prima di 2 schede, quella con cui il dispositivo viene nominato');
  });
});
