---
title: "Rotte"
description: "I comandi che aggiungono e tolgono le rotte statiche, predefinite e di riserva di un router o di un firewall."
order: 4
---

> [!TODO]
> Una pagina di riferimento: seguire terminal/interfaces-and-vlans.md. Esempi sulla rete delle due sedi.

## add route {#add-route}

```text
add route <network>|default via <next hop> [on] <device>
```

> [!TODO]
> Rete o default, prossimo salto come indirizzo o dispositivo; sostituire.

## add backup route {#add-backup-route}

```text
add backup route <network>|default via <next hop> [on] <device>
```

> [!TODO]
> Una seconda rotta per una rete che ne ha già una.

## remove route {#remove-route}

```text
remove route <network>|default [via <next hop>] [from] <device>
delete route <network>|default [via <next hop>] [from] <device>
```

> [!TODO]
> Tutte le rotte di una rete, o quella attraverso un prossimo salto; delete come alias.
