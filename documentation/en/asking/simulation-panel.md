---
title: "The simulation panel"
description: "From, to, what: ask whether one device reaches another, and watch the packet go."
order: 1
---

The simulation panel asks the network one question: can this device reach that one, with this kind of traffic? A packet travels along the cables of the board, and when it gets to the end of its way the device that answers turns green, or the device where it stops turns red. The panel is the quickest way to try a drawing while you build it; to show a network to other people, [presentation mode](presentation.md) asks the same questions with more on screen.

![A board with ten devices, the Site sample. In the Simulation panel, Source is PC-Office-1 and Destination is Srv-Internal, with the traffic type Ping. Start simulation is pressed: the packet travels from the PC to the server and back, and the server turns green. Then the source is changed to Web-Public: the packet goes as far as the firewall FW-Edge, which turns red, and a notice gives the reason.](../../media/simulation-panel/ask.en.mp4 "Two pings from the simulation panel on the Site sample: the first arrives, the second is stopped by the firewall.")

## Asking {#ask}

Press the button “Simulation” in the bar on the left. The panel opens with three fields and a button.

1. **“Source”**: the device the packet starts from.
2. **“Destination”**: the device it is for.
3. **“Traffic type”**: what kind of traffic it is, see [below](#traffic).
4. Press **“Start simulation”**.

“Source” and “Destination” are lists you can search: open one, type a part of a name or of an address, and press the device. Each entry shows the name and the address, as in `PC-Office-1 (192.168.10.11)`; for a device that takes its address from DHCP, the one it is leased. The list is in alphabetical order.

You do not start from an empty form. The panel proposes a question: from the first PC of the drawing to the first server (a database counts), or, in a drawing without them, the first two devices. It proposes again when the device you had chosen is no longer on the board, as when another drawing is opened.

While the packet travels the button reads **“Stop simulation”**: pressing it stops the packet where it is, and leaves no answer. A new question can be asked when the packet has arrived, or when it has been stopped.

The button is dimmed, and the panel says “The board needs at least two devices.”, until there are two devices. If both fields name the same device, a ping is answered by the device itself, as a real one answers its own address: no packet travels, the device turns green at once, and a notice says that it answers itself. A web page, a download or an email needs two devices: for them a notice says “The source and the destination cannot be the same device”.

The pace of the packet is the one set in presentation mode (“Slow”, “Normal”, “Fast”, in the bar at the top). It is normal until you change it, and it goes back to normal when the page is loaded again.

## Kinds of traffic {#traffic}

“Traffic type” has four choices. Each is made of one or two packets, and the packet you see goes through all of them, one after the other.

| Choice | What it is made of |
|---|---|
| “Ping (ICMP)” | a request from the source to the destination, then the reply back |
| “Web page (HTTP)” | the request for a page, then the page that comes back |
| “File download (FTP)” | the request for a file, then the file that comes back; a firewall treats it as web traffic |
| “Email message (SMTP)” | the message from the source to a mail server, then from the mail server to the destination; there is no reply |

A reply is a packet of its own: it is followed only if the request arrived, and it may take another way back. A firewall lets it through because it answers a flow that was allowed. How each leg is followed, and which mail server or internet exit an email goes through, is in [flows](how-the-engine-decides.md#flows).

Which way an email goes is chosen in Settings → Network, group “Simulation”, field “Email mode (SMTP)”: “Internal mail server”, “Cloud (M365, Gmail…)”, where the message goes out to the Internet, or “Auto (detect automatically)”, which uses a mail server if the drawing has one and the way out to the Internet if it has not.

## The answer {#answer}

The answer is on the board, in three ways.

- **The packet.** A dot travels from the source along the cables, device by device, as far as the engine follows it. For a ping it goes to the destination and comes back; for an email it stops at the recipient.
- **The lamp.** When the packet has got to the end of its way, one device says how the question ended: the device that answers turns **green**, or the device where the question stops turns **red**. The one that answers is the destination.
- **The reason.** When the question does not arrive, a notice says so. Its title names the kind of traffic (`Ping simulation failed`; in the Italian interface, `Simulazione Ping fallita`), and under it the reason, as the engine gives it: `request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied`. It begins with the leg that failed and names the device, the port, the route or the rule. The reasons are in English in both languages; [the reasons and the notes](how-the-engine-decides.md#reasons) explains how to read them.

A packet that stops does not disappear at once: it travels as far as the device that drops it and stays there, and that device is the one that turns red.

Two cases leave no packet. A question that stops on the sender itself, because it is down or has no way out, turns the sender red and says why, with no packet. A question that cannot even be tried, because a device has no address or no cable joins the two, gives the notice and no lamp.

A question that arrives gives no notice. Only the lamp and the packet say so. To see the whole way, hop by hop, with what each device did, use `trace` in the [terminal](../terminal/asking.md#trace), or the “Path” of [presentation mode](presentation.md#ask).

## What stays on the board {#afterwards}

The lamp stays when the packet has gone. The green or the red device keeps it until:

- you ask another question, or stop the one that is running;
- the devices or the cables change, because the answer was about the drawing as it was;
- you press the empty board.

The answer is not saved with the project. It is part of the picture if you [export the image](exporting-an-image.md#choices) while it is there. The questions asked from the terminal (`ping`, `trace`, `browse`, `mail`, `download`) leave the same lamp.

## Limits {#limits}

> [!LIMITS]
> - The panel shows the reason of a stop, and nothing of the notes of an answer that arrives (a firewall that allowed, a backup route taken, an address translated). They are in the terminal and in presentation mode.
> - Devices are chosen from the lists, never by name or address typed into a field: a name that DNS would resolve is a question for the terminal.
> - One question at a time, and one packet on the board.
> - “File download (FTP)” is a request and a reply like a web page: there is no file, no size and no transfer time.
