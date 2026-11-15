/**
 * What a drawing looks like once it is drawn, measured as the exported image
 * draws it (layoutDrawing, which repeats the numbers of the style sheet), and
 * what in it is written over something else. Texts are measured roughly
 * (approximateTextWidth), so a few pixels of room are asked for around each
 * label. Used by the tests of the samples and of the automatic layout.
 */
import { useTemplateStore } from '@/store/templateStore';
import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';
import {
  AREA_METRICS,
  DEVICE_METRICS,
  approximateTextWidth,
  areaLabelReach,
  layoutDrawing,
  type Box,
  type Scene,
} from '@/utils/drawingImage';

/** A drawing: its devices, its cables, its areas (with or without their ids) */
export interface Drawing {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  areas: ReadonlyArray<Omit<CanvasArea, 'id'> & { id?: string }>;
}

/** The room asked for around a label of a cable */
export const ROOM = 4;

/** The areas of a drawing, each with an id */
function withIds(drawing: Drawing): CanvasArea[] {
  return drawing.areas.map((area, index) => ({ ...area, id: area.id ?? `area-${index + 1}` }));
}

/** A drawing as the board draws it: a device on DHCP shows the address it is leased */
export function sceneOf(drawing: Drawing): Scene {
  const shown = (device: NetworkDevice) =>
    device.ip || (device.nics ?? []).some((nic) => nic.dhcp === true)
      ? { ...device, ip: device.ip || '192.168.1.100 · DHCP' }
      : device;
  const { templates, connectionTemplates } = useTemplateStore.getState();
  return layoutDrawing({
    devices: drawing.devices.map(shown),
    connections: drawing.connections,
    areas: withIds(drawing),
    deviceTemplates: templates,
    connectionTemplates,
    measureText: approximateTextWidth,
  });
}

export const grown = (box: Box, by: number): Box => ({
  x: box.x - by,
  y: box.y - by,
  width: box.width + 2 * by,
  height: box.height + 2 * by,
});
export const touch = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
export const holds = (outer: Box, inner: Box) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

/** What a device takes on the board: its frame, and its name or address where wider */
export function deviceBox(device: Scene['devices'][number]): Box {
  const wide = Math.max(
    approximateTextWidth(device.label, { size: DEVICE_METRICS.nameSize, weight: 600 }),
    approximateTextWidth(device.ip, { size: DEVICE_METRICS.ipSize, weight: 400, mono: true })
  );
  const half = Math.max(device.box.width / 2, wide / 2 + DEVICE_METRICS.textPad);
  const centre = device.box.x + device.box.width / 2;
  return { x: centre - half, y: device.box.y, width: 2 * half, height: device.box.height };
}

/** Where the name of an area is written, in its top left corner */
function areaNameBox(area: Scene['areas'][number], source: CanvasArea): Box {
  return {
    x: area.box.x,
    y: area.box.y,
    width: areaLabelReach(source, approximateTextWidth),
    height: AREA_METRICS.labelTop + AREA_METRICS.labelLine,
  };
}

/** Every label of a cable written over something else, in words */
export function crowding(drawing: Drawing): string[] {
  const scene = sceneOf(drawing);
  const areas = withIds(drawing);
  const name = (id: string) => drawing.devices.find((device) => device.id === id)?.label ?? id;
  const cableName = (id: string) => {
    const connection = drawing.connections.find((one) => one.id === id)!;
    return `the label of ${name(connection.source)}–${name(connection.target)}`;
  };
  const labels = scene.cables.flatMap((cable) => (cable.label ? [{ id: cable.id, box: cable.label.box }] : []));
  const found: string[] = [];
  for (const [index, label] of labels.entries()) {
    const room = grown(label.box, ROOM);
    for (const area of scene.areas) {
      const inside = holds(grown(area.box, -ROOM), label.box);
      if (touch(room, area.box) && !inside) found.push(`${cableName(label.id)} is on the border of ${area.label}`);
      const source = areas.find((one) => one.id === area.id)!;
      if (touch(room, areaNameBox(area, source))) found.push(`${cableName(label.id)} is on the name of ${area.label}`);
    }
    for (const device of scene.devices) {
      if (touch(room, deviceBox(device))) found.push(`${cableName(label.id)} is on ${device.label}`);
    }
    for (const other of labels.slice(index + 1)) {
      if (touch(grown(label.box, ROOM / 2), other.box)) found.push(`${cableName(label.id)} touches ${cableName(other.id)}`);
    }
  }
  return found;
}

/** Two devices whose frames, names or addresses touch, in words */
export function deviceOverlaps(drawing: Drawing): string[] {
  const devices = sceneOf(drawing).devices;
  const found: string[] = [];
  for (const [index, device] of devices.entries()) {
    for (const other of devices.slice(index + 1)) {
      if (touch(grown(deviceBox(device), ROOM / 2), deviceBox(other))) found.push(`${device.label} touches ${other.label}`);
    }
  }
  return found;
}

/** Areas that cross another (one wholly inside another is meant), and devices half in an area, in words */
export function areaProblems(drawing: Drawing): string[] {
  const scene = sceneOf(drawing);
  const found: string[] = [];
  for (const [index, area] of scene.areas.entries()) {
    for (const other of scene.areas.slice(index + 1)) {
      const nested = holds(area.box, other.box) || holds(other.box, area.box);
      if (touch(area.box, other.box) && !nested) found.push(`${area.label} crosses ${other.label}`);
    }
    for (const device of scene.devices) {
      const frame = device.box;
      if (touch(area.box, frame) && !holds(area.box, frame)) found.push(`${device.label} is half in ${area.label}`);
    }
  }
  return found;
}
