/**
 * The steps of the guided tour (components/Guide/GuidedTour.tsx), in order.
 * What each says is in the dictionary (`guide.tour.steps`, by the id); here
 * is what it points at on the screen: the first of its places that is on
 * screen. A part of the screen the tour points at carries `data-tour`.
 *
 * A step whose places are all out of sight (a narrow window hides the button
 * of annotation mode and «Presenta», and the View menu is there for both) is shown
 * without a frame, its balloon in the middle.
 */

export type TourStepId =
  | 'addDevice'
  | 'cable'
  | 'ask'
  | 'terminal'
  | 'undo'
  | 'save'
  | 'marker'
  | 'present';

export interface TourStep {
  id: TourStepId;
  /** Where it points, the first of these on screen (CSS selectors) */
  places: readonly string[];
}

/** A device of the board in view, or the board itself */
export const DEVICE_ON_BOARD = '.react-flow__node-device';

export const TOUR_STEPS: readonly TourStep[] = [
  { id: 'addDevice', places: ['[data-tour="add-device"]'] },
  { id: 'cable', places: [DEVICE_ON_BOARD, '.canvas-area'] },
  { id: 'ask', places: ['[data-tour="simulation"]'] },
  { id: 'terminal', places: ['[data-tour="console"]'] },
  { id: 'undo', places: ['[data-tour="edit-menu"]'] },
  { id: 'save', places: ['[data-tour="file-menu"]'] },
  { id: 'marker', places: ['[data-tour="marker"]', '[data-tour="view-menu"]'] },
  { id: 'present', places: ['[data-tour="present"]', '[data-tour="view-menu"]'] },
];
