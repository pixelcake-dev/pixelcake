/**
 * The sample network the welcome screen loads: a small company, drawn the way
 * such a network is built. Offices and Wi-Fi in two VLANs on a trunk, the
 * servers on a switch of their own, a public portal in a DMZ, one firewall
 * at the edge. Every question asked of it has an answer worth reading:
 *
 *   Cliente-Remoto ── Internet                        203.0.113.0/24 (untrust)
 *                        │ port 3
 *                     FW-Edge ── port 2 ── SW-DMZ ── Portale-Clienti
 *                        │ port 1                     172.16.0.0/24 (dmz)
 *                        │ 10.0.0.0/30 (trust)
 *                        │ port 4
 *                    Router-Core
 *          port 1 ╱   port 2 │      ╲ port 3
 *        (VLAN 10)  (VLAN 20)        (VLAN 30)
 *              SW-Core               SW-Server ── Srv-Auth  DB-Gestionale
 *                 │ trunk 10, 20                  Web-Gestionale  Mail  NAS
 *              SW-Uffici ── AP-Uffici ── Portatile-1  Portatile-2
 *            ╱     │     ╲      (VLAN 20, Wi-Fi)
 *  PC-Contabilità PC-Vendite Stampante
 *        (VLAN 10, offices)
 *
 *  - SW-Uffici puts the offices in VLAN 10 and the access point in VLAN 20;
 *    one trunk carries both to SW-Core, where Router-Core has a port in each
 *  - the servers are VLAN 30, on SW-Server, behind a third port of the router
 *  - Router-Core's default route is the firewall; the firewall has a static
 *    route back to the inside networks
 *  - FW-Edge has a port per zone and THREE rules: the portal is reachable
 *    from outside, mail comes in from outside, the portal reads its database.
 *    Everything else follows the zone policy (inside can go out, outside
 *    cannot come in, the DMZ cannot reach the inside)
 *  - FW-Edge does NAT on the port that faces the Internet: what goes out
 *    leaves with its public address, 203.0.113.1. Two port forwards publish
 *    the portal (web) and the mail server (email) at that address: it is the
 *    only way in, the Internet does not carry the private addresses inside
 *  - Router-Core is the DHCP server of the offices and of the Wi-Fi: each of
 *    its two ports hands out the addresses from .100 to .199 of its network.
 *    The two laptops take theirs from it (192.168.20.100 and .101); the PCs,
 *    the printer, the access point and the servers have theirs written by
 *    hand, as fixed things do
 *  - Srv-Auth is the DNS server of the inside: it keeps the names of the
 *    management software, of the mail server and of the portal (at its
 *    address in the DMZ), under azienda.example. The PCs and the printer of
 *    the offices name it on their cards; the laptops are handed it with their
 *    lease, and the same goes for whatever takes an address in the offices.
 *    Cliente-Remoto has no DNS server: outside, a name finds nobody to ask
 *
 * Devices have the shape AddDeviceModal produces. Positions are hand-placed.
 * The list goes from the desks outwards (offices, core, servers, DMZ, edge,
 * outside), so that whatever proposes a first question starts inside: the
 * simulation panel takes the first PC and the first server it finds. The
 * data is fully deterministic (fixed MACs) so tests can rely on it.
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

function nic(id: string, name: string, mac: string, ip = '', gateway = '', dns = ''): NetworkInterfaceCard {
  return { id, name, enabled: true, speed: 'auto', ip, subnet: MASK, gateway, ...(dns ? { dns } : {}), mac };
}

/** A PC whose one card takes its address from the DHCP server of its network */
function dhcpClient(
  id: string,
  label: string,
  mac: string,
  location: string,
  position: { x: number; y: number }
): NetworkDevice {
  return {
    id,
    type: 'PC',
    templateId: 'tpl-pc',
    label,
    // No address of its own, at device level or on the card: it is leased
    ip: '',
    subnet: '',
    gateway: '',
    location,
    position,
    nics: [{ id: 'nic-1', name: 'eth0', enabled: true, speed: 'auto', ip: '', subnet: '', gateway: '', mac, dhcp: true }],
  };
}

function endDevice(
  id: string,
  type: 'PC' | 'Server' | 'Database',
  templateId: string,
  label: string,
  ip: string,
  gateway: string,
  mac: string,
  location: string,
  position: { x: number; y: number },
  /** The DNS server its card asks, when it asks one */
  dns = ''
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
    nics: [nic('nic-1', 'eth0', mac, ip, gateway, dns)],
  };
}

function switchDevice(
  id: string,
  label: string,
  ip: string,
  gateway: string,
  location: string,
  position: { x: number; y: number },
  vlans: number[],
  settings: Record<number, Partial<Port>>
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
    ...(vlans.length > 0 ? { vlan: vlans } : {}),
    portCount: 8,
    ports: ports(8, 'access', settings),
  };
}

const OFFICE_GATEWAY = '192.168.10.1';
const WIFI_GATEWAY = '192.168.20.1';
const SERVER_GATEWAY = '192.168.30.1';
/** Srv-Auth: the DNS server of the inside */
const DNS_SERVER = '192.168.30.10';

export function createCompanySample(): {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
} {
  const devices: NetworkDevice[] = [
    // ── Offices (VLAN 10, 192.168.10.0/24) and Wi-Fi (VLAN 20, 192.168.20.0/24)
    switchDevice('sw-uffici', 'SW-Uffici', '10.99.0.3', '', 'Uffici', { x: 200, y: 740 }, [10, 20], {
      1: { name: 'PC-Contabilità', vlan: 10 },
      2: { name: 'PC-Vendite', vlan: 10 },
      3: { name: 'Stampante', vlan: 10 },
      4: { name: 'AP-Uffici', vlan: 20, poe: true },
      8: { name: 'SW-Core', portType: 'trunk', vlan: [10, 20] },
    }),
    endDevice(
      'pc-contabilita', 'PC', 'tpl-pc', 'PC-Contabilità',
      '192.168.10.11', OFFICE_GATEWAY, '02:00:C0:A8:0A:0B', 'Uffici', { x: 0, y: 920 }, DNS_SERVER
    ),
    endDevice(
      'pc-vendite', 'PC', 'tpl-pc', 'PC-Vendite',
      '192.168.10.12', OFFICE_GATEWAY, '02:00:C0:A8:0A:0C', 'Uffici', { x: 200, y: 920 }, DNS_SERVER
    ),
    endDevice(
      'stampante', 'PC', 'tpl-printer', 'Stampante',
      '192.168.10.50', OFFICE_GATEWAY, '02:00:C0:A8:0A:32', 'Uffici', { x: 400, y: 920 }, DNS_SERVER
    ),
    {
      id: 'ap-uffici',
      type: 'AccessPoint',
      templateId: 'tpl-accesspoint',
      label: 'AP-Uffici',
      ip: '192.168.20.2',
      subnet: MASK,
      gateway: WIFI_GATEWAY,
      location: 'Uffici',
      position: { x: 700, y: 740 },
      // The cable to the switch, and a radio card for each device on the Wi-Fi
      nics: [
        nic('nic-1', 'eth0', '02:00:C0:A8:14:02', '192.168.20.2', WIFI_GATEWAY),
        nic('nic-2', 'wlan0', '02:00:C0:A8:14:F0'),
        nic('nic-3', 'wlan1', '02:00:C0:A8:14:F1'),
      ],
    },
    // The laptops come and go: they take their address from Router-Core, and
    // with it the DNS server to ask
    dhcpClient('portatile-1', 'Portatile-1', '02:00:C0:A8:14:0B', 'Uffici', { x: 600, y: 920 }),
    dhcpClient('portatile-2', 'Portatile-2', '02:00:C0:A8:14:0C', 'Uffici', { x: 840, y: 920 }),

    // ── Core ─────────────────────────────────────────────────────────────
    {
      id: 'router-core',
      type: 'Router',
      templateId: 'tpl-router',
      label: 'Router-Core',
      // Management address = its address on the office network
      ip: OFFICE_GATEWAY,
      subnet: MASK,
      // Default route: everything that is not inside goes to the firewall
      gateway: '10.0.0.2',
      vendor: '',
      location: 'Sala Server',
      position: { x: 620, y: 380 },
      portCount: 4,
      // The two networks people sit on get their addresses from the router,
      // and with them the DNS server of the inside
      ports: ports(4, 'lan', {
        1: {
          name: 'Uffici (VLAN 10)',
          ip: OFFICE_GATEWAY,
          subnet: MASK,
          dhcpServer: { start: '192.168.10.100', end: '192.168.10.199', dns: DNS_SERVER },
        },
        2: {
          name: 'Wi-Fi (VLAN 20)',
          ip: WIFI_GATEWAY,
          subnet: MASK,
          dhcpServer: { start: '192.168.20.100', end: '192.168.20.199', dns: DNS_SERVER },
        },
        3: { name: 'Server (VLAN 30)', ip: SERVER_GATEWAY, subnet: MASK },
        4: { name: 'Firewall', ip: '10.0.0.1', subnet: P2P_MASK },
      }),
    },
    // Management addresses of the VLAN switches are on a network of their own:
    // a switch answers in VLAN 1, and here every cabled port is in another one
    switchDevice('sw-core', 'SW-Core', '10.99.0.2', '', 'Sala Server', { x: 200, y: 560 }, [10, 20], {
      1: { name: 'SW-Uffici', portType: 'trunk', vlan: [10, 20] },
      7: { name: 'Router VLAN 10', vlan: 10 },
      8: { name: 'Router VLAN 20', vlan: 20 },
    }),
    switchDevice('sw-server', 'SW-Server', '10.99.0.4', '', 'Sala Server', { x: 1300, y: 560 }, [30], {
      1: { name: 'Srv-Auth', vlan: 30 },
      2: { name: 'DB-Gestionale', vlan: 30 },
      3: { name: 'Web-Gestionale', vlan: 30 },
      4: { name: 'Mail', vlan: 30 },
      5: { name: 'NAS', vlan: 30 },
      8: { name: 'Router VLAN 30', vlan: 30 },
    }),

    // ── Servers (VLAN 30, 192.168.30.0/24) ───────────────────────────────
    {
      ...endDevice(
        'srv-auth', 'Server', 'tpl-server', 'Srv-Auth',
        DNS_SERVER, SERVER_GATEWAY, '02:00:C0:A8:1E:0A', 'Sala Server', { x: 900, y: 740 }
      ),
      // The names of the inside. The portal is known by its address in the
      // DMZ: from inside it is reached there, not at the public one
      dnsRecords: [
        { id: 'record-1', name: 'gestionale.azienda.example', address: '192.168.30.30' },
        { id: 'record-2', name: 'posta.azienda.example', address: '192.168.30.40' },
        { id: 'record-3', name: 'portale.azienda.example', address: '172.16.0.10' },
      ],
    },
    endDevice(
      'db-gestionale', 'Database', 'tpl-database', 'DB-Gestionale',
      '192.168.30.20', SERVER_GATEWAY, '02:00:C0:A8:1E:14', 'Sala Server', { x: 1100, y: 740 }
    ),
    endDevice(
      'web-gestionale', 'Server', 'tpl-webserver', 'Web-Gestionale',
      '192.168.30.30', SERVER_GATEWAY, '02:00:C0:A8:1E:1E', 'Sala Server', { x: 1300, y: 740 }
    ),
    endDevice(
      'mail', 'Server', 'tpl-mailserver', 'Mail',
      '192.168.30.40', SERVER_GATEWAY, '02:00:C0:A8:1E:28', 'Sala Server', { x: 1500, y: 740 }
    ),
    endDevice(
      'nas', 'Database', 'tpl-nas', 'NAS',
      '192.168.30.50', SERVER_GATEWAY, '02:00:C0:A8:1E:32', 'Sala Server', { x: 1700, y: 740 }
    ),

    // ── DMZ (172.16.0.0/24) ──────────────────────────────────────────────
    switchDevice('sw-dmz', 'SW-DMZ', '172.16.0.2', '172.16.0.1', 'Sala Server', { x: 960, y: 200 }, [], {
      1: { name: 'Portale-Clienti' },
      8: { name: 'Firewall' },
    }),
    endDevice(
      'portale-clienti', 'Server', 'tpl-webserver', 'Portale-Clienti',
      '172.16.0.10', '172.16.0.1', '02:00:AC:10:00:0A', 'Sala Server', { x: 1300, y: 200 }
    ),

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
      location: 'Sala Server',
      position: { x: 620, y: 200 },
      portCount: 4,
      ports: ports(4, 'lan', {
        1: { name: 'Interno', ip: '10.0.0.2', subnet: P2P_MASK, securityZone: 'trust' },
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
        { id: 'route-1', destination: '192.168.0.0/16', nextHop: '10.0.0.1', description: 'reti interne' },
      ],
      // What is published at the public address: a forward says where the
      // traffic goes, a rule below says that it may
      portForwards: [
        { id: 'forward-1', service: 'web', port: 3, to: '172.16.0.10', description: 'portale clienti' },
        { id: 'forward-2', service: 'email', port: 3, to: '192.168.30.40', description: 'posta in arrivo' },
      ],
      firewallRules: [
        {
          id: 'rule-1',
          action: 'allow',
          service: 'web',
          source: 'untrust',
          destination: '172.16.0.10',
          description: 'portale clienti',
        },
        {
          id: 'rule-2',
          action: 'allow',
          service: 'email',
          source: 'untrust',
          destination: '192.168.30.40',
          description: 'posta in arrivo',
        },
        {
          id: 'rule-3',
          action: 'allow',
          service: 'web',
          source: '172.16.0.10',
          destination: '192.168.30.20',
          description: 'il portale legge il database',
        },
      ],
    },

    // ── Outside ──────────────────────────────────────────────────────────
    endDevice(
      'cliente-remoto', 'PC', 'tpl-pc', 'Cliente-Remoto',
      '203.0.113.50', '203.0.113.1', '02:00:CB:00:71:32', 'Fuori sede', { x: 320, y: 20 }
    ),
    {
      id: 'internet',
      type: 'Cloud',
      templateId: 'tpl-cloud',
      label: 'Internet',
      ip: '',
      subnet: MASK,
      gateway: '',
      position: { x: 620, y: 20 },
      // Two cards without an address: the symbol only stands for "outside"
      nics: [nic('nic-1', 'eth0', '02:00:CB:00:71:01'), nic('nic-2', 'eth1', '02:00:CB:00:71:02')],
    },
  ];

  /** An end device cabled to a switch port, from its top to the switch's bottom */
  const access = (id: string, deviceId: string, switchId: string, port: number): NetworkConnection => ({
    id,
    source: deviceId,
    target: switchId,
    sourceHandle: 'top',
    targetHandle: 'bottom',
    sourceNic: 'nic-1',
    targetPort: port,
    type: 'access',
    bandwidth: '1 Gbps',
  });

  // Every link is bound on both ends: NIC id on end devices, port id elsewhere
  // (on the firewall the port is also the zone, so it is never left to chance).
  const connections: NetworkConnection[] = [
    {
      id: 'link-remoto',
      source: 'cliente-remoto',
      target: 'internet',
      sourceHandle: 'right',
      targetHandle: 'left',
      sourceNic: 'nic-1',
      targetNic: 'nic-2',
      type: 'access',
      bandwidth: '100 Mbps',
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
      id: 'link-portale',
      source: 'portale-clienti',
      target: 'sw-dmz',
      sourceHandle: 'left',
      targetHandle: 'right',
      sourceNic: 'nic-1',
      targetPort: 1,
      type: 'access',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-interno',
      source: 'fw-edge',
      target: 'router-core',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourcePort: 1,
      targetPort: 4,
      type: 'uplink',
      bandwidth: '1 Gbps',
    },
    {
      id: 'link-vlan-10',
      source: 'router-core',
      target: 'sw-core',
      sourceHandle: 'left',
      targetHandle: 'top',
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
      sourceHandle: 'bottom',
      targetHandle: 'right',
      sourcePort: 2,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
      label: 'VLAN 20',
    },
    {
      id: 'link-vlan-30',
      source: 'router-core',
      target: 'sw-server',
      sourceHandle: 'right',
      targetHandle: 'top',
      sourcePort: 3,
      targetPort: 8,
      type: 'uplink',
      bandwidth: '1 Gbps',
      label: 'VLAN 30',
    },
    {
      id: 'link-trunk-uffici',
      source: 'sw-core',
      target: 'sw-uffici',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      sourcePort: 1,
      targetPort: 8,
      type: 'trunk',
      bandwidth: '1 Gbps',
      label: 'Trunk 10, 20',
    },
    access('link-pc-contabilita', 'pc-contabilita', 'sw-uffici', 1),
    access('link-pc-vendite', 'pc-vendite', 'sw-uffici', 2),
    access('link-stampante', 'stampante', 'sw-uffici', 3),
    {
      id: 'link-ap-uffici',
      source: 'sw-uffici',
      target: 'ap-uffici',
      sourceHandle: 'right',
      targetHandle: 'left',
      sourcePort: 4,
      targetNic: 'nic-1',
      type: 'access',
      bandwidth: '1 Gbps',
      label: 'VLAN 20',
    },
    {
      id: 'link-portatile-1',
      source: 'portatile-1',
      target: 'ap-uffici',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetNic: 'nic-2',
      type: 'access',
      bandwidth: '100 Mbps',
      label: 'Wi-Fi',
    },
    {
      id: 'link-portatile-2',
      source: 'portatile-2',
      target: 'ap-uffici',
      sourceHandle: 'top',
      targetHandle: 'bottom',
      sourceNic: 'nic-1',
      targetNic: 'nic-3',
      type: 'access',
      bandwidth: '100 Mbps',
      label: 'Wi-Fi',
    },
    access('link-srv-auth', 'srv-auth', 'sw-server', 1),
    access('link-db-gestionale', 'db-gestionale', 'sw-server', 2),
    access('link-web-gestionale', 'web-gestionale', 'sw-server', 3),
    access('link-mail', 'mail', 'sw-server', 4),
    access('link-nas', 'nas', 'sw-server', 5),
  ];

  return { devices, connections };
}
