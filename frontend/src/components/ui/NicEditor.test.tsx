/**
 * NicEditor and NicRows on their own — how a card has its address (by hand,
 * or from DHCP), what goes to the form of the window as it is typed, and how
 * the cards of a device are listed. What the device window makes of it is
 * in InspectorModal.dhcp.test.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { NetworkInterfaceCard } from '@/types';
import { tidyNic } from '@/utils/interfaceProblems';
import NicEditor, { type CardLease } from './NicEditor';
import NicRows from './NicRows';

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

/** The editor over a card kept as the window keeps it: each change goes into the card */
function renderEditor(start: NetworkInterfaceCard, props: { lease?: CardLease; canServe?: boolean } = {}) {
  const state = { nic: start };
  function Harness() {
    const [nic, setNic] = useState(start);
    return (
      <NicEditor
        nic={nic}
        onChange={(patch) => {
          state.nic = { ...state.nic, ...patch };
          setNic(state.nic);
        }}
        {...props}
      />
    );
  }
  render(<Harness />);
  return {
    /** The card as it is in the form */
    nic: () => state.nic,
    /** The card as the device would keep it */
    kept: () => tidyNic(state.nic),
  };
}

const mode = () => screen.getByLabelText<HTMLSelectElement>('Indirizzo');
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const SERVER = 'Server DHCP Attivo';

describe('NicEditor — where the address comes from', () => {
  it('by hand: the fields, kept as typed and with no word about DHCP', () => {
    const { kept } = renderEditor(CARD);
    expect(mode().value).toBe('manual');
    type('Indirizzo IP', ' 192.168.1.20 ');
    expect(kept()).toMatchObject({ ip: '192.168.1.20', subnet: '255.255.255.0', gateway: '192.168.1.1' });
    expect(kept().dhcp).toBeUndefined();
    expect(kept().dhcpServer).toBeUndefined();
  });

  it('from DHCP: the card is kept with no address of its own', () => {
    const { nic, kept } = renderEditor(CARD);
    fireEvent.change(mode(), { target: { value: 'dhcp' } });
    expect(screen.queryByLabelText('Indirizzo IP')).not.toBeInTheDocument();
    expect(nic().dhcp).toBe(true);
    expect(kept()).toMatchObject({ dhcp: true, ip: '', subnet: '', gateway: '', name: 'eth0' });
  });

  it('from DHCP: the card is kept with no DNS server of its own either', () => {
    const { kept } = renderEditor({ ...CARD, dns: '192.168.1.53' });
    expect(screen.getByLabelText('Server DNS')).toHaveValue('192.168.1.53');
    fireEvent.change(mode(), { target: { value: 'dhcp' } });
    expect(screen.queryByLabelText('Server DNS')).not.toBeInTheDocument();
    expect(kept()).toMatchObject({ dhcp: true, ip: '' });
    expect(kept().dns).toBeUndefined();
  });

  it('says what is wrong with the DNS server under its field while it is typed', () => {
    const { nic } = renderEditor(CARD);
    type('Server DNS', 'srv-auth');
    expect(screen.getByRole('alert')).toHaveTextContent('"srv-auth" non è un indirizzo IPv4 valido');
    expect(nic().dns).toBe('srv-auth');
    type('Server DNS', '192.168.1.53');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('what is wrong with one card is not said of another', () => {
    const { rerender } = render(<NicEditor nic={{ ...CARD, dns: 'srv-auth' }} onChange={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<NicEditor nic={{ ...CARD, id: 'nic-2', name: 'eth1' }} onChange={() => {}} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Server DNS')).toHaveValue('');
  });

  it('a card kept on DHCP opens on DHCP', () => {
    renderEditor({ ...CARD, dhcp: true, ip: '', subnet: '', gateway: '' });
    expect(mode().value).toBe('dhcp');
    expect(screen.queryByLabelText('Subnet Mask')).not.toBeInTheDocument();
  });

  it('with nothing known of the drawing says where the address will come from', () => {
    renderEditor({ ...CARD, dhcp: true });
    const box = screen.getByTestId('nic-lease');
    expect(box).toHaveTextContent("L'indirizzo arriva dal server DHCP della rete a cui la scheda è collegata.");
    expect(box.style.borderLeft).toContain('--border-color');
  });

  it('with a lease shows it; without, the reason, marked as something wrong', () => {
    const given = { ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '' };
    renderEditor({ ...CARD, dhcp: true }, { lease: { text: '192.168.1.100 da R, porta 1', given } });
    expect(screen.getByTestId('nic-lease')).toHaveTextContent(
      '192.168.1.100 da R, porta 1Subnet mask 255.255.255.0 · gateway nessuno · server DNS nessuno'
    );
    expect(screen.getByTestId('nic-lease').style.borderLeft).toContain('--ok-color');
    cleanup();

    renderEditor({ ...CARD, dhcp: true }, { lease: { text: 'Nessun indirizzo: la scheda è disabilitata' } });
    const box = screen.getByTestId('nic-lease');
    expect(box).toHaveTextContent('Nessun indirizzo: la scheda è disabilitata');
    expect(box).not.toHaveTextContent('Subnet mask');
    expect(box.style.borderLeft).toContain('--danger-color');
  });

  it('back to an address by hand: what was typed stays, else the lease is the start', () => {
    const given = { ip: '192.168.1.100', subnet: '255.255.255.0', gateway: '192.168.1.1' };
    // typed before: kept
    renderEditor(CARD, { lease: { text: '', given } });
    fireEvent.change(mode(), { target: { value: 'dhcp' } });
    fireEvent.change(mode(), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.1.10');
    cleanup();
    // nothing typed: the lease
    const { nic } = renderEditor({ ...CARD, dhcp: true, ip: '', subnet: '', gateway: '' }, { lease: { text: '', given } });
    fireEvent.change(mode(), { target: { value: 'manual' } });
    expect(screen.getByLabelText('Indirizzo IP')).toHaveValue('192.168.1.100');
    expect(screen.getByLabelText('Gateway')).toHaveValue('192.168.1.1');
    expect(nic().dhcp).toBeUndefined();
  });
});

describe('NicEditor — the card itself', () => {
  it('is switched off, renamed, given a speed and a note', () => {
    const { kept } = renderEditor(CARD);
    fireEvent.click(screen.getByLabelText('Scheda Attiva'));
    type('Nome dell\'Interfaccia', ' ens192 ');
    type('Velocità', '10G');
    type('Note / Descrizione', 'uplink');
    expect(kept()).toMatchObject({ enabled: false, name: 'ens192', speed: '10G', description: 'uplink' });
  });

  it('must have a name: an empty one is said so', () => {
    renderEditor(CARD);
    type('Nome dell\'Interfaccia', ' ');
    expect(screen.getByRole('alert')).toHaveTextContent('La scheda deve avere un nome');
  });

  it('is given a MAC address at a press', () => {
    const { nic } = renderEditor({ ...CARD, mac: undefined });
    expect(screen.getByLabelText('Indirizzo MAC')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Genera un MAC' }));
    expect(nic().mac).toMatch(/^02(:[0-9A-F]{2}){5}$/i);
    expect(screen.getByLabelText('Indirizzo MAC')).toHaveValue(nic().mac);
  });
});

describe('NicEditor — the DHCP server of a card', () => {
  it('is offered only where the card can serve', () => {
    renderEditor(CARD);
    expect(screen.queryByLabelText(SERVER)).not.toBeInTheDocument();
    cleanup();
    renderEditor(CARD, { canServe: true });
    expect(screen.getByLabelText(SERVER)).not.toBeChecked();
  });

  it('ticked, starts from a range of the network of the card', () => {
    const { nic } = renderEditor(CARD, { canServe: true });
    fireEvent.click(screen.getByLabelText(SERVER));
    expect(nic().dhcpServer).toEqual({ start: '192.168.1.100', end: '192.168.1.199' });
  });

  it('is kept tidy, and is not kept when the tick is off', () => {
    const { nic, kept } = renderEditor(CARD, { canServe: true });
    fireEvent.click(screen.getByLabelText(SERVER));
    type('Primo indirizzo', ' 192.168.1.100');
    type('Ultimo indirizzo', '192.168.1.110 ');
    expect(kept().dhcpServer).toEqual({ start: '192.168.1.100', end: '192.168.1.110' });

    fireEvent.click(screen.getByLabelText(SERVER));
    expect(nic().dhcpServer).toBeUndefined();
  });

  it('says what is wrong with the range under its fields', () => {
    renderEditor(CARD, { canServe: true });
    fireEvent.click(screen.getByLabelText(SERVER));
    type('Primo indirizzo', '192.168.9.50');
    expect(screen.getByRole('alert')).toHaveTextContent('192.168.9.50 è fuori dalla rete della scheda (192.168.1.0/24)');
  });

  it('goes with the choice of DHCP: a card that takes its address cannot hand out any', () => {
    const { kept } = renderEditor(
      { ...CARD, dhcpServer: { start: '192.168.1.100', end: '192.168.1.110' } },
      { canServe: true }
    );
    expect(screen.getByLabelText(SERVER)).toBeChecked();
    fireEvent.change(mode(), { target: { value: 'dhcp' } });
    expect(screen.queryByLabelText(SERVER)).not.toBeInTheDocument();
    expect(kept().dhcpServer).toBeUndefined();
  });
});

describe('NicRows — the cards of a device', () => {
  const second: NetworkInterfaceCard = { ...CARD, id: 'nic-2', name: 'eth1', ip: '', dhcp: true, mac: undefined };

  function renderRows(nics: NetworkInterfaceCard[], props: Partial<React.ComponentProps<typeof NicRows>> = {}) {
    const handlers = { onOpen: vi.fn(), onChange: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn() };
    render(<NicRows nics={nics} openNicId={null} {...handlers} {...props} />);
    return handlers;
  }
  const rowOf = (name: string) => screen.getByText(name, { selector: '.nic-name' }).closest('.nic-card') as HTMLElement;

  it('shows of each card the address written on it, or what it is told to show for a card on DHCP', () => {
    renderRows([CARD, second], { leasedAddresses: new Map([['nic-2', '192.168.1.100 · DHCP']]) });
    const addresses = Array.from(document.querySelectorAll('.nic-address')).map(cell => cell.textContent);
    expect(addresses).toEqual(['192.168.1.10', '192.168.1.100 · DHCP']);
    expect(rowOf('eth0')).toHaveTextContent('MAC 02:00:00:00:00:01');
    expect(rowOf('eth1')).toHaveTextContent('MAC non indicato');
  });

  it('marks only the cards that have a link, and says where it goes', () => {
    renderRows([CARD, second], { linkedNics: new Map([['nic-1', 'SW-Office (porta 1)']]) });
    const marker = screen.getByTestId('nic-link-marker-nic-1');
    expect(marker).toHaveTextContent('SW-Office (porta 1)');
    expect(marker).toHaveAttribute('title', 'Collegata a SW-Office (porta 1)');
    expect(screen.queryByTestId('nic-link-marker-nic-2')).not.toBeInTheDocument();
  });

  it('a device with one card shows its settings at once, and a press on its row does not close them', () => {
    const { onOpen } = renderRows([CARD]);
    expect(screen.getByTestId('nic-editor-nic-1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('eth0', { selector: '.nic-name' }));
    expect(onOpen).toHaveBeenLastCalledWith('nic-1');
    // one card cannot be taken away
    expect(screen.queryByRole('button', { name: /^Elimina la scheda/ })).not.toBeInTheDocument();
  });

  it('with several cards one is opened by its row, and closed by the same row', () => {
    const closed = renderRows([CARD, second]);
    expect(screen.queryByTestId('nic-editor-nic-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('eth1', { selector: '.nic-name' }));
    expect(closed.onOpen).toHaveBeenLastCalledWith('nic-2');
    cleanup();

    const open = renderRows([CARD, second], { openNicId: 'nic-2' });
    expect(screen.getByTestId('nic-editor-nic-2')).toBeInTheDocument();
    expect(screen.queryByTestId('nic-editor-nic-1')).not.toBeInTheDocument();
    expect(rowOf('eth1').className).toContain('nic-card-selected');
    fireEvent.click(screen.getByText('eth1', { selector: '.nic-name' }));
    expect(open.onOpen).toHaveBeenLastCalledWith(null);
  });

  it('what is typed in the open card goes out with the card it is of', () => {
    const { onChange } = renderRows([CARD, second], { openNicId: 'nic-1' });
    fireEvent.change(screen.getByLabelText('Indirizzo IP'), { target: { value: '192.168.1.20' } });
    expect(onChange).toHaveBeenCalledWith('nic-1', { ip: '192.168.1.20' });
  });

  it('cards are added, and taken away when there is more than one', () => {
    const { onAdd, onRemove } = renderRows([CARD, second]);
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi scheda' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Elimina la scheda eth1' }));
    expect(onRemove).toHaveBeenCalledWith('nic-2');
  });

  it('a card that is off says so on its row', () => {
    renderRows([CARD, { ...second, enabled: false }]);
    expect(rowOf('eth1')).toHaveTextContent('Disabilitata');
    expect(rowOf('eth0')).not.toHaveTextContent('Disabilitata');
  });
});
