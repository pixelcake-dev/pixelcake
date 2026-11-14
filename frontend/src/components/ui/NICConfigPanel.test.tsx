/**
 * NICConfigPanel and NICList on their own — how a card has its address (by
 * hand, or from DHCP) and what the panel hands back when it is saved. What
 * the device window makes of it is in InspectorModal.dhcp.test.
 */

import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { NetworkInterfaceCard } from '@/types';
import NICConfigPanel from './NICConfigPanel';
import type { CardLease } from './NICConfigPanel';
import NICList from './NICList';

const CARD: NetworkInterfaceCard = {
  id: 'nic-1',
  name: 'eth0',
  enabled: true,
  speed: 'auto',
  ip: '192.168.1.10',
  subnet: '255.255.255.0',
  gateway: '192.168.1.1',
  mac: '02:00:00:00:00:01',
};

function renderPanel(nic: NetworkInterfaceCard, props: { lease?: CardLease; canServe?: boolean } = {}) {
  const onSave = vi.fn<(nicId: string, updates: Partial<NetworkInterfaceCard>) => void>();
  render(<NICConfigPanel nic={nic} onSave={onSave} onCancel={() => {}} {...props} />);
  return { onSave };
}

const mode = () => screen.getByLabelText<HTMLSelectElement>('Indirizzo');
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
const saved = (onSave: ReturnType<typeof renderPanel>['onSave']) => onSave.mock.calls[0][1];

describe('NICConfigPanel — where the address comes from', () => {
  it('by hand: the three fields, saved as typed and with no word about DHCP', () => {
    const { onSave } = renderPanel(CARD);
    expect(mode().value).toBe('manual');
    fireEvent.change(screen.getByLabelText('Indirizzo IP'), { target: { value: ' 192.168.1.20 ' } });
    save();
    expect(onSave).toHaveBeenCalledWith('nic-1', expect.objectContaining({ ip: '192.168.1.20' }));
    expect(saved(onSave)).toMatchObject({ subnet: '255.255.255.0', gateway: '192.168.1.1' });
    expect(saved(onSave).dhcp).toBeUndefined();
    expect(saved(onSave).dhcpServer).toBeUndefined();
  });

  it('from DHCP: the card is saved with no address of its own', () => {
    const { onSave } = renderPanel(CARD);
    fireEvent.change(mode(), { target: { value: 'dhcp' } });
    expect(screen.queryByLabelText('Indirizzo IP')).not.toBeInTheDocument();
    save();
    expect(saved(onSave)).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '', name: 'eth0' });
  });

  it('from DHCP: the card is handed back with no DNS server of its own either', () => {
    const { onSave } = renderPanel({ ...CARD, dns: '192.168.1.53' });
    expect(screen.getByLabelText('Server DNS')).toHaveValue('192.168.1.53');
    fireEvent.change(mode(), { target: { value: 'dhcp' } });
    expect(screen.queryByLabelText('Server DNS')).not.toBeInTheDocument();
    save();
    expect(saved(onSave)).toMatchObject({ dhcp: true, ip: '' });
    expect(saved(onSave).dns).toBeUndefined();
  });

  it('what was wrong with the DNS server of one card is not said of the next one opened', () => {
    const onSave = vi.fn();
    const { rerender } = render(<NICConfigPanel nic={CARD} onSave={onSave} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Server DNS'), { target: { value: 'srv-auth' } });
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('"srv-auth" non è un indirizzo IPv4 valido');
    expect(onSave).not.toHaveBeenCalled();
    rerender(<NICConfigPanel nic={{ ...CARD, id: 'nic-2', name: 'eth1' }} onSave={onSave} onCancel={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Server DNS')).toHaveValue('');
  });

  it('a card kept on DHCP opens on DHCP', () => {
    renderPanel({ ...CARD, dhcp: true, ip: '', subnet: '', gateway: '' });
    expect(mode().value).toBe('dhcp');
    expect(screen.queryByLabelText('Subnet Mask')).not.toBeInTheDocument();
  });

  it('with nothing known of the drawing says where the address will come from', () => {
    renderPanel({ ...CARD, dhcp: true });
    const box = screen.getByTestId('nic-lease');
    expect(box).toHaveTextContent("L'indirizzo arriva dal server DHCP della rete a cui la scheda è collegata.");
    expect(box).toHaveClass('modal-info-box');
  });

  it('with a lease shows it; without, the reason, as an error', () => {
    const given = { ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '' };
    const { unmount } = render(
      <NICConfigPanel
        nic={{ ...CARD, dhcp: true }}
        onSave={() => {}}
        onCancel={() => {}}
        lease={{ text: '192.168.1.100 da R, porta 1', given }}
      />
    );
    expect(screen.getByTestId('nic-lease')).toHaveTextContent(
      'Indirizzo assegnato: 192.168.1.100 da R, porta 1Subnet mask 255.255.255.0 · gateway nessuno'
    );
    unmount();

    renderPanel({ ...CARD, dhcp: true }, { lease: { text: 'Nessun indirizzo: la scheda è disabilitata' } });
    const box = screen.getByTestId('nic-lease');
    expect(box).toHaveTextContent('Nessun indirizzo: la scheda è disabilitata');
    expect(box).not.toHaveTextContent('Subnet mask');
    expect(box).toHaveClass('modal-error-box');
  });

  it('back to an address by hand: what was typed stays, else the lease is the start', () => {
    const given = { ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '192.168.1.1' };
    // typed before: kept
    renderPanel(CARD, { lease: { text: '', given } });
    fireEvent.change(mode(), { target: { value: 'dhcp' } });
    fireEvent.change(mode(), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.1.10');
    cleanup();

    // nothing typed: the lease
    renderPanel({ ...CARD, dhcp: true, ip: '', subnet: '', gateway: '' }, { lease: { text: '', given } });
    fireEvent.change(mode(), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.1.100');
    expect(screen.getByLabelText('Gateway')).toHaveValue('192.168.1.1');
  });
});

describe('NICConfigPanel — the DHCP server of a card', () => {
  it('is offered only where the card can serve', () => {
    const { unmount } = render(<NICConfigPanel nic={CARD} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.queryByLabelText(/^Server DHCP Abilitato/)).not.toBeInTheDocument();
    unmount();
    renderPanel(CARD, { canServe: true });
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).not.toBeChecked();
  });

  it('is saved tidy, and is not saved when the tick is off', () => {
    const { onSave } = renderPanel(CARD, { canServe: true });
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    fireEvent.change(screen.getByLabelText('Primo indirizzo'), { target: { value: ' 192.168.1.100' } });
    fireEvent.change(screen.getByLabelText('Ultimo indirizzo'), { target: { value: '192.168.1.110 ' } });
    save();
    expect(saved(onSave).dhcpServer).toEqual({ start: '192.168.1.100', end: '192.168.1.110' });

    onSave.mockClear();
    fireEvent.click(screen.getByLabelText(/^Server DHCP Abilitato/));
    save();
    expect(saved(onSave).dhcpServer).toBeUndefined();
  });

  it('a pool kept on a card that cannot serve any more is dropped at the next save', () => {
    const { onSave } = renderPanel({ ...CARD, dhcpServer: { start: '192.168.1.100', end: '192.168.1.110' } });
    save();
    expect(saved(onSave).dhcpServer).toBeUndefined();
  });
});

describe('NICList — the address of a card', () => {
  const second: NetworkInterfaceCard = { ...CARD, id: 'nic-2', name: 'eth1', ip: '', dhcp: true };

  it('is the one written on it, or what it is told to show for a card on DHCP', () => {
    render(
      <NICList
        nics={[CARD, second]}
        selectedNicId={null}
        onNicSelect={() => {}}
        onAddNic={() => {}}
        onRemoveNic={() => {}}
        leasedAddresses={new Map([['nic-2', '192.168.1.100 · DHCP']])}
      />
    );
    const values = Array.from(document.querySelectorAll('.nic-card')).map(
      card => card.querySelector('.nic-detail-value')?.textContent
    );
    expect(values).toEqual(['192.168.1.10', '192.168.1.100 · DHCP']);
  });
});
