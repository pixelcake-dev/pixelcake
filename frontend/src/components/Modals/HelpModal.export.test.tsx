/**
 * The guide and the picture of the drawing tell the same story: every name
 * the guide puts in «quotes» is on a control of the dialog, and what it says
 * the dialog offers is what it offers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import * as images from '@/utils/imageExport';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import PresentationBar from '@/components/Presentation/PresentationBar';
import ExportImageModal from './ExportImageModal';
import HelpModal from './HelpModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/utils/imageExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/imageExport')>()),
  rasterizeSvg: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  canCopyImage: vi.fn(() => true),
  canChooseWhereToSave: vi.fn(() => true),
}));

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();
const ui = () => useUIStore.getState();
const id = (label: string) => network().devices.find((d) => d.label === label)!.id;

const TITLE = 'Esporta il disegno come immagine';

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
const quoted = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((match) => match[1]);

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  localStorage.clear();
  act(() => presentation().exit());
  ui().closeModal('exportImage');
  vi.mocked(images.canChooseWhereToSave).mockReturnValue(true);
  createNewProject({ name: 'Guida' });
  const sample = createRedundancySample();
  network().loadTopology(sample.devices, sample.connections);
});

afterEach(async () => {
  await settle();
  act(() => {
    presentation().exit();
    ui().closeModal('exportImage');
  });
});

describe(`the guide — "${TITLE}"`, () => {
  it('names controls that exist, where it says they are', async () => {
    const text = step(TITLE);
    expect(quoted(text)).toEqual([
      'Nome del progetto in alto',
      'Sfondo trasparente',
      'Salva PNG…',
      'Scarica PNG',
      'Copia negli appunti',
      'Esporta immagine',
      'Domanda e risposta sotto il disegno',
    ]);

    // "File → Esporta immagine…"
    expect(text).toContain('File → Esporta immagine…');
    render(
      <>
        <TopMenuBar />
        <ExportImageModal />
      </>
    );
    fireEvent.click(screen.getByText('Esporta immagine…'));
    await settle();

    // the formats and the themes it lists, the three sizes it counts
    expect(text).toMatch(/PNG.*in\s+tre grandezze.*oppure SVG/s);
    for (const format of ['PNG', 'SVG']) {
      expect(screen.getByRole('button', { name: format })).toBeInTheDocument();
    }
    expect(screen.getByRole('group', { name: 'Dimensione' }).querySelectorAll('button')).toHaveLength(3);
    for (const theme of ['Chiaro', 'Scuro']) {
      expect(screen.getByRole('button', { name: theme })).toBeInTheDocument();
    }
    expect(screen.getByRole('checkbox', { name: 'Nome del progetto in alto' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Sfondo trasparente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva PNG…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copia negli appunti' })).toBeInTheDocument();
    // outside a presentation there is no question to write
    expect(screen.queryByRole('checkbox', { name: 'Domanda e risposta sotto il disegno' })).toBeNull();
  });

  it('says the button reads "Scarica PNG" where the browser cannot ask where to save: it does', async () => {
    vi.mocked(images.canChooseWhereToSave).mockReturnValue(false);
    render(<ExportImageModal />);
    act(() => ui().openModal('exportImage'));
    await settle();

    expect(screen.getByRole('button', { name: 'Scarica PNG' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva PNG…' })).toBeNull();
  });

  it('says the picture has no selection: a selected device is drawn like the others', async () => {
    expect(step(TITLE)).toContain('senza selezioni né punti di connessione');
    act(() => network().selectMultipleDevices([id('R-Sede')]));
    render(<ExportImageModal />);
    act(() => ui().openModal('exportImage'));
    await settle();

    const address = screen.getByAltText("Anteprima dell'immagine").getAttribute('src') ?? '';
    const picture = new DOMParser().parseFromString(
      decodeURIComponent(address.slice(address.indexOf(',') + 1)),
      'image/svg+xml'
    );
    const borders = [...picture.querySelectorAll('svg > g > g')]
      .slice(2)
      .map((group) => group.querySelectorAll('rect')[0].getAttribute('stroke'));
    expect(borders).toHaveLength(12);
    expect(new Set(borders).size).toBe(1);
    // a connection point would be a circle on the device (icons have circles of their own, inside)
    expect(picture.querySelector('svg > g > g > circle')).toBeNull();
  });

  it('while presenting, the button of the bar opens the same dialog, with the question to write', async () => {
    act(() => {
      presentation().enter();
      presentation().ask(id('PC-Filiale-1'), id('Srv-File'));
    });
    render(
      <>
        <PresentationBar />
        <ExportImageModal />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Esporta immagine' }));
    await settle();

    expect(screen.getByRole('heading', { name: 'Esporta immagine' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Domanda e risposta sotto il disegno' })).toBeChecked();
  });
});
