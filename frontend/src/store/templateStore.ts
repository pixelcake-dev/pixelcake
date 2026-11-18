/**
 * Template Store
 * Manages device templates and connection templates
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeviceTemplate, ConnectionTemplate } from '@/types/network';
import { safeJSONStorage } from '@/utils/safeStorage';
import { dictionaryOf } from '@/i18n';

interface TemplateStore {
  // Device Templates State
  templates: DeviceTemplate[];

  // Connection Templates State
  connectionTemplates: ConnectionTemplate[];

  // Device Template Actions
  addTemplate: (template: Omit<DeviceTemplate, 'id'>) => void;
  updateTemplate: (id: string, updates: Partial<DeviceTemplate>) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => DeviceTemplate | undefined;
  loadDefaultTemplates: () => void;
  /**
   * Put back the built-in templates that are missing (deleted): each in its
   * place among the built-in ones. The ones that are there are not touched,
   * a built-in one the user edited as little as those the user made. Gives
   * how many were put back.
   */
  restoreDefaultTemplates: () => number;

  // Connection Template Actions
  addConnectionTemplate: (template: Omit<ConnectionTemplate, 'id'>) => void;
  updateConnectionTemplate: (id: string, updates: Partial<ConnectionTemplate>) => void;
  deleteConnectionTemplate: (id: string) => void;
  getConnectionTemplate: (id: string) => ConnectionTemplate | undefined;
  getConnectionTemplateByType: (type: string) => ConnectionTemplate | undefined;
  loadDefaultConnectionTemplates: () => void;

  /**
   * Add the templates that came with a project file and are not here yet.
   * Templates already present (same id; for connections also same type) are
   * never overwritten.
   */
  addMissingTemplates: (devices: DeviceTemplate[], connections: ConnectionTemplate[]) => void;
}

/** What is written to localStorage */
type PersistedTemplateState = Pick<TemplateStore, 'templates' | 'connectionTemplates'>;

// Default generic templates
const DEFAULT_TEMPLATES: DeviceTemplate[] = [
  {
    id: 'tpl-pc',
    name: 'PC',
    type: 'PC',
    icon: 'pc',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false, // PC does not support port management
    supportsNICs: true, // PC supports Network Interface Cards
  },
  {
    id: 'tpl-switch',
    name: 'Switch',
    type: 'Switch',
    icon: 'switch',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: true,
    supportsSTP: true,
    supportsPorts: true, // Port management enabled for switches
    supportsNICs: false, // Switch uses ports instead of NICs
    portOptions: [5, 8, 16, 24, 48], // Available port counts
    defaultPortCount: 24, // Default 24-port switch
  },
  {
    id: 'tpl-router',
    name: 'Router',
    type: 'Router',
    icon: 'router',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: true,
    supportsSTP: true,
    supportsPorts: true, // Router port management enabled
    supportsNICs: false, // Router uses ports instead of NICs
    portOptions: [2, 4, 8, 16], // Available port counts
    defaultPortCount: 8, // Default 8-port router
  },
  {
    id: 'tpl-server',
    name: 'Server',
    type: 'Server',
    icon: 'server',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false, // Server does not support port management
    supportsNICs: true, // Server supports Network Interface Cards
  },
  {
    id: 'tpl-firewall',
    name: 'Firewall',
    type: 'Firewall',
    icon: 'firewall',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: true,
    supportsSTP: true,
    supportsPorts: true, // Firewall port management enabled
    supportsNICs: false, // Firewall uses ports instead of NICs
    portOptions: [2, 4, 8, 16], // Available port counts
    defaultPortCount: 8, // Default 8-port firewall
  },
  {
    id: 'tpl-accesspoint',
    name: 'Access Point',
    type: 'AccessPoint',
    icon: 'access-point',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false, // Access Point does not support port management
    supportsNICs: true, // Access Point supports Network Interface Cards
  },
  {
    id: 'tpl-loadbalancer',
    name: 'Load Balancer',
    type: 'LoadBalancer',
    icon: 'load-balancer',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false, // Load Balancer does not support port management
    supportsNICs: true, // Load Balancer supports Network Interface Cards
  },
  {
    id: 'tpl-database',
    name: 'Database',
    type: 'Database',
    icon: 'database',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false, // Database does not support port management
    supportsNICs: true, // Database supports Network Interface Cards
  },
  {
    id: 'tpl-cloud',
    name: 'Cloud',
    type: 'Cloud',
    icon: 'cloud',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false, // Cloud does not support port management
    supportsNICs: true, // Cloud supports Network Interface Cards
  },
  // === Application servers (type: Server) ===
  {
    id: 'tpl-mailserver',
    name: 'Mail Server',
    type: 'Server', // Base type: Server
    icon: 'server-mail',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-vps',
    name: 'VPS',
    type: 'Server', // Base type: Server
    icon: 'server-vps',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-webserver',
    name: 'Web Server',
    type: 'Server', // Base type: Server
    icon: 'server-web',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-proxy',
    name: 'Proxy Server',
    type: 'Server', // Base type: Server
    icon: 'server-proxy',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  // === Storage (type: Database) ===
  {
    id: 'tpl-storage-s3',
    name: 'Storage S3',
    type: 'Database', // Base type: Database
    icon: 'storage-s3',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-nas',
    name: 'NAS',
    type: 'Database', // Base type: Database
    icon: 'nas',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  // === Network Services (type: Server) ===
  {
    id: 'tpl-dnsserver',
    name: 'DNS Server',
    type: 'Server', // Base type: Server
    icon: 'server-dns',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-dhcpserver',
    name: 'DHCP Server',
    type: 'Server', // Base type: Server
    icon: 'server-dhcp',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  // === Endpoint / IoT ===
  {
    id: 'tpl-iotgateway',
    name: 'IoT Gateway',
    type: 'AccessPoint', // Base type: AccessPoint
    icon: 'iot',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-ipcamera',
    name: 'IP Camera',
    type: 'PC', // Base type: PC (endpoint)
    icon: 'telecamera-ip',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-printer',
    name: 'Printer',
    type: 'PC', // Base type: PC (endpoint)
    icon: 'stampante',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  // More end devices: each has one network card, as a PC has, and is shown
  // with its own drawing (named by its `icon`)
  {
    id: 'tpl-laptop',
    name: 'Laptop',
    type: 'PC', // Base type: PC (endpoint)
    icon: 'laptop',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-smartphone',
    name: 'Smartphone',
    type: 'PC', // Base type: PC (endpoint)
    icon: 'smartphone',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-tablet',
    name: 'Tablet',
    type: 'PC', // Base type: PC (endpoint)
    icon: 'tablet',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
  {
    id: 'tpl-ipphone',
    name: 'IP Phone',
    type: 'PC', // Base type: PC (endpoint)
    icon: 'telefono-ip',
    color: '#5E8096',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
];

/**
 * What each built-in link type is for, as it is kept in the browser with the
 * template: the Italian words, whatever the language of the interface. On
 * screen the description follows the language of the interface for as long
 * as the user has not rewritten it (utils/templateText.ts, which also knows
 * the words stored by earlier versions).
 */
const BUILT_IN_DESCRIPTIONS = dictionaryOf('it').templates.links.builtInDescriptions;

// Default connection templates
const DEFAULT_CONNECTION_TEMPLATES: ConnectionTemplate[] = [
  {
    id: 'conn-access',
    name: 'Access',
    type: 'access',
    description: BUILT_IN_DESCRIPTIONS.access,
    color: '#3b82f6', // Blue
    lineStyle: 'solid',
    strokeWidth: 2.5,
    strokeWidthHighlighted: 4,
    isCustom: false,
  },
  {
    id: 'conn-trunk',
    name: 'Trunk',
    type: 'trunk',
    description: BUILT_IN_DESCRIPTIONS.trunk,
    color: '#9333ea', // Purple
    lineStyle: 'solid',
    strokeWidth: 3.5,
    strokeWidthHighlighted: 5,
    isCustom: false,
  },
  {
    id: 'conn-uplink',
    name: 'Uplink',
    type: 'uplink',
    description: BUILT_IN_DESCRIPTIONS.uplink,
    color: '#f59e0b', // Orange
    lineStyle: 'dashed',
    strokeWidth: 3,
    strokeWidthHighlighted: 4.5,
    strokeDasharray: '8 4',
    isCustom: false,
  },
  {
    id: 'conn-backbone',
    name: 'Backbone',
    type: 'backbone',
    description: BUILT_IN_DESCRIPTIONS.backbone,
    color: '#ef4444', // Red
    lineStyle: 'dotted',
    strokeWidth: 4,
    strokeWidthHighlighted: 6,
    strokeDasharray: '1 5',
    isCustom: false,
  },
  {
    id: 'conn-mpls',
    name: 'MPLS',
    type: 'mpls',
    description: BUILT_IN_DESCRIPTIONS.mpls,
    color: '#10b981', // Green
    lineStyle: 'dashed',
    strokeWidth: 3.5,
    strokeWidthHighlighted: 5,
    strokeDasharray: '12 6',
    isCustom: false,
  },
];

/**
 * The version of what is kept in localStorage (the key keeps its name):
 *
 *  - 0: what was kept before versions were counted
 *  - 1: the app comes with a laptop, a smartphone, a tablet and an IP phone
 */
export const TEMPLATE_STORAGE_VERSION = 1;

/**
 * What was kept by an older version, as this one reads it. Nothing kept is
 * changed or lost, a template made by the user least of all: the templates
 * the app has come with since are added after the ones that are there.
 */
export function migrateTemplateStorage(kept: unknown, version: number): PersistedTemplateState {
  const state = (typeof kept === 'object' && kept !== null ? kept : {}) as Partial<PersistedTemplateState>;
  const templates = Array.isArray(state.templates) ? state.templates : DEFAULT_TEMPLATES;
  const connectionTemplates = Array.isArray(state.connectionTemplates)
    ? state.connectionTemplates
    : DEFAULT_CONNECTION_TEMPLATES;
  if (version >= TEMPLATE_STORAGE_VERSION) return { templates, connectionTemplates };

  const there = new Set(templates.map((template) => template.id));
  return {
    templates: [...templates, ...DEFAULT_TEMPLATES.filter((template) => !there.has(template.id))],
    connectionTemplates,
  };
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set, get) => ({
      // Initial State
      templates: DEFAULT_TEMPLATES,
      connectionTemplates: DEFAULT_CONNECTION_TEMPLATES,

      // Device Template Actions
      addTemplate: (template) => {
        const newTemplate: DeviceTemplate = {
          ...template,
          id: `tpl-${Date.now()}`,
        };

        set((state) => ({ templates: [...state.templates, newTemplate] }));
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      getTemplate: (id) => {
        return get().templates.find((t) => t.id === id);
      },

      loadDefaultTemplates: () => {
        set({ templates: DEFAULT_TEMPLATES });
      },

      restoreDefaultTemplates: () => {
        const { templates } = get();
        const there = new Map(templates.map((template) => [template.id, template] as const));
        const missing = DEFAULT_TEMPLATES.filter((template) => !there.has(template.id));
        if (missing.length === 0) return 0;
        const builtInIds = new Set(DEFAULT_TEMPLATES.map((template) => template.id));
        set({
          // (the built-in ones in their order, as the app comes with them, then what is not built-in)
          templates: [
            ...DEFAULT_TEMPLATES.map((template) => there.get(template.id) ?? template),
            ...templates.filter((template) => !builtInIds.has(template.id)),
          ],
        });
        return missing.length;
      },

      // Connection Template Actions
      addConnectionTemplate: (template) => {
        const newTemplate: ConnectionTemplate = {
          ...template,
          id: `conn-${Date.now()}`,
        };

        set((state) => ({
          connectionTemplates: [...state.connectionTemplates, newTemplate],
        }));
      },

      updateConnectionTemplate: (id, updates) => {
        set((state) => ({
          connectionTemplates: state.connectionTemplates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      deleteConnectionTemplate: (id) => {
        set((state) => ({
          connectionTemplates: state.connectionTemplates.filter((t) => t.id !== id),
        }));
      },

      getConnectionTemplate: (id) => {
        return get().connectionTemplates.find((t) => t.id === id);
      },

      getConnectionTemplateByType: (type) => {
        return get().connectionTemplates.find((t) => t.type === type);
      },

      loadDefaultConnectionTemplates: () => {
        set({ connectionTemplates: DEFAULT_CONNECTION_TEMPLATES });
      },

      addMissingTemplates: (devices, connections) => {
        const { templates, connectionTemplates } = get();

        const knownIds = new Set(templates.map((t) => t.id));
        const newDevices: DeviceTemplate[] = [];
        for (const template of devices) {
          if (knownIds.has(template.id)) continue;
          knownIds.add(template.id);
          newDevices.push(template);
        }

        // A connection template is looked up by `type`: a second one with a
        // type already present would never be used
        const knownConnectionIds = new Set(connectionTemplates.map((t) => t.id));
        const knownTypes = new Set(connectionTemplates.map((t) => t.type));
        const newConnections: ConnectionTemplate[] = [];
        for (const template of connections) {
          if (knownConnectionIds.has(template.id) || knownTypes.has(template.type)) continue;
          knownConnectionIds.add(template.id);
          knownTypes.add(template.type);
          newConnections.push(template);
        }

        if (newDevices.length === 0 && newConnections.length === 0) return;
        set({
          templates: [...templates, ...newDevices],
          connectionTemplates: [...connectionTemplates, ...newConnections],
        });
      },
    }),
    {
      name: 'pixelcake-templates-v8', // LocalStorage key (v8: added 11 new device types + MPLS connection)
      storage: safeJSONStorage<PersistedTemplateState>(),
      version: TEMPLATE_STORAGE_VERSION,
      migrate: migrateTemplateStorage,
      partialize: (state): PersistedTemplateState => ({
        templates: state.templates,
        connectionTemplates: state.connectionTemplates,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Template store hydration error (ignored):', error);
        }

        // Migration: add supportsPorts and supportsNICs fields to existing templates (v4 → v5 → v6 → v7)
        if (state) {
          state.templates = state.templates.map((t) => {
            // Determine port support based on device type
            const isSwitch = t.type === 'Switch';
            const isRouterOrFirewall = t.type === 'Router' || t.type === 'Firewall';
            const hasPortSupport = isSwitch || isRouterOrFirewall;

            // Default values based on type
            let supportsPorts = t.supportsPorts;
            let portOptions = t.portOptions;
            let defaultPortCount = t.defaultPortCount;
            let supportsNICs = t.supportsNICs;

            // Apply defaults if not set
            if (supportsPorts === undefined) {
              supportsPorts = hasPortSupport;
            }

            if (portOptions === undefined) {
              if (isSwitch) {
                portOptions = [5, 8, 16, 24, 48];
              } else if (isRouterOrFirewall) {
                portOptions = [2, 4, 8, 16];
              }
            }

            if (defaultPortCount === undefined) {
              if (isSwitch) {
                defaultPortCount = 24;
              } else if (isRouterOrFirewall) {
                defaultPortCount = 8;
              }
            }

            // v7 Migration: Add NICs support for devices without ports
            if (supportsNICs === undefined) {
              supportsNICs = !hasPortSupport; // Devices without ports support NICs
            }

            return {
              ...t,
              supportsPorts,
              portOptions,
              defaultPortCount,
              supportsNICs,
            };
          });
        }
      },
    }
  )
);
