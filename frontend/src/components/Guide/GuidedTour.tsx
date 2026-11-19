/**
 * The guided tour: one balloon at a time beside the part of the screen it
 * names, framed in the accent, the rest of the screen dimmed but in view.
 * Eight steps (data/tourSteps.ts), each a title and a sentence or two
 * (`guide.tour` of the dictionary).
 *
 * A dialog over the whole app while it is open: named after its step, the
 * focus on its buttons and given back where it was when it closes, and the
 * keys its own (→ and Enter go on, ← goes back, Esc closes it, Tab goes round
 * its buttons; the shortcuts of the app hear nothing). A press of the pointer
 * outside the balloon does nothing. «Salta» closes it at any step.
 *
 * On a window narrower than 600 px the balloon sits at the bottom, the whole
 * width; a step whose part of the screen is out of sight there is shown
 * without a frame. Presenting puts it away.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGuideStore } from '@/store/guideStore';
import { usePresentationStore } from '@/store/presentationStore';
import { TOUR_STEPS } from '@/data/tourSteps';
import { undoKeys } from '@/utils/undoActions';
import { useT } from '@/i18n';
import { findPlace, NARROW_WINDOW, placeBalloon, type Box } from './tourPlace';

/** The size of the balloon before it is measured */
const BALLOON_SIZE = { width: 340, height: 180 };

interface Layout {
  spot: Box | null;
  /** The top left corner of the balloon; null when it sits at the bottom */
  at: { left: number; top: number } | null;
}

const sameLayout = (a: Layout | null, b: Layout) =>
  a !== null &&
  JSON.stringify(a.spot) === JSON.stringify(b.spot) &&
  JSON.stringify(a.at) === JSON.stringify(b.at);

const GuidedTour = () => {
  const t = useT();
  const step = useGuideStore(state => state.tourStep);
  const nextStep = useGuideStore(state => state.nextStep);
  const previousStep = useGuideStore(state => state.previousStep);
  const closeTour = useGuideStore(state => state.closeTour);
  const presenting = usePresentationStore(state => state.active);
  const open = step !== null && !presenting;

  const balloonRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();
  const [layout, setLayout] = useState<Layout | null>(null);
  const layoutRef = useRef<Layout | null>(null);

  const last = step !== null && step === TOUR_STEPS.length - 1;

  // Presenting is for the audience: the tour goes away
  useEffect(() => {
    if (presenting && step !== null) closeTour();
  }, [presenting, step, closeTour]);

  /** The frame and the balloon, measured on the page as it is now */
  const measure = useCallback(() => {
    if (step === null) return;
    const view = { width: window.innerWidth, height: window.innerHeight };
    const spot = findPlace(TOUR_STEPS[step], view);
    const balloon = balloonRef.current;
    const size = {
      width: balloon?.offsetWidth || BALLOON_SIZE.width,
      height: balloon?.offsetHeight || BALLOON_SIZE.height,
    };
    const next: Layout = {
      spot,
      at: view.width < NARROW_WINDOW ? null : placeBalloon(spot, size, view),
    };
    if (sameLayout(layoutRef.current, next)) return;
    layoutRef.current = next;
    setLayout(next);
  }, [step]);

  // After every drawing of the balloon (its size may have changed with its words)
  useLayoutEffect(() => {
    if (open) measure();
  });

  // And while it is open, whatever moves under it: the window resized, the
  // board fitted to the window just after a sample is loaded
  useEffect(() => {
    if (!open || typeof window.requestAnimationFrame !== 'function') return;
    let frame = window.requestAnimationFrame(function follow() {
      measure();
      frame = window.requestAnimationFrame(follow);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, measure]);

  // The focus: on the way on when it opens, given back where it was when it closes
  useLayoutEffect(() => {
    if (!open) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primaryRef.current?.focus();
    return () => {
      layoutRef.current = null;
      if (before && before.isConnected) before.focus();
    };
  }, [open]);

  // A step that took away the button that had the focus («Indietro» on the first step)
  useLayoutEffect(() => {
    if (open && !balloonRef.current?.contains(document.activeElement)) primaryRef.current?.focus();
  }, [open, step]);

  const goOn = useCallback(() => {
    if (last) closeTour();
    else nextStep();
  }, [last, closeTour, nextStep]);

  // Its keys, heard before anything else of the app hears them
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // (whatever the key, the app does not hear it while the tour is open)
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTour();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextStep();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousStep();
      } else if (event.key === 'Enter') {
        // (on a button, Enter presses that button)
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        goOn();
      } else if (event.key === 'Tab') {
        const balloon = balloonRef.current;
        if (!balloon) return;
        const buttons = [...balloon.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
        if (buttons.length === 0) return;
        const first = buttons[0];
        const lastButton = buttons[buttons.length - 1];
        const inside = balloon.contains(document.activeElement);
        if (event.shiftKey && (!inside || document.activeElement === first)) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && (!inside || document.activeElement === lastButton)) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, closeTour, nextStep, previousStep, goOn]);

  if (!open) return null;

  const { id } = TOUR_STEPS[step];
  const words = t.guide.tour.steps[id];
  const keys = undoKeys();
  const text = typeof words.text === 'function' ? words.text(keys.undo, keys.redo) : words.text;
  const spot = layout?.spot ?? null;
  const docked = window.innerWidth < NARROW_WINDOW;

  return createPortal(
    <div className="guide-tour">
      {/* The rest of the screen, dimmed and out of reach; around the frame when there is one */}
      <div className="guide-tour-shield" onMouseDown={event => event.preventDefault()} />
      {spot ? (
        <div
          className="guide-tour-spotlight"
          aria-hidden="true"
          style={{
            left: `${spot.left}px`,
            top: `${spot.top}px`,
            width: `${spot.width}px`,
            height: `${spot.height}px`,
          }}
        />
      ) : (
        <div className="guide-tour-veil" aria-hidden="true" />
      )}

      <div
        ref={balloonRef}
        className={docked ? 'guide-tour-balloon docked' : 'guide-tour-balloon'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        style={
          !docked && layout?.at
            ? { left: `${layout.at.left}px`, top: `${layout.at.top}px` }
            : undefined
        }
      >
        {/* (each step is read out as it comes) */}
        <div aria-live="polite">
          <p className="guide-tour-label">
            <span>{t.guide.tour.name}</span>
            <span className="guide-tour-counter">
              {t.guide.tour.counter(step + 1, TOUR_STEPS.length)}
            </span>
          </p>
          <h2 id={titleId} className="guide-tour-title">
            {words.title}
          </h2>
          <p id={textId} className="guide-tour-text">
            {text}
          </p>
          {last && <p className="guide-tour-again">{t.guide.tour.again}</p>}
        </div>

        <div className="guide-tour-actions">
          <button type="button" className="guide-tour-skip" onClick={closeTour}>
            {t.guide.tour.skip}
          </button>
          {step > 0 && (
            <button type="button" className="guide-tour-button" onClick={previousStep}>
              {t.guide.tour.back}
            </button>
          )}
          <button
            type="button"
            ref={primaryRef}
            className="guide-tour-button primary"
            onClick={goOn}
          >
            {last ? t.guide.tour.done : t.guide.tour.next}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default GuidedTour;
