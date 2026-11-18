/**
 * ImportExportModal tests — the export formats. YAML is the one that can be
 * loaded back, so it comes first; the Terraform export is a sketch that
 * cannot be applied, and says so whenever it is the one on screen.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { answerConfirms } from '@/test/confirm';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { resolveDhcp } from '@/engine';
import ImportExportModal from './ImportExportModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const WARNING = /non si può applicare con Terraform/;

const format = () => screen.getByLabelText('Formato:') as HTMLSelectElement;
const choose = (value: string) => fireEvent.change(format(), { target: { value } });
const preview = () => document.querySelector('pre')?.textContent ?? '';

describe('ImportExportModal — export formats', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useNetworkStore.getState().addDevice({
      type: 'PC',
      label: 'PC-1',
      ip: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      position: { x: 0, y: 0 },
    });
    useUIStore.setState(state => ({ modals: { ...state.modals, importExport: true } }));
    vi.clearAllMocks();
  });

  it('opens on YAML, with no warning', () => {
    render(<ImportExportModal />);

    expect(format().value).toBe('yaml');
    expect(preview()).toContain('PC-1');
    expect(preview()).not.toContain('resource "');
    expect(screen.getByRole('button', { name: /Scarica .*\.yaml$/ })).toBeInTheDocument();
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('offers Terraform as a draft, after YAML', () => {
    render(<ImportExportModal />);

    expect(Array.from(format().options).map(option => [option.value, option.text])).toEqual([
      ['yaml', 'YAML (.yaml)'],
      ['terraform', 'Terraform HCL (bozza)'],
    ]);
  });

  it('warns that the Terraform draft cannot be applied, only while it is selected', () => {
    render(<ImportExportModal />);

    choose('terraform');
    expect(preview()).toContain('resource "compute_instance" "pc_1"');
    expect(screen.getByRole('button', { name: /Scarica .*\.tf$/ })).toBeInTheDocument();
    const warning = screen.getByRole('note');
    expect(warning).toHaveClass('modal-info-box');
    expect(warning).toHaveTextContent(WARNING);
    expect(warning).toHaveTextContent('È una bozza');

    choose('yaml');
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('shows the warning on an empty canvas too', () => {
    useNetworkStore.getState().removeDevice('dev-0');
    render(<ImportExportModal />);

    expect(screen.queryByRole('note')).toBeNull();
    choose('terraform');
    expect(screen.getByRole('note')).toHaveTextContent(WARNING);
  });

  it('never shows it on the import tab', () => {
    render(<ImportExportModal />);
    choose('terraform');

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('ImportExportModal — the buttons at the bottom', () => {
  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useUIStore.setState(state => ({ modals: { ...state.modals, importExport: true } }));
  });

  it.each([
    ['export', /^Copia negli appunti$/],
    ['export', /^Scarica .*\.yaml$/],
    ['import', /^Importa$/],
  ])('on the %s tab, %s has its icon on the line of its label', (tabName, name) => {
    render(<ImportExportModal />);
    if (tabName === 'import') fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const button = screen.getByRole('button', { name });
    const icon = button.querySelector('svg');

    expect(button.closest('.modal-actions')).not.toBeNull();
    expect(icon).not.toBeNull();
    // the row is the button's doing (see Button.test.tsx): icon and label are
    // its two children, and the icon carries no layout of its own
    expect(button.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['inline-flex', 'items-center', 'gap-1'])
    );
    expect(icon?.parentElement).toBe(button);
    expect(icon?.getAttribute('style')).toBeNull();
  });

  it('the X at the top has a name, as in every other window, and closes the window', () => {
    render(<ImportExportModal />);
    const close = screen.getByRole('button', { name: 'Chiudi la finestra' });
    expect(close).toHaveAttribute('type', 'button');
    expect(close.closest('.modal-header')).not.toBeNull();

    fireEvent.click(close);
    expect(useUIStore.getState().modals.importExport).toBe(false);
  });
});

describe('ImportExportModal — importing a YAML file', () => {
  const YAML_FILE = [
    'pixelcake:',
    '  devices:',
    '    - name: FW',
    '      type: Firewall',
    '      ports:',
    '        - id: 1',
    '          ip: 192.168.50.1',
    '          subnet: 255.255.255.0',
    '          dhcp_server:',
    '            start: 192.168.50.100',
    '            end: 192.168.50.110',
    '        - id: 2',
    '          ip: 203.0.113.2',
    '          nat: true',
    '      routes:',
    '        - destination: 10.0.0.0/8',
    '          via: 192.168.50.254',
    '      firewall_rules:',
    '        - action: allow',
    '          service: web',
    '          from: any',
    '          to: 192.168.50.20',
    '      port_forwards:',
    '        - service: web',
    '          interface: 2',
    '          to: 192.168.50.20',
    '    - name: Portatile',
    '      type: PC',
    '      nics:',
    '        - name: eth0',
    '          dhcp: true',
    '    - name: NS',
    '      type: Server',
    '      nics:',
    '        - name: eth0',
    '          ip: 192.168.50.53',
    '          dns: 192.168.50.53',
    '      dns_records:',
    '        - name: www.azienda.example',
    '          address: 192.168.50.20',
    '  connections:',
    '    - source: Portatile',
    '      target: FW',
    '      source_nic: eth0',
    '      target_port: 1',
  ].join('\n');

  const devices = () => useNetworkStore.getState().devices;
  const named = (label: string) => devices().find(d => d.label === label);

  /** Open the import tab and hand it the file, as choosing it in the file dialog does */
  async function chooseFile() {
    render(<ImportExportModal />);
    fireEvent.click(screen.getByRole('button', { name: /Import$/ }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input');
    const file = new File([YAML_FILE], 'rete.yaml', { type: 'text/yaml' });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText('Dispositivi trovati');
  }

  beforeEach(() => {
    localStorage.clear();
    createNewProject({ name: 'Sede Milano' });
    useNetworkStore.getState().addDevice({
      type: 'PC',
      label: 'PC-1',
      ip: '192.168.1.10',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      position: { x: 0, y: 0 },
    });
    useUIStore.setState(state => ({ modals: { ...state.modals, importExport: true } }));
    vi.clearAllMocks();
  });

  it('lists what it found: a device on DHCP says so in place of an address', async () => {
    await chooseFile();
    const rows = Array.from(document.querySelectorAll('.settings-content span'))
      .map(span => span.textContent)
      .filter(Boolean);
    expect(rows).toEqual(expect.arrayContaining(['FW', 'Firewall', 'Portatile', 'PC', 'DHCP']));
  });

  it('replacing the drawing keeps routes, rules, forwards, DHCP and DNS', async () => {
    // (the board has a device: replacing asks first)
    answerConfirms(true);
    await chooseFile();
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }));
    await waitFor(() => expect(devices().map(d => d.label)).toEqual(['FW', 'Portatile', 'NS']));
    expect(named('FW')).toMatchObject({
      routes: [{ destination: '10.0.0.0/8', nextHop: '192.168.50.254' }],
      firewallRules: [{ action: 'allow', service: 'web', destination: '192.168.50.20' }],
      portForwards: [{ service: 'web', port: 2, to: '192.168.50.20' }],
    });
    expect(named('FW')?.ports?.[0].dhcpServer).toEqual({ start: '192.168.50.100', end: '192.168.50.110' });
    expect(named('Portatile')?.nics?.[0]).toMatchObject({ dhcp: true, ip: '' });
    expect(named('NS')?.dnsRecords).toEqual([
      { id: 'record-1', name: 'www.azienda.example', address: '192.168.50.20' },
    ]);
    expect(named('NS')?.nics?.[0].dns).toBe('192.168.50.53');
  });

  it('adding to the drawing keeps them too', async () => {
    await chooseFile();
    fireEvent.click(screen.getByLabelText('Aggiungi alla topologia'));
    fireEvent.click(screen.getByRole('button', { name: 'Importa' }));
    expect(devices().map(d => d.label)).toEqual(['PC-1', 'FW', 'Portatile', 'NS']);
    expect(named('FW')).toMatchObject({
      routes: [{ destination: '10.0.0.0/8', nextHop: '192.168.50.254' }],
      firewallRules: [{ action: 'allow', service: 'web', destination: '192.168.50.20' }],
      portForwards: [{ service: 'web', port: 2, to: '192.168.50.20' }],
    });
    expect(named('FW')?.ports?.[0].dhcpServer).toEqual({ start: '192.168.50.100', end: '192.168.50.110' });
    expect(named('FW')?.ports?.[1].nat).toBe(true);
    expect(named('Portatile')?.nics?.[0]).toMatchObject({ dhcp: true, ip: '' });
    expect(named('NS')?.dnsRecords).toEqual([
      { id: 'record-1', name: 'www.azienda.example', address: '192.168.50.20' },
    ]);
    expect(named('NS')?.nics?.[0].dns).toBe('192.168.50.53');
    // the cable came with its two ends, so the laptop is served at once
    const { connections } = useNetworkStore.getState();
    expect(resolveDhcp({ devices: devices(), connections }).leases.map(lease => lease.ip)).toEqual([
      '192.168.50.100',
    ]);
  });
});
