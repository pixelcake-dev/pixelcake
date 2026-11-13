/**
 * Appearance Settings Tab
 * Light or dark: the one choice there is about how the app looks
 */

import { useUIStore } from '@/store/uiStore';
import { Icon } from '@iconify/react';

const AppearanceSettingsTab = () => {
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);

  return (
    <div className="settings-panel">
      <h3>Impostazioni Aspetto</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-6">
        Interfaccia chiara o scura. La scelta resta salvata in questo browser.
      </p>

      {/* Dark Mode Toggle */}
      <h4 className="text-base font-semibold mb-3">Modalità Scura</h4>
      <button
        type="button"
        role="switch"
        aria-checked={darkMode}
        className="w-full text-left flex items-center justify-between p-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--accent-color)] transition-colors"
        onClick={toggleDarkMode}
      >
        <span className="flex items-center gap-3">
          <Icon
            icon={darkMode ? 'mdi:weather-night' : 'mdi:weather-sunny'}
            width={24}
            className="text-[var(--accent-color)]"
          />
          <span>
            <span className="block font-medium">
              {darkMode ? 'Modalità Scura Attiva' : 'Modalità Chiara Attiva'}
            </span>
            <span className="block text-sm text-[var(--text-color-light)]">
              Clicca per passare alla modalità {darkMode ? 'chiara' : 'scura'}
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative w-14 h-7 rounded-full transition-colors ${
            darkMode ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
              darkMode ? 'right-1' : 'left-1'
            }`}
          />
        </span>
      </button>
    </div>
  );
};

export default AppearanceSettingsTab;
