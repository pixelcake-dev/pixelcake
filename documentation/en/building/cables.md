---
title: "Cables and links"
description: "Drawing a cable between two devices, the port or card each end is attached to, and the type, label and colour of a link."
order: 3
---

A link is the line you draw between two devices; the cable is the thing it stands for. A link has two ends, and each end is attached to one interface of its device: a port on a switch, a router or a firewall, a network card on any other device ([Ports and network cards](ports-and-cards.md)). That attachment is what the engine reads: it follows a packet from interface to interface along the links, and applies to each end the settings of the port or the card it sits on.

## Drawing a cable {#draw}

![Two devices, a PC and a switch, are dragged apart; a cable is pulled from the right side of the PC, which turns orange, to the switch; the window of the link then shows eth0 on the PC and Port 1 on the switch.](../../media/cables/draw.en.mp4 "Drawing a cable, and the window of the link that shows where each end is attached.")

1. Move the pointer to an edge of a device. A band along each of the four sides of the frame, 12 units deep, starts a cable; the side under the pointer turns orange.
2. Press there and drag to another device. A line follows the pointer.
3. Let go anywhere over the other device. The cable ends on the side where you let go.

The cable is made at once. A click on it selects it, and the Delete key deletes it at once. Right click it for a menu with “Edit link” and “Delete link”, which asks first. Two devices may be joined by more than one cable, as the two cables between Router-Core and SW-Core in the company sample, and each takes interfaces of its own. Nothing can be drawn or edited in presentation mode.

## The two ends {#ends}

When a cable is made, each end takes the first free interface of its device: the lowest-numbered port that is free and on, else the first card that is free and on; if every free one is off, the first of them. A PC takes `eth0`, a switch its port 1, then port 2. Pasted cables keep the interfaces of the cables they were copied from.

To see or change an end, right click the cable and choose “Edit link”. The window is titled with the two devices, and under “Interfaces” has one list for each end, titled "Interface on" and the name of the device ("Interface on PC-1"). A card or port that another cable already uses is in the list and cannot be chosen; one that is switched off is marked. An end with no interface says “Not assigned”: that is a device with no free port or card, or with none at all.

What an end is attached to decides what the engine can check on it:

- a port that is off, or a card that is off, stops the packet there, and the reason names it;
- the VLAN of a port on a switch is the VLAN the packet is in on that cable ([VLANs](vlans.md));
- the address of a router port, and the gateway that goes with it, are checked against what the sender uses ([Addresses and gateways](addresses.md#gateway));
- the security zone of a firewall port decides which policy applies ([Firewall](../services/firewall.md#zones)).

An end that is **not attached** has none of this. The engine lets the packet through that end, skips the rules of the port, and writes a note on the answer: `link Router-Core–FW-Edge has no port binding on FW-Edge: per-port rules skipped`, or, when it is a router, that the gateway was not verified. The window says the same under the lists: “Port state, security zone and gateway are checked only on the ends assigned to an interface.” A project that is opened gives each end that has none the first free interface again, with the one exception below.

## On a firewall with zones {#firewall}

On a firewall whose ports carry security zones the end is never attached by itself. Picking a port there would be picking a policy: the port decides the zone, and the zone decides what the firewall lets through. So a cable to such a firewall is made with that end not attached, and you choose the port in “Edit link”, under "Interface on" and the name of the firewall. The terminal does the same: `connect` leaves the end open and says so.

Until the port is chosen the firewall cannot tell which zone the cable is in. In the company sample, take away the cable from FW-Edge to Router-Core and draw it again, and the trace through the firewall changes from the zone policy to a note:

```ncl sample=company
pixelcake> disconnect FW-Edge from Router-Core
disconnected FW-Edge ↔ Router-Core
pixelcake> connect FW-Edge to Router-Core
connected FW-Edge (unbound) ↔ Router-Core (port 4)
  FW-Edge has security zones, so the port of a new link is chosen by hand (right click on the link, Edit link, Interfaces): until then that end is not bound, per-port rules are skipped there
pixelcake> trace Customer-Portal from PC-Sales
Tracing route to Customer-Portal (172.16.0.10) from PC-Sales:
  1  ○ PC-Sales (PC)
  2  ○ SW-Offices (Switch)  — VLAN 10
  3  ○ SW-Core (Switch)  — VLAN 10
  4  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 4)
  5  ○ FW-Edge (Firewall)  — routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: no rule matches and no zone binding: allowed
  6  ○ SW-DMZ (Switch)
  7  ● Customer-Portal (Server)
  note: link Router-Core–FW-Edge has no port binding on FW-Edge: per-port rules skipped
  note: firewall FW-Edge: no rule matches and no zone binding: allowed
Trace complete: destination reached.
```

Before, the same trace read `no rule matches, zone policy trust → dmz allowed`. The commands are in [Devices and addresses](../terminal/devices-and-addresses.md#connect).

## Editing a link {#edit}

The same window, “Edit link”, sets how the cable looks:

- “Link type”: “None (default)”, or one of the types in Settings → Templates, which come as Access, Trunk, Uplink, Backbone and MPLS. A type gives the line its colour, its style (solid, dashed, dotted) and its thickness. “Colour preview” shows the result.
- “Bandwidth (e.g. 1 Gbps, 100 Mbps)”: a text, written on the cable.
- “Custom label”: another text, written under it. The samples use it for names such as `VLAN 10` and `Trunk 10, 20`.
- “Custom colour (optional)”: it overrides the colour of the type.

Press “Save” to keep the changes. **These four change what is drawn and nothing else.** The engine does not read the type, the bandwidth, the label or the colour: a cable labelled `VLAN 10` carries VLAN 10 only if the ports at its ends are in VLAN 10. [Templates](templates.md#built-in) says how to make a link type of your own.

## Limits {#limits}

> [!LIMITS]
> - A cable has no length, no speed and no failure of its own. "Bandwidth" is a label, and a packet takes the same time on every cable. A cable can be cut only in presentation mode, as a simulated failure.
> - Nothing stops a cable between two end devices, or from a device to itself. The engine follows what is drawn and then says why a packet cannot cross an end device.
> - A port can have one cable. A device with more cables than ports has the extra ends unattached.
