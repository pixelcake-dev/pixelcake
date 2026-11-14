/**
 * InspectorModal tests — DNS: the names a server answers for («DNS» tab), the
 * server a card asks («Server DNS»), the one a pool hands out («Server DNS
 * consegnato»), the service in rules and forwards, what is refused, and what
 * reaches the store (and with it the engine). Runs against the real stores
 * with the small sample network:
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
import { lookup, resolveDhcp } from '@/engine';
import type { DhcpPool, DnsRecord, NetworkDevice } from '@/types';
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
const addRecord = () => fireEvent.click(screen.getByRole('button', { name: 'Aggiungi record' }));
const alerts = () => screen.queryAllByRole('alert').map(alert => alert.textContent);

const WEB = '192.168.20.10';
const RECORDS: DnsRecord[] = [
  { id: 'record-1', name: 'www.azienda.example', address: WEB },
  { id: 'record-2', name: 'posta.azienda.example', address: '192.168.20.20' },
];
const OFFICE: DhcpPool = { start: '192.168.10.100', end: '192.168.10.199' };

/** Put records on a server, as the store keeps them */
function setRecords(label: string, records: DnsRecord[] | undefined) {
  store().updateDevice(device(label).id, { dnsRecords: records });
}

/** Change the first card of a device, as the store keeps it */
function setCard(label: string, patch: Partial<NonNullable<NetworkDevice['nics']>[number]>) {
  const d = device(label);
  store().updateDevice(d.id, { nics: d.nics?.map((nic, i) => (i === 0 ? { ...nic, ...patch } : nic)) });
}

function setPool(portId: number, pool: DhcpPool | undefined) {
  const router = device('Router-1');
  store().updateDevice(router.id, {
    ports: router.ports?.map(p => (p.id === portId ? { ...p, dhcpServer: pool } : p)),
  });
}

const resolved = (from: string, name: string) => {
  const { devices, connections } = store();
  return lookup({ devices, connections }, device(from).id, name);
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(toast.error).mockClear();
  store().clearAllDevices();
  const sample = createSampleTopology();
  store().loadTopology(sample.devices, sample.connections);
  useUIStore.getState().closeModal('inspector');
});

describe('InspectorModal — the «DNS» tab of a server', () => {
  it('is on a server, of whatever kind, and on nothing else', () => {
    openInspector('Web-01');
    expect(tabNames()).toEqual(['Generale', 'Schede di rete (1)', 'DHCP', 'DNS']);
    openInspector('Mail-01');
    expect(tabNames()).toContain('DNS');
    for (const label of ['PC-1', 'Router-1', 'SW-Office']) {
      openInspector(label);
      expect(tabNames(), label).not.toContain('DNS');
    }
  });

  it('starts with no names, and says what that means and at which address the server is asked', () => {
    openInspector('Web-01');
    openTab('DNS');
    expect(section('Record DNS')).toHaveTextContent(
      'Nessun nome: finché non ne ha almeno uno, questo dispositivo non risponde come server DNS.'
    );
    expect(section('Chi chiede a questo server')).toHaveTextContent(`L'indirizzo di questo server è ${WEB}.`);
    expect(alerts()).toEqual([]);
  });

  it('a name is added with its address, counted on the tab, and saved with the device', () => {
    openInspector('Web-01');
    openTab('DNS');
    addRecord();
    type('Nome del record 1', ' WWW.Azienda.Example. ');
    type('Indirizzo del record 1', ` ${WEB} `);
    expect(alerts()).toEqual([]);
    expect(screen.getByRole('button', { name: 'DNS (1)' })).toBeInTheDocument();
    // nothing reaches the drawing before the device is saved
    expect(device('Web-01').dnsRecords).toBeUndefined();

    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    // kept the way names are compared: lower case, no dot at the end
    expect(device('Web-01').dnsRecords).toEqual([{ id: 'record-1', name: 'www.azienda.example', address: WEB }]);
  });

  it('the engine answers with what was saved, to a device whose card names the server', () => {
    openInspector('Web-01');
    openTab('DNS');
    addRecord();
    type('Nome del record 1', 'www.azienda.example');
    type('Indirizzo del record 1', '192.168.20.20');
    saveDevice();
    setCard('PC-1', { dns: WEB });
    expect(resolved('PC-1', 'www.azienda.example')).toMatchObject({ address: '192.168.20.20', serverIp: WEB });
    expect(resolved('PC-1', 'www.azienda.example').server?.label).toBe('Web-01');
  });

  it('shows the names saved when the window is opened again, in their order', () => {
    setRecords('Web-01', RECORDS);
    openInspector('Web-01');
    expect(screen.getByRole('button', { name: 'DNS (2)' })).toBeInTheDocument();
    openTab(/^DNS/);
    expect(screen.getByLabelText('Nome del record 1')).toHaveValue('www.azienda.example');
    expect(screen.getByLabelText('Indirizzo del record 1')).toHaveValue(WEB);
    expect(screen.getByLabelText('Nome del record 2')).toHaveValue('posta.azienda.example');
    expect(screen.getByLabelText('Indirizzo del record 2')).toHaveValue('192.168.20.20');
    expect(within(section('Record DNS')).getAllByRole('row')).toHaveLength(3);
  });

  it('a name is deleted by its own button; with the last one the list is gone from the device', () => {
    setRecords('Web-01', RECORDS);
    openInspector('Web-01');
    openTab(/^DNS/);
    fireEvent.click(screen.getByRole('button', { name: 'Elimina il record 1' }));
    expect(screen.getByLabelText('Nome del record 1')).toHaveValue('posta.azienda.example');
    expect(screen.queryByLabelText('Nome del record 2')).not.toBeInTheDocument();
    saveDevice();
    expect(device('Web-01').dnsRecords).toEqual([RECORDS[1]]);

    openInspector('Web-01');
    openTab(/^DNS/);
    fireEvent.click(screen.getByRole('button', { name: 'Elimina il record 1' }));
    saveDevice();
    expect(device('Web-01').dnsRecords).toBeUndefined();
  });

  it('a new name takes the lowest id not in use, and a row left empty is not kept', () => {
    setRecords('Web-01', [RECORDS[1]]);
    openInspector('Web-01');
    openTab(/^DNS/);
    addRecord();
    addRecord();
    type('Nome del record 3', 'nas.azienda.example');
    type('Indirizzo del record 3', '192.168.20.30');
    // (the empty row in the middle is not counted)
    expect(screen.getByRole('button', { name: 'DNS (2)' })).toBeInTheDocument();
    expect(alerts()).toEqual([]);
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Web-01').dnsRecords).toEqual([
      RECORDS[1],
      { id: 'record-3', name: 'nas.azienda.example', address: '192.168.20.30' },
    ]);
  });

  it.each([
    ['gestionale', WEB, '"gestionale" non è un nome valido: lettere, cifre e trattini, con almeno un punto, come www.azienda.example'],
    ['il mio server.example', WEB, '"il mio server.example" non è un nome valido: lettere, cifre e trattini, con almeno un punto, come www.azienda.example'],
    ['192.168.20.10', WEB, '"192.168.20.10" non è un nome valido: lettere, cifre e trattini, con almeno un punto, come www.azienda.example'],
    ['', WEB, 'manca il nome'],
    ['www.azienda.example', '', 'manca l\'indirizzo a cui corrisponde il nome'],
    ['www.azienda.example', 'web-01', '"web-01" non è un indirizzo IPv4 valido'],
    ['www.azienda.example', '192.168.20.300', '"192.168.20.300" non è un indirizzo IPv4 valido'],
  ])('says what is wrong with "%s" → "%s" as it is typed, and refuses to save it', (name, address, message) => {
    openInspector('Web-01');
    openTab('DNS');
    addRecord();
    type('Nome del record 1', name);
    type('Indirizzo del record 1', address);
    expect(alerts()).toEqual([message]);
    saveDevice();
    expect(toast.error).toHaveBeenCalledWith(`Record DNS 1: ${message}`);
    expect(device('Web-01').dnsRecords).toBeUndefined();
    // the window stays open, with what was typed
    expect(screen.getByLabelText('Nome del record 1')).toHaveValue(name);
  });

  it('a name is in the list once: the second row that carries it is the one refused', () => {
    setRecords('Web-01', RECORDS);
    openInspector('Web-01');
    openTab(/^DNS/);
    addRecord();
    type('Nome del record 3', 'WWW.azienda.example');
    type('Indirizzo del record 3', '192.168.20.99');
    expect(alerts()).toEqual(['il nome www.azienda.example è già nel record 1: un nome ha un solo indirizzo']);
    saveDevice();
    expect(toast.error).toHaveBeenCalledWith(
      'Record DNS 3: il nome www.azienda.example è già nel record 1: un nome ha un solo indirizzo'
    );
    expect(device('Web-01').dnsRecords).toEqual(RECORDS);

    // however the first of the two is written
    type('Nome del record 1', 'Www.Azienda.EXAMPLE.');
    expect(alerts()).toEqual(['il nome www.azienda.example è già nel record 1: un nome ha un solo indirizzo']);
    type('Nome del record 1', 'www.azienda.example');

    // with another name it is fine
    type('Nome del record 3', 'intranet.azienda.example');
    expect(alerts()).toEqual([]);
  });

  it('says so when the server has no address to be asked at', () => {
    setCard('Web-01', { dhcp: true });
    openInspector('Web-01');
    openTab('DNS');
    expect(alerts()).toEqual(['Questo server non ha un indirizzo: nessuno può chiedergli nulla.']);
  });

  it('says where a name can be used, and what is not simulated', () => {
    openInspector('Web-01');
    openTab('DNS');
    expect(document.body).toHaveTextContent('Un nome si usa nel terminale al posto di un indirizzo');
    expect(document.body).toHaveTextContent('ping www.azienda.example from PC-1');
    const notes = section('Chi chiede a questo server');
    expect(notes).toHaveTextContent('il campo «Server DNS»');
    expect(notes).toHaveTextContent('«Server DNS consegnato» nel server DHCP');
    expect(notes).toHaveTextContent(
      'Non sono simulati: un secondo server DNS di riserva, l\'inoltro della domanda ad altri server'
    );
    expect(notes).toHaveTextContent('la memoria delle risposte e le scadenze, la ricerca inversa, gli alias e i nomi jolly');
    expect(notes).toHaveTextContent('La simulazione e la presentazione scelgono i dispositivi dai menu e non usano i nomi.');
  });
});

describe('InspectorModal — the DNS server a card asks', () => {
  it('is a field under the gateway of a card whose address is written by hand, saved with the device', () => {
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.getByLabelText('Server DNS')).toHaveValue('');
    const labels = Array.from(document.querySelectorAll('.nic-editor label')).map(label => label.textContent);
    expect(labels.indexOf('Server DNS')).toBe(labels.indexOf('Gateway') + 1);

    type('Server DNS', ` ${WEB} `);
    expect(device('PC-1').nics?.[0].dns).toBeUndefined();
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('PC-1').nics?.[0]).toMatchObject({ ip: '192.168.10.11', dns: WEB });
  });

  it('shows the one saved when the card is opened again, and none when it is emptied', () => {
    setCard('PC-1', { dns: WEB });
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.getByLabelText('Server DNS')).toHaveValue(WEB);
    type('Server DNS', '  ');
    saveDevice();
    expect(device('PC-1').nics?.[0].dns).toBeUndefined();
    expect(device('PC-1').nics?.[0].ip).toBe('192.168.10.11');
  });

  it('has to be an address: a name is said so while it is typed, and the device is not saved with it', () => {
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    type('Server DNS', 'web-01');
    expect(alerts()).toEqual(['"web-01" non è un indirizzo IPv4 valido: il server DNS si indica con il suo indirizzo']);
    saveDevice();
    expect(toast.error).toHaveBeenCalledWith(
      'Scheda eth0: "web-01" non è un indirizzo IPv4 valido: il server DNS si indica con il suo indirizzo'
    );
    expect(device('PC-1').nics?.[0].dns).toBeUndefined();
    expect(screen.getByLabelText('Server DNS')).toHaveValue('web-01');
    // the error goes away with the next keystroke
    type('Server DNS', WEB);
    expect(alerts()).toEqual([]);
    saveDevice();
    expect(device('PC-1').nics?.[0].dns).toBe(WEB);
  });

  it('a card on DHCP has no field: the server it was handed is shown with the lease', () => {
    setPool(1, { ...OFFICE, dns: WEB });
    setCard('PC-1', { dhcp: true });
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.queryByLabelText('Server DNS')).not.toBeInTheDocument();
    expect(screen.getByTestId('nic-lease')).toHaveTextContent(
      'Subnet mask 255.255.255.0 · gateway 192.168.10.1 · server DNS 192.168.20.10'
    );
  });

  it('and "nessuno" when the pool hands out none', () => {
    setPool(1, OFFICE);
    setCard('PC-1', { dhcp: true });
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    expect(screen.getByTestId('nic-lease')).toHaveTextContent(
      'Subnet mask 255.255.255.0 · gateway 192.168.10.1 · server DNS nessuno'
    );
  });

  it('from DHCP to by hand the field starts from the server that came with the lease', () => {
    setPool(1, { ...OFFICE, dns: WEB });
    setCard('PC-1', { dhcp: true });
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.10.100');
    expect(screen.getByLabelText('Server DNS')).toHaveValue(WEB);
    saveDevice();
    expect(device('PC-1').nics?.[0]).toMatchObject({ ip: '192.168.10.100', dns: WEB });
    expect(device('PC-1').nics?.[0].dhcp).toBeUndefined();
  });

  it('and from a pool that hands out none it starts empty', () => {
    setPool(1, OFFICE);
    setCard('PC-1', { dhcp: true });
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Server DNS')).toHaveValue('');
  });

  it('a card put on DHCP keeps no DNS server of its own, whatever was typed', () => {
    setPool(1, OFFICE);
    setCard('PC-1', { dns: WEB });
    openInspector('PC-1');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    type('Server DNS', 'not even an address');
    fireEvent.change(screen.getByLabelText('Indirizzo'), { target: { value: 'dhcp' } });
    expect(alerts()).toEqual([]);
    saveDevice();
    expect(device('PC-1').nics?.[0]).toMatchObject({ dhcp: true, ip: '' });
    expect(device('PC-1').nics?.[0].dns).toBeUndefined();
    expect(resolved('PC-1', 'www.azienda.example').failureReason).toBe(
      'PC-1 has no DNS server: it cannot look up www.azienda.example'
    );
  });
});

describe('InspectorModal — the DNS server a pool hands out', () => {
  const openPool = () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    fireEvent.click(screen.getByLabelText(/^Server DHCP attivo/));
    type('Primo indirizzo', OFFICE.start);
    type('Ultimo indirizzo', OFFICE.end);
  };

  it('is typed with the range, may be on another network, and is saved with the pool', () => {
    openPool();
    type('Server DNS consegnato (facoltativo)', ` ${WEB} `);
    expect(alerts()).toEqual([]);
    openTab(/^DHCP/);
    expect(section('Intervalli di indirizzi')).toHaveTextContent(
      'Gateway consegnato 192.168.10.1 · server DNS consegnato 192.168.20.10 · 0 assegnati, 100 liberi su 100'
    );
    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual({ ...OFFICE, dns: WEB });

    // and a card on DHCP then asks it
    setRecords('Web-01', RECORDS);
    setCard('PC-1', { dhcp: true });
    const { devices, connections } = store();
    expect(resolveDhcp({ devices, connections }).leases[0]).toMatchObject({ ip: '192.168.10.100', dns: WEB });
    expect(resolved('PC-1', 'posta.azienda.example').address).toBe('192.168.20.20');
  });

  it('is kept only when one is typed, and shown again when the port is opened', () => {
    openPool();
    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual(OFFICE);

    setPool(1, { ...OFFICE, dns: WEB });
    openInspector('Router-1');
    openTab(/^DHCP/);
    openTab(/^Porte/);
    selectPort(1);
    expect(screen.getByLabelText('Server DNS consegnato (facoltativo)')).toHaveValue(WEB);
    type('Server DNS consegnato (facoltativo)', '');
    saveDevice();
    expect(device('Router-1').ports?.[0].dhcpServer).toEqual(OFFICE);
  });

  it('has to be an address', () => {
    openPool();
    type('Server DNS consegnato (facoltativo)', 'web-01.azienda.example');
    expect(alerts()).toEqual(['"web-01.azienda.example" non è un indirizzo IPv4 valido']);
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue(OFFICE.start);
  });

  it('typed alone, without a range, it is not a pool', () => {
    openInspector('Router-1');
    openTab(/^Porte/);
    selectPort(1);
    fireEvent.click(screen.getByLabelText(/^Server DHCP attivo/));
    type('Primo indirizzo', '');
    type('Ultimo indirizzo', '');
    type('Server DNS consegnato (facoltativo)', WEB);
    expect(alerts()).toEqual(['servono il primo e l\'ultimo indirizzo']);
  });

  it('is on the card of a server too', () => {
    openInspector('Web-01');
    openTab(/^Schede di rete/);
    selectCard('eth0');
    fireEvent.click(screen.getByLabelText(/^Server DHCP attivo/));
    type('Primo indirizzo', '192.168.20.100');
    type('Ultimo indirizzo', '192.168.20.110');
    type('Server DNS consegnato (facoltativo)', WEB);
    saveDevice();
    expect(device('Web-01').nics?.[0].dhcpServer).toEqual({
      start: '192.168.20.100',
      end: '192.168.20.110',
      dns: WEB,
    });
  });

  it('the «DHCP» tab says nothing of a DNS server for a pool that hands out none', () => {
    setPool(1, OFFICE);
    openInspector('Router-1');
    openTab(/^DHCP/);
    expect(section('Intervalli di indirizzi')).toHaveTextContent(
      'Gateway consegnato 192.168.10.1 · 0 assegnati, 100 liberi su 100'
    );
    expect(section('Intervalli di indirizzi')).not.toHaveTextContent('server DNS consegnato');
    expect(screen.getByLabelText('Server DNS consegnato, porta 1')).toHaveValue('');
  });
});

describe('InspectorModal — dns among the services of rules and forwards', () => {
  beforeEach(() => {
    store().addDevice({
      type: 'Firewall',
      templateId: 'tpl-firewall',
      label: 'FW',
      ip: '10.0.1.1',
      subnet: '255.255.255.0',
      gateway: '',
      position: { x: 0, y: 0 },
      portCount: 2,
      ports: [1, 2].map(id => ({ id, enabled: true, speed: 'auto' as const, ip: `10.0.${id}.1`, subnet: '255.255.255.0' })),
    });
  });

  const options = (label: string) =>
    Array.from(screen.getByLabelText<HTMLSelectElement>(label).options).map(option => `${option.value}=${option.textContent}`);

  it('a rule can be for DNS', () => {
    openInspector('FW');
    openTab(/^Regole/);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi regola' }));
    expect(options('Servizio della regola 1')).toEqual(['any=Qualsiasi', 'ping=Ping', 'web=Web', 'email=Email', 'dns=DNS']);
    fireEvent.change(screen.getByLabelText('Servizio della regola 1'), { target: { value: 'dns' } });
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('FW').firewallRules?.[0].service).toBe('dns');
  });

  it('a forward can be for DNS', () => {
    openInspector('FW');
    openTab(/^NAT/);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi inoltro' }));
    expect(options('Servizio dell\'inoltro 1')).toEqual(['web=Web', 'email=Email', 'dns=DNS', 'ping=Ping', 'any=Qualsiasi']);
    fireEvent.change(screen.getByLabelText('Servizio dell\'inoltro 1'), { target: { value: 'dns' } });
    type('Indirizzo interno dell\'inoltro 1', WEB);
    saveDevice();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('FW').portForwards?.[0]).toMatchObject({ service: 'dns', to: WEB });
  });
});
