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
  traceToDevice,
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
  describeForward,
  forwardAddress,
  forwardProblem,
  DEFAULT_MASK,
  withLeases,
  resolveDhcp,
  leaseOf,
  unservedOf,
  poolAt,
  poolOf,
  poolProblem,
  servesDhcp,
} from '@/engine';
import type {
  Topology,
  TraceResult,
  InterfaceLink,
  DeviceInterface,
  FlowResult,
  DhcpPoolState,
  DhcpResolution,
} from '@/engine';
import { isValidIP } from '@/utils/ipHelpers';
import { liveTopology } from '@/utils/liveTopology';
import { parse } from './parser';
import { NCL_VERSION } from './types';
import type { Command, InterfaceSetting, TerminalLine, ShowTarget } from './types';
import type {
  DhcpPool,
  FirewallRule,
  FlowModelType,
  NetworkDevice,
  NetworkInterfaceCard,
  Port,
  PortForward,
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

/**
 * What the commands that only read look at: the same drawing as the engine
 * reads it, every card on DHCP carrying the address it is leased.
 * Configuration commands work on `snapshot()`, the drawing as it is kept: a
 * leased address must never be written back as one typed by hand.
 */
function view(): Topology {
  return withLeases(snapshot());
}

/**
 * The device a name or an address stands for, as `topo` has it. An address
 * may be a leased one: it is looked for in the drawing with its leases, and
 * the device is handed back as it is in `topo`.
 */
function findDevice(query: string, topo: Topology): NetworkDevice | undefined {
  const found = resolveEndpoint(query, withLeases(topo))?.device;
  return found ? (topo.devices.find((d) => d.id === found.id) ?? found) : undefined;
}

/** Resolve a raw name/IP to a device, with a "did you mean" error on miss */
function resolveOrError(
  query: string,
  topo: Topology
): { device: NetworkDevice } | { errorLines: TerminalLine[] } {
  const device = findDevice(query, topo);
  if (device) return { device };
  const suggestion = suggestEndpoint(query, topo);
  const errorLines = [err(`device not found: "${query}"`)];
  if (suggestion) errorLines.push(muted(`  did you mean "${suggestion}"?`));
  return { errorLines };
}

function contextDevice(context: TerminalContext, topo: Topology): NetworkDevice | undefined {
  if (!context.deviceLabel) return undefined;
  return findDevice(context.deviceLabel, topo);
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
  const topo = view();
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
    // The address the ping went to: the one typed, the device's own, or the
    // one it is reached at from outside (a note says so)
    const aimedIp = flow.legs[0]?.trace.targetIp ?? shownIp;
    lines.push(muted(`Pinging ${destination.label} (${aimedIp || 'no ip'}) from ${source.label}...`));

    const finalLines: TerminalLine[] = [];
    if (flow.verdict === 'success') {
      const requestHops = flow.legs[0]?.trace.hops.length ?? 1;
      const rttMs = 1 + 2 * Math.max(0, requestHops - 2);
      finalLines.push(ok(`Reply from ${aimedIp}: hops=${requestHops} time=${rttMs}ms`));
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
  const { trace: result, note: aimNote } = traceToDevice(source.id, destination.id, topo, {
    service,
    targetIp,
  });
  const asService = service ? ` as ${service}` : '';
  lines.push(
    muted(
      `Tracing route to ${destination.label} (${(result.targetIp ?? shownIp) || 'no ip'}) ` +
        `from ${source.label}${asService}:`
    )
  );

  const hopLines = result.hops.map((hop, i) => hopLine(hop, i));
  const finalLines: TerminalLine[] = [...(aimNote ? [aimNote] : []), ...result.notes].map((note) =>
    muted(`  note: ${note}`)
  );
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
  const label = (id: string) => topo.devices.find((d) => d.id === id)?.label ?? id;
  // A page is asked at the address the request went to, of the device that
  // answers there: a typed public address may be one a firewall publishes a
  // server at (a mail goes by its relay)
  const aimedIp = model === 'email' ? shownIp : (flow.legs[0]?.trace.targetIp ?? shownIp);
  const answers = model === 'email' ? destination.label : label(flow.legs[0]?.toId ?? destination.id);
  const lines = [muted(`${words.doing} ${answers} (${aimedIp || 'no ip'}) from ${source.label}...`)];

  const finalLines: TerminalLine[] = flow.legs.map((leg) => {
    const passed = leg.trace.verdict === 'success';
    return line(
      `  ${passed ? '✓' : '✗'} ${leg.purpose}: ${label(leg.fromId)} → ${label(leg.toId)}`,
      passed ? 'normal' : 'error'
    );
  });
  if (flow.verdict === 'success') {
    finalLines.push(ok(`${words.done} ${answers}`));
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

/**
 * The address a device is listed with, and whether it is a leased one: a
 * device whose address comes from DHCP is marked `(dhcp)`, also while it has
 * none (`- (dhcp)`). `d` is a device of `view()`.
 */
function addressCell(d: NetworkDevice): string {
  const ip = primaryIp(d);
  const card = (d.nics ?? []).find((nic) => nic.ip === ip && ip !== '');
  const leased = ip ? card?.dhcp === true : (d.nics ?? []).some((nic) => nic.dhcp);
  return leased ? `${ip || '-'} (dhcp)` : ip || '-';
}

function showDevices(topo: Topology): TerminalLine[] {
  if (topo.devices.length === 0) return [muted('no devices on the canvas')];
  // (the column is as wide as it always was until an address says where it comes from)
  const cells = topo.devices.map(addressCell);
  const width = cells.some((cell) => cell.endsWith('(dhcp)')) ? 22 : 16;
  const lines = [heading(`${'DEVICE'.padEnd(24)} ${'TYPE'.padEnd(14)} ${'IP'.padEnd(width)} VLANS`)];
  topo.devices.forEach((d, index) => {
    const vlans = d.vlan && d.vlan.length > 0 ? d.vlan.join(',') : '-';
    lines.push(line(`${d.label.padEnd(24)} ${d.type.padEnd(14)} ${cells[index].padEnd(width)} ${vlans}`));
  });
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

/**
 * What a card on DHCP says in place of its three fields:
 * `192.168.20.100 / 255.255.255.0 gw 192.168.20.1 (dhcp from Router-Core port 2)`,
 * or `no address (dhcp: no DHCP server answers on its network)`. Undefined
 * for a card whose address is written by hand.
 */
function leasedCard(dhcp: DhcpResolution, d: NetworkDevice, nic: NetworkInterfaceCard): string | undefined {
  if (!nic.dhcp) return undefined;
  const lease = leaseOf(dhcp, d.id, nic.id);
  if (!lease) {
    return `no address (dhcp: ${unservedOf(dhcp, d.id, nic.id)?.reason ?? 'no lease'})`;
  }
  const pool = poolAt(dhcp, lease.server);
  const from = pool ? ` from ${pool.name}` : '';
  return `${lease.ip} / ${lease.mask} gw ${lease.gateway || '-'} (dhcp${from})`;
}

function showConfig(topo: Topology, d: NetworkDevice): TerminalLine[] {
  const dhcp = resolveDhcp(topo);
  const lines = [heading(`${d.label} — ${d.type}${d.vendor ? ` (${d.vendor})` : ''}`)];
  lines.push(line(`  ip:       ${addressCell(d)}`));
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
    const address = leasedCard(dhcp, d, nic) ?? `${nic.ip || '-'} / ${nic.subnet || '-'} gw ${nic.gateway || '-'}`;
    lines.push(line(`  nic ${nic.name}: ${address} ${nic.enabled ? '' : '(disabled)'}`));
  }
  if (d.routes && d.routes.length > 0) {
    lines.push(line(`  routes:   ${d.routes.length} static — "show routes ${d.label}" for the whole table`));
  }
  if (d.firewallRules && d.firewallRules.length > 0) {
    lines.push(line(`  rules:    ${d.firewallRules.length} — "show rules ${d.label}" for detail`));
  }
  const natPorts = (d.ports ?? []).filter((p) => p.nat);
  const forwards = d.portForwards ?? [];
  if (natPorts.length > 0 || forwards.length > 0) {
    const where = natPorts.length > 0 ? `on interface ${natPorts.map((p) => p.id).join(', ')}` : 'off';
    const published = `${forwards.length} forward${forwards.length === 1 ? '' : 's'}`;
    lines.push(line(`  nat:      ${where}, ${published} — "show nat ${d.label}" for detail`));
  }
  const pools = dhcp.pools.filter((pool) => pool.deviceId === d.id);
  if (pools.length > 0) {
    const where = pools.map((pool) => pool.iface.label).join(', ');
    lines.push(line(`  dhcp:     hands out addresses on ${where} — "show dhcp ${d.label}" for detail`));
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
      // (a card whose address comes from a DHCP server says so where a port says its zone)
      const mode = iface.nic.dhcp ? 'dhcp' : '-';
      lines.push(
        line(
          `${iface.nic.name.padEnd(10)} ${'nic'.padEnd(6)} ${state} ${ip} ${'-'.padEnd(10)} ${mode.padEnd(10)} ${link}`,
          iface.enabled ? 'normal' : 'muted'
        )
      );
    }
  }
  return lines;
}

/** `show ip <device>` — compact addressing summary (also ipconfig/ifconfig). */
function showIp(topo: Topology, d: NetworkDevice): TerminalLine[] {
  const dhcp = resolveDhcp(topo);
  const lines = [heading(`${d.label} — addressing`)];
  lines.push(line(`  ip:       ${addressCell(d)}`));
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
    const address = leasedCard(dhcp, d, nic) ?? `${nic.ip || '-'} / ${nic.subnet || '-'} gw ${nic.gateway || '-'}`;
    lines.push(
      line(`  ${nic.name}: ${address}${nic.enabled ? '' : ' (disabled)'}`, nic.enabled ? 'normal' : 'muted')
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
    if (dev) lines.push(line(`  ${dev.label.padEnd(24)} ${dev.type.padEnd(14)} ${addressCell(dev)}`));
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

/** `show nat <device>` — the ports that translate what leaves by them, then what is published */
function showNat(d: NetworkDevice): TerminalLine[] {
  const forwards = d.portForwards ?? [];
  if (!isL3Capable(d) && forwards.length === 0) {
    return [muted(`${d.label} is a ${d.type}: it translates no addresses`)];
  }
  const lines = [heading(`NAT of ${d.label}`)];
  const natPorts = (d.ports ?? []).filter((p) => p.nat);
  if (natPorts.length === 0) lines.push(muted('  no interface does NAT: what leaves keeps its own address'));
  for (const p of natPorts) {
    lines.push(
      p.ip && isValidIP(p.ip)
        ? line(`  interface ${String(p.id).padEnd(3)} what leaves by it takes the address ${p.ip}`)
        : muted(`  interface ${String(p.id).padEnd(3)} has no address: it translates nothing`)
    );
  }
  lines.push(heading('FORWARDS (the first that matches is taken)'));
  if (forwards.length === 0) lines.push(muted('  none: from outside only the device itself is reached'));
  forwards.forEach((forward, index) => {
    const address = forwardAddress(d, forward);
    const row =
      `  ${String(index + 1).padStart(2)}  ${forward.service.padEnd(6)} ` +
      `from interface ${String(forward.port).padEnd(3)} (${address ?? 'no address'}) to ${forward.to}`;
    lines.push(forward.enabled === false ? muted(`${row}  (disabled)`) : line(row));
  });
  return lines;
}

/** One pool on a line: where, its range, what it hands out with it, how much is left */
function poolLine(pool: DhcpPoolState): TerminalLine {
  const head = `  ${pool.name.padEnd(22)} ${pool.pool.start} – ${pool.pool.end}`;
  if (pool.problem) return err(`${head}  ✗ ${pool.problem.text}`);
  const gateway = pool.gateway ? `gateway ${pool.gateway}` : 'no gateway';
  const row = `${head}  ${gateway}  ${pool.leases.length} leased, ${pool.free} free of ${pool.size}`;
  return pool.iface.enabled ? line(row) : muted(`${row}  (interface down: it answers nobody)`);
}

/**
 * `show dhcp [<device>]` — who hands out addresses, who got which, who got
 * none and why. Of the whole drawing, or of what one device gives and takes.
 */
function showDhcp(topo: Topology, device?: NetworkDevice): TerminalLine[] {
  const dhcp = resolveDhcp(topo);
  const about = (deviceId: string | undefined) => device === undefined || deviceId === device.id;
  const pools = dhcp.pools.filter((pool) => about(pool.deviceId));
  const leases = dhcp.leases.filter((lease) => about(lease.deviceId) || about(lease.server.deviceId));
  const waiting = dhcp.unserved.filter((entry) => about(entry.deviceId) || (entry.server && about(entry.server.deviceId)));
  const warnings = dhcp.warnings.filter((_, index) => dhcp.rivals[index].some((pool) => about(pool.deviceId)));

  if (pools.length === 0 && leases.length === 0 && waiting.length === 0) {
    if (!device) {
      return [
        muted('no DHCP in the drawing: no interface hands out addresses, no card asks for one'),
        muted('  hand out addresses: interface <n> pool <first> to <last> on <router>'),
        muted('  ask for one:        interface <name> dhcp on <device>'),
      ];
    }
    const lines = [muted(`${device.label} hands out no addresses and asks for none`)];
    if (servesDhcp(device)) {
      lines.push(muted(`  hand out addresses: interface <n> pool <first> to <last> on ${device.label}`));
    }
    const card = isL3Capable(device) ? undefined : device.nics?.[0];
    if (card) lines.push(muted(`  ask for one:        interface ${card.name} dhcp on ${device.label}`));
    return lines;
  }

  const card = (deviceId: string, nicId: string) => {
    const owner = topo.devices.find((d) => d.id === deviceId);
    return `${owner?.label ?? deviceId} ${owner?.nics?.find((nic) => nic.id === nicId)?.name ?? nicId}`;
  };
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const lines = [
    heading(
      device
        ? `DHCP of ${device.label}`
        : `DHCP — ${count(pools.length, 'pool')}, ${count(leases.length, 'lease')}`
    ),
  ];
  if (pools.length > 0) {
    lines.push(heading('POOLS'));
    lines.push(...pools.map(poolLine));
  }
  if (leases.length > 0) {
    lines.push(heading('LEASES'));
    for (const lease of leases) {
      const from = poolAt(dhcp, lease.server)?.name ?? lease.server.deviceId;
      lines.push(line(`  ${lease.ip.padEnd(16)} ${card(lease.deviceId, lease.nicId).padEnd(24)} from ${from}`));
    }
  }
  if (waiting.length > 0) {
    lines.push(heading('WITHOUT AN ADDRESS'));
    for (const entry of waiting) lines.push(err(`  ✗ ${card(entry.deviceId, entry.nicId)}: ${entry.reason}`));
  }
  for (const warning of warnings) lines.push(muted(`  warning: ${warning}`));
  lines.push(muted('  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network'));
  return lines;
}

function runShow(what: ShowTarget, deviceQuery: string | undefined, context: TerminalContext): TerminalLine[] {
  const topo = view();
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
  if (what === 'dhcp') return showDhcp(topo, device);
  if (!device) return [err(`specify a device: "show ${what} <device>" — or enter a context with "use <device>"`)];
  if (what === 'config') return showConfig(topo, device);
  if (what === 'ports') return showPorts(topo, device);
  if (what === 'interfaces') return showInterfaces(topo, device);
  if (what === 'ip') return showIp(topo, device);
  if (what === 'routes') return showRoutes(device);
  if (what === 'rules') return showRules(device);
  if (what === 'nat') return showNat(device);
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
  // A first card on DHCP: mask and gateway come with the lease, and an
  // address written by hand takes the card off DHCP
  const wasOnDhcp = primaryNic?.dhcp === true;
  if (wasOnDhcp && property !== 'ip') {
    return [
      err(`${device.label} takes its address from DHCP: its ${property} comes with the lease`),
      muted(`  to write its address by hand: set ip of ${device.label} to <address>`),
    ];
  }
  if (device.nics && primaryNic) {
    updates.nics = device.nics.map((nic, index) => {
      if (index !== 0) return nic;
      // (a card that was on DHCP kept no mask of its own: /24 until one is set)
      return wasOnDhcp
        ? { ...without(nic, 'dhcp'), ip: value, subnet: DEFAULT_MASK }
        : { ...nic, [property]: value };
    });
  }
  useNetworkStore.getState().updateDevice(device.id, updates);
  const lines = [ok(`${device.label}: ${property} set to ${value}`)];
  if (wasOnDhcp) {
    lines.push(muted(`  ${device.label} no longer takes its address from DHCP: mask ${DEFAULT_MASK}, no gateway yet`));
  }
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

/** `1 address` / `100 addresses` */
function countAddresses(count: number): string {
  return `${count} address${count === 1 ? '' : 'es'}`;
}

/** What a card on DHCP has right now in the drawing, on a line of its own */
function leaseLine(deviceId: string, nicId: string): TerminalLine {
  const dhcp = resolveDhcp(snapshot());
  const lease = leaseOf(dhcp, deviceId, nicId);
  if (!lease) {
    return muted(`  warning: no address yet: ${unservedOf(dhcp, deviceId, nicId)?.reason ?? 'no lease'}`);
  }
  const from = poolAt(dhcp, lease.server)?.name ?? lease.server.deviceId;
  return muted(`  leased ${lease.ip} / ${lease.mask} gw ${lease.gateway || '-'} by ${from}`);
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
      // A card on DHCP has no address of its own to clear, and one written
      // by hand takes it off DHCP
      const wasOnDhcp = iface.kind === 'nic' && iface.nic.dhcp === true;
      if (setting.address === null) {
        if (wasOnDhcp) {
          return [muted(`${name} takes its address from DHCP: "interface ${ifaceId} dhcp off" to stop`)];
        }
        if (iface.kind === 'port') savePort(device, without(iface.port, 'ip', 'subnet'));
        else saveNic(device, { ...iface.nic, ip: '' });
        return [ok(`${name} has no address now`)];
      }
      if (!isValidIP(setting.address)) return [err(`"${setting.address}" is not a valid IPv4 address`)];
      // The mask: the prefix typed, else the one already there, else /24
      const subnet =
        setting.prefix !== undefined ? prefixToMask(setting.prefix) : iface.subnet || DEFAULT_MASK;
      if (iface.kind === 'port') savePort(device, { ...iface.port, ip: setting.address, subnet });
      else if (wasOnDhcp) saveNic(device, { ...without(iface.nic, 'dhcp'), ip: setting.address, subnet });
      else saveNic(device, { ...iface.nic, ip: setting.address, subnet });
      return [
        ok(`${name}: ${setting.address} / ${subnet}`),
        ...(wasOnDhcp ? [muted(`  ${name} no longer takes its address from DHCP`)] : []),
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
      if (iface.nic.dhcp) {
        return [
          err(`${name} takes its address from DHCP: the gateway comes with the lease`),
          muted('  it is the one of the pool: interface <n> pool <first> to <last> gateway <address> on <server>'),
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

    case 'nat': {
      if (iface.kind !== 'port' || !isL3Capable(device)) {
        return [err(`NAT is set on the ports of a router or a firewall: ${device.label} is a ${device.type}`)];
      }
      const doing = iface.port.nat === true;
      if (doing === setting.on) {
        return [muted(`${name} ${doing ? 'already does NAT' : 'does no NAT already'}`)];
      }
      if (!setting.on) {
        savePort(device, without(iface.port, 'nat'));
        return [ok(`${name} no longer does NAT: what leaves by it keeps its own address`)];
      }
      savePort(device, { ...iface.port, nat: true });
      if (!isValidIP(iface.ip)) {
        return [
          ok(`${name} now does NAT`),
          muted(`  it has no address yet: nothing is translated until it has one (interface ${ifaceId} ip <address>)`),
        ];
      }
      return [ok(`${name} now does NAT: what leaves by it takes the address ${iface.ip}`)];
    }

    case 'dhcp': {
      if (iface.kind !== 'nic' || isL3Capable(device)) {
        return [
          err(`DHCP gives an address to the network cards of end devices: ${name} gets its own by hand`),
          ...(servesDhcp(device)
            ? [muted(`  to hand out addresses from it: interface ${ifaceId} pool <first> to <last> on ${device.label}`)]
            : []),
        ];
      }
      const using = iface.nic.dhcp === true;
      if (using === setting.on) {
        return using
          ? [muted(`${name} already takes its address from DHCP`), leaseLine(device.id, iface.nic.id)]
          : [muted(`${name} does not take its address from DHCP`)];
      }
      if (!setting.on) {
        saveNic(device, without(iface.nic, 'dhcp'));
        return [
          ok(`${name} no longer takes its address from DHCP: it has no address now`),
          muted(`  give it one: interface ${ifaceId} ip <address>/<prefix> on ${device.label}`),
        ];
      }
      // A card that asks for an address hands out none (and keeps none of
      // its own: the store empties it as it takes it in)
      const served = iface.nic.dhcpServer !== undefined;
      saveNic(device, { ...without(iface.nic, 'dhcpServer'), dhcp: true });
      return [
        ok(`${name} now takes its address from DHCP`),
        leaseLine(device.id, iface.nic.id),
        ...(served ? [muted(`  ${name} no longer hands out addresses itself: a card cannot do both`)] : []),
      ];
    }

    case 'pool': {
      // A router or a firewall serves from its ports, a server from its cards
      const canServe = iface.kind === 'port' ? isL3Capable(device) : servesDhcp(device) && !isL3Capable(device);
      if (!canServe) {
        return [
          err(
            `addresses are handed out by a port of a router or a firewall, or by a card of a server: ` +
              `${device.label} is a ${device.type}`
          ),
        ];
      }
      const labelOf = (deviceId: string) => topo.devices.find((d) => d.id === deviceId)?.label ?? deviceId;
      const stateOf = (dhcp: DhcpResolution) =>
        dhcp.pools.find((pool) => pool.deviceId === device.id && pool.interfaceKey === iface.key);
      const current = poolOf(iface);

      if (setting.pool === null) {
        if (!current) return [muted(`${name} hands out no addresses already`)];
        const served = stateOf(resolveDhcp(topo))?.leases ?? [];
        if (iface.kind === 'port') savePort(device, without(iface.port, 'dhcpServer'));
        else saveNic(device, without(iface.nic, 'dhcpServer'));
        // Who had an address from it, and has none from anybody now
        const after = resolveDhcp(snapshot());
        const left = served
          .filter((lease) => leaseOf(after, lease.deviceId, lease.nicId) === undefined)
          .map((lease) => labelOf(lease.deviceId));
        return [
          ok(`${name} no longer hands out addresses`),
          ...(left.length > 0 ? [muted(`  without an address now: ${left.join(', ')}`)] : []),
        ];
      }

      const gateway = (setting.pool.gateway ?? '').trim();
      const pool: DhcpPool = {
        start: setting.pool.start.trim(),
        end: setting.pool.end.trim(),
        ...(gateway ? { gateway } : {}),
      };
      const problem = poolProblem(device, iface, pool);
      if (problem) return [err(problem.text)];
      if (current && current.start === pool.start && current.end === pool.end && (current.gateway ?? '') === gateway) {
        return [muted(`${name} already hands out ${pool.start} to ${pool.end}`)];
      }
      if (iface.kind === 'port') savePort(device, { ...iface.port, dhcpServer: pool });
      else saveNic(device, { ...iface.nic, dhcpServer: pool });

      const after = resolveDhcp(snapshot());
      const state = stateOf(after);
      const handed = state?.gateway
        ? `gateway ${state.gateway}`
        : 'no gateway: its clients talk inside their network only';
      const lines = [
        ok(`${name} now hands out ${pool.start} to ${pool.end}: ${countAddresses(state?.size ?? 0)}, ${handed}`),
      ];
      const leases = state?.leases ?? [];
      lines.push(
        leases.length > 0
          ? muted(`  leased now: ${leases.map((lease) => `${labelOf(lease.deviceId)} ${lease.ip}`).join(', ')}`)
          : muted('  no card on its network asks for an address yet: interface <name> dhcp on <device>')
      );
      after.rivals.forEach((group, index) => {
        if (group.some((rival) => rival === state)) lines.push(muted(`  warning: ${after.warnings[index]}`));
      });
      if (!iface.enabled) lines.push(muted(`  ${name} is down: it answers nobody until it is up`));
      return lines;
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
 * ` (leased by DHCP: …)` when the address a device was named by is one it
 * is leased: what is written with it holds for as long as the lease does
 */
function leasedNote(device: NetworkDevice, address: string): string {
  const leased = (device.nics ?? []).some((nic) => nic.dhcp && nic.ip === address);
  return leased ? ' (leased by DHCP: it changes if the drawing does)' : '';
}

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
  // (a device on DHCP is named by the address it is leased)
  const named = resolveEndpoint(text, withLeases(topo))?.device;
  const address = named ? primaryAddress(named) : '';
  if (named && isValidIP(address)) {
    return { value: address, note: `${named.label} → ${address}${leasedNote(named, address)}` };
  }
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

/* ── port forwards ────────────────────────────────────────────────────── */

function runForwardAdd(
  command: Extract<Command, { kind: 'forward-add' }>,
  context: TerminalContext
): TerminalLine[] {
  const found = targetDevice(
    command.device,
    context,
    `add forward ${command.service} from interface ${command.iface} to ${command.to} on <device>`
  );
  if ('errorLines' in found) return found.errorLines;
  const { device, topo } = found;
  if (!isL3Capable(device)) {
    return [err(`${device.label} is a ${device.type}: forwards belong on routers and firewalls`)];
  }
  const iface = findInterface(device, command.iface);
  if (!iface || iface.kind !== 'port') {
    return [err(`${device.label} has no interface "${command.iface}" (it has: ${interfaceNames(device)})`)];
  }

  // The address inside, as typed; a device name becomes its address
  let to = command.to.trim();
  let note: string | undefined;
  if (!isValidIP(to)) {
    // (a device on DHCP is named by the address it is leased)
    const named = resolveEndpoint(to, withLeases(topo))?.device;
    const address = named ? primaryAddress(named) : '';
    if (!named) return [err(`"${command.to}" is not an address or a device`)];
    if (!isValidIP(address)) return [err(`${named.label} has no address to forward to`)];
    note = `${named.label} → ${address}${leasedNote(named, address)}`;
    to = address;
  }

  const forwards = device.portForwards ?? [];
  const forward: PortForward = {
    id: nextId('forward', forwards),
    service: command.service,
    port: iface.port.id,
    to,
  };
  const problem = forwardProblem(device, forward);
  if (problem) return [err(problem)];
  const same = forwards.findIndex(
    (entry) => entry.service === forward.service && entry.port === forward.port && entry.to === forward.to
  );
  if (same !== -1) return [muted(`${device.label} already has it: forward ${same + 1}`)];

  useNetworkStore.getState().updateDevice(device.id, { portForwards: [...forwards, forward] });

  const lines = [ok(`${device.label}: forward ${forwards.length + 1} added — ${describeForward(forward)}`)];
  if (note) lines.push(muted(`  ${note}`));
  lines.push(muted(`  from outside it is reached at ${forwardAddress(device, forward)}`));
  // An earlier forward for the same service on the same port takes the traffic first
  const before = forwards.findIndex(
    (entry) =>
      entry.enabled !== false &&
      entry.port === forward.port &&
      (entry.service === 'any' || forward.service === 'any' || entry.service === forward.service)
  );
  if (before !== -1) {
    lines.push(muted(`  warning: forward ${before + 1} comes first for the same interface and service`));
  }
  // A firewall filters what a forward lets in
  const filters = device.type.toLowerCase().includes('firewall');
  const allowed = (device.firewallRules ?? []).some(
    (rule) => rule.enabled !== false && rule.action === 'allow' && rule.destination === to
  );
  if (filters && !allowed) {
    lines.push(
      muted(
        `  a firewall also needs a rule that lets it in: ` +
          `add rule allow ${forward.service} from untrust to ${to} on ${device.label}`
      )
    );
  }
  return lines;
}

function runForwardRemove(
  position: number,
  deviceQuery: string | undefined,
  context: TerminalContext
): TerminalLine[] {
  const found = targetDevice(deviceQuery, context, `remove forward ${position} from <device>`);
  if ('errorLines' in found) return found.errorLines;
  const { device } = found;
  const forwards = device.portForwards ?? [];
  const forward = forwards[position - 1];
  if (!forward) {
    return [
      err(
        forwards.length === 0
          ? `${device.label} has no forwards`
          : `${device.label} has no forward ${position} (it has ${forwards.length})`
      ),
    ];
  }
  const remaining = forwards.filter((entry) => entry !== forward);
  useNetworkStore.getState().updateDevice(device.id, {
    portForwards: remaining.length > 0 ? remaining : undefined,
  });
  return [ok(`${device.label}: forward ${position} removed — ${describeForward(forward)}`)];
}

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
  ['show routes | rules | nat [of] <device>', 'routing table, firewall rules, address translation'],
  ['show dhcp [[of] <device>]', 'DHCP: who hands out addresses, who got which, who got none'],
  ['show config | ports | neighbors <device>', 'device detail'],
  ['set ip|gateway|subnet|name of <device> to <value>', 'change device config'],
  ['interface <n> up|down on <device>', 'interface state (also enable|disable port <n>)'],
  ['interface <n> ip <address>/<prefix> on <device>', 'address of a router/firewall port or network card'],
  ['interface <n> access <vlan> | trunk <vlans>|all | default', 'VLAN of a switch port'],
  ['interface <n> zone trust|untrust|dmz|none on <device>', 'security zone of a firewall port'],
  ['interface <n> nat [off] on <device>', 'source NAT on a router/firewall port: what leaves takes its address'],
  ['interface <name> dhcp [off] on <device>', 'a network card takes its address from a DHCP server'],
  ['interface <n> [dhcp] pool <first> to <last> on <device>', 'DHCP server on a router/firewall port or a server card (pool none)'],
  ['add route <network>|default via <next hop> on <device>', 'static route (remove route <network> from <device>)'],
  ['add backup route <network> via <next hop> on <device>', 'second route to a network, used when the line of the first is down'],
  ['add rule allow|deny <service> from <src> to <dst> on <fw>', 'firewall rule (remove rule <n> from <fw>)'],
  ['add forward <svc> from interface <n> to <address> on <dev>', 'publish a service inside (remove forward <n> from <dev>)'],
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
    heading(`PixelCake terminal — NCL v${NCL_VERSION} (Network Command Language, vendor-neutral)`),
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
    case 'forward-add':
      return { lines: runForwardAdd(command, context), context };
    case 'forward-remove':
      return { lines: runForwardRemove(command.position, command.device, context), context };
    case 'unknown': {
      const lines = [err(`unknown command: "${command.input}"`)];
      if (command.suggestion) lines.push(muted(`  ${command.suggestion}`));
      lines.push(muted('  type "help" for the command list'));
      return { lines, context };
    }
  }
}
