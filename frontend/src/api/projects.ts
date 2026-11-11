/**
 * Projects API
 * Functions for managing network topology projects
 */

import { apiClient } from './client';
import {
  type ProjectCreate,
  type ProjectUpdate,
  type ProjectResponse,
  type ProjectList,
} from '../types/api';

/**
 * Get all projects for the current user
 * Returns list of projects with canvas count
 */
export async function listProjects(): Promise<ProjectList[]> {
  return apiClient.get<ProjectList[]>('/api/projects');
}

/**
 * Create a new project with a default canvas
 */
export async function createProject(data: ProjectCreate): Promise<ProjectResponse> {
  return apiClient.post<ProjectResponse>('/api/projects', data);
}

/**
 * Get a single project by ID with all canvases
 */
export async function getProject(projectId: string): Promise<ProjectResponse> {
  return apiClient.get<ProjectResponse>(`/api/projects/${projectId}`);
}

/**
 * Update project metadata (name, description, settings)
 */
export async function updateProject(
  projectId: string,
  data: ProjectUpdate
): Promise<ProjectResponse> {
  return apiClient.put<ProjectResponse>(`/api/projects/${projectId}`, data);
}

/**
 * Delete a project (cascade deletes all canvases)
 */
export async function deleteProject(projectId: string): Promise<void> {
  return apiClient.delete<void>(`/api/projects/${projectId}`);
}
