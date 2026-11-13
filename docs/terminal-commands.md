# NCL — Network Command Language v0.5

**NCL (Network Command Language)** is a vendor-neutral command language in
semi-natural English. Cisco, Juniper and Mikrotik each speak their own
dialect; NCL aims to be the esperanto: one open, cross-vendor way to express
network diagnostics, inspection and configuration. No IOS/JunOS syntax: plain
verbs, optional prepositions, case-insensitive. Device names may be
multi-word and are resolved fuzzily ("did you mean…?" on miss); an IP address
is accepted anywhere a device is expected, and a host name wherever a
question has a target.

This document is the **source of the spec**. In the app, `help` in the
terminal lists the same commands, and so does Aiuto → Comandi del terminale.
The language is versioned independently of the app; until v1.0 canonical
forms are stable but aliases and output formats may still be refined between
minor versions.

**New in v0.5:** DNS. A host name works as the target of `ping`, `trace`,
`browse`, `mail` and `download`: the source asks its DNS server first, and
the lookup is shown before the flow. `resolve <name>` does the lookup alone.
A server keeps records (`add record`, `remove record`), a network card names
the server it asks (`interface <name> dns`), a pool hands one out
(`pool … dns <address>`), `show dns`. `dns` is a service for rules, forwards
and `trace … as dns`.

**New in v0.4:** DHCP. A network card takes its address from a server
(`interface <name> dhcp`), an interface hands out a range of addresses
(`interface <n> pool`), `show dhcp`. The `show` commands tell a leased
address from one written by hand.

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
                | "resolve" name ["from" device]
service       ::= "ping" | "web" | "email" | "dns"

inspection    ::= "show" show-target [["of"] device]
show-target   ::= "devices" | "interfaces" | "ports" | "vlans"
                | "connections" | "config" | "neighbors" | "ip"
                | "routes" | "rules" | "nat" | "dhcp" | "dns"

configuration ::= set-cmd | vlan-cmd | link-cmd | iface-cmd | route-cmd | rule-cmd
                | forward-cmd | record-cmd
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
                | "dhcp" ["on" | "off" | "none"]          (* network cards *)
                | ["dhcp"] "pool" (ipv4 ["to"] ipv4 ["gateway" ipv4] ["dns" ipv4] | "none")
                                                          (* router/firewall ports, server cards *)
                | "dns" (ipv4 | "none")                   (* network cards *)

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

record-cmd    ::= "add" "record" name ["to"] (ipv4 | device) [["on"] device]
                | "remove" "record" (position | name) [("from" | "on") device]

session       ::= "use" device | "exit" | "clear" | "help" [topic]

target        ::= device | ipv4 | name
device        ::= word { word } | '"' text '"'      (* multi-word, quotable *)
name          ::= label "." label { "." label }     (* www.azienda.example *)
```

In a device context (`use …`) the `["from" device]`, `[["of"] device]` and
`[["on"] device]` parts default to the context device. `show dhcp` with no
device, outside a context, is about the whole drawing.

## Commands

### Diagnostics (engine-backed, real evaluation — not animation)

| Command | Meaning |
|---|---|
| `ping <target> [from <device>]` | Echo semantics: BOTH directions evaluated (request + reply), round trip animated on the canvas. |
| `trace <target> [from <device>] [as <service>]` | One way; prints every hop with what the device did (the VLAN, the route taken, the firewall decision) as the packet reaches it. `as web` / `as email` traces that service instead of a ping, which matters to firewall rules. Aliases: `traceroute`, `tracert`. |
| `browse <target> [from <device>]` | A whole web exchange: HTTP request, then the response. Aliases: `web`, `curl`. |
| `mail <target> [from <device>]` | An email, through its relay (see *Email and flow models*). Alias: `email`. |
| `download <target> [from <device>]` | Download request, then the data. To a firewall a download is web traffic. Alias: `wget`. |
| `resolve <name> [from <device>]` | A DNS lookup alone: the server asked, the request and the reply, then the address the name stands for, or the reason there is none. Aliases: `lookup`, `nslookup`. |

`<target>` = device label, IP or host name. A device name stands for its primary address
(the first network card of an end device, leased or written by hand; the
management address of a router);
**an IP typed as target is the address aimed at**, so `ping 192.168.20.1`
reaches that interface of the router and not its main address. **A target
that is neither a device nor an address, and reads as a host name, is looked
up first** (see *DNS* below): the lookup is printed and animated before the
flow, and the flow then goes to the address found exactly as if it had been
typed. When the lookup fails the command stops there, with the reason. In
device context `from` is implied. Terminal output follows the packet
animation in real time.

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

#### DHCP

A network card can take its address from a DHCP server instead of having one
written on it. The engine has no clock, so **a lease is not remembered: it is
worked out from the drawing**, the same way every time.

- **Client** (`interface <name> dhcp`). A network card of a device that does
  not route. While it is on DHCP the card keeps no address of its own.
- **Server** (`interface <n> pool <first> to <last>`). One pool per
  interface, for the network of that interface: a port of a router or of a
  firewall, or a card of a server. With the address the server hands out the
  mask of its interface and a gateway: the one written in the pool, else the
  address of the port itself on a router or firewall, else none (and the
  clients then talk inside their network only).
- **Who answers whom.** A card is served by a pool whose interface is on the
  same network: reached across switches and access points, VLAN by VLAN,
  through ports and cables that are up. A router does not pass the request on
  to another network. With two servers on one network the first in the
  drawing that has an address left answers, and a warning names them.
- **Which address.** Cards are served in the order of the drawing; each gets
  the lowest address of the range that nobody has: not written by hand on any
  interface of the drawing, not leased already, not the first or the last
  address of the network. So writing an address by hand inside a range moves
  the lease that had it.
- **A card that gets nothing has no address**, and a question from it or to it
  says why: `Portatile-1 has no address: no DHCP server answers on its
  network`, `… the pool of Router-Core port 2 is used up: 100 addresses, all
  taken`, `… interface eth0 has no cable attached`.

`show dhcp` lists pools, leases and the cards left without an address;
`show ip`, `show config`, `show devices`, `show neighbors` and
`show interfaces` mark an address that is leased with `dhcp`.

#### DNS

A name can stand for an address. The engine has no clock and no cache, so **a
name is looked up each time a question uses it**, and the lookup is a real
exchange that can fail like any other.

- **Records** (`add record <name> <address>`). A server keeps a list of
  names, each with one address. A name is a host name with at least one dot
  (`gestionale.azienda.example`); upper and lower case are the same. A server
  answers only for the names written on it.
- **Who asks whom** (`interface <name> dns <address>`). A network card names
  the DNS server it asks, by its address. A card on DHCP does not: it asks
  the server its pool hands out with the lease (`pool … dns <address>`), or
  nobody. A device asks through its first enabled card that names a server.
  A router, a firewall and a switch have no cards, and ask nobody.
- **A lookup is a round trip.** A request goes from the device to the address
  of its DNS server and the reply comes back, as the service `dns`. Both are
  followed like any other packet: VLANs, routes, firewall rules, NAT and
  simulated failures apply. A firewall rule or a port forward can name
  `dns`, and `any` covers it. Only when both arrive is the record read.
- **A lookup that fails says why**: `Cliente-Remoto has no DNS server: it
  cannot look up portale.azienda.example`; `PC-1 asks 8.8.8.8 for names, an
  address no device has`; the reason of the trace, with the leg it is about
  (`DNS request: firewall policy on FW-1: untrust → dmz denied`);
  `192.168.30.30 is Web-Gestionale, which is not a DNS server: it keeps no
  records`; `Srv-Auth has no record for intranet.azienda.example`.

`show dns` lists the records of every server and who asks whom; `show ip`
and `show config` write ` dns <address>` after the gateway of a card that
asks one. The simulation panel and the presentation choose devices from
menus, and do not use names.

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
- A lease does not change: a device keeps the address it had, even when it is
  its DHCP server that is down.
- A lookup is an exchange like any other: with the DNS server down, or the
  way to it cut, names find no address while the addresses still answer.

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
- `firewall FW-1 has no zone binding: allowed` — the firewall's links are not
  attached to zoned ports
- `firewall FW-1: rule 2 names a zone and the link is not attached to a port:
  skipped`

### Inspection (read-only)

| Command | Meaning |
|---|---|
| `show devices` | All devices with type and IP (`(dhcp)` after an address that is leased) |
| `show interfaces [of] <device>` | **Unified interface table** — ports + NICs in one view (the standard term), with the address and VLAN of each and the device it is linked to |
| `show ports [of] <device>` | Port table (status, mode, VLAN, zone, IP, link) — specialized ports-only view |
| `show vlans` | Every VLAN with where it lives: the ports of the switches that apply VLANs, and the devices that carry it in their own list |
| `show connections [of <device>]` | Links, with the interface on each end: `[port 3 ↔ eth0]` (`?` for an end not attached to an interface) |
| `show config [of] <device>` | IP/subnet/gateway, VLANs, STP, ports, NICs, number of routes and rules, NAT, DHCP, DNS |
| `show neighbors [of] <device>` | Directly connected devices |
| `show ip [of] <device>` | Compact addressing summary: primary ip/mask/gateway + each NIC + each addressed port. A card on DHCP shows its lease and the pool it comes from, or why it has none. A card that asks a DNS server shows which |
| `show routes [of] <device>` | The routing table exactly as the engine reads it: destination, next hop, interface it leaves from, kind. A route whose next hop is on none of the device's networks is flagged |
| `show rules [of] <device>` | The firewall rules in order, then what decides when none matches |
| `show nat [of] <device>` | The interfaces that do source NAT with the address each gives, then the port forwards in order |
| `show dhcp [[of] <device>]` | The pools (range, gateway and DNS server handed out, how many addresses are leased and free), the leases (address, card, pool) and the cards left without an address, each with the reason. Of the whole drawing, or of what one device hands out and is given |
| `show dns [[of] <device>]` | Of the whole drawing: the records of every server, and every device that asks a DNS server, with the card it asks through. Of one device: its records if it is a server, and for each of its cards the server it asks, which device that is, and whether it came with the lease |

Aliases: `sh` → `show` · `ls`, `list` → `show devices` ·
`ipconfig`, `ifconfig` → `show ip`.

### Configuration (writes to the canvas, like any edit)

| Command | Meaning |
|---|---|
| `set ip [of] <device> [to] <ip>` | Also `set gateway …`, `set subnet …`, `set name …`. On a device with network cards these write the first one. On a router `set gateway` sets the default route. On a device whose first card is on DHCP, `set ip` takes the card off DHCP; mask and gateway come with the lease and are refused |
| `interface <id> up\|down [on] <device>` | Interface state — **canonical form**. `<id>` is a port number or the name of a network card (`eth0`). `enable\|disable port <n> on <device>` stays as an accepted variant |
| `interface <id> ip <address>[/<prefix>] [on] <device>` | Address of a router/firewall port or of a network card (`ip none` clears it). Without a prefix the mask already there is kept, else /24. An address written on a card that was on DHCP takes it off DHCP |
| `interface <name> gateway <address> [on] <device>` | Default gateway of a network card (`gateway none` clears it) |
| `interface <n> access <vlan> [on] <switch>` | The port becomes an access port in that VLAN |
| `interface <n> trunk <vlan,vlan,…>\|all [on] <switch>` | The port becomes a trunk for those VLANs (`all`, or no list: every VLAN) |
| `interface <n> default [on] <switch>` | The port has no VLAN of its own any more |
| `interface <n> zone trust\|untrust\|dmz\|none [on] <firewall>` | Security zone of a firewall port |
| `interface <n> nat [on] <device>` / `interface <n> nat off [on] <device>` | Source NAT on a port of a router or firewall: what the device forwards out of it takes its address. `nat none` is the same as `nat off` |
| `interface <name> dhcp [on] <device>` / `interface <name> dhcp off [on] <device>` | A network card takes its address from the DHCP server of its network; the answer says which address it is leased, or why none. `dhcp off` leaves the card without an address (`dhcp none` is the same) |
| `interface <id> pool <first> to <last> [gateway <address>] [dns <address>] [on] <device>` | DHCP server on a port of a router or firewall, or on a card of a server: the range it hands out to its network, replacing the one it had, with the gateway and the DNS server it names. `pool none` stops it. `to` may be left out or written `-`; `interface <id> dhcp pool …` is an accepted variant |
| `interface <name> dns <address> [on] <device>` | The DNS server a network card asks (`dns none`: nobody). Refused on a card on DHCP, where it comes with the lease |
| `add route <network>\|default via <next hop> [on] <device>` | Static route on a router or firewall. The network is written `192.168.30.0/24`; the next hop is an address, or a device with an address on a network the two share. Adding a route to a network that has one replaces its next hop |
| `add backup route <network>\|default via <next hop> [on] <device>` | A second route to a network that has one. It is used when the interface of the first has no working link (a port switched off, or a failure simulated in presentation mode). `show routes` marks it `backup` |
| `remove route <network>\|default [via <next hop>] [from] <device>` | Without `via`, every route to that network; with it, the one through that next hop |
| `add rule [<position>] allow\|deny [<service>\|any] from <source> to <destination> [on] <firewall>` | Firewall rule, added last or at the given position. Source and destination are `any`, a zone, an address, a network, or a device (stored as its address). No service means any |
| `remove rule <n> [from] <firewall>` | |
| `add forward [<service>\|any] from interface <n> to <address> [on] <device>` | Port forward on a router or firewall: what arrives for the address of interface `<n>`, for the service, is sent on to the address, which may be given as a device. No service means any. `interface` may be left out |
| `remove forward <n> [from] <device>` | |
| `add record <name> [to] <address> [on] <server>` | A name a server answers for as a DNS server. The address may be given as a device, and is stored as the address it has. A name that is already there takes the new address: one name, one address |
| `remove record <n>\|<name> [from] <server>` | By its place in the list, or by its name |
| `add vlan <id> [to] <device>` / `remove vlan <id> from <device>` | The VLAN list of a device (see *VLANs*) |
| `connect <A> [to] <B>` / `disconnect <A> [from] <B>` | Create/remove a link. `connect` attaches each end to the first free interface and says which: `connected A (port 3) ↔ B (eth0)`. On a firewall with security zones the end stays unattached: choose the port, and with it the zone, in the connection editor |

Values are validated before writing (`"999.1.2.3" is not a valid IPv4
address`, `"servers" is not a network: write it as 192.168.30.0/24, or
"default"`). Service names: `ping` (also `icmp`), `web` (`http`, `https`),
`email` (`mail`, `smtp`), `dns`; `allow`/`deny` may be written
`permit`/`block`.

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

DHCP on the same sample: the router hands out the offices and the Wi-Fi, and
the two laptops take their address from it.

```
pixelcake> show dhcp
DHCP — 2 pools, 2 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
  192.168.20.101   Portatile-2 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> show ip Portatile-1
Portatile-1 — addressing
  ip:       192.168.20.100 (dhcp)
  subnet:   255.255.255.0
  gateway:  192.168.20.1
  eth0: 192.168.20.100 / 255.255.255.0 gw 192.168.20.1 dns 192.168.30.10 (dhcp from Router-Core port 2)
pixelcake> interface eth0 dhcp on PC-Vendite
interface eth0 on PC-Vendite now takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 by Router-Core port 1
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> interface 1 pool none on Router-Core
port 1 on Router-Core no longer hands out addresses
  without an address now: PC-Vendite
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Ping failed (error): request: PC-Vendite has no address: no DHCP server answers on its network
pixelcake> interface 1 pool 192.168.10.100 to 192.168.10.149 dns 192.168.30.10 on Router-Core
port 1 on Router-Core now hands out 192.168.10.100 to 192.168.10.149: 50 addresses, gateway 192.168.10.1, DNS server 192.168.30.10
  leased now: PC-Vendite 192.168.10.100
pixelcake> show dhcp Router-Core
DHCP of Router-Core
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.149  gateway 192.168.10.1  dns 192.168.30.10  1 leased, 49 free of 50
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.10.100   PC-Vendite eth0          from Router-Core port 1
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
  192.168.20.101   Portatile-2 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

DNS on the same sample: Srv-Auth knows the names of the inside, the offices
and the laptops ask it, and the customer outside has nobody to ask.

```
pixelcake> show dns
DNS — 1 server, 3 records
RECORDS of Srv-Auth (192.168.30.10)
   1  gestionale.azienda.example       192.168.30.30
   2  posta.azienda.example            192.168.30.40
   3  portale.azienda.example          172.16.0.10
WHO ASKS WHOM
  PC-Contabilità eth0      192.168.30.10
  PC-Vendite eth0          192.168.30.10
  Stampante eth0           192.168.30.10
  Portatile-1 eth0         192.168.30.10  (with its lease)
  Portatile-2 eth0         192.168.30.10  (with its lease)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> resolve gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> ping gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> browse portale.azienda.example from Portatile-1
Looking up portale.azienda.example from Portatile-1 (DNS server 192.168.30.10)...
  ✓ DNS request: Portatile-1 → Srv-Auth
  ✓ DNS reply: Srv-Auth → Portatile-1
portale.azienda.example is 172.16.0.10 (answered by Srv-Auth)
Browsing Portale-Clienti (172.16.0.10) from Portatile-1...
  ✓ HTTP request: Portatile-1 → Portale-Clienti
  ✓ HTTP response: Portale-Clienti → Portatile-1
Page received from Portale-Clienti
  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
pixelcake> resolve intranet.azienda.example from PC-Vendite
Looking up intranet.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
Lookup failed: Srv-Auth has no record for intranet.azienda.example
pixelcake> add record intranet.azienda.example Web-Gestionale on Srv-Auth
Srv-Auth: record 4 added — intranet.azienda.example is 192.168.30.30
  Web-Gestionale → 192.168.30.30
pixelcake> resolve intranet.azienda.example from PC-Vendite
Looking up intranet.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
intranet.azienda.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> resolve portale.azienda.example from Cliente-Remoto
Looking up portale.azienda.example from Cliente-Remoto...
Lookup failed: Cliente-Remoto has no DNS server: it cannot look up portale.azienda.example
pixelcake> interface eth0 dns none on PC-Vendite
interface eth0 on PC-Vendite asks no DNS server now
pixelcake> ping gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite...
Lookup failed: PC-Vendite has no DNS server: it cannot look up gestionale.azienda.example
pixelcake> show dns PC-Vendite
DNS of PC-Vendite
  eth0: asks nobody
  name a DNS server: interface eth0 dns <address> on PC-Vendite
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
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
  bindings, the pools and the cards on DHCP, the records and the DNS server
  of each card) is in the project file and in the YAML export. A lease is
  not in any file, and neither is the address a name resolved to: both are
  worked out again from the drawing.
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
without loops, but no port is blocked), dynamic routing,
gateway redundancy (a host has one gateway per network card), router
sub-interfaces, TCP/UDP ports beyond the four services, link speed and ping
times (the time printed is derived from the number of hops).

Of NAT: port numbers (a forward is a service on an interface, and two flows
never compete for a translation), a server reached from inside at its
published address is not treated apart, and a device behind two layers of
NAT is found by name only through the first.

Of DHCP: relay (a server giving addresses to another network through a
router), reservations (the same address always to the same card), lease
times and renewal, a router or a firewall port that takes its own address
from DHCP. A lease is a function of the drawing, so there is no `renew`.

Of DNS: a second DNS server to fall back on (a card names one), forwarders
and recursion (a server answers only for its own records, and never asks
another; a public DNS server outside the drawing is nobody), reverse lookup,
cache and TTL (every question that uses a name looks it up again), wildcards
and aliases. A device with no network card asks nobody.

## Language roadmap

The spec will grow with the engine's capabilities; every extension keeps the
principles above (verb-first, optional prepositions, neutral vocabulary):

- **Failures from the terminal** — failures are simulated in presentation
  mode today, and the terminal sees them; commands to break and repair a
  device or a link, and to list what stops working, are not in the language
  yet
- **More services** — `ssh`, and rules by port number
