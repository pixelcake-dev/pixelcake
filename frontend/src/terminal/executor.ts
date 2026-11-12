/**
 * Terminal Executor
 * Bridges parser → engine → stores. This is the ONLY terminal layer allowed
 * to touch Zustand; parser and engine stay pure. Configuration commands go
 * through the same store actions as canvas edits, so they are saved with the
 * drawing like any graphical edit.
 */

import { useNetworkStore } from '@/store/networkStore';
import {
  resolveEndpoint,
  suggestEndpoint,
  buildAdjacency,
  primaryIp,
  primaryAddress,
  ownedAddresses,
  traceRoute,
  planAndEvaluateFlow,
  boundInterface,
  interfaceLinks,
  listInterfaces,
  routingTable,
  isBackupRoute,
  hasInterfaceAddresses,
  formatNetwork,
  canonicalNetwork,
  parseNetwork,
  networkContains,
  prefixToMask,
  isL3Capable,
  isSwitchLike,
  isVlanAware,
  portVlanMode,
  describePortVlan,
  describeRule,
  isValidRuleEndpoint,
  DEFAULT_MASK,
} from '@/engine';
import type { Topology, TraceResult, InterfaceLink, DeviceInterface, FlowResult } from '@/engine';
import { isValidIP } from '@/utils/ipHelpers';
import { liveTopology } from '@/utils/liveTopology';
import { parse } from './parser';
import type { Command, InterfaceSetting, TerminalLine, ShowTarget } from './types';
import type {
  FirewallRule,
  FlowModelType,
  NetworkDevice,
  NetworkInterfaceCard,
  Port,
  ServiceName,
  StaticRoute,
} from '@/types';

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
  /** The cable of each stretch of `animationPath`, as the engine took them */
  animationLinks?: string[];
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

/**
 * What the commands look at: the canvas on screen, and the failures simulated
 * in presentation mode while it is on, so a ping typed there agrees with the
 * picture.
 */
function snapshot(): Topology {
  return liveTopology();
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

/**
 * The device a configuration command acts on: the one named in the command,
 * else the `use` context. `usage` completes "specify a device: …".
 */
function targetDevice(
  deviceQuery: string | undefined,
  context: TerminalContext,
  usage: string
): { device: NetworkDevice; topo: Topology } | { errorLines: TerminalLine[] } {
  const topo = snapshot();
  const query = deviceQuery ?? context.deviceLabel ?? undefined;
  if (!query) return { errorLines: [err(`specify a device: "${usage}"`)] };
  const res = resolveOrError(query, topo);
  if ('errorLines' in res) return res;
  return { device: res.device, topo };
}

/** An address typed where a device is expected is the address to aim at */
function typedAddress(query: string): string | undefined {
  const value = query.trim();
  return isValidIP(value) ? value : undefined;
}

/* ── diagnostics rendering ────────────────────────────────────────────── */

/** Format one trace hop as a terminal line */
function hopLine(hop: TraceResult['hops'][number], index: number): TerminalLine {
  const icon = hop.status === 'blocked' ? '✗' : hop.status === 'delivered' ? '●' : '○';
  const tone = hop.status === 'blocked' ? 'error' : hop.status === 'delivered' ? 'success' : 'normal';
  const note = hop.note ? `  — ${hop.note}` : '';
  return line(` ${String(index + 1).padStart(2)}  ${icon} ${hop.label} (${hop.deviceType})${note}`, tone);
}

/** Source and target of a diagnostic, resolved, or the lines saying why not */
function resolveEnds(
  verb: string,
  target: string,
  from: string | undefined,
  context: TerminalContext
):
  | { topo: Topology; source: NetworkDevice; destination: NetworkDevice; targetIp?: string }
  | { errorLines: TerminalLine[] } {
  const topo = snapshot();
  const sourceQuery = from ?? context.deviceLabel ?? undefined;
  if (!sourceQuery) {
    return {
      errorLines: [
        err(`specify a source: "${verb} ${target} from <device>" — or enter a device context with "use <device>"`),
      ],
    };
  }
  const src = resolveOrError(sourceQuery, topo);
  if ('errorLines' in src) return src;
  const dst = resolveOrError(target, topo);
  if ('errorLines' in dst) return dst;
  return { topo, source: src.device, destination: dst.device, targetIp: typedAddress(target) };
}

/** The lines that close a failed flow: where it was dropped */
function droppedAt(flow: FlowResult): TerminalLine[] {
  const blocked = flow.legs.flatMap((l) => l.trace.hops).find((h) => h.status === 'blocked');
  return blocked ? [muted(`  dropped at: ${blocked.label}`)] : [];
}

function runDiagnostic(
  kind: 'ping' | 'trace',
  target: string,
  from: string | undefined,
  context: TerminalContext,
  service?: ServiceName
): { lines: TerminalLine[]; liveTrace?: LiveTrace } {
  const ends = resolveEnds(kind, target, from, context);
  if ('errorLines' in ends) return { lines: ends.errorLines };
  const { topo, source, destination, targetIp } = ends;
  const shownIp = targetIp ?? primaryAddress(destination);
  const lines: TerminalLine[] = [];

  if (kind === 'ping') {
    // Echo semantics: both directions evaluated, round trip animated
    const flow = planAndEvaluateFlow('ping', source.id, destination.id, topo, { targetIp });
    lines.push(muted(`Pinging ${destination.label} (${shownIp || 'no ip'}) from ${source.label}...`));

    const finalLines: TerminalLine[] = [];
    if (flow.verdict === 'success') {
      const requestHops = flow.legs[0]?.trace.hops.length ?? 1;
      const rttMs = 1 + 2 * Math.max(0, requestHops - 2);
      finalLines.push(ok(`Reply from ${shownIp}: hops=${requestHops} time=${rttMs}ms`));
    } else {
      finalLines.push(err(`Ping failed (${flow.verdict}): ${flow.failureReason ?? 'unknown reason'}`));
      finalLines.push(...droppedAt(flow));
    }
    for (const note of flow.notes) finalLines.push(muted(`  note: ${note}`));

    if (flow.animationPath.length >= 2) {
      return {
        lines,
        liveTrace: {
          animationPath: flow.animationPath,
          animationLinks: flow.animationLinks,
          flowModel: 'ping',
          hopLines: [],
          finalLines,
        },
      };
    }
    return { lines: [...lines, ...finalLines] };
  }

  // trace: one-way, hop lines revealed as the packet travels
  const result = traceRoute(source.id, destination.id, topo, { service, targetIp });
  const asService = service ? ` as ${service}` : '';
  lines.push(
    muted(`Tracing route to ${destination.label} (${shownIp || 'no ip'}) from ${source.label}${asService}:`)
  );

  const hopLines = result.hops.map((hop, i) => hopLine(hop, i));
  const finalLines: TerminalLine[] = result.notes.map((note) => muted(`  note: ${note}`));
  if (result.verdict === 'success') {
    finalLines.push(ok('Trace complete: destination reached.'));
  } else {
    finalLines.push(err(`Trace failed (${result.verdict}): ${result.failureReason ?? 'unknown reason'}`));
  }

  const animationPath = result.hops.map((h) => h.deviceId);
  if (animationPath.length >= 2) {
    // A web or email trace travels in the colour of its flow
    const flowModel: FlowModelType = service === 'web' || service === 'email' ? service : 'ping';
    const animationLinks = result.hops.slice(1).map((h) => h.viaConnectionId ?? '');
    return { lines, liveTrace: { animationPath, animationLinks, flowModel, hopLines, finalLines } };
  }
  return { lines: [...lines, ...hopLines, ...finalLines] };
}

const FLOW_WORDS: Record<'web' | 'email' | 'download', { verb: string; doing: string; done: string; name: string }> = {
  web: { verb: 'browse', doing: 'Browsing', done: 'Page received from', name: 'Browse' },
  email: { verb: 'mail', doing: 'Mailing', done: 'Mail delivered to', name: 'Mail' },
  download: { verb: 'download', doing: 'Downloading from', done: 'Download complete from', name: 'Download' },
};

/** `browse|mail|download`: a whole exchange, one line per leg */
function runFlow(
  model: 'web' | 'email' | 'download',
  target: string,
  from: string | undefined,
  context: TerminalContext
): { lines: TerminalLine[]; liveTrace?: LiveTrace } {
  const words = FLOW_WORDS[model];
  const ends = resolveEnds(words.verb, target, from, context);
  if ('errorLines' in ends) return { lines: ends.errorLines };
  const { topo, source, destination, targetIp } = ends;
  const shownIp = targetIp ?? primaryAddress(destination);

  const emailMode = useNetworkStore.getState().globalNetworkSettings.emailMode ?? 'auto';
  const flow = planAndEvaluateFlow(model, source.id, destination.id, topo, {
    emailMode,
    targetIp: model === 'email' ? undefined : targetIp,
  });
  const lines = [muted(`${words.doing} ${destination.label} (${shownIp || 'no ip'}) from ${source.label}...`)];

  const label = (id: string) => topo.devices.find((d) => d.id === id)?.label ?? id;
  const finalLines: TerminalLine[] = flow.legs.map((leg) => {
    const passed = leg.trace.verdict === 'success';
    return line(
      `  ${passed ? '✓' : '✗'} ${leg.purpose}: ${label(leg.fromId)} → ${label(leg.toId)}`,
      passed ? 'normal' : 'error'
    );
  });
  if (flow.verdict === 'success') {
    finalLines.push(ok(`${words.done} ${destination.label}`));
  } else {
    finalLines.push(err(`${words.name} failed (${flow.verdict}): ${flow.failureReason ?? 'unknown reason'}`));
    finalLines.push(...droppedAt(flow));
  }
  for (const note of flow.notes) finalLines.push(muted(`  note: ${note}`));

  if (flow.animationPath.length >= 2) {
    return {
      lines,
      liveTrace: {
        animationPath: flow.animationPath,
        animationLinks: flow.animationLinks,
        flowModel: model,
        hopLines: [],
        finalLines,
      },
    };
  }
  return { lines: [...lines, ...finalLines] };
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

/**
 * `show vlans`: every VLAN with where it lives — the ports of the switches
 * that apply VLANs port by port, and the devices that carry it in their own
 * list.
 */
function showVlans(topo: Topology): TerminalLine[] {
  const membership = new Map<number, string[]>();
  const add = (vlan: number, where: string) => {
    membership.set(vlan, [...(membership.get(vlan) ?? []), where]);
  };
  const footnotes: string[] = [];

  for (const d of topo.devices) {
    if (isVlanAware(d)) {
      // vlan → its access ports and the trunks that list it
      const access = new Map<number, number[]>();
      const trunks = new Map<number, number[]>();
      for (const p of d.ports ?? []) {
        const mode = portVlanMode(p);
        if (mode.kind === 'access') {
          access.set(mode.vlan, [...(access.get(mode.vlan) ?? []), p.id]);
        } else if (mode.vlans.length === 0) {
          footnotes.push(`${d.label} port ${p.id} is a trunk for every VLAN`);
        } else {
          for (const vlan of mode.vlans) trunks.set(vlan, [...(trunks.get(vlan) ?? []), p.id]);
        }
      }
      for (const vlan of new Set([...access.keys(), ...trunks.keys()])) {
        const parts: string[] = [];
        const accessPorts = access.get(vlan);
        const trunkPorts = trunks.get(vlan);
        if (accessPorts) parts.push(`port${accessPorts.length > 1 ? 's' : ''} ${accessPorts.join(',')}`);
        if (trunkPorts) parts.push(`trunk ${trunkPorts.join(',')}`);
        add(vlan, `${d.label} (${parts.join('; ')})`);
      }
    }
    for (const vlan of d.vlan ?? []) {
      if (!(membership.get(vlan) ?? []).some((where) => where.startsWith(`${d.label} (`))) {
        add(vlan, d.label);
      }
    }
  }

  if (membership.size === 0) return [muted('no VLANs configured (all traffic untagged)')];
  const lines = [heading(`${'VLAN'.padEnd(6)} MEMBERS`)];
  for (const [id, members] of [...membership.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(line(`${String(id).padEnd(6)} ${members.join(', ')}`));
  }
  for (const note of footnotes) lines.push(muted(`  ${note}`));
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
  if (d.stp?.enabled) {
    lines.push(line(`  stp:      ${d.stp.mode ?? 'STP'} priority ${d.stp.priority ?? 32768} (not simulated)`));
  }
  if (d.ports && d.ports.length > 0) {
    const enabled = d.ports.filter((p) => p.enabled).length;
    lines.push(line(`  ports:    ${enabled}/${d.ports.length} enabled — "show ports ${d.label}" for detail`));
  }
  for (const nic of d.nics ?? []) {
    lines.push(line(`  nic ${nic.name}: ${nic.ip || '-'} / ${nic.subnet || '-'} gw ${nic.gateway || '-'} ${nic.enabled ? '' : '(disabled)'}`));
  }
  if (d.routes && d.routes.length > 0) {
    lines.push(line(`  routes:   ${d.routes.length} static — "show routes ${d.label}" for the whole table`));
  }
  if (d.firewallRules && d.firewallRules.length > 0) {
    lines.push(line(`  rules:    ${d.firewallRules.length} — "show rules ${d.label}" for detail`));
  }
  return lines;
}

/** The VLAN cell of a port: its own, or the default one on a VLAN-aware switch */
function portVlanText(d: NetworkDevice, p: Port): string {
  if (p.vlan !== undefined && !(Array.isArray(p.vlan) && p.vlan.length === 0)) {
    return Array.isArray(p.vlan) ? p.vlan.join(',') : String(p.vlan);
  }
  const mode = portVlanMode(p);
  if (mode.kind === 'trunk') return 'all';
  return isVlanAware(d) ? String(mode.vlan) : '-';
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
    lines.push(
      line(
        `${String(p.id).padEnd(6)} ${(p.enabled ? 'up' : 'down').padEnd(10)} ${(p.portType ?? '-').padEnd(8)} ${portVlanText(d, p).padEnd(10)} ${(p.securityZone ?? '-').padEnd(8)} ${(iface.ip || '-').padEnd(16)} ${linkText(links.get(iface.key))}`,
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
      const modeZone = p.portType ?? p.securityZone ?? '-';
      lines.push(
        line(
          `${String(p.id).padEnd(10)} ${'port'.padEnd(6)} ${state} ${ip} ${portVlanText(d, p).padEnd(10)} ${modeZone.padEnd(10)} ${link}`,
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

/** `show routes <device>` — the routing table exactly as the engine reads it */
function showRoutes(d: NetworkDevice): TerminalLine[] {
  const lines = [heading(`ROUTES of ${d.label}`)];
  if (isL3Capable(d) && !hasInterfaceAddresses(d)) {
    lines.push(muted(`  ${d.label} has no interface addresses: it lets traffic through, its routes are not used`));
    lines.push(muted(`  give a port its address with: interface <n> ip <address>/<prefix> on ${d.label}`));
  }

  const table = routingTable(d);
  if (table.length === 0) {
    lines.push(muted('  no routes: the device has no address'));
  } else {
    lines.push(heading(`${'DESTINATION'.padEnd(20)} ${'VIA'.padEnd(16)} ${'OUT'.padEnd(8)} KIND`));
  }
  table.forEach((entry, index) => {
    const out = entry.out ? (entry.out.iface?.label ?? '-') : '?';
    const base = entry.kind === 'default' && !entry.route ? 'default (gateway)' : entry.kind;
    // A second route to the same network waits for the line of the first to go down
    const kind = isBackupRoute(table, index) ? `${base}, backup` : base;
    const row = `${formatNetwork(entry.network).padEnd(20)} ${(entry.nextHop ?? '-').padEnd(16)} ${out.padEnd(8)} ${kind}`;
    if (!entry.out) {
      lines.push(err(`${row}  ✗ next hop on none of its networks`));
    } else if (!entry.out.enabled) {
      lines.push(muted(`${row}  (interface down)`));
    } else {
      lines.push(line(row));
    }
  });
  // Routes the engine refuses: say so instead of hiding them
  for (const route of d.routes ?? []) {
    if (!parseNetwork(route.destination) || !isValidIP(route.nextHop)) {
      lines.push(err(`  ✗ "${route.destination} via ${route.nextHop}" is not a network and an address: ignored`));
    }
  }
  return lines;
}

const ZONE_POLICY =
  'zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed';

/** `show rules <device>` — the rules in order, then what decides when none matches */
function showRules(d: NetworkDevice): TerminalLine[] {
  const rules = d.firewallRules ?? [];
  const isFirewall = d.type.toLowerCase().includes('firewall');
  if (!isFirewall && rules.length === 0) {
    return [muted(`${d.label} is not a firewall and has no rules: it filters nothing`)];
  }
  const lines = [heading(`RULES of ${d.label} (the first that matches decides)`)];
  if (rules.length === 0) lines.push(muted('  no rules'));
  rules.forEach((rule, index) => {
    const row =
      `  ${String(index + 1).padStart(2)}  ${rule.action.padEnd(5)} ${rule.service.padEnd(6)} ` +
      `from ${rule.source.padEnd(18)} to ${rule.destination}`;
    lines.push(rule.enabled === false ? muted(`${row}  (disabled)`) : line(row));
  });
  lines.push(muted(`  then the ${ZONE_POLICY}`));
  lines.push(muted('  the reply to an allowed flow always passes'));
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
  if (what === 'routes') return showRoutes(device);
  if (what === 'rules') return showRules(device);
  return showNeighbors(topo, device);
}

/* ── configuration commands ───────────────────────────────────────────── */

/** "  warning: 10.0.0.1 is also the address of R2" when another device has it */
function duplicateAddressWarning(ip: string, device: NetworkDevice, topo: Topology): TerminalLine[] {
  const other = topo.devices.find((d) => d.id !== device.id && ownedAddresses(d).includes(ip));
  return other ? [muted(`  warning: ${ip} is also the address of ${other.label}`)] : [];
}

function runSet(property: 'ip' | 'gateway' | 'subnet' | 'name', deviceQuery: string | undefined, value: string, context: TerminalContext): TerminalLine[] {
  const found = targetDevice(deviceQuery, context, `set ${property} of <device> to <value>`);
  if ('errorLines' in found) return found.errorLines;
  const { device, topo } = found;

  if (property === 'name') {
    useNetworkStore.getState().updateDevice(device.id, { label: value });
    return [ok(`${device.label} renamed to "${value}"`)];
  }

  if ((property === 'ip' || property === 'gateway') && !isValidIP(value)) {
    return [err(`"${value}" is not a valid IPv4 address`)];
  }

  // A device with NICs is addressed through them: the engine reads the NIC,
  // and the device-level field is only its mirror. Write the primary NIC (the
  // one the Inspector shows as the device addressing), otherwise the change
  // would not reach the simulation.
  const updates: Partial<NetworkDevice> = { [property]: value };
  const primaryNic = device.nics?.[0];
  if (device.nics && primaryNic) {
    updates.nics = device.nics.map((nic, index) =>
      index === 0 ? { ...nic, [property]: value } : nic
    );
  }
  useNetworkStore.getState().updateDevice(device.id, updates);
  const lines = [ok(`${device.label}: ${property} set to ${value}`)];
  if (property === 'ip') lines.push(...duplicateAddressWarning(value, device, topo));
  if (property === 'gateway' && isL3Capable(device)) {
    lines.push(muted(`  the gateway of a router is its default route — "show routes ${device.label}"`));
  }
  return lines;
}

function runVlan(action: 'add' | 'remove', vlanId: number, deviceQuery: string | undefined, context: TerminalContext): TerminalLine[] {
  const found = targetDevice(
    deviceQuery,
    context,
    `${action} vlan ${vlanId} ${action === 'add' ? 'to' : 'from'} <device>`
  );
  if ('errorLines' in found) return found.errorLines;
  const { device } = found;
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
  const found = targetDevice(deviceQuery, context, `${action} port ${portId} on <device>`);
  if ('errorLines' in found) return found.errorLines;
  const { device } = found;

  if (!device.ports || device.ports.length === 0) return [err(`${device.label} has no configurable ports`)];
  const port = device.ports.find((p) => p.id === portId);
  if (!port) return [err(`${device.label} has no port ${portId} (ports 1-${device.ports.length})`)];
  const enabled = action === 'enable';
  if (port.enabled === enabled) return [muted(`port ${portId} on ${device.label} is already ${enabled ? 'up' : 'down'}`)];

  const ports = device.ports.map((p) => (p.id === portId ? { ...p, enabled } : p));
  useNetworkStore.getState().updateDevice(device.id, { ports });
  return [ok(`port ${portId} on ${device.label} is now ${enabled ? 'up' : 'down'}`)];
}

/* ── interfaces ───────────────────────────────────────────────────────── */

/** The port (by number) or NIC (by name or id) the user means */
function findInterface(device: NetworkDevice, id: string): DeviceInterface | undefined {
  const interfaces = listInterfaces(device);
  if (/^\d+$/.test(id)) {
    const port = interfaces.find((i) => i.kind === 'port' && i.port.id === parseInt(id, 10));
    if (port) return port;
  }
  const lower = id.toLowerCase();
  return interfaces.find(
    (i) => i.kind === 'nic' && (i.nic.name.toLowerCase() === lower || i.nic.id.toLowerCase() === lower)
  );
}

/** "ports 1-8" / "eth0, eth1", for "no such interface" errors */
function interfaceNames(device: NetworkDevice): string {
  const parts: string[] = [];
  const ports = device.ports ?? [];
  if (ports.length > 0) parts.push(`ports ${ports[0].id}-${ports[ports.length - 1].id}`);
  const nics = (device.nics ?? []).map((nic) => nic.name);
  if (nics.length > 0) parts.push(nics.join(', '));
  return parts.length > 0 ? parts.join(', ') : 'none';
}

/** Copy of `source` without the given keys */
function without<T extends object>(source: T, ...keys: Array<keyof T>): T {
  const copy = { ...source };
  for (const key of keys) delete copy[key];
  return copy;
}

function savePort(device: NetworkDevice, port: Port): void {
  const ports = (device.ports ?? []).map((p) => (p.id === port.id ? port : p));
  useNetworkStore.getState().updateDevice(device.id, { ports });
}

function saveNic(device: NetworkDevice, nic: NetworkInterfaceCard): void {
  const nics = (device.nics ?? []).map((n) => (n.id === nic.id ? nic : n));
  useNetworkStore.getState().updateDevice(device.id, { nics });
}

function runInterface(
  ifaceId: string,
  setting: InterfaceSetting,
  deviceQuery: string | undefined,
  context: TerminalContext
): TerminalLine[] {
  const found = targetDevice(deviceQuery, context, `interface ${ifaceId} … on <device>`);
  if ('errorLines' in found) return found.errorLines;
  const { device, topo } = found;

  const iface = findInterface(device, ifaceId);
  if (!iface) {
    return [err(`${device.label} has no interface "${ifaceId}" (it has: ${interfaceNames(device)})`)];
  }
  const name = `${iface.kind === 'port' ? iface.label : `interface ${iface.label}`} on ${device.label}`;

  switch (setting.what) {
    case 'state': {
      if (iface.enabled === setting.up) return [muted(`${name} is already ${setting.up ? 'up' : 'down'}`)];
      if (iface.kind === 'port') savePort(device, { ...iface.port, enabled: setting.up });
      else saveNic(device, { ...iface.nic, enabled: setting.up });
      return [ok(`${name} is now ${setting.up ? 'up' : 'down'}`)];
    }

    case 'ip': {
      if (iface.kind === 'port' && !isL3Capable(device)) {
        return [
          err(`${device.label} is a ${device.type}: its ports carry no address`),
          muted(`  its own address is set with: set ip of ${device.label} to <address>`),
        ];
      }
      if (setting.address === null) {
        if (iface.kind === 'port') savePort(device, without(iface.port, 'ip', 'subnet'));
        else saveNic(device, { ...iface.nic, ip: '' });
        return [ok(`${name} has no address now`)];
      }
      if (!isValidIP(setting.address)) return [err(`"${setting.address}" is not a valid IPv4 address`)];
      // The mask: the prefix typed, else the one already there, else /24
      const subnet =
        setting.prefix !== undefined ? prefixToMask(setting.prefix) : iface.subnet || DEFAULT_MASK;
      if (iface.kind === 'port') savePort(device, { ...iface.port, ip: setting.address, subnet });
      else saveNic(device, { ...iface.nic, ip: setting.address, subnet });
      return [
        ok(`${name}: ${setting.address} / ${subnet}`),
        ...duplicateAddressWarning(setting.address, device, topo),
      ];
    }

    case 'gateway': {
      if (iface.kind === 'port') {
        return [
          err(`${name} is a port: ports have no gateway`),
          muted(`  the default route of ${device.label} is: set gateway of ${device.label} to <address>`),
        ];
      }
      if (setting.address === null) {
        saveNic(device, { ...iface.nic, gateway: '' });
        return [ok(`${name} has no gateway now`)];
      }
      if (!isValidIP(setting.address)) return [err(`"${setting.address}" is not a valid IPv4 address`)];
      saveNic(device, { ...iface.nic, gateway: setting.address });
      return [ok(`${name}: gateway ${setting.address}`)];
    }

    case 'access':
    case 'trunk':
    case 'no-vlan': {
      if (iface.kind !== 'port' || !isSwitchLike(device)) {
        return [err(`VLANs are set on the ports of a switch: ${device.label} is a ${device.type}`)];
      }
      const wasAware = isVlanAware(device);
      let port: Port;
      if (setting.what === 'access') {
        port = { ...iface.port, portType: 'access', vlan: setting.vlan };
      } else if (setting.what === 'trunk') {
        port =
          setting.vlans.length > 0
            ? { ...iface.port, portType: 'trunk', vlan: setting.vlans }
            : { ...without(iface.port, 'vlan'), portType: 'trunk' };
      } else {
        port = { ...without(iface.port, 'vlan'), portType: 'access' };
      }
      savePort(device, port);

      const after = { ...device, ports: (device.ports ?? []).map((p) => (p.id === port.id ? port : p)) };
      const lines = [
        ok(
          setting.what === 'no-vlan'
            ? `${name} has no VLAN of its own now`
            : `${name} is now ${describePortVlan(portVlanMode(port))}`
        ),
      ];
      if (!wasAware && isVlanAware(after)) {
        lines.push(muted(`  ${device.label} now applies VLANs port by port: the ports you did not set are in VLAN 1`));
      } else if (wasAware && !isVlanAware(after)) {
        lines.push(muted(`  no port of ${device.label} has a VLAN any more: it forwards everything as it comes`));
      }
      return lines;
    }

    case 'zone': {
      if (iface.kind !== 'port' || !device.type.toLowerCase().includes('firewall')) {
        return [err(`security zones are set on the ports of a firewall: ${device.label} is a ${device.type}`)];
      }
      if (setting.zone === null) {
        savePort(device, without(iface.port, 'securityZone'));
        return [ok(`${name} is in no security zone now`)];
      }
      savePort(device, { ...iface.port, securityZone: setting.zone });
      return [ok(`${name} is now in zone ${setting.zone}`)];
    }
  }
}

/* ── routes ───────────────────────────────────────────────────────────── */

/** Lowest `prefix-N` id not in use */
function nextId(prefix: string, used: Array<{ id: string }>): string {
  let n = 1;
  while (used.some((entry) => entry.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}



function runRoute(
  action: 'add' | 'remove',
  destination: string,
  nextHop: string | undefined,
  deviceQuery: string | undefined,
  context: TerminalContext,
  /** `add backup route`: a second route to the network, after the one it has */
  backup = false
): TerminalLine[] {
  const usage =
    action === 'add'
      ? `add ${backup ? 'backup ' : ''}route ${destination} via ${nextHop ?? '<next hop>'} on <device>`
      : `remove route ${destination} from <device>`;
  const found = targetDevice(deviceQuery, context, usage);
  if ('errorLines' in found) return found.errorLines;
  const { device, topo } = found;

  const network = parseNetwork(destination);
  if (!network) {
    return [err(`"${destination}" is not a network: write it as 192.168.30.0/24, or "default"`)];
  }
  const canonical = canonicalNetwork(network);
  const routes = device.routes ?? [];
  const same = (route: StaticRoute) => {
    const parsed = parseNetwork(route.destination);
    return parsed !== undefined && canonicalNetwork(parsed) === canonical;
  };
  const name = formatNetwork(network);

  if (action === 'remove') {
    const toSame = routes.filter(same);
    if (toSame.length === 0) return [muted(`${device.label} has no route to ${name}`)];
    // With a next hop only the route through it goes; without, every route to the network
    const leaving = nextHop === undefined ? toSame : toSame.filter((route) => route.nextHop === nextHop);
    if (leaving.length === 0) return [muted(`${device.label} has no route to ${name} via ${nextHop}`)];
    const remaining = routes.filter((route) => !leaving.includes(route));
    useNetworkStore.getState().updateDevice(device.id, { routes: remaining.length > 0 ? remaining : undefined });
    if (nextHop !== undefined) return [ok(`${device.label}: route to ${name} via ${nextHop} removed`)];
    return [
      ok(
        leaving.length === 1
          ? `${device.label}: route to ${name} removed`
          : `${device.label}: ${leaving.length} routes to ${name} removed`
      ),
    ];
  }

  if (!isL3Capable(device)) {
    return [
      err(`${device.label} is a ${device.type}: routes belong on routers and firewalls`),
      muted(`  an end device has one way out, its gateway: set gateway of ${device.label} to <address>`),
    ];
  }

  // The next hop: an address, or a device with an address on one of this device's networks
  let hop = nextHop ?? '';
  const lines: TerminalLine[] = [];
  if (!isValidIP(hop)) {
    const named = resolveEndpoint(hop, topo)?.device;
    const connected = routingTable(device).filter((entry) => entry.kind === 'connected');
    const shared = named
      ? ownedAddresses(named).find((ip) => isValidIP(ip) && connected.some((entry) => networkContains(entry.network, ip)))
      : undefined;
    if (!named) return [err(`"${hop}" is not an address, nor a device on the canvas`)];
    if (!shared) {
      return [err(`${named.label} has no address on a network of ${device.label}: give the next hop as an address`)];
    }
    lines.push(muted(`  ${named.label} → ${shared}`));
    hop = shared;
  }

  // The first route to a network is the one used; any other is its backup
  const toSame = routes.filter(same);
  const existing = toSame[0];
  const twin = toSame.find((route) => route.nextHop === hop);
  let next: StaticRoute[];
  if (backup) {
    if (twin) return [...lines, muted(`${device.label} already has a route to ${name} via ${hop}`)];
    next = [...routes, { id: nextId('route', routes), destination: canonical, nextHop: hop }];
    if (existing) {
      lines.unshift(
        ok(`${device.label}: backup route to ${name} via ${hop} added`),
        muted(`  used when the interface of the route via ${existing.nextHop} has no working link`)
      );
    } else {
      lines.unshift(
        ok(`${device.label}: route to ${name} via ${hop} added`),
        muted(`  it is the only route to ${name}: there is nothing to back up yet`)
      );
    }
  } else {
    if (existing && twin && twin !== existing) {
      return [
        err(`${device.label} already has a backup route to ${name} via ${hop}`),
        muted(`  remove it first: remove route ${name} via ${hop} from ${device.label}`),
      ];
    }
    next = existing
      ? routes.map((route) => (route === existing ? { ...route, destination: canonical, nextHop: hop } : route))
      : [...routes, { id: nextId('route', routes), destination: canonical, nextHop: hop }];
    lines.unshift(
      ok(
        existing
          ? `${device.label}: route to ${name} now goes via ${hop} (was ${existing.nextHop})`
          : `${device.label}: route to ${name} via ${hop} added`
      )
    );
  }
  useNetworkStore.getState().updateDevice(device.id, { routes: next });
  if (!hasInterfaceAddresses(device)) {
    lines.push(muted(`  ${device.label} has no interface addresses yet: its routes are not used until a port has one`));
  } else if (!routingTable({ ...device, routes: next }).some((entry) => entry.route?.nextHop === hop && entry.out)) {
    lines.push(muted(`  warning: ${hop} is on none of the networks of ${device.label}: the route cannot be used yet`));
  }
  return lines;
}

/* ── firewall rules ───────────────────────────────────────────────────── */

/**
 * One side of a rule as it will be stored: `any`, a zone, an address or a
 * network as typed; a device name becomes its address.
 */
function ruleEndpoint(
  text: string,
  topo: Topology
): { value: string; note?: string } | { error: string } {
  if (isValidRuleEndpoint(text)) {
    const value = text.trim().toLowerCase();
    const network = parseNetwork(value);
    // Networks are stored without host bits; a bare address stays an address
    if (network && value.includes('/')) return { value: canonicalNetwork(network) };
    return { value: value === 'default' ? 'any' : value };
  }
  const named = resolveEndpoint(text, topo)?.device;
  const address = named ? primaryAddress(named) : '';
  if (named && isValidIP(address)) return { value: address, note: `${named.label} → ${address}` };
  if (named) return { error: `${named.label} has no address to write in a rule` };
  return {
    error: `"${text}" is not any, a zone (trust, untrust, dmz), an address, a network or a device`,
  };
}

function runRuleAdd(
  command: Extract<Command, { kind: 'rule-add' }>,
  context: TerminalContext
): TerminalLine[] {
  const found = targetDevice(
    command.device,
    context,
    `add rule ${command.action} ${command.service} from ${command.source} to ${command.destination} on <device>`
  );
  if ('errorLines' in found) return found.errorLines;
  const { device, topo } = found;
  if (!isL3Capable(device)) {
    return [err(`${device.label} is a ${device.type}: rules belong on firewalls`)];
  }

  const source = ruleEndpoint(command.source, topo);
  if ('error' in source) return [err(source.error)];
  const destination = ruleEndpoint(command.destination, topo);
  if ('error' in destination) return [err(destination.error)];

  const rules = device.firewallRules ?? [];
  const position = command.position ?? rules.length + 1;
  if (position > rules.length + 1) {
    return [
      err(
        rules.length === 0
          ? `${device.label} has no rules yet: the first one goes at position 1`
          : `${device.label} has ${rules.length} rule${rules.length === 1 ? '' : 's'}: the position must be 1-${rules.length + 1}`
      ),
    ];
  }

  const rule: FirewallRule = {
    id: nextId('rule', rules),
    action: command.action,
    service: command.service,
    source: source.value,
    destination: destination.value,
  };
  const next = [...rules.slice(0, position - 1), rule, ...rules.slice(position - 1)];
  useNetworkStore.getState().updateDevice(device.id, { firewallRules: next });

  const lines = [ok(`${device.label}: rule ${position} added — ${describeRule(rule)}`)];
  for (const side of [source, destination]) {
    if (side.note) lines.push(muted(`  ${side.note}`));
  }
  // A rule that names a zone no port is in can never match
  const zones = new Set((device.ports ?? []).map((p) => p.securityZone).filter(Boolean));
  for (const value of [rule.source, rule.destination]) {
    if ((value === 'trust' || value === 'untrust' || value === 'dmz') && !zones.has(value)) {
      lines.push(muted(`  no port of ${device.label} is in zone ${value} yet: interface <n> zone ${value} on ${device.label}`));
    }
  }
  return lines;
}

function runRuleRemove(position: number, deviceQuery: string | undefined, context: TerminalContext): TerminalLine[] {
  const found = targetDevice(deviceQuery, context, `remove rule ${position} from <device>`);
  if ('errorLines' in found) return found.errorLines;
  const { device } = found;
  const rules = device.firewallRules ?? [];
  const rule = rules[position - 1];
  if (!rule) {
    return [
      err(
        rules.length === 0
          ? `${device.label} has no rules`
          : `${device.label} has no rule ${position} (it has ${rules.length})`
      ),
    ];
  }
  const remaining = rules.filter((entry) => entry !== rule);
  useNetworkStore.getState().updateDevice(device.id, {
    firewallRules: remaining.length > 0 ? remaining : undefined,
  });
  return [ok(`${device.label}: rule ${position} removed — ${describeRule(rule)}`)];
}

/* ── help ─────────────────────────────────────────────────────────────── */

/**
 * The command reference: what `help` prints, and the list the in-app guide
 * shows. One table, so the two can never disagree.
 */
export const COMMAND_REFERENCE: Array<[string, string]> = [
  ['ping <target> [from <device>]', 'does it answer? request and reply'],
  ['trace <target> [from <device>] [as web|email]', 'one way, hop by hop, with what each device did'],
  ['browse | mail | download <target> [from <device>]', 'a whole web, email or download exchange'],
  ['show devices | vlans | connections', 'topology overview'],
  ['show interfaces [of] <device>', 'unified ports + NICs table (the standard view)'],
  ['show ip [of] <device>', 'compact addressing summary (also ipconfig/ifconfig)'],
  ['show routes | rules [of] <device>', 'routing table, firewall rules'],
  ['show config | ports | neighbors <device>', 'device detail'],
  ['set ip|gateway|subnet|name of <device> to <value>', 'change device config'],
  ['interface <n> up|down on <device>', 'interface state (also enable|disable port <n>)'],
  ['interface <n> ip <address>/<prefix> on <device>', 'address of a router/firewall port or network card'],
  ['interface <n> access <vlan> | trunk <vlans>|all | default', 'VLAN of a switch port'],
  ['interface <n> zone trust|untrust|dmz|none on <device>', 'security zone of a firewall port'],
  ['add route <network>|default via <next hop> on <device>', 'static route (remove route <network> from <device>)'],
  ['add backup route <network> via <next hop> on <device>', 'second route to a network, used when the line of the first is down'],
  ['add rule allow|deny <service> from <src> to <dst> on <fw>', 'firewall rule (remove rule <n> from <fw>)'],
  ['add vlan <id> to <device>', 'VLAN list of a device (remove vlan <id> from <device>)'],
  ['connect <A> to <B>', 'create a link (disconnect <A> from <B>)'],
  ['use <device> / exit', 'enter/leave device context (implies "from" and "on")'],
  ['clear, help [command]', 'screen and this reference'],
];

/** Width of the syntax column */
const SYNTAX_WIDTH = 58;

function runHelp(topic?: string): TerminalLine[] {
  if (topic) {
    const match = COMMAND_REFERENCE.filter(([syntax]) => syntax.toLowerCase().includes(topic.toLowerCase()));
    if (match.length > 0) {
      return match.map(([syntax, desc]) => line(`${syntax.padEnd(SYNTAX_WIDTH)} ${desc}`));
    }
    return [err(`no help for "${topic}" — try "help" for the full list`)];
  }
  return [
    heading('PixelCake terminal — NCL v0.2 (Network Command Language, vendor-neutral)'),
    ...COMMAND_REFERENCE.map(([syntax, desc]) => line(`  ${syntax.padEnd(SYNTAX_WIDTH)} ${desc}`)),
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
      return {
        ...runDiagnostic('trace', command.target, command.from, context, command.service),
        context,
      };
    case 'flow':
      return { ...runFlow(command.model, command.target, command.from, context), context };
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
    case 'interface-set':
      return { lines: runInterface(command.iface, command.setting, command.device, context), context };
    case 'route-add':
      return {
        lines: runRoute('add', command.destination, command.nextHop, command.device, context, command.backup),
        context,
      };
    case 'route-remove':
      return {
        lines: runRoute('remove', command.destination, command.nextHop, command.device, context),
        context,
      };
    case 'rule-add':
      return { lines: runRuleAdd(command, context), context };
    case 'rule-remove':
      return { lines: runRuleRemove(command.position, command.device, context), context };
    case 'unknown': {
      const lines = [err(`unknown command: "${command.input}"`)];
      if (command.suggestion) lines.push(muted(`  ${command.suggestion}`));
      lines.push(muted('  type "help" for the command list'));
      return { lines, context };
    }
  }
}
