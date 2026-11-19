---
title: "Bulk add"
description: "Many devices at once, with their ports, cards, names and addresses."
order: 8
---

“Bulk add” makes many devices in one go: three PCs and a switch, ten printers, a rack of servers. Each is made as it would be one at a time: the same name, address and ports. The difference is that you do not see each window.

## Opening the window {#open}

In the bar on the left press “Add device”, and in the panel “Add” choose “Bulk add”. The window “Add devices in bulk” opens, with a search field, a part for “Configurable devices” and a part for “Standard devices (1 network card by default)”. Type in the search field, “Search by type or ports…”, to find a kind or a number of ports in what the window lists. The window lists the generic templates, the ones under “Generic devices” in the settings, and not the ones made under “Custom devices” ([Templates](templates.md)).

## Rows and quantities {#rows}

![The window Add devices in bulk: a row for a Switch of 24 ports with quantity 1 is added, then the quantities of the PC and Server rows are raised to 3 and 2. The button reads Add (6). The window is closed, and six devices appear on the board in two rows of three, all selected.](../../media/bulk-add/bulk.en.mp4 "The window, then the grid of new devices.")

**Standard devices** are the kinds that have network cards: a PC, a server, a printer, an access point, a database. Each has a row with its name and a quantity. Type the number, or use “Increase” and “Decrease”. Every device of these rows gets one card, `eth0`.

**Configurable devices** are the ones with numbered ports: a switch, a router, a firewall. There is no fixed row for them. Press “Add Switch/Router/Firewall” and choose the kind: a row is added, with the kind, a list of the number of ports (a switch has 5, 8, 16, 24 or 48; a router or a firewall 2, 4, 8 or 16), and a quantity. Add a row for each combination you need, for instance one for 24-port switches and one for 8-port switches. “Delete row” takes a row away.

At the bottom, “Total devices:” counts them, and the button says how many it will make, as in "Add (6)". Nothing is made with a total of zero. “Cancel” closes the window and leaves the board as it was.

## What is made {#result}

Each device is made as in [Adding a device](devices.md#add):

- **Name.** The name of its template and the lowest free number, from 1: `PC-1`, `PC-2`, `PC-3` and `Switch-1`. A row of three gets the next three free names, and the devices of one batch never take the same one. Existing devices are not renamed.
- **Address.** For a device with a card, the next free address of the network of the project, one after the other (`192.168.1.3`, `.4`, …), with its mask, its gateway and, for an end device, its DNS server; and a MAC of its own. A router or a firewall has no gateway, and its ports no address: they are for whoever configures it. A switch has an address of its own.
- **Ports.** Plain ones, numbered from 1, on and at automatic speed: access ports on a switch, LAN ports on a router or a firewall. No VLAN, PoE, NAT or zone is set, so a switch made here forwards everything as it comes, and a firewall can be cabled to a port that is chosen later ([Cables and links](cables.md#firewall)).
- **Place.** In a grid of rows, as square as it can be (as many columns as rows, or one more), from the place where a single new device would go: the first free place of the part of the board you are looking at, from its top left. A place a device is on is skipped, so two batches do not pile up. If the new devices do not all fit on the screen, the view moves to show them.

The new devices are the selection afterwards, so the whole batch can be dragged where it belongs. A notice says how many were made, as in "6 devices added". Nothing is cabled: [Connecting what has no cable](layout-and-connection.md#connect) does that, and areas can be put around the batch with Edit → “Enclose in an area” ([Areas](areas.md#add)).

## Limits {#limits}

> [!LIMITS]
> - A batch is made from the generic templates, not the custom ones, and without a vendor, a location or a note of its own.
> - There is no address field: the addresses are the next free ones in order, and are changed one device at a time afterwards.
> - One window makes one batch. A wrong batch goes with Edit → “Undo” (Ctrl + Z), which takes it away whole, or with the Delete key, since it is selected already.
