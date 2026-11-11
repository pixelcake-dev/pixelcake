/**
 * Network Engine — Interfaces
 *
 * A link end attaches to one concrete interface of its device: a Port on
 * switches/routers/firewalls, a NIC on end devices. This module gives both a
 * unified shape and owns the binding rules: which interface a link end uses,
 * which interfaces are free, how unbound ends get bound and how stale or
 * conflicting bindings are dropped.
 *
 * Pure and deterministic: no React, no Zustand, no side effects. Functions
 * never mutate their inputs and return the SAME reference when nothing
 * changed, so callers can cheaply detect a no-op.
 */

import type { NetworkConnection, NetworkDevice, NetworkInterfaceCard, Port } from '@/types';

/** Which end of a connection: its `source` or its `target` device */
export type ConnectionEnd = 'source' | 'target';

interface InterfaceBase {
  /** Unique within the device: `port:3` / `nic:nic-1` */
  key: string;
  /** Short English name: `port 3` / `eth0` */
  label: string;
  enabled: boolean;
  /** '' when the interface carries no address */
  ip: string;
  /** '' when the interface carries no mask */
  subnet: string;
}

export interface PortInterface extends InterfaceBase {
  kind: 'port';
  port: Port;
}

export interface NicInterface extends InterfaceBase {
  kind: 'nic';
  nic: NetworkInterfaceCard;
}

/** A Port or a NIC seen through one shape */
export type DeviceInterface = PortInterface | NicInterface;

/** The link attached to an interface, seen from that interface's device */
export interface InterfaceLink {
  connection: NetworkConnection;
  /** The end of `connection` that sits on the interface's device */
  end: ConnectionEnd;
  /** Device on the other end (undefined when the connection dangles) */
  peer?: NetworkDevice;
  /** Interface the other end is bound to (undefined when unbound) */
  peerInterface?: DeviceInterface;
}

/** The four binding fields of a connection */
export type ConnectionBinding = Pick<
  NetworkConnection,
  'sourcePort' | 'sourceNic' | 'targetPort' | 'targetNic'
>;

const portKey = (portId: number): string => `port:${portId}`;
const nicKey = (nicId: string): string => `nic:${nicId}`;

function fromPort(port: Port): PortInterface {
  return {
    kind: 'port',
    key: portKey(port.id),
    label: `port ${port.id}`,
    enabled: port.enabled !== false,
    ip: port.ip ?? '',
    subnet: port.subnet ?? '',
    port,
  };
}

function fromNic(nic: NetworkInterfaceCard): NicInterface {
  return {
    kind: 'nic',
    key: nicKey(nic.id),
    label: nic.name || nic.id,
    enabled: nic.enabled !== false,
    ip: nic.ip ?? '',
    subnet: nic.subnet ?? '',
    nic,
  };
}

/** Every interface of a device in one list: ports first, then NICs */
export function listInterfaces(device: NetworkDevice): DeviceInterface[] {
  return [...(device.ports ?? []).map(fromPort), ...(device.nics ?? []).map(fromNic)];
}

/**
 * How a failure message names an interface: `port 3` for ports,
 * `interface eth0` for NICs.
 */
export function interfacePhrase(iface: DeviceInterface): string {
  return iface.kind === 'port' ? iface.label : `interface ${iface.label}`;
}

/** The end of `connection` that sits on `deviceId` (source wins on a self-loop) */
export function connectionEndOn(
  connection: NetworkConnection,
  deviceId: string
): ConnectionEnd | undefined {
  if (connection.source === deviceId) return 'source';
  if (connection.target === deviceId) return 'target';
  return undefined;
}

function endDeviceId(connection: NetworkConnection, end: ConnectionEnd): string {
  return end === 'source' ? connection.source : connection.target;
}

function endPort(connection: NetworkConnection, end: ConnectionEnd): number | undefined {
  return end === 'source' ? connection.sourcePort : connection.targetPort;
}

function endNic(connection: NetworkConnection, end: ConnectionEnd): string | undefined {
  return end === 'source' ? connection.sourceNic : connection.targetNic;
}

/** True when the end carries a binding (even one that no longer resolves) */
export function isEndBound(connection: NetworkConnection, end: ConnectionEnd): boolean {
  return endPort(connection, end) !== undefined || endNic(connection, end) !== undefined;
}

/**
 * The interface of `device` that `connection` is bound to. `end` defaults to
 * the end sitting on the device. Undefined when the end is unbound or its
 * binding points at a port/NIC the device does not have. A port binding wins
 * over a NIC binding if corrupt data carries both.
 */
export function boundInterface(
  connection: NetworkConnection,
  device: NetworkDevice,
  end: ConnectionEnd | undefined = connectionEndOn(connection, device.id)
): DeviceInterface | undefined {
  if (!end || endDeviceId(connection, end) !== device.id) return undefined;

  const portId = endPort(connection, end);
  if (portId !== undefined) {
    const port = device.ports?.find(p => p.id === portId);
    if (port) return fromPort(port);
  }
  const nicId = endNic(connection, end);
  if (nicId !== undefined) {
    const nic = device.nics?.find(n => n.id === nicId);
    if (nic) return fromNic(nic);
  }
  return undefined;
}

/** The binding fields that attach `end` to `iface` (or detach it when undefined) */
export function bindingFor(
  end: ConnectionEnd,
  iface: DeviceInterface | undefined
): Partial<ConnectionBinding> {
  const port = iface?.kind === 'port' ? iface.port.id : undefined;
  const nic = iface?.kind === 'nic' ? iface.nic.id : undefined;
  return end === 'source'
    ? { sourcePort: port, sourceNic: nic }
    : { targetPort: port, targetNic: nic };
}

/** Copy of `connection` with `end` attached to `iface` (detached when undefined) */
function withBinding(
  connection: NetworkConnection,
  end: ConnectionEnd,
  iface: DeviceInterface | undefined
): NetworkConnection {
  const next: NetworkConnection = { ...connection };
  if (end === 'source') {
    delete next.sourcePort;
    delete next.sourceNic;
    if (iface?.kind === 'port') next.sourcePort = iface.port.id;
    if (iface?.kind === 'nic') next.sourceNic = iface.nic.id;
  } else {
    delete next.targetPort;
    delete next.targetNic;
    if (iface?.kind === 'port') next.targetPort = iface.port.id;
    if (iface?.kind === 'nic') next.targetNic = iface.nic.id;
  }
  return next;
}

const ENDS: readonly ConnectionEnd[] = ['source', 'target'];

/**
 * Interface key → the link bound to it, for one device. When corrupt data has
 * two links on the same interface the first connection wins.
 */
export function interfaceLinks(
  device: NetworkDevice,
  devices: NetworkDevice[],
  connections: NetworkConnection[]
): Map<string, InterfaceLink> {
  const devicesById = new Map(devices.map(d => [d.id, d] as const));
  const links = new Map<string, InterfaceLink>();
  for (const connection of connections) {
    for (const end of ENDS) {
      const iface = boundInterface(connection, device, end);
      if (!iface || links.has(iface.key)) continue;
      const peerEnd: ConnectionEnd = end === 'source' ? 'target' : 'source';
      const peer = devicesById.get(endDeviceId(connection, peerEnd));
      links.set(iface.key, {
        connection,
        end,
        peer,
        peerInterface: peer ? boundInterface(connection, peer, peerEnd) : undefined,
      });
    }
  }
  return links;
}

/**
 * Keys of the interfaces of `device` that connections already use.
 * `exceptConnectionId` leaves one connection out (the one being edited).
 */
export function usedInterfaceKeys(
  device: NetworkDevice,
  connections: NetworkConnection[],
  exceptConnectionId?: string
): Set<string> {
  const used = new Set<string>();
  for (const connection of connections) {
    if (exceptConnectionId !== undefined && connection.id === exceptConnectionId) continue;
    for (const end of ENDS) {
      const iface = boundInterface(connection, device, end);
      if (iface) used.add(iface.key);
    }
  }
  return used;
}

/**
 * True when the ports of a device stand for different security policies, so
 * that picking one for the user would be picking a policy: a firewall whose
 * ports carry security zones. On these devices a link end is never bound
 * automatically; the user chooses the port (and with it the zone) in the
 * connection inspector, and until then the trace says the zones are not
 * applied.
 */
export function requiresExplicitBinding(device: NetworkDevice): boolean {
  return (
    device.type.toLowerCase().includes('firewall') &&
    (device.ports ?? []).some(port => port.securityZone !== undefined)
  );
}

/**
 * First free interface given the keys already in use: the lowest-numbered
 * free ENABLED port, else the first free enabled NIC in array order; when
 * every free interface is disabled, the first free one; undefined when the
 * device has no interfaces, none is free, or the choice must be the user's
 * (see requiresExplicitBinding).
 */
function pickFreeInterface(
  device: NetworkDevice,
  used: ReadonlySet<string>
): DeviceInterface | undefined {
  if (requiresExplicitBinding(device)) return undefined;

  const freePorts = (device.ports ?? [])
    .map(fromPort)
    .filter(iface => !used.has(iface.key))
    .sort((a, b) => a.port.id - b.port.id);
  const freeNics = (device.nics ?? []).map(fromNic).filter(iface => !used.has(iface.key));
  const free: DeviceInterface[] = [...freePorts, ...freeNics];
  return free.find(iface => iface.enabled) ?? free[0];
}

/**
 * The interface a new link should attach to on `device`: see
 * pickFreeInterface for the preference order. Undefined when the device has
 * no ports/NICs or all of them are used.
 */
export function firstFreeInterface(
  device: NetworkDevice,
  connections: NetworkConnection[]
): DeviceInterface | undefined {
  return pickFreeInterface(device, usedInterfaceKeys(device, connections));
}

/** deviceId → interface keys in use on that device */
type UsedInterfaces = Map<string, Set<string>>;

/** The (lazily created) key set of one device */
function keysOf(used: UsedInterfaces, deviceId: string): Set<string> {
  let keys = used.get(deviceId);
  if (!keys) {
    keys = new Set<string>();
    used.set(deviceId, keys);
  }
  return keys;
}

/** Bind every unbound end of `connection`, claiming keys in `used` */
function bindEnds(
  connection: NetworkConnection,
  devicesById: ReadonlyMap<string, NetworkDevice>,
  used: UsedInterfaces
): NetworkConnection {
  let bound = connection;
  for (const end of ENDS) {
    if (isEndBound(bound, end)) continue;
    const device = devicesById.get(endDeviceId(bound, end));
    if (!device) continue;
    const keys = keysOf(used, device.id);
    const iface = pickFreeInterface(device, keys);
    if (!iface) continue; // no ports/NICs or none free: the end stays unbound
    keys.add(iface.key);
    bound = withBinding(bound, end, iface);
  }
  return bound;
}

/** Record in `used` every interface the connections already resolve to */
function claimExisting(
  connections: NetworkConnection[],
  devicesById: ReadonlyMap<string, NetworkDevice>,
  used: UsedInterfaces
): void {
  for (const connection of connections) {
    for (const end of ENDS) {
      const device = devicesById.get(endDeviceId(connection, end));
      const iface = device ? boundInterface(connection, device, end) : undefined;
      if (device && iface) keysOf(used, device.id).add(iface.key);
    }
  }
}

/**
 * Fill in the missing ends of ONE connection with the first free interface of
 * the respective device, never overwriting an existing binding. `others` are
 * the connections already in the topology (an entry with the same id as
 * `connection` is ignored). Returns the same object when nothing changed.
 */
export function bindConnection(
  connection: NetworkConnection,
  devices: NetworkDevice[],
  others: NetworkConnection[]
): NetworkConnection {
  const devicesById = new Map(devices.map(d => [d.id, d] as const));
  const used: UsedInterfaces = new Map();
  claimExisting(
    [...others.filter(other => other.id !== connection.id), connection],
    devicesById,
    used
  );
  return bindEnds(connection, devicesById, used);
}

/**
 * Bind every unbound end of a whole topology. Existing bindings are reserved
 * first (so an auto-chosen interface never collides with an explicit one
 * further down the list), then unbound ends are filled in connection order,
 * source end before target end. Deterministic: same input, same output.
 * Returns the same array when nothing changed.
 */
export function bindUnboundConnections(
  devices: NetworkDevice[],
  connections: NetworkConnection[]
): NetworkConnection[] {
  const devicesById = new Map(devices.map(d => [d.id, d] as const));
  const used: UsedInterfaces = new Map();
  claimExisting(connections, devicesById, used);

  let changed = false;
  const bound = connections.map(connection => {
    const next = bindEnds(connection, devicesById, used);
    if (next !== connection) changed = true;
    return next;
  });
  return changed ? bound : connections;
}

/**
 * Drop bindings that cannot hold: an end pointing at a port/NIC its device no
 * longer has (or at a missing device) becomes unbound, and when two ends claim
 * the same interface the first connection keeps it and the later one is
 * unbound. An end carrying both a port and a NIC keeps only the one that
 * resolves. Returns the same array when nothing changed.
 */
export function sanitizeBindings(
  devices: NetworkDevice[],
  connections: NetworkConnection[]
): NetworkConnection[] {
  const devicesById = new Map(devices.map(d => [d.id, d] as const));
  const claimed: UsedInterfaces = new Map();

  let changed = false;
  const sanitized = connections.map(connection => {
    let next = connection;
    for (const end of ENDS) {
      if (!isEndBound(next, end)) continue;
      const device = devicesById.get(endDeviceId(next, end));
      const iface = device ? boundInterface(next, device, end) : undefined;
      const keys = device ? keysOf(claimed, device.id) : undefined;

      if (!iface || !keys || keys.has(iface.key)) {
        next = withBinding(next, end, undefined);
        continue;
      }
      keys.add(iface.key);
      const hasBoth = endPort(next, end) !== undefined && endNic(next, end) !== undefined;
      if (hasBoth) next = withBinding(next, end, iface);
    }
    if (next !== connection) changed = true;
    return next;
  });
  return changed ? sanitized : connections;
}

/**
 * Bring a whole topology to the "every link end sits on its own interface"
 * state: bindings that cannot hold are dropped (sanitizeBindings), then every
 * unbound end gets the first free interface (bindUnboundConnections). This is
 * what runs whenever a topology is loaded, so data saved before interface
 * bindings existed is migrated by the same call. Returns the same array when
 * there is nothing to do.
 */
export function normalizeBindings(
  devices: NetworkDevice[],
  connections: NetworkConnection[]
): NetworkConnection[] {
  return bindUnboundConnections(devices, sanitizeBindings(devices, connections));
}
