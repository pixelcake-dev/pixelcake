# NCL — Network Command Language v0.3

**NCL (Network Command Language)** is a vendor-neutral command language in
semi-natural English. Cisco, Juniper and Mikrotik each speak their own
dialect; NCL aims to be the esperanto: one open, cross-vendor way to express
network diagnostics, inspection and configuration. No IOS/JunOS syntax: plain
verbs, optional prepositions, case-insensitive. Device names may be
multi-word and are resolved fuzzily ("did you mean…?" on miss); an IP address
is accepted anywhere a device is expected.

This document is the **source of the spec**. In the app, `help` in the
terminal lists the same commands, and so does Aiuto → Comandi del terminale.
The language is versioned independently of the app; until v1.0 canonical
forms are stable but aliases and output formats may still be refined between
minor versions.

**New in v0.3:** address translation. Source NAT on an interface
(`interface <n> nat`), port forwards (`add forward`, `remove forward`),
`show nat`. The Internet symbol no longer carries private addresses, so a
network needs them to reach it and to be reached from it.

**New in v0.2:** static routes, firewall rules, per-interface settings
(address, VLAN, security zone), whole exchanges (`browse`, `mail`,
`download`) and `trace … as <service>`.

## Principles

1. **Verb first**: `ping`, `trace`, `show`, `set`, `add`, `connect`, `use`…
2. **Prepositions are optional noise** where unambiguous: `show config of Switch-0` ≡ `show config Switch-0`.
3. **Role keywords** (`from`, `to`, `of`, `on`, `via`) split multi-word device names: `ping PC Sales 1 from Core Switch HQ`.
4. **Context**: `use <device>` enters a device context (prompt becomes `PC-1>`); `from` and `on` are then implied. `exit` leaves.
5. **Vendor-neutral vocabulary**: `show neighbors` not `show cdp neighbors`; `interface 3 down` not `no shutdown`; `add route` not `ip route`. **`interfaces` is THE standard unified term** — ports and NICs in one table.
6. **Tolerances are part of the spec**, not parser sugar: optional prepositions (`of`/`to`), dropped articles (`the`/`a`), `device`/`host` noise words, double-quoted names, IPs anywhere a device is expected, did-you-mean on unknown verbs and devices.
7. **Every refusal says what was expected.** A command that cannot be run answers with the form it should have had, or with the reason in the terms of the network (`PC-1 is a PC: routes belong on routers and firewalls`).

## Grammar (EBNF-like)

```
command       ::= diagnostic | inspection | configuration | session

diagnostic    ::= "ping" target ["from" device]
                | "trace" target ["from" device] ["as" service]
                | ("browse" | "mail" | "download") target ["from" device]
service       ::= "ping" | "web" | "email"

inspection    ::= "show" show-target [["of"] device]
show-target   ::= "devices" | "interfaces" | "ports" | "vlans"
                | "connections" | "config" | "neighbors" | "ip"
                | "routes" | "rules" | "nat"

configuration ::= set-cmd | vlan-cmd | link-cmd | iface-cmd | route-cmd | rule-cmd
                | forward-cmd
set-cmd       ::= "set" ("ip" | "gateway" | "subnet" | "name")
                        ["of"] device ["to"] value
vlan-cmd      ::= "add" "vlan" number ["to"] device
                | "remove" "vlan" number "from" device
link-cmd      ::= "connect" device ["to"] device
                | "disconnect" device ["from"] device

iface-cmd     ::= "interface" iface-id iface-setting [["on"] device]
iface-id      ::= number | nic-name                    (* port 3, eth0 *)
iface-setting ::= "up" | "down"
                | "ip" (ipv4 ["/" prefix] | "none")
                | "gateway" (ipv4 | "none")            (* network cards *)
                | "access" vlan                        (* switch ports *)
                | "trunk" (vlan {"," vlan} | "all")    (* switch ports *)
                | "default"                            (* switch ports: no VLAN of its own *)
                | "zone" ("trust" | "untrust" | "dmz" | "none")   (* firewall ports *)
                | "nat" ["on" | "off" | "none"]           (* router/firewall ports *)

route-cmd     ::= "add" ["backup"] "route" network "via" next-hop [["on"] device]
                | "remove" "route" network ["via" next-hop] [("from" | "on") device]
network       ::= ipv4 "/" prefix | "default"
next-hop      ::= ipv4 | device

rule-cmd      ::= "add" "rule" [position] ("allow" | "deny") [service | "any"]
                        "from" endpoint "to" endpoint [["on"] device]
                | "remove" "rule" position [("from" | "on") device]
endpoint      ::= "any" | "trust" | "untrust" | "dmz" | ipv4 | network | device

forward-cmd   ::= "add" "forward" [service | "any"] "from" ["interface"] number
                        "to" (ipv4 | device) [["on"] device]
                | "remove" "forward" position [("from" | "on") device]

session       ::= "use" device | "exit" | "clear" | "help" [topic]

target        ::= device | ipv4
device        ::= word { word } | '"' text '"'      (* multi-word, quotable *)
```

In a device context (`use …`) the `["from" device]`, `[["of"] device]` and
`[["on"] device]` parts default to the context device.

## Commands

### Diagnostics (engine-backed, real evaluation — not animation)

| Command | Meaning |
|---|---|
| `ping <target> [from <device>]` | Echo semantics: BOTH directions evaluated (request + reply), round trip animated on the canvas. |
| `trace <target> [from <device>] [as <service>]` | One way; prints every hop with what the device did (the VLAN, the route taken, the firewall decision) as the packet reaches it. `as web` / `as email` traces that service instead of a ping, which matters to firewall rules. Aliases: `traceroute`, `tracert`. |
| `browse <target> [from <device>]` | A whole web exchange: HTTP request, then the response. Aliases: `web`, `curl`. |
| `mail <target> [from <device>]` | An email, through its relay (see *Email and flow models*). Alias: `email`. |
| `download <target> [from <device>]` | Download request, then the data. To a firewall a download is web traffic. Alias: `wget`. |

`<target>` = device label or IP. A device name stands for its primary address
(the first network card of an end device, the management address of a router);
**an IP typed as target is the address aimed at**, so `ping 192.168.20.1`
reaches that interface of the router and not its main address. In device
context `from` is implied. Terminal output follows the packet animation in
real time.

#### How a packet is followed

At every device that handles the packet at layer 3:

1. **Routing.** The device looks the destination up in its routing table and
   takes the most specific entry:
   - *connected* — a network one of its addressed interfaces is in;
   - *static* — a route written on a router or firewall (`add route`);
   - *default* — the gateway of a network card on end devices, the device's
     `gateway` on routers.

   No entry → `blocked` (`no default gateway configured on PC-1`, `R1 has no
   route to 192.168.30.11`). `show routes <device>` prints this table.
2. **Filtering.** A firewall in transit applies its rules top to bottom: the
   first enabled rule whose service, source and destination match decides.
   When none matches, the zone policy decides: a new flow towards a more
   trusted zone is denied (`untrust→trust`, `untrust→dmz`, `dmz→trust`), the
   rest is allowed. The reply to an allowed flow always passes. Traffic
   addressed to the firewall itself is not filtered.

   A router or a firewall may also change the addresses of the packet: see
   *Address translation* below. A firewall filters between the two changes,
   so its rules always name real addresses.
3. **Delivery.** The packet is carried to the next address — the destination,
   or the next hop — across switches, VLAN by VLAN, through whatever port and
   cable are up. The shortest way that works is taken: a port that is down is
   gone round when the drawing offers another way.

until the destination answers, something drops the packet, or the packet
comes back to a router it already crossed (`routing loop`).

Verdicts: `error` (an endpoint does not exist or has no usable address),
`unreachable` (no cables join the two devices), `blocked` (dropped on the
way: the reason names the device, the port, the route or the rule),
`success`.

#### Address translation (NAT)

**The Internet does not carry private addresses.** A Cloud symbol named
*Internet* refuses a packet whose source or destination is in a private
range (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`),
and the reason says which of the two and what should have translated it. A
Cloud symbol with any other name (a carrier's network, a private line)
carries whatever crosses it.

- **Source NAT** (`interface <n> nat`). A new flow a router or a firewall
  forwards out of a port with NAT leaves with the address of that port. The
  hop says `NAT: source 192.168.10.12 → 203.0.113.1`. The device remembers
  the flow: the reply comes back to that address and is sent on to the real
  sender (`NAT: destination 203.0.113.1 → 192.168.10.12 (reply to a
  translated flow)`). A reply is never translated as a flow of its own, and
  what the device sends itself is not translated.
- **Port forward** (`add forward`). A new flow addressed to a port of the
  device, for a service the device forwards from that port, is sent on to
  an address inside (`NAT: destination 203.0.113.1 → 172.16.0.10 (port
  forward 1)`). The answer leaves with the address that was asked. Forwards
  are read top to bottom: the first that matches is taken.
- **A firewall on the same device** sees the packet with the destination
  already translated and the source not yet: a rule for a published server
  names its address inside. A forward says where the traffic goes; a rule
  has to say that it may.

**Which address is aimed at.** A device given by name is aimed at its own
address. When that address is private and the Internet is in between, the
sender aims instead at the device's own public address, if it has one, else
at the address a forward publishes it at for that service, and a note says
so (`Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge
publishes it (port forward 1)`). An address that is typed is the address
aimed at, and nothing is tried in its place.

#### Simulated failures

In presentation mode a device or a cable can be taken as broken ("what
happens if this goes down?"). The drawing is not changed, and the commands of
the terminal see the same failures for as long as the presentation lasts.

- A device that is down sends and takes nothing; a cable that is cut carries
  nothing: `SW-Core is down`, `link R-Sede–R-Filiale is down`.
- Delivery goes round them when the drawing offers another way (a ring of
  switches, a second cable between two devices).
- A route whose interface has no working cable left is withdrawn, as a device
  does when it loses the carrier, and the next route for that destination is
  taken. Write a backup route after the main one (in the Inspector: a second
  row for the same network):

  ```text
  pixelcake> add route 192.168.2.0/24 via 10.0.0.2 on R-Sede
  pixelcake> add backup route 192.168.2.0/24 via 10.0.1.2 on R-Sede
  R-Sede: backup route to 192.168.2.0/24 via 10.0.1.2 added
    used when the interface of the route via 10.0.0.2 has no working link
  ```

  The trace then carries the note `R-Sede: the route 192.168.2.0/24 via
  10.0.0.2 is unusable (link R-Sede–R-Filiale is down), the route
  192.168.2.0/24 via 10.0.1.2 is used instead`. The same holds for two
  default routes, and for a host with a gateway on each of two network cards.
- A network the device itself is attached to is not looked for elsewhere: the
  broken link is the answer.
- A next hop that dies behind a switch does not take the interface down: the
  route stays and the traffic is lost there, as with a plain static route.

#### VLANs

- A switch port is an **access** port in one VLAN or a **trunk** carrying a
  list (no list: every VLAN). Frames stay in their VLAN inside the switch;
  they leave an access port untagged and a trunk tagged.
- A switch applies VLANs port by port **once any of its ports has a VLAN**:
  from then on the ports nobody touched are access ports in VLAN 1, as on
  real hardware. A switch with no VLAN on any port forwards frames as they
  are.
- Two access ports facing each other join their VLANs, as cabled. Untagged
  traffic on a trunk is in VLAN 1.
- A device's own VLAN list (`add vlan`): on a switch, the VLANs it knows
  (others are dropped; VLAN 1 always exists); on anything else, the VLANs its
  interfaces tag and accept on a trunk. A device that declares VLANs must sit
  on a port of one of them.
- A switch answers on its own address in VLAN 1.
- Routing between VLANs needs a router with a port in each (router
  sub-interfaces are not modelled).

#### Who forwards what

| Device | In transit |
|---|---|
| Router, firewall with interface addresses | routes by its table, never passes traffic inside one network |
| Switch, access point | bridges, VLAN by VLAN |
| Router, firewall **without** interface addresses | transparent: lets traffic through (a firewall still applies its policy between the two ports); nothing is verified |
| Internet/Cloud symbol, load balancer | not simulated: assumed to let traffic through |
| PC, server and other end devices | nothing: an end device does not carry traffic for others |

**What is not verified says so.** The engine never turns an unchecked
condition into a silent success; it adds a note to the result instead:

- `link A–B has no port binding…: per-port rules skipped` — one end is not
  attached to an interface
- `Router-1 has no interface addresses: gateway and routing not verified` —
  the router's ports carry no IP (typically data from before ports could be
  addressed): it is assumed to pass the packet on
- `203.0.113.1 is not in the drawing: Internet assumed to take the traffic` —
  a gateway that belongs to the outside world, with an Internet symbol on
  that network
- `Internet is not simulated: traffic assumed to pass`
- `NAT on Router-1 port 2 is not simulated: addresses are not translated`
- `firewall FW-1 has no zone binding: allowed` — the firewall's links are not
  attached to zoned ports
- `firewall FW-1: rule 2 names a zone and the link is not attached to a port:
  skipped`

### Inspection (read-only)

| Command | Meaning |
|---|---|
| `show devices` | All devices with type and IP |
| `show interfaces [of] <device>` | **Unified interface table** — ports + NICs in one view (the standard term), with the address and VLAN of each and the device it is linked to |
| `show ports [of] <device>` | Port table (status, mode, VLAN, zone, IP, link) — specialized ports-only view |
| `show vlans` | Every VLAN with where it lives: the ports of the switches that apply VLANs, and the devices that carry it in their own list |
| `show connections [of <device>]` | Links, with the interface on each end: `[port 3 ↔ eth0]` (`?` for an end not attached to an interface) |
| `show config [of] <device>` | IP/subnet/gateway, VLANs, STP, ports, NICs, number of routes and rules, NAT |
| `show neighbors [of] <device>` | Directly connected devices |
| `show ip [of] <device>` | Compact addressing summary: primary ip/mask/gateway + each NIC + each addressed port |
| `show routes [of] <device>` | The routing table exactly as the engine reads it: destination, next hop, interface it leaves from, kind. A route whose next hop is on none of the device's networks is flagged |
| `show rules [of] <device>` | The firewall rules in order, then what decides when none matches |
| `show nat [of] <device>` | The interfaces that do source NAT with the address each gives, then the port forwards in order |

Aliases: `sh` → `show` · `ls`, `list` → `show devices` ·
`ipconfig`, `ifconfig` → `show ip`.

### Configuration (writes to the canvas, like any edit)

| Command | Meaning |
|---|---|
| `set ip [of] <device> [to] <ip>` | Also `set gateway …`, `set subnet …`, `set name …`. On a device with network cards these write the first one. On a router `set gateway` sets the default route |
| `interface <id> up\|down [on] <device>` | Interface state — **canonical form**. `<id>` is a port number or the name of a network card (`eth0`). `enable\|disable port <n> on <device>` stays as an accepted variant |
| `interface <id> ip <address>[/<prefix>] [on] <device>` | Address of a router/firewall port or of a network card (`ip none` clears it). Without a prefix the mask already there is kept, else /24 |
| `interface <name> gateway <address> [on] <device>` | Default gateway of a network card (`gateway none` clears it) |
| `interface <n> access <vlan> [on] <switch>` | The port becomes an access port in that VLAN |
| `interface <n> trunk <vlan,vlan,…>\|all [on] <switch>` | The port becomes a trunk for those VLANs (`all`, or no list: every VLAN) |
| `interface <n> default [on] <switch>` | The port has no VLAN of its own any more |
| `interface <n> zone trust\|untrust\|dmz\|none [on] <firewall>` | Security zone of a firewall port |
| `interface <n> nat [on] <device>` / `interface <n> nat off [on] <device>` | Source NAT on a port of a router or firewall: what the device forwards out of it takes its address. `nat none` is the same as `nat off` |
| `add route <network>\|default via <next hop> [on] <device>` | Static route on a router or firewall. The network is written `192.168.30.0/24`; the next hop is an address, or a device with an address on a network the two share. Adding a route to a network that has one replaces its next hop |
| `add backup route <network>\|default via <next hop> [on] <device>` | A second route to a network that has one. It is used when the interface of the first has no working link (a port switched off, or a failure simulated in presentation mode). `show routes` marks it `backup` |
| `remove route <network>\|default [via <next hop>] [from] <device>` | Without `via`, every route to that network; with it, the one through that next hop |
| `add rule [<position>] allow\|deny [<service>\|any] from <source> to <destination> [on] <firewall>` | Firewall rule, added last or at the given position. Source and destination are `any`, a zone, an address, a network, or a device (stored as its address). No service means any |
| `remove rule <n> [from] <firewall>` | |
| `add forward [<service>\|any] from interface <n> to <address> [on] <device>` | Port forward on a router or firewall: what arrives for the address of interface `<n>`, for the service, is sent on to the address, which may be given as a device. No service means any. `interface` may be left out |
| `remove forward <n> [from] <device>` | |
| `add vlan <id> [to] <device>` / `remove vlan <id> from <device>` | The VLAN list of a device (see *VLANs*) |
| `connect <A> [to] <B>` / `disconnect <A> [from] <B>` | Create/remove a link. `connect` attaches each end to the first free interface and says which: `connected A (port 3) ↔ B (eth0)`. On a firewall with security zones the end stays unattached: choose the port, and with it the zone, in the connection editor |

Values are validated before writing (`"999.1.2.3" is not a valid IPv4
address`, `"servers" is not a network: write it as 192.168.30.0/24, or
"default"`). Service names: `ping` (also `icmp`), `web` (`http`, `https`),
`email` (`mail`, `smtp`); `allow`/`deny` may be written `permit`/`block`.

### Session

| Command | Meaning |
|---|---|
| `use <device>` | Enter device context (`exit`/`quit` to leave); `from` and `on` implied |
| `clear` | Clear the screen (alias `cls`) |
| `help [topic]` | The reference, filterable by topic (alias `?`) |

## Email and flow models

The same engine that judges `ping`/`trace` evaluates the flow models —
`ping`, `web`, `download`, `email` — whether they are started from the
simulation panel or from the terminal (`ping`, `browse`, `download`, `mail`).
Each model is a plan of one or more legs, each traced hop-by-hop; the verdict
is `success` only when ALL legs pass, and evaluation stops at the first
failing leg. A reply goes back to the address the request came from.

Email relays depend on the configured **email mode**:

- `internal` — nearest internal mail server (hops from the source); legs
  `SMTP submit` + `delivery`. No mail server → error.
- `cloud` — nearest internet exit (Internet/Cloud/WAN/ISP device); legs
  `SMTP to cloud provider` + `cloud delivery`. No internet exit → error.
- `auto` (default) — prefers internal, falls back to cloud with a note
  (`no internal mail server: using cloud email via <relay>`).

When an endpoint already IS the relay the plan collapses to a single leg.

## Examples

On the bundled sample network (two subnets, one router):

```
pixelcake> ping Web-01 from PC-1
pixelcake> trace 192.168.20.20 from PC-2
pixelcake> show interfaces of Router-1
pixelcake> show routes of Router-1
pixelcake> use PC-1
PC-1> trace Mail-01
PC-1> browse Web-01
PC-1> exit
```

A VLAN, port by port:

```
pixelcake> interface 1 access 10 on SW-Office
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: VLAN 10 does not leave through port 2 on SW-Office: it is in the default VLAN 1
  dropped at: SW-Office
pixelcake> interface 2 access 10 on SW-Office
pixelcake> ping PC-2 from PC-1
Reply from 192.168.10.12: hops=3 time=3ms
```

A second router, and the route to what is behind it:

```
pixelcake> interface 3 ip 10.0.0.1/30 on Router-1
pixelcake> interface 1 ip 10.0.0.2/30 on Router-2
pixelcake> interface 2 ip 192.168.30.1/24 on Router-2
pixelcake> ping Branch-PC from PC-1
Ping failed (blocked): request: Router-1 has no route to 192.168.30.11
pixelcake> add route 192.168.30.0/24 via 10.0.0.2 on Router-1
pixelcake> ping Branch-PC from PC-1
Ping failed (blocked): reply: Router-2 has no route to 192.168.10.11
pixelcake> add route default via Router-1 on Router-2
Router-2: route to default via 10.0.0.1 added
  Router-1 → 10.0.0.1
pixelcake> trace Branch-PC from PC-1
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)
  3  ○ Router-1 (Router)  — routed: 192.168.30.0/24 via 10.0.0.2 (port 3)
  4  ○ Router-2 (Router)  — routed: 192.168.30.0/24 is on port 2
  5  ● Branch-PC (PC)
Trace complete: destination reached.
```

A firewall that publishes one service of one server:

```
pixelcake> interface 1 zone trust on FW-1
pixelcake> interface 2 zone untrust on FW-1
pixelcake> browse Web-01 from Ext
Browse failed (blocked): HTTP request: firewall policy on FW-1: untrust → trust denied
pixelcake> add rule allow web from untrust to Web-01 on FW-1
FW-1: rule 1 added — allow web from untrust to 192.168.20.10
  Web-01 → 192.168.20.10
pixelcake> browse Web-01 from Ext
  ✓ HTTP request: Ext → Web-01
  ✓ HTTP response: Web-01 → Ext
Page received from Web-01
pixelcake> ping Web-01 from Ext
Ping failed (blocked): request: firewall FW-1: no rule matches, zone policy untrust → trust denied
```

A firewall that does NAT towards the Internet (the sample of the welcome
screen):

```
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
   2  email  from interface 3   (203.0.113.1) to 192.168.30.40
pixelcake> trace Cliente-Remoto from PC-Vendite
  1  ○ PC-Vendite (PC)
  2  ○ SW-Uffici (Switch)  — VLAN 10
  3  ○ SW-Core (Switch)  — VLAN 10
  4  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 4)
  5  ○ FW-Edge (Firewall)  — routed: 203.0.113.0/24 is on port 3; firewall FW-Edge: no rule matches, zone policy trust → untrust allowed; NAT: source 192.168.10.12 → 203.0.113.1
  6  ○ Internet (Cloud)  — Internet is not simulated: traffic assumed to pass
  7  ● Cliente-Remoto (PC)
Trace complete: destination reached.
pixelcake> browse Portale-Clienti from Cliente-Remoto
Browsing Portale-Clienti (203.0.113.1) from Cliente-Remoto...
  ✓ HTTP request: Cliente-Remoto → Portale-Clienti
  ✓ HTTP response: Portale-Clienti → Cliente-Remoto
Page received from Portale-Clienti
  note: HTTP request: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
pixelcake> ping Portale-Clienti from Cliente-Remoto
Ping failed (blocked): request: Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
pixelcake> interface 3 nat off on FW-Edge
port 3 on FW-Edge no longer does NAT: what leaves by it keeps its own address
pixelcake> ping Cliente-Remoto from PC-Vendite
Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.12 has to be translated before it goes out, and NAT is off on port 3 on FW-Edge
pixelcake> interface 3 nat on FW-Edge
port 3 on FW-Edge now does NAT: what leaves by it takes the address 203.0.113.1
pixelcake> add forward web from interface 3 to Portale-Clienti on FW-Edge
FW-Edge already has it: forward 1
pixelcake> remove forward 2 from FW-Edge
FW-Edge: forward 2 removed — forward email from interface 3 to 192.168.30.40
```

## Design notes

- The engine consumes only data the drawing holds; every field it reads
  (addresses, routes, VLANs, port state, zones, rules, the interface
  bindings) is in the project file and in the YAML export.
- Every link end is attached to one interface of its device: a port
  (`sourcePort`/`targetPort`) or a NIC (`sourceNic`/`targetNic`). New links
  take the first free interface; drawings saved before bindings existed are
  attached the same way when they are opened. An end that cannot be attached
  (no free interface, or a firewall with security zones, where the port is
  the user's choice) skips per-port rules and says so in the trace notes.
- Configuration commands go through the same store actions as graphical
  edits, so they are kept like any other edit (in the browser at once, in
  the project file at the next save) and are consistent with the Inspector.
- Nothing saved before routing existed stops working: a router whose ports
  carry no address still lets traffic through, with a note.

## Not simulated

ARP and MAC tables, spanning tree (a drawing with redundant links is walked
without loops, but no port is blocked), DHCP, DNS, dynamic routing,
gateway redundancy (a host has one gateway per network card), router
sub-interfaces, TCP/UDP ports beyond the three services, link speed and ping
times (the time printed is derived from the number of hops).

Of NAT: port numbers (a forward is a service on an interface, and two flows
never compete for a translation), a server reached from inside at its
published address is not treated apart, and a device behind two layers of
NAT is found by name only through the first.

## Language roadmap

The spec will grow with the engine's capabilities; every extension keeps the
principles above (verb-first, optional prepositions, neutral vocabulary):

- **Failures from the terminal** — failures are simulated in presentation
  mode today, and the terminal sees them; commands to break and repair a
  device or a link, and to list what stops working, are not in the language
  yet
- **More services** — `ssh`, `dns`, and rules by port number
