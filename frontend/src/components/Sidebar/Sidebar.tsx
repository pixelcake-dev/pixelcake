import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore, type SidebarPanelId } from '@/store/uiStore';
import { Zap, Plus, Files, Settings, Terminal, ArrowUpDown } from 'lucide-react';
import { useT } from '@/i18n';

/**
 * A button of the sidebar: an icon, and its name shown next to it while the
 * pointer or the keyboard is on it.
 *
 * The name is drawn on the page, outside the sidebar, because the panel a
 * button opens slides in over the sidebar's own layer and would cover it.
 * It is for the eye only: the button already carries the name for whoever
 * does not see the icon.
 */
const SidebarButton = ({
  label,
  active = false,
  className = '',
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) => {
  const button = useRef<HTMLButtonElement>(null);
  const [nameAt, setNameAt] = useState<{ top: number; left: number } | null>(null);

  const showName = () => {
    const box = button.current?.getBoundingClientRect();
    if (box) setNameAt({ top: box.top + box.height / 2, left: box.right + 8 });
  };
  const hideName = () => setNameAt(null);

  return (
    <>
      <button
        ref={button}
        className={`sidebar-icon ${className} ${active ? 'active' : ''}`}
        aria-label={label}
        onClick={() => {
          // What the button opens appears where the name is: the name has done its job
          hideName();
          onClick();
        }}
        onMouseEnter={showName}
        onMouseLeave={hideName}
        onFocus={showName}
        onBlur={hideName}
      >
        {children}
      </button>
      {nameAt &&
        createPortal(
          <span className="sidebar-tooltip" style={nameAt} aria-hidden="true">
            {label}
          </span>,
          document.body
        )}
    </>
  );
};

const Sidebar = () => {
  const t = useT();
  const activeSidebarPanel = useUIStore((state) => state.activeSidebarPanel);
  const setActiveSidebarPanel = useUIStore((state) => state.setActiveSidebarPanel);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const isSettingsOpen = useUIStore((state) => state.modals.settings);

  const handleSectionClick = (section: SidebarPanelId) => {
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
        <SidebarButton
          label={t.sidebar.buttons.explorer}
          className="sidebar-toggle"
          active={activeSidebarPanel === 'explorer'}
          onClick={() => handleSectionClick('explorer')}
        >
          <Files size={20} strokeWidth={1.75} />
        </SidebarButton>

        <div className="sidebar-divider" />

        {/* Simulation */}
        <SidebarButton
          label={t.sidebar.buttons.simulation}
          active={activeSidebarPanel === 'simulation'}
          onClick={() => handleSectionClick('simulation')}
        >
          <Zap size={20} strokeWidth={1.75} />
        </SidebarButton>

        {/* Add Device */}
        <SidebarButton
          label={t.sidebar.buttons.addDevice}
          active={activeSidebarPanel === 'devices'}
          onClick={() => handleSectionClick('devices')}
        >
          <Plus size={20} strokeWidth={1.75} />
        </SidebarButton>

        {/* Console */}
        <SidebarButton label={t.sidebar.buttons.console} onClick={() => openModal('codeTerminal')}>
          <Terminal size={20} strokeWidth={1.75} />
        </SidebarButton>

        {/* Import/Export */}
        <SidebarButton
          label={t.sidebar.buttons.importExport}
          onClick={() => openModal('importExport')}
        >
          <ArrowUpDown size={20} strokeWidth={1.75} />
        </SidebarButton>
      </div>

      {/* Footer Section */}
      <div className="sidebar-footer">
        <SidebarButton
          label={t.sidebar.buttons.settings}
          onClick={() => (isSettingsOpen ? closeModal('settings') : openModal('settings'))}
        >
          <Settings size={20} strokeWidth={1.75} />
        </SidebarButton>
      </div>
    </div>
  );
};

export default Sidebar;
