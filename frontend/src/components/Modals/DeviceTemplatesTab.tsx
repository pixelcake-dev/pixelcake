/**
 * Device Templates Tab
 * Manages device templates (generic and custom)
 */

import { useState } from 'react';
import { useTemplateStore } from '@/store/templateStore';
import GenericTemplatesTab from './GenericTemplatesTab';
import CustomTemplatesTab from './CustomTemplatesTab';

const DeviceTemplatesTab = () => {
  const templates = useTemplateStore((state) => state.templates);
  const [templateTab, setTemplateTab] = useState<'generic' | 'custom'>('generic');

  // Filter templates by type
  const genericTemplates = templates.filter((t) => !t.isCustom);
  const customTemplates = templates.filter((t) => t.isCustom);

  return (
    <div>
      {/* Sub-tabs for Device Templates */}
      <div className="settings-tabs mb-4">
        <button
          className={`settings-tab ${templateTab === 'generic' ? 'active' : ''}`}
          onClick={() => setTemplateTab('generic')}
        >
          Dispositivi Generici
        </button>
        <button
          className={`settings-tab ${templateTab === 'custom' ? 'active' : ''}`}
          onClick={() => setTemplateTab('custom')}
        >
          Dispositivi Custom
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
