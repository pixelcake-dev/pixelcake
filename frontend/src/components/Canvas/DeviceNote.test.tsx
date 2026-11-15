/**
 * The note of a device, shown by the app: after a short rest of the pointer
 * on the device (or when the keyboard brings its focus there), in a panel
 * under it that never takes the pointer, and gone as soon as the pointer
 * leaves, a button is pressed or Esc is pressed. A screen reader has it from
 * the device.
 *
 * The canvas is the real one (React Flow included); only what jsdom lacks is
 * stubbed, and where a device is on the page is given.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import styleSheet from '@/index.css?raw';
import NetworkCanvas from './NetworkCanvas';
import { NOTE_REST_MS } from './DeviceNote';

const network = () => useNetworkStore.getState();
const presentation = () => usePresentationStore.getState();

const NOTE = 'Postazione di Marta.\nDa sostituire a gennaio.';

function add(label: string, notes?: string) {
  return network().addDevice({
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: network().devices.length * 200, y: 0 },
    ...(notes === undefined ? {} : { notes }),
  });
}

/** Where every device is on the page: 104 by 94, its top left corner at (300, 200) */
let frame = { left: 300, top: 200, width: 104, height: 94 };

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
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.classList.contains('network-device')) return new DOMRect(0, 0, 0, 0);
    return new DOMRect(frame.left, frame.top, frame.width, frame.height);
  });
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderCanvas() {
  render(
    <ReactFlowProvider>
      <NetworkCanvas />
    </ReactFlowProvider>
  );
  await settle();
}

const nodeOf = (label: string) => screen.getByText(label).closest<HTMLElement>('.react-flow__node')!;
const frameOf = (label: string) => nodeOf(label).querySelector<HTMLElement>('.network-device')!;
const panel = () => document.querySelector<HTMLElement>('.device-note');
/** jsdom's own window: React Flow follows a press through `event.view` */
const view = () => (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;

/** Let `ms` pass */
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const enter = (label: string) => fireEvent.mouseEnter(frameOf(label));
const leave = (label: string) => fireEvent.mouseLeave(frameOf(label));

beforeEach(() => {
  localStorage.clear();
  frame = { left: 300, top: 200, width: 104, height: 94 };
  stubBrowser();
  presentation().exit();
  createNewProject({ name: 'Sede Milano' });
  useUIStore.setState({ showWelcomeScreen: false });
  useUIStore.getState().closeContextMenu();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  act(() => presentation().exit());
  document.body.classList.remove('react-flow-connecting');
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the note of a device, on the canvas', () => {
  it('shows after a short rest of the pointer on the device: its lines as they were written', async () => {
    add('PC-1', NOTE);
    await renderCanvas();

    enter('PC-1');
    await wait(NOTE_REST_MS - 50);
    expect(panel()).toBeNull();

    await wait(50);
    expect(panel()?.textContent).toBe(NOTE);
    expect(panel()?.querySelector('.device-note-text')?.textContent).toBe(NOTE);
  });

  it('is under the device, in its middle, and never takes the pointer', async () => {
    add('PC-1', NOTE);
    await renderCanvas();
    enter('PC-1');
    await wait(NOTE_REST_MS);

    // the middle of the device across, 6 under its frame
    expect(panel()?.style.left).toBe(`${300 + 52}px`);
    expect(panel()?.style.top).toBe(`${200 + 94 + 6}px`);
    expect(panel()?.className).toBe('device-note');
    // outside the frame of the device, where nothing of the device is
    expect(frameOf('PC-1').contains(panel())).toBe(false);
  });

  it('is above the device when there is no room under it', async () => {
    add('PC-1', NOTE);
    frame = { left: 300, top: window.innerHeight - 120, width: 104, height: 94 };
    await renderCanvas();
    enter('PC-1');
    await wait(NOTE_REST_MS);

    expect(panel()?.className).toBe('device-note device-note-above');
    expect(panel()?.style.top).toBe(`${window.innerHeight - 120 - 6}px`);
  });

  it('a device with no note, or a note of blanks, shows nothing', async () => {
    add('PC-1');
    add('PC-2', '  \n ');
    await renderCanvas();

    enter('PC-1');
    await wait(NOTE_REST_MS * 2);
    expect(panel()).toBeNull();
    leave('PC-1');
    enter('PC-2');
    await wait(NOTE_REST_MS * 2);
    expect(panel()).toBeNull();
  });

  it('goes as soon as the pointer leaves, and the next device waits its own rest', async () => {
    add('PC-1', NOTE);
    add('PC-2', 'Stampa le fatture');
    await renderCanvas();
    enter('PC-1');
    await wait(NOTE_REST_MS);
    expect(panel()).not.toBeNull();

    leave('PC-1');
    expect(panel()).toBeNull();

    enter('PC-2');
    expect(panel()).toBeNull();
    await wait(NOTE_REST_MS);
    expect(panel()?.textContent).toBe('Stampa le fatture');
  });

  it('a pointer that only passes over a device shows nothing', async () => {
    add('PC-1', NOTE);
    await renderCanvas();

    enter('PC-1');
    await wait(NOTE_REST_MS / 2);
    leave('PC-1');
    await wait(NOTE_REST_MS * 2);
    expect(panel()).toBeNull();
  });

  it('Esc sends it away, and it stays away until the pointer comes back to the device', async () => {
    add('PC-1', NOTE);
    await renderCanvas();
    enter('PC-1');
    await wait(NOTE_REST_MS);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(panel()).toBeNull();
    await wait(NOTE_REST_MS * 3);
    expect(panel()).toBeNull();

    leave('PC-1');
    enter('PC-1');
    await wait(NOTE_REST_MS);
    expect(panel()?.textContent).toBe(NOTE);
  });

  it('a press of a button sends it away: a device is dragged, a cable pulled, a click given', async () => {
    add('PC-1', NOTE);
    await renderCanvas();
    enter('PC-1');
    await wait(NOTE_REST_MS);

    fireEvent.mouseDown(frameOf('PC-1'), { button: 0, view: view() });
    expect(panel()).toBeNull();
    await wait(NOTE_REST_MS * 2);
    expect(panel()).toBeNull();
  });

  it('the wheel, and the right button, send it away too', async () => {
    add('PC-1', NOTE);
    await renderCanvas();
    enter('PC-1');
    await wait(NOTE_REST_MS);
    fireEvent.wheel(frameOf('PC-1'));
    expect(panel()).toBeNull();

    leave('PC-1');
    enter('PC-1');
    await wait(NOTE_REST_MS);
    fireEvent.contextMenu(frameOf('PC-1'));
    expect(panel()).toBeNull();
  });

  it('does not show while a cable is pulled, or while a menu is open', async () => {
    const pc = add('PC-1', NOTE);
    await renderCanvas();

    document.body.classList.add('react-flow-connecting');
    enter('PC-1');
    await wait(NOTE_REST_MS * 2);
    expect(panel()).toBeNull();
    document.body.classList.remove('react-flow-connecting');
    leave('PC-1');

    act(() => useUIStore.getState().setContextMenuDevice(network().devices.find((d) => d.id === pc)!, 40, 60));
    enter('PC-1');
    await wait(NOTE_REST_MS * 2);
    expect(panel()).toBeNull();
  });

  it('shows for the keyboard too: a device the focus is brought to with Tab, not one clicked', async () => {
    add('PC-1', NOTE);
    await renderCanvas();
    const node = nodeOf('PC-1');

    // a click gives the focus as well: no note for that
    fireEvent.mouseDown(node, { button: 0, view: view() });
    act(() => node.focus());
    await wait(NOTE_REST_MS * 2);
    expect(panel()).toBeNull();
    act(() => node.blur());

    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => node.focus());
    await wait(NOTE_REST_MS);
    expect(panel()?.textContent).toBe(NOTE);

    act(() => node.blur());
    expect(panel()).toBeNull();
  });

  it('is there while presenting: a note is something to read aloud', async () => {
    add('PC-1', NOTE);
    add('PC-2');
    await renderCanvas();
    act(() => {
      expect(presentation().enter()).toBe(true);
    });
    await settle();

    enter('PC-1');
    await wait(NOTE_REST_MS);
    expect(panel()?.textContent).toBe(NOTE);
  });

  it('follows the device: a note changed is shown changed, a device removed takes its note away', async () => {
    const pc = add('PC-1', NOTE);
    await renderCanvas();
    enter('PC-1');
    await wait(NOTE_REST_MS);

    act(() => network().updateDevice(pc, { notes: 'Spostata al piano 2' }));
    expect(panel()?.textContent).toBe('Spostata al piano 2');

    act(() => network().removeDevice(pc));
    expect(panel()).toBeNull();
  });

  it('is for the eye: a screen reader has the note from the device, which carries no mark for it', async () => {
    add('PC-1', NOTE);
    add('PC-2');
    await renderCanvas();

    // what the device says (the node is a button: this is part of its name)
    const words = [...frameOf('PC-1').querySelectorAll('.sr-only')].map((span) => span.textContent);
    expect(words).toEqual([`Nota: ${NOTE}`]);
    expect(frameOf('PC-2').querySelectorAll('.sr-only')).toHaveLength(0);
    expect(nodeOf('PC-1').getAttribute('role')).toBe('button');
    // no tooltip of the browser any more, and nothing drawn for it
    expect(frameOf('PC-1').hasAttribute('title')).toBe(false);
    expect(frameOf('PC-1').querySelector('.device-content')?.textContent).not.toContain('Marta');

    enter('PC-1');
    await wait(NOTE_REST_MS);
    expect(panel()?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('the note panel (style sheet)', () => {
  const sheet = styleSheet.replace(/\r\n/g, '\n');
  const rule = (selector: string): Record<string, string> => {
    const start = sheet.indexOf(`\n${selector} {\n`);
    if (start === -1) throw new Error(`no rule "${selector}"`);
    const body = sheet.slice(start + selector.length + 4, sheet.indexOf('\n}', start));
    return Object.fromEntries(
      body
        .split(';')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()])
    );
  };

  it('never takes the pointer: the device, its bands and what is near stay as they are', () => {
    expect(rule('.device-note')['pointer-events']).toBe('none');
    expect(rule('.device-note').position).toBe('fixed');
  });

  it('keeps the lines of the note, is as wide as reads well, and stops a long note after six lines', () => {
    const note = rule('.device-note');
    expect(note['white-space']).toBe('pre-line');
    expect(note['max-width']).toBe('280px');
    // (the lines are cut inside the padding of the panel, so that no part of a seventh shows;
    // a line cut so ends in an ellipsis)
    const lines = rule('.device-note-text');
    expect(lines['-webkit-line-clamp']).toBe('6');
    expect(lines['line-clamp']).toBe('6');
    expect(lines.overflow).toBe('hidden');
    expect(lines.display).toBe('-webkit-box');
    expect(note.overflow).toBeUndefined();
  });

  it('is never taller than its six lines: the room of the text is the clamp times the height of a line', () => {
    const note = rule('.device-note');
    const lines = rule('.device-note-text');
    // (the text has the line of the panel: it sets none of its own)
    expect(lines['line-height']).toBeUndefined();
    expect(lines['max-height']).toBe(`calc(${lines['-webkit-line-clamp']} * ${note['line-height']})`);
    // and the panel adds no room of its own under the text that a line could show in
    expect(note['max-height']).toBeUndefined();
    expect(note.height).toBeUndefined();
  });

  it('has the look of the menus: the colours of the theme, its corners, the shadow of what floats', () => {
    const note = rule('.device-note');
    expect(note['background-color']).toBe('var(--bg-menu)');
    expect(note.color).toBe('var(--text-color)');
    expect(note.border).toBe('1px solid var(--border-color)');
    expect(note['border-radius']).toBe('var(--radius)');
    expect(note['box-shadow']).toBe('0 8px 24px var(--shadow-color)');
  });

  it('above a device it ends where the device starts', () => {
    expect(rule('.device-note').transform).toBe('translateX(-50%)');
    expect(rule('.device-note.device-note-above').transform).toBe('translate(-50%, -100%)');
  });
});
