/**
 * Saving the project to a file and opening one, through both paths: the File
 * System Access API (mocked pickers and file handles) and the fallback
 * (download, file input).
 *
 * What must hold: a save writes the whole project and clears the changed
 * flag; an open replaces the whole project; cancelling a picker changes
 * nothing; a project with unsaved changes is never replaced without asking.
 *
 * Isolation: the stores and the remembered file handle are module state, so
 * each test re-imports them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import type { NetworkDevice, ProjectFile } from '@/types';
import { parseProjectFile, serializeProject } from './projectFile';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));


function makePc(label: string): Omit<NetworkDevice, 'id'> {
  return {
    type: 'PC',
    label,
    ip: '192.168.1.10',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1',
    position: { x: 0, y: 0 },
  };
}

async function loadApp() {
  vi.resetModules();
  const { toast } = await import('sonner');
  const { useNetworkStore } = await import('@/store/networkStore');
  const { useProjectStore } = await import('@/store/projectStore');
  const { useTemplateStore } = await import('@/store/templateStore');
  const { useUIStore } = await import('@/store/uiStore');
  const { useConfirmStore } = await import('@/store/confirmStore');
  const access = await import('./projectFileAccess');
  return {
    confirm: useConfirmStore,
    network: useNetworkStore,
    project: useProjectStore,
    templates: useTemplateStore,
    ui: useUIStore,
    access,
    toast: {
      success: toast.success as Mock,
      error: toast.error as Mock,
      warning: toast.warning as Mock,
      info: toast.info as Mock,
    },
  };
}

type App = Awaited<ReturnType<typeof loadApp>>;

/**
 * From now on every question the app asks in its window gets this answer, as
 * from a click on one of its two buttons. Gives the questions asked.
 */
function answerQuestions(app: App, yes: boolean) {
  const asked: Array<{ title: string; detail?: string; confirmLabel: string; danger?: boolean }> = [];
  app.confirm.subscribe((state) => {
    if (!state.pending) return;
    asked.push(state.pending);
    state.answer(yes);
  });
  return asked;
}

const labels = (devices: NetworkDevice[]) => devices.map(d => d.label);

function expectNoToast(app: App) {
  for (const toast of Object.values(app.toast)) {
    expect(toast).not.toHaveBeenCalled();
  }
}

/** A project "Sede Milano" with a device on each of two canvases, changed flag set */
async function appWithProject(): Promise<App> {
  const app = await loadApp();
  app.project.getState().renameProject('Sede Milano');
  app.network.getState().addDevice(makePc('A-1'));
  const second = app.project.getState().addCanvas('Magazzino');
  app.project.getState().switchCanvas(second);
  app.network.getState().addDevice(makePc('B-1'));
  expect(app.network.getState().hasUnsavedChanges).toBe(true);
  return app;
}

/** The project a file on disk holds */
function fileProject(name = 'Sede Roma'): ProjectFile {
  return {
    format: 'pixelcake-project',
    version: 1,
    name,
    description: 'Da file',
    savedAt: '2026-11-10T08:00:00.000Z',
    settings: { ipClass: '10.0.0.0', subnet: '255.0.0.0', gateway: '10.0.0.1', emailMode: 'auto' },
    activeCanvasId: 'canvas-1',
    canvases: [
      {
        id: 'canvas-1',
        name: 'Roma',
        devices: [{ ...makePc('R-1'), id: 'dev-0' }],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        deviceCounter: 1,
        connectionCounter: 0,
      },
    ],
    templates: { devices: [], connections: [] },
  };
}

// ---------- fakes: File System Access API ----------

interface FakeDiskFile {
  name: string;
  /** What is on disk now */
  content: string;
  /** Every completed write, in order */
  writes: string[];
  handle: {
    name: string;
    getFile: Mock;
    createWritable: Mock;
  };
}

function diskFile(name: string, content = ''): FakeDiskFile {
  const file: FakeDiskFile = {
    name,
    content,
    writes: [],
    handle: {
      name,
      getFile: vi.fn(async () => new File([file.content], name, { type: 'application/json' })),
      createWritable: vi.fn(async () => {
        let buffer = '';
        return {
          write: async (data: string) => {
            buffer += data;
          },
          close: async () => {
            file.content = buffer;
            file.writes.push(buffer);
          },
        };
      }),
    },
  };
  return file;
}

/** Install showSaveFilePicker answering with the given files, one per call */
function savePicker(...files: FakeDiskFile[]): Mock {
  const picker = vi.fn();
  for (const file of files) picker.mockResolvedValueOnce(file.handle);
  vi.stubGlobal('showSaveFilePicker', picker);
  return picker;
}

function openPicker(...files: FakeDiskFile[]): Mock {
  const picker = vi.fn();
  for (const file of files) picker.mockResolvedValueOnce([file.handle]);
  vi.stubGlobal('showOpenFilePicker', picker);
  return picker;
}

function abortError(): DOMException {
  return new DOMException('The user aborted a request.', 'AbortError');
}

function projectIn(text: string): ProjectFile {
  const result = parseProjectFile(text);
  if (!result.ok) throw new Error(`not a project file: ${result.error}`);
  expect(result.warnings).toEqual([]);
  return result.project;
}

// ---------- fakes: fallback (download, file input) ----------

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

interface Download {
  fileName: string;
  blob: Blob;
}

/** jsdom has no object URLs and cannot navigate: capture what would be downloaded */
function captureDownloads(): Download[] {
  const downloads: Download[] = [];
  const blobs = new Map<string, Blob>();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((blob: Blob) => {
      const url = `blob:pixelcake-test/${blobs.size}`;
      blobs.set(url, blob);
      return url;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    const blob = blobs.get(this.href);
    if (!blob) throw new Error(`download of an unknown URL: ${this.href}`);
    downloads.push({ fileName: this.download, blob });
  });
  return downloads;
}

/** The user's answer to the file chooser of a file input: a file, or cancel */
function fileChooser(answer: File | null): HTMLInputElement[] {
  const inputs: HTMLInputElement[] = [];
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (
    this: HTMLInputElement
  ) {
    inputs.push(this);
    if (answer) {
      Object.defineProperty(this, 'files', { configurable: true, value: [answer] });
      this.dispatchEvent(new Event('change'));
    } else {
      this.dispatchEvent(new Event('cancel'));
    }
  });
  return inputs;
}

function jsonFile(project: ProjectFile | string, name = 'sede-roma.pixelcake.json'): File {
  const text = typeof project === 'string' ? project : serializeProject(project);
  return new File([text], name, { type: 'application/json' });
}

describe('project file access', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    document.body.innerHTML = '';
  });

  // ================= File System Access API =================

  describe('save, with the File System Access API', () => {
    it('the first save asks where, writes the whole project and clears the changed flag', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      const picker = savePicker(file);

      const outcome = await app.access.saveProject();

      expect(outcome).toBe('saved');
      expect(picker).toHaveBeenCalledTimes(1);
      expect(picker.mock.calls[0][0]).toMatchObject({
        suggestedName: 'sede-milano.pixelcake.json',
        types: [{ accept: { 'application/json': ['.json'] } }],
      });

      // the file holds every canvas, the one on screen included
      const saved = projectIn(file.content);
      expect(saved).toMatchObject({ name: 'Sede Milano', activeCanvasId: 'canvas-2' });
      expect(saved.canvases.map(c => [c.name, labels(c.devices)])).toEqual([
        ['Canvas 1', ['A-1']],
        ['Magazzino', ['B-1']],
      ]);
      // and it is exactly the documented text
      expect(file.content).toBe(serializeProject(saved));

      expect(app.network.getState().hasUnsavedChanges).toBe(false);
      expect(app.toast.success).toHaveBeenCalledTimes(1);
      expect(app.toast.success.mock.calls[0][0]).toBe('Progetto salvato su file');
      expect(app.toast.error).not.toHaveBeenCalled();
    });

    it('the next save writes the same file in place, without asking', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      const picker = savePicker(file);
      await app.access.saveProject();

      app.network.getState().addDevice(makePc('B-2'));
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
      const outcome = await app.access.saveProject();

      expect(outcome).toBe('saved');
      expect(picker).toHaveBeenCalledTimes(1);
      expect(file.writes).toHaveLength(2);
      expect(labels(projectIn(file.content).canvases[1].devices)).toEqual(['B-1', 'B-2']);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('"Salva con nome" always asks, and the file chosen becomes the one "Salva" writes', async () => {
      const app = await appWithProject();
      const first = diskFile('sede-milano.pixelcake.json');
      const copy = diskFile('copia.pixelcake.json');
      const picker = savePicker(first, copy);
      await app.access.saveProject();

      expect(await app.access.saveProjectAs()).toBe('saved');
      expect(picker).toHaveBeenCalledTimes(2);
      expect(copy.writes).toHaveLength(1);

      app.network.getState().addDevice(makePc('B-2'));
      await app.access.saveProject();

      expect(picker).toHaveBeenCalledTimes(2);
      expect(copy.writes).toHaveLength(2);
      expect(first.writes).toHaveLength(1);
    });

    it('cancelling the picker is not an error: no toast, nothing written, still changed', async () => {
      const app = await appWithProject();
      const picker = vi.fn().mockRejectedValue(abortError());
      vi.stubGlobal('showSaveFilePicker', picker);

      expect(await app.access.saveProject()).toBe('cancelled');
      expect(await app.access.saveProjectAs()).toBe('cancelled');

      expectNoToast(app);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
      expect(picker).toHaveBeenCalledTimes(2);
    });

    it('cancelling "Salva con nome" keeps the file of the session for "Salva"', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      const picker = savePicker(file);
      await app.access.saveProject();
      picker.mockRejectedValueOnce(abortError());

      expect(await app.access.saveProjectAs()).toBe('cancelled');
      app.network.getState().addDevice(makePc('B-2'));
      expect(await app.access.saveProject()).toBe('saved');

      expect(file.writes).toHaveLength(2);
      expect(picker).toHaveBeenCalledTimes(2);
    });

    it('a picker that fails for another reason is reported and leaves the project changed', async () => {
      const app = await appWithProject();
      vi.stubGlobal('showSaveFilePicker', vi.fn().mockRejectedValue(new Error('SecurityError')));

      expect(await app.access.saveProject()).toBe('failed');

      expect(app.toast.error).toHaveBeenCalledTimes(1);
      expect(app.toast.success).not.toHaveBeenCalled();
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('a write that fails is reported, keeps the flag, and the next save asks where again', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      const other = diskFile('altro.pixelcake.json');
      const picker = savePicker(file, other);
      await app.access.saveProject();
      app.network.getState().addDevice(makePc('B-2'));
      file.handle.createWritable.mockRejectedValueOnce(new Error('NotAllowedError'));

      expect(await app.access.saveProject()).toBe('failed');

      expect(app.toast.error).toHaveBeenCalledTimes(1);
      expect(app.toast.error.mock.calls[0][0]).toContain('sede-milano.pixelcake.json');
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
      expect(file.writes).toHaveLength(1);

      expect(await app.access.saveProject()).toBe('saved');
      expect(picker).toHaveBeenCalledTimes(2);
      expect(other.writes).toHaveLength(1);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('an edit made while the file is being written keeps the project marked as changed', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      savePicker(file);
      let finishWrite: () => void = () => {};
      let writing = false;
      file.handle.createWritable.mockImplementationOnce(async () => ({
        write: (data: string) =>
          new Promise<void>(resolve => {
            writing = true;
            finishWrite = () => {
              file.content = data;
              resolve();
            };
          }),
        close: async () => {
          file.writes.push(file.content);
        },
      }));

      const saving = app.access.saveProject();
      await vi.waitFor(() => expect(writing).toBe(true));
      app.network.getState().addDevice(makePc('B-2')); // not in the text being written
      finishWrite();

      expect(await saving).toBe('saved');
      expect(labels(projectIn(file.content).canvases[1].devices)).toEqual(['B-1']);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);

      // the next save carries it and the project is clean
      await app.access.saveProject();
      expect(labels(projectIn(file.content).canvases[1].devices)).toEqual(['B-1', 'B-2']);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('does not open a second picker while one is open', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      let choose: () => void = () => {};
      const picker = vi.fn(() => new Promise(resolve => (choose = () => resolve(file.handle))));
      vi.stubGlobal('showSaveFilePicker', picker);

      const first = app.access.saveProject();
      expect(await app.access.saveProject()).toBe('cancelled');
      choose();

      expect(await first).toBe('saved');
      expect(picker).toHaveBeenCalledTimes(1);
      expect(file.writes).toHaveLength(1);
    });

    it('saves the custom templates with the project', async () => {
      const app = await appWithProject();
      app.templates.getState().addTemplate({
        name: 'NVR',
        type: 'Server',
        icon: 'mdi:cctv',
        color: '#123456',
        isCustom: true,
        supportsVLAN: false,
        supportsSTP: false,
        supportsPorts: false,
        supportsNICs: true,
      });
      const file = diskFile('sede-milano.pixelcake.json');
      savePicker(file);

      await app.access.saveProject();

      expect(projectIn(file.content).templates.devices.map(t => t.name)).toEqual(['NVR']);
    });
  });

  describe('open, with the File System Access API', () => {
    it('replaces the whole project, hides the welcome screen and has nothing to save', async () => {
      const app = await loadApp();
      app.ui.getState().setShowWelcomeScreen(true);
      const file = diskFile('sede-roma.pixelcake.json', serializeProject(fileProject()));
      const picker = openPicker(file);

      const outcome = await app.access.openProject();

      expect(outcome).toBe('opened');
      expect(picker.mock.calls[0][0]).toMatchObject({
        multiple: false,
        types: [{ accept: { 'application/json': ['.json'] } }],
      });
      expect(app.project.getState()).toMatchObject({ name: 'Sede Roma', description: 'Da file' });
      expect(app.project.getState().canvases.map(c => c.name)).toEqual(['Roma']);
      expect(labels(app.network.getState().devices)).toEqual(['R-1']);
      expect(app.network.getState().globalNetworkSettings).toMatchObject({ ipClass: '10.0.0.0' });
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
      expect(app.ui.getState().showWelcomeScreen).toBe(false);
      expect(app.toast.success).toHaveBeenCalledTimes(1);
      expect(app.toast.success.mock.calls[0][0]).toBe('Progetto «Sede Roma» aperto');
      expect(app.toast.warning).not.toHaveBeenCalled();
    });

    it('remembers the file: "Salva" then writes back to it without asking', async () => {
      const app = await loadApp();
      const file = diskFile('sede-roma.pixelcake.json', serializeProject(fileProject()));
      openPicker(file);
      const savePickerMock = savePicker();
      await app.access.openProject();

      app.network.getState().addDevice(makePc('R-2'));
      expect(await app.access.saveProject()).toBe('saved');

      expect(savePickerMock).not.toHaveBeenCalled();
      expect(file.writes).toHaveLength(1);
      expect(labels(projectIn(file.content).canvases[0].devices)).toEqual(['R-1', 'R-2']);
    });

    it('shows what the parser had to repair in one toast', async () => {
      const app = await loadApp();
      const damaged = JSON.parse(serializeProject(fileProject())) as Record<string, unknown>;
      delete damaged.description;
      delete damaged.templates;
      damaged.activeCanvasId = 'canvas-99';
      openPicker(diskFile('sede-roma.pixelcake.json', JSON.stringify(damaged)));

      expect(await app.access.openProject()).toBe('opened');

      expect(app.toast.warning).toHaveBeenCalledTimes(1);
      const [title, options] = app.toast.warning.mock.calls[0];
      expect(title).toContain('Sede Roma');
      expect(options.description.split('\n')).toHaveLength(3);
      expect(app.toast.success).not.toHaveBeenCalled();
      expect(app.toast.error).not.toHaveBeenCalled();
      expect(labels(app.network.getState().devices)).toEqual(['R-1']);
    });

    it('cancelling the picker changes nothing and shows nothing', async () => {
      const app = await appWithProject();
      const before = app.project.getState().buildProjectFile().canvases;
      vi.stubGlobal('showOpenFilePicker', vi.fn().mockRejectedValue(abortError()));
      const asked = answerQuestions(app, false);

      expect(await app.access.openProject()).toBe('cancelled');

      expectNoToast(app);
      expect(asked).toEqual([]);
      expect(app.project.getState().name).toBe('Sede Milano');
      expect(app.project.getState().buildProjectFile().canvases).toEqual(before);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('a file that is not a project is refused with the reason, and nothing changes', async () => {
      const app = await appWithProject();
      openPicker(diskFile('appunti.json', '{"hello": "world"}'));
      const asked = answerQuestions(app, false);

      expect(await app.access.openProject()).toBe('failed');

      expect(app.toast.error).toHaveBeenCalledTimes(1);
      const [title, options] = app.toast.error.mock.calls[0];
      expect(title).toBe('Impossibile aprire «appunti.json»');
      expect(options.description).toContain('non è un progetto PixelCake');
      // nothing to lose yet: the question is not even asked
      expect(asked).toEqual([]);
      expect(app.project.getState().name).toBe('Sede Milano');
      expect(labels(app.network.getState().devices)).toEqual(['B-1']);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('with unsaved changes it asks first; declining changes nothing', async () => {
      const app = await appWithProject();
      const mine = diskFile('sede-milano.pixelcake.json');
      const picker = savePicker(mine);
      await app.access.saveProject(); // "Salva" now writes to mine
      app.network.getState().addDevice(makePc('B-2'));
      const before = app.project.getState().buildProjectFile().canvases;
      const other = diskFile('sede-roma.pixelcake.json', serializeProject(fileProject()));
      openPicker(other);
      const asked = answerQuestions(app, false);
      app.toast.success.mockClear();

      expect(await app.access.openProject()).toBe('cancelled');

      expect(asked).toHaveLength(1);
      expect(asked).toEqual([app.access.discardChangesQuestion()]);
      // it says what is lost, and its yes names what it does
      expect(asked[0].title).toBe('Continuare senza salvare?');
      expect(asked[0].detail).toContain('modifiche non ancora salvate su file');
      expect(asked[0]).toMatchObject({ confirmLabel: 'Continua senza salvare', danger: true });
      expect(app.project.getState().name).toBe('Sede Milano');
      expect(app.project.getState().buildProjectFile().canvases).toEqual(before);
      expect(labels(app.network.getState().devices)).toEqual(['B-1', 'B-2']);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
      expectNoToast(app);

      // and "Salva" still writes the project to its own file, not to the one declined
      await app.access.saveProject();
      expect(picker).toHaveBeenCalledTimes(1);
      expect(mine.writes).toHaveLength(2);
      expect(other.writes).toHaveLength(0);
    });

    it('with unsaved changes, accepting replaces the project', async () => {
      const app = await appWithProject();
      openPicker(diskFile('sede-roma.pixelcake.json', serializeProject(fileProject())));
      const asked = answerQuestions(app, true);

      expect(await app.access.openProject()).toBe('opened');

      expect(asked).toHaveLength(1);
      expect(app.project.getState().name).toBe('Sede Roma');
      expect(labels(app.network.getState().devices)).toEqual(['R-1']);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
    });

    it('without unsaved changes it does not ask', async () => {
      const app = await appWithProject();
      app.network.getState().markSaved();
      openPicker(diskFile('sede-roma.pixelcake.json', serializeProject(fileProject())));
      const asked = answerQuestions(app, false);

      expect(await app.access.openProject()).toBe('opened');

      expect(asked).toEqual([]);
      expect(app.project.getState().name).toBe('Sede Roma');
    });

    it('opening another file makes that one the target of "Salva"', async () => {
      const app = await loadApp();
      const roma = diskFile('sede-roma.pixelcake.json', serializeProject(fileProject('Sede Roma')));
      const bari = diskFile('sede-bari.pixelcake.json', serializeProject(fileProject('Sede Bari')));
      openPicker(roma, bari);
      savePicker();
      await app.access.openProject();
      await app.access.openProject();

      app.project.getState().setDescription('Modificato');
      await app.access.saveProject();

      expect(roma.writes).toHaveLength(0);
      expect(bari.writes).toHaveLength(1);
      expect(projectIn(bari.content)).toMatchObject({
        name: 'Sede Bari',
        description: 'Modificato',
      });
    });

    it('brings the custom templates of the file along', async () => {
      const app = await loadApp();
      const project = fileProject();
      project.templates.devices = [
        {
          id: 'tpl-1700000000000',
          name: 'NVR',
          type: 'Server',
          icon: 'mdi:cctv',
          color: '#123456',
          isCustom: true,
          supportsVLAN: false,
          supportsSTP: false,
          supportsPorts: false,
          supportsNICs: true,
        },
      ];
      openPicker(diskFile('sede-roma.pixelcake.json', serializeProject(project)));

      await app.access.openProject();

      expect(app.templates.getState().getTemplate('tpl-1700000000000')?.name).toBe('NVR');
    });
  });

  // ================= fallback =================

  describe('save, without the File System Access API', () => {
    it('downloads the project as <name>.pixelcake.json and clears the changed flag', async () => {
      const app = await appWithProject();
      const downloads = captureDownloads();

      const outcome = await app.access.saveProject();

      expect(outcome).toBe('downloaded');
      expect(downloads).toHaveLength(1);
      expect(downloads[0].fileName).toBe('sede-milano.pixelcake.json');
      const saved = projectIn(await readBlob(downloads[0].blob));
      expect(saved.canvases.map(c => [c.name, labels(c.devices)])).toEqual([
        ['Canvas 1', ['A-1']],
        ['Magazzino', ['B-1']],
      ]);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
      // the toast says it was downloaded, and under which name
      expect(app.toast.success).toHaveBeenCalledTimes(1);
      expect(app.toast.success.mock.calls[0][0]).toBe(
        'Progetto scaricato come sede-milano.pixelcake.json'
      );
      // nothing is left in the page
      expect(document.querySelector('a[download]')).toBeNull();
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('"Salva con nome" downloads too, and every save is a new download', async () => {
      const app = await appWithProject();
      const downloads = captureDownloads();

      expect(await app.access.saveProjectAs()).toBe('downloaded');
      app.project.getState().renameProject('???');
      expect(await app.access.saveProject()).toBe('downloaded');

      expect(downloads.map(d => d.fileName)).toEqual([
        'sede-milano.pixelcake.json',
        'progetto.pixelcake.json',
      ]);
    });

    it('the API is looked up at every call: remove it and the next save downloads', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      savePicker(file);
      expect(await app.access.saveProject()).toBe('saved');

      vi.unstubAllGlobals();
      const downloads = captureDownloads();
      app.network.getState().addDevice(makePc('B-2'));

      expect(await app.access.saveProject()).toBe('downloaded');
      expect(downloads).toHaveLength(1);
      expect(file.writes).toHaveLength(1);
    });
  });

  describe('open, without the File System Access API', () => {
    it('asks through a hidden file input accepting .json and replaces the project', async () => {
      const app = await loadApp();
      app.ui.getState().setShowWelcomeScreen(true);
      const inputs = fileChooser(jsonFile(fileProject()));

      const outcome = await app.access.openProject();

      expect(outcome).toBe('opened');
      expect(inputs).toHaveLength(1);
      expect(inputs[0].type).toBe('file');
      expect(inputs[0].accept).toContain('.json');
      expect(inputs[0].style.display).toBe('none');
      expect(app.project.getState().name).toBe('Sede Roma');
      expect(labels(app.network.getState().devices)).toEqual(['R-1']);
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
      expect(app.ui.getState().showWelcomeScreen).toBe(false);
      // the input does not stay in the page
      expect(document.querySelector('input[type="file"]')).toBeNull();
    });

    it('cancelling the chooser changes nothing and shows nothing', async () => {
      const app = await appWithProject();
      fileChooser(null);

      expect(await app.access.openProject()).toBe('cancelled');

      expectNoToast(app);
      expect(app.project.getState().name).toBe('Sede Milano');
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
      expect(document.querySelector('input[type="file"]')).toBeNull();
    });

    it('with unsaved changes, declining the confirmation changes nothing', async () => {
      const app = await appWithProject();
      fileChooser(jsonFile(fileProject()));
      const asked = answerQuestions(app, false);

      expect(await app.access.openProject()).toBe('cancelled');

      expect(asked).toEqual([app.access.discardChangesQuestion()]);
      expect(app.project.getState().name).toBe('Sede Milano');
      expect(labels(app.network.getState().devices)).toEqual(['B-1']);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('a file that is not JSON is refused with the reason', async () => {
      const app = await appWithProject();
      fileChooser(jsonFile('not json at all', 'rotto.json'));

      expect(await app.access.openProject()).toBe('failed');

      expect(app.toast.error.mock.calls[0][1].description).toBe('Il file non è un JSON valido.');
      expect(app.project.getState().name).toBe('Sede Milano');
    });

    it('a project opened this way has no file to write back to: "Salva" downloads', async () => {
      const app = await loadApp();
      fileChooser(jsonFile(fileProject()));
      await app.access.openProject();
      const downloads = captureDownloads();

      app.network.getState().addDevice(makePc('R-2'));
      expect(await app.access.saveProject()).toBe('downloaded');

      expect(downloads[0].fileName).toBe('sede-roma.pixelcake.json');
    });

    it('a chooser left without an answer does not block the next one', async () => {
      const app = await loadApp();
      // first chooser: dismissed by a browser that fires no event at all
      vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementationOnce(() => {});
      const abandoned = app.access.openProject();

      vi.restoreAllMocks();
      fileChooser(jsonFile(fileProject()));
      expect(await app.access.openProject()).toBe('opened');

      expect(await abandoned).toBe('cancelled');
      expect(document.querySelectorAll('input[type="file"]')).toHaveLength(0);
    });
  });

  // ================= new project =================

  describe('new project', () => {
    it('with unsaved changes it asks first; declining leaves everything, the form does not open', async () => {
      const app = await appWithProject();
      const asked = answerQuestions(app, false);

      expect(await app.access.requestNewProject()).toBe(false);

      expect(asked).toEqual([app.access.discardChangesQuestion()]);
      expect(app.ui.getState().modals.newProject).toBe(false);
      expect(app.project.getState().name).toBe('Sede Milano');
      expect(labels(app.network.getState().devices)).toEqual(['B-1']);
      expect(app.network.getState().hasUnsavedChanges).toBe(true);
    });

    it('accepting opens the form; the project is only replaced when the form is confirmed', async () => {
      const app = await appWithProject();
      answerQuestions(app, true);

      expect(await app.access.requestNewProject()).toBe(true);

      expect(app.ui.getState().modals.newProject).toBe(true);
      expect(app.project.getState().name).toBe('Sede Milano');
      expect(labels(app.network.getState().devices)).toEqual(['B-1']);
    });

    it('without unsaved changes it does not ask', async () => {
      const app = await loadApp();
      const asked = answerQuestions(app, false);

      expect(await app.access.requestNewProject()).toBe(true);

      expect(asked).toEqual([]);
      expect(app.ui.getState().modals.newProject).toBe(true);
    });

    it('createNewProject replaces the project, hides the welcome screen and forgets the file', async () => {
      const app = await appWithProject();
      app.ui.getState().setShowWelcomeScreen(true);
      const old = diskFile('sede-milano.pixelcake.json');
      const fresh = diskFile('sede-bari.pixelcake.json');
      const picker = savePicker(old, fresh);
      await app.access.saveProject();

      app.access.createNewProject({
        name: 'Sede Bari',
        description: 'Nuova',
        settings: { ipClass: '172.16.0.0', subnet: '255.255.0.0', gateway: '172.16.0.1' },
      });

      expect(app.project.getState()).toMatchObject({ name: 'Sede Bari', description: 'Nuova' });
      expect(app.project.getState().canvases).toHaveLength(1);
      expect(app.network.getState().devices).toEqual([]);
      expect(app.network.getState().globalNetworkSettings.ipClass).toBe('172.16.0.0');
      expect(app.network.getState().hasUnsavedChanges).toBe(false);
      expect(app.ui.getState().showWelcomeScreen).toBe(false);

      // the new project must not overwrite the file of the old one
      await app.access.saveProject();
      expect(picker).toHaveBeenCalledTimes(2);
      expect(picker.mock.calls[1][0].suggestedName).toBe('sede-bari.pixelcake.json');
      expect(old.writes).toHaveLength(1);
      expect(projectIn(old.content).name).toBe('Sede Milano');
      expect(projectIn(fresh.content).name).toBe('Sede Bari');
    });
  });

  // ================= Ctrl+S =================

  describe('Ctrl+S', () => {
    function press(init: KeyboardEventInit): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      document.body.dispatchEvent(event);
      return event;
    }

    it('saves the project from anywhere and keeps the browser from saving the page', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      savePicker(file);
      const unregister = app.access.registerSaveShortcut();

      const event = press({ key: 's', ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(file.writes).toHaveLength(1));
      await vi.waitFor(() => expect(app.network.getState().hasUnsavedChanges).toBe(false));
      unregister();
    });

    it('works with Cmd+S and with caps lock, from inside a text field too', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      savePicker(file);
      const unregister = app.access.registerSaveShortcut();
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'S',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(file.writes).toHaveLength(1));
      unregister();
    });

    it('works on a keyboard whose letters are not Latin: the key of S', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      savePicker(file);
      const unregister = app.access.registerSaveShortcut();

      // a Russian layout: the key of S writes «ы»
      const event = press({ key: 'ы', code: 'KeyS', ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(file.writes).toHaveLength(1));
      unregister();
    });

    it('ignores other keys and other combinations', async () => {
      const app = await appWithProject();
      const picker = savePicker();
      const unregister = app.access.registerSaveShortcut();

      const events = [
        press({ key: 's' }),
        press({ key: 'a', ctrlKey: true }),
        press({ key: 's', ctrlKey: true, shiftKey: true }),
        press({ key: 's', ctrlKey: true, altKey: true }),
      ];

      expect(events.map(e => e.defaultPrevented)).toEqual([false, false, false, false]);
      expect(picker).not.toHaveBeenCalled();
      unregister();
    });

    it('a key held down saves once', async () => {
      const app = await appWithProject();
      const file = diskFile('sede-milano.pixelcake.json');
      const picker = savePicker(file);
      const unregister = app.access.registerSaveShortcut();

      press({ key: 's', ctrlKey: true });
      const repeated = press({ key: 's', ctrlKey: true, repeat: true });

      expect(repeated.defaultPrevented).toBe(true);
      await vi.waitFor(() => expect(file.writes).toHaveLength(1));
      expect(picker).toHaveBeenCalledTimes(1);
      unregister();
    });

    it('stops listening once unregistered', async () => {
      const app = await appWithProject();
      const picker = savePicker();
      const unregister = app.access.registerSaveShortcut();
      unregister();

      const event = press({ key: 's', ctrlKey: true });

      expect(event.defaultPrevented).toBe(false);
      expect(picker).not.toHaveBeenCalled();
    });
  });
});
