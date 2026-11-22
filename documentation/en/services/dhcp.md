---
title: "DHCP"
description: "Devices that take their address by themselves, the ports and servers that hand addresses out, and why a card gets none."
order: 4
---

With DHCP a device does not have its address written on it: it asks for one, and a DHCP server on its network hands it out together with the subnet mask and a gateway, and a DNS server when the range names one. In PixelCake the engine has no clock, so a lease is not remembered: the addresses are worked out from the drawing, the same way every time.

The examples use the sample network “Company: offices, Wi-Fi, servers and DMZ”. Its router, Router-Core, hands out addresses to the offices (port 1) and to the Wi-Fi (port 2), and the two laptops take theirs from it.

## A card on DHCP {#clients}

The client is a network card. In the window of an end device (a PC, a laptop, a printer, a server), open the “Network cards” tab, choose the card, and under “Address” choose “Automatic (DHCP)” instead of “Manual”. While a card is on DHCP it keeps no address of its own. It takes the address, the subnet mask and the gateway of the server that answers it, and the DNS server when the range names one; the card shows them under “Leased address”. On the board the address of the device is followed by “DHCP”.

In the terminal the same is `interface <name> dhcp on <device>` ([reference](../terminal/dhcp-and-dns.md#dhcp-client)), and the answer says what the card was leased:

```ncl sample=company
pixelcake> interface eth0 dhcp on PC-Sales
interface eth0 on PC-Sales now takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 by Router-Core port 1
pixelcake> show ip PC-Sales
PC-Sales — addressing
  ip:       192.168.10.100 (dhcp)
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 (dhcp from Router-Core port 1)
```

`show ip` marks a leased address with `(dhcp)` and says which range it comes from. Choose “Manual” in the window, or write an address with `set ip`, and the card is taken off DHCP.

A router or a firewall does not take addresses from DHCP: its ports are written by hand.

## Who hands addresses out {#servers}

A DHCP server is a range of addresses on an interface: a port of a router or of a firewall, or a card of a server. A range hands out addresses of the network of its interface, so the interface needs an address of its own first.

In the window of the router, the firewall or the server, go to the “DHCP” tab. Under “Address ranges” tick the port or the card of the network that should get addresses: a range is suggested, and you can change it with “First address” and “Last address”. “Gateway for clients” is what the clients are given as gateway: empty means the address of the port on a router or a firewall, and none on a server. “DNS server for clients” is the server they will ask for names, and it can be on another network. It is the same choice as “DHCP server enabled” in the panel of the port or of the card. Nothing changes until you press “Save”. Under “Leased addresses” the tab lists who has which address, with “Address”, “Device”, “Card” and “Leased by”, and “Warnings” says what is wrong.

In the terminal, `interface <n> pool <first> to <last> on <device>` ([reference](../terminal/dhcp-and-dns.md#pool)), and `show dhcp` lists the ranges and the leases of the whole drawing, or of one device:

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
pixelcake> show ip Laptop-1
Laptop-1 — addressing
  ip:       192.168.20.100 (dhcp)
  subnet:   255.255.255.0
  gateway:  192.168.20.1
  eth0: 192.168.20.100 / 255.255.255.0 gw 192.168.20.1 dns 192.168.30.10 (dhcp from Router-Core port 2)
```

A range is for one network, and a device is served by the range that is on its own network. A router does not pass a request on to another network, so a server in the servers’ network does not give addresses to the offices. A server can hand out addresses to its own network, though. In the multinational sample the server DHCP-RM does it for one site:

```ncl sample=multinational
pixelcake> show dhcp DHCP-RM
DHCP of DHCP-RM
POOLS
  DHCP-RM eth0           10.20.10.100 – 10.20.10.199  gateway 10.20.10.1  dns 10.10.100.53  8 leased, 92 free of 100
LEASES
  10.20.10.100     PC-RM-101 eth0           from DHCP-RM eth0
  10.20.10.101     PC-RM-102 eth0           from DHCP-RM eth0
  10.20.10.102     PC-RM-103 eth0           from DHCP-RM eth0
  10.20.10.103     PC-RM-104 eth0           from DHCP-RM eth0
  10.20.10.104     PC-RM-201 eth0           from DHCP-RM eth0
  10.20.10.105     PC-RM-202 eth0           from DHCP-RM eth0
  10.20.10.106     PC-RM-203 eth0           from DHCP-RM eth0
  10.20.10.107     PC-RM-204 eth0           from DHCP-RM eth0
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

A range written again replaces the one the interface had, all of it: what is not written in the new one, the gateway and the DNS server, is gone.

```ncl sample=company
pixelcake> interface 1 pool 192.168.10.100 to 192.168.10.149 gateway 192.168.10.1 on Router-Core
port 1 on Router-Core now hands out 192.168.10.100 to 192.168.10.149: 50 addresses, gateway 192.168.10.1
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> show dhcp Router-Core
DHCP of Router-Core
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.149  gateway 192.168.10.1  0 leased, 50 free of 50
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Laptop-1 eth0            from Router-Core port 2
  192.168.20.101   Laptop-2 eth0            from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

The range of port 1 lost its DNS server, because the command did not name one.

## Which address {#which-address}

The engine gives the cards their addresses in the order of the drawing: the devices as they appear, and the cards of each device in order. Each card takes the lowest address of its range that is free. An address is not free when:

- it is written by hand on an interface of the drawing, in any network, except a private address on the other side of the Internet symbol: behind another NAT it is in a network of its own, as for [two devices with one address](../building/addresses.md#conflicts);
- another card has been given it already, with the same exception;
- it is the gateway the range hands out;
- it is the first or the last address of the network.

So an address written by hand inside a range moves the lease that had it. Here the printer is given 192.168.20.100 by hand, and both laptops move up by one:

```ncl sample=company
pixelcake> interface eth0 ip 192.168.20.100 on Printer
interface eth0 on Printer: 192.168.20.100 / 255.255.255.0
pixelcake> show dhcp
DHCP — 2 pools, 2 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 97 free of 100
LEASES
  192.168.20.101   Laptop-1 eth0            from Router-Core port 2
  192.168.20.102   Laptop-2 eth0            from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

If two servers on one network both have addresses left, the first in the drawing answers, and “Warnings” in the “DHCP” tab names them. When the first has none left, the next one gives one.

## A card that gets none {#no-address}

A card on DHCP that finds no address is left without one, and anything asked of it or to it stops with the reason. The reason is one of these:

- no DHCP server answers on its network: there is no range on that network, or it does not reach the card;
- the range is used up: every address of it is taken (`the pool of Router-Core port 2 is used up`);
- the interface of the card is switched off (`interface eth0 is disabled`);
- no cable is attached to the card;
- the range that answers cannot be used, for example it is outside the network of its interface;
- the cable to the server is not attached to one of its ports, so it is not known which range answers (on a firewall with zones, see [Zones](firewall.md#zones));
- the device is a router or a firewall.

The window says the same. In the “Network cards” tab the card reads `No address:` followed by the reason, and on the board the address of the device is replaced by “DHCP: no address” and the top of its drawing turns yellow. `show dhcp` lists such cards under `WITHOUT AN ADDRESS`.

A range with a single address, used by one laptop, leaves the other without:

```ncl sample=company
pixelcake> interface 2 pool 192.168.20.100 to 192.168.20.100 on Router-Core
port 2 on Router-Core now hands out 192.168.20.100 to 192.168.20.100: 1 address, gateway 192.168.20.1
  leased now: Laptop-1 192.168.20.100
pixelcake> show dhcp
DHCP — 2 pools, 1 lease
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.100  gateway 192.168.20.1  1 leased, 0 free of 1
LEASES
  192.168.20.100   Laptop-1 eth0            from Router-Core port 2
WITHOUT AN ADDRESS
  ✗ Laptop-2 eth0: the pool of Router-Core port 2 is used up: its one address is taken
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> ping Web-ERP from Laptop-2
Pinging Web-ERP (192.168.30.30) from Laptop-2...
Ping failed (error): request: Laptop-2 has no address: the pool of Router-Core port 2 is used up: its one address is taken
```

A range on a port that is switched off answers nobody, and the cards that had an address from it lose it:

```ncl sample=company
pixelcake> interface 2 down on Router-Core
port 2 on Router-Core is now down
pixelcake> show dhcp
DHCP — 2 pools, 0 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  0 leased, 100 free of 100  (interface down: it answers nobody)
WITHOUT AN ADDRESS
  ✗ Laptop-1 eth0: no DHCP server answers on its network
  ✗ Laptop-2 eth0: no DHCP server answers on its network
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

A card that is disabled and a card with no cable are two more cases:

```ncl sample=company
pixelcake> interface eth0 down on Laptop-1
interface eth0 on Laptop-1 is now down
pixelcake> disconnect Laptop-2 from AP-Offices
disconnected Laptop-2 ↔ AP-Offices
pixelcake> show dhcp
DHCP — 2 pools, 0 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  0 leased, 100 free of 100
WITHOUT AN ADDRESS
  ✗ Laptop-1 eth0: interface eth0 is disabled
  ✗ Laptop-2 eth0: interface eth0 has no cable attached
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

When a card is put on DHCP and nothing answers, the answer says so at once:

```ncl sample=company
pixelcake> interface eth0 dhcp on Remote-Customer
interface eth0 on Remote-Customer now takes its address from DHCP
  warning: no address yet: no DHCP server answers on its network
```

## Limits {#limits}

> [!LIMITS]
> - No relay. A server gives addresses to the network its interface is on, and a router does not pass a request on to another network.
> - No reservations: a range cannot give the same address to the same card every time. An address written by hand on the card does that.
> - No lease times and no renewal: a lease is a function of the drawing. It is not saved in the project file and it is worked out again at every question.
> - No exchange of messages: the request, the offer and the acknowledgement are not shown. The lease is there, or the reason it is not.
> - One range for each interface, and only the gateway and the DNS server are handed out with the address: no domain name, no time server, no other options.
> - A router or a firewall port cannot take its address from DHCP.
> - A failure simulated in presentation mode does not take the address away from whoever had it, not even when it is its DHCP server that is down.
