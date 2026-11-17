---
title: "Firewall and NAT"
description: "The commands for the security zones and rules of a firewall, for source NAT and for port forwards."
order: 5
---

> [!TODO]
> A reference page: follow terminal/interfaces-and-vlans.md. Examples on the company sample (FW-Edge).

## interface … zone {#zone}

```text
interface <n> zone trust|untrust|dmz|none [on] <firewall>
```

> [!TODO]
> The zone of a firewall port.

## add rule {#add-rule}

```text
add rule [<position>] allow|deny [<service>|any] from <source> to <destination> [on] <firewall>
  allow may be written permit, deny block
```

> [!TODO]
> Position, action, service, source, destination; a device stored as its address.

## remove rule {#remove-rule}

```text
remove rule <n> [from] <firewall>
```

> [!TODO]
> By its number.

## Services {#services}

```text
ping   (also icmp)
web    (also http, https)
email  (also mail, smtp)
dns
any
```

> [!TODO]
> The four services and the names they also go by.

## interface … nat {#nat}

```text
interface <n> nat [on] <device>
interface <n> nat off [on] <device>
```

> [!TODO]
> Source NAT on a port.

## add forward {#add-forward}

```text
add forward [<service>|any] from [interface] <n> to <address> [on] <device>
```

> [!TODO]
> Service, the port it arrives on, the address inside.

## remove forward {#remove-forward}

```text
remove forward <n> [from] <device>
```

> [!TODO]
> By its number.
