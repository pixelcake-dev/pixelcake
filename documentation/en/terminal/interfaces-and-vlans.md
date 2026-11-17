---
title: Interfaces and VLANs
description: The commands that switch an interface on and off, give it an address and a gateway, and put the port of a switch in a VLAN.
order: 3
---

An interface is a port of a switch, a router or a firewall, numbered from 1, or a network card of any other device, called by its name (`eth0`). The commands on this page change one interface at a time, as the window of the device does, and the change is kept with the drawing like any other edit. Two more groups of settings belong to an interface and have pages of their own: the security zone and NAT in [Firewall and NAT](firewall-and-nat.md), the DHCP server, the DHCP client and the DNS server in [DHCP and DNS](dhcp-and-dns.md).

In the syntax below, `<id>` is a port number or the name of a card, `<n>` a port number, `<name>` the name of a card. A device is named as it is on the board, or by one of its addresses; `[on] <device>` may be left out inside `use <device>` (see [Inside a device](#inside-a-device)). The [overview](index.md#conventions) explains the rest of the notation.

## interface … up | down {#up-down}

```text
interface <id> up|down [on] <device>
enable port <n> [on] <device>
disable port <n> [on] <device>
```

Switches an interface on or off, as “Port enabled” does in the window of a switch, a router or a firewall. An interface that is down carries nothing: a packet that has another path takes it, the others stop there, and the reason names the interface.

| Parameter | What it is |
|---|---|
| `<id>` | A port number (`3`) or the name of a network card (`eth0`) |
| `<device>` | The device the interface belongs to |

`enable port <n>` and `disable port <n>` are the same as `interface <n> up` and `interface <n> down`, for ports only.

```ncl sample=office
pixelcake> interface 2 down on SW-Office
port 2 on SW-Office is now down
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: port 2 on SW-Office is disabled
  dropped at: SW-Office
pixelcake> interface 2 up on SW-Office
port 2 on SW-Office is now up
pixelcake> disable port 2 on SW-Office
port 2 on SW-Office is now down
pixelcake> enable port 2 on SW-Office
port 2 on SW-Office is now up
pixelcake> interface eth0 down on PC-2
interface eth0 on PC-2 is now down
```

## interface … ip {#ip}

```text
interface <id> ip <address>[/<prefix>] [on] <device>
interface <id> ip none [on] <device>
interface <id> address <address>[/<prefix>] [on] <device>
```

The address of a port of a router or of a firewall, or of a network card. On a router or a firewall the address of a port is the gateway of the devices connected to it, and its network is reached without a route. `ip none` takes the address away.

| Parameter | What it is |
|---|---|
| `<address>` | An IPv4 address, `10.0.0.1` |
| `/<prefix>` | The length of the mask, from 0 to 32: `/30` is 255.255.255.252. Without it the mask the interface has is kept, and a new address gets `/24` |

`address` may be written in place of `ip`. An address written on a card that takes its address from DHCP takes the card off DHCP. The ports of a switch have no address: the switch has one of its own, set with `set ip` ([Devices and addresses](devices-and-addresses.md#set)).

```ncl sample=office
pixelcake> interface 3 ip 10.0.0.1/30 on Router-1
port 3 on Router-1: 10.0.0.1 / 255.255.255.252
pixelcake> show ip Router-1
Router-1 — addressing
  ip:       192.168.10.1
  subnet:   255.255.255.0
  gateway:  -
  port 1: 192.168.10.1 / 255.255.255.0
  port 2: 192.168.20.1 / 255.255.255.0
  port 3: 10.0.0.1 / 255.255.255.252
pixelcake> interface 3 address 10.0.0.5 on Router-1
port 3 on Router-1: 10.0.0.5 / 255.255.255.252
pixelcake> interface 3 ip none on Router-1
port 3 on Router-1 has no address now
pixelcake> interface eth0 ip 192.168.10.21 on PC-1
interface eth0 on PC-1: 192.168.10.21 / 255.255.255.0
```

## interface … gateway {#gateway}

```text
interface <name> gateway <address> [on] <device>
interface <name> gateway none [on] <device>
```

The default gateway of a network card: where the card sends what is not on its own network. Only cards have a gateway; the default route of a router or a firewall is set with `set gateway` or `add route default` ([Routes](routes.md)). The engine checks that the gateway is an address of a router on the network of the card, and says so when it is not.

| Parameter | What it is |
|---|---|
| `<name>` | The name of a network card, `eth0` |
| `<address>` | The address of the gateway, on the network of the card |

```ncl sample=office
pixelcake> interface eth0 gateway 192.168.10.254 on PC-1
interface eth0 on PC-1: gateway 192.168.10.254
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.254, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
pixelcake> interface eth0 gateway 192.168.10.1 on PC-1
interface eth0 on PC-1: gateway 192.168.10.1
pixelcake> interface eth0 gateway none on PC-2
interface eth0 on PC-2 has no gateway now
pixelcake> ping Web-01 from PC-2
Pinging Web-01 (192.168.20.10) from PC-2...
Ping failed (blocked): request: no default gateway configured on PC-2
  dropped at: PC-2
pixelcake> interface 1 gateway 10.0.0.1 on Router-1
port 1 on Router-1 is a port: ports have no gateway
  the default route of Router-1 is: set gateway of Router-1 to <address>
```

## interface … access {#access}

```text
interface <n> access <vlan> [on] <switch>
```

The port becomes an access port in one VLAN. The first port of a switch to get a VLAN makes the switch apply VLANs port by port, and the answer says so: from then on every port nobody set is in VLAN 1 ([why](../building/vlans.md#vlan-1)).

| Parameter | What it is |
|---|---|
| `<n>` | The number of a port of a switch |
| `<vlan>` | A VLAN, from 1 to 4094 |

```ncl sample=office
pixelcake> interface 1 access 10 on SW-Office
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> interface 2 access 10 on SW-Office
port 2 on SW-Office is now an access port in VLAN 10
pixelcake> trace PC-2 from PC-1
Tracing route to PC-2 (192.168.10.12) from PC-1:
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)  — VLAN 10
  3  ● PC-2 (PC)
Trace complete: destination reached.
pixelcake> interface 2 access 20 on SW-Office
port 2 on SW-Office is now an access port in VLAN 20
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: VLAN 10 does not leave through port 2 on SW-Office: it is an access port in VLAN 20
  dropped at: SW-Office
```

## interface … trunk {#trunk}

```text
interface <n> trunk <vlan>,<vlan>,… [on] <switch>
interface <n> trunk all [on] <switch>
```

The port becomes a trunk, carrying the VLANs of the list, each with its tag. The list may be written `10,20` or `10, 20`; `all`, or no list at all, makes a trunk for every VLAN. A trunk for every VLAN is the only VLAN setting of a switch that does not make it apply VLANs: alone, it changes nothing.

| Parameter | What it is |
|---|---|
| `<n>` | The number of a port of a switch |
| `<vlan>,<vlan>,…` | The VLANs the trunk carries, each from 1 to 4094 |

```ncl sample=company
pixelcake> show interfaces SW-Offices
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
1          port   up      -                10         access     PC-Accounts (eth0)
2          port   up      -                10         access     PC-Sales (eth0)
3          port   up      -                10         access     Printer (eth0)
4          port   up      -                20         access     AP-Offices (eth0)
5          port   up      -                1          access     -
6          port   up      -                1          access     -
7          port   up      -                1          access     -
8          port   up      -                10,20      trunk      SW-Core (port 1)
pixelcake> interface 8 trunk 10 on SW-Offices
port 8 on SW-Offices is now a trunk carrying VLANs [10]
pixelcake> ping Web-ERP from AP-Offices
Pinging Web-ERP (192.168.30.30) from AP-Offices...
Ping failed (blocked): request: VLAN 20 does not leave through port 8 on SW-Offices: it is a trunk carrying VLANs [10]
  dropped at: SW-Offices
pixelcake> interface 8 trunk 10,20 on SW-Offices
port 8 on SW-Offices is now a trunk carrying VLANs [10,20]
```

```ncl sample=office
pixelcake> interface 8 trunk 10,20 on SW-Office
port 8 on SW-Office is now a trunk carrying VLANs [10,20]
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> interface 8 trunk all on SW-Office
port 8 on SW-Office is now a trunk carrying every VLAN
  no port of SW-Office has a VLAN any more: it forwards everything as it comes
```

## interface … default {#default}

```text
interface <n> default [on] <switch>
```

The port has no VLAN of its own any more, as when the switch was drawn. When it was the last port with a VLAN, the switch stops applying VLANs and forwards everything as it comes, and the answer says so.

| Parameter | What it is |
|---|---|
| `<n>` | The number of a port of a switch |

```ncl sample=office
pixelcake> interface 1 access 10 on SW-Office
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> interface 1 default on SW-Office
port 1 on SW-Office has no VLAN of its own now
  no port of SW-Office has a VLAN any more: it forwards everything as it comes
```

## add vlan, remove vlan {#device-vlans}

```text
add vlan <id> [to] <device>
remove vlan <id> from <device>
```

The list of VLANs of a device, the one in the “General” tab of its window. On a switch it is the VLANs the switch knows: frames of any other VLAN are dropped, and an empty list means all of them. On any other device it is the VLANs its interface accepts tagged on a trunk port. The VLAN of each port is set with `interface … access` and `interface … trunk`, above; this list is rarely needed ([more](../building/vlans.md#device-vlans)).

| Parameter | What it is |
|---|---|
| `<id>` | A VLAN, from 1 to 4094 |
| `<device>` | Any device |

```ncl sample=office
pixelcake> add vlan 10 to SW-Office
SW-Office: added to VLAN 10 (now [10])
pixelcake> show vlans
VLAN   MEMBERS
10     SW-Office
pixelcake> remove vlan 10 from SW-Office
SW-Office: removed from VLAN 10 (no VLANs left — untagged)
pixelcake> remove vlan 20 from PC-1
PC-1 is not a member of VLAN 20
```

## Inside a device {#inside-a-device}

```text
use <device>
exit
```

`use` makes a device the one every command is about, until `exit`: the prompt takes its name, and `on <device>` is left out.

```ncl sample=office
pixelcake> use SW-Office
context: SW-Office — "from" is now implied, "exit" to leave
SW-Office> interface 1 access 10
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
SW-Office> exit
left SW-Office
```

## When a command is refused {#refusals}

A command that cannot be done changes nothing, and says why, or what it should have been:

```ncl sample=office
pixelcake> interface 1 access 5000 on SW-Office
unknown command: "interface 1 access 5000 on SW-Office"
  VLAN id must be a number from 1 to 4094, got "5000" — try: interface <n> access <vlan> [on] <device>
  type "help" for the command list
pixelcake> interface 9 down on SW-Office
SW-Office has no port 9 (ports 1-8)
pixelcake> interface 1 access 10 on PC-1
PC-1 has no interface "1" (it has: eth0)
pixelcake> interface 1 ip 10.1.1.1 on SW-Office
SW-Office is a Switch: its ports carry no address
  its own address is set with: set ip of SW-Office to <address>
```

## See also {#see-also}

- [VLANs](../building/vlans.md): what a VLAN is, and how to set one in the window of a switch.
- [Show commands](show.md#show-interfaces): `show interfaces` and `show vlans`, to read what these commands changed.
- [Firewall and NAT](firewall-and-nat.md) and [DHCP and DNS](dhcp-and-dns.md): the other settings of an interface.
