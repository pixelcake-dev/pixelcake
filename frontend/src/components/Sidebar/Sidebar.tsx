import { useUIStore } from '@/store/uiStore';
import { Zap, Plus, Star, Files, User, Settings, Terminal, ArrowUpDown } from 'lucide-react';

type SidebarSection = 'simulation' | 'devices' | 'favorites' | 'explorer' | null;

const Sidebar = () => {
  const activeSidebarPanel = useUIStore((state) => state.activeSidebarPanel);
  const setActiveSidebarPanel = useUIStore((state) => state.setActiveSidebarPanel);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const isSettingsOpen = useUIStore((state) => state.modals.settings);

  const handleSectionClick = (section: SidebarSection) => {
    // Toggle: if same section clicked, close it
    if (activeSidebarPanel === section) {
      setActiveSidebarPanel(null);
    } else {
      setActiveSidebarPanel(section);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-main">
        {/* File Menu Button */}
        <button
          className={`sidebar-icon sidebar-toggle ${activeSidebarPanel === 'explorer' ? 'active' : ''}`}
          title="Explorer"
          onClick={() => handleSectionClick('explorer')}
        >
          <Files size={28} />
        </button>

        <div className="sidebar-divider" />

        {/* Simulation */}
        <button
          className={`sidebar-icon ${activeSidebarPanel === 'simulation' ? 'active' : ''}`}
          title="Simulazione"
          onClick={() => handleSectionClick('simulation')}
        >
          <Zap size={28} style={{ color: '#8b5cf6' }} />
        </button>

        {/* Add Device */}
        <button
          className={`sidebar-icon ${activeSidebarPanel === 'devices' ? 'active' : ''}`}
          title="Aggiungi Dispositivo"
          onClick={() => handleSectionClick('devices')}
        >
          <Plus size={28} style={{ color: '#3b82f6' }} />
        </button>

        {/* Favorites */}
        <button
          className={`sidebar-icon ${activeSidebarPanel === 'favorites' ? 'active' : ''}`}
          title="Preferiti"
          onClick={() => handleSectionClick('favorites')}
          disabled
        >
          <Star size={28} style={{ color: '#9ca3af' }} />
        </button>

        {/* Console */}
        <button
          className="sidebar-icon"
          title="Console"
          onClick={() => openModal('codeTerminal')}
        >
          <Terminal size={28} style={{ color: '#10b981' }} />
        </button>

        {/* Import/Export */}
        <button
          className="sidebar-icon"
          title="Import/Export"
          onClick={() => openModal('importExport')}
        >
          <ArrowUpDown size={28} style={{ color: '#f59e0b' }} />
        </button>
      </div>

      {/* Footer Section */}
      <div className="sidebar-footer">
        <button
          className="sidebar-icon"
          title="Account (Coming Soon)"
          disabled
        >
          <User size={28} />
        </button>
        <button
          className="sidebar-icon"
          title="Impostazioni"
          onClick={() => isSettingsOpen ? closeModal('settings') : openModal('settings')}
        >
          <Settings size={28} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
