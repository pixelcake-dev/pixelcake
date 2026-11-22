---
title: "How the engine decides"
description: "The path of a packet hop by hop, at layer 3 and layer 2, the reasons it gives when it stops, and what is not simulated."
order: 2
---

The engine is the part of PixelCake that answers a question such as "does PC-1 reach Web-01?". It is given the drawing (devices, cables, and everything set on them) and follows one packet from the sender to the destination, one device at a time. It looks at what each device would do with the packet, and the answer is the place where the packet arrives or the place where it stops, with the reason.

The same engine answers the [simulation panel](simulation-panel.md), [presentation mode](presentation.md) and the terminal ([ping, trace and the other commands](../terminal/asking.md)). It never looks at the screen and keeps nothing between two questions: the same drawing and the same question always give the same answer.

## Before the packet starts {#before}

Five things are settled before the first hop.

1. **Addresses from DHCP.** A network card set to take its address from a DHCP server has the address it is leased. The engine works the lease out from the drawing, the same way every time. A card that gets none has no address, and the answer says why: [a card that gets none](../services/dhcp.md#no-address).
2. **Names.** In the terminal a host name can stand in place of a device. The engine first asks the DNS server of the sender, as a request and a reply that travel like any other packet, and only then sends the real question to the address it found. The panel and the presentation choose devices from menus and use no names: [a lookup](../services/dns.md#lookup).
3. **Both ends exist and have an address.** Without one the answer is `error` and says which device has none (`PC-1 has no IP address configured`).
4. **The address is not in conflict.** When the address the question goes to is on another device too, and the two can meet, nobody can say which of them answers: the answer is `error`, and names the address and the devices (`address conflict: 192.168.20.10 is on both Web-01 and Mail-01, so the answer cannot be trusted`). The same holds for the address the sender sends from, and for a port forward that sends the packet on to such an address. [Two devices with one address](../building/addresses.md#conflicts) says which addresses collide.
5. **A cable joins them.** The engine looks for any chain of cables between the two devices, as drawn. If there is none the answer is `unreachable` (`no physical path between PC-1 and Web-01`). A cable that is cut by a [simulated failure](#failures) is still drawn: the answer is then a stop, with the cable as the reason.

A device that is down sends nothing. If the sender is down the question stops on it (`PC-1 is down`).

## Hop by hop {#hop-by-hop}

The walk alternates two kinds of step.

- At a device that works at layer 3 (the sender, a router, a firewall) the engine **decides**: where should this packet go next? It looks up the route, applies the firewall and the address translation, and finds the next address.
- Between two layer 3 devices the engine **delivers**: it carries the packet to that next address across whatever lies between, switches and access points, VLAN by VLAN, and checks every port and cable on the way.

Then it decides again at the device where the delivery ended, until the destination answers, something drops the packet, or the packet comes back to a router it has already crossed (`routing loop: the packet comes back to Router-1`).

```ncl sample=office
pixelcake> trace Web-01 from PC-1
Tracing route to Web-01 (192.168.20.10) from PC-1:
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)
  3  ○ Router-1 (Router)  — routed: 192.168.20.0/24 is on port 2
  4  ○ SW-Servers (Switch)
  5  ● Web-01 (Server)
Trace complete: destination reached.
```

Each line is a device the packet went through: `○` passed on, `●` delivered, and `✗` dropped. What a device did is written after the dash. PC-1 decided that Web-01 is outside its network, so it sent the packet to its gateway; the delivery crossed SW-Office; Router-1 decided that 192.168.20.0/24 is on its port 2; the delivery crossed SW-Servers and reached Web-01.

The way a packet takes is not chosen by a metric. At layer 3 the routing table says which address comes next; at layer 2 the engine takes the shortest chain of cables that works, as [below](#layer-2) explains. Cable speeds and the names of the cables count for nothing.

## At layer 3 {#layer-3}

A device that works at layer 3 decides in this order: whether the packet is for it or for a server it publishes, which route to take, what the firewall says, and with which source address the packet leaves. The sender is not filtered and does not translate what it sends itself, and a firewall does not filter a packet addressed to the firewall itself.

### The route {#route}

The device looks the destination up in its routing table. Three kinds of entry exist:

- **connected**: a network one of its addressed ports or cards is in;
- **static**: a route written on a router or firewall;
- **default**: the gateway of a network card, the gateway of a router, or a route written to `default`.

The most specific entry wins. At equal length a connected network beats a static route, and a static route beats the default. Of two routes to the same network the first one written is used, and the others are [backup routes](../services/routes.md#backup). A route that leaves by a port that is switched off is not used. The table is explained in [the routing table](../services/routes.md#routing-table).

When there is no entry the packet stops here, and the reason says which device and what is missing: `no default gateway configured on PC-1`, or `Router-1 has no route to 192.168.30.11`. A route whose next hop is on none of the device's own networks leads nowhere: it is passed over, as a real router does, and the next entry decides, a backup route or the default route, with a note. When it was the only way, the packet stops there with that reason: `Router-1 cannot use the route 192.168.30.0/24 via 172.16.0.1: that address is on none of its networks`. When the only way leaves by a port that is switched off, the reason is that port: `port 2 on Router-1 is disabled`.

Having found the next address, the engine looks for the device that answers for it on the sender's own network. When there is none, the reason says what is there instead: `PC-1 uses gateway 192.168.10.99, but Router-1 port 1 on its network is 192.168.10.1`. See [the gateway](../building/addresses.md#gateway).

### Backup routes {#backup-route}

A route is withdrawn when the interface it leaves by has no working cable left: every cable on it is cut, or the device at the other end of each is down (the two [simulated failures](#failures)), or the interface at the other end is switched off; or when the port itself is switched off. The next route for that destination takes over. A line that goes down is down for the devices at both of its ends, as a real link loses its carrier on both sides. When it is the line that is down, and not the port itself switched off, the answer carries a note:

```text
note: R-HQ: the route 192.168.2.0/24 via 10.0.0.2 is unusable (link R-HQ–R-Branch is down), the route 192.168.2.0/24 via 10.0.1.2 is used instead
```

Two cases keep the main route. A network the device is attached to by a failed cable is not looked for elsewhere: the broken link is the answer. (A port that is switched off is not a failure: its network leaves the table, and a less specific route, the default one for instance, may take its traffic.) And a next hop that dies behind a switch does not take the interface down, so the route stays and the packet is lost there, as with a plain static route.

### The firewall {#firewall}

A firewall that a packet crosses (not one that sends it, not one it is addressed to) decides before the packet goes on. So does a router that carries rules, its access list: it reads them the same way, and has no zones.

1. **The rules**, top to bottom. The first rule that is enabled and matches the service, the source and the destination decides, to allow or to deny. A rule that names a zone needs the cable to be attached to a port that is in a zone, because the zone belongs to the port: without that the rule is skipped, with a note.
2. **The zone policy**, when no rule matches. A new flow to a more trusted zone is denied: `untrust → trust`, `untrust → dmz` and `dmz → trust`. Anything else is allowed. The policy needs the zone of both sides, and a cable attached to no port, or to a port in no zone, has none. There a firewall with a rule switched on ends its list as a router does: what no rule allows is blocked, and the reason says why the zones could not decide (`firewall FW-Edge: no rule allows it, and the zone policy cannot decide: port 2 is in no zone`), naming the rules that were skipped for it when there are any. A firewall with no rule switched on allows, with a note. A router has no zones: its list ends with an implicit deny, as on real routers, so what no rule allows is blocked (`router Router-Core: no rule allows it`). A router with no rules, or with all of them disabled, lets everything through.
3. **Replies**. A firewall remembers the flows it has let through itself. The reply to such a flow passes it, whatever the rules say about a new flow in that direction. A reply that comes back by another way, through a firewall the request did not cross, is a new packet to that firewall: its rules and its zones decide, and when they deny it the reason ends with `and it never saw the request`.

```ncl sample=site
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  without a zone on both sides (a link not attached to a port, a port in no zone): what no rule allows is blocked
  the reply to a flow it allowed passes
pixelcake> ping Srv-Internal from Web-Public
Pinging Srv-Internal (192.168.20.10) from Web-Public...
Ping failed (blocked): request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied
  dropped at: FW-Edge
pixelcake> ping Web-Public from PC-Office-1
Pinging Web-Public (172.16.0.10) from PC-Office-1...
Reply from 172.16.0.10: hops=6 time=9ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: reply: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

The rules and the policy are in [Firewall](../services/firewall.md): [zones](../services/firewall.md#zones), [the zone policy](../services/firewall.md#policy), [rules](../services/firewall.md#rules) and [replies](../services/firewall.md#replies).

### Translating addresses {#nat}

A router or a firewall may change the addresses of a packet, in the order that makes its own rules meaningful. A packet addressed to the device is first sent on to the address a [port forward](../services/nat.md#forwards) names. The firewall then sees the real destination and the real source. Last, a new flow that leaves by a port with [source NAT](../services/nat.md#source-nat) takes the address of that port, and the device remembers the flow so that the reply is translated back.

A Cloud symbol whose name contains Internet does not carry private addresses. A packet that arrives there with a private source or destination stops, and the reason says which of the two and what should have translated it: [the Internet does not carry private addresses](../services/nat.md#private). A packet that leaves the symbol for a private destination stops there too, with the same reason, whoever sent it: an external PC that has the address of the symbol as its gateway, or the symbol itself when it has an address. When the Internet is in the way, a device behind NAT is aimed at its public address if it has one, else at the address a forward publishes it at, and a note says so.

```ncl sample=site
pixelcake> browse Web-Public from Remote-PC
Browsing Web-Public (203.0.113.1) from Remote-PC...
  ✓ HTTP request: Remote-PC → Web-Public
  ✓ HTTP response: Web-Public → Remote-PC
Page received from Web-Public
  note: HTTP request: Web-Public is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed
  note: HTTP response: Internet is not simulated: traffic assumed to pass
pixelcake> ping Web-Public from Remote-PC
Pinging Web-Public (172.16.0.10) from Remote-PC...
Ping failed (blocked): request: Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
  dropped at: Internet
```

Web has a forward and ping has none: the same server is reached by one question and not by the other. Rules and forwards name a [service](../services/firewall.md#rules): ping, web, email or DNS.

## At layer 2 {#layer-2}

The delivery looks for the device that answers for the next address on the sender's own network. It goes out over the cables and follows them breadth first, in the order the cables were drawn, so that **the shortest chain of cables that works is the one taken**. When two chains are equally short, the one found first is taken. A port that is off, a cut cable or a VLAN that does not pass is gone round when the drawing has another way. Spanning tree is not simulated: a drawing with a loop of switches is walked without looping, and no port is blocked.

At every cable the engine checks, in this order:

1. **The cable and the device at its other end.** A cable cut by a simulated failure, or a device that is down, carries nothing.
2. **The port it leaves by is up.** `port 1 on SW-Office is disabled`.
3. **The VLAN may leave through that port.** On a switch that applies VLANs, an access port lets out only its own VLAN, and a trunk only the ones it carries: `VLAN 10 does not leave through port 2 on SW-Office: it is in the default VLAN 1`. See [VLANs](../building/vlans.md) and, for the rule about the ports nobody touched, [VLAN 1](../building/vlans.md#vlan-1).
4. **A router or firewall without addresses on its ports** lets the packet through, and a firewall of that kind still applies its rules and its zone policy between the two ports crossed.
5. **The port it arrives at is up.**
6. **The device it reaches.** A switch or an access point takes the frame if the VLAN is allowed in by that port, and the search goes on from it. A router with addresses on its ports never carries a frame for others: it answers if the address is the one of the port the cable arrives at (any of its own, when the cable end is attached to no port), and otherwise the search does not go through it. An end device is the same.

The cable end is attached to a port or a network card of its device ([the two ends](../building/cables.md#ends)). Rules that belong to a port, such as the state of the port, its VLAN and its zone, are applied only when that is known. A cable end attached to nothing is accepted, and the answer carries a note: `link A–B has no port binding…: per-port rules skipped`. On a firewall with rules the zone of that end is not known, so what no rule allows is blocked there (step 2 of [the firewall](#firewall)).

When nothing answers for the address, the reason is the first thing that stopped the packet on the shortest chain of cables to the device that should have answered. What stopped it on a side branch says nothing about the way there. When nothing stopped it, the reason is what is wrong with the network itself: the device is on another network and there is no router in between (`no router between subnets 192.168.10.0 and 192.168.20.0 — L2 devices cannot route`), or an end device sits in the way (`PC-2 is an end device: it does not forward traffic for others`), or a router sits between two devices addressed in one network (`… a router does not pass traffic within one network`), or nobody has the address.

## Who forwards what {#who-forwards}

What a device does with traffic that is not addressed to it depends on what it is.

| Device | In transit |
|---|---|
| Router, firewall with addresses on its ports | routes by its table, and never passes traffic inside one network |
| Switch, access point, and any other device built with ports | bridges inside one network, VLAN by VLAN |
| Router, firewall **without** addresses on its ports | transparent: lets traffic through (a firewall still applies its rules and its zone policy between the two ports); nothing is verified, and a note says so |
| Internet or Cloud symbol, load balancer | not simulated: assumed to let traffic through, with a note |
| PC, server and other end devices | nothing: an end device does not carry traffic for others |

A Cloud symbol whose name does not contain Internet (a carrier's network, a private line) carries whatever crosses it, private addresses included.

## Flows: more than one packet {#flows}

A question is rarely one packet. The engine turns each kind of traffic into **legs**, a packet that goes one way, and follows each leg as above. The legs are evaluated in order and the evaluation stops at the first one that fails: the reason carries its name (`request:`, `HTTP response:`, `fetch request:`).

| Traffic | Legs | Seen by a firewall as |
|---|---|---|
| Ping | request, then reply | ping |
| Web page | HTTP request, then HTTP response | web |
| File download | download request, then download data | web |
| Email | SMTP submit to the mail server of the sender; then the recipient fetches it from its own: fetch request, then fetch reply | email |

- **A reply is a packet of its own.** It starts only if the request arrived, goes back to the address the request seemed to come from, and takes the way its own routing tables give. It may take another way than the request, and may fail where the request did not. A firewall that saw the request lets it through because it answers a flow it allowed; a firewall the request did not cross judges it as a new packet. The NAT devices of the way translate it back.
- **An email is fetched by its recipient.** The sender submits it to its mail server. The recipient then fetches it from its own: a request to the server, and the reply that brings the mail back on its own way, as a page comes back. No server pushes a mail to a desk, so the mail reaches a recipient where the recipient may open a flow to its server: a host in a DMZ that the zone policy keeps away from the inside gets no mail from a server inside. Which servers depends on the email mode in Settings → Network, group “Simulation”, field “Email mode (SMTP)”. “Internal mail server” uses, for each end, the mail server with the fewest cables from it, counted on the drawing; when the two are different servers, the first relays the mail to the second (`SMTP relay`), a push, as mail between servers is. “Cloud (M365, Gmail…)” uses the mailbox of a provider out on the Internet, beyond the nearest Internet symbol: the packet is aimed at an address of the outside that no device has, the highest free one of the public network next to the symbol (203.0.113.254 in the site sample), it is routed as anything for the Internet is, and the symbol takes it, with a note. A symbol that has an address of its own is aimed at that address. A drawing with no Internet symbol uses the nearest Cloud symbol, or a device whose name has Internet, Cloud, WAN or ISP as a word of its own (`ISP-Router`, `R-WAN`, `WAN1`, but not `Display-1`). “Auto (detect automatically)” prefers the mail server and falls back to the cloud, with a note. A mail to a mail server is submitted and fetched by nobody; a mail from one is only fetched.
- **A page from a device that is not a server** is followed all the same, with a note.

```ncl sample=office
pixelcake> mail PC-2 from PC-1
Mailing PC-2 (192.168.10.12) from PC-1...
  ✓ SMTP submit: PC-1 → Mail-01
  ✓ fetch request: PC-2 → Mail-01
  ✓ fetch reply: Mail-01 → PC-2
Mail delivered to PC-2
```

Because a reply is evaluated on its own, a ping can fail where a trace to the same device succeeds. In the two-sites sample, take away the routes of the branch router back to the head office: the request arrives, and the reply finds no way back.

```ncl sample=two-sites
pixelcake> remove route 192.168.1.0/24 from R-Branch
R-Branch: 2 routes to 192.168.1.0/24 removed
pixelcake> trace PC-Branch-1 from PC-HQ-1
Tracing route to PC-Branch-1 (192.168.2.11) from PC-HQ-1:
  1  ○ PC-HQ-1 (PC)
  2  ○ SW-Floor-1 (Switch)
  3  ○ SW-Core (Switch)
  4  ○ R-HQ (Router)  — routed: 192.168.2.0/24 via 10.0.0.2 (port 2)
  5  ○ R-Branch (Router)  — routed: 192.168.2.0/24 is on port 1
  6  ○ SW-Branch (Switch)
  7  ● PC-Branch-1 (PC)
Trace complete: destination reached.
pixelcake> ping PC-Branch-1 from PC-HQ-1
Pinging PC-Branch-1 (192.168.2.11) from PC-HQ-1...
Ping failed (blocked): reply: R-Branch has no route to 192.168.1.11
  dropped at: R-Branch
```

## Simulated failures {#failures}

In [presentation mode](presentation.md#failures) a device can be taken as down and a cable as cut. The drawing is not changed: the engine is given the list next to the drawing and finds nothing travelling through them.

- A device that is down sends nothing and takes nothing. A cable that is cut carries nothing. The reasons are `SW-Core is down` and `link R-HQ–R-Branch is down`.
- Delivery goes round them when the drawing offers another way, and a router withdraws a route that has no working cable left (see [backup routes](#backup-route)).
- A DHCP lease does not change: a device keeps the address it had, even when its DHCP server is down.
- A name lookup is a question like any other. With the DNS server down, or the way to it cut, a name finds no address while the addresses still answer.

The terminal asks the same engine with the same failures for as long as the presentation lasts.

## The reasons and the notes {#reasons}

An answer is one of four verdicts:

| Verdict | Meaning |
|---|---|
| `success` | the destination answered (and, for a flow, every leg arrived) |
| `blocked` | the packet was dropped on the way: the reason says why, and where |
| `unreachable` | no chain of cables joins the two devices |
| `error` | the question cannot be tried: one end does not exist, has no usable address or has an address in conflict, both ends of a page, a download or an email are the same device, or there is no mail server or internet exit for an email to go through. (A device that pings itself answers, without the packet leaving it, as a trace to itself does.) |

A stop says two things: the **reason**, in a sentence that names the device, the port, the route or the rule; and the **device where it stopped**, `dropped at:` in the terminal, the red box in the panel and in the presentation. It is the device that holds the packet when it stops. For a port, a rule or a route it is the device they belong to; for a cut cable or a device that is down it is the device in front, the last one that could still send. In a flow the reason begins with the name of the leg that failed.

```ncl sample=office
pixelcake> interface 1 down on SW-Office
port 1 on SW-Office is now down
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: port 1 on SW-Office is disabled
  dropped at: SW-Office
pixelcake> interface 1 up on SW-Office
port 1 on SW-Office is now up
pixelcake> set gateway of PC-1 to 192.168.10.99
PC-1: gateway set to 192.168.10.99
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.99, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
```

The reasons are written in English, in both languages of the interface, and name devices as the drawing does. These are the ones met most often:

| The reason says | It means |
|---|---|
| `no default gateway configured on PC-1` | a device has to leave its network and has no gateway |
| `Router-1 has no route to 192.168.30.11` | a router has no entry for the destination |
| `PC-1 uses gateway …, but Router-1 port 1 on its network is …` | the gateway is not the address of any router port on that network |
| `port 2 on SW-Office is disabled` | the port is switched off |
| `VLAN 10 does not leave through port 2 on SW-Office: …` | the VLAN of the packet is not allowed out of that port |
| `firewall FW-Edge: denied by rule 2 (…)` | a rule says deny, with its number |
| `firewall FW-Edge: no rule matches, zone policy dmz → trust denied` | no rule decides, and the zones do |
| `router Router-Core: no rule allows it` | a router with rules, and none of them allows the packet |
| `firewall FW-Edge: no rule allows it, and the zone policy cannot decide: …` | a firewall with rules, none of them allows the packet, and the zone of a side is not known: the end says which |
| `address conflict: 192.168.20.10 is on both Web-01 and Mail-01, …` | two devices have the address the question goes to, or comes from |
| `Internet does not carry private addresses: …` | a private address reached the Internet symbol, or was to leave it |
| `SW-Core is down`, `link R-HQ–R-Branch is down` | a simulated failure |
| `PC-2 is an end device: it does not forward traffic for others` | the only way goes through an end device |
| `Laptop-1 has no address: no DHCP server answers on its network` | a card on DHCP got no lease |
| `routing loop: the packet comes back to Router-1` | two routers send it to each other |

What the engine cannot verify is **never passed silently as a success**: it adds a note to the answer. A note is not a failure. The ones met most often:

- `Router-1 has no interface addresses: gateway and routing not verified`: the router's ports carry no address, so it is assumed to pass the packet on.
- `Internet is not simulated: traffic assumed to pass`: the Internet symbol is a stand-in. `203.0.113.1 is not in the drawing: Internet assumed to take the traffic` says a gateway belongs to the outside world.
- `link A–B has no port binding…: per-port rules skipped`: one end of a cable is attached to no port or card.
- `firewall FW-1 has no zone binding: allowed` (a firewall with no rule switched on), or a rule `names a zone and the link is not attached to a port: skipped`, or `names a zone and port 4 is in no zone: skipped`.
- `firewall FW-1: allowed by rule 1 (…)`, `router R-1: denied by rule 1 (…)`, `NAT: source … → …`, and the line about a route that is unusable and the one used instead, which tell what the device did and are there to be read.

The terminal prints the notes under the answer. The simulation panel shows only the reason of a stop; [presentation mode](presentation.md#ask) shows the path hop by hop with the notes of each hop, and `trace` prints them in the terminal.

## What is not simulated {#not-simulated}

> [!LIMITS]
> - **It is not a packet simulator.** There is no ARP, no MAC table, no spanning tree, no dynamic routing (RIP, OSPF, BGP) and no gateway redundancy: a host has one gateway for each network card. Routes are the ones written.
> - **Only the line itself is looked at.** A route is withdrawn when the port it leaves by is switched off, or when its line carries nothing: the cables are cut, the devices at their other ends are down, or the interfaces there are switched off. A next hop that dies behind a switch is not seen, as with a static route on real hardware, and the packet is lost there.
> - **There is no time and no load.** The time printed by `ping` is worked out from the number of hops of the request (1 ms, plus 2 ms for each device between the two ends). There is no cable speed, queue, congestion, packet loss or timeout.
> - **Four services.** A flow is ping, web, email or DNS (a download is web to a firewall). There are no TCP or UDP ports, and traffic addressed to the firewall itself is not filtered.
> - **NAT is by service, not by port number.** Two flows never compete for a translation. A server reached from inside at its published address is not treated apart, and a device behind two layers of NAT is found by name only through the first.
> - **A DHCP lease is worked out, not negotiated.** No lease time, renewal or reservation, no relay through a router, and a port of a router cannot take its address from DHCP.
> - **DNS is one server, asked every time.** No second server, no forwarding between servers, no cache, no reverse lookup, no aliases or wildcards. Names are for the terminal.
> - **Router sub-interfaces are not modelled.** Routing between VLANs needs a port of a router in each VLAN.
> - **The Internet is a stand-in.** The symbol named Internet carries public addresses and refuses private ones; nothing is simulated behind it. A load balancer lets traffic through without balancing it.
>
> The same limits, in one place, are in [what is not simulated](../reference/limits-and-faq.md#not-simulated).
