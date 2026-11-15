/**
 * The automatic layout (Vista → Disposizione automatica): the levels come
 * from the network, every cable is laid from its upper end down whichever
 * end it was drawn from, the areas follow their devices, and nothing is
 * written over anything else, vertically or horizontally, on the four
 * samples however their devices were placed.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setLanguage } from '@/i18n';
import { useNetworkStore } from '@/store/networkStore';
import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';
import { areaProblems, crowding, deviceOverlaps, holds, sceneOf } from '@/test/drawingChecks';
import { arrangeDrawing, networkLevels, type LayoutDirection } from './autoLayout';
import { AREA_MARGIN } from './canvasAreas';
import { deviceHeight, DEVICE_METRICS } from './deviceGeometry';
import { createCompanySample } from './sampleCompany';
import { createMultinationalSample } from './sampleMultinational';
import { createPerimeterSample } from './samplePerimeter';
import { createRedundancySample } from './sampleRedundancy';
import { createSampleTopology } from './sampleTopology';
import type { SampleNetwork } from './sampleNetwork';

afterEach(() => setLanguage('it'));

let next = 0;
function device(label: string, type: string, overrides: Partial<NetworkDevice> = {}): NetworkDevice {
  return {
    id: `d-${label}`,
    type,
    label,
    ip: `10.0.0.${++next % 250}`,
    subnet: '255.255.255.0',
    gateway: '',
    position: { x: (next * 137) % 900, y: (next * 271) % 700 },
    ...overrides,
  };
}
/** A cable drawn from `from` to `to`: `from` is only the end the user started from */
function cable(from: string, to: string, extra: Partial<NetworkConnection> = {}): NetworkConnection {
  return { id: `c-${from}-${to}-${++next}`, source: `d-${from}`, target: `d-${to}`, ...extra };
}
const at = (devices: NetworkDevice[], label: string) => devices.find((one) => one.label === label)!.position;

/** Internet, a firewall, a router, a switch, two PCs: each cable drawn from its lower end */
function chain() {
  const devices = [
    device('PC-1', 'PC'),
    device('PC-2', 'PC'),
    device('SW', 'Switch'),
    device('Router', 'Router'),
    device('FW', 'Firewall'),
    device('Internet', 'Cloud', { ip: '' }),
  ];
  const connections = [
    cable('PC-1', 'SW'),
    cable('PC-2', 'SW'),
    cable('SW', 'Router'),
    cable('Router', 'FW'),
    cable('FW', 'Internet'),
  ];
  return { devices, connections, areas: [] as CanvasArea[] };
}

describe('the levels come from the network', () => {
  it('the top is where the traffic leaves: the Internet, then one more level for each cable from it', () => {
    const { devices, connections } = chain();
    const levels = networkLevels(devices, connections);
    expect(['Internet', 'FW', 'Router', 'SW', 'PC-1', 'PC-2'].map((label) => levels.get(`d-${label}`))).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it('without an Internet the firewall is the top; without one the router; without one the switch with most cables', () => {
    const { devices, connections } = chain();
    const without = (gone: string[]) => {
      const kept = devices.filter((one) => !gone.includes(one.label));
      return networkLevels(kept, connections.filter((one) => kept.some((d) => d.id === one.source) && kept.some((d) => d.id === one.target)));
    };
    expect(without(['Internet']).get('d-FW')).toBe(0);
    expect(without(['Internet', 'FW']).get('d-Router')).toBe(0);
    const switches = without(['Internet', 'FW', 'Router']);
    expect(switches.get('d-SW')).toBe(0);
    expect(switches.get('d-PC-1')).toBe(1);
  });

  it('of the routers, one cabled only to routers (between two sites) is the top, the others under it', () => {
    const sample = createRedundancySample();
    const levels = networkLevels(sample.devices, sample.connections);
    const level = (id: string) => levels.get(id);
    expect(level('r-riserva')).toBe(0);
    expect(level('r-sede')).toBe(1);
    expect(level('r-filiale')).toBe(1);
  });

  it('a device with no cable has no level', () => {
    const { devices, connections } = chain();
    const levels = networkLevels([...devices, device('Alone', 'PC')], connections);
    expect(levels.has('d-Alone')).toBe(false);
  });

  it('with no router the top is a switch, even when a server has more cables', () => {
    // a server with three cards on three switches; the first switch also has a PC
    const devices = [device('Srv', 'Server'), device('SW-1', 'Switch'), device('SW-2', 'Switch'), device('SW-3', 'Switch'), device('PC', 'PC')];
    const connections = [cable('Srv', 'SW-1'), cable('Srv', 'SW-2'), cable('Srv', 'SW-3'), cable('PC', 'SW-1')];
    const levels = networkLevels(devices, connections);
    expect(['SW-1', 'Srv', 'PC', 'SW-2'].map((label) => levels.get(`d-${label}`))).toEqual([0, 1, 1, 2]);
  });
});

describe('three cables between the same two devices', () => {
  it.each(['TB', 'LR'] as const)('%s: one for each VLAN, their labels are not on one another', (direction) => {
    // a router and its switch, one cable for each VLAN it routes, each with its speed and its VLAN
    const devices = [device('R-1', 'Router'), device('SW-1', 'Switch'), device('PC-1', 'PC')];
    const connections = [10, 20, 30].map((vlan) => cable('R-1', 'SW-1', { bandwidth: '1 Gbps', label: `VLAN ${vlan}` }));
    connections.push(cable('PC-1', 'SW-1'));
    const laid = arrangeDrawing({ devices, connections, areas: [] }, direction);
    expect(crowding(laid)).toEqual([]);
    expect(deviceOverlaps(laid)).toEqual([]);
  });
});

describe('two devices of one level, cabled together', () => {
  it.each(['TB', 'LR'] as const)('%s: side by side, not one a level under the other', (direction) => {
    // two routers, each the top of its side, with a switch and a PC under it
    const devices = [
      device('R-1', 'Router'),
      device('R-2', 'Router'),
      device('SW-1', 'Switch'),
      device('SW-2', 'Switch'),
      device('PC-1', 'PC'),
      device('PC-2', 'PC'),
    ];
    const connections = [cable('R-1', 'R-2'), cable('SW-1', 'R-1'), cable('SW-2', 'R-2'), cable('PC-1', 'SW-1'), cable('PC-2', 'SW-2')];
    const laid = arrangeDrawing({ devices, connections, areas: [] }, direction);
    const along = (label: string) => (direction === 'TB' ? at(laid.devices, label).y : at(laid.devices, label).x);
    expect(along('R-1')).toBe(along('R-2'));
    expect(along('SW-1')).toBe(along('SW-2'));
  });
});

describe.each(['TB', 'LR'] as const)('laid out %s', (direction: LayoutDirection) => {
  const along = (position: { x: number; y: number }) => (direction === 'TB' ? position.y : position.x);

  it('every cable goes from its upper end down, whichever end it was drawn from', () => {
    const laid = arrangeDrawing(chain(), direction);
    const order = ['Internet', 'FW', 'Router', 'SW', 'PC-1'].map((label) => along(at(laid.devices, label)));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
    expect(along(at(laid.devices, 'PC-1'))).toBe(along(at(laid.devices, 'PC-2')));
    // the sides it ends on face each other: the lower side of the upper end, the upper side of the lower end
    const [down, up] = direction === 'TB' ? ['bottom', 'top'] : ['right', 'left'];
    for (const connection of laid.connections) {
      const source = laid.devices.find((one) => one.id === connection.source)!;
      const target = laid.devices.find((one) => one.id === connection.target)!;
      const sourceUpper = along(source.position) < along(target.position);
      expect(connection.sourceHandle).toBe(sourceUpper ? down : up);
      expect(connection.targetHandle).toBe(sourceUpper ? up : down);
    }
  });

  it('the devices with no cable are put apart, under the rest, in a row', () => {
    const input = chain();
    input.devices.push(device('Alone-1', 'PC'), device('Alone-2', 'Server'));
    const laid = arrangeDrawing(input, direction);
    const bottom = Math.max(
      ...laid.devices.filter((one) => !one.label.startsWith('Alone')).map((one) => one.position.y + deviceHeight(true))
    );
    const [first, second] = [at(laid.devices, 'Alone-1'), at(laid.devices, 'Alone-2')];
    expect(first.y).toBeGreaterThan(bottom);
    expect(second.y).toBe(first.y);
    expect(second.x - first.x).toBeGreaterThanOrEqual(DEVICE_METRICS.width);
  });

  it('an area follows its devices, drawn again around them with the room of «Racchiudi in un riquadro»', () => {
    const input = chain();
    // the switch and the two PCs, in an area where they are now
    const members = ['SW', 'PC-1', 'PC-2'].map((label) => input.devices.find((one) => one.label === label)!);
    members.forEach((member, index) => (member.position = { x: 1000 + index * 150, y: 1000 }));
    const area: CanvasArea = { id: 'area-1', label: 'Uffici', color: 'red', position: { x: 980, y: 950 }, size: { width: 450, height: 170 } };
    const laid = arrangeDrawing({ ...input, areas: [area] }, direction);
    const now = laid.areas[0];
    const box = { ...now.position, ...now.size };
    const frames = laid.devices.map((one) => ({ label: one.label, box: { ...one.position, width: DEVICE_METRICS.width, height: deviceHeight(Boolean(one.ip)) } }));
    // it holds its three devices, and nothing else
    expect(frames.filter((frame) => holds(box, frame.box)).map((frame) => frame.label).sort()).toEqual(['PC-1', 'PC-2', 'SW']);
    // with the room above for its label
    const top = Math.min(...frames.filter((frame) => ['SW', 'PC-1', 'PC-2'].includes(frame.label)).map((frame) => frame.box.y));
    expect(top - box.y).toBe(AREA_MARGIN.top);
    expect(areaProblems(laid)).toEqual([]);
  });

  it('an area inside another stays inside it; an area with no device is put apart, under the rest', () => {
    const input = chain();
    input.devices.find((one) => one.label === 'SW')!.position = { x: 1000, y: 1000 };
    input.devices.find((one) => one.label === 'PC-1')!.position = { x: 1200, y: 1000 };
    const outer: CanvasArea = { id: 'area-1', label: 'Sede', color: 'teal', position: { x: 900, y: 900 }, size: { width: 500, height: 300 } };
    const inner: CanvasArea = { id: 'area-2', label: 'Piano', color: 'amber', position: { x: 1180, y: 950 }, size: { width: 150, height: 160 } };
    const empty: CanvasArea = { id: 'area-3', label: 'Vuoto', color: 'slate', position: { x: -500, y: -500 }, size: { width: 200, height: 120 } };
    const laid = arrangeDrawing({ ...input, areas: [outer, inner, empty] }, direction);
    const box = (id: string) => {
      const area = laid.areas.find((one) => one.id === id)!;
      return { ...area.position, ...area.size };
    };
    expect(holds(box('area-1'), box('area-2'))).toBe(true);
    const rest = Math.max(...laid.devices.map((one) => one.position.y + deviceHeight(true)), box('area-1').y + box('area-1').height);
    expect(box('area-3').y).toBeGreaterThan(rest);
    expect(box('area-3')).toMatchObject({ width: 200, height: 120 });
    expect(areaProblems(laid)).toEqual([]);
  });
});

/** A sample with its devices placed anywhere */
function shuffled(sample: SampleNetwork, seed: number): SampleNetwork {
  let s = seed;
  const random = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return {
    ...sample,
    devices: sample.devices.map((one) => ({ ...one, position: { x: Math.round(random() * 2000), y: Math.round(random() * 1500) } })),
  };
}

const SAMPLES: Array<[string, () => SampleNetwork]> = [
  ['the company', createCompanySample],
  ['the small office', createSampleTopology],
  ['the site', createPerimeterSample],
  ['the two sites', createRedundancySample],
];

describe.each(SAMPLES)('%s, laid out', (_, create) => {
  it.each([
    ['TB', 'it', 0],
    ['LR', 'it', 0],
    ['TB', 'en', 7],
    ['LR', 'en', 7],
    ['TB', 'it', 991],
    ['LR', 'en', 991],
  ] as const)('%s in %s (devices placed by %i): nothing on anything, no area across another', (direction, language, seed) => {
    setLanguage(language);
    const sample = seed === 0 ? create() : shuffled(create(), seed);
    const areas = sample.areas.map((area, index) => ({ ...area, id: `area-${index + 1}` }));
    const laid = arrangeDrawing({ devices: sample.devices, connections: sample.connections, areas }, direction);
    expect(deviceOverlaps(laid)).toEqual([]);
    expect(areaProblems(laid)).toEqual([]);
    expect(crowding(laid)).toEqual([]);
    // the same devices, cables and areas, only placed again
    expect(laid.devices.map((one) => one.id)).toEqual(sample.devices.map((one) => one.id));
    expect(laid.connections.map((one) => [one.id, one.source, one.target])).toEqual(
      sample.connections.map((one) => [one.id, one.source, one.target])
    );
  });

  it('laid out as drawn, every area still holds the devices it held', () => {
    const sample = create();
    const areas = sample.areas.map((area, index) => ({ ...area, id: `area-${index + 1}` }));
    const frame = (one: NetworkDevice) => ({ ...one.position, width: DEVICE_METRICS.width, height: deviceHeight(Boolean(one.ip) || (one.nics ?? []).some((nic) => nic.dhcp)) });
    const membersOf = (devices: NetworkDevice[], list: Array<{ position: { x: number; y: number }; size: { width: number; height: number } }>) =>
      list.map((area) => devices.filter((one) => holds({ ...area.position, ...area.size }, frame(one))).map((one) => one.id).sort());
    const laid = arrangeDrawing({ devices: sample.devices, connections: sample.connections, areas });
    expect(membersOf(laid.devices, laid.areas)).toEqual(membersOf(sample.devices, areas));
  });
});

describe('laid out again, from what a layout made', () => {
  it('the two sites, vertical then horizontal: no label is left on the border of an area', () => {
    // where a visitor had them after «Verticale», their devices first moved about inside their areas
    // (loaded through the store, with the ids it gives); «Orizzontale» left the label of the main line
    // across the lower border of the head office
    setLanguage('it');
    const store = () => useNetworkStore.getState();
    store().clearAllDevices();
    store().loadSample(createRedundancySample());
    const places: Record<string, [number, number]> = {
      'R-Riserva': [472, 0], 'R-Sede': [174, 256], 'R-Filiale': [605, 390], 'SW-Core': [174, 656],
      'SW-Piano-1': [30, 1056], 'SW-Piano-2': [256, 1190], 'Srv-File': [174, 1056], 'PC-Sede-1': [30, 1496],
      'PC-Sede-2': [256, 1630], 'SW-Filiale': [605, 790], 'PC-Filiale-1': [533, 1190], 'PC-Filiale-2': [677, 1190],
    };
    for (const one of store().devices) store().updateDevice(one.id, { position: { x: places[one.label][0], y: places[one.label][1] } });
    for (const area of store().areas) {
      store().updateArea(
        area.id,
        area.label === 'Sede'
          ? { position: { x: 14, y: 216 }, size: { width: 362, height: 1524 } }
          : { position: { x: 517, y: 350 }, size: { width: 280, height: 950 } }
      );
    }
    store().applyAutoLayout('LR');
    expect(crowding(store())).toEqual([]);
    expect(deviceOverlaps(store())).toEqual([]);
    expect(areaProblems(store())).toEqual([]);
  });
});

describe('a large drawing: the multinational', () => {
  /** The zoom a window of 1568 × 779 fits the drawing at (fitView, a padding of 0.2), as the samples are measured */
  const fitZoom = (drawing: Parameters<typeof sceneOf>[0]) => {
    const scene = sceneOf(drawing);
    const boxes = [...scene.devices.map((device) => device.box), ...scene.areas.map((area) => area.box)];
    const width = Math.max(...boxes.map((box) => box.x + box.width)) - Math.min(...boxes.map((box) => box.x));
    const height = Math.max(...boxes.map((box) => box.y + box.height)) - Math.min(...boxes.map((box) => box.y));
    return Math.min(1520 / (width * 1.2), 735 / (height * 1.2));
  };

  it.each(['TB', 'LR'] as const)('%s: it can be seen whole on a laptop, nothing on anything, every area with its devices', (direction) => {
    setLanguage('it');
    const sample = createMultinationalSample();
    const areas = sample.areas.map((area, index) => ({ ...area, id: `area-${index + 1}` }));
    const laid = arrangeDrawing({ devices: sample.devices, connections: sample.connections, areas }, direction);
    // the least zoom of the board is 0.1: drawn larger, part of it stays out of the window
    expect(fitZoom(laid)).toBeGreaterThanOrEqual(0.1);
    expect(deviceOverlaps(laid)).toEqual([]);
    expect(areaProblems(laid)).toEqual([]);
    expect(crowding(laid)).toEqual([]);
    const frame = (one: NetworkDevice) => ({ ...one.position, width: DEVICE_METRICS.width, height: deviceHeight(Boolean(one.ip) || (one.nics ?? []).some((nic) => nic.dhcp)) });
    const membersOf = (devices: NetworkDevice[], list: Array<{ position: { x: number; y: number }; size: { width: number; height: number } }>) =>
      list.map((area) => devices.filter((one) => holds({ ...area.position, ...area.size }, frame(one))).map((one) => one.id).sort());
    expect(membersOf(laid.devices, laid.areas)).toEqual(membersOf(sample.devices, areas));
  });

  it('a small sample is laid out as it was: every cable across the levels ends on facing sides', () => {
    // (the leaves under a device are only stacked beside it when a plain layout could not be seen whole)
    for (const create of [createCompanySample, createSampleTopology, createPerimeterSample, createRedundancySample]) {
      const sample = create();
      const areas = sample.areas.map((area, index) => ({ ...area, id: `area-${index + 1}` }));
      const laid = arrangeDrawing({ devices: sample.devices, connections: sample.connections, areas }, 'TB');
      const mixed = laid.connections.filter((one) => {
        const sides = [one.sourceHandle, one.targetHandle].map((side) => (side === 'top' || side === 'bottom' ? 'v' : 'h'));
        return sides[0] !== sides[1];
      });
      expect(mixed.map((one) => one.id)).toEqual([]);
    }
  });
});

describe('the store: Vista → Disposizione automatica', () => {
  it('moves the devices and the areas with them, and is a change of the drawing', () => {
    const store = useNetworkStore.getState();
    store.clearAllDevices();
    const sample = createRedundancySample();
    store.loadSample(sample);
    useNetworkStore.getState().markSaved();
    const before = useNetworkStore.getState().areas.map((area) => area.position);

    useNetworkStore.getState().applyAutoLayout('LR');

    const now = useNetworkStore.getState();
    expect(now.areas.map((area) => area.position)).not.toEqual(before);
    expect(areaProblems(now)).toEqual([]);
    expect(now.hasUnsavedChanges).toBe(true);
  });
});
