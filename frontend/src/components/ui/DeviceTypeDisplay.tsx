import { Icon } from '@iconify/react';
import { useTemplateStore } from '@/store/templateStore';

interface DeviceTypeDisplayProps {
  deviceType: string;
  label?: string;
}

/**
 * DeviceTypeDisplay - Read-only display of device type with icon
 * Shows device type as a styled card with icon preview
 */
export const DeviceTypeDisplay = ({ deviceType, label }: DeviceTypeDisplayProps) => {
  const templates = useTemplateStore((state) => state.templates);
  const template = templates.find((t) => t.type === deviceType);

  // Fallback if template not found
  const icon = template?.icon || 'mdi:help-circle';
  const color = template?.color || '#5E8096';
  const name = template?.name || deviceType;

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-[var(--text-color-light)] mb-1.5">
          {label}
        </label>
      )}

      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'var(--bg-toolbar)',
        }}
      >
        {/* Device Icon */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-small)',
            backgroundColor: 'var(--bg-component)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={icon} width={24} height={24} style={{ color }} />
        </div>

        {/* Device Type Name */}
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>
            {name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-color-light)' }}>
            Device Type
          </div>
        </div>
      </div>
    </div>
  );
};
