/**
 * Templates API
 * Functions for managing device and connection templates
 */

import { apiClient } from './client';
import {
  type DeviceTemplateResponse,
  type DeviceTemplateCreate,
  type DeviceTemplateUpdate,
  type ConnectionTemplateResponse,
  type ConnectionTemplateCreate,
  type ConnectionTemplateUpdate,
  type TemplateSyncRequest,
  type TemplateSyncResponse,
} from '../types/api';

/**
 * Device Templates
 */

/**
 * Get all device templates (global + user custom)
 * Returns list of device templates ordered by global first, then custom
 */
export async function listDeviceTemplates(): Promise<DeviceTemplateResponse[]> {
  return apiClient.get<DeviceTemplateResponse[]>('/api/templates/devices');
}

/**
 * Create a new custom device template
 * Only custom templates (isCustom=true) can be created via API
 */
export async function createDeviceTemplate(
  data: DeviceTemplateCreate
): Promise<DeviceTemplateResponse> {
  return apiClient.post<DeviceTemplateResponse>('/api/templates/devices', data);
}

/**
 * Update an existing device template
 * Only custom templates owned by user can be updated
 */
export async function updateDeviceTemplate(
  templateId: string,
  data: DeviceTemplateUpdate
): Promise<DeviceTemplateResponse> {
  return apiClient.put<DeviceTemplateResponse>(`/api/templates/devices/${templateId}`, data);
}

/**
 * Delete a device template
 * Only custom templates owned by user can be deleted
 */
export async function deleteDeviceTemplate(templateId: string): Promise<void> {
  return apiClient.delete<void>(`/api/templates/devices/${templateId}`);
}

/**
 * Connection Templates
 */

/**
 * Get all connection templates (global + user custom)
 * Returns list of connection templates ordered by global first, then custom
 */
export async function listConnectionTemplates(): Promise<ConnectionTemplateResponse[]> {
  return apiClient.get<ConnectionTemplateResponse[]>('/api/templates/connections');
}

/**
 * Create a new custom connection template
 * Only custom templates (isCustom=true) can be created via API
 */
export async function createConnectionTemplate(
  data: ConnectionTemplateCreate
): Promise<ConnectionTemplateResponse> {
  return apiClient.post<ConnectionTemplateResponse>('/api/templates/connections', data);
}

/**
 * Update an existing connection template
 * Only custom templates owned by user can be updated
 */
export async function updateConnectionTemplate(
  templateId: string,
  data: ConnectionTemplateUpdate
): Promise<ConnectionTemplateResponse> {
  return apiClient.put<ConnectionTemplateResponse>(`/api/templates/connections/${templateId}`, data);
}

/**
 * Delete a connection template
 * Only custom templates owned by user can be deleted
 */
export async function deleteConnectionTemplate(templateId: string): Promise<void> {
  return apiClient.delete<void>(`/api/templates/connections/${templateId}`);
}

/**
 * Bulk Sync
 */

/**
 * Sync all templates (upsert)
 * Used for migrating custom templates from LocalStorage to database
 * Only syncs custom templates (isCustom=true), skips global templates
 */
export async function syncTemplates(data: TemplateSyncRequest): Promise<TemplateSyncResponse> {
  return apiClient.post<TemplateSyncResponse>('/api/templates/sync', data);
}
