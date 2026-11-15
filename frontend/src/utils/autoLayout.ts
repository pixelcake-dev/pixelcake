/**
 * The automatic layout of a drawing (Vista → Disposizione automatica): the
 * devices placed again in levels, from where the traffic leaves the network
 * down to the devices people use, and the areas drawn again around their
 * devices.
 *
 * The levels come from the network, not from how it was drawn. The top of a
 * group of devices cabled together is where its traffic leaves: its Internet
 * (any Cloud symbol); without one, its firewalls; without those, its routers;
 * without those, the switch with the most cables. All the devices of that kind
 * are tops together, but when some of them are cabled to nothing else than
 * routers, firewalls and clouds (a router in the middle of a WAN, between two
 * sites), those alone are: the others hang under them. A device is as many levels down as there are cables
 * between it and the nearest top, and every cable is laid from the upper end
 * to the lower one, whichever end it was drawn from. A cable between two
 * devices of the same level keeps them side by side.
 *
 * The areas are groups of the layout (dagre's compound graph): the devices of
 * an area, and the areas inside it, stay together, and the area is drawn
 * again around them with the room «Racchiudi in un riquadro» leaves. Devices
 * with no cable, and areas with no device, are put apart, under the rest.
 *
 * No React, no store: the same drawing gives the same layout.
 */

import dagre from 'dagre';
import type { CanvasArea, DeviceTemplate, NetworkConnection, NetworkDevice } from '@/types';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';
import { approximateTextWidth } from '@/utils/drawingImage';
import { areaAround } from '@/utils/canvasAreas';
import { makeRoom } from '@/utils/layoutRoom';

export type LayoutDirection = 'TB' | 'LR';

export interface LayoutInput {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  areas: CanvasArea[];
}

export type LayoutResult = LayoutInput;

/** The kinds a top can be of, in the order they are looked for */
const TOP_KINDS = ['Cloud', 'Firewall', 'Router'] as const;

/**
 * The room the layout leaves: between two devices side by side, and between
 * two levels. Between two levels there is room for the label of a cable and,
 * where the cable leaves an area, for the borders and the name of the areas
 */
export const LAYOUT_SPACING = {
  TB: { nodesep: 40, ranksep: 80, edgesep: 20 },
  LR: { nodesep: 32, ranksep: 110, edgesep: 20 },
} as const;

/** Where the devices with no cable, and the areas with none, are put: under the drawing */
const APART = { gap: 96, columnGap: 56, rowGap: 56 } as const;

/** The size of a label of a cable, as the board draws it: its speed, its name */
function labelSize(connection: NetworkConnection): { width: number; height: number } {
  const lines = [connection.bandwidth, connection.label].filter((line): line is string => Boolean(line));
  if (lines.length === 0) return { width: 0, height: 0 };
  const width = Math.max(...lines.map((line) => approximateTextWidth(line, { size: 12, weight: 600 })));
  return { width: Math.round(width + 18), height: lines.length * 16 + 10 };
}

/** The frame of a device, as the board draws it: a line lower when it shows no address */
function frameOf(device: NetworkDevice): { width: number; height: number } {
  const shows = Boolean(device.ip) || (device.nics ?? []).some((nic) => nic.dhcp === true);
  return { width: DEVICE_METRICS.width, height: deviceHeight(shows) };
}

/** How wide a device is, its name and its address included where they are wider than the frame */
function widthOf(device: NetworkDevice): number {
  const text = Math.max(
    approximateTextWidth(device.label, { size: DEVICE_METRICS.nameSize, weight: 600 }),
    approximateTextWidth(device.ip ?? '', { size: DEVICE_METRICS.ipSize, weight: 400, mono: true })
  );
  return Math.max(DEVICE_METRICS.width, Math.ceil(text + 2 * DEVICE_METRICS.textPad));
}

/** The devices each device is cabled to, both ways: a cable is the same whichever end it starts from */
function neighboursOf(devices: NetworkDevice[], connections: NetworkConnection[]): Map<string, Set<string>> {
  const known = new Set(devices.map((device) => device.id));
  const neighbours = new Map(devices.map((device) => [device.id, new Set<string>()] as const));
  for (const connection of connections) {
    const { source, target } = connection;
    if (source === target || !known.has(source) || !known.has(target)) continue;
    neighbours.get(source)!.add(target);
    neighbours.get(target)!.add(source);
  }
  return neighbours;
}

/**
 * The level of each device that has a cable: 0 for a top, then one more for
 * each cable between it and the nearest top (see the top of the file for
 * what a top is). A device with no cable has none.
 */
export function networkLevels(devices: NetworkDevice[], connections: NetworkConnection[]): Map<string, number> {
  const neighbours = neighboursOf(devices, connections);
  const byId = new Map(devices.map((device) => [device.id, device] as const));
  const levels = new Map<string, number>();
  const seen = new Set<string>();

  for (const start of devices) {
    if (seen.has(start.id) || neighbours.get(start.id)!.size === 0) continue;
    // The devices cabled together with this one
    const group: NetworkDevice[] = [];
    const queue = [start.id];
    seen.add(start.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      group.push(byId.get(id)!);
      for (const next of neighbours.get(id)!) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }

    // Its tops: where its traffic leaves
    const ofKind = (kind: string) => group.filter((device) => device.type === kind);
    let tops = TOP_KINDS.map(ofKind).find((found) => found.length > 0);
    if (tops) {
      const outward = (device: NetworkDevice) =>
        [...neighbours.get(device.id)!].every((id) => (TOP_KINDS as readonly string[]).includes(byId.get(id)!.type));
      const transit = tops.filter(outward);
      if (transit.length > 0 && transit.length < tops.length) tops = transit;
    }
    if (!tops) {
      const switches = ofKind('Switch');
      const pool = switches.length > 0 ? switches : group;
      const most = Math.max(...pool.map((device) => neighbours.get(device.id)!.size));
      tops = pool.filter((device) => neighbours.get(device.id)!.size === most);
    }

    // As many levels down as cables from the nearest top
    const level = new Map<string, number>(tops.map((device) => [device.id, 0]));
    const wave = tops.map((device) => device.id);
    while (wave.length > 0) {
      const id = wave.shift()!;
      for (const next of neighbours.get(id)!) {
        if (!level.has(next)) {
          level.set(next, level.get(id)! + 1);
          wave.push(next);
        }
      }
    }
    for (const [id, value] of level) levels.set(id, value);
  }
  return levels;
}

/**
 * For each area, the area it is inside of (the smallest that holds it whole),
 * and for each device the smallest area that holds its frame whole
 */
function membership(devices: NetworkDevice[], areas: CanvasArea[]) {
  const box = (area: CanvasArea) => ({ ...area.position, ...area.size });
  const holds = (
    outer: { x: number; y: number; width: number; height: number },
    inner: { x: number; y: number; width: number; height: number }
  ) =>
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height;
  const smallest = (candidates: CanvasArea[]) =>
    candidates.sort((a, b) => a.size.width * a.size.height - b.size.width * b.size.height)[0];

  const areaOf = new Map<string, string>();
  for (const device of devices) {
    const frame = { ...device.position, ...frameOf(device) };
    const inside = smallest(areas.filter((area) => holds(box(area), frame)));
    if (inside) areaOf.set(device.id, inside.id);
  }
  const parentOf = new Map<string, string>();
  for (const area of areas) {
    const outer = smallest(areas.filter((other) => other.id !== area.id && holds(box(other), box(area)) && !holds(box(area), box(other))));
    if (outer) parentOf.set(area.id, outer.id);
  }
  return { areaOf, parentOf };
}

/** The sides a cable ends on, from where its two ends now are: across the levels, or side by side */
function sidesOf(
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
  direction: LayoutDirection
): { sourceHandle: string; targetHandle: string } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const across = direction === 'TB' ? Math.abs(dy) > Math.min(from.height, to.height) / 2 : Math.abs(dx) > Math.min(from.width, to.width) / 2;
  const vertical = direction === 'TB' ? across : !across;
  if (vertical) return dy > 0 ? { sourceHandle: 'bottom', targetHandle: 'top' } : { sourceHandle: 'top', targetHandle: 'bottom' };
  return dx > 0 ? { sourceHandle: 'right', targetHandle: 'left' } : { sourceHandle: 'left', targetHandle: 'right' };
}

/**
 * The drawing laid out again, vertically (TB: the tops above) or
 * horizontally (LR: the tops on the left). Devices, cables (the sides they
 * end on) and areas are handed back; nothing else of them changes.
 */
export function arrangeDrawing(
  input: LayoutInput,
  direction: LayoutDirection = 'TB',
  deviceTemplates: DeviceTemplate[] = []
): LayoutResult {
  const { devices, connections, areas } = input;
  if (devices.length === 0) return input;

  const levels = networkLevels(devices, connections);
  const { areaOf, parentOf } = membership(devices, areas);

  // The areas that hold something: a device, or an area that does
  const holding = new Set<string>();
  const mark = (areaId: string | undefined) => {
    for (let id = areaId; id && !holding.has(id); id = parentOf.get(id)) holding.add(id);
  };
  for (const device of devices) mark(areaOf.get(device.id));

  // In the layout: every device with a cable, and every device of an area
  // (a device of an area stays with it, cable or not)
  const placed = devices.filter((device) => levels.has(device.id) || areaOf.has(device.id));
  const apart = devices.filter((device) => !placed.includes(device));

  const graph = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  graph.setGraph({ rankdir: direction, ...LAYOUT_SPACING[direction], marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const area of areas) if (holding.has(area.id)) graph.setNode(area.id, {});
  for (const area of areas) {
    const parent = parentOf.get(area.id);
    if (holding.has(area.id) && parent && holding.has(parent)) graph.setParent(area.id, parent);
  }
  for (const device of placed) {
    graph.setNode(device.id, { width: widthOf(device), height: frameOf(device).height });
    const area = areaOf.get(device.id);
    if (area) graph.setParent(device.id, area);
  }

  // Every cable from its upper end to its lower one; side by side when the two are on one level
  const kindOrder = (device: NetworkDevice) => {
    const index = ['Cloud', 'Firewall', 'Router', 'Switch'].indexOf(device.type);
    return index === -1 ? 4 : index;
  };
  const byId = new Map(devices.map((device) => [device.id, device] as const));
  for (const connection of connections) {
    const a = byId.get(connection.source);
    const b = byId.get(connection.target);
    if (!a || !b || a.id === b.id || !levels.has(a.id) || !levels.has(b.id)) continue;
    const la = levels.get(a.id)!;
    const lb = levels.get(b.id)!;
    const upperFirst = la < lb || (la === lb && (kindOrder(a) < kindOrder(b) || (kindOrder(a) === kindOrder(b) && a.id < b.id)));
    const [upper, lower] = upperFirst ? [a, b] : [b, a];
    const label = labelSize(connection);
    graph.setEdge(
      upper.id,
      lower.id,
      { minlen: Math.abs(la - lb), weight: la === lb ? 2 : 1, width: label.width, height: label.height, labelpos: 'c' },
      connection.id
    );
  }

  dagre.layout(graph);

  // Where each device now is: its frame, in the middle of the room dagre gave it
  const laid = devices.map((device) => {
    if (!placed.includes(device)) return device;
    const node = graph.node(device.id);
    const frame = frameOf(device);
    return { ...device, position: { x: Math.round(node.x - frame.width / 2), y: Math.round(node.y - frame.height / 2) } };
  });

  // The areas around their devices, what is apart under the rest, the sides of
  // the cables: worked out again each time the devices move
  const depth = (id: string) => {
    let count = 0;
    for (let parent = parentOf.get(id); parent; parent = parentOf.get(parent)) count++;
    return count;
  };
  const redraw = (now: NetworkDevice[]): LayoutResult => {
    const at = new Map(now.map((device) => [device.id, device] as const));
    const frameAt = (id: string) => ({ ...at.get(id)!.position, ...frameOf(at.get(id)!) });

    // The areas drawn again around what they hold, the inner ones first
    const drawn = new Map<string, Pick<CanvasArea, 'position' | 'size'>>();
    for (const area of [...areas].filter((one) => holding.has(one.id)).sort((a, b) => depth(b.id) - depth(a.id))) {
      const boxes = [
        ...placed.filter((device) => areaOf.get(device.id) === area.id).map((device) => frameAt(device.id)),
        ...[...drawn.entries()]
          .filter(([id]) => parentOf.get(id) === area.id)
          .map(([, inner]) => ({ ...inner.position, ...inner.size })),
      ];
      const around = areaAround(boxes);
      if (around) drawn.set(area.id, { position: around.position, size: around.size });
    }

    // What is apart: under the rest, the devices with no cable in rows, then the empty areas
    const boxes = [
      ...placed.map((device) => frameAt(device.id)),
      ...[...drawn.values()].map((area) => ({ ...area.position, ...area.size })),
    ];
    const left = boxes.length > 0 ? Math.min(...boxes.map((box) => box.x)) : 0;
    const right = boxes.length > 0 ? Math.max(...boxes.map((box) => box.x + box.width)) : 0;
    let top = boxes.length > 0 ? Math.max(...boxes.map((box) => box.y + box.height)) + APART.gap : 0;
    const width = Math.max(right - left, 4 * (DEVICE_METRICS.width + APART.columnGap));
    const moved = new Map<string, { x: number; y: number }>();
    if (apart.length > 0) {
      const pitch = Math.max(...apart.map(widthOf)) + APART.columnGap;
      const perRow = Math.max(1, Math.floor((width + APART.columnGap) / pitch));
      const rowHeight = deviceHeight(true) + APART.rowGap;
      apart.forEach((device, index) => {
        const column = index % perRow;
        const row = Math.floor(index / perRow);
        const centre = left + column * pitch + pitch / 2 - APART.columnGap / 2;
        moved.set(device.id, { x: Math.round(centre - DEVICE_METRICS.width / 2), y: top + row * rowHeight });
      });
      top += Math.ceil(apart.length / perRow) * rowHeight + APART.gap - APART.rowGap;
    }
    let x = left;
    for (const area of areas.filter((one) => !holding.has(one.id))) {
      drawn.set(area.id, { position: { x, y: top }, size: area.size });
      x += area.size.width + APART.columnGap;
    }
    const laidDevices = now.map((device) => (moved.has(device.id) ? { ...device, position: moved.get(device.id)! } : device));
    const ends = new Map(laidDevices.map((device) => [device.id, { ...device.position, ...frameOf(device) }] as const));

    // (a second cable between the same two devices goes round on one side,
    // a third on the other, so that neither they nor their labels lie on the first)
    const pairs = new Map<string, number>();
    const laidConnections = connections.map((connection) => {
      if (!ends.has(connection.source) || !ends.has(connection.target) || connection.source === connection.target) {
        return connection;
      }
      const pair = [connection.source, connection.target].sort().join(' ');
      const nth = pairs.get(pair) ?? 0;
      pairs.set(pair, nth + 1);
      const twice = connections.filter((other) => [other.source, other.target].sort().join(' ') === pair).length > 1;
      if (twice && nth < 2) {
        const side = (direction === 'TB' ? ['left', 'right'] : ['top', 'bottom'])[nth];
        return { ...connection, sourceHandle: side, targetHandle: side };
      }
      return { ...connection, ...sidesOf(ends.get(connection.source)!, ends.get(connection.target)!, direction) };
    });
    const laidAreas = areas.map((area) => {
      const now = drawn.get(area.id);
      return now ? { ...area, position: now.position, size: now.size } : area;
    });
    return { devices: laidDevices, connections: laidConnections, areas: laidAreas };
  };

  // Where a label lies on something, the drawing is opened up there
  return makeRoom(redraw(laid), redraw, deviceTemplates);
}
