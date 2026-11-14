/**
 * The four sample networks, as a whole: what each brings with its drawing
 * (the network settings of the project, its areas), and that bringing it
 * changed nothing of what the engine answers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { planAndEvaluateFlow } from '@/engine';
import { setLanguage, type Language } from '@/i18n';
import { useNetworkStore } from '@/store/networkStore';
import { AREA_COLOURS } from '@/types';
import type { FlowModelType, GlobalNetworkSettings, NetworkDevice } from '@/types';
import { createCompanySample } from './sampleCompany';
import { createPerimeterSample } from './samplePerimeter';
import { createRedundancySample } from './sampleRedundancy';
import { createSampleTopology } from './sampleTopology';
import { areasAround, drawnSize } from './sampleNetwork';
import type { SampleArea, SampleGroup, SampleNetwork } from './sampleNetwork';
import { AREA_MARGIN, areaAround, tidyAreaLabel } from './canvasAreas';
import { DEVICE_METRICS, approximateTextWidth, estimateDeviceSize } from './drawingImage';
import { areSameNetwork, isValidIP } from './ipHelpers';
import { tidyVlans, vlansInUse } from './vlanNames';

const SAMPLES: Array<[string, () => SampleNetwork]> = [
  ['the company', createCompanySample],
  ['the small office', createSampleTopology],
  ['the site', createPerimeterSample],
  ['the two sites', createRedundancySample],
];

const LANGUAGES: Language[] = ['it', 'en'];

/** True when an address is one a device can have on the network of the settings */
function isOnNetwork(address: string, settings: GlobalNetworkSettings): boolean {
  // (the networks of the samples have 254 addresses: the first names the network, the last all of it)
  return (
    isValidIP(address) &&
    areSameNetwork(address, settings.ipClass, settings.subnet) &&
    address !== settings.ipClass &&
    !address.endsWith('.255')
  );
}

/** Every address a device of the sample has, on itself, on a port or on a card */
function addressesOf(sample: SampleNetwork): string[] {
  return sample.devices
    .flatMap((device) => [
      device.ip,
      ...(device.ports ?? []).map((port) => port.ip),
      ...(device.nics ?? []).map((nic) => nic.ip),
    ])
    .filter((address): address is string => typeof address === 'string' && address !== '');
}

describe.each(SAMPLES)('the settings %s brings', (_, create) => {
  it.each(LANGUAGES)('%s: the network new devices start from is one of the drawing, with its gateway', (language) => {
    setLanguage(language);
    const sample = create();
    const { settings } = sample;

    expect(isValidIP(settings.ipClass)).toBe(true);
    expect(settings.subnet).toBe('255.255.255.0');
    expect(isValidIP(settings.gateway)).toBe(true);
    // the gateway is in the network, and it is an address of the drawing: a router or firewall port
    expect(isOnNetwork(settings.gateway, settings)).toBe(true);
    const serves = sample.devices.filter((device) =>
      (device.ports ?? []).some((port) => port.ip === settings.gateway)
    );
    expect(serves.map((device) => device.type)).toEqual(['Router']);
    // and the devices of the drawing that are on that network use it
    const onIt = sample.devices.filter(
      (device) => (device.nics ?? []).some((nic) => nic.ip && isOnNetwork(nic.ip, settings))
    );
    expect(onIt.length).toBeGreaterThan(0);
    for (const device of onIt) expect(device.gateway, device.label).toBe(settings.gateway);
  });

  it.each(LANGUAGES)('%s: the DNS server, when there is one, is a device of the drawing that answers for names', (language) => {
    setLanguage(language);
    const sample = create();
    const servers = sample.devices.filter((device) => (device.dnsRecords ?? []).length > 0);
    if (servers.length === 0) {
      expect(sample.settings.dns).toBeUndefined();
      return;
    }
    expect(servers.map((device) => device.ip)).toContain(sample.settings.dns);
  });

  it.each(LANGUAGES)('%s: every VLAN the drawing uses has a name, in the language of the moment', (language) => {
    setLanguage(language);
    const sample = create();
    const inUse = vlansInUse(sample.devices, sample.connections);
    const named = sample.settings.vlans ?? [];

    expect(named.map((vlan) => vlan.id)).toEqual(inUse);
    // (kept as a project keeps them: tidy names, lowest number first; absent when there is none)
    expect(tidyVlans(named)).toEqual(named);
    if (inUse.length === 0) expect(sample.settings.vlans).toBeUndefined();
  });

  it('the names of the VLANs follow the language, as the names of the devices do', () => {
    const names = (language: Language) => {
      setLanguage(language);
      return (create().settings.vlans ?? []).map((vlan) => vlan.name);
    };
    const [italian, english] = [names('it'), names('en')];
    expect(english).toHaveLength(italian.length);
    if (italian.length > 0) {
      expect(italian).toContain('Uffici');
      expect(english).toContain('Offices');
      expect(english).not.toContain('Uffici');
    }
  });

  it('the mail travels the way the drawing says', () => {
    expect(create().settings.emailMode).toBe('auto');
  });
});

describe.each(SAMPLES)('loading %s', (_, create) => {
  beforeEach(() => {
    const store = useNetworkStore.getState();
    store.clearAllDevices();
    // a project set for another network, with what a sample may not have
    store.setGlobalNetworkSettings({
      ipClass: '10.20.30.0',
      subnet: '255.255.0.0',
      gateway: '10.20.30.1',
      dns: '10.20.30.53',
      emailMode: 'cloud',
      vlans: [{ id: 99, name: 'Magazzino' }],
    });
  });

  it('sets the network settings of the project to its own, all of them', () => {
    const sample = create();
    useNetworkStore.getState().loadSample(sample);

    expect(useNetworkStore.getState().globalNetworkSettings).toEqual(sample.settings);
    expect(useNetworkStore.getState().globalNetworkSettings.vlans?.some((vlan) => vlan.id === 99) ?? false).toBe(false);
    expect(useNetworkStore.getState().devices).toHaveLength(sample.devices.length);
    expect(useNetworkStore.getState().connections).toHaveLength(sample.connections.length);
    expect(useNetworkStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('a device added afterwards is offered an address of the network of the sample, one nobody has', () => {
    const sample = create();
    useNetworkStore.getState().loadSample(sample);

    const offered = useNetworkStore.getState().findNextAvailableIP();
    expect(isOnNetwork(offered, sample.settings), offered).toBe(true);
    expect(addressesOf(sample)).not.toContain(offered);
  });

  it('loading the drawing alone, as an import does, leaves the settings as they were', () => {
    const sample = create();
    useNetworkStore.getState().loadTopology(sample.devices, sample.connections);
    expect(useNetworkStore.getState().globalNetworkSettings.ipClass).toBe('10.20.30.0');
  });
});

/* ── the engine answers as it did before the samples brought anything ── */

/** A short, stable number for a text (FNV-1a) */
function digest(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * What the engine answers on every ordered pair of devices of a sample, for
 * ping, web and email: the verdict, the devices of each leg, the reason of a
 * failure (with the ids of the devices in place of their names, which change
 * with the language).
 */
function answersOf(sample: SampleNetwork): string[] {
  const byLength = [...sample.devices].sort((a, b) => b.label.length - a.label.length);
  const neutral = (text: string | undefined) =>
    byLength.reduce((said, device) => said.split(device.label).join(device.id), text ?? '');
  const answers: string[] = [];
  for (const model of ['ping', 'web', 'email'] as FlowModelType[]) {
    for (const from of sample.devices) {
      for (const to of sample.devices) {
        if (from.id === to.id) continue;
        const result = planAndEvaluateFlow(model, from.id, to.id, {
          devices: sample.devices,
          connections: sample.connections,
        });
        const legs = result.legs
          .map(
            (leg) =>
              `${leg.trace.verdict}:${leg.trace.hops.map((hop) => hop.deviceId).join('>')}:${neutral(leg.trace.failureReason)}`
          )
          .join('|');
        answers.push(`${model} ${from.id} ${to.id} ${result.verdict} ${legs}`);
      }
    }
  }
  return answers;
}

/**
 * Taken on the samples as they were before they brought settings: how many
 * questions, how many arrive, and the digest of all the answers.
 */
const BEFORE: Record<string, { questions: number; arrive: number; digest: string }> = {
  'the company': { questions: 1140, arrive: 607, digest: '53ece83d' },
  'the small office': { questions: 126, arrive: 126, digest: '568c6059' },
  'the site': { questions: 270, arrive: 84, digest: '28eb5cc8' },
  'the two sites': { questions: 396, arrive: 256, digest: '9a345a59' },
};

describe.each(SAMPLES)('what the engine answers on %s', (name, create) => {
  it.each(LANGUAGES)('%s: on every pair of devices, for ping, web and email, it is what it was', (language) => {
    setLanguage(language);
    const answers = answersOf(create());
    expect({
      questions: answers.length,
      arrive: answers.filter((answer) => / success /.test(answer)).length,
      digest: digest(answers.join('\n')),
    }).toEqual(BEFORE[name]);
  });

  it('the settings it brings are no part of what the engine is asked', () => {
    // (the mail goes the way the drawing says with them too)
    const sample = create();
    const withTheSettings = sample.devices.flatMap((from) =>
      sample.devices
        .filter((to) => to.id !== from.id)
        .map(
          (to) =>
            planAndEvaluateFlow('email', from.id, to.id, sample, { emailMode: sample.settings.emailMode }).verdict
        )
    );
    const without = sample.devices.flatMap((from) =>
      sample.devices
        .filter((to) => to.id !== from.id)
        .map((to) => planAndEvaluateFlow('email', from.id, to.id, sample).verdict)
    );
    expect(withTheSettings).toEqual(without);
  });
});

/* ── the areas a sample comes with ─────────────────────────────────────── */

type Box = { x: number; y: number; width: number; height: number };
const boxOfArea = (area: SampleArea): Box => ({ ...area.position, ...area.size });
const boxOfDevice = (device: NetworkDevice): Box => ({ ...device.position, ...drawnSize(device) });
const touch = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const holds = (outer: Box, inner: Box) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

/** How many areas each sample has, and what they are called in each language */
const AREAS: Record<string, Record<Language, string[]>> = {
  'the company': {
    it: ['Internet', 'Edge', 'Core', 'Uffici', 'Server'],
    en: ['Internet', 'Edge', 'Core', 'Offices', 'Servers'],
  },
  // (none: its two networks are plain without, and the labels of the cables from the router would sit on them)
  'the small office': { it: [], en: [] },
  'the site': { it: ['Internet', 'DMZ', 'Rete interna'], en: ['Internet', 'DMZ', 'Internal network'] },
  'the two sites': { it: ['Sede', 'Filiale'], en: ['Head office', 'Branch'] },
};

describe.each(SAMPLES)('the areas of %s', (name, create) => {
  it.each(LANGUAGES)('%s: they are named in the language of the moment, each in a colour of its own', (language) => {
    setLanguage(language);
    const { areas } = create();
    expect(areas.map((area) => area.label)).toEqual(AREAS[name][language]);
    expect(new Set(areas.map((area) => area.color)).size).toBe(areas.length);
    for (const area of areas) {
      expect(AREA_COLOURS).toContain(area.color);
      expect(tidyAreaLabel(area.label)).toBe(area.label);
    }
  });

  it.each(LANGUAGES)('%s: each is where its devices are, with the room «Racchiudi in un riquadro» leaves', (language) => {
    setLanguage(language);
    const sample = create();
    for (const area of sample.areas) {
      // The devices of an area are the ones drawn inside it: the area is the
      // one `areaAround` gives them, to the pixel (no rectangle was typed)
      const inside = sample.devices.filter((device) => touch(boxOfArea(area), boxOfDevice(device)));
      expect(inside.length, area.label).toBeGreaterThan(1);
      expect({ position: area.position, size: area.size }, area.label).toEqual(areaAround(inside.map(boxOfDevice)));
      // and the room is the one of the margins: more above, where the label is
      const top = Math.min(...inside.map((device) => device.position.y));
      const left = Math.min(...inside.map((device) => device.position.x));
      expect(area.position).toEqual({ x: left - AREA_MARGIN.side, y: top - AREA_MARGIN.top });
    }
  });

  it.each(LANGUAGES)('%s: no two cross, and no device is half in one', (language) => {
    setLanguage(language);
    const sample = create();
    const boxes = sample.areas.map(boxOfArea);
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const pair = `${sample.areas[a].label} and ${sample.areas[b].label}`;
        // (one inside another would be meant; one across another is an accident)
        const apart = !touch(boxes[a], boxes[b]);
        const nested = holds(boxes[a], boxes[b]) || holds(boxes[b], boxes[a]);
        expect(apart || nested, pair).toBe(true);
      }
    }
    for (const device of sample.devices) {
      for (const [index, box] of boxes.entries()) {
        const where = `${device.label} and ${sample.areas[index].label}`;
        expect(!touch(box, boxOfDevice(device)) || holds(box, boxOfDevice(device)), where).toBe(true);
      }
    }
  });

  it('loading it puts them on the canvas, in place of the ones that were there', () => {
    const store = useNetworkStore.getState();
    store.clearAllDevices();
    store.addArea({ label: 'Di prima', color: 'teal', position: { x: 0, y: 0 }, size: { width: 300, height: 200 } });
    const sample = create();
    useNetworkStore.getState().loadSample(sample);

    const onCanvas = useNetworkStore.getState().areas;
    expect(onCanvas.map((area) => area.id)).toEqual(sample.areas.map((_, index) => `area-${index + 1}`));
    expect(
      onCanvas.map((area) => ({ label: area.label, color: area.color, position: area.position, size: area.size }))
    ).toEqual(sample.areas);
    // (a drawing loaded alone, as an import is, comes with none)
    useNetworkStore.getState().loadTopology(sample.devices, sample.connections);
    expect(useNetworkStore.getState().areas).toEqual([]);
  });
});

describe('the areas of a sample are worked out, not typed', () => {
  const device = (id: string, x: number, y: number): NetworkDevice => ({
    id,
    type: 'PC',
    label: id,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x, y },
  });
  const devices = [device('a', 0, 0), device('b', 300, 0), device('c', 0, 400)];
  const groups: SampleGroup[] = [{ label: 'Sopra', color: 'slate', devices: ['a', 'b'] }];

  it('an area is around the devices of its group, as large as they are drawn', () => {
    const [area] = areasAround(groups, devices);
    const size = drawnSize(devices[0]);
    expect(area).toEqual({
      label: 'Sopra',
      color: 'slate',
      position: { x: -AREA_MARGIN.side, y: -AREA_MARGIN.top },
      size: {
        width: 300 + size.width + 2 * AREA_MARGIN.side,
        height: size.height + AREA_MARGIN.top + AREA_MARGIN.bottom,
      },
    });
    // the size of a device is the one the style sheet gives it (drawingImage.ts keeps its numbers)
    expect(size).toEqual(estimateDeviceSize('a', '192.168.1.10', approximateTextWidth));
    expect(size.width).toBe(DEVICE_METRICS.minWidth);
  });

  it('devices drawn larger make it larger: it follows the look of a device', () => {
    const [usual] = areasAround(groups, devices);
    const [larger] = areasAround(groups, devices, (one) => {
      const size = drawnSize(one);
      return { width: size.width + 40, height: size.height + 30 };
    });
    expect(larger.position).toEqual(usual.position);
    expect(larger.size).toEqual({ width: usual.size.width + 40, height: usual.size.height + 30 });
  });

  it('a device that moves takes its border with it', () => {
    const [usual] = areasAround(groups, devices);
    const moved = devices.map((one) => (one.id === 'b' ? { ...one, position: { x: 500, y: 60 } } : one));
    const [after] = areasAround(groups, moved);
    expect(after.size.width).toBe(usual.size.width + 200);
    expect(after.size.height).toBe(usual.size.height + 60);
  });

  it('a group that names a device the sample does not have is a mistake, said at once', () => {
    expect(() => areasAround([{ label: 'Sbagliata', color: 'red', devices: ['a', 'z'] }], devices)).toThrow(/z/);
    expect(() => areasAround([{ label: 'Vuota', color: 'red', devices: [] }], devices)).toThrow(/Vuota/);
  });
});
