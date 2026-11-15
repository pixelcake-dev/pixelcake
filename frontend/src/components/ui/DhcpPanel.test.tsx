/**
 * DhcpPanel on its own, for what the window of a device never hands it: the
 * window is tested in Modals/InspectorModal.dhcp.test.tsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { listInterfaces, resolveDhcp } from '@/engine';
import { device, nic } from '@/test/networkFixtures';
import type { NetworkDevice } from '@/types';
import DhcpPanel from './DhcpPanel';

function renderPanel(server: NetworkDevice) {
  const onPoolChange = vi.fn();
  const onOpenInterface = vi.fn();
  render(
    <DhcpPanel
      deviceId={server.id}
      dhcp={resolveDhcp({ devices: [server], connections: [] })}
      setIn="cards"
      interfaces={listInterfaces(server)}
      onPoolChange={onPoolChange}
      onOpenInterface={onOpenInterface}
    />
  );
  return { onPoolChange, onOpenInterface };
}

describe('DhcpPanel', () => {
  it('a card on DHCP cannot be ticked even when an address was left written on it', () => {
    // (the app clears the address of a card put on DHCP: a file written by hand may not)
    const server = device({
      id: 'srv',
      type: 'Server',
      nics: [nic({ dhcp: true, ip: '10.0.0.5', subnet: '255.255.255.0' })],
    });
    renderPanel(server);

    expect(screen.getByLabelText('Server DHCP sulla scheda eth0')).toBeDisabled();
    expect(screen.getByText('Prende il proprio indirizzo dal DHCP: non può anche assegnarne.')).toBeInTheDocument();
    // its stale address is not shown as the one of the card
    expect(screen.queryByText(/10\.0\.0\.5/)).toBeNull();
  });

  it('a card on DHCP hands out nothing, even with a range left written on it', () => {
    // (in the form of the window what was typed stays until the device is saved)
    const server = device({
      id: 'srv',
      type: 'Server',
      nics: [nic({ dhcp: true, ip: '10.0.0.5', dhcpServer: { start: '10.0.0.100', end: '10.0.0.199' } })],
    });
    renderPanel(server);
    expect(screen.getByLabelText('Server DHCP sulla scheda eth0')).not.toBeChecked();
    expect(screen.queryByLabelText('Primo indirizzo, scheda eth0')).not.toBeInTheDocument();
    expect(screen.getByText(/Nessuna scheda assegna indirizzi/)).toBeInTheDocument();
  });

  it('a card with no address cannot be ticked, and «Dagliene uno» asks for that card', () => {
    const server = device({ id: 'srv', type: 'Server', nics: [nic({ ip: '' })] });
    const { onPoolChange, onOpenInterface } = renderPanel(server);

    expect(screen.getByLabelText('Server DHCP sulla scheda eth0')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Dagliene uno' }));
    expect(onOpenInterface).toHaveBeenCalledWith(expect.objectContaining({ key: 'nic:nic-1' }));
    expect(onPoolChange).not.toHaveBeenCalled();
  });

  it('a tick on a card that has an address asks for the range of its network', () => {
    const server = device({
      id: 'srv',
      type: 'Server',
      nics: [nic({ ip: '10.0.0.5', subnet: '255.255.255.0' })],
    });
    const { onPoolChange } = renderPanel(server);

    fireEvent.click(screen.getByLabelText('Server DHCP sulla scheda eth0'));
    expect(onPoolChange).toHaveBeenCalledWith(expect.objectContaining({ key: 'nic:nic-1' }), {
      start: '10.0.0.100',
      end: '10.0.0.199',
    });
  });
});
