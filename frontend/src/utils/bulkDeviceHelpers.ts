import type {
  NetworkDevice,
  GlobalNetworkSettings,
  DeviceTemplate,
  NetworkInterfaceCard,
} from '@/types/network';
import { findNextAvailableIP, generateMacAddress } from './ipHelpers';
import { isEndDeviceKind } from './defaultDns';
import { newDeviceName, newDevicePorts } from './newDevice';
import { gridPlaces, type Place } from './placeDevice';
import { isL3Type } from '@/engine';

/**
 * Configurable Device Row (from BulkAddDeviceModal): so many devices of one
 * template, with so many ports each. The template is told by its id: two
 * templates can be of one type
 */
interface ConfigurableDeviceRow {
  id: string;
  templateId: string;
  portCount: number;
  quantity: number;
}

/**
 * Generates grid-based positions to spread devices evenly
 */
/**
 * Generate default NIC configuration for end devices: the card the window
 * that adds one device starts from (AddDeviceModal)
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
  };
};

/**
 * Bulk adds multiple devices with configurable port counts and standard devices with NICs.
 * Each is made from the template of its row, which is found by its id: its
 * name, its address, its card and its ports are those the window that adds
 * one device gives a device of that template
 *
 * @param configurableRows Array of configurable device rows (Switch/Router/Firewall with portCount)
 * @param standardQuantities How many standard devices (PC/Server/Database/etc.) of each template, by template id
 * @param existingDevices Array of existing devices (for IP/name generation)
 * @param globalSettings Global network settings
 * @param templates All device templates
 * @param addDeviceCallback Callback function to add each device
 * @param start Where the first goes: the others follow in a grid of rows
 *   from there, past the places the devices already there are on (gridPlaces)
 * @returns Total number of devices added
 */
export const bulkAddDevices = (
  configurableRows: ConfigurableDeviceRow[],
  standardQuantities: Record<string, number>,
  existingDevices: NetworkDevice[],
  globalSettings: GlobalNetworkSettings,
  templates: DeviceTemplate[],
  addDeviceCallback: (device: Omit<NetworkDevice, 'id'>) => void,
  start: Place = { x: 100, y: 100 }
): number => {
  let totalAdded = 0;

  // Calculate total device count for position generation
  const configurableTotal = configurableRows.reduce((sum, row) => sum + row.quantity, 0);
  const standardTotal = Object.values(standardQuantities).reduce((sum, qty) => sum + qty, 0);
  const totalCount = configurableTotal + standardTotal;

  const allPositions = gridPlaces(
    totalCount,
    start,
    existingDevices.map((device) => device.position)
  );
  let positionIndex = 0;
  const currentDevices = [...existingDevices];

  // PART 1: Add configurable devices (with ports)
  configurableRows.forEach(row => {
    if (row.quantity === 0) return;

    const template = templates.find(t => t.id === row.templateId);
    if (!template) return;
    const type = template.type;

    for (let i = 0; i < row.quantity; i++) {
      // (the devices just made are in the list: their names are taken)
      const deviceName = newDeviceName(template.name, currentDevices);
      const ip = findNextAvailableIP(currentDevices, globalSettings);
      const position = allPositions[positionIndex++];

      // As many ports as the row says, plain: those the window that adds one gives
      const ports = newDevicePorts(row.portCount, type);

      const newDevice: Omit<NetworkDevice, 'id'> = {
        type,
        templateId: template.id,
        label: deviceName,
        ip,
        subnet: globalSettings.subnet,
        // On a router or firewall the gateway is its default route: left
        // empty, it is for whoever configures the device to choose
        gateway: isL3Type(type) ? '' : globalSettings.gateway,
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
  Object.entries(standardQuantities).forEach(([templateId, quantity]) => {
    if (quantity === 0) return;

    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    const type = template.type;

    for (let i = 0; i < quantity; i++) {
      const deviceName = newDeviceName(template.name, currentDevices);
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
        type,
        templateId: template.id,
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
