/**
 * Device Templates Tab
 * Manages device templates (generic and custom)
 */

import { useState } from 'react';
import { useTemplateStore } from '@/store/templateStore';
import GenericTemplatesTab from './GenericTemplatesTab';
import CustomTemplatesTab from './CustomTemplatesTab';
import { useT } from '@/i18n';

const DeviceTemplatesTab = () => {
  const t = useT();
  const templates = useTemplateStore((state) => state.templates);
  const [templateTab, setTemplateTab] = useState<'generic' | 'custom'>('generic');

  // Filter templates by type
  const genericTemplates = templates.filter((template) => !template.isCustom);
  const customTemplates = templates.filter((template) => template.isCustom);

  return (
    <div>
      {/* Sub-tabs for Device Templates */}
      <div className="settings-tabs mb-4">
        <button
          className={`settings-tab ${templateTab === 'generic' ? 'active' : ''}`}
          onClick={() => setTemplateTab('generic')}
        >
          {t.templates.devices.tabs.generic}
        </button>
        <button
          className={`settings-tab ${templateTab === 'custom' ? 'active' : ''}`}
          onClick={() => setTemplateTab('custom')}
        >
          {t.templates.devices.tabs.custom}
        </button>
      </div>

      {/* Template Tab Content */}
      <div>
        {templateTab === 'generic' && <GenericTemplatesTab templates={genericTemplates} />}
        {templateTab === 'custom' && <CustomTemplatesTab templates={customTemplates} />}
      </div>
    </div>
  );
};

export default DeviceTemplatesTab;
