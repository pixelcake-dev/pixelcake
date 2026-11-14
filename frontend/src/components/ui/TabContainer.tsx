import { type ReactNode, useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabContainerProps {
  tabs: Tab[];
  defaultTab?: string;
  /**
   * The open tab, when whoever uses the container decides it (together with
   * `onTabChange`): a window can then send to one of its own tabs. Left out,
   * the container keeps track of the open tab by itself.
   */
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
}

/**
 * TabContainer - Reusable tab system for modals and panels
 * Provides a clean tab interface with active state management
 */
const TabContainer = ({ tabs, defaultTab, activeTab, onTabChange, className = '' }: TabContainerProps) => {
  const [ownTab, setOwnTab] = useState(defaultTab || tabs[0]?.id || '');
  const openTab = activeTab ?? ownTab;
  const open = (id: string) => {
    setOwnTab(id);
    onTabChange?.(id);
  };

  const activeTabContent = tabs.find((tab) => tab.id === openTab)?.content;

  return (
    <div className={`tab-container ${className}`}>
      {/* Tab Headers */}
      <div className="tab-headers" style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '20px',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-header ${openTab === tab.id ? 'active' : ''}`}
            onClick={() => open(tab.id)}
            style={{
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              color: openTab === tab.id ? 'var(--text-color)' : 'var(--text-color-light)',
              fontWeight: openTab === tab.id ? 600 : 400,
              fontSize: '14px',
              cursor: 'pointer',
              borderBottom: openTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 0.12s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTabContent}
      </div>
    </div>
  );
};

export default TabContainer;
