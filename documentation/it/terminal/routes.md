---
title: "Rotte"
description: "I comandi che aggiungono e tolgono le rotte statiche, le rotte predefinite e le rotte di riserva di un router o di un firewall."
order: 4
---

Una rotta dice a un router o a un firewall dove mandare ciò che non sta su una rete a cui è collegato. Questi comandi scrivono le stesse righe della scheda «Rotte» della finestra del dispositivo, e `show routes` rilegge la tabella intera ([Comandi show](show.md#show-routes)). Che cos'è una rotta, e come il motore ne sceglie una, è spiegato in [Rotte statiche e di riserva](../services/routes.md).

Una rete si scrive come un indirizzo e un prefisso, `192.168.30.0/24`, oppure con la parola `default`, che sta per ogni rete (`0.0.0.0/0`). I bit dell'host di un indirizzo vengono scartati: `192.168.30.7/24` è la rete `192.168.30.0/24`. La notazione dei blocchi di sintassi è spiegata nella [panoramica](index.md#conventions).

Le rotte appartengono a router e firewall. Su ogni altro dispositivo i comandi vengono rifiutati, e la risposta rimanda a `set gateway` ([Dispositivi e indirizzi](devices-and-addresses.md#set)).

## add route {#add-route}

```text
add route <network>|default via <next hop> [on] <device>
```

Aggiunge una rotta statica: ciò che è diretto a `<network>` viene mandato a `<next hop>`.

| Parametro | Che cos'è |
|---|---|
| `<network>` | Una rete, `192.168.30.0/24`, oppure `default` |
| `<next hop>` | L'indirizzo del router successivo, oppure il nome di un dispositivo che ha un indirizzo su una delle reti di questo router: il comando scrive allora quell'indirizzo e dice quale (`Mail-01 → 192.168.20.20`) |
| `<device>` | Il router o il firewall su cui si scrive la rotta. Dentro `use <device>` si tralascia |

Se la rete ha già una rotta, il comando non ne aggiunge una seconda: ne cambia il prossimo salto, e la risposta dice qual era. La stessa rotta ripetuta, con il prossimo salto che ha già, non cambia nulla, e la risposta lo dice. Una seconda rotta verso la stessa rete è una rotta di riserva ([più avanti](#add-backup-route)). Il comando avvisa, e scrive la rotta lo stesso, quando il prossimo salto non sta su nessuna delle reti del dispositivo: la rotta non si può usare finché una delle sue porte non ha un indirizzo sulla rete del prossimo salto, e `show routes` la segna con `✗ next hop on none of its networks`. Un router le cui porte non hanno ancora un indirizzo riceve lo stesso avviso in un'altra forma: le sue rotte non vengono usate finché una porta non ne ha uno.

Il prossimo salto viene scritto come indirizzo; il motore lo legge alla domanda successiva. Su un router la rotta predefinita è anche il «Gateway (rotta predefinita)» della sua finestra, e `set gateway` scrive la stessa cosa ([Dispositivi e indirizzi](devices-and-addresses.md#set)).

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 from R-Sede
R-Sede: 2 routes to 192.168.2.0/24 removed
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Ping failed (blocked): request: R-Sede has no route to 192.168.2.11
  dropped at: R-Sede
pixelcake> add route 192.168.2.0/24 via R-Filiale on R-Sede
R-Sede: route to 192.168.2.0/24 via 10.0.0.2 added
  R-Filiale → 10.0.0.2
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Reply from 192.168.2.11: hops=7 time=11ms
pixelcake> add route 192.168.2.0/24 via 10.0.1.2 on R-Sede
R-Sede: route to 192.168.2.0/24 now goes via 10.0.1.2 (was 10.0.0.2)
pixelcake> add route 192.168.2.0/24 via 10.0.0.2 on R-Sede
R-Sede: route to 192.168.2.0/24 now goes via 10.0.0.2 (was 10.0.1.2)
pixelcake> add route 192.168.2.0/24 via 10.0.0.2 on R-Sede
R-Sede: route to 192.168.2.0/24 via 10.0.0.2 is already there, nothing changed
```

Una rotta predefinita, e una rotta il cui prossimo salto non sta dove dovrebbe:

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

Aggiunge una seconda rotta verso una rete che ne ha già una. Viene usata quando l'interfaccia della prima rotta non ha più un cavo che funzioni: una porta spenta, un cavo tagliato, o un guasto simulato in una presentazione. Vale lo stesso per due rotte predefinite. `show routes` la indica con `backup`.

| Parametro | Che cos'è |
|---|---|
| `<network>` | Una rete, oppure `default` |
| `<next hop>` | Un indirizzo o un dispositivo, come per `add route`. Deve essere diverso dal prossimo salto delle rotte che la rete ha già |
| `<device>` | Il router o il firewall |

Se la rete non ha ancora una rotta, il comando scrive una rotta normale e dice che non c'è ancora nulla di cui fare da riserva. Non esiste `remove backup route`: una rotta di riserva si toglie come ogni altra, con il suo prossimo salto ([più avanti](#remove-route)).

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 via 10.0.1.2 from R-Sede
R-Sede: route to 192.168.2.0/24 via 10.0.1.2 removed
pixelcake> add backup route 192.168.2.0/24 via 10.0.1.2 on R-Sede
R-Sede: backup route to 192.168.2.0/24 via 10.0.1.2 added
  used when the interface of the route via 10.0.0.2 has no working link
pixelcake> add backup route 192.168.2.0/24 via 10.0.1.2 on R-Sede
R-Sede already has a route to 192.168.2.0/24 via 10.0.1.2
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
pixelcake> interface 2 down on R-Sede
port 2 on R-Sede is now down
pixelcake> trace PC-Filiale-1 from PC-Sede-1
Tracing route to PC-Filiale-1 (192.168.2.11) from PC-Sede-1:
  1  ○ PC-Sede-1 (PC)
  2  ○ SW-Piano-1 (Switch)
  3  ○ SW-Core (Switch)
  4  ○ R-Sede (Router)  — routed: 192.168.2.0/24 via 10.0.1.2 (port 3)
  5  ○ R-Riserva (Router)  — routed: 192.168.2.0/24 via 10.0.2.2 (port 2)
  6  ○ R-Filiale (Router)  — routed: 192.168.2.0/24 is on port 1
  7  ○ SW-Filiale (Switch)
  8  ● PC-Filiale-1 (PC)
Trace complete: destination reached.
pixelcake> add backup route 192.168.9.0/24 via 10.0.1.2 on R-Sede
R-Sede: route to 192.168.9.0/24 via 10.0.1.2 added
  it is the only route to 192.168.9.0/24: there is nothing to back up yet
```

## remove route {#remove-route}

```text
remove route <network>|default [via <next hop>] [from] <device>
delete route <network>|default [via <next hop>] [from] <device>
```

Toglie le rotte verso una rete. Senza `via` le toglie tutte, anche quelle di riserva; con `via`, solo quella che passa da quel prossimo salto. `delete` è uguale a `remove`.

| Parametro | Che cos'è |
|---|---|
| `<network>` | Una rete, oppure `default` |
| `<next hop>` | L'indirizzo del prossimo salto della rotta da togliere. Qui non si può usare il nome di un dispositivo: scrivi il suo indirizzo |
| `<device>` | Il router o il firewall. Dopo il comando si può scrivere `on` al posto di `from` |

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 via 10.0.1.2 from R-Sede
R-Sede: route to 192.168.2.0/24 via 10.0.1.2 removed
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
pixelcake> remove route 192.168.2.0/24 via 10.0.1.2 from R-Sede
R-Sede has no route to 192.168.2.0/24 via 10.0.1.2
pixelcake> delete route 192.168.2.0/24 on R-Sede
R-Sede: route to 192.168.2.0/24 removed
pixelcake> delete route 192.168.2.0/24 on R-Sede
R-Sede has no route to 192.168.2.0/24
```

## Quando un comando viene rifiutato {#refusals}

Un comando che non si può eseguire non cambia nulla, e dice perché, o che forma avrebbe dovuto avere:

```ncl sample=office
pixelcake> add route servers via 10.0.0.2 on Router-1
"servers" is not a network: write it as 192.168.30.0/24, or "default"
pixelcake> add route 192.168.30.0/24 via Nessuno on Router-1
"Nessuno" is not an address, nor a device on the canvas
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

## Vedi anche {#see-also}

- [Rotte statiche e di riserva](../services/routes.md): la tabella di instradamento, la rotta predefinita, le rotte di riserva e ciò che il motore non fa.
- [Comandi show](show.md#show-routes): `show routes`.
- [Interfacce e VLAN](interfaces-and-vlans.md#ip): l'indirizzo di una porta, che rende raggiungibile la sua rete senza una rotta.
- [Il terminale durante la presentazione](../asking/presentation.md#terminal): i guasti simulati in una presentazione, e la rotta di riserva che subentra.
