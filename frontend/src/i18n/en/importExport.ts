import type { Dictionary } from '../dictionary';
import { formatCount } from '../numbers';

/** A number of things as English writes it ("14,891") */
const amount = (value: number) => formatCount('en', value);

/** YAML and Terraform: the window, and what an import reports */

const devices = (count: number) => (count === 1 ? '1 device' : `${amount(count)} devices`);
const connections = (count: number) => (count === 1 ? '1 link' : `${amount(count)} links`);

const areas = (count: number) => (count === 1 ? '1 area' : `${amount(count)} areas`);

export const importExport: Dictionary['importExport'] = {
  /** How many devices, links and areas: of the board, of a file */
  devices,
  connections,
  areas,

  exportTab: {
    format: 'Format:',
    terraformDraft: 'Terraform HCL (draft)',
    terraformNote:
      '<strong>This is a draft: it cannot be applied with Terraform.</strong> The resource types ' +
      'are placeholders and no provider is named. To save the topology and load it back, use the ' +
      'YAML format.',
    noDevices: 'No devices in the current topology.',
    addDevicesFirst: 'Add devices to the board to export them.',
    lines: (count: number) => (count === 1 ? '1 line' : `${amount(count)} lines`),

    copy: 'Copy to clipboard',
    copied: 'Copied',
    download: (fileName: string) => `Download ${fileName}`,

    copiedNotice: 'Copied to clipboard',
    copyFailed: 'Could not copy',
    downloadedNotice: (fileName: string) => `File downloaded: ${fileName}`,
  },

  importTab: {
    dropHere: 'Drop the file here',
    dragOrClick: 'Drag a file here or click to choose one',
    supportedFormats: 'Supported formats: .yaml, .yml',

    warningCount: (count: number) => (count === 1 ? '1 warning' : `${amount(count)} warnings`),
    devicesFound: 'Devices found',
    warnings: 'Warnings',

    mode: 'Mode:',
    replace: 'Replace the topology',
    append: 'Add to the topology',
    confirm: 'Import',

    unsupportedFormat: 'Format not supported. Use a .yaml or .yml file.',
    cannotRead: 'Could not read the file',
    nothingToImport: 'No devices to import',
    /** The question before “Replace the topology” empties the board: what will be removed */
    replaceTitle: 'Replace the topology?',
    replaceDetail: (deviceCount: number, connectionCount: number, areaCount: number) =>
      `The board holds ${devices(deviceCount)}, ${connections(connectionCount)} and ${areas(areaCount)}: they will be removed and replaced by the contents of the file. This cannot be undone.`,
    replaceConfirm: 'Replace',
    /** After “Add to the topology”: devices of the file that had a name already on the board */
    renamedNotice: (renamed: string) =>
      `Names already on the board, the devices added were given a free name: ${renamed}`,
    replacedNotice: (deviceCount: number, connectionCount: number) =>
      `Topology imported: ${devices(deviceCount)}, ${connections(connectionCount)}`,
    appendedNotice: (deviceCount: number, connectionCount: number) =>
      `Added: ${devices(deviceCount)}, ${connections(connectionCount)}`,
  },

  /** What reading a YAML file reports, one line each */
  warnings: {
    /** `reason` is what the YAML reader said, when it said something */
    yamlError: (reason: string | undefined) =>
      reason === undefined ? 'YAML parsing error: unknown error' : `YAML parsing error: ${reason}`,
    noData: 'The YAML file contains no valid data',
    unknownStructure: 'YAML structure not recognised',
    noDevices: 'No devices found in the file',

    deviceNotValid: (number: number) => `Device ${number}: invalid format, ignored`,
    deviceAddressNotValid: (deviceName: string, address: string) =>
      `${deviceName}: invalid IP address "${address}"`,
    portAddressNotValid: (portId: number, address: string) =>
      `Port ${portId}: invalid IP address "${address}"`,
    portVlanOutOfRange: (portId: number, values: string) =>
      `Port ${portId}: VLAN ${values} out of range (1–4094), left out`,
    deviceVlanOutOfRange: (deviceName: string, values: string) =>
      `${deviceName}: VLAN ${values} out of range (1–4094), left out`,
    connectionVlanOutOfRange: (number: number, values: string) =>
      `Link ${number}: VLAN ${values} out of range (1–4094), left out`,
    /** `renamed` is the list of the new names, each written “old” → “new” */
    namesRepeated: (renamed: string) =>
      `Names used more than once, the later devices were given a free name: ${renamed}. Links that name it go to the first device that has it`,
    areaNotValid: (number: number) => `Area ${number}: no position or size, ignored`,
    portPoolIncomplete: (portId: number) =>
      `Port ${portId}: DHCP server without a first or a last address, ignored`,
    cardPoolIncomplete: (deviceName: string, cardName: string) =>
      `${deviceName}: ${cardName}: DHCP server without a first or a last address, ignored`,
    recordIncomplete: (deviceName: string, number: number) =>
      `${deviceName}: DNS record ${number} without a name or an address, ignored`,
    routeIncomplete: (deviceName: string, number: number) =>
      `${deviceName}: route ${number} without a destination or a next hop, ignored`,
    forwardNotValid: (deviceName: string, number: number) =>
      `${deviceName}: port forward ${number} incomplete or invalid, ignored`,
    ruleNotValid: (deviceName: string, number: number) =>
      `${deviceName}: rule ${number} incomplete or invalid, ignored`,

    connectionNotValid: (number: number) => `Link ${number}: invalid format, ignored`,
    sourceNotFound: (number: number, deviceName: string) =>
      `Link ${number}: source “${deviceName}” not found`,
    targetNotFound: (number: number, deviceName: string) =>
      `Link ${number}: target “${deviceName}” not found`,
    portNotFound: (number: number, port: string, deviceName: string) =>
      `Link ${number}: port ${port} not found on “${deviceName}”, end not assigned`,
    portTaken: (number: number, portId: number, deviceName: string) =>
      `Link ${number}: port ${portId} of “${deviceName}” already used by another link, end not assigned`,
    cardNotFound: (number: number, cardName: string, deviceName: string) =>
      `Link ${number}: interface “${cardName}” not found on “${deviceName}”, end not assigned`,
    cardTaken: (number: number, cardName: string, deviceName: string) =>
      `Link ${number}: interface “${cardName}” of “${deviceName}” already used by another link, end not assigned`,
  },
};
