---
title: "Presentation and simulated failures"
description: "A mode for showing a network to others: two clicks ask a question, a third breaks a device or a cable, and the panel counts what stops."
order: 3
---

Presentation mode is for showing a network to other people. The tools for building are put away, the drawing fills the window, and a panel on the left answers questions: does this device reach that one, and what happens if this one breaks? Two clicks ask a question. A third takes a device or a cable out, and the panel says what stops working, what takes another path, and what does not change.

Nothing in the drawing changes while you present, and nothing is saved: a device that is down is still there, and a cable that is cut is still drawn. The engine is only told, for the length of the presentation, that they carry nothing.

![The two-sites sample in presentation mode. A PC of the head office asks whether it reaches a PC of the branch: the packet crosses the main line and the answer is Arrives. The main line is cut: the packet takes the backup line through R-Backup, the answer is Arrives by another path, and the panel counts 12 exchanges that take another path and none that stop. R-Backup is taken down too: the packet stops at R-HQ, the answer is Does not arrive, and the panel counts 12 exchanges that stop.](../../media/presentation/failure.en.mp4 "The two-sites sample: a question, the main line cut, then the backup router taken down.")

## Entering and leaving {#enter}

Press **“Present”** in the menu bar, or choose View → “Presentation mode”. On an empty board nothing opens, and a notice says “The board is empty: there is nothing to present”.

On entering, the selection is let go, the right-click menu is closed and a packet that was travelling is stopped; the drawing is fitted to the window. The menu bar becomes a bar with:

- the badge **“Presentation”** and the name of the project;
- the boards of the project, in “Project boards”, when it has more than one. Changing board forgets the question and the failures, because they belonged to the other;
- **“Packet speed”**: “Slow”, “Normal”, “Fast”;
- **“Annotation mode”**, to [write over the drawing](#annotations), with a small number when annotations are hidden, then **“Terminal”**, **“Export image”** and **“Full screen”**;
- the language and the theme, as in the menu bar;
- **“Exit”**.

To leave, press “Exit” or Esc. Esc first closes the small menu if one is open, or leaves annotation mode if it is on; it does nothing while you are typing in a field or a window is open. Leaving forgets the question and every simulated failure, and leaves full screen.

Areas are shown, and cannot be edited. Double-clicking a device does not open its window: nothing here edits the drawing.

The panel on the left has four parts: “Question”, “Answer”, “Simulated failures” and, when there is an answer, “Path”. “Close the panel” gives the whole window to the drawing, and “Open the panel” brings it back; closed, it goes on working.

## Asking a question {#ask}

Click a device. A small menu opens at the pointer, with the name and the address of the device and three entries.

1. Choose **“Start here”** on the device the question starts from.
2. Click another device and choose **“Arrive here”**.

The right button opens the same menu. The question is asked as soon as both ends are chosen: the packet is sent, and the answer is written in the panel. The two ends are marked on the drawing with `FROM` and `TO`.

You can also choose the ends in the panel, with “From” and “To”; “Swap source and destination” turns the question round. Choosing the other end as the start turns it round by itself. Under them, **“Traffic type”** has three choices: “Ping”, “Web” and “Email”. A download is not offered here, and a web page is the same traffic for a firewall. “Ping” is a question and its answer, “Web” the request for a page and the page that comes back, “Email” a message from the sender to the mail server and from the server to the recipient. How each is followed is in [flows](how-the-engine-decides.md#flows).

The packet is sent again whenever the question or a failure changes, and “Show again” plays it once more. While it travels, the button reads “Stop”.

**“Answer”** says how it ends, in a word, a sentence, and the reason when it does not arrive:

- **“Arrives”**: `PC-Branch-1 replies to PC-HQ-1.`
- **“Does not arrive”**: `It stops at R-HQ (request).`, or `It does not even leave PC-HQ-1 (request).`, and under it, in a box, the reason as the engine gives it, in English: `link R-HQ–R-Branch is down`. The device where it stops is outlined in red on the drawing. When no chain of cables joins the two devices the sentence is `No path of cables joins the two devices.`
- **“Cannot be tested”**: something is missing to run the test, for instance an address.

When failures are in force, the panel also says what the same question would have given with nothing broken: “It still arrives, by another path.” or “Without the failures it would arrive.”

**“Path”** follows the packet hop by hop, one block for each leg, with what each device did, and the notes of the engine under them: a firewall that allowed, an address translated, a backup route taken. A reply that comes back the way the request went is folded in one line, and opens on a click. While the packet travels, the step it is at is marked.

## Simulating a failure {#failures}

Click a device, or a cable, and choose **“Simulate a failure”**. The device or the cable is marked on the drawing, and listed under “Simulated failures”. The answer, if there is a question, is worked out again and the packet is sent again.

Any device can be taken down, a switch as well as a PC, and any cable cut; several at once. A failed device sends and takes nothing; a cut cable carries nothing. The engine takes another way when the drawing offers one, and a router leaves a route that has no working cable left for the next one: [simulated failures](how-the-engine-decides.md#failures) and [backup routes](../services/routes.md#backup).

To repair, choose “Repair” on the same device, or “Repair the cable” on the same cable; or press the failure in the list (its tooltip is “Repair”); or press **“Repair all”**.

A failure is only a list the presentation keeps. It is not saved, it does not touch the drawing or the file, and it is gone when you leave. If a device or a cable it names is removed meanwhile, for instance from the terminal, it is forgotten.

## What it does to the rest {#impact}

As soon as something is broken, the panel works out what it does to the rest of the network, under **“On the rest of the network”**. The engine takes every exchange between two end devices (PCs, servers and the like, and the Internet or Cloud symbols that have an address), asks it with nothing broken and again with the failures, and compares:

- **it stops**: it worked, and it no longer does, with the reason;
- **it takes another path**: it still works, through other devices or other cables;
- **it does not change**: it works exactly as before.

An exchange that did not work to begin with is not counted, because a failure cannot break it. Exchanges are counted one way each: A to B and B to A are two, because a firewall may let one through and not the other.

The panel writes it as a sentence, "Ping between the 5 end devices: 20 exchanges that work without the failures.", and then "None of them stop", "12 stop", "12 take another path", "8 do not change". Under "stop" and "take another path", each source is written with its destinations as buttons: press one to ask that exchange, and see its path and its reason. A long list shows a few and “Show all”.

The kind of exchange counted is the one chosen in the question, “Ping”, “Web” or “Email”: change it to count another. A big drawing takes a moment, and the panel says “Working out the effect on the rest of the network…”. With fewer than two end devices that have an address it says “Measuring the effect takes at least two end devices (PCs, servers…) with an address.”.

The engine takes the shortest path that works. Spanning tree and similar protocols are not simulated, so a path that "takes another path" is the shortest one the cables allow, not the one a real switch would have chosen.

## Writing over the drawing {#annotations}

[Annotation mode](../building/annotations.md) works while you present too, on the same sheet as when you build. The presentation starts with it off and the drawing clean. Press “Annotation mode” on the bar, or A, and the annotations written beforehand appear; write over the drawing while you break a switch or cut a link: a circle around what stops, an arrow, a word. What you write stays on the board, saved with it, until you erase it. Turn the mode off and they are out of sight again; the button says how many are hidden.

While the mode is on, a click writes instead of opening the menu of a device. Turn it off (A, Esc or its button) to ask a question or to break something, and on again to write. With the mode on, the first Esc leaves it and the second leaves the presentation.

Undo does not work while presenting, as for everything else: what was written during the presentation is taken back with Ctrl + Z after leaving it, or erased with the eraser.

## The terminal while presenting {#terminal}

The bar has the **“Terminal”**. While the presentation lasts, the commands that ask a question (`ping`, `trace`, `browse`, `mail`, `download`, `resolve`) see the same failures as the panel: a trace stops with `link R-HQ–R-Branch is down`, and a name is looked up across the network as it is with the pieces you broke. The two always agree, because they ask the same engine ([how it decides](how-the-engine-decides.md)).

The failures themselves cannot be made from the terminal. They are made with the small menu, and are gone when you leave.

## Limits {#limits}

> [!LIMITS]
> - Failures are not saved and are not part of the file. Leaving presentation mode, or changing board, forgets them.
> - Three kinds of exchange: ping, web and email. Not download.
> - A failure is all or nothing: a device is down or up, a cable cut or whole. There is no slow line, partial loss, or port that fails alone.
> - A route whose next hop dies behind a switch is not withdrawn: see [what is not simulated](how-the-engine-decides.md#not-simulated).
> - A DHCP lease does not change when a device fails: it keeps the address it had, even when its DHCP server is down.
