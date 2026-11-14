/**
 * The guide and DNS tell the same story: every name the step puts in
 * «quotes» is on a control of the device window, every command it shows does
 * what it says, and the sample it points at is made the way it says.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createCompanySample } from '@/utils/sampleCompany';
import { dnsCardOf, withLeases } from '@/engine';
import { executeCommand } from '@/terminal/executor';
import { answerConfirms, settled } from '@/test/confirm';
import HelpModal from './HelpModal';
import InspectorModal from './InspectorModal';
import SettingsModal from './SettingsModal';
import AddDeviceModal from './AddDeviceModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const TITLE = 'Chiama i dispositivi per nome con il DNS';
const ui = () => useUIStore.getState();
const device = (label: string) => {
  const found = useNetworkStore.getState().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found;
};

/** One step of the guide, by its title: its text, and what it shows to type */
function step(title: string): { text: string; typed: string[] } {
  ui().openHelp('guide');
  render(<HelpModal />);
  const item = screen.getByText(title).closest('li');
  const result = {
    text: item?.textContent ?? '',
    typed: Array.from(item?.querySelectorAll('code') ?? []).map(code => code.textContent ?? ''),
  };
  cleanup();
  ui().closeModal('help');
  return result;
}

/** What a step puts in «quotes»: the names of controls */
const quoted = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map(match => match[1].replace(/\s+/g, ' '));

function openInspector(label: string) {
  cleanup();
  ui().setInspectorDevice(device(label));
  ui().openModal('inspector');
  render(<InspectorModal />);
}

const tabNames = () =>
  Array.from(document.querySelectorAll('.tab-header')).map(tab => (tab.textContent ?? '').replace(/ \(\d+\)$/, ''));

/** Everything a terminal command ends up printing */
function printed(command: string): string[] {
  const result = executeCommand(command, { deviceLabel: null });
  const live = result.liveTrace;
  return [
    ...result.lines,
    ...(live ? [...(live.lookup?.lines ?? []), ...live.hopLines, ...live.finalLines] : []),
  ].map(line => line.text);
}

beforeEach(() => {
  localStorage.clear();
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  const sample = createCompanySample();
  store.loadTopology(sample.devices, sample.connections);
  ui().closeModal('inspector');
});

describe('the guide — DNS', () => {
  it('has the step, after DHCP and before asking questions', () => {
    ui().openHelp('guide');
    render(<HelpModal />);
    // (the title of a step is the first paragraph of its item)
    const titles = Array.from(document.querySelectorAll('li')).map(li => li.querySelector('p')?.textContent);
    const at = (title: string) => titles.indexOf(title);
    expect(at(TITLE)).toBeGreaterThan(at('Dai gli indirizzi con il DHCP'));
    expect(at(TITLE)).toBeLessThan(at('Chiedi se un dispositivo ne raggiunge un altro'));
  });

  it('names what is on the screen', () => {
    expect(quoted(step(TITLE).text)).toEqual([
      'DNS',
      'Aggiungi record',
      'Schede di rete',
      'Server DNS',
      'Server DNS Predefinito',
      'Server DNS consegnato (facoltativo)',
      'DNS',
    ]);
  });

  it('the server has the tab and the button it names, with the three names of the sample', () => {
    openInspector('Srv-Auth');
    expect(tabNames()).toContain('DNS');
    fireEvent.click(screen.getByRole('button', { name: 'DNS (3)' }));
    expect(screen.getByRole('button', { name: 'Aggiungi record' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome del record 1')).toHaveValue('gestionale.azienda.example');
    expect(screen.getByLabelText('Indirizzo del record 1')).toHaveValue('192.168.30.30');
    expect(screen.getByLabelText('Nome del record 3')).toHaveValue('portale.azienda.example');
  });

  it('the card of a PC has the field it names, with the address of the server', () => {
    openInspector('PC-Vendite');
    expect(tabNames()).toContain('Schede di rete');
    fireEvent.click(screen.getByRole('button', { name: /^Schede di rete/ }));
    fireEvent.click(screen.getByText('eth0', { selector: '.nic-name' }));
    expect(screen.getByLabelText('Server DNS')).toHaveValue('192.168.30.10');
    expect(device('Srv-Auth').nics?.[0].ip).toBe('192.168.30.10');
  });

  it('the DHCP server of the router has the field it names, and the laptop shows what it was handed', () => {
    openInspector('Router-Core');
    fireEvent.click(screen.getByRole('button', { name: /^Porte/ }));
    fireEvent.click(screen.getByText('2', { selector: '.port-number' }));
    expect(screen.getByLabelText('Server DNS consegnato (facoltativo)')).toHaveValue('192.168.30.10');

    openInspector('Portatile-1');
    fireEvent.click(screen.getByRole('button', { name: /^Schede di rete/ }));
    fireEvent.click(screen.getByText('eth0', { selector: '.nic-name' }));
    expect(screen.getByTestId('nic-lease')).toHaveTextContent('server DNS 192.168.30.10');
    expect(screen.queryByLabelText('Server DNS')).not.toBeInTheDocument();
  });

  it('the settings have the field it names: saved, new devices start with it and it is offered to those that have none', async () => {
    expect(step(TITLE).text).toContain(
      'in Impostazioni → Rete c\'è «Server DNS Predefinito»: i nuovi dispositivi nascono con quello sulla scheda e, una volta salvato, lì sotto si può assegnarlo anche ai dispositivi del canvas che non ne hanno uno.'
    );
    cleanup();
    ui().openModal('settings');
    const settings = render(<SettingsModal />);
    // Rete is the tab the settings open on
    expect(screen.getByText('Impostazioni di Rete Globali')).toBeInTheDocument();
    const field = screen.getByLabelText('Server DNS Predefinito');
    // not saved yet: nothing is offered
    expect(screen.queryByRole('button', { name: /^Assegna/ })).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: '192.168.30.10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva le Impostazioni di Rete' }));

    // under it, in the same group: the devices of the sample that ask nobody
    const offer = screen.getByRole('button', { name: 'Assegna 192.168.30.10' });
    expect(field.closest('fieldset')).toContainElement(offer);
    expect(field.compareDocumentPosition(offer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    answerConfirms(true);
    fireEvent.click(offer);
    await settled();
    expect(device('Cliente-Remoto').nics?.[0].dns).toBe('192.168.30.10');
    expect(device('Portatile-1').nics?.[0].dns).toBeUndefined();
    settings.unmount();
    ui().closeModal('settings');

    // a new device
    ui().setAddDeviceType('PC', 'tpl-pc');
    ui().openModal('addDevice');
    render(<AddDeviceModal />);
    expect(screen.getByLabelText('Server DNS')).toHaveValue('192.168.30.10');
    cleanup();
    ui().closeModal('addDevice');
  });

  it('the rules and the forwards of the firewall offer the service it names', () => {
    openInspector('FW-Edge');
    fireEvent.click(screen.getByRole('button', { name: /^Regole/ }));
    const ofRule = screen.getByLabelText<HTMLSelectElement>('Servizio della regola 1');
    expect(Array.from(ofRule.options).map(option => option.textContent)).toContain('DNS');
    fireEvent.click(screen.getByRole('button', { name: /^NAT/ }));
    const ofForward = screen.getByLabelText<HTMLSelectElement>('Servizio dell\'inoltro 1');
    expect(Array.from(ofForward.options).map(option => option.textContent)).toContain('DNS');
  });

  it('the commands it shows do what it says', () => {
    const { typed } = step(TITLE);
    expect(typed).toEqual([
      'gestionale.azienda.example',
      'ping gestionale.azienda.example from PC-Vendite',
      'resolve gestionale.azienda.example from PC-Vendite',
    ]);
    // the ping asks first, then pings
    expect(printed(typed[1])).toEqual([
      'Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...',
      '  ✓ DNS request: PC-Vendite → Srv-Auth',
      '  ✓ DNS reply: Srv-Auth → PC-Vendite',
      'gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)',
      'Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...',
      'Reply from 192.168.30.30: hops=6 time=9ms',
    ]);
    // resolve only asks
    expect(printed(typed[2])).toEqual(printed(typed[1]).slice(0, 4));
  });

  it('the sample of the welcome screen is made the way the step says', () => {
    expect(step(TITLE).text).toContain(
      'Nella rete di esempio della schermata di benvenuto Srv-Auth conosce tre nomi, gli uffici e i portatili chiedono a lui, e Cliente-Remoto non ha nessuno a cui chiedere.'
    );
    expect(device('Srv-Auth').dnsRecords).toHaveLength(3);
    const { devices, connections } = useNetworkStore.getState();
    const asking = withLeases({ devices, connections }).devices.filter(d => dnsCardOf(d) !== undefined);
    expect(asking.map(d => d.label)).toEqual(['PC-Contabilità', 'PC-Vendite', 'Stampante', 'Portatile-1', 'Portatile-2']);
    expect(asking.every(d => dnsCardOf(d)?.dns === '192.168.30.10')).toBe(true);
    expect(printed('resolve portale.azienda.example from Cliente-Remoto')).toEqual([
      'Looking up portale.azienda.example from Cliente-Remoto...',
      'Lookup failed: Cliente-Remoto has no DNS server: it cannot look up portale.azienda.example',
    ]);
  });

  it('says what is not simulated, and that nothing is remembered', () => {
    const { text } = step(TITLE);
    expect(text).toContain('Nulla viene ricordato: il nome viene chiesto di nuovo ogni volta.');
    expect(text).toContain(
      'Non sono simulati un secondo server DNS di riserva, l\'inoltro ad altri server e la ricerca inversa'
    );
    expect(text).toContain('la simulazione e la presentazione scelgono i dispositivi dai menu e non usano i nomi');
  });

  it('the step on the firewall names the service too', () => {
    expect(step('Filtra con il firewall').text).toContain('per servizio (ping, web, email, DNS), partenza e destinazione');
  });
});
