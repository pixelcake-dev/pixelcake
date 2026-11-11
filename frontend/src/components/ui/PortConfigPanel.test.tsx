/**
 * PortConfigPanel tests — the L3 address of Router/Firewall ports (validated
 * with utils/ipHelpers) and the read-only "Collegata a" line, plus the link
 * markers of PortGrid and NICList.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NetworkInterfaceCard, Port } from '@/types';
import PortConfigPanel from './PortConfigPanel';
import PortGrid from './PortGrid';
import NICList from './NICList';

function renderPanel(port: Port, deviceType: string, connectedTo?: string) {
  const onSave = vi.fn<(portId: number, updates: Partial<Port>) => void>();
  render(
    <PortConfigPanel
      port={port}
      deviceType={deviceType}
      onSave={onSave}
      onCancel={() => {}}
      connectedTo={connectedTo}
    />
  );
  return { onSave };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

describe('PortConfigPanel — port address', () => {
  it('offers IP and subnet mask on Router and Firewall ports, not on Switch ports', () => {
    const { unmount } = render(
      <PortConfigPanel
        port={{ id: 1, enabled: true }}
        deviceType="Router"
        onSave={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByLabelText('Indirizzo IP')).toBeInTheDocument();
    expect(screen.getByLabelText('Subnet Mask')).toBeInTheDocument();
    unmount();

    const firewall = render(
      <PortConfigPanel
        port={{ id: 1, enabled: true }}
        deviceType="Firewall"
        onSave={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByLabelText('Indirizzo IP')).toBeInTheDocument();
    firewall.unmount();

    render(
      <PortConfigPanel
        port={{ id: 1, enabled: true }}
        deviceType="Switch"
        onSave={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.queryByLabelText('Indirizzo IP')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Subnet Mask')).not.toBeInTheDocument();
  });

  it('shows the address the port already has', () => {
    renderPanel({ id: 2, enabled: true, ip: '192.168.20.1', subnet: '255.255.255.0' }, 'Router');
    expect(screen.getByLabelText<HTMLInputElement>('Indirizzo IP').value).toBe('192.168.20.1');
    expect(screen.getByLabelText<HTMLInputElement>('Subnet Mask').value).toBe('255.255.255.0');
  });

  it('saves a valid address with its mask', () => {
    const { onSave } = renderPanel({ id: 1, enabled: true, portType: 'lan' }, 'Router');

    type('Indirizzo IP', ' 192.168.10.1 ');
    type('Subnet Mask', '255.255.0.0');
    save();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBe(1);
    expect(onSave.mock.calls[0][1]).toMatchObject({ ip: '192.168.10.1', subnet: '255.255.0.0' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('defaults the mask to 255.255.255.0 when only the IP is given', () => {
    const { onSave } = renderPanel({ id: 1, enabled: true }, 'Firewall');

    type('Indirizzo IP', '10.0.0.1');
    save();

    expect(onSave.mock.calls[0][1]).toMatchObject({ ip: '10.0.0.1', subnet: '255.255.255.0' });
  });

  it('refuses an invalid IP with an error and does not save', () => {
    const { onSave } = renderPanel({ id: 1, enabled: true }, 'Router');

    type('Indirizzo IP', '192.168.10.999');
    save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '"192.168.10.999" non è un indirizzo IPv4 valido'
    );

    // fixing the value clears the error and lets the save through
    type('Indirizzo IP', '192.168.10.1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('refuses an invalid mask, and a mask without an IP', () => {
    const { onSave } = renderPanel({ id: 1, enabled: true }, 'Router');

    type('Indirizzo IP', '192.168.10.1');
    type('Subnet Mask', '255.255.255');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '"255.255.255" non è una subnet mask valida'
    );

    type('Indirizzo IP', '');
    type('Subnet Mask', '255.255.255.0');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Inserisci un indirizzo IP oppure svuota la subnet mask'
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clearing the IP removes the address from the port', () => {
    const { onSave } = renderPanel(
      { id: 2, enabled: true, ip: '192.168.20.1', subnet: '255.255.255.0' },
      'Router'
    );

    type('Indirizzo IP', '');
    type('Subnet Mask', '');
    save();

    const updates = onSave.mock.calls[0][1];
    expect(updates.ip).toBeUndefined();
    expect(updates.subnet).toBeUndefined();
    // both keys are present so the merge in the Inspector really clears them
    expect('ip' in updates && 'subnet' in updates).toBe(true);
  });

  it('does not write address fields for a Switch port', () => {
    const { onSave } = renderPanel({ id: 1, enabled: true, portType: 'access' }, 'Switch');
    save();
    const updates = onSave.mock.calls[0][1];
    expect('ip' in updates).toBe(false);
    expect('subnet' in updates).toBe(false);
  });
});

describe('PortConfigPanel — link', () => {
  it('shows, read-only, what the port is connected to', () => {
    renderPanel({ id: 1, enabled: true }, 'Router', 'SW-Office (porta 8)');

    const field = screen.getByLabelText<HTMLInputElement>('Collegata a');
    expect(field.value).toBe('SW-Office (porta 8)');
    expect(field.readOnly).toBe(true);
  });

  it('shows the link on Switch ports too', () => {
    renderPanel({ id: 3, enabled: true }, 'Switch', 'PC-1 (eth0)');
    expect(screen.getByLabelText<HTMLInputElement>('Collegata a').value).toBe('PC-1 (eth0)');
  });

  it('shows nothing about a link when the port is free', () => {
    renderPanel({ id: 1, enabled: true }, 'Router');
    expect(screen.queryByLabelText('Collegata a')).not.toBeInTheDocument();
  });
});

describe('link markers', () => {
  it('PortGrid marks only the ports that have a link', () => {
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

    expect(screen.getByTestId('port-link-marker-2')).toHaveAttribute(
      'title',
      'Collegata a SW-Servers (porta 8)'
    );
    expect(screen.queryByTestId('port-link-marker-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('port-link-marker-3')).not.toBeInTheDocument();
    // the tooltip of the port itself says it too
    expect(screen.getByTitle('Port 2 — collegata a SW-Servers (porta 8)')).toBeInTheDocument();
  });

  it('PortGrid renders without markers when no link info is given', () => {
    render(
      <PortGrid ports={[{ id: 1, enabled: true }]} selectedPortId={null} onPortSelect={() => {}} />
    );
    expect(screen.queryByTestId('port-link-marker-1')).not.toBeInTheDocument();
  });

  it('NICList marks only the NICs that have a link, and says where it goes', () => {
    const nic = (id: string, name: string): NetworkInterfaceCard => ({
      id,
      name,
      enabled: true,
      speed: 'auto',
      ip: '',
      subnet: '',
      gateway: '',
    });
    render(
      <NICList
        nics={[nic('nic-1', 'eth0'), nic('nic-2', 'eth1')]}
        selectedNicId={null}
        onNicSelect={() => {}}
        onAddNic={() => {}}
        onRemoveNic={() => {}}
        linkedNics={new Map([['nic-1', 'SW-Office (porta 1)']])}
      />
    );

    expect(screen.getByTestId('nic-link-marker-nic-1')).toHaveTextContent('Collegata');
    expect(screen.queryByTestId('nic-link-marker-nic-2')).not.toBeInTheDocument();
    expect(screen.getByText('Collegata a:')).toBeInTheDocument();
    expect(screen.getByText('SW-Office (porta 1)')).toBeInTheDocument();
  });
});
