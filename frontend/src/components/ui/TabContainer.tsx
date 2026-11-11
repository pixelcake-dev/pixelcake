import { type ReactNode, useState } from 'react';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabContainerProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

/**
 * TabContainer - Reusable tab system for modals and panels
 * Provides a clean tab interface with active state management
 */
const TabContainer = ({ tabs, defaultTab, className = '' }: TabContainerProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={`tab-container ${className}`}>
      {/* Tab Headers */}
      <div className="tab-headers" style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '2px solid var(--border-color)',
        marginBottom: '20px',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-header ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--accent-color)' : 'var(--text-color-light)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '14px',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all 0.2s ease',
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
