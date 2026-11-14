/**
 * Appearance Settings Tab
 * Light or dark: the one choice there is about how the app looks
 */

import { useUIStore } from '@/store/uiStore';
import { Icon } from '@iconify/react';
import { Languages } from 'lucide-react';
import { LANGUAGE_NAMES, useLanguage, useT } from '@/i18n';
import LanguageSwitch from '@/components/ui/LanguageSwitch';

const AppearanceSettingsTab = () => {
  const t = useT();
  const language = useLanguage();
  const darkMode = useUIStore((state) => state.darkMode);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);

  return (
    <div className="settings-panel">
      <h3>{t.settings.appearance.title}</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-6">{t.settings.appearance.intro}</p>

      {/* Dark Mode Toggle */}
      <h4 className="text-base font-semibold mb-3">{t.settings.appearance.darkMode}</h4>
      <button
        type="button"
        role="switch"
        aria-checked={darkMode}
        className="w-full text-left flex items-center justify-between p-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--text-color)] transition-colors"
        onClick={toggleDarkMode}
      >
        <span className="flex items-center gap-3">
          <Icon
            icon={darkMode ? 'mdi:weather-night' : 'mdi:weather-sunny'}
            width={24}
            className="text-[var(--text-color-light)]"
          />
          <span>
            <span className="block font-medium">
              {t.settings.appearance.modeOn(darkMode ? 'dark' : 'light')}
            </span>
            <span className="block text-sm text-[var(--text-color-light)]">
              {t.settings.appearance.switchTo(darkMode ? 'light' : 'dark')}
            </span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative w-12 h-6 rounded transition-colors ${
            darkMode ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-sm transition-transform ${
              darkMode ? 'right-1' : 'left-1'
            }`}
          />
        </span>
      </button>

      {/* The language of the interface: the same switch as on the menu bar */}
      <h4 className="text-base font-semibold mt-6 mb-3">{t.settings.appearance.language}</h4>
      <div className="flex items-center justify-between gap-4 p-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg">
        <span className="flex items-center gap-3">
          <Languages size={24} className="text-[var(--text-color-light)] flex-shrink-0" aria-hidden="true" />
          <span>
            <span className="block font-medium" lang={language}>
              {LANGUAGE_NAMES[language]}
            </span>
            <span className="block text-sm text-[var(--text-color-light)]">
              {t.settings.appearance.languageHint}
            </span>
          </span>
        </span>
        <LanguageSwitch />
      </div>
    </div>
  );
};

export default AppearanceSettingsTab;
