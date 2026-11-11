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

import type { Command, SetProperty, ShowTarget } from './types';

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
];

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
  'try: show devices | interfaces | ports | vlans | connections | config | neighbors | ip';
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

/** `ping <target> [from <device>]` / `trace <target> [from <device>]` */
function parsePingTrace(kind: 'ping' | 'trace', rest: Token[], raw: string): Command {
  const usage = `try: ${kind} <target> [from <device>]`;
  const fromIdx = findKeyword(rest, ['from']);
  const targetTokens = stripLeadingNoise(fromIdx === -1 ? rest : rest.slice(0, fromIdx), ['to']);
  const target = joinTokens(targetTokens);
  if (!target) return unknown(raw, usage);
  if (fromIdx === -1) return { kind, target };
  const from = joinTokens(stripLeadingNoise(rest.slice(fromIdx + 1), []));
  if (!from) return unknown(raw, usage);
  return { kind, target, from };
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

/**
 * `interface <n> up|down [on] <device...>` — the CANONICAL NCL form for
 * interface state; maps onto the same port-enable/port-disable commands as
 * the accepted `enable|disable port <n> on <device>` variant.
 */
function parseInterface(rest: Token[], raw: string): Command {
  const usage = 'try: interface <n> up|down [on] <device>';
  const numberToken = rest[0];
  if (numberToken === undefined) return unknown(raw, usage);
  if (!/^\d+$/.test(numberToken.text)) {
    return unknown(raw, `interface number must be a number, got "${numberToken.text}" — ${usage}`);
  }
  const port = parseInt(numberToken.text, 10);
  const direction = rest[1];
  if (direction === undefined || direction.quoted || (direction.lower !== 'up' && direction.lower !== 'down')) {
    return unknown(raw, `missing up|down — ${usage}`);
  }
  const kind = direction.lower === 'up' ? 'port-enable' : 'port-disable';
  const device = joinTokens(stripLeadingNoise(rest.slice(2), ['on', 'of']));
  return device ? { kind, port, device } : { kind, port };
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
      return parsePingTrace('ping', rest, raw);
    case 'trace':
    case 'traceroute':
    case 'tracert':
      return parsePingTrace('trace', rest, raw);
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
      return parseVlan('vlan-add', rest, raw);
    case 'remove':
    case 'delete':
      return parseVlan('vlan-remove', rest, raw);
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
