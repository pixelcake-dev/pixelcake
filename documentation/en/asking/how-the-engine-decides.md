---
title: "How the engine decides"
description: "The path of a packet hop by hop, at layer 3 and layer 2, the reasons it gives when it stops, and what is not simulated."
order: 2
---

> [!TODO]
> The page that explains every answer. Sources: README.md (How a packet is followed, What it does not do), ARCHITECTURE.md (Network Engine), docs/terminal-commands.md (How a packet is followed, Who forwards what, What is not verified).

## Hop by hop {#hop-by-hop}

> [!TODO]
> The walk: a decision at layer 3, a delivery at layer 2, again.

## At layer 3 {#layer-3}

> [!TODO]
> Routing table, firewall, NAT.

## At layer 2 {#layer-2}

> [!TODO]
> Switches, VLANs, ports that are down; the shortest path that works.

## Who forwards what {#who-forwards}

> [!TODO]
> The table of devices and what each does in transit.

## The reasons and the notes {#reasons}

> [!TODO]
> What stops a packet says where and why; what is not verified is a note, never a silent success.

## What is not simulated {#not-simulated}

> [!TODO]
> A [!LIMITS] box with the full list.
