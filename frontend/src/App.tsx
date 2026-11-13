/**
 * Pixelcake Main App Component
 */

import { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Toaster } from 'sonner';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { registerSaveShortcut } from '@/utils/projectFileAccess';
import TopMenuBar from '@/components/Toolbar/TopMenuBar';
import SidebarContainer from '@/components/Sidebar/SidebarContainer';
import NetworkCanvas from '@/components/Canvas/NetworkCanvas';
import PresentationBar from '@/components/Presentation/PresentationBar';
import PresentationPanel from '@/components/Presentation/PresentationPanel';
import PresentationMenu from '@/components/Presentation/PresentationMenu';
import ContextMenu from '@/components/ui/ContextMenu';
import ConnectionContextMenu from '@/components/ui/ConnectionContextMenu';
import AddDeviceModal from '@/components/Modals/AddDeviceModal';
import BulkAddDeviceModal from '@/components/Modals/BulkAddDeviceModal';
import InspectorModal from '@/components/Modals/InspectorModal';
import ConnectionInspectorModal from '@/components/Modals/ConnectionInspectorModal';
import HelpModal from '@/components/Modals/HelpModal';
import SettingsModal from '@/components/Modals/SettingsModal';
import TerminalModal from '@/components/Modals/TerminalModal';
import NewProjectModal from '@/components/Modals/NewProjectModal';
import ImportExportModal from '@/components/Modals/ImportExportModal';
import ExportImageModal from '@/components/Modals/ExportImageModal';
import 'reactflow/dist/style.css';

function App() {
  const theme = useUIStore((state) => state.theme);
  const darkMode = useUIStore((state) => state.darkMode);
  const setShowWelcomeScreen = useUIStore((state) => state.setShowWelcomeScreen);
  // Presentation mode: the tools for building give way to the tools for showing
  const presenting = usePresentationStore((state) => state.active);

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
    return registerSaveShortcut();
  }, []);

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

      <div className={presenting ? 'app-container presenting' : 'app-container'}>
        {/* Top bar: the menus, or the bar of the presentation */}
        {presenting ? <PresentationBar /> : <TopMenuBar />}

        {/* Main Content: Sidebar (or presentation panel) + Canvas */}
        <div className="app-main">
          {presenting ? <PresentationPanel /> : <SidebarContainer />}

          {/* Canvas Area (right) */}
          <main className="canvas-area">
            <NetworkCanvas />
          </main>
        </div>

        {/* Context Menus (while presenting, a click opens the presentation menu) */}
        {presenting ? (
          <PresentationMenu />
        ) : (
          <>
            <ContextMenu />
            <ConnectionContextMenu />
          </>
        )}

        {/* Modals */}
        <AddDeviceModal />
        <BulkAddDeviceModal />
        <InspectorModal />
        <ConnectionInspectorModal />
        <HelpModal />
        <SettingsModal />
        <TerminalModal />
        <NewProjectModal />
        <ImportExportModal />
        <ExportImageModal />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
