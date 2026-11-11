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
  mac?: string;            // MAC address (auto-generated or custom)
  description?: string;    // Notes/comments
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
  // Router-specific fields
  nat?: boolean;           // NAT enabled/disabled (router only)
  // Firewall-specific fields
  securityZone?: 'trust' | 'untrust' | 'dmz'; // Security zone assignment (firewall only)
  ips?: boolean;           // IPS/IDS enabled (firewall only)
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
  // React Flow position
  position: { x: number; y: number };
  // Network Advanced Config
  vlan?: number[]; // VLAN IDs (es. [10, 20, 30])
  stp?: {
    enabled: boolean;
    mode?: 'STP' | 'RSTP' | 'PVST+' | 'MST';
    priority?: number; // Bridge priority (0-65535, step 4096, default 32768)
  };
  // Port Management (Switch, Router, Firewall)
  portCount?: number; // Total number of ports (5, 8, 16, 24, 48)
  ports?: Port[]; // Per-port configuration
  // Network Interface Cards (PC, Server, Database, Cloud, etc.)
  nics?: NetworkInterfaceCard[]; // Network interfaces (replaces single ip/subnet/gateway)
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
  bandwidth?: string; // e.g., "1Gbps", "100Mbps"
  vlan?: number[]; // VLAN IDs (for future network logic)
  label?: string; // Custom label
  color?: string; // Custom color override
  // STP Port Configuration
  stpPortState?: 'forwarding' | 'blocking' | 'disabled' | 'learning';
  stpPortPriority?: number; // Port priority (0-240, step 16)
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
 * Global Network Settings
 */
export interface GlobalNetworkSettings {
  ipClass: string; // e.g., "192.168.1.0"
  subnet: string; // e.g., "255.255.255.0"
  gateway: string; // e.g., "192.168.1.1"
  emailMode?: EmailMode; // default 'auto'
}

/**
 * Device Template
 * Template for creating device types with custom icons and fields
 */
export interface DeviceTemplate {
  id: string;
  name: string;
  type: DeviceType;
  icon: string; // Iconify icon name
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
  description?: string; // Italian description for UI
  color: string; // Hex color (e.g., "#9333ea")
  lineStyle: 'solid' | 'dashed' | 'dotted'; // Visual line style
  strokeWidth: number; // Base stroke width (e.g., 2.5, 3, 4)
  strokeWidthHighlighted?: number; // Optional: width when highlighted
  strokeDasharray?: string; // SVG dash pattern (e.g., "8 4", "1 5")
  isCustom: boolean; // Distinguishes default from user-created
}

/**
 * Device Icon Mapping (DEPRECATED)
 * Icons are now managed through templateStore
 * Kept for backward compatibility only
 */
export const DEVICE_ICONS: Record<string, string> = {
  PC: 'solar:monitor-bold-duotone',
  Switch: 'carbon:network-4',
  Router: 'mdi:router-network',
  Server: 'mdi:server',
  Firewall: 'mdi:shield-network',
  AccessPoint: 'mdi:access-point',
  LoadBalancer: 'mdi:scale-balance',
  Database: 'mdi:database',
  Cloud: 'mdi:cloud',
};

/**
 * Flow Model Colors for packet animation
 */
export const FLOW_MODEL_COLORS: Record<FlowModelType, string> = {
  ping: '#00f7ff', // Cyan
  email: '#f7ff00', // Yellow
  web: '#28a745', // Green
  download: '#ff4500', // Orange
};
