/**
 * Where an area of the canvas («riquadro») is asked for: the panel that
 * adds things, the menu of a device, the Modifica menu. And two things that
 * read the whole canvas: the picture of the drawing, which shows the areas,
 * and a sample network, which asks before taking their place.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import type { CanvasArea } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { AREA_MARGIN, AREA_PALETTE } from '@/utils/canvasAreas';
import { answerConfirms, settled } from '@/test/confirm';
import DevicePanel from '@/components/Sidebar/DevicePanel';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import ContextMenu from '@/components/ui/ContextMenu';
import ExportImageModal from '@/components/Modals/ExportImageModal';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

// jsdom paints nothing: the PNG of the export dialog is not made here
vi.mock('@/utils/imageExport', async (original) => ({
  ...(await original<typeof import('@/utils/imageExport')>()),
  rasterizeSvg: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const store = () => useNetworkStore.getState();

function addPc(label: string, position: { x: number; y: number }) {
  return store().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position,
  });
}

const CORE: Omit<CanvasArea, 'id'> = {
  label: 'Core',
  color: 'violet',
  position: { x: -40, y: -60 },
  size: { width: 300, height: 260 },
};

/** What an area around these two is: jsdom measures nothing, a device is taken to be its frame, 104 by 94 */
const AROUND_TWO = {
  position: { x: 100 - AREA_MARGIN.side, y: 150 - AREA_MARGIN.top },
  size: { width: 404 + 2 * AREA_MARGIN.side, height: 144 + AREA_MARGIN.top + AREA_MARGIN.bottom },
};

beforeEach(() => {
  localStorage.clear();
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.getState().closeContextMenu();
  useUIStore.getState().closeModal('exportImage');
  vi.clearAllMocks();
});

describe('the panel «Aggiungi»', () => {
  it('has «Riquadro» with the devices: a click adds an area, selected, with its name to be typed', () => {
    addPc('PC-1', { x: 0, y: 0 });
    render(<DevicePanel />);
    const entry = screen.getByRole('button', { name: /^Riquadro/ });
    expect(entry).toHaveTextContent("Un'area con un nome, dietro a un gruppo di dispositivi");

    fireEvent.click(entry);

    expect(store().areas).toHaveLength(1);
    const [area] = store().areas;
    expect(area).toMatchObject({ id: 'area-1', label: 'Riquadro', color: 'slate' });
    expect(store()).toMatchObject({ selectedAreaId: 'area-1', editingAreaId: 'area-1' });
    // no window is opened for it, and no device is added
    expect(useUIStore.getState().modals.addDevice).toBe(false);
    expect(store().devices).toHaveLength(1);

    // one more: another colour, another id
    fireEvent.click(entry);
    expect(store().areas.map((a) => [a.id, a.color])).toEqual([
      ['area-1', 'slate'],
      ['area-2', 'green'],
    ]);
  });

  it('a sample network asks before taking the place of a canvas that has only areas', async () => {
    store().addArea(CORE);
    const answers = answerConfirms(false);
    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Topologie' }));

    fireEvent.click(screen.getByRole('button', { name: /Ufficio: due reti e un router/ }));
    await settled();

    expect(answers.asked.map((question) => question.title)).toEqual(['Caricare la rete di esempio?']);
    expect(store().areas).toHaveLength(1);
    expect(store().devices).toEqual([]);

    // a yes: the sample comes, as it is, and the areas of the old drawing go
    answers.say(true);
    fireEvent.click(screen.getByRole('button', { name: /Ufficio: due reti e un router/ }));
    await settled();
    expect(store().devices.length).toBeGreaterThan(0);
    expect(store().areas).toEqual([]);
  });

  it('a sample network on an empty canvas is loaded without asking, and brings no area', async () => {
    const answers = answerConfirms(true);
    render(<DevicePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Topologie' }));
    for (const name of [/Azienda:/, /Ufficio:/, /Sede:/, /Due sedi:/]) {
      act(() => store().clearAllDevices());
      answers.asked.length = 0;
      fireEvent.click(screen.getByRole('button', { name }));
      await settled();
      expect(answers.asked).toEqual([]);
      expect(store().devices.length).toBeGreaterThan(0);
      // (the samples are as they were: none of them draws an area)
      expect(store().areas).toEqual([]);
    }
  });
});

describe('«Racchiudi in un riquadro»', () => {
  it('in the menu of a device: around the devices that are selected, when it is one of them', () => {
    const first = addPc('PC-1', { x: 100, y: 200 });
    const second = addPc('PC-2', { x: 400, y: 150 });
    addPc('PC-3', { x: 900, y: 900 });
    store().selectMultipleDevices([first, second]);
    useUIStore.getState().setContextMenuDevice(store().devices[0], 40, 60);
    render(<ContextMenu />);

    fireEvent.click(screen.getByText('Racchiudi in un riquadro'));

    expect(store().areas).toEqual([{ id: 'area-1', label: 'Riquadro', color: 'slate', ...AROUND_TWO }]);
    expect(store()).toMatchObject({ selectedAreaId: 'area-1', editingAreaId: 'area-1', selectedDeviceIds: [] });
    expect(useUIStore.getState().contextMenuDevice).toBeNull();
    // the devices are where they were
    expect(store().devices.map((d) => d.position)).toEqual([
      { x: 100, y: 200 },
      { x: 400, y: 150 },
      { x: 900, y: 900 },
    ]);
  });

  it('in the menu of a device that is not among the selected ones: around that device alone', () => {
    const first = addPc('PC-1', { x: 100, y: 200 });
    addPc('PC-2', { x: 400, y: 150 });
    const third = addPc('PC-3', { x: 900, y: 900 });
    store().selectMultipleDevices([first]);
    useUIStore.getState().setContextMenuDevice(store().devices.find((d) => d.id === third)!, 40, 60);
    render(<ContextMenu />);

    fireEvent.click(screen.getByText('Racchiudi in un riquadro'));

    expect(store().areas[0].position).toEqual({ x: 900 - AREA_MARGIN.side, y: 900 - AREA_MARGIN.top });
    expect(store().areas[0].size).toEqual({
      width: 104 + 2 * AREA_MARGIN.side,
      height: 94 + AREA_MARGIN.top + AREA_MARGIN.bottom,
    });
  });

  it('in Modifica: around the selected devices; off while nothing is selected', () => {
    const first = addPc('PC-1', { x: 100, y: 200 });
    const second = addPc('PC-2', { x: 400, y: 150 });
    render(<TopMenuBar />);
    const entry = () => screen.getByText('Racchiudi in un riquadro');
    expect(entry().className).toContain('disabled');
    fireEvent.click(entry());
    expect(store().areas).toEqual([]);

    act(() => store().selectMultipleDevices([first, second]));
    expect(entry().className).not.toContain('disabled');
    fireEvent.click(entry());

    expect(store().areas).toEqual([{ id: 'area-1', label: 'Riquadro', color: 'slate', ...AROUND_TWO }]);
    // (the area is now the selected thing: with no device selected the entry is off again)
    expect(entry().className).toContain('disabled');
  });
});

describe('the picture of a drawing with areas', () => {
  const picture = () => {
    const address = screen.getByAltText("Anteprima dell'immagine").getAttribute('src') ?? '';
    const doc = new DOMParser().parseFromString(
      decodeURIComponent(address.slice(address.indexOf(',') + 1)),
      'image/svg+xml'
    );
    expect(doc.querySelector('parsererror')).toBeNull();
    return doc;
  };
  const areaRects = () => [...picture().querySelectorAll('svg > g > g:first-child rect[fill-opacity]')];

  it('shows them behind the devices, in the colours of the theme the picture is made in', async () => {
    addPc('PC-1', { x: 0, y: 0 });
    store().addArea(CORE);
    store().addArea({ ...CORE, label: 'Edge', color: 'teal', position: { x: 400, y: 0 } });
    useUIStore.setState({ darkMode: false });
    render(<ExportImageModal />);
    act(() => useUIStore.getState().openModal('exportImage'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(areaRects().map((rect) => rect.getAttribute('fill'))).toEqual([
      AREA_PALETTE.light.violet,
      AREA_PALETTE.light.teal,
    ]);
    const texts = [...picture().querySelectorAll('svg > g text')].map((text) => text.textContent);
    expect(texts.slice(0, 2)).toEqual(['CORE', 'EDGE']);
    expect(texts).toContain('PC-1');

    fireEvent.click(within(screen.getByRole('group', { name: 'Tema' })).getByRole('button', { name: 'Scuro' }));
    expect(areaRects().map((rect) => rect.getAttribute('fill'))).toEqual([
      AREA_PALETTE.dark.violet,
      AREA_PALETTE.dark.teal,
    ]);
  });
});
