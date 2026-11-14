import type {
  NetworkDevice,
  DeviceType,
  GlobalNetworkSettings,
  DeviceTemplate,
  Port,
  NetworkInterfaceCard,
} from '@/types/network';
import { generateMacAddress } from './ipHelpers';
import { isEndDeviceKind } from './defaultDns';
import { isL3Type } from '@/engine';
import { getT } from '@/i18n';

/**
 * Configurable Device Row (from BulkAddDeviceModal)
 */
interface ConfigurableDeviceRow {
  id: string;
  templateType: DeviceType;
  portCount: number;
  quantity: number;
}

/**
 * Generates sequential device name based on type and existing count
 */
export const generateDeviceName = (
  type: DeviceType,
  index: number,
  existingDevices: NetworkDevice[]
): string => {
  const typeCount = existingDevices.filter((d) => d.type === type).length;
  return `${type}-${typeCount + index}`;
};

/**
 * Generates grid-based positions to spread devices evenly
 */
export const generateGridPositions = (
  count: number,
  startX: number = 100,
  startY: number = 100,
  spacing: number = 200
): Array<{ x: number; y: number }> => {
  const positions: Array<{ x: number; y: number }> = [];
  const cols = Math.ceil(Math.sqrt(count));

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    positions.push({
      x: startX + col * spacing + (Math.random() * 50 - 25), // Add small random offset
      y: startY + row * spacing + (Math.random() * 50 - 25),
    });
  }

  return positions;
};

/**
 * Finds next available IP for a device
 */
const findNextAvailableIP = (
  existingDevices: NetworkDevice[],
  globalSettings: GlobalNetworkSettings
): string => {
  const usedIPs = new Set(existingDevices.map((d) => d.ip));
  const [base1, base2, base3] = globalSettings.gateway.split('.').slice(0, 3);

  // Start from .2 (skip .1 which is gateway)
  for (let i = 2; i <= 254; i++) {
    const ip = `${base1}.${base2}.${base3}.${i}`;
    if (!usedIPs.has(ip)) {
      return ip;
    }
  }

  // Fallback if all IPs are taken (shouldn't happen)
  return `${base1}.${base2}.${base3}.${Math.floor(Math.random() * 253) + 2}`;
};

/**
 * Generate default port configuration for network devices
 * @param portCount Number of ports to generate
 * @param deviceType Type of device (Switch, Router, Firewall)
 * @returns Array of Port configurations
 */
const generateDefaultPorts = (portCount: number, deviceType: DeviceType): Port[] => {
  const ports: Port[] = [];

  for (let i = 1; i <= portCount; i++) {
    const port: Port = {
      id: i,
      enabled: true,
      speed: 'auto',
    };

    // Device-specific defaults
    if (deviceType === 'Switch') {
      port.portType = i === 1 ? 'trunk' : 'access'; // First port is trunk (uplink), rest are access
      port.poe = i > 1; // PoE enabled for access ports
      port.vlan = i === 1 ? [1, 10, 20] : 1; // Trunk has multiple VLANs, access has VLAN 1
    } else if (deviceType === 'Router') {
      port.portType = i === 1 ? 'wan' : 'lan';
      port.nat = i === 1; // NAT enabled on WAN port
    } else if (deviceType === 'Firewall') {
      if (i === 1) {
        port.portType = 'wan';
        port.securityZone = 'untrust';
        port.ips = true; // IPS enabled on WAN
      } else if (i === 2) {
        port.portType = 'dmz';
        port.securityZone = 'dmz';
      } else {
        port.portType = 'lan';
        port.securityZone = 'trust';
      }
    }

    ports.push(port);
  }

  return ports;
};

/**
 * Generate default NIC configuration for end devices
 * @param ip IP address for NIC
 * @param subnet Subnet mask
 * @param gateway Gateway address
 * @param dns DNS server the card asks (the one of the project, when it has one)
 * @returns NetworkInterfaceCard configuration
 */
const generateDefaultNIC = (
  ip: string,
  subnet: string,
  gateway: string,
  dns?: string
): NetworkInterfaceCard => {
  return {
    id: 'nic-1',
    name: 'eth0',
    enabled: true,
    speed: 'auto',
    ip,
    subnet,
    gateway,
    ...(dns ? { dns } : {}),
    mac: generateMacAddress(),
    // Written on the card once, in the language of the moment: from then on it is the user's text
    description: getT().addDevice.bulk.cardDescription,
  };
};

/**
 * Bulk adds multiple devices with configurable port counts and standard devices with NICs
 *
 * @param configurableRows Array of configurable device rows (Switch/Router/Firewall with portCount)
 * @param standardQuantities Record of standard device quantities (PC/Server/Database/etc.)
 * @param existingDevices Array of existing devices (for IP/name generation)
 * @param globalSettings Global network settings
 * @param templates All device templates
 * @param addDeviceCallback Callback function to add each device
 * @returns Total number of devices added
 */
export const bulkAddDevices = (
  configurableRows: ConfigurableDeviceRow[],
  standardQuantities: Record<DeviceType, number>,
  existingDevices: NetworkDevice[],
  globalSettings: GlobalNetworkSettings,
  templates: DeviceTemplate[],
  addDeviceCallback: (device: Omit<NetworkDevice, 'id'>) => void
): number => {
  let totalAdded = 0;

  // Calculate total device count for position generation
  const configurableTotal = configurableRows.reduce((sum, row) => sum + row.quantity, 0);
  const standardTotal = Object.values(standardQuantities).reduce((sum, qty) => sum + qty, 0);
  const totalCount = configurableTotal + standardTotal;

  const allPositions = generateGridPositions(totalCount);
  let positionIndex = 0;
  const currentDevices = [...existingDevices];

  // PART 1: Add configurable devices (with ports)
  configurableRows.forEach(row => {
    if (row.quantity === 0) return;

    const template = templates.find(t => t.type === row.templateType);
    if (!template) return;

    for (let i = 0; i < row.quantity; i++) {
      const deviceName = generateDeviceName(row.templateType, i, currentDevices);
      const ip = findNextAvailableIP(currentDevices, globalSettings);
      const position = allPositions[positionIndex++];

      // Generate ports based on portCount
      const ports = generateDefaultPorts(row.portCount, row.templateType);

      const newDevice: Omit<NetworkDevice, 'id'> = {
        type: row.templateType,
        label: deviceName,
        ip,
        subnet: globalSettings.subnet,
        // On a router or firewall the gateway is its default route: left
        // empty, it is for whoever configures the device to choose
        gateway: isL3Type(row.templateType) ? '' : globalSettings.gateway,
        position,
        portCount: row.portCount,
        ports,
      };

      addDeviceCallback(newDevice);

      // Add to tracking array for next iteration
      currentDevices.push({ ...newDevice, id: `temp-${totalAdded}` } as NetworkDevice);
      totalAdded++;
    }
  });

  // PART 2: Add standard devices (with NICs)
  Object.entries(standardQuantities).forEach(([type, quantity]) => {
    if (quantity === 0) return;

    const template = templates.find(t => t.type === type);
    if (!template) return;

    for (let i = 0; i < quantity; i++) {
      const deviceName = generateDeviceName(type as DeviceType, i, currentDevices);
      const ip = findNextAvailableIP(currentDevices, globalSettings);
      const position = allPositions[positionIndex++];

      // Generate 1 NIC with MAC address
      // (the DNS server of the project is for end devices: see utils/defaultDns)
      const nic = generateDefaultNIC(
        ip,
        globalSettings.subnet,
        globalSettings.gateway,
        isEndDeviceKind(type, template.id) ? globalSettings.dns : undefined
      );

      const newDevice: Omit<NetworkDevice, 'id'> = {
        type: type as DeviceType,
        label: deviceName,
        ip, // Device-level IP mirrors NIC IP
        subnet: globalSettings.subnet,
        gateway: globalSettings.gateway,
        position,
        nics: [nic],
      };

      addDeviceCallback(newDevice);

      // Add to tracking array for next iteration
      currentDevices.push({ ...newDevice, id: `temp-${totalAdded}` } as NetworkDevice);
      totalAdded++;
    }
  });

  return totalAdded;
};
