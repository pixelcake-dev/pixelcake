/**
 * Terminal — Command AST and output types
 *
 * The parser (parser.ts) turns semi-natural English into a Command; the
 * executor turns a Command into TerminalLine[] by calling the engine and
 * the stores. The command set is deliberately VENDOR-AGNOSTIC: no IOS/JunOS
 * syntax, just plain verbs with optional prepositions.
 */

import type { ServiceName } from '@/types';

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
  | 'ip'
  | 'routes'
  | 'rules';

export type SetProperty = 'ip' | 'gateway' | 'subnet' | 'name';

/** A security zone of a firewall port */
export type ZoneName = 'trust' | 'untrust' | 'dmz';

/** What `interface <id> …` changes on one interface */
export type InterfaceSetting =
  | { what: 'state'; up: boolean }
  /** `address` null clears the address; `prefix` is the /n written after it, if any */
  | { what: 'ip'; address: string | null; prefix?: number }
  | { what: 'gateway'; address: string | null }
  | { what: 'access'; vlan: number }
  /** An empty list is a trunk carrying every VLAN */
  | { what: 'trunk'; vlans: number[] }
  | { what: 'no-vlan' }
  | { what: 'zone'; zone: ZoneName | null };

/**
 * Parsed command. Device arguments are RAW STRINGS (labels may be multi-word,
 * or IPs); resolution against the topology happens in the executor, which
 * can also produce "did you mean" suggestions.
 */
export type Command =
  | { kind: 'ping'; target: string; from?: string }
  | { kind: 'trace'; target: string; from?: string; service?: ServiceName }
  | { kind: 'flow'; model: 'web' | 'email' | 'download'; target: string; from?: string }
  | { kind: 'show'; what: ShowTarget; device?: string }
  | { kind: 'set'; property: SetProperty; device?: string; value: string }
  | { kind: 'vlan-add'; vlanId: number; device?: string }
  | { kind: 'vlan-remove'; vlanId: number; device?: string }
  | { kind: 'connect'; a: string; b: string }
  | { kind: 'disconnect'; a: string; b: string }
  | { kind: 'port-enable'; port: number; device?: string }
  | { kind: 'port-disable'; port: number; device?: string }
  /** `iface` is a port number or a NIC name, as typed */
  | { kind: 'interface-set'; iface: string; setting: InterfaceSetting; device?: string }
  | { kind: 'route-add'; destination: string; nextHop: string; device?: string }
  | { kind: 'route-remove'; destination: string; device?: string }
  | {
      kind: 'rule-add';
      /** 1-based place in the list; undefined = at the end */
      position?: number;
      action: 'allow' | 'deny';
      service: ServiceName | 'any';
      /** `any`, a zone, an address, a network — or a device name, resolved by the executor */
      source: string;
      destination: string;
      device?: string;
    }
  | { kind: 'rule-remove'; position: number; device?: string }
  | { kind: 'use'; device: string }
  | { kind: 'exit' }
  | { kind: 'clear' }
  | { kind: 'help'; topic?: string }
  | { kind: 'empty' }
  | { kind: 'unknown'; input: string; suggestion?: string };
