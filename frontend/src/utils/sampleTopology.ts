/**
 * Sample Network Topology
 *
 * A small office network that is correct end to end, so every simulation on
 * it gives a meaningful verdict out of the box:
 *
 *                      Router-1
 *            port 1 /            \ port 2
 *        192.168.10.1            192.168.20.1
 *               |                      |
 *           SW-Office              SW-Servers
 *            /      \               /       \
 *         PC-1      PC-2        Web-01     Mail-01
 *        .10.11    .10.12       .20.10      .20.20
 *
 * Two subnets (192.168.10.0/24 offices, 192.168.20.0/24 servers) joined by one
 * router whose ports carry the gateway addresses. Every link is bound to a
 * concrete interface on both ends (a port on switches/router, eth0 on end
 * devices).
 *
 * Devices have the shape AddDeviceModal produces (templateId, default port
 * arrays, one NIC with MAC). Positions are hand-placed, top-down. The data is
 * fully deterministic (fixed MACs) so tests can rely on it.
 *
 * The devices are called the same in every language. The places and the two
 * port names of the router are read from the dictionary, `samples.office`, at
 * the moment the sample is created.
 */

import type { NetworkDevice, NetworkConnection, NetworkInterfaceCard, Port } from '@/types';
import { getT } from '@/i18n';
import { sampleSettings, type SampleNetwork } from '@/utils/sampleNetwork';

const MASK = '255.255.255.0';

/** Default port array, as created for a new Switch/Router */
function defaultPorts(count: number, portType: NonNullable<Port['portType']>): Port[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    enabled: true,
    speed: 'auto',
    portType,
  }));
}

/** Apply per-port settings on top of a default port array */
function configurePorts(ports: Port[], settings: Record<number, Partial<Port>>): Port[] {
  return ports.map(port => ({ ...port, ...settings[port.id] }));
}

/** The single default NIC of an end device */
function eth0(ip: string, gateway: string, mac: string): NetworkInterfaceCard {
  return { id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip, subnet: MASK, gateway, mac };
}

/** An 8-port access switch with a management address */
function accessSwitch(
  id: string,
  label: string,
  ip: string,
  gateway: string,
  location: string,
  position: { x: number; y: number },
  portNames: Record<number, Partial<Port>>
): NetworkDevice {
  return {
    id,
    type: 'Switch',
    templateId: 'tpl-switch',
    label,
    ip,
    subnet: MASK,
    gateway,
    vendor: '',
    location,
    position,
    portCount: 8,
    ports: configurePorts(defaultPorts(8, 'access'), portNames),
  };
}

/** An end device (PC or server) addressed through its eth0 NIC */
function endDevice(
  id: string,
  type: 'PC' | 'Server',
  templateId: string,
  label: string,
  ip: string,
  gateway: string,
  mac: string,
  position: { x: number; y: number }
): NetworkDevice {
  return {
    id,
    type,
    templateId,
    label,
    // Device-level addressing mirrors the NIC, as for any device with NICs
    ip,
    subnet: MASK,
    gateway,
    position,
    nics: [eth0(ip, gateway, mac)],
  };
}

export function createSampleTopology(): SampleNetwork {
  const OFFICE_GATEWAY = '192.168.10.1';
  const SERVERS_GATEWAY = '192.168.20.1';

  // The names are read now, in the language the interface is in: once on the
  // board they are content, and they stay as they were created
  const names = getT().samples.office;

  const devices: NetworkDevice[] = [
    // ── Routing ──────────────────────────────────────────────────────────
    {
      id: 'router-1',
      type: 'Router',
      templateId: 'tpl-router',
      label: 'Router-1',
      // Management address = its address on the office network
      ip: OFFICE_GATEWAY,
      subnet: MASK,
      gateway: '',
      vendor: '',
      location: names.places.serverRoom,
      position: { x: 400, y: 60 },
      portCount: 4,
      ports: configurePorts(defaultPorts(4, 'lan'), {
        1: { name: names.ports.officeLan, ip: OFFICE_GATEWAY, subnet: MASK },
        2: { name: names.ports.serverLan, ip: SERVERS_GATEWAY, subnet: MASK },
      }),
    },

    // ── Switching ────────────────────────────────────────────────────────
    accessSwitch(
      'sw-office',
      'SW-Office',
      '192.168.10.2',
      OFFICE_GATEWAY,
      names.places.offices,
      { x: 180, y: 260 },
      { 1: { name: 'PC-1' }, 2: { name: 'PC-2' }, 8: { name: 'Uplink' } }
    ),
    accessSwitch(
      'sw-servers',
      'SW-Servers',
      '192.168.20.2',
      SERVERS_GATEWAY,
      names.places.serverRoom,
      { x: 620, y: 260 },
      { 1: { name: 'Web-01' }, 2: { name: 'Mail-01' }, 8: { name: 'Uplink' } }
    ),

    // ── Offices (192.168.10.0/24) ────────────────────────────────────────
    endDevice('pc-1', 'PC', 'tpl-pc', 'PC-1', '192.168.10.11', OFFICE_GATEWAY, '02:00:C0:A8:0A:0B', {
      x: 80,
      y: 480,
    }),
    endDevice('pc-2', 'PC', 'tpl-pc', 'PC-2', '192.168.10.12', OFFICE_GATEWAY, '02:00:C0:A8:0A:0C', {
      x: 280,
      y: 480,
    }),

    // ── Servers (192.168.20.0/24) ────────────────────────────────────────
    endDevice(
      'web-01',
      'Server',
      'tpl-webserver',
      'Web-01',
      '192.168.20.10',
      SERVERS_GATEWAY,
      '02:00:C0:A8:14:0A',
      { x: 520, y: 480 }
    ),
    endDevice(
      'mail-01',
      'Server',
      'tpl-mailserver',
      'Mail-01',
      '192.168.20.20',
      SERVERS_GATEWAY,
      '02:00:C0:A8:14:14',
      { x: 720, y: 480 }
    ),
  ];

  // Every link is bound on both ends: NIC id on end devices, port id elsewhere.
  // Handles follow the top-down placement (lower device leaves from its top).
  const connections: NetworkConnection[] = [
    {
      id: 'link-pc-1',
      source: 'pc-1',
      target: 'sw-office',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-pc-2',
      source: 'pc-2',
      target: 'sw-office',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 2,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-office-uplink',
      source: 'sw-office',
      target: 'router-1',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourcePort: 8,
      targetPort: 1,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-servers-uplink',
      source: 'router-1',
      target: 'sw-servers',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourcePort: 2,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-web-01',
      source: 'web-01',
      target: 'sw-servers',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-mail-01',
      source: 'mail-01',
      target: 'sw-servers',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 2,
      type: 'access',
      bandwidth: '1 Gbps',
    },
  ];

  // What the project is set to with this network: a new device starts on the
  // network of the offices. The sample has no DNS server and no VLAN
  const settings = sampleSettings({ network: '192.168.10.0', gateway: OFFICE_GATEWAY });

  // No area: the two networks are plain to see, a switch under the router
  // with its devices under it, and the label of each cable from the router
  // would sit on the top of an area
  return { devices, connections, settings, areas: [] };
}
