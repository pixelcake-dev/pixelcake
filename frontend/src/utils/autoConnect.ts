/**
 * Automatic connection (Vista → Connessione automatica), as it was before
 * the layout was made again: moved here from utils/autoLayout.ts.
 */

import type { NetworkDevice, NetworkConnection, ConnectionType } from '@/types';

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
