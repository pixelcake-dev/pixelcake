/**
 * The samples as a visitor first sees them: loaded, and fit to a window of
 * 1568 × 779 with the side panel closed, a board of 1520 × 735. Each is
 * drawn large enough for its names to be read, and nothing is written over
 * anything else: no label of a cable on the border of an area, on the name
 * of an area, on a device or on another label.
 *
 * The boxes are those of the exported image (layoutDrawing), which repeats
 * the numbers of the style sheet; texts are measured roughly
 * (approximateTextWidth), so a few pixels of room are asked for around
 * each label.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setLanguage, type Language } from '@/i18n';
import { crowding, deviceBox, sceneOf, touch } from '@/test/drawingChecks';
import { createCompanySample } from './sampleCompany';
import { createPerimeterSample } from './samplePerimeter';
import { createRedundancySample } from './sampleRedundancy';
import { createSampleTopology } from './sampleTopology';
import type { SampleNetwork } from './sampleNetwork';
import { type Box, type Scene } from './drawingImage';

const SAMPLES: Array<[string, () => SampleNetwork]> = [
  ['the company', createCompanySample],
  ['the small office', createSampleTopology],
  ['the site', createPerimeterSample],
  ['the two sites', createRedundancySample],
];
const LANGUAGES: Language[] = ['it', 'en'];

/** The board of a 1568 × 779 window, the side panel closed (measured in the browser) */
const BOARD = { width: 1520, height: 735 } as const;
/** The room NetworkCanvas leaves around a drawing it fits to the window */
const FIT_PADDING = 0.2;
/** The least zoom a sample is fitted at: a drawing 38 px wide, names of 10 px */
const LEAST_ZOOM = 0.8;

afterEach(() => setLanguage('it'));

/**
 * The zoom React Flow fits the drawing at (fitView): the box of its devices
 * and areas, with the padding around, in the board
 */
function fitZoom(scene: Scene): number {
  const boxes = [...scene.devices.map((device) => device.box), ...scene.areas.map((area) => area.box)];
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const width = Math.max(...boxes.map((box) => box.x + box.width)) - left;
  const height = Math.max(...boxes.map((box) => box.y + box.height)) - top;
  return Math.min(BOARD.width / (width * (1 + FIT_PADDING)), BOARD.height / (height * (1 + FIT_PADDING)), 4);
}

/** The small map in the bottom right corner of the board (React Flow's MiniMap: 200 × 150, 15 from the sides) */
const SMALL_MAP: Box = { x: BOARD.width - 15 - 200, y: BOARD.height - 15 - 150, width: 200, height: 150 };

/** Where a box of the drawing is on the board once it is fitted: centred, at the zoom of fitZoom */
function onBoard(scene: Scene, box: Box): Box {
  const boxes = [...scene.devices.map((device) => device.box), ...scene.areas.map((area) => area.box)];
  const left = Math.min(...boxes.map((one) => one.x));
  const top = Math.min(...boxes.map((one) => one.y));
  const right = Math.max(...boxes.map((one) => one.x + one.width));
  const bottom = Math.max(...boxes.map((one) => one.y + one.height));
  const zoom = fitZoom(scene);
  const x = BOARD.width / 2 - ((left + right) / 2) * zoom;
  const y = BOARD.height / 2 - ((top + bottom) / 2) * zoom;
  return { x: x + box.x * zoom, y: y + box.y * zoom, width: box.width * zoom, height: box.height * zoom };
}


describe.each(SAMPLES)('%s, as a visitor first sees it', (_, create) => {
  it.each(LANGUAGES)('%s: fit to the window, its drawings are large enough to read', (language) => {
    setLanguage(language);
    const zoom = fitZoom(sceneOf(create()));
    expect(zoom).toBeGreaterThanOrEqual(LEAST_ZOOM);
    // (and no smaller than the company, the first one shown)
    expect(zoom).toBeGreaterThanOrEqual(fitZoom(sceneOf(createCompanySample())) - 0.001);
  });

  it.each(LANGUAGES)('%s: no label of a cable is written over an area border or name, a device, another label', (language) => {
    setLanguage(language);
    expect(crowding(create())).toEqual([]);
  });

  it('the cables of one device to a row of devices run on one line, their labels on it', () => {
    const sample = create();
    const scene = sceneOf(sample);
    const box = (id: string) => scene.devices.find((device) => device.id === id)!.box;
    /** The heights the horizontal parts of a path are at */
    const runsOf = (path: string) => {
      const points = [...path.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((found) => [Number(found[1]), Number(found[2])]);
      return points.slice(1).flatMap(([x, y], index) => (y === points[index][1] && x !== points[index][0] ? [y] : []));
    };
    // cables that leave one device by its bottom for the tops of devices that stand in one row
    const groups = new Map<string, Array<{ label: number | null; runs: number[] }>>();
    for (const connection of sample.connections) {
      const cable = scene.cables.find((one) => one.id === connection.id)!;
      const ends = [
        [connection.source, connection.sourceHandle, connection.target, connection.targetHandle],
        [connection.target, connection.targetHandle, connection.source, connection.sourceHandle],
      ];
      for (const [from, fromSide, to, toSide] of ends) {
        if (fromSide !== 'bottom' || toSide !== 'top') continue;
        const key = `${from} ${box(to!).y}`;
        const label = cable.label ? cable.label.box.y + cable.label.box.height / 2 : null;
        groups.set(key, [...(groups.get(key) ?? []), { label, runs: runsOf(cable.path) }]);
      }
    }
    const rows = [...groups.values()].filter((group) => group.length > 1);
    if (create === createCompanySample) expect(rows.some((group) => group.length === 5)).toBe(true);
    for (const group of rows) {
      const runs = new Set(group.flatMap((cable) => cable.runs.map((y) => y.toFixed(2))));
      expect(runs.size, JSON.stringify(group)).toBeLessThanOrEqual(1);
      const labels = new Set(group.flatMap((cable) => (cable.label === null ? [] : [cable.label.toFixed(2)])));
      expect(labels.size, JSON.stringify(group)).toBeLessThanOrEqual(1);
    }
  });

  it.each(LANGUAGES)('%s: no device and no label of a cable is under the small map of the board', (language) => {
    setLanguage(language);
    const scene = sceneOf(create());
    const hidden = [
      ...scene.devices.filter((device) => touch(onBoard(scene, deviceBox(device)), SMALL_MAP)).map((device) => device.label),
      ...scene.cables
        .filter((cable) => cable.label && touch(onBoard(scene, cable.label.box), SMALL_MAP))
        .map((cable) => `the label of ${cable.id}`),
    ];
    expect(hidden).toEqual([]);
  });
});

describe('the measure itself', () => {
  it('finds a label on the border of an area, and the zoom the board fits a drawing at', () => {
    setLanguage('en');
    const sample = createCompanySample();
    // the label of the cable from the router to the firewall, on the top border of the core
    const router = sample.devices.find((device) => device.id === 'router-core')!;
    const core = sample.areas.find((area) => area.label === 'Core')!;
    const moved: SampleNetwork = {
      ...sample,
      areas: sample.areas.map((area) =>
        area === core ? { ...area, position: { x: area.position.x, y: router.position.y - 160 } } : area
      ),
    };
    expect(crowding(moved).some((said) => said.includes('border of CORE'))).toBe(true);
    // a drawing as large as the board, less its padding, is fitted at 1
    const scene = sceneOf(sample);
    const one: Scene = {
      ...scene,
      areas: [],
      devices: [{ ...scene.devices[0], box: { x: 0, y: 0, width: BOARD.width / 1.2, height: BOARD.height / 1.2 } }],
    };
    expect(fitZoom(one)).toBeCloseTo(1, 5);
    // and is centred on the board, with the room of the padding around it
    const placed = onBoard(one, one.devices[0].box);
    expect(placed.x).toBeCloseTo((BOARD.width - placed.width) / 2, 5);
    expect(placed.y).toBeCloseTo((BOARD.height - placed.height) / 2, 5);
    // a device in the bottom right corner of a drawing as wide as the board is under the small map
    const corner: Scene = {
      ...one,
      devices: [
        ...one.devices,
        { ...scene.devices[0], box: { x: BOARD.width / 1.2 - 104, y: BOARD.height / 1.2 - 94, width: 104, height: 94 } },
      ],
    };
    expect(touch(onBoard(corner, corner.devices[1].box), SMALL_MAP)).toBe(true);
  });
});
