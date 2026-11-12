/**
 * NetworkCanvas in presentation mode — the drawing is shown, not edited: a
 * click opens the presentation menu, nothing can be moved, joined, deleted or
 * pasted, and looking around does not change the saved view. Then the packet
 * animation, which the presentation restarts at every change.
 *
 * The canvas is the real one (React Flow included), driven with mouse and
 * keyboard events; only what jsdom lacks is stubbed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { END_PAUSE_MS, HOP_PAUSE_MS, edgeDuration } from '@/utils/packetTiming';
import NetworkCanvas from './NetworkCanvas';

const LEFT = 0;

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

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();
const simulation = () => useSimulationStore.getState();

function addPc(label: string, x = 0) {
  network().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x, y: 0 },
  });
}

const idOf = (label: string) => network().devices.find(d => d.label === label)!.id;
const labels = () => network().devices.map(d => d.label);

function renderCanvas() {
  return render(
    <ReactFlowProvider>
      <NetworkCanvas />
    </ReactFlowProvider>
  );
}

const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
const pane = () => document.querySelector<HTMLElement>('.react-flow__pane')!;
const viewport = () =>
  document.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform;
const nodeOf = (label: string) => screen.getByText(label).closest<HTMLElement>('.react-flow__node')!;

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function selectDevice(label: string) {
  const mouse = { button: LEFT, clientX: 5, clientY: 5, view: view() };
  fireEvent.mouseDown(nodeOf(label), mouse);
  fireEvent.mouseUp(nodeOf(label), mouse);
  await settle();
}

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.body, { key, code: key, ...init });
  fireEvent.keyUp(document.body, { key, code: key, ...init });
}

async function present() {
  act(() => {
    expect(presentation().enter()).toBe(true);
  });
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  stubBrowser();
  presentation().exit();
  simulation().resetSimulation();
  simulation().setSpeed(1);
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false });
  useUIStore.getState().closeContextMenu();
  useUIStore.getState().closeModal('inspector');
});

afterEach(() => {
  act(() => presentation().exit());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('NetworkCanvas — presentation mode', () => {
  it('a click on a device opens the presentation menu where the click was, and selects nothing', async () => {
    addPc('PC-1');
    renderCanvas();
    await present();

    fireEvent.click(nodeOf('PC-1'), { clientX: 120, clientY: 80 });
    await settle();

    expect(presentation().menu).toEqual({ kind: 'device', id: idOf('PC-1'), x: 120, y: 80 });
    await selectDevice('PC-1');
    expect(network().selectedDeviceIds).toEqual([]);
  });

  it('outside presentation mode a click opens no such menu', async () => {
    addPc('PC-1');
    renderCanvas();

    fireEvent.click(nodeOf('PC-1'), { clientX: 120, clientY: 80 });
    await settle();

    expect(presentation().menu).toBeNull();
  });

  it('the right button opens the same menu, not the one for editing', async () => {
    addPc('PC-1');
    renderCanvas();
    await present();

    fireEvent.contextMenu(screen.getByText('PC-1').closest('.network-device')!, { clientX: 40, clientY: 50 });

    expect(presentation().menu).toEqual({ kind: 'device', id: idOf('PC-1'), x: 40, y: 50 });
    expect(useUIStore.getState().contextMenuDevice).toBeNull();
  });

  it('a double click does not open the inspector', async () => {
    addPc('PC-1');
    renderCanvas();

    // while building it does
    fireEvent.doubleClick(screen.getByText('PC-1').closest('.network-device')!);
    expect(useUIStore.getState().modals.inspector).toBe(true);
    act(() => useUIStore.getState().closeModal('inspector'));

    await present();
    fireEvent.doubleClick(screen.getByText('PC-1').closest('.network-device')!);
    expect(useUIStore.getState().modals.inspector).toBe(false);
  });

  it('a double click does not zoom the view either', async () => {
    /** The zoom of a double click glides: give it the time to get there */
    const afterTheGlide = () =>
      act(async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
      });
    addPc('PC-1');
    renderCanvas();

    // while building, a double click on an empty spot zooms in
    fireEvent.doubleClick(pane(), { clientX: 300, clientY: 300, view: view() });
    await afterTheGlide();
    expect(viewport()).toMatch(/scale\(2\)$/);

    await present();
    const before = viewport();
    fireEvent.doubleClick(nodeOf('PC-1'), { clientX: 60, clientY: 40, view: view() });
    fireEvent.doubleClick(pane(), { clientX: 300, clientY: 300, view: view() });
    await afterTheGlide();

    expect(viewport()).toBe(before);
  });

  it('a click with a hand that is not perfectly still is still a click', async () => {
    addPc('PC-1');
    renderCanvas();
    await present();
    const before = viewport();
    const node = nodeOf('PC-1').querySelector<HTMLElement>('.network-device')!;

    // the mouse moves a couple of pixels between press and release
    fireEvent.mouseDown(node, { button: LEFT, clientX: 60, clientY: 40, view: view() });
    fireEvent.mouseMove(node, { clientX: 62, clientY: 41, view: view() });
    fireEvent.mouseUp(node, { button: LEFT, clientX: 62, clientY: 41, view: view() });
    fireEvent.click(node, { clientX: 62, clientY: 41, view: view() });

    expect(presentation().menu).toEqual({ kind: 'device', id: idOf('PC-1'), x: 62, y: 41 });
    // and the press on the device did not start moving the view
    expect(viewport()).toBe(before);
  });

  it('a click on an empty spot closes the menu', async () => {
    addPc('PC-1');
    renderCanvas();
    await present();
    fireEvent.click(nodeOf('PC-1'), { clientX: 120, clientY: 80 });
    expect(presentation().menu).not.toBeNull();

    fireEvent.click(pane());

    expect(presentation().menu).toBeNull();
  });

  it('Delete deletes nothing', async () => {
    addPc('PC-1');
    addPc('PC-2');
    renderCanvas();
    await selectDevice('PC-1');
    await present();
    await selectDevice('PC-2');

    press('Delete');

    expect(labels()).toEqual(['PC-1', 'PC-2']);
  });

  it('Ctrl+V pastes nothing, even with devices copied before', async () => {
    addPc('PC-1');
    renderCanvas();
    await selectDevice('PC-1');
    press('c', { ctrlKey: true });
    expect(network().clipboard?.devices).toHaveLength(1);
    await present();

    const paste = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true });
    fireEvent(window, paste);

    expect(labels()).toEqual(['PC-1']);
    expect(paste.defaultPrevented).toBe(false);
  });

  it('dragging with the left button pans instead of drawing a selection box, and the saved view stays', async () => {
    addPc('PC-1');
    network().setViewport({ x: 7, y: 9, zoom: 1 });
    renderCanvas();
    await present();
    const before = viewport();

    fireEvent.mouseDown(pane(), { button: LEFT, clientX: 100, clientY: 100, view: view() });
    fireEvent.mouseMove(pane(), { clientX: 150, clientY: 130, view: view() });
    expect(document.querySelector('.react-flow__selection')).toBeNull();
    expect(viewport()).not.toBe(before);
    fireEvent.mouseUp(pane(), { button: LEFT, clientX: 150, clientY: 130, view: view() });
    await settle();

    expect(network().viewport).toEqual({ x: 7, y: 9, zoom: 1 });
  });

  it('zooming does not change the saved view either', async () => {
    addPc('PC-1');
    renderCanvas();
    await present();

    fireEvent.wheel(pane(), { deltaY: -100, clientX: 0, clientY: 0, view: view() });
    await settle();

    expect(viewport()).toMatch(/scale\(1\.1\d*\)$/);
    expect(network().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('on the way out the drawing is back where it was left while building', async () => {
    addPc('PC-1');
    network().setViewport({ x: 7, y: 9, zoom: 1 });
    renderCanvas();
    await present();
    fireEvent.wheel(pane(), { deltaY: -100, clientX: 0, clientY: 0, view: view() });
    expect(viewport()).not.toBe('translate(7px,9px) scale(1)');

    act(() => presentation().exit());

    // it glides back: wait for it to get there
    await waitFor(() => expect(viewport()).toBe('translate(7px,9px) scale(1)'));
  });

  it('puts the small map and the welcome screen away', async () => {
    renderCanvas();
    expect(document.querySelector('.react-flow__minimap')).not.toBeNull();

    addPc('PC-1');
    await present();
    expect(document.querySelector('.react-flow__minimap')).toBeNull();

    // the last device removed from the terminal: still no welcome screen
    act(() => {
      useUIStore.setState({ showWelcomeScreen: true });
      network().removeDevice(idOf('PC-1'));
    });
    expect(screen.queryByText(/Benvenuto/i)).toBeNull();
  });

  it('marks the two ends of the question and a broken device on the drawing', async () => {
    addPc('PC-1');
    addPc('PC-2', 200);
    addPc('PC-3', 400);
    renderCanvas();
    await present();

    act(() => {
      presentation().ask(idOf('PC-1'), idOf('PC-2'));
      presentation().toggleDeviceFailure(idOf('PC-3'));
    });

    expect(nodeOf('PC-1').querySelector('.device-role')?.textContent).toBe('Da');
    expect(nodeOf('PC-2').querySelector('.device-role')?.textContent).toBe('A');
    expect(nodeOf('PC-3').querySelector('.device-role')).toBeNull();
    expect(nodeOf('PC-3').querySelector('.network-device')?.className).toContain('device-failed');
    expect(nodeOf('PC-3').textContent).toContain('Guasto simulato');
    expect(nodeOf('PC-1').querySelector('.network-device')?.className).not.toContain('device-failed');

    // and nothing of it is left once the presentation is over
    act(() => presentation().exit());
    expect(document.querySelector('.device-role, .device-failed')).toBeNull();
  });
});

describe('NetworkCanvas — the packet animation', () => {
  /** PC-1 and PC-2 joined by two cables, PC-2 and PC-3 by one */
  function drawing() {
    addPc('PC-1', 0);
    addPc('PC-2', 300);
    addPc('PC-3', 600);
    const [a, b, c] = ['PC-1', 'PC-2', 'PC-3'].map(idOf);
    network().addConnection({ source: a, target: b });
    network().addConnection({ source: b, target: a });
    network().addConnection({ source: b, target: c });
    const cables = network().connections;
    return { a, b, c, first: cables[0].id, second: cables[1].id, last: cables[2].id };
  }

  /** Let `ms` pass, and what was waiting for it go on */
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  /** The time the packet takes on a cable between two devices 300 units apart */
  const HOP = edgeDuration(300, 1);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  it('travels cable by cable, stops on each device, and ends by itself', async () => {
    const { a, b, c, first, last } = drawing();
    renderCanvas();

    act(() => {
      simulation().startSimulation([a, b, c], 'ping');
    });
    expect(simulation()).toMatchObject({
      isRunning: true,
      currentHop: 0,
      activeDeviceId: a,
      currentConnectionId: first,
      currentEdgeDuration: HOP,
      isPacketReversed: false,
    });

    await advance(HOP);
    expect(simulation()).toMatchObject({ currentHop: 0, activeDeviceId: b });

    await advance(HOP_PAUSE_MS);
    expect(simulation()).toMatchObject({ currentHop: 1, activeDeviceId: b, currentConnectionId: last });

    await advance(HOP);
    expect(simulation()).toMatchObject({ isRunning: true, activeDeviceId: c, currentConnectionId: null });

    await advance(END_PAUSE_MS);
    expect(simulation()).toMatchObject({ isRunning: false, activeDeviceId: null, currentConnectionId: null });
  });

  it('takes the cable the engine named, and knows which way it is drawn', async () => {
    const { a, b, second } = drawing();
    renderCanvas();

    act(() => {
      simulation().startSimulation([a, b], 'ping', [second]);
    });

    // `second` is drawn from PC-2 to PC-1: the packet runs it backwards
    expect(simulation()).toMatchObject({ currentConnectionId: second, isPacketReversed: true });
  });

  it('with no cable named, leaves the one cut in the presentation for its twin', async () => {
    const { a, b, first, second } = drawing();
    renderCanvas();
    act(() => {
      presentation().enter();
      presentation().toggleConnectionFailure(first);
    });

    act(() => {
      simulation().startSimulation([a, b], 'ping');
    });

    expect(simulation().currentConnectionId).toBe(second);
  });

  it('goes twice as fast at double speed', async () => {
    const { a, b } = drawing();
    renderCanvas();
    act(() => simulation().setSpeed(2));

    act(() => {
      simulation().startSimulation([a, b], 'ping');
    });
    expect(simulation().currentEdgeDuration).toBe(HOP / 2);

    await advance(HOP / 2);
    expect(simulation().activeDeviceId).toBe(b);
    await advance(END_PAUSE_MS / 2);
    expect(simulation().isRunning).toBe(false);
  });

  it('a new run takes over at once: the old one never moves the packet again', async () => {
    const { a, b, c, first, last } = drawing();
    renderCanvas();

    act(() => {
      simulation().startSimulation([a, b, c], 'ping');
    });
    await advance(HOP / 2);

    // half way along the first cable, another question is asked
    act(() => {
      simulation().startSimulation([c, b], 'web');
    });
    expect(simulation()).toMatchObject({
      flowModel: 'web',
      currentHop: 0,
      activeDeviceId: c,
      currentConnectionId: last,
      isPacketReversed: true,
    });

    // the moment the old run would have reached PC-2 and moved on
    await advance(HOP / 2);
    await advance(HOP_PAUSE_MS);
    expect(simulation()).toMatchObject({ currentHop: 0, isRunning: true });
    expect(simulation().currentConnectionId).not.toBe(first);

    // the new run ends on its own time, once: it has been on its cable for
    // half a hop and a pause, the rest of the hop takes it to PC-2
    await advance(HOP - HOP / 2 - HOP_PAUSE_MS);
    expect(simulation()).toMatchObject({ isRunning: true, activeDeviceId: b });
    await advance(END_PAUSE_MS);
    expect(simulation().isRunning).toBe(false);
  });

  it('stopped half way, it stays stopped', async () => {
    const { a, b, c } = drawing();
    renderCanvas();
    act(() => {
      simulation().startSimulation([a, b, c], 'ping');
    });
    await advance(HOP / 2);

    act(() => simulation().stopSimulation());
    await advance(10_000);

    expect(simulation()).toMatchObject({
      isRunning: false,
      currentHop: 0,
      activeDeviceId: null,
      currentConnectionId: null,
    });
  });

  it('ends at once when there is nowhere to go', async () => {
    const { a } = drawing();
    renderCanvas();

    act(() => {
      simulation().startSimulation([a], 'ping');
    });

    expect(simulation().isRunning).toBe(false);
  });

  it('skips a stretch whose cable was removed meanwhile, and goes on', async () => {
    const { a, b, c, first, second, last } = drawing();
    renderCanvas();
    act(() => {
      network().removeConnection(first);
      network().removeConnection(second);
    });

    act(() => {
      simulation().startSimulation([a, b, c], 'ping');
    });

    expect(simulation()).toMatchObject({ isRunning: true, currentHop: 1, currentConnectionId: last });
  });

  it('shows on the device that the packet is stopping there', async () => {
    const { a, b } = drawing();
    renderCanvas();

    act(() => {
      simulation().startSimulation([a, b], 'ping');
    });
    expect(nodeOf('PC-1').querySelector('.network-device')?.className).toContain('device-has-packet');
    expect(nodeOf('PC-2').querySelector('.network-device')?.className).not.toContain('device-has-packet');

    await advance(HOP);
    expect(nodeOf('PC-2').querySelector('.network-device')?.className).toContain('device-has-packet');
    expect(nodeOf('PC-1').querySelector('.network-device')?.className).not.toContain('device-has-packet');

    await advance(END_PAUSE_MS);
    expect(document.querySelector('.device-has-packet')).toBeNull();
  });
});
