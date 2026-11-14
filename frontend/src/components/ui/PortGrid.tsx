import React from 'react';
import { Icon } from '@iconify/react';
import { portVlanText } from '@/utils/portSummary';
import { useVlanNames } from '@/utils/useVlanNames';
import { useT } from '@/i18n';
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
 * Displays the ports of a device as a row of boxes that wraps, each with its
 * number, its name and its marks
 * Color coding: green (enabled/access), purple (trunk), gray (disabled)
 * A link marker in the corner flags ports that have a connection attached
 * Resting the pointer on a port says its name, its VLAN (with the name the
 * project gave it) and what it is linked to
 */
const PortGrid: React.FC<PortGridProps> = ({ ports, selectedPortId, onPortSelect, linkedPorts }) => {
  const t = useT();
  const names = useVlanNames();
  const getPortStatusClass = (port: Port): string => {
    if (!port.enabled) return 'port-box-disabled';
    if (port.portType === 'trunk') return 'port-box-trunk';
    return 'port-box-access'; // default: access mode
  };

  const getPortStatusColor = (port: Port): string => {
    if (!port.enabled) return 'var(--text-color-light)';
    if (port.portType === 'trunk') return 'var(--trunk-color)';
    return 'var(--ok-color)';
  };

  return (
    <div className="port-grid">
      {ports.map((port) => {
        const linkedTo = linkedPorts?.get(port.id);
        const title = t.interfaces.grid.title(
          port.name || t.interfaces.port.defaultName(port.id),
          portVlanText(port, ports, names),
          linkedTo
        );

        return (
          <button
            key={port.id}
            className={`port-box ${getPortStatusClass(port)} ${selectedPortId === port.id ? 'port-box-selected' : ''}`}
            onClick={() => onPortSelect(port.id)}
            title={title}
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

            {/* Port Type Badge, and power over the cable next to it */}
            {port.enabled && (port.portType || port.poe) && (
              <div className="port-type-badge">
                {port.portType === 'trunk' && 'T'}
                {port.portType === 'access' && 'A'}
                {port.portType === 'wan' && 'W'}
                {port.portType === 'lan' && 'L'}
                {port.portType === 'dmz' && 'D'}
                {port.poe && (
                  <span className="port-poe-indicator" title={t.interfaces.grid.poe}>
                    <Icon icon="mdi:lightning-bolt" width={10} height={10} />
                  </span>
                )}
              </div>
            )}

            {/* Link Marker: a connection is attached to this port */}
            {linkedTo && (
              <div
                className="port-link-marker"
                title={t.interfaces.link.linkedToPeer(linkedTo)}
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
