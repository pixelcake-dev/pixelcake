/**
 * What is written with the marker («Pennarello») in the stores: it belongs to
 * its canvas and goes wherever the canvas goes (a canvas switch, a copy of
 * the canvas, the project as it goes to a file, a page load); each mark
 * finished, rubbed out or cleared is one edit of the project. While
 * presenting, the presenter's pen writes apart: on top, never saved, gone
 * when the presentation ends.
 *
 * Isolation: the stores read localStorage when they are created, so each
 * test re-imports them (a re-import is a reload).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CanvasMark, NetworkDevice } from '@/types';

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
  const { useMarkerStore } = await import('./markerStore');
  const files = await import('@/utils/projectFile');
  return {
    network: useNetworkStore,
    project: useProjectStore,
    presentation: usePresentationStore,
    marker: useMarkerStore,
    files,
  };
}

const ring: Omit<CanvasMark, 'id'> = {
  kind: 'ellipse',
  color: 'red',
  width: 'thick',
  points: [100, 50, 260, 140],
  seed: 11,
};
const note: Omit<CanvasMark, 'id'> = {
  kind: 'text',
  color: 'ink',
  width: 'thin',
  points: [300, 40],
  text: 'Punto unico di guasto',
  seed: 5,
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

describe('a mark on the canvas on screen', () => {
  it('is added with an id of its own, and is a change of the project', async () => {
    const { network } = await loadApp();
    network.getState().markSaved();

    const first = network.getState().addMark(ring);
    const second = network.getState().addMark({ ...note, text: '  Punto unico di guasto  ' });

    expect([first, second]).toEqual(['mark-1', 'mark-2']);
    expect(network.getState().marks).toEqual([
      { id: 'mark-1', ...ring },
      { id: 'mark-2', ...note },
    ]);
    expect(network.getState().hasUnsavedChanges).toBe(true);
    // (nothing else of the drawing is touched)
    expect(network.getState()).toMatchObject({ devices: [], connections: [], areas: [], deviceCounter: 0 });
  });

  it('is refused when it is no mark: nothing changes', async () => {
    const { network } = await loadApp();
    network.getState().markSaved();

    expect(network.getState().addMark({ ...note, text: ' ' })).toBeNull();
    expect(network.getState().addMark({ ...ring, points: [1, 2] })).toBeNull();

    expect(network.getState().marks).toEqual([]);
    expect(network.getState().hasUnsavedChanges).toBe(false);
  });

  it('rubbed out with the eraser: those touched go in one edit, the others stay', async () => {
    const { network } = await loadApp();
    const a = network.getState().addMark(ring);
    const b = network.getState().addMark(note);
    const c = network.getState().addMark({ ...ring, color: 'green' });
    network.getState().markSaved();

    network.getState().removeMarks([a!, c!, 'mark-99']);

    expect(network.getState().marks.map((mark) => mark.id)).toEqual([b]);
    expect(network.getState().hasUnsavedChanges).toBe(true);
  });

  it('rubbing out what is not there is no change', async () => {
    const { network } = await loadApp();
    network.getState().addMark(ring);
    network.getState().markSaved();

    network.getState().removeMarks(['mark-99']);
    network.getState().removeMarks([]);

    expect(network.getState().marks).toHaveLength(1);
    expect(network.getState().hasUnsavedChanges).toBe(false);
  });

  it('cleared all at once: one edit; a canvas with nothing written is no change', async () => {
    const { network } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    network.getState().addMark(ring);
    network.getState().addMark(note);
    network.getState().markSaved();

    network.getState().clearMarks();
    expect(network.getState().marks).toEqual([]);
    expect(network.getState().devices).toHaveLength(1);
    expect(network.getState().hasUnsavedChanges).toBe(true);

    network.getState().markSaved();
    network.getState().clearMarks();
    expect(network.getState().hasUnsavedChanges).toBe(false);
  });

  it('a new mark never takes the id of one that is there', async () => {
    const { network } = await loadApp();
    network.getState().addMark(ring);
    network.getState().addMark(note);
    network.getState().removeMarks(['mark-1']);

    expect(network.getState().addMark(ring)).toBe('mark-3');
  });
});

describe('the marks and the drawing they were written on', () => {
  it('a canvas emptied has none left', async () => {
    const { network } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    network.getState().addMark(ring);

    network.getState().clearAllDevices();

    expect(network.getState().marks).toEqual([]);
  });

  it('a drawing loaded as a whole (a sample network, a YAML file) takes their place too', async () => {
    const { network } = await loadApp();
    network.getState().addMark(ring);

    network.getState().loadTopology([{ id: 'x', ...pc('PC-1') }], []);

    expect(network.getState().marks).toEqual([]);
  });

  it('moving a device moves no mark', async () => {
    const { network } = await loadApp();
    const id = network.getState().addDevice(pc('PC-1'));
    network.getState().addMark(ring);

    network.getState().updateDevice(id, { position: { x: 900, y: 900 } });

    expect(network.getState().marks[0].points).toEqual(ring.points);
  });
});

describe('the marks of each canvas of a project', () => {
  it('stay with their canvas through every switch', async () => {
    const { network, project } = await loadApp();
    network.getState().addMark(ring);
    const second = project.getState().addCanvas('Piano 2');

    project.getState().switchCanvas(second);
    expect(network.getState().marks).toEqual([]);
    network.getState().addMark(note);

    project.getState().switchCanvas('canvas-1');
    expect(network.getState().marks).toEqual([{ id: 'mark-1', ...ring }]);

    project.getState().switchCanvas(second);
    expect(network.getState().marks).toEqual([{ id: 'mark-1', ...note }]);
  });

  it('are in the project as it goes to a file, each on its canvas; a canvas without any has no list', async () => {
    const { network, project } = await loadApp();
    network.getState().addMark(ring);
    project.getState().addCanvas('Vuoto');

    const file = project.getState().buildProjectFile();

    expect(file.canvases[0].marks).toEqual([{ id: 'mark-1', ...ring }]);
    expect(file.canvases[1]).not.toHaveProperty('marks');
  });

  it('the last mark rubbed out on the canvas on screen is gone from the project too', async () => {
    const { network, project, files } = await loadApp();
    network.getState().addMark(ring);
    project.getState().commitActiveCanvas();

    network.getState().clearMarks();

    const file = project.getState().buildProjectFile();
    expect(file.canvases[0].marks).toBeUndefined();
    expect(files.serializeProject(file)).not.toContain('"marks"');
  });

  it('a copy of the canvas has them too, and its own: a mark added to one is not on the other', async () => {
    const { network, project } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    network.getState().addMark(ring);
    network.getState().addMark(note);

    const copy = project.getState().duplicateCanvas('canvas-1');
    expect(copy).not.toBeNull();
    project.getState().switchCanvas(copy!);
    expect(network.getState().marks).toEqual([
      { id: 'mark-1', ...ring },
      { id: 'mark-2', ...note },
    ]);

    network.getState().addMark({ ...ring, color: 'green' });
    project.getState().switchCanvas('canvas-1');
    expect(network.getState().marks).toHaveLength(2);
  });

  it('a project saved, written and opened again has them where they were, wobble and all', async () => {
    const { network, project, files } = await loadApp();
    network.getState().addMark(ring);
    network.getState().addMark({ kind: 'pen', color: 'accent', width: 'thin', points: [0, 0, 12.5, 4, 30, -2.5], seed: 9 });
    const written = files.serializeProject(project.getState().buildProjectFile());

    const fresh = await loadApp();
    const read = fresh.files.parseProjectFile(written);
    if (!read.ok) throw new Error(read.error);
    expect(read.warnings).toEqual([]);
    fresh.project.getState().loadProject(read.project);

    expect(fresh.network.getState().marks).toEqual(network.getState().marks);
    expect(fresh.network.getState().hasUnsavedChanges).toBe(false);
  });

  it('a new project starts without any', async () => {
    const { network, project } = await loadApp();
    network.getState().addMark(ring);

    project.getState().createProject({ name: 'Nuovo' });

    expect(network.getState().marks).toEqual([]);
  });
});

describe('the marks after the page is loaded again', () => {
  it('are on the canvas that was on screen, as they were left', async () => {
    const first = await loadApp();
    first.network.getState().addMark(ring);
    first.network.getState().addMark(note);
    const marks = first.network.getState().marks;

    const { network } = await loadApp();

    expect(network.getState().marks).toEqual(marks);
  });

  it('a drawing kept by a version without marks opens as before, with none', async () => {
    localStorage.setItem(
      NETWORK_KEY,
      JSON.stringify({ state: { devices: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 } }, version: 0 })
    );

    const { network } = await loadApp();

    expect(network.getState().marks).toEqual([]);
  });

  it('what the storage holds in place of a mark is left behind, the rest is kept', async () => {
    localStorage.setItem(
      NETWORK_KEY,
      JSON.stringify({
        state: { devices: [], connections: [], marks: [{ id: 'mark-1', ...ring }, { kind: 'pen' }, 'x'] },
        version: 0,
      })
    );

    const { network } = await loadApp();

    expect(network.getState().marks).toEqual([{ id: 'mark-1', ...ring }]);
  });
});

describe("the presenter's pen", () => {
  it('writes apart from the canvas: nothing of the drawing changes, nothing is saved', async () => {
    const { network, presentation, marker, project } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    network.getState().addMark(ring);
    network.getState().markSaved();
    presentation.getState().enter();

    const id = marker.getState().addPresenterMark(note);

    expect(id).toBe('mark-1');
    expect(marker.getState().presenterMarks).toEqual([{ id: 'mark-1', ...note }]);
    expect(network.getState().marks).toEqual([{ id: 'mark-1', ...ring }]);
    expect(network.getState().hasUnsavedChanges).toBe(false);
    expect(project.getState().buildProjectFile().canvases[0].marks).toEqual([{ id: 'mark-1', ...ring }]);
  });

  it('is rubbed out and cleared by itself', async () => {
    const { network, presentation, marker } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    presentation.getState().enter();
    const a = marker.getState().addPresenterMark(ring);
    marker.getState().addPresenterMark(note);

    marker.getState().removePresenterMarks([a!]);
    expect(marker.getState().presenterMarks.map((mark) => mark.kind)).toEqual(['text']);

    marker.getState().clearPresenterMarks();
    expect(marker.getState().presenterMarks).toEqual([]);
  });

  it('what it wrote is gone when the presentation ends, and the marker is put away', async () => {
    const { network, presentation, marker } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    presentation.getState().enter();
    marker.getState().setActive(true);
    marker.getState().addPresenterMark(ring);

    presentation.getState().exit();

    expect(marker.getState().presenterMarks).toEqual([]);
    expect(marker.getState().active).toBe(false);
  });

  it('what it wrote is gone when another canvas comes on screen: it was written over the old one', async () => {
    const { network, presentation, marker } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    presentation.getState().enter();
    marker.getState().addPresenterMark(ring);

    presentation.getState().resetCanvasState();

    expect(marker.getState().presenterMarks).toEqual([]);
  });

  it('entering the presentation puts away a marker that was in use while building', async () => {
    const { network, presentation, marker } = await loadApp();
    network.getState().addDevice(pc('PC-1'));
    marker.getState().setActive(true);

    presentation.getState().enter();

    expect(marker.getState().active).toBe(false);
  });
});
