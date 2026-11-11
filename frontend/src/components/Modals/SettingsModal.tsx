import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useUIStore } from '@/store/uiStore';
import Logo from '@/components/ui/Logo';
import UserSettingsTab from './UserSettingsTab';
import NetworkSettingsTab from './NetworkSettingsTab';
import AppearanceSettingsTab from './AppearanceSettingsTab';
import TemplatesSettingsTab from './TemplatesSettingsTab';
import AdvancedSettingsTab from './AdvancedSettingsTab';

type SettingsTab = 'user' | 'network' | 'appearance' | 'templates' | 'advanced';

const SettingsModal = () => {
  const isOpen = useUIStore((state) => state.modals.settings);
  const closeModal = useUIStore((state) => state.closeModal);

  const [activeTab, setActiveTab] = useState<SettingsTab>('user');

  const handleClose = () => {
    closeModal('settings');
    // Reset to first tab on close
    setActiveTab('user');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title=""
      size="md"
      variant="tabbed"
      autoHeight={true}
      minHeight={undefined}
      maxHeight="calc(90vh - 120px)"
      verticalAlign="start"
      fixedContent={
        <>
          {/* Header with Title and Close Button */}
          <div className="modal-header flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
            <h3 className="text-lg font-semibold">Impostazioni</h3>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-[var(--bg-canvas)] rounded transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="settings-tabs px-6 pt-2 pb-3 border-b border-[var(--border-color)]">
            <button
              className={`settings-tab ${activeTab === 'user' ? 'active' : ''}`}
              onClick={() => setActiveTab('user')}
            >
              Utente
            </button>
            <button
              className={`settings-tab ${activeTab === 'network' ? 'active' : ''}`}
              onClick={() => setActiveTab('network')}
            >
              Rete
            </button>
            <button
              className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              Aspetto
            </button>
            <button
              className={`settings-tab ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              Template
            </button>
            <button
              className={`settings-tab ${activeTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setActiveTab('advanced')}
            >
              Avanzate
            </button>
          </div>
        </>
      }
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <div className="flex items-center justify-center gap-2 w-full">
            <Logo size={24} />
            <p className="text-sm text-[var(--text-color-light)] italic">
              "Infrastructure, piece by piece."
            </p>
          </div>
        </div>
      }
    >
      {/* Tab Content */}
      <div className="settings-content">
        {activeTab === 'user' && <UserSettingsTab />}

        {activeTab === 'network' && <NetworkSettingsTab />}

        {activeTab === 'appearance' && <AppearanceSettingsTab />}

        {activeTab === 'templates' && <TemplatesSettingsTab />}

        {activeTab === 'advanced' && <AdvancedSettingsTab />}
      </div>
    </Modal>
  );
};

export default SettingsModal;
