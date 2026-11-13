/**
 * The guide and DHCP tell the same story: every name the step puts in
 * «quotes» is on a control of the device window (or on the drawing), and the
 * sample it points at is made the way it says.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { shownAddress } from '@/utils/dhcpLabels';
import { resolveDhcp } from '@/engine';
import HelpModal from './HelpModal';
import InspectorModal from './InspectorModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const TITLE = 'Dai gli indirizzi con il DHCP';
const ui = () => useUIStore.getState();
const device = (label: string) => {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

/** The text of one step of the guide, by its title */
function step(title: string): string {
  ui().openHelp('guide');
  render(<HelpModal />);
  const text = screen.getByText(title).closest('li')?.textContent ?? '';
  cleanup();
  ui().closeModal('help');
  return text;
}

/** What a step puts in «quotes»: the names of controls */
const quoted = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map(match => match[1]);

function openInspector(label: string) {
  cleanup();
  ui().setInspectorDevice(device(label));
  ui().openModal('inspector');
  render(<InspectorModal />);
}

const tabNames = () =>
  Array.from(document.querySelectorAll('.tab-header')).map(tab => (tab.textContent ?? '').replace(/ \(\d+\)$/, ''));

beforeEach(() => {
  localStorage.clear();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createCompanySample();
  store.loadTopology(sample.devices, sample.connections);
  ui().closeModal('inspector');
});

describe('the guide — DHCP', () => {
  it('has the step, after NAT and before asking questions', () => {
    ui().openHelp('guide');
    render(<HelpModal />);
    // (the title of a step is the first paragraph of its item)
    const titles = Array.from(document.querySelectorAll('li')).map(li => li.querySelector('p')?.textContent);
    const at = (title: string) => titles.indexOf(title);
    expect(at(TITLE)).toBeGreaterThan(at('Esci su Internet con il NAT'));
    expect(at(TITLE)).toBeLessThan(at('Chiedi se un dispositivo ne raggiunge un altro'));
  });

  it('names what is on the screen', () => {
    expect(quoted(step(TITLE))).toEqual([
      'Schede di rete',
      'Indirizzo',
      'Automatico (DHCP)',
      'Manuale',
      'Server DHCP Abilitato',
      'Primo indirizzo',
      'Ultimo indirizzo',
      'DHCP',
      'DHCP',
    ]);
  });

  it('the card of a device has the choice it names, with the two answers it names', () => {
    openInspector('Portatile-1');
    expect(tabNames()).toContain('Schede di rete');
    fireEvent.click(screen.getByRole('button', { name: /^Schede di rete/ }));
    fireEvent.click(screen.getByText('eth0', { selector: '.nic-name' }));
    const choice = screen.getByLabelText<HTMLSelectElement>('Indirizzo');
    expect(Array.from(choice.options).map(option => option.textContent)).toEqual(['Manuale', 'Automatico (DHCP)']);
    // the laptop of the sample is on DHCP, and its window says where its address comes from
    expect(choice.value).toBe('dhcp');
    expect(screen.getByTestId('nic-lease')).toHaveTextContent('192.168.20.100 da Router-Core, porta 2');
  });

  it('the port of the router has the tick and the two fields it names, and the router the tab', () => {
    openInspector('Router-Core');
    expect(tabNames()).toContain('DHCP');
    fireEvent.click(screen.getByRole('button', { name: /^Porte/ }));
    fireEvent.click(screen.getByText('2', { selector: '.port-number' }));
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).toBeChecked();
    expect(screen.getByLabelText('Primo indirizzo')).toHaveValue('192.168.20.100');
    expect(screen.getByLabelText('Ultimo indirizzo')).toHaveValue('192.168.20.199');

    fireEvent.click(screen.getByRole('button', { name: /^DHCP/ }));
    const leases = screen.getByRole('region', { name: 'Indirizzi assegnati' });
    expect(leases).toHaveTextContent('192.168.20.100');
    expect(leases).toHaveTextContent('Portatile-1');
    expect(leases).toHaveTextContent('192.168.20.101');
    expect(leases).toHaveTextContent('Portatile-2');
  });

  it('the same tick is on the card of a server', () => {
    openInspector('Srv-Auth');
    fireEvent.click(screen.getByRole('button', { name: /^Schede di rete/ }));
    fireEvent.click(screen.getByText('eth0', { selector: '.nic-name' }));
    expect(screen.getByLabelText(/^Server DHCP Abilitato/)).not.toBeChecked();
  });

  it('on the drawing a leased address is followed by the word it names', () => {
    const { devices, connections } = useNetworkStore.getState();
    const dhcp = resolveDhcp({ devices, connections });
    expect(shownAddress(device('Portatile-1'), dhcp)).toBe('192.168.20.100 · DHCP');
    expect(shownAddress(device('PC-Vendite'), dhcp)).toBe('192.168.10.12');
  });

  it('the sample of the welcome screen is made the way the step says', () => {
    expect(step(TITLE)).toContain(
      'Nella rete di esempio della schermata iniziale i due portatili prendono l\'indirizzo così, da Router-Core.'
    );
    const { devices, connections } = useNetworkStore.getState();
    const dhcp = resolveDhcp({ devices, connections });
    const label = (id: string) => devices.find(d => d.id === id)?.label;
    expect(dhcp.leases.map(lease => [label(lease.deviceId), label(lease.server.deviceId)])).toEqual([
      ['Portatile-1', 'Router-Core'],
      ['Portatile-2', 'Router-Core'],
    ]);
    expect(dhcp.unserved).toEqual([]);
  });

  it('says what is not simulated', () => {
    const text = step(TITLE);
    expect(text).toContain('il relay non è simulato, e nemmeno le prenotazioni e le scadenze');
  });
});
