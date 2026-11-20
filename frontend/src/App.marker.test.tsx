/**
 * Annotation mode («Modalità appunti») in the whole app: how it is entered
 * and left (its button, the View menu, the A key, Esc), what the pointer does
 * while it is on and while it is off, the notes shown only while it is on
 * (and their count when it is off), the question before everything written
 * is cleared, and the mode in the presentation: the same sheet.
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
import { undo } from '@/store/historyStore';
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
const toolbar = () => screen.queryByRole('toolbar', { name: 'Modalità appunti' });
const sheet = () => document.querySelector('.marks-layer');
const tick = { kind: 'tick' as const, color: 'green' as const, width: 'thin' as const, points: [0, 0, 30, 30], seed: 1 };

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
  useMarkerStore.setState({ active: false, tool: 'pen', color: 'accent', width: 'thin', erasing: [] });
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
    const button = screen.getByRole('button', { name: /^Modalità appunti/ });
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

  it('View → «Modalità appunti» does the same, with a tick while it is in use', () => {
    render(<App />);
    const entry = screen.getByRole('menuitemcheckbox', { name: /Modalità appunti/ });
    expect(entry).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(entry);

    expect(marker().active).toBe(true);
    expect(entry).toHaveAttribute('aria-checked', 'true');
  });

  it('the A key turns it on and off, Esc turns it off', () => {
    render(<App />);

    press('a');
    expect(marker().active).toBe(true);
    press('A');
    expect(marker().active).toBe(false);

    press('a');
    press('Escape');
    expect(marker().active).toBe(false);
  });

  it('A is a letter like any other while a field is being typed in, and with Ctrl, Alt or Shift it is not the mode', () => {
    render(<App />);
    act(() => useUIStore.getState().openModal('codeTerminal'));
    const input = screen.getByLabelText('Riga di comando del terminale');

    press('a', input);
    expect(marker().active).toBe(false);

    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      fireEvent.keyDown(document.body, { key: 'a', ...modifier });
      expect(marker().active).toBe(false);
    }
  });

  it('A is not heard with a window open over the board', () => {
    render(<App />);
    act(() => useUIStore.getState().openModal('settings'));

    press('a');

    expect(marker().active).toBe(false);
  });

  it('the close button of its tools puts it away', () => {
    render(<App />);
    press('a');

    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Esci dalla modalità appunti' }));

    expect(marker().active).toBe(false);
  });
});

describe('App — writing on the board', () => {
  it('a stroke of the pen is one mark, in the colour and thickness chosen', () => {
    render(<App />);
    press('a');
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
    press('a');
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
    press('a');
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
    press('a');
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
    press('a');
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
    press('a');

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
    press('a');
    const clear = within(toolbar()!).getByRole('button', { name: 'Cancella tutto' });

    fireEvent.click(clear);
    await settled();
    expect(answers.asked).toHaveLength(1);
    expect(answers.asked[0]).toMatchObject({
      title: 'Cancellare tutti gli appunti del canvas?',
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
    press('a');
    expect(within(toolbar()!).getByRole('button', { name: 'Cancella tutto' })).toBeDisabled();
  });
});

describe('App — the notes are seen only while the mode is on', () => {
  it('off, nothing is drawn on the board; on, the notes are there; off again, they are gone', () => {
    render(<App />);
    act(() => network().addMark(tick));
    expect(network().marks).toHaveLength(1);
    expect(sheet()).toBeNull();

    press('a');
    expect(sheet()?.querySelectorAll('path').length).toBeGreaterThan(0);

    press('Escape');
    expect(sheet()).toBeNull();
    // (they are not lost: only out of sight)
    expect(network().marks).toHaveLength(1);

    press('a');
    expect(sheet()).not.toBeNull();
  });

  it('what is written is seen at once, and stays seen until the mode is left', () => {
    render(<App />);
    press('a');

    stroke([
      [100, 100],
      [200, 140],
    ]);

    expect(sheet()?.querySelectorAll('path').length).toBeGreaterThan(0);
    press('Escape');
    expect(sheet()).toBeNull();
  });

  it('off, the button shows how many notes are hidden; on, or with none, it shows no number', () => {
    render(<App />);
    const button = () => screen.getByRole('button', { name: /^Modalità appunti/ });
    expect(button()).toHaveAccessibleName('Modalità appunti');
    expect(button().querySelector('.marker-count')).toBeNull();

    act(() => {
      network().addMark(tick);
      network().addMark({ ...tick, points: [50, 50, 80, 80] });
      network().addMark({ ...tick, points: [90, 90, 120, 120] });
    });
    expect(button()).toHaveAccessibleName('Modalità appunti, 3 appunti nascosti');
    expect(button().querySelector('.marker-count')).toHaveTextContent('3');

    fireEvent.click(button());
    expect(button()).toHaveAccessibleName('Modalità appunti');
    expect(button().querySelector('.marker-count')).toBeNull();
  });

  it('the View menu entry says the same count', () => {
    render(<App />);
    act(() => network().addMark(tick));

    expect(screen.getByRole('menuitemcheckbox', { name: /Modalità appunti.*\(1\)/ })).toBeInTheDocument();
  });

  it('the simulation panel is not under the sheet: it stays usable with the mode on', () => {
    render(<App />);
    act(() => useUIStore.getState().setActiveSidebarPanel('simulation'));
    press('a');

    expect(surface()?.closest('.canvas-area')).not.toBeNull();
    expect(surface()?.closest('.sidebar-panel')).toBeNull();
    expect(screen.getByRole('button', { name: /Modalità appunti/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('App — annotation mode while presenting: the same sheet', () => {
  it('starts off, the notes hidden, and the bar says how many there are', () => {
    render(<App />);
    act(() => {
      network().addMark(tick);
      presentation().enter();
    });

    expect(marker().active).toBe(false);
    expect(sheet()).toBeNull();
    const button = screen.getByRole('button', { name: /^Modalità appunti/ });
    expect(button).toHaveAccessibleName('Modalità appunti, 1 appunto nascosto');
    expect(button.querySelector('.marker-count')).toHaveTextContent('1');
  });

  it('its button on the bar and the A key turn it on: the notes prepared are there, and it writes on the same sheet', () => {
    render(<App />);
    act(() => {
      network().addMark(tick);
      network().markSaved();
      presentation().enter();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Modalità appunti/ }));
    expect(marker().active).toBe(true);
    expect(sheet()?.querySelectorAll('path').length).toBeGreaterThan(0);

    stroke([
      [100, 100],
      [200, 150],
      [260, 120],
    ]);
    expect(network().marks).toHaveLength(2);
    expect(network().hasUnsavedChanges).toBe(true);

    press('Escape');
    press('a');
    expect(marker().active).toBe(true);
    expect(network().marks).toHaveLength(2);
  });

  it('writing selects and moves no device', () => {
    render(<App />);
    act(() => presentation().enter());
    press('a');
    const before = network().devices.map((one) => one.position);

    stroke([
      [10, 10],
      [400, 400],
    ]);

    expect(network().selectedDeviceIds).toEqual([]);
    expect(network().devices.map((one) => one.position)).toEqual(before);
    expect(presentation().menu).toBeNull();
  });

  it('the first Esc leaves the mode, the second leaves the presentation', () => {
    render(<App />);
    act(() => presentation().enter());
    press('a');
    expect(marker().active).toBe(true);

    press('Escape');
    expect(marker().active).toBe(false);
    expect(presentation().active).toBe(true);

    press('Escape');
    expect(presentation().active).toBe(false);
  });

  it('leaving the presentation leaves the mode off, and the notes written stay on the canvas', () => {
    render(<App />);
    act(() => presentation().enter());
    press('a');
    stroke([
      [100, 100],
      [200, 150],
    ]);

    act(() => presentation().exit());

    expect(marker().active).toBe(false);
    expect(sheet()).toBeNull();
    expect(network().marks).toHaveLength(1);
  });

  it('undo is refused while presenting; after leaving, it takes the notes written back', async () => {
    render(<App />);
    act(() => presentation().enter());
    press('a');
    stroke([
      [100, 100],
      [200, 150],
    ]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(undo()).toBe(false);
    expect(network().marks).toHaveLength(1);

    act(() => presentation().exit());
    expect(undo()).toBe(true);
    expect(network().marks).toEqual([]);
  });

  it('its eraser takes the notes away, the prepared ones too', () => {
    render(<App />);
    act(() => {
      network().addMark({ kind: 'arrow', color: 'red', width: 'thin', points: [100, 100, 300, 100], seed: 2 });
      presentation().enter();
    });
    press('a');
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Gomma' }));

    stroke([
      [200, 40],
      [200, 160],
    ]);

    expect(network().marks).toEqual([]);
  });

  it('there is no temporary pen: no «only for this presentation» label, and «Cancella tutto» asks as ever', async () => {
    const answers = answerConfirms(false);
    render(<App />);
    act(() => {
      network().addMark(tick);
      presentation().enter();
    });
    press('a');

    expect(within(toolbar()!).queryByText(/Solo per questa presentazione/)).toBeNull();
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Cancella tutto' }));
    await settled();
    expect(answers.asked).toHaveLength(1);
    expect(network().marks).toHaveLength(1);
  });

  it('left off, there is no sheet over the devices and a click on one opens the menu of the presentation', () => {
    render(<App />);
    act(() => presentation().enter());
    press('a');
    press('a');

    expect(surface()).toBeNull();
  });
});
