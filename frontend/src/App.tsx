/**
 * Pixelcake Main App Component
 */

import { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Toaster, toast } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { useTemplateStore } from '@/store/templateStore';
import { useProjectStore } from '@/store/projectStore';
import { restoreSession, registerUnloadFlush } from '@/utils/restoreSession';
import LoginPage from '@/components/LoginPage';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import SidebarContainer from '@/components/Sidebar/SidebarContainer';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';
import ContextMenu from '@/components/ui/ContextMenu';
import ConnectionContextMenu from '@/components/ui/ConnectionContextMenu';
import AddDeviceModal from '@/components/Modals/AddDeviceModal';
import DevicePickerModal from '@/components/Modals/DevicePickerModal';
import BulkAddDeviceModal from '@/components/Modals/BulkAddDeviceModal';
import InspectorModal from '@/components/Modals/InspectorModal';
import ConnectionInspectorModal from '@/components/Modals/ConnectionInspectorModal';
import SimulationModal from '@/components/Modals/SimulationModal';
import HelpModal from '@/components/Modals/HelpModal';
import SettingsModal from '@/components/Modals/SettingsModal';
import TerminalModal from '@/components/Modals/TerminalModal';
import NewProjectModal from '@/components/Modals/NewProjectModal';
import OpenProjectModal from '@/components/Modals/OpenProjectModal';
import SaveAsModal from '@/components/Modals/SaveAsModal';
import ImportExportModal from '@/components/Modals/ImportExportModal';
import 'reactflow/dist/style.css';

function App() {
  const isAuthenticated = useUIStore((state) => state.isAuthenticated);
  const theme = useUIStore((state) => state.theme);
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const setShowWelcomeScreen = useUIStore((state) => state.setShowWelcomeScreen);
  const currentProject = useProjectStore((state) => state.currentProject);

  useEffect(() => {
    // Initialize dark mode from system preference (only on mount)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      toggleDarkMode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    // Apply theme to body element whenever it changes
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Load templates from backend on app start
    const loadTemplates = async () => {
      const templateStore = useTemplateStore.getState();
      if (!templateStore.isInitialized) {
        try {
          await templateStore.loadFromBackend();
        } catch (error) {
          console.warn('[App] Failed to load templates from backend, using defaults:', error);
        }
      }
    };
    loadTemplates();
  }, []);

  useEffect(() => {
    // Restore the previously open project/canvas after a refresh and flush
    // unsaved changes when the tab closes (both internally StrictMode-guarded)
    registerUnloadFlush();
    restoreSession();
  }, []);

  useEffect(() => {
    // Check backend health on app start
    const checkBackendHealth = async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      try {
        const response = await fetch(`${apiUrl}/api/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          toast.success('Backend connesso correttamente');
        } else {
          toast.warning('Backend online ma non risponde correttamente');
        }
      } catch (error) {
        toast.warning('Backend offline - lavorando in modalità locale', {
          description: 'Le modifiche non verranno salvate nel database',
        });
        console.warn('[App] Backend health check failed:', error);
      }
    };
    checkBackendHealth();
  }, []);

  useEffect(() => {
    // Controlla se mostrare la welcome screen
    const hideWelcome = localStorage.getItem('pixelcake-hide-welcome') === 'true';

    if (!currentProject && !hideWelcome) {
      // Nessun progetto caricato e l'utente non ha scelto di nascondere la welcome screen
      setShowWelcomeScreen(true);
    } else {
      // Progetto caricato o utente ha scelto di nascondere la welcome screen
      setShowWelcomeScreen(false);
    }
  }, [currentProject, setShowWelcomeScreen]);

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Show main app if authenticated
  return (
    <ReactFlowProvider>
      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        expand={false}
        richColors
        closeButton
        theme={darkMode ? 'dark' : 'light'}
      />

      <div className="app-container">
        {/* Top Menu Bar */}
        <TopMenuBar />

        {/* Main Content: Sidebar + Canvas */}
        <div className="app-main">
          {/* Sidebar (left) */}
          <SidebarContainer />

          {/* Canvas Area (right) */}
          <main className="canvas-area">
            <NetworkCanvas />
          </main>
        </div>

        {/* Context Menus */}
        <ContextMenu />
        <ConnectionContextMenu />

        {/* Modals */}
        <DevicePickerModal />
        <AddDeviceModal />
        <BulkAddDeviceModal />
        <InspectorModal />
        <ConnectionInspectorModal />
        <SimulationModal />
        <HelpModal />
        <SettingsModal />
        <TerminalModal />
        <NewProjectModal />
        <OpenProjectModal />
        <SaveAsModal />
        <ImportExportModal />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
