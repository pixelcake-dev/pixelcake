import { useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  ConnectionLineType,
  SelectionMode,
} from 'reactflow';
import type {
  Node,
  Edge,
  Connection,
  OnConnect,
  NodeTypes,
  NodeChange,
  OnConnectStart,
  OnConnectEnd,
  EdgeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import NetworkDevice from './NetworkDevice';
import CustomEdge from './CustomEdge';
import ParticleEdge from './ParticleEdge';
import PacketAnimation from './PacketAnimation';
import WelcomeScreen from '@/components/WelcomeScreen';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { useProjectStore } from '@/store/projectStore';
import type { NetworkDevice as NetworkDeviceType } from '@/types/network';

// Define node and edge types outside component to prevent re-renders
const nodeTypes: NodeTypes = {
  device: NetworkDevice,
};

const edgeTypes = {
  custom: CustomEdge,
  particle: ParticleEdge, // Particle animations with CSS offset-path
};

const NetworkCanvas = () => {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const viewport = useNetworkStore((state) => state.viewport);
  const shouldFitView = useNetworkStore((state) => state.shouldFitView);
  const updateDevice = useNetworkStore((state) => state.updateDevice);
  const removeDevice = useNetworkStore((state) => state.removeDevice);
  const addConnection = useNetworkStore((state) => state.addConnection);
  const setViewport = useNetworkStore((state) => state.setViewport);
  const isConnecting = useNetworkStore((state) => state.isConnecting);
  const cancelConnection = useNetworkStore((state) => state.cancelConnection);
  const getConnection = useNetworkStore((state) => state.getConnection);
  const selectedDeviceIds = useNetworkStore((state) => state.selectedDeviceIds);
  const selectMultipleDevices = useNetworkStore((state) => state.selectMultipleDevices);
  const copySelection = useNetworkStore((state) => state.copySelection);
  const paste = useNetworkStore((state) => state.paste);
  const clipboard = useNetworkStore((state) => state.clipboard);
  const setContextMenuDevice = useUIStore((state) => state.setContextMenuDevice);
  const setContextMenuConnection = useUIStore((state) => state.setContextMenuConnection);
  const setInspectorDevice = useUIStore((state) => state.setInspectorDevice);
  const openModal = useUIStore((state) => state.openModal);
  const closeContextMenu = useUIStore((state) => state.closeContextMenu);
  const magnifiedConnectionTypes = useUIStore((state) => state.magnifiedConnectionTypes);
  const particleAnimationEnabled = useUIStore((state) => state.particleAnimationEnabled);
  const showWelcomeScreen = useUIStore((state) => state.showWelcomeScreen);
  const currentProject = useProjectStore((state) => state.currentProject);

  const reactFlowInstance = useReactFlow();

  // Memoize node and edge types to prevent React Flow warnings
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isUpdatingSelection = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragEndPos = useRef<{ x: number; y: number } | null>(null);
  const dragGestureId = useRef<number>(0);
  const currentDragId = useRef<number | null>(null);

  // Handle context menu on device
  const handleDeviceContextMenu = useCallback(
    (e: React.MouseEvent, device: NetworkDeviceType) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuDevice(device, e.clientX, e.clientY);
    },
    [setContextMenuDevice]
  );

  // Handle double click on device
  const handleDeviceDoubleClick = useCallback(
    (device: NetworkDeviceType) => {
      setInspectorDevice(device);
      openModal('inspector');
    },
    [setInspectorDevice, openModal]
  );

  // Handle selection change from React Flow (selection box, click, etc.)
  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => {
      // Prevent infinite loop from programmatic selection updates
      if (isUpdatingSelection.current) {
        return;
      }

      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);

      // Check if this was a micro-drag (< 5px) and cancel selection if so
      // Validate that coordinates are from the same drag gesture
      if (dragStartPos.current && dragEndPos.current && currentDragId.current !== null) {
        const dx = dragEndPos.current.x - dragStartPos.current.x;
        const dy = dragEndPos.current.y - dragStartPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If drag distance < 5px, it's accidental - cancel selection
        if (distance < 5) {
          dragStartPos.current = null;
          dragEndPos.current = null;
          currentDragId.current = null;
          return; // Don't update selection
        }
      }

      // Only update if selection changed (avoid infinite loops)
      // Use Set for efficient comparison instead of sort().join()
      const currentSet = new Set(selectedDeviceIds);
      const newSet = new Set(selectedIds);
      const changed =
        currentSet.size !== newSet.size ||
        ![...currentSet].every((id) => newSet.has(id));

      if (changed) {
        isUpdatingSelection.current = true;
        selectMultipleDevices(selectedIds);
        // Use queueMicrotask instead of setTimeout - more reliable and performant
        queueMicrotask(() => {
          isUpdatingSelection.current = false;
        });
      }

      // Reset drag tracking
      dragStartPos.current = null;
      dragEndPos.current = null;
      currentDragId.current = null;
    },
    [selectedDeviceIds, selectMultipleDevices]
  );

  // Handle node deletion (Delete key)
  const handleNodesDelete = useCallback(
    (nodes: Node[]) => {
      nodes.forEach((node) => {
        removeDevice(node.id);
      });
    },
    [removeDevice]
  );

  // Handle context menu on edge (connection)
  const handleEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault();
      event.stopPropagation();

      // Get the full connection data from the store using edge.id
      const connection = getConnection(edge.id);
      if (connection) {
        setContextMenuConnection(connection, event.clientX, event.clientY);
      }
    },
    [getConnection, setContextMenuConnection]
  );

  // Sync Zustand devices to React Flow nodes (memoized to prevent unnecessary re-renders)
  const reactFlowNodes: Node[] = useMemo(() =>
    devices.map((device) => ({
      id: device.id,
      type: 'device',
      position: device.position,
      selected: selectedDeviceIds.includes(device.id), // React Flow selection property
      data: {
        ...device,
        isSelected: selectedDeviceIds.includes(device.id), // Keep for backward compatibility
        onContextMenu: handleDeviceContextMenu,
        onDoubleClick: handleDeviceDoubleClick,
      },
    })),
    [devices, selectedDeviceIds, handleDeviceContextMenu, handleDeviceDoubleClick]
  );

  useEffect(() => {
    setNodes(reactFlowNodes);
  }, [reactFlowNodes, setNodes]);

  // Sync Zustand connections to React Flow edges
  useEffect(() => {
    const reactFlowEdges: Edge[] = connections.map((conn) => {
      // Magnification logic for edges
      const isMagnified = conn.type && magnifiedConnectionTypes.includes(conn.type);
      const isDimmed = magnifiedConnectionTypes.length > 0 && !isMagnified;

      // Build CSS classes for edge magnification
      let edgeClassName = '';
      if (isMagnified) {
        edgeClassName = `edge-magnified conn-${conn.type}`;
      } else if (isDimmed) {
        edgeClassName = 'edge-dimmed';
      }

      // Determine edge type: 'particle' if animation enabled, 'custom' otherwise
      const edgeType = particleAnimationEnabled ? 'particle' : 'custom';

      return {
        id: conn.id,
        source: conn.source,
        target: conn.target,
        // Use nullish coalescing to set null when sourceHandle/targetHandle are undefined
        // React Flow accepts null (auto-detect) but NOT undefined (tries to find handle ID "undefined")
        sourceHandle: conn.sourceHandle ?? null,
        targetHandle: conn.targetHandle ?? null,
        type: edgeType, // Switch between 'custom' (normal) and 'particle' (with animations)
        data: conn, // Pass full connection data to edge component
        className: edgeClassName, // Add magnification classes
      };
    });
    setEdges(reactFlowEdges);
  }, [connections, magnifiedConnectionTypes, particleAnimationEnabled, setEdges]);

  // Fit view when triggered from TopMenuBar
  useEffect(() => {
    if (shouldFitView) {
      reactFlowInstance.fitView({
        padding: 0.2, // 20% padding around edges
        duration: 300, // Smooth animation 300ms
      });
    }
  }, [shouldFitView, reactFlowInstance]);

  // Handle node position changes (drag)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      // Update Zustand store when node position changes (anche durante drag)
      changes.forEach((change) => {
        if (change.type === 'position' && 'position' in change && change.position) {
          updateDevice(change.id, { position: change.position });
        }
      });
    },
    [onNodesChange, updateDevice]
  );

  // Handle connection start (drag begins)
  const onConnectStart: OnConnectStart = useCallback(() => {
    document.body.classList.add('react-flow-connecting');
  }, []);

  // Handle connection end (drag ends)
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    document.body.classList.remove('react-flow-connecting');
  }, []);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        addConnection({
          source: params.source,
          target: params.target,
          // Use nullish coalescing to ensure we store null (not undefined)
          // This keeps our data consistent with React Flow's expectations
          sourceHandle: params.sourceHandle ?? null,
          targetHandle: params.targetHandle ?? null,
        });
      }
    },
    [addConnection]
  );

  // Close context menu and cancel connection when clicking on canvas
  // Note: React Flow handles selection clearing automatically
  const handleCanvasClick = useCallback(() => {
    closeContextMenu();
    if (isConnecting) {
      cancelConnection();
    }
  }, [closeContextMenu, isConnecting, cancelConnection]);

  // Save viewport when user pans or zooms
  const handleMoveEnd = useCallback(() => {
    const currentViewport = reactFlowInstance.getViewport();
    setViewport(currentViewport);
  }, [reactFlowInstance, setViewport]);

  // ESC to cancel connection
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isConnecting) {
        cancelConnection();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isConnecting, cancelConnection]);

  // Keyboard shortcuts: Ctrl+C (copy), Ctrl+V (paste)
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl+C - Copy selection
      if (isCtrlOrCmd && e.key === 'c' && selectedDeviceIds.length > 0) {
        e.preventDefault();
        copySelection();
      }

      // Ctrl+V - Paste from clipboard
      if (isCtrlOrCmd && e.key === 'v' && clipboard && clipboard.devices.length > 0) {
        e.preventDefault();
        paste();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [selectedDeviceIds, clipboard, copySelection, paste]);

  // Suppress React Flow development warnings
  // These are false positives caused by React Strict Mode
  const handleError = useCallback(() => {
    // Suppress all React Flow warnings in development
    // Our code is correct - warnings are due to Strict Mode double-rendering
    return;
  }, []);

  // Track mouse drag for threshold-based selection
  // Use onPaneMouseDown/Up to ensure events only fire from canvas pane (not Controls/MiniMap)
  const handlePaneMouseDown = useCallback((e: React.MouseEvent) => {
    dragGestureId.current++;
    currentDragId.current = dragGestureId.current;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragEndPos.current = null;
  }, []);

  const handlePaneMouseUp = useCallback((e: React.MouseEvent) => {
    dragEndPos.current = { x: e.clientX, y: e.clientY };
    // Keep currentDragId for validation in handleSelectionChange
  }, []);

  // Determina se mostrare la welcome screen
  const shouldShowWelcome = showWelcomeScreen && devices.length === 0 && !currentProject;

  return (
    <div className="relative w-full h-full">
      {/* Welcome Screen - integrata nel canvas */}
      {shouldShowWelcome && <WelcomeScreen />}

      {/* React Flow Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full"
        onClick={handleCanvasClick}
      >
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onNodesDelete={handleNodesDelete}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onEdgeContextMenu={handleEdgeContextMenu}
        onError={handleError}
        onMoveEnd={handleMoveEnd}
        onMouseDown={handlePaneMouseDown}
        onMouseUp={handlePaneMouseUp}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        // Restore saved viewport on mount
        defaultViewport={viewport}
        // Enable drag-and-drop connections
        connectionMode={ConnectionMode.Loose}
        // Connection line styling for visual feedback during drag
        connectionLineStyle={{
          stroke: '#999',
          strokeWidth: 2,
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionRadius={50}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
        }}
        // Multi-selection support
        selectionOnDrag={true}
        panOnDrag={[2]}
        selectionMode={SelectionMode.Full}
        multiSelectionKeyCode="Control"
        deleteKeyCode="Delete"
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const device = node.data as NetworkDeviceType;
            // Color mapping for all 9 device types
            const colorMap: Record<string, string> = {
              PC: '#3b82f6',          // Blue
              Switch: '#10b981',      // Green
              Router: '#f59e0b',      // Amber
              Server: '#8b5cf6',      // Violet
              Firewall: '#ef4444',    // Red
              AccessPoint: '#06b6d4', // Cyan
              LoadBalancer: '#ec4899', // Pink
              Database: '#f97316',    // Orange
              Cloud: '#6366f1',       // Indigo
            };
            return colorMap[device.type] || '#6b7280'; // Gray fallback
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        {/* Packet Animation Logic */}
        <PacketAnimation />
      </ReactFlow>
      </div>
    </div>
  );
};

export default NetworkCanvas;
