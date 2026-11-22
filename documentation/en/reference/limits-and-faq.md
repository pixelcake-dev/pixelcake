---
title: "Limits and questions"
description: "Everything PixelCake does not simulate, in one place, and answers to the questions people ask."
order: 5
---

PixelCake is a beta. It is good for exploring and explaining a small network, and it is not a tool to validate a real one: when it cannot verify something it says so in a note, but it cannot tell you what a real device would do beyond what is listed here. This page gathers what the app does not do. Each group names the page that explains the feature it belongs to.

## What is not simulated {#not-simulated}

**The packets.** PixelCake is not a packet-level simulator. There is no ARP and no MAC learning, so no table of addresses on a switch, and an address on two devices is found in the drawing, not in the traffic ([two devices with one address](../building/addresses.md#conflicts)). The time a ping prints is worked out from the cables and the devices of its path, with typical values: there is no bandwidth, no queue or congestion, no jitter and no loss ([the time of a ping](../asking/how-the-engine-decides.md#time)). The Internet is not simulated either: its symbol is a stand-in that carries public addresses, with a note, and refuses private ones as the Internet does; a Cloud symbol with any other name carries everything, with a note. How the engine reaches an answer is in [How the engine decides](../asking/how-the-engine-decides.md#not-simulated).

**Routing.** Routes are static. A router knows the networks it is attached to and the routes written on it; there is no dynamic routing. A backup route takes over only when the line is seen to be down, that is, when the interface of the main route has no working cable left (cut, the device at the other end down, or the port at the other end switched off): a next hop that dies behind a switch is not noticed, as with a plain static route on real hardware. A host has one gateway per network card and there is no gateway redundancy protocol. See [Routes](../services/routes.md#limits).

**Switching and VLANs.** Spanning tree is not simulated: a drawing with redundant links is walked without loops, and the shortest path that works is taken, but no port is blocked. Routing between VLANs needs a router or firewall port in each; router sub-interfaces (a "router on a stick") are not modelled. The untagged traffic of a trunk is always VLAN 1, with no native VLAN to choose. There is no VTP or GVRP, no voice VLAN, no private VLAN and no double tagging. See [VLANs](../building/vlans.md#limits).

**The firewall.** Rules know four services: ping, web, email and DNS. There are no port numbers, no connection states beyond "a firewall lets through the reply to a flow it allowed itself", and no inspection of the contents. A router filters by its rules too: it has no zones, and once it has a rule what no rule allows is blocked, as on real routers. A firewall with a rule does the same where it cannot tell the zone of a side, a cable not attached to a port or a port in no zone, as its zone policy cannot decide there. Its rules keep state as a firewall does, where a plain access list would need a rule for the replies. Traffic addressed to the firewall itself is not filtered. The `ips` flag of a port is documentation: it changes nothing. See [Firewall](../services/firewall.md#limits).

**NAT.** Translation is by service, not by port number: a port forward is "this service, arriving on this port", and two flows never compete for a translation. A server reached from the inside at its published address is not treated apart, and a device behind two layers of NAT is found by name only through the first. See [NAT](../services/nat.md#limits).

**DHCP.** A lease is worked out from the drawing, not negotiated: there are no lease times, no renewal and no reservations, and putting on DHCP a device drawn before the others moves the addresses of those after it. A server gives addresses to its own network only (no relay through a router), and a port of a router or a firewall cannot take its own address from DHCP. A simulated failure does not take an address away. See [DHCP](../services/dhcp.md#limits).

**DNS.** One server, asked every time. A card names one DNS server, with no second one to fall back on; a server answers only for the names written on it and never passes a question on; nothing is cached; there is no reverse lookup, no alias and no wildcard. A public DNS server that is not in the drawing is nobody. Names are for the terminal: the simulation panel and the presentation choose devices from menus. See [DNS](../services/dns.md#limits).

**Failures.** A failure belongs to a presentation and is gone when it ends: it is not saved with the project. The terminal sees the failures of the presentation but cannot make or repair one. See [Presentation](../asking/presentation.md#failures).

**Images.** An image is one board: a project with several boards is exported one board at a time. Its texts are set in the typeface of the computer, not in the one of the interface, which an image cannot carry along, so the same image on another computer can have slightly different letters. A PNG of a very large drawing is reduced to what the browser can paint, and the window says so. See [Exporting an image](../asking/exporting-an-image.md#limits).

**The project.** Undo goes back 100 steps on each board, and only while the page is open: a reload forgets them ([Undo and redo](../getting-started/interface.md#undo)). There are no accounts and no sharing: a project is a file on your disk, and two browser tabs open on the same project do not see each other's changes, the last one to write wins ([saving](../getting-started/saving-and-files.md#two-tabs)). The YAML format is PixelCake's own, and holds the network, its places and its areas, not the settings of the project. The Terraform export is a sketch that cannot be applied, and a Terraform state cannot be read ([YAML](yaml.md#limits)). The keyboard and the mouse have their own gaps ([shortcuts](shortcuts.md#board)).

## Questions {#faq}

**Can I use it to validate a real network?** No. It follows the rules above, and a real network has many more. It is for working out how a small network should behave, and for showing it to someone.

**Where is my work kept?** In the storage of the browser you are using, as you work: reload the page and it is still there. It is not on a server, and it does not follow you to another browser or computer, nor survive clearing the data of the site or closing a private window. To keep it, or to take it elsewhere, save the project to a file with File → Save ([the project file](project-file.md#format)).

**Does it work offline?** Once the page has loaded, yes: drawing, asking questions, the terminal and the exports all ran with the network cut. The only thing it may still ask the site for is a file of a typeface. It is not installed as an app and keeps no copy of itself for offline use, so to open it again without a connection the browser has to still hold the page.

**Does it send anything anywhere?** No. There is no server behind the app: it makes no requests of its own while you work, no analytics, and nothing of a project leaves the computer unless you save, export or copy it yourself. The typefaces and the icons are part of the app and are not fetched from anywhere. A link to the website, the repository or the documentation opens only when you click it.

**Is there an account?** No, and nothing to sign in to.

**What does it cost?** Nothing. It is free and open source ([licences](licences.md#app)).

**Can I use it at work?** Yes, the licence allows it. What you draw stays on your computer. Remember that its answers are not a validation of a real network.

**Can I undo?** Yes: Edit → “Undo” or Ctrl + Z, and Edit → “Redo” or Ctrl + Y. Each board keeps its last 100 steps while the page is open; what is and is not a step is in [Undo and redo](../getting-started/interface.md#undo). To go back further, or after a reload, save the project to a file before the change and open it again.

**Why does a ping stop at a switch?** The reason says. A switch stops a flow when the port it should leave by is down, when a cable is missing, or when the ports are in different VLANs: the answer names the port and the VLAN ([VLANs](../building/vlans.md#vlan-1)).

**Why does a firewall block what no rule of it mentions?** It has a rule, and it cannot tell the zone of one side: a cable is not attached to a port (on a firewall with zones a new cable never is, by itself), or the port is in no zone. Without both zones the zone policy cannot decide, so the list ends as a router's does: what no rule allows is blocked. The reason says which side, `the link is not attached to a port` or `port 2 is in no zone`, and the rules skipped for it: attach the cable in “Edit link”, or put the port in a zone ([Firewall](../services/firewall.md#zones)).

**Why is a device yellow, with `in conflict` under its address?** Another device has the same address, and the two can meet: a question to it, or from it, cannot be trusted. It happens after pasting a server, a router, a firewall or a switch, which keep the addresses of the original. Give one of the two another address ([two devices with one address](../building/addresses.md#conflicts)).

**Why does a device have no address?** A card on DHCP has none until a server on its network answers; the question about it says why: no server on its network, a range used up, a cable that is missing ([DHCP](../services/dhcp.md#no-address)).

**Why is the terminal in English when the interface is Italian?** The language of the terminal, NCL, is English in both languages: the commands, what they print and the reasons of the engine. The window around it is translated ([the terminal](../terminal/index.md#open)).

**How do I take a project to another computer?** Save it to a file there and open the file here: File → Open…. The file holds every board.

## Reporting a problem {#report}

Open an issue at [github.com/pixelcake-dev/pixelcake/issues](https://github.com/pixelcake-dev/pixelcake/issues): the welcome screen has a link to it, “Report a problem”. Say what you did, what you expected and what happened, in which browser, and add the project file if it is small, or the terminal commands that show it. Take care that a project file holds the names you gave to your devices and the notes you wrote: look at it before you attach it. You can also write to pixelcake.dev@gmail.com.

A security problem goes privately to the maintainer, not to a public issue: [SECURITY.md](https://github.com/pixelcake-dev/pixelcake/blob/main/SECURITY.md) says how.

## Contributing {#contributing}

Corrections to these pages, bug reports and reports of a wrong answer of the engine help the most. [CONTRIBUTING.md](https://github.com/pixelcake-dev/pixelcake/blob/main/CONTRIBUTING.md) says how to set up and what the checks expect. A pull request is accepted under the [Contributor Licence Agreement](https://github.com/pixelcake-dev/pixelcake/blob/main/CLA.md), accepted with a box in its description: you keep the copyright of what you write, and give the maintainer a licence to publish it in PixelCake, under the AGPL or under other licences.
