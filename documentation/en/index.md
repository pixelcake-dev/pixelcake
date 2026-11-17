---
title: PixelCake documentation
description: How to draw a network in PixelCake, configure it, and ask it whether one device reaches another, with the reference of its terminal and of its files.
---

PixelCake is a designer for small networks that runs in the browser. You draw the network, configure it, then ask it a question: does this PC reach that server? If it does not, the answer says where the packet stops, and why. These pages explain every part of it.

![Three devices are added from the panel on the left, a PC, a server and a firewall, and joined by two cables. In the terminal a ping from the PC reaches the server; a rule added to the firewall denies the ping, and the same ping then stops at the firewall, with the rule that stopped it.](../media/home/firewall-ping.en.mp4 "Three devices, two cables, a question, then a firewall rule that changes the answer.")

## Where to start {#start}

- **New to PixelCake?** Read [What PixelCake is](getting-started/what-is-pixelcake.md), then draw [your first network in five minutes](getting-started/first-network.md).
- **Looking for a command of the terminal?** The [terminal reference](terminal/index.md) has every command, with examples. Or press `/` and search.
- **Wondering why an answer is what it is?** Read [how the engine decides](asking/how-the-engine-decides.md).

## The sections {#sections}

- [Getting started](getting-started/what-is-pixelcake.md): what the app is, a first network, the interface, languages and themes, saving and opening files.
- [Building a network](building/devices.md): devices, ports and network cards, cables, addresses, VLANs, areas, notes, bulk add, automatic layout, templates.
- [Services and security](services/routes.md): static and backup routes, firewall zones and rules, NAT and port forwards, DHCP, DNS.
- [Asking the network](asking/simulation-panel.md): the simulation panel, how the engine decides, presentation mode and simulated failures, exporting an image.
- [Terminal reference (NCL)](terminal/index.md): the commands of the terminal, group by group, and the grammar of its language.
- [Reference](reference/project-file.md): the project file, YAML, the keyboard and the mouse, the sample networks, limits and questions, licences, what changed.

## About these pages {#about}

Every terminal example on these pages is run by the tests of PixelCake, on the sample network it names, and prints exactly what is shown here: when the app changes, the pages that no longer match fail before they are published. What the app does not simulate is said where it matters, in a box of its own.

The documentation is open source, as the app is: each page links to its source at the bottom.
