/**
 * Canvases API
 * Functions for managing canvases within projects
 */

import { apiClient } from './client';
import {
  type CanvasCreate,
  type CanvasUpdate,
  type CanvasResponse,
  type CanvasList,
} from '../types/api';

/**
 * Get all canvases for a project
 * Returns list without full devices/connections data
 */
export async function listCanvases(projectId: string): Promise<CanvasList[]> {
  return apiClient.get<CanvasList[]>(`/api/projects/${projectId}/canvases`);
}

/**
 * Create a new canvas in the project
 */
export async function createCanvas(
  projectId: string,
  data: CanvasCreate
): Promise<CanvasResponse> {
  return apiClient.post<CanvasResponse>(`/api/projects/${projectId}/canvases`, data);
}

/**
 * Get a single canvas by ID with full data (devices, connections)
 */
export async function getCanvas(
  projectId: string,
  canvasId: string
): Promise<CanvasResponse> {
  return apiClient.get<CanvasResponse>(`/api/projects/${projectId}/canvases/${canvasId}`);
}

/**
 * Update canvas data (name, devices, connections, settings)
 * `keepalive` lets the request outlive the page (used on tab close)
 */
export async function updateCanvas(
  projectId: string,
  canvasId: string,
  data: CanvasUpdate,
  options?: { keepalive?: boolean }
): Promise<CanvasResponse> {
  return apiClient.put<CanvasResponse>(
    `/api/projects/${projectId}/canvases/${canvasId}`,
    data,
    options
  );
}

/**
 * Delete a canvas from the project
 * Note: Cannot delete the last canvas in a project (minimum 1 required)
 */
export async function deleteCanvas(projectId: string, canvasId: string): Promise<void> {
  return apiClient.delete<void>(`/api/projects/${projectId}/canvases/${canvasId}`);
}
