---
title: "Addresses and gateways"
description: "The address of an end device, the addresses of the ports of a router, the gateway, and the network new devices start from."
order: 4
---

An address tells a device where it is; a mask tells it which other addresses are in the same network; a gateway tells it where to send what is not. The engine reads all three from the interfaces of every device on the path of a packet. A device sends straight to an address that is in its own network, and to its gateway for any other. The gateway must be a router, or a firewall, that has an address in that network.

## The address of an end device {#end-devices}

An end device has an address on its first network card, `eth0`: an “IP address”, a “Subnet mask” and a “Gateway”, and optionally a “DNS server”. They are set in two places that are one: the “General” tab of the window of the device, under the heading `Network · eth0`, and the card’s row in the “Network cards” tab ([Ports and network cards](ports-and-cards.md#first-card)).

A card can take its address from a DHCP server instead: set “Address” to “Automatic (DHCP)”, and the fields give way to the address the card is leased ([DHCP](../services/dhcp.md#clients)). A card on DHCP that gets no address makes its device yellow, and says “DHCP: no address” under its name.

`show ip` tells what a device has, in the terminal:

```ncl sample=office
pixelcake> show ip PC-1
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
pixelcake> show ip Router-1
Router-1 — addressing
  ip:       192.168.10.1
  subnet:   255.255.255.0
  gateway:  -
  port 1: 192.168.10.1 / 255.255.255.0
  port 2: 192.168.20.1 / 255.255.255.0
```

The device has `ip`, `subnet` and `gateway` of its own, which are the first card’s, and one line for each card or addressed port. The terminal sets them with `set ip`, `set gateway`, `set subnet` and `interface <name> ip` ([Devices and addresses](../terminal/devices-and-addresses.md#set)).

## The ports of a router {#router-ports}

The ports of a switch have no address: a switch has one of its own, for being managed, and forwards by VLAN. The ports of a **router** and of a **firewall** have each an “IP address” and a “Subnet mask” ([Ports and network cards](ports-and-cards.md#ports)). An address on a port does two things:

- it is the **gateway of the devices cabled there**: they write it in their “Gateway”;
- its network is **connected** to the router: a packet for it is delivered without a route.

Router-1, in the office sample, has two ports, one in each network. A port with no address is not in any network; a router whose ports have none still lets traffic through, with a note that the gateway and the routing were not verified, so that drawings made without addresses go on working. Several VLANs on one switch are several networks, and a router needs a port in each ([VLANs](vlans.md#between-vlans)). A network behind another router is reached with a route ([Routes](../services/routes.md#static)).

## The gateway {#gateway}

When a device sends to an address that is not in its own network, it sends to its gateway. The engine checks that the gateway is there. Each of these stops the packet, with a reason that says which:

```ncl sample=office
pixelcake> set gateway of PC-1 to 192.168.10.5
PC-1: gateway set to 192.168.10.5
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.5, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
pixelcake> interface eth0 gateway none on PC-1
interface eth0 on PC-1 has no gateway now
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: no default gateway configured on PC-1
  dropped at: PC-1
pixelcake> interface eth0 gateway 192.168.10.1 on PC-1
interface eth0 on PC-1: gateway 192.168.10.1
```

A gateway that nobody has: the reason names the gateway the device uses, and the address of the router port it reached. No gateway at all: the device cannot leave its network. A gateway that is a port with no address:

```ncl continue
pixelcake> interface 1 ip none on Router-1
port 1 on Router-1 has no address now
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.1, but Router-1 port 1 on its link has no IP address
  dropped at: PC-1
pixelcake> interface 1 ip 192.168.10.1 on Router-1
port 1 on Router-1: 192.168.10.1 / 255.255.255.0
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
```

And a mask too wide, which makes two networks look like one to the sender. It sends straight to the server instead of to its gateway, and the router in between does not carry traffic inside a network:

```ncl sample=office
pixelcake> interface eth0 ip 192.168.10.11/16 on PC-1
interface eth0 on PC-1: 192.168.10.11 / 255.255.0.0
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: Web-01 (192.168.20.10) is addressed inside the network of PC-1 but sits behind Router-1: a router does not pass traffic within one network
  dropped at: Router-1
```

The reverse is an address in the wrong network: the packet reaches the router, which finds nobody that answers:

```ncl sample=office
pixelcake> set ip of PC-2 to 192.168.20.77
PC-2: ip set to 192.168.20.77
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.20.77) from PC-1...
Ping failed (blocked): request: PC-2 (192.168.20.77) does not answer on the network of Router-1
  dropped at: Router-1
```

None of these is refused when you type it. The window checks that an address is four numbers from 0 to 255, that a mask is a mask, and that a mask comes with an address ([Ports and network cards](ports-and-cards.md#problems)); it does not check that a gateway is in the network of the card, or that an address belongs to the network of the cable it is on. That is what asking the network is for: a `ping`, or a `trace`, says where the packet stopped and why. An address that another device has too is not refused either, but it is marked at once ([below](#conflicts)).

## Two devices with one address {#conflicts}

An address written on two devices is in conflict, as on a real network when a machine is cloned with its address: whoever asks for it may be answered by either of the two, so no answer about it can be trusted. It happens most often after a paste: a copy of a server, a router, a firewall or a switch keeps the addresses of the original ([Devices](devices.md#copy-delete)). Until one of the two has another address:

- **on the board** both devices are yellow, and the line under the name shows the address followed by `· in conflict`;
- **in the window of the device** a box over the tabs names the other device that has the address, and follows what you type; saving is not refused;
- **in the answers** a question to that address, or from it, stops before it starts, with a reason that names the address and the devices. A device that pings itself is still answered, and a question between two other devices is not touched;
- **in the terminal** `show ip` and `show interfaces` end with a line for each address in conflict.

```ncl sample=office
pixelcake> set ip of Mail-01 to 192.168.20.10
Mail-01: ip set to 192.168.20.10
  warning: 192.168.20.10 is also the address of Web-01
pixelcake> show ip Mail-01
Mail-01 — addressing
  ip:       192.168.20.10
  subnet:   255.255.255.0
  gateway:  192.168.20.1
  eth0: 192.168.20.10 / 255.255.255.0 gw 192.168.20.1
  ✗ address conflict: 192.168.20.10 is also on Web-01
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (error): request: address conflict: 192.168.20.10 is on both Web-01 and Mail-01, so the answer cannot be trusted
pixelcake> set ip of Mail-01 to 192.168.20.11
Mail-01: ip set to 192.168.20.11
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
```

The ping does not leave PC-1: which of the two servers would answer cannot be said, and a real network would answer now from one, now from the other.

What counts:

- **An address written by hand**: on a network card, on a port of a router or a firewall, or on the device itself (the address of a switch). An interface that is disabled answers nobody and does not count. `0.0.0.0` and the loopback addresses (`127.x.x.x`) never do.
- **Not a leased address.** A DHCP server hands out only addresses nobody has, written by hand or leased ([DHCP](../services/dhcp.md#which-address)), so a lease is never in conflict, not even with an address written inside its range.
- **A public address** is in conflict wherever the two devices are: on the Internet it is unique.
- **A private address** (10.x, 172.16–31.x, 192.168.x) is not in conflict when the Internet stands between the two devices, that is, when they are cabled to each other only through an Internet symbol. The Internet does not carry private addresses ([NAT](../services/nat.md#private)), so each is in a network of its own: two offices, each behind its own router towards the Internet, can both have `192.168.1.10`, as real ones do. Any other way between them, a cable, a switch, a router, a Cloud symbol that is not the Internet such as an MPLS network, puts them in one network.
- **Two devices not cabled to each other at all** are taken to be in one network: a copy just pasted, not cabled yet, is meant to sit beside its original.

## The network of the project {#project-network}

A new device is given an address, a mask and a gateway, and these come from the project. In Settings → Network, under “New devices”:

| Field | What it is |
|---|---|
| “Network” | A network address, `192.168.1.0`. A new device is proposed the first free address of it, from `.2`, skipping the addresses that devices already have, written by hand or leased |
| “Default subnet mask” | The mask of the new cards |
| “Default gateway” | The gateway of the new cards. A router or a firewall starts with none: for them the gateway is the default route, chosen in their window |
| “Default DNS server” | Optional. It is written on the card of new PCs, servers and other end devices; not on an access point, a load balancer or a Cloud, which only carry the traffic of others |

Press “Save network settings”. A field left empty (the DNS server may be) or one that is not an address is refused, and a notice says so (“All fields are required”). The settings are those of the project and travel with it in the file. **Changing them does not touch devices that are already on the board**: they have the addresses they were given. The one exception is the DNS server: once it is saved, the same tab says how many end devices of the board ask nobody and offers a button, for example "Assign 192.168.30.10", that gives it to them after a question. A device that names a server keeps it.

Each sample network brings its own settings: the company, for example, starts new devices in `192.168.10.0` with gateway `192.168.10.1`. Loading one replaces the settings of the project, and the question that is asked first says so ([Samples](../reference/samples.md)). File → “New project…” asks for the same values.

## Limits {#limits}

> [!LIMITS]
> - Only IPv4. There is no IPv6.
> - A port or a card has one address. A second address on the same interface, a sub-interface, and an address that moves between devices (VRRP, HSRP) are not modelled.
> - There is no ARP. A conflict is found in the drawing, not in the traffic: which of the two devices would answer is not worked out, and a gateway that is in conflict is not noticed by the packets that only pass through it. Two interfaces of one device with the same address are not taken for a conflict.
> - A gateway is only looked at when a packet needs it: the board accepts one that is nowhere near the network of its card.
