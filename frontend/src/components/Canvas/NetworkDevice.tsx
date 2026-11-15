import { memo, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { ZapOff } from 'lucide-react';
import type { NetworkDevice as NetworkDeviceType } from '@/types/network';
import DeviceDrawing from '@/components/ui/DeviceDrawing';
import { deviceState, drawingOf } from '@/utils/deviceDrawing';
import { noLeaseLabel } from '@/utils/dhcpLabels';
import { DEVICE_METRICS, cableEnd, type Side } from '@/utils/deviceGeometry';
import type { DeviceDrawingId } from '@/data/deviceDrawings';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useT } from '@/i18n';

interface NetworkDeviceData extends NetworkDeviceType {
  /**
   * What is shown under the name: the address written by hand, or the one
   * the device is leased by a DHCP server (see shownAddress). Left out, the
   * device-level address is shown.
   */
  address?: string;
  isSelected?: boolean;
  onContextMenu?: (e: React.MouseEvent, device: NetworkDeviceType) => void;
  onDoubleClick?: (device: NetworkDeviceType) => void;
}

/** The four sides of a device: a cable can end on each */
const SIDES: ReadonlyArray<{ side: Side; position: Position }> = [
  { side: 'top', position: Position.Top },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
  { side: 'right', position: Position.Right },
];

/** The mark a cable ends on is 8 long and 2 thick (index.css): half of its length */
const HALF_MARK = 4;

/**
 * Where the connection point of a side is placed, for a drawing: next to
 * what is drawn, where the cable has to end (utils/deviceGeometry.ts), from
 * the inside of the frame. The band that starts a cable is placed back from
 * there by the style sheet, which is told where the point is.
 */
function pointStyle(drawing: DeviceDrawingId, side: Side): CSSProperties {
  const { border } = DEVICE_METRICS;
  // (the end at the bottom is placed from the bottom of the frame: no height is needed)
  const end = cableEnd(drawing, side, 0);
  const place = (style: CSSProperties, x: number, y?: number) =>
    ({ ...style, '--at-x': `${x}px`, ...(y === undefined ? {} : { '--at-y': `${y}px` }) }) as CSSProperties;
  switch (side) {
    case 'top': {
      const x = end.x - border - HALF_MARK;
      const y = end.y - border;
      return place({ left: x, top: y }, x, y);
    }
    case 'bottom': {
      const x = end.x - border - HALF_MARK;
      return place({ left: x, top: 'auto', bottom: -border }, x);
    }
    case 'left': {
      const x = end.x - border;
      const y = end.y - border - HALF_MARK;
      return place({ left: x, top: y }, x, y);
    }
    case 'right': {
      // (the mark is 2 thick: its outer edge is where the cable ends)
      const x = end.x - border - 2;
      const y = end.y - border - HALF_MARK;
      return place({ left: x, top: y, right: 'auto' }, x, y);
    }
  }
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
    prevProps.data.address === nextProps.data.address &&
    prevProps.data.notes === nextProps.data.notes &&
    prevProps.data.type === nextProps.data.type &&
    prevProps.data.templateId === nextProps.data.templateId &&
    prevProps.data.position.x === nextProps.data.position.x &&
    prevProps.data.position.y === nextProps.data.position.y &&
    prevProps.data.isSelected === nextProps.data.isSelected
  );
}

const NetworkDevice = memo(({ data, id, selected }: NodeProps<NetworkDeviceData>) => {
  // (the comparator below knows nothing of the language: this hook is what
  // draws the device again when the language changes)
  const t = useT();
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
  const isArrival = usePresentationStore(
    (state) => state.active && state.route?.arrives === true && state.targetId === id
  );
  // Outside a presentation: what the last question asked (simulation panel,
  // terminal) left on the canvas when its packet got to the end of its way
  const answered = useSimulationStore((state) =>
    state.answer?.deviceId === id ? (state.answer.arrives ? 'ok' : 'error') : null
  );

  // Find template by ID (preferred) or fallback to type (backward compatibility)
  const template = data.templateId
    ? templates.find((entry) => entry.id === data.templateId)
    : templates.find((entry) => entry.type === data.type);

  // The drawing of the device: the one of its template, else the one of its type
  const drawing = drawingOf(template, data.type);
  // (the same objects while the drawing is the same: a device dragged does
  // not draw its four points again at every step)
  const pointStyles = useMemo(
    () => Object.fromEntries(SIDES.map(({ side }) => [side, pointStyle(drawing, side)])) as Record<Side, CSSProperties>,
    [drawing]
  );

  // The cables end next to what is drawn, and every drawing has its own
  // shape: when the drawing of a device changes, React Flow is told to look
  // again at where its connection points are
  const updateNodeInternals = useUpdateNodeInternals();
  const drawn = useRef(drawing);
  useEffect(() => {
    if (drawn.current === drawing) return;
    drawn.current = drawing;
    updateNodeInternals(id);
  }, [drawing, id, updateNodeInternals]);

  // What is written under the name: nothing, for a device with no address to show
  const address = data.address ?? data.ip;

  // What the upper layer of the drawing says: one thing, by the order of
  // deviceState. A device on DHCP that got no address waits for one, and the
  // line under its name says so in words
  const state = deviceState({
    failed: isFailed,
    stopsHere: isDropPoint || answered === 'error',
    arrivesHere: isArrival || answered === 'ok',
    selected,
    // (both in the language of the interface: the address is worked out in it, and t draws this again when it changes)
    waiting: address === noLeaseLabel(),
  });

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
    // (the frame is a line higher: the style sheet places the sides by it)
    address ? 'device-with-address' : '',
    // While presenting a device is not dragged, so a press on it would start
    // moving the view, and a hand that is not perfectly still would turn a
    // click into a drag: `nopan` leaves the press to the click
    presenting ? 'nopan' : '',
    hasPacket ? 'device-has-packet' : '',
    isFailed ? 'device-failed' : '',
    // The answer on screen ends here: the frame shows too, in the colour of the lamp
    // (a broken device is where the packet stops only for the one before it)
    state === 'error' ? 'device-drop' : '',
    state === 'ok' ? 'device-arrival' : '',
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
          Each is where a cable ends on that side, next to what is drawn; what
          starts a cable is the band of the frame along the side (index.css).
          While presenting nothing can be joined: the handles stay where they are
          (the cables hang on them) and their bands are taken away by the style sheet. */}

      {SIDES.map(({ side, position }) => (
        <Handle
          key={side}
          type="source"
          position={position}
          id={side}
          className={`connect-point connect-point-${side}`}
          style={pointStyles[side]}
          isConnectable={!presenting}
        />
      ))}

      {/* Presentation mode: the ends of the question, and a broken device */}
      {(isSource || isTarget) && (
        <span className={`device-role ${isSource ? 'device-role-source' : 'device-role-target'}`}>
          {isSource ? t.canvas.device.from : t.canvas.device.to}
        </span>
      )}
      {isFailed && (
        <span className="device-failed-badge" title={t.canvas.device.failed}>
          <ZapOff size={14} aria-hidden="true" />
          <span className="sr-only">{t.canvas.device.failed}</span>
        </span>
      )}

      {/* The note of the device: the app shows it to the eye in a panel of its
          own when the pointer rests here (DeviceNote); a screen reader has it
          here. The eye sees that there is one by the small square after the name */}
      {data.notes?.trim() && <span className="sr-only">{t.canvas.device.note(data.notes.trim())}</span>}

      {/* (what the lamp says of the answer on screen, for who cannot see its colour) */}
      {state === 'error' && <span className="sr-only">{t.canvas.device.stopsHere}</span>}
      {state === 'ok' && <span className="sr-only">{t.canvas.device.getsHere}</span>}

      {/* Device Content */}
      <div className="device-content pointer-events-none">
        <DeviceDrawing drawing={drawing} state={state} className="device-icon" />
        <span className="device-name">
          {data.label}
          {data.notes?.trim() && <span className="device-note-mark" aria-hidden="true" />}
        </span>
        {/* (a device with no address to show is its drawing and its name: no empty line) */}
        {address && <span className="device-ip">{address}</span>}
      </div>
    </div>
  );
}, arePropsEqual);

NetworkDevice.displayName = 'NetworkDevice';

export default NetworkDevice;
