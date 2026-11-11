# NCL — Network Command Language v0.1

**NCL (Network Command Language)** is a vendor-neutral command language in
semi-natural English. Cisco, Juniper and Mikrotik each speak their own
dialect; NCL aims to be the esperanto: one open, cross-vendor way to express
network diagnostics, inspection and configuration. No IOS/JunOS syntax: plain
verbs, optional prepositions, case-insensitive. Device names may be
multi-word and are resolved fuzzily ("did you mean…?" on miss); an IP address
is accepted anywhere a device is expected.

This document is the **source of the v0.1 spec**. In the app, `help` in the
terminal lists the same commands. The language is versioned
independently of the app; until v1.0 canonical forms are stable but aliases
and output formats may still be refined between minor versions.

## Principles

1. **Verb first**: `ping`, `trace`, `show`, `set`, `connect`, `use`…
2. **Prepositions are optional noise** where unambiguous: `show config of Switch-0` ≡ `show config Switch-0`.
3. **Role keywords** (`from`, `to`, `of`, `on`) split multi-word device names: `ping PC Sales 1 from Core Switch HQ`.
4. **Context**: `use <device>` enters a device context (prompt becomes `PC-1>`); `from` is then implied. `exit` leaves.
5. **Vendor-neutral vocabulary**: `show neighbors` not `show cdp neighbors`; `interface 3 down` not `no shutdown`. **`interfaces` is THE standard unified term** — ports and NICs in one table.
6. **Tolerances are part of the spec**, not parser sugar: optional prepositions (`of`/`to`), dropped articles (`the`/`a`), `device`/`host` noise words, double-quoted names, IPs anywhere a device is expected, did-you-mean on unknown verbs and devices.

## Grammar (EBNF-like)

```
command       ::= diagnostic | inspection | configuration | session

diagnostic    ::= ("ping" | "trace") target ["from" device]
inspection    ::= "show" show-target [["of"] device]
show-target   ::= "devices" | "interfaces" | "ports" | "vlans"
                | "connections" | "config" | "neighbors" | "ip"

configuration ::= set-cmd | vlan-cmd | link-cmd | iface-cmd
set-cmd       ::= "set" ("ip" | "gateway" | "subnet" | "name")
                        ["of"] device ["to"] value
vlan-cmd      ::= "add" "vlan" number ["to"] device
                | "remove" "vlan" number "from" device
link-cmd      ::= "connect" device ["to"] device
                | "disconnect" device ["from"] device
iface-cmd     ::= "interface" number ("up" | "down") ["on"] device

session       ::= "use" device | "exit" | "clear" | "help" [topic]

target        ::= device | ipv4
device        ::= word { word } | '"' text '"'      (* multi-word, quotable *)
```

In a device context (`use …`) the `["from" device]` / `[["of"] device]` parts
default to the context device.

## Commands

### Diagnostics (engine-backed, real evaluation — not animation)
| Command | Meaning |
|---|---|
| `ping <target> [from <device>]` | Echo semantics: BOTH directions evaluated (request + reply), round trip animated on the canvas. VLANs, subnets, gateway, firewall zones and port bindings evaluated hop-by-hop. |
| `trace <target> [from <device>]` | One-way, same evaluation; prints every hop with verdict and reason as the packet reaches it. Aliases: `traceroute`, `tracert`. |

`<target>` = device label or IP. In device context `from` is implied.
Terminal output follows the packet animation in real time.

Checks applied in order along the shortest (BFS) physical path:

1. endpoints exist and have valid IPs → verdict `error`
2. a physical path exists → `unreachable`
3. per-link interface bindings: a disabled port or NIC on either end of a link
   drops the packet → `blocked`
4. L2 VLAN continuity on switch-like transit hops → `blocked`
5. L3 across subnets: the source has a gateway, **a router/firewall is on the
   path**, and **the gateway is the address of the router port the packet
   arrives on** (typical failures: `no router between subnets 192.168.1.0 and
   192.168.2.0 — L2 devices cannot route`, `PC-1 uses gateway 192.168.10.254,
   but Router-1 port 1 on its network is 192.168.10.1`) → `blocked`
6. firewall security zones on port-bound firewall hops (`untrust→trust`,
   `untrust→dmz`, `dmz→trust` denied for a new flow; the reply to an allowed
   flow passes) → `blocked`

Each endpoint is addressed through the interface its link is attached to: the
NIC's ip/subnet/gateway on end devices.

**What is not verified says so.** The engine never turns an unchecked condition
into a silent success; it adds a note to the result instead:

- `link A–B has no port binding…: per-port rules skipped` — one end is not
  attached to an interface
- `Router-1 has no interface addresses: gateway not verified` — the router's
  ports carry no IP (data from before ports could be addressed)
- `routing between routers is not simulated: assumed` — more than one router on
  the path; only the first one is checked
- `firewall FW-1 has no zone binding: allowed` — the firewall's links are not
  attached to zoned ports

### Inspection (read-only)
| Command | Meaning |
|---|---|
| `show devices` | All devices with type and IP |
| `show interfaces [of] <device>` | **Unified interface table** — ports + NICs in one view (the standard term), with the address of each and the device it is linked to |
| `show ports [of] <device>` | Port table (status, VLAN, type, zone, IP, link) — specialized ports-only view |
| `show vlans` | VLAN membership across the topology |
| `show connections [of <device>]` | Links, with the interface on each end: `[port 3 ↔ eth0]` (`?` for an end not attached to an interface) |
| `show config [of] <device>` | IP/subnet/gateway, VLANs, STP, ports, NICs |
| `show neighbors [of] <device>` | Directly connected devices |
| `show ip [of] <device>` | Compact addressing summary: primary ip/mask/gateway + each NIC + each addressed port |

Aliases: `sh` → `show` · `ls`, `list` → `show devices` ·
`ipconfig`, `ifconfig` → `show ip`.

### Configuration (writes to the canvas, like any edit)
| Command | Meaning |
|---|---|
| `set ip [of] <device> [to] <ip>` | Also `set gateway …`, `set subnet …`, `set name …` |
| `add vlan <id> [to] <device>` / `remove vlan <id> from <device>` | Device VLAN membership |
| `connect <A> [to] <B>` / `disconnect <A> [from] <B>` | Create/remove a link. `connect` attaches each end to the first free interface and says which: `connected A (port 3) ↔ B (eth0)`. On a firewall with security zones the end stays unattached: choose the port, and with it the zone, in the connection editor |
| `interface <n> up\|down [on] <device>` | Interface state — **canonical form**. `enable\|disable port <n> on <device>` stays as an accepted variant. |

Values are validated before writing (`"999.1.2.3" is not a valid IPv4
address`). A device with NICs is addressed through them: `set gateway` and
`set subnet` write its first NIC, and `set ip` is refused (per-NIC terminal
config is on the roadmap).

### Session
| Command | Meaning |
|---|---|
| `use <device>` | Enter device context (`exit`/`quit` to leave); `from` implied |
| `clear` | Clear the screen (alias `cls`) |
| `help [topic]` | The reference, filterable by topic (alias `?`) |

## Email and flow models

The same engine that judges `ping`/`trace` evaluates the canvas simulation
flow models — `ping`, `web`, `download`, `email`. Each model is a plan of one
or more legs, each traced hop-by-hop; the verdict is `success` only when ALL
legs pass, and evaluation stops at the first failing leg.

Email relays depend on the configured **email mode**:

- `internal` — nearest internal mail server (BFS hops from the source); legs
  `SMTP submit` + `delivery`. No mail server → error.
- `cloud` — nearest internet exit (Internet/Cloud/WAN/ISP device); legs
  `SMTP to cloud provider` + `cloud delivery`. No internet exit → error.
- `auto` (default) — prefers internal, falls back to cloud with a note
  (`no internal mail server: using cloud email via <relay>`).

When an endpoint already IS the relay the plan collapses to a single leg.

## Examples

```
pixelcake> ping Web-01 from PC-1
pixelcake> trace 192.168.20.20 from PC-2
pixelcake> show interfaces of Router-1
pixelcake> show ip of Web-01
pixelcake> use PC-1
PC-1> trace Mail-01
PC-1> show neighbors
PC-1> exit
pixelcake> set gateway of PC-1 to 192.168.10.1
pixelcake> add vlan 20 to SW-Office
pixelcake> interface 2 down on Router-1
pixelcake> connect SW-Office to "SW-Servers"
```

## Design notes

- The engine consumes only data the canvas already captures; every field it
  reads (`vlan`, `port.enabled`, `port.ip`, `securityZone`, the interface
  bindings) maps 1:1 to the future Terraform export (step 2).
- Every link end is attached to one interface of its device: a port
  (`sourcePort`/`targetPort`) or a NIC (`sourceNic`/`targetNic`). New links
  take the first free interface; drawings saved before bindings existed are
  attached the same way when they are opened. An end that cannot be attached
  (no free interface, or a firewall with security zones, where the port is
  the user's choice) skips per-port rules and says so in the trace notes.
- Configuration commands go through the same store actions as graphical
  edits, so they are kept like any other edit (in the browser at once, in
  the project file at the next save) and are consistent with the Inspector.

## Language roadmap

The spec will grow with the engine's capabilities; every extension keeps the
principles above (verb-first, optional prepositions, neutral vocabulary):

- **Per-NIC configuration** — `set ip of eth1 on Web-01 to 10.0.30.99`
- **ACL / policy** — `allow dmz to trust port 443 on FW-1`, evaluated by the
  diagnostics instead of the fixed zone-transition table
- **Static routes** — `route add 10.0.30.0/24 via 10.0.0.1 on Router-Core`
