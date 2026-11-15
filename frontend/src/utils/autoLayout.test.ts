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
import { areaProblems, crowding, deviceOverlaps, holds } from '@/test/drawingChecks';
import { arrangeDrawing, networkLevels, type LayoutDirection } from './autoLayout';
import { AREA_MARGIN } from './canvasAreas';
import { deviceHeight, DEVICE_METRICS } from './deviceGeometry';
import { createCompanySample } from './sampleCompany';
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
