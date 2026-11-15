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
 *
 * The names above are the Italian ones. Whatever is called differently in
 * another language (devices, places, ports, notes, DNS names) is read from
 * the dictionary, `samples.company`, at the moment the sample is created;
 * what is called the same everywhere (SW-Core, Mail, Internet, VLAN 10…) is
 * written here. Ids and addresses never change (and an id is seen by nobody:
 * a sample that is loaded is given new ones, `dev-1`, `conn-1`…).
 *
 * The sample brings the network settings of its project (`settings`) and its
 * areas (`areas`): see utils/sampleNetwork.ts. The rows of devices are 200
 * apart, the room two areas one above the other need not to touch.
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
    // (a laptop: an end device with one card, as a PC is, with its own drawing)
    templateId: 'tpl-laptop',
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

export function createCompanySample(): SampleNetwork {
  // The names are read now, in the language the interface is in: once on the
  // board they are content, and they stay as they were created
  const names = getT().samples.company;
  const { offices, serverRoom, offSite } = names.places;

  const devices: NetworkDevice[] = [
    // ── Offices (VLAN 10, 192.168.10.0/24) and Wi-Fi (VLAN 20, 192.168.20.0/24)
    switchDevice('sw-uffici', names.devices.officeSwitch, '10.99.0.3', '', offices, { x: 200, y: 820 }, [10, 20], {
      1: { name: names.devices.accountsPc, vlan: 10 },
      2: { name: names.devices.salesPc, vlan: 10 },
      3: { name: names.devices.printer, vlan: 10 },
      4: { name: names.devices.accessPoint, vlan: 20, poe: true },
      8: { name: 'SW-Core', portType: 'trunk', vlan: [10, 20] },
    }),
    endDevice(
      'pc-contabilita', 'PC', 'tpl-pc', names.devices.accountsPc,
      '192.168.10.11', OFFICE_GATEWAY, '02:00:C0:A8:0A:0B', offices, { x: 0, y: 1020 }, DNS_SERVER
    ),
    endDevice(
      'pc-vendite', 'PC', 'tpl-pc', names.devices.salesPc,
      '192.168.10.12', OFFICE_GATEWAY, '02:00:C0:A8:0A:0C', offices, { x: 200, y: 1020 }, DNS_SERVER
    ),
    endDevice(
      'stampante', 'PC', 'tpl-printer', names.devices.printer,
      '192.168.10.50', OFFICE_GATEWAY, '02:00:C0:A8:0A:32', offices, { x: 400, y: 1020 }, DNS_SERVER
    ),
    {
      id: 'ap-uffici',
      type: 'AccessPoint',
      templateId: 'tpl-accesspoint',
      label: names.devices.accessPoint,
      ip: '192.168.20.2',
      subnet: MASK,
      gateway: WIFI_GATEWAY,
      location: offices,
      position: { x: 700, y: 820 },
      // The cable to the switch, and a radio card for each device on the Wi-Fi
      nics: [
        nic('nic-1', 'eth0', '02:00:C0:A8:14:02', '192.168.20.2', WIFI_GATEWAY),
        nic('nic-2', 'wlan0', '02:00:C0:A8:14:F0'),
        nic('nic-3', 'wlan1', '02:00:C0:A8:14:F1'),
      ],
    },
    // The laptops come and go: they take their address from Router-Core, and
    // with it the DNS server to ask
    dhcpClient('portatile-1', names.devices.laptop(1), '02:00:C0:A8:14:0B', offices, { x: 600, y: 1020 }),
    dhcpClient('portatile-2', names.devices.laptop(2), '02:00:C0:A8:14:0C', offices, { x: 840, y: 1020 }),

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
      location: serverRoom,
      position: { x: 620, y: 420 },
      portCount: 4,
      // The two networks people sit on get their addresses from the router,
      // and with them the DNS server of the inside
      ports: ports(4, 'lan', {
        1: {
          name: names.ports.offices(10),
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
        3: { name: names.ports.servers(30), ip: SERVER_GATEWAY, subnet: MASK },
        4: { name: 'Firewall', ip: '10.0.0.1', subnet: P2P_MASK },
      }),
    },
    // Management addresses of the VLAN switches are on a network of their own:
    // a switch answers in VLAN 1, and here every cabled port is in another one
    switchDevice('sw-core', 'SW-Core', '10.99.0.2', '', serverRoom, { x: 200, y: 620 }, [10, 20], {
      1: { name: names.devices.officeSwitch, portType: 'trunk', vlan: [10, 20] },
      7: { name: 'Router VLAN 10', vlan: 10 },
      8: { name: 'Router VLAN 20', vlan: 20 },
    }),
    switchDevice('sw-server', names.devices.serverSwitch, '10.99.0.4', '', serverRoom, { x: 1300, y: 620 }, [30], {
      1: { name: 'Srv-Auth', vlan: 30 },
      2: { name: names.devices.erpDatabase, vlan: 30 },
      3: { name: names.devices.erpWebServer, vlan: 30 },
      4: { name: 'Mail', vlan: 30 },
      5: { name: 'NAS', vlan: 30 },
      8: { name: 'Router VLAN 30', vlan: 30 },
    }),

    // ── Servers (VLAN 30, 192.168.30.0/24) ───────────────────────────────
    {
      ...endDevice(
        'srv-auth', 'Server', 'tpl-server', 'Srv-Auth',
        DNS_SERVER, SERVER_GATEWAY, '02:00:C0:A8:1E:0A', serverRoom, { x: 900, y: 820 }
      ),
      // The names of the inside. The portal is known by its address in the
      // DMZ: from inside it is reached there, not at the public one
      dnsRecords: [
        { id: 'record-1', name: names.hostNames.erp, address: '192.168.30.30' },
        { id: 'record-2', name: names.hostNames.mail, address: '192.168.30.40' },
        { id: 'record-3', name: names.hostNames.portal, address: '172.16.0.10' },
      ],
    },
    endDevice(
      'db-gestionale', 'Database', 'tpl-database', names.devices.erpDatabase,
      '192.168.30.20', SERVER_GATEWAY, '02:00:C0:A8:1E:14', serverRoom, { x: 1100, y: 820 }
    ),
    endDevice(
      'web-gestionale', 'Server', 'tpl-webserver', names.devices.erpWebServer,
      '192.168.30.30', SERVER_GATEWAY, '02:00:C0:A8:1E:1E', serverRoom, { x: 1300, y: 820 }
    ),
    endDevice(
      'mail', 'Server', 'tpl-mailserver', 'Mail',
      '192.168.30.40', SERVER_GATEWAY, '02:00:C0:A8:1E:28', serverRoom, { x: 1500, y: 820 }
    ),
    endDevice(
      'nas', 'Database', 'tpl-nas', 'NAS',
      '192.168.30.50', SERVER_GATEWAY, '02:00:C0:A8:1E:32', serverRoom, { x: 1700, y: 820 }
    ),

    // ── DMZ (172.16.0.0/24) ──────────────────────────────────────────────
    switchDevice('sw-dmz', 'SW-DMZ', '172.16.0.2', '172.16.0.1', serverRoom, { x: 960, y: 220 }, [], {
      1: { name: names.devices.customerPortal },
      8: { name: 'Firewall' },
    }),
    endDevice(
      'portale-clienti', 'Server', 'tpl-webserver', names.devices.customerPortal,
      '172.16.0.10', '172.16.0.1', '02:00:AC:10:00:0A', serverRoom, { x: 1300, y: 220 }
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
      location: serverRoom,
      position: { x: 620, y: 220 },
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
      // What is published at the public address: a forward says where the
      // traffic goes, a rule below says that it may
      portForwards: [
        { id: 'forward-1', service: 'web', port: 3, to: '172.16.0.10', description: names.notes.customerPortal },
        { id: 'forward-2', service: 'email', port: 3, to: '192.168.30.40', description: names.notes.incomingMail },
      ],
      firewallRules: [
        {
          id: 'rule-1',
          action: 'allow',
          service: 'web',
          source: 'untrust',
          destination: '172.16.0.10',
          description: names.notes.customerPortal,
        },
        {
          id: 'rule-2',
          action: 'allow',
          service: 'email',
          source: 'untrust',
          destination: '192.168.30.40',
          description: names.notes.incomingMail,
        },
        {
          id: 'rule-3',
          action: 'allow',
          service: 'web',
          source: '172.16.0.10',
          destination: '192.168.30.20',
          description: names.notes.portalReadsDatabase,
        },
      ],
    },

    // ── Outside ──────────────────────────────────────────────────────────
    endDevice(
      'cliente-remoto', 'PC', 'tpl-pc', names.devices.remoteCustomer,
      '203.0.113.50', '203.0.113.1', '02:00:CB:00:71:32', offSite, { x: 320, y: 20 }
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

  // What the project is set to with this network: a new device starts on the
  // network of the offices, asks the DNS server of the inside, and every
  // VLAN of the drawing has its name (1 is where the ports nobody set are)
  const settings = sampleSettings({
    network: '192.168.10.0',
    gateway: OFFICE_GATEWAY,
    dns: DNS_SERVER,
    vlans: [
      { id: 1, name: names.vlans.default },
      { id: 10, name: names.vlans.offices },
      { id: 20, name: 'Wi-Fi' },
      { id: 30, name: names.vlans.servers },
    ],
  });

  // What its groups of devices are, at a glance. The access point and the
  // two laptops are in none: they sit between the offices and the servers.
  // (Internet, Edge and Core are called the same in every language)
  const areas = areasAround(
    [
      { label: 'Internet', color: 'slate', devices: ['cliente-remoto', 'internet'] },
      { label: 'Edge', color: 'green', devices: ['fw-edge', 'sw-dmz', 'portale-clienti'] },
      { label: 'Core', color: 'amber', devices: ['router-core', 'sw-core', 'sw-server'] },
      {
        label: names.areas.offices,
        color: 'red',
        devices: ['sw-uffici', 'pc-contabilita', 'pc-vendite', 'stampante'],
      },
      {
        label: names.areas.servers,
        color: 'violet',
        devices: ['srv-auth', 'db-gestionale', 'web-gestionale', 'mail', 'nas'],
      },
    ],
    devices
  );

  return { devices, connections, settings, areas };
}
