/**
 * The cable in the window of a link: «Mezzo», «Lunghezza» with its unit,
 * «Ritardo (ms)», and «Ritardo in un verso», the time the engine works out as
 * the fields are typed. What is wrong is said under its field, and nothing is
 * saved until it is right. Against the real stores, with the samples.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { useUIStore } from '@/store/uiStore';
import { useNetworkStore } from '@/store/networkStore';
import { setLanguage } from '@/i18n';
import { createSampleTopology } from '@/utils/sampleTopology';
import { createCompanySample } from '@/utils/sampleCompany';
import type { SampleNetwork } from '@/utils/sampleNetwork';
import type { NetworkConnection } from '@/types';
import ConnectionInspectorModal from './ConnectionInspectorModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function load(sample: () => SampleNetwork) {
  const store = useNetworkStore.getState();
  store.clearAllDevices();
  store.loadSample(sample());
}

/** The (live) link between two devices, by their names */
function linkBetween(a: string, b: string): NetworkConnection {
  const { devices, connections } = useNetworkStore.getState();
  const id = (label: string) => devices.find((d) => d.label === label)!.id;
  const found = connections.find(
    (c) => (c.source === id(a) && c.target === id(b)) || (c.source === id(b) && c.target === id(a))
  );
  if (!found) throw new Error(`no link ${a} – ${b}`);
  return found;
}

function open(a: string, b: string) {
  useUIStore.getState().setInspectorConnection(linkBetween(a, b));
  useUIStore.getState().openModal('connectionInspector');
  render(<ConnectionInspectorModal />);
}

const field = (label: string) => screen.getByLabelText<HTMLInputElement | HTMLSelectElement>(label);
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
/** What the read-only line says */
const oneWay = (label = 'Ritardo in un verso') => screen.getByRole('status', { name: label }).textContent;
const save = (name = 'Salva') => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  localStorage.clear();
  setLanguage('it');
  load(createSampleTopology);
  useUIStore.getState().closeModal('connectionInspector');
  useUIStore.getState().setInspectorConnection(null);
});

afterEach(() => setLanguage('it'));

describe('the cable in the window of a link', () => {
  it('a link nobody set: automatic medium, no length, no delay, copper and no time', () => {
    open('PC-1', 'SW-Office');
    expect(field('Mezzo').value).toBe('');
    expect((field('Mezzo') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Automatico');
    expect(field('Lunghezza').value).toBe('');
    expect(field('Unità').value).toBe('m');
    expect(field('Ritardo (ms)').value).toBe('');
    expect(oneWay()).toBe('0,00 ms: rame (automatico)');
  });

  it('offers «Automatico» first, then the seven media', () => {
    open('PC-1', 'SW-Office');
    const options = Array.from((field('Mezzo') as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual([
      'Automatico',
      'Rame (Ethernet)',
      'Fibra ottica',
      'Wi-Fi',
      'DSL verso il provider',
      'Fibra verso il provider (FTTH)',
      'Rete mobile 4G/5G',
      'Satellite (geostazionario)',
    ]);
  });

  it('works the time out as it is typed, and saves medium and length in metres', () => {
    open('Router-1', 'SW-Servers');
    type('Mezzo', 'fibre');
    type('Lunghezza', '600');
    type('Unità', 'km');
    expect(oneWay()).toBe('3,0 ms: fibra, 600 km');
    save();
    expect(linkBetween('Router-1', 'SW-Servers')).toMatchObject({ medium: 'fibre', lengthM: 600_000 });
    expect(linkBetween('Router-1', 'SW-Servers').delayMs).toBeUndefined();
    expect(useUIStore.getState().modals.connectionInspector).toBe(false);
  });

  it('a delay written by hand takes the place of medium and length, with a decimal comma', () => {
    open('Router-1', 'SW-Servers');
    type('Mezzo', 'dsl');
    type('Ritardo (ms)', '7,5');
    expect(oneWay()).toBe('7,5 ms: scritto a mano');
    save();
    expect(linkBetween('Router-1', 'SW-Servers')).toMatchObject({ medium: 'dsl', delayMs: 7.5 });
  });

  it('shows what was saved: a length of a km or more in km, the delay with a comma', () => {
    useNetworkStore.getState().updateConnection(linkBetween('Router-1', 'SW-Servers').id, {
      medium: 'fibre',
      lengthM: 1500,
      delayMs: 0.25,
    });
    open('Router-1', 'SW-Servers');
    expect(field('Mezzo').value).toBe('fibre');
    expect(field('Lunghezza').value).toBe('1,5');
    expect(field('Unità').value).toBe('km');
    expect(field('Ritardo (ms)').value).toBe('0,25');
    expect(oneWay()).toBe('0,25 ms: scritto a mano');
  });

  it('a laptop on its access point is on Wi-Fi without being told', () => {
    load(createCompanySample);
    open('Portatile-1', 'AP-Uffici');
    expect(oneWay()).toBe('1,5 ms: Wi-Fi (automatico)');
  });

  it('says under the field what is wrong, and saves nothing until it is right', () => {
    open('Router-1', 'SW-Servers');
    const before = useNetworkStore.getState().connections;

    type('Lunghezza', 'lontano');
    expect(screen.getByText('Scrivi un numero maggiore di 0, come 600 o 0,5')).toBeInTheDocument();
    type('Lunghezza', '0');
    expect(screen.getByText('Scrivi un numero maggiore di 0, come 600 o 0,5')).toBeInTheDocument();
    type('Lunghezza', '50000');
    type('Unità', 'km');
    expect(screen.getByText('Un cavo è lungo al massimo 40.000 km')).toBeInTheDocument();
    type('Ritardo (ms)', 'subito');
    expect(screen.getByText('Scrivi i millisecondi con un numero, come 7 o 0,5')).toBeInTheDocument();
    type('Ritardo (ms)', '20000');
    expect(screen.getByText('Un ritardo scritto a mano è al massimo di 10.000 ms')).toBeInTheDocument();

    save();
    expect(useNetworkStore.getState().connections).toBe(before);
    expect(useUIStore.getState().modals.connectionInspector).toBe(true);

    type('Lunghezza', '50');
    type('Ritardo (ms)', '');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    save();
    expect(linkBetween('Router-1', 'SW-Servers').lengthM).toBe(50_000);
  });

  it('«Automatico» and empty fields take medium, length and delay away', () => {
    useNetworkStore.getState().updateConnection(linkBetween('Router-1', 'SW-Servers').id, {
      medium: 'satellite',
      lengthM: 80,
      delayMs: 3,
    });
    open('Router-1', 'SW-Servers');
    type('Mezzo', '');
    type('Lunghezza', '');
    type('Ritardo (ms)', '');
    expect(oneWay()).toBe('0,00 ms: rame (automatico)');
    save();
    const link = linkBetween('Router-1', 'SW-Servers');
    expect(link.medium).toBeUndefined();
    expect(link.lengthM).toBeUndefined();
    expect(link.delayMs).toBeUndefined();
    // and the file has none of them
    expect(JSON.stringify(link)).not.toMatch(/medium|lengthM|delayMs/);
  });

  it('cancelling keeps the cable as it was', () => {
    open('Router-1', 'SW-Servers');
    const before = useNetworkStore.getState().connections;
    type('Mezzo', 'satellite');
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(useNetworkStore.getState().connections).toBe(before);
  });

  it('speaks English with a decimal point', () => {
    setLanguage('en');
    open('Router-1', 'SW-Servers');
    const group = screen.getByRole('group', { name: 'Cable' });
    expect(within(group).getByLabelText('Medium')).toBeInTheDocument();
    type('Medium', 'fibre');
    type('Length', '0.5');
    type('Unit', 'km');
    expect(oneWay('One-way delay')).toBe('0.00 ms: fibre, 500 m');
    type('Delay (ms)', '7');
    expect(oneWay('One-way delay')).toBe('7.0 ms: written by hand');
    save('Save');
    expect(linkBetween('Router-1', 'SW-Servers')).toMatchObject({ medium: 'fibre', lengthM: 500, delayMs: 7 });
    cleanup();
  });
});
