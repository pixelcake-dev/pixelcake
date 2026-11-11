/**
 * Pixelcake Main App Component
 */

import { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Toaster } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { registerSaveShortcut } from '@/utils/projectFileAccess';
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
import ImportExportModal from '@/components/Modals/ImportExportModal';
import 'reactflow/dist/style.css';

function App() {
  const isAuthenticated = useUIStore((state) => state.isAuthenticated);
  const theme = useUIStore((state) => state.theme);
  const darkMode = useUIStore((state) => state.darkMode);
  const setShowWelcomeScreen = useUIStore((state) => state.setShowWelcomeScreen);

  useEffect(() => {
    // Apply theme to body element whenever it changes
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Welcome screen at start-up, unless the user chose not to see it again
    // (the canvas only shows it while it is empty)
    const hideWelcome = localStorage.getItem('pixelcake-hide-welcome') === 'true';
    setShowWelcomeScreen(!hideWelcome);
  }, [setShowWelcomeScreen]);

  useEffect(() => {
    // Ctrl+S saves the project to a file, anywhere in the app
    if (!isAuthenticated) return;
    return registerSaveShortcut();
  }, [isAuthenticated]);

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
        <ImportExportModal />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
