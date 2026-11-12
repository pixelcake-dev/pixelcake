/**
 * Custom Edge Component
 * Renders network connections with enhanced features:
 * - Smooth step paths
 * - Highlight on selection/hover
 * - Color coding by connection type
 * - Bandwidth/label display
 * - Packet animation using SVG animateMotion (React Flow official approach)
 * - Presentation mode: a cable that is cut, a cable that leads to a broken
 *   device, and the way of the answer on screen
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

/** Colours of presentation mode, readable on both themes */
const ROUTE_COLOR_ARRIVES = '#10b981';
const ROUTE_COLOR_STOPS = '#f59e0b';
const FAILURE_COLOR = '#ef4444';

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
  const routeState = usePresentationStore((state) =>
    state.active && state.route?.links.includes(id) ? (state.route.arrives ? 'arrives' : 'stops') : null
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

  const lineColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--line-color')
    .trim();

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
  // red and broken up, a cable into a broken device fades, the way of the
  // answer stands out in the colour of its outcome.
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
    if (routeState) {
      return {
        stroke: routeState === 'arrives' ? ROUTE_COLOR_ARRIVES : ROUTE_COLOR_STOPS,
        strokeWidth: strokeStyle.strokeWidth + 1.5,
        strokeDasharray: strokeStyle.strokeDasharray,
        opacity: 1,
      };
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
            <div className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs shadow-sm">
              {data.bandwidth && (
                <div className="font-semibold text-gray-700 dark:text-gray-200">
                  {data.bandwidth}
                </div>
              )}
              {data.label && (
                <div className="text-gray-500 dark:text-gray-400">{data.label}</div>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;
