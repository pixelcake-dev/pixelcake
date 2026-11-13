/**
 * The guide and address translation tell the same story: every name the
 * step puts in «quotes» is on a control of the device window, and the sample
 * it points at is made the way it says.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { isPrivateAddress, isPublicInternet } from '@/engine';
import HelpModal from './HelpModal';
import InspectorModal from './InspectorModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const TITLE = 'Esci su Internet con il NAT';
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

describe('the guide — NAT', () => {
  it('has the step, after the firewall and before asking questions', () => {
    ui().openHelp('guide');
    render(<HelpModal />);
    // (the title of a step is the first paragraph of its item)
    const titles = Array.from(document.querySelectorAll('li')).map(li => li.querySelector('p')?.textContent);
    expect(titles).toContain(TITLE);
    const at = (title: string) => titles.indexOf(title);
    expect(at(TITLE)).toBeGreaterThan(at('Filtra con il firewall'));
    expect(at(TITLE)).toBeLessThan(at('Chiedi se un dispositivo ne raggiunge un altro'));
  });

  it('names what is on the screen', () => {
    expect(quoted(step(TITLE))).toEqual(['Internet', 'Porte', 'NAT Abilitato', 'NAT', 'Aggiungi inoltro', 'Regole']);
  });

  it('the tabs it names are those of a firewall', () => {
    openInspector('FW-Edge');
    for (const tab of ['Porte', 'NAT', 'Regole']) expect(tabNames(), tab).toContain(tab);
  });

  it('the option it names is on a port, the button it names is in the NAT tab', () => {
    openInspector('FW-Edge');
    fireEvent.click(screen.getByRole('button', { name: /^Porte/ }));
    fireEvent.click(screen.getByText('3'));
    expect(screen.getByLabelText(/^NAT Abilitato/)).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /^NAT/ }));
    expect(screen.getByRole('button', { name: 'Aggiungi inoltro' })).toBeEnabled();
  });

  it('the symbol it names is the one that refuses private addresses, and the ranges are the ones it lists', () => {
    expect(isPublicInternet(device('Internet'))).toBe(true);
    const text = step(TITLE);
    expect(text).toContain('10.x, 172.16-31.x, 192.168.x');
    for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.254', '192.168.1.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['172.15.0.1', '172.32.0.1', '11.0.0.1']) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('the sample of the welcome screen is made the way the step says', () => {
    expect(step(TITLE)).toContain('La rete di esempio della schermata iniziale è fatta così.');
    const firewall = device('FW-Edge');
    const facing = firewall.ports?.find(p => p.nat);
    expect(facing?.name).toBe('Internet');
    expect(firewall.portForwards?.length).toBeGreaterThan(0);
    // for each forward, the rule that lets it in
    for (const forward of firewall.portForwards ?? []) {
      expect(
        firewall.firewallRules?.some(r => r.action === 'allow' && r.destination === forward.to),
        forward.id
      ).toBe(true);
    }
  });
});
