---
title: "Automatic layout and connection"
description: "Lay the drawing out again from the network, and give a cable to every device that has none."
order: 9
---

Two entries of the View menu work on the whole drawing. “Auto-layout” moves every device to a place that follows the network, and “Connect devices with no cable” gives a cable to each device that has none. Neither changes an address, a VLAN or a setting of a port.

## Automatic layout {#layout}

![The site sample network is laid out horizontally, then vertically. The question Lay the drawing out again? appears each time, and its areas, Internet, DMZ and Internal network, move together with their devices.](../../media/layout-and-connection/layout.en.mp4 "View → Auto-layout → Horizontal, then Vertical, on the site sample. The areas follow their devices.")

Choose View → “Auto-layout” and then “Vertical” or “Horizontal”. PixelCake asks first, “Lay the drawing out again?”, because every device is moved. Press “Lay out” to go on, or “Cancel”. When it is done the whole drawing is brought into view. Edit → “Undo”, or Ctrl + Z, puts every device back where it was, in one step.

The layout reads the network and not how the drawing was made:

- **The top.** In each group of devices cabled together, the top is where its traffic leaves the network: the Internet (any Cloud); when there is none, the firewalls; then the routers; then the switch with the most cables.
- **The levels.** A device is one level lower for each cable between it and the top, and every cable is laid from its upper end down, whichever end it was drawn from. Two devices of one level that are cabled together stand side by side. Horizontal is the same with the levels from left to right.
- **The areas.** Each area is laid out with the devices drawn inside it, and drawn again around them with the room that “Enclose in an area” leaves ([Areas](areas.md#add)). An area inside another stays inside it, and an area that is hidden is moved too. Areas with nothing in them, and devices with no cable and no area, are put in rows under the rest.
- **The room.** Names and addresses have room, vertically and horizontally: no name over another, no label of a cable on a device or on the border of an area, and three cables between two devices keep their labels apart.

The layout does the same for the same drawing, and it is worked out in steps, so that the page does not freeze while it runs.

## Large drawings {#large}

A drawing laid out plainly can be wider than the board can show at its lowest zoom. The multinational sample, 181 devices on ten sites, would be about 18,000 units across. When that happens the layout stacks the devices that hang from one device alone in two columns beside it, so that the drawing is narrower and the whole of it can be seen at once, vertically and horizontally. On the multinational it takes a few seconds, and the page stays usable while it runs.

You do not choose this: it is what the layout does when the drawing is that large.

## Connecting what has no cable {#connect}

View → “Connect devices with no cable” gives a cable to each device that has none, and touches nothing else: no cable that is there is moved, and none is given a name. It needs two devices at least. Where it puts a cable:

1. **An end device** goes to the nearest **switch of its network**, on a free port meant for it: a port in the VLAN of the device, or with nothing set on it. An access point is cabled first, so that its first card stays its cable. A server goes first to a load balancer of its network that has servers of its kind behind it and a card free.
2. **A laptop, a smartphone or a tablet** goes first to the nearest access point of its network that has a card free, and to a switch otherwise.
3. **A group of devices cabled together with no router, firewall or Internet in it** gets one cable up: from its switch nearest to a router, a firewall or a core switch (a switch cabled to a router or a firewall) of its network, to that device. On a router or a firewall the port is one with an address in the network of the switch, or with none. One cable for the whole group: it never closes a loop.

A network is told by the addresses, with their masks, and by the VLANs: a VLAN is the network of a group of switches cabled together, and the same number on another site may be another network. A device on DHCP may be on any network, and goes by distance. A device goes to a switch of its own area (its site) before one of another; a port named after a device is kept for that device ([Ports and network cards](ports-and-cards.md#ports)); and a cable ends on the side where the cable of its nearest neighbour does, so that in a stack it goes down into the line the others share.

When it has finished a notice says how many cables were added (“Every device already has its cable” when there was nothing to do, “No cable added” when nothing could be), and which devices were left alone and why.

## Who is left alone, and why {#left-alone}

The notice names the devices that still have no cable, with the reason after each name, for example `PC-7, PC-8: no switch on the same network.` The four reasons:

| The notice says | It means |
|---|---|
| “no switch on the same network” | An end device has no switch, and no access point, whose network it shares |
| “no router, firewall or core switch on the same network” | A group of switches or devices has nowhere to go up to |
| “no free port” | Where it could go, no port is free for it, or the device has none of its own |
| “routers, firewalls and the Internet are cabled by hand” | These are never cabled automatically |

Never cabled automatically: routers and firewalls between themselves, the Internet, and end devices between themselves. A firewall whose ports carry zones gets its cable with that end not attached: the port, and with it the zone, is yours to choose ([Cables and links](cables.md#firewall)). Draw these cables by hand, or fix the address, the VLAN or the free port that was in the way, and run it again.

## Limits {#limits}

> [!LIMITS]
> - The layout is a good guess at where a network engineer would put the devices, not a promise: it follows the cables and the areas, and knows nothing of racks, floors or distances.
> - The automatic connection chooses by address, VLAN and distance. It does not know what you meant: check the cables it made, in the window of a device or with `show connections`.
