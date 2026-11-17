---
title: "DHCP e DNS"
description: "I comandi che mettono una scheda in DHCP, danno a un'interfaccia un intervallo di indirizzi da assegnare, indicano un server DNS e ne tengono i record."
order: 6
---

> [!TODO]
> Una pagina di riferimento: seguire terminal/interfaces-and-vlans.md. Le sessioni DHCP e DNS di docs/terminal-commands.md sono già eseguite dai test e si possono spostare qui, divise per comando.

## interface … dhcp {#dhcp-client}

```text
interface <name> dhcp [on] <device>
interface <name> dhcp off [on] <device>
```

> [!TODO]
> Una scheda prende l'indirizzo dal DHCP; dhcp off.

## interface … pool {#pool}

```text
interface <id> [dhcp] pool <first> to <last> [gateway <address>] [dns <address>] [on] <device>
interface <id> pool none [on] <device>
```

> [!TODO]
> L'intervallo che un'interfaccia assegna, con gateway e server DNS; pool none.

## interface … dns {#dns-server}

```text
interface <name> dns <address>|none [on] <device>
```

> [!TODO]
> Il server DNS che una scheda interroga.

## add record {#add-record}

```text
add record <name> [to] <address> [on] <server>
```

> [!TODO]
> Un nome e il suo indirizzo, su un server.

## remove record {#remove-record}

```text
remove record <n>|<name> [from] <server>
```

> [!TODO]
> Per numero o per nome.
