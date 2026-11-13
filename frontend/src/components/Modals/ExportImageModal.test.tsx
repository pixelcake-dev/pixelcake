/**
 * Export image — the dialog: what the picture shows for each choice, and
 * what goes to the file and to the clipboard.
 *
 * Painting the PNG, the picker and the clipboard are the browser's and are
 * replaced here (utils/imageExport.test.ts covers them); the picture itself
 * is the real one, read back from the preview.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useProjectStore } from '@/store/projectStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { MARK_COLORS, PALETTES } from '@/utils/drawingImage';
import * as images from '@/utils/imageExport';
import { device } from '@/test/networkFixtures';
import PresentationBar from '@/components/Presentation/PresentationBar';
import PresentationPanel from '@/components/Presentation/PresentationPanel';
import ExportImageModal from './ExportImageModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/utils/imageExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/imageExport')>()),
  rasterizeSvg: vi.fn(),
  saveImage: vi.fn(),
  copyImage: vi.fn(),
  canCopyImage: vi.fn(),
  canChooseWhereToSave: vi.fn(),
}));

const rasterizeSvg = vi.mocked(images.rasterizeSvg);
const saveImage = vi.mocked(images.saveImage);
const copyImage = vi.mocked(images.copyImage);

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();
const ui = () => useUIStore.getState();
const id = (label: string) => network().devices.find((d) => d.label === label)!.id;
/** The cable between two devices (the store names cables itself) */
const cable = (a: string, b: string) =>
  network().connections.find(
    (c) => [c.source, c.target].includes(id(a)) && [c.source, c.target].includes(id(b))
  )!.id;

/** A PNG that remembers what it was painted from */
const pngOf = (svg: string, width: number, height: number) =>
  new Blob([`${width}x${height}:${svg.length}`], { type: 'image/png' });

function closeEveryModal() {
  for (const name of Object.keys(ui().modals) as Array<keyof ReturnType<typeof ui>['modals']>) {
    ui().closeModal(name);
  }
}

/** Let what is waiting happen: a PNG being painted, a save being answered */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Open the dialog and let the PNG of the first choices be made */
async function openDialog() {
  act(() => ui().openModal('exportImage'));
  await settle();
}

const preview = () => screen.getByAltText("Anteprima dell'immagine");
/** The picture on show, as a document */
function picture(): Document {
  const address = preview().getAttribute('src') ?? '';
  const doc = new DOMParser().parseFromString(
    decodeURIComponent(address.slice(address.indexOf(',') + 1)),
    'image/svg+xml'
  );
  expect(doc.querySelector('parsererror')).toBeNull();
  return doc;
}
const pictureSize = () =>
  ['width', 'height'].map((name) => Number(picture().documentElement.getAttribute(name)));
const pictureTexts = () => [...picture().querySelectorAll('text')].map((t) => t.textContent);
/** What is written around the drawing: title above, caption below */
const pageTexts = () => [...picture().querySelectorAll('svg > text')].map((t) => t.textContent);
const cables = () => [...picture().querySelectorAll('svg > g > g:first-child > path')];

const choice = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', { name });
const check = (name: string) => screen.getByRole('checkbox', { name });
const saveButton = () => screen.getByRole('button', { name: /^(Salva|Scarica|Preparo) / });
const pixels = () => screen.getByTestId('export-image-pixels').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  act(() => {
    presentation().exit();
    closeEveryModal();
  });
  useSimulationStore.getState().resetSimulation();
  ui().setDarkMode(false);
  ui().setTheme('pixelcake');
  createNewProject({ name: 'Due sedi' });
  const sample = createRedundancySample();
  network().loadTopology(sample.devices, sample.connections);

  rasterizeSvg.mockImplementation(async (svg, width, height) => pngOf(svg, width, height));
  saveImage.mockResolvedValue('saved');
  copyImage.mockResolvedValue(true);
  vi.mocked(images.canCopyImage).mockReturnValue(true);
  vi.mocked(images.canChooseWhereToSave).mockReturnValue(true);
});

afterEach(async () => {
  // a PNG still being painted for the last choice is let through first
  await settle();
  act(() => {
    presentation().exit();
    closeEveryModal();
  });
  document.body.querySelectorAll('.react-flow__node').forEach((node) => node.remove());
});

describe('ExportImageModal — the dialog', () => {
  it('is not there, and makes nothing, until it is opened', () => {
    render(<ExportImageModal />);
    expect(screen.queryByText('Esporta immagine')).toBeNull();
    expect(rasterizeSvg).not.toHaveBeenCalled();
  });

  it('shows the whole drawing, with the name of the project, as a large PNG in the theme on screen', async () => {
    render(<ExportImageModal />);
    await openDialog();

    expect(screen.getByRole('heading', { name: 'Esporta immagine' })).toBeInTheDocument();
    const texts = pictureTexts();
    for (const entry of network().devices) {
      expect(texts).toContain(entry.label);
      expect(texts).toContain(entry.ip);
    }
    expect(texts).toContain('Linea principale');
    expect(cables()).toHaveLength(network().connections.length);
    // every device has its icon
    expect(picture().querySelectorAll('svg > g > g > g[transform*="scale"]')).toHaveLength(12);

    expect(choice('Formato', 'PNG')).toHaveAttribute('aria-pressed', 'true');
    expect(choice('Dimensione', 'Grande')).toHaveAttribute('aria-pressed', 'true');
    expect(choice('Tema', 'Chiaro')).toHaveAttribute('aria-pressed', 'true');
    expect(check('Nome del progetto in alto')).toBeChecked();
    expect(check('Sfondo trasparente')).not.toBeChecked();
    expect(pageTexts()).toEqual(['Due sedi']);
    expect(picture().querySelector('svg > rect')?.getAttribute('fill')).toBe(PALETTES.light.canvas);
    // nothing of a presentation outside a presentation
    expect(screen.queryByRole('checkbox', { name: /sotto il disegno/ })).toBeNull();
    expect(screen.queryByText(/com'è ora nella presentazione/)).toBeNull();
  });

  it('starts dark when the screen is dark', async () => {
    ui().setDarkMode(true);
    render(<ExportImageModal />);
    await openDialog();

    expect(choice('Tema', 'Scuro')).toHaveAttribute('aria-pressed', 'true');
    expect(picture().querySelector('svg > rect')?.getAttribute('fill')).toBe(PALETTES.dark.canvas);
  });

  it('starts again from the screen each time it is opened', async () => {
    render(<ExportImageModal />);
    await openDialog();
    fireEvent.click(choice('Formato', 'SVG'));
    fireEvent.click(choice('Tema', 'Scuro'));
    fireEvent.click(check('Nome del progetto in alto'));

    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(ui().modals.exportImage).toBe(false);
    expect(screen.queryByText('Esporta immagine')).toBeNull();

    await openDialog();
    expect(choice('Formato', 'PNG')).toHaveAttribute('aria-pressed', 'true');
    expect(choice('Tema', 'Chiaro')).toHaveAttribute('aria-pressed', 'true');
    expect(check('Nome del progetto in alto')).toBeChecked();
  });

  it('closes with Esc', async () => {
    render(<ExportImageModal />);
    await openDialog();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(ui().modals.exportImage).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(ui().modals.exportImage).toBe(false);
  });
});

describe('ExportImageModal — the choices', () => {
  it('theme: the picture is light or dark as chosen, whatever the screen', async () => {
    render(<ExportImageModal />);
    await openDialog();
    const fill = () => picture().querySelector('svg > rect')?.getAttribute('fill');

    fireEvent.click(choice('Tema', 'Scuro'));
    expect(choice('Tema', 'Scuro')).toHaveAttribute('aria-pressed', 'true');
    expect(choice('Tema', 'Chiaro')).toHaveAttribute('aria-pressed', 'false');
    expect(fill()).toBe(PALETTES.dark.canvas);
    // the screen is not touched
    expect(ui().darkMode).toBe(false);

    fireEvent.click(choice('Tema', 'Chiaro'));
    expect(fill()).toBe(PALETTES.light.canvas);
    await settle();
  });

  it('background: none when asked, shown on the grey squares', async () => {
    render(<ExportImageModal />);
    await openDialog();
    expect(preview().parentElement?.className).not.toContain('transparent');

    fireEvent.click(check('Sfondo trasparente'));
    expect(picture().querySelector('svg > rect')).toBeNull();
    expect(preview().parentElement?.className).toContain('transparent');

    fireEvent.click(check('Sfondo trasparente'));
    expect(picture().querySelector('svg > rect')).not.toBeNull();
    await settle();
  });

  it('title: the name of the project, and of the canvas when there are several', async () => {
    render(<ExportImageModal />);
    await openDialog();
    expect(pageTexts()).toEqual(['Due sedi']);

    fireEvent.click(check('Nome del progetto in alto'));
    expect(pageTexts()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));

    // a second canvas: now each has a name worth writing
    act(() => {
      const second = useProjectStore.getState().addCanvas('Magazzino');
      useProjectStore.getState().switchCanvas(second);
      network().addDevice(device({ id: 'x', label: 'NAS', ip: '10.9.9.9' }));
    });
    await openDialog();
    expect(pageTexts()).toEqual(['Due sedi', 'Magazzino']);
    expect(pictureTexts()).toContain('NAS');
    expect(pictureTexts()).not.toContain('Srv-File');

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveImage).toHaveBeenCalled());
    expect(saveImage.mock.calls[0][1]).toBe('due-sedi-magazzino.png');
  });

  it('size: the pixels are said, and the PNG is painted that large', async () => {
    render(<ExportImageModal />);
    await openDialog();
    const [width, height] = pictureSize();

    expect(pixels()).toBe(`${width * 2} × ${height * 2} pixel`);
    await waitFor(() => expect(rasterizeSvg).toHaveBeenCalled());
    const [painted, paintedWidth, paintedHeight] = rasterizeSvg.mock.calls.at(-1)!;
    expect([paintedWidth, paintedHeight]).toEqual([width * 2, height * 2]);
    // the document painted declares those very pixels, for the same drawing
    expect(painted).toContain(`width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}"`);

    fireEvent.click(choice('Dimensione', 'Molto grande'));
    expect(pixels()).toBe(`${width * 3} × ${height * 3} pixel`);
    await waitFor(() =>
      expect(rasterizeSvg.mock.calls.at(-1)?.slice(1)).toEqual([width * 3, height * 3])
    );

    fireEvent.click(choice('Dimensione', 'Normale'));
    expect(pixels()).toBe(`${width} × ${height} pixel`);
    await waitFor(() => expect(rasterizeSvg.mock.calls.at(-1)?.slice(1)).toEqual([width, height]));
  });

  it('size: a drawing too large for the browser is made as large as it can be, and says so', async () => {
    act(() => {
      network().addDevice(device({ id: 'far', label: 'Lontano', position: { x: 30000, y: 0 } }));
    });
    render(<ExportImageModal />);
    await openDialog();

    const [width] = pictureSize();
    expect(width).toBeGreaterThan(30000);
    expect(pixels()).toMatch(/^\d+ × \d+ pixel \(ridotta: è il massimo che il browser riesce a creare\)$/);
    const painted = Number(pixels()?.split(' ')[0]);
    expect(painted).toBeLessThanOrEqual(images.MAX_PNG_SIDE);
    expect(painted).toBeGreaterThan(images.MAX_PNG_SIDE * 0.99);
    await waitFor(() => expect(rasterizeSvg.mock.calls.at(-1)?.[1]).toBe(painted));
  });

  it('format: SVG has no size to choose, and says what it is good for', async () => {
    render(<ExportImageModal />);
    await openDialog();
    expect(screen.getByText('Per documenti, presentazioni e messaggi.')).toBeInTheDocument();
    expect(saveButton()).toHaveTextContent('Salva PNG…');

    fireEvent.click(choice('Formato', 'SVG'));

    expect(screen.queryByRole('group', { name: 'Dimensione' })).toBeNull();
    expect(screen.getByText(/^Vettoriale: si ingrandisce senza sgranare/)).toBeInTheDocument();
    expect(saveButton()).toHaveTextContent('Salva SVG…');
  });

  it('uses the size each device has on screen', async () => {
    // the canvas has drawn R-Sede 200 wide (a long name, say)
    const node = document.createElement('div');
    node.className = 'react-flow__node';
    node.dataset.id = id('R-Sede');
    const box = document.createElement('div');
    box.className = 'network-device';
    Object.defineProperty(box, 'offsetWidth', { value: 200 });
    Object.defineProperty(box, 'offsetHeight', { value: 117 });
    node.appendChild(box);
    document.body.appendChild(node);

    render(<ExportImageModal />);
    await openDialog();

    const widths = [...picture().querySelectorAll('svg > g > g')]
      .slice(2)
      .map((group) => [
        group.querySelector('text')?.textContent,
        Number(group.querySelectorAll('rect')[1].getAttribute('width')) + 2,
      ]);
    expect(widths).toContainEqual(['R-Sede', 200]);
    expect(widths).toContainEqual(['R-Filiale', 120]);
  });
});

describe('ExportImageModal — the file', () => {
  it('saves the PNG on show under the name of the project, and closes', async () => {
    render(<ExportImageModal />);
    await openDialog();
    const [width, height] = pictureSize();

    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());
    await waitFor(() => expect(ui().modals.exportImage).toBe(false));

    expect(saveImage).toHaveBeenCalledTimes(1);
    const [blob, name, format] = saveImage.mock.calls[0];
    expect([name, format]).toEqual(['due-sedi.png', 'png']);
    // the very PNG painted for these choices
    expect(blob).toBe(await rasterizeSvg.mock.results.at(-1)?.value);
    expect(rasterizeSvg.mock.calls.at(-1)?.slice(1)).toEqual([width * 2, height * 2]);
  });

  it('saves the SVG on show, as it is', async () => {
    render(<ExportImageModal />);
    await openDialog();
    fireEvent.click(choice('Formato', 'SVG'));
    fireEvent.click(choice('Tema', 'Scuro'));
    const address = preview().getAttribute('src') ?? '';
    const shown = decodeURIComponent(address.slice(address.indexOf(',') + 1));

    fireEvent.click(saveButton());
    await waitFor(() => expect(ui().modals.exportImage).toBe(false));

    const [blob, name, format] = saveImage.mock.calls[0];
    expect([name, format]).toEqual(['due-sedi.svg', 'svg']);
    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(text).toBe(shown);
    expect(text).toContain(PALETTES.dark.canvas);
  });

  it('stays open when the save did not happen', async () => {
    render(<ExportImageModal />);
    await openDialog();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    for (const outcome of ['cancelled', 'failed'] as const) {
      saveImage.mockResolvedValueOnce(outcome);
      fireEvent.click(saveButton());
      await settle();
      expect(ui().modals.exportImage).toBe(true);
    }

    saveImage.mockResolvedValueOnce('downloaded');
    fireEvent.click(saveButton());
    await waitFor(() => expect(ui().modals.exportImage).toBe(false));
  });

  it('says "Scarica" where the browser cannot ask where to save', async () => {
    vi.mocked(images.canChooseWhereToSave).mockReturnValue(false);
    render(<ExportImageModal />);
    await openDialog();
    expect(saveButton()).toHaveTextContent('Scarica PNG');
    fireEvent.click(choice('Formato', 'SVG'));
    expect(saveButton()).toHaveTextContent('Scarica SVG');
  });

  it('cannot save a PNG that is not painted yet, nor one painted for other choices', async () => {
    // painting is slow: each PNG arrives when the test says
    const pending: Array<{ size: number[]; finish: () => void }> = [];
    rasterizeSvg.mockImplementation(
      (svg, width, height) =>
        new Promise((resolve) => {
          pending.push({ size: [width, height], finish: () => resolve(pngOf(svg, width, height)) });
        })
    );
    render(<ExportImageModal />);
    await openDialog();
    const [width, height] = pictureSize();

    expect(saveButton()).toBeDisabled();
    // and it says why
    expect(saveButton()).toHaveTextContent('Preparo il PNG…');
    expect(screen.getByRole('button', { name: 'Copia negli appunti' })).toBeDisabled();
    fireEvent.click(saveButton());
    expect(saveImage).not.toHaveBeenCalled();
    // the SVG needs no painting: it can be saved at once
    fireEvent.click(choice('Formato', 'SVG'));
    expect(saveButton()).toBeEnabled();
    expect(saveButton()).toHaveTextContent('Salva SVG…');
    fireEvent.click(choice('Formato', 'PNG'));

    // the user changes the size before the first PNG is there
    fireEvent.click(choice('Dimensione', 'Normale'));
    expect(pending.map((entry) => entry.size)).toEqual([
      [width * 2, height * 2],
      [width, height],
    ]);

    // the first one arrives late: it is for the size that was left
    await act(async () => pending[0].finish());
    expect(saveButton()).toBeDisabled();

    await act(async () => pending[1].finish());
    expect(saveButton()).toBeEnabled();
    expect(saveButton()).toHaveTextContent('Salva PNG…');
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveImage).toHaveBeenCalledTimes(1));
    expect(saveImage.mock.calls[0][0]).toBe(await rasterizeSvg.mock.results[1].value);
  });

  it('a PNG that was ready is no longer the one to save once a choice changes', async () => {
    const pending: Array<{ size: number[]; finish: () => void }> = [];
    rasterizeSvg.mockImplementation(
      (svg, width, height) =>
        new Promise((resolve) => {
          pending.push({ size: [width, height], finish: () => resolve(pngOf(svg, width, height)) });
        })
    );
    render(<ExportImageModal />);
    await openDialog();

    // the PNG of the first choices is there
    await act(async () => pending[0].finish());
    expect(saveButton()).toBeEnabled();
    const first = await rasterizeSvg.mock.results[0].value;

    // another theme: what was painted shows the old one
    fireEvent.click(choice('Tema', 'Scuro'));
    expect(pending).toHaveLength(2);
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveTextContent('Preparo il PNG…');
    expect(screen.getByRole('button', { name: 'Copia negli appunti' })).toBeDisabled();
    fireEvent.click(saveButton());
    fireEvent.click(screen.getByRole('button', { name: 'Copia negli appunti' }));
    expect(saveImage).not.toHaveBeenCalled();
    expect(copyImage).not.toHaveBeenCalled();

    await act(async () => pending[1].finish());
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveImage).toHaveBeenCalledTimes(1));
    const saved = saveImage.mock.calls[0][0];
    expect(saved).toBe(await rasterizeSvg.mock.results[1].value);
    expect(saved).not.toBe(first);
  });

  it('the warning about a PNG that failed goes while another one is being painted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    rasterizeSvg.mockRejectedValueOnce(new Error('too large'));
    render(<ExportImageModal />);
    await openDialog();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // a smaller size is chosen, and takes its time
    let finish: () => void = () => undefined;
    rasterizeSvg.mockImplementation(
      (svg, width, height) =>
        new Promise((resolve) => {
          finish = () => resolve(pngOf(svg, width, height));
        })
    );
    fireEvent.click(choice('Dimensione', 'Normale'));

    // the warning was about the other picture: this one is still being made
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton()).toBeDisabled();
    expect(saveButton()).toHaveTextContent('Preparo il PNG…');

    await act(async () => finish());
    expect(saveButton()).toBeEnabled();
    expect(saveButton()).toHaveTextContent('Salva PNG…');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says so when the browser cannot paint the PNG, and still offers the SVG', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    rasterizeSvg.mockRejectedValue(new Error('too large'));
    render(<ExportImageModal />);
    await openDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Il browser non è riuscito a creare l'immagine PNG. Prova una dimensione più piccola, oppure il formato SVG."
    );
    expect(saveButton()).toBeDisabled();
    // nothing is being prepared any more: the warning says what happened
    expect(saveButton()).toHaveTextContent('Salva PNG…');
    expect(screen.getByRole('button', { name: 'Copia negli appunti' })).toBeDisabled();

    fireEvent.click(choice('Formato', 'SVG'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(saveButton()).toBeEnabled();

    // a smaller size that the browser can paint: the warning goes
    fireEvent.click(choice('Formato', 'PNG'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rasterizeSvg.mockImplementation(async (svg, width, height) => pngOf(svg, width, height));
    fireEvent.click(choice('Dimensione', 'Normale'));
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ExportImageModal — the clipboard', () => {
  it('copies the PNG on show and stays open', async () => {
    render(<ExportImageModal />);
    await openDialog();
    const copy = () => screen.getByRole('button', { name: /^Copia/ });
    await waitFor(() => expect(copy()).toBeEnabled());

    fireEvent.click(copy());
    await waitFor(() => expect(copy()).toHaveTextContent('Copiata'));

    expect(copyImage).toHaveBeenCalledTimes(1);
    expect(copyImage.mock.calls[0][0]).toBe(await rasterizeSvg.mock.results.at(-1)?.value);
    expect(ui().modals.exportImage).toBe(true);
    expect(saveImage).not.toHaveBeenCalled();
  });

  it('goes back to "Copia negli appunti" after a moment', async () => {
    render(<ExportImageModal />);
    await openDialog();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Copia/ })).toBeEnabled());

    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: /^Copia/ }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(screen.getByRole('button', { name: 'Copiata' })).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(screen.getByRole('button', { name: 'Copia negli appunti' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not say "Copiata" when the browser refused', async () => {
    copyImage.mockResolvedValue(false);
    render(<ExportImageModal />);
    await openDialog();
    await waitFor(() => expect(screen.getByRole('button', { name: /^Copia/ })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /^Copia/ }));
    await waitFor(() => expect(copyImage).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Copiata' })).toBeNull();
  });

  it('copies a PNG also while SVG is the format chosen for the file', async () => {
    render(<ExportImageModal />);
    await openDialog();
    fireEvent.click(choice('Formato', 'SVG'));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Copia/ })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /^Copia/ }));
    await waitFor(() => expect(copyImage).toHaveBeenCalled());
    expect(copyImage.mock.calls[0][0].type).toBe('image/png');
  });

  it('offers no copy where the browser cannot copy pictures', async () => {
    vi.mocked(images.canCopyImage).mockReturnValue(false);
    render(<ExportImageModal />);
    await openDialog();
    expect(screen.queryByRole('button', { name: /^Copia/ })).toBeNull();
    expect(saveButton()).toBeInTheDocument();
  });
});

describe('ExportImageModal — while presenting', () => {
  const strokes = (color: string) => cables().filter((path) => path.getAttribute('stroke') === color);

  /** The presentation, with the panel that works the answer out, and the dialog */
  async function present(prepare: () => void) {
    act(() => {
      presentation().enter();
      prepare();
    });
    render(
      <>
        <PresentationBar />
        <PresentationPanel />
        <ExportImageModal />
      </>
    );
    await openDialog();
  }

  it('shows what the presentation shows: the question, the way of the answer, the failure', async () => {
    await present(() => {
      presentation().ask(id('PC-Filiale-1'), id('Srv-File'));
      presentation().toggleConnectionFailure(cable('R-Sede', 'R-Filiale'));
    });

    // on the drawing: the two ends, the cut cable, the way round it
    const texts = pictureTexts();
    expect(texts).toContain('DA');
    expect(texts).toContain('A');
    expect(strokes(MARK_COLORS.failure)).toHaveLength(1);
    expect(strokes(MARK_COLORS.arrives)).toHaveLength(presentation().route?.links.length ?? 0);
    expect(strokes(MARK_COLORS.arrives).length).toBeGreaterThan(3);
    // the name of the cut cable gives way to the mark of the cut
    expect(texts).not.toContain('Linea principale');

    // under it: the same words as the panel
    const panel = screen.getByRole('complementary', { name: 'Pannello della presentazione' });
    const verdict = panel.querySelector('.presentation-verdict');
    const headline = verdict?.querySelector('strong')?.textContent ?? '';
    const detail = verdict?.querySelector('span')?.textContent ?? '';
    const whatIf = panel.querySelector('.presentation-whatif')?.textContent ?? '';
    expect(headline).toBe('Arriva');
    expect(pageTexts()).toEqual([
      'Due sedi',
      'Ping da PC-Filiale-1 a Srv-File: arriva',
      `${detail} ${whatIf}`,
      'Guasto simulato: cavo R-Sede – R-Filiale.',
      "Sul resto della rete (Ping tra i 5 dispositivi finali): nessuna delle 20 comunicazioni si interrompe, 12 passano da un'altra strada, 8 non cambiano.",
    ]);
    expect(picture().querySelector('svg > circle')?.getAttribute('fill')).toBe(PALETTES.light.toneOk);

    expect(check('Domanda e risposta sotto il disegno')).toBeChecked();
    expect(
      screen.getByText(
        "L'immagine mostra il disegno com'è ora nella presentazione, con i segni della domanda e dei guasti simulati."
      )
    ).toBeInTheDocument();
  });

  it('says why when the answer does not arrive, in the words of the engine', async () => {
    await present(() => {
      presentation().ask(id('PC-Sede-1'), id('Srv-File'));
      presentation().toggleDeviceFailure(id('SW-Core'));
    });

    const panel = screen.getByRole('complementary', { name: 'Pannello della presentazione' });
    const reason = panel.querySelector('.presentation-reason')?.textContent ?? '';
    expect(reason).not.toBe('');
    const caption = pageTexts().slice(1);
    expect(caption[0]).toBe('Ping da PC-Sede-1 a Srv-File: non arriva');
    expect(caption).toContain(`Motivo: ${reason}`);
    expect(caption).toContain('Guasto simulato: SW-Core.');
    expect(picture().querySelector('svg > circle')?.getAttribute('fill')).toBe(PALETTES.light.toneKo);
    // the broken device is struck out on the drawing
    expect(picture().querySelector('pattern#pc-hatch')).not.toBeNull();
  });

  it('leaves the caption out when asked, and keeps the marks on the drawing', async () => {
    await present(() => {
      presentation().ask(id('PC-Filiale-1'), id('Srv-File'));
      presentation().toggleConnectionFailure(cable('R-Sede', 'R-Filiale'));
    });

    fireEvent.click(check('Domanda e risposta sotto il disegno'));

    expect(pageTexts()).toEqual(['Due sedi']);
    expect(picture().querySelector('svg > circle')).toBeNull();
    expect(strokes(MARK_COLORS.failure)).toHaveLength(1);
    expect(pictureTexts()).toContain('DA');
  });

  it('with failures and no question, the caption is about the failures', async () => {
    await present(() => {
      presentation().toggleDeviceFailure(id('SW-Core'));
      presentation().toggleConnectionFailure(cable('R-Sede', 'R-Filiale'));
    });

    expect(screen.queryByRole('checkbox', { name: 'Domanda e risposta sotto il disegno' })).toBeNull();
    expect(check('Guasti simulati sotto il disegno')).toBeChecked();
    const caption = pageTexts().slice(1);
    expect(caption[0]).toBe('Guasti simulati: SW-Core e cavo R-Sede – R-Filiale');
    expect(caption[1]).toMatch(/^Sul resto della rete \(Ping tra i 5 dispositivi finali\): \d+ comunicazioni su 20 si interrompono/);
    expect(picture().querySelector('svg > circle')).toBeNull();
  });

  it('with neither question nor failure there is nothing to say under the drawing', async () => {
    await present(() => undefined);

    expect(screen.queryByRole('checkbox', { name: /sotto il disegno/ })).toBeNull();
    expect(pageTexts()).toEqual(['Due sedi']);
    expect(strokes(PALETTES.light.line)).toHaveLength(network().connections.length);
    // nothing is marked on the drawing: nothing to say about marks
    expect(screen.queryByText(/com'è ora nella presentazione/)).toBeNull();
  });

  it('Esc closes the dialog and leaves the presentation running; once more leaves it', async () => {
    await present(() => undefined);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(ui().modals.exportImage).toBe(false);
    expect(presentation().active).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(presentation().active).toBe(false);
  });

  it('Esc with the dialog open never leaves the presentation, whoever hears the key first', async () => {
    // the dialog listens before the bar does (the other order is the usual one, above)
    render(<ExportImageModal />);
    await openDialog();
    act(() => presentation().enter());
    render(<PresentationBar />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(ui().modals.exportImage).toBe(false);
    expect(presentation().active).toBe(true);
  });

  it('opens from the bar of the presentation', async () => {
    act(() => presentation().enter());
    render(
      <>
        <PresentationBar />
        <ExportImageModal />
      </>
    );
    expect(screen.queryByRole('heading', { name: 'Esporta immagine' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Esporta immagine' }));
    await settle();

    expect(screen.getByRole('heading', { name: 'Esporta immagine' })).toBeInTheDocument();
    expect(presentation().active).toBe(true);
  });
});
