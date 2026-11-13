/**
 * Terminal — semi-natural English command parser
 *
 * Pure TypeScript: turns a raw input line into a Command AST node (see
 * ./types). Implements NCL — Network Command Language v0.1 (vendor-neutral,
 * per docs/terminal-commands.md): verb-first, case-insensitive, optional
 * prepositions, multi-word device names split by role keywords
 * (from/to/of/on), quoted names accepted. Leading "device"/"host" noise
 * nouns are stripped from unquoted name segments ("use device X" → use X);
 * OS-style aliases ipconfig/ifconfig map to `show ip`.
 *
 * Device arguments are returned as RAW strings — resolution against the
 * topology (fuzzy matching, "did you mean") happens in the executor.
 */

import type { ServiceName } from '@/types';
import type { Command, InterfaceSetting, SetProperty, ShowTarget, ZoneName } from './types';

/** One lexical token: original text, lowercase form, and quoting flag. */
interface Token {
  text: string;
  lower: string;
  /** Quoted tokens are always verbatim name parts, never keywords. */
  quoted: boolean;
}

const SHOW_TARGETS: readonly ShowTarget[] = [
  'devices',
  'interfaces',
  'vlans',
  'connections',
  'config',
  'ports',
  'neighbors',
  'ip',
  'routes',
  'rules',
  'nat',
];

const SET_PROPERTIES: readonly SetProperty[] = ['ip', 'gateway', 'subnet', 'name'];

/** Every recognized first word, used for "did you mean" on unknown verbs. */
const KNOWN_VERBS: readonly string[] = [
  'ping',
  'trace',
  'show',
  'set',
  'add',
  'remove',
  'connect',
  'disconnect',
  'enable',
  'disable',
  'use',
  'exit',
  'clear',
  'help',
  'traceroute',
  'tracert',
  'delete',
  'quit',
  'list',
  'cls',
  'sh',
  'ls',
  'ipconfig',
  'ifconfig',
  'interface',
  'browse',
  'mail',
  'download',
  'web',
  'email',
  'curl',
  'wget',
];

/** Names a service goes by: the three NCL names plus the instinctive ones */
const SERVICES: Record<string, ServiceName> = {
  ping: 'ping',
  icmp: 'ping',
  web: 'web',
  http: 'web',
  https: 'web',
  email: 'email',
  mail: 'email',
  smtp: 'email',
};

const ZONES: readonly ZoneName[] = ['trust', 'untrust', 'dmz'];

/** Articles dropped at the start of any device/target segment. */
const ARTICLES: readonly string[] = ['the', 'a'];

/**
 * Noise nouns dropped at the start of any device/target segment, e.g.
 * `use device Core-Switch-HQ` or `ping X from host Y`. Only LEADING
 * unquoted tokens are stripped — quoted names and mid-name occurrences
 * ("Meeting Room Host") always survive verbatim.
 */
const DEVICE_NOISE: readonly string[] = ['device', 'host'];

const SHOW_USAGE =
  'try: show devices | interfaces | ports | vlans | connections | config | neighbors | ip | routes | rules | nat';
const ADD_USAGE =
  'try: add vlan <id> [to] <device> | add route <network> via <next hop> [on <device>] | ' +
  'add rule allow|deny <service> from <source> to <destination> [on <device>] | ' +
  'add forward <service> from interface <n> to <address> [on <device>]';
const REMOVE_USAGE =
  'try: remove vlan <id> from <device> | remove route <network> [from <device>] | ' +
  'remove rule <n> [from <device>] | remove forward <n> [from <device>]';
const SET_USAGE = 'try: set ip|gateway|subnet|name [of] <device> [to] <value>';

/** Split the input into tokens; double-quoted spans become single verbatim tokens. */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let buf = '';
      while (j < input.length && input[j] !== '"') {
        buf += input[j];
        j++;
      }
      i = j < input.length ? j + 1 : j;
      if (buf.length > 0) {
        tokens.push({ text: buf, lower: buf.toLowerCase(), quoted: true });
      }
      continue;
    }
    let j = i;
    let buf = '';
    while (j < input.length && input[j] !== ' ' && input[j] !== '\t' && input[j] !== '"') {
      buf += input[j];
      j++;
    }
    tokens.push({ text: buf, lower: buf.toLowerCase(), quoted: false });
    i = j;
  }
  return tokens;
}

/** Classic Levenshtein edit distance (two-row DP). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost));
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Closest candidate within edit distance 2, or undefined. Ties → first in list. */
function closest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDist = 3;
  for (const candidate of candidates) {
    const dist = levenshtein(word, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

/** Drop leading unquoted articles, device-noise nouns, and any extra noise keywords, repeatedly. */
function stripLeadingNoise(tokens: Token[], extraNoise: readonly string[]): Token[] {
  let start = 0;
  while (
    start < tokens.length &&
    !tokens[start].quoted &&
    (ARTICLES.includes(tokens[start].lower) ||
      DEVICE_NOISE.includes(tokens[start].lower) ||
      extraNoise.includes(tokens[start].lower))
  ) {
    start++;
  }
  return tokens.slice(start);
}

/** Index of the first unquoted token matching one of the keywords, or -1. */
function findKeyword(tokens: Token[], keywords: readonly string[]): number {
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].quoted && keywords.includes(tokens[i].lower)) return i;
  }
  return -1;
}

/** Join tokens back into a single argument string (verbatim text). */
function joinTokens(tokens: Token[]): string {
  return tokens.map((t) => t.text).join(' ');
}

function unknown(input: string, suggestion?: string): Command {
  return suggestion !== undefined ? { kind: 'unknown', input, suggestion } : { kind: 'unknown', input };
}

/** `<target> [from <device>]`: the two arguments every diagnostic takes */
function parseTargetFrom(rest: Token[]): { target: string; from?: string } | undefined {
  const fromIdx = findKeyword(rest, ['from']);
  const targetTokens = stripLeadingNoise(fromIdx === -1 ? rest : rest.slice(0, fromIdx), ['to']);
  const target = joinTokens(targetTokens);
  if (!target) return undefined;
  if (fromIdx === -1) return { target };
  const from = joinTokens(stripLeadingNoise(rest.slice(fromIdx + 1), []));
  if (!from) return undefined;
  return { target, from };
}

/** `ping <target> [from <device>]` */
function parsePing(rest: Token[], raw: string): Command {
  const args = parseTargetFrom(rest);
  return args ? { kind: 'ping', ...args } : unknown(raw, 'try: ping <target> [from <device>]');
}

/** `trace <target> [from <device>] [as ping|web|email]` */
function parseTrace(rest: Token[], raw: string): Command {
  const usage = 'try: trace <target> [from <device>] [as ping|web|email]';
  let tokens = rest;
  let service: ServiceName | undefined;

  // `as <service>` closes the command: only the last two tokens can be it
  const asToken = rest[rest.length - 2];
  if (asToken !== undefined && !asToken.quoted && asToken.lower === 'as') {
    const name = rest[rest.length - 1];
    service = SERVICES[name.lower];
    if (service === undefined) {
      return unknown(raw, `unknown service "${name.text}" — ${usage}`);
    }
    tokens = rest.slice(0, -2);
  }

  const args = parseTargetFrom(tokens);
  if (!args) return unknown(raw, usage);
  return service !== undefined ? { kind: 'trace', ...args, service } : { kind: 'trace', ...args };
}

/** `browse|mail|download <target> [from <device>]`: a whole exchange, request and answer */
function parseFlow(
  model: 'web' | 'email' | 'download',
  verb: string,
  rest: Token[],
  raw: string
): Command {
  const args = parseTargetFrom(rest);
  return args ? { kind: 'flow', model, ...args } : unknown(raw, `try: ${verb} <target> [from <device>]`);
}

/** `show devices|interfaces|ports|vlans|connections|config|neighbors|ip [of] [device...]` */
function parseShow(rest: Token[], raw: string): Command {
  if (rest.length === 0) return unknown(raw, SHOW_USAGE);
  const word = rest[0].lower;
  const what = SHOW_TARGETS.find((t) => t === word);
  if (what === undefined) {
    const near = closest(word, SHOW_TARGETS);
    return unknown(raw, near !== undefined ? `did you mean "show ${near}"?` : SHOW_USAGE);
  }
  const device = joinTokens(stripLeadingNoise(rest.slice(1), ['of', 'on']));
  return device ? { kind: 'show', what, device } : { kind: 'show', what };
}

/** `set ip|gateway|subnet|name [of] <device...> [to] <value>` */
function parseSet(rest: Token[], raw: string): Command {
  if (rest.length === 0) return unknown(raw, SET_USAGE);
  const property = SET_PROPERTIES.find((p) => p === rest[0].lower);
  if (property === undefined) return unknown(raw, SET_USAGE);
  const args = stripLeadingNoise(rest.slice(1), ['of']);
  if (args.length === 0) return unknown(raw, SET_USAGE);

  if (property === 'name') {
    // Name values may be multi-word: everything after 'to' is the value.
    const toIdx = findKeyword(args, ['to']);
    if (toIdx === -1) {
      // Device-context style: `set name New Name` (device omitted).
      return { kind: 'set', property, value: joinTokens(args) };
    }
    const device = joinTokens(args.slice(0, toIdx));
    const value = joinTokens(args.slice(toIdx + 1));
    if (!value) return unknown(raw, SET_USAGE);
    return device ? { kind: 'set', property, device, value } : { kind: 'set', property, value };
  }

  // ip / gateway / subnet: the value is the LAST token.
  const valueToken = args[args.length - 1];
  if (!valueToken.quoted && valueToken.lower === 'to') return unknown(raw, SET_USAGE);
  let deviceTokens = args.slice(0, -1);
  const last = deviceTokens[deviceTokens.length - 1];
  if (last !== undefined && !last.quoted && last.lower === 'to') {
    deviceTokens = deviceTokens.slice(0, -1);
  }
  const device = joinTokens(deviceTokens);
  const value = valueToken.text;
  return device ? { kind: 'set', property, device, value } : { kind: 'set', property, value };
}

/** `add vlan <n> [to] <device...>` / `remove|delete vlan <n> from <device...>` */
function parseVlan(kind: 'vlan-add' | 'vlan-remove', rest: Token[], raw: string): Command {
  const usage =
    kind === 'vlan-add' ? 'try: add vlan <id> [to] <device>' : 'try: remove vlan <id> from <device>';
  if (rest.length === 0 || rest[0].quoted || rest[0].lower !== 'vlan') return unknown(raw, usage);
  const idToken = rest[1];
  if (idToken === undefined) return unknown(raw, usage);
  if (!/^\d+$/.test(idToken.text)) {
    return unknown(raw, `VLAN id must be a number, got "${idToken.text}" — ${usage}`);
  }
  const vlanId = parseInt(idToken.text, 10);
  const device = joinTokens(stripLeadingNoise(rest.slice(2), ['to', 'from', 'of', 'on']));
  return device ? { kind, vlanId, device } : { kind, vlanId };
}

/** `enable|disable port <n> on <device...>` — 'on' separates number and device. */
function parsePort(kind: 'port-enable' | 'port-disable', rest: Token[], raw: string): Command {
  const verb = kind === 'port-enable' ? 'enable' : 'disable';
  const usage = `try: ${verb} port <n> on <device>`;
  if (rest.length === 0 || rest[0].quoted || rest[0].lower !== 'port') return unknown(raw, usage);
  const numberToken = rest[1];
  if (numberToken === undefined) return unknown(raw, usage);
  if (!/^\d+$/.test(numberToken.text)) {
    return unknown(raw, `port number must be a number, got "${numberToken.text}" — ${usage}`);
  }
  const port = parseInt(numberToken.text, 10);
  const device = joinTokens(stripLeadingNoise(rest.slice(2), ['on', 'of']));
  return device ? { kind, port, device } : { kind, port };
}

/** A VLAN id as typed, or undefined when it is not one (1-4094) */
function vlanId(text: string): number | undefined {
  if (!/^\d+$/.test(text)) return undefined;
  const id = parseInt(text, 10);
  return id >= 1 && id <= 4094 ? id : undefined;
}

/**
 * `interface <id> <setting> [on] <device...>` — the CANONICAL NCL form for
 * everything that belongs to one interface. `<id>` is a port number or the
 * name of a network card (eth0). Settings:
 *
 *   up | down                       state (a port number maps onto the same
 *                                   port-enable/port-disable commands as the
 *                                   accepted `enable|disable port <n>` variant)
 *   ip <address>[/<prefix>] | none  address of a router/firewall port or NIC
 *   gateway <address> | none        default gateway of a NIC
 *   access <vlan>                   switch port: access port in one VLAN
 *   trunk <vlan,vlan…> | all        switch port: trunk
 *   default                         switch port: no VLAN of its own
 *   zone trust|untrust|dmz|none     firewall port: security zone
 *   nat [on] | nat off|none         router/firewall port: source NAT
 */
function parseInterface(rest: Token[], raw: string): Command {
  const usage = 'try: interface <n> up|down [on] <device>';
  const more =
    'also: ip <address>[/<prefix>]|none, gateway <address>|none, access <vlan>, ' +
    'trunk <vlans>|all, default, zone trust|untrust|dmz|none, nat [off]';
  const idToken = rest[0];
  if (idToken === undefined) return unknown(raw, `${usage} — ${more}`);
  const iface = idToken.text;
  const isNumber = /^\d+$/.test(iface);
  const word = rest[1];
  if (word === undefined || word.quoted) return unknown(raw, `missing up|down — ${usage} — ${more}`);

  const deviceAfter = (count: number) => joinTokens(stripLeadingNoise(rest.slice(count), ['on', 'of']));
  const withDevice = (setting: InterfaceSetting, count: number): Command => {
    const device = deviceAfter(count);
    return device
      ? { kind: 'interface-set', iface, setting, device }
      : { kind: 'interface-set', iface, setting };
  };
  const value = rest[2];
  const isNone = (token: Token | undefined) =>
    token !== undefined && !token.quoted && (token.lower === 'none' || token.lower === 'clear');

  switch (word.lower) {
    case 'up':
    case 'down': {
      const up = word.lower === 'up';
      if (!isNumber) return withDevice({ what: 'state', up }, 2);
      const port = parseInt(iface, 10);
      const kind = up ? 'port-enable' : 'port-disable';
      const device = deviceAfter(2);
      return device ? { kind, port, device } : { kind, port };
    }
    case 'ip':
    case 'address': {
      const hint = 'try: interface <n> ip <address>[/<prefix>] [on] <device> — or "ip none" to clear it';
      if (value === undefined) return unknown(raw, hint);
      if (isNone(value)) return withDevice({ what: 'ip', address: null }, 3);
      const [address, length, ...extra] = value.text.split('/');
      if (extra.length > 0) return unknown(raw, hint);
      if (length === undefined) return withDevice({ what: 'ip', address }, 3);
      if (!/^\d{1,2}$/.test(length) || parseInt(length, 10) > 32) {
        return unknown(raw, `"/${length}" is not a prefix length (0-32) — ${hint}`);
      }
      return withDevice({ what: 'ip', address, prefix: parseInt(length, 10) }, 3);
    }
    case 'gateway': {
      if (value === undefined) {
        return unknown(raw, 'try: interface <name> gateway <address> [on] <device> — or "gateway none"');
      }
      return withDevice({ what: 'gateway', address: isNone(value) ? null : value.text }, 3);
    }
    case 'access': {
      const hint = 'try: interface <n> access <vlan> [on] <device>';
      if (value === undefined) return unknown(raw, hint);
      const vlan = vlanId(value.text);
      if (vlan === undefined) {
        return unknown(raw, `VLAN id must be a number from 1 to 4094, got "${value.text}" — ${hint}`);
      }
      return withDevice({ what: 'access', vlan }, 3);
    }
    case 'trunk': {
      const hint = 'try: interface <n> trunk <vlan,vlan,…>|all [on] <device>';
      if (value !== undefined && !value.quoted && value.lower === 'all') {
        return withDevice({ what: 'trunk', vlans: [] }, 3);
      }
      // The list may be typed "10,20,30" or "10, 20, 30": take every token made of digits and commas
      let count = 2;
      const vlans: number[] = [];
      while (count < rest.length && !rest[count].quoted && /^[\d,]+$/.test(rest[count].text)) {
        for (const part of rest[count].text.split(',').filter(Boolean)) {
          const vlan = vlanId(part);
          if (vlan === undefined) {
            return unknown(raw, `VLAN id must be a number from 1 to 4094, got "${part}" — ${hint}`);
          }
          if (!vlans.includes(vlan)) vlans.push(vlan);
        }
        count++;
      }
      // No list at all: a trunk for every VLAN
      return withDevice({ what: 'trunk', vlans }, count);
    }
    case 'default':
      return withDevice({ what: 'no-vlan' }, 2);
    case 'zone': {
      const hint = 'try: interface <n> zone trust|untrust|dmz|none [on] <device>';
      if (value === undefined) return unknown(raw, hint);
      if (isNone(value)) return withDevice({ what: 'zone', zone: null }, 3);
      const zone = ZONES.find(z => z === value.lower);
      if (zone === undefined) return unknown(raw, `unknown zone "${value.text}" — ${hint}`);
      return withDevice({ what: 'zone', zone }, 3);
    }
    case 'nat': {
      // `nat` alone switches it on. `nat on <device>` reads the same whether
      // "on" is the value or the word before the device: one is dropped as
      // the value, any other with the device
      if (value !== undefined && !value.quoted && ['off', 'none', 'no', 'disable'].includes(value.lower)) {
        return withDevice({ what: 'nat', on: false }, 3);
      }
      return withDevice({ what: 'nat', on: true }, 2);
    }
    default:
      return unknown(raw, `missing up|down — ${usage} — ${more}`);
  }
}

/** `add route <network>|default via <next hop> [on <device...>]` */
function parseRouteAdd(rest: Token[], raw: string, backup = false): Command {
  // `add backup route …` is a second route to a network that has one
  const usage = `try: add ${backup ? 'backup ' : ''}route <network>|default via <next hop> [on <device>]`;
  const args = stripLeadingNoise(rest, ['to']);
  const viaIdx = findKeyword(args, ['via']);
  const hop = args[viaIdx + 1];
  if (viaIdx !== 1 || hop === undefined) return unknown(raw, usage);
  const destination = args[0].text;
  const nextHop = hop.text;
  const device = joinTokens(stripLeadingNoise(args.slice(viaIdx + 2), ['on', 'to', 'of']));
  return {
    kind: 'route-add',
    destination,
    nextHop,
    ...(device ? { device } : {}),
    ...(backup ? { backup: true as const } : {}),
  };
}

/** `remove route <network>|default [from|on <device...>]` */
function parseRouteRemove(rest: Token[], raw: string): Command {
  // Without `via` every route to the network goes; with it, the one through that next hop
  const usage = 'try: remove route <network>|default [via <next hop>] [from <device>]';
  const args = stripLeadingNoise(rest, ['to']);
  if (args.length === 0) return unknown(raw, usage);
  const destination = args[0].text;
  let tail = args.slice(1);
  let nextHop: string | undefined;
  if (tail[0] !== undefined && !tail[0].quoted && tail[0].lower === 'via') {
    if (tail[1] === undefined) return unknown(raw, usage);
    nextHop = tail[1].text;
    tail = tail.slice(2);
  }
  const device = joinTokens(stripLeadingNoise(tail, ['from', 'on', 'of']));
  return {
    kind: 'route-remove',
    destination,
    ...(nextHop !== undefined ? { nextHop } : {}),
    ...(device ? { device } : {}),
  };
}

/**
 * `add rule [<position>] allow|deny [<service>|any] from <source> to
 * <destination> [on <device...>]` — the service may be left out (any).
 */
function parseRuleAdd(rest: Token[], raw: string): Command {
  const usage =
    'try: add rule [<position>] allow|deny <service>|any from <source> to <destination> [on <device>]';
  let index = 0;
  let position: number | undefined;
  const first = rest[0];
  if (first !== undefined && /^\d+$/.test(first.text)) {
    position = parseInt(first.text, 10);
    if (position < 1) return unknown(raw, `rule positions start at 1 — ${usage}`);
    index = 1;
  }

  const actionToken = rest[index];
  const actions: Record<string, 'allow' | 'deny'> = {
    allow: 'allow',
    permit: 'allow',
    deny: 'deny',
    block: 'deny',
  };
  const action = actionToken !== undefined && !actionToken.quoted ? actions[actionToken.lower] : undefined;
  if (action === undefined) return unknown(raw, `a rule starts with allow or deny — ${usage}`);
  index++;

  // Optional service: straight to `from` means any
  let service: ServiceName | 'any' = 'any';
  const serviceToken = rest[index];
  if (serviceToken !== undefined && (serviceToken.quoted || serviceToken.lower !== 'from')) {
    if (serviceToken.lower === 'any' || serviceToken.lower === 'all') {
      service = 'any';
    } else {
      const named = SERVICES[serviceToken.lower];
      if (named === undefined) {
        return unknown(raw, `unknown service "${serviceToken.text}" (ping, web, email or any) — ${usage}`);
      }
      service = named;
    }
    index++;
  }

  const tail = rest.slice(index);
  if (tail.length === 0 || tail[0].quoted || tail[0].lower !== 'from') return unknown(raw, usage);
  const toIdx = findKeyword(tail, ['to']);
  if (toIdx === -1) return unknown(raw, usage);
  const source = joinTokens(tail.slice(1, toIdx));

  // The LAST `on` splits the destination from the device the rule goes on
  const afterTo = tail.slice(toIdx + 1);
  let onIdx = -1;
  for (let i = afterTo.length - 1; i >= 0; i--) {
    if (!afterTo[i].quoted && afterTo[i].lower === 'on') {
      onIdx = i;
      break;
    }
  }
  const destination = joinTokens(onIdx === -1 ? afterTo : afterTo.slice(0, onIdx));
  const device = onIdx === -1 ? '' : joinTokens(stripLeadingNoise(afterTo.slice(onIdx + 1), []));
  if (!source || !destination || (onIdx !== -1 && !device)) return unknown(raw, usage);

  const command: Extract<Command, { kind: 'rule-add' }> = {
    kind: 'rule-add',
    action,
    service,
    source,
    destination,
  };
  if (position !== undefined) command.position = position;
  if (device) command.device = device;
  return command;
}

/** `remove rule <n> [from|on <device...>]` */
function parseRuleRemove(rest: Token[], raw: string): Command {
  const usage = 'try: remove rule <n> [from <device>]';
  const numberToken = rest[0];
  if (numberToken === undefined) return unknown(raw, usage);
  if (!/^\d+$/.test(numberToken.text) || parseInt(numberToken.text, 10) < 1) {
    return unknown(raw, `rule number must be a number, got "${numberToken.text}" — ${usage}`);
  }
  const position = parseInt(numberToken.text, 10);
  const device = joinTokens(stripLeadingNoise(rest.slice(1), ['from', 'on', 'of']));
  return device ? { kind: 'rule-remove', position, device } : { kind: 'rule-remove', position };
}

/**
 * `add forward [<service>|any] from [interface] <n> to <address|device...>
 * [on <device...>]` — the service may be left out (any).
 */
function parseForwardAdd(rest: Token[], raw: string): Command {
  const usage = 'try: add forward <service>|any from interface <n> to <address> [on <device>]';

  // Optional service: straight to `from` means any
  let index = 0;
  let service: ServiceName | 'any' = 'any';
  const serviceToken = rest[0];
  if (serviceToken !== undefined && (serviceToken.quoted || serviceToken.lower !== 'from')) {
    if (serviceToken.lower === 'any' || serviceToken.lower === 'all') {
      service = 'any';
    } else {
      const named = SERVICES[serviceToken.lower];
      if (named === undefined) {
        return unknown(raw, `unknown service "${serviceToken.text}" (ping, web, email or any) — ${usage}`);
      }
      service = named;
    }
    index = 1;
  }

  const tail = rest.slice(index);
  if (tail.length === 0 || tail[0].quoted || tail[0].lower !== 'from') return unknown(raw, usage);
  // `from interface 3`, `from port 3`, `from 3`
  let at = 1;
  if (tail[at] !== undefined && !tail[at].quoted && ['interface', 'port'].includes(tail[at].lower)) at++;
  const ifaceToken = tail[at];
  if (ifaceToken === undefined) return unknown(raw, usage);
  if (!/^\d+$/.test(ifaceToken.text)) {
    return unknown(raw, `a forward is published from a port: "${ifaceToken.text}" is not a port number — ${usage}`);
  }
  const toToken = tail[at + 1];
  if (toToken === undefined || toToken.quoted || toToken.lower !== 'to') return unknown(raw, usage);

  // The LAST `on` splits the address from the device the forward goes on
  const afterTo = tail.slice(at + 2);
  let onIdx = -1;
  for (let i = afterTo.length - 1; i >= 0; i--) {
    if (!afterTo[i].quoted && afterTo[i].lower === 'on') {
      onIdx = i;
      break;
    }
  }
  const to = joinTokens(onIdx === -1 ? afterTo : afterTo.slice(0, onIdx));
  const device = onIdx === -1 ? '' : joinTokens(stripLeadingNoise(afterTo.slice(onIdx + 1), []));
  if (!to || (onIdx !== -1 && !device)) return unknown(raw, usage);

  const command: Extract<Command, { kind: 'forward-add' }> = {
    kind: 'forward-add',
    service,
    iface: ifaceToken.text,
    to,
  };
  if (device) command.device = device;
  return command;
}

/** `remove forward <n> [from|on <device...>]` */
function parseForwardRemove(rest: Token[], raw: string): Command {
  const usage = 'try: remove forward <n> [from <device>]';
  const numberToken = rest[0];
  if (numberToken === undefined) return unknown(raw, usage);
  if (!/^\d+$/.test(numberToken.text) || parseInt(numberToken.text, 10) < 1) {
    return unknown(raw, `forward number must be a number, got "${numberToken.text}" — ${usage}`);
  }
  const position = parseInt(numberToken.text, 10);
  const device = joinTokens(stripLeadingNoise(rest.slice(1), ['from', 'on', 'of']));
  return device ? { kind: 'forward-remove', position, device } : { kind: 'forward-remove', position };
}

/** `add vlan|route|rule|forward …` / `remove|delete vlan|route|rule|forward …` */
function parseAddRemove(action: 'add' | 'remove', rest: Token[], raw: string): Command {
  const noun = rest[0] !== undefined && !rest[0].quoted ? rest[0].lower : '';
  if (noun === 'route') {
    return action === 'add' ? parseRouteAdd(rest.slice(1), raw) : parseRouteRemove(rest.slice(1), raw);
  }
  // `add backup route …`; a backup route is removed like any other, by its next hop
  if (noun === 'backup' && rest[1] !== undefined && !rest[1].quoted && rest[1].lower === 'route') {
    return action === 'add'
      ? parseRouteAdd(rest.slice(2), raw, true)
      : unknown(raw, 'try: remove route <network>|default via <next hop> [from <device>]');
  }
  if (noun === 'rule') {
    return action === 'add' ? parseRuleAdd(rest.slice(1), raw) : parseRuleRemove(rest.slice(1), raw);
  }
  if (noun === 'forward') {
    return action === 'add'
      ? parseForwardAdd(rest.slice(1), raw)
      : parseForwardRemove(rest.slice(1), raw);
  }
  if (noun === 'vlan') return parseVlan(action === 'add' ? 'vlan-add' : 'vlan-remove', rest, raw);
  return unknown(raw, action === 'add' ? ADD_USAGE : REMOVE_USAGE);
}

/** `connect <A...> to <B...>` / `disconnect <A...> from|to <B...>` */
function parseLink(kind: 'connect' | 'disconnect', rest: Token[], raw: string): Command {
  const usage =
    kind === 'connect'
      ? 'try: connect <device A> to <device B>'
      : 'try: disconnect <device A> from <device B>';
  const separators = kind === 'connect' ? ['to'] : ['from', 'to'];
  const sepIdx = findKeyword(rest, separators);
  if (sepIdx === -1) {
    // No separator: exactly two tokens are unambiguous (A B).
    const pair = stripLeadingNoise(rest, []);
    if (pair.length === 2) return { kind, a: pair[0].text, b: pair[1].text };
    return unknown(raw, usage);
  }
  const a = joinTokens(stripLeadingNoise(rest.slice(0, sepIdx), []));
  const b = joinTokens(stripLeadingNoise(rest.slice(sepIdx + 1), []));
  if (!a || !b) return unknown(raw, usage);
  return { kind, a, b };
}

/** `use <device...>` */
function parseUse(rest: Token[], raw: string): Command {
  const device = joinTokens(stripLeadingNoise(rest, []));
  if (!device) return unknown(raw, 'try: use <device>');
  return { kind: 'use', device };
}

/**
 * Parse one terminal input line into a Command.
 * Never throws: unparseable input yields { kind: 'unknown', ... }.
 */
export function parse(input: string): Command {
  const raw = input.trim();
  if (!raw) return { kind: 'empty' };
  const tokens = tokenize(raw);
  if (tokens.length === 0) return { kind: 'empty' };

  const verb = tokens[0].lower;
  const rest = tokens.slice(1);

  switch (verb) {
    case 'ping':
      return parsePing(rest, raw);
    case 'trace':
    case 'traceroute':
    case 'tracert':
      return parseTrace(rest, raw);
    case 'browse':
    case 'web':
    case 'curl':
      return parseFlow('web', 'browse', rest, raw);
    case 'mail':
    case 'email':
      return parseFlow('email', 'mail', rest, raw);
    case 'download':
    case 'wget':
      return parseFlow('download', 'download', rest, raw);
    case 'show':
    case 'sh':
      return parseShow(rest, raw);
    case 'ls':
    case 'list':
      // Bare alias means `show devices`; with arguments behaves like `show ...`.
      return rest.length === 0 ? { kind: 'show', what: 'devices' } : parseShow(rest, raw);
    case 'ipconfig':
    case 'ifconfig': {
      // Instinctive OS aliases for `show ip`, optionally scoped to a device.
      const device = joinTokens(stripLeadingNoise(rest, ['of', 'on']));
      return device ? { kind: 'show', what: 'ip', device } : { kind: 'show', what: 'ip' };
    }
    case 'set':
      return parseSet(rest, raw);
    case 'add':
      return parseAddRemove('add', rest, raw);
    case 'remove':
    case 'delete':
      return parseAddRemove('remove', rest, raw);
    case 'connect':
      return parseLink('connect', rest, raw);
    case 'disconnect':
      return parseLink('disconnect', rest, raw);
    case 'enable':
      return parsePort('port-enable', rest, raw);
    case 'disable':
      return parsePort('port-disable', rest, raw);
    case 'interface':
      return parseInterface(rest, raw);
    case 'use':
      return parseUse(rest, raw);
    case 'exit':
    case 'quit':
      return { kind: 'exit' };
    case 'clear':
    case 'cls':
      return { kind: 'clear' };
    case 'help':
    case '?': {
      const topic = joinTokens(rest);
      return topic ? { kind: 'help', topic } : { kind: 'help' };
    }
    default:
      return unknown(raw, closest(verb, KNOWN_VERBS));
  }
}
