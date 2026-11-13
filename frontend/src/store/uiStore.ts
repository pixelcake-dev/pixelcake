/**
 * UI Store
 * Manages UI state like theme, modals, menus, context menu
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NetworkDevice, NetworkConnection, DeviceType } from '@/types';

/** The panels the sidebar can show next to its icons */
export type SidebarPanelId = 'simulation' | 'devices' | 'explorer';

/** The tabs of the guide (HelpModal) */
export type HelpTab = 'guide' | 'commands' | 'about';

interface UIStore {
  // State
  darkMode: boolean;
  activeSidebarPanel: SidebarPanelId | null;
  modals: {
    addDevice: boolean;
    inspector: boolean;
    help: boolean;
    connectionInspector: boolean;
    settings: boolean;
    bulkAddDevice: boolean;
    codeTerminal: boolean;
    newProject: boolean;
    importExport: boolean;
    exportImage: boolean;
  };
  addDeviceType: DeviceType | null;
  addDeviceTemplateId: string | null; // Template ID for specific device creation
  inspectorDevice: NetworkDevice | null;
  inspectorConnection: NetworkConnection | null;
  contextMenuDevice: NetworkDevice | null;
  contextMenuConnection: NetworkConnection | null;
  contextMenuPosition: { x: number; y: number } | null;

  // Terminal: device context to start in when opened from a device
  // (not persisted; consumed once by TerminalModal on open, then cleared)
  terminalContextDevice: string | null;

  // Guide: the tab it shows (not persisted; set by whoever opens it)
  helpTab: HelpTab;

  // Magnification State
  magnifiedDeviceTypes: string[];
  magnifiedConnectionTypes: string[];

  // Particle Animation State (not persisted)
  particleAnimationEnabled: boolean;

  // Welcome Screen State (not persisted - controlled by separate localStorage flag)
  showWelcomeScreen: boolean;

  // Actions
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  setActiveSidebarPanel: (panel: SidebarPanelId | null) => void;
  openModal: (modalName: keyof UIStore['modals']) => void;
  closeModal: (modalName: keyof UIStore['modals']) => void;
  /** Open the guide on a tab ("Come si usa" when none is given) */
  openHelp: (tab?: HelpTab) => void;
  setHelpTab: (tab: HelpTab) => void;
  setAddDeviceType: (type: DeviceType, templateId?: string) => void;
  setInspectorDevice: (device: NetworkDevice | null) => void;
  setInspectorConnection: (connection: NetworkConnection | null) => void;
  setContextMenuDevice: (device: NetworkDevice | null, x?: number, y?: number) => void;
  setContextMenuConnection: (connection: NetworkConnection | null, x?: number, y?: number) => void;
  closeContextMenu: () => void;
  setTerminalContextDevice: (label: string | null) => void;

  // Magnification Actions
  toggleMagnifyDevice: (deviceType: string) => void;
  toggleMagnifyConnection: (connectionType: string) => void;
  resetMagnification: () => void;

  // Particle Animation Actions
  toggleParticleAnimation: () => void;
  setParticleAnimation: (enabled: boolean) => void;

  // Welcome Screen Actions
  setShowWelcomeScreen: (show: boolean) => void;
  dismissWelcomeScreen: (neverShowAgain: boolean) => void;
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial State
      // Until the user picks one, the theme follows the system. A saved
      // choice replaces this value when the store is read from storage
      darkMode: systemPrefersDark(),
      activeSidebarPanel: null,
      modals: {
        addDevice: false,
        inspector: false,
        help: false,
        connectionInspector: false,
        settings: false,
        bulkAddDevice: false,
        codeTerminal: false,
        newProject: false,
        importExport: false,
        exportImage: false,
      },
      addDeviceType: null,
      addDeviceTemplateId: null,
      inspectorDevice: null,
      inspectorConnection: null,
      contextMenuDevice: null,
      contextMenuConnection: null,
      contextMenuPosition: null,
      terminalContextDevice: null,
      helpTab: 'guide',

      // Magnification State
      magnifiedDeviceTypes: [],
      magnifiedConnectionTypes: [],

      // Particle Animation State (not persisted - default OFF)
      particleAnimationEnabled: false,

      // Welcome Screen State (not persisted - default ON)
      showWelcomeScreen: true,

      // Actions
      toggleDarkMode: () => {
        set((state) => {
          const newMode = !state.darkMode;
          if (newMode) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return { darkMode: newMode };
        });
      },

      setDarkMode: (isDark) => {
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        set({ darkMode: isDark });
      },

      setActiveSidebarPanel: (panel) => {
        set({ activeSidebarPanel: panel });
      },

      openModal: (modalName) => {
        set((state) => ({
          modals: { ...state.modals, [modalName]: true },
        }));
      },

      closeModal: (modalName) => {
        set((state) => ({
          modals: { ...state.modals, [modalName]: false },
        }));
      },

      openHelp: (tab = 'guide') => {
        set((state) => ({
          helpTab: tab,
          modals: { ...state.modals, help: true },
        }));
      },

      setHelpTab: (tab) => {
        set({ helpTab: tab });
      },

      setAddDeviceType: (type, templateId) => {
        set({ addDeviceType: type, addDeviceTemplateId: templateId ?? null });
      },

      setInspectorDevice: (device) => {
        set({ inspectorDevice: device });
      },

      setInspectorConnection: (connection) => {
        set({ inspectorConnection: connection });
      },

      setContextMenuDevice: (device, x, y) => {
        if (device && x !== undefined && y !== undefined) {
          set({
            contextMenuDevice: device,
            contextMenuConnection: null,
            contextMenuPosition: { x, y },
          });
        } else {
          set({
            contextMenuDevice: null,
            contextMenuPosition: null,
          });
        }
      },

      setContextMenuConnection: (connection, x, y) => {
        if (connection && x !== undefined && y !== undefined) {
          set({
            contextMenuConnection: connection,
            contextMenuDevice: null,
            contextMenuPosition: { x, y },
          });
        } else {
          set({
            contextMenuConnection: null,
            contextMenuPosition: null,
          });
        }
      },

      closeContextMenu: () => {
        set({
          contextMenuDevice: null,
          contextMenuConnection: null,
          contextMenuPosition: null,
        });
      },

      setTerminalContextDevice: (label) => {
        set({ terminalContextDevice: label });
      },

      // Magnification Actions
      toggleMagnifyDevice: (deviceType) => {
        set((state) => {
          const isCurrentlyMagnified = state.magnifiedDeviceTypes.includes(deviceType);
          if (isCurrentlyMagnified) {
            // Remove from list (toggle off)
            return {
              magnifiedDeviceTypes: state.magnifiedDeviceTypes.filter((t) => t !== deviceType),
            };
          } else {
            // Add to list (toggle on)
            return {
              magnifiedDeviceTypes: [...state.magnifiedDeviceTypes, deviceType],
            };
          }
        });
      },

      toggleMagnifyConnection: (connectionType) => {
        set((state) => {
          const isCurrentlyMagnified = state.magnifiedConnectionTypes.includes(connectionType);
          if (isCurrentlyMagnified) {
            // Remove from list (toggle off)
            return {
              magnifiedConnectionTypes: state.magnifiedConnectionTypes.filter((t) => t !== connectionType),
            };
          } else {
            // Add to list (toggle on)
            return {
              magnifiedConnectionTypes: [...state.magnifiedConnectionTypes, connectionType],
            };
          }
        });
      },

      resetMagnification: () => {
        set({
          magnifiedDeviceTypes: [],
          magnifiedConnectionTypes: [],
        });
      },

      // Particle Animation Actions
      toggleParticleAnimation: () => {
        set((state) => ({
          particleAnimationEnabled: !state.particleAnimationEnabled,
        }));
      },

      setParticleAnimation: (enabled) => {
        set({ particleAnimationEnabled: enabled });
      },

      // Welcome Screen Actions
      setShowWelcomeScreen: (show) => {
        set({ showWelcomeScreen: show });
      },

      dismissWelcomeScreen: (neverShowAgain) => {
        if (neverShowAgain) {
          localStorage.setItem('pixelcake-hide-welcome', 'true');
        }
        set({ showWelcomeScreen: false });
      },
    }),
    {
      name: 'pixelcake-ui-v1', // LocalStorage key
      partialize: (state) => ({
        darkMode: state.darkMode, // Persist darkMode preference
      }),
      // Light or dark is all that is kept. (A second colour theme existed
      // once: what an older version stored about it is not read back.)
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { darkMode?: unknown };
        return typeof saved.darkMode === 'boolean'
          ? { ...current, darkMode: saved.darkMode }
          : current;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('UI store hydration error (ignorato):', error);
        }
        // Dark mode is a class on <html>: put the page in line with the
        // state once, here. Toggling at start-up instead (as an earlier
        // version did) flips the saved choice at every reload
        if (state) {
          document.documentElement.classList.toggle('dark', state.darkMode);
        }
      },
    }
  )
);
