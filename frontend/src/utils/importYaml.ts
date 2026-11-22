/**
 * YAML Import Utility
 * Parses PixelCake YAML topology files into NetworkDevice[] and NetworkConnection[]
 *
 * The warnings are for the user: they are read from the dictionary, in the
 * language of the moment the file is parsed in.
 */

import YAML, { isScalar, Scalar } from 'yaml';
import type {
  CanvasArea,
  DhcpPool,
  DnsRecord,
  FirewallRule,
  NetworkDevice,
  NetworkConnection,
  Port,
  PortForward,
  NetworkInterfaceCard,
  StaticRoute,
} from '@/types';
import type { ConnectionBinding, ConnectionEnd } from '@/engine/interfaces';
import { tidyNotes } from '@/utils/deviceNotes';
import { getT } from '@/i18n';
import { isNameTaken, newDeviceName } from '@/utils/newDevice';
import { readAreas } from '@/utils/canvasAreas';
import { isLinkDelay, isLinkLength, isLinkMedium } from '@/engine/latency';

export interface ImportResult {
  devices: NetworkDevice[];
  connections: NetworkConnection[];
  /** The areas the file draws, with the places of its devices; none when it has none */
  areas: CanvasArea[];
  warnings: string[];
}

/**
 * The keys whose value is a name: a device, and the two ends of a link. A
 * name that YAML reads as a number or as true/false (`10`, `1.50`, `true`)
 * is the text it was written as.
 */
const NAME_KEYS = new Set(['name', 'source', 'target']);

function keepNamesAsText(doc: YAML.Document.Parsed): void {
  YAML.visit(doc, {
    Pair(_key, pair) {
      if (!isScalar(pair.key) || typeof pair.key.value !== 'string' || !NAME_KEYS.has(pair.key.value)) return;
      const value = pair.value;
      if (
        isScalar(value) &&
        (typeof value.value === 'number' || typeof value.value === 'boolean') &&
        typeof value.source === 'string'
      ) {
        pair.value = new Scalar(value.source);
      }
    },
  });
}

/** The VLANs inside 1–4094, and what was outside, as the text of a warning */
function splitVlans(values: unknown[]): { valid: number[]; outside: string } {
  const numbers = values.filter((v): v is number => typeof v === 'number');
  const valid = numbers.filter((v) => Number.isInteger(v) && v >= 1 && v <= 4094);
  return { valid, outside: numbers.filter((v) => !valid.includes(v)).join(', ') };
}

/** The words of the warnings, in the language of the moment */
const words = () => getT().importExport.warnings;

/** Validate IP address format (basic check) */
function isValidIP(ip: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/**
 * The DHCP server of an interface (`dhcp_server`: `start`, `end` and, when
 * they are handed out, `gateway` and `dns`). Without both ends of the range
 * it is left out with the warning `incomplete` gives, which names the
 * interface: `Port 2`, `FW: eth0`.
 */
function parsePool(
  value: unknown,
  incomplete: () => string,
  warnings: string[]
): DhcpPool | undefined {
  if (value === undefined || value === null) return undefined;
  const data = typeof value === 'object' ? (value as Record<string, unknown>) : {};
  // String(): YAML reads a bare number where an address was mistyped
  const start = data.start === undefined || data.start === null ? '' : String(data.start);
  const end = data.end === undefined || data.end === null ? '' : String(data.end);
  if (!start || !end) {
    warnings.push(incomplete());
    return undefined;
  }
  const pool: DhcpPool = { start, end };
  if (data.gateway !== undefined && data.gateway !== null && data.gateway !== '') {
    pool.gateway = String(data.gateway);
  }
  if (data.dns !== undefined && data.dns !== null && data.dns !== '') {
    pool.dns = String(data.dns);
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
    if (!isValidIP(data.ip)) warnings.push(words().portAddressNotValid(port.id, data.ip));
    port.ip = data.ip;
  }
  if (typeof data.subnet === 'string' && data.subnet) port.subnet = data.subnet;
  if (typeof data.speed === 'string') port.speed = data.speed as Port['speed'];
  if (typeof data.mode === 'string') port.portType = data.mode as Port['portType'];
  if (typeof data.poe === 'boolean') port.poe = data.poe;
  if (typeof data.nat === 'boolean') port.nat = data.nat;
  const pool = parsePool(data.dhcp_server, () => words().portPoolIncomplete(port.id), warnings);
  if (pool) port.dhcpServer = pool;
  if (typeof data.security_zone === 'string') port.securityZone = data.security_zone as Port['securityZone'];
  if (typeof data.ips === 'boolean') port.ips = data.ips;
  if (typeof data.description === 'string') port.description = data.description;

  // VLAN - can be number or array
  // (a VLAN outside 1–4094 is left out, and the warning says so)
  if (typeof data.vlan === 'number' || Array.isArray(data.vlan)) {
    const { valid, outside } = splitVlans(Array.isArray(data.vlan) ? data.vlan : [data.vlan]);
    if (outside) warnings.push(words().portVlanOutOfRange(port.id, outside));
    if (Array.isArray(data.vlan)) {
      if (valid.length > 0 || outside === '') port.vlan = valid;
    } else if (valid.length > 0) {
      port.vlan = valid[0];
    }
  }

  return port;
}

/**
 * Parse a NIC from YAML data. A card with `dhcp: true` takes its address
 * from a DHCP server: whatever address or DNS server the file writes next to
 * it is not read, and neither is a `dhcp_server` (a card cannot do both).
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
  if (typeof data.dns === 'string' && data.dns) nic.dns = data.dns;
  const pool = parsePool(
    data.dhcp_server,
    () => words().cardPoolIncomplete(deviceName, name),
    warnings
  );
  if (pool) nic.dhcpServer = pool;
  return nic;
}

/**
 * DNS records of a device (`name` + `address`), in file order. An entry
 * without both is left out with a warning.
 */
function parseRecords(list: unknown[], deviceName: string, warnings: string[]): DnsRecord[] {
  const records: DnsRecord[] = [];
  list.forEach((raw, index) => {
    const data = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    // String(): YAML reads a bare number where an address was mistyped
    const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));
    const name = text(data.name);
    const address = text(data.address);
    if (!name || !address) {
      warnings.push(words().recordIncomplete(deviceName, index + 1));
      return;
    }
    records.push({ id: `record-${records.length + 1}`, name, address });
  });
  return records;
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
      warnings.push(words().routeIncomplete(deviceName, index + 1));
      return;
    }
    const route: StaticRoute = { id: `route-${routes.length + 1}`, destination, nextHop };
    if (typeof data.description === 'string') route.description = data.description;
    routes.push(route);
  });
  return routes;
}

const RULE_SERVICES: readonly FirewallRule['service'][] = ['any', 'ping', 'web', 'email', 'dns'];

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
      warnings.push(words().forwardNotValid(deviceName, index + 1));
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
      warnings.push(words().ruleNotValid(deviceName, index + 1));
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
  const portValue = raw[`${end}_port`];
  const nicValue = raw[`${end}_nic`];

  if (portValue !== undefined && portValue !== null) {
    const port = device.ports?.find((p) => p.id === portValue);
    if (!port) {
      warnings.push(words().portNotFound(connectionNumber, String(portValue), device.label));
      return {};
    }
    const key = `${device.id}|port:${port.id}`;
    if (claimed.has(key)) {
      warnings.push(words().portTaken(connectionNumber, port.id, device.label));
      return {};
    }
    claimed.add(key);
    return end === 'source' ? { sourcePort: port.id } : { targetPort: port.id };
  }

  if (nicValue !== undefined && nicValue !== null) {
    // String(): a NIC named "1" comes back from YAML as the number 1
    const nic = device.nics?.find((n) => n.name === String(nicValue));
    if (!nic) {
      warnings.push(words().cardNotFound(connectionNumber, String(nicValue), device.label));
      return {};
    }
    const key = `${device.id}|nic:${nic.id}`;
    if (claimed.has(key)) {
      warnings.push(words().cardTaken(connectionNumber, nic.name, device.label));
      return {};
    }
    claimed.add(key);
    return end === 'source' ? { sourceNic: nic.id } : { targetNic: nic.id };
  }

  return {};
}

/** Where the file says a device is drawn (`position: {x, y}`), when it says it */
function placeOf(value: unknown): { x: number; y: number } | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const { x, y } = value as Record<string, unknown>;
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : undefined;
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
    const doc = YAML.parseDocument(content);
    if (doc.errors.length > 0) throw doc.errors[0];
    keepNamesAsText(doc);
    parsed = doc.toJS();
  } catch (e) {
    const reason = e instanceof Error ? e.message : undefined;
    return { devices: [], connections: [], areas: [], warnings: [words().yamlError(reason)] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { devices: [], connections: [], areas: [], warnings: [words().noData] };
  }

  // Extract root — support both { pixelcake: { ... } } and flat { devices: [...] }
  const root = (parsed as Record<string, unknown>).pixelcake || parsed;
  if (typeof root !== 'object' || root === null) {
    return { devices: [], connections: [], areas: [], warnings: [words().unknownStructure] };
  }

  const data = root as Record<string, unknown>;

  // Parse devices
  const rawDevices = Array.isArray(data.devices) ? data.devices : [];
  if (rawDevices.length === 0) {
    warnings.push(words().noDevices);
  }

  const positions = calculatePositions(rawDevices.length);
  // The devices as the file names them, to find the one a link names: the
  // first that has the name (the others of that name were renamed)
  const declared: { id: string; name: string }[] = [];
  // The name each entry asks for, to give a repeated one a name no later entry has
  const askedNames = rawDevices.map((raw, index) =>
    raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).name === 'string'
      ? ((raw as Record<string, unknown>).name as string)
      : `Device-${index + 1}`
  );
  const renamed: string[] = [];

  for (let i = 0; i < rawDevices.length; i++) {
    const raw = rawDevices[i];
    if (!raw || typeof raw !== 'object') {
      warnings.push(words().deviceNotValid(i + 1));
      continue;
    }

    const d = raw as Record<string, unknown>;
    const asked = askedNames[i];
    // A name already taken (as the terminal compares names) goes to the first
    // device that has it; this one gets the first free name of the app's rule
    const name = isNameTaken(asked, devices)
      ? newDeviceName(asked, [
          ...devices,
          ...askedNames.slice(i + 1).map((label) => ({ label })),
        ])
      : asked;
    if (name !== asked) renamed.push(`“${asked}” → “${name}”`);
    const type = typeof d.type === 'string' ? d.type : 'PC';
    const id = `dev-${i}`;

    // Validate IP if present
    if (typeof d.ip === 'string' && d.ip && !isValidIP(d.ip)) {
      warnings.push(words().deviceAddressNotValid(name, d.ip));
    }

    const device: NetworkDevice = {
      id,
      type,
      label: name,
      ip: typeof d.ip === 'string' ? d.ip : '',
      subnet: typeof d.subnet === 'string' ? d.subnet : '',
      gateway: typeof d.gateway === 'string' ? d.gateway : '',
      position: placeOf(d.position) ?? positions[i],
    };

    if (typeof d.template_id === 'string' && d.template_id) device.templateId = d.template_id;
    if (typeof d.vendor === 'string') device.vendor = d.vendor;
    if (typeof d.location === 'string') device.location = d.location;
    // (a note of digits alone comes back from YAML as a number when its quotes were taken away)
    const notes = tidyNotes(typeof d.notes === 'number' ? String(d.notes) : d.notes);
    if (notes) device.notes = notes;

    // VLAN (those outside 1–4094 are left out, and the warning says so)
    if (Array.isArray(d.vlan)) {
      const { valid, outside } = splitVlans(d.vlan);
      if (outside) warnings.push(words().deviceVlanOutOfRange(name, outside));
      device.vlan = valid;
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

    // Static routes, firewall rules, port forwards and DNS records
    if (Array.isArray(d.dns_records)) {
      const records = parseRecords(d.dns_records, name, warnings);
      if (records.length > 0) device.dnsRecords = records;
    }
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
    declared.push({ id, name: asked });
  }
  if (renamed.length > 0) warnings.push(words().namesRepeated(renamed.join(', ')));

  /** The device a link names: the first one of the file that had this name */
  const findByName = (name: string): string | undefined =>
    declared.find((entry) => isNameTaken(name, [{ id: entry.id, label: entry.name }]))?.id;

  // Parse connections
  const rawConnections = Array.isArray(data.connections) ? data.connections : [];
  const devicesById = new Map(devices.map((d) => [d.id, d] as const));
  const claimedInterfaces = new Set<string>();

  for (let i = 0; i < rawConnections.length; i++) {
    const raw = rawConnections[i];
    if (!raw || typeof raw !== 'object') {
      warnings.push(words().connectionNotValid(i + 1));
      continue;
    }

    const c = raw as Record<string, unknown>;
    const sourceName = typeof c.source === 'string' ? c.source : '';
    const targetName = typeof c.target === 'string' ? c.target : '';

    const sourceId = findByName(sourceName);
    const targetId = findByName(targetName);

    if (!sourceId) {
      warnings.push(words().sourceNotFound(i + 1, sourceName));
      continue;
    }
    if (!targetId) {
      warnings.push(words().targetNotFound(i + 1, targetName));
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
    // The cable: a value the engine could not read is left out, and said
    for (const [key, field, isReadable] of [
      ['medium', 'medium', isLinkMedium],
      ['length_m', 'lengthM', isLinkLength],
      ['delay_ms', 'delayMs', isLinkDelay],
    ] as const) {
      const value = c[key];
      if (value === undefined || value === null) continue;
      if (isReadable(value)) Object.assign(conn, { [field]: value });
      else warnings.push(words().connectionCableNotValid(i + 1, key, String(value)));
    }

    if (Array.isArray(c.vlan)) {
      const { valid, outside } = splitVlans(c.vlan);
      if (outside) warnings.push(words().connectionVlanOutOfRange(i + 1, outside));
      conn.vlan = valid;
    }

    connections.push(conn);
  }

  // Areas: one that cannot be drawn is left out, with a warning
  const drawable: unknown[] = [];
  (Array.isArray(data.areas) ? data.areas : []).forEach((entry: unknown, index: number) => {
    if (readAreas([entry]).dropped > 0) warnings.push(words().areaNotValid(index + 1));
    else drawable.push(entry);
  });
  const { areas } = readAreas(drawable);

  return { devices, connections, areas, warnings };
}
