---
title: "Devices and addresses"
description: "The commands that change the address, mask, gateway and name of a device, and that add or remove a cable."
order: 2
---

> [!TODO]
> A reference page: follow terminal/interfaces-and-vlans.md (syntax, parameters, aliases, examples with real output).

## set {#set}

```text
set ip [of] <device> [to] <address>
set gateway [of] <device> [to] <address>
set subnet [of] <device> [to] <mask>
set name [of] <device> [to] <new name>
```

> [!TODO]
> ip, gateway, subnet, name; on a device with cards, the first card; on a router, the default route.

## connect, disconnect {#connect}

```text
connect <device> [to] <device>
disconnect <device> [from] <device>
```

> [!TODO]
> The first free interface at each end; a firewall with zones.
