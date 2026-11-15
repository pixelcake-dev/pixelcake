import type { Dictionary } from '../dictionary';
import { formatCount } from '../numbers';

/** A number of things as English writes it ("14,891") */
const amount = (value: number) => formatCount('en', value);

/** The window that adds a device, and the one that adds many */
export const addDevice: Dictionary['addDevice'] = {
  /** In both windows: the type of a device, and a number of ports to choose from a list */
  type: 'Type',
  ports: (count: number) => (count === 1 ? '1 port' : `${amount(count)} ports`),

  /** The window that adds one device, of the type picked in the panel */
  title: (typeName: string) => `Add a new ${typeName}`,
  nameAndAddressRequired: 'Name and IP address are required',

  identity: {
    legend: 'Identity',
    name: 'Device name',
    namePlaceholder: (type: string) => `e.g. ${type}-Office-01`,
    vendor: 'Vendor',
    vendorPlaceholder: 'e.g. Cisco, HP…',
    location: 'Location',
    locationPlaceholder: 'e.g. Rack 01…',
    portCount: 'Number of ports',
    portCountHint: 'It can also be changed later.',
  },

  network: {
    legend: 'Network',
    legendOfCard: (cardName: string) => `Network · ${cardName}`,
    /** Under the address of the card of an end device; `withDns` when the project gives it a DNS server */
    cardHint: (withDns: boolean) =>
      "The address is suggested: the first free one in the project’s network. " +
      (withDns
        ? 'The subnet mask, gateway and DNS server come from Settings → Network.'
        : 'The subnet mask and gateway come from Settings → Network.'),
    ipAddress: 'IP address',
    ipAddressHint: 'Suggested: the first free one.',
    subnetMask: 'Subnet mask',
    gateway: 'Gateway',
    /** On a router or a firewall, in place of the gateway */
    setLater: 'Port addresses, routes and the default route are set later, in the device window.',
  },

  /** The window that adds many devices at once */
  bulk: {
    title: 'Add devices in bulk',
    searchPlaceholder: 'Search by type or ports…',
    noDevicesFor: (query: string) => `No devices found for "${query}"`,

    configurableHeading: 'Configurable devices',
    standardHeading: 'Standard devices (1 network card by default)',
    columns: {
      configuration: 'Configuration',
      quantity: 'Quantity',
      actions: 'Actions',
      controls: 'Controls',
    },
    addRow: 'Add Switch/Router/Firewall',
    removeRow: 'Delete row',
    decrease: 'Decrease',
    increase: 'Increase',
    total: 'Total devices:',

    selectAtLeastOne: 'Select at least one device to add',
    added: (count: number) => (count === 1 ? '1 device added' : `${amount(count)} devices added`),
  },
};
