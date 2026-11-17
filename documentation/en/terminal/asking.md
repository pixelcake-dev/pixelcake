---
title: "Asking: ping, trace and the others"
description: "The commands that ask the network a question and follow the answer on the board: ping, trace, browse, mail, download, resolve."
order: 7
---

> [!TODO]
> A reference page: follow terminal/interfaces-and-vlans.md. Show both a success and a failure for each.

## ping {#ping}

```text
ping <target> [from <device>]
```

> [!TODO]
> Request and reply, both ways.

## trace {#trace}

```text
trace <target> [from <device>] [as ping|web|email|dns]
traceroute <target> [from <device>]
tracert <target> [from <device>]
```

> [!TODO]
> One way, hop by hop, with what each device did; as <service>.

## browse {#browse}

```text
browse <target> [from <device>]
web <target> [from <device>]
curl <target> [from <device>]
```

> [!TODO]
> A whole web exchange.

## mail {#mail}

```text
mail <target> [from <device>]
email <target> [from <device>]
```

> [!TODO]
> An email through its relay; the email mode of the project.

## download {#download}

```text
download <target> [from <device>]
wget <target> [from <device>]
```

> [!TODO]
> Request, then the data.

## resolve {#resolve}

```text
resolve <name> [from <device>]
lookup <name> [from <device>]
nslookup <name> [from <device>]
```

> [!TODO]
> A DNS lookup alone.

## Targets {#targets}

> [!TODO]
> A device, an address (the one aimed at), a host name looked up first; behind NAT.
