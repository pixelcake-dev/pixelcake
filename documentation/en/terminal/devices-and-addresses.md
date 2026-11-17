---
title: "Devices and addresses"
description: "The commands that change the address, mask, gateway and name of a device, and that add or remove a cable."
order: 2
---

These commands change a device as a whole, or the cable between two devices. What belongs to one port or one network card (its address, its state, its VLAN, its zone) is set with `interface`, and has its own pages: [Interfaces and VLANs](interfaces-and-vlans.md), [Firewall and NAT](firewall-and-nat.md) and [DHCP and DNS](dhcp-and-dns.md). Like every command that changes the network, they edit the drawing you see: the change is on the board at once, and is kept with the project like any other edit ([overview](index.md#edits)).

A device is named as it is on the board, or by one of its addresses; `[of]` and `[to]` are words the terminal accepts and does not need. The [overview](index.md#conventions) explains the rest of the notation.

## set {#set}

```text
set ip [of] <device> [to] <address>
set gateway [of] <device> [to] <address>
set subnet [of] <device> [to] <mask>
set name [of] <device> [to] <new name>
```

Sets one property of a device: its address, its default gateway, its mask, or its name. They are the address, mask, gateway and name of the “General” tab of the window of the device ([addresses](../building/addresses.md)).

| Parameter | What it is |
|---|---|
| `<device>` | The device to change. Inside `use <device>` it is left out |
| `<address>` | An IPv4 address, `192.168.10.21`. It is checked before it is written |
| `<mask>` | The subnet mask, `255.255.255.0`. The command writes whatever is typed: it is not checked |
| `<new name>` | The new name of the device, of one or more words. It is the last thing in the command, so it needs no quotes |

What each one does:

- **On a device with network cards**, `set ip`, `set gateway` and `set subnet` write the first card, the one the window of the device shows as its address. For any other card use `interface <name> ip` and `interface <name> gateway` ([Interfaces and VLANs](interfaces-and-vlans.md#ip)).
- **On a router or a firewall**, `set gateway` sets the default route, and the answer says so. `add route default` does the same with a next hop that may be a device ([Routes](routes.md)). `set ip` sets the address the device is known by; the address of each port is set with `interface <n> ip`.
- **On a switch**, `set ip` sets the address the switch answers on, as no port of a switch has one.
- **If the address is already another device's**, the command writes it all the same and prints a warning with the name of that device.
- **If the first card takes its address from DHCP**, `set ip` takes the card off DHCP and writes the address, with the mask `255.255.255.0` and no gateway. `set subnet` and `set gateway` are refused: they come with the lease ([DHCP and DNS](dhcp-and-dns.md#dhcp-client)).

```ncl sample=office
pixelcake> set ip of PC-1 to 192.168.10.21
PC-1: ip set to 192.168.10.21
pixelcake> set ip PC-1 192.168.10.12
PC-1: ip set to 192.168.10.12
  warning: 192.168.10.12 is also the address of PC-2
pixelcake> set subnet of PC-1 to 255.255.255.128
PC-1: subnet set to 255.255.255.128
pixelcake> set gateway of PC-1 to 192.168.10.254
PC-1: gateway set to 192.168.10.254
pixelcake> show config PC-1
PC-1 — PC
  ip:       192.168.10.12
  subnet:   255.255.255.128
  gateway:  192.168.10.254
  vlans:    none (untagged)
  nic eth0: 192.168.10.12 / 255.255.255.128 gw 192.168.10.254 
pixelcake> set gateway of Router-1 to 10.0.0.9
Router-1: gateway set to 10.0.0.9
  the gateway of a router is its default route — "show routes Router-1"
pixelcake> set ip of SW-Office to 192.168.10.3
SW-Office: ip set to 192.168.10.3
```

The name may be several words, and a name another device already has is not refused.

```ncl sample=office
pixelcake> set name of PC-1 to Front desk
PC-1 renamed to "Front desk"
pixelcake> ping Web-01 from Front desk
Pinging Web-01 (192.168.20.10) from Front desk...
Reply from 192.168.20.10: hops=5 time=7ms
pixelcake> show devices
DEVICE                   TYPE           IP               VLANS
Router-1                 Router         192.168.10.1     -
SW-Office                Switch         192.168.10.2     -
SW-Servers               Switch         192.168.20.2     -
Front desk               PC             192.168.10.11    -
PC-2                     PC             192.168.10.12    -
Web-01                   Server         192.168.20.10    -
Mail-01                  Server         192.168.20.20    -
```

> [!WARNING]
> Renaming the device you are inside (`use <device>`) leaves the prompt on the old name, and the commands that need the device then say that none is specified. Leave with `exit` and enter it again by its new name.

## connect, disconnect {#connect}

```text
connect <device> [to] <device>
disconnect <device> [from] <device>
```

`connect` draws a link between two devices, as pulling a cable from one to the other does on the board; `disconnect` takes it away. Each end of a new link is attached to the first free interface of its device: a port with the lowest number, or a network card, and the answer says which. Two devices can be given in either order, and `to` or `from` may be left out when each is one word.

| Parameter | What it is |
|---|---|
| `<device>` | A device. The two must be different |

Things the answer says:

- An end with no free interface (every port is in use, or the device has none) is drawn all the same, not attached to an interface, and the answer says so. A link that is not attached to an interface cannot be checked per port: the port rules are skipped on it and the engine says so in its notes.
- On a firewall whose ports have security zones the end is never attached by itself, even when ports are free: the port decides the zone. The answer says so and where to choose the port, in the window of the link (see [On a firewall with zones](../building/cables.md#firewall)).
- On a firewall whose ports are in security zones the end is not attached either: the port, and with it the zone, is chosen in the window of the link, opened with “Edit link”. The answer says that the port of a new link is chosen by hand, and that until then that end is not bound.
- `connect` between two devices that already have a link does nothing, and says so. `disconnect` between two devices that have none says so too.

```ncl sample=office
pixelcake> disconnect PC-1 from SW-Office
disconnected PC-1 ↔ SW-Office
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (unreachable): request: no physical path between PC-1 and Web-01
pixelcake> connect PC-1 to SW-Office
connected PC-1 (eth0) ↔ SW-Office (port 1)
pixelcake> show connections of PC-1
CONNECTIONS of PC-1 (1)
  PC-1 ↔ SW-Office  [eth0 ↔ port 1]
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
pixelcake> connect PC-1 to SW-Office
PC-1 and SW-Office are already connected
pixelcake> disconnect PC-1 SW-Office
disconnected PC-1 ↔ SW-Office
pixelcake> disconnect PC-1 SW-Office
PC-1 and SW-Office are not connected
```

## When a command is refused {#refusals}

A command that cannot be done changes nothing, and says why, or what it should have been:

```ncl sample=office
pixelcake> set ip of PC-1 to 192.168.10.999
"192.168.10.999" is not a valid IPv4 address
pixelcake> set ip of PC-9 to 192.168.10.30
device not found: "PC-9"
  did you mean "PC-1"?
pixelcake> set ip to 192.168.10.30
specify a device: "set ip of <device> to <value>"
pixelcake> set colour of PC-1 to red
unknown command: "set colour of PC-1 to red"
  try: set ip|gateway|subnet|name [of] <device> [to] <value>
  type "help" for the command list
pixelcake> connect PC-1 to PC-1
cannot connect a device to itself
pixelcake> connect PC-1 to Printer
device not found: "Printer"
pixelcake> connect PC-1
unknown command: "connect PC-1"
  try: connect <device A> to <device B>
  type "help" for the command list
```

## See also {#see-also}

- [Addresses](../building/addresses.md): the address, mask and gateway of a device in its window.
- [Interfaces and VLANs](interfaces-and-vlans.md#ip): the address of one port or card.
- [Show commands](show.md#show-ip): `show ip` and `show config`, to read what these commands changed.
- [Cables](../building/cables.md): links on the board.
