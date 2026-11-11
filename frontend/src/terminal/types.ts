/**
 * Terminal — Command AST and output types
 *
 * The parser (parser.ts) turns semi-natural English into a Command; the
 * executor turns a Command into TerminalLine[] by calling the engine and
 * the stores. The command set is deliberately VENDOR-AGNOSTIC: no IOS/JunOS
 * syntax, just plain verbs with optional prepositions.
 */

/** One rendered line of terminal output */
export interface TerminalLine {
  text: string;
  tone: 'normal' | 'success' | 'error' | 'muted' | 'heading' | 'command';
}

export type ShowTarget =
  | 'devices'
  | 'interfaces' // unified ports + NICs view — the vendor-neutral term
  | 'vlans'
  | 'connections'
  | 'config'
  | 'ports'
  | 'neighbors'
  | 'ip';

export type SetProperty = 'ip' | 'gateway' | 'subnet' | 'name';

/**
 * Parsed command. Device arguments are RAW STRINGS (labels may be multi-word,
 * or IPs); resolution against the topology happens in the executor, which
 * can also produce "did you mean" suggestions.
 */
export type Command =
  | { kind: 'ping'; target: string; from?: string }
  | { kind: 'trace'; target: string; from?: string }
  | { kind: 'show'; what: ShowTarget; device?: string }
  | { kind: 'set'; property: SetProperty; device?: string; value: string }
  | { kind: 'vlan-add'; vlanId: number; device?: string }
  | { kind: 'vlan-remove'; vlanId: number; device?: string }
  | { kind: 'connect'; a: string; b: string }
  | { kind: 'disconnect'; a: string; b: string }
  | { kind: 'port-enable'; port: number; device?: string }
  | { kind: 'port-disable'; port: number; device?: string }
  | { kind: 'use'; device: string }
  | { kind: 'exit' }
  | { kind: 'clear' }
  | { kind: 'help'; topic?: string }
  | { kind: 'empty' }
  | { kind: 'unknown'; input: string; suggestion?: string };
