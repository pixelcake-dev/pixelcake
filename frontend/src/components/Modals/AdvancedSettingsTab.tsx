/**
 * Advanced Settings Tab
 * Displays usage statistics and general preferences
 */

import { Select } from '@/components/ui/Select';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { useUserStore } from '@/store/userStore';
import { Icon } from '@iconify/react';

const AdvancedSettingsTab = () => {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const templates = useTemplateStore((state) => state.templates);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);

  const preferences = useUserStore((state) => state.preferences);
  const setLanguage = useUserStore((state) => state.setLanguage);
  const setDateFormat = useUserStore((state) => state.setDateFormat);
  const setUnitSystem = useUserStore((state) => state.setUnitSystem);

  // Calculate statistics
  const customDeviceTemplates = templates.filter((t) => t.isCustom).length;
  const customConnectionTemplates = connectionTemplates.filter((t) => t.isCustom).length;

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'it' | 'en');
  };

  const handleDateFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDateFormat(e.target.value as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD');
  };

  const handleUnitSystemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUnitSystem(e.target.value as 'metric' | 'imperial');
  };

  return (
    <div className="settings-panel">
      {/* Usage Statistics Section */}
      <h3>Statistiche Utilizzo</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">
        Statistiche sull'utilizzo corrente dell'applicazione.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Devices Count */}
        <div className="p-4 bg-[var(--color-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:router-network" className="text-[var(--accent-color)]" width={24} />
            <p className="font-semibold">Dispositivi nel Canvas</p>
          </div>
          <p className="text-3xl font-bold text-[var(--accent-color)]">{devices.length}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Dispositivi attualmente nel progetto
          </p>
        </div>

        {/* Connections Count */}
        <div className="p-4 bg-[var(--color-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:connection" className="text-[var(--accent-color)]" width={24} />
            <p className="font-semibold">Connessioni nel Canvas</p>
          </div>
          <p className="text-3xl font-bold text-[var(--accent-color)]">{connections.length}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Connessioni attive tra dispositivi
          </p>
        </div>

        {/* Custom Device Templates Count */}
        <div className="p-4 bg-[var(--color-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:shape" className="text-[var(--accent-color)]" width={24} />
            <p className="font-semibold">Template Dispositivi Custom</p>
          </div>
          <p className="text-3xl font-bold text-[var(--accent-color)]">{customDeviceTemplates}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Template personalizzati creati
          </p>
        </div>

        {/* Custom Connection Templates Count */}
        <div className="p-4 bg-[var(--color-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:vector-line" className="text-[var(--accent-color)]" width={24} />
            <p className="font-semibold">Template Connessioni Custom</p>
          </div>
          <p className="text-3xl font-bold text-[var(--accent-color)]">
            {customConnectionTemplates}
          </p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Template connessioni personalizzati
          </p>
        </div>
      </div>

      {/* General Preferences Section */}
      <hr className="my-6 border-[var(--border-color)]" />

      <h3>Preferenze Generali</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">
        Configura le preferenze generali dell'applicazione.
      </p>

      <div className="space-y-4 mb-6">
        {/* Language */}
        <Select
          label="Lingua Interfaccia"
          value={preferences.language}
          onChange={handleLanguageChange}
          size="md"
        >
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </Select>

        {/* Date Format */}
        <Select
          label="Formato Data"
          value={preferences.dateFormat}
          onChange={handleDateFormatChange}
          size="lg"
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY (Europeo)</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY (Americano)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
        </Select>

        {/* Unit System */}
        <Select
          label="Sistema di Unità"
          value={preferences.unitSystem}
          onChange={handleUnitSystemChange}
          size="lg"
        >
          <option value="metric">Metrico (m, km, kg)</option>
          <option value="imperial">Imperiale (ft, mi, lb)</option>
        </Select>
      </div>

      <p className="text-xs text-[var(--text-color-light)] italic">
        Le modifiche alle preferenze vengono salvate automaticamente.
      </p>

      {/* Keyboard Shortcuts Section */}
      <hr className="my-6 border-[var(--border-color)]" />

      <h3>Scorciatoie da Tastiera</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">
        Elenco delle scorciatoie da tastiera disponibili.
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-[var(--color-canvas)] rounded border border-[var(--border-color)]">
          <span className="text-sm">Auto-Layout Rete</span>
          <kbd className="px-2 py-1 bg-[var(--color-bg)] border border-[var(--border-color)] rounded text-xs font-mono">
            Ctrl + L
          </kbd>
        </div>

        <div className="flex items-center justify-between p-3 bg-[var(--color-canvas)] rounded border border-[var(--border-color)]">
          <span className="text-sm">Selezione Multipla</span>
          <kbd className="px-2 py-1 bg-[var(--color-bg)] border border-[var(--border-color)] rounded text-xs font-mono">
            Shift + Click
          </kbd>
        </div>

        <div className="flex items-center justify-between p-3 bg-[var(--color-canvas)] rounded border border-[var(--border-color)]">
          <span className="text-sm">Box Selection</span>
          <kbd className="px-2 py-1 bg-[var(--color-bg)] border border-[var(--border-color)] rounded text-xs font-mono">
            Click + Drag
          </kbd>
        </div>

        <div className="flex items-center justify-between p-3 bg-[var(--color-canvas)] rounded border border-[var(--border-color)]">
          <span className="text-sm">Pan Canvas</span>
          <kbd className="px-2 py-1 bg-[var(--color-bg)] border border-[var(--border-color)] rounded text-xs font-mono">
            Middle Mouse / Right Mouse
          </kbd>
        </div>

        <div className="flex items-center justify-between p-3 bg-[var(--color-canvas)] rounded border border-[var(--border-color)]">
          <span className="text-sm">Zoom</span>
          <kbd className="px-2 py-1 bg-[var(--color-bg)] border border-[var(--border-color)] rounded text-xs font-mono">
            Mouse Wheel
          </kbd>
        </div>
      </div>

      {/* Extra spacing at bottom for scrolling */}
      <div className="pb-64"></div>
    </div>
  );
};

export default AdvancedSettingsTab;
