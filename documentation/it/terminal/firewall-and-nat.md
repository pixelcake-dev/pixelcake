---
title: "Firewall e NAT"
description: "I comandi per le zone di sicurezza e le regole di un firewall, per il NAT in uscita e per gli inoltri."
order: 5
---

> [!TODO]
> Una pagina di riferimento: seguire terminal/interfaces-and-vlans.md. Esempi sulla rete dell'azienda (FW-Edge).

## interface … zone {#zone}

```text
interface <n> zone trust|untrust|dmz|none [on] <firewall>
```

> [!TODO]
> La zona di una porta del firewall.

## add rule {#add-rule}

```text
add rule [<position>] allow|deny [<service>|any] from <source> to <destination> [on] <firewall>
  allow may be written permit, deny block
```

> [!TODO]
> Posizione, azione, servizio, partenza, destinazione; un dispositivo salvato come il suo indirizzo.

## remove rule {#remove-rule}

```text
remove rule <n> [from] <firewall>
```

> [!TODO]
> Per il suo numero.

## Servizi {#services}

```text
ping   (also icmp)
web    (also http, https)
email  (also mail, smtp)
dns
any
```

> [!TODO]
> I quattro servizi e gli altri nomi con cui vanno.

## interface … nat {#nat}

```text
interface <n> nat [on] <device>
interface <n> nat off [on] <device>
```

> [!TODO]
> Il NAT in uscita su una porta.

## add forward {#add-forward}

```text
add forward [<service>|any] from [interface] <n> to <address> [on] <device>
```

> [!TODO]
> Servizio, la porta su cui arriva, l'indirizzo interno.

## remove forward {#remove-forward}

```text
remove forward <n> [from] <device>
```

> [!TODO]
> Per il suo numero.
