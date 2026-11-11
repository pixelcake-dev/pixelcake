/**
 * Project Types
 * A project is a named set of canvases kept in the browser and saved to /
 * opened from a `.pixelcake.json` file (see docs/project-file.md).
 */

import type {
  ConnectionTemplate,
  DeviceTemplate,
  GlobalNetworkSettings,
  NetworkConnection,
  NetworkDevice,
} from './network';

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Everything one canvas draws: what the network store holds for the canvas on screen */
export interface CanvasData {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  viewport: CanvasViewport;
  /** Number used by the next `dev-N` id */
  deviceCounter: number;
  /** Number used by the next `conn-N` id */
  connectionCounter: number;
}

/** A canvas as kept in the project (and in the project file) */
export interface StoredCanvas extends CanvasData {
  id: string;
  name: string;
}

/** Custom templates travelling with a project, so it opens correctly elsewhere */
export interface ProjectTemplates {
  devices: DeviceTemplate[];
  connections: ConnectionTemplate[];
}

export const PROJECT_FILE_FORMAT = 'pixelcake-project';
export const PROJECT_FILE_VERSION = 1;

/** The content of a `.pixelcake.json` file, version 1 */
export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT;
  version: typeof PROJECT_FILE_VERSION;
  name: string;
  description: string;
  /** ISO 8601 timestamp of the save */
  savedAt: string;
  settings: GlobalNetworkSettings;
  activeCanvasId: string;
  canvases: StoredCanvas[];
  templates: ProjectTemplates;
}
