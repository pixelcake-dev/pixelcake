import { memo } from 'react';
import { Icon } from '@iconify/react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NetworkDevice as NetworkDeviceType } from '@/types/network';
import { DEVICE_ICONS } from '@/types/network';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { useUIStore } from '@/store/uiStore';

interface NetworkDeviceData extends NetworkDeviceType {
  isSelected?: boolean;
  onContextMenu?: (e: React.MouseEvent, device: NetworkDeviceType) => void;
  onDoubleClick?: (device: NetworkDeviceType) => void;
}

// Custom comparator for memo to prevent unnecessary re-renders
function arePropsEqual(
  prevProps: NodeProps<NetworkDeviceData>,
  nextProps: NodeProps<NetworkDeviceData>
): boolean {
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.data.label === nextProps.data.label &&
    prevProps.data.ip === nextProps.data.ip &&
    prevProps.data.type === nextProps.data.type &&
    prevProps.data.templateId === nextProps.data.templateId &&
    prevProps.data.position.x === nextProps.data.position.x &&
    prevProps.data.position.y === nextProps.data.position.y &&
    prevProps.data.isSelected === nextProps.data.isSelected
  );
}

const NetworkDevice = memo(({ data, id }: NodeProps<NetworkDeviceData>) => {
  const setHoveredDevice = useNetworkStore((state) => state.setHoveredDevice);
  const templates = useTemplateStore((state) => state.templates);
  const magnifiedDeviceTypes = useUIStore((state) => state.magnifiedDeviceTypes);

  // Find template by ID (preferred) or fallback to type (backward compatibility)
  const template = data.templateId
    ? templates.find((t) => t.id === data.templateId)
    : templates.find((t) => t.type === data.type);

  // Fallback to DEVICE_ICONS if template not found (backward compatibility)
  const deviceIcon = template?.icon || DEVICE_ICONS[data.type] || 'mdi:help-circle-outline';
  const deviceColor = template?.color || '#5B7C8D';

  // Magnification logic
  const isMagnified = magnifiedDeviceTypes.includes(data.type);
  const isDimmed = magnifiedDeviceTypes.length > 0 && !isMagnified;

  // Build CSS classes for magnification
  // Note: React Flow handles selection styling with .react-flow__node-selected class
  const magnifyClasses = isMagnified
    ? `device-magnified type-${data.type.toLowerCase()}`
    : isDimmed
    ? 'device-dimmed'
    : '';

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (data.onContextMenu) {
      data.onContextMenu(e, data);
    }
  };

  const handleDoubleClick = () => {
    if (data.onDoubleClick) {
      data.onDoubleClick(data);
    }
  };

  const handleMouseEnter = () => {
    setHoveredDevice(id);
  };

  const handleMouseLeave = () => {
    setHoveredDevice(null);
  };

  return (
    <div
      className={`network-device group ${magnifyClasses}`}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Connection Handles - 4 directions (source only with connectionMode="loose")
          Using only source handles with loose mode is the official React Flow pattern
          for bidirectional connections. This avoids handle overlap/z-index conflicts. */}

      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="connect-point connect-point-top"
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="connect-point connect-point-bottom"
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="connect-point connect-point-left"
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="connect-point connect-point-right"
        isConnectable={true}
      />

      {/* Device Content */}
      <div className="device-content pointer-events-none">
        <Icon
          icon={deviceIcon}
          width={48}
          height={48}
          className="device-icon mb-1"
          style={{ color: deviceColor }}
        />
        <span className="device-name font-semibold text-sm">
          {data.label}
        </span>
        <span className="device-ip text-xs text-gray-500 dark:text-gray-400 mt-1">
          {data.ip}
        </span>
      </div>
    </div>
  );
}, arePropsEqual);

NetworkDevice.displayName = 'NetworkDevice';

export default NetworkDevice;
