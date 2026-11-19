/**
 * Undo and redo of the drawing (store/historyStore.ts).
 *
 * One action of the user is one step: a device added, a drag from press to
 * release, a delete with what it takes along, a paste, a save in the window
 * of a device or of a link, a command of the terminal, an import, a bulk
 * add, an automatic layout, an automatic connection, an area made, moved,
 * resized, renamed, recoloured or deleted. What is not the drawing is not a
 * step: the view, the selection, the windows, a presentation, the settings
 * of the project, the preferences of the browser.
 *
 * The history is of the board: each board of the project keeps its own for
 * the session, and opening or creating a project, or loading a sample,
 * starts it afresh. It covers whatever the project file keeps of a board,
 * so that a field added to a board later is covered with nothing written
 * for it.
 *
 * Isolation: the stores read localStorage when they are created, so each
 * test re-imports them (a re-import is a reload).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CanvasArea, NetworkConnection, NetworkDevice } from '@/types';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

/** Import the stores afresh: what a page load does */
async function loadApp() {
  vi.resetModules();
  const { useNetworkStore } = await import('./networkStore');
  const { useProjectStore } = await import('./projectStore');
  const { usePresentationStore } = await import('./presentationStore');
  const { useUIStore } = await import('./uiStore');
  const { useTemplateStore } = await import('./templateStore');
  const history = await import('./historyStore');
  return {
    network: useNetworkStore,
    project: useProjectStore,
    presentation: usePresentationStore,
    ui: useUIStore,
    templates: useTemplateStore,
    history,
  };
}

/** The end of the task an action runs in: the step it made is closed then */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const pc = (label: string, x = 100, y = 100): Omit<NetworkDevice, 'id'> => ({
  type: 'PC',
  label,
  ip: '',
  subnet: '255.255.255.0',
  gateway: '',
  position: { x, y },
});

const core: Omit<CanvasArea, 'id'> = {
  label: 'Core',
  color: 'violet',
  position: { x: 40, y: 40 },
  size: { width: 300, height: 200 },
};

/** The drawing of the board, as a project file keeps it */
type App = Awaited<ReturnType<typeof loadApp>>;
const drawing = (app: App) => {
  const { devices, connections, areas } = app.network.getState();
  return JSON.parse(JSON.stringify({ devices, connections, areas }));
};

/** A board with three PCs and a switch, cabled; its history empty */
async function threeAndASwitch(app: App) {
  const store = app.network.getState();
  const ids = [pc('PC-1', 100, 300), pc('PC-2', 300, 300), pc('PC-3', 500, 300)].map((device) =>
    store.addDevice(device)
  );
  const sw = store.addDevice({ ...pc('SW-1', 300, 100), type: 'Switch', ports: [1, 2, 3, 4].map((id) => ({ id, enabled: true, speed: 'auto' as const })) });
  for (const id of ids) store.addConnection({ source: sw, target: id });
  await settle();
  app.history.clearHistory();
  return { pcs: ids, sw };
}

beforeEach(() => {
  localStorage.clear();
});

describe('one action is one step', () => {
  it('a device added: undone it is gone, redone it is back as it was', async () => {
    const app = await loadApp();
    const before = drawing(app);
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    const after = drawing(app);

    expect(app.history.useHistoryStore.getState().canUndo).toBe(true);
    expect(app.history.undo()).toBe(true);
    expect(drawing(app)).toEqual(before);
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
    expect(app.history.useHistoryStore.getState().canRedo).toBe(true);

    expect(app.history.redo()).toBe(true);
    expect(drawing(app)).toEqual(after);
    expect(app.history.useHistoryStore.getState().canRedo).toBe(false);
  });

  it('two actions are two steps, undone one at a time, the last first', async () => {
    const app = await loadApp();
    const empty = drawing(app);
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    const one = drawing(app);
    app.network.getState().addDevice(pc('PC-2', 300));
    await settle();

    app.history.undo();
    expect(drawing(app)).toEqual(one);
    app.history.undo();
    expect(drawing(app)).toEqual(empty);
    expect(app.history.undo()).toBe(false);
  });

  it('a drag is one step from press to release, however many moves, several devices together too', async () => {
    const app = await loadApp();
    const { pcs } = await threeAndASwitch(app);
    const before = drawing(app);

    app.history.beginGesture();
    for (let step = 1; step <= 20; step++) {
      // (React Flow writes every device of the selection at every move)
      for (const id of pcs) app.network.getState().updateDevice(id, { position: { x: 100 + step * 5, y: 300 + step } });
      await settle();
    }
    // (the press is still on: nothing is closed yet)
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
    app.history.endGesture();
    await settle();

    expect(app.history.useHistoryStore.getState().canUndo).toBe(true);
    app.history.undo();
    expect(drawing(app)).toEqual(before);
    expect(app.history.undo()).toBe(false);
  });

  it('a delete brings back what it took along: the cables of the devices, the areas', async () => {
    const app = await loadApp();
    const { pcs } = await threeAndASwitch(app);
    app.network.getState().addArea(core);
    await settle();
    app.history.clearHistory();
    const before = drawing(app);

    app.network.getState().removeElements({ devices: [pcs[0], pcs[1]], areas: ['area-1'] });
    await settle();
    expect(app.network.getState().connections).toHaveLength(1);

    app.history.undo();
    expect(drawing(app)).toEqual(before);
  });

  it('a paste is one step', async () => {
    const app = await loadApp();
    const { pcs } = await threeAndASwitch(app);
    const before = drawing(app);
    app.network.getState().selectMultipleDevices(pcs);
    app.network.getState().copySelection();
    expect(app.network.getState().paste().pasted).toHaveLength(3);
    await settle();

    app.history.undo();
    expect(drawing(app)).toEqual(before);
  });

  it('a save in the window of a device is one step with all its fields; a save that changes nothing is none', async () => {
    const app = await loadApp();
    const { pcs } = await threeAndASwitch(app);
    const before = drawing(app);
    app.network.getState().updateDevice(pcs[0], { label: 'Desk', notes: 'by the window', ip: '192.168.1.10' });
    await settle();
    // (the same values saved again: nothing to take back)
    const device = app.network.getState().devices.find((d) => d.id === pcs[0])!;
    app.network.getState().updateDevice(pcs[0], { label: device.label, notes: device.notes, ip: device.ip });
    await settle();

    app.history.undo();
    expect(drawing(app)).toEqual(before);
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
  });

  it('a save in the window of a link is one step', async () => {
    const app = await loadApp();
    await threeAndASwitch(app);
    const before = drawing(app);
    const link = app.network.getState().connections[0];
    app.network.getState().updateConnection(link.id, { label: 'uplink', bandwidth: '10G', vlan: [10, 20] });
    await settle();

    app.history.undo();
    expect(drawing(app)).toEqual(before);
  });

  it('a command of the terminal that configures is one step; one that only reads is none', async () => {
    const app = await loadApp();
    await threeAndASwitch(app);
    const { executeCommand } = await import('@/terminal/executor');
    const before = drawing(app);

    executeCommand('show devices', { deviceLabel: null });
    await settle();
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);

    executeCommand('set ip PC-1 192.168.1.50', { deviceLabel: null });
    await settle();
    expect(app.network.getState().devices.find((d) => d.label === 'PC-1')?.ip).toBe('192.168.1.50');
    executeCommand('disconnect PC-2 from SW-1', { deviceLabel: null });
    await settle();

    app.history.undo();
    expect(app.network.getState().connections).toHaveLength(3);
    expect(app.network.getState().devices.find((d) => d.label === 'PC-1')?.ip).toBe('192.168.1.50');
    app.history.undo();
    expect(drawing(app)).toEqual(before);
  });

  it('an import that replaces the drawing is one step, its areas with it', async () => {
    const app = await loadApp();
    await threeAndASwitch(app);
    const before = drawing(app);
    // (what the Import/Export window does: in one go after its question)
    const store = app.network.getState();
    store.clearAllDevices();
    store.loadTopology(
      [{ id: 'a', ...pc('Imported-1') }, { id: 'b', ...pc('Imported-2', 300) }] as NetworkDevice[],
      [{ id: 'l', source: 'a', target: 'b' } as NetworkConnection]
    );
    store.addArea(core);
    await settle();
    expect(app.network.getState().devices.map((d) => d.label)).toEqual(['Imported-1', 'Imported-2']);

    app.history.undo();
    expect(drawing(app)).toEqual(before);
  });

  it('a bulk add is one step', async () => {
    const app = await loadApp();
    const before = drawing(app);
    for (let n = 1; n <= 12; n++) app.network.getState().addDevice(pc(`PC-${n}`, n * 160));
    await settle();

    app.history.undo();
    expect(drawing(app)).toEqual(before);
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
  });

  it('an automatic layout is one step, and so is an automatic connection', async () => {
    const app = await loadApp();
    const { pcs } = await threeAndASwitch(app);
    const before = drawing(app);
    await app.network.getState().applyAutoLayout('LR', app.templates.getState().templates);
    await settle();
    expect(drawing(app)).not.toEqual(before);
    app.history.undo();
    expect(drawing(app)).toEqual(before);

    app.network.getState().removeElements({ connections: app.network.getState().connections.map((c) => c.id) });
    await settle();
    const loose = drawing(app);
    expect(app.network.getState().autoConnectDevices().added).toBeGreaterThan(0);
    expect(pcs).toHaveLength(3);
    await settle();
    app.history.undo();
    expect(drawing(app)).toEqual(loose);
  });

  it('an area made, moved, resized, renamed, recoloured and deleted: a step each', async () => {
    const app = await loadApp();
    const store = () => app.network.getState();
    const states = [drawing(app)];
    const act = async (edit: () => void) => {
      edit();
      await settle();
      states.push(drawing(app));
    };
    await act(() => store().addArea(core));
    await act(() => {
      // (dragged by its border: many moves, one press)
      app.history.beginGesture();
      for (let x = 50; x <= 150; x += 10) store().moveTogether({}, { 'area-1': { x, y: 60 } });
      app.history.endGesture();
    });
    await act(() => {
      app.history.beginGesture();
      for (let w = 310; w <= 400; w += 30) store().updateArea('area-1', { size: { width: w, height: 240 } });
      app.history.endGesture();
    });
    await act(() => store().updateArea('area-1', { label: 'Server room' }));
    await act(() => store().updateArea('area-1', { color: 'teal' }));
    await act(() => store().removeArea('area-1'));

    for (let index = states.length - 2; index >= 0; index--) {
      expect(app.history.undo()).toBe(true);
      expect(drawing(app)).toEqual(states[index]);
    }
    expect(app.history.undo()).toBe(false);
    for (let index = 1; index < states.length; index++) {
      expect(app.history.redo()).toBe(true);
      expect(drawing(app)).toEqual(states[index]);
    }
  });
});

describe('what is not a step', () => {
  it('the view, the selection, the pointer, the windows, a presentation, the settings of the project, the preferences', async () => {
    const app = await loadApp();
    const { pcs } = await threeAndASwitch(app);
    const store = app.network.getState();

    store.setViewport({ x: 120, y: -40, zoom: 0.5 });
    store.triggerFitView();
    store.selectMultipleDevices(pcs.slice(0, 2));
    store.selectArea(null);
    store.setHoveredDevice(pcs[0]);
    store.copySelection();
    app.ui.getState().openModal('inspector');
    app.ui.getState().closeModal('inspector');
    app.ui.getState().toggleDarkMode();
    app.ui.getState().setAreasShown(false);
    store.setGlobalNetworkSettings({ dns: '192.168.1.53' });
    app.presentation.getState().enter();
    app.presentation.getState().toggleDeviceFailure(pcs[0]);
    app.presentation.getState().exit();
    await settle();

    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
    expect(app.history.undo()).toBe(false);
  });
});

describe('the history', () => {
  it(`keeps the last ${100} steps of a board: the oldest go`, async () => {
    const app = await loadApp();
    expect(app.history.HISTORY_LIMIT).toBe(100);
    for (let n = 1; n <= 105; n++) {
      app.network.getState().addDevice(pc(`PC-${n}`, n * 10));
      await settle();
    }
    let undone = 0;
    while (app.history.undo()) undone++;
    expect(undone).toBe(100);
    // (the first five could not be taken back)
    expect(app.network.getState().devices.map((d) => d.label)).toEqual(['PC-1', 'PC-2', 'PC-3', 'PC-4', 'PC-5']);
  });

  it('loses the redo when a new step is made after an undo', async () => {
    const app = await loadApp();
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    app.history.undo();
    app.network.getState().addDevice(pc('PC-9'));
    await settle();
    expect(app.history.useHistoryStore.getState().canRedo).toBe(false);
    expect(app.history.redo()).toBe(false);
  });

  it('keeps what a step did not change shared, not copied', async () => {
    const app = await loadApp();
    const { pcs } = await threeAndASwitch(app);
    const untouched = app.network.getState().devices.filter((d) => d.id !== pcs[0]);
    const links = app.network.getState().connections;
    app.network.getState().updateDevice(pcs[0], { position: { x: 999, y: 999 } });
    await settle();
    app.history.undo();
    // (the very objects of before: a step holds the parts it changed, and shares the rest)
    const back = app.network.getState().devices.filter((d) => d.id !== pcs[0]);
    back.forEach((device, index) => expect(device).toBe(untouched[index]));
    app.network.getState().connections.forEach((connection, index) => expect(connection).toBe(links[index]));
    // (in lists of its own: what the engine keeps for a list of the store goes with that list)
    expect(app.network.getState().connections).not.toBe(links);
  });

  it('is an edit of the project: undo sets the changed flag and is written to the browser', async () => {
    const app = await loadApp();
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    app.network.getState().markSaved();
    app.history.undo();
    expect(app.network.getState().hasUnsavedChanges).toBe(true);
    const stored = JSON.parse(localStorage.getItem('pixelcake-network-v2') ?? '{}');
    expect(stored.state.devices).toEqual([]);
  });

  it('after an undo, the selection holds only what is there, and an id is never given twice', async () => {
    const app = await loadApp();
    const first = app.network.getState().addDevice(pc('PC-1'));
    await settle();
    const second = app.network.getState().addDevice(pc('PC-2', 300));
    await settle();
    app.network.getState().selectMultipleDevices([first, second]);
    app.history.undo();
    expect(app.network.getState().selectedDeviceIds).toEqual([first]);
    const third = app.network.getState().addDevice(pc('PC-3', 500));
    expect(third).not.toBe(second);
  });

  it('closes the window of a device, or of a link, that the undo took away, and the menus', async () => {
    const app = await loadApp();
    const id = app.network.getState().addDevice(pc('PC-1'));
    await settle();
    const ui = app.ui.getState();
    ui.setInspectorDevice(app.network.getState().devices[0]);
    ui.openModal('inspector');
    ui.setContextMenuDevice(app.network.getState().devices[0], 10, 10);
    app.history.undo();
    expect(app.network.getState().devices.some((d) => d.id === id)).toBe(false);
    expect(app.ui.getState().modals.inspector).toBe(false);
    expect(app.ui.getState().contextMenuDevice).toBeNull();
  });

  it('does nothing while presenting, and is there again after', async () => {
    const app = await loadApp();
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    app.presentation.getState().enter();
    expect(app.history.undo()).toBe(false);
    expect(app.network.getState().devices).toHaveLength(1);
    app.presentation.getState().exit();
    expect(app.history.undo()).toBe(true);
    expect(app.network.getState().devices).toHaveLength(0);
    expect(app.history.redo()).toBe(true);
    app.presentation.getState().enter();
    expect(app.history.undo()).toBe(false);
    expect(app.network.getState().devices).toHaveLength(1);
  });

  it('does nothing while a button of the pointer is held (a drag under way)', async () => {
    const app = await loadApp();
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    app.history.beginGesture();
    expect(app.history.undo()).toBe(false);
    app.history.endGesture();
    expect(app.history.undo()).toBe(true);
  });
});

describe('a history for each board', () => {
  it('a board keeps its own: another board starts with none, and switching back finds it again', async () => {
    const app = await loadApp();
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    const first = app.project.getState().activeCanvasId;

    const second = app.project.getState().addCanvas();
    app.project.getState().switchCanvas(second);
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
    app.network.getState().addDevice(pc('Other-1'));
    await settle();
    app.network.getState().addDevice(pc('Other-2', 300));
    await settle();

    app.project.getState().switchCanvas(first);
    expect(app.history.useHistoryStore.getState().canUndo).toBe(true);
    app.history.undo();
    expect(app.network.getState().devices).toEqual([]);
    expect(app.history.undo()).toBe(false);

    app.project.getState().switchCanvas(second);
    app.history.undo();
    expect(app.network.getState().devices.map((d) => d.label)).toEqual(['Other-1']);
  });

  it('switching boards is not a step, and a step under way ends on its own board', async () => {
    const app = await loadApp();
    const second = app.project.getState().addCanvas();
    app.network.getState().addDevice(pc('PC-1'));
    // (no pause: the board changes in the same task as the edit)
    app.project.getState().switchCanvas(second);
    await settle();
    expect(app.history.undo()).toBe(false);
    app.project.getState().switchCanvas('canvas-1');
    expect(app.history.undo()).toBe(true);
    expect(app.network.getState().devices).toEqual([]);
  });

  it('a deleted board takes its history with it', async () => {
    const app = await loadApp();
    const second = app.project.getState().addCanvas();
    app.project.getState().switchCanvas(second);
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    app.project.getState().switchCanvas('canvas-1');
    app.project.getState().deleteCanvas(second);
    // (a board made afterwards may get the same id: it starts with nothing to undo)
    const again = app.project.getState().addCanvas();
    expect(again).toBe(second);
    app.project.getState().switchCanvas(again);
    expect(app.history.undo()).toBe(false);
  });

  it('opening a project, or creating one, starts every history afresh', async () => {
    const app = await loadApp();
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    const file = app.project.getState().buildProjectFile();
    app.project.getState().loadProject(file);
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
    expect(app.history.undo()).toBe(false);
    expect(app.network.getState().devices).toHaveLength(1);

    app.network.getState().addDevice(pc('PC-2', 300));
    await settle();
    app.project.getState().createProject({ name: 'New' });
    expect(app.history.undo()).toBe(false);
  });

  it('loading a sample starts the history of the board afresh', async () => {
    const app = await loadApp();
    app.network.getState().addDevice(pc('PC-1'));
    await settle();
    const { createCompanySample } = await import('@/utils/sampleCompany');
    const { loadSampleNetwork } = await import('@/utils/sampleActions');
    loadSampleNetwork(createCompanySample());
    await settle();
    expect(app.history.useHistoryStore.getState().canUndo).toBe(false);
    expect(app.history.undo()).toBe(false);
    expect(app.network.getState().devices.length).toBeGreaterThan(1);
  });
});

describe('what the project file keeps of a board, and nothing else', () => {
  it('a field of the board added later is covered with nothing written for it', async () => {
    const app = await loadApp();
    // (a board that keeps one more thing, as the drawings made by hand: in
    // the store under a name, and in the project file under the same name)
    type WithMarks = { marks: string[] };
    const original = app.network.getState().getCanvasSnapshot;
    app.network.setState({
      marks: [],
      getCanvasSnapshot: () => ({
        ...original(),
        marks: (app.network.getState() as unknown as WithMarks).marks,
      }),
    } as never);
    const marks = () => (app.network.getState() as unknown as WithMarks).marks;
    const draw = (mark: string) => app.network.setState({ marks: [...marks(), mark] } as never);
    await settle();
    app.history.clearHistory();

    draw('a stroke');
    await settle();
    app.history.beginGesture();
    draw('a second stroke');
    draw('and a third');
    app.history.endGesture();
    await settle();

    app.history.undo();
    expect(marks()).toEqual(['a stroke']);
    app.history.undo();
    expect(marks()).toEqual([]);
    app.history.redo();
    expect(marks()).toEqual(['a stroke']);
  });

  it('a field kept only when it has something is covered too, from its first change to its last', async () => {
    const app = await loadApp();
    type WithMarks = { marks: string[] };
    const original = app.network.getState().getCanvasSnapshot;
    const marks = () => (app.network.getState() as unknown as WithMarks).marks;
    app.network.setState({
      marks: [],
      // (left out of the snapshot when empty, as the areas are)
      getCanvasSnapshot: () => ({ ...original(), ...(marks().length > 0 ? { marks: marks() } : {}) }),
    } as never);
    await settle();
    app.history.clearHistory();

    app.network.setState({ marks: ['first'] } as never);
    await settle();
    app.network.setState({ marks: [] } as never);
    await settle();
    app.history.undo();
    expect(marks()).toEqual(['first']);
    app.history.undo();
    expect(marks()).toEqual([]);
  });

  it('every field the project file keeps of a board is a field of the store with the same name', async () => {
    const app = await loadApp();
    const state = app.network.getState();
    for (const key of Object.keys(state.getCanvasSnapshot())) expect(key in state, key).toBe(true);
  });
});
