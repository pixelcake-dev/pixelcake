---
title: "Routes"
description: "The commands that add and remove the static routes, default routes and backup routes of a router or a firewall."
order: 4
---

> [!TODO]
> A reference page: follow terminal/interfaces-and-vlans.md. Examples on the two-sites sample.

## add route {#add-route}

```text
add route <network>|default via <next hop> [on] <device>
```

> [!TODO]
> Network or default, next hop as an address or a device; replacing.

## add backup route {#add-backup-route}

```text
add backup route <network>|default via <next hop> [on] <device>
```

> [!TODO]
> A second route to a network that has one.

## remove route {#remove-route}

```text
remove route <network>|default [via <next hop>] [from] <device>
delete route <network>|default [via <next hop>] [from] <device>
```

> [!TODO]
> Every route to a network, or the one through a next hop; delete as an alias.
