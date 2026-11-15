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
 * devices of the same level is left out of dagre, which would put one a rank
 * under the other: each stays on its level, held there by its cable to the
 * level above, and the two are side by side.
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

/**
 * How wide a device is, its name and its address included where they are
 * wider than the frame (a device on DHCP shows the address it is leased, and
 * says so)
 */
function widthOf(device: NetworkDevice): number {
  const leased = !device.ip && (device.nics ?? []).some((nic) => nic.dhcp === true);
  const text = Math.max(
    approximateTextWidth(device.label, { size: DEVICE_METRICS.nameSize, weight: 600 }),
    approximateTextWidth(leased ? '255.255.255.255 · DHCP' : (device.ip ?? ''), { size: DEVICE_METRICS.ipSize, weight: 400, mono: true })
  );
  return Math.max(DEVICE_METRICS.width, Math.ceil(text + 2 * DEVICE_METRICS.textPad));
}

/**
 * The leaves of a device stacked beside it (a comb), when the drawing laid
 * out plainly could not be seen whole: fitted to a window of 1568 × 779 (a
 * board of 1520 × 735, with the room fitView leaves around) it would be drawn
 * at less than a quarter of its size. A device needs a few leaves to have one.
 */
const COMB = {
  least: 3,
  zoom: 0.25,
  board: { width: 1520 / 1.2, height: 735 / 1.2 },
  /** From the line the cables share to the leaves, at the least */
  gap: 24,
  /** Between two leaves of a column (or of a row, horizontally) */
  between: 24,
  /** Around a label on the line the cables share */
  labelRoom: 8,
} as const;

/** A device and its leaves, stacked beside it; `block` is their place in the layout */
interface Comb {
  parent: string;
  block: string;
  leaves: NetworkDevice[];
  cables: Set<string>;
}

/**
 * How the leaves of a comb are stacked. Vertically (TB) in two columns, one
 * each side of a line from the middle of the parent, the left one half a row
 * lower, so that the labels on the line are never side by side; the first row
 * where the devices of that level are, so that the cables to the parent's
 * other children turn above the stack. Horizontally (LR) the same, turned: two
 * rows, one each side of a line from the middle of the parent. `cells` are the
 * middles of the leaves: across the line, from the middle of the parent; along
 * it, from the middle of `block`, the room the stack takes in the layout.
 */
function combShape(
  comb: Comb,
  direction: LayoutDirection,
  connections: NetworkConnection[]
): { block: { width: number; height: number }; cells: Array<{ x: number; y: number }> } {
  const across = Math.max(...comb.leaves.map((leaf) => (direction === 'TB' ? widthOf(leaf) : frameOf(leaf).height)));
  const along = Math.max(...comb.leaves.map((leaf) => (direction === 'TB' ? frameOf(leaf).height : widthOf(leaf))));
  const labels = connections.filter((one) => comb.cables.has(one.id)).map(labelSize);
  const label = Math.max(0, ...labels.map((size) => (direction === 'TB' ? size.width : size.height))) / 2;
  const gap = Math.max(COMB.gap, label + COMB.labelRoom);
  const pitch = along + COMB.between;
  const first = Math.ceil(comb.leaves.length / 2);
  const second = comb.leaves.length - first;
  const extent = Math.max(first * pitch, second * pitch + pitch / 2) - COMB.between;
  const cells = comb.leaves.map((_, index) => {
    const side = index % 2 === 0 ? 1 : -1;
    const step = Math.floor(index / 2) * pitch + (side < 0 ? pitch / 2 : 0);
    const off = side * (gap + across / 2);
    return direction === 'TB' ? { x: off, y: step } : { x: step, y: off };
  });
  const length = 2 * extent - along;
  const width = 2 * (gap + across);
  return { block: direction === 'TB' ? { width, height: length } : { width: length, height: width }, cells };
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

  const byId = new Map(devices.map((device) => [device.id, device] as const));

  // The leaves of a device (cabled to it alone, a level under it, in its
  // area), where it has a few: stacked beside it when the drawing is large
  const combs = (() => {
    const cablesOf = new Map<string, NetworkConnection[]>();
    for (const connection of connections) {
      if (connection.source === connection.target) continue;
      for (const id of [connection.source, connection.target]) cablesOf.set(id, [...(cablesOf.get(id) ?? []), connection]);
    }
    const found = new Map<string, Comb>();
    for (const device of placed) {
      const level = levels.get(device.id);
      const own = cablesOf.get(device.id) ?? [];
      if (level === undefined || own.length !== 1) continue;
      const cable = own[0];
      const parent = cable.source === device.id ? cable.target : cable.source;
      if (levels.get(parent) !== level - 1 || areaOf.get(parent) !== areaOf.get(device.id)) continue;
      const comb = found.get(parent) ?? { parent, block: `comb:${parent}`, leaves: [], cables: new Set<string>() };
      comb.leaves.push(device);
      comb.cables.add(cable.id);
      found.set(parent, comb);
    }
    return [...found.values()].filter((comb) => comb.leaves.length >= COMB.least);
  })();

  /**
   * Where each device goes, its leaves stacked in `stacked`. With `part`, the
   * devices of `members` alone, and `flip` lays them the other way round (the
   * top under them, or on their right)
   */
  const lay = (stacked: Comb[], part?: { members: Set<string>; flip: boolean }): NetworkDevice[] => {
    const inPart = (id: string) => !part || part.members.has(id);
    const flip = part?.flip ? -1 : 1;
    const ours = stacked.filter((comb) => inPart(comb.parent));
    const leafOf = new Map(ours.flatMap((comb) => comb.leaves.map((leaf) => [leaf.id, comb] as const)));
    const shapes = new Map(ours.map((comb) => [comb.block, combShape(comb, direction, connections)] as const));
    const rankdir = part?.flip ? (direction === 'TB' ? 'BT' : 'RL') : direction;
    const graph = new dagre.graphlib.Graph({ compound: true, multigraph: true });
    graph.setGraph({ rankdir, ...LAYOUT_SPACING[direction], marginx: 0, marginy: 0 });
    graph.setDefaultEdgeLabel(() => ({}));
    // (the areas that hold something of this part)
    const held = new Set<string>();
    for (const device of placed) {
      if (!inPart(device.id)) continue;
      for (let id = areaOf.get(device.id); id && !held.has(id); id = parentOf.get(id)) held.add(id);
    }
    for (const area of areas) if (held.has(area.id)) graph.setNode(area.id, {});
    for (const area of areas) {
      const parent = parentOf.get(area.id);
      if (held.has(area.id) && parent && held.has(parent)) graph.setParent(area.id, parent);
    }
    for (const device of placed) {
      if (leafOf.has(device.id) || !inPart(device.id)) continue;
      graph.setNode(device.id, { width: widthOf(device), height: frameOf(device).height });
      const area = areaOf.get(device.id);
      if (area) graph.setParent(device.id, area);
    }
    for (const comb of ours) {
      const shape = shapes.get(comb.block)!;
      graph.setNode(comb.block, { width: shape.block.width, height: shape.block.height });
      const area = areaOf.get(comb.parent);
      if (area) graph.setParent(comb.block, area);
      graph.setEdge(comb.parent, comb.block, { minlen: 1 }, comb.block);
    }

    // Every cable from its upper end to its lower one. One between two devices
    // of a level is left out: given to dagre (with a length of 0) it puts one
    // end a rank under the other, and other rankers fail on it
    for (const connection of connections) {
      const a = byId.get(connection.source);
      const b = byId.get(connection.target);
      if (!a || !b || a.id === b.id || !levels.has(a.id) || !levels.has(b.id)) continue;
      if (leafOf.has(a.id) || leafOf.has(b.id) || !inPart(a.id) || !inPart(b.id)) continue;
      const la = levels.get(a.id)!;
      const lb = levels.get(b.id)!;
      if (la === lb) continue;
      const [upper, lower] = la < lb ? [a, b] : [b, a];
      const label = labelSize(connection);
      graph.setEdge(
        upper.id,
        lower.id,
        { minlen: Math.abs(la - lb), width: label.width, height: label.height, labelpos: 'c' },
        connection.id
      );
    }

    dagre.layout(graph);

    // Where each device now is: its frame, in the middle of the room dagre
    // gave it; a leaf in its place in the stack, from where its parent is
    const result = devices.map((device) => {
      if (!placed.includes(device) || !inPart(device.id)) return device;
      const frame = frameOf(device);
      const comb = leafOf.get(device.id);
      if (!comb) {
        const node = graph.node(device.id);
        return { ...device, position: { x: Math.round(node.x - frame.width / 2), y: Math.round(node.y - frame.height / 2) } };
      }
      const block = graph.node(comb.block);
      const cell = shapes.get(comb.block)!.cells[comb.leaves.indexOf(device)];
      // (in the room dagre gave the stack, which the parent's other children
      // stay out of; the first row where the rank's devices are, the stack
      // going away from the parent)
      const x = direction === 'TB' ? block.x + cell.x : block.x + flip * cell.x;
      const y = direction === 'TB' ? block.y + flip * cell.y : block.y + cell.y;
      return { ...device, position: { x: Math.round(x - frame.width / 2), y: Math.round(y - frame.height / 2) } };
    });

    // Three cables or more between the same two devices (a router and its
    // switch, one for each VLAN): one goes straight, two go round either side,
    // close to it. In line, the label of the straight one would be on theirs:
    // the lower device is set aside by the width of a label, so that the
    // straight one bends, and its label with it
    const index = new Map(result.map((device, at) => [device.id, at] as const));
    const parallel = new Map<string, NetworkConnection[]>();
    for (const connection of connections) {
      const { source, target } = connection;
      if (source === target || !index.has(source) || !index.has(target) || !inPart(source) || !inPart(target)) continue;
      if (leafOf.has(source) || leafOf.has(target) || levels.get(source) === levels.get(target)) continue;
      const key = [source, target].sort().join(' ');
      parallel.set(key, [...(parallel.get(key) ?? []), connection]);
    }
    for (const cables of parallel.values()) {
      if (cables.length < 3) continue;
      const reach = Math.max(...cables.map(labelSize).map((size) => (direction === 'TB' ? size.width : size.height)));
      const [a, b] = [cables[0].source, cables[0].target];
      const lower = (levels.get(a) ?? 0) > (levels.get(b) ?? 0) ? a : b;
      const upper = lower === a ? b : a;
      const axis = direction === 'TB' ? 'x' : 'y';
      const offset = result[index.get(lower)!].position[axis] - result[index.get(upper)!].position[axis];
      if (reach === 0 || Math.abs(offset) >= reach) continue;
      const position = { ...result[index.get(lower)!].position };
      position[axis] = result[index.get(upper)!].position[axis] + (offset < 0 ? -reach : reach);
      result[index.get(lower)!] = { ...result[index.get(lower)!], position };
    }
    return result;
  };

  /**
   * A large drawing with one top (and that top in no area), laid out around
   * it: half of what hangs from it under it, the other half over it, laid the
   * other way round; an area goes whole with most of its devices, and the two
   * halves hold as many devices as can be. Undefined where it cannot be.
   */
  const halves = (() => {
    const tops = [...levels].filter(([, level]) => level === 0).map(([id]) => id);
    if (tops.length !== 1 || areaOf.has(tops[0])) return undefined;
    const top = tops[0];
    const neighbours = neighboursOf(devices, connections);
    // each device goes with the child of the top it is first reached through
    const branch = new Map<string, string>();
    const queue: string[] = [];
    for (const child of neighbours.get(top) ?? []) {
      if (levels.get(child) === 1 && !branch.has(child)) {
        branch.set(child, child);
        queue.push(child);
      }
    }
    if (queue.length < 2) return undefined;
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const next of neighbours.get(id) ?? []) {
        if (next !== top && !branch.has(next)) {
          branch.set(next, branch.get(id)!);
          queue.push(next);
        }
      }
    }
    // what goes together: the devices of an outermost area, or of a branch outside every area
    const outermost = (id: string) => {
      let area = areaOf.get(id);
      while (area && parentOf.get(area)) area = parentOf.get(area);
      return area;
    };
    const units = new Map<string, string[]>();
    for (const device of placed) {
      if (device.id === top) continue;
      const key = outermost(device.id) ?? `branch:${branch.get(device.id) ?? device.id}`;
      units.set(key, [...(units.get(key) ?? []), device.id]);
    }
    if (units.size < 2) return undefined;
    const under = new Set<string>([top]);
    const over = new Set<string>([top]);
    let [underCount, overCount] = [0, 0];
    for (const members of [...units.values()].sort((a, b) => b.length - a.length)) {
      const into = underCount <= overCount ? under : over;
      for (const id of members) into.add(id);
      if (into === under) underCount += members.length;
      else overCount += members.length;
    }
    return { top, under, over };
  })();

  /** The drawing laid out around its top (see halves), its leaves stacked in `stacked` */
  const layAround = (stacked: Comb[]): NetworkDevice[] => {
    const { top, under, over } = halves!;
    const below = lay(stacked, { members: under, flip: false });
    const above = lay(stacked, { members: over, flip: true });
    const here = below.find((device) => device.id === top)!.position;
    const there = above.find((device) => device.id === top)!.position;
    return below.map((device, index) =>
      over.has(device.id) && device.id !== top
        ? { ...device, position: { x: above[index].position.x + here.x - there.x, y: above[index].position.y + here.y - there.y } }
        : device
    );
  };

  // The cables of the combs in use (none, until the leaves are stacked)
  let stackedCables = new Map<string, Comb>();

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
      // (a cable of a comb leaves its parent on the line it shares with the
      // others, and comes into the leaf from that line's side)
      const comb = stackedCables.get(connection.id);
      if (comb) {
        const parent = ends.get(comb.parent)!;
        const leaf = ends.get(connection.source === comb.parent ? connection.target : connection.source)!;
        const right = leaf.x + leaf.width / 2 > parent.x + parent.width / 2;
        const below = leaf.y + leaf.height / 2 > parent.y + parent.height / 2;
        const [parentSide, leafSide] =
          direction === 'TB'
            ? [below ? 'bottom' : 'top', right ? 'left' : 'right']
            : [right ? 'right' : 'left', below ? 'top' : 'bottom'];
        return connection.source === comb.parent
          ? { ...connection, sourceHandle: parentSide, targetHandle: leafSide }
          : { ...connection, sourceHandle: leafSide, targetHandle: parentSide };
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

  // Laid out plainly; where that could not be seen whole, the other ways it
  // can be, the leaves stacked, around the top, both: the one seen largest
  let start = redraw(lay([]));
  if (seenAt(start) < COMB.zoom) {
    const ways: Array<{ stacked: Comb[]; around: boolean }> = [];
    if (combs.length > 0) ways.push({ stacked: combs, around: false });
    if (halves) ways.push({ stacked: [], around: true });
    if (halves && combs.length > 0) ways.push({ stacked: combs, around: true });
    let best: Comb[] = [];
    for (const way of ways) {
      stackedCables = new Map(way.stacked.flatMap((comb) => [...comb.cables].map((id) => [id, comb] as const)));
      const tried = redraw(way.around ? layAround(way.stacked) : lay(way.stacked));
      if (seenAt(tried) > seenAt(start)) {
        start = tried;
        best = way.stacked;
      }
    }
    stackedCables = new Map(best.flatMap((comb) => [...comb.cables].map((id) => [id, comb] as const)));
  }

  // Where a label lies on something, the drawing is opened up there
  return makeRoom(start, redraw, deviceTemplates);
}

/** How large a drawing is drawn fitted to the reference window (see COMB) */
function seenAt(drawing: LayoutResult): number {
  const boxes = [
    ...drawing.devices.map((device) => ({ ...device.position, ...frameOf(device) })),
    ...drawing.areas.map((area) => ({ ...area.position, ...area.size })),
  ];
  const width = Math.max(...boxes.map((box) => box.x + box.width)) - Math.min(...boxes.map((box) => box.x));
  const height = Math.max(...boxes.map((box) => box.y + box.height)) - Math.min(...boxes.map((box) => box.y));
  return Math.min(COMB.board.width / width, COMB.board.height / height);
}
