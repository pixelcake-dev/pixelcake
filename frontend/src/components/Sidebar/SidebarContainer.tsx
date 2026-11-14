import { useUIStore } from '@/store/uiStore';
import { useT } from '@/i18n';
import Sidebar from './Sidebar';
import SidebarPanel from './SidebarPanel';
import SimulationPanel from './SimulationPanel';
import DevicePanel from './DevicePanel';
import ExplorerPanel from './ExplorerPanel';

const SidebarContainer = () => {
  const t = useT();
  const activeSidebarPanel = useUIStore((state) => state.activeSidebarPanel);

  return (
    <>
      {/* Sidebar Icons (always visible) */}
      <Sidebar />

      {/* Sidebar Panels (slide-in based on active panel) */}
      {activeSidebarPanel === 'simulation' && (
        <SidebarPanel isOpen={true} title={t.sidebar.panels.simulation}>
          <SimulationPanel />
        </SidebarPanel>
      )}

      {activeSidebarPanel === 'devices' && (
        <SidebarPanel isOpen={true} title={t.sidebar.panels.devices}>
          <DevicePanel />
        </SidebarPanel>
      )}

      {activeSidebarPanel === 'explorer' && (
        <SidebarPanel isOpen={true} title={t.sidebar.panels.explorer}>
          <ExplorerPanel />
        </SidebarPanel>
      )}
    </>
  );
};

export default SidebarContainer;
