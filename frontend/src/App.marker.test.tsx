/**
 * The marker («Pennarello») in the whole app: how it is taken up and put
 * away (its button, the View menu, the P key, Esc), what the pointer does
 * while it is in use and while it is not, the question before everything
 * written is cleared, and the presenter's pen.
 *
 * jsdom does not lay the page out: the board starts at the top left of the
 * window, at 100 %, so a point of the window is a point of the canvas.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, within } from '@testing-library/react';
import { useNetworkStore } from '@/store/networkStore';
import { useMarkerStore } from '@/store/markerStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useUIStore } from '@/store/uiStore';
import { createNewProject } from '@/utils/projectFileAccess';
import { createSampleTopology } from '@/utils/sampleTopology';
import { answerConfirms, settled } from '@/test/confirm';
import App from './App';

vi.mock('sonner', () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const network = () => useNetworkStore.getState();
const marker = () => useMarkerStore.getState();
const presentation = () => usePresentationStore.getState();

const press = (key: string, target: Element = document.body) => fireEvent.keyDown(target, { key });
const surface = () => document.querySelector<HTMLElement>('.marker-surface');
const toolbar = () => screen.queryByRole('toolbar', { name: 'Pennarello' });

/** A stroke of the pointer on the surface, through these points of the window */
function stroke(points: Array<[number, number]>) {
  const target = surface();
  if (!target) throw new Error('the marker is not in use');
  const [first, ...rest] = points;
  const at = ([clientX, clientY]: [number, number]) => ({
    clientX,
    clientY,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 1,
    isPrimary: true,
  });
  fireEvent.pointerDown(target, at(first));
  for (const point of rest) fireEvent.pointerMove(target, at(point));
  fireEvent.pointerUp(target, at(rest[rest.length - 1] ?? first));
}

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

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('pixelcake-hide-welcome', 'true');
  stubBrowser();
  presentation().exit();
  // (the tools the last test chose are not this test's)
  useMarkerStore.setState({ active: false, tool: 'pen', color: 'accent', width: 'thin', presenterMarks: [], erasing: [] });
  createNewProject({ name: 'Sede Milano' });
  const sample = createSampleTopology();
  network().loadTopology(sample.devices, sample.connections);
  network().markSaved();
  // (no window left open by the test before)
  const ui = useUIStore.getState();
  for (const name of Object.keys(ui.modals) as Array<keyof typeof ui.modals>) ui.closeModal(name);
});

afterEach(() => {
  act(() => {
    presentation().exit();
    marker().setActive(false);
  });
  vi.unstubAllGlobals();
});

describe('App — taking up the marker and putting it away', () => {
  it('its button in the menu bar takes it up and puts it away, with its tools on the board', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'Pennarello' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(toolbar()).toBeNull();
    expect(surface()).toBeNull();

    fireEvent.click(button);
    expect(marker().active).toBe(true);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(toolbar()).not.toBeNull();
    expect(surface()).not.toBeNull();

    fireEvent.click(button);
    expect(marker().active).toBe(false);
    expect(toolbar()).toBeNull();
  });

  it('View → «Pennarello» does the same, with a tick while it is in use', () => {
    render(<App />);
    const entry = screen.getByRole('menuitemcheckbox', { name: /Pennarello/ });
    expect(entry).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(entry);

    expect(marker().active).toBe(true);
    expect(entry).toHaveAttribute('aria-checked', 'true');
  });

  it('the P key takes it up and puts it away, Esc puts it away', () => {
    render(<App />);

    press('p');
    expect(marker().active).toBe(true);
    press('P');
    expect(marker().active).toBe(false);

    press('p');
    press('Escape');
    expect(marker().active).toBe(false);
  });

  it('P is a letter like any other while a field is being typed in, and with Ctrl it is not the marker', () => {
    render(<App />);
    act(() => useUIStore.getState().openModal('codeTerminal'));
    const input = screen.getByLabelText('Riga di comando del terminale');

    press('p', input);
    expect(marker().active).toBe(false);

    fireEvent.keyDown(document.body, { key: 'p', ctrlKey: true });
    expect(marker().active).toBe(false);
  });

  it('the close button of its tools puts it away', () => {
    render(<App />);
    press('p');

    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Chiudi il pennarello' }));

    expect(marker().active).toBe(false);
  });
});

describe('App — writing on the board', () => {
  it('a stroke of the pen is one mark, in the colour and thickness chosen', () => {
    render(<App />);
    press('p');
    const tools = within(toolbar()!);
    fireEvent.click(tools.getByRole('button', { name: 'Penna' }));
    fireEvent.click(tools.getByRole('button', { name: 'Verde' }));
    fireEvent.click(tools.getByRole('button', { name: 'Spesso' }));

    stroke([
      [100, 100],
      [140, 120],
      [180, 100],
      [220, 140],
    ]);

    expect(network().marks).toHaveLength(1);
    expect(network().marks[0]).toMatchObject({ kind: 'pen', color: 'green', width: 'thick' });
    expect(network().marks[0].points.slice(0, 2)).toEqual([100, 100]);
    expect(network().marks[0].points.slice(-2)).toEqual([220, 140]);
    expect(network().hasUnsavedChanges).toBe(true);
    // (and it is drawn on the board)
    expect(document.querySelectorAll('.marks-layer path').length).toBeGreaterThan(0);
  });

  it('an arrow from where the pointer went down to where it came up', () => {
    render(<App />);
    press('p');
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Freccia' }));

    stroke([
      [50, 60],
      [120, 90],
      [300, 200],
    ]);

    expect(network().marks).toEqual([expect.objectContaining({ kind: 'arrow', points: [50, 60, 300, 200] })]);
  });

  it('a tick placed with a click, of the size of a stamp', () => {
    render(<App />);
    press('p');
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Spunta' }));

    stroke([[200, 200]]);

    const [tick] = network().marks;
    expect(tick.kind).toBe('tick');
    const [x0, y0, x1, y1] = tick.points;
    expect((x0 + x1) / 2).toBeCloseTo(200);
    expect((y0 + y1) / 2).toBeCloseTo(200);
    expect(x1 - x0).toBeGreaterThan(10);
  });

  it('words: typed where the board was clicked, kept with Enter, given up with Esc', () => {
    render(<App />);
    press('p');
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Testo' }));

    stroke([[300, 120]]);
    const field = screen.getByLabelText('Testo da scrivere sul canvas');
    fireEvent.change(field, { target: { value: 'Core giù' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(network().marks).toEqual([
      expect.objectContaining({ kind: 'text', text: 'Core giù', points: [300, 120] }),
    ]);
    expect(screen.queryByLabelText('Testo da scrivere sul canvas')).toBeNull();

    stroke([[300, 300]]);
    const again = screen.getByLabelText('Testo da scrivere sul canvas');
    fireEvent.change(again, { target: { value: 'non questo' } });
    fireEvent.keyDown(again, { key: 'Escape' });

    expect(network().marks).toHaveLength(1);
    // (Esc gave up the words, and left the marker in use)
    expect(marker().active).toBe(true);
  });

  it('the eraser takes away the whole mark it touches, in one edit', () => {
    render(<App />);
    press('p');
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Freccia' }));
    stroke([
      [100, 100],
      [300, 100],
    ]);
    stroke([
      [100, 400],
      [300, 400],
    ]);
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Gomma' }));

    // (across it, quickly: what lies between two moves of the pointer is touched too)
    stroke([
      [200, 40],
      [200, 160],
    ]);

    expect(network().marks).toHaveLength(1);
    expect(network().marks[0].points).toEqual([100, 400, 300, 400]);
  });

  it('while it is in use a press on a device draws, and selects nothing', () => {
    render(<App />);
    press('p');

    stroke([
      [10, 10],
      [400, 400],
    ]);

    expect(network().selectedDeviceIds).toEqual([]);
    expect(network().devices.map((one) => one.position)).toEqual(
      createSampleTopology().devices.map((one) => one.position)
    );
  });
});

describe('App — clearing what is written', () => {
  const ringOf = (color: 'red' | 'green') => ({
    kind: 'ellipse' as const,
    color,
    width: 'thin' as const,
    points: [0, 0, 50, 50],
    seed: 1,
  });

  it('asks first, in the window of the app: no leaves everything, yes takes every mark away', async () => {
    const answers = answerConfirms(false);
    render(<App />);
    act(() => {
      network().addMark(ringOf('red'));
      network().addMark(ringOf('green'));
    });
    press('p');
    const clear = within(toolbar()!).getByRole('button', { name: 'Cancella tutto' });

    fireEvent.click(clear);
    await settled();
    expect(answers.asked).toHaveLength(1);
    expect(answers.asked[0]).toMatchObject({
      title: 'Cancellare tutto quello che è scritto sul canvas?',
      confirmLabel: 'Cancella',
      danger: true,
    });
    expect(network().marks).toHaveLength(2);

    answers.say(true);
    fireEvent.click(clear);
    await settled();
    expect(network().marks).toEqual([]);
    // (the drawing stays)
    expect(network().devices.length).toBeGreaterThan(0);
  });

  it('with nothing written there is nothing to clear: the button is disabled', () => {
    render(<App />);
    press('p');
    expect(within(toolbar()!).getByRole('button', { name: 'Cancella tutto' })).toBeDisabled();
  });
});

describe("App — the presenter's pen", () => {
  it('writes over the drawing without changing it, and what it wrote is gone at the end', () => {
    render(<App />);
    act(() => {
      network().addMark({ kind: 'tick', color: 'green', width: 'thin', points: [0, 0, 30, 30], seed: 1 });
      network().markSaved();
      presentation().enter();
    });
    const pen = screen.getByRole('button', { name: 'Pennarello' });
    fireEvent.click(pen);
    expect(marker().active).toBe(true);

    stroke([
      [100, 100],
      [200, 150],
      [260, 120],
    ]);

    expect(marker().presenterMarks).toHaveLength(1);
    expect(network().marks).toHaveLength(1);
    expect(network().hasUnsavedChanges).toBe(false);
    // (the saved one underneath, the presenter's on top)
    expect(document.querySelectorAll('.marks-layer .marks-presenter path').length).toBeGreaterThan(0);

    act(() => presentation().exit());
    expect(marker().presenterMarks).toEqual([]);
    expect(network().marks).toHaveLength(1);
  });

  it('its «Cancella tutto» clears what the presenter wrote at once, and nothing of the canvas', () => {
    const answers = answerConfirms(true);
    render(<App />);
    act(() => {
      network().addMark({ kind: 'tick', color: 'green', width: 'thin', points: [0, 0, 30, 30], seed: 1 });
      presentation().enter();
    });
    press('p');
    stroke([
      [100, 100],
      [200, 150],
    ]);

    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Cancella tutto' }));

    expect(answers.asked).toHaveLength(0);
    expect(marker().presenterMarks).toEqual([]);
    expect(network().marks).toHaveLength(1);
  });

  it('Esc puts the pen away first, and leaves the presentation at the second press', () => {
    render(<App />);
    act(() => {
      presentation().enter();
    });
    press('p');
    expect(marker().active).toBe(true);

    press('Escape');
    expect(marker().active).toBe(false);
    expect(presentation().active).toBe(true);

    press('Escape');
    expect(presentation().active).toBe(false);
  });

  it('while the pen is put away a click on a device opens the menu of the presentation as before', () => {
    render(<App />);
    act(() => {
      presentation().enter();
    });
    press('p');
    press('p');

    expect(surface()).toBeNull();
  });
});
