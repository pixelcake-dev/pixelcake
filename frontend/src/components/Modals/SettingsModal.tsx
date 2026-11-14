import { useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useUIStore } from '@/store/uiStore';
import Logo from '@/components/ui/Logo';
import { useT } from '@/i18n';
import NetworkSettingsTab from './NetworkSettingsTab';
import AppearanceSettingsTab from './AppearanceSettingsTab';
import TemplatesSettingsTab from './TemplatesSettingsTab';
import AdvancedSettingsTab from './AdvancedSettingsTab';

type SettingsTab = 'network' | 'appearance' | 'templates' | 'advanced';

/** The tabs, in the order they are shown (each is named when it is drawn) */
const TABS: SettingsTab[] = ['network', 'appearance', 'templates', 'advanced'];

const FIRST_TAB: SettingsTab = 'network';

const SettingsModal = () => {
  const t = useT();
  const isOpen = useUIStore((state) => state.modals.settings);
  const closeModal = useUIStore((state) => state.closeModal);

  const [activeTab, setActiveTab] = useState<SettingsTab>(FIRST_TAB);

  const handleClose = () => {
    closeModal('settings');
    // Reset to first tab on close
    setActiveTab(FIRST_TAB);
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
          <div className="modal-header flex items-center justify-between mx-6 pt-5 pb-3 flex-shrink-0">
            <h3 className="text-base font-semibold tracking-tight">{t.settings.title}</h3>
            <button
              onClick={handleClose}
              className="p-1 text-[var(--text-color-light)] hover:text-[var(--text-color)] hover:bg-[var(--bg-hover)] rounded transition-colors"
              aria-label={t.ui.closeWindow}
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="settings-tabs px-6 pt-1 border-b border-[var(--border-color)]">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {t.settings.tabs[tab]}
              </button>
            ))}
          </div>
        </>
      }
      footer={
        <div className="modal-actions px-6 pb-6 pt-4">
          <div className="flex items-center justify-center gap-2 w-full">
            <Logo symbol size={18} />
            <p className="text-sm text-[var(--text-color-light)] italic">
              {t.common.quote(t.common.brand.motto)}
            </p>
          </div>
        </div>
      }
    >
      {/* Tab Content */}
      <div className="settings-content">
        {activeTab === 'network' && <NetworkSettingsTab />}

        {activeTab === 'appearance' && <AppearanceSettingsTab />}

        {activeTab === 'templates' && <TemplatesSettingsTab />}

        {activeTab === 'advanced' && <AdvancedSettingsTab />}
      </div>
    </Modal>
  );
};

export default SettingsModal;
