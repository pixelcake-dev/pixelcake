/**
 * Adding an area to the canvas («riquadro»): by itself, where the user is
 * looking, or around the devices that are selected. These need the screen
 * (what part of the canvas is in view, how large each device is drawn) and
 * the store; where an area goes is worked out in utils/canvasAreas.
 */

import { useNetworkStore } from '@/store/networkStore';
import { areaAround, areaAt, defaultAreaLabel, nextAreaColour } from '@/utils/canvasAreas';
import { createTextMeasure, measureDeviceSizes } from '@/utils/drawingMeasure';
import { areaLabelReach } from '@/utils/drawingImage';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';

/** The size a device is taken to have when the screen cannot say: its frame, with an address */
const ASSUMED_DEVICE_SIZE = { width: DEVICE_METRICS.width, height: deviceHeight(true) };

/** The middle of the part of the canvas on screen, in the coordinates of the canvas */
function viewCentre(): { x: number; y: number } {
  const { viewport } = useNetworkStore.getState();
  const zoom = viewport.zoom || 1;
  const canvas = document.querySelector('.react-flow')?.getBoundingClientRect();
  const width = canvas?.width || window.innerWidth;
  const height = canvas?.height || window.innerHeight;
  return { x: (width / 2 - viewport.x) / zoom, y: (height / 2 - viewport.y) / zoom };
}

/** A new area is the selected one, with its label ready to be typed */
function addAndName(place: ReturnType<typeof areaAt>): string {
  const network = useNetworkStore.getState();
  const id = network.addArea({
    label: defaultAreaLabel(),
    color: nextAreaColour(network.areas),
    ...place,
  });
  network.selectArea(id);
  network.setEditingArea(id);
  return id;
}

/** Add an area in the middle of what the user is looking at; gives its id */
export function addAreaInView(): string {
  return addAndName(areaAt(viewCentre()));
}

/**
 * Add an area around these devices of the canvas, with room for its label;
 * gives its id, or null when none of them is on the canvas. The devices are
 * not touched: the area is drawn behind them. Where its room would cross
 * another area, or cover another device, it gives way (areaAround).
 */
export function encloseDevices(deviceIds: readonly string[]): string | null {
  const { devices, areas } = useNetworkStore.getState();
  const sizes = measureDeviceSizes();
  const measureText = createTextMeasure();
  const boxOf = (device: (typeof devices)[number]) => ({
    ...device.position,
    ...(sizes.get(device.id) ?? ASSUMED_DEVICE_SIZE),
  });
  const placed = areaAround(
    devices.filter((device) => deviceIds.includes(device.id)).map(boxOf),
    {
      // (an area inside another may go up beside its label, not over it)
      areas: areas.map((area) => ({
        ...area.position,
        ...area.size,
        labelReach: areaLabelReach(area, measureText),
      })),
      devices: devices.filter((device) => !deviceIds.includes(device.id)).map(boxOf),
    }
  );
  if (!placed) return null;
  const { position, size } = placed;
  return addAndName({ position, size });
}
