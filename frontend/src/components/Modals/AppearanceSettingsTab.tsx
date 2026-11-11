/**
 * Appearance Settings Tab
 * Manages theme selection and dark mode preferences
 */

import { useUIStore } from '@/store/uiStore';
import { Icon } from '@iconify/react';

const AppearanceSettingsTab = () => {
  const darkMode = useUIStore((state) => state.darkMode);
  const theme = useUIStore((state) => state.theme);
  const toggleDarkMode = useUIStore((state) => state.toggleDarkMode);
  const setTheme = useUIStore((state) => state.setTheme);

  const themes = [
    {
      id: 'pixelcake' as const,
      name: 'PixelCake',
      description: 'Tema originale con colori del logo',
      colors: {
        light: { primary: '#5B7C8D', secondary: '#F47920' },
        dark: { primary: '#F47920', secondary: '#5B7C8D' },
      },
    },
    {
      id: 'modern-tech' as const,
      name: 'Modern Tech',
      description: 'Tema moderno con blu e teal',
      colors: {
        light: { primary: '#007aff', secondary: '#14B8A6' },
        dark: { primary: '#0a84ff', secondary: '#2DD4BF' },
      },
    },
  ];

  return (
    <div className="settings-panel">
      <h3>Impostazioni Aspetto</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-6">
        Personalizza l'aspetto dell'interfaccia con temi e modalità scura.
      </p>

      {/* Dark Mode Toggle */}
      <div className="mb-8">
        <h4 className="text-base font-semibold mb-3">Modalità Scura</h4>
        <div
          className="flex items-center justify-between p-4 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--accent-color)] transition-colors"
          onClick={toggleDarkMode}
        >
          <div className="flex items-center gap-3">
            <Icon
              icon={darkMode ? 'mdi:weather-night' : 'mdi:weather-sunny'}
              width={24}
              className="text-[var(--accent-color)]"
            />
            <div>
              <p className="font-medium">
                {darkMode ? 'Modalità Scura Attiva' : 'Modalità Chiara Attiva'}
              </p>
              <p className="text-sm text-[var(--text-color-light)]">
                Clicca per passare alla modalità {darkMode ? 'chiara' : 'scura'}
              </p>
            </div>
          </div>
          <div
            className={`relative w-14 h-7 rounded-full transition-colors ${
              darkMode ? 'bg-[var(--accent-color)]' : 'bg-[var(--border-color)]'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                darkMode ? 'right-1' : 'left-1'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Theme Selection */}
      <div>
        <h4 className="text-base font-semibold mb-3">Tema Colore</h4>
        <p className="text-sm text-[var(--text-color-light)] mb-4">
          Seleziona il tema che preferisci. I colori si adattano automaticamente alla modalità
          scura.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {themes.map((themeOption) => {
            const isSelected = theme === themeOption.id;

            return (
              <div
                key={themeOption.id}
                className={`relative border-2 rounded-lg cursor-pointer transition-all overflow-hidden ${
                  isSelected
                    ? 'border-[var(--accent-color)]'
                    : 'border-[var(--border-color)] hover:border-[var(--accent-color)]'
                }`}
                onClick={() => setTheme(themeOption.id)}
                style={{ minHeight: '280px' }}
              >
                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 z-10 bg-green-500 rounded-full">
                    <Icon icon="mdi:check-circle" width={24} className="text-white" />
                  </div>
                )}

                {/* Split Diagonal Background */}
                <div className="relative w-full h-full">
                  {/* Light Mode Half (Top-Left) */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${themeOption.colors.light.primary} 0%, ${themeOption.colors.light.primary} 48%, transparent 48%, transparent 52%, ${themeOption.colors.dark.primary} 52%, ${themeOption.colors.dark.primary} 100%)`,
                    }}
                  />

                  {/* Content Overlay */}
                  <div className="relative z-[1] p-5 flex flex-col h-full">
                    {/* Header */}
                    <div className="mb-4">
                      <h5 className="font-semibold text-base mb-1 text-white drop-shadow-md">
                        {themeOption.name}
                      </h5>
                      <p className="text-sm text-white/90 drop-shadow">
                        {themeOption.description}
                      </p>
                    </div>

                    {/* Color Previews */}
                    <div className="flex-1 flex flex-col justify-between">
                      {/* Light Mode Section */}
                      <div className="flex items-start gap-2">
                        <Icon
                          icon="mdi:weather-sunny"
                          width={16}
                          className="text-white drop-shadow mt-1"
                        />
                        <div className="text-white drop-shadow">
                          <p className="text-xs font-semibold mb-1">Light</p>
                          <div className="flex gap-2">
                            <div
                              className="w-6 h-6 rounded border-2 border-white/50 shadow"
                              style={{ backgroundColor: themeOption.colors.light.primary }}
                              title={`Primary: ${themeOption.colors.light.primary}`}
                            />
                            <div
                              className="w-6 h-6 rounded border-2 border-white/50 shadow"
                              style={{ backgroundColor: themeOption.colors.light.secondary }}
                              title={`Secondary: ${themeOption.colors.light.secondary}`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Dark Mode Section */}
                      <div className="flex items-end justify-end gap-2">
                        <div className="text-white drop-shadow text-right">
                          <p className="text-xs font-semibold mb-1">Dark</p>
                          <div className="flex gap-2 justify-end">
                            <div
                              className="w-6 h-6 rounded border-2 border-white/50 shadow"
                              style={{ backgroundColor: themeOption.colors.dark.primary }}
                              title={`Primary: ${themeOption.colors.dark.primary}`}
                            />
                            <div
                              className="w-6 h-6 rounded border-2 border-white/50 shadow"
                              style={{ backgroundColor: themeOption.colors.dark.secondary }}
                              title={`Secondary: ${themeOption.colors.dark.secondary}`}
                            />
                          </div>
                        </div>
                        <Icon
                          icon="mdi:weather-night"
                          width={16}
                          className="text-white drop-shadow mb-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diagonal Separator Line */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(135deg, transparent 0%, transparent 49.5%, rgba(255,255,255,0.3) 49.5%, rgba(255,255,255,0.3) 50.5%, transparent 50.5%, transparent 100%)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
        <p className="text-sm text-[var(--text-color-light)] flex items-start gap-2">
          <Icon icon="mdi:information-outline" width={18} className="mt-0.5 flex-shrink-0" />
          <span>
            Il tema selezionato verrà applicato a tutti gli elementi interattivi: bottoni, link,
            hover, icone e animazioni. Prova a cambiare tema e modalità per vedere l'effetto!
          </span>
        </p>
      </div>
    </div>
  );
};

export default AppearanceSettingsTab;
