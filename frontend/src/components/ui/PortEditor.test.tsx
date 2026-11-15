/**
 * PortEditor tests — the settings of one port, typed straight into the form
 * of the window: the L3 address of router and firewall ports, the VLAN of a
 * switch port (the engine reads exactly these fields, see engine/vlan.ts),
 * the security zone, NAT, the DHCP server, and what the port is linked to.
 * Plus the link markers of PortGrid.
 */

import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Port } from '@/types';
import { portVlanMode } from '@/engine';
import { tidyPort } from '@/utils/interfaceProblems';
import PortEditor from './PortEditor';
import PortGrid from './PortGrid';

/** The editor over a port kept as the window keeps it: each change goes into the port */
function renderEditor(
  start: Port,
  deviceType: string,
  props: { connectedTo?: string; poolStatus?: string } = {}
) {
  const state = { port: start };
  function Harness() {
    const [port, setPort] = useState(start);
    return (
      <PortEditor
        port={port}
        deviceType={deviceType}
        onChange={(patch) => {
          state.port = { ...state.port, ...patch };
          setPort(state.port);
        }}
        {...props}
      />
    );
  }
  render(<Harness />);
  return {
    /** The port as it is in the form */
    port: () => state.port,
    /** The port as the device would keep it */
    kept: () => tidyPort(deviceType, state.port),
  };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const ACCESS = 'VLAN (singola)';
const TRUNK = 'VLAN (separate da virgola)';
const MODE = 'Modalità della porta';
const NAT = 'NAT attivo';
const SERVER = 'Server DHCP attivo';
const MASK = '255.255.255.0';

describe('PortEditor — port address', () => {
  it('offers IP and subnet mask on Router and Firewall ports, not on Switch ports', () => {
    for (const deviceType of ['Router', 'Firewall']) {
      renderEditor({ id: 1, enabled: true }, deviceType);
      expect(screen.getByLabelText('Indirizzo IP')).toBeInTheDocument();
      expect(screen.getByLabelText('Subnet mask')).toBeInTheDocument();
      cleanup();
    }
    renderEditor({ id: 1, enabled: true }, 'Switch');
    expect(screen.queryByLabelText('Indirizzo IP')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Subnet mask')).not.toBeInTheDocument();
  });

  it('shows the address the port already has', () => {
    renderEditor({ id: 2, enabled: true, ip: '192.168.20.1', subnet: MASK }, 'Router');
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.20.1');
    expect(screen.getByLabelText('Subnet mask')).toHaveValue(MASK);
  });

  it('a valid address goes to the port as it is typed, and is kept trimmed with its mask', () => {
    const { port, kept } = renderEditor({ id: 1, enabled: true, portType: 'lan' }, 'Router');
    type('Indirizzo IP', ' 192.168.10.1 ');
    type('Subnet mask', '255.255.0.0');
    expect(port()).toMatchObject({ ip: ' 192.168.10.1 ', subnet: '255.255.0.0' });
    expect(kept()).toMatchObject({ ip: '192.168.10.1', subnet: '255.255.0.0' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('defaults the mask to 255.255.255.0 when only the IP is given', () => {
    const { kept } = renderEditor({ id: 1, enabled: true }, 'Firewall');
    type('Indirizzo IP', '10.0.0.1');
    expect(kept()).toMatchObject({ ip: '10.0.0.1', subnet: MASK });
  });

  it('says what is wrong with an address under its field while it is typed', () => {
    renderEditor({ id: 1, enabled: true }, 'Router');
    type('Indirizzo IP', '192.168.10.999');
    expect(screen.getByRole('alert')).toHaveTextContent('"192.168.10.999" non è un indirizzo IPv4 valido');
    expect(screen.getByLabelText('Indirizzo IP')).toHaveAttribute('aria-invalid', 'true');
    // fixing the value clears it
    type('Indirizzo IP', '192.168.10.1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says so of an invalid mask, and of a mask without an IP', () => {
    renderEditor({ id: 1, enabled: true }, 'Router');
    type('Indirizzo IP', '192.168.10.1');
    type('Subnet mask', '255.255.255');
    expect(screen.getByRole('alert')).toHaveTextContent('"255.255.255" non è una subnet mask valida');

    type('Indirizzo IP', '');
    type('Subnet mask', MASK);
    expect(screen.getByRole('alert')).toHaveTextContent('Inserisci un indirizzo IP oppure svuota la subnet mask');
  });

  it('clearing the IP removes the address from the port', () => {
    const { kept } = renderEditor({ id: 2, enabled: true, ip: '192.168.20.1', subnet: MASK }, 'Router');
    type('Indirizzo IP', '');
    type('Subnet mask', '');
    expect(kept().ip).toBeUndefined();
    expect(kept().subnet).toBeUndefined();
  });

  it('does not write address fields for a Switch port', () => {
    const { kept } = renderEditor({ id: 1, enabled: true, portType: 'access' }, 'Switch');
    type('Nome della porta (facoltativo)', 'PC-1');
    expect(kept().name).toBe('PC-1');
    expect('ip' in kept()).toBe(false);
    expect('subnet' in kept()).toBe(false);
  });
});

describe('PortEditor — what every port has', () => {
  it('names the port in its title, with the name it is given', () => {
    renderEditor({ id: 3, enabled: true }, 'Router');
    expect(screen.getByRole('heading', { name: 'Porta 3' })).toBeInTheDocument();
    type('Nome della porta (facoltativo)', 'Internet');
    expect(screen.getByRole('heading', { name: 'Porta 3 «Internet»' })).toBeInTheDocument();
  });

  it('is switched off and on, and its speed and note go to the port', () => {
    const { port, kept } = renderEditor({ id: 3, enabled: true }, 'Switch');
    fireEvent.click(screen.getByLabelText('Porta attiva'));
    expect(port().enabled).toBe(false);
    type('Velocità', '1G');
    type('Note / descrizione', ' uplink ');
    expect(kept()).toMatchObject({ enabled: false, speed: '1G', description: 'uplink' });
  });
});

describe('PortEditor — link', () => {
  it('shows what the port is connected to; it is not something to type', () => {
    renderEditor({ id: 1, enabled: true }, 'Router', { connectedTo: 'SW-Office (porta 8)' });
    const link = screen.getByLabelText('Collegata a');
    expect(link).toHaveTextContent('SW-Office (porta 8)');
    expect(link.tagName).toBe('OUTPUT');
  });

  it('shows the link on Switch ports too', () => {
    renderEditor({ id: 3, enabled: true }, 'Switch', { connectedTo: 'PC-1 (eth0)' });
    expect(screen.getByLabelText('Collegata a')).toHaveTextContent('PC-1 (eth0)');
  });

  it('says that no cable is on a free port', () => {
    renderEditor({ id: 1, enabled: true }, 'Router');
    expect(screen.queryByLabelText('Collegata a')).not.toBeInTheDocument();
    expect(screen.getByText('Nessun cavo collegato')).toBeInTheDocument();
  });
});

describe('PortEditor — VLAN of a switch port', () => {
  it('an access port takes one VLAN, which the engine reads as its access VLAN', () => {
    const { port } = renderEditor({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    type(ACCESS, '10');
    expect(port()).toMatchObject({ portType: 'access', vlan: 10 });
    expect(portVlanMode(port())).toEqual({ kind: 'access', vlan: 10, explicit: true });
  });

  it('a trunk takes its list', () => {
    const { port } = renderEditor({ id: 8, enabled: true, portType: 'trunk' }, 'Switch');
    type(TRUNK, '10, 20,30');
    expect(port()).toMatchObject({ portType: 'trunk', vlan: [10, 20, 30] });
    expect(portVlanMode(port())).toEqual({ kind: 'trunk', vlans: [10, 20, 30] });
  });

  it('a list is typed a character at a time: the comma stays in the field', () => {
    const { port } = renderEditor({ id: 8, enabled: true, portType: 'trunk' }, 'Switch');
    for (const typed of ['1', '10', '10,', '10, ', '10, 2', '10, 20']) {
      type(TRUNK, typed);
      expect(screen.getByLabelText(TRUNK)).toHaveValue(typed);
    }
    expect(port().vlan).toEqual([10, 20]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a trunk left without a list carries every VLAN', () => {
    const { port } = renderEditor({ id: 8, enabled: true, portType: 'access' }, 'Switch');
    type(MODE, 'trunk');
    expect(port().vlan).toBeUndefined();
    expect(portVlanMode(port())).toEqual({ kind: 'trunk', vlans: [] });
  });

  it('emptying the field takes the VLAN off the port', () => {
    const { port } = renderEditor({ id: 3, enabled: true, portType: 'access', vlan: 10 }, 'Switch');
    expect(screen.getByLabelText(ACCESS)).toHaveValue('10');
    type(ACCESS, '');
    expect(port().vlan).toBeUndefined();
    expect(portVlanMode(port())).toEqual({ kind: 'access', vlan: 1, explicit: false });
  });

  it('keeps what was typed when the port changes between access and trunk', () => {
    const { port } = renderEditor({ id: 3, enabled: true, portType: 'access', vlan: 10 }, 'Switch');
    type(MODE, 'trunk');
    expect(screen.getByLabelText(TRUNK)).toHaveValue('10');
    type(TRUNK, '10, 20');
    type(MODE, 'access');
    expect(screen.getByLabelText(ACCESS)).toHaveValue('10');
    expect(port()).toMatchObject({ portType: 'access', vlan: 10 });
  });

  it('a number that is not a VLAN is said so, and does not reach the port', () => {
    const { port } = renderEditor({ id: 3, enabled: true, portType: 'access', vlan: 10 }, 'Switch');
    type(ACCESS, '5000');
    expect(screen.getByRole('alert')).toHaveTextContent('5000 non è una VLAN: il numero va da 1 a 4094');
    expect(port().vlan).toBe(10);

    type(ACCESS, '4094');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(port().vlan).toBe(4094);
  });

  it('an access port is in one VLAN: a list is said so', () => {
    const { port } = renderEditor({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    type(ACCESS, '10, 20');
    expect(screen.getByRole('alert')).toHaveTextContent('Una porta di accesso sta in una sola VLAN');
    expect(port().vlan).toBeUndefined();
  });

  it('explains what the field means in each mode, and the VLAN 1 rule', () => {
    renderEditor({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    expect(screen.getByText(/La porta appartiene a questa VLAN/)).toBeInTheDocument();
    expect(
      screen.getByText(/Appena una porta dello switch ha una VLAN, quelle senza sono nella VLAN 1\./)
    ).toBeInTheDocument();
    type(MODE, 'trunk');
    expect(screen.getByText(/Le VLAN che la porta trasporta con etichetta/)).toBeInTheDocument();
  });

  it('does not offer a VLAN on router and firewall ports', () => {
    renderEditor({ id: 1, enabled: true, portType: 'lan' }, 'Router');
    expect(screen.queryByLabelText(ACCESS)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(TRUNK)).not.toBeInTheDocument();
  });
});

describe('PortEditor — security zone of a firewall port', () => {
  const ZONE = 'Zona di sicurezza';

  it('a port without a zone stays without one when something else is typed', () => {
    // a name must not put the port in "trust" behind the user's back
    const { kept } = renderEditor({ id: 3, enabled: true, portType: 'lan' }, 'Firewall');
    expect(screen.getByLabelText(ZONE)).toHaveValue('');
    type('Nome della porta (facoltativo)', 'Riserva');
    expect(kept().name).toBe('Riserva');
    expect(kept().securityZone).toBeUndefined();
  });

  it('takes the zone that is chosen', () => {
    const { port } = renderEditor({ id: 2, enabled: true, portType: 'wan' }, 'Firewall');
    type(ZONE, 'untrust');
    expect(port().securityZone).toBe('untrust');
  });

  it('shows the zone the port is in, and "Nessuna" removes it', () => {
    const { port } = renderEditor({ id: 2, enabled: true, portType: 'wan', securityZone: 'dmz' }, 'Firewall');
    expect(screen.getByLabelText(ZONE)).toHaveValue('dmz');
    type(ZONE, '');
    expect(port().securityZone).toBeUndefined();
  });

  it('a router port has no zone', () => {
    renderEditor({ id: 2, enabled: true }, 'Router');
    expect(screen.queryByLabelText(ZONE)).not.toBeInTheDocument();
  });
});

describe('PortEditor — NAT', () => {
  it.each(['Router', 'Firewall'])('a %s port can do NAT, and the panel says what that does', deviceType => {
    const { port } = renderEditor({ id: 2, enabled: true, ip: '203.0.113.1', subnet: MASK }, deviceType);

    expect(screen.getByLabelText(NAT)).not.toBeChecked();
    expect(screen.getByText(/ciò che esce da questa porta prende il suo indirizzo/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(NAT));
    expect(port().nat).toBe(true);
  });

  it('shows a port that does NAT as doing it, and switches it off', () => {
    const { port } = renderEditor({ id: 2, enabled: true, ip: '203.0.113.1', nat: true }, 'Firewall');
    expect(screen.getByLabelText(NAT)).toBeChecked();

    fireEvent.click(screen.getByLabelText(NAT));
    expect(port().nat).toBe(false);
  });

  it('warns while the port has no address: there is nothing to translate to', () => {
    renderEditor({ id: 2, enabled: true }, 'Router');
    expect(screen.queryByText(/finché non ne ha uno il NAT non traduce nulla/)).toBeNull();

    fireEvent.click(screen.getByLabelText(NAT));
    expect(screen.getByText(/finché non ne ha uno il NAT non traduce nulla/)).toBeInTheDocument();
  });

  it('a switch port has no NAT', () => {
    renderEditor({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    expect(screen.queryByLabelText(NAT)).toBeNull();
  });
});

describe('PortEditor — the DHCP server of a port', () => {
  const LAN: Port = { id: 1, enabled: true, ip: '192.168.10.1', subnet: MASK };

  it('is off until it is ticked; ticked, it starts from a range of the network of the port', () => {
    const { port } = renderEditor(LAN, 'Router');
    expect(screen.getByLabelText(SERVER)).not.toBeChecked();
    expect(screen.queryByLabelText('Primo indirizzo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(SERVER));
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue('192.168.10.100');
    expect(screen.getByLabelText('Ultimo indirizzo')).toHaveValue('192.168.10.199');
    expect(port().dhcpServer).toEqual({ start: '192.168.10.100', end: '192.168.10.199' });
  });

  it('a range typed is kept trimmed; the tick off takes the server away', () => {
    const { port, kept } = renderEditor(LAN, 'Router');
    fireEvent.click(screen.getByLabelText(SERVER));
    type('Primo indirizzo', ' 192.168.10.50 ');
    type('Ultimo indirizzo', '192.168.10.59');
    type('Gateway consegnato (facoltativo)', '192.168.10.254');
    expect(kept().dhcpServer).toEqual({ start: '192.168.10.50', end: '192.168.10.59', gateway: '192.168.10.254' });

    fireEvent.click(screen.getByLabelText(SERVER));
    expect(port().dhcpServer).toBeUndefined();
    // ticked again, what was typed is back
    fireEvent.click(screen.getByLabelText(SERVER));
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue(' 192.168.10.50 ');
  });

  it('says what is wrong with the range under its fields while it is typed', () => {
    renderEditor(LAN, 'Router');
    fireEvent.click(screen.getByLabelText(SERVER));
    type('Primo indirizzo', '10.0.0.5');
    expect(screen.getByRole('alert')).toHaveTextContent('10.0.0.5 è fuori dalla rete della porta (192.168.10.0/24)');
  });

  it('on a port with no address starts empty, and says that an empty range is not kept', () => {
    const { kept } = renderEditor({ id: 4, enabled: true }, 'Firewall');
    fireEvent.click(screen.getByLabelText(SERVER));
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue('');
    expect(screen.getByText(/un intervallo lasciato vuoto non viene salvato/)).toBeInTheDocument();
    expect(kept().dhcpServer).toBeUndefined();
  });

  it('says what the range gave out when the window knows it, and not while something is wrong', () => {
    const served: Port = { ...LAN, dhcpServer: { start: '192.168.10.100', end: '192.168.10.199' } };
    const status = 'Gateway consegnato 192.168.10.1 · 2 assegnati, 98 liberi su 100';
    renderEditor(served, 'Router', { poolStatus: status });
    expect(screen.getByText(status)).toBeInTheDocument();
    type('Ultimo indirizzo', 'x');
    expect(screen.queryByText(status)).not.toBeInTheDocument();
  });

  it('a switch port hands out no addresses', () => {
    renderEditor({ id: 3, enabled: true, portType: 'access' }, 'Switch');
    expect(screen.queryByLabelText(SERVER)).toBeNull();
  });
});

describe('PortEditor — settings the engine does not simulate', () => {
  it('says so next to IPS', () => {
    renderEditor({ id: 1, enabled: true }, 'Firewall');
    expect(screen.getByText('Resta come documentazione: il motore non lo simula.')).toBeInTheDocument();
    expect(screen.getByText(/Per il firewall conta la zona di sicurezza/)).toBeInTheDocument();
  });
});

describe('PortGrid — link markers', () => {
  it('marks only the ports that have a link', () => {
    const ports: Port[] = [
      { id: 1, enabled: true },
      { id: 2, enabled: true },
      { id: 3, enabled: false },
    ];
    render(
      <PortGrid
        ports={ports}
        selectedPortId={null}
        onPortSelect={() => {}}
        linkedPorts={new Map([[2, 'SW-Servers (porta 8)']])}
      />
    );
    expect(screen.getByTestId('port-link-marker-2')).toHaveAttribute('title', 'Collegata a SW-Servers (porta 8)');
    expect(screen.queryByTestId('port-link-marker-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('port-link-marker-3')).not.toBeInTheDocument();
    // the tooltip of the port itself says it too
    expect(screen.getByTitle('Porta 2 — collegata a SW-Servers (porta 8)')).toBeInTheDocument();
  });

  it('renders without markers when no link info is given', () => {
    render(<PortGrid ports={[{ id: 1, enabled: true }]} selectedPortId={null} onPortSelect={() => {}} />);
    expect(screen.queryByTestId('port-link-marker-1')).not.toBeInTheDocument();
  });
});
