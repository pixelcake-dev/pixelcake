---
title: "Ports and network cards"
description: "Switches, routers and firewalls have numbered ports; every other device has network cards. What each holds, and how to edit it."
order: 2
---

A cable is plugged into something. On a switch, a router or a firewall that is a numbered **port**; on every other device it is a **network card**, called by its name, `eth0`. The engine reads the settings of a port or of a card, one at a time: whether it is on, which VLAN it is in, which address it has. Both are edited in the window of the device ([Devices](devices.md#window)), in its “Ports” tab or its “Network cards” tab, and nothing is kept until you press “Save”.

## Ports {#ports}

A switch has 5, 8, 16, 24 or 48 ports; a router or a firewall has 2, 4, 8 or 16. The number is chosen when the device is added, and it can be changed later: “Number of ports” in the “Ports” tab. New ports are added at the end. The last ones are taken away, unless a cable is attached to one of them: then PixelCake says which port, and the cable has to be detached first.

The tab shows the ports as a row of boxes. Each shows its number, its name if it has one, a letter for its mode (`A` access, `T` trunk, `W` WAN, `L` LAN, `D` DMZ), a small link mark when a cable is attached, and a bolt when PoE is on; a disabled port is grey. Rest the pointer on one and it says its name, its VLAN and what it is connected to. A click on a box opens its settings under the row, and the line “Connected to” says which device and which port the cable goes to, or that no cable is attached.

| Setting | On | What it does |
|---|---|---|
| “Port enabled” | all | A port that is off carries nothing. A packet with another way takes it; the others stop, and the reason names the port |
| “Port name (optional)” | all | A name for you, shown in lists and when the pointer rests on the port. [Connecting what has no cable](layout-and-connection.md#connect) also reads it: a port named after a device is kept for that device |
| “Port mode” | switch | “Access (end device)” or “Trunk (between switches)”. It decides how the VLAN of the port is read: see [VLANs](vlans.md#access-and-trunk) |
| “VLAN (single)” or “VLANs (comma-separated)” | switch | The VLAN of an access port, the VLANs a trunk carries: see [VLANs](vlans.md) |
| “IP address”, “Subnet mask” | router, firewall | The address of the port. It is the gateway of the devices cabled there, and its network is reached without a route. Without a mask `255.255.255.0` is used. See [Addresses and gateways](addresses.md#router-ports) |
| “Security zone” | firewall | Trust, untrust, DMZ or none. The firewall reads its rules first; when no rule matches, the zone policy decides what passes ([Firewall](../services/firewall.md#policy)) |
| “NAT enabled” | router, firewall | What the device forwards out of this port leaves with the address of the port |
| “DHCP server enabled” | router, firewall | The port hands addresses out to the cards of its network that are on DHCP |
| “Link speed”, “PoE enabled (Power over Ethernet)”, “IPS/IDS enabled (intrusion prevention/detection)” | speed on all, PoE on a switch, IPS on a firewall | Nothing: they are kept with the drawing, and the engine does not read them |
| “Port mode” | router, firewall | Nothing: WAN, LAN or DMZ here only describes the port. On a firewall the security zone is what counts |
| “Notes / description” | all | Free text |

Where a device has ports, the “General” tab sums them up. A switch tells how many are connected and disabled, which ports are in which VLAN and what each trunk carries. A router or a firewall lists its ports in use, with address, zone, what each is connected to and what it does (NAT, DHCP server); a click on the name of a port opens it in the “Ports” tab.

On a firewall, the security zones, the NAT of a port and the DHCP server of a port have pages of their own: [Firewall](../services/firewall.md#zones), [NAT and port forwards](../services/nat.md#source-nat) and [DHCP](../services/dhcp.md#servers).

## Network cards {#cards}

Every device that is not a switch, a router or a firewall has at least one network card, and a new device has one: `eth0`. The “Network cards” tab lists them, one row for each, with its name, address, MAC, speed and what it is connected to; a click on a row opens its settings. A device with a single card shows them at once.

| Setting | What it does |
|---|---|
| “Card enabled” | A card that is off carries nothing, as a port that is off |
| “Interface name” | `eth0`, `eth1`, `ens192`. It is how the terminal names the card (`interface eth0 down on PC-1`). Two cards of a device may not have the same name |
| “Link speed” | Nothing: the engine does not read it |
| “MAC address” | Written on the card and kept with the drawing. The link “Generate a MAC address” makes one, of the form `02:XX:XX:XX:XX:XX`. Nothing reads it: the engine follows addresses and cables, not MAC addresses |
| “Address” | “Manual”, with “IP address”, “Subnet mask” and “Gateway” typed here, or “Automatic (DHCP)”, where the address comes from a DHCP server of the network ([DHCP](../services/dhcp.md#clients)) |
| “DNS server” | The address of the server the card asks to turn a name into an address ([DNS](../services/dns.md#who-asks)) |
| “Notes / description” | Free text |

“Add card” adds a card, `eth1` and so on, with a MAC of its own, no address, and the mask and gateway of the device; “Delete card” takes one away, except the last one, which a device cannot be without. Each cable is attached to one card ([Cables and links](cables.md#ends)). A device with two cards on two networks is addressed on both, and each card has the gateway of its own network: the “Gateway” of the card is the next hop of what leaves by that card.

A server can hand out addresses from a card, as a router does from a port: the card has the same “DHCP server enabled” setting. An end device cannot.

## The first card {#first-card}

A device with cards is known by its first card: its name stands for that card’s address, in the drawing under the name and in the terminal (`ping PC-1`). That address, the mask and the gateway are also on the “General” tab of the window, under the heading `Network · eth0`: they are the card’s, and the two places are one field. Typing the address there, or in the card’s row, writes the same value. The address of a router or a firewall is different: the one in “General” is the address the device is called by, and the networks it is attached to come from the addresses of its ports.

Under the address the tab says what the first card is connected to, and, for a device with several cards, that it is the first of them and where the others are. The line under the name on the drawing is the address of this card, followed by “DHCP” when it is leased.

## What is wrong with one {#problems}

A value that cannot be kept is said under its field as you type it, in red:

- an address that is not four numbers from 0 to 255: `"300.1.1.1" is not a valid IPv4 address`;
- a mask that is not a mask, or a mask with no address: “Enter an IP address or clear the subnet mask”;
- a VLAN that is not a number from 1 to 4094, or several VLANs on an access port;
- a card with no name, or two cards with the same name;
- a DHCP range outside the network of its port or card, or with no address to give;
- a DNS server that is not an address.

“Save” does not close the window while one of these is left. It tells which port or card it is: `Port 1: "300.1.1.1" is not a valid IPv4 address`, `Card eth0: …`. Fix it, or press “Cancel” to leave the device as it was.

What the app does not check is whether the values make sense together. A port with an address outside the network its cable leads to, or two ports on one network, is saved. What the engine makes of it comes out when you ask: a packet that cannot find its way stops with a reason ([Addresses and gateways](addresses.md#gateway)).

## Limits {#limits}

> [!LIMITS]
> - Speed and PoE are not simulated: a 10 Mbps port is as fast as a 10 Gbps one, and a switch does not run out of power.
> - Spanning tree and the other settings of a port that only describe it (the mode of a router port, IPS/IDS) are kept with the drawing and read by nothing.
> - A port belongs to one cable. A device with more cables than ports leaves the extra cables with no port, and the engine then skips the per-port rules on them, with a note.
> - A MAC address is for show: nothing is learned or filtered by it.
