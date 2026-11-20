/**
 * Network Device Types
 * Now dynamic - any string is a valid device type
 * Device types are managed through templateStore
 */
export type DeviceType = string;

/**
 * Flow Model Types for simulation
 */
export type FlowModelType = 'ping' | 'email' | 'web' | 'download';

/**
 * DHCP server on one interface: the range of addresses it hands out to the
 * devices on the network of that interface (a router or firewall port, or a
 * card of a server). One pool per interface, as there is one network per
 * interface. The mask handed out is the one of the interface.
 */
export interface DhcpPool {
  start: string;           // First address of the range
  end: string;             // Last address of the range
  // Gateway handed out with the address. Empty: the interface's own address
  // on a router or firewall, none on a server
  gateway?: string;
  // DNS server handed out with the address (any address: it is usually on
  // another network). Empty: none
  dns?: string;
}

/**
 * One name a DNS server answers for, and the address it stands for. A name
 * is a host name with at least one dot (`www.azienda.example`), compared
 * without regard to case; a server keeps one address per name.
 */
export interface DnsRecord {
  id: string;              // Record ID (record-1, record-2...)
  name: string;            // Host name
  address: string;         // The address the name stands for
}

/**
 * Network Interface Card (NIC)
 * Represents a network interface on end devices (PC, Server, Database, Cloud, etc.)
 */
export interface NetworkInterfaceCard {
  id: string;              // NIC ID (nic-1, nic-2...)
  name: string;            // Interface name (eth0, eth1, ens192...)
  enabled: boolean;        // NIC enabled/disabled
  speed: '10M' | '100M' | '1G' | '2.5G' | '10G' | 'auto'; // Link speed
  ip: string;              // IP address
  subnet: string;          // Subnet mask
  gateway: string;         // Gateway
  // The DNS server the card asks when a name is used in place of an address.
  // Written by hand; on a card on DHCP it comes with the lease instead
  dns?: string;
  mac?: string;            // MAC address (auto-generated or custom)
  description?: string;    // Notes/comments
  // The card takes its address from a DHCP server on its network. While this
  // is on, ip/subnet/gateway/dns above are not used (and are kept empty)
  dhcp?: boolean;
  // DHCP server on this card (a server): the addresses it hands out
  dhcpServer?: DhcpPool;
}

/**
 * Port Configuration
 * Represents a single port on a network device (Switch, Router, Firewall)
 */
export interface Port {
  id: number;              // Port number (1-48)
  name?: string;           // Custom name (e.g., "Uplink to Core", "Server VLAN 10")
  enabled: boolean;        // Port enabled/disabled
  speed?: '10M' | '100M' | '1G' | '2.5G' | '10G' | 'auto'; // Link speed
  vlan?: number | number[]; // VLAN assignment (single for access, array for trunk) - Switch only
  portType?: 'access' | 'trunk' | 'wan' | 'lan' | 'dmz'; // Port mode: Switch (access/trunk) or Router/Firewall (wan/lan/dmz)
  poe?: boolean;           // PoE enabled (switch only)
  description?: string;    // Notes/comments
  // L3 address of the port (Router/Firewall): the gateway hosts on that
  // network point at. Optional: ports saved before this field have none.
  ip?: string;             // IP address
  subnet?: string;         // Subnet mask
  // Address translation (Router, Firewall): a new flow forwarded out of
  // this port leaves with the port's address instead of its own
  nat?: boolean;           // NAT enabled/disabled
  // DHCP server on this port (Router, Firewall): the addresses it hands out
  // to the devices of its network
  dhcpServer?: DhcpPool;
  // Firewall-specific fields
  securityZone?: 'trust' | 'untrust' | 'dmz'; // Security zone assignment (firewall only)
  ips?: boolean;           // IPS/IDS enabled (firewall only)
}

/**
 * Static route of a router or firewall: traffic for `destination` is handed
 * to `nextHop`, an address on one of the device's own networks.
 */
export interface StaticRoute {
  id: string;              // Route ID (route-1, route-2...)
  destination: string;     // Network in CIDR form ("192.168.30.0/24"; "0.0.0.0/0" is the default route)
  nextHop: string;         // IP address of the next router
  description?: string;    // Notes/comments
}

/**
 * What a flow is, as far as a firewall can tell:
 * ping (ICMP echo), web (HTTP/HTTPS), email (SMTP), dns (a name lookup).
 */
export type ServiceName = 'ping' | 'web' | 'email' | 'dns';

/**
 * Firewall rule. Rules are read top to bottom and the first one that matches
 * decides. `source` and `destination` are `any`, a security zone
 * (`trust` | `untrust` | `dmz`), an IP address or a network in CIDR form.
 * When no rule matches, the zone policy of the firewall decides, where it
 * knows the zone of both sides; elsewhere, and on a router (its access list,
 * no zones), what no rule allows is blocked.
 */
export interface FirewallRule {
  id: string;              // Rule ID (rule-1, rule-2...)
  action: 'allow' | 'deny';
  service: ServiceName | 'any';
  source: string;
  destination: string;
  enabled?: boolean;       // A disabled rule is skipped (default: enabled)
  description?: string;    // Notes/comments
}

/**
 * Port forward of a router or firewall (destination NAT): what arrives for
 * the address of `port`, for `service`, is sent on to `to`, an address
 * inside. It is how a server behind NAT is reached from outside. Forwards
 * are read top to bottom and the first that matches is taken.
 */
export interface PortForward {
  id: string;              // Forward ID (forward-1, forward-2...)
  service: ServiceName | 'any';
  port: number;            // The port whose address is published
  to: string;              // Address the traffic is sent on to
  enabled?: boolean;       // A disabled forward is skipped (default: enabled)
  description?: string;    // Notes/comments
}

/**
 * Network Device
 * Represents a single device in the network topology
 */
export interface NetworkDevice {
  id: string;
  type: DeviceType;
  templateId?: string; // Template ID for specific icon/name lookup (e.g., 'tpl-mailserver')
  label: string;
  ip: string;
  subnet: string;
  gateway: string;
  vendor?: string;
  location?: string;
  // Free text about the device, of one or more lines. Kept trimmed, and
  // absent when there is none (see utils/deviceNotes)
  notes?: string;
  // React Flow position
  position: { x: number; y: number };
  // Network Advanced Config
  vlan?: number[]; // VLAN IDs (es. [10, 20, 30])
  stp?: {
    enabled: boolean;
    mode?: 'STP' | 'RSTP' | 'PVST+' | 'MST';
    priority?: number; // Bridge priority (0-61440, step 4096, default 32768)
  };
  // Port Management (Switch, Router, Firewall)
  portCount?: number; // Total number of ports (5, 8, 16, 24, 48)
  ports?: Port[]; // Per-port configuration
  // Network Interface Cards (PC, Server, Database, Cloud, etc.)
  nics?: NetworkInterfaceCard[]; // Network interfaces (replaces single ip/subnet/gateway)
  // Routing (Router, Firewall): static routes on top of the networks the
  // ports are attached to. `gateway` above is the device's default route.
  routes?: StaticRoute[];
  // Filtering (Firewall): ordered rules, first match decides
  firewallRules?: FirewallRule[];
  // Address translation (Router, Firewall): services published from a port
  // to an address inside. Source NAT is a property of each port (`nat`).
  portForwards?: PortForward[];
  // Name resolution (Server): the names this device answers for as a DNS
  // server. Which server a device asks is written on its cards (`dns`).
  dnsRecords?: DnsRecord[];
}

/**
 * Connection Types for network links
 */
export type ConnectionType = 'trunk' | 'access' | 'uplink' | 'backbone';

/**
 * Network Connection (Edge)
 * Represents a connection between two devices
 */
export interface NetworkConnection {
  id: string;
  source: string; // device ID
  target: string; // device ID
  sourceHandle?: string | null; // Optional: specific handle ID on source node
  targetHandle?: string | null; // Optional: specific handle ID on target node
  // Interface binding: each end attaches to one concrete interface of its
  // device — a port (Port.id) on switches/routers/firewalls or a NIC
  // (NetworkInterfaceCard.id) on end devices. An end is "bound" when it has
  // one of the two and never has both. Optional for backward compatibility:
  // an unbound end cannot be gated by per-interface rules (enabled state,
  // security zone, port address). Maps 1:1 to the future Terraform export
  // (source_port/target_port, source_nic/target_nic attributes).
  sourcePort?: number;
  targetPort?: number;
  sourceNic?: string;
  targetNic?: string;
  // Enhanced connection metadata
  type?: ConnectionType; // Type of connection
  bandwidth?: string; // e.g., "1 Gbps", "100 Mbps"
  vlan?: number[]; // VLAN IDs (for future network logic)
  label?: string; // Custom label
  color?: string; // Custom color override
  // STP Port Configuration
  stpPortState?: 'forwarding' | 'blocking' | 'disabled' | 'learning';
  stpPortPriority?: number; // Port priority (0-240, step 16)
}

/**
 * The colours an area can have: a small palette of calm colours, each with
 * a value in the light theme and one in the dark (`--area-<name>` in
 * index.css; the exported picture repeats them).
 */
export const AREA_COLOURS = ['slate', 'green', 'amber', 'red', 'violet', 'teal'] as const;
export type AreaColour = (typeof AREA_COLOURS)[number];

/**
 * A logical area of a canvas («riquadro»): a rectangle with a short label
 * in a corner, drawn behind a group of devices to say what they are (Core,
 * Edge, Access, Internet). It is a drawing and nothing else: no device
 * belongs to it, the engine never reads it, and moving it moves no device.
 */
export interface CanvasArea {
  id: string;              // Unique within the canvas (area-1, area-2...)
  label: string;           // Short text in the corner; may be empty
  color: AreaColour;
  position: { x: number; y: number }; // Top left corner, in canvas coordinates
  size: { width: number; height: number };
}

/** What a mark of annotation mode («Modalità appunti») is: a line by hand, words, an arrow, a ring, a tick, a cross */
export const MARK_KINDS = ['pen', 'text', 'arrow', 'ellipse', 'tick', 'cross'] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

/** The colours of the marker: the accent, red, green, and the ink of the theme */
export const MARK_COLOURS = ['accent', 'red', 'green', 'ink'] as const;
export type MarkColour = (typeof MARK_COLOURS)[number];

/** How thick a mark is (for words: how large) */
export const MARK_WIDTHS = ['thin', 'thick'] as const;
export type MarkWidth = (typeof MARK_WIDTHS)[number];

/**
 * A mark written by hand on a canvas with annotation mode («Modalità appunti»): drawn
 * over the devices and the cables, in the coordinates of the canvas. Like an
 * area it is a drawing and nothing else: the engine never reads it, and it
 * does not follow a device that is moved.
 */
export interface CanvasMark {
  id: string;              // Unique within the canvas (mark-1, mark-2...)
  kind: MarkKind;
  color: MarkColour;
  width: MarkWidth;
  /**
   * Points of the canvas, flat: x, y, x, y… A line by hand is every point
   * it went through; an arrow its tail and its tip; a ring, a tick and a
   * cross the two corners of the box they are drawn in; words the point
   * their first line starts at (left, top)
   */
  points: number[];
  /** The words, for a mark of words: one line or more */
  text?: string;
  /** What the hand-drawn wobble of the mark is made from: the same seed, the same mark */
  seed: number;
}

/**
 * FlowMap Meta Information
 */
export interface FlowMapMeta {
  name: string;
  version: string;
  created?: string;
  modified?: string;
}

/**
 * FlowMap Schema
 * Main data structure for network topology
 */
export interface FlowMap {
  meta: FlowMapMeta;
  nodes: NetworkDevice[];
  edges: NetworkConnection[];
}

/**
 * Email delivery mode for the simulation
 * - internal: requires a Mail Server device in the topology
 * - cloud: SMTP hosted outside (M365/Gmail…) — email routes through the
 *   internet exit (Internet gateway / Cloud device) instead
 * - auto: internal mail server when present, cloud otherwise
 */
export type EmailMode = 'auto' | 'internal' | 'cloud';

/**
 * A VLAN of the project and the name it goes by: `10` is `Uffici`. A VLAN
 * stays a number for the engine; the name is what the interface shows next
 * to it (see utils/vlanNames).
 */
export interface ProjectVlan {
  id: number;   // VLAN number, 1-4094
  name: string; // Trimmed, never empty, 32 characters at most
}

/**
 * Global Network Settings
 */
export interface GlobalNetworkSettings {
  ipClass: string; // e.g., "192.168.1.0"
  subnet: string; // e.g., "255.255.255.0"
  gateway: string; // e.g., "192.168.1.1"
  // DNS server written on the card of a new end device (an IPv4 address).
  // Absent: new cards name no DNS server
  dns?: string;
  emailMode?: EmailMode; // default 'auto'
  // The VLANs that were given a name, lowest number first, one entry for a
  // number. Absent when none has one
  vlans?: ProjectVlan[];
}

/**
 * Device Template
 * Template for creating device types with custom icons and fields
 */
export interface DeviceTemplate {
  id: string;
  name: string;
  type: DeviceType;
  /**
   * The drawing a device of this template is shown with: the name of one of
   * the drawings of data/deviceDrawings.ts. A template made before the
   * drawings has the name of an icon here: it is shown with its own drawing
   * if the app comes with it, else with the one of its base type
   * (utils/deviceDrawing.ts)
   */
  icon: string;
  /** No longer shown: a drawing has the colours of the theme. Kept for the files that carry it */
  color: string;
  terraformFields?: Record<string, string | number | boolean>;
  isCustom: boolean;
  supportsVLAN: boolean; // Device supports VLAN configuration
  supportsSTP: boolean; // Device supports STP configuration
  supportsPorts: boolean; // Device supports port management
  supportsNICs: boolean; // Device supports Network Interface Cards (PC, Server, Database, Cloud, etc.)
  portOptions?: number[]; // Available port counts (e.g., [5, 8, 16, 24, 48])
  defaultPortCount?: number; // Default port count (e.g., 24)
}

/**
 * Connection Template
 * Template for creating connection types with custom styles
 */
export interface ConnectionTemplate {
  id: string;
  name: string; // Display name (e.g., "Trunk", "Access")
  type: string; // Unique identifier (e.g., "trunk", "access")
  description?: string; // What the type is for: shown in the language of the interface until the user rewrites it (utils/templateText.ts)
  color: string; // Hex color (e.g., "#9333ea")
  lineStyle: 'solid' | 'dashed' | 'dotted'; // Visual line style
  strokeWidth: number; // Base stroke width (e.g., 2.5, 3, 4)
  strokeWidthHighlighted?: number; // Optional: width when highlighted
  strokeDasharray?: string; // SVG dash pattern (e.g., "8 4", "1 5")
  isCustom: boolean; // Distinguishes default from user-created
}

/**
 * Flow Model Colors for packet animation
 */
export const FLOW_MODEL_COLORS: Record<FlowModelType, string> = {
  ping: '#00f7ff', // Cyan
  email: '#f7ff00', // Yellow
  web: '#28a745', // Green
  download: '#ff4500', // Orange
};
