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
  NodeToolbar,
  Position,
} from 'reactflow';
import { SquareDashed } from 'lucide-react';
import type {
  Node,
  Edge,
  Connection,
  ReactFlowState,
  OnConnect,
  NodeTypes,
  NodeChange,
  NodeMouseHandler,
  MiniMapNodeProps,
  OnConnectStart,
  OnConnectEnd,
  EdgeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import NetworkDevice from './NetworkDevice';
import AreaNode from './AreaNode';
import { useDhcp } from '@/utils/useDhcp';
import { shownAddress } from '@/utils/dhcpLabels';
import { useAddressConflicts } from '@/utils/useAddressConflicts';
import { conflictedAddress } from '@/utils/addressConflicts';
import { miniMapColour } from '@/utils/miniMapColour';
import CustomEdge from './CustomEdge';
import ParticleEdge from './ParticleEdge';
import PacketAnimation from './PacketAnimation';
import DeviceNote from './DeviceNote';
import MarksLayer from './MarksLayer';
import MarkerSurface from './MarkerSurface';
import MarkerToolbar from './MarkerToolbar';
import { useMarkerKeys } from './useMarkerKeys';
import WelcomeScreen from '@/components/WelcomeScreen';
import { useWelcomeShown } from '@/components/useWelcomeShown';
import { useNetworkStore } from '@/store/networkStore';
import { useUIStore } from '@/store/uiStore';
import { usePresentationStore } from '@/store/presentationStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useMarkerStore } from '@/store/markerStore';
import type { CanvasArea, NetworkDevice as NetworkDeviceType } from '@/types/network';
import { getT, useLanguage, useT } from '@/i18n';
import { shortcutLetter } from '@/utils/shortcutKey';
import { askConfirm, useConfirmStore, type ConfirmQuestion } from '@/store/confirmStore';
import { hasClipboard } from '@/utils/pasteDevices';
import { pasteAndTell } from '@/utils/pasteActions';
import { encloseDevices } from '@/utils/areaActions';

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

/** A device on the small map is drawn in the colour of its type */
const miniMapNodeColour = (node: Node): string =>
  miniMapColour((node.data as NetworkDeviceType | undefined)?.type);

/** What tells an area on the small map, where it is not drawn */
const MINI_MAP_AREA = 'minimap-area';
const miniMapNodeClass = (node: Node): string => (node.type === AREA_NODE ? MINI_MAP_AREA : '');

/**
 * A device on the small map: a plain square, without the rounded corners and
 * the border React Flow gives it (drawn without smoothing, at a scale that is
 * not a whole number, the corners left stray pixels). An area is not drawn:
 * at the size of the map its faint rectangle showed as marks around and
 * under the squares of its devices
 */
const MiniMapSquare = ({ x, y, width, height, color, className, shapeRendering }: MiniMapNodeProps) =>
  className.includes(MINI_MAP_AREA) ? null : (
    <rect
      className="react-flow__minimap-node"
      x={x}
      y={y}
      width={width}
      height={height}
      fill={color}
      shapeRendering={shapeRendering}
    />
  );

/**
 * The question the Delete key asks: for one thing alone the one its menu
 * asks, for more how many of each
 */
function deleteQuestion(
  devices: readonly NetworkDeviceType[],
  connectionCount: number,
  areas: readonly CanvasArea[]
): ConfirmQuestion {
  const t = getT();
  const yes = { confirmLabel: t.common.actions.delete, danger: true };
  const alone = devices.length + connectionCount + areas.length === 1;
  if (alone && devices.length === 1) {
    const words = t.contextMenu.device.deleteQuestion;
    return { title: words.title(devices[0].label), detail: words.detail, ...yes };
  }
  if (alone && areas.length === 1) {
    const words = t.contextMenu.area.deleteQuestion;
    return { title: words.title(areas[0].label), detail: words.detail, ...yes };
  }
  if (alone) return { title: t.contextMenu.connection.deleteQuestion.title, ...yes };
  const words = t.canvas.deleteQuestion;
  return {
    title: words.title(devices.length, connectionCount, areas.length),
    ...(devices.length > 0 ? { detail: words.detail } : {}),
    ...yes,
  };
}

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
  const t = useT();
  const devices = useNetworkStore((state) => state.devices);
  const connections = useNetworkStore((state) => state.connections);
  const areas = useNetworkStore((state) => state.areas);
  // (hidden from the View menu, the areas are not on the board at all)
  const areasShown = useUIStore((state) => state.areasShown);
  const selectedAreaId = useNetworkStore((state) => state.selectedAreaId);
  const viewport = useNetworkStore((state) => state.viewport);
  const fitViewRequest = useNetworkStore((state) => state.fitViewRequest);
  const updateDevice = useNetworkStore((state) => state.updateDevice);
  const addConnection = useNetworkStore((state) => state.addConnection);
  const setViewport = useNetworkStore((state) => state.setViewport);
  const getConnection = useNetworkStore((state) => state.getConnection);
  const selectedDeviceIds = useNetworkStore((state) => state.selectedDeviceIds);
  const selectedAreaIds = useNetworkStore((state) => state.selectedAreaIds);
  const selectMultipleDevices = useNetworkStore((state) => state.selectMultipleDevices);
  const copySelection = useNetworkStore((state) => state.copySelection);
  const clipboard = useNetworkStore((state) => state.clipboard);
  const setContextMenuDevice = useUIStore((state) => state.setContextMenuDevice);
  const setContextMenuConnection = useUIStore((state) => state.setContextMenuConnection);
  const setInspectorDevice = useUIStore((state) => state.setInspectorDevice);
  const openModal = useUIStore((state) => state.openModal);
  const closeContextMenu = useUIStore((state) => state.closeContextMenu);
  const magnifiedConnectionTypes = useUIStore((state) => state.magnifiedConnectionTypes);
  const particleAnimationEnabled = useUIStore((state) => state.particleAnimationEnabled);
  // The welcome screen, drawn inside the canvas while it is an empty project
  const shouldShowWelcome = useWelcomeShown();
  const canvasRevision = useNetworkStore((state) => state.canvasRevision);
  // Presentation mode: the drawing is shown, not edited
  const presenting = usePresentationStore((state) => state.active);
  const panelOpen = usePresentationStore((state) => state.panelOpen);
  // The marker in use: the pointer writes on the board (MarkerSurface)
  const markerActive = useMarkerStore((state) => state.active);
  useMarkerKeys();

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
        // (the areas of the selection are not React Flow's: they are kept,
        // and let go where a press says so, see handlePressCapture)
        selectMultipleDevices(selectedIds, { keepAreas: true });
        // Use queueMicrotask instead of setTimeout - more reliable and performant
        queueMicrotask(() => {
          isUpdatingSelection.current = false;
        });
      }
    },
    [selectMultipleDevices]
  );

  // A press of the left button without Ctrl on a device that is not
  // selected, or on a cable, makes a new selection (React Flow's): the areas
  // that were in the old one are let go. A press on a selected device keeps
  // them, since it moves the whole selection; Ctrl+click adds to it
  const handlePressCapture = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return;
    if (usePresentationStore.getState().active) return;
    const network = useNetworkStore.getState();
    if (network.selectedAreaIds.length === 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const device = target?.closest('.react-flow__node-device');
    if (device) {
      if (!network.selectedDeviceIds.includes(device.getAttribute('data-id') ?? '')) network.selectArea(null);
      return;
    }
    if (target?.closest('.react-flow__edge')) network.selectArea(null);
  }, []);

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
  // (and an address another device has too, in conflict)
  const conflicts = useAddressConflicts();
  const language = useLanguage();

  // The areas come first and lie under everything: under the cables too,
  // which React Flow draws at depth 0. An area is not React Flow's to
  // select, drag, join or delete: it never enters the selection of the
  // devices, and a selection box drawn over it takes the devices alone
  // (see AreaNode for how it is taken and moved)
  const areaNodes: Node[] = useMemo(
    () =>
      (areasShown ? areas : []).map((area) => ({
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
    [areas, areasShown]
  );

  // Hidden, an area cannot be selected nor renamed: the one that was is let go
  useEffect(() => {
    if (areasShown) return;
    const network = useNetworkStore.getState();
    if (network.selectedAreaIds.length > 0) network.selectArea(null);
    if (network.editingAreaId !== null) network.setEditingArea(null);
  }, [areasShown]);

  // Sync Zustand devices to React Flow nodes (memoized to prevent unnecessary re-renders)
  const deviceNodes: Node[] = useMemo(() => {
    // (a card on DHCP that was given no address says so in words, in the
    // language of the moment: the list is made again when it changes)
    void language;
    return devices.map((device) => ({
      id: device.id,
      type: 'device',
      position: device.position,
      selected: selectedDeviceIds.includes(device.id), // React Flow selection property
      data: {
        ...device,
        address: shownAddress(device, dhcp),
        conflict: conflictedAddress(device, conflicts),
        isSelected: selectedDeviceIds.includes(device.id), // Keep for backward compatibility
        onContextMenu: handleDeviceContextMenu,
        onDoubleClick: handleDeviceDoubleClick,
      },
    }));
  }, [devices, dhcp, conflicts, language, selectedDeviceIds, handleDeviceContextMenu, handleDeviceDoubleClick]);

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
      // (devices asked for alone, as a batch just added, are brought into view
      // without zooming in on them)
      const only = useNetworkStore.getState().fitViewNodes;
      reactFlowInstance.fitView({
        padding: 0.2, // 20% padding around edges
        duration: 300, // Smooth animation 300ms
        ...(only ? { nodes: only.map((id) => ({ id })), maxZoom: reactFlowInstance.getZoom() } : {}),
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

  // The selected areas follow the selected devices React Flow moves (a
  // device of the selection dragged, the rectangle around it, the arrow
  // keys). Where each area was and where the device was when the move
  // began: the areas are placed from there, so that no rounding piles up
  const dragAnchor = useRef<{
    deviceId: string;
    from: { x: number; y: number };
    areas: Array<[string, { x: number; y: number }]>;
  } | null>(null);
  const moveSelectedAreas = useCallback((changes: NodeChange[]) => {
    const network = useNetworkStore.getState();
    if (network.selectedAreaIds.length === 0) {
      dragAnchor.current = null;
      return;
    }
    for (const change of changes) {
      if (change.type !== 'position' || !network.selectedDeviceIds.includes(change.id)) continue;
      // (the end of a drag: the next move starts from where things are)
      if (!change.position) {
        if (change.dragging === false) dragAnchor.current = null;
        continue;
      }
      if (dragAnchor.current?.deviceId !== change.id) {
        const device = network.devices.find((entry) => entry.id === change.id);
        if (!device) continue;
        dragAnchor.current = {
          deviceId: change.id,
          from: device.position,
          areas: network.areas
            .filter((area) => network.selectedAreaIds.includes(area.id))
            .map((area) => [area.id, area.position]),
        };
      }
      const anchor = dragAnchor.current;
      const dx = change.position.x - anchor.from.x;
      const dy = change.position.y - anchor.from.y;
      network.moveTogether(
        {},
        Object.fromEntries(
          anchor.areas.map(([id, at]) => [id, { x: Math.round(at.x + dx), y: Math.round(at.y + dy) }])
        )
      );
      // (a step of the arrow keys is a move of its own)
      if (!change.dragging) dragAnchor.current = null;
      return;
    }
  }, []);

  // Handle node position changes (drag)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      // (before the devices are written: where the dragged one was is read from the store)
      moveSelectedAreas(changes);

      // Update Zustand store when node position changes (while it is dragged too)
      changes.forEach((change) => {
        if (change.type === 'position' && 'position' in change && change.position) {
          // (an area moved by one of its resize handles writes itself to the store)
          if (useNetworkStore.getState().areas.some((area) => area.id === change.id)) return;
          updateDevice(change.id, { position: change.position });
        }
      });
    },
    [onNodesChange, updateDevice, moveSelectedAreas]
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

  // An area selected by itself: the devices and the cables React Flow had
  // selected are let go (the store has emptied its own list already), so
  // that the Delete key deletes the area and nothing else. Not while a
  // selection box is drawn: what it takes is passed to the store a moment
  // apart, the areas before the devices
  useEffect(() => {
    if (selectedAreaId === null) return;
    if (reactFlowStore.getState().userSelectionActive) return;
    reactFlowStore.getState().unselectNodesAndEdges();
  }, [selectedAreaId, reactFlowStore]);

  // A press on the empty canvas (a click there, or a selection box begun
  // there) lets go of the area that was selected
  const deselectArea = useCallback(() => {
    useNetworkStore.getState().selectArea(null);
  }, []);

  // A selection box takes the areas it wholly holds, as it takes the
  // devices (SelectionMode.Full). The box is React Flow's: it is read from
  // its store while it is drawn, in the measure of the screen
  useEffect(() => {
    if (presenting) return;
    return reactFlowStore.subscribe((state) => {
      if (!state.userSelectionActive || !state.userSelectionRect) return;
      // (hidden areas are out of its reach)
      if (!useUIStore.getState().areasShown) return;
      const { x, y, width, height } = state.userSelectionRect;
      const [tx, ty, zoom] = state.transform;
      const box = {
        left: (x - tx) / zoom,
        top: (y - ty) / zoom,
        right: (x + width - tx) / zoom,
        bottom: (y + height - ty) / zoom,
      };
      const network = useNetworkStore.getState();
      network.setSelectedAreas(
        network.areas
          .filter(
            (area) =>
              area.position.x >= box.left &&
              area.position.y >= box.top &&
              area.position.x + area.size.width <= box.right &&
              area.position.y + area.size.height <= box.bottom
          )
          .map((area) => area.id)
      );
    });
  }, [presenting, reactFlowStore]);

  // The Delete key deletes what is selected: devices (with their cables),
  // cables and areas, after the question the menu of the right button asks.
  // Not while typing, not while a window is open, not while presenting
  useEffect(() => {
    const handleDeleteKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      if (usePresentationStore.getState().active) return;
      const target = e.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (isTyping) return;
      // (the key belongs to a window open over the drawing, the question
      // included; the terminal floats beside the drawing and is not one)
      if (useConfirmStore.getState().pending) return;
      const { codeTerminal, ...windows } = useUIStore.getState().modals;
      void codeTerminal;
      if (Object.values(windows).some(Boolean)) return;

      const flow = reactFlowStore.getState();
      const network = useNetworkStore.getState();
      const devices = network.devices.filter((device) =>
        flow.getNodes().some((node) => node.selected && node.id === device.id && node.type !== AREA_NODE)
      );
      const connections = flow.edges.filter((edge) => edge.selected).map((edge) => edge.id);
      // (hidden areas are out of its reach)
      const areas = useUIStore.getState().areasShown
        ? network.areas.filter((area) => network.selectedAreaIds.includes(area.id))
        : [];
      if (devices.length + connections.length + areas.length === 0) return;
      e.preventDefault();
      void (async () => {
        if (!(await askConfirm(deleteQuestion(devices, connections.length, areas)))) return;
        useNetworkStore.getState().removeElements({
          devices: devices.map((device) => device.id),
          connections,
          areas: areas.map((area) => area.id),
        });
      })();
    };
    window.addEventListener('keydown', handleDeleteKey);
    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [reactFlowStore]);

  // The marker taken up: the menus open on the board close, as at a click on it
  useEffect(() => {
    if (!markerActive) return;
    closeContextMenu();
    usePresentationStore.getState().closeMenu();
  }, [markerActive, closeContextMenu]);

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

  // Keyboard shortcuts: Ctrl+C (copy), Ctrl+V (paste), Cmd on a Mac. The
  // letter is read whatever Caps Lock says (utils/shortcutKey)
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      const letter = shortcutLetter(e);
      if (letter === null) return;
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

      // Ctrl+C - Copy selection: devices, the cables among them, areas
      if (letter === 'c' && selectedDeviceIds.length + selectedAreaIds.length > 0) {
        e.preventDefault();
        copySelection();
      }

      // Ctrl+V - Paste from clipboard
      if (letter === 'v' && hasClipboard(clipboard)) {
        e.preventDefault();
        pasteAndTell();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [selectedDeviceIds, selectedAreaIds, clipboard, copySelection]);

  // Suppress React Flow development warnings
  // These are false positives caused by React Strict Mode
  const handleError = useCallback(() => {
    // Suppress all React Flow warnings in development
    // Our code is correct - warnings are due to Strict Mode double-rendering
    return;
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Welcome Screen: drawn inside the canvas */}
      {shouldShowWelcome && <WelcomeScreen />}

      {/* The tools of the marker, over the top of the board while it is in use */}
      {markerActive && <MarkerToolbar />}

      {/* React Flow Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full"
        onClick={handleCanvasClick}
        onMouseDownCapture={handlePressCapture}
      >
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
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
        // The Delete key is the canvas's own: it asks first (handleDeleteKey)
        deleteKeyCode={null}
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
        {!presenting && (
          <MiniMap nodeColor={miniMapNodeColour} nodeClassName={miniMapNodeClass} nodeComponent={MiniMapSquare} />
        )}
        {/* Two devices selected or more: a button over them encloses them
            in an area, as Modifica → «Racchiudi in un riquadro» does */}
        {!presenting && selectedDeviceIds.length >= 2 && (
          <NodeToolbar
            nodeId={selectedDeviceIds}
            isVisible
            position={Position.Top}
            offset={8}
            className="selection-toolbar nopan nodrag"
          >
            <button
              type="button"
              className="selection-toolbar-button"
              onClick={() => encloseDevices(useNetworkStore.getState().selectedDeviceIds)}
            >
              <SquareDashed size={14} strokeWidth={1.75} aria-hidden="true" />
              {t.menu.edit.enclose}
            </button>
          </NodeToolbar>
        )}
        {/* Packet Animation Logic */}
        <PacketAnimation />
        <DeviceNote />
        {/* What is written with the marker, over the devices and the cables;
            and, while the marker is in use, the sheet that takes the pointer */}
        <MarksLayer />
        {markerActive && <MarkerSurface />}
      </ReactFlow>
      </div>
    </div>
  );
};

export default NetworkCanvas;
