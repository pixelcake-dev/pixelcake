---
title: "Routes"
description: "The commands that add and remove the static routes, default routes and backup routes of a router or a firewall."
order: 4
---

A route tells a router or a firewall where to send what is not on a network it is attached to. These commands write the same rows as the “Routes” tab of the window of the device, and `show routes` reads the whole table back ([Show commands](show.md#show-routes)). What a route is, and how the engine picks one, is in [Services and security](../services/routes.md).

A network is written as an address and a prefix, `192.168.30.0/24`, or as the word `default`, which stands for every network (`0.0.0.0/0`). The host bits of an address are dropped: `192.168.30.7/24` is the network `192.168.30.0/24`. The notation of the syntax blocks is explained in the [overview](index.md#conventions).

Routes belong to routers and firewalls. On any other device the commands refuse and point to `set gateway` ([Devices and addresses](devices-and-addresses.md#set)).

## add route {#add-route}

```text
add route <network>|default via <next hop> [on] <device>
```

Adds a static route: what is for `<network>` is sent to `<next hop>`.

| Parameter | What it is |
|---|---|
| `<network>` | A network, `192.168.30.0/24`, or `default` |
| `<next hop>` | The address of the next router, or the name of a device that has an address on a network of this one: the command then writes that address and says which (`Mail-01 → 192.168.20.20`) |
| `<device>` | The router or firewall the route is written on. Inside `use <device>` it is left out |

A route to a network that already has one does not add a second: its next hop is changed, and the answer says what it was. The same route again, with the next hop it already has, changes nothing, and the answer says so. A second route to the same network is a backup route ([below](#add-backup-route)). The command warns, and writes the route all the same, when the next hop is on none of the networks of the device: the route cannot be used until one of its ports has an address on the network of the next hop, and `show routes` marks it `✗ next hop on none of its networks`. A router whose ports have no address yet gets the same warning in a different form: its routes are not used until a port has one.

The route is written with the next hop as an address; the engine reads it at the next question. On a router the default route is also the “Gateway (default route)” of its window, and `set gateway` writes the same ([Devices and addresses](devices-and-addresses.md#set)).

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 from R-HQ
R-HQ: 2 routes to 192.168.2.0/24 removed
pixelcake> ping PC-Branch-1 from PC-HQ-1
Pinging PC-Branch-1 (192.168.2.11) from PC-HQ-1...
Ping failed (blocked): request: R-HQ has no route to 192.168.2.11
  dropped at: R-HQ
pixelcake> add route 192.168.2.0/24 via R-Branch on R-HQ
R-HQ: route to 192.168.2.0/24 via 10.0.0.2 added
  R-Branch → 10.0.0.2
pixelcake> show routes R-HQ
ROUTES of R-HQ
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
pixelcake> ping PC-Branch-1 from PC-HQ-1
Pinging PC-Branch-1 (192.168.2.11) from PC-HQ-1...
Reply from 192.168.2.11: hops=7 time=11ms
pixelcake> add route 192.168.2.0/24 via 10.0.1.2 on R-HQ
R-HQ: route to 192.168.2.0/24 now goes via 10.0.1.2 (was 10.0.0.2)
pixelcake> add route 192.168.2.0/24 via 10.0.0.2 on R-HQ
R-HQ: route to 192.168.2.0/24 now goes via 10.0.0.2 (was 10.0.1.2)
pixelcake> add route 192.168.2.0/24 via 10.0.0.2 on R-HQ
R-HQ: route to 192.168.2.0/24 via 10.0.0.2 is already there, nothing changed
```

A default route, and a route whose next hop is not where it should be:

```ncl sample=office
pixelcake> interface 3 ip 10.0.0.1/30 on Router-1
port 3 on Router-1: 10.0.0.1 / 255.255.255.252
pixelcake> add route 192.168.30.0/24 via 10.0.0.2 on Router-1
Router-1: route to 192.168.30.0/24 via 10.0.0.2 added
pixelcake> add route default via 10.0.0.2 on Router-1
Router-1: route to default via 10.0.0.2 added
pixelcake> add route 192.168.40.0/24 via 192.168.50.1 on Router-1
Router-1: route to 192.168.40.0/24 via 192.168.50.1 added
  warning: 192.168.50.1 is on none of the networks of Router-1: the route cannot be used yet
pixelcake> show routes Router-1
ROUTES of Router-1
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 3   connected
192.168.10.0/24      -                port 1   connected
192.168.20.0/24      -                port 2   connected
192.168.30.0/24      10.0.0.2         port 3   static
192.168.40.0/24      192.168.50.1     ?        static  ✗ next hop on none of its networks
default              10.0.0.2         port 3   default
```

## add backup route {#add-backup-route}

```text
add backup route <network>|default via <next hop> [on] <device>
```

Adds a second route to a network that already has one. It is used when the interface of the first route has no working link: a port switched off, a cable cut, or a failure simulated in a presentation. The same holds for two default routes. `show routes` marks it `backup`.

| Parameter | What it is |
|---|---|
| `<network>` | A network, or `default` |
| `<next hop>` | An address or a device, as for `add route`. It must differ from the next hop of the routes the network already has |
| `<device>` | The router or firewall |

If the network has no route yet, the command writes an ordinary route and says that there is nothing to back up. There is no `remove backup route`: a backup route is removed like any other, by its next hop ([below](#remove-route)).

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 via 10.0.1.2 from R-HQ
R-HQ: route to 192.168.2.0/24 via 10.0.1.2 removed
pixelcake> add backup route 192.168.2.0/24 via 10.0.1.2 on R-HQ
R-HQ: backup route to 192.168.2.0/24 via 10.0.1.2 added
  used when the interface of the route via 10.0.0.2 has no working link
pixelcake> add backup route 192.168.2.0/24 via 10.0.1.2 on R-HQ
R-HQ already has a route to 192.168.2.0/24 via 10.0.1.2
pixelcake> show routes R-HQ
ROUTES of R-HQ
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
pixelcake> interface 2 down on R-HQ
port 2 on R-HQ is now down
pixelcake> trace PC-Branch-1 from PC-HQ-1
Tracing route to PC-Branch-1 (192.168.2.11) from PC-HQ-1:
  1  ○ PC-HQ-1 (PC)
  2  ○ SW-Floor-1 (Switch)
  3  ○ SW-Core (Switch)
  4  ○ R-HQ (Router)  — routed: 192.168.2.0/24 via 10.0.1.2 (port 3)
  5  ○ R-Backup (Router)  — routed: 192.168.2.0/24 via 10.0.2.2 (port 2)
  6  ○ R-Branch (Router)  — routed: 192.168.2.0/24 is on port 1
  7  ○ SW-Branch (Switch)
  8  ● PC-Branch-1 (PC)
Trace complete: destination reached.
pixelcake> add backup route 192.168.9.0/24 via 10.0.1.2 on R-HQ
R-HQ: route to 192.168.9.0/24 via 10.0.1.2 added
  it is the only route to 192.168.9.0/24: there is nothing to back up yet
```

## remove route {#remove-route}

```text
remove route <network>|default [via <next hop>] [from] <device>
delete route <network>|default [via <next hop>] [from] <device>
```

Removes the routes to a network. Without `via` every route to that network goes, the backup ones too; with it, only the one through that next hop. `delete` is the same as `remove`.

| Parameter | What it is |
|---|---|
| `<network>` | A network, or `default` |
| `<next hop>` | The address of the next hop of the route to remove. A device name is not read here: write its address |
| `<device>` | The router or firewall. After the command `on` may be written in place of `from` |

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 via 10.0.1.2 from R-HQ
R-HQ: route to 192.168.2.0/24 via 10.0.1.2 removed
pixelcake> show routes R-HQ
ROUTES of R-HQ
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
pixelcake> remove route 192.168.2.0/24 via 10.0.1.2 from R-HQ
R-HQ has no route to 192.168.2.0/24 via 10.0.1.2
pixelcake> delete route 192.168.2.0/24 on R-HQ
R-HQ: route to 192.168.2.0/24 removed
pixelcake> delete route 192.168.2.0/24 on R-HQ
R-HQ has no route to 192.168.2.0/24
```

## When a command is refused {#refusals}

A command that cannot be done changes nothing, and says why, or what it should have been:

```ncl sample=office
pixelcake> add route servers via 10.0.0.2 on Router-1
"servers" is not a network: write it as 192.168.30.0/24, or "default"
pixelcake> add route 192.168.30.0/24 via Nobody on Router-1
"Nobody" is not an address, nor a device on the canvas
pixelcake> add route 192.168.30.0/24 via PC-1 on SW-Office
SW-Office is a Switch: routes belong on routers and firewalls
  an end device has one way out, its gateway: set gateway of SW-Office to <address>
pixelcake> add route 192.168.30.0/24 via 10.0.0.2 on PC-1
PC-1 is a PC: routes belong on routers and firewalls
  an end device has one way out, its gateway: set gateway of PC-1 to <address>
pixelcake> add route 192.168.30.0/24 10.0.0.2 on Router-1
unknown command: "add route 192.168.30.0/24 10.0.0.2 on Router-1"
  try: add route <network>|default via <next hop> [on <device>]
  type "help" for the command list
pixelcake> add route 192.168.30.0/24 via 10.0.0.2
specify a device: "add route 192.168.30.0/24 via 10.0.0.2 on <device>"
pixelcake> remove route 192.168.30.0/24 from Router-1
Router-1 has no route to 192.168.30.0/24
pixelcake> remove backup route 192.168.30.0/24 from Router-1
unknown command: "remove backup route 192.168.30.0/24 from Router-1"
  try: remove route <network>|default via <next hop> [from <device>]
  type "help" for the command list
```

## See also {#see-also}

- [Routes](../services/routes.md): the routing table, the default route, backup routes, and what the engine does not do.
- [Show commands](show.md#show-routes): `show routes`.
- [Interfaces and VLANs](interfaces-and-vlans.md#ip): the address of a port, which makes its network reachable without a route.
- [The terminal while presenting](../asking/presentation.md#terminal): failures simulated in a presentation, and the backup route that answers them.
