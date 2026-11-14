/**
 * InspectorModal tests — DHCP: the server on a router port and on a card of a
 * server, the card that takes its address from it, the «DHCP» tab, what is
 * refused, and what reaches the store (and with it the engine). Runs against
 * the real stores with the small sample network:
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
import { resolveDhcp, traceRoute } from '@/engine';
import type { DhcpPool, NetworkDevice } from '@/types';
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

const tabNames = () =>
  Array.from(document.querySelectorAll('.tab-header')).map(tab => tab.textContent);
const openTab = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
/** The one «Salva» of the window: ports and cards are typed straight into its form */
const saveDevice = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
const selectPort = (id: number) => fireEvent.click(screen.getByText(String(id), { selector: '.port-number' }));
const selectCard = (name: string) => fireEvent.click(screen.getByText(name, { selector: '.nic-name' }));
const section = (name: string) => screen.getByRole('region', { name });
const openedTab = () => document.querySelector('.tab-header.active');

/** The rows of «Intervalli di indirizzi» as read: the interface, its tick, its fields, what is said below them */
function poolRows() {
  return within(section('Intervalli di indirizzi'))
    .getAllByRole('listitem')
    .map(item => {
      const last = item.lastElementChild;
      return {
        name: item.querySelector('label')?.textContent,
        on: within(item).getByRole<HTMLInputElement>('checkbox').checked,
        range: within(item)
          .queryAllByRole<HTMLInputElement>('textbox')
          .map(field => field.value),
        says: last?.tagName === 'SPAN' ? last.textContent : '',
      };
    });
}

/** Put a pool on a port of Router-1, as the store keeps it */
function setPool(portId: number, pool: DhcpPool | undefined) {
  const router = device('Router-1');
  store().updateDevice(router.id, {
    ports: router.ports?.map(p => (p.id === portId ? { ...p, dhcpServer: pool } : p)),
  });
}

/** Put the first card of a device on DHCP, as the store keeps it */
function setAutomatic(label: string) {
  const d = device(label);
  store().updateDevice(d.id, { nics: d.nics?.map((nic, i) => (i === 0 ? { ...nic, dhcp: true } : nic)) });
}

const OFFICE: DhcpPool = { start: '192.168.10.100', end: '192.168.10.199' };

beforeEach(() => {
  localStorage.clear();
  vi.mocked(toast.error).mockClear();
  store().clearAllDevices();
  const sample = createSampleTopology();
  store().loadTopology(sample.devices, sample.connections);
  useUIStore.getState().closeModal('inspector');
});

describe('InspectorModal — the DHCP server of a port', () => {
  it('is switched on port by port, with its range, and saved with the device', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    // off: no range to type
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).not.toBeChecked();
    expect(screen.queryByLabelText('Primo indirizzo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', ' 192.168.10.100 ');
    type('Ultimo indirizzo', '192.168.10.199');
    expect(screen.getByRole('button', { name: 'DHCP (1)' })).toBeInTheDocument();
    // nothing reaches the drawing before the device is saved
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();

    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual(OFFICE);
    expect(device('Router-1').ports?.[1].dhcpServer).toBeUndefined();
  });

  it('keeps a gateway only when one is typed', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', '192.168.10.100');
    type('Ultimo indirizzo', '192.168.10.199');
    type('Gateway consegnato (opzionale)', '192.168.10.254');
    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({ ...OFFICE, gateway: '192.168.10.254' });
  });

  it('shows what is saved when the port is opened again, and is switched off by the same tick', () => {
    setPool(1, { ...OFFICE, gateway: '192.168.10.254' });
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).toBeChecked();
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue('192.168.10.100');
    expect(screen.getByLabelText('Ultimo indirizzo')).toHaveValue('192.168.10.199');
    expect(screen.getByLabelText('Gateway consegnato (opzionale)')).toHaveValue('192.168.10.254');

    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();
    expect(device('Router-1').ports?.[0]).toMatchObject({ ip: '192.168.10.1', subnet: '255.255.255.0' });
  });

  it.each([
    ['192.168.10.100', '', 'servono il primo e l\'ultimo indirizzo'],
    ['192.168.10.100', 'dieci', '"dieci" non è un indirizzo IPv4 valido'],
    ['192.168.20.100', '192.168.20.199', '192.168.20.100 è fuori dalla rete della porta (192.168.10.0/24)'],
    ['192.168.10.199', '192.168.10.100', 'l\'ultimo indirizzo (192.168.10.100) viene prima del primo (192.168.10.199)'],
  ])('says why the range %s – %s cannot work while it is typed, and does not save it', (first, last, message) => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', first);
    type('Ultimo indirizzo', last);
    expect(screen.getByRole('alert')).toHaveTextContent(message);

    saveDevice();
    expect(toast.error).toHaveBeenCalledWith(`Porta 1, server DHCP: ${message}`);
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();
    // the window stays open on the port, with what was typed
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue(first);
  });

  it('ticked, starts from a range of the network of the port; emptied, it is not kept and is not an error', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue('192.168.10.100');
    expect(screen.getByLabelText('Ultimo indirizzo')).toHaveValue('192.168.10.199');
    // what it gives out is said under the fields, as in the «DHCP» tab
    expect(screen.getByText('Gateway consegnato 192.168.10.1 · 0 assegnati, 100 liberi su 100')).toBeInTheDocument();

    type('Primo indirizzo', '');
    type('Ultimo indirizzo', '');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/un intervallo lasciato vuoto non viene salvato/)).toBeInTheDocument();
    expect(tabNames()).toContain('DHCP');
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();
  });

  it('refuses a gateway outside the network, and a range on a port without an address', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', '192.168.10.100');
    type('Ultimo indirizzo', '192.168.10.199');
    type('Gateway consegnato (opzionale)', '10.0.0.1');
    expect(screen.getByRole('alert')).toHaveTextContent('10.0.0.1 è fuori dalla rete della porta (192.168.10.0/24)');

    // the error goes away with the next keystroke
    type('Gateway consegnato (opzionale)', '');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    type('Indirizzo IP', '');
    type('Subnet Mask', '');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'la porta non ha un indirizzo: gli indirizzi da assegnare sono quelli della sua rete'
    );
  });

  it('checks the range against the address as it is typed now, not as it was', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    type('Indirizzo IP', '172.16.5.1');
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', '172.16.5.10');
    type('Ultimo indirizzo', '172.16.5.20');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    saveDevice();
    expect(device('Router-1').ports?.[0]).toMatchObject({
      ip: '172.16.5.1',
      dhcpServer: { start: '172.16.5.10', end: '172.16.5.20' },
    });
  });

  it('is not offered on the ports of a switch', () => {
    openInspector('SW-Office');
    openTab(/^Porte/);
    selectPort(1);
    expect(screen.queryByLabelText(/^Server DHCP Abilitato/)).not.toBeInTheDocument();
    expect(tabNames()).not.toContain('DHCP');
  });

  it('a pool that no longer fits its port is refused when the device is saved', () => {
    // (as it can come from a file: the address of the port is of another network)
    setPool(1, { start: '10.0.0.10', end: '10.0.0.20' });
    openInspector('Router-1');
    saveDevice();
    expect(toast.error).toHaveBeenCalledWith(
      'Porta 1, server DHCP: 10.0.0.10 è fuori dalla rete della porta (192.168.10.0/24)'
    );
    // the window stays open
    expect(screen.getByRole('button', { name: /^Porte/ })).toBeInTheDocument();
  });
});

describe('InspectorModal — a card on DHCP', () => {
  it('offers the two ways of having an address, by hand first', () => {
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    const mode = screen.getByLabelText('Indirizzo') as HTMLSelectElement;
    expect(Array.from(mode.options).map(option => option.textContent)).toEqual(['Manuale', 'Automatico (DHCP)']);
    expect(mode.value).toBe('manual');
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.10.11');
  });

  it('shows the lease in place of the three fields, and saves a card with no address of its own', () => {
    setPool(1, OFFICE);
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });

    for (const label of ['Indirizzo IP', 'Subnet Mask', 'Gateway']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    const lease = screen.getByTestId('nic-lease');
    expect(lease).toHaveTextContent('192.168.10.100 da Router-1, porta 1');
    expect(lease).toHaveTextContent('Subnet mask 255.255.255.0 · gateway 192.168.10.1');
    expect(lease.style.borderLeft).toContain('--ok-color');

    // the row of the card and the first screen show the leased address
    expect(screen.getByText('192.168.10.100 · DHCP')).toBeInTheDocument();
    openTab('Generale');
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('dhcp');
    expect(screen.queryByLabelText('Indirizzo IP')).not.toBeInTheDocument();
    expect(screen.getByTestId('nic-lease')).toHaveTextContent('192.168.10.100 da Router-1, porta 1');
    expect(screen.getByTestId('nic-lease')).toHaveTextContent('Subnet mask 255.255.255.0 · gateway 192.168.10.1');

    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    const pc = device('PC-1');
    expect(pc.nics?.[0]).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '' });
    expect(pc).toMatchObject({ ip: '', gateway: '' });
    // and the engine gives it the address the window announced
    const { devices, connections } = store();
    expect(traceRoute(pc.id, device('Web-01').id, { devices, connections })).toMatchObject({
      verdict: 'success',
      sourceIp: '192.168.10.100',
    });
  });

  it('says why there is no lease when no server answers, and still lets the card be saved', () => {
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });
    const lease = screen.getByTestId('nic-lease');
    expect(lease).toHaveTextContent('Nessun indirizzo: nessun server DHCP risponde sulla sua rete');
    expect(lease).not.toHaveTextContent('Subnet mask');
    expect(lease.style.borderLeft).toContain('--danger-color');

    expect(screen.getByText('DHCP: nessun indirizzo')).toBeInTheDocument();
    openTab('Generale');
    expect(screen.getByTestId('nic-lease')).toHaveTextContent(
      'Nessun indirizzo: nessun server DHCP risponde sulla sua rete'
    );
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('PC-1').nics?.[0].dhcp).toBe(true);
  });

  it('previews the lease the card would get, counting the cards already served', () => {
    setPool(1, OFFICE);
    setAutomatic('PC-1');
    // PC-1 comes first in the drawing and has .100: PC-2 would get .101
    openInspector('PC-2');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });
    expect(screen.getByTestId('nic-lease')).toHaveTextContent('192.168.10.101 da Router-1, porta 1');
  });

  it('goes back to an address by hand starting from the one it was leased', () => {
    setPool(1, OFFICE);
    setAutomatic('PC-1');
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('dhcp');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.10.100');
    expect(screen.getByLabelText('Subnet Mask')).toHaveValue('255.255.255.0');
    expect(screen.getByLabelText('Gateway')).toHaveValue('192.168.10.1');

    saveDevice();
    const card = device('PC-1').nics?.[0];
    expect(card).toMatchObject({ ip: '192.168.10.100', subnet: '255.255.255.0', gateway: '192.168.10.1' });
    expect(card?.dhcp).toBeUndefined();
    expect(device('PC-1').ip).toBe('192.168.10.100');
  });

  it('going to DHCP and back before saving loses nothing of what was typed', () => {
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.10.11');
    expect(screen.getByLabelText('Gateway')).toHaveValue('192.168.10.1');
  });

  it('a card left without a lease goes back to empty fields', () => {
    setAutomatic('PC-1');
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('');
  });

  it('is not asked for an address when the device is saved, and neither is a device with no address on its cards', () => {
    setAutomatic('PC-1');
    openInspector('PC-1');
    type('Nome Dispositivo', 'PC-Nuovo');
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('PC-Nuovo').nics?.[0].dhcp).toBe(true);

    // the symbol of the outside world: cards, and no address at all
    store().addDevice({
      type: 'Cloud',
      templateId: 'tpl-cloud',
      label: 'Internet',
      ip: '',
      subnet: '255.255.255.0',
      gateway: '',
      position: { x: 0, y: 0 },
      nics: [{ id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip: '', subnet: '255.255.255.0', gateway: '' }],
    });
    openInspector('Internet');
    type('Nome Dispositivo', 'Fuori');
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Fuori').type).toBe('Cloud');
  });

  it('a name is still asked of everybody, and an address of a device that types it in the first tab', () => {
    openInspector('PC-1');
    type('Nome Dispositivo', ' ');
    saveDevice();
    expect(toast.error).toHaveBeenCalledWith('Il nome è obbligatorio');

    vi.mocked(toast.error).mockClear();
    openInspector('SW-Office');
    type('Indirizzo IP', '');
    saveDevice();
    expect(toast.error).toHaveBeenCalledWith('Nome e IP sono obbligatori');
  });
});

describe('InspectorModal — the DHCP server of a server', () => {
  it('is on the card of a server, not on the card of a PC', () => {
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.queryByLabelText(/^Server DHCP Abilitato/)).not.toBeInTheDocument();
    expect(tabNames()).toEqual(['Generale', 'Schede di rete (1)']);

    openInspector('Web-01');
    expect(tabNames()).toEqual(['Generale', 'Schede di rete (1)', 'DHCP', 'DNS']);
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).not.toBeChecked();
  });

  it('serves the network of the card with the gateway typed, and says so in the «DHCP» tab', () => {
    setAutomatic('Mail-01');
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', '192.168.20.50');
    type('Ultimo indirizzo', '192.168.20.59');
    type('Gateway consegnato (opzionale)', '192.168.20.1');

    openTab('DHCP (1)');
    expect(poolRows()).toEqual([
      {
        name: 'eth0 (192.168.20.10)',
        on: true,
        range: ['192.168.20.50', '192.168.20.59', '192.168.20.1', ''],
        says: 'Gateway consegnato 192.168.20.1 · 1 assegnato, 9 liberi su 10',
      },
    ]);
    const rows = within(section('Indirizzi assegnati')).getAllByRole('row').slice(1);
    expect(rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
      ['192.168.20.50', 'Mail-01', 'eth0', 'eth0'],
    ]);

    saveDevice();
    expect(device('Web-01').nics?.[0].dhcpServer).toEqual({
      start: '192.168.20.50',
      end: '192.168.20.59',
      gateway: '192.168.20.1',
    });
    const { devices, connections } = store();
    expect(resolveDhcp({ devices, connections }).leases).toEqual([
      {
        deviceId: device('Mail-01').id,
        nicId: 'nic-1',
        ip: '192.168.20.50',
        mask: '255.255.255.0',
        gateway: '192.168.20.1',
        server: { deviceId: device('Web-01').id, interfaceKey: 'nic:nic-1' },
      },
    ]);
  });

  it('without a gateway says that none is handed out', () => {
    const web = device('Web-01');
    store().updateDevice(web.id, {
      nics: web.nics?.map(nic => ({ ...nic, dhcpServer: { start: '192.168.20.50', end: '192.168.20.59' } })),
    });
    openInspector('Web-01');
    openTab('DHCP (1)');
    expect(section('Intervalli di indirizzi')).toHaveTextContent('Nessun gateway consegnato · 0 assegnati, 10 liberi su 10');
    expect(section('Indirizzi assegnati')).toHaveTextContent('Nessun indirizzo assegnato');
  });

  it('a card that takes its own address from DHCP cannot hand out any: the server goes with the choice', () => {
    const web = device('Web-01');
    store().updateDevice(web.id, {
      nics: web.nics?.map(nic => ({ ...nic, dhcpServer: { start: '192.168.20.50', end: '192.168.20.59' } })),
    });
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).toBeChecked();
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });
    expect(screen.queryByLabelText(/^Server DHCP Abilitato/)).not.toBeInTheDocument();
    saveDevice();
    const card = device('Web-01').nics?.[0];
    expect(card?.dhcp).toBe(true);
    expect(card?.dhcpServer).toBeUndefined();
  });

  it('refuses a range outside the network of the card', () => {
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', '192.168.10.50');
    type('Ultimo indirizzo', '192.168.10.59');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '192.168.10.50 è fuori dalla rete della scheda (192.168.20.0/24)'
    );
    // an empty range too, and a card with no address
    type('Primo indirizzo', '');
    type('Ultimo indirizzo', '');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/un intervallo lasciato vuoto non viene salvato/)).toBeInTheDocument();
    type('Primo indirizzo', '192.168.20.50');
    type('Ultimo indirizzo', '192.168.20.59');
    type('Indirizzo IP', '');
    expect(screen.getByRole('alert')).toHaveTextContent('la scheda non ha un indirizzo');
  });
});

describe('InspectorModal — the «DHCP» tab', () => {
  it('with no pool says how one is switched on', () => {
    openInspector('Router-1');
    openTab('DHCP');
    expect(section('Intervalli di indirizzi')).toHaveTextContent(
      "Nessuna porta assegna indirizzi. Spunta la porta della rete a cui darli: l'intervallo viene proposto, e si può cambiare."
    );
    expect(screen.queryByRole('region', { name: 'Avvisi' })).not.toBeInTheDocument();

    openInspector('Web-01');
    openTab('DHCP');
    expect(section('Intervalli di indirizzi')).toHaveTextContent(
      'Nessuna scheda assegna indirizzi. Spunta la scheda della rete a cui darli'
    );
  });

  it('lists every pool of the device with what it gave, and to whom', () => {
    setPool(1, OFFICE);
    setPool(2, { start: '192.168.20.100', end: '192.168.20.101' });
    setAutomatic('PC-1');
    setAutomatic('PC-2');
    setAutomatic('Mail-01');
    openInspector('Router-1');
    expect(screen.getByRole('button', { name: 'DHCP (2)' })).toBeInTheDocument();
    openTab('DHCP (2)');

    expect(poolRows()).toEqual([
      {
        name: 'Porta 1 «LAN Uffici» (192.168.10.1)',
        on: true,
        range: ['192.168.10.100', '192.168.10.199', '', ''],
        says: 'Gateway consegnato 192.168.10.1 · 2 assegnati, 98 liberi su 100',
      },
      {
        name: 'Porta 2 «LAN Server» (192.168.20.1)',
        on: true,
        range: ['192.168.20.100', '192.168.20.101', '', ''],
        says: 'Gateway consegnato 192.168.20.1 · 1 assegnato, 1 libero su 2',
      },
    ]);
    const rows = within(section('Indirizzi assegnati')).getAllByRole('row').slice(1);
    expect(rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
      ['192.168.10.100', 'PC-1', 'eth0', 'porta 1'],
      ['192.168.10.101', 'PC-2', 'eth0', 'porta 1'],
      ['192.168.20.100', 'Mail-01', 'eth0', 'porta 2'],
    ]);
    expect(screen.queryByRole('region', { name: 'Avvisi' })).not.toBeInTheDocument();
  });

  it('follows the form before it is saved: a range typed a moment ago gives its addresses at once', () => {
    setAutomatic('PC-1');
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    type('Primo indirizzo', '192.168.10.100');
    type('Ultimo indirizzo', '192.168.10.199');
    openTab('DHCP (1)');
    expect(section('Indirizzi assegnati')).toHaveTextContent('192.168.10.100');
    expect(section('Indirizzi assegnati')).toHaveTextContent('PC-1');
  });

  it('names who is left without an address when a range is used up', () => {
    setPool(1, { start: '192.168.10.100', end: '192.168.10.100' });
    setAutomatic('PC-1');
    setAutomatic('PC-2');
    openInspector('Router-1');
    openTab('DHCP (1)');
    expect(section('Avvisi')).toHaveTextContent(
      'PC-2 (eth0) resta senza indirizzo: l\'intervallo di Router-1, porta 1 è esaurito: il suo unico indirizzo è già preso.'
    );
  });

  it('says so when a pool cannot work, and when its port is down', () => {
    setPool(1, { start: '10.0.0.10', end: '10.0.0.20' });
    setPool(2, { start: '192.168.20.100', end: '192.168.20.101' });
    const router = device('Router-1');
    store().updateDevice(router.id, {
      ports: device('Router-1').ports?.map(p => (p.id === 2 ? { ...p, enabled: false } : p)),
    });
    setAutomatic('PC-1');
    openInspector('Router-1');
    openTab('DHCP (2)');
    const [one, two] = within(section('Intervalli di indirizzi')).getAllByRole('listitem');
    expect(one).toHaveTextContent('Non utilizzabile: 10.0.0.10 è fuori dalla rete della porta (192.168.10.0/24).');
    expect(two).toHaveTextContent('porta disabilitata: non risponde');
    expect(section('Avvisi')).toHaveTextContent(
      'PC-1 (eth0) resta senza indirizzo: l\'intervallo di Router-1, porta 1 non è utilizzabile: ' +
        '10.0.0.10 è fuori dalla rete della porta (192.168.10.0/24).'
    );
  });

  it('warns of a second server on the same network, in both windows', () => {
    setPool(2, { start: '192.168.20.100', end: '192.168.20.110' });
    const web = device('Web-01');
    store().updateDevice(web.id, {
      nics: web.nics?.map(nic => ({ ...nic, dhcpServer: { start: '192.168.20.50', end: '192.168.20.59' } })),
    });
    setAutomatic('Mail-01');
    const warning =
      'Due server DHCP sulla stessa rete: Router-1, porta 2; Web-01, eth0. Risponde il primo che ha un indirizzo libero.';
    openInspector('Router-1');
    openTab('DHCP (1)');
    expect(section('Avvisi')).toHaveTextContent(warning);
    // the router comes first in the drawing: it is the one that answered
    expect(section('Indirizzi assegnati')).toHaveTextContent('192.168.20.100');
    openInspector('Web-01');
    openTab('DHCP (1)');
    expect(section('Avvisi')).toHaveTextContent(warning);
    expect(section('Indirizzi assegnati')).toHaveTextContent('Nessun indirizzo assegnato');
    // a server that is not one of the two has nothing to be warned of
    openInspector('Mail-01');
    openTab('DHCP');
    expect(screen.queryByRole('region', { name: 'Avvisi' })).not.toBeInTheDocument();
  });

  it('says what is not simulated', () => {
    openInspector('Router-1');
    openTab('DHCP');
    expect(
      screen.getByText(/Un guasto simulato in presentazione non toglie l'indirizzo a chi lo aveva\. Non sono simulati il relay/)
    ).toBeInTheDocument();
  });
});

describe('InspectorModal — pools set from the «DHCP» tab', () => {
  const tick = (of: string) => screen.getByLabelText(`Server DHCP sulla ${of}`);

  it('lists the ports that have an address, each with its tick', () => {
    openInspector('Router-1');
    openTab('DHCP');
    expect(poolRows()).toEqual([
      { name: 'Porta 1 «LAN Uffici» (192.168.10.1)', on: false, range: [], says: '' },
      { name: 'Porta 2 «LAN Server» (192.168.20.1)', on: false, range: [], says: '' },
    ]);
    expect(section('Intervalli di indirizzi')).toHaveTextContent('Sono elencate le porte che hanno un indirizzo.');
  });

  it('a tick switches the server of the port on with a range to start from, which hands out at once', () => {
    setAutomatic('PC-1');
    openInspector('Router-1');
    openTab('DHCP');
    fireEvent.click(tick('porta 1'));

    expect(screen.getByRole('button', { name: 'DHCP (1)' })).toBeInTheDocument();
    expect(poolRows()[0]).toEqual({
      name: 'Porta 1 «LAN Uffici» (192.168.10.1)',
      on: true,
      range: ['192.168.10.100', '192.168.10.199', '', ''],
      says: 'Gateway consegnato 192.168.10.1 · 1 assegnato, 99 liberi su 100',
    });
    // left empty, the gateway handed out is the port: the field shows it
    expect(screen.getByLabelText('Gateway consegnato, porta 1')).toHaveAttribute('placeholder', '192.168.10.1');
    expect(section('Intervalli di indirizzi')).not.toHaveTextContent('Nessuna porta assegna indirizzi');
    const rows = within(section('Indirizzi assegnati')).getAllByRole('row').slice(1);
    expect(rows.map(row => within(row).getAllByRole('cell').map(cell => cell.textContent))).toEqual([
      ['192.168.10.100', 'PC-1', 'eth0', 'porta 1'],
    ]);
    // nothing reaches the drawing before the device is saved
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();

    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual(OFFICE);
    expect(device('Router-1').ports?.[1].dhcpServer).toBeUndefined();
  });

  it('the range is changed in its fields, and what is typed is kept trimmed', () => {
    openInspector('Router-1');
    openTab('DHCP');
    fireEvent.click(tick('porta 1'));
    type('Primo indirizzo, porta 1', ' 192.168.10.50 ');
    type('Ultimo indirizzo, porta 1', '192.168.10.59');
    type('Gateway consegnato, porta 1', '192.168.10.254');
    type('Server DNS consegnato, porta 1', ' 192.168.20.10 ');
    // read as it will be kept, while it is still being typed
    expect(poolRows()[0].says).toBe(
      'Gateway consegnato 192.168.10.254 · server DNS consegnato 192.168.20.10 · 0 assegnati, 10 liberi su 10'
    );

    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({
      start: '192.168.10.50',
      end: '192.168.10.59',
      gateway: '192.168.10.254',
      dns: '192.168.20.10',
    });
  });

  it('the tick of the tab and «Server DHCP Abilitato» of the port are one setting', () => {
    openInspector('Router-1');
    openTab('DHCP');
    fireEvent.click(tick('porta 1'));
    openTab(/^Porte/);
    selectPort(1);
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).toBeChecked();
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue('192.168.10.100');
    expect(screen.getByLabelText('Ultimo indirizzo')).toHaveValue('192.168.10.199');

    // and back: off on the port, off in the tab
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    openTab('DHCP');
    expect(tick('porta 1')).not.toBeChecked();
    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();
  });

  it('a range switched off comes back with the tick, for as long as the tab is open', () => {
    setPool(1, { start: '192.168.10.50', end: '192.168.10.59' });
    openInspector('Router-1');
    openTab('DHCP (1)');
    fireEvent.click(tick('porta 1'));
    expect(poolRows()[0]).toMatchObject({ on: false, range: [] });
    fireEvent.click(tick('porta 1'));
    expect(poolRows()[0]).toMatchObject({ on: true, range: ['192.168.10.50', '192.168.10.59', '', ''] });
  });

  it('a range that cannot work says so under its fields, and the device is not saved', () => {
    openInspector('Router-1');
    openTab('DHCP');
    fireEvent.click(tick('porta 1'));
    type('Primo indirizzo, porta 1', '10.0.0.5');
    expect(within(section('Intervalli di indirizzi')).getByRole('alert')).toHaveTextContent(
      'Non utilizzabile: 10.0.0.5 è fuori dalla rete della porta (192.168.10.0/24).'
    );

    saveDevice();
    expect(toast.error).toHaveBeenCalledWith(
      'Porta 1, server DHCP: 10.0.0.5 è fuori dalla rete della porta (192.168.10.0/24)'
    );
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();
    expect(useUIStore.getState().modals.inspector).toBe(true);
  });

  it('a range left empty is not kept, and is not an error', () => {
    openInspector('Router-1');
    openTab('DHCP');
    fireEvent.click(tick('porta 1'));
    type('Primo indirizzo, porta 1', '');
    type('Ultimo indirizzo, porta 1', ' ');
    expect(poolRows()[0].says).toBe(
      "Scrivi il primo e l'ultimo indirizzo da assegnare: un intervallo lasciato vuoto non viene salvato."
    );
    // it does not count as a pool
    expect(screen.getByRole('button', { name: 'DHCP' })).toBeInTheDocument();

    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Router-1').ports?.[0].dhcpServer).toBeUndefined();
    expect(useUIStore.getState().modals.inspector).toBe(false);
  });

  it('sends to «Porte» for a port that has no address yet', () => {
    openInspector('Router-1');
    openTab('DHCP');
    fireEvent.click(within(section('Intervalli di indirizzi')).getByRole('button', { name: 'scheda «Porte»' }));
    expect(openedTab()).toHaveTextContent(/^Porte/);
  });

  it('a pool on a port without an address: «Dagliene uno» opens that port in «Porte»', () => {
    setPool(3, OFFICE);
    openInspector('Router-1');
    openTab('DHCP (1)');
    const row = poolRows()[2];
    expect(row.name).toMatch(/^Porta 3/);
    expect(row.on).toBe(true);
    expect(row.says).toContain('Non utilizzabile: la porta non ha un indirizzo');

    fireEvent.click(screen.getByRole('button', { name: 'Dagliene uno' }));
    expect(openedTab()).toHaveTextContent(/^Porte/);
    expect(screen.getByRole('heading', { name: /^Porta 3/ })).toBeInTheDocument();
  });

  it('with no addressed port there is no tick to put: it says why and sends to «Porte»', () => {
    const router = device('Router-1');
    store().updateDevice(router.id, {
      ports: router.ports?.map(p => ({ ...p, ip: undefined, subnet: undefined })),
    });
    openInspector('Router-1');
    openTab('DHCP');
    const pools = section('Intervalli di indirizzi');
    expect(pools).toHaveTextContent(
      'Nessuna porta ha un indirizzo: un intervallo distribuisce gli indirizzi della rete della sua porta, quindi si attiva su una porta che ne ha uno.'
    );
    expect(within(pools).queryByRole('checkbox')).toBeNull();
    fireEvent.click(within(pools).getByRole('button', { name: 'Vai alla scheda «Porte»' }));
    expect(openedTab()).toHaveTextContent(/^Porte/);
  });

  it('on a server the cards are listed: a tick proposes the range of the network of the card', () => {
    openInspector('Web-01');
    openTab('DHCP');
    expect(poolRows()).toEqual([{ name: 'eth0 (192.168.20.10)', on: false, range: [], says: '' }]);

    fireEvent.click(tick('scheda eth0'));
    expect(poolRows()[0]).toMatchObject({ on: true, range: ['192.168.20.100', '192.168.20.199', '', ''] });
    expect(poolRows()[0].says).toBe('Nessun gateway consegnato · 0 assegnati, 100 liberi su 100');
    // a server is not the gateway of its network: none is handed out unless one is typed
    expect(screen.getByLabelText('Gateway consegnato, scheda eth0')).toHaveAttribute('placeholder', 'nessuno');

    saveDevice();
    expect(device('Web-01').nics?.[0].dhcpServer).toEqual({ start: '192.168.20.100', end: '192.168.20.199' });
  });

  it('a card that takes its own address from DHCP cannot be ticked, and says why', () => {
    setAutomatic('Web-01');
    openInspector('Web-01');
    openTab('DHCP');
    expect(tick('scheda eth0')).toBeDisabled();
    expect(poolRows()).toEqual([
      {
        name: 'eth0',
        on: false,
        range: [],
        says: 'Prende il proprio indirizzo dal DHCP: non può anche assegnarne.',
      },
    ]);
  });
});
