/**
 * The guide and the names of the VLANs tell the same story: every name the
 * step puts in «quotes» is on the screen, and doing what it says on the
 * sample of the welcome screen shows what it says.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { executeCommand } from '@/terminal/executor';
import HelpModal from './HelpModal';
import InspectorModal from './InspectorModal';
import SettingsModal from './SettingsModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const TITLE = 'Separa con le VLAN';
const ui = () => useUIStore.getState();
const device = (label: string) => {
  const found = useNetworkStore.getState().devices.find((d) => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

/** The text of one step of the guide, by its title */
function step(title: string): string {
  ui().openHelp('guide');
  render(<HelpModal />);
  const text = (screen.getByText(title).closest('li')?.textContent ?? '').replace(/\s+/g, ' ');
  cleanup();
  ui().closeModal('help');
  return text;
}

/** What a step puts in «quotes» */
const quoted = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((match) => match[1]);

function openInspector(label: string) {
  cleanup();
  ui().setInspectorDevice(device(label));
  ui().openModal('inspector');
  render(<InspectorModal />);
}

/** Impostazioni → Rete: give VLAN 10 the name of the guide, and save */
function nameVlan10() {
  ui().openModal('settings');
  render(<SettingsModal />);
  const group = screen.getByRole('group', { name: 'VLAN del progetto' });
  fireEvent.change(within(group).getByLabelText('Nome della VLAN 10'), { target: { value: 'Uffici' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva le impostazioni di rete' }));
  cleanup();
  ui().closeModal('settings');
}

beforeEach(() => {
  localStorage.clear();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  store.setGlobalNetworkSettings({ vlans: undefined });
  const sample = createCompanySample();
  store.loadTopology(sample.devices, sample.connections);
  ui().closeModal('inspector');
  ui().closeModal('settings');
});

describe('the guide — the names of the VLANs', () => {
  it('names what is on the screen', () => {
    expect(quoted(step(TITLE))).toEqual(['Porte', 'VLAN del progetto', 'Aggiungi VLAN', 'Uffici']);
  });

  it('the settings have the group it names, with the VLANs the canvas uses and the button it names', () => {
    expect(step(TITLE)).toContain(
      'in Impostazioni → Rete, sotto «VLAN del progetto», trovi quelle usate sul canvas e scrivi il nome di ciascuna; «Aggiungi VLAN» ne aggiunge un\'altra.'
    );
    ui().openModal('settings');
    render(<SettingsModal />);
    // Rete is the tab the settings open on
    const group = screen.getByRole('group', { name: 'VLAN del progetto' });
    // the offices and the Wi-Fi of the sample, each on its own VLAN
    expect(within(group).getByLabelText('Nome della VLAN 10')).toHaveValue('');
    expect(within(group).getByLabelText('Nome della VLAN 20')).toHaveValue('');
    expect(within(group).getByRole('button', { name: 'Aggiungi VLAN' })).toBeInTheDocument();
  });

  it('once saved, the name is next to the number where it says: on the switch and on its ports', () => {
    expect(step(TITLE)).toContain(
      'Dopo aver salvato, il nome compare accanto al numero, per esempio VLAN 10 «Uffici», nella scheda dello switch e nelle impostazioni delle sue porte.'
    );
    // before: the number alone
    openInspector('SW-Uffici');
    const summaryBefore = within(screen.getByRole('group', { name: 'Porte' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(summaryBefore.some((line) => line.startsWith('VLAN 10:'))).toBe(true);
    expect(document.body.textContent).not.toContain('«Uffici»');

    nameVlan10();
    expect(useNetworkStore.getState().globalNetworkSettings.vlans).toEqual([{ id: 10, name: 'Uffici' }]);

    openInspector('SW-Uffici');
    const summary = within(screen.getByRole('group', { name: 'Porte' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(summary.some((line) => line.startsWith('VLAN 10 «Uffici»:'))).toBe(true);
    expect(summary.some((line) => line.startsWith('Trunk') && line.includes('10 «Uffici»'))).toBe(true);

    // the tab it names, and a port of the offices
    fireEvent.click(screen.getByRole('button', { name: /^Porte/ }));
    const inVlan10 = device('SW-Uffici').ports?.find((port) => port.vlan === 10);
    if (!inVlan10) throw new Error('no access port in VLAN 10 on SW-Uffici');
    fireEvent.click(screen.getByText(String(inVlan10.id), { selector: '.port-number' }));
    expect(screen.getByLabelText('VLAN (singola)')).toHaveValue('10');
    expect(screen.getByTestId('vlan-names')).toHaveTextContent('VLAN 10 «Uffici»');
  });

  it('in the terminal the VLANs stay numbers, as it says', () => {
    expect(step(TITLE)).toContain('Nel terminale le VLAN restano numeri.');
    nameVlan10();
    const printed = executeCommand('show vlans', { deviceLabel: null }).lines.map((line) => line.text);
    // the row of VLAN 10: its number, then where it lives (a switch that happens to be called SW-Uffici)
    const row = printed.find((text) => /^10\s/.test(text));
    expect(row).toMatch(/^10\s+SW-Uffici \(ports /);
    expect(printed.join('\n')).not.toContain('«');
  });
});
