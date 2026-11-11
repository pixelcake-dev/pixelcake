import { useUIStore } from '@/store/uiStore';
import { X } from 'lucide-react';

interface SidebarPanelProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
}

const SidebarPanel = ({ isOpen, title, children }: SidebarPanelProps) => {
  const setActiveSidebarPanel = useUIStore((state) => state.setActiveSidebarPanel);

  if (!isOpen) return null;

  return (
    <div className={`sidebar-panel ${isOpen ? 'open' : ''}`}>
      {/* Panel Header */}
      <div className="sidebar-panel-header">
        <h3 className="sidebar-panel-title">{title}</h3>
        <button
          className="sidebar-panel-close"
          onClick={() => setActiveSidebarPanel(null)}
          title="Chiudi"
        >
          <X size={18} />
        </button>
      </div>

      {/* Panel Content */}
      <div className="sidebar-panel-content">{children}</div>
    </div>
  );
};

export default SidebarPanel;
