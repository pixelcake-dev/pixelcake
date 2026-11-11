/**
 * Template Store
 * Manages device templates and connection templates
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import type { DeviceTemplate, ConnectionTemplate } from '@/types/network';
import {
  listDeviceTemplates,
  createDeviceTemplate,
  listConnectionTemplates,
  createConnectionTemplate,
  syncTemplates,
} from '@/api';
// Planned imports for individual template CRUD with DB ID mapping (see TODO in updateTemplate):
// import { updateDeviceTemplate, deleteDeviceTemplate, updateConnectionTemplate, deleteConnectionTemplate } from '@/api';

interface TemplateStore {
  // Device Templates State
  templates: DeviceTemplate[];

  // Connection Templates State
  connectionTemplates: ConnectionTemplate[];

  // Backend Sync State
  isSyncing: boolean;
  lastSyncError: string | null;
  isInitialized: boolean;

  // Device Template Actions
  addTemplate: (template: Omit<DeviceTemplate, 'id'>) => Promise<void>;
  updateTemplate: (id: string, updates: Partial<DeviceTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  getTemplate: (id: string) => DeviceTemplate | undefined;
  loadDefaultTemplates: () => void;

  // Connection Template Actions
  addConnectionTemplate: (template: Omit<ConnectionTemplate, 'id'>) => Promise<void>;
  updateConnectionTemplate: (id: string, updates: Partial<ConnectionTemplate>) => Promise<void>;
  deleteConnectionTemplate: (id: string) => Promise<void>;
  getConnectionTemplate: (id: string) => ConnectionTemplate | undefined;
  getConnectionTemplateByType: (type: string) => ConnectionTemplate | undefined;
  loadDefaultConnectionTemplates: () => void;

  // Backend Sync Actions
  loadFromBackend: () => Promise<void>;
  saveToBackend: () => Promise<void>;
  syncCustomTemplates: () => Promise<void>;
}

// Default generic templates
const DEFAULT_TEMPLATES: DeviceTemplate[] = [
  {
    id: 'tpl-pc',
    name: 'PC',
    type: 'PC',
    icon: 'solar:monitor-bold-duotone',
    color: '#5B7C8D',
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
    icon: 'carbon:network-4',
    color: '#5B7C8D',
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
    icon: 'mdi:router-network',
    color: '#5B7C8D',
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
    icon: 'mdi:server',
    color: '#5B7C8D',
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
    icon: 'mdi:shield-network',
    color: '#5B7C8D',
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
    icon: 'mdi:access-point',
    color: '#5B7C8D',
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
    icon: 'mdi:scale-balance',
    color: '#5B7C8D',
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
    icon: 'mdi:database',
    color: '#5B7C8D',
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
    icon: 'mdi:cloud',
    color: '#5B7C8D',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false, // Cloud does not support port management
    supportsNICs: true, // Cloud supports Network Interface Cards
  },
  // === Server Applicativi (type: Server) ===
  {
    id: 'tpl-mailserver',
    name: 'Mail Server',
    type: 'Server', // Base type: Server
    icon: 'mdi:email-fast',
    color: '#5B7C8D',
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
    icon: 'mdi:cloud-outline',
    color: '#5B7C8D',
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
    icon: 'mdi:web',
    color: '#5B7C8D',
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
    icon: 'mdi:shield-half-full',
    color: '#5B7C8D',
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
    icon: 'mdi:bucket',
    color: '#5B7C8D',
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
    icon: 'mdi:nas',
    color: '#5B7C8D',
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
    icon: 'mdi:dns',
    color: '#5B7C8D',
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
    icon: 'mdi:ip-network',
    color: '#5B7C8D',
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
    icon: 'mdi:router-wireless-settings',
    color: '#5B7C8D',
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
    icon: 'mdi:cctv',
    color: '#5B7C8D',
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
    icon: 'mdi:printer-wireless',
    color: '#5B7C8D',
    isCustom: false,
    supportsVLAN: false,
    supportsSTP: false,
    supportsPorts: false,
    supportsNICs: true,
  },
];

// Default connection templates
const DEFAULT_CONNECTION_TEMPLATES: ConnectionTemplate[] = [
  {
    id: 'conn-access',
    name: 'Access',
    type: 'access',
    description: 'Porta di accesso a dispositivi finali',
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
    description: 'Link trunk tra switch',
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
    description: 'Uplink a core/internet',
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
    description: 'Infrastruttura critica',
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
    description: 'Connessione MPLS WAN',
    color: '#10b981', // Green
    lineStyle: 'dashed',
    strokeWidth: 3.5,
    strokeWidthHighlighted: 5,
    strokeDasharray: '12 6',
    isCustom: false,
  },
];

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set, get) => ({
      // Initial State
      templates: DEFAULT_TEMPLATES,
      connectionTemplates: DEFAULT_CONNECTION_TEMPLATES,
      isSyncing: false,
      lastSyncError: null,
      isInitialized: false,

      // Device Template Actions
      addTemplate: async (template) => {
        const newTemplate: DeviceTemplate = {
          ...template,
          id: `tpl-${Date.now()}`,
        };

        // Add locally first (optimistic update)
        set((state) => ({ templates: [...state.templates, newTemplate] }));

        // Sync to backend if custom template
        if (newTemplate.isCustom) {
          try {
            set({ isSyncing: true, lastSyncError: null });
            await createDeviceTemplate({ template: newTemplate });
            set({ isSyncing: false });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create device template';
            set({ lastSyncError: errorMessage, isSyncing: false });
            toast.error(`Errore creazione template: ${errorMessage}`);
            console.error('[TemplateStore] Failed to create device template:', error);
            // Keep local changes even if backend sync fails
          }
        }
      },

      updateTemplate: async (id, updates) => {
        const template = get().templates.find((t) => t.id === id);
        if (!template) return;

        // Update locally first (optimistic update)
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));

        // Sync to backend if custom template
        if (template.isCustom) {
          try {
            set({ isSyncing: true, lastSyncError: null });
            // TODO: Map template.id to DB record ID, then call:
            // const updatedTemplate = { ...template, ...updates };
            // await updateDeviceTemplate(dbId, updatedTemplate);
            // For now, skip backend update (will be synced on next load via bulk sync)
            set({ isSyncing: false });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update device template';
            set({ lastSyncError: errorMessage, isSyncing: false });
            toast.error(`Errore aggiornamento template: ${errorMessage}`);
            console.error('[TemplateStore] Failed to update device template:', error);
          }
        }
      },

      deleteTemplate: async (id) => {
        // Delete locally
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));

        // Backend sync will happen via syncCustomTemplates() or saveToBackend()
        // Note: Individual delete not implemented - use bulk sync instead
      },

      getTemplate: (id) => {
        return get().templates.find((t) => t.id === id);
      },

      loadDefaultTemplates: () => {
        set({ templates: DEFAULT_TEMPLATES });
      },

      // Connection Template Actions
      addConnectionTemplate: async (template) => {
        const newTemplate: ConnectionTemplate = {
          ...template,
          id: `conn-${Date.now()}`,
        };

        // Add locally first (optimistic update)
        set((state) => ({
          connectionTemplates: [...state.connectionTemplates, newTemplate],
        }));

        // Sync to backend if custom template
        if (newTemplate.isCustom) {
          try {
            set({ isSyncing: true, lastSyncError: null });
            await createConnectionTemplate({ template: newTemplate });
            set({ isSyncing: false });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create connection template';
            set({ lastSyncError: errorMessage, isSyncing: false });
            toast.error(`Errore creazione template connessione: ${errorMessage}`);
            console.error('[TemplateStore] Failed to create connection template:', error);
          }
        }
      },

      updateConnectionTemplate: async (id, updates) => {
        const template = get().connectionTemplates.find((t) => t.id === id);
        if (!template) return;

        // Update locally first (optimistic update)
        set((state) => ({
          connectionTemplates: state.connectionTemplates.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));

        // Backend sync will happen via syncCustomTemplates() or saveToBackend()
        // Note: Individual update uses bulk sync instead
      },

      deleteConnectionTemplate: async (id) => {
        // Delete locally
        set((state) => ({
          connectionTemplates: state.connectionTemplates.filter((t) => t.id !== id),
        }));

        // Backend sync will happen via syncCustomTemplates() or saveToBackend()
        // Note: Individual delete not implemented - use bulk sync instead
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

      // Backend Sync Actions
      loadFromBackend: async () => {
        try {
          set({ isSyncing: true, lastSyncError: null });

          // Fetch all templates from backend (global + custom)
          const [deviceTemplatesResponse, connectionTemplatesResponse] = await Promise.all([
            listDeviceTemplates(),
            listConnectionTemplates(),
          ]);

          // Convert API responses to frontend format
          const deviceTemplates = deviceTemplatesResponse.map((res) => res.template);
          const connectionTemplates = connectionTemplatesResponse.map((res) => res.template);

          // Update state
          set({
            templates: deviceTemplates,
            connectionTemplates,
            isInitialized: true,
            isSyncing: false,
          });

          toast.success(`Templates caricati dal backend: ${deviceTemplates.length} dispositivi, ${connectionTemplates.length} connessioni`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load templates';
          set({ lastSyncError: errorMessage, isSyncing: false });
          toast.error(`Errore caricamento templates: ${errorMessage}`);
          console.error('[TemplateStore] Failed to load templates from backend:', error);
          // Fall back to LocalStorage cached data (already loaded by persist middleware)
        }
      },

      saveToBackend: async () => {
        // Alias for syncCustomTemplates
        await get().syncCustomTemplates();
      },

      syncCustomTemplates: async () => {
        try {
          set({ isSyncing: true, lastSyncError: null });

          // Get only custom templates
          const customDeviceTemplates = get().templates.filter((t) => t.isCustom);
          const customConnectionTemplates = get().connectionTemplates.filter((t) => t.isCustom);

          // Sync to backend (upsert)
          await syncTemplates({
            deviceTemplates: customDeviceTemplates,
            connectionTemplates: customConnectionTemplates,
          });

          set({ isSyncing: false });

          toast.success(`Templates sincronizzati: ${customDeviceTemplates.length} dispositivi, ${customConnectionTemplates.length} connessioni`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to sync templates';
          set({ lastSyncError: errorMessage, isSyncing: false });
          toast.error(`Errore sincronizzazione templates: ${errorMessage}`);
          console.error('[TemplateStore] Failed to sync templates to backend:', error);
          throw error;
        }
      },
    }),
    {
      name: 'pixelcake-templates-v8', // LocalStorage key (v8: added 11 new device types + MPLS connection)
      partialize: (state) => ({
        templates: state.templates,
        connectionTemplates: state.connectionTemplates,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Template store hydration error (ignorato):', error);
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
