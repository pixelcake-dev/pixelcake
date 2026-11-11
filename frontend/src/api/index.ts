/**
 * API Module
 * Centralized exports for all API functions
 */

// Client
export { apiClient, API_BASE_URL, HTTPError } from './client';

// Error helpers
export { friendlyApiError, BACKEND_UNREACHABLE_MESSAGE } from './errors';

// Projects API
export {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
} from './projects';

// Canvases API
export {
  listCanvases,
  createCanvas,
  getCanvas,
  updateCanvas,
  deleteCanvas,
} from './canvases';

// Templates API
export {
  listDeviceTemplates,
  createDeviceTemplate,
  updateDeviceTemplate,
  deleteDeviceTemplate,
  listConnectionTemplates,
  createConnectionTemplate,
  updateConnectionTemplate,
  deleteConnectionTemplate,
  syncTemplates,
} from './templates';

// Re-export types for convenience
export type {
  ProjectCreate,
  ProjectUpdate,
  ProjectResponse,
  ProjectList,
  CanvasCreate,
  CanvasUpdate,
  CanvasResponse,
  CanvasList,
  CanvasBasic,
  CanvasSettings,
  DeviceTemplateData,
  DeviceTemplateCreate,
  DeviceTemplateUpdate,
  DeviceTemplateResponse,
  ConnectionTemplateData,
  ConnectionTemplateCreate,
  ConnectionTemplateUpdate,
  ConnectionTemplateResponse,
  TemplateSyncRequest,
  TemplateSyncResponse,
  APIError,
} from '../types/api';
