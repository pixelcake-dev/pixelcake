/**
 * The guide and the two entries of Vista that rearrange the drawing tell the
 * same story: the names it puts in quotes are those of the menu, in both
 * languages, and what it says they do is what they do.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { setLanguage } from '@/i18n';
import { answerConfirms, settled } from '@/test/confirm';
import { device, host, nic, port, switchWith } from '@/test/networkFixtures';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import HelpModal from './HelpModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const ui = () => useUIStore.getState();
const store = () => useNetworkStore.getState();
/** (the store gives the devices of a loaded drawing ids of its own: they go by their names) */
const named = (label: string) => store().devices.find((one) => one.label === label);
const labelOf = (id: string) => store().devices.find((one) => one.id === id)?.label;

/** The text of one step of the guide, by its title */
function step(title: string): string {
  ui().openHelp('guide');
  render(<HelpModal />);
  const text = (screen.getByText(title).closest('li')?.textContent ?? '').replace(/\s+/g, ' ');
  cleanup();
  ui().closeModal('help');
  return text;
}

const quotedIt = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((match) => match[1]);
const quotedEn = (text: string) => [...text.matchAll(/“([^”]+)”/g)].map((match) => match[1]);

/** The Internet, a firewall, a switch and a PC in a row, drawn the wrong way up */
function chain() {
  const ports = (count: number) => Array.from({ length: count }, (_, index) => port(index + 1));
  store().loadTopology(
    [
      host('PC-1', '10.0.0.11', '10.0.0.1', { position: { x: 0, y: 0 } }),
      switchWith('SW-1', ports(8), { ip: '10.0.0.2', position: { x: 0, y: 150 } }),
      device({ id: 'FW-1', type: 'Firewall', ip: '10.0.0.1', position: { x: 0, y: 300 }, ports: ports(4) }),
      device({ id: 'Internet', type: 'Cloud', position: { x: 0, y: 450 }, nics: [nic()] }),
    ],
    [
      { id: 'c1', source: 'PC-1', target: 'SW-1' },
      { id: 'c2', source: 'SW-1', target: 'FW-1' },
      { id: 'c3', source: 'FW-1', target: 'Internet' },
    ]
  );
}

beforeEach(() => {
  localStorage.clear();
  createNewProject({ name: 'Ufficio' });
  useUIStore.setState({ showWelcomeScreen: false });
});

afterEach(() => {
  act(() => setLanguage('it'));
});

describe('the guide — the automatic layout', () => {
  it('names the entries of Vista as the menu shows them', () => {
    expect(quotedIt(step('Spostali e selezionali'))).toEqual(['Disposizione automatica', 'Verticale', 'Orizzontale']);
    render(<TopMenuBar />);
    for (const name of ['Disposizione automatica', 'Verticale', 'Orizzontale']) expect(screen.getByText(name)).toBeInTheDocument();
  });

  it('on top what the traffic leaves through, a level for each cable; and it asks first', async () => {
    expect(step('Spostali e selezionali')).toContain(
      'in cima ciò da cui il traffico esce dalla rete (Internet, se no il firewall, se no il router), sotto un livello per ogni cavo'
    );
    expect(step('Spostali e selezionali')).toContain('Prima chiede conferma: sposta ogni dispositivo e non si può annullare.');
    chain();
    const answers = answerConfirms(true);
    render(<TopMenuBar />);
    fireEvent.click(screen.getByText('Verticale'));
    await settled();
    expect(answers.asked).toHaveLength(1);
    const y = (label: string) => named(label)?.position.y ?? Number.NaN;
    expect(y('Internet')).toBeLessThan(y('FW-1'));
    expect(y('FW-1')).toBeLessThan(y('SW-1'));
    expect(y('SW-1')).toBeLessThan(y('PC-1'));
  });

  it('in English too', () => {
    act(() => setLanguage('en'));
    expect(quotedEn(step('Move and select them'))).toEqual(['Auto-layout', 'Vertical', 'Horizontal']);
    render(<TopMenuBar />);
    for (const name of ['Auto-layout', 'Vertical', 'Horizontal']) expect(screen.getByText(name)).toBeInTheDocument();
  });
});

describe('the guide — the automatic connection', () => {
  it('names the entry of Vista as the menu shows it', () => {
    expect(quotedIt(step('Collegali'))).toEqual(['Modifica connessione', 'Collega i dispositivi senza cavo']);
    render(<TopMenuBar />);
    expect(screen.getByText('Collega i dispositivi senza cavo')).toBeInTheDocument();
  });

  it('a cable for each device that has none, to the switch of its network; routers by hand', () => {
    expect(step('Collegali')).toContain('dà un cavo a ogni dispositivo che non ne ha: allo switch più vicino della sua rete');
    expect(step('Collegali')).toContain('Router, firewall e Internet si collegano a mano.');
    chain();
    // the PC and the Internet lose their cables: the PC gets one back, the Internet stays as it is
    for (const label of ['PC-1', 'Internet']) {
      const id = named(label)?.id;
      for (const one of store().connections.filter((cable) => cable.source === id || cable.target === id)) {
        store().removeConnection(one.id);
      }
    }
    render(<TopMenuBar />);
    fireEvent.click(screen.getByText('Collega i dispositivi senza cavo'));
    const cables = store().connections.map((one) => `${labelOf(one.source)}>${labelOf(one.target)}`);
    expect(cables.sort()).toEqual(['SW-1>FW-1', 'SW-1>PC-1']);
  });

  it('in English too', () => {
    act(() => setLanguage('en'));
    expect(quotedEn(step('Connect them'))).toEqual(['Edit link', 'Connect devices with no cable']);
    render(<TopMenuBar />);
    expect(screen.getByText('Connect devices with no cable')).toBeInTheDocument();
  });
});
