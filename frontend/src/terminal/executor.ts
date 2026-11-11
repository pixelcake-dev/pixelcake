/**
 * Terminal Executor
 * Bridges parser → engine → stores. This is the ONLY terminal layer allowed
 * to touch Zustand; parser and engine stay pure. Configuration commands go
 * through the same store actions as canvas edits, so they are autosaved and
 * undo-consistent with graphical editing.
 */

import { useNetworkStore } from '@/store/networkStore';
import {
  resolveEndpoint,
  suggestEndpoint,
  buildAdjacency,
  primaryIp,
  traceRoute,
  planAndEvaluateFlow,
  boundInterface,
  interfaceLinks,
  listInterfaces,
} from '@/engine';
import type { Topology, TraceResult, InterfaceLink } from '@/engine';
import { isValidIP } from '@/utils/ipHelpers';
import { parse } from './parser';
import type { Command, TerminalLine, ShowTarget } from './types';
import type { NetworkDevice, FlowModelType } from '@/types';

export interface TerminalContext {
  /** Label of the device entered via `use <device>`, or null at global scope */
  deviceLabel: string | null;
}

/**
 * Live diagnostic session: the UI starts the canvas packet animation on
 * `animationPath` and prints `hopLines[i]` when the packet reaches path
 * index i, then `finalLines` when the animation completes — so the terminal
 * output follows the visible flow in real time.
 */
export interface LiveTrace {
  animationPath: string[];
  flowModel: FlowModelType;
  /** Aligned with animationPath indices (may be empty, e.g. for ping) */
  hopLines: TerminalLine[];
  finalLines: TerminalLine[];
}

export interface ExecutionResult {
  lines: TerminalLine[];
  context: TerminalContext;
  /** When true the UI clears the scrollback before printing `lines` */
  clear?: boolean;
  /** Present when the command should drive the canvas animation */
  liveTrace?: LiveTrace;
}

/* ── line helpers ─────────────────────────────────────────────────────── */

const line = (text: string, tone: TerminalLine['tone'] = 'normal'): TerminalLine => ({ text, tone });
const err = (text: string): TerminalLine => line(text, 'error');
const ok = (text: string): TerminalLine => line(text, 'success');
const muted = (text: string): TerminalLine => line(text, 'muted');
const heading = (text: string): TerminalLine => line(text, 'heading');

function snapshot(): Topology {
  const { devices, connections } = useNetworkStore.getState();
  return { devices, connections };
}

/** Resolve a raw name/IP to a device, with a "did you mean" error on miss */
function resolveOrError(
  query: string,
  topo: Topology
): { device: NetworkDevice } | { errorLines: TerminalLine[] } {
  const resolved = resolveEndpoint(query, topo);
  if (resolved) return { device: resolved.device };
  const suggestion = suggestEndpoint(query, topo);
  const errorLines = [err(`device not found: "${query}"`)];
  if (suggestion) errorLines.push(muted(`  did you mean "${suggestion}"?`));
  return { errorLines };
}

function contextDevice(context: TerminalContext, topo: Topology): NetworkDevice | undefined {
  if (!context.deviceLabel) return undefined;
  return resolveEndpoint(context.deviceLabel, topo)?.device;
}

/* ── diagnostics rendering ────────────────────────────────────────────── */

/** Format one trace hop as a terminal line */
function hopLine(hop: TraceResult['hops'][number], index: number): TerminalLine {
  const icon = hop.status === 'blocked' ? '✗' : hop.status === 'delivered' ? '●' : '○';
  const tone = hop.status === 'blocked' ? 'error' : hop.status === 'delivered' ? 'success' : 'normal';
  const note = hop.note ? `  — ${hop.note}` : '';
  return line(` ${String(index + 1).padStart(2)}  ${icon} ${hop.label} (${hop.deviceType})${note}`, tone);
}

function runDiagnostic(
  kind: 'ping' | 'trace',
  target: string,
  from: string | undefined,
  context: TerminalContext
): { lines: TerminalLine[]; liveTrace?: LiveTrace } {
  const topo = snapshot();
  const lines: TerminalLine[] = [];

  const sourceQuery = from ?? context.deviceLabel ?? undefined;
  if (!sourceQuery) {
    return {
      lines: [err(`specify a source: "${kind} ${target} from <device>" — or enter a device context with "use <device>"`)],
    };
  }
  const src = resolveOrError(sourceQuery, topo);
  if ('errorLines' in src) return { lines: src.errorLines };
  const dst = resolveOrError(target, topo);
  if ('errorLines' in dst) return { lines: dst.errorLines };

  if (kind === 'ping') {
    // Echo semantics: both directions evaluated, round trip animated
    const flow = planAndEvaluateFlow('ping', src.device.id, dst.device.id, topo);
    lines.push(muted(`Pinging ${dst.device.label} (${primaryIp(dst.device) || 'no ip'}) from ${src.device.label}...`));

    const finalLines: TerminalLine[] = [];
    if (flow.verdict === 'success') {
      const requestHops = flow.legs[0]?.trace.hops.length ?? 1;
      const rttMs = 1 + 2 * Math.max(0, requestHops - 2);
      finalLines.push(ok(`Reply from ${primaryIp(dst.device)}: hops=${requestHops} time=${rttMs}ms`));
    } else {
      finalLines.push(err(`Ping failed (${flow.verdict}): ${flow.failureReason ?? 'unknown reason'}`));
      const blocked = flow.legs.flatMap((l) => l.trace.hops).find((h) => h.status === 'blocked');
      if (blocked) finalLines.push(muted(`  dropped at: ${blocked.label}`));
    }
    for (const note of flow.notes) finalLines.push(muted(`  note: ${note}`));

    if (flow.animationPath.length >= 2) {
      return {
        lines,
        liveTrace: { animationPath: flow.animationPath, flowModel: 'ping', hopLines: [], finalLines },
      };
    }
    return { lines: [...lines, ...finalLines] };
  }

  // trace: one-way, hop lines revealed as the packet travels
  const result = traceRoute(src.device.id, dst.device.id, topo);
  lines.push(muted(`Tracing route to ${dst.device.label} (${primaryIp(dst.device) || 'no ip'}) from ${src.device.label}:`));

  const hopLines = result.hops.map((hop, i) => hopLine(hop, i));
  const finalLines: TerminalLine[] = result.notes.map((note) => muted(`  note: ${note}`));
  if (result.verdict === 'success') {
    finalLines.push(ok('Trace complete: destination reached.'));
  } else {
    finalLines.push(err(`Trace failed (${result.verdict}): ${result.failureReason ?? 'unknown reason'}`));
  }

  const animationPath = result.hops.map((h) => h.deviceId);
  if (animationPath.length >= 2) {
    return { lines, liveTrace: { animationPath, flowModel: 'ping', hopLines, finalLines } };
  }
  return { lines: [...lines, ...hopLines, ...finalLines] };
}

/* ── show commands ────────────────────────────────────────────────────── */

function showDevices(topo: Topology): TerminalLine[] {
  if (topo.devices.length === 0) return [muted('no devices on the canvas')];
  const lines = [heading(`${'DEVICE'.padEnd(24)} ${'TYPE'.padEnd(14)} ${'IP'.padEnd(16)} VLANS`)];
  for (const d of topo.devices) {
    const vlans = d.vlan && d.vlan.length > 0 ? d.vlan.join(',') : '-';
    lines.push(line(`${d.label.padEnd(24)} ${d.type.padEnd(14)} ${(primaryIp(d) || '-').padEnd(16)} ${vlans}`));
  }
  return lines;
}

function showVlans(topo: Topology): TerminalLine[] {
  const membership = new Map<number, string[]>();
  for (const d of topo.devices) {
    for (const v of d.vlan ?? []) {
      membership.set(v, [...(membership.get(v) ?? []), d.label]);
    }
  }
  if (membership.size === 0) return [muted('no VLANs configured (all traffic untagged)')];
  const lines = [heading(`${'VLAN'.padEnd(6)} MEMBERS`)];
  for (const [id, members] of [...membership.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(line(`${String(id).padEnd(6)} ${members.join(', ')}`));
  }
  return lines;
}

function showConnections(topo: Topology, device?: NetworkDevice): TerminalLine[] {
  const conns = device
    ? topo.connections.filter((c) => c.source === device.id || c.target === device.id)
    : topo.connections;
  if (conns.length === 0) return [muted('no connections')];
  const byId = new Map(topo.devices.map((d) => [d.id, d]));
  const lines = [heading(`CONNECTIONS${device ? ` of ${device.label}` : ''} (${conns.length})`)];
  for (const c of conns) {
    const source = byId.get(c.source);
    const target = byId.get(c.target);
    const a = source?.label ?? c.source;
    const b = target?.label ?? c.target;
    // Interface each end is bound to: a port ("port 3") or a NIC ("eth0");
    // "?" for an end that is not bound, nothing when neither end is
    const sourceIface = source ? boundInterface(c, source, 'source') : undefined;
    const targetIface = target ? boundInterface(c, target, 'target') : undefined;
    const ports =
      sourceIface || targetIface
        ? `  [${sourceIface?.label ?? '?'} ↔ ${targetIface?.label ?? '?'}]`
        : '';
    const meta = [c.type, c.bandwidth].filter(Boolean).join(', ');
    lines.push(line(`  ${a} ↔ ${b}${meta ? `  (${meta})` : ''}${ports}`));
  }
  return lines;
}

/** What an interface is linked to: "SW-Office (port 8)", "SW-Office", or "-" */
function linkText(link: InterfaceLink | undefined): string {
  if (!link) return '-';
  const peer = link.peer?.label ?? '?';
  return link.peerInterface ? `${peer} (${link.peerInterface.label})` : peer;
}

function showConfig(d: NetworkDevice): TerminalLine[] {
  const lines = [heading(`${d.label} — ${d.type}${d.vendor ? ` (${d.vendor})` : ''}`)];
  lines.push(line(`  ip:       ${d.ip || '-'}`));
  lines.push(line(`  subnet:   ${d.subnet || '-'}`));
  lines.push(line(`  gateway:  ${d.gateway || '-'}`));
  if (d.location) lines.push(line(`  location: ${d.location}`));
  lines.push(line(`  vlans:    ${d.vlan && d.vlan.length > 0 ? d.vlan.join(', ') : 'none (untagged)'}`));
  if (d.stp?.enabled) lines.push(line(`  stp:      ${d.stp.mode ?? 'STP'} priority ${d.stp.priority ?? 32768}`));
  if (d.ports && d.ports.length > 0) {
    const enabled = d.ports.filter((p) => p.enabled).length;
    lines.push(line(`  ports:    ${enabled}/${d.ports.length} enabled — "show ports ${d.label}" for detail`));
  }
  for (const nic of d.nics ?? []) {
    lines.push(line(`  nic ${nic.name}: ${nic.ip || '-'} / ${nic.subnet || '-'} gw ${nic.gateway || '-'} ${nic.enabled ? '' : '(disabled)'}`));
  }
  return lines;
}

function showPorts(topo: Topology, d: NetworkDevice): TerminalLine[] {
  if (!d.ports || d.ports.length === 0) return [muted(`${d.label} has no configurable ports`)];
  const links = interfaceLinks(d, topo.devices, topo.connections);
  const lines = [
    heading(
      `${'PORT'.padEnd(6)} ${'STATE'.padEnd(10)} ${'MODE'.padEnd(8)} ${'VLAN'.padEnd(10)} ${'ZONE'.padEnd(8)} ${'IP'.padEnd(16)} LINK`
    ),
  ];
  for (const iface of listInterfaces(d)) {
    if (iface.kind !== 'port') continue;
    const p = iface.port;
    const vlan = p.vlan === undefined ? '-' : Array.isArray(p.vlan) ? p.vlan.join(',') : String(p.vlan);
    lines.push(
      line(
        `${String(p.id).padEnd(6)} ${(p.enabled ? 'up' : 'down').padEnd(10)} ${(p.portType ?? '-').padEnd(8)} ${vlan.padEnd(10)} ${(p.securityZone ?? '-').padEnd(8)} ${(iface.ip || '-').padEnd(16)} ${linkText(links.get(iface.key))}`,
        p.enabled ? 'normal' : 'muted'
      )
    );
  }
  return lines;
}

/**
 * `show interfaces <device>` — the NCL-standard unified view: every Port and
 * every NIC of a device in one table, whatever kind of hardware it is.
 */
function showInterfaces(topo: Topology, d: NetworkDevice): TerminalLine[] {
  const interfaces = listInterfaces(d);
  if (interfaces.length === 0) {
    return [muted(`${d.label} has no configurable interfaces`)];
  }
  const links = interfaceLinks(d, topo.devices, topo.connections);
  const lines = [
    heading(
      `${'IFACE'.padEnd(10)} ${'KIND'.padEnd(6)} ${'STATE'.padEnd(7)} ${'IP'.padEnd(16)} ${'VLAN'.padEnd(10)} ${'MODE-ZONE'.padEnd(10)} LINK`
    ),
  ];
  for (const iface of interfaces) {
    const state = (iface.enabled ? 'up' : 'down').padEnd(7);
    const ip = (iface.ip || '-').padEnd(16);
    const link = linkText(links.get(iface.key));
    if (iface.kind === 'port') {
      const p = iface.port;
      const vlan = p.vlan === undefined ? '-' : Array.isArray(p.vlan) ? p.vlan.join(',') : String(p.vlan);
      const modeZone = p.portType ?? p.securityZone ?? '-';
      lines.push(
        line(
          `${String(p.id).padEnd(10)} ${'port'.padEnd(6)} ${state} ${ip} ${vlan.padEnd(10)} ${modeZone.padEnd(10)} ${link}`,
          iface.enabled ? 'normal' : 'muted'
        )
      );
    } else {
      lines.push(
        line(
          `${iface.nic.name.padEnd(10)} ${'nic'.padEnd(6)} ${state} ${ip} ${'-'.padEnd(10)} ${'-'.padEnd(10)} ${link}`,
          iface.enabled ? 'normal' : 'muted'
        )
      );
    }
  }
  return lines;
}

/** `show ip <device>` — compact addressing summary (also ipconfig/ifconfig). */
function showIp(d: NetworkDevice): TerminalLine[] {
  const lines = [heading(`${d.label} — addressing`)];
  lines.push(line(`  ip:       ${d.ip || '-'}`));
  lines.push(line(`  subnet:   ${d.subnet || '-'}`));
  lines.push(line(`  gateway:  ${d.gateway || '-'}`));
  // Addressed ports (router/firewall interfaces): the gateways of their networks
  for (const port of d.ports ?? []) {
    if (!port.ip) continue;
    lines.push(
      line(
        `  port ${port.id}: ${port.ip} / ${port.subnet || '-'}${port.enabled ? '' : ' (disabled)'}`,
        port.enabled ? 'normal' : 'muted'
      )
    );
  }
  for (const nic of d.nics ?? []) {
    lines.push(
      line(
        `  ${nic.name}: ${nic.ip || '-'} / ${nic.subnet || '-'} gw ${nic.gateway || '-'}${nic.enabled ? '' : ' (disabled)'}`,
        nic.enabled ? 'normal' : 'muted'
      )
    );
  }
  return lines;
}

function showNeighbors(topo: Topology, d: NetworkDevice): TerminalLine[] {
  const adjacency = buildAdjacency(topo);
  const neighbors = adjacency.get(d.id) ?? [];
  if (neighbors.length === 0) return [muted(`${d.label} has no connected neighbors`)];
  const byId = new Map(topo.devices.map((dev) => [dev.id, dev]));
  const lines = [heading(`NEIGHBORS of ${d.label} (${neighbors.length})`)];
  for (const n of neighbors) {
    const dev = byId.get(n.neighborId);
    if (dev) lines.push(line(`  ${dev.label.padEnd(24)} ${dev.type.padEnd(14)} ${primaryIp(dev) || '-'}`));
  }
  return lines;
}

function runShow(what: ShowTarget, deviceQuery: string | undefined, context: TerminalContext): TerminalLine[] {
  const topo = snapshot();
  if (what === 'devices') return showDevices(topo);
  if (what === 'vlans') return showVlans(topo);

  // Remaining targets accept/require a device (context as fallback)
  let device: NetworkDevice | undefined;
  if (deviceQuery) {
    const res = resolveOrError(deviceQuery, topo);
    if ('errorLines' in res) return res.errorLines;
    device = res.device;
  } else {
    device = contextDevice(context, topo);
  }

  if (what === 'connections') return showConnections(topo, device);
  if (!device) return [err(`specify a device: "show ${what} <device>" — or enter a context with "use <device>"`)];
  if (what === 'config') return showConfig(device);
  if (what === 'ports') return showPorts(topo, device);
  if (what === 'interfaces') return showInterfaces(topo, device);
  if (what === 'ip') return showIp(device);
  return showNeighbors(topo, device);
}

/* ── configuration commands ───────────────────────────────────────────── */

function runSet(property: 'ip' | 'gateway' | 'subnet' | 'name', deviceQuery: string | undefined, value: string, context: TerminalContext): TerminalLine[] {
  const topo = snapshot();
  const query = deviceQuery ?? context.deviceLabel ?? undefined;
  if (!query) return [err(`specify a device: "set ${property} of <device> to <value>"`)];
  const res = resolveOrError(query, topo);
  if ('errorLines' in res) return res.errorLines;
  const device = res.device;

  if (property === 'name') {
    useNetworkStore.getState().updateDevice(device.id, { label: value });
    return [ok(`${device.label} renamed to "${value}"`)];
  }

  if ((property === 'ip' || property === 'gateway') && !isValidIP(value)) {
    return [err(`"${value}" is not a valid IPv4 address`)];
  }
  if (property === 'ip' && device.nics && device.nics.length > 0) {
    return [
      err(`${device.label} uses NICs — the device-level IP is read-only`),
      muted('  edit the NIC in the Inspector instead (per-NIC terminal config coming later)'),
    ];
  }

  // A device with NICs is addressed through them: the engine reads the NIC a
  // link is bound to, and the device-level field is only its mirror. Write
  // the primary NIC (the one the Inspector shows as the device addressing)
  // too, otherwise the change would not reach the simulation.
  const updates: Partial<NetworkDevice> = { [property]: value };
  if (device.nics && device.nics.length > 0) {
    updates.nics = device.nics.map((nic, index) =>
      index === 0 ? { ...nic, [property]: value } : nic
    );
  }
  useNetworkStore.getState().updateDevice(device.id, updates);
  return [ok(`${device.label}: ${property} set to ${value}`)];
}

function runVlan(action: 'add' | 'remove', vlanId: number, deviceQuery: string | undefined, context: TerminalContext): TerminalLine[] {
  const topo = snapshot();
  const query = deviceQuery ?? context.deviceLabel ?? undefined;
  if (!query) return [err(`specify a device: "${action} vlan ${vlanId} ${action === 'add' ? 'to' : 'from'} <device>"`)];
  const res = resolveOrError(query, topo);
  if ('errorLines' in res) return res.errorLines;
  const device = res.device;
  const current = device.vlan ?? [];

  if (action === 'add') {
    if (current.includes(vlanId)) return [muted(`${device.label} is already a member of VLAN ${vlanId}`)];
    const next = [...current, vlanId].sort((a, b) => a - b);
    useNetworkStore.getState().updateDevice(device.id, { vlan: next });
    return [ok(`${device.label}: added to VLAN ${vlanId} (now [${next.join(', ')}])`)];
  }
  if (!current.includes(vlanId)) return [muted(`${device.label} is not a member of VLAN ${vlanId}`)];
  const next = current.filter((v) => v !== vlanId);
  useNetworkStore.getState().updateDevice(device.id, { vlan: next });
  return [ok(`${device.label}: removed from VLAN ${vlanId}${next.length > 0 ? ` (now [${next.join(', ')}])` : ' (no VLANs left — untagged)'}`)];
}

function runConnect(action: 'connect' | 'disconnect', aQuery: string, bQuery: string): TerminalLine[] {
  const topo = snapshot();
  const resA = resolveOrError(aQuery, topo);
  if ('errorLines' in resA) return resA.errorLines;
  const resB = resolveOrError(bQuery, topo);
  if ('errorLines' in resB) return resB.errorLines;
  const [a, b] = [resA.device, resB.device];
  if (a.id === b.id) return [err('cannot connect a device to itself')];

  const existing = topo.connections.find(
    (c) => (c.source === a.id && c.target === b.id) || (c.source === b.id && c.target === a.id)
  );

  if (action === 'connect') {
    if (existing) return [muted(`${a.label} and ${b.label} are already connected`)];
    useNetworkStore.getState().addConnection({ source: a.id, target: b.id });

    // Report the interface the store bound each end to
    const created = useNetworkStore
      .getState()
      .connections.filter((c) => c.source === a.id && c.target === b.id)
      .pop();
    const ifaceA = created ? boundInterface(created, a, 'source') : undefined;
    const ifaceB = created ? boundInterface(created, b, 'target') : undefined;
    const lines = [
      ok(`connected ${a.label} (${ifaceA?.label ?? 'unbound'}) ↔ ${b.label} (${ifaceB?.label ?? 'unbound'})`),
    ];
    for (const [device, iface] of [
      [a, ifaceA],
      [b, ifaceB],
    ] as const) {
      if (iface) continue;
      const reason = listInterfaces(device).length === 0 ? 'has no interfaces' : 'has no free interface';
      lines.push(muted(`  ${device.label} ${reason}: that end is not bound, per-port rules are skipped there`));
    }
    return lines;
  }
  if (!existing) return [muted(`${a.label} and ${b.label} are not connected`)];
  useNetworkStore.getState().removeConnection(existing.id);
  return [ok(`disconnected ${a.label} ↔ ${b.label}`)];
}

function runPort(action: 'enable' | 'disable', portId: number, deviceQuery: string | undefined, context: TerminalContext): TerminalLine[] {
  const topo = snapshot();
  const query = deviceQuery ?? context.deviceLabel ?? undefined;
  if (!query) return [err(`specify a device: "${action} port ${portId} on <device>"`)];
  const res = resolveOrError(query, topo);
  if ('errorLines' in res) return res.errorLines;
  const device = res.device;

  if (!device.ports || device.ports.length === 0) return [err(`${device.label} has no configurable ports`)];
  const port = device.ports.find((p) => p.id === portId);
  if (!port) return [err(`${device.label} has no port ${portId} (ports 1-${device.ports.length})`)];
  const enabled = action === 'enable';
  if (port.enabled === enabled) return [muted(`port ${portId} on ${device.label} is already ${enabled ? 'up' : 'down'}`)];

  const ports = device.ports.map((p) => (p.id === portId ? { ...p, enabled } : p));
  useNetworkStore.getState().updateDevice(device.id, { ports });
  return [ok(`port ${portId} on ${device.label} is now ${enabled ? 'up' : 'down'}`)];
}

/* ── help ─────────────────────────────────────────────────────────────── */

const HELP: Array<[string, string]> = [
  ['ping <target> [from <device>]', 'test reachability (VLAN/subnet/firewall aware)'],
  ['trace <target> [from <device>]', 'hop-by-hop path evaluation with verdicts'],
  ['show devices | vlans | connections', 'topology overview'],
  ['show interfaces [of] <device>', 'unified ports + NICs table (the standard view)'],
  ['show ip [of] <device>', 'compact addressing summary (also ipconfig/ifconfig)'],
  ['show config | ports | neighbors <device>', 'device detail'],
  ['set ip|gateway|subnet|name of <device> to <value>', 'change device config'],
  ['add vlan <id> to <device>', 'VLAN membership (remove vlan <id> from <device>)'],
  ['connect <A> to <B>', 'create a link (disconnect <A> from <B>)'],
  ['interface <n> up|down on <device>', 'interface state (also enable|disable port <n>)'],
  ['use <device> / exit', 'enter/leave device context (implies "from")'],
  ['clear, help [command]', 'screen and this reference'],
];

function runHelp(topic?: string): TerminalLine[] {
  if (topic) {
    const match = HELP.filter(([syntax]) => syntax.toLowerCase().includes(topic.toLowerCase()));
    if (match.length > 0) {
      return match.map(([syntax, desc]) => line(`${syntax.padEnd(50)} ${desc}`));
    }
    return [err(`no help for "${topic}" — try "help" for the full list`)];
  }
  return [
    heading('PixelCake terminal — NCL v0.1 (Network Command Language, vendor-neutral)'),
    ...HELP.map(([syntax, desc]) => line(`  ${syntax.padEnd(50)} ${desc}`)),
    muted('  device names are case-insensitive and may be multi-word; IPs work anywhere a device is expected'),
  ];
}

/* ── entry point ──────────────────────────────────────────────────────── */

export function executeCommand(rawInput: string, context: TerminalContext): ExecutionResult {
  const command: Command = parse(rawInput);

  switch (command.kind) {
    case 'empty':
      return { lines: [], context };
    case 'clear':
      return { lines: [], context, clear: true };
    case 'help':
      return { lines: runHelp(command.topic), context };
    case 'exit':
      if (!context.deviceLabel) return { lines: [muted('already at global scope')], context };
      return { lines: [muted(`left ${context.deviceLabel}`)], context: { deviceLabel: null } };
    case 'use': {
      const topo = snapshot();
      const res = resolveOrError(command.device, topo);
      if ('errorLines' in res) return { lines: res.errorLines, context };
      return {
        lines: [ok(`context: ${res.device.label} — "from" is now implied, "exit" to leave`)],
        context: { deviceLabel: res.device.label },
      };
    }
    case 'ping':
      return { ...runDiagnostic('ping', command.target, command.from, context), context };
    case 'trace':
      return { ...runDiagnostic('trace', command.target, command.from, context), context };
    case 'show':
      return { lines: runShow(command.what, command.device, context), context };
    case 'set':
      return { lines: runSet(command.property, command.device, command.value, context), context };
    case 'vlan-add':
      return { lines: runVlan('add', command.vlanId, command.device, context), context };
    case 'vlan-remove':
      return { lines: runVlan('remove', command.vlanId, command.device, context), context };
    case 'connect':
      return { lines: runConnect('connect', command.a, command.b), context };
    case 'disconnect':
      return { lines: runConnect('disconnect', command.a, command.b), context };
    case 'port-enable':
      return { lines: runPort('enable', command.port, command.device, context), context };
    case 'port-disable':
      return { lines: runPort('disable', command.port, command.device, context), context };
    case 'unknown': {
      const lines = [err(`unknown command: "${command.input}"`)];
      if (command.suggestion) lines.push(muted(`  ${command.suggestion}`));
      lines.push(muted('  type "help" for the command list'));
      return { lines, context };
    }
  }
}
