/**
 * Room where a laid out drawing is crowded. The automatic layout gives the
 * levels and the order of the devices; what it cannot know is where the
 * board will write the label of a cable (halfway along its middle run) and
 * how far an area reaches around its devices. This looks at the drawing as
 * the board draws it (layoutDrawing) and, where a label lies on the border or
 * the name of an area, on a device or on another label, where two devices
 * touch or two areas cross, it opens a gap: everything beyond a line is moved
 * away, as far as it takes. One gap at a time, until nothing is crowded or
 * the gaps stop helping.
 */

import type { CanvasArea, DeviceTemplate, NetworkConnection, NetworkDevice } from '@/types';
import {
  AREA_METRICS,
  DEVICE_METRICS,
  approximateTextWidth,
  areaLabelReach,
  layoutDrawing,
  type Box,
  type Scene,
} from '@/utils/drawingImage';

/** The room asked for around a label of a cable */
const ROOM = 4;
/** The most gaps opened in one layout */
const MOST_GAPS = 80;

type Axis = 'x' | 'y';

export interface RoomDrawing {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  areas: CanvasArea[];
}

/** A gap to open: everything whose middle is beyond `at` on `axis` goes `by` further */
interface Gap {
  axis: Axis;
  at: number;
  by: number;
}

const lo = (box: Box, axis: Axis) => (axis === 'x' ? box.x : box.y);
const hi = (box: Box, axis: Axis) => (axis === 'x' ? box.x + box.width : box.y + box.height);
const mid = (box: Box, axis: Axis) => (lo(box, axis) + hi(box, axis)) / 2;
const grown = (box: Box, by: number): Box => ({ x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by });
const touch = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const holds = (outer: Box, inner: Box) =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;

/** What a device takes on the board: its frame, and its name or address where wider */
function deviceBox(device: Scene['devices'][number]): Box {
  const wide = Math.max(
    approximateTextWidth(device.label, { size: DEVICE_METRICS.nameSize, weight: 600 }),
    approximateTextWidth(device.ip, { size: DEVICE_METRICS.ipSize, weight: 400, mono: true })
  );
  const half = Math.max(device.box.width / 2, wide / 2 + DEVICE_METRICS.textPad);
  const centre = device.box.x + device.box.width / 2;
  return { x: centre - half, y: device.box.y, width: 2 * half, height: device.box.height };
}

/**
 * The gap that parts a thing that moves with some of the devices from
 * another: `moves` is how far each moves for a gap of 1 beyond `at` (a label
 * moves half as far when one end of its cable is beyond, and the other not).
 * The one further along goes on beyond the other; when it cannot (it moves no
 * further), the other way round: two things across each other, a label on the
 * line of a border, have no order of their own. Undefined when no gap at `at`
 * can part them.
 */
function parting(
  axis: Axis,
  at: number,
  first: { box: Box; moves: number },
  second: { box: Box; moves: number },
  room: number
): Gap | undefined {
  const along = mid(first.box, axis) <= mid(second.box, axis) ? [first, second] : [second, first];
  for (const [before, after] of [along, [along[1], along[0]]]) {
    const rate = after.moves - before.moves;
    if (rate <= 0) continue;
    const needed = hi(before.box, axis) + room - lo(after.box, axis);
    if (needed <= 0) return undefined;
    return { axis, at, by: Math.ceil(needed / rate) + 1 };
  }
  return undefined;
}

/** The first crowded place of the drawing, and the gap that clears it */
function firstGap(drawing: RoomDrawing, scene: Scene): Gap | undefined {
  const centreOf = new Map(scene.devices.map((device) => [device.id, device.box] as const));
  /** How far a device moves, for a gap of 1 beyond `at` */
  const deviceMoves = (id: string, axis: Axis, at: number) => (mid(centreOf.get(id)!, axis) > at ? 1 : 0);
  /** How far the label of a cable moves: half as far for each end beyond */
  const labelMoves = (id: string, axis: Axis, at: number) => {
    const connection = drawing.connections.find((one) => one.id === id)!;
    return (deviceMoves(connection.source, axis, at) + deviceMoves(connection.target, axis, at)) / 2;
  };
  /** How far an area moves: as its devices do, near enough (its side beyond the line goes with them) */
  const areaMoves = (box: Box, axis: Axis, at: number) => (mid(box, axis) > at ? 1 : 0);

  /** The gap at the middle of the two, or at the middle of the first, whichever parts them */
  const between = (
    first: { box: Box; moves: (axis: Axis, at: number) => number },
    second: { box: Box; moves: (axis: Axis, at: number) => number },
    room: number
  ): Gap | undefined => {
    // along the axis they overlap the least
    const overlap = (axis: Axis) => Math.min(hi(first.box, axis), hi(second.box, axis)) - Math.max(lo(first.box, axis), lo(second.box, axis));
    const axes: Axis[] = overlap('x') <= overlap('y') ? ['x', 'y'] : ['y', 'x'];
    for (const axis of axes) {
      for (const at of [(mid(first.box, axis) + mid(second.box, axis)) / 2, mid(first.box, axis), mid(second.box, axis)]) {
        const gap = parting(axis, at, { box: first.box, moves: first.moves(axis, at) }, { box: second.box, moves: second.moves(axis, at) }, room);
        if (gap) return gap;
      }
    }
    return undefined;
  };

  // Two devices whose frames, names or addresses touch
  for (const [index, device] of scene.devices.entries()) {
    for (const other of scene.devices.slice(index + 1)) {
      if (!touch(grown(deviceBox(device), ROOM / 2), deviceBox(other))) continue;
      const gap = between(
        { box: deviceBox(device), moves: (axis, at) => deviceMoves(device.id, axis, at) },
        { box: deviceBox(other), moves: (axis, at) => deviceMoves(other.id, axis, at) },
        ROOM
      );
      if (gap) return gap;
    }
  }

  // Two areas across each other (one inside another is meant)
  for (const [index, area] of scene.areas.entries()) {
    for (const other of scene.areas.slice(index + 1)) {
      if (!touch(area.box, other.box) || holds(area.box, other.box) || holds(other.box, area.box)) continue;
      const gap = between(
        { box: area.box, moves: (axis, at) => areaMoves(area.box, axis, at) },
        { box: other.box, moves: (axis, at) => areaMoves(other.box, axis, at) },
        6
      );
      if (gap) return gap;
    }
  }

  // A label of a cable on something
  const labels = scene.cables.flatMap((cable) => (cable.label ? [{ id: cable.id, box: cable.label.box }] : []));
  for (const [index, label] of labels.entries()) {
    const room = grown(label.box, ROOM);
    const asLabel = { box: label.box, moves: (axis: Axis, at: number) => labelMoves(label.id, axis, at) };
    for (const area of scene.areas) {
      // on a side of the border: the side, a line, is parted from the label
      const inside = holds(grown(area.box, -ROOM), label.box);
      if (touch(room, area.box) && !inside) {
        const sides: Array<{ axis: Axis; at: number }> = [
          { axis: 'x', at: area.box.x },
          { axis: 'x', at: area.box.x + area.box.width },
          { axis: 'y', at: area.box.y },
          { axis: 'y', at: area.box.y + area.box.height },
        ];
        for (const side of sides) {
          if (side.at <= lo(room, side.axis) || side.at >= hi(room, side.axis)) continue;
          const line: Box =
            side.axis === 'x'
              ? { x: side.at, y: area.box.y, width: 0, height: area.box.height }
              : { x: area.box.x, y: side.at, width: area.box.width, height: 0 };
          if (!touch(grown(line, 0.5), room)) continue;
          // the side moves with the devices of the area on its side of the line
          const lineMoves = (axis: Axis, at: number) => (axis === side.axis && side.at > at ? 1 : areaMoves(area.box, axis, at));
          for (const at of [mid(label.box, side.axis), (mid(label.box, side.axis) + side.at) / 2]) {
            const gap = parting(side.axis, at, { box: label.box, moves: asLabel.moves(side.axis, at) }, { box: line, moves: lineMoves(side.axis, at) }, ROOM);
            if (gap) return gap;
          }
        }
      }
      // on the name of the area
      const source = drawing.areas.find((one) => one.id === area.id);
      if (source) {
        const name: Box = {
          x: area.box.x,
          y: area.box.y,
          width: areaLabelReach(source, approximateTextWidth),
          height: AREA_METRICS.labelTop + AREA_METRICS.labelLine,
        };
        if (touch(room, name)) {
          const gap = between(asLabel, { box: name, moves: (axis, at) => areaMoves(area.box, axis, at) }, ROOM);
          if (gap) return gap;
        }
      }
    }
    for (const device of scene.devices) {
      if (!touch(room, deviceBox(device))) continue;
      const gap = between(asLabel, { box: deviceBox(device), moves: (axis, at) => deviceMoves(device.id, axis, at) }, ROOM);
      if (gap) return gap;
    }
    for (const other of labels.slice(index + 1)) {
      if (!touch(grown(label.box, ROOM / 2), other.box)) continue;
      const gap = between(asLabel, { box: other.box, moves: (axis, at) => labelMoves(other.id, axis, at) }, ROOM / 2);
      if (gap) return gap;
    }
  }
  return undefined;
}

/**
 * Open gaps until nothing is crowded (or MOST_GAPS have been opened). `redraw`
 * draws the areas again around their devices, and gives the sides of the
 * cables again, after each gap: the drawing handed back is the last one.
 */
export function makeRoom(
  start: RoomDrawing,
  redraw: (devices: NetworkDevice[]) => RoomDrawing,
  deviceTemplates: DeviceTemplate[]
): RoomDrawing {
  let drawing = start;
  for (let count = 0; count < MOST_GAPS; count++) {
    const scene = layoutDrawing({
      devices: drawing.devices.map((device) =>
        device.ip || !(device.nics ?? []).some((nic) => nic.dhcp === true) ? device : { ...device, ip: '0.0.0.0 · DHCP' }
      ),
      connections: drawing.connections,
      areas: drawing.areas,
      deviceTemplates,
      connectionTemplates: [],
      measureText: approximateTextWidth,
    });
    const gap = firstGap(drawing, scene);
    if (!gap) break;
    const centre = new Map(scene.devices.map((device) => [device.id, device.box] as const));
    const moved = drawing.devices.map((device) => {
      const box = centre.get(device.id)!;
      if (mid(box, gap.axis) <= gap.at) return device;
      const position = { ...device.position };
      position[gap.axis] += gap.by;
      return { ...device, position };
    });
    drawing = redraw(moved);
  }
  return drawing;
}
