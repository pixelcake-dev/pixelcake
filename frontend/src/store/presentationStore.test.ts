/**
 * presentationStore — presentation mode never changes the drawing, and what
 * was asked and broken is forgotten on the way out.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNetworkStore } from './networkStore';
import { usePresentationStore } from './presentationStore';
import { useSimulationStore } from './simulationStore';
import { useUIStore } from './uiStore';
import { createRedundancySample } from '@/utils/sampleRedundancy';
import { liveFailures, liveTopology } from '@/utils/liveTopology';

const presentation = () => usePresentationStore.getState();
const network = () => useNetworkStore.getState();

/** The id the store gave to a device of the sample */
const id = (label: string) => {
  const found = network().devices.find(d => d.label === label);
  if (!found) throw new Error(`no device "${label}"`);
  return found.id;
};

function loadSample() {
  const sample = createRedundancySample();
  network().clearAllDevices();
  network().loadTopology(sample.devices, sample.connections);
}

beforeEach(() => {
  localStorage.clear();
  presentation().exit();
  useSimulationStore.getState().resetSimulation();
  network().clearAllDevices();
  network().markSaved();
});

describe('entering and leaving', () => {
  it('does not enter on an empty canvas', () => {
    expect(presentation().enter()).toBe(false);
    expect(presentation().active).toBe(false);
  });

  it('enters with a drawing, and puts the building tools away', () => {
    loadSample();
    network().selectMultipleDevices([id('SW-Core')]);
    network().setSelectedDevice(id('SW-Core'));
    useUIStore.getState().setContextMenuDevice(network().devices[0], 10, 10);
    useSimulationStore.getState().startSimulation([id('PC-Sede-1'), id('SW-Piano-1')], 'ping');

    expect(presentation().enter()).toBe(true);

    expect(presentation().active).toBe(true);
    expect(network().selectedDeviceIds).toEqual([]);
    expect(network().selectedDeviceId).toBeNull();
    expect(useUIStore.getState().contextMenuDevice).toBeNull();
    expect(useSimulationStore.getState().isRunning).toBe(false);
  });

  it('starts every presentation clean: no question, no failure, ping, panel open', () => {
    loadSample();
    presentation().enter();
    presentation().ask(id('PC-Sede-1'), id('Srv-File'));
    presentation().setFlow('web');
    presentation().toggleDeviceFailure(id('SW-Core'));
    presentation().toggleConnectionFailure(network().connections[0].id);
    presentation().setPanelOpen(false);
    presentation().openMenu({ kind: 'device', id: id('SW-Core'), x: 1, y: 2 });
    presentation().setRoute({ links: ['x'], arrives: true, dropDeviceId: null });

    presentation().exit();
    expect(presentation()).toMatchObject({
      active: false,
      sourceId: null,
      targetId: null,
      failedDevices: [],
      failedConnections: [],
      menu: null,
      route: null,
    });

    presentation().enter();
    expect(presentation()).toMatchObject({ active: true, flow: 'ping', panelOpen: true, sourceId: null });
  });

  it('stops the packet on the way out', () => {
    loadSample();
    presentation().enter();
    useSimulationStore.getState().startSimulation([id('PC-Sede-1'), id('SW-Piano-1')], 'ping');
    presentation().exit();
    expect(useSimulationStore.getState().isRunning).toBe(false);
  });

  it('entering twice changes nothing', () => {
    loadSample();
    presentation().enter();
    presentation().toggleDeviceFailure(id('SW-Core'));
    expect(presentation().enter()).toBe(true);
    expect(presentation().failedDevices).toEqual([id('SW-Core')]);
  });
});

describe('the drawing is never touched', () => {
  it('a whole presentation leaves devices, cables, view and "unsaved" as they were', () => {
    loadSample();
    network().setViewport({ x: 12, y: 34, zoom: 0.8 });
    network().markSaved();
    const before = JSON.stringify({
      devices: network().devices,
      connections: network().connections,
      viewport: network().viewport,
    });

    presentation().enter();
    presentation().ask(id('PC-Filiale-1'), id('Srv-File'));
    presentation().setFlow('web');
    presentation().swapEnds();
    presentation().toggleDeviceFailure(id('SW-Core'));
    presentation().toggleConnectionFailure(network().connections[0].id);
    presentation().replay();
    presentation().repairAll();
    presentation().toggleDeviceFailure(id('R-Sede'));
    presentation().exit();

    expect(
      JSON.stringify({
        devices: network().devices,
        connections: network().connections,
        viewport: network().viewport,
      })
    ).toBe(before);
    expect(network().hasUnsavedChanges).toBe(false);
  });
});

describe('the question', () => {
  beforeEach(() => {
    loadSample();
    presentation().enter();
  });

  it('sets the two ends one at a time', () => {
    presentation().setSource('a');
    expect(presentation()).toMatchObject({ sourceId: 'a', targetId: null });
    presentation().setTarget('b');
    expect(presentation()).toMatchObject({ sourceId: 'a', targetId: 'b' });
  });

  it('turns the question round when an end is picked as the other end', () => {
    presentation().setSource('a');
    presentation().setTarget('b');
    presentation().setSource('b');
    expect(presentation()).toMatchObject({ sourceId: 'b', targetId: 'a' });
    presentation().setTarget('b');
    expect(presentation()).toMatchObject({ sourceId: 'a', targetId: 'b' });
  });

  it('never has the same device at both ends', () => {
    presentation().setSource('a');
    presentation().setTarget('a');
    expect(presentation()).toMatchObject({ sourceId: null, targetId: 'a' });
  });

  it('swaps the ends, also when only one is set', () => {
    presentation().setSource('a');
    presentation().swapEnds();
    expect(presentation()).toMatchObject({ sourceId: null, targetId: 'a' });
  });

  it('asks in one go, and asks for the packet to be shown', () => {
    const seq = presentation().replaySeq;
    presentation().ask('a', 'b');
    expect(presentation()).toMatchObject({ sourceId: 'a', targetId: 'b', replaySeq: seq + 1 });
    // asking the same again shows it again
    presentation().ask('a', 'b');
    expect(presentation().replaySeq).toBe(seq + 2);
  });

  it('refuses a question from a device to itself', () => {
    presentation().ask('a', 'b');
    const seq = presentation().replaySeq;
    presentation().ask('c', 'c');
    expect(presentation()).toMatchObject({ sourceId: 'a', targetId: 'b', replaySeq: seq });
  });
});

describe('simulated failures', () => {
  beforeEach(() => {
    loadSample();
    presentation().enter();
  });

  it('breaks and repairs a device or a cable with the same action', () => {
    presentation().toggleDeviceFailure('d1');
    presentation().toggleDeviceFailure('d2');
    presentation().toggleConnectionFailure('c1');
    expect(presentation().failedDevices).toEqual(['d1', 'd2']);
    expect(presentation().failedConnections).toEqual(['c1']);

    presentation().toggleDeviceFailure('d1');
    presentation().toggleConnectionFailure('c1');
    expect(presentation().failedDevices).toEqual(['d2']);
    expect(presentation().failedConnections).toEqual([]);
  });

  it('repairs everything at once, and keeps the question', () => {
    presentation().ask('a', 'b');
    presentation().toggleDeviceFailure('d1');
    presentation().toggleConnectionFailure('c1');
    presentation().repairAll();
    expect(presentation()).toMatchObject({
      failedDevices: [],
      failedConnections: [],
      sourceId: 'a',
      targetId: 'b',
    });
  });

  it('does not make a new (identical) state when there is nothing to repair', () => {
    const before = presentation().failedDevices;
    presentation().repairAll();
    expect(presentation().failedDevices).toBe(before);
  });
});

describe('when the drawing changes under the presentation', () => {
  beforeEach(() => {
    loadSample();
    presentation().enter();
  });

  it('forgets what is no longer there, and only that', () => {
    presentation().ask('a', 'b');
    presentation().toggleDeviceFailure('a');
    presentation().toggleDeviceFailure('gone');
    presentation().toggleConnectionFailure('c1');
    presentation().toggleConnectionFailure('cut-away');
    presentation().openMenu({ kind: 'connection', id: 'cut-away', x: 0, y: 0 });

    presentation().prune(['a'], ['c1']);
    expect(presentation()).toMatchObject({
      sourceId: 'a',
      targetId: null,
      failedDevices: ['a'],
      failedConnections: ['c1'],
      menu: null,
    });
  });

  it('keeps the very same state when nothing is missing', () => {
    presentation().ask('a', 'b');
    presentation().toggleDeviceFailure('a');
    presentation().openMenu({ kind: 'device', id: 'b', x: 0, y: 0 });
    const before = presentation();
    presentation().prune(['a', 'b'], []);
    expect(presentation()).toBe(before);
  });

  it('starts again from nothing when another canvas comes on screen', () => {
    presentation().ask('a', 'b');
    presentation().setFlow('email');
    presentation().toggleDeviceFailure('a');
    useSimulationStore.getState().startSimulation(['a', 'b'], 'ping');

    presentation().resetCanvasState();
    expect(presentation()).toMatchObject({
      active: true,
      sourceId: null,
      targetId: null,
      failedDevices: [],
      // the kind of exchange is a choice of the presenter, not of the canvas
      flow: 'email',
    });
    expect(useSimulationStore.getState().isRunning).toBe(false);
  });
});

describe('liveTopology — what every question is asked of', () => {
  it('is the plain drawing outside presentation mode, whatever the store holds', () => {
    loadSample();
    usePresentationStore.setState({ failedDevices: [id('SW-Core')] });
    expect(liveFailures()).toEqual({ devices: [], connections: [] });
    expect(liveTopology()).toEqual({ devices: network().devices, connections: network().connections });
    expect('failures' in liveTopology()).toBe(false);
  });

  it('carries the simulated failures while presenting', () => {
    loadSample();
    presentation().enter();
    expect('failures' in liveTopology()).toBe(false);

    presentation().toggleDeviceFailure(id('SW-Core'));
    presentation().toggleConnectionFailure(network().connections[0].id);
    expect(liveTopology().failures).toEqual({
      devices: [id('SW-Core')],
      connections: [network().connections[0].id],
    });
    expect(liveTopology().devices).toBe(network().devices);

    presentation().exit();
    expect('failures' in liveTopology()).toBe(false);
  });
});
