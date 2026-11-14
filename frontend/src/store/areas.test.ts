/**
 * The areas of a canvas («riquadri») in the two stores: they belong to a
 * canvas and go wherever its devices go (a canvas switch, the project file,
 * a page load), an edit of one is an edit of the project, and the selection
 * of the devices never holds one.
 *
 * Isolation: the stores read localStorage when they are created, so each
 * test re-imports them (a re-import is a reload).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CanvasArea, NetworkDevice } from '@/types';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const NETWORK_KEY = 'pixelcake-network-v2';

/** Import the stores afresh: what a page load does */
async function loadApp() {
  vi.resetModules();
  const { useNetworkStore } = await import('./networkStore');
  const { useProjectStore } = await import('./projectStore');
  const { usePresentationStore } = await import('./presentationStore');
  const files = await import('@/utils/projectFile');
  return { network: useNetworkStore, project: useProjectStore, presentation: usePresentationStore, files };
}

const core: Omit<CanvasArea, 'id'> = {
  label: 'Core',
  color: 'violet',
  position: { x: 100, y: 50 },
  size: { width: 300, height: 200 },
};
const edge: Omit<CanvasArea, 'id'> = {
  label: 'Edge',
  color: 'teal',
  position: { x: 500, y: 50 },
  size: { width: 240, height: 320 },
};

const pc = (label: string): Omit<NetworkDevice, 'id'> => ({
  type: 'PC',
  label,
  ip: '192.168.1.10',
  subnet: '255.255.255.0',
  gateway: '192.168.1.1',
  position: { x: 150, y: 120 },
});

beforeEach(() => {
  localStorage.clear();
});

describe('an area in the canvas on screen', () => {
  it('is added with an id of its own and a tidy label, and counts as a change of the project', async () => {
    const { network } = await loadApp();
    network.getState().markSaved();

    const first = network.getState().addArea({ ...core, label: '  Core \n ' });
    const second = network.getState().addArea(edge);

    expect([first, second]).toEqual(['area-1', 'area-2']);
    expect(network.getState().areas).toEqual([
      { id: 'area-1', ...core },
      { id: 'area-2', ...edge },
    ]);
    expect(network.getState().hasUnsavedChanges).toBe(true);
    // (devices and cables are not touched, nor their counters)
    expect(network.getState()).toMatchObject({ devices: [], connections: [], deviceCounter: 0 });
  });

  it('is renamed, coloured, moved and resized: each is a change, and its id stays', async () => {
    const { network } = await loadApp();
    const id = network.getState().addArea(core);
    network.getState().markSaved();

    network.getState().updateArea(id, { label: ' Dorsale ' });
    expect(network.getState().areas[0].label).toBe('Dorsale');
    expect(network.getState().hasUnsavedChanges).toBe(true);

    network.getState().updateArea(id, { color: 'amber', position: { x: 10, y: 20 }, size: { width: 400, height: 250 } });
    // (an id handed in with the rest is not taken)
    network.getState().updateArea(id, { id: 'area-99' } as Partial<CanvasArea>);
    expect(network.getState().areas).toEqual([
      { id, label: 'Dorsale', color: 'amber', position: { x: 10, y: 20 }, size: { width: 400, height: 250 } },
    ]);
  });

  it('is never made smaller than an area can be', async () => {
    const { network } = await loadApp();
    const id = network.getState().addArea(core);
    network.getState().updateArea(id, { size: { width: 10, height: 500 } });
    expect(network.getState().areas[0].size).toEqual({ width: 120, height: 500 });
    network.getState().updateArea(id, { size: { width: 500, height: 3 } });
    expect(network.getState().areas[0].size).toEqual({ width: 500, height: 80 });
  });

  it('an update that changes nothing is not a change: a label confirmed as it was, a handle let go', async () => {
    const { network } = await loadApp();
    const id = network.getState().addArea(core);
    network.getState().markSaved();
    const before = network.getState().areas;

    network.getState().updateArea(id, { label: 'Core' });
    network.getState().updateArea(id, { position: { ...core.position }, size: { ...core.size } });
    network.getState().updateArea('area-404', { label: 'Nessuno' });

    expect(network.getState().areas).toBe(before);
    expect(network.getState().hasUnsavedChanges).toBe(false);
  });

  it('is deleted alone: the others stay, and so does every device', async () => {
    const { network } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    const first = network.getState().addArea(core);
    const second = network.getState().addArea(edge);
    network.getState().selectArea(first);
    network.getState().markSaved();

    network.getState().removeArea(first);

    expect(network.getState().areas.map((area) => area.id)).toEqual([second]);
    expect(network.getState().selectedAreaId).toBeNull();
    expect(network.getState().devices.map((d) => d.label)).toEqual(['PC-1']);
    expect(network.getState().hasUnsavedChanges).toBe(true);

    // an area that is not there: nothing happens, nothing is marked
    network.getState().markSaved();
    network.getState().removeArea('area-404');
    expect(network.getState().hasUnsavedChanges).toBe(false);
  });

  it('a new area never takes the id of one that is there', async () => {
    const { network } = await loadApp();
    const first = network.getState().addArea(core);
    network.getState().addArea(edge);
    network.getState().removeArea(first);
    expect(network.getState().addArea(core)).toBe('area-3');
    expect(new Set(network.getState().areas.map((area) => area.id)).size).toBe(2);
  });
});

describe('the area that is selected', () => {
  it('is one at most, and is not kept among the selected devices', async () => {
    const { network } = await loadApp();
    const device = network.getState().addDevice(pc('PC-1'));
    const first = network.getState().addArea(core);
    const second = network.getState().addArea(edge);
    network.getState().markSaved();

    network.getState().selectMultipleDevices([device]);
    network.getState().selectArea(first);
    // selecting an area lets go of the devices
    expect(network.getState()).toMatchObject({ selectedAreaId: first, selectedDeviceIds: [] });
    network.getState().selectArea(second);
    expect(network.getState().selectedAreaId).toBe(second);

    // selecting devices lets go of the area
    network.getState().selectMultipleDevices([device]);
    expect(network.getState()).toMatchObject({ selectedAreaId: null, selectedDeviceIds: [device] });

    // and none of this is an edit
    expect(network.getState().hasUnsavedChanges).toBe(false);
  });

  it('an empty selection of devices (a click on the canvas) does not let go of the area by itself', async () => {
    const { network } = await loadApp();
    const id = network.getState().addArea(core);
    network.getState().selectArea(id);
    network.getState().selectMultipleDevices([]);
    expect(network.getState().selectedAreaId).toBe(id);
    network.getState().selectArea(null);
    expect(network.getState().selectedAreaId).toBeNull();
  });

  it('an area that is not on the canvas cannot be selected', async () => {
    const { network } = await loadApp();
    const device = network.getState().addDevice(pc('PC-1'));
    network.getState().selectMultipleDevices([device]);
    network.getState().selectArea('area-404');
    expect(network.getState()).toMatchObject({ selectedAreaId: null, selectedDeviceIds: [device] });
  });

  it('copy and paste are of the devices: no area is copied, and none is pasted', async () => {
    const { network } = await loadApp();
    const device = network.getState().addDevice(pc('PC-1'));
    network.getState().addArea(core);
    network.getState().selectMultipleDevices([device]);

    network.getState().copySelection();
    network.getState().paste();

    expect(network.getState().devices).toHaveLength(2);
    expect(network.getState().areas).toHaveLength(1);
    expect(JSON.stringify(network.getState().clipboard)).not.toContain('area-');
  });

  it('presentation mode puts it away with the rest of the building tools, and edits nothing', async () => {
    const { network, presentation } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    const id = network.getState().addArea(core);
    network.getState().selectArea(id);
    network.getState().setEditingArea(id);
    network.getState().markSaved();

    expect(presentation.getState().enter()).toBe(true);

    expect(network.getState()).toMatchObject({ selectedAreaId: null, editingAreaId: null });
    expect(network.getState().areas).toHaveLength(1);
    expect(network.getState().hasUnsavedChanges).toBe(false);
  });
});

describe('the areas and the drawing they were made for', () => {
  it('a canvas emptied has no areas left', async () => {
    const { network } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    const id = network.getState().addArea(core);
    network.getState().selectArea(id);

    network.getState().clearAllDevices();

    expect(network.getState()).toMatchObject({ devices: [], areas: [], selectedAreaId: null });
  });

  it('a drawing loaded as a whole (a sample network, a YAML file) takes their place too', async () => {
    const { network } = await loadApp();
    network.getState().addArea(core);

    network.getState().loadTopology([{ ...pc('PC-9'), id: 'x' }], []);

    expect(network.getState().devices.map((d) => d.label)).toEqual(['PC-9']);
    expect(network.getState().areas).toEqual([]);
  });

  it('moving a device moves no area, and moving an area moves no device', async () => {
    const { network } = await loadApp();
    const device = network.getState().addDevice(pc('PC-1'));
    const id = network.getState().addArea(core);

    network.getState().updateDevice(device, { position: { x: 900, y: 900 } });
    expect(network.getState().areas[0].position).toEqual(core.position);

    network.getState().updateArea(id, { position: { x: -300, y: -300 } });
    expect(network.getState().devices[0].position).toEqual({ x: 900, y: 900 });
  });
});

describe('the areas of each canvas of a project', () => {
  it('stay with their canvas through every switch', async () => {
    const { network, project } = await loadApp();
    project.getState().createProject({ name: 'Sede Milano' });
    network.getState().addDevice(pc('PC-1'));
    network.getState().addArea(core);
    const second = project.getState().addCanvas('DMZ');

    project.getState().switchCanvas(second);
    // an empty canvas: no area of the first follows
    expect(network.getState().areas).toEqual([]);
    const onSecond = network.getState().addArea(edge);
    network.getState().selectArea(onSecond);

    project.getState().switchCanvas('canvas-1');
    expect(network.getState().areas).toEqual([{ id: 'area-1', ...core }]);
    // (what was selected on the canvas that left is not selected here)
    expect(network.getState().selectedAreaId).toBeNull();

    project.getState().switchCanvas(second);
    expect(network.getState().areas).toEqual([{ id: 'area-1', ...edge }]);
  });

  it('are in the project as it goes to a file, each on its canvas; a canvas without any has no list', async () => {
    const { network, project } = await loadApp();
    project.getState().createProject({ name: 'Sede Milano' });
    network.getState().addArea(core);
    project.getState().addCanvas('DMZ');
    const third = project.getState().addCanvas('Magazzino');
    project.getState().switchCanvas(third);
    network.getState().addArea(edge);
    network.getState().addArea(core);

    const file = project.getState().buildProjectFile();

    expect(file.canvases.map((canvas) => [canvas.name, canvas.areas?.map((area) => area.label)])).toEqual([
      ['Canvas 1', ['Core']],
      ['DMZ', undefined],
      ['Magazzino', ['Edge', 'Core']],
    ]);
    expect('areas' in JSON.parse(JSON.stringify(file.canvases[1]))).toBe(false);
  });

  it('the last area deleted from the canvas on screen is gone from the project too', async () => {
    const { network, project } = await loadApp();
    project.getState().createProject({ name: 'Sede Milano' });
    const id = network.getState().addArea(core);
    project.getState().commitActiveCanvas();
    expect(project.getState().canvases[0].areas).toHaveLength(1);

    network.getState().removeArea(id);

    const [canvas] = project.getState().buildProjectFile().canvases;
    expect(canvas.areas).toBeUndefined();
  });

  it('a project saved, written and opened again has them where they were', async () => {
    const { network, project, files } = await loadApp();
    project.getState().createProject({ name: 'Sede Milano' });
    network.getState().addDevice(pc('PC-1'));
    network.getState().addArea(core);
    network.getState().addArea(edge);
    const second = project.getState().addCanvas('DMZ');
    project.getState().switchCanvas(second);
    network.getState().addArea({ ...edge, label: 'Internet' });

    const text = files.serializeProject(project.getState().buildProjectFile());
    // (another project in between: nothing of the first is left on screen)
    project.getState().createProject({ name: 'Altro' });
    expect(network.getState().areas).toEqual([]);
    const read = files.parseProjectFile(text);
    if (!read.ok) throw new Error(read.error);
    expect(read.warnings).toEqual([]);
    project.getState().loadProject(read.project);

    // it opens on the canvas it was saved on
    expect(network.getState().areas).toEqual([{ id: 'area-1', ...edge, label: 'Internet' }]);
    expect(network.getState().hasUnsavedChanges).toBe(false);
    project.getState().switchCanvas('canvas-1');
    expect(network.getState().areas).toEqual([
      { id: 'area-1', ...core },
      { id: 'area-2', ...edge },
    ]);
    expect(network.getState().devices.map((d) => d.label)).toEqual(['PC-1']);
  });

  it('a new project starts without any, and the canvas that takes the place of a deleted one shows its own', async () => {
    const { network, project } = await loadApp();
    project.getState().createProject({ name: 'Sede Milano' });
    network.getState().addArea(core);
    const second = project.getState().addCanvas('DMZ');
    project.getState().switchCanvas(second);
    network.getState().addArea(edge);

    // the canvas on screen is deleted: its neighbour comes on screen with its own area
    expect(project.getState().deleteCanvas(second)).toBe(true);
    expect(network.getState().areas.map((area) => area.label)).toEqual(['Core']);

    project.getState().createProject({ name: 'Nuovo' });
    expect(network.getState().areas).toEqual([]);
    expect(project.getState().canvases[0].areas).toBeUndefined();
  });
});

describe('the areas after the page is loaded again', () => {
  it('are on the canvas that was on screen, as they were left', async () => {
    const first = await loadApp();
    first.project.getState().createProject({ name: 'Sede Milano' });
    first.network.getState().addDevice(pc('PC-1'));
    const id = first.network.getState().addArea(core);
    first.network.getState().updateArea(id, { position: { x: 7, y: 9 } });
    first.network.getState().selectArea(id);

    const again = await loadApp();

    expect(again.network.getState().areas).toEqual([{ id, ...core, position: { x: 7, y: 9 } }]);
    // (what was selected belongs to the session, as for the devices)
    expect(again.network.getState()).toMatchObject({ selectedAreaId: null, editingAreaId: null });
    // and the other canvases have kept theirs
    const second = again.project.getState().addCanvas('DMZ');
    again.project.getState().switchCanvas(second);
    again.network.getState().addArea(edge);
    again.project.getState().switchCanvas('canvas-1');

    const third = await loadApp();
    expect(third.network.getState().areas.map((area) => area.label)).toEqual(['Core']);
    third.project.getState().switchCanvas(second);
    expect(third.network.getState().areas.map((area) => area.label)).toEqual(['Edge']);
  });

  it('a drawing kept by a version without areas opens as before, with none', async () => {
    const first = await loadApp();
    first.network.getState().addDevice(pc('PC-1'));
    // what that version wrote: the same, without the list
    const stored = JSON.parse(localStorage.getItem(NETWORK_KEY) ?? '{}');
    expect(stored.state.areas).toEqual([]);
    delete stored.state.areas;
    localStorage.setItem(NETWORK_KEY, JSON.stringify(stored));

    const again = await loadApp();

    expect(again.network.getState().areas).toEqual([]);
    expect(again.network.getState().devices.map((d) => d.label)).toEqual(['PC-1']);
  });

  it('what the storage holds in place of an area is left behind, the rest is kept', async () => {
    const first = await loadApp();
    first.network.getState().addArea(core);
    const stored = JSON.parse(localStorage.getItem(NETWORK_KEY) ?? '{}');
    stored.state.areas = [stored.state.areas[0], { id: 'area-2', label: 'Rotto' }, 'Core'];
    localStorage.setItem(NETWORK_KEY, JSON.stringify(stored));

    const again = await loadApp();

    expect(again.network.getState().areas).toEqual([{ id: 'area-1', ...core }]);
  });
});
