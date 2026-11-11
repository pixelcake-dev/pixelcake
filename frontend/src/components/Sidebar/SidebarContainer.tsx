import { useUIStore } from '@/store/uiStore';
import Sidebar from './Sidebar';
import SidebarPanel from './SidebarPanel';
import SimulationPanel from './SimulationPanel';
import DevicePanel from './DevicePanel';
import ExplorerPanel from './ExplorerPanel';

const SidebarContainer = () => {
  const activeSidebarPanel = useUIStore((state) => state.activeSidebarPanel);

  return (
    <>
      {/* Sidebar Icons (always visible) */}
      <Sidebar />

      {/* Sidebar Panels (slide-in based on active panel) */}
      {activeSidebarPanel === 'simulation' && (
        <SidebarPanel isOpen={true} title="Simulazione">
          <SimulationPanel />
        </SidebarPanel>
      )}

      {activeSidebarPanel === 'devices' && (
        <SidebarPanel isOpen={true} title="Aggiungi">
          <DevicePanel />
        </SidebarPanel>
      )}

      {activeSidebarPanel === 'favorites' && (
        <SidebarPanel isOpen={true} title="Preferiti">
          <div className="sidebar-panel-section">
            <p className="text-[var(--text-color-light)] text-center py-8">
              Aggiungi dispositivi ai preferiti per accesso rapido.
            </p>
          </div>
        </SidebarPanel>
      )}

      {activeSidebarPanel === 'explorer' && (
        <SidebarPanel isOpen={true} title="Explorer">
          <ExplorerPanel />
        </SidebarPanel>
      )}
    </>
  );
};

export default SidebarContainer;
