/**
 * InspectorModal tests — the "Rotte" and "Regole" tabs: which devices have
 * them, editing, what is refused, and what reaches the store (and with it
 * the engine). Runs against the real stores with the sample network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { traceRoute } from '@/engine';
import type { NetworkDevice } from '@/types';
import InspectorModal from './InspectorModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function device(label: string): NetworkDevice {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
}

/** Open the inspector on a device, as a double click on the canvas does */
function openInspector(label: string) {
  useUIStore.getState().setInspectorDevice(device(label));
  useUIStore.getState().openModal('inspector');
  render(<InspectorModal />);
}

const tabNames = () =>
  Array.from(document.querySelectorAll('.tab-header')).map(tab => tab.textContent);
const openTab = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

/** The rows of the routing table shown in the "Rotte" tab, cell by cell */
function routingTableRows(): string[][] {
  const section = screen.getByRole('region', { name: 'Tabella di instradamento' });
  return within(section)
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('cell').map(cell => cell.textContent ?? ''));
}

function addFirewall(): void {
  useNetworkStore.getState().addDevice({
    type: 'Firewall',
    templateId: 'tpl-firewall',
    label: 'FW-1',
    ip: '10.0.0.2',
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: 0, y: 0 },
    portCount: 4,
    ports: [
      { id: 1, enabled: true, speed: 'auto', portType: 'lan', securityZone: 'trust' },
      { id: 2, enabled: true, speed: 'auto', portType: 'wan', securityZone: 'untrust' },
      { id: 3, enabled: true, speed: 'auto', portType: 'lan' },
      { id: 4, enabled: true, speed: 'auto', portType: 'lan' },
    ],
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(toast.error).mockClear();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createSampleTopology();
  store.loadTopology(sample.devices, sample.connections);
  useUIStore.getState().closeModal('inspector');
});

describe('InspectorModal — tabs', () => {
  it('a router has Generale, Porte and Rotte', () => {
    openInspector('Router-1');
    expect(tabNames()).toEqual(['Generale', 'Porte (4)', 'Rotte']);
  });

  it('a firewall also has Regole', () => {
    addFirewall();
    openInspector('FW-1');
    expect(tabNames()).toEqual(['Generale', 'Porte (4)', 'Rotte', 'Regole']);
  });

  it('a switch and an end device have neither', () => {
    openInspector('SW-Office');
    expect(tabNames()).toEqual(['Generale', 'Porte (8)']);
  });

  it('an end device has its network cards', () => {
    openInspector('PC-1');
    expect(tabNames()).toEqual(['Generale', 'Schede di rete (1)']);
  });

  it('has no tab that only announces a feature', () => {
    openInspector('Router-1');
    expect(screen.queryByText(/Terraform/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/future updates/i)).not.toBeInTheDocument();
  });
});

describe('InspectorModal — Rotte', () => {
  it('shows the routing table of the device: its two networks, nothing else', () => {
    openInspector('Router-1');
    openTab('Rotte');
    expect(screen.getByText('Nessuna rotta statica.')).toBeInTheDocument();
    expect(routingTableRows()).toEqual([
      ['192.168.10.0/24', '—', 'porta 1', 'collegata'],
      ['192.168.20.0/24', '—', 'porta 2', 'collegata'],
    ]);
  });

  it('adds a static route, shows it in the table at once, and saves it', () => {
    openInspector('Router-1');
    openTab('Rotte');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi rotta' }));
    type('Rete di destinazione della rotta 1', '192.168.30.0/24');
    type('Prossimo salto della rotta 1', '192.168.20.10');
    type('Nota della rotta 1', 'filiale');

    expect(routingTableRows()).toContainEqual(['192.168.30.0/24', '192.168.20.10', 'porta 2', 'statica']);
    expect(screen.getByRole('button', { name: 'Rotte (1)' })).toBeInTheDocument();

    save();
    expect(device('Router-1').routes).toEqual([
      { id: 'route-1', destination: '192.168.30.0/24', nextHop: '192.168.20.10', description: 'filiale' },
    ]);
  });

  it('shows the gateway of the Generale tab as the default route, before saving', () => {
    openInspector('Router-1');
    type('Gateway (rotta predefinita)', '192.168.20.254');
    openTab('Rotte');
    expect(routingTableRows()).toContainEqual(['default', '192.168.20.254', 'porta 2', 'predefinita (gateway)']);
  });

  it('flags in the table a next hop the device cannot reach', () => {
    openInspector('Router-1');
    openTab('Rotte');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi rotta' }));
    type('Rete di destinazione della rotta 1', '10.0.0.0/8');
    type('Prossimo salto della rotta 1', '172.16.0.1');
    expect(routingTableRows()).toContainEqual([
      '10.0.0.0/8',
      '172.16.0.1',
      '?',
      'statica: il prossimo salto non è su nessuna rete del dispositivo',
    ]);
  });

  it('refuses a route that is not a network and an address: says which, saves nothing', () => {
    openInspector('Router-1');
    openTab('Rotte');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi rotta' }));
    type('Rete di destinazione della rotta 1', 'server');
    type('Prossimo salto della rotta 1', '192.168.20.10');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '"server" non è una rete: scrivila come 192.168.30.0/24, oppure "default"'
    );

    save();
    expect(toast.error).toHaveBeenCalledWith(
      'Rotta 1: "server" non è una rete: scrivila come 192.168.30.0/24, oppure "default"'
    );
    expect(device('Router-1').routes).toBeUndefined();
    // the inspector stays open on what was typed
    expect(screen.getByLabelText('Rete di destinazione della rotta 1')).toHaveValue('server');

    type('Rete di destinazione della rotta 1', '192.168.30.0/24');
    type('Prossimo salto della rotta 1', 'router-2');
    save();
    expect(toast.error).toHaveBeenLastCalledWith('Rotta 1: "router-2" non è un indirizzo IPv4 valido');
    expect(device('Router-1').routes).toBeUndefined();
  });

  it('drops a row left empty and removes a route', () => {
    useNetworkStore.getState().updateDevice(device('Router-1').id, {
      routes: [
        { id: 'route-1', destination: '192.168.30.0/24', nextHop: '192.168.20.10' },
        { id: 'route-2', destination: '192.168.40.0/24', nextHop: '192.168.20.10' },
      ],
    });
    openInspector('Router-1');
    openTab('Rotte (2)');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi rotta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Elimina la rotta 1' }));
    save();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Router-1').routes).toEqual([
      { id: 'route-2', destination: '192.168.40.0/24', nextHop: '192.168.20.10' },
    ]);
  });

  it('shows a second route to the same network as the backup of the first', () => {
    useNetworkStore.getState().updateDevice(device('Router-1').id, {
      routes: [
        { id: 'route-1', destination: '192.168.30.0/24', nextHop: '192.168.20.10' },
        { id: 'route-2', destination: '192.168.30.0/24', nextHop: '192.168.10.11' },
      ],
    });
    openInspector('Router-1');
    openTab('Rotte (2)');

    expect(screen.getByText(/La seconda è di riserva/)).toBeInTheDocument();
    const toBranch = routingTableRows().filter(row => row[0] === '192.168.30.0/24');
    expect(toBranch).toEqual([
      ['192.168.30.0/24', '192.168.20.10', 'porta 2', 'statica'],
      ['192.168.30.0/24', '192.168.10.11', 'porta 1', 'statica, di riserva'],
    ]);

    // two routes to one network are not a mistake: they are saved as written
    save();
    expect(toast.error).not.toHaveBeenCalled();
    expect(device('Router-1').routes).toHaveLength(2);
  });

  it('says that the routes of a router without addressed ports are not used', () => {
    useNetworkStore.getState().updateDevice(device('Router-1').id, {
      ports: device('Router-1').ports?.map(({ id, enabled }) => ({ id, enabled })),
    });
    openInspector('Router-1');
    openTab('Rotte');
    expect(screen.getByRole('note')).toHaveTextContent(
      'Nessuna porta di questo dispositivo ha un indirizzo'
    );
  });
});

describe('InspectorModal — Regole', () => {
  beforeEach(() => {
    addFirewall();
  });

  it('starts empty and explains what decides without rules', () => {
    openInspector('FW-1');
    openTab('Regole');
    expect(screen.getByText(/Nessuna regola: decide soltanto la politica delle zone/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Quando nessuna regola corrisponde' })).toHaveTextContent(
      'untrust → trust, untrust → dmz, dmz → trust'
    );
  });

  it('adds rules, orders them, switches one off, and saves them in that order', () => {
    openInspector('FW-1');
    openTab('Regole');
    const add = () => fireEvent.click(screen.getByRole('button', { name: 'Aggiungi regola' }));

    add();
    type('Servizio della regola 1', 'web');
    type('Origine della regola 1', 'untrust');
    type('Destinazione della regola 1', '192.168.20.10');
    add();
    type('Azione della regola 2', 'deny');
    type('Origine della regola 2', '203.0.113.0/24');

    // the deny goes first, and is switched off for now
    fireEvent.click(screen.getByRole('button', { name: 'Sposta in su la regola 2' }));
    fireEvent.click(screen.getByLabelText('Regola 1 attiva'));
    expect(screen.getByRole('button', { name: 'Sposta in su la regola 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sposta in giù la regola 2' })).toBeDisabled();

    save();
    expect(device('FW-1').firewallRules).toEqual([
      { id: 'rule-2', action: 'deny', service: 'any', source: '203.0.113.0/24', destination: 'any', enabled: false },
      { id: 'rule-1', action: 'allow', service: 'web', source: 'untrust', destination: '192.168.20.10' },
    ]);
  });

  it('refuses a side that is not any, a zone, an address or a network', () => {
    openInspector('FW-1');
    openTab('Regole');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi regola' }));
    type('Origine della regola 1', 'internet');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '«Da»: "internet" non è any, una zona (trust, untrust, dmz), un indirizzo o una rete'
    );
    save();
    expect(toast.error).toHaveBeenCalledWith(
      'Regola 1: «Da»: "internet" non è any, una zona (trust, untrust, dmz), un indirizzo o una rete'
    );
    expect(device('FW-1').firewallRules).toBeUndefined();
  });

  it('writes zones in lower case however they were typed', () => {
    openInspector('FW-1');
    openTab('Regole');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi regola' }));
    type('Origine della regola 1', ' Untrust ');
    type('Destinazione della regola 1', 'TRUST');
    save();
    expect(device('FW-1').firewallRules).toMatchObject([{ source: 'untrust', destination: 'trust' }]);
  });

  it('warns about a rule naming a zone no port is in', () => {
    openInspector('FW-1');
    openTab('Regole');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi regola' }));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    type('Destinazione della regola 1', 'dmz');
    expect(screen.getByRole('note')).toHaveTextContent(
      'Nessuna porta è nella zona dmz: le regole che la nominano non corrispondono mai.'
    );
  });

  it('removes a rule, and the last one leaves the device without rules', () => {
    useNetworkStore.getState().updateDevice(device('FW-1').id, {
      firewallRules: [{ id: 'rule-1', action: 'deny', service: 'any', source: 'any', destination: 'any' }],
    });
    openInspector('FW-1');
    openTab('Regole (1)');
    fireEvent.click(screen.getByRole('button', { name: 'Elimina la regola 1' }));
    save();
    expect(device('FW-1').firewallRules).toBeUndefined();
  });
});

describe('InspectorModal — what is saved reaches the engine', () => {
  it('a rule written in the inspector decides a trace', () => {
    // FW-1 between the sample router and an outside PC, by hand in the store
    addFirewall();
    const store = useNetworkStore.getState();
    store.addDevice({
      type: 'PC',
      templateId: 'tpl-pc',
      label: 'Ext',
      ip: '203.0.113.50',
      subnet: '255.255.255.0',
      gateway: '203.0.113.1',
      position: { x: 0, y: 0 },
      nics: [
        { id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip: '203.0.113.50', subnet: '255.255.255.0', gateway: '203.0.113.1' },
      ],
    });
    const fw = device('FW-1');
    const router = device('Router-1');
    store.updateDevice(fw.id, {
      ports: fw.ports?.map(p =>
        p.id === 1
          ? { ...p, ip: '10.0.0.2', subnet: '255.255.255.252' }
          : p.id === 2
            ? { ...p, ip: '203.0.113.1', subnet: '255.255.255.0' }
            : p
      ),
      routes: [{ id: 'route-1', destination: '192.168.0.0/16', nextHop: '10.0.0.1' }],
    });
    store.updateDevice(router.id, {
      gateway: '10.0.0.2',
      ports: router.ports?.map(p => (p.id === 3 ? { ...p, ip: '10.0.0.1', subnet: '255.255.255.252' } : p)),
    });
    store.addConnection({ source: router.id, target: fw.id, sourcePort: 3, targetPort: 1 });
    store.addConnection({ source: device('Ext').id, target: fw.id, sourceNic: 'nic-1', targetPort: 2 });

    const web = () => {
      const { devices, connections } = useNetworkStore.getState();
      return traceRoute(device('Ext').id, device('Web-01').id, { devices, connections }, { service: 'web' });
    };
    expect(web().failureReason).toBe('firewall policy on FW-1: untrust → trust denied');

    openInspector('FW-1');
    openTab('Regole');
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi regola' }));
    type('Servizio della regola 1', 'web');
    type('Origine della regola 1', 'untrust');
    type('Destinazione della regola 1', '192.168.20.10');
    save();

    expect(web().verdict).toBe('success');
  });
});
