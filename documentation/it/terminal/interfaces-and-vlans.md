---
title: Interfacce e VLAN
description: I comandi che accendono e spengono un'interfaccia, le danno un indirizzo e un gateway, e mettono la porta di uno switch in una VLAN.
order: 3
---

Un'interfaccia è una porta di uno switch, di un router o di un firewall, numerata da 1, oppure una scheda di rete di ogni altro dispositivo, chiamata per nome (`eth0`). I comandi di questa pagina cambiano un'interfaccia alla volta, come fa la finestra del dispositivo, e la modifica resta nel disegno come ogni altra. Due altri gruppi di impostazioni appartengono a un'interfaccia e hanno pagine proprie: la zona di sicurezza e il NAT in [Firewall e NAT](firewall-and-nat.md), il server DHCP, il client DHCP e il server DNS in [DHCP e DNS](dhcp-and-dns.md).

Nella sintassi qui sotto `<id>` è il numero di una porta o il nome di una scheda, `<n>` il numero di una porta, `<name>` il nome di una scheda. Un dispositivo si indica con il nome che ha sul canvas, oppure con uno dei suoi indirizzi; `[on] <device>` si può tralasciare dentro `use <device>` (vedi [Dentro un dispositivo](#inside-a-device)). La [panoramica](index.md#conventions) spiega il resto della notazione. I comandi sono in inglese, come tutto il terminale.

## interface … up | down {#up-down}

```text
interface <id> up|down [on] <device>
enable port <n> [on] <device>
disable port <n> [on] <device>
```

Accende o spegne un'interfaccia, come fa «Porta attiva» nella finestra di uno switch, di un router o di un firewall. Un'interfaccia spenta non porta nulla: un pacchetto che ha un'altra strada la prende, gli altri si fermano lì, e il motivo nomina l'interfaccia.

| Parametro | Che cos'è |
|---|---|
| `<id>` | Il numero di una porta (`3`) o il nome di una scheda di rete (`eth0`) |
| `<device>` | Il dispositivo a cui appartiene l'interfaccia |

`enable port <n>` e `disable port <n>` equivalgono a `interface <n> up` e `interface <n> down`, solo per le porte.

```ncl sample=office
pixelcake> interface 2 down on SW-Office
port 2 on SW-Office is now down
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: port 2 on SW-Office is disabled
  dropped at: SW-Office
pixelcake> interface 2 up on SW-Office
port 2 on SW-Office is now up
pixelcake> disable port 2 on SW-Office
port 2 on SW-Office is now down
pixelcake> enable port 2 on SW-Office
port 2 on SW-Office is now up
pixelcake> interface eth0 down on PC-2
interface eth0 on PC-2 is now down
```

## interface … ip {#ip}

```text
interface <id> ip <address>[/<prefix>] [on] <device>
interface <id> ip none [on] <device>
interface <id> address <address>[/<prefix>] [on] <device>
```

L'indirizzo di una porta di un router o di un firewall, oppure di una scheda di rete. Su un router o su un firewall l'indirizzo di una porta è il gateway dei dispositivi collegati lì, e la sua rete si raggiunge senza bisogno di rotte. `ip none` toglie l'indirizzo.

| Parametro | Che cos'è |
|---|---|
| `<address>` | Un indirizzo IPv4, `10.0.0.1` |
| `/<prefix>` | La lunghezza della maschera, da 0 a 32: `/30` è 255.255.255.252. Senza, resta la maschera che l'interfaccia ha già, e un indirizzo nuovo prende `/24` |

Al posto di `ip` si può scrivere `address`. Un indirizzo scritto su una scheda che prende l'indirizzo dal DHCP toglie la scheda dal DHCP. Le porte di uno switch non hanno indirizzo: lo switch ne ha uno suo, che si imposta con `set ip` ([Dispositivi e indirizzi](devices-and-addresses.md#set)).

```ncl sample=office
pixelcake> interface 3 ip 10.0.0.1/30 on Router-1
port 3 on Router-1: 10.0.0.1 / 255.255.255.252
pixelcake> show ip Router-1
Router-1 — addressing
  ip:       192.168.10.1
  subnet:   255.255.255.0
  gateway:  -
  port 1: 192.168.10.1 / 255.255.255.0
  port 2: 192.168.20.1 / 255.255.255.0
  port 3: 10.0.0.1 / 255.255.255.252
pixelcake> interface 3 address 10.0.0.5 on Router-1
port 3 on Router-1: 10.0.0.5 / 255.255.255.252
pixelcake> interface 3 ip none on Router-1
port 3 on Router-1 has no address now
pixelcake> interface eth0 ip 192.168.10.21 on PC-1
interface eth0 on PC-1: 192.168.10.21 / 255.255.255.0
```

## interface … gateway {#gateway}

```text
interface <name> gateway <address> [on] <device>
interface <name> gateway none [on] <device>
```

Il gateway predefinito di una scheda di rete: dove la scheda manda ciò che non sta sulla sua rete. Solo le schede hanno un gateway; la rotta predefinita di un router o di un firewall si imposta con `set gateway` o con `add route default` ([Rotte](routes.md)). Il motore controlla che il gateway sia l'indirizzo di un router sulla rete della scheda, e lo dice quando non lo è.

| Parametro | Che cos'è |
|---|---|
| `<name>` | Il nome di una scheda di rete, `eth0` |
| `<address>` | L'indirizzo del gateway, sulla rete della scheda |

```ncl sample=office
pixelcake> interface eth0 gateway 192.168.10.254 on PC-1
interface eth0 on PC-1: gateway 192.168.10.254
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.254, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
pixelcake> interface eth0 gateway 192.168.10.1 on PC-1
interface eth0 on PC-1: gateway 192.168.10.1
pixelcake> interface eth0 gateway none on PC-2
interface eth0 on PC-2 has no gateway now
pixelcake> ping Web-01 from PC-2
Pinging Web-01 (192.168.20.10) from PC-2...
Ping failed (blocked): request: no default gateway configured on PC-2
  dropped at: PC-2
pixelcake> interface 1 gateway 10.0.0.1 on Router-1
port 1 on Router-1 is a port: ports have no gateway
  the default route of Router-1 is: set gateway of Router-1 to <address>
```

## interface … access {#access}

```text
interface <n> access <vlan> [on] <switch>
```

La porta diventa una porta di accesso in una VLAN. La prima porta di uno switch che riceve una VLAN fa sì che lo switch applichi le VLAN porta per porta, e la risposta lo dice: da quel momento ogni porta che nessuno ha impostato è nella VLAN 1 ([perché](../building/vlans.md#vlan-1)).

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di una porta di uno switch |
| `<vlan>` | Una VLAN, da 1 a 4094 |

```ncl sample=office
pixelcake> interface 1 access 10 on SW-Office
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> interface 2 access 10 on SW-Office
port 2 on SW-Office is now an access port in VLAN 10
pixelcake> trace PC-2 from PC-1
Tracing route to PC-2 (192.168.10.12) from PC-1:
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)  — VLAN 10
  3  ● PC-2 (PC)
Trace complete: destination reached.
pixelcake> interface 2 access 20 on SW-Office
port 2 on SW-Office is now an access port in VLAN 20
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: VLAN 10 does not leave through port 2 on SW-Office: it is an access port in VLAN 20
  dropped at: SW-Office
```

## interface … trunk {#trunk}

```text
interface <n> trunk <vlan>,<vlan>,… [on] <switch>
interface <n> trunk all [on] <switch>
```

La porta diventa un trunk e trasporta le VLAN dell'elenco, ciascuna con la sua etichetta. L'elenco si può scrivere `10,20` oppure `10, 20`; `all`, o nessun elenco, fa un trunk per tutte le VLAN. Un trunk per tutte le VLAN è l'unica impostazione di VLAN che non fa applicare le VLAN allo switch: da sola non cambia nulla.

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di una porta di uno switch |
| `<vlan>,<vlan>,…` | Le VLAN che il trunk trasporta, ciascuna da 1 a 4094 |

```ncl sample=company
pixelcake> show interfaces SW-Uffici
IFACE      KIND   STATE   IP               VLAN       MODE-ZONE  LINK
1          port   up      -                10         access     PC-Contabilità (eth0)
2          port   up      -                10         access     PC-Vendite (eth0)
3          port   up      -                10         access     Stampante (eth0)
4          port   up      -                20         access     AP-Uffici (eth0)
5          port   up      -                1          access     -
6          port   up      -                1          access     -
7          port   up      -                1          access     -
8          port   up      -                10,20      trunk      SW-Core (port 1)
pixelcake> interface 8 trunk 10 on SW-Uffici
port 8 on SW-Uffici is now a trunk carrying VLANs [10]
pixelcake> ping Web-Gestionale from AP-Uffici
Pinging Web-Gestionale (192.168.30.30) from AP-Uffici...
Ping failed (blocked): request: VLAN 20 does not leave through port 8 on SW-Uffici: it is a trunk carrying VLANs [10]
  dropped at: SW-Uffici
pixelcake> interface 8 trunk 10,20 on SW-Uffici
port 8 on SW-Uffici is now a trunk carrying VLANs [10,20]
```

```ncl sample=office
pixelcake> interface 8 trunk 10,20 on SW-Office
port 8 on SW-Office is now a trunk carrying VLANs [10,20]
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> interface 8 trunk all on SW-Office
port 8 on SW-Office is now a trunk carrying every VLAN
  no port of SW-Office has a VLAN any more: it forwards everything as it comes
```

## interface … default {#default}

```text
interface <n> default [on] <switch>
```

La porta non ha più una VLAN sua, come quando lo switch è stato disegnato. Se era l'ultima porta con una VLAN, lo switch smette di applicare le VLAN e inoltra tutto così come arriva, e la risposta lo dice.

| Parametro | Che cos'è |
|---|---|
| `<n>` | Il numero di una porta di uno switch |

```ncl sample=office
pixelcake> interface 1 access 10 on SW-Office
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> interface 1 default on SW-Office
port 1 on SW-Office has no VLAN of its own now
  no port of SW-Office has a VLAN any more: it forwards everything as it comes
```

## add vlan, remove vlan {#device-vlans}

```text
add vlan <id> [to] <device>
remove vlan <id> from <device>
```

L'elenco delle VLAN di un dispositivo, quello della scheda «Generale» della sua finestra. Su uno switch sono le VLAN che lo switch conosce: le trame di ogni altra VLAN vengono scartate, e l'elenco vuoto vuol dire tutte. Su ogni altro dispositivo sono le VLAN che la sua interfaccia accetta con l'etichetta su una porta trunk. La VLAN di ogni porta si imposta con `interface … access` e `interface … trunk`, qui sopra; questo elenco serve di rado ([di più](../building/vlans.md#device-vlans)).

| Parametro | Che cos'è |
|---|---|
| `<id>` | Una VLAN, da 1 a 4094 |
| `<device>` | Un dispositivo qualsiasi |

```ncl sample=office
pixelcake> add vlan 10 to SW-Office
SW-Office: added to VLAN 10 (now [10])
pixelcake> show vlans
VLAN   MEMBERS
10     SW-Office
pixelcake> remove vlan 10 from SW-Office
SW-Office: removed from VLAN 10 (no VLANs left — untagged)
pixelcake> remove vlan 20 from PC-1
PC-1 is not a member of VLAN 20
```

## Dentro un dispositivo {#inside-a-device}

```text
use <device>
exit
```

`use` fa di un dispositivo quello di cui parla ogni comando, fino a `exit`: il prompt prende il suo nome, e `on <device>` si tralascia.

```ncl sample=office
pixelcake> use SW-Office
context: SW-Office — "from" is now implied, "exit" to leave
SW-Office> interface 1 access 10
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
SW-Office> exit
left SW-Office
```

## Quando un comando è rifiutato {#refusals}

Un comando che non si può eseguire non cambia nulla, e dice perché, o come andava scritto:

```ncl sample=office
pixelcake> interface 1 access 5000 on SW-Office
unknown command: "interface 1 access 5000 on SW-Office"
  VLAN id must be a number from 1 to 4094, got "5000" — try: interface <n> access <vlan> [on] <device>
  type "help" for the command list
pixelcake> interface 9 down on SW-Office
SW-Office has no port 9 (ports 1-8)
pixelcake> interface 1 access 10 on PC-1
PC-1 has no interface "1" (it has: eth0)
pixelcake> interface 1 ip 10.1.1.1 on SW-Office
SW-Office is a Switch: its ports carry no address
  its own address is set with: set ip of SW-Office to <address>
```

## Vedi anche {#see-also}

- [VLAN](../building/vlans.md): che cos'è una VLAN, e come si imposta nella finestra di uno switch.
- [I comandi show](show.md#show-interfaces): `show interfaces` e `show vlans`, per leggere ciò che questi comandi hanno cambiato.
- [Firewall e NAT](firewall-and-nat.md) e [DHCP e DNS](dhcp-and-dns.md): le altre impostazioni di un'interfaccia.
