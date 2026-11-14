/**
 * Auto Layout Utilities
 * Hierarchical network topology layout using dagre
 */

import dagre from 'dagre';
import type { NetworkDevice, NetworkConnection, ConnectionType } from '@/types';
import { withLeases } from '@/engine';
import { DEVICE_METRICS, deviceHeight } from '@/utils/deviceGeometry';

/**
 * Node dimensions for layout calculation: the frame of a device on the
 * canvas, with its address
 */
const NODE_WIDTH = DEVICE_METRICS.width;
const NODE_HEIGHT = deviceHeight(true);

/**
 * Device Tier Hierarchy
 * Lower tier = higher in network hierarchy (closer to edge/internet)
 */
export const DeviceTier = {
  TIER_1_EDGE: 1,      // Router (Internet Gateway)
  TIER_2_SECURITY: 2,  // Firewall
  TIER_3_CORE: 3,      // Core Switch
  TIER_4_DISTRIB: 4,   // Distribution Switch, Load Balancer
  TIER_5_ACCESS: 5,    // End devices (PC, Server, Database, AP)
  TIER_UNKNOWN: 99,    // Unknown device type
} as const;

export type DeviceTier = typeof DeviceTier[keyof typeof DeviceTier];

/**
 * Map device types to their tier in network hierarchy
 */
const DEVICE_TIER_MAP: Record<string, DeviceTier> = {
  'Router': DeviceTier.TIER_1_EDGE,
  'Firewall': DeviceTier.TIER_2_SECURITY,
  'Switch': DeviceTier.TIER_4_DISTRIB, // Default for generic switches
  'LoadBalancer': DeviceTier.TIER_4_DISTRIB,
  'PC': DeviceTier.TIER_5_ACCESS,
  'Server': DeviceTier.TIER_5_ACCESS,
  'Database': DeviceTier.TIER_5_ACCESS,
  'AccessPoint': DeviceTier.TIER_5_ACCESS,
  'Cloud': DeviceTier.TIER_1_EDGE, // Cloud gateway at edge
};

/**
 * Get device tier based on type and label
 * Core switches are detected by name (e.g., "Core", "core-switch")
 */
export function getDeviceTier(device: NetworkDevice): DeviceTier {
  // Special case: Core switches (Switch type but with "core" in name)
  if (device.type === 'Switch' && device.label.toLowerCase().includes('core')) {
    return DeviceTier.TIER_3_CORE;
  }

  // Check if device type exists in tier map
  const tier = DEVICE_TIER_MAP[device.type];
  if (tier !== undefined) {
    return tier;
  }

  // Unknown device type
  return DeviceTier.TIER_UNKNOWN;
}

/**
 * Determine connection type based on device tiers and IP subnets
 * Uses hybrid approach: hierarchy tier + subnet relationship
 */
export function getConnectionType(
  sourceDevice: NetworkDevice,
  targetDevice: NetworkDevice
): ConnectionType {
  const sourceTier = getDeviceTier(sourceDevice);
  const targetTier = getDeviceTier(targetDevice);

  // Extract network class (first 2 octets) to detect inter-building connections.
  // A device that takes its address from DHCP has none to tell a building by:
  // it is where the device it is cabled to is
  const leased = (device: NetworkDevice) => device.nics?.[0]?.dhcp === true;
  const sourceNetClass = sourceDevice.ip.split('.').slice(0, 2).join('.');
  const targetNetClass = targetDevice.ip.split('.').slice(0, 2).join('.');
  const isInterBuilding =
    !leased(sourceDevice) && !leased(targetDevice) && sourceNetClass !== targetNetClass;

  // Extract subnet (first 3 octets)
  const sourceSubnet = sourceDevice.ip.split('.').slice(0, 3).join('.');
  const targetSubnet = targetDevice.ip.split('.').slice(0, 3).join('.');
  const isSameSubnet = sourceSubnet === targetSubnet;

  // Inter-building connections are always backbone
  if (isInterBuilding) {
    return 'backbone';
  }

  // Tier-based connection type determination
  // Router → Firewall
  if (sourceTier === DeviceTier.TIER_1_EDGE && targetTier === DeviceTier.TIER_2_SECURITY) {
    return 'uplink';
  }

  // Firewall → Core Switch
  if (sourceTier === DeviceTier.TIER_2_SECURITY && targetTier === DeviceTier.TIER_3_CORE) {
    return 'trunk';
  }

  // Core Switch → Distribution Switch/LoadBalancer
  if (sourceTier === DeviceTier.TIER_3_CORE && targetTier === DeviceTier.TIER_4_DISTRIB) {
    return 'trunk';
  }

  // Distribution → Access (Switch/LoadBalancer → End Devices)
  if (sourceTier === DeviceTier.TIER_4_DISTRIB && targetTier === DeviceTier.TIER_5_ACCESS) {
    return 'access';
  }

  // Access-to-Access connections (same tier end devices)
  if (sourceTier === DeviceTier.TIER_5_ACCESS && targetTier === DeviceTier.TIER_5_ACCESS) {
    // If same subnet, it's local access
    // If different subnet, it's a special backbone link (e.g., DB replication)
    return isSameSubnet ? 'access' : 'backbone';
  }

  // Default fallback based on subnet relationship
  return isSameSubnet ? 'access' : 'trunk';
}

/**
 * Layout configuration factory
 * Creates dagre config with specified direction
 */
const getLayoutConfig = (direction: 'TB' | 'LR' = 'TB') => ({
  rankdir: direction, // TB = Top-Bottom (vertical), LR = Left-Right (horizontal)
  nodesep: 100, // Horizontal spacing between nodes (ridotto per compattare lateralmente)
  ranksep: 250, // Vertical spacing between ranks (levels) (aumentato per più sviluppo verticale)
  align: 'UL', // Alignment: up-left
  marginx: 50,
  marginy: 50,
});

/**
 * Calculate optimal handle positions for connections based on device positions
 * Determines which side of each device the edge should connect to
 *
 * @param layoutedDevices - Devices with their calculated positions
 * @param connections - Network connections to update
 * @returns Connections with optimal sourceHandle and targetHandle
 */
function calculateOptimalHandles(
  layoutedDevices: NetworkDevice[],
  connections: NetworkConnection[]
): NetworkConnection[] {
  return connections.map((conn) => {
    const sourceDevice = layoutedDevices.find((d) => d.id === conn.source);
    const targetDevice = layoutedDevices.find((d) => d.id === conn.target);

    // If devices not found, preserve original connection
    if (!sourceDevice || !targetDevice) {
      return conn;
    }

    // Calculate vector from source to target (using device centers)
    const sourceCenterX = sourceDevice.position.x + NODE_WIDTH / 2;
    const sourceCenterY = sourceDevice.position.y + NODE_HEIGHT / 2;
    const targetCenterX = targetDevice.position.x + NODE_WIDTH / 2;
    const targetCenterY = targetDevice.position.y + NODE_HEIGHT / 2;

    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;

    // Determine optimal handles based on direction
    let sourceHandle: string;
    let targetHandle: string;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominance - use left/right handles
      sourceHandle = dx > 0 ? 'right' : 'left';
      targetHandle = dx > 0 ? 'left' : 'right';
    } else {
      // Vertical dominance - use top/bottom handles
      sourceHandle = dy > 0 ? 'bottom' : 'top';
      targetHandle = dy > 0 ? 'top' : 'bottom';
    }

    return {
      ...conn,
      sourceHandle,
      targetHandle,
    };
  });
}

/**
 * Apply hierarchical layout to network devices
 * Uses dagre algorithm to organize devices based on their connections
 *
 * @param devices - Array of network devices
 * @param connections - Array of network connections
 * @param direction - Layout direction: 'TB' (vertical) or 'LR' (horizontal)
 * @returns Object with devices (updated positions) and connections (optimal handles)
 */
export function applyHierarchicalLayout(
  devices: NetworkDevice[],
  connections: NetworkConnection[],
  direction: 'TB' | 'LR' = 'TB'
): { devices: NetworkDevice[]; connections: NetworkConnection[] } {
  // Create a new dagre graph
  const graph = new dagre.graphlib.Graph();

  // Set graph configuration
  graph.setGraph(getLayoutConfig(direction));

  // Default node and edge settings
  graph.setDefaultEdgeLabel(() => ({}));

  // Add all devices as nodes
  devices.forEach((device) => {
    graph.setNode(device.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: device.label,
    });
  });

  // Add all connections as edges
  connections.forEach((connection) => {
    graph.setEdge(connection.source, connection.target);
  });

  // Run the dagre layout algorithm
  dagre.layout(graph);

  // Map the calculated positions back to devices
  const layoutedDevices = devices.map((device) => {
    const nodeWithPosition = graph.node(device.id);

    return {
      ...device,
      position: {
        // Dagre returns center coordinates, we need top-left
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  // Calculate optimal handles based on new positions
  const layoutedConnections = calculateOptimalHandles(layoutedDevices, connections);

  return {
    devices: layoutedDevices,
    connections: layoutedConnections,
  };
}

/**
 * Auto-organize devices by subnet/building
 * Groups devices by their network class into horizontal sections with vertical hierarchy
 *
 * @param devices - Array of network devices
 * @param connections - Array of network connections
 * @param direction - Layout direction: 'TB' (vertical) or 'LR' (horizontal)
 * @returns Object with devices (updated positions) and connections (optimal handles)
 */
export function applySubnetGroupedLayout(
  devices: NetworkDevice[],
  connections: NetworkConnection[],
  direction: 'TB' | 'LR' = 'TB'
): { devices: NetworkDevice[]; connections: NetworkConnection[] } {
  // Group devices by network class (first 2 octets for private networks)
  // This groups buildings/locations together (e.g., 192.168.x.x, 10.10.x.x, 172.16.x.x)
  const subnetGroups = new Map<string, NetworkDevice[]>();

  // (a device on DHCP is grouped by the address it is leased)
  const leasedIp = new Map(
    withLeases({ devices, connections }).devices.map((device) => [device.id, device.ip] as const)
  );

  devices.forEach((device) => {
    const octets = (leasedIp.get(device.id) ?? device.ip).split('.');
    // Use first 2 octets for network class grouping
    // This keeps all floors/subnets of same building together
    const networkClass = `${octets[0]}.${octets[1]}`;

    if (!subnetGroups.has(networkClass)) {
      subnetGroups.set(networkClass, []);
    }
    subnetGroups.get(networkClass)!.push(device);
  });

  // Apply hierarchical layout to each group separately
  let xOffset = 0;
  const allLayoutedDevices: NetworkDevice[] = [];
  const processedConnectionIds = new Set<string>(); // Track processed connections to avoid duplicates
  const allLayoutedConnections: NetworkConnection[] = [];

  subnetGroups.forEach((groupDevices) => {
    // Get connections involving this group
    // Include BOTH internal connections AND cross-group connections
    // This ensures hierarchy is preserved even with WAN links
    const groupDeviceIds = new Set(groupDevices.map((d) => d.id));
    const groupConnections = connections.filter(
      (conn) =>
        groupDeviceIds.has(conn.source) || groupDeviceIds.has(conn.target)
    );

    // Layout this group with hierarchical algorithm (respecting direction parameter)
    const { devices: layoutedGroup, connections: layoutedGroupConnections } = applyHierarchicalLayout(groupDevices, groupConnections, direction);

    // Shift group horizontally to separate buildings
    const shiftedGroup = layoutedGroup.map((device) => ({
      ...device,
      position: {
        x: device.position.x + xOffset,
        y: device.position.y,
      },
    }));

    allLayoutedDevices.push(...shiftedGroup);

    // Add connections but avoid duplicates (inter-building links appear in multiple groups)
    layoutedGroupConnections.forEach((conn) => {
      if (!processedConnectionIds.has(conn.id)) {
        allLayoutedConnections.push(conn);
        processedConnectionIds.add(conn.id);
      }
    });

    // Calculate next offset (max X in this group + spacing)
    const maxX = Math.max(...shiftedGroup.map((d) => d.position.x));
    xOffset = maxX + NODE_WIDTH + 150; // 150px gap between buildings (ridotto per compattare)
  });

  // Return devices and connections with handles already calculated by hierarchical layout
  return {
    devices: allLayoutedDevices,
    connections: allLayoutedConnections,
  };
}

/**
 * Calculate Euclidean distance between two devices
 */
function calculateDistance(dev1: NetworkDevice, dev2: NetworkDevice): number {
  const dx = dev1.position.x - dev2.position.x;
  const dy = dev1.position.y - dev2.position.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if connection already exists between two devices
 */
function connectionExists(
  connections: NetworkConnection[],
  sourceId: string,
  targetId: string
): boolean {
  return connections.some(
    (conn) =>
      (conn.source === sourceId && conn.target === targetId) ||
      (conn.source === targetId && conn.target === sourceId) // Bidirectional check
  );
}

/**
 * Auto-connect devices based on hierarchy tier and proximity
 * Creates intelligent connections using hybrid approach (tier + IP subnet)
 *
 * @param devices - Array of network devices with positions
 * @param existingConnections - Existing connections to avoid duplicates
 * @param startingCounter - Starting connection counter from store
 * @returns Array of new connections to add
 */
export function autoConnectDevices(
  devices: NetworkDevice[],
  existingConnections: NetworkConnection[],
  startingCounter: number
): NetworkConnection[] {
  const newConnections: NetworkConnection[] = [];
  let connectionCounter = startingCounter;

  // Group devices by tier
  const devicesByTier = new Map<DeviceTier, NetworkDevice[]>();
  devices.forEach((device) => {
    const tier = getDeviceTier(device);
    if (!devicesByTier.has(tier)) {
      devicesByTier.set(tier, []);
    }
    devicesByTier.get(tier)!.push(device);
  });

  // Sort tiers ascending (Edge → Access)
  const sortedTiers = Array.from(devicesByTier.keys()).sort((a, b) => a - b);

  // Connect each tier to the tier above it (lower tier number = higher in hierarchy)
  for (let i = 0; i < sortedTiers.length; i++) {
    const currentTier = sortedTiers[i];
    const currentDevices = devicesByTier.get(currentTier)!;

    // Find parent tier (tier immediatamente precedente, non il primo in assoluto)
    // Es: se tiers = [1, 2, 5] e currentTier=5 → parentTier=2 (non 1!)
    const parentTier = sortedTiers
      .filter((t) => t < currentTier)
      .sort((a, b) => b - a)[0]; // Prendi il più alto tra quelli minori

    if (parentTier !== undefined) {
      const parentDevices = devicesByTier.get(parentTier)!;

      // Connect each current device to closest parent device
      currentDevices.forEach((device) => {
        // Find closest parent device (prefer same building by network class)
        const deviceNetClass = device.ip.split('.').slice(0, 2).join('.');

        // First try same building
        let closestParent = parentDevices
          .filter((p) => p.ip.split('.').slice(0, 2).join('.') === deviceNetClass)
          .sort((a, b) => calculateDistance(device, a) - calculateDistance(device, b))[0];

        // If no parent in same building, use closest parent overall
        if (!closestParent) {
          closestParent = parentDevices
            .sort((a, b) => calculateDistance(device, a) - calculateDistance(device, b))[0];
        }

        // Create connection if it doesn't exist
        if (closestParent && !connectionExists(existingConnections, device.id, closestParent.id)) {
          const connectionType = getConnectionType(closestParent, device);

          newConnections.push({
            id: `conn-${connectionCounter++}`,
            source: closestParent.id,
            target: device.id,
            type: connectionType,
            sourceHandle: null,
            targetHandle: null,
          });
        }
      });
    }
  }

  // Special case: Connect devices within same tier if they're Database replicas
  const accessDevices = devicesByTier.get(DeviceTier.TIER_5_ACCESS) || [];
  const databases = accessDevices.filter((d) => d.type === 'Database');

  if (databases.length >= 2) {
    // Group databases by network class (same building)
    const dbByBuilding = new Map<string, NetworkDevice[]>();
    databases.forEach((db) => {
      const netClass = db.ip.split('.').slice(0, 2).join('.');
      if (!dbByBuilding.has(netClass)) {
        dbByBuilding.set(netClass, []);
      }
      dbByBuilding.get(netClass)!.push(db);
    });

    // Connect databases within same building (replication links)
    dbByBuilding.forEach((buildingDbs) => {
      if (buildingDbs.length >= 2) {
        // Connect first DB to second DB (primary-replica pattern)
        const [primary, replica] = buildingDbs;
        if (!connectionExists(existingConnections, primary.id, replica.id)) {
          newConnections.push({
            id: `conn-${connectionCounter++}`,
            source: primary.id,
            target: replica.id,
            type: 'backbone', // Replication is backbone
            label: 'DB Replication',
            sourceHandle: null,
            targetHandle: null,
          });
        }
      }
    });
  }

  // Special case: Inter-building backbone connections
  // Connect routers/firewalls between different buildings
  const edgeDevices = [
    ...(devicesByTier.get(DeviceTier.TIER_1_EDGE) || []),
    ...(devicesByTier.get(DeviceTier.TIER_2_SECURITY) || []),
  ];

  if (edgeDevices.length >= 2) {
    // Group edge devices by building
    const edgeByBuilding = new Map<string, NetworkDevice[]>();
    edgeDevices.forEach((device) => {
      const netClass = device.ip.split('.').slice(0, 2).join('.');
      if (!edgeByBuilding.has(netClass)) {
        edgeByBuilding.set(netClass, []);
      }
      edgeByBuilding.get(netClass)!.push(device);
    });

    // Connect buildings (mesh topology between edge devices)
    const buildings = Array.from(edgeByBuilding.keys());
    if (buildings.length >= 2) {
      // Connect each building to every other building (full mesh for WAN)
      for (let i = 0; i < buildings.length; i++) {
        for (let j = i + 1; j < buildings.length; j++) {
          const building1Devices = edgeByBuilding.get(buildings[i])!;
          const building2Devices = edgeByBuilding.get(buildings[j])!;

          // Connect first edge device of each building (typically router or firewall)
          const device1 = building1Devices[0];
          const device2 = building2Devices[0];

          if (!connectionExists(existingConnections, device1.id, device2.id)) {
            newConnections.push({
              id: `conn-${connectionCounter++}`,
              source: device1.id,
              target: device2.id,
              type: 'backbone',
              label: `WAN ${device1.label}-${device2.label}`,
              bandwidth: '1Gbps',
              sourceHandle: null,
              targetHandle: null,
            });
          }
        }
      }
    }
  }

  return newConnections;
}
