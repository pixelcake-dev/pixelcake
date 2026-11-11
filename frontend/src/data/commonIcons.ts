/**
 * Curated list of common Iconify icons for network infrastructure devices
 * Format: collection:icon-name (e.g., "mdi:router-network")
 */

export interface IconOption {
  name: string; // Iconify icon name (e.g., "mdi:router-network")
  label: string; // Display label
  category: string; // Category for filtering
  keywords?: string[]; // Search keywords
}

export const COMMON_NETWORK_ICONS: IconOption[] = [
  // ==================== NETWORK DEVICES ====================
  {
    name: 'mdi:router-network',
    label: 'Router Network',
    category: 'Network Devices',
    keywords: ['router', 'network', 'gateway'],
  },
  {
    name: 'mdi:router-wireless',
    label: 'Wireless Router',
    category: 'Network Devices',
    keywords: ['router', 'wireless', 'wifi'],
  },
  {
    name: 'mdi:router',
    label: 'Router',
    category: 'Network Devices',
    keywords: ['router', 'basic'],
  },
  {
    name: 'carbon:network-4',
    label: 'Switch',
    category: 'Network Devices',
    keywords: ['switch', 'network'],
  },
  {
    name: 'mdi:switch',
    label: 'Switch Alt',
    category: 'Network Devices',
    keywords: ['switch', 'alternative'],
  },
  {
    name: 'mdi:shield-network',
    label: 'Firewall',
    category: 'Network Devices',
    keywords: ['firewall', 'security', 'shield'],
  },
  {
    name: 'mdi:shield-lock',
    label: 'Security Firewall',
    category: 'Network Devices',
    keywords: ['firewall', 'security', 'lock'],
  },
  {
    name: 'mdi:access-point',
    label: 'Access Point',
    category: 'Network Devices',
    keywords: ['access point', 'wifi', 'wireless'],
  },
  {
    name: 'mdi:access-point-network',
    label: 'AP Network',
    category: 'Network Devices',
    keywords: ['access point', 'network'],
  },
  {
    name: 'mdi:wifi',
    label: 'WiFi',
    category: 'Network Devices',
    keywords: ['wifi', 'wireless'],
  },
  {
    name: 'mdi:network-outline',
    label: 'Network',
    category: 'Network Devices',
    keywords: ['network', 'hub'],
  },
  {
    name: 'mdi:hub',
    label: 'Hub',
    category: 'Network Devices',
    keywords: ['hub', 'network'],
  },
  {
    name: 'mdi:lan',
    label: 'LAN',
    category: 'Network Devices',
    keywords: ['lan', 'network'],
  },
  {
    name: 'mdi:wan',
    label: 'WAN',
    category: 'Network Devices',
    keywords: ['wan', 'network'],
  },
  {
    name: 'mdi:ethernet',
    label: 'Ethernet',
    category: 'Network Devices',
    keywords: ['ethernet', 'cable'],
  },

  // ==================== SERVERS & STORAGE ====================
  {
    name: 'mdi:server',
    label: 'Server',
    category: 'Servers & Storage',
    keywords: ['server', 'rack'],
  },
  {
    name: 'mdi:server-network',
    label: 'Server Network',
    category: 'Servers & Storage',
    keywords: ['server', 'network', 'rack'],
  },
  {
    name: 'mdi:server-security',
    label: 'Server Security',
    category: 'Servers & Storage',
    keywords: ['server', 'security'],
  },
  {
    name: 'mdi:database',
    label: 'Database',
    category: 'Servers & Storage',
    keywords: ['database', 'db', 'sql'],
  },
  {
    name: 'mdi:database-outline',
    label: 'Database Outline',
    category: 'Servers & Storage',
    keywords: ['database', 'outline'],
  },
  {
    name: 'mdi:cloud',
    label: 'Cloud',
    category: 'Servers & Storage',
    keywords: ['cloud', 'storage'],
  },
  {
    name: 'mdi:cloud-outline',
    label: 'Cloud Outline',
    category: 'Servers & Storage',
    keywords: ['cloud', 'outline'],
  },
  {
    name: 'mdi:harddisk',
    label: 'Hard Disk',
    category: 'Servers & Storage',
    keywords: ['storage', 'disk', 'harddisk'],
  },
  {
    name: 'mdi:nas',
    label: 'NAS',
    category: 'Servers & Storage',
    keywords: ['nas', 'storage', 'network'],
  },
  {
    name: 'mdi:folder-network',
    label: 'Network Storage',
    category: 'Servers & Storage',
    keywords: ['storage', 'network', 'folder'],
  },
  {
    name: 'mdi:bucket',
    label: 'Storage S3',
    category: 'Servers & Storage',
    keywords: ['s3', 'bucket', 'object storage', 'minio', 'aws'],
  },
  {
    name: 'mdi:email-fast',
    label: 'Mail Server',
    category: 'Servers & Storage',
    keywords: ['mail', 'email', 'smtp', 'exchange', 'postfix'],
  },

  // ==================== END DEVICES ====================
  {
    name: 'solar:monitor-bold-duotone',
    label: 'PC Monitor',
    category: 'End Devices',
    keywords: ['pc', 'monitor', 'desktop'],
  },
  {
    name: 'mdi:monitor',
    label: 'Monitor',
    category: 'End Devices',
    keywords: ['monitor', 'display'],
  },
  {
    name: 'mdi:desktop-tower',
    label: 'Desktop Tower',
    category: 'End Devices',
    keywords: ['desktop', 'pc', 'tower'],
  },
  {
    name: 'mdi:laptop',
    label: 'Laptop',
    category: 'End Devices',
    keywords: ['laptop', 'notebook'],
  },
  {
    name: 'mdi:cellphone',
    label: 'Mobile Phone',
    category: 'End Devices',
    keywords: ['mobile', 'phone', 'smartphone'],
  },
  {
    name: 'mdi:tablet',
    label: 'Tablet',
    category: 'End Devices',
    keywords: ['tablet', 'ipad'],
  },
  {
    name: 'mdi:printer',
    label: 'Printer',
    category: 'End Devices',
    keywords: ['printer', 'print'],
  },
  {
    name: 'mdi:printer-wireless',
    label: 'Wireless Printer',
    category: 'End Devices',
    keywords: ['printer', 'wireless', 'network'],
  },
  {
    name: 'mdi:printer-3d',
    label: '3D Printer',
    category: 'End Devices',
    keywords: ['3d', 'printer'],
  },
  {
    name: 'mdi:phone',
    label: 'Phone',
    category: 'End Devices',
    keywords: ['phone', 'telephone'],
  },
  {
    name: 'mdi:cctv',
    label: 'CCTV Camera',
    category: 'End Devices',
    keywords: ['camera', 'cctv', 'security'],
  },
  {
    name: 'mdi:webcam',
    label: 'Webcam',
    category: 'End Devices',
    keywords: ['webcam', 'camera'],
  },
  {
    name: 'mdi:speaker',
    label: 'Speaker',
    category: 'End Devices',
    keywords: ['speaker', 'audio'],
  },

  // ==================== INFRASTRUCTURE ====================
  {
    name: 'mdi:scale-balance',
    label: 'Load Balancer',
    category: 'Infrastructure',
    keywords: ['load balancer', 'balance', 'scale'],
  },
  {
    name: 'mdi:chart-line',
    label: 'Analytics',
    category: 'Infrastructure',
    keywords: ['analytics', 'chart', 'monitoring'],
  },
  {
    name: 'mdi:gauge',
    label: 'Monitoring',
    category: 'Infrastructure',
    keywords: ['monitoring', 'gauge', 'metrics'],
  },
  {
    name: 'mdi:radar',
    label: 'Radar/Antenna',
    category: 'Infrastructure',
    keywords: ['radar', 'antenna', 'signal'],
  },
  {
    name: 'mdi:antenna',
    label: 'Antenna',
    category: 'Infrastructure',
    keywords: ['antenna', 'signal'],
  },
  {
    name: 'mdi:cable-data',
    label: 'Data Cable',
    category: 'Infrastructure',
    keywords: ['cable', 'data'],
  },
  {
    name: 'mdi:power-plug',
    label: 'Power',
    category: 'Infrastructure',
    keywords: ['power', 'plug', 'electricity'],
  },
  {
    name: 'mdi:rack',
    label: 'Server Rack',
    category: 'Infrastructure',
    keywords: ['rack', 'cabinet'],
  },
  {
    name: 'mdi:gate',
    label: 'Gateway',
    category: 'Infrastructure',
    keywords: ['gateway', 'gate'],
  },
  {
    name: 'mdi:vpn',
    label: 'VPN',
    category: 'Infrastructure',
    keywords: ['vpn', 'security'],
  },
  {
    name: 'mdi:dns',
    label: 'DNS',
    category: 'Infrastructure',
    keywords: ['dns', 'domain'],
  },
  {
    name: 'mdi:web',
    label: 'Web',
    category: 'Infrastructure',
    keywords: ['web', 'internet'],
  },
  {
    name: 'mdi:earth',
    label: 'Internet/Globe',
    category: 'Infrastructure',
    keywords: ['internet', 'globe', 'world'],
  },
  {
    name: 'mdi:ip',
    label: 'IP Address',
    category: 'Infrastructure',
    keywords: ['ip', 'address'],
  },
  {
    name: 'mdi:ip-network',
    label: 'IP Network',
    category: 'Infrastructure',
    keywords: ['ip', 'network'],
  },
  {
    name: 'mdi:shield-half-full',
    label: 'Proxy Server',
    category: 'Infrastructure',
    keywords: ['proxy', 'reverse proxy', 'shield', 'security'],
  },
  {
    name: 'mdi:router-wireless-settings',
    label: 'IoT Gateway',
    category: 'Infrastructure',
    keywords: ['iot', 'gateway', 'wireless', 'settings'],
  },
];
