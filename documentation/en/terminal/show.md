---
title: "Show commands"
description: "The commands that read the network without changing it: devices, interfaces, VLANs, routes, rules, NAT, DHCP, DNS."
order: 8
---

The `show` commands print the drawing as the engine reads it: the tables the other commands change, in the order they are written in the windows of the devices. They change nothing, and send no packet. An address that a card is leased from DHCP is marked `(dhcp)` wherever it is shown, so that it is told from one written by hand ([DHCP](../services/dhcp.md)).

Most of them are about one device: `show <what> [of] <device>`, where the device is named as on the board or by an address, and `of` may be left out. Inside `use <device>` the device is implied. A device that cannot have what is asked (a routing table on a switch, the rules of a PC) is answered with a line that says so. `show devices` and `show vlans` are about the whole drawing, and so are `show connections`, `show dhcp` and `show dns` when no device is given. The notation is explained in the [overview](index.md#conventions).

A `show` with a word that is not one of the list is refused with the list, or with the closest word:

```ncl sample=office
pixelcake> show banana
unknown command: "show banana"
  try: show devices | interfaces | ports | vlans | connections | config | neighbors | ip | routes | rules | nat | dhcp | dns
  type "help" for the command list
pixelcake> show devces
unknown command: "show devces"
  did you mean "show devices"?
  type "help" for the command list
pixelcake> show config
specify a device: "show config <device>" — or enter a context with "use <device>"
```

## show devices {#show-devices}

```text
show devices
ls
list
```

Every device of the drawing, with its type, its address and its VLANs (the list the device knows, not those of its ports). `ls` and `list` are the same command; given more words they are read as `show`, so `ls vlans` is `show vlans`. A drawing with no device says so.

```ncl sample=office
pixelcake> show devices
DEVICE                   TYPE           IP               VLANS
Router-1                 Router         192.168.10.1     -
SW-Office                Switch         192.168.10.2     -
SW-Servers               Switch         192.168.20.2     -
PC-1                     PC             192.168.10.11    -
PC-2                     PC             192.168.10.12    -
Web-01                   Server         192.168.20.10    -
Mail-01                  Server         192.168.20.20    -
pixelcake> ls
DEVICE                   TYPE           IP               VLANS
Router-1                 Router         192.168.10.1     -
SW-Office                Switch         192.168.10.2     -
SW-Servers               Switch         192.168.20.2     -
PC-1                     PC             192.168.10.11    -
PC-2                     PC             192.168.10.12    -
Web-01                   Server         192.168.20.10    -
Mail-01                  Server         192.168.20.20    -
```

## show interfaces {#show-interfaces}

```text
show interfaces [of] <device>
```

The ports and the network cards of a device in one table, whatever the device is. It is the standard table of the language: an interface is the one word for both.

| Column | What it says |
|---|---|
| `IFACE` | The number of a port, or the name of a card |
| `KIND` | `port` or `nic` |
| `STATE` | `up` or `down` |
| `IP` | Its address, or `-` |
| `VLAN` | Of a port of a switch: its VLAN, or `10,20` for a trunk with a list, or `all` for a trunk for every VLAN; `1` for a port nobody set on a switch that applies VLANs. `-` elsewhere |
| `MODE-ZONE` | Of a port: its mode, `access` or `trunk` on a switch, `lan`, `wan` or `dmz` on a router or a firewall. That is the type of the port: the security zone of a firewall port is in `show ports`. Of a card: `dhcp` when it takes its address from DHCP, else `-` |
| `LINK` | What it is connected to: the device and its interface, `SW-Office (port 8)`, or `-` |

```ncl sample=office
pixelcake> show interfaces Router-1
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
1          port   up      192.168.10.1     -          lan        SW-Office (port 8)
2          port   up      192.168.20.1     -          lan        SW-Servers (port 8)
3          port   up      -                -          lan        -
4          port   up      -                -          lan        -
pixelcake> show interfaces PC-1
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
eth0       nic    up      192.168.10.11    -          -          SW-Office (port 1)
```

## show ports {#show-ports}

```text
show ports [of] <device>
```

The ports alone, with more of what a port has: its state, its mode, its VLAN, its security zone and its address. A device with no ports (a PC, a server) says so.

| Column | What it says |
|---|---|
| `PORT` | The number of the port |
| `STATE` | `up` or `down` |
| `MODE` | The type of the port |
| `VLAN` | As in `show interfaces` |
| `ZONE` | The security zone of a firewall port, `-` for a port with none |
| `IP` | The address of the port |
| `LINK` | The device and the interface it is connected to |

```ncl sample=company
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 4)
2      up         dmz      -          dmz      172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
pixelcake> show ports PC-Sales
PC-Sales has no configurable ports
```

## show vlans {#show-vlans}

```text
show vlans
```

Every VLAN of the drawing and where it is: for a switch that applies VLANs port by port, the access ports and the trunks that carry it; for any other device, or a switch that does not apply them, the devices that list it in their own list. A trunk for every VLAN is named under the table. A drawing with no VLAN says so.

```ncl sample=company
pixelcake> show vlans
VLAN   MEMBERS
1      SW-Offices (ports 5,6,7), SW-Core (ports 2,3,4,5,6), SW-Servers (ports 6,7)
10     SW-Offices (ports 1,2,3; trunk 8), SW-Core (port 7; trunk 1)
20     SW-Offices (port 4; trunk 8), SW-Core (port 8; trunk 1)
30     SW-Servers (ports 1,2,3,4,5,8)
```

## show connections {#show-connections}

```text
show connections [of <device>]
```

The links of the drawing, or those of one device, with the interface at each end: `[port 3 ↔ eth0]`. An end that is not attached to an interface is shown as `?`. After each link its type and bandwidth, as drawn.

```ncl sample=office
pixelcake> show connections
CONNECTIONS (6)
  PC-1 ↔ SW-Office  (access, 1 Gbps)  [eth0 ↔ port 1]
  PC-2 ↔ SW-Office  (access, 1 Gbps)  [eth0 ↔ port 2]
  SW-Office ↔ Router-1  (uplink, 1 Gbps)  [port 8 ↔ port 1]
  Router-1 ↔ SW-Servers  (uplink, 1 Gbps)  [port 2 ↔ port 8]
  Web-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 1]
  Mail-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 2]
pixelcake> show connections of SW-Servers
CONNECTIONS of SW-Servers (3)
  Router-1 ↔ SW-Servers  (uplink, 1 Gbps)  [port 2 ↔ port 8]
  Web-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 1]
  Mail-01 ↔ SW-Servers  (access, 1 Gbps)  [eth0 ↔ port 2]
```

## show config {#show-config}

```text
show config [of] <device>
```

Everything the drawing says about one device: its type and vendor, its address, mask and gateway, its location and note, its VLANs, the state of STP (which is not simulated), the number of its ports and which are up, each network card, and then what it has of routes, rules, NAT, DHCP and DNS, each with the command that shows it in full. What the device does not have is left out.

```ncl sample=company
pixelcake> show config FW-Edge
FW-Edge — Firewall
  ip:       10.0.0.2
  subnet:   255.255.255.252
  gateway:  -
  location: Server room
  vlans:    none (untagged)
  ports:    4/4 enabled — "show ports FW-Edge" for detail
  routes:   1 static — "show routes FW-Edge" for the whole table
  rules:    3 — "show rules FW-Edge" for detail
  nat:      on interface 3, 2 forwards — "show nat FW-Edge" for detail
pixelcake> show config Srv-Auth
Srv-Auth — Server
  ip:       192.168.30.10
  subnet:   255.255.255.0
  gateway:  192.168.30.1
  location: Server room
  vlans:    none (untagged)
  nic eth0: 192.168.30.10 / 255.255.255.0 gw 192.168.30.1 
  dns:      answers for 3 names — "show dns Srv-Auth" for detail
```

## show neighbors {#show-neighbors}

```text
show neighbors [of] <device>
```

The devices connected to one, with their type and address. A device that has no cable says so.

```ncl sample=office
pixelcake> show neighbors Router-1
NEIGHBORS of Router-1 (2)
  SW-Office                Switch         192.168.10.2
  SW-Servers               Switch         192.168.20.2
```

## show ip {#show-ip}

```text
show ip [of] <device>
ipconfig [<device>]
ifconfig [<device>]
```

The addressing of a device in a few lines: the address, mask and gateway it is known by, then each addressed port and each card. A card that takes its address from DHCP shows the lease and the pool it comes from, or why it has none. A card that asks a DNS server shows which. `ipconfig` and `ifconfig` are the same command; `of` or `on` may be written before the device.

```ncl sample=office
pixelcake> show ip Router-1
Router-1 — addressing
  ip:       192.168.10.1
  subnet:   255.255.255.0
  gateway:  -
  port 1: 192.168.10.1 / 255.255.255.0
  port 2: 192.168.20.1 / 255.255.255.0
pixelcake> ipconfig PC-1
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
pixelcake> ifconfig of PC-2
PC-2 — addressing
  ip:       192.168.10.12
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.12 / 255.255.255.0 gw 192.168.10.1
```

## show routes {#show-routes}

```text
show routes [of] <device>
```

The routing table as the engine reads it, one row for each route: where it goes, through which next hop, out of which interface, and of which kind. The kinds are `connected` (a network one of its addressed interfaces is in), `static` (written with `add route`), `default` (a route to every network) and `default (gateway)` (the gateway of a card or the gateway of a router). A route that waits for the line of another is marked `backup`. An end device has a table of its own, with its network and its gateway.

A route that cannot be used says so on its row: `(interface down)` when its interface is down, and `✗ next hop on none of its networks` when the next hop is on none of the networks of the device. A route written as something that is not a network and an address is listed under the table, as ignored. A router with no interface addresses says that its routes are not used ([Routes](routes.md)).

```ncl sample=two-sites
pixelcake> show routes R-HQ
ROUTES of R-HQ
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
pixelcake> interface 2 down on R-HQ
port 2 on R-HQ is now down
pixelcake> show routes R-HQ
ROUTES of R-HQ
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected  (interface down)
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static  (interface down)
192.168.2.0/24       10.0.1.2         port 3   static, backup
pixelcake> show routes PC-HQ-1
ROUTES of PC-HQ-1
DESTINATION          VIA              OUT      KIND
192.168.1.0/24       -                eth0     connected
default              192.168.1.1      eth0     default (gateway)
```

## show rules {#show-rules}

```text
show rules [of] <device>
```

The rules of a firewall in the order they are read, each with its number, its action, its service, its source and its destination, and then what decides when none matches: the zone policy. The reply to an allowed flow always passes. A device that is not a firewall and has no rules says that it filters nothing.

```ncl sample=company
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
   2  allow email  from untrust            to 192.168.30.40
   3  allow web    from 172.16.0.10        to 192.168.30.20
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to an allowed flow always passes
pixelcake> show rules Router-Core
Router-Core is not a firewall and has no rules: it filters nothing
```

## show nat {#show-nat}

```text
show nat [of] <device>
```

Source NAT and port forwards: the interfaces that translate what leaves by them, with the address each gives, then the forwards in the order they are read, with the address each is published at. A device that has neither says so.

```ncl sample=company
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
   2  email  from interface 3   (203.0.113.1) to 192.168.30.40
pixelcake> show nat PC-Sales
PC-Sales is a PC: it translates no addresses
```

## show dhcp {#show-dhcp}

```text
show dhcp [[of] <device>]
```

Of the whole drawing: the pools (range, gateway and DNS server handed out, how many addresses are leased and how many are free), the leases (address, card, pool) and the cards left without an address, each with the reason. Of one device: what it hands out and what it is given. A drawing with no DHCP at all says so, and how to start.

```ncl sample=company
pixelcake> show dhcp
DHCP — 2 pools, 2 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Laptop-1 eth0            from Router-Core port 2
  192.168.20.101   Laptop-2 eth0            from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> show dhcp Laptop-1
DHCP of Laptop-1
LEASES
  192.168.20.100   Laptop-1 eth0            from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> show dhcp Srv-Auth
Srv-Auth hands out no addresses and asks for none
  hand out addresses: interface <n> pool <first> to <last> on Srv-Auth
  ask for one:        interface eth0 dhcp on Srv-Auth
```

## show dns {#show-dns}

```text
show dns [[of] <device>]
```

Of the whole drawing: the records of every server, and every device that asks a DNS server, with the card it asks through. Of one device: its records if it is a server, and for each of its cards the server it asks, which device that is, and whether it came with the lease. A drawing with no DNS says so, and how to start.

```ncl sample=company
pixelcake> show dns
DNS — 1 server, 3 records
RECORDS of Srv-Auth (192.168.30.10)
   1  erp.company.example              192.168.30.30
   2  mail.company.example             192.168.30.40
   3  portal.company.example           172.16.0.10
WHO ASKS WHOM
  PC-Accounts eth0         192.168.30.10
  PC-Sales eth0            192.168.30.10
  Printer eth0             192.168.30.10
  Laptop-1 eth0            192.168.30.10  (with its lease)
  Laptop-2 eth0            192.168.30.10  (with its lease)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> show dns Laptop-1
DNS of Laptop-1
  eth0: asks 192.168.30.10 (Srv-Auth), handed out with its lease by Router-Core port 2
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

## sh {#sh}

```text
sh <what> [[of] <device>]
```

`sh` is `show`: every command above may be written with it.

```ncl sample=office
pixelcake> sh vlans
no VLANs configured (all traffic untagged)
pixelcake> sh ip PC-1
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
```

## When a command is refused {#refusals}

A device that does not exist is refused with the closest name, and a command that needs a device and has none says so:

```ncl sample=office
pixelcake> show config Web 01
device not found: "Web 01"
  did you mean "Web-01"?
pixelcake> show routes
specify a device: "show routes <device>" — or enter a context with "use <device>"
pixelcake> show ip PC
device not found: "PC"
  did you mean "PC-1"?
pixelcake> ifconfig
specify a device: "show ip <device>" — or enter a context with "use <device>"
pixelcake> show nat PC-1
PC-1 is a PC: it translates no addresses
pixelcake> show rules PC-1
PC-1 is not a firewall and has no rules: it filters nothing
pixelcake> show ports PC-1
PC-1 has no configurable ports
```

## See also {#see-also}

- [Interfaces and VLANs](interfaces-and-vlans.md), [Routes](routes.md), [Firewall and NAT](firewall-and-nat.md), [DHCP and DNS](dhcp-and-dns.md): the commands that change what these ones show.
- [Overview](index.md#answers): how a question and its answer are written.
