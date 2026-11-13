/**
 * YAML Import Utility
 * Parses PixelCake YAML topology files into NetworkDevice[] and NetworkConnection[]
 */

import YAML from 'yaml';
import type {
  DhcpPool,
  FirewallRule,
  NetworkDevice,
  NetworkConnection,
  Port,
  PortForward,
  NetworkInterfaceCard,
  StaticRoute,
} from '@/types';
import type { ConnectionBinding, ConnectionEnd } from '@/engine/interfaces';

export interface ImportResult {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  warnings: string[];
}

/** Validate IP address format (basic check) */
function isValidIP(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/**
 * The DHCP server of an interface (`dhcp_server`: `start`, `end` and, when
 * one is handed out, `gateway`). Without both ends of the range it is left
 * out with a warning. `where` names the interface: `Port 2`, `FW: eth0`.
 */
function parsePool(value: unknown, where: string, warnings: string[]): DhcpPool | undefined {
  if (value === undefined || value === null) return undefined;
  const data = typeof value === 'object' ? (value as Record<string, unknown>) : {};
  // String(): YAML reads a bare number where an address was mistyped
  const start = data.start === undefined || data.start === null ? '' : String(data.start);
  const end = data.end === undefined || data.end === null ? '' : String(data.end);
  if (!start || !end) {
    warnings.push(`${where}: server DHCP senza primo o ultimo indirizzo, ignorato`);
    return undefined;
  }
  const pool: DhcpPool = { start, end };
  if (data.gateway !== undefined && data.gateway !== null && data.gateway !== '') {
    pool.gateway = String(data.gateway);
  }
  return pool;
}

/** Parse a port from YAML data */
function parsePort(data: Record<string, unknown>, warnings: string[]): Port {
  const port: Port = {
    id: typeof data.id === 'number' ? data.id : 1,
    enabled: data.enabled !== false,
  };

  if (typeof data.name === 'string') port.name = data.name;
  if (typeof data.ip === 'string' && data.ip) {
    if (!isValidIP(data.ip)) warnings.push(`Port ${port.id}: IP "${data.ip}" non valido`);
    port.ip = data.ip;
  }
  if (typeof data.subnet === 'string' && data.subnet) port.subnet = data.subnet;
  if (typeof data.speed === 'string') port.speed = data.speed as Port['speed'];
  if (typeof data.mode === 'string') port.portType = data.mode as Port['portType'];
  if (typeof data.poe === 'boolean') port.poe = data.poe;
  if (typeof data.nat === 'boolean') port.nat = data.nat;
  const pool = parsePool(data.dhcp_server, `Port ${port.id}`, warnings);
  if (pool) port.dhcpServer = pool;
  if (typeof data.security_zone === 'string') port.securityZone = data.security_zone as Port['securityZone'];
  if (typeof data.ips === 'boolean') port.ips = data.ips;
  if (typeof data.description === 'string') port.description = data.description;

  // VLAN - can be number or array
  if (typeof data.vlan === 'number') {
    port.vlan = data.vlan;
  } else if (Array.isArray(data.vlan)) {
    const vlans = data.vlan.filter((v): v is number => typeof v === 'number');
    const invalid = vlans.some((v) => v < 1 || v > 4094);
    if (invalid) warnings.push(`Port ${port.id}: VLAN fuori range (1-4094)`);
    port.vlan = vlans;
  }

  return port;
}

/**
 * Parse a NIC from YAML data. A card with `dhcp: true` takes its address
 * from a DHCP server: whatever address the file writes next to it is not
 * read, and neither is a `dhcp_server` (a card cannot do both).
 */
function parseNic(
  data: Record<string, unknown>,
  index: number,
  deviceName: string,
  warnings: string[]
): NetworkInterfaceCard {
  const name = typeof data.name === 'string' ? data.name : `eth${index}`;
  const automatic = data.dhcp === true;
  const nic: NetworkInterfaceCard = {
    id: `nic-${index + 1}`,
    name,
    enabled: data.enabled !== false,
    speed: (typeof data.speed === 'string' ? data.speed : 'auto') as NetworkInterfaceCard['speed'],
    ip: !automatic && typeof data.ip === 'string' ? data.ip : '',
    subnet: !automatic && typeof data.subnet === 'string' ? data.subnet : '',
    gateway: !automatic && typeof data.gateway === 'string' ? data.gateway : '',
    mac: typeof data.mac === 'string' ? data.mac : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
  };
  if (automatic) {
    nic.dhcp = true;
    return nic;
  }
  const pool = parsePool(data.dhcp_server, `${deviceName}: ${name}`, warnings);
  if (pool) nic.dhcpServer = pool;
  return nic;
}

/**
 * Static routes of a device (`destination` + `via`). An entry without both is
 * left out with a warning.
 */
function parseRoutes(list: unknown[], deviceName: string, warnings: string[]): StaticRoute[] {
  const routes: StaticRoute[] = [];
  list.forEach((raw, index) => {
    const data = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    // String(): YAML reads a bare number where an address was mistyped
    const destination = data.destination === undefined ? '' : String(data.destination);
    const nextHop = data.via === undefined ? '' : String(data.via);
    if (!destination || !nextHop) {
      warnings.push(`${deviceName}: rotta ${index + 1} senza destinazione o prossimo salto, ignorata`);
      return;
    }
    const route: StaticRoute = { id: `route-${routes.length + 1}`, destination, nextHop };
    if (typeof data.description === 'string') route.description = data.description;
    routes.push(route);
  });
  return routes;
}

const RULE_SERVICES: readonly FirewallRule['service'][] = ['any', 'ping', 'web', 'email'];

/**
 * Port forwards of a device, in file order. A forward that is not complete
 * is left out with a warning: the order of the others is kept.
 */
function parseForwards(list: unknown[], deviceName: string, warnings: string[]): PortForward[] {
  const forwards: PortForward[] = [];
  list.forEach((raw, index) => {
    const data = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const service = RULE_SERVICES.find((name) => name === (data.service ?? 'any'));
    const port = typeof data.interface === 'number' ? data.interface : Number.NaN;
    const to = data.to === undefined ? '' : String(data.to);
    if (!service || !Number.isInteger(port) || !to) {
      warnings.push(`${deviceName}: inoltro ${index + 1} incompleto o non valido, ignorato`);
      return;
    }
    const forward: PortForward = { id: `forward-${forwards.length + 1}`, service, port, to };
    if (data.enabled === false) forward.enabled = false;
    if (typeof data.description === 'string') forward.description = data.description;
    forwards.push(forward);
  });
  return forwards;
}

/**
 * Firewall rules of a device, in file order. A rule that is not complete is
 * left out with a warning: the order of the others is kept.
 */
function parseRules(list: unknown[], deviceName: string, warnings: string[]): FirewallRule[] {
  const rules: FirewallRule[] = [];
  list.forEach((raw, index) => {
    const data = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const action = data.action;
    const service = RULE_SERVICES.find((name) => name === (data.service ?? 'any'));
    const source = data.from === undefined ? '' : String(data.from);
    const destination = data.to === undefined ? '' : String(data.to);
    if ((action !== 'allow' && action !== 'deny') || !service || !source || !destination) {
      warnings.push(`${deviceName}: regola ${index + 1} incompleta o non valida, ignorata`);
      return;
    }
    const rule: FirewallRule = { id: `rule-${rules.length + 1}`, action, service, source, destination };
    if (data.enabled === false) rule.enabled = false;
    if (typeof data.description === 'string') rule.description = data.description;
    rules.push(rule);
  });
  return rules;
}

/**
 * Resolve the interface binding of one connection end (`source_port: 3` or
 * `source_nic: eth0`, the NIC name) against the imported device. A binding
 * that points at a port/NIC the device does not have, or at an interface
 * another connection of the file already uses, produces a warning and leaves
 * the end unbound (it is then bound to a free interface on load, like any
 * end of a file without bindings).
 * `claimed` collects `deviceId|interface` keys across the whole file.
 */
function parseBinding(
  raw: Record<string, unknown>,
  end: ConnectionEnd,
  device: NetworkDevice,
  connectionNumber: number,
  claimed: Set<string>,
  warnings: string[],
): Partial<ConnectionBinding> {
  const where = `Connessione ${connectionNumber}`;
  const unbound = 'estremità non assegnata';
  const portValue = raw[`${end}_port`];
  const nicValue = raw[`${end}_nic`];

  if (portValue !== undefined && portValue !== null) {
    const port = device.ports?.find((p) => p.id === portValue);
    if (!port) {
      warnings.push(`${where}: porta ${String(portValue)} non trovata su "${device.label}", ${unbound}`);
      return {};
    }
    const key = `${device.id}|port:${port.id}`;
    if (claimed.has(key)) {
      warnings.push(`${where}: porta ${port.id} di "${device.label}" già usata da un'altra connessione, ${unbound}`);
      return {};
    }
    claimed.add(key);
    return end === 'source' ? { sourcePort: port.id } : { targetPort: port.id };
  }

  if (nicValue !== undefined && nicValue !== null) {
    // String(): a NIC named "1" comes back from YAML as the number 1
    const nic = device.nics?.find((n) => n.name === String(nicValue));
    if (!nic) {
      warnings.push(`${where}: interfaccia "${String(nicValue)}" non trovata su "${device.label}", ${unbound}`);
      return {};
    }
    const key = `${device.id}|nic:${nic.id}`;
    if (claimed.has(key)) {
      warnings.push(`${where}: interfaccia "${nic.name}" di "${device.label}" già usata da un'altra connessione, ${unbound}`);
      return {};
    }
    claimed.add(key);
    return end === 'source' ? { sourceNic: nic.id } : { targetNic: nic.id };
  }

  return {};
}

/** Calculate grid positions for imported devices */
function calculatePositions(count: number): { x: number; y: number }[] {
  const cols = Math.ceil(Math.sqrt(count));
  const spacingX = 250;
  const spacingY = 200;
  const startX = 100;
  const startY = 100;

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: startX + col * spacingX,
      y: startY + row * spacingY,
    });
  }
  return positions;
}

/**
 * Parse a PixelCake YAML topology file
 */
export function parseYamlTopology(content: string): ImportResult {
  const warnings: string[] = [];
  const devices: NetworkDevice[] = [];
  const connections: NetworkConnection[] = [];

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
    return { devices: [], connections: [], warnings: [`Errore parsing YAML: ${msg}`] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { devices: [], connections: [], warnings: ['Il file YAML non contiene dati validi'] };
  }

  // Extract root — support both { pixelcake: { ... } } and flat { devices: [...] }
  const root = (parsed as Record<string, unknown>).pixelcake || parsed;
  if (typeof root !== 'object' || root === null) {
    return { devices: [], connections: [], warnings: ['Struttura YAML non riconosciuta'] };
  }

  const data = root as Record<string, unknown>;

  // Parse devices
  const rawDevices = Array.isArray(data.devices) ? data.devices : [];
  if (rawDevices.length === 0) {
    warnings.push('Nessun dispositivo trovato nel file');
  }

  const positions = calculatePositions(rawDevices.length);
  const nameToId = new Map<string, string>();

  for (let i = 0; i < rawDevices.length; i++) {
    const raw = rawDevices[i];
    if (!raw || typeof raw !== 'object') {
      warnings.push(`Dispositivo ${i + 1}: formato non valido, ignorato`);
      continue;
    }

    const d = raw as Record<string, unknown>;
    const name = typeof d.name === 'string' ? d.name : `Device-${i + 1}`;
    const type = typeof d.type === 'string' ? d.type : 'PC';
    const id = `dev-${i}`;

    // Validate IP if present
    if (typeof d.ip === 'string' && d.ip && !isValidIP(d.ip)) {
      warnings.push(`${name}: IP "${d.ip}" non valido`);
    }

    const device: NetworkDevice = {
      id,
      type,
      label: name,
      ip: typeof d.ip === 'string' ? d.ip : '',
      subnet: typeof d.subnet === 'string' ? d.subnet : '',
      gateway: typeof d.gateway === 'string' ? d.gateway : '',
      position: positions[i],
    };

    if (typeof d.template_id === 'string' && d.template_id) device.templateId = d.template_id;
    if (typeof d.vendor === 'string') device.vendor = d.vendor;
    if (typeof d.location === 'string') device.location = d.location;

    // VLAN
    if (Array.isArray(d.vlan)) {
      device.vlan = d.vlan.filter((v): v is number => typeof v === 'number');
    }

    // STP
    if (d.stp && typeof d.stp === 'object') {
      const stp = d.stp as Record<string, unknown>;
      device.stp = {
        enabled: stp.enabled !== false,
        mode: typeof stp.mode === 'string' ? stp.mode as NonNullable<NetworkDevice['stp']>['mode'] : undefined,
        priority: typeof stp.priority === 'number' ? stp.priority : undefined,
      };
    }

    // Ports
    if (Array.isArray(d.ports)) {
      device.ports = d.ports
        .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
        .map((p) => parsePort(p, warnings));
      device.portCount = device.ports.length;
    }

    // NICs
    if (Array.isArray(d.nics)) {
      device.nics = d.nics
        .filter((n): n is Record<string, unknown> => n !== null && typeof n === 'object')
        .map((n, idx) => parseNic(n, idx, name, warnings));
      // A first card on DHCP: the device has no addressing of its own
      if (device.nics[0]?.dhcp) {
        device.ip = '';
        device.subnet = '';
        device.gateway = '';
      }
    }

    // Static routes, firewall rules and port forwards
    if (Array.isArray(d.port_forwards)) {
      const forwards = parseForwards(d.port_forwards, name, warnings);
      if (forwards.length > 0) device.portForwards = forwards;
    }
    if (Array.isArray(d.routes)) {
      const routes = parseRoutes(d.routes, name, warnings);
      if (routes.length > 0) device.routes = routes;
    }
    if (Array.isArray(d.firewall_rules)) {
      const rules = parseRules(d.firewall_rules, name, warnings);
      if (rules.length > 0) device.firewallRules = rules;
    }

    devices.push(device);
    nameToId.set(name, id);
  }

  // Parse connections
  const rawConnections = Array.isArray(data.connections) ? data.connections : [];
  const devicesById = new Map(devices.map((d) => [d.id, d] as const));
  const claimedInterfaces = new Set<string>();

  for (let i = 0; i < rawConnections.length; i++) {
    const raw = rawConnections[i];
    if (!raw || typeof raw !== 'object') {
      warnings.push(`Connessione ${i + 1}: formato non valido, ignorata`);
      continue;
    }

    const c = raw as Record<string, unknown>;
    const sourceName = typeof c.source === 'string' ? c.source : '';
    const targetName = typeof c.target === 'string' ? c.target : '';

    const sourceId = nameToId.get(sourceName);
    const targetId = nameToId.get(targetName);

    if (!sourceId) {
      warnings.push(`Connessione ${i + 1}: sorgente "${sourceName}" non trovata`);
      continue;
    }
    if (!targetId) {
      warnings.push(`Connessione ${i + 1}: destinazione "${targetName}" non trovata`);
      continue;
    }

    const conn: NetworkConnection = {
      id: `conn-${i}`,
      source: sourceId,
      target: targetId,
    };

    // Interface bindings (optional: a file without them is bound on load)
    const sourceDevice = devicesById.get(sourceId);
    const targetDevice = devicesById.get(targetId);
    if (sourceDevice) {
      Object.assign(conn, parseBinding(c, 'source', sourceDevice, i + 1, claimedInterfaces, warnings));
    }
    if (targetDevice) {
      Object.assign(conn, parseBinding(c, 'target', targetDevice, i + 1, claimedInterfaces, warnings));
    }

    if (typeof c.type === 'string') conn.type = c.type as NetworkConnection['type'];
    if (typeof c.bandwidth === 'string') conn.bandwidth = c.bandwidth;
    if (typeof c.label === 'string') conn.label = c.label;
    if (typeof c.stp_state === 'string') conn.stpPortState = c.stp_state as NetworkConnection['stpPortState'];

    if (Array.isArray(c.vlan)) {
      conn.vlan = c.vlan.filter((v): v is number => typeof v === 'number');
    }

    connections.push(conn);
  }

  return { devices, connections, warnings };
}
