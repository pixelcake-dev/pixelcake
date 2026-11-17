---
title: "Dispositivi e indirizzi"
description: "I comandi che cambiano indirizzo, maschera, gateway e nome di un dispositivo, e che aggiungono o tolgono un cavo."
order: 2
---

> [!TODO]
> Una pagina di riferimento: seguire terminal/interfaces-and-vlans.md (sintassi, parametri, alias, esempi con l'output vero).

## set {#set}

```text
set ip [of] <device> [to] <address>
set gateway [of] <device> [to] <address>
set subnet [of] <device> [to] <mask>
set name [of] <device> [to] <new name>
```

> [!TODO]
> ip, gateway, subnet, name; su un dispositivo con schede, la prima scheda; su un router, la rotta predefinita.

## connect, disconnect {#connect}

```text
connect <device> [to] <device>
disconnect <device> [from] <device>
```

> [!TODO]
> La prima interfaccia libera a ogni capo; un firewall con le zone.
