import { useCallback, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  useStoreApi,
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
import AreaNode from './AreaNode';
import { useDhcp } from '@/utils/useDhcp';
import { shownAddress } from '@/utils/dhcpLabels';
import { miniMapAreaColour, miniMapColour } from '@/utils/miniMapColour';
import CustomEdge from './CustomEdge';
import ParticleEdge from './ParticleEdge';
import PacketAnimation from './PacketAnimation';
import DeviceNote from './DeviceNote';
import WelcomeScreen from '@/components/WelcomeScreen';
import { useNetworkStore } from '@/store/networkStore';
import { useProjectStore } from '@/store/projectStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import type { CanvasArea, NetworkDevice as NetworkDeviceType } from '@/types/network';

// Define node and edge types outside component to prevent re-renders
const nodeTypes: NodeTypes = {
  device: NetworkDevice,
  // An area («riquadro»): a labelled rectangle behind the devices
  area: AreaNode,
};

/** The kind of node an area is, and what tells one from a device */
const AREA_NODE = 'area';

const edgeTypes = {
  custom: CustomEdge,
  particle: ParticleEdge, // Particle animations with CSS offset-path
};

/**
 * A device on the small map is drawn in the colour of its type; an area is
 * a faint rectangle of its own colour behind them
 */
const miniMapNodeColour = (node: Node): string =>
  node.type === AREA_NODE
    ? miniMapAreaColour((node.data as CanvasArea | undefined)?.color)
    : miniMapColour((node.data as NetworkDeviceType | undefined)?.type);

/** How long the view has to stand still to be taken as come to rest (ms) */
const VIEW_AT_REST_AFTER = 150;

/**
 * True once React Flow knows the size of every device on screen, which is
 * what fitting the view needs. A device that has just come on the canvas
 * has none until React Flow has measured it, a moment later.
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
  const areas = useNetworkStore((state) => state.areas);
  const selectedAreaId = useNetworkStore((state) => state.selectedAreaId);
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
  const welcomeRequested = useUIStore((state) => state.welcomeRequested);
  const canvasRevision = useNetworkStore((state) => state.canvasRevision);
  const canvasCount = useProjectStore((state) => state.canvases.length);
  // Presentation mode: the drawing is shown, not edited
  const presenting = usePresentationStore((state) => state.active);
  const panelOpen = usePresentationStore((state) => state.panelOpen);

  const reactFlowInstance = useReactFlow();
  const reactFlowStore = useStoreApi();
  const nodesMeasured = useStore(allNodesMeasured);

  // Memoize node and edge types to prevent React Flow warnings
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isUpdatingSelection = useRef(false);

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
    // (an area is shown and nothing else: it has no menu)
    if (node.type === AREA_NODE) return;
    usePresentationStore
      .getState()
      .openMenu({ kind: 'device', id: node.id, x: event.clientX, y: event.clientY });
  }, []);

  const handlePresentationEdgeClick: EdgeMouseHandler = useCallback((event, edge) => {
    usePresentationStore
      .getState()
      .openMenu({ kind: 'connection', id: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  // A click on the empty canvas takes away the answer the last question left on a device
  const clearAnswer = useSimulationStore((state) => state.clearAnswer);

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

      // Every change is passed on, whatever was done on the canvas before
      // it: React Flow has changed its selection already, and a change kept
      // from the store leaves the app with another selection than the one on
      // screen
      const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);

      // Only update if selection changed (avoid infinite loops)
      // Use Set for efficient comparison instead of sort().join().
      // The selection of the store is read here, at the moment of the call,
      // and this handler stays the same one: React Flow calls a handler again
      // whenever it is a new one, with the selection it has at that moment,
      // and a selection just set by the app (a device added and selected) was
      // taken for one the user had cleared
      const currentSet = new Set(useNetworkStore.getState().selectedDeviceIds);
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
    },
    [selectMultipleDevices]
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

  // The areas come first and lie under everything: under the cables too,
  // which React Flow draws at depth 0. An area is not React Flow's to
  // select, drag, join or delete: it never enters the selection of the
  // devices, and a selection box drawn over it takes the devices alone
  // (see AreaNode for how it is taken and moved)
  const areaNodes: Node[] = useMemo(
    () =>
      areas.map((area) => ({
        id: area.id,
        type: AREA_NODE,
        position: area.position,
        data: area,
        style: { width: area.size.width, height: area.size.height },
        // (its size is known: it needs no measuring to be drawn or fitted)
        width: area.size.width,
        height: area.size.height,
        zIndex: -1,
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        deletable: false,
      })),
    [areas]
  );

  // Sync Zustand devices to React Flow nodes (memoized to prevent unnecessary re-renders)
  const deviceNodes: Node[] = useMemo(() =>
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

  const reactFlowNodes: Node[] = useMemo(
    () => (areaNodes.length > 0 ? [...areaNodes, ...deviceNodes] : deviceNodes),
    [areaNodes, deviceNodes]
  );

  // The list is made anew from the store at every change, and React Flow
  // takes a node as it is handed over: without the size it had measured,
  // which it then has to measure again. Until it has, the device counts as
  // inside any selection box, and the rectangle around a group taken with a
  // box is as large as the places of its devices alone: of no height for
  // two in a row. React Flow then takes the rectangle away, and the one it
  // draws next cannot be dragged. So a device that stays on the canvas is
  // handed over with the size it had (a size that changes is still told by
  // React Flow, which goes on watching the device)
  useEffect(() => {
    setNodes((shown) => {
      const before = new Map(shown.map((node) => [node.id, node]));
      return reactFlowNodes.map((node) => {
        const had = before.get(node.id);
        return node.width === undefined && had?.width && had.height
          ? { ...node, width: had.width, height: had.height }
          : node;
      });
    });
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
          // (an area moved by one of its resize handles writes itself to the store)
          if (useNetworkStore.getState().areas.some((area) => area.id === change.id)) return;
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

  // An area that is selected: the devices and the cables React Flow had
  // selected are let go (the store has emptied its own list already), so
  // that the Delete key deletes the area and nothing else
  useEffect(() => {
    if (selectedAreaId !== null) reactFlowStore.getState().unselectNodesAndEdges();
  }, [selectedAreaId, reactFlowStore]);

  // A press on the empty canvas (a click there, or a selection box begun
  // there) lets go of the area that was selected
  const deselectArea = useCallback(() => {
    useNetworkStore.getState().selectArea(null);
  }, []);

  // The Delete key deletes the area that is selected, as it deletes the
  // devices that are. Not while typing, and not while presenting
  useEffect(() => {
    const handleDeleteKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      if (usePresentationStore.getState().active) return;
      const target = e.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (isTyping) return;
      const network = useNetworkStore.getState();
      if (network.selectedAreaId !== null) network.removeArea(network.selectedAreaId);
    };
    window.addEventListener('keydown', handleDeleteKey);
    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, []);

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

  // A move the app makes (the drawing fitted to the window, the zoom buttons
  // of the canvas, the view that follows a device dragged to the border) has
  // no end React Flow tells of, as one made with the pointer or the wheel
  // has. It is over when the view has stood still for a moment, and the view
  // is stored then: it is the one a reload of the page comes back to
  const viewAtRest = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleMove = useCallback(
    (event: MouseEvent | TouchEvent | null) => {
      // (made with the pointer or the wheel: stored at its end, above)
      if (event) return;
      clearTimeout(viewAtRest.current);
      viewAtRest.current = setTimeout(handleMoveEnd, VIEW_AT_REST_AFTER);
    },
    [handleMoveEnd]
  );
  useEffect(() => () => clearTimeout(viewAtRest.current), []);

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

  // The welcome screen shows by itself only on an empty project: one canvas
  // with nothing on it (an empty canvas added to a project is just an empty
  // canvas). Asked for from the Aiuto menu, it shows on any empty canvas
  const shouldShowWelcome =
    !presenting &&
    showWelcomeScreen &&
    devices.length === 0 &&
    // (a canvas with an area drawn on it is not an empty one)
    areas.length === 0 &&
    (canvasCount === 1 || welcomeRequested);

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
        onPaneClick={presenting ? closePresentationMenu : clearAnswer}
        onSelectionStart={presenting ? undefined : deselectArea}
        onMoveStart={presenting ? closePresentationMenu : undefined}
        onError={handleError}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
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
        {/* (the devices on the small map take their one colour from the style sheet) */}
        {!presenting && <MiniMap nodeColor={miniMapNodeColour} />}
        {/* Packet Animation Logic */}
        <PacketAnimation />
        <DeviceNote />
      </ReactFlow>
      </div>
    </div>
  );
};

export default NetworkCanvas;
