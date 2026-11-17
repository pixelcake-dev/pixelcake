---
title: "DHCP and DNS"
description: "The commands that put a card on DHCP, give an interface a range of addresses to hand out, name a DNS server and keep the records of one."
order: 6
---

Two services let a device be given something it would otherwise have written on it. DHCP gives a network card its address, mask, gateway and DNS server. DNS lets a name stand for an address. These commands set up both, in the same way as the “DHCP” and “DNS” tabs of the window of a device, and `show dhcp` and `show dns` read the result back ([Show commands](show.md#show-dhcp)). How the engine works out a lease and a lookup, and what it leaves out, is in [DHCP](../services/dhcp.md) and [DNS](../services/dns.md). Using a name in a question is in [Asking](asking.md#targets).

The examples run on the company sample, where Router-Core hands out the addresses of the offices and of the Wi-Fi, and Srv-Auth is the DNS server. In the syntax below, `<name>` is the name of a card (`eth0`), `<id>` a port number or the name of a card, `<address>` an IPv4 address; `on <device>` may be left out inside `use <device>`. The notation is explained in the [overview](index.md#conventions).

## interface … dhcp {#dhcp-client}

```text
interface <name> dhcp [on] <device>
interface <name> dhcp off [on] <device>
```

A network card takes its address from the DHCP server of its network, or stops doing so. The answer says which address the card is leased, with its mask, gateway and DNS server, and by which pool; or, when no server can serve it, why not. `dhcp off` leaves the card without an address, and the answer says how to give it one. `dhcp none` is the same as `dhcp off`.

| Parameter | What it is |
|---|---|
| `<name>` | The name of a network card of an end device |
| `<device>` | The device the card belongs to |

- A router, a firewall and a switch have no DHCP client: their addresses are written by hand, and the command is refused. For a router or a firewall port the refusal names `interface <n> pool`, below.
- A card that is a DHCP server itself (it has a pool) stops handing out addresses when it asks for one: a card does not do both, and the answer says so.
- While a card is on DHCP it keeps no address of its own. An address written on it by hand, with `interface <name> ip` or with `set ip` (when it is the first card), takes it off DHCP ([Interfaces and VLANs](interfaces-and-vlans.md#ip)). Its gateway and DNS server come with the lease, and `interface <name> gateway` and `interface <name> dns` are refused.
- A lease is not remembered: the engine works it out from the drawing each time, as the lowest free address of the pool ([which address](../services/dhcp.md#which-address)).

```ncl sample=company
pixelcake> show ip PC-Sales
PC-Sales — addressing
  ip:       192.168.10.12
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.12 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10
pixelcake> interface eth0 dhcp on PC-Sales
interface eth0 on PC-Sales now takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 by Router-Core port 1
pixelcake> interface eth0 dhcp on PC-Sales
interface eth0 on PC-Sales already takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 by Router-Core port 1
pixelcake> ping Web-ERP from PC-Sales
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> interface eth0 dhcp off on PC-Sales
interface eth0 on PC-Sales no longer takes its address from DHCP: it has no address now
  give it one: interface eth0 ip <address>/<prefix> on PC-Sales
pixelcake> ping Web-ERP from PC-Sales
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Ping failed (error): request: PC-Sales has no IP address configured
pixelcake> interface eth0 ip 192.168.10.12/24 on PC-Sales
interface eth0 on PC-Sales: 192.168.10.12 / 255.255.255.0
pixelcake> interface eth0 gateway 192.168.10.1 on PC-Sales
interface eth0 on PC-Sales: gateway 192.168.10.1
```

A card that no server answers has no address, and says why:

```ncl sample=office
pixelcake> interface eth0 dhcp on Web-01
interface eth0 on Web-01 now takes its address from DHCP
  warning: no address yet: no DHCP server answers on its network
pixelcake> show dhcp
DHCP — 0 pools, 0 leases
WITHOUT AN ADDRESS
  ✗ Web-01 eth0: no DHCP server answers on its network
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> ping Mail-01 from Web-01
Pinging Mail-01 (192.168.20.20) from Web-01...
Ping failed (error): request: Web-01 has no address: no DHCP server answers on its network
pixelcake> interface 1 dhcp on Router-1
DHCP gives an address to the network cards of end devices: port 1 on Router-1 gets its own by hand
  to hand out addresses from it: interface 1 pool <first> to <last> on Router-1
pixelcake> interface 2 dhcp on SW-Office
DHCP gives an address to the network cards of end devices: port 2 on SW-Office gets its own by hand
```

## interface … pool {#pool}

```text
interface <id> [dhcp] pool <first> to <last> [gateway <address>] [dns <address>] [on] <device>
interface <id> pool none [on] <device>
```

An interface hands out a range of addresses to its network: a port of a router or of a firewall, or a card of a server. A pool is the range, and with each address the server hands out the mask of its interface, a gateway and a DNS server. An interface has one pool: a new one replaces the old.

| Parameter | What it is |
|---|---|
| `<id>` | A port number, or the name of a card of a server. The interface must have an address: the pool is for its network |
| `<first>`, `<last>` | The first and the last address of the range, both inside the network of the interface. `to` may be left out, or the two written `<first>-<last>` |
| `gateway <address>` | The gateway handed out. `gw` is the same word. Without it, a router or a firewall hands out the address of the port itself, and a server hands out none: its clients then talk inside their network only |
| `dns <address>` | The DNS server handed out. Without it none |
| `none` | Stops the pool. `off` is the same |

`interface <id> dhcp pool …` is the same command with one word more. The two options `gateway` and `dns` may be written in either order. The answer gives the number of addresses in the range, what is handed out, who has a lease from it now, and a warning when another pool answers the same network: the first in the drawing that has an address left serves ([who answers whom](../services/dhcp.md#servers)). `pool none` says who is left without an address.

```ncl sample=company
pixelcake> show dhcp Router-Core
DHCP of Router-Core
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Laptop-1 eth0            from Router-Core port 2
  192.168.20.101   Laptop-2 eth0            from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> interface 1 pool none on Router-Core
port 1 on Router-Core no longer hands out addresses
pixelcake> interface eth0 dhcp on PC-Sales
interface eth0 on PC-Sales now takes its address from DHCP
  warning: no address yet: no DHCP server answers on its network
pixelcake> interface 1 pool 192.168.10.100 to 192.168.10.149 dns 192.168.30.10 on Router-Core
port 1 on Router-Core now hands out 192.168.10.100 to 192.168.10.149: 50 addresses, gateway 192.168.10.1, DNS server 192.168.30.10
  leased now: PC-Sales 192.168.10.100
pixelcake> interface 1 pool 192.168.10.100 to 192.168.10.149 dns 192.168.30.10 on Router-Core
port 1 on Router-Core already hands out 192.168.10.100 to 192.168.10.149
pixelcake> interface 1 pool none on Router-Core
port 1 on Router-Core no longer hands out addresses
  without an address now: PC-Sales
pixelcake> interface 1 pool none on Router-Core
port 1 on Router-Core hands out no addresses already
```

The short forms, and a server that hands out addresses:

```ncl sample=office
pixelcake> interface 1 pool 192.168.10.100-192.168.10.150 on Router-1
port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.150: 51 addresses, gateway 192.168.10.1
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> interface 1 dhcp pool 192.168.10.100 192.168.10.150 gateway 192.168.10.1 dns 192.168.20.10 on Router-1
port 1 on Router-1 now hands out 192.168.10.100 to 192.168.10.150: 51 addresses, gateway 192.168.10.1, DNS server 192.168.20.10
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> interface eth0 pool 192.168.20.100 to 192.168.20.150 on Web-01
interface eth0 on Web-01 now hands out 192.168.20.100 to 192.168.20.150: 51 addresses, no gateway: its clients talk inside their network only
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> interface eth0 dhcp on PC-1
interface eth0 on PC-1 now takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10 by Router-1 port 1
pixelcake> show ip PC-1
PC-1 — addressing
  ip:       192.168.10.100 (dhcp)
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.20.10 (dhcp from Router-1 port 1)
```

## interface … dns {#dns-server}

```text
interface <name> dns <address>|none [on] <device>
```

The DNS server a network card asks when a name is used in place of an address: the address of a device of the drawing that keeps records. `dns none` makes the card ask nobody; `clear` is the same word. A device asks through its first enabled card that names a server. A router, a firewall and a switch have no cards and ask nobody.

| Parameter | What it is |
|---|---|
| `<name>` | The name of a network card |
| `<address>` | The address of the DNS server. It is checked as an address, not as a device: the engine says in the lookup if no device has it |

On a card that is on DHCP the command is refused: the DNS server comes with the lease, from the `dns` of the pool.

```ncl sample=company
pixelcake> show dns PC-Sales
DNS of PC-Sales
  eth0: asks 192.168.30.10 (Srv-Auth)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> interface eth0 dns none on PC-Sales
interface eth0 on PC-Sales asks no DNS server now
pixelcake> ping erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales...
Lookup failed: PC-Sales has no DNS server: it cannot look up erp.company.example
pixelcake> interface eth0 dns 192.168.30.10 on PC-Sales
interface eth0 on PC-Sales: DNS server 192.168.30.10
pixelcake> interface eth0 dns 192.168.30.10 on PC-Sales
interface eth0 on PC-Sales already asks 192.168.30.10
pixelcake> interface eth0 dns 8.8.8.8 on PC-Sales
interface eth0 on PC-Sales: DNS server 8.8.8.8
pixelcake> resolve erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 8.8.8.8)...
Lookup failed: PC-Sales asks 8.8.8.8 for names, an address no device has
pixelcake> interface 1 dns 192.168.30.10 on Router-Core
port 1 on Router-Core is a port: a DNS server is named on a network card
pixelcake> interface eth0 dns 192.168.30.10 on Laptop-1
interface eth0 on Laptop-1 takes its address from DHCP: the DNS server comes with the lease
  it is the one of the pool: interface <n> pool <first> to <last> dns <address> on <server>
```

## add record {#add-record}

```text
add record <name> [to] <address> [on] <server>
```

A server keeps a record: a host name and the address it stands for. The server answers a lookup for the names it keeps, and for no other.

| Parameter | What it is |
|---|---|
| `<name>` | A host name with at least one dot, `erp.company.example`. Upper and lower case are the same: it is kept in lower case |
| `<address>` | An IPv4 address, or a device: the command then writes the address of the device and says which. `is` or `at` may be written in place of `to`, or nothing |
| `<server>` | A device of type Server. Inside `use <device>` it is left out |

One name has one address: a name that is already there takes the new address, and the answer says what it was; the same name and address again adds nothing. The device named as the address is written as the address it has, now: if its address changes later, the record does not follow.

```ncl sample=company
pixelcake> add record intranet.company.example Web-ERP on Srv-Auth
Srv-Auth: record 4 added — intranet.company.example is 192.168.30.30
  Web-ERP → 192.168.30.30
pixelcake> resolve intranet.company.example from PC-Sales
Looking up intranet.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
intranet.company.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> add record INTRANET.company.example 192.168.30.31 on Srv-Auth
Srv-Auth: record 4 — intranet.company.example is now 192.168.30.31 (was 192.168.30.30)
pixelcake> add record INTRANET.company.example 192.168.30.31 on Srv-Auth
Srv-Auth already has it: record 4
pixelcake> show dns Srv-Auth
DNS of Srv-Auth
RECORDS (it answers for these names, and for no other)
   1  erp.company.example              192.168.30.30
   2  mail.company.example             192.168.30.40
   3  portal.company.example           172.16.0.10
   4  intranet.company.example         192.168.30.31
  eth0: asks nobody
  name a DNS server: interface eth0 dns <address> on Srv-Auth
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

## remove record {#remove-record}

```text
remove record <n>|<name> [from] <server>
delete record <n>|<name> [from] <server>
```

Takes a record out, by its number in the list of the server (`show dns <server>` numbers them) or by its name. The records after it move up by one. `delete` is the same as `remove`, and `on` may be written in place of `from`.

| Parameter | What it is |
|---|---|
| `<n>` | The number of a record, from 1 |
| `<name>` | The name of a record |
| `<server>` | The server that keeps it |

```ncl sample=company
pixelcake> remove record 1 from Srv-Auth
Srv-Auth: record 1 removed — erp.company.example is 192.168.30.30
pixelcake> remove record mail.company.example from Srv-Auth
Srv-Auth: record 1 removed — mail.company.example is 192.168.30.40
pixelcake> show dns Srv-Auth
DNS of Srv-Auth
RECORDS (it answers for these names, and for no other)
   1  portal.company.example           172.16.0.10
  eth0: asks nobody
  name a DNS server: interface eth0 dns <address> on Srv-Auth
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> remove record 4 from Srv-Auth
Srv-Auth has no record 4 (it has 1)
pixelcake> remove record erp.company.example from Srv-Auth
Srv-Auth has no record for erp.company.example
pixelcake> resolve portal.company.example from PC-Sales
Looking up portal.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
portal.company.example is 172.16.0.10 (answered by Srv-Auth)
```

## When a command is refused {#refusals}

A command that cannot be done changes nothing, and says why, or what it should have been:

```ncl sample=company
pixelcake> interface 3 dhcp on Router-Core
DHCP gives an address to the network cards of end devices: port 3 on Router-Core gets its own by hand
  to hand out addresses from it: interface 3 pool <first> to <last> on Router-Core
pixelcake> interface eth0 pool 192.168.10.150 to 192.168.10.100 on Srv-Auth
192.168.10.150 is outside 192.168.30.0/24, the network of eth0 on Srv-Auth
pixelcake> interface 1 pool 10.0.0.1 to 10.0.0.9 on Router-Core
10.0.0.1 is outside 192.168.10.0/24, the network of port 1 on Router-Core
pixelcake> interface 1 pool 192.168.10.100 on Router-Core
unknown command: "interface 1 pool 192.168.10.100 on Router-Core"
  a pool goes from its first address to its last — try: interface <n> pool <first> to <last> [gateway <address>] [dns <address>] [on] <device> — or "pool none" to stop
  type "help" for the command list
pixelcake> interface eth0 pool 192.168.10.100 to 192.168.10.110 on PC-Sales
addresses are handed out by a port of a router or a firewall, or by a card of a server: PC-Sales is a PC
pixelcake> interface eth0 dns banana on PC-Sales
"banana" is not a valid IPv4 address
pixelcake> add record x.company.example 192.168.30.30 on PC-Sales
PC-Sales is a PC: records are kept by servers
pixelcake> add record x.company.example Nobody on Srv-Auth
"Nobody" is not an address or a device
pixelcake> add record x.company.example Internet on Srv-Auth
Internet has no address for a name to stand for
pixelcake> remove record 9 from Srv-Auth
Srv-Auth has no record 9 (it has 3)
pixelcake> remove record nothing.company.example from Srv-Auth
Srv-Auth has no record for nothing.company.example
```

## See also {#see-also}

- [DHCP](../services/dhcp.md), [DNS](../services/dns.md): how the engine works out a lease and a lookup, and what it does not do.
- [Show commands](show.md#show-dhcp): `show dhcp` and `show dns`, to read what these commands set.
- [Asking](asking.md#resolve): `resolve`, and a name used in place of an address.
- [Interfaces and VLANs](interfaces-and-vlans.md#ip): the address and the gateway of a card written by hand.
