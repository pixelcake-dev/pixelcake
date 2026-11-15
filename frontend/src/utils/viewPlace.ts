/**
 * The part of the canvas on screen, read from the page and from the view the
 * store keeps, and where a new device goes in it. Both windows that add
 * devices ask here: one device, or a batch, appears where the user is
 * looking.
 */

import { useNetworkStore } from '@/store/networkStore';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';
import type { Place } from '@/utils/placeDevice';

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
