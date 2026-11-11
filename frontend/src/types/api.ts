/**
 * API Types
 * TypeScript interfaces matching backend Pydantic schemas
 */

import { type NetworkDevice, type NetworkConnection } from './network';

/**
 * API Response wrapper for errors
 */
export interface APIError {
  detail: string;
}

/**
 * Project Types
 */

export interface ProjectCreate {
  name: string;
  description?: string;
  global_settings?: {
    ipClass: string;
    subnet: string;
    gateway: string;
  };
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  global_settings?: {
    ipClass: string;
    subnet: string;
    gateway: string;
  };
  is_public?: boolean;
}

export interface CanvasBasic {
  id: string;
  name: string;
  order: number;
  is_locked: boolean;
  devices_count: number;
  connections_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectResponse {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  version: string;
  is_public: boolean;
  global_settings: {
    ipClass: string;
    subnet: string;
    gateway: string;
  };
  canvases: CanvasBasic[];
  created_at: string;
  updated_at: string;
  last_accessed: string;
}

export interface ProjectList {
  id: string;
  name: string;
  description: string | null;
  version: string;
  canvases_count: number;
  created_at: string;
  updated_at: string;
  last_accessed: string;
}

/**
 * Canvas Types
 */

export interface CanvasSettings {
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  deviceCounter: number;
  connectionCounter: number;
}

export interface CanvasCreate {
  name: string;
  order?: number;
  is_locked?: boolean;
  settings?: CanvasSettings;
  devices?: NetworkDevice[];
  connections?: NetworkConnection[];
}

export interface CanvasUpdate {
  name?: string;
  order?: number;
  is_locked?: boolean;
  settings?: CanvasSettings;
  devices?: NetworkDevice[];
  connections?: NetworkConnection[];
}

export interface CanvasResponse {
  id: string;
  project_id: string;
  name: string;
  order: number;
  is_locked: boolean;
  settings: CanvasSettings;
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  created_at: string;
  updated_at: string;
}

export interface CanvasList {
  id: string;
  project_id: string;
  name: string;
  order: number;
  is_locked: boolean;
  devices_count: number;
  connections_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Template Types
 */

export interface DeviceTemplateData {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  terraformFields?: Record<string, string | number | boolean>;
  isCustom: boolean;
  supportsVLAN: boolean;
  supportsSTP: boolean;
  supportsPorts: boolean;
  supportsNICs: boolean;
  portOptions?: number[];
  defaultPortCount?: number;
}

export interface DeviceTemplateCreate {
  template: DeviceTemplateData;
}

export interface DeviceTemplateUpdate {
  template: DeviceTemplateData;
}

export interface DeviceTemplateResponse {
  id: string;
  user_id: string | null;
  is_custom: boolean;
  template: DeviceTemplateData;
  created_at: string;
}

export interface ConnectionTemplateData {
  id: string;
  name: string;
  type: string;
  description?: string;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  strokeWidth: number;
  strokeWidthHighlighted?: number;
  strokeDasharray?: string;
  isCustom: boolean;
}

export interface ConnectionTemplateCreate {
  template: ConnectionTemplateData;
}

export interface ConnectionTemplateUpdate {
  template: ConnectionTemplateData;
}

export interface ConnectionTemplateResponse {
  id: string;
  user_id: string | null;
  is_custom: boolean;
  template: ConnectionTemplateData;
  created_at: string;
}

export interface TemplateSyncRequest {
  deviceTemplates: DeviceTemplateData[];
  connectionTemplates: ConnectionTemplateData[];
}

export interface TemplateSyncResponse {
  deviceTemplates: DeviceTemplateResponse[];
  connectionTemplates: ConnectionTemplateResponse[];
  message: string;
}
