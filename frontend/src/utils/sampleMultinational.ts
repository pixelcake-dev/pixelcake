/**
 * Fifth sample network, and the largest: the Italian network of a
 * multinational, about two hundred devices on ten sites. It is there to see
 * how the app holds a drawing of that size, and to be questioned like a real
 * network: every answer it gives is one a network engineer would expect.
 *
 *   sites            block            joined by
 *   Milano (HQ)      10.10.0.0/16     MPLS, and the two direct lines below
 *   Roma             10.20.0.0/16     main line to Milano (10.254.20.0/30), MPLS as backup
 *   Bologna (DR DC)  10.30.0.0/16     fibre to Milano (10.254.30.0/30), MPLS as backup
 *   Torino           10.101.0.0/16    MPLS (a large branch, with its VLANs)
 *   Venezia          10.102.0.0/16    MPLS (small: one network)
 *   Firenze          10.103.0.0/16    MPLS (small)
 *   Napoli           10.104.0.0/16    MPLS (users and voice)
 *   Bari             10.105.0.0/16    MPLS (a warehouse behind a firewall: cameras, IoT)
 *   Palermo          10.106.0.0/16    MPLS (a shop behind a firewall: tills, guest Wi-Fi)
 *   Cagliari         10.107.0.0/16    MPLS (small)
 *   MPLS             10.255.0.0/24    the carrier's network: a Cloud symbol not named
 *                                    Internet, which carries everything
 *   guests           10.250.0.0/16    every guest network, one /24 for each site that has one,
 *                                    so that one rule covers them all
 *   DMZ (Milano)     172.16.10.0/24
 *   Internet         203.0.113.0/24 (provider A), 198.51.100.0/24 (provider B)
 *
 * A VLAN has the same number on every site: 10 users, 20 voice, 30 Wi-Fi,
 * 40 guests, 60 cameras, 70 IoT, 80 tills. A router or a firewall has a port
 * in each VLAN it routes (the engine has no sub-interfaces), so a router and
 * its switch are joined by one cable per VLAN, at most three for a pair of
 * devices.
 *
 * Routing is static, as the engine has no dynamic routing:
 *  - in Milano the firewall is the way out, R-MI routes the VLANs of the
 *    head office and hands everything for the other sites to R-MI-WAN, the
 *    router at the edge of the WAN, which knows each site by its next hop;
 *  - every branch has its default route to R-MI-WAN over MPLS (10.255.0.1):
 *    the Internet is reached through Milano, and so are the other branches;
 *  - Roma and the DR data centre have two default routes, the direct line
 *    first and MPLS as backup; R-MI-WAN has the same two routes back to
 *    each. Cut the direct line and both ends withdraw the route that leaves
 *    by it, and the traffic takes MPLS.
 *
 * FW-MI, at Milano's edge, has zones and an ordered list of rules (guests
 * never inside, the DMZ published through NAT on two providers, the staff
 * browsing only through the proxy). The warehouse and the shop have a
 * firewall of their own: cameras isolated with their recorder, sensors that
 * speak only to the archive, tills that reach only their server, guests kept
 * away from the company.
 *
 * DHCP: every router or firewall port where people sit hands out .100–.199
 * of its network, with the DNS server of Milano; in Roma the users take
 * their address from a DHCP server on their own network. DNS: DNS-1 and
 * DNS-2 in Milano (and DNS-3 at the DR data centre) know the names of the
 * services; DNS-PUB, in the DMZ, answers the outside for the public ones.
 *
 * Names: device names are codes, the same in every language (`R-MI`,
 * `PC-RM-101`); words (sites, VLANs, ports, notes, DNS names) are read from
 * the dictionary, `samples.multinational`, when the sample is created.
 *
 * Layout: the drawing reads as Italy, north on top. Torino, Milano and
 * Venezia in a row, Milano the largest, its Internet above it; Bologna and
 * Roma in the middle, either side of the MPLS network, Firenze beside
 * Bologna; the south and the islands under them: Cagliari on the left,
 * Palermo under the MPLS network, Napoli and Bari on the right. Each site is
 * laid out as the small samples are, its router or firewall on top, and has
 * an area worked out from its devices; Milano's holds its floors, its server
 * room and its DMZ. The cables of the WAN keep to the corridors between the
 * sites: R-MI-WAN stands at the foot of Milano's corridor, the lines of the
 * north come down outside the other sites, those of the south reach the
 * MPLS network from under it (utils/sampleLayout.test.ts measures the whole
 * at 100 %).
 */
import type {
  FirewallRule,
  NetworkConnection,
  NetworkDevice,
  NetworkInterfaceCard,
  Port,
  PortForward,
  StaticRoute,
} from '@/types';
import { getT } from '@/i18n';
import { areasAround, sampleSettings, type SampleGroup, type SampleNetwork } from '@/utils/sampleNetwork';

const MASK = '255.255.255.0';
const P2P_MASK = '255.255.255.252';
/** The DNS server every site asks */
const DNS_1 = '10.10.100.53';
/** Milano's WAN router on the MPLS network: every branch's default route */
const MILANO_MPLS = '10.255.0.1';

type Side = 'top' | 'bottom' | 'left' | 'right';
interface Point {
  x: number;
  y: number;
}
/** One end of a cable: a device, the side of it the cable leaves from, and the port or card */
interface End {
  id: string;
  side: Side;
  port?: number;
  nic?: string;
}

const hex = (value: number) => value.toString(16).toUpperCase().padStart(2, '0');

/** The devices and cables of the drawing, as they are added */
class Drawing {
  readonly devices: NetworkDevice[] = [];
  readonly connections: NetworkConnection[] = [];
  private macs = 0;
  private links = 0;

  /** A MAC address of its own for every card, in order */
  mac(): string {
    this.macs += 1;
    return `02:00:0A:00:${hex(this.macs >> 8)}:${hex(this.macs & 255)}`;
  }

  add<T extends NetworkDevice>(device: T): T {
    this.devices.push(device);
    return device;
  }

  device(id: string): NetworkDevice {
    const found = this.devices.find((device) => device.id === id);
    if (!found) throw new Error(`no device ${id}`);
    return found;
  }

  port(id: string, port: number): Port {
    const found = this.device(id).ports?.find((one) => one.id === port);
    if (!found) throw new Error(`no port ${port} on ${id}`);
    return found;
  }

  /** A cable between two ends */
  link(from: End, to: End, look: Pick<NetworkConnection, 'type' | 'bandwidth' | 'label'> = {}): void {
    this.links += 1;
    this.connections.push({
      id: `link-${this.links}`,
      source: from.id,
      target: to.id,
      sourceHandle: from.side,
      targetHandle: to.side,
      ...(from.port !== undefined ? { sourcePort: from.port } : { sourceNic: from.nic ?? 'nic-1' }),
      ...(to.port !== undefined ? { targetPort: to.port } : { targetNic: to.nic ?? 'nic-1' }),
      type: look.type ?? 'access',
      ...(look.bandwidth ? { bandwidth: look.bandwidth } : {}),
      ...(look.label ? { label: look.label } : {}),
    });
  }

  /**
   * A device on a switch port: from its top to the bottom of the switch, the
   * port in the device's VLAN (none on a switch that knows no VLAN). Desk
   * cables carry no label: there are too many of them to say "1 Gbps" on each
   */
  plug(deviceId: string, switchId: string, port: number, vlan?: number): void {
    const switchPort = this.port(switchId, port);
    switchPort.name = this.device(deviceId).label;
    if (vlan !== undefined) switchPort.vlan = vlan;
    this.link({ id: deviceId, side: 'top' }, { id: switchId, side: 'bottom', port });
  }

  /** A device on Wi-Fi: from its top to the bottom of the access point, on a card of its own */
  wifi(deviceId: string, apId: string, card: number): void {
    this.link({ id: deviceId, side: 'top' }, { id: apId, side: 'bottom', nic: `nic-${card}` });
  }

  /** Two switches joined by a trunk that carries these VLANs */
  trunk(from: End & { port: number }, to: End & { port: number }, vlans: number[], bandwidth = '10 Gbps'): void {
    for (const end of [from, to]) {
      const port = this.port(end.id, end.port);
      port.portType = 'trunk';
      port.vlan = vlans;
      port.name = this.device(end === from ? to.id : from.id).label;
    }
    this.link(from, to, { type: 'trunk', bandwidth, label: `Trunk ${vlans.join(', ')}` });
  }

  /**
   * The ports of a router (or a firewall) on its switch, one cable for each
   * VLAN. The first runs from the bottom of the router to the top of the
   * switch, the second under the switch, the third over the router: their
   * labels stand one above the other, never on each other
   */
  vlanCables(routerId: string, switchId: string, cables: Array<[number, number, number]>): void {
    const sides: Array<[Side, Side]> = [
      ['bottom', 'top'],
      ['bottom', 'bottom'],
      ['top', 'top'],
    ];
    cables.forEach(([routerPort, switchPort, vlan], i) => {
      const [from, to] = sides[i];
      this.gateway({ id: routerId, side: from, port: routerPort }, { id: switchId, side: to, port: switchPort }, vlan);
    });
  }

  /** A port of a router or a firewall on a switch port, in one VLAN (or none) */
  gateway(router: End & { port: number }, to: End & { port: number }, vlan?: number, bandwidth = '1 Gbps'): void {
    const switchPort = this.port(to.id, to.port);
    switchPort.name = this.device(router.id).label;
    if (vlan !== undefined) switchPort.vlan = vlan;
    this.link(router, to, { type: 'uplink', bandwidth, ...(vlan !== undefined ? { label: `VLAN ${vlan}` } : {}) });
  }
}

/** Ports of one kind, some of them set */
function ports(count: number, portType: NonNullable<Port['portType']>, settings: Record<number, Partial<Port>> = {}): Port[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    enabled: true,
    speed: 'auto' as const,
    portType,
    ...settings[i + 1],
  }));
}

/** A card with no address and no DHCP: a wireless card of an access point, a side of a cloud */
function bareCard(drawing: Drawing, id: string, name: string): NetworkInterfaceCard {
  return { id, name, enabled: true, speed: 'auto', ip: '', subnet: MASK, gateway: '', mac: drawing.mac() };
}

/** A card with an address written on it, or set to DHCP when there is none */
function card(drawing: Drawing, id: string, name: string, ip = '', gateway = '', dns = ''): NetworkInterfaceCard {
  if (!ip) {
    return { id, name, enabled: true, speed: 'auto', ip: '', subnet: '', gateway: '', mac: drawing.mac(), dhcp: true };
  }
  return { id, name, enabled: true, speed: 'auto', ip, subnet: MASK, gateway, ...(dns ? { dns } : {}), mac: drawing.mac() };
}

interface HostSpec {
  id: string;
  label: string;
  template: string;
  type?: string;
  location: string;
  at: Point;
  /** The address written on it; none, it takes one from DHCP */
  ip?: string;
  gateway?: string;
  dns?: string;
}

/** An end device with one card: a PC, a phone, a printer, a server */
function host(drawing: Drawing, spec: HostSpec, extra: Partial<NetworkDevice> = {}): NetworkDevice {
  const nic = card(drawing, 'nic-1', 'eth0', spec.ip, spec.gateway, spec.dns);
  return drawing.add({
    id: spec.id,
    type: spec.type ?? 'PC',
    templateId: spec.template,
    label: spec.label,
    // Device-level addressing mirrors the card: empty when it is leased
    ip: spec.ip ?? '',
    subnet: spec.ip ? MASK : '',
    gateway: spec.ip ? (spec.gateway ?? '') : '',
    location: spec.location,
    position: spec.at,
    nics: [nic],
    ...extra,
  });
}

/** An access point (or an IoT gateway): its address on the wire, a card for each device it serves */
function accessPoint(
  drawing: Drawing,
  spec: Omit<HostSpec, 'type' | 'template' | 'dns'> & { template?: string; clients: number }
): NetworkDevice {
  return drawing.add({
    id: spec.id,
    type: 'AccessPoint',
    templateId: spec.template ?? 'tpl-accesspoint',
    label: spec.label,
    ip: spec.ip ?? '',
    subnet: MASK,
    gateway: spec.gateway ?? '',
    location: spec.location,
    position: spec.at,
    nics: [
      card(drawing, 'nic-1', 'eth0', spec.ip, spec.gateway),
      ...Array.from({ length: spec.clients }, (_, i) => bareCard(drawing, `nic-${i + 2}`, `wlan${i}`)),
    ],
  });
}

interface SwitchSpec {
  id: string;
  label: string;
  ip: string;
  gateway?: string;
  location: string;
  at: Point;
  /** The VLANs it knows; none, it is one network */
  vlans?: number[];
  count?: number;
}

function switchDevice(drawing: Drawing, spec: SwitchSpec): NetworkDevice {
  const count = spec.count ?? 24;
  return drawing.add({
    id: spec.id,
    type: 'Switch',
    templateId: 'tpl-switch',
    label: spec.label,
    ip: spec.ip,
    subnet: MASK,
    gateway: spec.gateway ?? '',
    vendor: '',
    location: spec.location,
    position: spec.at,
    ...(spec.vlans && spec.vlans.length > 0 ? { vlan: spec.vlans } : {}),
    portCount: count,
    ports: ports(count, 'access'),
  });
}

interface RouterSpec {
  id: string;
  label: string;
  kind: 'Router' | 'Firewall';
  location: string;
  at: Point;
  /** Its management address: one of its ports */
  ip: string;
  subnet?: string;
  gateway?: string;
  count: number;
  ports: Record<number, Partial<Port>>;
  routes?: StaticRoute[];
  rules?: FirewallRule[];
  forwards?: PortForward[];
}

function router(drawing: Drawing, spec: RouterSpec): NetworkDevice {
  return drawing.add({
    id: spec.id,
    type: spec.kind,
    templateId: spec.kind === 'Router' ? 'tpl-router' : 'tpl-firewall',
    label: spec.label,
    ip: spec.ip,
    subnet: spec.subnet ?? MASK,
    gateway: spec.gateway ?? '',
    vendor: '',
    location: spec.location,
    position: spec.at,
    portCount: spec.count,
    ports: ports(spec.count, 'lan', spec.ports),
    ...(spec.routes ? { routes: spec.routes } : {}),
    ...(spec.rules ? { firewallRules: spec.rules } : {}),
    ...(spec.forwards ? { portForwards: spec.forwards } : {}),
  });
}

/** A symbol that is not simulated (a cloud, a load balancer): cards without an address, one for each cable */
function passthrough(
  drawing: Drawing,
  spec: { id: string; label: string; type: 'Cloud' | 'LoadBalancer'; location?: string; at: Point; cards: number }
): NetworkDevice {
  return drawing.add({
    id: spec.id,
    type: spec.type,
    templateId: spec.type === 'Cloud' ? 'tpl-cloud' : 'tpl-loadbalancer',
    label: spec.label,
    ip: '',
    subnet: MASK,
    gateway: '',
    ...(spec.location ? { location: spec.location } : {}),
    position: spec.at,
    nics: Array.from({ length: spec.cards }, (_, i) => bareCard(drawing, `nic-${i + 1}`, `eth${i}`)),
  });
}

/** A port of a router where people sit: its address, and the addresses it hands out with Milano's DNS server */
function served(name: string, network: string, dns = DNS_1): Partial<Port> {
  return {
    name,
    ip: `${network}.1`,
    subnet: MASK,
    dhcpServer: { start: `${network}.100`, end: `${network}.199`, dns },
  };
}

/** A port of a router with an address and nothing handed out */
function addressed(name: string, ip: string, subnet = MASK): Partial<Port> {
  return { name, ip, subnet };
}

let routeCount = 0;
function route(destination: string, nextHop: string, description: string): StaticRoute {
  routeCount += 1;
  return { id: `route-${routeCount}`, destination, nextHop, description };
}

/** A row of points from `x`, `step` apart */
const row = (x: number, y: number, count: number, step = 150): Point[] =>
  Array.from({ length: count }, (_, i) => ({ x: x + i * step, y }));

export function createMultinationalSample(): SampleNetwork {
  const t = getT().samples.multinational;
  const d = new Drawing();
  routeCount = 0;
  /** A port of a router or a firewall named after the VLAN it serves (the same in every language) */
  const vlanPort = (name: string, vlan: number) => `${name} (VLAN ${vlan})`;

  // ── Where things are: Italy, north on top ───────────────────────────────
  /** The column of Milano's firewall and routers, the middle of its corridor */
  const cx = 4700;
  const MI = { x: cx, y: 400 };
  /** The top of Milano's floors */
  const FY = MI.y + 800;
  /** The top of the middle of the country: Bologna and Roma */
  const MID = MI.y + 1800;
  /** The MPLS network, under Milano's corridor, lower than Roma */
  const MPLS_AT = { x: cx - 52, y: MID + 1130 };
  /** The foot of the MPLS network, where the south comes in: the height of the cloud is 80 */
  const SOUTH = MPLS_AT.y + 80;

  /* ══ MILANO, the head office ═══════════════════════════════════════════ */
  const milano = t.places.milan;
  const serverRoom = t.areas.serverRoom;

  // The Internet, above the firewall: two providers, a customer and a remote worker
  passthrough(d, { id: 'inet-a', label: 'Internet A', type: 'Cloud', at: { x: cx - 300, y: MI.y - 360 }, cards: 2 });
  passthrough(d, { id: 'inet-b', label: 'Internet B', type: 'Cloud', at: { x: cx + 196, y: MI.y - 360 }, cards: 2 });
  host(d, {
    id: 'customer', label: t.devices.customer, template: 'tpl-pc', location: '',
    at: { x: cx - 560, y: MI.y - 360 }, ip: '203.0.113.50', gateway: '203.0.113.1', dns: '203.0.113.1',
  });
  host(d, {
    id: 'remote-worker', label: t.devices.remoteWorker, template: 'tpl-laptop', location: '',
    at: { x: cx + 456, y: MI.y - 360 }, ip: '198.51.100.77', gateway: '198.51.100.1', dns: '198.51.100.1',
  });

  // The firewall at the edge
  router(d, {
    id: 'fw-mi', label: 'FW-MI', kind: 'Firewall', location: serverRoom,
    at: { x: cx - 52, y: MI.y }, ip: '10.10.255.1', subnet: P2P_MASK, count: 8,
    ports: {
      1: { ...addressed(t.ports.inside, '10.10.255.1', P2P_MASK), securityZone: 'trust' },
      2: { ...addressed('DMZ', '172.16.10.1'), portType: 'dmz', securityZone: 'dmz' },
      3: { ...addressed('Internet A', '203.0.113.1'), portType: 'wan', securityZone: 'untrust', nat: true },
      4: { ...addressed('Internet B', '198.51.100.1'), portType: 'wan', securityZone: 'untrust', nat: true },
      // The guests of the head office: in the outside zone, served by the firewall itself
      5: { ...served(vlanPort(t.vlans.guests, 40), '10.250.10', '172.16.10.53'), securityZone: 'untrust' },
    },
    routes: [route('10.0.0.0/8', '10.10.255.2', t.notes.company)],
    forwards: [
      { id: 'forward-1', service: 'web', port: 3, to: '172.16.10.11', description: t.notes.publicSite },
      { id: 'forward-2', service: 'email', port: 3, to: '10.10.100.25', description: t.notes.incomingMail },
      { id: 'forward-3', service: 'dns', port: 3, to: '172.16.10.53', description: t.notes.publicDns },
      { id: 'forward-4', service: 'web', port: 4, to: '172.16.10.30', description: t.notes.vpn },
      // (the public DNS answers on both providers: the remote worker asks the second)
      { id: 'forward-5', service: 'dns', port: 4, to: '172.16.10.53', description: t.notes.publicDns },
    ],
    rules: [
      { id: 'rule-1', action: 'deny', service: 'any', source: '10.250.0.0/16', destination: '10.0.0.0/8', description: t.notes.guestsNeverInside },
      { id: 'rule-2', action: 'allow', service: 'dns', source: '10.250.0.0/16', destination: '172.16.10.53', description: t.notes.guestsAskPublicDns },
      { id: 'rule-3', action: 'allow', service: 'web', source: '10.250.0.0/16', destination: 'untrust', description: t.notes.guestsBrowse },
      { id: 'rule-4', action: 'allow', service: 'web', source: 'untrust', destination: '172.16.10.11', description: t.notes.publicSiteFromOutside },
      { id: 'rule-5', action: 'allow', service: 'email', source: 'untrust', destination: '10.10.100.25', description: t.notes.mailFromOutside },
      { id: 'rule-6', action: 'allow', service: 'dns', source: 'untrust', destination: '172.16.10.53', description: t.notes.dnsFromOutside },
      { id: 'rule-7', action: 'allow', service: 'web', source: 'untrust', destination: '172.16.10.30', description: t.notes.vpnFromOutside },
      { id: 'rule-8', action: 'allow', service: 'web', source: '172.16.10.30', destination: '10.10.100.0/24', description: t.notes.vpnToApplications },
      { id: 'rule-9', action: 'allow', service: 'web', source: '172.16.10.40', destination: 'untrust', description: t.notes.proxyBrowses },
      { id: 'rule-10', action: 'deny', service: 'web', source: '10.0.0.0/8', destination: 'untrust', description: t.notes.staffThroughProxy },
      { id: 'rule-11', action: 'allow', service: 'web', source: '172.16.10.11', destination: '10.10.100.20', description: t.notes.siteReadsErp },
    ],
  });
  d.link({ id: 'customer', side: 'right' }, { id: 'inet-a', side: 'left', nic: 'nic-2' }, { bandwidth: '100 Mbps' });
  d.link({ id: 'remote-worker', side: 'left' }, { id: 'inet-b', side: 'right', nic: 'nic-2' }, { bandwidth: '100 Mbps' });
  d.link({ id: 'fw-mi', side: 'top', port: 3 }, { id: 'inet-a', side: 'bottom' }, { type: 'uplink', bandwidth: '1 Gbps' });
  d.link({ id: 'fw-mi', side: 'top', port: 4 }, { id: 'inet-b', side: 'bottom' }, { type: 'uplink', bandwidth: '500 Mbps' });

  // The DMZ, on the right of the firewall: a load balancer in front of two web servers
  switchDevice(d, { id: 'sw-mi-dmz', label: 'SW-MI-DMZ', ip: '172.16.10.2', gateway: '172.16.10.1', location: serverRoom, at: { x: cx + 750, y: MI.y } });
  d.gateway({ id: 'fw-mi', side: 'right', port: 2 }, { id: 'sw-mi-dmz', side: 'left', port: 24 });
  passthrough(d, { id: 'lb-mi', label: 'LB-WWW', type: 'LoadBalancer', location: serverRoom, at: { x: cx + 600, y: MI.y + 220 }, cards: 3 });
  d.plug('lb-mi', 'sw-mi-dmz', 1);
  const dmz: Array<[string, string, string, string]> = [
    ['dns-pub', 'DNS-PUB', 'tpl-dnsserver', '172.16.10.53'],
    ['vpn-gw', 'VPN-GW', 'tpl-vps', '172.16.10.30'],
    ['proxy', 'PROXY', 'tpl-proxy', '172.16.10.40'],
  ];
  dmz.forEach(([id, label, template, ip], i) => {
    host(d, { id, label, template, type: 'Server', location: serverRoom, at: { x: cx + 750 + i * 150, y: MI.y + 220 }, ip, gateway: '172.16.10.1' },
      id === 'dns-pub'
        ? {
            // What the outside asks: the public addresses of the published services
            dnsRecords: [
              { id: 'record-1', name: t.hostNames.www, address: '203.0.113.1' },
              { id: 'record-2', name: t.hostNames.mail, address: '203.0.113.1' },
              { id: 'record-3', name: t.hostNames.vpn, address: '198.51.100.1' },
            ],
          }
        : {});
    d.plug(id, 'sw-mi-dmz', i + 2);
  });
  ['www-1', 'www-2'].forEach((id, i) => {
    host(d, { id, label: id.toUpperCase(), template: 'tpl-webserver', type: 'Server', location: serverRoom, at: { x: cx + 525 + i * 150, y: MI.y + 440 }, ip: `172.16.10.${11 + i}`, gateway: '172.16.10.1' });
    d.link({ id, side: 'top' }, { id: 'lb-mi', side: 'bottom', nic: `nic-${i + 2}` });
  });

  // The core: the router under the firewall, two core switches under it
  router(d, {
    id: 'r-mi', label: 'R-MI', kind: 'Router', location: serverRoom,
    at: { x: cx - 52, y: MI.y + 220 }, ip: '10.10.10.1', gateway: '10.10.255.1', count: 8,
    ports: {
      1: served(vlanPort(t.vlans.users, 10), '10.10.10'),
      2: served(vlanPort(t.vlans.voice, 20), '10.10.20'),
      3: served(vlanPort('Wi-Fi', 30), '10.10.30'),
      4: addressed(t.ports.servers, '10.10.100.1'),
      5: addressed('Firewall', '10.10.255.2', P2P_MASK),
      6: addressed('R-MI-WAN', '10.10.255.5', P2P_MASK),
    },
    routes: [
      route('10.0.0.0/8', '10.10.255.6', t.notes.otherSites),
      route('10.250.10.0/24', '10.10.255.1', t.notes.headOfficeGuests),
    ],
  });
  d.link({ id: 'fw-mi', side: 'bottom', port: 1 }, { id: 'r-mi', side: 'top', port: 5 }, { type: 'uplink', bandwidth: '10 Gbps' });

  // (the core switches stand off the router's column, so that the trunk between
  // them keeps its label away from the cable that goes down to the WAN)
  const all = [10, 20, 30, 40];
  switchDevice(d, { id: 'sw-mi-c1', label: 'SW-MI-C1', ip: '10.10.1.2', location: serverRoom, at: { x: cx - 380, y: MI.y + 440 }, vlans: all });
  switchDevice(d, { id: 'sw-mi-c2', label: 'SW-MI-C2', ip: '10.10.1.3', location: serverRoom, at: { x: cx + 36, y: MI.y + 440 }, vlans: all });
  d.gateway({ id: 'r-mi', side: 'bottom', port: 1 }, { id: 'sw-mi-c1', side: 'top', port: 1 }, 10);
  d.gateway({ id: 'r-mi', side: 'left', port: 2 }, { id: 'sw-mi-c1', side: 'top', port: 2 }, 20);
  d.gateway({ id: 'r-mi', side: 'right', port: 3 }, { id: 'sw-mi-c2', side: 'top', port: 1 }, 30);
  d.gateway({ id: 'fw-mi', side: 'right', port: 5 }, { id: 'sw-mi-c2', side: 'right', port: 3 }, 40);
  d.trunk({ id: 'sw-mi-c1', side: 'right', port: 3 }, { id: 'sw-mi-c2', side: 'left', port: 4 }, all);

  // The server room, on the left of the core: one switch, ten servers in a row
  switchDevice(d, { id: 'sw-mi-dc', label: 'SW-MI-DC', ip: '10.10.100.2', gateway: '10.10.100.1', location: serverRoom, at: { x: cx - 1250, y: MI.y + 220 } });
  d.gateway({ id: 'r-mi', side: 'left', port: 4 }, { id: 'sw-mi-dc', side: 'right', port: 24 }, undefined, '10 Gbps');
  const internalRecords = () => [
    { id: 'record-1', name: t.hostNames.erp, address: '10.10.100.20' },
    { id: 'record-2', name: t.hostNames.mail, address: '10.10.100.25' },
    { id: 'record-3', name: t.hostNames.intranet, address: '10.10.100.20' },
    { id: 'record-4', name: t.hostNames.files, address: '10.10.100.30' },
    { id: 'record-5', name: t.hostNames.tills, address: '10.10.100.40' },
    // (from inside, the website and the remote access are reached in the DMZ)
    { id: 'record-6', name: t.hostNames.www, address: '172.16.10.11' },
    { id: 'record-7', name: t.hostNames.vpn, address: '172.16.10.30' },
  ];
  const servers: Array<[string, string, string, string, string]> = [
    ['erp-app', 'ERP-APP', 'tpl-webserver', 'Server', '10.10.100.20'],
    ['erp-db', 'ERP-DB', 'tpl-database', 'Database', '10.10.100.21'],
    ['mail-mi', 'MAIL', 'tpl-mailserver', 'Server', '10.10.100.25'],
    ['dns-1', 'DNS-1', 'tpl-dnsserver', 'Server', DNS_1],
    ['dns-2', 'DNS-2', 'tpl-dnsserver', 'Server', '10.10.100.54'],
    ['file-mi', 'FILE', 'tpl-server', 'Server', '10.10.100.30'],
    ['nas-mi', 'NAS-BK', 'tpl-nas', 'Database', '10.10.100.31'],
    ['s3-mi', 'S3-ARCH', 'tpl-storage-s3', 'Database', '10.10.100.80'],
    ['mon-mi', 'MON', 'tpl-vps', 'Server', '10.10.100.60'],
    ['pos-srv', 'POS-SRV', 'tpl-server', 'Server', '10.10.100.40'],
  ];
  servers.forEach(([id, label, template, type, ip], i) => {
    host(d, { id, label, template, type, location: serverRoom, at: { x: cx - 1925 + i * 150, y: MI.y + 440 }, ip, gateway: '10.10.100.1', dns: DNS_1 },
      id === 'dns-1' || id === 'dns-2' ? { dnsRecords: internalRecords() } : {});
    d.plug(id, 'sw-mi-dc', i + 1);
  });

  // Four floors in a row, two each side of the corridor; each floor switch in
  // the middle of its floor, a trunk up to the core switch on its side. The
  // printers are on the users' network, with an address of their own
  const floorVlans = [10, 20, 30];
  const floor = (n: number, centre: number, core: 'sw-mi-c1' | 'sw-mi-c2', corePort: number) => {
    const floorName = t.areas.floor(n);
    const sw = `sw-mi-0${n}`;
    const lobby = n === 1;
    const vlans = lobby ? [...floorVlans, 40] : floorVlans;
    switchDevice(d, { id: sw, label: `SW-MI-0${n}`, ip: `10.10.1.1${n}`, location: floorName, at: { x: centre - 52, y: FY }, vlans });
    d.trunk({ id: sw, side: 'top', port: 24 }, { id: core, side: 'bottom', port: corePort }, vlans);
    // the desks: (the guests' access point,) three PCs, two phones, the printer, the access point
    const count = lobby ? 8 : 7;
    const desks = row(centre - 52 - ((count - 1) * 150) / 2, FY + 220, count);
    const at = lobby ? desks.slice(1) : desks;
    const pcs = [1, 2, 3].map((k) => `pc-mi-${n}0${k}`);
    pcs.forEach((id, k) => {
      host(d, { id, label: id.toUpperCase(), template: 'tpl-pc', location: floorName, at: at[k] });
      d.plug(id, sw, k + 1, 10);
    });
    const phones = [1, 2].map((k) => `tel-mi-${n}0${k}`);
    phones.forEach((id, k) => {
      host(d, { id, label: id.toUpperCase(), template: 'tpl-ipphone', location: floorName, at: at[3 + k] });
      d.plug(id, sw, 5 + k, 20);
    });
    const printer = `prn-mi-${n}`;
    host(d, { id: printer, label: printer.toUpperCase(), template: 'tpl-printer', location: floorName, at: at[5], ip: `10.10.10.5${n}`, gateway: '10.10.10.1' });
    d.plug(printer, sw, 7, 10);
    const ap = `ap-mi-${n}`;
    accessPoint(d, { id: ap, label: `AP-MI-${n}`, location: floorName, at: at[6], ip: `10.10.30.1${n}`, gateway: '10.10.30.1', clients: 3 });
    d.plug(ap, sw, 8, 30);
    // on Wi-Fi, under the access point and the two desks before it
    const wifiAt = row(at[4].x, FY + 440, 3);
    const wireless = [`lap-mi-${n}01`, `lap-mi-${n}02`, `mob-mi-${n}01`];
    wireless.forEach((id, k) => {
      host(d, { id, label: id.toUpperCase(), template: k < 2 ? 'tpl-laptop' : 'tpl-smartphone', location: floorName, at: wifiAt[k] });
      d.wifi(id, ap, k + 2);
    });
    const ids = [sw, ...pcs, ...phones, printer, ap, ...wireless];
    if (lobby) {
      // the lobby: the guests' access point, on the guests' VLAN, at the other end of the row
      accessPoint(d, { id: 'ap-mi-guests', label: 'AP-MI-OSP', location: floorName, at: desks[0], ip: '10.250.10.10', gateway: '10.250.10.1', clients: 2 });
      d.plug('ap-mi-guests', sw, 9, 40);
      host(d, { id: 'guest-mi-1', label: t.devices.guest('MI', 1), template: 'tpl-smartphone', location: floorName, at: { x: desks[0].x, y: FY + 440 } });
      host(d, { id: 'guest-mi-2', label: t.devices.guest('MI', 2), template: 'tpl-tablet', location: floorName, at: { x: desks[1].x, y: FY + 440 } });
      d.wifi('guest-mi-1', 'ap-mi-guests', 2);
      d.wifi('guest-mi-2', 'ap-mi-guests', 3);
      ids.push('ap-mi-guests', 'guest-mi-1', 'guest-mi-2');
    }
    return ids;
  };
  const floors = [
    floor(1, cx - 1920, 'sw-mi-c1', 4),
    floor(2, cx - 646, 'sw-mi-c1', 5),
    floor(3, cx + 646, 'sw-mi-c2', 5),
    floor(4, cx + 1840, 'sw-mi-c2', 6),
  ];

  // The edge of the WAN, at the foot of the corridor: MPLS straight down,
  // the line to Roma on the right, the fibre to the DR data centre on the left
  const branchRoutes = (
    [
      ['10.101.0.0/16', '10.255.0.101', t.places.turin],
      ['10.102.0.0/16', '10.255.0.102', t.places.venice],
      ['10.103.0.0/16', '10.255.0.103', t.places.florence],
      ['10.104.0.0/16', '10.255.0.104', t.places.naples],
      ['10.105.0.0/16', '10.255.0.105', 'Bari'],
      ['10.106.0.0/16', '10.255.0.106', 'Palermo'],
      ['10.107.0.0/16', '10.255.0.107', 'Cagliari'],
    ] as const
  ).map(([network, nextHop, place]) => route(network, nextHop, t.notes.branch(place)));
  router(d, {
    id: 'r-mi-wan', label: 'R-MI-WAN', kind: 'Router', location: serverRoom,
    at: { x: cx - 52, y: MI.y + 1440 }, ip: '10.10.255.6', subnet: P2P_MASK, gateway: '10.10.255.5', count: 4,
    ports: {
      1: addressed('R-MI', '10.10.255.6', P2P_MASK),
      2: { ...addressed('MPLS', MILANO_MPLS), portType: 'wan' },
      3: { ...addressed(t.ports.lineTo(t.places.rome), '10.254.20.1', P2P_MASK), portType: 'wan' },
      4: { ...addressed(t.ports.lineTo(t.places.disasterRecovery), '10.254.30.1', P2P_MASK), portType: 'wan' },
    },
    routes: [
      route('10.20.0.0/16', '10.254.20.2', t.notes.viaMainLine(t.places.rome)),
      route('10.20.0.0/16', '10.255.0.20', t.notes.viaBackup(t.places.rome)),
      route('10.30.0.0/16', '10.254.30.2', t.notes.viaMainLine(t.places.disasterRecovery)),
      route('10.30.0.0/16', '10.255.0.30', t.notes.viaBackup(t.places.disasterRecovery)),
      ...branchRoutes,
      route('10.250.106.0/24', '10.255.0.106', t.notes.shopGuests),
    ],
  });
  d.link({ id: 'r-mi', side: 'bottom', port: 6 }, { id: 'r-mi-wan', side: 'top', port: 1 }, { type: 'uplink', bandwidth: '10 Gbps' });

  /* ══ The MPLS network, in the middle of the country ═════════════════════ */
  passthrough(d, { id: 'mpls', label: t.carrier, type: 'Cloud', at: MPLS_AT, cards: 10 });
  let mplsCard = 0;
  const mpls = (end: End & { port: number }, side: Side, bandwidth: string) => {
    mplsCard += 1;
    d.link(end, { id: 'mpls', side, nic: `nic-${mplsCard}` }, { type: 'uplink', bandwidth, label: 'MPLS' });
  };
  mpls({ id: 'r-mi-wan', side: 'bottom', port: 2 }, 'top', '1 Gbps');

  /* ══ ROMA: the second site, main line to Milano, MPLS as backup ════════ */
  // Its router at the top left corner, near the MPLS network; the rest on its right
  const roma = t.places.rome;
  const RM = { x: cx + 600, y: MID };
  const rmVlans = [10, 20, 30];
  router(d, {
    id: 'r-rm', label: 'R-RM', kind: 'Router', location: roma, at: RM, ip: '10.20.10.1', count: 8,
    ports: {
      // the users take their address from DHCP-RM, on their own network
      1: addressed(vlanPort(t.vlans.users, 10), '10.20.10.1'),
      2: served(vlanPort(t.vlans.voice, 20), '10.20.20'),
      3: served(vlanPort('Wi-Fi', 30), '10.20.30'),
      4: { ...addressed(t.ports.lineTo(milano), '10.254.20.2', P2P_MASK), portType: 'wan' },
      5: { ...addressed('MPLS', '10.255.0.20'), portType: 'wan' },
    },
    routes: [
      route('0.0.0.0/0', '10.254.20.1', t.notes.viaMainLine(milano)),
      route('0.0.0.0/0', MILANO_MPLS, t.notes.viaBackup(milano)),
    ],
  });
  d.link({ id: 'r-mi-wan', side: 'right', port: 3 }, { id: 'r-rm', side: 'top', port: 4 }, { type: 'backbone', bandwidth: '10 Gbps', label: t.cables.mainLine });
  mpls({ id: 'r-rm', side: 'left', port: 5 }, 'right', '1 Gbps');
  switchDevice(d, { id: 'sw-rm-c', label: 'SW-RM-C', ip: '10.20.1.2', location: roma, at: { x: RM.x + 200, y: RM.y + 260 }, vlans: rmVlans });
  d.vlanCables('r-rm', 'sw-rm-c', [[1, 1, 10], [2, 2, 20], [3, 3, 30]]);
  // the two servers of Roma, on the users' network: one of them hands out its addresses
  host(d, { id: 'dhcp-rm', label: 'DHCP-RM', template: 'tpl-dhcpserver', type: 'Server', location: roma, at: { x: RM.x + 550, y: RM.y }, ip: '10.20.10.10', gateway: '10.20.10.1', dns: DNS_1 });
  // (a server hands out no gateway unless told which: the router's port on the users' network)
  d.device('dhcp-rm').nics![0].dhcpServer = { start: '10.20.10.100', end: '10.20.10.199', gateway: '10.20.10.1', dns: DNS_1 };
  host(d, { id: 'file-rm', label: 'FILE-RM', template: 'tpl-server', type: 'Server', location: roma, at: { x: RM.x + 700, y: RM.y }, ip: '10.20.10.11', gateway: '10.20.10.1', dns: DNS_1 });
  d.link({ id: 'dhcp-rm', side: 'bottom' }, { id: 'sw-rm-c', side: 'right', port: 6 });
  d.port('sw-rm-c', 6).vlan = 10;
  d.port('sw-rm-c', 6).name = 'DHCP-RM';
  d.link({ id: 'file-rm', side: 'bottom' }, { id: 'sw-rm-c', side: 'right', port: 7 });
  d.port('sw-rm-c', 7).vlan = 10;
  d.port('sw-rm-c', 7).name = 'FILE-RM';
  const romeFloor = (n: number, x: number) => {
    const sw = `sw-rm-0${n}`;
    const y = RM.y + 560;
    switchDevice(d, { id: sw, label: `SW-RM-0${n}`, ip: `10.20.1.1${n}`, location: roma, at: { x: x + 525, y }, vlans: rmVlans });
    d.trunk({ id: sw, side: 'top', port: 24 }, { id: 'sw-rm-c', side: 'bottom', port: 3 + n }, rmVlans);
    const desks = row(x, y + 220, 8);
    const ids: string[] = [sw];
    [1, 2, 3, 4].forEach((k) => {
      const id = `pc-rm-${n}0${k}`;
      host(d, { id, label: id.toUpperCase(), template: 'tpl-pc', location: roma, at: desks[k - 1] });
      d.plug(id, sw, k, 10);
      ids.push(id);
    });
    [1, 2].forEach((k) => {
      const id = `tel-rm-${n}0${k}`;
      host(d, { id, label: id.toUpperCase(), template: 'tpl-ipphone', location: roma, at: desks[3 + k] });
      d.plug(id, sw, 4 + k, 20);
      ids.push(id);
    });
    const ap = `ap-rm-${n}`;
    accessPoint(d, { id: ap, label: `AP-RM-${n}`, location: roma, at: desks[6], ip: `10.20.30.1${n}`, gateway: '10.20.30.1', clients: 3 });
    d.plug(ap, sw, 7, 30);
    host(d, { id: `prn-rm-${n}`, label: `PRN-RM-${n}`, template: 'tpl-printer', location: roma, at: desks[7], ip: `10.20.10.5${n}`, gateway: '10.20.10.1' });
    d.plug(`prn-rm-${n}`, sw, 8, 10);
    const wifiAt = row(desks[6].x - 150, y + 440, 3);
    [`lap-rm-${n}01`, `lap-rm-${n}02`].forEach((id, k) => {
      host(d, { id, label: id.toUpperCase(), template: 'tpl-laptop', location: roma, at: wifiAt[k] });
      d.wifi(id, ap, k + 2);
    });
    host(d, { id: `tab-rm-${n}01`, label: `TAB-RM-${n}01`, template: 'tpl-tablet', location: roma, at: wifiAt[2] });
    d.wifi(`tab-rm-${n}01`, ap, 4);
    return [...ids, ap, `prn-rm-${n}`, `lap-rm-${n}01`, `lap-rm-${n}02`, `tab-rm-${n}01`];
  };
  const romeFloors = [romeFloor(1, RM.x), romeFloor(2, RM.x + 1350)];

  /* ══ BOLOGNA: the disaster recovery data centre ═════════════════════════ */
  // Its router at the top right corner, near the MPLS network; the servers on its left
  const dr = t.places.disasterRecovery;
  const BO = { x: cx - 700, y: MID };
  router(d, {
    id: 'r-dr', label: 'R-DR', kind: 'Router', location: dr, at: BO, ip: '10.30.100.1', count: 4,
    ports: {
      1: addressed(t.ports.servers, '10.30.100.1'),
      2: { ...addressed(t.ports.lineTo(milano), '10.254.30.2', P2P_MASK), portType: 'wan' },
      3: { ...addressed('MPLS', '10.255.0.30'), portType: 'wan' },
    },
    routes: [
      route('0.0.0.0/0', '10.254.30.1', t.notes.viaMainLine(milano)),
      route('0.0.0.0/0', MILANO_MPLS, t.notes.viaBackup(milano)),
    ],
  });
  d.link({ id: 'r-mi-wan', side: 'left', port: 4 }, { id: 'r-dr', side: 'top', port: 2 }, { type: 'backbone', bandwidth: '10 Gbps', label: t.cables.drFibre });
  mpls({ id: 'r-dr', side: 'right', port: 3 }, 'left', '1 Gbps');
  const drServers: Array<[string, string, string, string, string]> = [
    ['erp-app-dr', 'ERP-APP-DR', 'tpl-webserver', 'Server', '10.30.100.20'],
    ['erp-db-dr', 'ERP-DB-DR', 'tpl-database', 'Database', '10.30.100.21'],
    ['dns-3', 'DNS-3', 'tpl-dnsserver', 'Server', '10.30.100.53'],
    ['s3-dr', 'S3-DR', 'tpl-storage-s3', 'Database', '10.30.100.80'],
    ['nas-dr', 'NAS-DR', 'tpl-nas', 'Database', '10.30.100.31'],
  ];
  const drRow = row(BO.x - 554, BO.y + 440, drServers.length);
  switchDevice(d, { id: 'sw-dr', label: 'SW-DR', ip: '10.30.100.2', gateway: '10.30.100.1', location: dr, at: { x: drRow[2].x, y: BO.y + 220 } });
  d.gateway({ id: 'r-dr', side: 'bottom', port: 1 }, { id: 'sw-dr', side: 'top', port: 24 }, undefined, '10 Gbps');
  drServers.forEach(([id, label, template, type, ip], i) => {
    host(d, { id, label, template, type, location: dr, at: drRow[i], ip, gateway: '10.30.100.1', dns: DNS_1 },
      id === 'dns-3' ? { dnsRecords: internalRecords() } : {});
    d.plug(id, 'sw-dr', i + 1);
  });

  /* ══ The branches ═══════════════════════════════════════════════════════ */

  /**
   * A small branch: a router, one switch, one network, what sits on it. The
   * router stands at one end, on the side its MPLS cable leaves by, the
   * switch and the desks on the other: the cable goes down past them
   */
  const smallBranch = (spec: {
    code: string;
    site: number;
    place: string;
    /** Where the router is */
    at: Point;
    /** Which side of the router the desks are on */
    desks: 'left' | 'right';
    devices: Array<[string, string, boolean]>; // template, prefix, has a written address
    mpls: [Side, Side, string];
  }) => {
    const { code, site, place, at } = spec;
    const net = `10.${site}.10`;
    const r = `r-${code}`;
    const sw = `sw-${code}`;
    const count = spec.devices.length;
    const first = spec.desks === 'right' ? at.x + 200 : at.x - 100 - (count - 1) * 150 - 104;
    const desks = row(first, at.y + 480, count);
    router(d, {
      id: r, label: `R-${code.toUpperCase()}`, kind: 'Router', location: place, at, ip: `${net}.1`,
      gateway: MILANO_MPLS, count: 4,
      ports: {
        1: served('LAN', net),
        2: { ...addressed('MPLS', `10.255.0.${site}`), portType: 'wan' },
      },
    });
    switchDevice(d, { id: sw, label: `SW-${code.toUpperCase()}`, ip: `${net}.2`, gateway: `${net}.1`, location: place, at: { x: (desks[0].x + desks[count - 1].x) / 2, y: at.y + 260 }, count: 8 });
    d.gateway({ id: r, side: 'bottom', port: 1 }, { id: sw, side: 'top', port: 8 });
    const [routerSide, mplsSide, bandwidth] = spec.mpls;
    mpls({ id: r, side: routerSide, port: 2 }, mplsSide, bandwidth);
    const ids = [r, sw];
    const counts: Record<string, number> = {};
    spec.devices.forEach(([template, prefix, fixed], i) => {
      counts[prefix] = (counts[prefix] ?? 0) + 1;
      const id = `${prefix}-${code}-${counts[prefix]}`;
      host(d, {
        id, label: id.toUpperCase(), template, location: place, at: desks[i],
        ...(fixed ? { ip: `${net}.${10 + i}`, gateway: `${net}.1` } : {}),
      });
      d.plug(id, sw, i + 1);
      ids.push(id);
    });
    return ids;
  };

  // The north: Venezia on the right of Milano, its line down past Roma
  const venezia = smallBranch({
    code: 've', site: 102, place: t.places.venice, at: { x: cx + 3400, y: MI.y }, desks: 'left', mpls: ['bottom', 'right', '100 Mbps'],
    devices: [['tpl-pc', 'pc', false], ['tpl-pc', 'pc', false], ['tpl-pc', 'pc', false], ['tpl-ipphone', 'tel', false], ['tpl-printer', 'prn', true]],
  });
  // Firenze, beside Bologna and a little lower, its line down on its left
  const firenze = smallBranch({
    code: 'fi', site: 103, place: t.places.florence, at: { x: cx - 2250, y: MID + 400 }, desks: 'right', mpls: ['bottom', 'left', '100 Mbps'],
    devices: [['tpl-pc', 'pc', false], ['tpl-pc', 'pc', false], ['tpl-laptop', 'lap', false], ['tpl-printer', 'prn', true]],
  });
  // Cagliari, the island on the left, its line across to the foot of the MPLS network
  const cagliari = smallBranch({
    code: 'ca', site: 107, place: 'Cagliari', at: { x: cx - 2600, y: SOUTH + 380 }, desks: 'left', mpls: ['right', 'bottom', '100 Mbps'],
    devices: [['tpl-pc', 'pc', false], ['tpl-pc', 'pc', false], ['tpl-ipphone', 'tel', false], ['tpl-printer', 'prn', true]],
  });

  // Torino, on the left of Milano: a large branch, with users, voice and
  // Wi-Fi. Its router at the top left corner, its line down on the left
  const torino = (() => {
    const place = t.places.turin;
    const TO = { x: 0, y: MI.y };
    router(d, {
      id: 'r-to', label: 'R-TO', kind: 'Router', location: place, at: TO, ip: '10.101.10.1', gateway: MILANO_MPLS, count: 8,
      ports: {
        1: served(vlanPort(t.vlans.users, 10), '10.101.10'),
        2: served(vlanPort(t.vlans.voice, 20), '10.101.20'),
        3: served(vlanPort('Wi-Fi', 30), '10.101.30'),
        4: { ...addressed('MPLS', '10.255.0.101'), portType: 'wan' },
      },
    });
    mpls({ id: 'r-to', side: 'bottom', port: 4 }, 'left', '200 Mbps');
    switchDevice(d, { id: 'sw-to-c', label: 'SW-TO-C', ip: '10.101.1.2', location: place, at: { x: TO.x + 200, y: TO.y + 260 }, vlans: rmVlans });
    d.vlanCables('r-to', 'sw-to-c', [[1, 1, 10], [2, 2, 20], [3, 3, 30]]);
    const ids = ['r-to', 'sw-to-c'];
    [0, 1].forEach((k) => {
      const sw = `sw-to-0${k + 1}`;
      const switchX = TO.x + 400 + k * 650;
      switchDevice(d, { id: sw, label: `SW-TO-0${k + 1}`, ip: `10.101.1.1${k + 1}`, location: place, at: { x: switchX, y: TO.y + 560 }, vlans: rmVlans });
      d.trunk({ id: sw, side: 'top', port: 24 }, { id: 'sw-to-c', side: 'bottom', port: 4 + k }, rmVlans, '1 Gbps');
      ids.push(sw);
      const desks = row(switchX - 225, TO.y + 780, 4);
      const kinds: Array<[string, string, number]> =
        k === 0
          ? [['tpl-pc', 'pc', 10], ['tpl-pc', 'pc', 10], ['tpl-ipphone', 'tel', 20], ['tpl-ipphone', 'tel', 20]]
          : [['tpl-pc', 'pc', 10], ['tpl-pc', 'pc', 10], ['tpl-ipphone', 'tel', 20], ['tpl-printer', 'prn', 10]];
      kinds.forEach(([template, prefix, vlan], i) => {
        const id = `${prefix}-to-${k + 1}0${i + 1}`;
        const fixed = template === 'tpl-printer';
        host(d, { id, label: id.toUpperCase(), template, location: place, at: desks[i], ...(fixed ? { ip: '10.101.10.50', gateway: '10.101.10.1' } : {}) });
        d.plug(id, sw, i + 1, vlan);
        ids.push(id);
      });
    });
    // the Wi-Fi of the branch, on the core switch
    accessPoint(d, { id: 'ap-to', label: 'AP-TO', location: place, at: { x: TO.x + 1700, y: TO.y + 560 }, ip: '10.101.30.10', gateway: '10.101.30.1', clients: 3 });
    d.link({ id: 'ap-to', side: 'top' }, { id: 'sw-to-c', side: 'right', port: 6 });
    d.port('sw-to-c', 6).vlan = 30;
    d.port('sw-to-c', 6).name = 'AP-TO';
    row(TO.x + 1550, TO.y + 780, 3).forEach((at, i) => {
      const [template, id] = i < 2 ? ['tpl-laptop', `lap-to-${i + 1}`] : ['tpl-smartphone', 'mob-to-1'];
      host(d, { id, label: id.toUpperCase(), template, location: place, at });
      d.wifi(id, 'ap-to', i + 2);
      ids.push(id);
    });
    return [...ids, 'ap-to'];
  })();

  // The south, under the MPLS network: each line runs along the top of its
  // site to the foot of the cloud. Bari highest, then Napoli, then Palermo
  // straight under the cloud, so that no line passes over another site

  // Bari: a warehouse behind a firewall. Cameras with their recorder on a
  // network of their own, sensors behind an IoT gateway, offices and tablets
  const bari = (() => {
    const place = 'Bari';
    const BA = { x: cx + 1745, y: SOUTH + 140 };
    const vlans = [10, 60, 70];
    router(d, {
      id: 'fw-ba', label: 'FW-BA', kind: 'Firewall', location: place, at: { x: BA.x + 600, y: BA.y }, ip: '10.105.10.1', gateway: MILANO_MPLS, count: 8,
      ports: {
        1: { ...addressed('MPLS', '10.255.0.105'), portType: 'wan', securityZone: 'trust' },
        2: { ...served(vlanPort(t.vlans.users, 10), '10.105.10'), securityZone: 'trust' },
        3: { ...addressed(vlanPort(t.vlans.cameras, 60), '10.105.60.1'), portType: 'dmz', securityZone: 'dmz' },
        4: { ...served(vlanPort('IoT', 70), '10.105.70'), portType: 'dmz', securityZone: 'dmz' },
      },
      rules: [
        { id: 'rule-1', action: 'deny', service: 'any', source: '10.105.60.0/24', destination: 'any', description: t.notes.camerasOnlyRecorder },
        { id: 'rule-2', action: 'allow', service: 'web', source: '10.105.70.0/24', destination: '10.10.100.80', description: t.notes.sensorsToArchive },
        { id: 'rule-3', action: 'deny', service: 'any', source: '10.105.70.0/24', destination: 'any', description: t.notes.sensorsNothingElse },
      ],
    });
    mpls({ id: 'fw-ba', side: 'left', port: 1 }, 'bottom', '100 Mbps');
    switchDevice(d, { id: 'sw-ba', label: 'SW-BA', ip: '10.105.1.2', location: place, at: { x: BA.x + 800, y: BA.y + 260 }, vlans });
    d.vlanCables('fw-ba', 'sw-ba', [[2, 1, 10], [3, 2, 60], [4, 3, 70]]);
    const ids = ['fw-ba', 'sw-ba'];
    const desks = row(BA.x, BA.y + 480, 9);
    const kinds: Array<[string, string, string, number, string?]> = [
      ['tpl-ipcamera', 'cam-ba-1', 'CAM-BA-1', 60, '10.105.60.11'],
      ['tpl-ipcamera', 'cam-ba-2', 'CAM-BA-2', 60, '10.105.60.12'],
      ['tpl-ipcamera', 'cam-ba-3', 'CAM-BA-3', 60, '10.105.60.13'],
      ['tpl-nas', 'nvr-ba', 'NVR-BA', 60, '10.105.60.10'],
      ['tpl-pc', 'pc-ba-1', 'PC-BA-1', 10],
      ['tpl-pc', 'pc-ba-2', 'PC-BA-2', 10],
      ['tpl-printer', 'prn-ba', 'PRN-BA', 10, '10.105.10.50'],
    ];
    kinds.forEach(([template, id, label, vlan, ip], i) => {
      const network = ip ? ip.split('.').slice(0, 3).join('.') : '';
      host(d, { id, label, template, type: template === 'tpl-nas' ? 'Database' : 'PC', location: place, at: desks[i], ...(ip ? { ip, gateway: `${network}.1` } : {}) });
      d.plug(id, 'sw-ba', i + 4, vlan);
      ids.push(id);
    });
    accessPoint(d, { id: 'ap-ba', label: 'AP-BA', location: place, at: desks[7], ip: '10.105.10.10', gateway: '10.105.10.1', clients: 2 });
    d.plug('ap-ba', 'sw-ba', 11, 10);
    accessPoint(d, { id: 'iot-ba', label: 'IOT-GW-BA', template: 'tpl-iotgateway', location: place, at: desks[8], ip: '10.105.70.10', gateway: '10.105.70.1', clients: 0 });
    d.plug('iot-ba', 'sw-ba', 12, 70);
    row(desks[7].x - 75, BA.y + 700, 2).forEach((at, i) => {
      const id = `tab-ba-${i + 1}`;
      host(d, { id, label: id.toUpperCase(), template: 'tpl-tablet', location: place, at });
      d.wifi(id, 'ap-ba', i + 2);
      ids.push(id);
    });
    return [...ids, 'ap-ba', 'iot-ba'];
  })();

  // Napoli: users and voice, a few on Wi-Fi
  const napoli = (() => {
    const place = t.places.naples;
    const NA = { x: cx + 340, y: SOUTH + 290 };
    const vlans = [10, 20];
    router(d, {
      id: 'r-na', label: 'R-NA', kind: 'Router', location: place, at: { x: NA.x + 525, y: NA.y }, ip: '10.104.10.1', gateway: MILANO_MPLS, count: 4,
      ports: {
        1: served(vlanPort(t.vlans.users, 10), '10.104.10'),
        2: served(vlanPort(t.vlans.voice, 20), '10.104.20'),
        3: { ...addressed('MPLS', '10.255.0.104'), portType: 'wan' },
      },
    });
    mpls({ id: 'r-na', side: 'left', port: 3 }, 'bottom', '100 Mbps');
    switchDevice(d, { id: 'sw-na', label: 'SW-NA', ip: '10.104.1.2', location: place, at: { x: NA.x + 725, y: NA.y + 260 }, vlans });
    d.vlanCables('r-na', 'sw-na', [[1, 1, 10], [2, 2, 20]]);
    const ids = ['r-na', 'sw-na'];
    const desks = row(NA.x, NA.y + 480, 8);
    const kinds: Array<[string, string, number]> = [
      ['tpl-pc', 'pc', 10], ['tpl-pc', 'pc', 10], ['tpl-pc', 'pc', 10], ['tpl-pc', 'pc', 10],
      ['tpl-ipphone', 'tel', 20], ['tpl-ipphone', 'tel', 20], ['tpl-printer', 'prn', 10],
    ];
    const counts: Record<string, number> = {};
    kinds.forEach(([template, prefix, vlan], i) => {
      counts[prefix] = (counts[prefix] ?? 0) + 1;
      const id = `${prefix}-na-${counts[prefix]}`;
      host(d, { id, label: id.toUpperCase(), template, location: place, at: desks[i], ...(template === 'tpl-printer' ? { ip: '10.104.10.50', gateway: '10.104.10.1' } : {}) });
      d.plug(id, 'sw-na', i + 3, vlan);
      ids.push(id);
    });
    accessPoint(d, { id: 'ap-na', label: 'AP-NA', location: place, at: desks[7], ip: '10.104.10.10', gateway: '10.104.10.1', clients: 2 });
    d.plug('ap-na', 'sw-na', 10, 10);
    row(desks[7].x - 75, NA.y + 700, 2).forEach((at, i) => {
      const id = `lap-na-${i + 1}`;
      host(d, { id, label: id.toUpperCase(), template: 'tpl-laptop', location: place, at });
      d.wifi(id, 'ap-na', i + 2);
      ids.push(id);
    });
    return [...ids, 'ap-na'];
  })();

  // Palermo: a shop behind a firewall, straight under the MPLS network. The
  // tills reach their server in Milano and nothing else; the guests' Wi-Fi
  // goes out to the Internet, never inside
  const palermo = (() => {
    const place = 'Palermo';
    const PA = { x: cx - 52, y: SOUTH + 500 };
    const vlans = [10, 40, 80];
    router(d, {
      id: 'fw-pa', label: 'FW-PA', kind: 'Firewall', location: place, at: PA, ip: '10.106.10.1', gateway: MILANO_MPLS, count: 8,
      ports: {
        1: { ...addressed('MPLS', '10.255.0.106'), portType: 'wan', securityZone: 'trust' },
        2: { ...served(t.ports.shop, '10.106.10'), securityZone: 'trust' },
        3: { ...served(vlanPort(t.vlans.tills, 80), '10.106.80'), securityZone: 'trust' },
        4: { ...served(vlanPort(t.vlans.guests, 40), '10.250.106', '172.16.10.53'), securityZone: 'untrust' },
      },
      rules: [
        { id: 'rule-1', action: 'allow', service: 'web', source: '10.106.80.0/24', destination: '10.10.100.40', description: t.notes.tillsToServer },
        { id: 'rule-2', action: 'deny', service: 'any', source: '10.106.80.0/24', destination: 'any', description: t.notes.tillsNothingElse },
        { id: 'rule-3', action: 'deny', service: 'any', source: '10.250.106.0/24', destination: '10.0.0.0/8', description: t.notes.guestsNeverInside },
        { id: 'rule-4', action: 'allow', service: 'any', source: '10.250.106.0/24', destination: 'any', description: t.notes.guestsOut },
      ],
    });
    mpls({ id: 'fw-pa', side: 'top', port: 1 }, 'bottom', '100 Mbps');
    // (the switch on the left of the firewall, the shop under it: Napoli is on the right)
    switchDevice(d, { id: 'sw-pa', label: 'SW-PA', ip: '10.106.1.2', location: place, at: { x: PA.x - 200, y: PA.y + 260 }, vlans });
    d.vlanCables('fw-pa', 'sw-pa', [[2, 1, 10], [3, 2, 80], [4, 3, 40]]);
    const ids = ['fw-pa', 'sw-pa'];
    const desks = row(PA.x - 1098, PA.y + 480, 9);
    const kinds: Array<[string, string, number]> = [
      ['tpl-pc', 'pos-pa-1', 80],
      ['tpl-pc', 'pos-pa-2', 80],
      ['tpl-pc', 'pos-pa-3', 80],
      ['tpl-printer', 'prn-pa', 80],
      ['tpl-pc', 'pc-pa-1', 10],
      ['tpl-tablet', 'tab-pa-1', 10],
    ];
    kinds.forEach(([template, id, vlan], i) => {
      const fixed = template === 'tpl-printer';
      host(d, { id, label: id.toUpperCase(), template, location: place, at: desks[i], ...(fixed ? { ip: '10.106.80.50', gateway: '10.106.80.1' } : {}) });
      d.plug(id, 'sw-pa', i + 4, vlan);
      ids.push(id);
    });
    accessPoint(d, { id: 'ap-pa-guests', label: 'AP-PA-OSP', location: place, at: desks[7], ip: '10.250.106.10', gateway: '10.250.106.1', clients: 2 });
    d.plug('ap-pa-guests', 'sw-pa', 10, 40);
    row(desks[7].x - 75, PA.y + 700, 2).forEach((at, i) => {
      const id = `guest-pa-${i + 1}`;
      host(d, { id, label: t.devices.guest('PA', i + 1), template: 'tpl-smartphone', location: place, at });
      d.wifi(id, 'ap-pa-guests', i + 2);
      ids.push(id);
    });
    return [...ids, 'ap-pa-guests'];
  })();

  // ── What the project is set to with this network ───────────────────────
  const settings = sampleSettings({
    network: '10.10.10.0',
    gateway: '10.10.10.1',
    dns: DNS_1,
    vlans: [
      { id: 1, name: t.vlans.default },
      { id: 10, name: t.vlans.users },
      { id: 20, name: t.vlans.voice },
      { id: 30, name: 'Wi-Fi' },
      { id: 40, name: t.vlans.guests },
      { id: 60, name: t.vlans.cameras },
      { id: 70, name: 'IoT' },
      { id: 80, name: t.vlans.tills },
    ],
  });

  // ── The areas: one for each site; Milano's holds its floors, its server
  //    room and its DMZ ───────────────────────────────────────────────────
  const groups: SampleGroup[] = [
    { label: 'Internet', color: 'slate', devices: ['customer', 'inet-a', 'inet-b', 'remote-worker'] },
    { label: 'DMZ', color: 'green', devices: ['sw-mi-dmz', 'lb-mi', 'dns-pub', 'vpn-gw', 'proxy', 'www-1', 'www-2'] },
    { label: t.areas.serverRoom, color: 'violet', devices: ['sw-mi-dc', ...servers.map(([id]) => id)] },
    ...floors.map((ids, i) => ({ label: t.areas.floor(i + 1), color: 'teal' as const, devices: ids })),
    {
      label: t.sites.milan,
      color: 'amber',
      devices: ['fw-mi', 'r-mi', 'sw-mi-c1', 'sw-mi-c2', 'r-mi-wan'],
      areas: ['DMZ', t.areas.serverRoom, ...floors.map((_, i) => t.areas.floor(i + 1))],
    },
    { label: t.sites.rome, color: 'amber', devices: ['r-rm', 'sw-rm-c', 'dhcp-rm', 'file-rm', ...romeFloors.flat()] },
    { label: t.sites.disasterRecovery, color: 'violet', devices: ['r-dr', 'sw-dr', ...drServers.map(([id]) => id)] },
    { label: t.sites.turin, color: 'slate', devices: torino },
    { label: t.sites.venice, color: 'slate', devices: venezia },
    { label: t.sites.florence, color: 'slate', devices: firenze },
    { label: t.sites.naples, color: 'slate', devices: napoli },
    { label: t.sites.bari, color: 'red', devices: bari },
    { label: t.sites.palermo, color: 'red', devices: palermo },
    { label: t.sites.cagliari, color: 'slate', devices: cagliari },
  ];
  const areas = areasAround(groups, d.devices);

  return { devices: d.devices, connections: d.connections, settings, areas };
}
