/**
 * The part of the canvas on screen, read from the page and from the view the
 * store keeps, and where a new device goes in it. Both windows that add
 * devices ask here: one device, or a batch, appears where the user is
 * looking.
 */

import { useNetworkStore } from '@/store/networkStore';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';
import { firstFreePlace, placeInView, type Place } from '@/utils/placeDevice';

/** How far from the border of the view a device added by itself stays, on screen */
const VIEW_MARGIN = 24;

/** What may cover the board: a panel open beside it, the small map, the zoom buttons */
const COVERS = ['.sidebar-panel.open', '.react-flow__minimap', '.react-flow__controls'];

export interface CanvasRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The part of the canvas on screen, in the coordinates of the canvas */
export function canvasOnScreen(): CanvasRect {
  const { viewport } = useNetworkStore.getState();
  const zoom = viewport.zoom || 1;
  const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
  const width = canvas?.width || window.innerWidth;
  const height = canvas?.height || window.innerHeight;
  return {
    left: -viewport.x / zoom,
    top: -viewport.y / zoom,
    right: (width - viewport.x) / zoom,
    bottom: (height - viewport.y) / zoom,
  };
}

/**
 * Where a new device is asked to go: its frame (with an address) in the
 * middle of what is on screen. The window that adds one device puts it there
 * or in the nearest free place (firstFreePlace); a batch starts its grid
 * there (gridPlaces).
 */
export function newDevicePlace(): Place {
  const view = canvasOnScreen();
  return {
    x: Math.round((view.left + view.right) / 2) - DEVICE_METRICS.width / 2,
    y: Math.round((view.top + view.bottom) / 2) - deviceHeight(true) / 2,
  };
}

/** The parts of the board on screen that something of the page covers, in the coordinates of the board */
function coveredOnScreen(): CanvasRect[] {
  const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
  if (!canvas) return [];
  const { viewport } = useNetworkStore.getState();
  const zoom = viewport.zoom || 1;
  return COVERS.flatMap((selector) => {
    const rect = document.querySelector(selector)?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [];
    return [
      {
        left: (rect.left - canvas.left - viewport.x) / zoom,
        top: (rect.top - canvas.top - viewport.y) / zoom,
        right: (rect.right - canvas.left - viewport.x) / zoom,
        bottom: (rect.bottom - canvas.top - viewport.y) / zoom,
      },
    ];
  });
}

/**
 * Where a device added by itself goes: the first free place of what is on
 * screen, row by row from the top left (placeInView), out of the way of the
 * panels over the board. With no free place left in view, the nearest free
 * one to its middle (firstFreePlace), which the window that adds it then
 * brings into view.
 *
 * @param taken Where the devices of the board are
 */
export function newDeviceSpot(taken: Place[]): Place {
  const view = canvasOnScreen();
  const margin = VIEW_MARGIN / (useNetworkStore.getState().viewport.zoom || 1);
  const inner = {
    left: view.left + margin,
    top: view.top + margin,
    right: view.right - margin,
    bottom: view.bottom - margin,
  };
  const size = { width: DEVICE_METRICS.width, height: deviceHeight(true) };
  return placeInView(inner, taken, coveredOnScreen(), size) ?? firstFreePlace(newDevicePlace(), taken);
}

/** True when every one of these devices is wholly on screen */
export function allOnScreen(places: readonly Place[]): boolean {
  const view = canvasOnScreen();
  return places.every(
    (place) =>
      place.x >= view.left &&
      place.y >= view.top &&
      place.x + DEVICE_METRICS.width <= view.right &&
      place.y + deviceHeight(true) <= view.bottom
  );
}
