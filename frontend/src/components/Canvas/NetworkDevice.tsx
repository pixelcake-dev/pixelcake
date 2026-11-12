import { memo } from 'react';
import { Icon } from '@iconify/react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { ZapOff } from 'lucide-react';
import type { NetworkDevice as NetworkDeviceType } from '@/types/network';
import { DEVICE_ICONS } from '@/types/network';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';

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

  // The packet of a simulation is stopping here
  const hasPacket = useSimulationStore((state) => state.isRunning && state.activeDeviceId === id);

  // Presentation mode: what this device is in the question on screen, and
  // whether it is taken as broken. Each selector gives a boolean, so a device
  // is drawn again only when its own state changes.
  const presenting = usePresentationStore((state) => state.active);
  const isSource = usePresentationStore((state) => state.active && state.sourceId === id);
  const isTarget = usePresentationStore((state) => state.active && state.targetId === id);
  const isFailed = usePresentationStore((state) => state.active && state.failedDevices.includes(id));
  const isDropPoint = usePresentationStore(
    (state) => state.active && state.route?.dropDeviceId === id
  );

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

  const stateClasses = [
    // While presenting a device is not dragged, so a press on it would start
    // moving the view, and a hand that is not perfectly still would turn a
    // click into a drag: `nopan` leaves the press to the click
    presenting ? 'nopan' : '',
    hasPacket ? 'device-has-packet' : '',
    isFailed ? 'device-failed' : '',
    // A broken device is where the packet stops only for the one before it
    isDropPoint && !isFailed ? 'device-drop' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
      className={`network-device group ${magnifyClasses} ${stateClasses}`}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Connection Handles - 4 directions (source only with connectionMode="loose")
          Using only source handles with loose mode is the official React Flow pattern
          for bidirectional connections. This avoids handle overlap/z-index conflicts.
          While presenting nothing can be joined: the handles stay where they are
          (the cables hang on them) and are hidden by the style sheet. */}

      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="connect-point connect-point-top"
        isConnectable={!presenting}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="connect-point connect-point-bottom"
        isConnectable={!presenting}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="connect-point connect-point-left"
        isConnectable={!presenting}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="connect-point connect-point-right"
        isConnectable={!presenting}
      />

      {/* Presentation mode: the ends of the question, and a broken device */}
      {(isSource || isTarget) && (
        <span className={`device-role ${isSource ? 'device-role-source' : 'device-role-target'}`}>
          {isSource ? 'Da' : 'A'}
        </span>
      )}
      {isFailed && (
        <span className="device-failed-badge" title="Guasto simulato">
          <ZapOff size={14} aria-hidden="true" />
          <span className="sr-only">Guasto simulato</span>
        </span>
      )}

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
