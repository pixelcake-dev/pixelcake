/**
 * A device keeps the size React Flow measured, whatever changes in the
 * drawing. React Flow needs that size for more than drawing: the rectangle
 * around a group taken with a box is made from it, and a device without one
 * counts as inside any selection box.
 *
 * The canvas is the real one (React Flow included), driven with mouse
 * events; what jsdom lacks is stubbed, and the devices are given a size the
 * way a browser gives it (test/measuredCanvas).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { NODE_SIZE, stubMeasuringBrowser, type Measurements } from '@/test/measuredCanvas';
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

/** React Flow's own store: the sizes it knows are there */
let flow: ReturnType<typeof useStoreApi> | undefined;
const Grab = () => {
  flow = useStoreApi();
  return null;
};

/** A user's gestures are separate events with time between them */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/**
 * Between two events of the mouse, however close: what the canvas put off
 * to the end of the first has run, and no time has passed, so nothing has
 * been measured in between
 */
const nextEvent = () => Promise.resolve();

/** The canvas, once React Flow has measured what is on it */
async function renderCanvas() {
  render(
    <ReactFlowProvider>
      <NetworkCanvas />
      <Grab />
    </ReactFlowProvider>
  );
  await settle();
}

/** jsdom's own window: React Flow follows a drag through `event.view` */
const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
const pane = () => document.querySelector<HTMLElement>('.react-flow__pane')!;
const nodeOf = (label: string) => screen.getByText(label).closest<HTMLElement>('.react-flow__node')!;
const rectangle = () => document.querySelector<HTMLElement>('.react-flow__nodesselection-rect');

/** Labels of the selected devices, as the app knows them */
const known = () =>
  store().devices.filter((d) => store().selectedDeviceIds.includes(d.id)).map((d) => d.label);
/** Labels of the devices drawn as selected */
const shown = () =>
  store().devices.filter((d) => nodeOf(d.label).className.includes('selected')).map((d) => d.label);
const places = () => store().devices.map((d) => `${d.label} ${d.position.x},${d.position.y}`);
/** The sizes React Flow has for the devices, right now */
const sizes = () => flow!.getState().getNodes().map((node) => `${node.width}x${node.height}`);

type Point = { x: number; y: number };

/** Draw a selection box; the release comes a moment after the last movement, as a hand does it */
async function drawBox(from: Point, to: Point) {
  fireEvent.mouseDown(pane(), { button: LEFT, clientX: from.x, clientY: from.y, view: view() });
  fireEvent.mouseMove(pane(), { clientX: to.x, clientY: to.y, view: view() });
  await settle();
  fireEvent.mouseUp(pane(), { button: LEFT, clientX: to.x, clientY: to.y, view: view() });
  await settle();
}

/** Where the pointer takes hold: well inside the canvas, which moves its view when something is dragged near its border */
const HOLD: Point = { x: 400, y: 300 };

/** Take the rectangle around the selected group and move it */
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

async function clickDevice(label: string) {
  const mouse = { button: LEFT, clientX: 5, clientY: 5, view: view() };
  fireEvent.mouseDown(nodeOf(label), mouse);
  fireEvent.mouseUp(nodeOf(label), mouse);
  await settle();
}

let measurements: Measurements;

beforeEach(() => {
  localStorage.clear();
  measurements = stubMeasuringBrowser();
  usePresentationStore.getState().exit();
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false });
});

afterEach(() => {
  flow = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the size of a device', () => {
  it('is measured once, and kept when the drawing changes', async () => {
    const first = addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();
    const measured = `${NODE_SIZE.width}x${NODE_SIZE.height}`;
    expect(sizes()).toEqual([measured, measured]);
    expect(measurements.asked()).toBe(2);

    // moved, selected, renamed: React Flow has its size at once, without asking again
    act(() => store().updateDevice(first, { position: { x: 40, y: 20 } }));
    expect(sizes()).toEqual([measured, measured]);
    act(() => store().selectMultipleDevices([first]));
    expect(sizes()).toEqual([measured, measured]);
    act(() => store().updateDevice(first, { label: 'PC-Contabilità' }));
    expect(sizes()).toEqual([measured, measured]);

    await settle();
    expect(measurements.asked()).toBe(2);
    expect(sizes()).toEqual([measured, measured]);
  });

  it('is all that is kept: what changes in the drawing reaches the canvas as before', async () => {
    const first = addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();
    expect(nodeOf('PC-1').style.transform).toBe('translate(0px,0px)');

    act(() => store().updateDevice(first, { position: { x: 40, y: 20 } }));
    expect(nodeOf('PC-1').style.transform).toBe('translate(40px,20px)');

    act(() => store().updateDevice(first, { label: 'PC-Contabilità' }));
    expect(screen.queryByText('PC-1')).toBeNull();
    expect(nodeOf('PC-Contabilità').style.transform).toBe('translate(40px,20px)');

    act(() => store().selectMultipleDevices([first]));
    await settle();
    expect(shown()).toEqual(['PC-Contabilità']);
    act(() => store().selectMultipleDevices([]));
    await settle();
    expect(shown()).toEqual([]);
    expect(known()).toEqual([]);
  });

  it('is asked for a device that was not there, and for that one alone', async () => {
    addPc('PC-1');
    await renderCanvas();
    expect(measurements.asked()).toBe(1);

    act(() => {
      addPc('PC-2', { x: 300, y: 0 });
    });
    expect(sizes()).toEqual(['70x68', 'undefinedxundefined']);
    await settle();

    expect(measurements.asked()).toBe(2);
    expect(sizes()).toEqual(['70x68', '70x68']);
  });

  it('follows the device when it grows, and the new size is the one kept', async () => {
    const first = addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();

    act(() => measurements.resize(nodeOf('PC-1'), { width: 120, height: 68 }));
    expect(sizes()).toEqual(['120x68', '70x68']);

    act(() => store().updateDevice(first, { position: { x: 40, y: 20 } }));
    expect(sizes()).toEqual(['120x68', '70x68']);
  });

  it('is its own for an area: the one the drawing gives it, not the one it had', async () => {
    addPc('PC-1');
    const id = store().addArea({
      label: 'Core',
      color: 'violet',
      position: { x: 100, y: 50 },
      size: { width: 300, height: 200 },
    });
    await renderCanvas();
    const areaSize = () => {
      const node = flow!.getState().getNodes().find((entry) => entry.id === id)!;
      return `${node.width}x${node.height}`;
    };
    expect(areaSize()).toBe('300x200');

    act(() => store().updateArea(id, { size: { width: 420, height: 260 } }));

    expect(areaSize()).toBe('420x260');
  });

  it('is not kept for another drawing: the devices of a canvas that comes on screen are measured', async () => {
    addPc('PC-1');
    await renderCanvas();
    expect(measurements.asked()).toBe(1);

    act(() => store().clearAllDevices());
    act(() => {
      addPc('Server-1', { x: 100, y: 100 });
    });
    await settle();

    expect(measurements.asked()).toBe(2);
    expect(sizes()).toEqual(['70x68']);
  });
});

describe('a group taken with a selection box', () => {
  it('two devices in a row are dragged as many times as one likes', async () => {
    addPc('PC-1', { x: 0, y: 0 });
    addPc('PC-2', { x: 300, y: 0 });
    addPc('PC-3', { x: 0, y: 400 });
    await renderCanvas();

    await drawBox({ x: -20, y: -20 }, { x: 400, y: 100 });
    expect(known()).toEqual(['PC-1', 'PC-2']);
    expect(rectangle()).not.toBeNull();

    await dragGroup(30, -20);
    expect(places()).toEqual(['PC-1 30,-20', 'PC-2 330,-20', 'PC-3 0,400']);
    await dragGroup(30, -20);
    expect(places()).toEqual(['PC-1 60,-40', 'PC-2 360,-40', 'PC-3 0,400']);
    await dragGroup(-10, 50);
    expect(places()).toEqual(['PC-1 50,10', 'PC-2 350,10', 'PC-3 0,400']);

    // and they are the selection all along
    expect(known()).toEqual(['PC-1', 'PC-2']);
    expect(shown()).toEqual(['PC-1', 'PC-2']);
    expect(rectangle()).not.toBeNull();
  });

  it('two devices in a column too', async () => {
    addPc('PC-1', { x: 0, y: 0 });
    addPc('PC-2', { x: 0, y: 200 });
    await renderCanvas();

    await drawBox({ x: -20, y: -20 }, { x: 100, y: 300 });
    expect(known()).toEqual(['PC-1', 'PC-2']);

    await dragGroup(30, -20);
    await dragGroup(30, -20);
    await dragGroup(30, -20);

    expect(places()).toEqual(['PC-1 90,-60', 'PC-2 90,140']);
    expect(known()).toEqual(['PC-1', 'PC-2']);
  });

  it('the rectangle around the group is the same one while it is dragged: as large as the devices, never gone', async () => {
    addPc('PC-1', { x: 0, y: 0 });
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();
    await drawBox({ x: -20, y: -20 }, { x: 400, y: 100 });
    const grip = rectangle()!;
    expect(grip.style.width).toBe('370px');
    expect(grip.style.height).toBe('68px');

    fireEvent.mouseDown(grip, { button: LEFT, clientX: HOLD.x, clientY: HOLD.y, view: view() });
    fireEvent.mouseMove(view() as unknown as Element, { clientX: HOLD.x + 30, clientY: HOLD.y - 20, view: view() });

    // in the middle of the drag, before anything could be measured again
    expect(rectangle()).toBe(grip);
    expect(grip.style.width).toBe('370px');
    expect(grip.style.height).toBe('68px');
    fireEvent.mouseUp(view() as unknown as Element, { clientX: HOLD.x + 30, clientY: HOLD.y - 20, view: view() });
    await settle();
    expect(rectangle()).toBe(grip);
  });
});

describe('a press on the empty canvas that is not quite still', () => {
  it('with a device selected, lets go of it and selects nothing else', async () => {
    addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    addPc('PC-3', { x: 0, y: 300 });
    await renderCanvas();
    await clickDevice('PC-1');
    expect(known()).toEqual(['PC-1']);

    // the press, and the first movement right after it: the hand slips 2 pixels
    fireEvent.mouseDown(pane(), { button: LEFT, clientX: 600, clientY: 300, view: view() });
    await nextEvent();
    fireEvent.mouseMove(pane(), { clientX: 602, clientY: 302, view: view() });
    expect(shown()).toEqual([]);
    fireEvent.mouseUp(pane(), { button: LEFT, clientX: 602, clientY: 302, view: view() });
    await settle();

    expect(shown()).toEqual([]);
    expect(known()).toEqual([]);
  });

  it('a box drawn at once after a device was let go takes what it holds, not every device', async () => {
    addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    addPc('PC-3', { x: 0, y: 300 });
    await renderCanvas();
    await clickDevice('PC-3');

    fireEvent.mouseDown(pane(), { button: LEFT, clientX: 250, clientY: -20, view: view() });
    await nextEvent();
    fireEvent.mouseMove(pane(), { clientX: 400, clientY: 100, view: view() });
    await nextEvent();
    fireEvent.mouseUp(pane(), { button: LEFT, clientX: 400, clientY: 100, view: view() });
    await settle();

    expect(shown()).toEqual(['PC-2']);
    expect(known()).toEqual(['PC-2']);
  });
});
