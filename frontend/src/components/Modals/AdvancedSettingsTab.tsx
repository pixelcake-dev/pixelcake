/**
 * Advanced Settings Tab
 * Displays usage statistics and the keyboard and mouse shortcuts
 */

import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { Icon } from '@iconify/react';

/**
 * Every line here is something the application really does; keep it that
 * way when adding one.
 * - Ctrl+S: registerSaveShortcut (utils/projectFileAccess.ts), tested in
 *   App.test.tsx
 * - the others: NetworkCanvas, each one exercised in NetworkCanvas.test.tsx.
 *   Ctrl+C / Ctrl+V are its keydown handler, the rest are ReactFlow props:
 *   deleteKeyCode="Delete", multiSelectionKeyCode="Control", selectionOnDrag,
 *   panOnDrag={[2]} (the numbers are MouseEvent.button values: 2 is the right
 *   button) and the wheel zoom React Flow has on by default
 */
const SHORTCUTS: Array<{ action: string; keys: string }> = [
  { action: 'Salva il progetto su file', keys: 'Ctrl + S' },
  { action: 'Copia i dispositivi selezionati', keys: 'Ctrl + C' },
  { action: 'Incolla i dispositivi copiati', keys: 'Ctrl + V' },
  { action: 'Elimina i dispositivi selezionati', keys: 'Canc' },
  { action: 'Aggiungi o togli un dispositivo dalla selezione', keys: 'Ctrl + Clic' },
  { action: 'Seleziona più dispositivi con un riquadro', keys: "Trascina su un'area vuota" },
  { action: 'Sposta la vista', keys: 'Tasto destro + trascina' },
  { action: 'Zoom', keys: 'Rotellina del mouse' },
];

const AdvancedSettingsTab = () => {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const templates = useTemplateStore((state) => state.templates);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);

  // Calculate statistics
  const customDeviceTemplates = templates.filter((t) => t.isCustom).length;
  const customConnectionTemplates = connectionTemplates.filter((t) => t.isCustom).length;

  return (
    <div className="settings-panel">
      {/* Usage Statistics Section */}
      <h3>Statistiche Utilizzo</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">
        Statistiche sull'utilizzo corrente dell'applicazione.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Devices Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:router-network" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">Dispositivi nel Canvas</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">{devices.length}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Dispositivi nel canvas aperto
          </p>
        </div>

        {/* Connections Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:connection" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">Connessioni nel Canvas</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">{connections.length}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Connessioni attive tra dispositivi
          </p>
        </div>

        {/* Custom Device Templates Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:shape" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">Template Dispositivi Custom</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">{customDeviceTemplates}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Template personalizzati creati
          </p>
        </div>

        {/* Custom Connection Templates Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:vector-line" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">Template Connessioni Custom</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">
            {customConnectionTemplates}
          </p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">
            Template connessioni personalizzati
          </p>
        </div>
      </div>

      {/* Keyboard Shortcuts Section */}
      <hr className="my-6 border-[var(--border-color)]" />

      <h3>Scorciatoie da Tastiera e Mouse</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">
        Comandi da tastiera e da mouse per lavorare sul canvas.
      </p>

      <div className="space-y-2">
        {SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.action}
            className="flex items-center justify-between gap-4 p-3 bg-[var(--bg-canvas)] rounded border border-[var(--border-color)]"
          >
            <span className="text-sm">{shortcut.action}</span>
            <kbd className="px-2 py-1 bg-[var(--bg-component)] border border-[var(--border-color)] rounded text-xs font-mono whitespace-nowrap">
              {shortcut.keys}
            </kbd>
          </div>
        ))}
      </div>

      {/* Extra spacing at bottom for scrolling */}
      <div className="pb-64"></div>
    </div>
  );
};

export default AdvancedSettingsTab;
