/**
 * The areas of the canvas («riquadri»): drawn behind the devices, taken by
 * their label or their border, and never in the way of the drawing: the
 * selection of the devices, copy and paste, Delete and the selection box
 * behave with an area on the canvas as they do without.
 *
 * The canvas is the real one (React Flow included), driven with pointer,
 * mouse and keyboard events; only what jsdom lacks is stubbed. What needs a
 * laid out page (a selection box drawn over devices, the handles pulled) is
 * checked in the browser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from 'reactflow';
import type { CanvasArea } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { addAreaInView, encloseDevices } from '@/utils/areaActions';
import { AREA_MARGIN } from '@/utils/canvasAreas';
import { answerConfirms, settled } from '@/test/confirm';
import AreaContextMenu from '@/components/ui/AreaContextMenu';
import NetworkCanvas from './NetworkCanvas';

const LEFT = 0;
const RIGHT = 2;

function stubBrowser() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
}

const store = () => useNetworkStore.getState();

function addPc(label: string, position = { x: 0, y: 0 }) {
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
  position: { x: 100, y: 50 },
  size: { width: 300, height: 200 },
};

function renderCanvas() {
  return render(
    <ReactFlowProvider>
      <NetworkCanvas />
      <AreaContextMenu />
    </ReactFlowProvider>
  );
}

/** jsdom's own window: React Flow follows a drag through `event.view` */
const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
const pane = () => document.querySelector<HTMLElement>('.react-flow__pane')!;
const areaNode = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;
const drawn = (id: string) => screen.getByTestId(`area-${id}`);
const labelOf = (id: string) => drawn(id).querySelector<HTMLElement>('.area-label')!;
const area = (id: string) => store().areas.find((entry) => entry.id === id)!;
const labels = () => store().devices.map((d) => d.label);
const selectedDevices = () =>
  store().devices.filter((d) => store().selectedDeviceIds.includes(d.id)).map((d) => d.label);

async function clickDevice(label: string) {
  const node = screen.getByText(label).closest<HTMLElement>('.react-flow__node')!;
  const mouse = { button: LEFT, clientX: 5, clientY: 5, view: view() };
  fireEvent.mouseDown(node, mouse);
  fireEvent.mouseUp(node, mouse);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function press(key: string, target: Element = document.body) {
  fireEvent.keyDown(target, { key, code: key });
  fireEvent.keyUp(target, { key, code: key });
}

/** Press on something the area is taken by, move the pointer, let go */
function dragBy(grip: Element, dx: number, dy: number) {
  fireEvent.pointerDown(grip, { button: LEFT, pointerId: 1, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: 20 + dx, clientY: 20 + dy });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 20 + dx, clientY: 20 + dy });
}

beforeEach(() => {
  localStorage.clear();
  stubBrowser();
  usePresentationStore.getState().exit();
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false });
  useUIStore.getState().closeContextMenu();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('an area on the canvas', () => {
  it('is drawn behind the devices and the cables, as large as it is, in its colour, with its label', () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    renderCanvas();

    const node = areaNode(id);
    expect(node.className).toContain('react-flow__node-area');
    // under the cables (depth 0) and the devices; a device is at 0 or above
    expect(node.style.zIndex).toBe('-1');
    const device = screen.getByText('PC-1').closest<HTMLElement>('.react-flow__node')!;
    expect(Number(device.style.zIndex)).toBeGreaterThanOrEqual(0);
    expect(node.style.width).toBe('300px');
    expect(node.style.height).toBe('200px');
    expect(node.style.transform).toBe('translate(100px,50px)');
    // (its size is known: it does not wait to be measured to show)
    expect(node.style.visibility).toBe('visible');
    // first in the drawing, so that the small map too draws the devices over it
    expect(node.compareDocumentPosition(device) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(drawn(id).className).toContain('area-violet');
    expect(labelOf(id)).toHaveTextContent('Core');
  });

  it('is not React Flow\'s to select, drag or join: a selection box takes the devices alone', () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    renderCanvas();

    const node = areaNode(id);
    const device = screen.getByText('PC-1').closest<HTMLElement>('.react-flow__node')!;
    // (React Flow leaves out of a selection box what is not `selectable`,
    // and moves with a drag what is `draggable`: both are marked on the node)
    expect(device.className).toContain('selectable');
    expect(node.className).not.toContain('selectable');
    expect(device.className).toContain('nopan');
    expect(node.className.split(' ')).not.toContain('nopan');
    expect(node.querySelector('.react-flow__handle')).toBeNull();
    expect(node.getAttribute('tabindex')).toBeNull();
  });

  it('a press on its label selects it, and lets go of the devices that were selected', async () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    renderCanvas();
    await clickDevice('PC-1');
    expect(selectedDevices()).toEqual(['PC-1']);
    store().markSaved();

    // (a hand is never perfectly still: two pixels are not a move)
    fireEvent.pointerDown(labelOf(id), { button: LEFT, pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 22, clientY: 20 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 22, clientY: 20 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(store().selectedAreaId).toBe(id);
    expect(drawn(id).className).toContain('selected');
    expect(selectedDevices()).toEqual([]);
    expect(screen.getByText('PC-1').closest('.react-flow__node')!.className).not.toContain('selected');
    // selecting is not an edit, and a press that does not move is not a move
    expect(store().hasUnsavedChanges).toBe(false);
    expect(area(id).position).toEqual(CORE.position);
  });

  it('is moved by its label or by any side of its border; the devices stay where they are', () => {
    const device = addPc('PC-1', { x: 150, y: 120 });
    const id = store().addArea(CORE);
    renderCanvas();

    dragBy(labelOf(id), 50, 30);
    expect(area(id).position).toEqual({ x: 150, y: 80 });

    const sides = Array.from(drawn(id).querySelectorAll('.area-edge'));
    expect(sides.map((side) => side.className.match(/area-edge-(\w+)/)?.[1])).toEqual(['top', 'right', 'bottom', 'left']);
    dragBy(sides[2], -20, 100);
    expect(area(id).position).toEqual({ x: 130, y: 180 });

    expect(area(id).size).toEqual(CORE.size);
    expect(store().devices.find((d) => d.id === device)?.position).toEqual({ x: 150, y: 120 });
    expect(store().hasUnsavedChanges).toBe(true);
    // once the button is let go the pointer is no longer followed
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 900, clientY: 900 });
    expect(area(id).position).toEqual({ x: 130, y: 180 });
  });

  it('follows the pointer in the measure of the canvas, whatever the zoom', () => {
    store().setViewport({ x: 0, y: 0, zoom: 2 });
    const id = store().addArea(CORE);
    renderCanvas();

    dragBy(labelOf(id), 50, 30);

    expect(area(id).position).toEqual({ x: 125, y: 65 });
  });

  it('only the left button takes it, and another pointer does not move it', () => {
    const id = store().addArea(CORE);
    renderCanvas();

    fireEvent.pointerDown(labelOf(id), { button: RIGHT, pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 90, clientY: 90 });
    expect(area(id).position).toEqual(CORE.position);

    fireEvent.pointerDown(labelOf(id), { button: LEFT, pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 90, clientY: 90 });
    expect(area(id).position).toEqual(CORE.position);
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 20, clientY: 20 });
  });

  it('selected, it shows eight handles to resize it; not selected, none', () => {
    const id = store().addArea(CORE);
    renderCanvas();
    expect(drawn(id).querySelectorAll('.area-resize-handle')).toHaveLength(0);

    act(() => store().selectArea(id));

    const handles = Array.from(drawn(id).querySelectorAll('.react-flow__resize-control.area-resize-handle'));
    expect(handles).toHaveLength(8);
    // corners and the middle of the sides, each a handle of its own
    expect(new Set(handles.map((handle) => handle.className)).size).toBe(8);
    // (they come after the sides of the border in the page: a handle is over the side it sits on)
    const sides = drawn(id).querySelectorAll('.area-edge');
    expect(sides[3].compareDocumentPosition(handles[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a handle pulled resizes it, never under its smallest size, and moves no device', () => {
    const device = addPc('PC-1', { x: 150, y: 120 });
    const id = store().addArea(CORE);
    renderCanvas();
    act(() => store().selectArea(id));
    const corner = drawn(id).querySelector<HTMLElement>('.area-resize-handle.bottom.right')!;
    const devicesBefore = store().devices;

    fireEvent.mouseDown(corner, { button: LEFT, clientX: 400, clientY: 250, view: view() });
    fireEvent.mouseMove(view() as unknown as Element, { clientX: 460, clientY: 220, view: view() });
    fireEvent.mouseUp(view() as unknown as Element, { clientX: 460, clientY: 220, view: view() });
    expect(area(id)).toMatchObject({ position: CORE.position, size: { width: 360, height: 170 } });

    // from the top left corner the area keeps its bottom right one
    const topLeft = drawn(id).querySelector<HTMLElement>('.area-resize-handle.top.left')!;
    fireEvent.mouseDown(topLeft, { button: LEFT, clientX: 100, clientY: 50, view: view() });
    fireEvent.mouseMove(view() as unknown as Element, { clientX: 2000, clientY: 2000, view: view() });
    fireEvent.mouseUp(view() as unknown as Element, { clientX: 2000, clientY: 2000, view: view() });
    expect(area(id).size).toEqual({ width: 120, height: 80 });
    expect(area(id).position).toEqual({ x: 100 + 360 - 120, y: 50 + 170 - 80 });

    expect(store().devices.find((d) => d.id === device)?.position).toEqual({ x: 150, y: 120 });
    // (the list of the devices was not even written again: an area is not taken for one)
    expect(store().devices).toBe(devicesBefore);
  });
});

describe('the label of an area', () => {
  it('a double click renames it in place: Enter confirms, tidy; Esc leaves it as it was', () => {
    const id = store().addArea(CORE);
    renderCanvas();

    fireEvent.doubleClick(labelOf(id));
    const field = screen.getByLabelText<HTMLInputElement>('Nome del riquadro');
    expect(field).toHaveValue('Core');
    expect(field.maxLength).toBe(40);
    // (React Flow must not take what is typed, or a press in the field, for its own)
    expect(field.className).toContain('nodrag');
    fireEvent.change(field, { target: { value: '  Dorsale  ' } });
    // nothing changes before it is confirmed
    expect(area(id).label).toBe('Core');
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(area(id).label).toBe('Dorsale');
    expect(screen.queryByLabelText('Nome del riquadro')).not.toBeInTheDocument();
    expect(labelOf(id)).toHaveTextContent('Dorsale');

    fireEvent.doubleClick(labelOf(id));
    fireEvent.change(screen.getByLabelText('Nome del riquadro'), { target: { value: 'Altro' } });
    fireEvent.keyDown(screen.getByLabelText('Nome del riquadro'), { key: 'Escape' });
    expect(area(id).label).toBe('Dorsale');
    expect(store().editingAreaId).toBeNull();
  });

  it('from the keyboard: Enter on the name selects the area and renames it', () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    renderCanvas();
    labelOf(id).focus();

    fireEvent.keyDown(labelOf(id), { key: 'Tab' });
    expect(store().editingAreaId).toBeNull();
    fireEvent.keyDown(labelOf(id), { key: 'Enter' });

    expect(store()).toMatchObject({ selectedAreaId: id, editingAreaId: id });
    expect(screen.getByLabelText('Nome del riquadro')).toHaveValue('Core');
  });

  it('Delete typed in the name deletes a letter, not the area', () => {
    const id = store().addArea(CORE);
    renderCanvas();
    act(() => {
      store().selectArea(id);
      store().setEditingArea(id);
    });

    press('Delete', screen.getByLabelText('Nome del riquadro'));

    expect(store().areas).toHaveLength(1);
  });

  it('may be left empty: nothing is written on the area, and it can still be taken there', () => {
    const id = store().addArea({ ...CORE, label: '' });
    renderCanvas();

    expect(labelOf(id).className).toContain('area-label-empty');
    dragBy(labelOf(id), 10, 10);
    expect(area(id).position).toEqual({ x: 110, y: 60 });
  });
});

describe('adding an area', () => {
  it('by itself: in the middle of the view, selected, in the next colour, with its name ready to be typed', () => {
    store().addArea(CORE);
    renderCanvas();

    let id = '';
    act(() => {
      id = addAreaInView();
    });

    expect(area(id)).toMatchObject({ label: 'Riquadro', color: 'slate', size: { width: 360, height: 240 } });
    // (the view is untouched: its middle is the middle of the window)
    expect(area(id).position).toEqual({
      x: Math.round(window.innerWidth / 2 - 180),
      y: Math.round(window.innerHeight / 2 - 120),
    });
    expect(store()).toMatchObject({ selectedAreaId: id, editingAreaId: id });
    const field = screen.getByLabelText('Nome del riquadro');
    expect(field).toHaveValue('Riquadro');
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: 'Edge' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(area(id).label).toBe('Edge');
    // a second one takes another colour
    act(() => {
      id = addAreaInView();
    });
    expect(area(id).color).toBe('green');
  });

  it('around devices: it holds them with room for its label, they do not move, and it is the selected thing', async () => {
    const first = addPc('PC-1', { x: 100, y: 200 });
    const second = addPc('PC-2', { x: 400, y: 150 });
    addPc('PC-3', { x: 900, y: 900 });
    renderCanvas();
    await clickDevice('PC-1');

    let id: string | null = null;
    act(() => {
      id = encloseDevices([first, second]);
    });

    // (jsdom measures nothing: a device is taken to be its frame, 104 by 94)
    expect(area(id!)).toMatchObject({
      label: 'Riquadro',
      position: { x: 100 - AREA_MARGIN.side, y: 150 - AREA_MARGIN.top },
      size: { width: 504 - 100 + 2 * AREA_MARGIN.side, height: 294 - 150 + AREA_MARGIN.top + AREA_MARGIN.bottom },
    });
    expect(store().devices.map((d) => d.position)).toEqual([
      { x: 100, y: 200 },
      { x: 400, y: 150 },
      { x: 900, y: 900 },
    ]);
    expect(store()).toMatchObject({ selectedAreaId: id, editingAreaId: id, selectedDeviceIds: [] });
  });

  it('around no device there is nothing to add', () => {
    addPc('PC-1');
    renderCanvas();
    expect(encloseDevices([])).toBeNull();
    expect(encloseDevices(['dev-404'])).toBeNull();
    expect(store().areas).toEqual([]);
  });
});

describe('the menu of an area', () => {
  function openMenu(id: string) {
    fireEvent.contextMenu(labelOf(id), { clientX: 140, clientY: 70 });
  }
  const entries = () => Array.from(document.querySelectorAll('.context-menu.show li')).map((li) => li.textContent);

  it('opens with the right button on its label or on its border, and selects the area', () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    renderCanvas();

    openMenu(id);

    expect(useUIStore.getState()).toMatchObject({ contextMenuArea: id, contextMenuPosition: { x: 140, y: 70 } });
    expect(store().selectedAreaId).toBe(id);
    expect(entries()).toEqual(['Rinomina', 'Elimina']);
    const colours = screen.getByRole('group', { name: 'Colore del riquadro' });
    expect(Array.from(colours.querySelectorAll('button')).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Ardesia',
      'Verde',
      'Ocra',
      'Rosso',
      'Viola',
      'Petrolio',
    ]);
    expect(screen.getByRole('button', { name: 'Viola' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Verde' })).toHaveAttribute('aria-pressed', 'false');

    // the same from a side of the border
    act(() => useUIStore.getState().closeContextMenu());
    fireEvent.contextMenu(drawn(id).querySelector('.area-edge-left')!, { clientX: 100, clientY: 150 });
    expect(useUIStore.getState().contextMenuArea).toBe(id);
  });

  it('«Rinomina» puts the name under the keyboard', () => {
    const id = store().addArea(CORE);
    renderCanvas();
    openMenu(id);

    fireEvent.click(screen.getByText('Rinomina'));

    expect(useUIStore.getState().contextMenuArea).toBeNull();
    expect(screen.getByLabelText('Nome del riquadro')).toHaveValue('Core');
  });

  it('a colour of the palette is given with a click', () => {
    const id = store().addArea(CORE);
    renderCanvas();
    openMenu(id);

    fireEvent.click(screen.getByRole('button', { name: 'Ocra' }));

    expect(area(id).color).toBe('amber');
    expect(drawn(id).className).toContain('area-amber');
    expect(drawn(id).className).not.toContain('area-violet');
    expect(useUIStore.getState().contextMenuArea).toBeNull();
  });

  it('«Elimina» asks first, in a window of the app, and deletes the area alone', async () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    const other = store().addArea({ ...CORE, label: 'Edge' });
    const answers = answerConfirms(false);
    renderCanvas();
    openMenu(id);

    fireEvent.click(screen.getByText('Elimina'));
    await settled();
    expect(answers.asked).toEqual([
      {
        title: 'Eliminare il riquadro «Core»?',
        detail: 'I dispositivi che racchiude restano dove sono.',
        confirmLabel: 'Elimina',
        danger: true,
      },
    ]);
    // a no: nothing is deleted
    expect(store().areas).toHaveLength(2);

    answers.say(true);
    openMenu(id);
    fireEvent.click(screen.getByText('Elimina'));
    await settled();
    expect(store().areas.map((entry) => entry.id)).toEqual([other]);
    expect(labels()).toEqual(['PC-1']);
  });
});

describe('the keyboard and the mouse, with an area on the canvas', () => {
  it('Delete deletes the area that is selected, and no device', async () => {
    addPc('PC-1');
    addPc('PC-2');
    const id = store().addArea(CORE);
    renderCanvas();
    await clickDevice('PC-1');

    act(() => store().selectArea(id));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    press('Delete');

    expect(store().areas).toEqual([]);
    expect(labels()).toEqual(['PC-1', 'PC-2']);
    // and with no area selected it deletes nothing of the kind
    const again = store().addArea(CORE);
    press('Delete');
    expect(store().areas.map((entry) => entry.id)).toEqual([again]);
  });

  it('Delete deletes the selected devices as before, and leaves the areas', async () => {
    addPc('PC-1');
    addPc('PC-2');
    store().addArea(CORE);
    renderCanvas();
    await clickDevice('PC-1');

    press('Delete');

    expect(labels()).toEqual(['PC-2']);
    expect(store().areas).toHaveLength(1);
  });

  it('Ctrl+C and Ctrl+V copy and paste the selected devices as before, and no area', async () => {
    addPc('PC-1');
    addPc('PC-2');
    store().addArea(CORE);
    renderCanvas();
    await clickDevice('PC-1');

    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'v', ctrlKey: true });

    expect(labels()).toEqual(['PC-1', 'PC-2', 'PC-1']);
    expect(store().areas).toHaveLength(1);
    // with an area selected there is no device to copy: the keys are left to the browser
    act(() => store().selectArea(store().areas[0].id));
    useNetworkStore.setState({ clipboard: null });
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    expect(store().clipboard).toBeNull();
  });

  it('selecting an area lets go of the cable React Flow holds selected: Delete then deletes the area alone', async () => {
    const first = addPc('PC-1');
    const second = addPc('PC-2', { x: 300, y: 0 });
    store().addConnection({ source: first, target: second });
    const id = store().addArea(CORE);
    // (a selected cable is known to React Flow alone: its store is asked)
    let flow: ReturnType<typeof useStoreApi> | undefined;
    const Grab = () => {
      flow = useStoreApi();
      return null;
    };
    render(
      <ReactFlowProvider>
        <NetworkCanvas />
        <Grab />
      </ReactFlowProvider>
    );
    const cable = () => flow?.getState().edges.find((edge) => edge.id === store().connections[0].id);
    act(() => flow?.getState().addSelectedEdges([store().connections[0].id]));
    expect(cable()?.selected).toBe(true);

    act(() => store().selectArea(id));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(cable()?.selected).toBeFalsy();
    press('Delete');
    expect(store().connections).toHaveLength(1);
    expect(labels()).toEqual(['PC-1', 'PC-2']);
    expect(store().areas).toEqual([]);
  });

  it('a device clicked is selected as before, and the area that was is let go', async () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    renderCanvas();
    act(() => store().selectArea(id));

    await clickDevice('PC-1');

    expect(selectedDevices()).toEqual(['PC-1']);
    expect(store().selectedAreaId).toBeNull();
    expect(drawn(id).className).not.toContain('selected');
  });

  it('a device the app adds and selects stays selected, with an area on the canvas', async () => {
    addPc('PC-1');
    store().addArea(CORE);
    renderCanvas();

    act(() => {
      store().selectMultipleDevices([addPc('PC-2', { x: 200, y: 0 })]);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(selectedDevices()).toEqual(['PC-2']);
    expect(screen.getByText('PC-2').closest('.react-flow__node')!.className).toContain('selected');
    expect(screen.getByText('PC-1').closest('.react-flow__node')!.className).not.toContain('selected');
  });

  it('a click on the empty canvas, or a selection box begun on it, lets go of the selected area', () => {
    const id = store().addArea(CORE);
    renderCanvas();
    act(() => store().selectArea(id));

    // the right button moves the view: the area stays selected
    fireEvent.mouseDown(pane(), { button: RIGHT, clientX: 600, clientY: 500, view: view() });
    fireEvent.mouseUp(pane(), { button: RIGHT, clientX: 600, clientY: 500, view: view() });
    expect(store().selectedAreaId).toBe(id);

    fireEvent.mouseDown(pane(), { button: LEFT, clientX: 600, clientY: 500, view: view() });
    fireEvent.mouseUp(pane(), { button: LEFT, clientX: 600, clientY: 500, view: view() });
    expect(store().selectedAreaId).toBeNull();

    act(() => store().selectArea(id));
    fireEvent.mouseDown(pane(), { button: LEFT, clientX: 600, clientY: 500, view: view() });
    fireEvent.mouseMove(pane(), { clientX: 700, clientY: 560, view: view() });
    expect(document.querySelector('.react-flow__selection')).not.toBeNull();
    fireEvent.mouseUp(pane(), { button: LEFT, clientX: 700, clientY: 560, view: view() });
    expect(store().selectedAreaId).toBeNull();
    // the area itself is still there
    expect(store().areas).toHaveLength(1);
  });

  it('a canvas with an area and no device is not an empty one: the welcome screen stays away', () => {
    useUIStore.setState({ showWelcomeScreen: true });
    const view = renderCanvas();
    expect(screen.getByText('Carica la rete di esempio')).toBeInTheDocument();
    view.unmount();

    store().addArea(CORE);
    renderCanvas();
    expect(screen.queryByText('Carica la rete di esempio')).not.toBeInTheDocument();
  });
});

describe('an area while presenting', () => {
  it('is shown, and there is nothing to take it by: no handle, no side, no menu, no key', () => {
    addPc('PC-1');
    const id = store().addArea(CORE);
    renderCanvas();
    act(() => store().selectArea(id));
    act(() => {
      usePresentationStore.getState().enter();
    });

    const shown = drawn(id);
    expect(shown.className).toContain('readonly');
    expect(shown.className).not.toContain('selected');
    expect(shown).toHaveTextContent('Core');
    expect(shown.querySelector('button, input, .area-edge, .area-resize-handle')).toBeNull();

    fireEvent.contextMenu(shown.querySelector('.area-label')!, { clientX: 140, clientY: 70 });
    expect(useUIStore.getState().contextMenuArea).toBeNull();
    fireEvent.doubleClick(shown.querySelector('.area-label')!);
    expect(store().editingAreaId).toBeNull();
    press('Delete');
    expect(store().areas).toHaveLength(1);
    // (not even with an area selected some other way: while presenting nothing edits the drawing)
    act(() => store().selectArea(id));
    press('Delete');
    expect(store().areas).toHaveLength(1);
    expect(drawn(id).className).not.toContain('selected');
    // a click on it opens no menu of the presentation: it is not a device
    fireEvent.click(areaNode(id), { clientX: 140, clientY: 70 });
    expect(usePresentationStore.getState().menu).toBeNull();
    expect(store().hasUnsavedChanges).toBe(true);
    expect(area(id)).toEqual({ id, ...CORE });
  });
});
