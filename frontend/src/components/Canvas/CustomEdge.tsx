/**
 * Custom Edge Component
 * Renders network connections with enhanced features:
 * - Smooth step paths
 * - Highlight on selection/hover
 * - Color coding by connection type
 * - Bandwidth/label display
 * - Packet animation using SVG animateMotion (React Flow official approach)
 * - Presentation mode: a cable that is cut and a cable that leads to a broken
 *   device. The way of the answer is not painted on the drawing: the packet
 *   shows it, and each cable lights up while the packet is on it, in the
 *   colour of its kind, as while building
 */

import { useEffect, useRef } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';
import type { EdgeProps } from 'reactflow';
import { useNetworkStore } from '@/store/networkStore';
import { useTemplateStore } from '@/store/templateStore';
import { useSimulationStore } from '@/store/simulationStore';
import { usePresentationStore } from '@/store/presentationStore';
import type { NetworkConnection } from '@/types/network';
import { FLOW_MODEL_COLORS } from '@/types/network';
import { MARK_COLORS } from '@/utils/drawingImage';

/**
 * The colour of a simulated failure, readable on both themes. The picture of
 * the drawing (File → Esporta immagine…) uses the very same one.
 */
const FAILURE_COLOR = MARK_COLORS.failure;

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<NetworkConnection>) => {
  const selectedDeviceId = useNetworkStore((state) => state.selectedDeviceId);
  const hoveredDeviceId = useNetworkStore((state) => state.hoveredDeviceId);
  const isSimulationRunning = useSimulationStore((state) => state.isRunning);
  const currentConnectionId = useSimulationStore((state) => state.currentConnectionId);
  const currentHop = useSimulationStore((state) => state.currentHop);
  const currentEdgeDuration = useSimulationStore((state) => state.currentEdgeDuration);
  const flowModel = useSimulationStore((state) => state.flowModel);
  const isPacketReversed = useSimulationStore((state) => state.isPacketReversed);
  const getConnectionTemplateByType = useTemplateStore(
    (state) => state.getConnectionTemplateByType
  );

  // Presentation mode (each selector gives a boolean or a short string, so a
  // cable is drawn again only when its own state changes)
  const presenting = usePresentationStore((state) => state.active);
  const isCut = usePresentationStore((state) => state.active && state.failedConnections.includes(id));
  const leadsToFailure = usePresentationStore(
    (state) =>
      state.active &&
      data !== undefined &&
      (state.failedDevices.includes(data.source) || state.failedDevices.includes(data.target))
  );

  // Check if this is the active edge in the simulation
  const isActiveSimulationEdge = isSimulationRunning && id === currentConnectionId;

  // Ref for animateMotion element to trigger animation programmatically
  const animationRef = useRef<SVGAnimateMotionElement>(null);

  // Calculate smooth step path (needed for both early return and normal render)
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Trigger animation when this edge becomes active OR when the packet
  // re-enters the SAME edge on a later hop (round trips traverse the edge
  // before the destination twice in a row: forward, then reversed — without
  // currentHop in the deps the second pass would never call beginElement()
  // and the packet would freeze at the turnaround)
  useEffect(() => {
    if (isActiveSimulationEdge && animationRef.current) {
      requestAnimationFrame(() => {
        animationRef.current?.beginElement();
      });
    }
  }, [isActiveSimulationEdge, currentHop]);

  // Early return if data is not available (prevents null reference errors during edge creation)
  if (!data) {
    // Render a simple edge without custom styling when data is not yet available
    return <BaseEdge id={id} path={edgePath} />;
  }

  // Determine if this edge should be highlighted
  // During simulation: only highlight the current connection being traversed
  // Outside simulation: highlight based on selection or hover
  const isHighlighted =
    selected ||
    (isSimulationRunning && id === currentConnectionId) ||
    (!isSimulationRunning &&
      (selectedDeviceId === data.source || selectedDeviceId === data.target)) ||
    (!isSimulationRunning && hoveredDeviceId === data.source) ||
    (!isSimulationRunning && hoveredDeviceId === data.target);

  // Get connection template for this type
  const template = data.type ? getConnectionTemplateByType(data.type) : undefined;

  // The colour of a cable at rest belongs to the theme. Named here and left
  // to the style sheet, it changes with the theme at once (read as a value,
  // it stayed that of the old theme until the cable was drawn again)
  const lineColor = 'var(--line-color)';

  // Get edge color: custom color > template color > CSS variable (line-color)
  const edgeColor = data.color || template?.color || lineColor;

  // Get stroke style from template or use default
  const getStrokeStyle = () => {
    if (template) {
      // Use template-defined styles
      return {
        strokeDasharray: template.strokeDasharray || 'none',
        strokeWidth: isHighlighted
          ? template.strokeWidthHighlighted || template.strokeWidth + 1.5
          : template.strokeWidth,
      };
    }

    // Fallback to default style if no template found
    return {
      strokeDasharray: 'none',
      strokeWidth: isHighlighted ? 4 : 2.5,
    };
  };

  const strokeStyle = getStrokeStyle();

  // What the cable looks like. Presentation mode comes first: a cut cable is
  // red and broken up, a cable into a broken device fades. Then, presenting
  // or building, a cable stands out in the colour of its kind while the
  // packet is on it (or its device is under the pointer) and rests otherwise.
  const appearance = (() => {
    if (isCut) {
      return {
        stroke: FAILURE_COLOR,
        strokeWidth: strokeStyle.strokeWidth + 0.5,
        strokeDasharray: '3 7',
        opacity: 0.9,
      };
    }
    if (leadsToFailure) {
      return { stroke: lineColor, strokeWidth: strokeStyle.strokeWidth, strokeDasharray: '3 7', opacity: 0.3 };
    }
    return {
      stroke: isHighlighted ? edgeColor : lineColor,
      strokeWidth: strokeStyle.strokeWidth,
      strokeDasharray: strokeStyle.strokeDasharray,
      opacity: isHighlighted ? 1 : 0.6,
    };
  })();

  // Calculate reversed path (for packet traveling opposite direction)
  const [reversedPath] = getSmoothStepPath({
    sourceX: targetX,  // Swap source and target
    sourceY: targetY,
    sourcePosition: targetPosition,
    targetX: sourceX,
    targetY: sourceY,
    targetPosition: sourcePosition,
  });

  // Determine which path to use for animation
  const animationPath = (isActiveSimulationEdge && isPacketReversed) ? reversedPath : edgePath;

  // How long the packet takes to cross this cable: PacketAnimation decides
  // (it also waits that long before the next cable), this edge only draws.
  // The fallback covers a run started before the duration was known.
  const edgeLength = Math.hypot(targetX - sourceX, targetY - sourceY);
  const animationDuration =
    currentEdgeDuration > 0 ? currentEdgeDuration : Math.max(edgeLength * 3, 400);

  // Get packet color based on flow model
  const packetColor = FLOW_MODEL_COLORS[flowModel];

  // Presentation mode: what sits on the cable (its label, the mark of a cut)
  // opens the menu of the cable, like the cable itself
  const openCableMenu = presenting
    ? (event: React.MouseEvent) => {
        event.stopPropagation();
        usePresentationStore
          .getState()
          .openMenu({ kind: 'connection', id, x: event.clientX, y: event.clientY });
      }
    : undefined;

  return (
    <>
      {/* Main edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...appearance,
          transition: 'all 0.2s ease',
        }}
      />

      {/* Animated packet circle - Following React Flow docs example with beginElement trigger */}
      {isActiveSimulationEdge && (
        <circle
          key={`${currentConnectionId}-${currentHop}`} // Remount per hop: the same edge can be traversed twice in a row on round trips
          r="8"
          fill={packetColor}
          stroke="white"
          strokeWidth="2"
          filter={`drop-shadow(0 0 8px ${packetColor})`}
        >
          <animateMotion
            ref={animationRef}
            begin="indefinite" // Prevent auto-start, wait for beginElement()
            dur={`${animationDuration}ms`}
            repeatCount="1"
            path={animationPath} // Use reversed path when packet travels backwards
            fill="freeze"
            calcMode="linear"
          />
        </circle>
      )}

      {/* A cut cable says so where it is cut */}
      {isCut && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="edge-cut-mark nodrag nopan"
            title="Guasto simulato: il cavo è interrotto"
            onClick={openCableMenu}
          >
            ✕
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Edge label (bandwidth/info) */}
      {!isCut && (data.bandwidth || data.label) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="edge-label nodrag nopan"
            onClick={openCableMenu}
          >
            <div className="px-2 py-1 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded text-xs">
              {data.bandwidth && (
                <div className="font-semibold text-[var(--text-color)]">
                  {data.bandwidth}
                </div>
              )}
              {data.label && (
                <div className="text-[var(--text-color-light)]">{data.label}</div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
