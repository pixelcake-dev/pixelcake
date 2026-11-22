/**
 * Third sample network: two sites joined by a main line and a backup line,
 * and three switches closed in a ring at the main site. It is there to ask
 * "what happens if this breaks?" — nearly every cable has another way round,
 * and the few things that have none are worth finding:
 *
 *                         R-Riserva
 *              10.0.1.0/30 ╱      ╲ 10.0.2.0/30        (backup line)
 *                   port 3╱        ╲port 3
 *                   R-Sede ──────── R-Filiale
 *                   port 2  10.0.0.0/30  port 2        (main line)
 *                   port 1              port 1
 *            192.168.1.1│                  │192.168.2.1
 *       Srv-File ── SW-Core            SW-Filiale
 *                   ╱      ╲            ╱       ╲
 *           SW-Piano-1 ── SW-Piano-2  PC-Filiale-1  PC-Filiale-2
 *               │             │
 *           PC-Sede-1     PC-Sede-2
 *
 *  - each site router has TWO routes to the other site: the main line first,
 *    the backup line (through R-Riserva) second. The second one is used when
 *    the interface of the first has no working cable left
 *  - the three switches of the main site form a ring: with one cable of the
 *    ring cut, traffic goes round the other way (spanning tree is not
 *    simulated: the engine takes the shortest way that works)
 *  - what has no second way: SW-Core for the file server and the router,
 *    each router for its own site, the cable of each end device
 *  - the main line is 80 km of fibre, the backup a DSL line of each site to
 *    the carrier: a ping between the sites takes about 1 ms on the first,
 *    about 33 ms on the second (see engine/latency)
 *
 * Devices have the shape AddDeviceModal produces. Positions are hand-placed.
 * The data is fully deterministic (fixed MACs) so tests can rely on it.
 *
 * The names above are the Italian ones («sede» is the head office, «filiale»
 * the branch, «riserva» the backup). Whatever is called differently in
 * another language (routers, switches and PCs, places, ports, the two lines,
 * notes) is read from the dictionary, `samples.twoSites`, at the moment the
 * sample is created; SW-Core and Srv-File are called the same everywhere.
 * Ids and addresses never change.
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
  location: string,
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
    location,
    position,
    nics: [eth0(ip, gateway, mac)],
  };
}

function switchDevice(
  id: string,
  label: string,
  ip: string,
  gateway: string,
  location: string,
  position: { x: number; y: number },
  names: Record<number, Partial<Port>>
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
    ports: ports(8, 'access', names),
  };
}

export function createRedundancySample(): SampleNetwork {
  // The names are read now, in the language the interface is in: once on the
  // board they are content, and they stay as they were created
  const names = getT().samples.twoSites;
  const { headOffice, headOfficeFloor, branch } = names.places;
  // A port on one of the two lines is named as the cable is labelled
  const { mainLine, backupLine } = names.cables;

  const devices: NetworkDevice[] = [
    // ── Lines between the sites ──────────────────────────────────────────
    {
      id: 'r-riserva',
      type: 'Router',
      templateId: 'tpl-router',
      label: names.devices.backupRouter,
      ip: '10.0.1.2',
      subnet: P2P_MASK,
      gateway: '',
      vendor: '',
      location: names.places.backupCarrier,
      position: { x: 560, y: 0 },
      portCount: 4,
      ports: ports(4, 'wan', {
        1: { name: names.ports.toHeadOffice, ip: '10.0.1.2', subnet: P2P_MASK },
        2: { name: names.ports.toBranch, ip: '10.0.2.1', subnet: P2P_MASK },
      }),
      routes: [
        { id: 'route-1', destination: '192.168.1.0/24', nextHop: '10.0.1.1', description: names.notes.headOffice },
        { id: 'route-2', destination: '192.168.2.0/24', nextHop: '10.0.2.2', description: names.notes.branch },
      ],
    },
    {
      id: 'r-sede',
      type: 'Router',
      templateId: 'tpl-router',
      label: names.devices.headOfficeRouter,
      // Management address = its address on the site network
      ip: '192.168.1.1',
      subnet: MASK,
      gateway: '',
      vendor: '',
      location: headOffice,
      position: { x: 280, y: 150 },
      portCount: 4,
      ports: ports(4, 'lan', {
        1: { name: names.ports.headOfficeNetwork, ip: '192.168.1.1', subnet: MASK },
        2: { name: mainLine, portType: 'wan', ip: '10.0.0.1', subnet: P2P_MASK },
        3: { name: backupLine, portType: 'wan', ip: '10.0.1.1', subnet: P2P_MASK },
      }),
      // Two routes to the same network: the first is used while its line is up
      routes: [
        { id: 'route-1', destination: '192.168.2.0/24', nextHop: '10.0.0.2', description: names.notes.branchMainLine },
        { id: 'route-2', destination: '192.168.2.0/24', nextHop: '10.0.1.2', description: names.notes.branchBackupLine },
      ],
    },
    {
      id: 'r-filiale',
      type: 'Router',
      templateId: 'tpl-router',
      label: names.devices.branchRouter,
      ip: '192.168.2.1',
      subnet: MASK,
      gateway: '',
      vendor: '',
      location: branch,
      position: { x: 840, y: 150 },
      portCount: 4,
      ports: ports(4, 'lan', {
        1: { name: names.ports.branchNetwork, ip: '192.168.2.1', subnet: MASK },
        2: { name: mainLine, portType: 'wan', ip: '10.0.0.2', subnet: P2P_MASK },
        3: { name: backupLine, portType: 'wan', ip: '10.0.2.2', subnet: P2P_MASK },
      }),
      routes: [
        { id: 'route-1', destination: '192.168.1.0/24', nextHop: '10.0.0.1', description: names.notes.headOfficeMainLine },
        { id: 'route-2', destination: '192.168.1.0/24', nextHop: '10.0.2.1', description: names.notes.headOfficeBackupLine },
      ],
    },

    // ── Main site (192.168.1.0/24) ───────────────────────────────────────
    switchDevice('sw-core', 'SW-Core', '192.168.1.2', '192.168.1.1', headOffice, { x: 280, y: 300 }, {
      1: { name: 'Srv-File' },
      6: { name: names.devices.floorSwitch(1) },
      7: { name: names.devices.floorSwitch(2) },
      8: { name: names.devices.headOfficeRouter },
    }),
    switchDevice(
      'sw-piano-1', names.devices.floorSwitch(1),
      '192.168.1.3', '192.168.1.1', headOfficeFloor(1), { x: 160, y: 450 },
      {
        1: { name: names.devices.headOfficePc(1) },
        7: { name: names.devices.floorSwitch(2) },
        8: { name: 'SW-Core' },
      }
    ),
    switchDevice(
      'sw-piano-2', names.devices.floorSwitch(2),
      '192.168.1.4', '192.168.1.1', headOfficeFloor(2), { x: 400, y: 450 },
      {
        1: { name: names.devices.headOfficePc(2) },
        7: { name: names.devices.floorSwitch(1) },
        8: { name: 'SW-Core' },
      }
    ),
    endDevice(
      'srv-file', 'Server', 'tpl-server', 'Srv-File',
      '192.168.1.10', '192.168.1.1', '02:00:C0:A8:01:0A', headOffice, { x: 40, y: 300 }
    ),
    endDevice(
      'pc-sede-1', 'PC', 'tpl-pc', names.devices.headOfficePc(1),
      '192.168.1.11', '192.168.1.1', '02:00:C0:A8:01:0B', headOfficeFloor(1), { x: 160, y: 600 }
    ),
    endDevice(
      'pc-sede-2', 'PC', 'tpl-pc', names.devices.headOfficePc(2),
      '192.168.1.12', '192.168.1.1', '02:00:C0:A8:01:0C', headOfficeFloor(2), { x: 400, y: 600 }
    ),

    // ── Branch (192.168.2.0/24) ──────────────────────────────────────────
    switchDevice('sw-filiale', names.devices.branchSwitch, '192.168.2.2', '192.168.2.1', branch, { x: 840, y: 300 }, {
      1: { name: names.devices.branchPc(1) },
      2: { name: names.devices.branchPc(2) },
      8: { name: names.devices.branchRouter },
    }),
    endDevice(
      'pc-filiale-1', 'PC', 'tpl-pc', names.devices.branchPc(1),
      '192.168.2.11', '192.168.2.1', '02:00:C0:A8:02:0B', branch, { x: 720, y: 450 }
    ),
    endDevice(
      'pc-filiale-2', 'PC', 'tpl-pc', names.devices.branchPc(2),
      '192.168.2.12', '192.168.2.1', '02:00:C0:A8:02:0C', branch, { x: 960, y: 450 }
    ),
  ];

  // Every link is bound on both ends: NIC id on end devices, port id elsewhere
  const connections: NetworkConnection[] = [
    // The two lines between the sites
    {
      id: 'link-principale',
      source: 'r-sede',
      target: 'r-filiale',
      sourceHandle: 'right',
      targetHandle: 'left',
      sourcePort: 2,
      targetPort: 2,
      type: 'backbone',
      bandwidth: '1 Gbps',
      label: mainLine,
      // A fibre of its own between the two sites
      medium: 'fibre',
      lengthM: 80_000,
    },
    {
      id: 'link-riserva-sede',
      source: 'r-sede',
      target: 'r-riserva',
      sourceHandle: 'top',
      targetHandle: 'left',
      sourcePort: 3,
      targetPort: 1,
      type: 'uplink',
      bandwidth: '100 Mbps',
      label: backupLine,
      // The backup line is a DSL line of each site to the carrier
      medium: 'dsl',
    },
    {
      id: 'link-riserva-filiale',
      source: 'r-riserva',
      target: 'r-filiale',
      sourceHandle: 'right',
      targetHandle: 'top',
      sourcePort: 2,
      targetPort: 3,
      type: 'uplink',
      bandwidth: '100 Mbps',
      label: backupLine,
      medium: 'dsl',
    },

    // Main site
    {
      id: 'link-sede-core',
      source: 'r-sede',
      target: 'sw-core',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourcePort: 1,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-srv-file',
      source: 'srv-file',
      target: 'sw-core',
      sourceHandle: 'right',
      targetHandle: 'left',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-core-piano-1',
      source: 'sw-core',
      target: 'sw-piano-1',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourcePort: 6,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-core-piano-2',
      source: 'sw-core',
      target: 'sw-piano-2',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourcePort: 7,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-piano-1-piano-2',
      source: 'sw-piano-1',
      target: 'sw-piano-2',
      sourceHandle: 'right',
      targetHandle: 'left',
      sourcePort: 7,
      targetPort: 7,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-pc-sede-1',
      source: 'pc-sede-1',
      target: 'sw-piano-1',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-pc-sede-2',
      source: 'pc-sede-2',
      target: 'sw-piano-2',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },

    // Branch
    {
      id: 'link-filiale-sw',
      source: 'r-filiale',
      target: 'sw-filiale',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourcePort: 1,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-pc-filiale-1',
      source: 'pc-filiale-1',
      target: 'sw-filiale',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-pc-filiale-2',
      source: 'pc-filiale-2',
      target: 'sw-filiale',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetPort: 2,
      type: 'access',
      bandwidth: '1 Gbps',
    },
  ];

  // What the project is set to with this network: a new device starts on the
  // network of the head office. The sample has no DNS server and no VLAN
  const settings = sampleSettings({ network: '192.168.1.0', gateway: '192.168.1.1' });

  // The two sites, at a glance; the router of the backup carrier is in neither
  const areas = areasAround(
    [
      {
        label: headOffice,
        color: 'slate',
        devices: ['r-sede', 'sw-core', 'srv-file', 'sw-piano-1', 'sw-piano-2', 'pc-sede-1', 'pc-sede-2'],
      },
      { label: branch, color: 'teal', devices: ['r-filiale', 'sw-filiale', 'pc-filiale-1', 'pc-filiale-2'] },
    ],
    devices
  );

  return { devices, connections, settings, areas };
}
