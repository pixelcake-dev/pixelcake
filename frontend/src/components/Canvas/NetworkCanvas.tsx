import { useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  ConnectionMode,
  ConnectionLineType,
  SelectionMode,
} from 'reactflow';
import type {
  Node,
  Edge,
  Connection,
  ReactFlowState,
  OnConnect,
  NodeTypes,
  NodeChange,
  NodeMouseHandler,
  OnConnectStart,
  OnConnectEnd,
  EdgeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import NetworkDevice from './NetworkDevice';
import { useDhcp } from '@/utils/useDhcp';
import { shownAddress } from '@/utils/dhcpLabels';
import CustomEdge from './CustomEdge';
import ParticleEdge from './ParticleEdge';
import PacketAnimation from './PacketAnimation';
import WelcomeScreen from '@/components/WelcomeScreen';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import type { NetworkDevice as NetworkDeviceType } from '@/types/network';

// Define node and edge types outside component to prevent re-renders
const nodeTypes: NodeTypes = {
  device: NetworkDevice,
};

const edgeTypes = {
  custom: CustomEdge,
  particle: ParticleEdge, // Particle animations with CSS offset-path
};

// Colour of a device on the small map, by device type
const MINI_MAP_COLORS: Record<string, string> = {
  PC: '#3b82f6', // Blue
  Switch: '#10b981', // Green
  Router: '#f59e0b', // Amber
  Server: '#8b5cf6', // Violet
  Firewall: '#ef4444', // Red
  AccessPoint: '#06b6d4', // Cyan
  LoadBalancer: '#ec4899', // Pink
  Database: '#f97316', // Orange
  Cloud: '#6366f1', // Indigo
};

const miniMapColor = (node: Node): string =>
  MINI_MAP_COLORS[(node.data as NetworkDeviceType).type] || '#6b7280'; // Gray fallback

/**
 * True once React Flow knows the size of every device on screen, which is
 * what fitting the view needs. The sizes are lost, and measured again a
 * moment later, each time the list of devices is handed to React Flow.
 */
const allNodesMeasured = (state: ReactFlowState): boolean => {
  if (state.nodeInternals.size === 0) return false;
  for (const node of state.nodeInternals.values()) {
    if (!node.width || !node.height) return false;
  }
  return true;
};

const NetworkCanvas = () => {
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const viewport = useNetworkStore((state) => state.viewport);
  const fitViewRequest = useNetworkStore((state) => state.fitViewRequest);
  const updateDevice = useNetworkStore((state) => state.updateDevice);
  const removeDevice = useNetworkStore((state) => state.removeDevice);
  const addConnection = useNetworkStore((state) => state.addConnection);
  const setViewport = useNetworkStore((state) => state.setViewport);
  const removeConnection = useNetworkStore((state) => state.removeConnection);
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
  const canvasRevision = useNetworkStore((state) => state.canvasRevision);
  const canvasCount = useProjectStore((state) => state.canvases.length);
  // Presentation mode: the drawing is shown, not edited
  const presenting = usePresentationStore((state) => state.active);
  const panelOpen = usePresentationStore((state) => state.panelOpen);

  const reactFlowInstance = useReactFlow();
  const nodesMeasured = useStore(allNodesMeasured);

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

  // Handle context menu on device. While presenting, the right button opens
  // the same small menu as a click: nothing there edits the drawing
  const handleDeviceContextMenu = useCallback(
    (e: React.MouseEvent, device: NetworkDeviceType) => {
      e.preventDefault();
      e.stopPropagation();
      const presentation = usePresentationStore.getState();
      if (presentation.active) {
        presentation.openMenu({ kind: 'device', id: device.id, x: e.clientX, y: e.clientY });
        return;
      }
      setContextMenuDevice(device, e.clientX, e.clientY);
    },
    [setContextMenuDevice]
  );

  // Handle double click on device (the inspector is a building tool)
  const handleDeviceDoubleClick = useCallback(
    (device: NetworkDeviceType) => {
      if (usePresentationStore.getState().active) return;
      setInspectorDevice(device);
      openModal('inspector');
    },
    [setInspectorDevice, openModal]
  );

  // Presentation mode: a click on a device or on a cable opens its menu
  const handlePresentationNodeClick: NodeMouseHandler = useCallback((event, node) => {
    usePresentationStore
      .getState()
      .openMenu({ kind: 'device', id: node.id, x: event.clientX, y: event.clientY });
  }, []);

  const handlePresentationEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    usePresentationStore
      .getState()
      .openMenu({ kind: 'connection', id: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  const closePresentationMenu = useCallback(() => {
    usePresentationStore.getState().closeMenu();
  }, []);

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

  // A link deleted with the Delete key goes away from the network too, not
  // only from the picture
  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((edge) => {
        removeConnection(edge.id);
      });
    },
    [removeConnection]
  );

  // Handle context menu on edge (connection)
  const handleEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault();
      event.stopPropagation();

      const presentation = usePresentationStore.getState();
      if (presentation.active) {
        presentation.openMenu({ kind: 'connection', id: edge.id, x: event.clientX, y: event.clientY });
        return;
      }

      // Get the full connection data from the store using edge.id
      const connection = getConnection(edge.id);
      if (connection) {
        setContextMenuConnection(connection, event.clientX, event.clientY);
      }
    },
    [getConnection, setContextMenuConnection]
  );

  // What each device shows under its name: its address, the leased one
  // for a device on DHCP
  const dhcp = useDhcp();

  // Sync Zustand devices to React Flow nodes (memoized to prevent unnecessary re-renders)
  const reactFlowNodes: Node[] = useMemo(() =>
    devices.map((device) => ({
      id: device.id,
      type: 'device',
      position: device.position,
      selected: selectedDeviceIds.includes(device.id), // React Flow selection property
      data: {
        ...device,
        address: shownAddress(device, dhcp),
        isSelected: selectedDeviceIds.includes(device.id), // Keep for backward compatibility
        onContextMenu: handleDeviceContextMenu,
        onDoubleClick: handleDeviceDoubleClick,
      },
    })),
    [devices, dhcp, selectedDeviceIds, handleDeviceContextMenu, handleDeviceDoubleClick]
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

  // Bring the whole drawing into view when asked (Vista → Adatta alla
  // finestra, a sample network just loaded). Fitting needs the size of every
  // device: a request made together with a new drawing waits until React
  // Flow has measured it, and the short wait lets the drawing that is on its
  // way in replace the one still on screen first.
  const fittedRequest = useRef(fitViewRequest);
  useEffect(() => {
    if (fittedRequest.current === fitViewRequest || !nodesMeasured) return;
    const timer = setTimeout(() => {
      fittedRequest.current = fitViewRequest;
      reactFlowInstance.fitView({
        padding: 0.2, // 20% padding around edges
        duration: 300, // Smooth animation 300ms
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [fitViewRequest, nodesMeasured, reactFlowInstance]);

  // A different canvas came on screen (canvas switch, project opened or
  // created): show it where it was left. `defaultViewport` only covers the
  // first mount.
  const appliedCanvasRevision = useRef(canvasRevision);
  useEffect(() => {
    if (appliedCanvasRevision.current === canvasRevision) return;
    appliedCanvasRevision.current = canvasRevision;
    reactFlowInstance.setViewport(useNetworkStore.getState().viewport);
  }, [canvasRevision, reactFlowInstance]);

  // Presentation mode shows the whole drawing: it is fitted to the window on
  // the way in, when another canvas comes on screen and when the panel opens
  // or closes. Where the user was looking while building is not touched (see
  // handleMoveEnd) and comes back on the way out.
  const wasPresenting = useRef(false);
  useEffect(() => {
    if (!presenting) {
      if (wasPresenting.current) {
        wasPresenting.current = false;
        reactFlowInstance.setViewport(useNetworkStore.getState().viewport, { duration: 200 });
      }
      return;
    }
    wasPresenting.current = true;
    // Fitting needs the size of every device and the new size of the canvas
    // (bars and panels have just been swapped): wait for both
    if (!nodesMeasured) return;
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 300 });
    }, 80);
    return () => clearTimeout(timer);
  }, [presenting, panelOpen, canvasRevision, nodesMeasured, reactFlowInstance]);

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

  // Close the context menu when clicking on the canvas
  // Note: React Flow handles selection clearing automatically
  const handleCanvasClick = useCallback(() => {
    closeContextMenu();
  }, [closeContextMenu]);

  // Save viewport when user pans or zooms. Not while presenting: looking
  // around a presentation must not move the view the drawing is saved with
  const handleMoveEnd = useCallback(() => {
    if (usePresentationStore.getState().active) return;
    const currentViewport = reactFlowInstance.getViewport();
    setViewport(currentViewport);
  }, [reactFlowInstance, setViewport]);

  // Keyboard shortcuts: Ctrl+C (copy), Ctrl+V (paste)
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;
      // Nothing is copied or pasted into a drawing that is being presented
      if (usePresentationStore.getState().active) return;

      // The shortcuts belong to the drawing. While the user is typing, or has
      // selected some text (the output of the terminal, say), copy and paste
      // are the browser's: they must work on that text
      const target = e.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (isTyping || (window.getSelection()?.toString() ?? '') !== '') return;

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

  // The welcome screen only shows on an empty project: one canvas with
  // nothing on it. An empty canvas added to a project is just an empty canvas
  const shouldShowWelcome =
    !presenting && showWelcomeScreen && devices.length === 0 && canvasCount === 1;

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
        onEdgesDelete={handleEdgesDelete}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onEdgeContextMenu={handleEdgeContextMenu}
        onNodeClick={presenting ? handlePresentationNodeClick : undefined}
        onEdgeClick={presenting ? handlePresentationEdgeClick : undefined}
        onPaneClick={presenting ? closePresentationMenu : undefined}
        onMoveStart={presenting ? closePresentationMenu : undefined}
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
        // Multi-selection support. While presenting nothing can be selected,
        // moved, joined or deleted: dragging pans the view
        selectionOnDrag={!presenting}
        panOnDrag={presenting ? true : [2]}
        selectionMode={SelectionMode.Full}
        multiSelectionKeyCode={presenting ? null : 'Control'}
        deleteKeyCode={presenting ? null : 'Delete'}
        nodesDraggable={!presenting}
        nodesConnectable={!presenting}
        elementsSelectable={!presenting}
        // A double click while presenting is two clicks on a menu, not a zoom
        zoomOnDoubleClick={!presenting}
      >
        <Background color="#aaa" gap={16} />
        <Controls showInteractive={!presenting} />
        {/* The small map is a tool for finding one's way while building. Its
            background and the veil outside the view follow the theme: they
            are in index.css, like those of the zoom buttons and the credit */}
        {!presenting && <MiniMap nodeColor={miniMapColor} />}
        {/* Packet Animation Logic */}
        <PacketAnimation />
      </ReactFlow>
      </div>
    </div>
  );
};

export default NetworkCanvas;
