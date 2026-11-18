/**
 * Areas in the selection, with the devices: a selection box that holds an
 * area takes it, Ctrl+click on an area adds it or takes it away, and what is
 * selected is moved, copied and deleted together. The Delete key asks
 * first, in a window of the app, as the menu of the right button does. Two
 * devices or more selected show a button that encloses them in an area.
 *
 * The canvas is the real one (React Flow included), driven with mouse,
 * pointer and keyboard events; the devices are given a size the way a
 * browser gives it (test/measuredCanvas).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from 'reactflow';
import type { CanvasArea } from '@/types';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { stubMeasuringBrowser } from '@/test/measuredCanvas';
import { answerConfirms, settled } from '@/test/confirm';
import NetworkCanvas from './NetworkCanvas';

const LEFT = 0;
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

let flow: ReturnType<typeof useStoreApi> | undefined;
const Grab = () => {
  flow = useStoreApi();
  return null;
};

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function renderCanvas() {
  render(
    <ReactFlowProvider>
      <NetworkCanvas />
      <Grab />
    </ReactFlowProvider>
  );
  await settle();
}

const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
const pane = () => document.querySelector<HTMLElement>('.react-flow__pane')!;
const nodeOf = (label: string) => screen.getByText(label).closest<HTMLElement>('.react-flow__node')!;
const rectangle = () => document.querySelector<HTMLElement>('.react-flow__nodesselection-rect');
const drawn = (id: string) => screen.getByTestId(`area-${id}`);
const labelOf = (id: string) => drawn(id).querySelector<HTMLElement>('.area-label')!;
const area = (id: string) => store().areas.find((entry) => entry.id === id)!;
const labels = () => store().devices.map((d) => d.label);
const selectedDevices = () =>
  store().devices.filter((d) => store().selectedDeviceIds.includes(d.id)).map((d) => d.label);
const places = () => store().devices.map((d) => `${d.label} ${d.position.x},${d.position.y}`);

type Point = { x: number; y: number };

/** Draw a selection box, in two movements of the hand, and let go */
async function drawBox(from: Point, to: Point) {
  fireEvent.mouseDown(pane(), { button: LEFT, clientX: from.x, clientY: from.y, view: view() });
  fireEvent.mouseMove(pane(), { clientX: (from.x + to.x) / 2, clientY: (from.y + to.y) / 2, view: view() });
  await settle();
  fireEvent.mouseMove(pane(), { clientX: to.x, clientY: to.y, view: view() });
  await settle();
  fireEvent.mouseUp(pane(), { button: LEFT, clientX: to.x, clientY: to.y, view: view() });
  await settle();
}

const HOLD: Point = { x: 400, y: 300 };

async function dragGroup(dx: number, dy: number) {
  const grip = rectangle();
  if (!grip) throw new Error('no rectangle around the selection');
  const at = (x: number, y: number) => ({ clientX: HOLD.x + x, clientY: HOLD.y + y, view: view() });
  fireEvent.mouseDown(grip, { button: LEFT, ...at(0, 0) });
  fireEvent.mouseMove(view() as unknown as Element, at(dx / 2, dy / 2));
  fireEvent.mouseMove(view() as unknown as Element, at(dx, dy));
  fireEvent.mouseUp(view() as unknown as Element, at(dx, dy));
  await settle();
}

async function clickDevice(label: string, { ctrl = false } = {}) {
  const mouse = { button: LEFT, clientX: 5, clientY: 5, ctrlKey: ctrl, view: view() };
  if (ctrl) fireEvent.keyDown(document.body, { key: 'Control', ctrlKey: true });
  fireEvent.mouseDown(nodeOf(label), mouse);
  fireEvent.mouseUp(nodeOf(label), mouse);
  if (ctrl) fireEvent.keyUp(document.body, { key: 'Control' });
  await settle();
}

/** Press on the label of an area (with Ctrl, or not), move, let go */
async function pressArea(id: string, { ctrl = false, dx = 0, dy = 0 } = {}) {
  const grip = labelOf(id);
  fireEvent.pointerDown(grip, { button: LEFT, pointerId: 1, clientX: 20, clientY: 20, ctrlKey: ctrl });
  if (dx || dy) fireEvent.pointerMove(window, { pointerId: 1, clientX: 20 + dx, clientY: 20 + dy });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: 20 + dx, clientY: 20 + dy });
  await settle();
}

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.body, { key, code: key, ...init });
  fireEvent.keyUp(document.body, { key, code: key, ...init });
}

beforeEach(() => {
  localStorage.clear();
  stubMeasuringBrowser();
  usePresentationStore.getState().exit();
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], selectedAreaIds: [], selectedAreaId: null, clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false });
  useUIStore.getState().closeContextMenu();
});

afterEach(() => {
  flow = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a selection box', () => {
  it('takes an area it wholly holds, together with the devices', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 600, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();

    await drawBox({ x: 60, y: 20 }, { x: 450, y: 300 });

    expect(selectedDevices()).toEqual(['PC-1']);
    expect(store().selectedAreaIds).toEqual([id]);
    expect(drawn(id).className).toContain('selected');
    // with devices, the area is not the one selected by itself: no handles
    expect(store().selectedAreaId).toBeNull();
    expect(drawn(id).querySelectorAll('.area-resize-handle')).toHaveLength(0);
  });

  it('leaves out an area it does not wholly hold', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    store().addArea(CORE);
    await renderCanvas();

    await drawBox({ x: 120, y: 100 }, { x: 450, y: 300 });

    expect(selectedDevices()).toEqual(['PC-1']);
    expect(store().selectedAreaIds).toEqual([]);
  });

  it('a new box starts a new selection: the areas of the last one are let go', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 700, y: 400 });
    store().addArea(CORE);
    await renderCanvas();
    await drawBox({ x: 60, y: 20 }, { x: 450, y: 300 });

    await drawBox({ x: 650, y: 350 }, { x: 900, y: 550 });

    expect(selectedDevices()).toEqual(['PC-2']);
    expect(store().selectedAreaIds).toEqual([]);
  });
});

describe('Ctrl+click on an area', () => {
  it('adds it to the selection of the devices, and takes it away again', async () => {
    addPc('PC-1', { x: 600, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();
    await clickDevice('PC-1');

    await pressArea(id, { ctrl: true });
    expect(selectedDevices()).toEqual(['PC-1']);
    expect(store().selectedAreaIds).toEqual([id]);
    expect(nodeOf('PC-1').className).toContain('selected');

    await pressArea(id, { ctrl: true });
    expect(selectedDevices()).toEqual(['PC-1']);
    expect(store().selectedAreaIds).toEqual([]);
  });

  it('a device added with Ctrl+click keeps the areas that are selected', async () => {
    addPc('PC-1', { x: 600, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();
    await pressArea(id);

    await clickDevice('PC-1', { ctrl: true });

    expect(selectedDevices()).toEqual(['PC-1']);
    expect(store().selectedAreaIds).toEqual([id]);
  });

  it('a device clicked without Ctrl is the whole selection: the areas are let go', async () => {
    addPc('PC-1', { x: 600, y: 120 });
    addPc('PC-2', { x: 800, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();
    await clickDevice('PC-1');
    await pressArea(id, { ctrl: true });

    await clickDevice('PC-2');

    expect(selectedDevices()).toEqual(['PC-2']);
    expect(store().selectedAreaIds).toEqual([]);
  });
});

describe('what is selected moves together', () => {
  it('the group dragged by its rectangle takes the selected area with it', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 250, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();
    await drawBox({ x: 60, y: 20 }, { x: 450, y: 300 });

    await dragGroup(30, -20);
    await dragGroup(30, -20);

    expect(places()).toEqual(['PC-1 210,80', 'PC-2 310,80']);
    expect(area(id).position).toEqual({ x: 160, y: 10 });
    expect(area(id).size).toEqual(CORE.size);
  });

  it('the area dragged by its label takes the selected devices with it, and nothing else', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 600, y: 120 });
    addPc('PC-3', { x: 800, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();
    await clickDevice('PC-1');
    await clickDevice('PC-2', { ctrl: true });
    await pressArea(id, { ctrl: true });

    await pressArea(id, { dx: 40, dy: 30 });

    expect(area(id).position).toEqual({ x: 140, y: 80 });
    expect(places()).toEqual(['PC-1 190,150', 'PC-2 640,150', 'PC-3 800,120']);
    // and the selection is as it was
    expect(selectedDevices()).toEqual(['PC-1', 'PC-2']);
    expect(store().selectedAreaIds).toEqual([id]);
  });

  it('an area not in the selection, taken by its label, is selected alone and moved alone', async () => {
    addPc('PC-1', { x: 600, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();
    await clickDevice('PC-1');

    await pressArea(id, { dx: 40, dy: 30 });

    expect(area(id).position).toEqual({ x: 140, y: 80 });
    expect(places()).toEqual(['PC-1 600,120']);
    expect(selectedDevices()).toEqual([]);
    expect(store().selectedAreaId).toBe(id);
  });
});

describe('copy and paste with areas', () => {
  it('Ctrl+C and Ctrl+V copy the selected area with the devices, in the same place around them', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    const id = store().addArea(CORE);
    await renderCanvas();
    await drawBox({ x: 60, y: 20 }, { x: 450, y: 300 });

    press('c', { ctrlKey: true });
    press('v', { ctrlKey: true });

    expect(labels()).toEqual(['PC-1', 'PC-2']);
    expect(store().areas).toHaveLength(2);
    const copy = store().areas[1];
    expect(copy.id).not.toBe(id);
    const pasted = store().devices[1].position;
    expect({ x: pasted.x - copy.position.x, y: pasted.y - copy.position.y }).toEqual({ x: 50, y: 70 });
  });
});

describe('the Delete key', () => {
  it('asks first, in a window of the app, as the menu does: no keeps the device, yes deletes it', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 600, y: 120 });
    await renderCanvas();
    await clickDevice('PC-1');
    const answers = answerConfirms(false);

    press('Delete');
    await settled();
    expect(answers.asked).toEqual([
      {
        title: 'Eliminare «PC-1»?',
        detail: 'Con il dispositivo vengono tolte anche le sue connessioni.',
        confirmLabel: 'Elimina',
        danger: true,
      },
    ]);
    expect(labels()).toEqual(['PC-1', 'PC-2']);

    answers.say(true);
    press('Delete');
    await settled();
    expect(labels()).toEqual(['PC-2']);
  });

  it('a cable selected: the question of the cable', async () => {
    const first = addPc('PC-1', { x: 150, y: 120 });
    const second = addPc('PC-2', { x: 600, y: 120 });
    store().addConnection({ source: first, target: second });
    await renderCanvas();
    act(() => flow?.getState().addSelectedEdges([store().connections[0].id]));
    const answers = answerConfirms(true);

    press('Delete');
    await settled();

    expect(answers.asked.map((question) => question.title)).toEqual(['Eliminare questa connessione?']);
    expect(store().connections).toEqual([]);
    expect(labels()).toEqual(['PC-1', 'PC-2']);
  });

  it('devices, a cable and an area selected together: one question, with how many of each, and all go', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 250, y: 120 });
    addPc('PC-3', { x: 700, y: 120 });
    store().addConnection({ source: store().devices[0].id, target: store().devices[1].id });
    const id = store().addArea(CORE);
    await renderCanvas();
    await drawBox({ x: 60, y: 20 }, { x: 450, y: 300 });
    const answers = answerConfirms(true);

    press('Delete');
    await settled();

    expect(answers.asked.map((question) => question.title)).toEqual([
      'Eliminare 2 dispositivi, 1 connessione e 1 riquadro?',
    ]);
    expect(labels()).toEqual(['PC-3']);
    expect(store().connections).toEqual([]);
    expect(store().areas.map((entry) => entry.id)).not.toContain(id);
  });

  it('with nothing selected asks nothing; typing in a field it is a key like any other', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    await renderCanvas();
    const answers = answerConfirms(true);

    press('Delete');
    await settled();
    expect(answers.asked).toEqual([]);

    await clickDevice('PC-1');
    const field = document.body.appendChild(document.createElement('input'));
    fireEvent.keyDown(field, { key: 'Delete', code: 'Delete' });
    await settled();
    expect(answers.asked).toEqual([]);
    expect(labels()).toEqual(['PC-1']);
    field.remove();
  });
});

describe('the button that encloses the selection in an area', () => {
  const button = () => screen.queryByRole('button', { name: 'Racchiudi in un riquadro' });

  it('is there with two devices selected or more, and not with one', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 400, y: 120 });
    await renderCanvas();

    await clickDevice('PC-1');
    expect(button()).toBeNull();

    await clickDevice('PC-2', { ctrl: true });
    expect(button()).not.toBeNull();
  });

  it('draws an area around the selected devices, which is then the selected thing', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 400, y: 120 });
    addPc('PC-3', { x: 900, y: 500 });
    await renderCanvas();
    await clickDevice('PC-1');
    await clickDevice('PC-2', { ctrl: true });

    fireEvent.click(button()!);
    await settle();

    expect(store().areas).toHaveLength(1);
    const made = store().areas[0];
    expect(made.position.x).toBeLessThan(150);
    expect(made.position.x + made.size.width).toBeGreaterThan(400);
    expect(store()).toMatchObject({ selectedAreaId: made.id, selectedDeviceIds: [] });
    expect(button()).toBeNull();
  });

  it('is not there while presenting', async () => {
    addPc('PC-1', { x: 150, y: 120 });
    addPc('PC-2', { x: 400, y: 120 });
    await renderCanvas();
    await clickDevice('PC-1');
    await clickDevice('PC-2', { ctrl: true });

    act(() => {
      usePresentationStore.getState().enter();
    });
    await settle();

    expect(button()).toBeNull();
  });
});
