---
title: "DHCP and DNS"
description: "The commands that put a card on DHCP, give an interface a range of addresses to hand out, name a DNS server and keep the records of one."
order: 6
---

> [!TODO]
> A reference page: follow terminal/interfaces-and-vlans.md. The DHCP and DNS sessions of docs/terminal-commands.md are already run by the tests and can be moved here, split by command.

## interface … dhcp {#dhcp-client}

```text
interface <name> dhcp [on] <device>
interface <name> dhcp off [on] <device>
```

> [!TODO]
> A card takes its address from DHCP; dhcp off.

## interface … pool {#pool}

```text
interface <id> [dhcp] pool <first> to <last> [gateway <address>] [dns <address>] [on] <device>
interface <id> pool none [on] <device>
```

> [!TODO]
> The range an interface hands out, with gateway and DNS server; pool none.

## interface … dns {#dns-server}

```text
interface <name> dns <address>|none [on] <device>
```

> [!TODO]
> The DNS server a card asks.

## add record {#add-record}

```text
add record <name> [to] <address> [on] <server>
```

> [!TODO]
> A name and its address, on a server.

## remove record {#remove-record}

```text
remove record <n>|<name> [from] <server>
```

> [!TODO]
> By number or by name.
