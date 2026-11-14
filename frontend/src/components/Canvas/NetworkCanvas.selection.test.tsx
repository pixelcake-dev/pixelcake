/**
 * The selection the app knows is the one the canvas shows, whatever was done
 * on the canvas before it changed: a click on an empty spot, a press that was
 * not quite still, the right button, a click on a cable.
 *
 * The canvas is the real one (React Flow included), driven with mouse and
 * keyboard events; only what jsdom lacks is stubbed, and the devices are given
 * a size (test/measuredCanvas), without which a selection box takes them all
 * and no cable is drawn.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { stubMeasuringBrowser } from '@/test/measuredCanvas';
import NetworkCanvas from './NetworkCanvas';

const LEFT = 0;
const RIGHT = 2;

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

/** React Flow's own store: a selected cable is known to it alone */
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

/** Labels of the selected devices, as the app knows them */
const known = () =>
  store().devices.filter((d) => store().selectedDeviceIds.includes(d.id)).map((d) => d.label);
/** Labels of the devices drawn as selected */
const shown = () =>
  store().devices.filter((d) => nodeOf(d.label).className.includes('selected')).map((d) => d.label);

/** Press and release on an empty spot of the canvas, `slip` pixels apart */
async function clickCanvas(slip = 0) {
  const at = { button: LEFT, clientX: 300, clientY: 200, view: view() };
  const end = { ...at, clientX: 300 + slip, clientY: 200 + slip };
  fireEvent.mouseDown(pane(), at);
  if (slip > 0) fireEvent.mouseMove(pane(), end);
  fireEvent.mouseUp(pane(), end);
  fireEvent.click(pane(), end);
  await settle();
}

async function clickDevice(label: string) {
  const mouse = { button: LEFT, clientX: 5, clientY: 5, view: view() };
  fireEvent.mouseDown(nodeOf(label), mouse);
  fireEvent.mouseUp(nodeOf(label), mouse);
  await settle();
}

/** The keyboard way to take a device: Enter on the one that has the focus */
async function enterOn(label: string) {
  nodeOf(label).focus();
  fireEvent.keyDown(nodeOf(label), { key: 'Enter', code: 'Enter' });
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  stubMeasuringBrowser();
  usePresentationStore.getState().exit();
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false });
  useUIStore.getState().closeContextMenu();
});

afterEach(() => {
  flow = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the selection after something else was done on the canvas', () => {
  it('a click on the empty canvas, then on a device: the device is selected, for the app as on screen', async () => {
    addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();

    await clickCanvas();
    await clickDevice('PC-1');

    expect(shown()).toEqual(['PC-1']);
    expect(known()).toEqual(['PC-1']);
    // so it can be copied
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    expect(store().clipboard?.devices.map((d) => d.label)).toEqual(['PC-1']);
  });

  it('and it is still drawn selected once it is moved', async () => {
    const id = addPc('PC-1');
    await renderCanvas();
    await clickCanvas();
    await clickDevice('PC-1');

    act(() => store().updateDevice(id, { position: { x: 80, y: 40 } }));
    await settle();

    expect(shown()).toEqual(['PC-1']);
    expect(known()).toEqual(['PC-1']);
  });

  it('the same after any number of clicks on the empty canvas, and for the device clicked next', async () => {
    addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();

    await clickCanvas();
    await clickCanvas();
    await clickDevice('PC-2');
    expect(known()).toEqual(['PC-2']);

    await clickCanvas();
    expect(shown()).toEqual([]);
    expect(known()).toEqual([]);

    await clickCanvas();
    await clickDevice('PC-1');
    expect(shown()).toEqual(['PC-1']);
    expect(known()).toEqual(['PC-1']);
  });

  it('a click on the empty canvas, then a device taken with the keyboard: the app knows it', async () => {
    addPc('PC-1');
    await renderCanvas();

    await clickCanvas();
    await enterOn('PC-1');

    expect(shown()).toEqual(['PC-1']);
    expect(known()).toEqual(['PC-1']);
  });

  it('a press on the empty canvas that slips a few pixels selects nothing, and the click on a device after it selects', async () => {
    addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();

    await clickCanvas(2);
    expect(shown()).toEqual([]);
    expect(known()).toEqual([]);

    await clickDevice('PC-2');
    expect(shown()).toEqual(['PC-2']);
    expect(known()).toEqual(['PC-2']);
  });

  it('the right button on a device, then a device taken with the keyboard: the app knows it', async () => {
    addPc('PC-1');
    addPc('PC-2', { x: 300, y: 0 });
    await renderCanvas();

    const mouse = { button: RIGHT, clientX: 5, clientY: 5, view: view() };
    fireEvent.mouseDown(nodeOf('PC-1'), mouse);
    fireEvent.mouseUp(nodeOf('PC-1'), mouse);
    fireEvent.contextMenu(nodeOf('PC-1'), mouse);
    await settle();
    await enterOn('PC-2');

    expect(shown()).toEqual(['PC-2']);
    expect(known()).toEqual(['PC-2']);
  });

  it('a click on a cable lets go of the selected devices, for the app too', async () => {
    const first = addPc('PC-1');
    const second = addPc('PC-2', { x: 300, y: 0 });
    store().addConnection({ source: first, target: second });
    await renderCanvas();
    await clickDevice('PC-1');
    expect(known()).toEqual(['PC-1']);

    const cable = document.querySelector<SVGElement>('.react-flow__edge')!;
    const mouse = { button: LEFT, clientX: 150, clientY: 5, view: view() };
    fireEvent.mouseDown(cable, mouse);
    fireEvent.mouseUp(cable, mouse);
    fireEvent.click(cable, mouse);
    await settle();

    expect(flow?.getState().edges[0].selected).toBe(true);
    expect(shown()).toEqual([]);
    expect(known()).toEqual([]);
    // nothing is left to copy
    fireEvent.keyDown(document.body, { key: 'c', ctrlKey: true });
    expect(store().clipboard).toBeNull();
  });
});
