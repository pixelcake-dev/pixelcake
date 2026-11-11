/**
 * Project Store
 * Manages projects and canvases list
 */

import { create } from 'zustand';
import { toast } from 'sonner';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listCanvases,
  createCanvas,
  deleteCanvas,
  type ProjectList,
  type ProjectResponse,
  type CanvasList,
  type ProjectCreate,
  type CanvasCreate,
  friendlyApiError,
} from '@/api';

interface ProjectStore {
  // State
  projects: ProjectList[];
  currentProject: ProjectResponse | null;
  canvases: CanvasList[];
  isLoading: boolean;
  error: string | null;

  // Actions - Projects
  loadProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<ProjectResponse>;
  createNewProject: (data: ProjectCreate) => Promise<ProjectResponse>;
  updateCurrentProject: (name?: string, description?: string) => Promise<void>;
  deleteCurrentProject: () => Promise<void>;

  // Actions - Canvases
  loadCanvases: (projectId: string) => Promise<void>;
  createNewCanvas: (projectId: string, data: CanvasCreate) => Promise<void>;
  deleteCanvasById: (projectId: string, canvasId: string) => Promise<void>;

  // Actions - Utility
  clearError: () => void;
  closeProject: () => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectStore>()((set, get) => ({
  // Initial State
  projects: [],
  currentProject: null,
  canvases: [],
  isLoading: false,
  error: null,

  // Projects Actions
  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await listProjects();
      set({ projects, isLoading: false });
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to load projects');
      set({ error: errorMessage, isLoading: false });
      toast.error(`Impossibile caricare progetti: ${errorMessage}`);
      throw error;
    }
  },

  loadProject: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const project = await getProject(projectId);
      set({ currentProject: project, isLoading: false });
      return project;
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to load project');
      set({ error: errorMessage, isLoading: false });
      toast.error(`Impossibile caricare progetto: ${errorMessage}`);
      throw error;
    }
  },

  createNewProject: async (data: ProjectCreate) => {
    set({ isLoading: true, error: null });
    try {
      const project = await createProject(data);
      set({ currentProject: project, isLoading: false });
      // Refresh projects list
      await get().loadProjects();
      return project;
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to create project');
      set({ error: errorMessage, isLoading: false });
      toast.error(`Impossibile creare progetto: ${errorMessage}`);
      throw error;
    }
  },

  updateCurrentProject: async (name?: string, description?: string) => {
    const { currentProject } = get();
    if (!currentProject) {
      throw new Error('No current project');
    }

    set({ isLoading: true, error: null });
    try {
      const updated = await updateProject(currentProject.id, { name, description });
      set({ currentProject: updated, isLoading: false });
      // Refresh projects list
      await get().loadProjects();
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to update project');
      set({ error: errorMessage, isLoading: false });
      toast.error(`Impossibile aggiornare progetto: ${errorMessage}`);
      throw error;
    }
  },

  deleteCurrentProject: async () => {
    const { currentProject } = get();
    if (!currentProject) {
      throw new Error('No current project');
    }

    set({ isLoading: true, error: null });
    try {
      await deleteProject(currentProject.id);
      set({ currentProject: null, isLoading: false });
      // Refresh projects list
      await get().loadProjects();
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to delete project');
      set({ error: errorMessage, isLoading: false });
      toast.error(`Impossibile eliminare progetto: ${errorMessage}`);
      throw error;
    }
  },

  // Canvases Actions
  loadCanvases: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const canvases = await listCanvases(projectId);
      set({ canvases, isLoading: false });
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to load canvases');
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  createNewCanvas: async (projectId: string, data: CanvasCreate) => {
    set({ isLoading: true, error: null });
    try {
      await createCanvas(projectId, data);
      set({ isLoading: false });
      // Refresh canvases list
      await get().loadCanvases(projectId);
      // Refresh current project (to update canvases list)
      await get().loadProject(projectId);
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to create canvas');
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteCanvasById: async (projectId: string, canvasId: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteCanvas(projectId, canvasId);
      set({ isLoading: false });
      // Refresh canvases list
      await get().loadCanvases(projectId);
      // Refresh current project (to update canvases list)
      await get().loadProject(projectId);
    } catch (error) {
      const errorMessage = friendlyApiError(error, 'Failed to delete canvas');
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Utility Actions
  clearError: () => {
    set({ error: null });
  },

  /** Leave the current project without touching anything saved in it */
  closeProject: () => {
    set({ currentProject: null, canvases: [] });
  },

  reset: () => {
    set({
      projects: [],
      currentProject: null,
      canvases: [],
      isLoading: false,
      error: null,
    });
  },
}));
