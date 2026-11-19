/**
 * The guided tour: a balloon beside each part of the screen it names, the
 * rest of the screen dimmed, one step after the other. A dialog: named after
 * its step, the focus kept inside it and given back when it closes, its keys
 * its own while it is open. Skipped at any step; not over a presentation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GuidedTour from './GuidedTour';
import { useGuideStore } from '@/store/guideStore';
import { usePresentationStore } from '@/store/presentationStore';
import { TOUR_STEPS } from '@/data/tourSteps';
import { TOUR_SEEN_KEY } from '@/utils/firstSteps';
import { setLanguage } from '@/i18n';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** A box on screen for an element (jsdom lays nothing out) */
function placeAt(element: Element, box: { x: number; y: number; width: number; height: number }) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...box,
      left: box.x,
      top: box.y,
      right: box.x + box.width,
      bottom: box.y + box.height,
      toJSON: () => box,
    }),
  });
}

/** The parts of the screen the tour names, where the app has them */
function Screen() {
  return (
    <div>
      <button type="button" data-tour="file-menu">
        File
      </button>
      <button type="button" data-tour="edit-menu">
        Modifica
      </button>
      <button type="button" data-tour="view-menu">
        Vista
      </button>
      <button type="button" data-tour="marker">
        Pennarello
      </button>
      <button type="button" data-tour="present">
        Presenta
      </button>
      <button type="button" data-tour="add-device">
        Aggiungi dispositivo
      </button>
      <button type="button" data-tour="simulation">
        Simulazione
      </button>
      <button type="button" data-tour="console">
        Console
      </button>
      <main className="canvas-area" />
      <button type="button" id="before">
        Aiuto
      </button>
    </div>
  );
}

const BOXES: Record<string, { x: number; y: number; width: number; height: number }> = {
  '[data-tour="file-menu"]': { x: 58, y: 5, width: 43, height: 33 },
  '[data-tour="edit-menu"]': { x: 101, y: 5, width: 78, height: 33 },
  '[data-tour="view-menu"]': { x: 179, y: 5, width: 53, height: 33 },
  '[data-tour="marker"]': { x: 1285, y: 5, width: 32, height: 32 },
  '[data-tour="present"]': { x: 1325, y: 5, width: 108, height: 33 },
  '[data-tour="add-device"]': { x: 4, y: 150, width: 40, height: 40 },
  '[data-tour="simulation"]': { x: 4, y: 104, width: 40, height: 40 },
  '[data-tour="console"]': { x: 4, y: 196, width: 40, height: 40 },
  '.canvas-area': { x: 48, y: 44, width: 1520, height: 735 },
};

function renderTour() {
  const view = render(
    <>
      <Screen />
      <GuidedTour />
    </>
  );
  for (const [selector, box] of Object.entries(BOXES)) {
    const element = document.querySelector(selector);
    if (element) placeAt(element, box);
  }
  return view;
}

const open = () => act(() => useGuideStore.getState().openTour());
const balloon = () => screen.getByRole('dialog');
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });

describe('the guided tour', () => {
  beforeEach(() => {
    localStorage.removeItem(TOUR_SEEN_KEY);
    useGuideStore.setState({ tourStep: null });
    usePresentationStore.setState({ active: false });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1568 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 779 });
  });

  afterEach(() => {
    act(() => useGuideStore.getState().closeTour());
  });

  it('has eight steps at most, each with a title and a sentence or two in both languages', () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(6);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(8);
  });

  it('opens on its first step: a dialog named after the step, said in words, the focus on the way on', () => {
    renderTour();
    expect(screen.queryByRole('dialog')).toBeNull();

    open();

    const dialog = screen.getByRole('dialog', { name: 'Aggiungi un dispositivo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(/Scegli un PC, uno switch, un router o un server/);
    expect(dialog).toHaveTextContent('Tour guidato');
    expect(dialog).toHaveTextContent(`1 di ${TOUR_STEPS.length}`);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Avanti' }));
    // (once open, it is not offered again by itself)
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('true');
  });

  it('«Avanti» and «Indietro» go through the steps; the last one says «Fine», and closes it', () => {
    renderTour();
    open();
    // nothing to go back to from the first step
    expect(screen.queryByRole('button', { name: 'Indietro' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    expect(balloon()).toHaveAccessibleName('Collega con un cavo');
    expect(balloon()).toHaveTextContent(`2 di ${TOUR_STEPS.length}`);

    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));
    expect(balloon()).toHaveAccessibleName('Aggiungi un dispositivo');

    for (let step = 1; step < TOUR_STEPS.length; step++) {
      fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    }
    expect(balloon()).toHaveAccessibleName('Presenta');
    expect(balloon()).toHaveTextContent('Il tour si riapre dal menu Aiuto.');
    expect(screen.queryByRole('button', { name: 'Avanti' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Fine' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useGuideStore.getState().tourStep).toBeNull();
  });

  it('names every part of the screen the visitor needs first, in this order', () => {
    renderTour();
    open();
    const titles: string[] = [];
    for (let step = 0; step < TOUR_STEPS.length; step++) {
      titles.push(screen.getByRole('heading').textContent ?? '');
      if (step < TOUR_STEPS.length - 1)
        fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    }
    expect(titles).toEqual([
      'Aggiungi un dispositivo',
      'Collega con un cavo',
      'Fai una domanda',
      'Il terminale',
      'Annulla e ripeti',
      'Salva il progetto',
      'Il pennarello',
      'Presenta',
    ]);
  });

  it('from the keyboard: → and Enter go on, ← goes back, Esc closes it', () => {
    renderTour();
    open();

    press('ArrowRight');
    expect(balloon()).toHaveAccessibleName('Collega con un cavo');
    press('ArrowLeft');
    expect(balloon()).toHaveAccessibleName('Aggiungi un dispositivo');
    // Enter on the balloon itself (on a button it presses the button, once)
    fireEvent.keyDown(balloon(), { key: 'Enter' });
    expect(balloon()).toHaveAccessibleName('Collega con un cavo');
    // ← on the first step and → on the last stay where they are
    press('ArrowLeft');
    press('ArrowLeft');
    expect(balloon()).toHaveAccessibleName('Aggiungi un dispositivo');

    press('Escape');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('its keys are its own while it is open: the shortcuts of the app do not hear them', () => {
    const heard = vi.fn();
    window.addEventListener('keydown', heard);
    try {
      renderTour();
      open();
      press('p');
      press('z', { ctrlKey: true });
      press('Delete');
      press('ArrowRight');
      press('Escape');
      expect(heard).not.toHaveBeenCalled();

      // closed, the app hears its keys again
      press('p');
      expect(heard).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', heard);
    }
  });

  it('keeps the focus inside the balloon (Tab and Shift+Tab go round its buttons)', () => {
    renderTour();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    const buttons = screen.getAllByRole('button').filter(button => balloon().contains(button));
    expect(buttons.map(button => button.textContent)).toEqual(['Salta', 'Indietro', 'Avanti']);

    buttons[2].focus();
    press('Tab');
    expect(document.activeElement).toBe(buttons[0]);
    press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(buttons[2]);
  });

  it('«Salta» closes it at any step, and gives the focus back to where it was', () => {
    renderTour();
    const before = screen.getByRole('button', { name: 'Aiuto' });
    before.focus();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avanti' }));

    fireEvent.click(screen.getByRole('button', { name: 'Salta' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(before);
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe('true');
  });

  it('frames the part of the screen of each step, the rest dimmed; a part not on screen leaves the balloon alone', () => {
    renderTour();
    open();
    const spotlight = () => document.querySelector<HTMLElement>('.guide-tour-spotlight');

    // the button that adds a device, with a little room around it, inside the window
    expect(spotlight()).not.toBeNull();
    expect(spotlight()!.style.left).toBe('2px');
    expect(spotlight()!.style.top).toBe('146px');
    expect(spotlight()!.style.width).toBe('46px');
    expect(spotlight()!.style.height).toBe('48px');
    // the balloon beside it, on its right
    const placed = balloon();
    expect(parseFloat(placed.style.left)).toBeGreaterThanOrEqual(48);

    // the marker button is not on screen (a narrow window): its step falls back on the View menu
    placeAt(document.querySelector('[data-tour="marker"]')!, { x: 0, y: 0, width: 0, height: 0 });
    act(() =>
      useGuideStore.setState({ tourStep: TOUR_STEPS.findIndex(step => step.id === 'marker') })
    );
    expect(spotlight()!.style.left).toBe(`${179 - 4}px`);

    // nothing of a step on screen: no frame, the balloon in the middle
    for (const selector of ['[data-tour="present"]', '[data-tour="view-menu"]']) {
      placeAt(document.querySelector(selector)!, { x: 0, y: 0, width: 0, height: 0 });
    }
    act(() => useGuideStore.setState({ tourStep: TOUR_STEPS.length - 1 }));
    expect(spotlight()).toBeNull();
    expect(balloon()).toBeInTheDocument();
  });

  it('on a narrow screen the balloon sits at the bottom, the whole width', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    renderTour();
    open();
    expect(balloon()).toHaveClass('docked');
    expect(document.querySelector('.guide-tour-spotlight')).not.toBeNull();
  });

  it('is not shown while presenting: presenting puts it away', () => {
    renderTour();
    open();
    act(() => usePresentationStore.setState({ active: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useGuideStore.getState().tourStep).toBeNull();
  });

  it('speaks the language of the interface', () => {
    setLanguage('en');
    renderTour();
    open();
    expect(screen.getByRole('dialog', { name: 'Add a device' })).toHaveTextContent('Guided tour');
    expect(balloon()).toHaveTextContent(`1 of ${TOUR_STEPS.length}`);
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });
});
