---
title: "Your first network in five minutes"
description: "Three devices, two cables, an address each, and the first question: does the PC reach the server?"
order: 2
---

This page builds the smallest network that has something to say: a PC, a firewall and a server in a row, joined by two cables. You ask whether the PC reaches the server, and it does. Then you add a firewall rule, ask again, and read why it no longer does. Every step says what to click and what appears.

## Before you start {#before-you-start}

Open PixelCake in a browser, at [app.pixelcake.dev](https://app.pixelcake.dev). The welcome screen is over an empty board.

1. Click “New project”. A window asks for a name and for the network the new devices start from.
2. In “Project name” type `First network`. Leave the network as it is: “Network” 192.168.1.0, “Subnet mask” 255.255.255.0 and “Gateway” 192.168.1.1.
3. Click “Create project”. A notice at the bottom right says the project was created, and its name is in the middle of the menu bar.

If the welcome screen does not appear (you asked not to see it again), choose File → “New project…” instead.

## Draw three devices {#draw}

1. In the bar on the left click “Add device”, the button with a plus. The panel “Add” opens, with the list of device types.
2. Click “PC”. A window suggests the name PC-1 and an address, 192.168.1.2, with the mask 255.255.255.0 and the gateway 192.168.1.1. Click “Add”. PC-1 appears at the centre of the board.
3. Click “Server”, then “Add”. The window suggests Server-1 and 192.168.1.3.
4. Click “Firewall” (scroll the list if it is not in view), then “Add”. The window suggests Firewall-1 and 192.168.1.4.
5. Close the panel with the cross at its top right. Drag each device by its drawing to put them in a row: PC-1 on the left, Firewall-1 in the middle, Server-1 on the right.

The video shows this step and the next one, from the welcome screen to the second cable.

![A new project is created from the welcome screen. A PC, a server and a firewall are added from the panel on the left, put in a row, and joined by two cables, the PC to the firewall and the firewall to the server.](../../media/getting-started/first-network-draw.en.mp4 "From the welcome screen to three devices and two cables.")

## Connect them {#connect}

1. Move the pointer over the right edge of PC-1: the side under the pointer turns orange.
2. Press there and drag to Firewall-1, and let go over it. A cable is drawn between them.
3. Do the same from the right edge of Firewall-1 to Server-1.

At each end the cable takes a free port or network card: the card of PC-1 is connected to port 1 of Firewall-1, and the card of Server-1 to port 2. A cable can be dragged from any side of a device.

## Give them addresses {#configure}

The addresses are already there: when you added each device, the app suggested the first free address of the network of the project. Check one of them.

1. Right-click PC-1 and choose “Details (edit)”. A double click on the device does the same.
2. The “General” tab shows the name and the address: “IP address” 192.168.1.2, “Subnet mask” 255.255.255.0 and “Gateway” 192.168.1.1. Under them a line says that the card is connected to Firewall-1 (port 1).
3. Click “Cancel”. To change an address you would type the new one and click “Save”: nothing changes until you do.

All three devices have an address of 192.168.1.0/24, each a different one: it is written under each name on the board. That is what to check.

The gateway, 192.168.1.1, is not a device of this drawing, and it does not need to be. A gateway is where a device sends what is not for its own network. Everything here is one network, so the three devices reach each other directly and the gateway is never used. It matters as soon as a router joins a second network: see [The gateway](../building/addresses.md#gateway). The firewall has no address on its ports, so it passes the traffic between them as a bridge, and the rules written on it are applied all the same.

## Ask the first question {#ask}

1. Click “Simulation”, the button with the lightning bolt. A panel opens on the left.
2. The panel starts with PC-1 as “Source” and Server-1 as “Destination”, and “Ping (ICMP)” as “Traffic type”. If it shows others, choose these from the menus.
3. Click “Start simulation”. While the packet is on its way the button is red and reads “Stop simulation”. A light dot goes from PC-1 along the cable to Firewall-1, and on to Server-1.
4. When it gets there, the top of the drawing of Server-1 turns green, with a green frame. No message appears: green is the answer, the server replied.

The colours stay until the next question, until you change the drawing, or until you click an empty spot of the board.

![The Simulation panel. The window of PC-1 shows its address and the cable to port 1 of Firewall-1. A ping from PC-1 to Server-1 is started: the packet goes through the firewall, and Server-1 turns green.](../../media/getting-started/first-network-ask.en.mp4 "The address of PC-1, then a ping that arrives: Server-1 turns green.")

The terminal asks the same question: open “Console” and type `ping Server-1 from PC-1`. The answer there is a line of text, with the number of hops.

## Break it on purpose {#break-it}

A firewall with no rule lets this ping through. Write one that does not.

1. Right-click Firewall-1, choose “Details (edit)” and click the “Rules” tab. It says that there are no rules yet.
2. Click “Add rule”. A row appears, with “Action” Allow, “Service” Any, and “From” and “To” both `any`.
3. Choose “Deny” as the action and “Ping” as the service. Change “From” to `192.168.1.2` and “To” to `192.168.1.3`, the addresses of PC-1 and of Server-1.
4. Click “Save”. The tab now reads `Rules (1)`.
5. In the Simulation panel click “Start simulation” again.

This time the packet stops at Firewall-1. The firewall turns red, with a red frame, and a notice at the bottom right is titled `Ping simulation failed` and gives the reason:

```text
request: firewall Firewall-1: denied by rule 1 (deny ping from 192.168.1.2 to 192.168.1.3)
```

It names the device that stopped the packet, the rule and what the rule said. Every answer of PixelCake that is a no has that shape: where, and why.

![The window of Firewall-1 on its Rules tab: a rule that denies ping is added, from 192.168.1.2 to 192.168.1.3, and saved. The same ping from PC-1 now stops at Firewall-1, which turns red, and a notice gives the rule as the reason.](../../media/getting-started/first-network-break.en.mp4 "A rule that denies ping, and the same question stopped at the firewall.")

The same rule, written in the terminal on the same drawing:

```ncl fixture=getting-started-first-network
pixelcake> ping Server-1 from PC-1
Pinging Server-1 (192.168.1.3) from PC-1...
Reply from 192.168.1.3: hops=3 time=3ms
  note: request: firewall Firewall-1 has no zone binding: allowed
  note: reply: firewall Firewall-1 has no zone binding: allowed
pixelcake> add rule deny ping from PC-1 to Server-1 on Firewall-1
Firewall-1: rule 1 added — deny ping from 192.168.1.2 to 192.168.1.3
  PC-1 → 192.168.1.2
  Server-1 → 192.168.1.3
pixelcake> ping Server-1 from PC-1
Pinging Server-1 (192.168.1.3) from PC-1...
Ping failed (blocked): request: firewall Firewall-1: denied by rule 1 (deny ping from 192.168.1.2 to 192.168.1.3)
  dropped at: Firewall-1
```

The two notes under the first answer say that no port of the firewall is in a security zone, so only the rules decide. The reason of the second answer is the one the notice showed.

To undo it, open the Rules tab again and click the bin of the rule, which reads “Delete rule” when the pointer rests on it, then “Save”. The same question then arrives again.

## Where to go next {#next}

- Add a second network and a router, and see what the gateway is for: [Addresses](../building/addresses.md) and [Static and backup routes](../services/routes.md).
- Split a switch into VLANs: [VLANs](../building/vlans.md).
- Learn the commands of the terminal: [the terminal reference](../terminal/index.md).
- See a larger drawing at work: the sample networks, from Add → Samples, are described in [Sample networks](../reference/samples.md).
- Keep what you drew: [Saving, opening, files](saving-and-files.md). The window and its parts are named in [The interface](interface.md).
