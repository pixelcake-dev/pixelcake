/**
 * Terminal — Command AST and output types
 *
 * The parser (parser.ts) turns semi-natural English into a Command; the
 * executor turns a Command into TerminalLine[] by calling the engine and
 * the stores. The command set is deliberately VENDOR-AGNOSTIC: no IOS/JunOS
 * syntax, just plain verbs with optional prepositions.
 */

import type { DhcpPool, LinkMedium, ServiceName } from '@/types';

/**
 * The version of the language the terminal speaks: NCL, Network Command
 * Language. The one place it is written in the code; the reference in
 * docs/terminal-commands.md carries the same number in its title, and a test
 * holds the two together.
 */
export const NCL_VERSION = '0.6';

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
  | 'rules'
  | 'nat'
  | 'dhcp'
  | 'dns'
  | 'failures';

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
  | { what: 'zone'; zone: ZoneName | null }
  /** Source NAT on a router or firewall port */
  | { what: 'nat'; on: boolean }
  /** A network card takes its address from a DHCP server */
  | { what: 'dhcp'; on: boolean }
  /** DHCP server on the interface: the addresses it hands out; null stops it */
  | { what: 'pool'; pool: DhcpPool | null }
  /** The DNS server a network card asks; null: none */
  | { what: 'dns'; address: string | null };

/** What `link <A> to <B> …` sets on the cable between two devices */
export type LinkSetting =
  /** What the cable is; null: worked out from its two ends */
  | { what: 'medium'; medium: LinkMedium | null }
  /** Its length in metres, as typed (the executor says whether it is one); null: none */
  | { what: 'length'; metres: number | null }
  /** A one-way delay written by hand, in ms, as typed; null: worked out from medium and length */
  | { what: 'delay'; ms: number | null };

/**
 * What `fail` and `repair` act on: a device, or a cable between two devices.
 * `by` names which cable when there are several between the same two: an
 * interface of `a`, as typed (a port number or a card name).
 */
export type FailureTarget =
  | { what: 'device'; device?: string }
  | { what: 'link'; a: string; b: string; by?: string };

/**
 * Parsed command. Device arguments are RAW STRINGS (labels may be multi-word,
 * or IPs); resolution against the topology happens in the executor, which
 * can also produce "did you mean" suggestions.
 */
export type Command =
  | { kind: 'ping'; target: string; from?: string }
  | { kind: 'trace'; target: string; from?: string; service?: ServiceName }
  | { kind: 'flow'; model: 'web' | 'email' | 'download'; target: string; from?: string }
  /** `resolve <name>`: ask the DNS server of a device for the address of a name */
  | { kind: 'resolve'; name: string; from?: string }
  | { kind: 'show'; what: ShowTarget; device?: string }
  /** `fail` / `repair`: simulated failures, which live in presentation mode */
  | { kind: 'fail'; target: FailureTarget }
  | { kind: 'repair'; target: FailureTarget | { what: 'all' } }
  | { kind: 'set'; property: SetProperty; device?: string; value: string }
  | { kind: 'vlan-add'; vlanId: number; device?: string }
  | { kind: 'vlan-remove'; vlanId: number; device?: string }
  | { kind: 'connect'; a: string; b: string }
  | { kind: 'disconnect'; a: string; b: string }
  /** `link <A> [to] <B> medium … length … delay …`: one setting or more, in the order typed */
  | { kind: 'link-set'; a: string; b: string; settings: LinkSetting[] }
  | { kind: 'port-enable'; port: number; device?: string }
  | { kind: 'port-disable'; port: number; device?: string }
  /** `iface` is a port number or a NIC name, as typed */
  | { kind: 'interface-set'; iface: string; setting: InterfaceSetting; device?: string }
  /**
   * `backup`: a second route to a network that has one (`add backup route`),
   * used when the line of the first is down
   */
  | { kind: 'route-add'; destination: string; nextHop: string; device?: string; backup?: true }
  /** `nextHop`: remove only the route through it (`remove route … via …`) */
  | { kind: 'route-remove'; destination: string; nextHop?: string; device?: string }
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
  | {
      kind: 'forward-add';
      service: ServiceName | 'any';
      /** The port whose address is published: its number, as typed */
      iface: string;
      /** An address inside — or a device name, resolved by the executor */
      to: string;
      device?: string;
    }
  | { kind: 'forward-remove'; position: number; device?: string }
  /** `address`: an address — or a device name, resolved by the executor */
  | { kind: 'record-add'; name: string; address: string; device?: string }
  /** `record`: the place of a record in the list, or its name, as typed */
  | { kind: 'record-remove'; record: string; device?: string }
  | { kind: 'use'; device: string }
  | { kind: 'exit' }
  | { kind: 'clear' }
  | { kind: 'help'; topic?: string }
  | { kind: 'empty' }
  | { kind: 'unknown'; input: string; suggestion?: string };
