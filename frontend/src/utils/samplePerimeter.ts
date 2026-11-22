/**
 * Second sample network: one site with VLANs, a DMZ and a firewall. It is
 * correct end to end and uses everything the engine evaluates, so each
 * question asked of it has an answer worth reading:
 *
 *      PC-Remoto ── Internet ─────────┐ 203.0.113.0/24 (untrust)
 *                                 port 3
 *                               FW-Edge ── port 2 ── SW-DMZ ── Web-Pubblico
 *                                 port 1          172.16.0.0/24 (dmz)
 *                                   │ 10.0.0.0/30 (trust)
 *                                 port 3
 *                              Router-Core
 *                        port 1 │        │ port 2
 *                   192.168.10.1│        │192.168.20.1
 *                        (VLAN 10)      (VLAN 20)
 *                               SW-Core
 *                    ┌────────────┼────────────┐
 *              PC-Uffici-1   PC-Uffici-2   Srv-Interno
 *                .10.11         .10.12        .20.10
 *
 *  - SW-Core applies VLANs port by port: offices in VLAN 10, the internal
 *    server in VLAN 20; Router-Core has a port in each and routes between them
 *  - Router-Core's default route is the firewall; the firewall has a static
 *    route back to the inside networks
 *  - FW-Edge has a port per zone and ONE rule: web from outside to Web-Pubblico.
 *    Everything else follows the zone policy (inside can go out, outside
 *    cannot come in, the DMZ cannot reach the inside)
 *  - FW-Edge does NAT on the port that faces the Internet, and one port
 *    forward publishes Web-Pubblico (web) at its public address, 203.0.113.1
 *
 * Devices have the shape AddDeviceModal produces. Positions are hand-placed
 * around the firewall: the outside above it, the DMZ on its right, the
 * inside on its left, laid out to be read at once in a window of the size
 * of a laptop (utils/sampleLayout.test.ts). The data is fully deterministic (fixed MACs) so tests can rely
 * on it.
 *
 * The names above are the Italian ones. Whatever is called differently in
 * another language (the PC outside, the public web server, the two PCs and
 * the server of the inside, places, ports, notes) is read from the dictionary, `samples.site`, at the moment the
 * sample is created; what is called the same everywhere (FW-Edge, SW-Core,
 * Internet, VLAN 10…) is written here. Ids and addresses never change.
 */

import type { NetworkDevice, NetworkConnection, NetworkInterfaceCard, Port } from '@/types';
import { getT } from '@/i18n';
import { areasAround, sampleSettings, type SampleNetwork } from '@/utils/sampleNetwork';

const MASK = '255.255.255.0';
const P2P_MASK = '255.255.255.252';

function ports(
  count: number,
  portType: NonNullable<Port['portType']>,
  settings: Record<number, Partial<Port>>
): Port[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    enabled: true,
    speed: 'auto' as const,
    portType,
    ...settings[i + 1],
  }));
}

function eth0(ip: string, gateway: string, mac: string): NetworkInterfaceCard {
  return { id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip, subnet: MASK, gateway, mac };
}

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

export function createPerimeterSample(): SampleNetwork {
  // The names are read now, in the language the interface is in: once on the
  // board they are content, and they stay as they were created
  const names = getT().samples.site;
  const { offices, serverRoom } = names.places;

  const devices: NetworkDevice[] = [
    // ── Outside ──────────────────────────────────────────────────────────
    {
      id: 'internet',
      type: 'Cloud',
      templateId: 'tpl-cloud',
      label: 'Internet',
      ip: '',
      subnet: MASK,
      gateway: '',
      position: { x: 440, y: 0 },
      // Two cards without an address: the symbol only stands for "outside"
      nics: [
        { id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip: '', subnet: MASK, gateway: '', mac: '02:00:CB:00:71:01' },
        { id: 'nic-2', name: 'eth1', enabled: true, speed: 'auto', ip: '', subnet: MASK, gateway: '', mac: '02:00:CB:00:71:02' },
      ],
    },
    endDevice('remote-pc', 'PC', 'tpl-pc', names.devices.remotePc, '203.0.113.50', '203.0.113.1', '02:00:CB:00:71:32', {
      x: 640,
      y: 0,
    }),

    // ── Edge ─────────────────────────────────────────────────────────────
    {
      id: 'fw-edge',
      type: 'Firewall',
      templateId: 'tpl-firewall',
      label: 'FW-Edge',
      // Management address = its address towards the inside
      ip: '10.0.0.2',
      subnet: P2P_MASK,
      gateway: '',
      vendor: '',
      location: serverRoom,
      position: { x: 440, y: 176 },
      portCount: 4,
      ports: ports(4, 'lan', {
        1: { name: names.ports.inside, ip: '10.0.0.2', subnet: P2P_MASK, securityZone: 'trust' },
        2: { name: 'DMZ', portType: 'dmz', ip: '172.16.0.1', subnet: MASK, securityZone: 'dmz' },
        3: {
          name: 'Internet',
          portType: 'wan',
          ip: '203.0.113.1',
          subnet: MASK,
          securityZone: 'untrust',
          nat: true,
        },
      }),
      routes: [
        { id: 'route-1', destination: '192.168.0.0/16', nextHop: '10.0.0.1', description: names.notes.insideNetworks },
      ],
      portForwards: [
        { id: 'forward-1', service: 'web', port: 3, to: '172.16.0.10', description: names.notes.publicWebsite },
      ],
      firewallRules: [
        {
          id: 'rule-1',
          action: 'allow',
          service: 'web',
          source: 'untrust',
          destination: '172.16.0.10',
          description: names.notes.publicWebsite,
        },
      ],
    },

    // ── DMZ (172.16.0.0/24) ──────────────────────────────────────────────
    {
      id: 'sw-dmz',
      type: 'Switch',
      templateId: 'tpl-switch',
      label: 'SW-DMZ',
      ip: '172.16.0.2',
      subnet: MASK,
      gateway: '172.16.0.1',
      vendor: '',
      location: serverRoom,
      position: { x: 660, y: 176 },
      portCount: 8,
      ports: ports(8, 'access', { 1: { name: names.devices.publicWebServer }, 8: { name: 'Uplink' } }),
    },
    endDevice('web-public', 'Server', 'tpl-webserver', names.devices.publicWebServer, '172.16.0.10', '172.16.0.1', '02:00:AC:10:00:0A', {
      x: 660,
      y: 362,
    }),

    // ── Inside ───────────────────────────────────────────────────────────
    {
      id: 'router-core',
      type: 'Router',
      templateId: 'tpl-router',
      label: 'Router-Core',
      // Management address = its address on the office network
      ip: '192.168.10.1',
      subnet: MASK,
      // Default route: everything that is not inside goes to the firewall
      gateway: '10.0.0.2',
      vendor: '',
      location: serverRoom,
      position: { x: 136, y: 216 },
      portCount: 4,
      ports: ports(4, 'lan', {
        1: { name: names.ports.offices(10), ip: '192.168.10.1', subnet: MASK },
        2: { name: names.ports.servers(20), ip: '192.168.20.1', subnet: MASK },
        3: { name: 'Firewall', ip: '10.0.0.1', subnet: P2P_MASK },
      }),
    },
    {
      id: 'sw-core',
      type: 'Switch',
      templateId: 'tpl-switch',
      label: 'SW-Core',
      // Management address, on a network of its own: a switch answers in
      // VLAN 1, and here every cabled port is in VLAN 10 or 20
      ip: '10.99.0.2',
      subnet: MASK,
      gateway: '',
      vendor: '',
      location: offices,
      position: { x: 136, y: 402 },
      vlan: [10, 20],
      portCount: 8,
      ports: ports(8, 'access', {
        1: { name: names.devices.officePc(1), vlan: 10 },
        2: { name: names.devices.officePc(2), vlan: 10 },
        3: { name: names.devices.internalServer, vlan: 20 },
        7: { name: 'Router VLAN 10', vlan: 10 },
        8: { name: 'Router VLAN 20', vlan: 20 },
      }),
    },
    endDevice(
      'pc-uffici-1', 'PC', 'tpl-pc', names.devices.officePc(1),
      '192.168.10.11', '192.168.10.1', '02:00:C0:A8:0A:0B', { x: 0, y: 546 }
    ),
    endDevice(
      'pc-uffici-2', 'PC', 'tpl-pc', names.devices.officePc(2),
      '192.168.10.12', '192.168.10.1', '02:00:C0:A8:0A:0C', { x: 136, y: 546 }
    ),
    endDevice(
      'srv-interno', 'Server', 'tpl-server', names.devices.internalServer,
      '192.168.20.10', '192.168.20.1', '02:00:C0:A8:14:0A', { x: 272, y: 546 }
    ),
  ];

  // Every link is bound on both ends: NIC id on end devices, port id elsewhere
  // (on the firewall the port is also the zone, so it is never left to chance).
  const connections: NetworkConnection[] = [
    {
      id: 'link-remote',
      source: 'remote-pc',
      target: 'internet',
      sourceHandle: 'left',
      targetHandle: 'right',
      sourceNic: 'nic-1',
      targetNic: 'nic-2',
      type: 'access',
      bandwidth: '100 Mbps',
      // (somebody outside, on a DSL line)
      medium: 'dsl',
    },
    {
      id: 'link-wan',
      source: 'internet',
      target: 'fw-edge',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourceNic: 'nic-1',
      targetPort: 3,
      type: 'uplink',
      bandwidth: '1 Gbps',
      // (the line of the company to its provider: fibre to the building)
      medium: 'ftth',
    },
    {
      id: 'link-dmz',
      source: 'fw-edge',
      target: 'sw-dmz',
      sourceHandle: 'right',
      targetHandle: 'left',
      sourcePort: 2,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-web-public',
      source: 'web-public',
      target: 'sw-dmz',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-inside',
      source: 'fw-edge',
      target: 'router-core',
      // (the router is a little lower than the firewall: the cable comes in from above)
      sourceHandle: 'left',
      targetHandle: 'top',
      sourcePort: 1,
      targetPort: 3,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-vlan-10',
      source: 'router-core',
      target: 'sw-core',
      sourceHandle: 'left',
      targetHandle: 'left',
      sourcePort: 1,
      targetPort: 7,
      type: 'uplink',
      bandwidth: '1 Gbps',
      label: 'VLAN 10',
    },
    {
      id: 'link-vlan-20',
      source: 'router-core',
      target: 'sw-core',
      sourceHandle: 'right',
      targetHandle: 'right',
      sourcePort: 2,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
      label: 'VLAN 20',
    },
    {
      id: 'link-pc-uffici-1',
      source: 'pc-uffici-1',
      target: 'sw-core',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-pc-uffici-2',
      source: 'pc-uffici-2',
      target: 'sw-core',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 2,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-srv-interno',
      source: 'srv-interno',
      target: 'sw-core',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 3,
      type: 'access',
      bandwidth: '1 Gbps',
    },
  ];

  // What the project is set to with this network: a new device starts on the
  // network of the offices, and the VLANs of the drawing have their names (1
  // is where the ports nobody set are). The sample has no DNS server
  const settings = sampleSettings({
    network: '192.168.10.0',
    gateway: '192.168.10.1',
    vlans: [
      { id: 1, name: names.vlans.default },
      { id: 10, name: names.vlans.offices },
      { id: 20, name: names.vlans.servers },
    ],
  });

  // The three sides of the firewall, at a glance: what is outside, the DMZ,
  // the inside. The firewall itself stands between them, in none
  const areas = areasAround(
    [
      { label: 'Internet', color: 'slate', devices: ['internet', 'remote-pc'] },
      { label: 'DMZ', color: 'green', devices: ['sw-dmz', 'web-public'] },
      {
        label: names.areas.inside,
        color: 'amber',
        devices: ['router-core', 'sw-core', 'pc-uffici-1', 'pc-uffici-2', 'srv-interno'],
      },
    ],
    devices
  );

  return { devices, connections, settings, areas };
}
