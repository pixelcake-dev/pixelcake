/**
 * The view that is stored with the drawing is the one on screen, whoever
 * moved it: the pointer, or the app (the drawing fitted to the window, the
 * zoom buttons of the canvas). It is what a reload of the page comes back to.
 *
 * The canvas is the real one (React Flow included); what jsdom lacks is
 * stubbed, and the devices are given a size (test/measuredCanvas), without
 * which nothing can be fitted.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, fireEvent, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { stubMeasuringBrowser } from '@/test/measuredCanvas';
import NetworkCanvas from './NetworkCanvas';

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

const later = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

/** The canvas, once React Flow has measured what is on it */
async function renderCanvas() {
  const rendered = render(
    <ReactFlowProvider>
      <NetworkCanvas />
    </ReactFlowProvider>
  );
  await later(0);
  return rendered;
}

/** jsdom's own window: React Flow follows a drag through `event.view` */
const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
const pane = () => document.querySelector<HTMLElement>('.react-flow__pane')!;

interface View {
  x: number;
  y: number;
  zoom: number;
}

/** The view on screen, read from the drawing itself */
function onScreen(): View {
  const transform = document.querySelector<HTMLElement>('.react-flow__viewport')!.style.transform;
  const [x, y, zoom] = (transform.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
  return { x, y, zoom };
}

const START: View = { x: 0, y: 0, zoom: 1 };
/** Longer than the canvas waits for a view to come to rest */
const WELL_AT_REST = 400;

let stopListening: (() => void) | undefined;

/** Every view written to the store from now to the end of the test */
function viewsStored(): View[] {
  const written: View[] = [];
  let last = store().viewport;
  stopListening = useNetworkStore.subscribe((state) => {
    if (state.viewport !== last) {
      last = state.viewport;
      written.push(state.viewport);
    }
  });
  return written;
}

/** A drawing wider than the canvas: fitting it zooms out */
function wideDrawing() {
  addPc('PC-1', { x: 0, y: 0 });
  addPc('PC-2', { x: 3000, y: 1200 });
}

beforeEach(() => {
  localStorage.clear();
  stubMeasuringBrowser();
  usePresentationStore.getState().exit();
  createNewProject({ name: 'Sede Milano' });
  useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
  useUIStore.setState({ showWelcomeScreen: false });
});

afterEach(() => {
  stopListening?.();
  stopListening = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the view the app moves', () => {
  it('the drawing fitted to the window (a sample just loaded, Vista → Adatta alla finestra) is the view that is stored', async () => {
    wideDrawing();
    await renderCanvas();
    expect(onScreen()).toEqual(START);

    act(() => store().triggerFitView());

    await waitFor(() => expect(onScreen().zoom).toBeLessThan(0.5), { timeout: 3000 });
    await waitFor(() => expect(store().viewport).toEqual(onScreen()), { timeout: 3000 });
    expect(store().viewport.zoom).toBeLessThan(0.5);
    // and it is not an edit of the drawing
    expect(store().viewport).not.toEqual(START);
  });

  it('some devices asked to be shown (a batch just added): those are brought into view, without zooming in', async () => {
    addPc('PC-1', { x: 0, y: 0 });
    const far = [addPc('PC-2', { x: 3000, y: 1200 }), addPc('PC-3', { x: 3160, y: 1200 })];
    await renderCanvas();
    expect(onScreen()).toEqual(START);

    act(() => store().triggerFitView(far));

    await waitFor(() => expect(onScreen().x).toBeLessThan(-2000), { timeout: 3000 });
    await waitFor(() => expect(store().viewport).toEqual(onScreen()), { timeout: 3000 });
    // the two are on screen, at the zoom there was: the rest of the drawing is not
    const { x, y, zoom } = onScreen();
    expect(zoom).toBe(1);
    for (const left of [3000, 3160]) {
      expect(left * zoom + x).toBeGreaterThanOrEqual(0);
      expect(left * zoom + x).toBeLessThanOrEqual(1000);
    }
    expect(1200 * zoom + y).toBeGreaterThanOrEqual(0);
    expect(1200 * zoom + y).toBeLessThanOrEqual(600);
    expect(0 * zoom + x).toBeLessThan(0);
  });

  it('is stored once, when it has come to rest, not at every step on the way', async () => {
    wideDrawing();
    await renderCanvas();
    const written = viewsStored();

    act(() => store().triggerFitView());
    await waitFor(() => expect(store().viewport).not.toEqual(START), { timeout: 3000 });
    await later(WELL_AT_REST);

    // (an animation of 300 ms that stalls can come to rest twice on its way, not more)
    expect(written.length).toBeGreaterThanOrEqual(1);
    expect(written.length).toBeLessThanOrEqual(3);
    expect(written[written.length - 1]).toEqual(onScreen());
  });

  it('the zoom and the fit buttons of the canvas store the view they make', async () => {
    wideDrawing();
    await renderCanvas();

    fireEvent.click(document.querySelector('.react-flow__controls-zoomin')!);
    await waitFor(() => expect(onScreen().zoom).toBeCloseTo(1.2), { timeout: 3000 });
    await waitFor(() => expect(store().viewport).toEqual(onScreen()), { timeout: 3000 });

    fireEvent.click(document.querySelector('.react-flow__controls-zoomout')!);
    fireEvent.click(document.querySelector('.react-flow__controls-zoomout')!);
    await waitFor(() => expect(onScreen().zoom).toBeLessThan(1), { timeout: 3000 });
    await waitFor(() => expect(store().viewport).toEqual(onScreen()), { timeout: 3000 });

    fireEvent.click(document.querySelector('.react-flow__controls-fitview')!);
    await waitFor(() => expect(onScreen().zoom).toBeLessThan(0.5), { timeout: 3000 });
    await waitFor(() => expect(store().viewport).toEqual(onScreen()), { timeout: 3000 });
  });

  it('a pan with the pointer is stored at its end, once', async () => {
    wideDrawing();
    await renderCanvas();
    const written = viewsStored();

    fireEvent.mouseDown(pane(), { button: RIGHT, clientX: 100, clientY: 100, view: view() });
    fireEvent.mouseMove(pane(), { clientX: 150, clientY: 130, view: view() });
    fireEvent.mouseUp(pane(), { button: RIGHT, clientX: 150, clientY: 130, view: view() });
    await waitFor(() => expect(store().viewport).toEqual({ x: 50, y: 30, zoom: 1 }));
    await later(WELL_AT_REST);

    expect(written).toEqual([{ x: 50, y: 30, zoom: 1 }]);
  });

  it('a view that has not come to rest when the canvas goes away is not stored, nor is anything else', async () => {
    wideDrawing();
    const { unmount } = await renderCanvas();
    // the view that is stored: panned with the pointer
    fireEvent.mouseDown(pane(), { button: RIGHT, clientX: 100, clientY: 100, view: view() });
    fireEvent.mouseMove(pane(), { clientX: 150, clientY: 130, view: view() });
    fireEvent.mouseUp(pane(), { button: RIGHT, clientX: 150, clientY: 130, view: view() });
    await waitFor(() => expect(store().viewport).toEqual({ x: 50, y: 30, zoom: 1 }));

    fireEvent.click(document.querySelector('.react-flow__controls-zoomin')!);
    await waitFor(() => expect(onScreen().zoom).toBeCloseTo(1.2), { timeout: 3000 });
    unmount();
    await later(WELL_AT_REST);

    // (React Flow forgets its view when it goes: that is not a view to store)
    expect(store().viewport).toEqual({ x: 50, y: 30, zoom: 1 });
  });
});

describe('the view of a presentation', () => {
  it('is fitted for the presentation and never stored; leaving gives back the view one was building in', async () => {
    wideDrawing();
    await renderCanvas();
    // the view one is building in: zoomed with the button of the canvas
    fireEvent.click(document.querySelector('.react-flow__controls-zoomin')!);
    await waitFor(() => expect(store().viewport.zoom).toBeCloseTo(1.2), { timeout: 3000 });
    const building = store().viewport;
    const written = viewsStored();

    act(() => {
      usePresentationStore.getState().enter();
    });
    await waitFor(() => expect(onScreen().zoom).toBeLessThan(0.5), { timeout: 3000 });
    await later(WELL_AT_REST);
    expect(store().viewport).toEqual(building);

    act(() => usePresentationStore.getState().exit());
    await waitFor(() => expect(onScreen()).toEqual(building), { timeout: 3000 });
    await later(WELL_AT_REST);

    expect(store().viewport).toEqual(building);
    expect(onScreen()).toEqual(building);
    // nothing but the view of before was ever written
    expect(written.every((stored) => stored.zoom === building.zoom && stored.x === building.x && stored.y === building.y)).toBe(true);
  });

  it('a drawing fitted while building, then presented and left: the fitted view comes back', async () => {
    wideDrawing();
    await renderCanvas();
    act(() => store().triggerFitView());
    await waitFor(() => expect(store().viewport.zoom).toBeLessThan(0.5), { timeout: 3000 });
    const fitted = store().viewport;

    act(() => {
      usePresentationStore.getState().enter();
    });
    await later(WELL_AT_REST * 2);
    act(() => usePresentationStore.getState().exit());

    await waitFor(() => expect(onScreen()).toEqual(fitted), { timeout: 3000 });
    expect(store().viewport).toEqual(fitted);
  });
});
