/**
 * Templates Settings Tab
 * Container for connection and device template management
 */

import { useState } from 'react';
import ConnectionTemplatesTab from './ConnectionTemplatesTab';
import DeviceTemplatesTab from './DeviceTemplatesTab';
import { useT } from '@/i18n';

const TemplatesSettingsTab = () => {
  const t = useT();
  const [templateType, setTemplateType] = useState<'connections' | 'devices'>('connections');

  return (
    <div className="settings-panel">
      <h3>{t.templates.title}</h3>

      {/* Sub-tabs: Connections and Devices */}
      <div className="settings-tabs mb-4">
        <button
          className={`settings-tab ${templateType === 'connections' ? 'active' : ''}`}
          onClick={() => setTemplateType('connections')}
        >
          {t.templates.kinds.links}
        </button>
        <button
          className={`settings-tab ${templateType === 'devices' ? 'active' : ''}`}
          onClick={() => setTemplateType('devices')}
        >
          {t.templates.kinds.devices}
        </button>
      </div>

      {/* Template Type Content */}
      <div className="template-content">
        {templateType === 'connections' && <ConnectionTemplatesTab />}
        {templateType === 'devices' && <DeviceTemplatesTab />}
      </div>
    </div>
  );
};

export default TemplatesSettingsTab;
