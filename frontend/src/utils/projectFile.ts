/**
 * Project file (`.pixelcake.json`), version 1 — see docs/project-file.md.
 *
 * Pure module: text in, data out. No store, no DOM, no clock (the caller
 * supplies `savedAt`). Messages are for the user, hence in Italian.
 */

import type {
  CanvasViewport,
  ConnectionTemplate,
  DeviceTemplate,
  GlobalNetworkSettings,
  NetworkConnection,
  NetworkDevice,
  ProjectFile,
  ProjectTemplates,
  ProjectVlan,
  StoredCanvas,
} from '@/types';
import { PROJECT_FILE_FORMAT, PROJECT_FILE_VERSION } from '@/types';
import { normalizeAddressing, normalizeBindings } from '@/engine';
import { cleanupConnections } from '@/utils/cleanupConnections';
import { isValidIP } from '@/utils/ipHelpers';
import { tidyNotes } from '@/utils/deviceNotes';
import { isVlanId, tidyVlanName, VLAN_NAME_MAX_LENGTH } from '@/utils/vlanNames';
import { readAreas } from '@/utils/canvasAreas';

export const PROJECT_FILE_EXTENSION = '.pixelcake.json';
export const DEFAULT_PROJECT_NAME = 'Progetto senza nome';

export const DEFAULT_NETWORK_SETTINGS: GlobalNetworkSettings = {
  ipClass: '192.168.1.0',
  subnet: '255.255.255.0',
  gateway: '192.168.1.1',
  emailMode: 'auto',
};

const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

export function createEmptyCanvas(id: string, name: string): StoredCanvas {
  return {
    id,
    name,
    devices: [],
    connections: [],
    viewport: { ...DEFAULT_VIEWPORT },
    deviceCounter: 0,
    connectionCounter: 0,
  };
}

/** Number for a new `canvas-N` id: one above the highest in use, 1 at least */
function nextCanvasNumber(existingIds: string[]): number {
  return Math.max(highestIndex(existingIds, 'canvas'), 0) + 1;
}

/** Id for a new canvas: `canvas-N`, N one above the highest in use */
export function nextCanvasId(existingIds: string[]): string {
  return `canvas-${nextCanvasNumber(existingIds)}`;
}

/**
 * A name made safe for a file name: lower case, plain letters and digits,
 * hyphens in between. Empty when nothing of the name is left.
 */
export function fileSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents: "Città" → "Citta"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** File name suggested for a project: its name made filename-safe + extension */
export function projectFileName(projectName: string): string {
  return `${fileSlug(projectName) || 'progetto'}${PROJECT_FILE_EXTENSION}`;
}

// ---------- small helpers ----------

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Highest N among ids shaped `<prefix>-N`, -1 when there is none */
function highestIndex(ids: string[], prefix: string): number {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = -1;
  for (const id of ids) {
    const match = pattern.exec(id);
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  }
  return highest;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// ---------- serialising ----------

const SETTINGS_KEYS = ['ipClass', 'subnet', 'gateway', 'dns', 'emailMode', 'vlans'];
const VLAN_KEYS = ['id', 'name'];
const DEVICE_KEYS = [
  'id',
  'type',
  'templateId',
  'label',
  'ip',
  'subnet',
  'gateway',
  'vendor',
  'location',
  'notes',
  'position',
  'vlan',
  'stp',
  'portCount',
  'ports',
  'nics',
  'routes',
  'firewallRules',
  'portForwards',
  'dnsRecords',
];
const ROUTE_KEYS = ['id', 'destination', 'nextHop', 'description'];
const RULE_KEYS = ['id', 'action', 'service', 'source', 'destination', 'enabled', 'description'];
const FORWARD_KEYS = ['id', 'service', 'port', 'to', 'enabled', 'description'];
const RECORD_KEYS = ['id', 'name', 'address'];
const POOL_KEYS = ['start', 'end', 'gateway', 'dns'];
const PORT_KEYS = [
  'id',
  'name',
  'enabled',
  'speed',
  'vlan',
  'portType',
  'poe',
  'description',
  'ip',
  'subnet',
  'nat',
  'dhcpServer',
  'securityZone',
  'ips',
];
const NIC_KEYS = [
  'id',
  'name',
  'enabled',
  'speed',
  'ip',
  'subnet',
  'gateway',
  'dns',
  'dhcp',
  'dhcpServer',
  'mac',
  'description',
];
const CONNECTION_KEYS = [
  'id',
  'source',
  'target',
  'sourceHandle',
  'targetHandle',
  'sourcePort',
  'sourceNic',
  'targetPort',
  'targetNic',
  'type',
  'bandwidth',
  'vlan',
  'label',
  'color',
  'stpPortState',
  'stpPortPriority',
];
const AREA_KEYS = ['id', 'label', 'color', 'position', 'size'];
const DEVICE_TEMPLATE_KEYS = [
  'id',
  'name',
  'type',
  'icon',
  'color',
  'terraformFields',
  'isCustom',
  'supportsVLAN',
  'supportsSTP',
  'supportsPorts',
  'supportsNICs',
  'portOptions',
  'defaultPortCount',
];
const CONNECTION_TEMPLATE_KEYS = [
  'id',
  'name',
  'type',
  'description',
  'color',
  'lineStyle',
  'strokeWidth',
  'strokeWidthHighlighted',
  'strokeDasharray',
  'isCustom',
];

type Reorder = (value: unknown) => unknown;

/** Keys of nested objects in alphabetical order; arrays keep their order */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!isRecord(value)) return value;
  const out: JsonObject = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortDeep(value[key]);
  }
  return out;
}

/**
 * A copy of `source` whose keys come in a fixed order: the known ones first,
 * as listed, then any other in alphabetical order. Nothing is dropped, so the
 * output does not depend on how the object was built or edited.
 */
function ordered(
  source: object,
  knownKeys: readonly string[],
  nested: Record<string, Reorder> = {}
): JsonObject {
  const record = source as JsonObject;
  const others = Object.keys(record)
    .filter(key => !knownKeys.includes(key))
    .sort();
  const out: JsonObject = {};
  for (const key of [...knownKeys, ...others]) {
    const value = record[key];
    if (value === undefined) continue;
    const reorder = nested[key];
    out[key] = reorder ? reorder(value) : sortDeep(value);
  }
  return out;
}

function each(keys: readonly string[], nested: Record<string, Reorder> = {}): Reorder {
  return value =>
    Array.isArray(value)
      ? value.map(item => (isRecord(item) ? ordered(item, keys, nested) : item))
      : sortDeep(value);
}

function one(keys: readonly string[]): Reorder {
  return value => (isRecord(value) ? ordered(value, keys) : value);
}

/** The DHCP server of an interface, a port or a card: its range, then what it hands out with it */
const INTERFACE_NESTED: Record<string, Reorder> = { dhcpServer: one(POOL_KEYS) };

const AREA_NESTED: Record<string, Reorder> = {
  position: one(['x', 'y']),
  size: one(['width', 'height']),
};

const DEVICE_NESTED: Record<string, Reorder> = {
  position: one(['x', 'y']),
  stp: one(['enabled', 'mode', 'priority']),
  ports: each(PORT_KEYS, INTERFACE_NESTED),
  nics: each(NIC_KEYS, INTERFACE_NESTED),
  routes: each(ROUTE_KEYS),
  firewallRules: each(RULE_KEYS),
  portForwards: each(FORWARD_KEYS),
  dnsRecords: each(RECORD_KEYS),
};

/**
 * The text of a project file: pretty-printed JSON with a stable key order
 * (two saves of the same project differ only in `savedAt`).
 */
export function serializeProject(project: ProjectFile): string {
  const document = {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name: project.name,
    description: project.description,
    savedAt: project.savedAt,
    // (a project that names no VLAN is written without the list)
    settings: ordered(
      { ...project.settings, vlans: project.settings.vlans?.length ? project.settings.vlans : undefined },
      SETTINGS_KEYS,
      { vlans: each(VLAN_KEYS) }
    ),
    activeCanvasId: project.activeCanvasId,
    canvases: project.canvases.map(canvas => ({
      id: canvas.id,
      name: canvas.name,
      devices: canvas.devices.map(device => ordered(device, DEVICE_KEYS, DEVICE_NESTED)),
      connections: canvas.connections.map(connection => ordered(connection, CONNECTION_KEYS)),
      // (a canvas without areas is written without the list, as before they existed)
      ...(canvas.areas && canvas.areas.length > 0
        ? { areas: canvas.areas.map(area => ordered(area, AREA_KEYS, AREA_NESTED)) }
        : {}),
      viewport: { x: canvas.viewport.x, y: canvas.viewport.y, zoom: canvas.viewport.zoom },
      deviceCounter: canvas.deviceCounter,
      connectionCounter: canvas.connectionCounter,
    })),
    templates: {
      devices: project.templates.devices.map(template => ordered(template, DEVICE_TEMPLATE_KEYS)),
      connections: project.templates.connections.map(template =>
        ordered(template, CONNECTION_TEMPLATE_KEYS)
      ),
    },
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

// ---------- parsing ----------

export type ParseProjectResult =
  | { ok: true; project: ProjectFile; warnings: string[] }
  | { ok: false; error: string };

/** Thrown inside the parser for a file that cannot be opened at all */
class ProjectFileError extends Error {}

/**
 * The names of the VLANs of the project: a number from 1 to 4094 and a name
 * each, one name for a number, lowest number first. What is not is left
 * out, a name that is too long is cut, and both are said.
 */
function parseVlans(value: unknown, warnings: string[]): ProjectVlan[] {
  if (!Array.isArray(value)) {
    warnings.push('Elenco dei nomi delle VLAN non valido: ignorato.');
    return [];
  }
  const byId = new Map<number, ProjectVlan>();
  let dropped = 0;
  let cut = 0;
  for (const entry of value) {
    const name = isRecord(entry) && typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!isRecord(entry) || !isVlanId(entry.id) || name === '' || byId.has(entry.id)) {
      dropped++;
      continue;
    }
    if (name.length > VLAN_NAME_MAX_LENGTH) cut++;
    byId.set(entry.id, { id: entry.id, name: tidyVlanName(name) });
  }
  if (dropped > 0) {
    warnings.push(
      `${plural(dropped, 'nome di VLAN non valido o duplicato ignorato', 'nomi di VLAN non validi o duplicati ignorati')}.`
    );
  }
  if (cut > 0) {
    warnings.push(
      `${plural(cut, 'nome di VLAN troppo lungo accorciato', 'nomi di VLAN troppo lunghi accorciati')} a ${VLAN_NAME_MAX_LENGTH} caratteri.`
    );
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function parseSettings(value: unknown, warnings: string[]): GlobalNetworkSettings {
  if (!isRecord(value)) {
    warnings.push('Impostazioni di rete mancanti: usati i valori predefiniti.');
    return { ...DEFAULT_NETWORK_SETTINGS };
  }

  let repaired = false;
  const text = (key: 'ipClass' | 'subnet' | 'gateway'): string => {
    const field = value[key];
    if (typeof field === 'string') return field;
    repaired = true;
    return DEFAULT_NETWORK_SETTINGS[key];
  };

  const settings: GlobalNetworkSettings = {
    ipClass: text('ipClass'),
    subnet: text('subnet'),
    gateway: text('gateway'),
  };
  // The DNS server of new devices is optional: kept when it is an address,
  // left out, and said, when it is anything else (it would be written on
  // the card of every new device)
  let badDns = false;
  if (value.dns !== undefined) {
    const dns = typeof value.dns === 'string' ? value.dns.trim() : null;
    if (dns !== null && isValidIP(dns)) settings.dns = dns;
    else if (dns !== '') badDns = true; // an empty field is simply no server
  }
  const mode = value.emailMode;
  if (mode === 'auto' || mode === 'internal' || mode === 'cloud') {
    settings.emailMode = mode;
  } else if (mode !== undefined) {
    repaired = true; // left out: the app reads a missing mode as 'auto'
  }

  if (repaired) {
    warnings.push('Impostazioni di rete incomplete: completate con i valori predefiniti.');
  }
  if (badDns) {
    warnings.push('Server DNS predefinito non valido: ignorato.');
  }
  if (value.vlans !== undefined) {
    const vlans = parseVlans(value.vlans, warnings);
    if (vlans.length > 0) settings.vlans = vlans;
  }
  return settings;
}

function isPosition(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

/** Keep the entries of an interface list that have a usable id; undefined when it is no list */
function interfaceList(value: unknown, hasId: (id: unknown) => boolean): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(entry => isRecord(entry) && hasId(entry.id));
}

/** A static route the engine can read: an id, a destination and a next hop, all text */
function isRoute(value: unknown): boolean {
  return (
    isRecord(value) && isText(value.id) && isText(value.destination) && isText(value.nextHop)
  );
}

/** What a rule or a port forward can be about: a service, or any of them */
const SERVICES = ['any', 'ping', 'web', 'email', 'dns'];

/** A firewall rule the engine can read */
function isRule(value: unknown): boolean {
  return (
    isRecord(value) &&
    isText(value.id) &&
    (value.action === 'allow' || value.action === 'deny') &&
    SERVICES.includes(value.service as string) &&
    isText(value.source) &&
    isText(value.destination)
  );
}

/** A port forward the engine can read: a service, the number of a port, an address */
function isForward(value: unknown): boolean {
  return (
    isRecord(value) &&
    isText(value.id) &&
    SERVICES.includes(value.service as string) &&
    typeof value.port === 'number' &&
    Number.isInteger(value.port) &&
    isText(value.to)
  );
}

/** A DNS record the engine can read: an id, a name and an address, all text */
function isDnsRecord(value: unknown): boolean {
  return isRecord(value) && isText(value.id) && isText(value.name) && isText(value.address);
}

/**
 * A DHCP pool the engine can read: a first and a last address, and a gateway
 * and a DNS server or none, all text
 */
function isPool(value: unknown): boolean {
  return (
    isRecord(value) &&
    isText(value.start) &&
    isText(value.end) &&
    (value.gateway === undefined || isText(value.gateway)) &&
    (value.dns === undefined || isText(value.dns))
  );
}

/**
 * The ports or the cards of a device without what the engine could not read
 * of DHCP and DNS: a pool that is not one, a `dhcp` that is not yes or no, a
 * DNS server that is not text. The SAME list when there is nothing to drop.
 */
function withReadableDhcp(interfaces: unknown[]): unknown[] {
  let changed = false;
  const kept = interfaces.map(entry => {
    if (!isRecord(entry)) return entry;
    const badPool = entry.dhcpServer !== undefined && !isPool(entry.dhcpServer);
    const badFlag = entry.dhcp !== undefined && typeof entry.dhcp !== 'boolean';
    const badDns = entry.dns !== undefined && !isText(entry.dns);
    if (!badPool && !badFlag && !badDns) return entry;
    changed = true;
    const copy: JsonObject = { ...entry };
    if (badPool) delete copy.dhcpServer;
    if (badFlag) delete copy.dhcp;
    if (badDns) delete copy.dns;
    return copy;
  });
  return changed ? kept : interfaces;
}

function parseDevices(list: unknown[], where: string, warnings: string[]): NetworkDevice[] {
  const devices: NetworkDevice[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  let repaired = 0;

  for (const entry of list) {
    // Without an id or a type there is nothing to draw or to link to
    if (!isRecord(entry) || !isText(entry.id) || !isText(entry.type) || seen.has(entry.id)) {
      dropped++;
      continue;
    }
    seen.add(entry.id);

    const device: JsonObject = { ...entry };
    let fixed = false;
    if (typeof device.label !== 'string') {
      device.label = entry.id;
      fixed = true;
    }
    for (const key of ['ip', 'subnet', 'gateway']) {
      if (typeof device[key] !== 'string') {
        device[key] = '';
        fixed = true;
      }
    }
    if (!isPosition(device.position)) {
      device.position = { x: 0, y: 0 };
      fixed = true;
    }
    // The note: kept as the app keeps it (trimmed, none when empty); what
    // is not text is dropped
    if (device.notes !== undefined) {
      const notes = tidyNotes(device.notes);
      if (typeof device.notes !== 'string') fixed = true;
      if (notes === undefined) delete device.notes;
      else device.notes = notes;
    }
    for (const [key, hasId] of [
      ['ports', (id: unknown) => typeof id === 'number'],
      ['nics', isText],
    ] as const) {
      const given = device[key];
      if (given === undefined) continue;
      const kept = interfaceList(given, hasId);
      if (kept && kept.length === (given as unknown[]).length) continue;
      if (kept) device[key] = kept;
      else delete device[key];
      fixed = true;
    }
    // DHCP on a port or on a card, the DNS server of a card: what the engine
    // could not read is dropped
    for (const key of ['ports', 'nics'] as const) {
      const interfaces = device[key];
      if (!Array.isArray(interfaces)) continue;
      const readable = withReadableDhcp(interfaces);
      if (readable === interfaces) continue;
      device[key] = readable;
      fixed = true;
    }
    // Routes, firewall rules, port forwards and DNS records: an entry the
    // engine could not read is dropped
    for (const [key, isComplete] of [
      ['routes', isRoute],
      ['firewallRules', isRule],
      ['portForwards', isForward],
      ['dnsRecords', isDnsRecord],
    ] as const) {
      const given = device[key];
      if (given === undefined) continue;
      const kept = Array.isArray(given) ? given.filter(isComplete) : [];
      if (Array.isArray(given) && kept.length === given.length) continue;
      if (kept.length > 0) device[key] = kept;
      else delete device[key];
      fixed = true;
    }
    if (fixed) repaired++;

    devices.push(device as unknown as NetworkDevice);
  }

  if (dropped > 0) {
    warnings.push(
      `${where}: ${plural(dropped, 'dispositivo non valido o duplicato ignorato', 'dispositivi non validi o duplicati ignorati')}.`
    );
  }
  if (repaired > 0) {
    warnings.push(
      `${where}: ${plural(repaired, 'dispositivo incompleto corretto', 'dispositivi incompleti corretti')}.`
    );
  }

  // A file written before interface addressing may carry a stale mirror, and
  // a card set to DHCP an address it does not use
  return devices.map(normalizeAddressing);
}

function parseConnections(
  list: unknown[],
  devices: NetworkDevice[],
  where: string,
  warnings: string[]
): NetworkConnection[] {
  const valid = list.filter(
    (entry): entry is JsonObject =>
      isRecord(entry) && isText(entry.id) && isText(entry.source) && isText(entry.target)
  ) as unknown as NetworkConnection[];
  if (valid.length !== list.length) {
    const count = list.length - valid.length;
    warnings.push(
      `${where}: ${plural(count, 'connessione non valida ignorata', 'connessioni non valide ignorate')}.`
    );
  }

  const { cleanedConnections } = cleanupConnections(valid);
  if (cleanedConnections.length !== valid.length) {
    const count = valid.length - cleanedConnections.length;
    warnings.push(
      `${where}: ${plural(count, 'connessione con id duplicato rimossa', 'connessioni con id duplicato rimosse')}.`
    );
  }

  const deviceIds = new Set(devices.map(device => device.id));
  const attached = cleanedConnections.filter(
    connection => deviceIds.has(connection.source) && deviceIds.has(connection.target)
  );
  if (attached.length !== cleanedConnections.length) {
    const count = cleanedConnections.length - attached.length;
    warnings.push(
      `${where}: ${plural(count, 'connessione verso un dispositivo inesistente rimossa', 'connessioni verso dispositivi inesistenti rimosse')}.`
    );
  }

  // A file written before interface bindings: every link gets its interfaces
  return normalizeBindings(devices, attached);
}

function parseViewport(value: unknown, where: string, warnings: string[]): CanvasViewport {
  if (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.zoom) &&
    value.zoom > 0
  ) {
    return { x: value.x, y: value.y, zoom: value.zoom };
  }
  warnings.push(`${where}: vista mancante o non valida, riportata alla posizione iniziale.`);
  return { ...DEFAULT_VIEWPORT };
}

/**
 * A counter must be above every id in use, or the next device/connection
 * would take the id of an existing one.
 */
function parseCounter(value: unknown, ids: string[], prefix: string): [number, boolean] {
  const required = highestIndex(ids, prefix) + 1;
  const given = typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
  if (given !== null && given >= required) return [given, false];
  return [Math.max(given ?? 0, required), true];
}

/** A canvas without its id: ids are settled once all canvases are read */
function parseCanvas(value: unknown, index: number, warnings: string[]): StoredCanvas {
  if (!isRecord(value)) {
    throw new ProjectFileError(`Il canvas n. ${index + 1} del file non è valido.`);
  }

  let name = `Canvas ${index + 1}`;
  if (isText(value.name)) {
    name = value.name;
  } else {
    warnings.push(`Canvas n. ${index + 1} senza nome: chiamato "${name}".`);
  }
  const where = `Canvas "${name}"`;

  if (!Array.isArray(value.devices)) {
    throw new ProjectFileError(`${where}: manca l'elenco dei dispositivi ("devices").`);
  }
  if (!Array.isArray(value.connections)) {
    throw new ProjectFileError(`${where}: manca l'elenco delle connessioni ("connections").`);
  }

  const devices = parseDevices(value.devices, where, warnings);
  const connections = parseConnections(value.connections, devices, where, warnings);
  // The areas behind the devices: one that cannot be drawn (no place, no
  // size) is left out, the rest of one is completed
  const drawn = readAreas(value.areas);
  if (drawn.dropped > 0) {
    warnings.push(
      `${where}: ${plural(drawn.dropped, 'riquadro non valido ignorato', 'riquadri non validi ignorati')}.`
    );
  }
  if (drawn.repaired > 0) {
    warnings.push(
      `${where}: ${plural(drawn.repaired, 'riquadro incompleto corretto', 'riquadri incompleti corretti')}.`
    );
  }
  const viewport = parseViewport(value.viewport, where, warnings);

  const [deviceCounter, deviceCounterRaised] = parseCounter(
    value.deviceCounter,
    devices.map(device => device.id),
    'dev'
  );
  const [connectionCounter, connectionCounterRaised] = parseCounter(
    value.connectionCounter,
    connections.map(connection => connection.id),
    'conn'
  );
  if (deviceCounterRaised || connectionCounterRaised) {
    warnings.push(`${where}: contatori degli id mancanti o troppo bassi, ricalcolati.`);
  }

  return {
    id: isText(value.id) ? value.id : '',
    name,
    devices,
    connections,
    ...(drawn.areas.length > 0 ? { areas: drawn.areas } : {}),
    viewport,
    deviceCounter,
    connectionCounter,
  };
}

/** Give a new id to every canvas whose id is missing or already taken */
function settleCanvasIds(canvases: StoredCanvas[], warnings: string[]): void {
  const given = canvases.map(canvas => canvas.id);
  const taken = new Set<string>();
  let next = nextCanvasNumber(given);
  let renamed = 0;

  for (const canvas of canvases) {
    if (canvas.id === '' || taken.has(canvas.id)) {
      canvas.id = `canvas-${next++}`;
      renamed++;
    }
    taken.add(canvas.id);
  }

  if (renamed > 0) {
    warnings.push(
      `${plural(renamed, 'canvas con id mancante o duplicato: assegnato un nuovo id', 'canvas con id mancante o duplicato: assegnati nuovi id')}.`
    );
  }
}

function isDeviceTemplate(value: unknown): value is DeviceTemplate {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    isText(value.type) &&
    typeof value.icon === 'string' &&
    typeof value.color === 'string' &&
    typeof value.supportsVLAN === 'boolean' &&
    typeof value.supportsSTP === 'boolean' &&
    typeof value.supportsPorts === 'boolean' &&
    typeof value.supportsNICs === 'boolean'
  );
}

function isConnectionTemplate(value: unknown): value is ConnectionTemplate {
  return (
    isRecord(value) &&
    isText(value.id) &&
    isText(value.name) &&
    isText(value.type) &&
    typeof value.color === 'string' &&
    (value.lineStyle === 'solid' || value.lineStyle === 'dashed' || value.lineStyle === 'dotted') &&
    isFiniteNumber(value.strokeWidth)
  );
}

function parseTemplates(value: unknown, warnings: string[]): ProjectTemplates {
  if (!isRecord(value)) {
    warnings.push('Elenco dei template personalizzati mancante: nessun template importato.');
    return { devices: [], connections: [] };
  }

  const given = [
    ...(Array.isArray(value.devices) ? value.devices : []),
    ...(Array.isArray(value.connections) ? value.connections : []),
  ];
  // Whatever travels in a project file is a custom template on arrival
  const devices = (Array.isArray(value.devices) ? value.devices : [])
    .filter(isDeviceTemplate)
    .map(template => ({ ...template, isCustom: true }));
  const connections = (Array.isArray(value.connections) ? value.connections : [])
    .filter(isConnectionTemplate)
    .map(template => ({ ...template, isCustom: true }));

  const ignored = given.length - devices.length - connections.length;
  if (ignored > 0) {
    warnings.push(
      `${plural(ignored, 'template personalizzato non valido ignorato', 'template personalizzati non validi ignorati')}.`
    );
  }
  return { devices, connections };
}

function readProject(text: string, warnings: string[]): ProjectFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectFileError('Il file non è un JSON valido.');
  }

  if (!isRecord(data) || data.format !== PROJECT_FILE_FORMAT) {
    throw new ProjectFileError(
      'Il file non è un progetto PixelCake (campo "format" mancante o non riconosciuto).'
    );
  }

  if (data.version === undefined) {
    warnings.push('Versione del formato non indicata: il file è stato letto come versione 1.');
  } else if (
    typeof data.version !== 'number' ||
    !Number.isInteger(data.version) ||
    data.version < 1
  ) {
    throw new ProjectFileError('Il file indica una versione del formato non valida.');
  } else if (data.version > PROJECT_FILE_VERSION) {
    throw new ProjectFileError(
      `Il file è stato creato con una versione più recente di PixelCake (formato ${data.version}): ` +
        "aggiorna l'applicazione per aprirlo."
    );
  }

  if (!Array.isArray(data.canvases) || data.canvases.length === 0) {
    throw new ProjectFileError('Il progetto non contiene nessun canvas.');
  }

  let name = DEFAULT_PROJECT_NAME;
  if (isText(data.name)) {
    name = data.name;
  } else {
    warnings.push(`Nome del progetto mancante: usato "${DEFAULT_PROJECT_NAME}".`);
  }

  let description = '';
  if (typeof data.description === 'string') {
    description = data.description;
  } else {
    warnings.push('Descrizione del progetto mancante: lasciata vuota.');
  }

  const settings = parseSettings(data.settings, warnings);

  const canvases = data.canvases.map((canvas, index) => parseCanvas(canvas, index, warnings));
  settleCanvasIds(canvases, warnings);

  let activeCanvasId = canvases[0].id;
  if (
    typeof data.activeCanvasId === 'string' &&
    canvases.some(canvas => canvas.id === data.activeCanvasId)
  ) {
    activeCanvasId = data.activeCanvasId;
  } else {
    warnings.push(`Canvas attivo non trovato: aperto "${canvases[0].name}".`);
  }

  const templates = parseTemplates(data.templates, warnings);

  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    name,
    description,
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
    settings,
    activeCanvasId,
    canvases,
    templates,
  };
}

/**
 * Read the text of a project file. A file that cannot be opened gives an
 * error; anything that could be repaired is repaired and listed in `warnings`.
 */
export function parseProjectFile(text: string): ParseProjectResult {
  const warnings: string[] = [];
  try {
    const project = readProject(text, warnings);
    return { ok: true, project, warnings };
  } catch (error) {
    if (error instanceof ProjectFileError) {
      return { ok: false, error: error.message };
    }
    // Content so malformed that reading it failed: still an answer, never a throw
    return { ok: false, error: 'Il file non può essere letto: il contenuto non è valido.' };
  }
}
