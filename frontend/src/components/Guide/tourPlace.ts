/**
 * Where the guided tour draws its frame and its balloon: the part of the
 * screen a step names, found on the page, and a place for the balloon beside
 * it that stays inside the window. Pure but for `findPlace`, which reads the
 * page.
 */

import type { TourStep } from '@/data/tourSteps';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The room left between the frame and what it frames */
export const SPOT_PADDING = 4;
/** The frame keeps this far from the edge of the window (its line is drawn outside it) */
const EDGE = 2;
/** Between the frame and the balloon */
const GAP = 12;
/** Between the balloon and the edge of the window */
const MARGIN = 16;
/** Narrower than this, the balloon sits at the bottom of the window, the whole width */
export const NARROW_WINDOW = 600;
/** A part of the screen closer than this to the top: the balloon goes under it first */
const NEAR_TOP = 80;

/** The first of the places of a step that is whole in the window, with a little room around it; null when none is */
export function findPlace(step: TourStep, view: { width: number; height: number }): Box | null {
  for (const selector of step.places) {
    for (const element of document.querySelectorAll(selector)) {
      const box = element.getBoundingClientRect();
      const whole =
        box.width > 0 &&
        box.height > 0 &&
        box.left >= 0 &&
        box.top >= 0 &&
        box.left + box.width <= view.width &&
        box.top + box.height <= view.height;
      if (whole) {
        // (the room around it stays inside the window, so that the frame is seen whole)
        const left = Math.max(EDGE, box.left - SPOT_PADDING);
        const top = Math.max(EDGE, box.top - SPOT_PADDING);
        const right = Math.min(view.width - EDGE, box.left + box.width + SPOT_PADDING);
        const bottom = Math.min(view.height - EDGE, box.top + box.height + SPOT_PADDING);
        return { left, top, width: right - left, height: bottom - top };
      }
    }
  }
  return null;
}

const fits = (
  at: { left: number; top: number },
  size: { width: number; height: number },
  view: { width: number; height: number }
) =>
  at.left >= MARGIN &&
  at.top >= MARGIN &&
  at.left + size.width <= view.width - MARGIN &&
  at.top + size.height <= view.height - MARGIN;

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(value, Math.max(low, high)));

/**
 * The top left corner of the balloon: beside the frame (on its right for what
 * is on the left of the screen, under it for what is along the top), else on
 * the other sides, else in the middle of the frame (the frame is the board)
 * or of the window (no frame).
 */
export function placeBalloon(
  spot: Box | null,
  size: { width: number; height: number },
  view: { width: number; height: number }
): { left: number; top: number } {
  const middle = (box: Box) => ({
    left: clamp(
      box.left + box.width / 2 - size.width / 2,
      MARGIN,
      view.width - MARGIN - size.width
    ),
    top: clamp(
      box.top + box.height / 2 - size.height / 2,
      MARGIN,
      view.height - MARGIN - size.height
    ),
  });
  if (!spot) return middle({ left: 0, top: 0, width: view.width, height: view.height });

  const alongY = (top: number) => clamp(top, MARGIN, view.height - MARGIN - size.height);
  const alongX = (left: number) => clamp(left, MARGIN, view.width - MARGIN - size.width);
  const right = {
    left: spot.left + spot.width + GAP,
    top: alongY(spot.top + spot.height / 2 - size.height / 2),
  };
  const below = {
    left: alongX(spot.left + spot.width / 2 - size.width / 2),
    top: spot.top + spot.height + GAP,
  };
  const left = {
    left: spot.left - GAP - size.width,
    top: alongY(spot.top + spot.height / 2 - size.height / 2),
  };
  const above = {
    left: alongX(spot.left + spot.width / 2 - size.width / 2),
    top: spot.top - GAP - size.height,
  };

  const order = spot.top < NEAR_TOP ? [below, right, left, above] : [right, below, left, above];
  return order.find(at => fits(at, size, view)) ?? middle(spot);
}
