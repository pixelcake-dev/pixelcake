/**
 * Advanced Settings Tab
 * Displays usage statistics and the keyboard and mouse shortcuts
 */

import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { Icon } from '@iconify/react';
import { useT, type Dictionary } from '@/i18n';

/**
 * The shortcuts, in the order they are listed; what each does and its keys
 * are in the dictionary (`advanced.shortcuts.rows`), read when the list is
 * drawn. Every line here is something the application really does; keep it
 * that way when adding one.
 * - Ctrl+S: registerSaveShortcut (utils/projectFileAccess.ts), tested in
 *   App.test.tsx
 * - the others: NetworkCanvas, each one exercised in NetworkCanvas.test.tsx.
 *   Ctrl+C / Ctrl+V are its keydown handler, the rest are ReactFlow props:
 *   deleteKeyCode="Delete", multiSelectionKeyCode="Control", selectionOnDrag,
 *   panOnDrag={[2]} (the numbers are MouseEvent.button values: 2 is the right
 *   button) and the wheel zoom React Flow has on by default
 */
const SHORTCUTS: Array<keyof Dictionary['advanced']['shortcuts']['rows']> = [
  'save',
  'copy',
  'paste',
  'delete',
  'toggleSelection',
  'selectionBox',
  'pan',
  'zoom',
];

const AdvancedSettingsTab = () => {
  const { usage, shortcuts } = useT().advanced;
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const templates = useTemplateStore((state) => state.templates);
  const connectionTemplates = useTemplateStore((state) => state.connectionTemplates);

  // Calculate statistics
  const customDeviceTemplates = templates.filter((template) => template.isCustom).length;
  const customConnectionTemplates = connectionTemplates.filter((template) => template.isCustom).length;

  return (
    <div className="settings-panel">
      {/* Usage Statistics Section */}
      <h3>{usage.title}</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">{usage.intro}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Devices Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:router-network" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">{usage.devices.title}</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">{devices.length}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">{usage.devices.caption}</p>
        </div>

        {/* Connections Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:connection" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">{usage.links.title}</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">{connections.length}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">{usage.links.caption}</p>
        </div>

        {/* Custom Device Templates Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:shape" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">{usage.deviceTemplates.title}</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">{customDeviceTemplates}</p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">{usage.deviceTemplates.caption}</p>
        </div>

        {/* Custom Connection Templates Count */}
        <div className="p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--border-color)]">
          <div className="flex items-center gap-3 mb-2">
            <Icon icon="mdi:vector-line" className="text-[var(--text-color-light)]" width={24} />
            <p className="font-semibold">{usage.linkTemplates.title}</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-[var(--text-color)]">
            {customConnectionTemplates}
          </p>
          <p className="text-xs text-[var(--text-color-light)] mt-1">{usage.linkTemplates.caption}</p>
        </div>
      </div>

      {/* Keyboard Shortcuts Section */}
      <hr className="my-6 border-[var(--border-color)]" />

      <h3>{shortcuts.title}</h3>
      <p className="text-sm text-[var(--text-color-light)] mb-4">{shortcuts.intro}</p>

      <div className="space-y-2">
        {SHORTCUTS.map((id) => (
          <div
            key={id}
            className="flex items-center justify-between gap-4 p-3 bg-[var(--bg-canvas)] rounded border border-[var(--border-color)]"
          >
            <span className="text-sm">{shortcuts.rows[id].action}</span>
            <kbd className="px-2 py-1 bg-[var(--bg-component)] border border-[var(--border-color)] rounded text-xs font-mono whitespace-nowrap">
              {shortcuts.rows[id].keys}
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
