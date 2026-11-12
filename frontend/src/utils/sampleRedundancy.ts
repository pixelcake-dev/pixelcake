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
 *
 * Devices have the shape AddDeviceModal produces. Positions are hand-placed.
 * The data is fully deterministic (fixed MACs) so tests can rely on it.
 */

import type { NetworkDevice, NetworkConnection, NetworkInterfaceCard, Port } from '@/types';

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

export function createRedundancySample(): {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
} {
  const devices: NetworkDevice[] = [
    // ── Lines between the sites ──────────────────────────────────────────
    {
      id: 'r-riserva',
      type: 'Router',
      templateId: 'tpl-router',
      label: 'R-Riserva',
      ip: '10.0.1.2',
      subnet: P2P_MASK,
      gateway: '',
      vendor: '',
      location: 'Operatore di riserva',
      position: { x: 560, y: 20 },
      portCount: 4,
      ports: ports(4, 'wan', {
        1: { name: 'Verso la sede', ip: '10.0.1.2', subnet: P2P_MASK },
        2: { name: 'Verso la filiale', ip: '10.0.2.1', subnet: P2P_MASK },
      }),
      routes: [
        { id: 'route-1', destination: '192.168.1.0/24', nextHop: '10.0.1.1', description: 'sede' },
        { id: 'route-2', destination: '192.168.2.0/24', nextHop: '10.0.2.2', description: 'filiale' },
      ],
    },
    {
      id: 'r-sede',
      type: 'Router',
      templateId: 'tpl-router',
      label: 'R-Sede',
      // Management address = its address on the site network
      ip: '192.168.1.1',
      subnet: MASK,
      gateway: '',
      vendor: '',
      location: 'Sede',
      position: { x: 280, y: 200 },
      portCount: 4,
      ports: ports(4, 'lan', {
        1: { name: 'Rete della sede', ip: '192.168.1.1', subnet: MASK },
        2: { name: 'Linea principale', portType: 'wan', ip: '10.0.0.1', subnet: P2P_MASK },
        3: { name: 'Linea di riserva', portType: 'wan', ip: '10.0.1.1', subnet: P2P_MASK },
      }),
      // Two routes to the same network: the first is used while its line is up
      routes: [
        { id: 'route-1', destination: '192.168.2.0/24', nextHop: '10.0.0.2', description: 'filiale, linea principale' },
        { id: 'route-2', destination: '192.168.2.0/24', nextHop: '10.0.1.2', description: 'filiale, linea di riserva' },
      ],
    },
    {
      id: 'r-filiale',
      type: 'Router',
      templateId: 'tpl-router',
      label: 'R-Filiale',
      ip: '192.168.2.1',
      subnet: MASK,
      gateway: '',
      vendor: '',
      location: 'Filiale',
      position: { x: 840, y: 200 },
      portCount: 4,
      ports: ports(4, 'lan', {
        1: { name: 'Rete della filiale', ip: '192.168.2.1', subnet: MASK },
        2: { name: 'Linea principale', portType: 'wan', ip: '10.0.0.2', subnet: P2P_MASK },
        3: { name: 'Linea di riserva', portType: 'wan', ip: '10.0.2.2', subnet: P2P_MASK },
      }),
      routes: [
        { id: 'route-1', destination: '192.168.1.0/24', nextHop: '10.0.0.1', description: 'sede, linea principale' },
        { id: 'route-2', destination: '192.168.1.0/24', nextHop: '10.0.2.1', description: 'sede, linea di riserva' },
      ],
    },

    // ── Main site (192.168.1.0/24) ───────────────────────────────────────
    switchDevice('sw-core', 'SW-Core', '192.168.1.2', '192.168.1.1', 'Sede', { x: 280, y: 380 }, {
      1: { name: 'Srv-File' },
      6: { name: 'SW-Piano-1' },
      7: { name: 'SW-Piano-2' },
      8: { name: 'R-Sede' },
    }),
    switchDevice('sw-piano-1', 'SW-Piano-1', '192.168.1.3', '192.168.1.1', 'Sede, piano 1', { x: 160, y: 560 }, {
      1: { name: 'PC-Sede-1' },
      7: { name: 'SW-Piano-2' },
      8: { name: 'SW-Core' },
    }),
    switchDevice('sw-piano-2', 'SW-Piano-2', '192.168.1.4', '192.168.1.1', 'Sede, piano 2', { x: 400, y: 560 }, {
      1: { name: 'PC-Sede-2' },
      7: { name: 'SW-Piano-1' },
      8: { name: 'SW-Core' },
    }),
    endDevice('srv-file', 'Server', 'tpl-server', 'Srv-File', '192.168.1.10', '192.168.1.1', '02:00:C0:A8:01:0A', 'Sede', {
      x: 40,
      y: 380,
    }),
    endDevice('pc-sede-1', 'PC', 'tpl-pc', 'PC-Sede-1', '192.168.1.11', '192.168.1.1', '02:00:C0:A8:01:0B', 'Sede, piano 1', {
      x: 160,
      y: 740,
    }),
    endDevice('pc-sede-2', 'PC', 'tpl-pc', 'PC-Sede-2', '192.168.1.12', '192.168.1.1', '02:00:C0:A8:01:0C', 'Sede, piano 2', {
      x: 400,
      y: 740,
    }),

    // ── Branch (192.168.2.0/24) ──────────────────────────────────────────
    switchDevice('sw-filiale', 'SW-Filiale', '192.168.2.2', '192.168.2.1', 'Filiale', { x: 840, y: 380 }, {
      1: { name: 'PC-Filiale-1' },
      2: { name: 'PC-Filiale-2' },
      8: { name: 'R-Filiale' },
    }),
    endDevice('pc-filiale-1', 'PC', 'tpl-pc', 'PC-Filiale-1', '192.168.2.11', '192.168.2.1', '02:00:C0:A8:02:0B', 'Filiale', {
      x: 720,
      y: 560,
    }),
    endDevice('pc-filiale-2', 'PC', 'tpl-pc', 'PC-Filiale-2', '192.168.2.12', '192.168.2.1', '02:00:C0:A8:02:0C', 'Filiale', {
      x: 960,
      y: 560,
    }),
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
      label: 'Linea principale',
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
      label: 'Linea di riserva',
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
      label: 'Linea di riserva',
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

  return { devices, connections };
}
