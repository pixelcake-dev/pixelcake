/**
 * NetworkCanvas tests — what the mouse and the keyboard do on the canvas.
 * These are the behaviours listed under Impostazioni → Avanzate and in the
 * guide: if one of them changes, that text has to change with it.
 *
 * The canvas is the real one (React Flow included) and it is driven with
 * mouse and keyboard events, as a user would; only what jsdom lacks is
 * stubbed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { answerConfirms, settled } from '@/test/confirm';
import NetworkCanvas from './NetworkCanvas';

/** MouseEvent.button values */
const LEFT = 0;
const MIDDLE = 1;
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

function addPc(label: string) {
  useNetworkStore.getState().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  });
}

const labels = () => useNetworkStore.getState().devices.map(d => d.label);

/** Labels of the selected devices, as the store knows them */
function selected(): string[] {
  const { devices, selectedDeviceIds } = useNetworkStore.getState();
  return devices.filter(d => selectedDeviceIds.includes(d.id)).map(d => d.label);
}

function renderCanvas() {
  return render(
    <ReactFlowProvider>
      <NetworkCanvas />
    </ReactFlowProvider>
  );
}

/**
 * The window the mouse events belong to: React Flow follows a drag through
 * `event.view`. It has to be jsdom's own window, which Vitest exposes as the
 * `jsdom` global (the `window` of a test is a stand-in that jsdom refuses).
 */
const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
const pane = () => document.querySelector<HTMLElement>('.react-flow__pane')!;
const viewport = () =>
  document.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform;
const selectionBox = () => document.querySelector('.react-flow__selection');

/** Press a mouse button on an empty spot of the canvas and move 50px right, 30px down */
function startDrag(button: number) {
  fireEvent.mouseDown(pane(), { button, clientX: 100, clientY: 100, view: view() });
  fireEvent.mouseMove(pane(), { clientX: 150, clientY: 130, view: view() });
}

function endDrag(button: number) {
  fireEvent.mouseUp(pane(), { button, clientX: 150, clientY: 130, view: view() });
}

/**
 * Click a device, optionally holding Ctrl. A user's clicks are separate
 * events with time between them: the wait at the end gives the canvas the
 * same chance to finish with one before the next arrives.
 */
async function clickDevice(label: string, { ctrl = false } = {}) {
  const node = screen.getByText(label).closest<HTMLElement>('.react-flow__node')!;
  const mouse = { button: LEFT, clientX: 5, clientY: 5, ctrlKey: ctrl, view: view() };
  if (ctrl) fireEvent.keyDown(document.body, { key: 'Control', ctrlKey: true });
  fireEvent.mouseDown(node, mouse);
  fireEvent.mouseUp(node, mouse);
  if (ctrl) fireEvent.keyUp(document.body, { key: 'Control' });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.body, { key, code: key, ...init });
  fireEvent.keyUp(document.body, { key, code: key, ...init });
}

describe('NetworkCanvas — mouse and keyboard', () => {
  beforeEach(() => {
    localStorage.clear();
    stubBrowser();
    createNewProject({ name: 'Sede Milano' });
    // selection and clipboard belong to the session, not to the project
    useNetworkStore.setState({ selectedDeviceIds: [], clipboard: null });
    useUIStore.setState({ showWelcomeScreen: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('moving the view', () => {
    it('dragging with the right button on an empty spot pans', async () => {
      renderCanvas();
      expect(viewport()).toBe('translate(0px,0px) scale(1)');

      startDrag(RIGHT);
      expect(viewport()).toBe('translate(50px,30px) scale(1)');
      endDrag(RIGHT);

      // and the canvas remembers where it was left
      await waitFor(() =>
        expect(useNetworkStore.getState().viewport).toEqual({ x: 50, y: 30, zoom: 1 })
      );
    });

    it('dragging with the left button does not pan: it draws a selection box', () => {
      renderCanvas();

      startDrag(LEFT);

      expect(viewport()).toBe('translate(0px,0px) scale(1)');
      expect(selectionBox()).not.toBeNull();
      endDrag(LEFT);
      expect(selectionBox()).toBeNull();
    });

    it('dragging with the middle button does nothing', () => {
      renderCanvas();

      startDrag(MIDDLE);

      expect(viewport()).toBe('translate(0px,0px) scale(1)');
      expect(selectionBox()).toBeNull();
      endDrag(MIDDLE);
    });

    it('the mouse wheel zooms', async () => {
      renderCanvas();

      fireEvent.wheel(pane(), { deltaY: -100, clientX: 0, clientY: 0, view: view() });

      expect(viewport()).toMatch(/scale\(1\.1\d*\)$/);
      await waitFor(() => expect(useNetworkStore.getState().viewport.zoom).toBeGreaterThan(1.1));
    });
  });

  describe('selecting', () => {
    it('a click selects one device, Ctrl+click adds another or takes it out again', async () => {
      addPc('PC-1');
      addPc('PC-2');
      addPc('PC-3');
      renderCanvas();

      await clickDevice('PC-1');
      expect(selected()).toEqual(['PC-1']);

      await clickDevice('PC-3', { ctrl: true });
      expect(selected()).toEqual(['PC-1', 'PC-3']);

      await clickDevice('PC-1', { ctrl: true });
      expect(selected()).toEqual(['PC-3']);

      // without Ctrl the selection is replaced
      await clickDevice('PC-2');
      expect(selected()).toEqual(['PC-2']);
    });
  });

  describe('keyboard', () => {
    it('Delete removes the selected devices, once the question is answered yes', async () => {
      addPc('PC-1');
      addPc('PC-2');
      addPc('PC-3');
      renderCanvas();
      await clickDevice('PC-1');
      await clickDevice('PC-3', { ctrl: true });
      const answers = answerConfirms(true);

      press('Delete');
      await settled();

      expect(answers.asked.map(question => question.title)).toEqual(['Eliminare 2 dispositivi?']);
      expect(labels()).toEqual(['PC-2']);
    });

    it('Ctrl+C copies the selected devices and Ctrl+V pastes them', async () => {
      addPc('PC-1');
      addPc('PC-2');
      renderCanvas();
      await clickDevice('PC-1');

      press('c', { ctrlKey: true });
      expect(useNetworkStore.getState().clipboard?.devices.map(d => d.label)).toEqual(['PC-1']);

      press('v', { ctrlKey: true });
      // (the copy takes the first free name of its family)
      expect(labels()).toEqual(['PC-1', 'PC-2', 'PC-3']);
    });

    it('with Caps Lock on (the keys come as capital letters) Ctrl+C and Ctrl+V work the same', async () => {
      addPc('PC-1');
      addPc('PC-2');
      renderCanvas();
      await clickDevice('PC-1');

      fireEvent.keyDown(document.body, { key: 'C', code: 'KeyC', ctrlKey: true });
      expect(useNetworkStore.getState().clipboard?.devices.map(d => d.label)).toEqual(['PC-1']);

      fireEvent.keyDown(document.body, { key: 'V', code: 'KeyV', ctrlKey: true });
      expect(labels()).toHaveLength(3);
      // Ctrl+Shift+V is another shortcut of the browser: nothing is pasted
      fireEvent.keyDown(document.body, { key: 'V', code: 'KeyV', ctrlKey: true, shiftKey: true });
      expect(labels()).toHaveLength(3);
    });

    it('Ctrl+C with nothing selected and Ctrl+V with nothing copied are left to the browser', () => {
      addPc('PC-1');
      renderCanvas();

      const copy = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      const paste = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, cancelable: true });
      fireEvent(window, copy);
      fireEvent(window, paste);

      expect(copy.defaultPrevented).toBe(false);
      expect(paste.defaultPrevented).toBe(false);
      expect(useNetworkStore.getState().clipboard).toBeNull();
      expect(labels()).toEqual(['PC-1']);
    });

    it('Ctrl+V while typing in a field pastes text there, not devices on the canvas', async () => {
      addPc('PC-1');
      renderCanvas();
      await clickDevice('PC-1');
      press('c', { ctrlKey: true }); // a device is in the clipboard

      for (const tag of ['input', 'textarea', 'select'] as const) {
        const field = document.body.appendChild(document.createElement(tag));
        const paste = new KeyboardEvent('keydown', {
          key: 'v',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        fireEvent(field, paste);

        expect(paste.defaultPrevented, tag).toBe(false);
        expect(labels(), tag).toEqual(['PC-1']);
        field.remove();
      }
    });

    it('Ctrl+C while typing in a field copies its text, not the selected device', async () => {
      addPc('PC-1');
      renderCanvas();
      await clickDevice('PC-1');

      const field = document.body.appendChild(document.createElement('input'));
      const copy = new KeyboardEvent('keydown', {
        key: 'c',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      fireEvent(field, copy);

      expect(copy.defaultPrevented).toBe(false);
      expect(useNetworkStore.getState().clipboard).toBeNull();
      field.remove();
    });

    it('Ctrl+C with text selected on the page copies that text (the output of the terminal, say)', async () => {
      addPc('PC-1');
      renderCanvas();
      await clickDevice('PC-1');

      const output = document.body.appendChild(document.createElement('pre'));
      output.textContent = 'Reply from 192.168.20.10: hops=5 time=0.44ms';
      const range = document.createRange();
      range.selectNodeContents(output);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);

      const copy = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, cancelable: true });
      fireEvent(window, copy);

      expect(copy.defaultPrevented).toBe(false);
      expect(useNetworkStore.getState().clipboard).toBeNull();

      window.getSelection()?.removeAllRanges();
      output.remove();
      // with nothing selected any more the shortcut is the canvas's again
      press('c', { ctrlKey: true });
      expect(useNetworkStore.getState().clipboard?.devices.map(d => d.label)).toEqual(['PC-1']);
    });
  });
});

describe('NetworkCanvas — a device the app selects', () => {
  beforeEach(() => {
    localStorage.clear();
    stubBrowser();
    createNewProject({ name: 'Prova' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a device added and selected by the app (the window that adds one does so) stays selected on the canvas', async () => {
    addPc('PC-1');
    renderCanvas();

    act(() => {
      const id = useNetworkStore.getState().addDevice({
        type: 'PC',
        label: 'PC-2',
        ip: '192.168.1.11',
        subnet: '255.255.255.0',
        gateway: '192.168.1.1',
        position: { x: 200, y: 0 },
      });
      useNetworkStore.getState().selectMultipleDevices([id]);
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(selected()).toEqual(['PC-2']);
    const node = screen.getByText('PC-2').closest<HTMLElement>('.react-flow__node')!;
    expect(node.className).toContain('selected');
    // and the one that was there is not
    expect(screen.getByText('PC-1').closest<HTMLElement>('.react-flow__node')!.className).not.toContain('selected');
  });
});
