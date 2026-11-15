/**
 * InspectorModal tests — the "Rotte", "Regole" and "NAT" tabs: which devices
 * have them, editing, what is refused, and what reaches the store (and with
 * it the engine). Runs against the real stores with the sample network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { createSampleTopology } from '@/utils/sampleTopology';
import { matchForward, traceRoute } from '@/engine';
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
  it('a router has Generale, Porte, Rotte, NAT and DHCP', () => {
    openInspector('Router-1');
    expect(tabNames()).toEqual(['Generale', 'Porte (4)', 'Rotte', 'NAT', 'DHCP']);
  });

  it('a firewall also has Regole', () => {
    addFirewall();
    openInspector('FW-1');
    expect(tabNames()).toEqual(['Generale', 'Porte (4)', 'Rotte', 'Regole', 'NAT', 'DHCP']);
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
    type('Partenza della regola 1', 'untrust');
    type('Destinazione della regola 1', '192.168.20.10');
    add();
    type('Azione della regola 2', 'deny');
    type('Partenza della regola 2', '203.0.113.0/24');

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
    type('Partenza della regola 1', 'internet');
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
    type('Partenza della regola 1', ' Untrust ');
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
    type('Partenza della regola 1', 'untrust');
    type('Destinazione della regola 1', '192.168.20.10');
    save();

    expect(web().verdict).toBe('success');
  });
});

describe('InspectorModal — NAT', () => {
  const SERVICE = "Servizio dell'inoltro 1";
  const PORT = "Porta dell'inoltro 1";
  const TO = "Indirizzo interno dell'inoltro 1";
  const add = () => fireEvent.click(screen.getByRole('button', { name: 'Aggiungi inoltro' }));
  const forwards = () => device('Router-1').portForwards;

  const natOf = (portId: number) => device('Router-1').ports?.find(p => p.id === portId)?.nat;
  const openedTab = () => document.querySelector('.tab-header.active');

  /** Switch NAT on on a port of Router-1, as the store keeps it */
  function natOn(portId: number, patch: Partial<NonNullable<NetworkDevice['ports']>[number]> = {}) {
    const router = device('Router-1');
    useNetworkStore.getState().updateDevice(router.id, {
      ports: router.ports?.map(p => (p.id === portId ? { ...p, nat: true, ...patch } : p)),
    });
  }

  it('starts with no port doing NAT and nothing published, and says what that means', () => {
    openInspector('Router-1');
    openTab('NAT');

    const natPorts = screen.getByRole('region', { name: 'Porte con NAT' });
    expect(natPorts).toHaveTextContent('Nessuna porta fa NAT. Spunta la porta da cui si esce verso Internet.');
    // the ports that have an address, each with its tick
    expect(within(natPorts).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Porta 1 «LAN Uffici» (192.168.10.1)',
      'Porta 2 «LAN Server» (192.168.20.1)',
    ]);
    for (const tick of within(natPorts).getAllByRole('checkbox')) expect(tick).not.toBeChecked();
    const published = screen.getByRole('region', { name: 'Servizi pubblicati' });
    expect(published).toHaveTextContent('Nessun inoltro: da fuori si raggiunge soltanto il dispositivo stesso.');
    expect(within(published).queryByRole('table')).toBeNull();
  });

  it('lists the ports that do NAT with the address they give', () => {
    natOn(2);
    openInspector('Router-1');
    openTab('NAT');

    const natPorts = screen.getByRole('region', { name: 'Porte con NAT' });
    expect(within(natPorts).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'Porta 1 «LAN Uffici» (192.168.10.1)',
      "Porta 2 «LAN Server»: ciò che esce prende l'indirizzo 192.168.20.1",
    ]);
    expect(screen.getByLabelText('NAT sulla porta 1')).not.toBeChecked();
    expect(screen.getByLabelText('NAT sulla porta 2')).toBeChecked();
  });

  it('warns about a port with NAT and no address: it translates nothing', () => {
    natOn(3);
    openInspector('Router-1');
    openTab('NAT');

    const warning = within(screen.getByRole('region', { name: 'Porte con NAT' })).getByRole('alert');
    expect(warning).toHaveTextContent('non ha un indirizzo, quindi non traduce nulla');
  });

  it('is switched on from the tab, on a port that has an address, and saved with the device', () => {
    openInspector('Router-1');
    openTab('NAT');
    fireEvent.click(screen.getByLabelText('NAT sulla porta 2'));

    const natPorts = screen.getByRole('region', { name: 'Porte con NAT' });
    expect(natPorts).not.toHaveTextContent('Nessuna porta fa NAT');
    expect(natPorts).toHaveTextContent("Porta 2 «LAN Server»: ciò che esce prende l'indirizzo 192.168.20.1");
    // nothing reaches the drawing before the device is saved
    expect(natOf(2)).toBeFalsy();
    save();
    expect(toast.error).not.toHaveBeenCalled();
    expect(natOf(2)).toBe(true);
    expect(natOf(1)).toBeFalsy();
  });

  it('is switched off from the tab', () => {
    natOn(2);
    openInspector('Router-1');
    openTab('NAT');
    expect(screen.getByLabelText('NAT sulla porta 2')).toBeChecked();
    fireEvent.click(screen.getByLabelText('NAT sulla porta 2'));
    save();
    expect(natOf(2)).toBe(false);
  });

  it('the tick of the tab and «NAT attivo» of the port are one setting', () => {
    openInspector('Router-1');
    openTab('NAT');
    fireEvent.click(screen.getByLabelText('NAT sulla porta 2'));
    openTab(/^Porte/);
    fireEvent.click(screen.getByText('2', { selector: '.port-number' }));
    expect(screen.getByLabelText(/^NAT attivo/)).toBeChecked();
    // and back: off on the port, off in the tab
    fireEvent.click(screen.getByLabelText(/^NAT attivo/));
    openTab('NAT');
    expect(screen.getByLabelText('NAT sulla porta 2')).not.toBeChecked();
  });

  it('a port with NAT and no address: «Dagliene uno» opens that port in «Porte»', () => {
    natOn(3);
    openInspector('Router-1');
    openTab('NAT');
    fireEvent.click(screen.getByRole('button', { name: 'Dagliene uno' }));

    expect(openedTab()).toHaveTextContent(/^Porte/);
    expect(screen.getByRole('heading', { name: /^Porta 3/ })).toBeInTheDocument();
    type('Indirizzo IP', '203.0.113.2');
    openTab('NAT');
    const natPorts = screen.getByRole('region', { name: 'Porte con NAT' });
    expect(within(natPorts).queryByRole('alert')).toBeNull();
    expect(natPorts).toHaveTextContent(/Porta 3.*: ciò che esce prende l'indirizzo 203\.0\.113\.2/);
  });

  it('lists the ports that have an address, and sends to «Porte» for the others', () => {
    openInspector('Router-1');
    openTab('NAT');
    const natPorts = screen.getByRole('region', { name: 'Porte con NAT' });
    expect(natPorts).toHaveTextContent('Sono elencate solo le porte che hanno un indirizzo.');
    fireEvent.click(within(natPorts).getByRole('button', { name: 'scheda «Porte»' }));

    expect(openedTab()).toHaveTextContent(/^Porte/);
    // no port is picked: which one gets an address is not the tab's to say
    expect(
      screen.getByText('Scegli una porta per vederne e cambiarne le impostazioni.')
    ).toBeInTheDocument();
  });

  it('with no addressed port there is no tick to put: it says why and sends to «Porte»', () => {
    const router = device('Router-1');
    useNetworkStore.getState().updateDevice(router.id, {
      ports: router.ports?.map(p => ({ ...p, ip: undefined, subnet: undefined })),
    });
    openInspector('Router-1');
    openTab('NAT');

    const natPorts = screen.getByRole('region', { name: 'Porte con NAT' });
    expect(natPorts).toHaveTextContent(
      "Nessuna porta ha un indirizzo: il NAT dà a ciò che esce l'indirizzo della porta, quindi si attiva su una porta che ne ha uno."
    );
    expect(within(natPorts).queryByRole('checkbox')).toBeNull();
    fireEvent.click(within(natPorts).getByRole('button', { name: 'Vai alla scheda «Porte»' }));
    expect(openedTab()).toHaveTextContent(/^Porte/);
  });

  it('adds a forward, on the port that does NAT, and saves it', () => {
    natOn(2);
    openInspector('Router-1');
    openTab('NAT');

    add();
    expect(screen.getByLabelText(SERVICE)).toHaveValue('web');
    expect(screen.getByLabelText(PORT)).toHaveValue('2');
    type(TO, ' 192.168.10.50 ');
    // the tab counts what would be saved
    expect(tabNames()).toContain('NAT (1)');
    save();

    expect(toast.error).not.toHaveBeenCalled();
    expect(forwards()).toEqual([{ id: 'forward-1', service: 'web', port: 2, to: '192.168.10.50' }]);
  });

  it('offers only the ports that have an address to publish', () => {
    openInspector('Router-1');
    openTab('NAT');
    add();

    const options = within(screen.getByLabelText(PORT)).getAllByRole('option').map(o => o.textContent);
    expect(options).toHaveLength(2);
    expect(options[0]).toContain('Porta 1');
    expect(options[0]).toContain('(192.168.10.1)');
    expect(options[1]).toContain('(192.168.20.1)');
  });

  it('with no addressed port there is nothing to publish from: the button says why', () => {
    const router = device('Router-1');
    useNetworkStore.getState().updateDevice(router.id, {
      ports: router.ports?.map(p => ({ ...p, ip: undefined, subnet: undefined })),
    });
    openInspector('Router-1');
    openTab('NAT');

    expect(screen.getByRole('button', { name: 'Aggiungi inoltro' })).toBeDisabled();
    expect(screen.getByText(/Nessuna porta ha un indirizzo da pubblicare/)).toBeInTheDocument();
  });

  it('refuses an address that is not one: says which forward, saves nothing', () => {
    openInspector('Router-1');
    openTab('NAT');
    add();
    type(TO, 'web-01');

    expect(screen.getByRole('alert')).toHaveTextContent('"web-01" non è un indirizzo IPv4 valido');
    save();

    expect(toast.error).toHaveBeenCalledWith('Inoltro 1: "web-01" non è un indirizzo IPv4 valido');
    expect(forwards()).toBeUndefined();
    expect(useUIStore.getState().modals.inspector).toBe(true);
  });

  it('refuses a forward to the address of the port itself', () => {
    openInspector('Router-1');
    openTab('NAT');
    add();
    type(TO, '192.168.10.1');
    save();

    expect(toast.error).toHaveBeenCalledWith("Inoltro 1: 192.168.10.1 è l'indirizzo della porta 1 stessa");
    expect(forwards()).toBeUndefined();
  });

  it('drops a row whose address was never typed', () => {
    openInspector('Router-1');
    openTab('NAT');
    add();
    add();
    type("Indirizzo interno dell'inoltro 2", '192.168.20.10');
    expect(tabNames()).toContain('NAT (1)');
    save();

    expect(toast.error).not.toHaveBeenCalled();
    expect(forwards()).toEqual([{ id: 'forward-2', service: 'web', port: 1, to: '192.168.20.10' }]);
  });

  it('orders the forwards, switches one off, changes service and port, and saves them so', () => {
    openInspector('Router-1');
    openTab('NAT');
    add();
    type(TO, '192.168.20.10');
    add();
    type("Indirizzo interno dell'inoltro 2", '192.168.20.20');
    type("Servizio dell'inoltro 2", 'email');
    type("Porta dell'inoltro 2", '2');

    fireEvent.click(screen.getByRole('button', { name: "Sposta in su l'inoltro 2" }));
    fireEvent.click(screen.getByLabelText('Inoltro 2 attivo'));
    save();

    expect(forwards()).toEqual([
      { id: 'forward-2', service: 'email', port: 2, to: '192.168.20.20' },
      { id: 'forward-1', service: 'web', port: 1, to: '192.168.20.10', enabled: false },
    ]);
  });

  it('removes a forward, and the last one leaves the device without forwards', () => {
    const router = device('Router-1');
    useNetworkStore.getState().updateDevice(router.id, {
      portForwards: [{ id: 'forward-1', service: 'web', port: 1, to: '192.168.20.10' }],
    });
    openInspector('Router-1');
    expect(tabNames()).toContain('NAT (1)');
    openTab(/^NAT/);

    fireEvent.click(screen.getByRole('button', { name: "Elimina l'inoltro 1" }));
    save();

    expect(forwards()).toBeUndefined();
  });

  it('shows a forward on a port that lost its address, and refuses to save it as it is', () => {
    const router = device('Router-1');
    useNetworkStore.getState().updateDevice(router.id, {
      portForwards: [{ id: 'forward-1', service: 'web', port: 3, to: '192.168.20.10' }],
    });
    openInspector('Router-1');
    openTab(/^NAT/);

    expect(screen.getByLabelText(PORT)).toHaveValue('3');
    expect(within(screen.getByLabelText(PORT)).getAllByRole('option')[0]).toHaveTextContent(
      'Porta 3 (senza indirizzo)'
    );
    save();
    expect(toast.error).toHaveBeenCalledWith(
      'Inoltro 1: la porta 3 non ha un indirizzo da pubblicare: dagliene uno nella scheda «Porte»'
    );
  });

  it('on a router does not ask for a rule: a router does not filter', () => {
    openInspector('Router-1');
    openTab('NAT');
    expect(screen.queryByText(/serve anche una regola che lo permetta/)).toBeNull();
  });

  it('on a firewall says that a forward needs a rule too', () => {
    addFirewall();
    openInspector('FW-1');
    openTab('NAT');
    expect(screen.getByText(/serve anche una regola che lo permetta/)).toBeInTheDocument();
  });

  it('what is saved reaches the engine: the forward takes what arrives for its port', () => {
    openInspector('Router-1');
    openTab('NAT');
    add();
    type(TO, '192.168.20.10');
    type(PORT, '1');
    save();

    const taken = matchForward(device('Router-1'), 'web', '192.168.10.1');
    expect(taken?.forward.to).toBe('192.168.20.10');
    expect(matchForward(device('Router-1'), 'ping', '192.168.10.1')).toBeUndefined();
  });
});
