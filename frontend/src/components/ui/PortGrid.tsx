import React from 'react';
import { Icon } from '@iconify/react';
import type { Port } from '@/types/network';

interface PortGridProps {
  ports: Port[];
  selectedPortId: number | null;
  onPortSelect: (portId: number) => void;
  /** Port id → what it is linked to ("SW-Office (porta 8)"); only linked ports are present */
  linkedPorts?: ReadonlyMap<number, string>;
}

/**
 * PortGrid Component
 * Displays network device ports in an 8-column grid with visual status indicators
 * Color coding: green (enabled/access), purple (trunk), gray (disabled)
 * A link marker on the right edge flags ports that have a connection attached
 */
const PortGrid: React.FC<PortGridProps> = ({ ports, selectedPortId, onPortSelect, linkedPorts }) => {
  const getPortStatusClass = (port: Port): string => {
    if (!port.enabled) return 'port-box-disabled';
    if (port.portType === 'trunk') return 'port-box-trunk';
    return 'port-box-access'; // default: access mode
  };

  const getPortStatusColor = (port: Port): string => {
    if (!port.enabled) return 'var(--text-color-light)';
    if (port.portType === 'trunk') return '#9333ea'; // Purple
    return '#10b981'; // Green
  };

  return (
    <div className="port-grid">
      {ports.map((port) => {
        const linkedTo = linkedPorts?.get(port.id);
        const baseTitle = port.name || `Port ${port.id}`;

        return (
          <button
            key={port.id}
            className={`port-box ${getPortStatusClass(port)} ${selectedPortId === port.id ? 'port-box-selected' : ''}`}
            onClick={() => onPortSelect(port.id)}
            title={linkedTo ? `${baseTitle} — collegata a ${linkedTo}` : baseTitle}
          >
            {/* Port Number */}
            <div className="port-number" style={{ color: getPortStatusColor(port) }}>
              {port.id}
            </div>

            {/* Port Name (if custom name set) */}
            {port.name && (
              <div className="port-name" title={port.name}>
                {port.name}
              </div>
            )}

            {/* PoE Indicator */}
            {port.poe && port.enabled && (
              <div className="port-poe-indicator" title="PoE Enabled">
                <Icon icon="mdi:lightning-bolt" width={14} height={14} />
              </div>
            )}

            {/* Port Type Badge */}
            {port.enabled && port.portType && (
              <div className="port-type-badge">
                {port.portType === 'trunk' && 'T'}
                {port.portType === 'access' && 'A'}
                {port.portType === 'wan' && 'W'}
                {port.portType === 'lan' && 'L'}
                {port.portType === 'dmz' && 'D'}
              </div>
            )}

            {/* Link Marker: a connection is attached to this port */}
            {linkedTo && (
              <div
                className="absolute top-1/2 -right-2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent-color)] text-white shadow"
                title={`Collegata a ${linkedTo}`}
                data-testid={`port-link-marker-${port.id}`}
              >
                <Icon icon="mdi:link-variant" width={11} height={11} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PortGrid;
