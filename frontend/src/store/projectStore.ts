/**
 * Project Store
 * The one project open in the browser: its name, description and canvases.
 *
 * The canvas on screen lives in networkStore. Its entry in `canvases` is only
 * refreshed when it is committed (canvas switch, building the project file),
 * so whatever needs the whole project goes through buildProjectFile().
 * The dependency goes one way: this store drives networkStore, never the
 * other way round.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlobalNetworkSettings, ProjectFile, StoredCanvas } from '@/types';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import {
  createEmptyCanvas,
  DEFAULT_NETWORK_SETTINGS,
  defaultProjectName,
  nextCanvasId,
} from '@/utils/projectFile';
import { safeJSONStorage } from '@/utils/safeStorage';
import { getT } from '@/i18n';
import { useNetworkStore } from './networkStore';
import { useSimulationStore } from './simulationStore';
import { clearHistory, forgetCanvasHistory, nameUnnamedBoard } from './historyStore';
import { useTemplateStore } from './templateStore';

export interface NewProjectInput {
  name: string;
  description?: string;
  settings?: Partial<GlobalNetworkSettings>;
}

interface ProjectStore {
  // State
  name: string;
  description: string;
  canvases: StoredCanvas[];
  activeCanvasId: string;

  // Actions - Project
  /** Start an empty project (one empty canvas), replacing the open one */
  createProject: (input: NewProjectInput) => void;
  /** Replace the open project with one read from a file */
  loadProject: (project: ProjectFile) => void;
  renameProject: (name: string) => void;
  setDescription: (description: string) => void;

  // Actions - Canvases
  /** Add an empty canvas (without switching to it) and return its id */
  addCanvas: (name?: string) => string;
  renameCanvas: (canvasId: string, name: string) => void;
  /**
   * A copy of a canvas, right after it, named «<name> (copia)»: everything on
   * it (devices, cables, areas, notes, the view), and nothing shared with the
   * original. It does not switch to it. The id of the new canvas, or null
   * when there is no such canvas
   */
  duplicateCanvas: (canvasId: string) => string | null;
  /** False when refused: the last canvas of a project cannot be deleted */
  deleteCanvas: (canvasId: string) => boolean;
  switchCanvas: (canvasId: string) => void;

  // Actions - Whole project
  /** Write the canvas on screen into its entry of `canvases` */
  commitActiveCanvas: () => void;
  /** The complete project, canvas on screen included, as it goes in a file */
  buildProjectFile: () => ProjectFile;
}

/** What is written to localStorage */
type PersistedProjectState = Pick<
  ProjectStore,
  'name' | 'description' | 'canvases' | 'activeCanvasId'
>;

const FIRST_CANVAS_ID = 'canvas-1';

/**
 * The name of a canvas nobody named, by its number. Like every name the app
 * gives, it is in the language of the moment it is given in, and from then
 * on it is the canvas's own: it does not follow the language.
 */
function canvasName(number: number): string {
  return getT().project.canvasName(number);
}

function firstCanvasName(): string {
  return canvasName(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredCanvas(value: unknown): value is StoredCanvas {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.devices) &&
    Array.isArray(value.connections) &&
    isRecord(value.viewport) &&
    typeof value.deviceCounter === 'number' &&
    typeof value.connectionCounter === 'number'
  );
}

/** The project found in localStorage, or null when it cannot be used */
function readPersistedProject(value: unknown): PersistedProjectState | null {
  if (!isRecord(value) || !Array.isArray(value.canvases)) return null;
  const canvases = value.canvases.filter(isStoredCanvas);
  if (canvases.length === 0) return null;
  const activeCanvasId = canvases.some(canvas => canvas.id === value.activeCanvasId)
    ? (value.activeCanvasId as string)
    : canvases[0].id;
  return {
    name: typeof value.name === 'string' && value.name ? value.name : defaultProjectName(),
    description: typeof value.description === 'string' ? value.description : '',
    canvases,
    activeCanvasId,
  };
}

/** True when localStorage held no project at start-up (see adoptLiveCanvas) */
let nothingStored = false;

function stopSimulation() {
  // A running packet belongs to the canvas that is going away
  useSimulationStore.getState().resetSimulation();
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      // Initial State: there is always a project
      name: defaultProjectName(),
      description: '',
      canvases: [createEmptyCanvas(FIRST_CANVAS_ID, firstCanvasName())],
      activeCanvasId: FIRST_CANVAS_ID,

      // Project Actions
      createProject: ({ name, description = '', settings }) => {
        const canvas = createEmptyCanvas(FIRST_CANVAS_ID, firstCanvasName());
        stopSimulation();
        set({
          name: name.trim() || defaultProjectName(),
          description: description.trim(),
          canvases: [canvas],
          activeCanvasId: canvas.id,
        });
        const network = useNetworkStore.getState();
        network.replaceCanvas(canvas.id, canvas, { ...DEFAULT_NETWORK_SETTINGS, ...settings });
        network.markSaved();
        // (nothing of another project is undone over this one)
        clearHistory();
      },

      loadProject: project => {
        const active =
          project.canvases.find(canvas => canvas.id === project.activeCanvasId) ??
          project.canvases[0];
        stopSimulation();
        // Templates first: the devices about to be drawn may use them
        useTemplateStore
          .getState()
          .addMissingTemplates(project.templates.devices, project.templates.connections);
        set({
          name: project.name,
          description: project.description,
          canvases: project.canvases,
          activeCanvasId: active.id,
        });
        const network = useNetworkStore.getState();
        network.replaceCanvas(active.id, active, project.settings);
        network.markSaved();
        clearHistory();
      },

      renameProject: name => {
        const next = name.trim();
        if (!next || next === get().name) return;
        set({ name: next });
        useNetworkStore.getState().markChanged();
      },

      setDescription: description => {
        const next = description.trim();
        if (next === get().description) return;
        set({ description: next });
        useNetworkStore.getState().markChanged();
      },

      // Canvas Actions
      addCanvas: name => {
        const { canvases } = get();
        const id = nextCanvasId(canvases.map(canvas => canvas.id));
        const label = name?.trim() || canvasName(Number(id.slice('canvas-'.length)));
        set({ canvases: [...canvases, createEmptyCanvas(id, label)] });
        useNetworkStore.getState().markChanged();
        return id;
      },

      renameCanvas: (canvasId, name) => {
        const next = name.trim();
        const canvas = get().canvases.find(c => c.id === canvasId);
        if (!canvas || !next || next === canvas.name) return;
        set(state => ({
          canvases: state.canvases.map(c => (c.id === canvasId ? { ...c, name: next } : c)),
        }));
        useNetworkStore.getState().markChanged();
      },

      duplicateCanvas: canvasId => {
        // (the canvas on screen is copied as it is now, not as it was last committed)
        if (canvasId === get().activeCanvasId) get().commitActiveCanvas();
        const { canvases } = get();
        const index = canvases.findIndex(canvas => canvas.id === canvasId);
        if (index === -1) return null;
        const id = nextCanvasId(canvases.map(canvas => canvas.id));
        const names = new Set(canvases.map(canvas => canvas.name));
        let copies = 1;
        while (names.has(getT().project.copyName(canvases[index].name, copies))) copies++;
        // (a deep copy: an edit of one never reaches the other)
        const copy: StoredCanvas = {
          ...(JSON.parse(JSON.stringify(canvases[index])) as StoredCanvas),
          id,
          name: getT().project.copyName(canvases[index].name, copies),
        };
        set({ canvases: [...canvases.slice(0, index + 1), copy, ...canvases.slice(index + 1)] });
        useNetworkStore.getState().markChanged();
        return id;
      },

      deleteCanvas: canvasId => {
        const { canvases, activeCanvasId } = get();
        const index = canvases.findIndex(canvas => canvas.id === canvasId);
        if (index === -1 || canvases.length <= 1) return false;

        const remaining = canvases.filter(canvas => canvas.id !== canvasId);
        const network = useNetworkStore.getState();
        if (canvasId === activeCanvasId) {
          // The canvas on screen is the one going away: it is dropped, not
          // committed, and its neighbour takes its place
          const next = remaining[Math.max(0, index - 1)];
          stopSimulation();
          set({ canvases: remaining, activeCanvasId: next.id });
          network.replaceCanvas(next.id, next);
        } else {
          set({ canvases: remaining });
        }
        // (its steps go with it: a canvas added later may get its id)
        forgetCanvasHistory(canvasId);
        network.markChanged();
        return true;
      },

      switchCanvas: canvasId => {
        if (canvasId === get().activeCanvasId) return;
        if (!get().canvases.some(canvas => canvas.id === canvasId)) return;

        // 1. what is on screen goes back into its own entry
        get().commitActiveCanvas();
        // 2. the target comes on screen (read after the commit: fresh entries)
        const target = get().canvases.find(canvas => canvas.id === canvasId);
        if (!target) return;
        stopSimulation();
        set({ activeCanvasId: canvasId });
        useNetworkStore.getState().replaceCanvas(canvasId, target);
      },

      // Whole project
      commitActiveCanvas: () => {
        const network = useNetworkStore.getState();
        const { canvases, activeCanvasId } = get();
        // The live canvas carries the id of the entry it belongs to (none on
        // a drawing older than projects: it is the active canvas then)
        const liveId = canvases.some(canvas => canvas.id === network.canvasId)
          ? network.canvasId
          : activeCanvasId;
        const snapshot = network.getCanvasSnapshot();
        set(state => ({
          canvases: state.canvases.map(canvas =>
            canvas.id === liveId ? { ...canvas, ...snapshot } : canvas
          ),
        }));
      },

      buildProjectFile: () => {
        get().commitActiveCanvas();
        const { name, description, canvases, activeCanvasId } = get();
        const { templates, connectionTemplates } = useTemplateStore.getState();
        return {
          format: PROJECT_FILE_FORMAT,
          version: PROJECT_FILE_VERSION,
          name,
          description,
          savedAt: new Date().toISOString(),
          settings: useNetworkStore.getState().globalNetworkSettings,
          activeCanvasId,
          canvases,
          templates: {
            devices: templates.filter(template => template.isCustom),
            connections: connectionTemplates.filter(template => template.isCustom),
          },
        };
      },
    }),
    {
      name: 'pixelcake-project-v1',
      storage: safeJSONStorage<PersistedProjectState>(),
      partialize: (state): PersistedProjectState => ({
        name: state.name,
        description: state.description,
        canvases: state.canvases,
        activeCanvasId: state.activeCanvasId,
      }),
      merge: (persisted, current) => {
        if (persisted === undefined) nothingStored = true;
        const saved = readPersistedProject(persisted);
        return saved ? { ...current, ...saved } : current;
      },
    }
  )
);

/**
 * Pair the project with the canvas on screen. Runs once at import: both
 * stores have been read from localStorage by then (it is synchronous).
 *
 * The two live under different keys, so they are matched through the canvas
 * id the network store keeps next to its data. Whatever happened to either
 * key (a write that failed, another tab), the canvas on screen is never
 * shown, or later committed, as a different canvas.
 */
function adoptLiveCanvas() {
  const network = useNetworkStore.getState();
  const project = useProjectStore.getState();
  const liveId = network.canvasId;

  if (nothingStored) {
    // First run with projects kept in the browser. A drawing made with an
    // earlier version is already in the network store (pixelcake-network-v2):
    // it simply is the content of the default project's only canvas. Nothing
    // is copied and nothing is cleared. It was never saved to a file, so it
    // counts as unsaved; the project is written once so this runs only once.
    if (network.devices.length > 0) network.markChanged();
    useProjectStore.setState(
      liveId === null || liveId === project.activeCanvasId
        ? {}
        : { canvases: [createEmptyCanvas(liveId, firstCanvasName())], activeCanvasId: liveId }
    );
    return;
  }

  if (liveId === null || liveId === project.activeCanvasId) return;

  if (project.canvases.some(canvas => canvas.id === liveId)) {
    useProjectStore.setState({ activeCanvasId: liveId });
    return;
  }

  // The project does not know this canvas (its own write was lost): keep the
  // drawing as a canvas of its own rather than passing it off as another one
  useProjectStore.setState({
    canvases: [
      ...project.canvases,
      { ...network.getCanvasSnapshot(), id: liveId, name: getT().project.recoveredCanvas },
    ],
    activeCanvasId: liveId,
  });
  network.markChanged();
}

adoptLiveCanvas();
// (a canvas on screen with no id of its own is the active one: its steps of
// undo are kept under that id, and found again after a switch of canvas)
nameUnnamedBoard(useProjectStore.getState().activeCanvasId);
