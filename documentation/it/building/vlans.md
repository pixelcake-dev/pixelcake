---
title: VLAN
description: Dividere le porte di uno switch in reti che non si vedono, portarne più d'una su un solo cavo, e passare dall'una all'altra.
order: 5
---

Una VLAN (LAN virtuale) divide le porte di uno switch in reti separate. Due dispositivi su porte di VLAN diverse non si raggiungono, anche se stanno sullo stesso switch, finché un router non unisce le due reti. In PixelCake una VLAN è un numero da 1 a 4094, impostato porta per porta sugli switch, e il motore lo applica a ogni pacchetto che segue.

## Porte di accesso e porte trunk {#access-and-trunk}

Ogni porta di uno switch lavora in uno di due modi:

- una porta di **accesso** sta in una VLAN sola. È la porta a cui si collega un dispositivo finale: un PC, una stampante, un access point. Ciò che esce da una porta di accesso non porta etichetta;
- una porta **trunk** trasporta più VLAN su un solo cavo, ogni trama con l'etichetta della sua VLAN. Unisce due switch, oppure uno switch e un dispositivo che si aspetta le etichette. Un trunk elenca le VLAN che trasporta; un trunk con l'elenco vuoto le trasporta tutte.

Per impostare una porta apri la finestra dello switch con un doppio clic, vai nella scheda «Porte» e scegli la porta. In «Modalità della porta» scegli «Access (dispositivo finale)» e scrivi il numero in «VLAN (singola)», oppure scegli «Trunk (tra switch)» e scrivi l'elenco in «VLAN (separate da virgola)», per esempio `10, 20`. Non cambia nulla finché non premi «Salva».

## La VLAN 1 e le porte che non hai toccato {#vlan-1}

Uno switch che non ha una VLAN su nessuna porta inoltra tutto così come arriva: tutte le sue porte sono una rete sola. Appena una porta ha una VLAN, lo switch applica le VLAN porta per porta, come fanno gli apparati veri, e ogni porta che nessuno ha impostato diventa una porta di accesso nella VLAN 1.

È la sorpresa più frequente. Sulla rete di esempio «Ufficio: due reti e un router» metti i due PC nella VLAN 10, una porta alla volta:

```ncl sample=office
pixelcake> interface 1 access 10 on SW-Office
port 1 on SW-Office is now an access port in VLAN 10
  SW-Office now applies VLANs port by port: the ports you did not set are in VLAN 1
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: VLAN 10 does not leave through port 2 on SW-Office: it is in the default VLAN 1
  dropped at: SW-Office
pixelcake> interface 2 access 10 on SW-Office
port 2 on SW-Office is now an access port in VLAN 10
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Reply from 192.168.10.12: hops=3 time=3ms
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: VLAN 10 does not leave through port 8 on SW-Office: it is in the default VLAN 1
  dropped at: SW-Office
```

I due PC si raggiungono di nuovo, ma non raggiungono i server: la porta 8, il cavo verso Router-1, è rimasta nella VLAN 1, e il gateway dei PC sta dall'altra parte. Metti anche quella nella VLAN 10:

```ncl continue
pixelcake> interface 8 access 10 on SW-Office
port 8 on SW-Office is now an access port in VLAN 10
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
```

Uno switch, poi, risponde sul proprio indirizzo solo nella VLAN 1: uno switch con tutte le porte in altre VLAN si gestisce da una rete a parte, come SW-Core e SW-Uffici nella rete dell'azienda.

## Un trunk, più VLAN {#trunk}

Nella rete di esempio «Azienda: uffici, Wi-Fi, server e DMZ» le postazioni degli uffici sono nella VLAN 10 e l'access point del Wi-Fi nella VLAN 20, sullo stesso switch, SW-Uffici. Un solo cavo porta le due VLAN a SW-Core: la porta 8 di SW-Uffici è un trunk per le VLAN 10 e 20. SW-Core riceve il trunk sulla sua porta 1 e dà a ciascuna VLAN una porta di accesso verso Router-Core.

![Gli uffici della rete dell'azienda. Router-Core è collegato a SW-Core da due cavi, con le etichette VLAN 10 e VLAN 20. SW-Core è collegato a SW-Uffici da un solo cavo, con l'etichetta Trunk 10, 20. SW-Uffici è collegato a PC-Contabilità, PC-Vendite e alla stampante, e con un cavo VLAN 20 ad AP-Uffici, che ha Portatile-1 e Portatile-2 sul suo Wi-Fi.](../../media/vlans/offices-trunk.it.svg "Gli uffici della rete dell'azienda: tre postazioni nella VLAN 10, il Wi-Fi nella VLAN 20, un trunk tra i due switch.")

`show vlans` elenca ogni VLAN con le porte su cui si trova e i trunk che la trasportano:

```ncl sample=company
pixelcake> show vlans
VLAN   MEMBERS
1      SW-Uffici (ports 5,6,7), SW-Core (ports 2,3,4,5,6), SW-Server (ports 6,7)
10     SW-Uffici (ports 1,2,3; trunk 8), SW-Core (port 7; trunk 1)
20     SW-Uffici (port 4; trunk 8), SW-Core (port 8; trunk 1)
30     SW-Server (ports 1,2,3,4,5,8)
```

Togli la VLAN 20 dal trunk e il Wi-Fi resta isolato dal resto della rete. Il motivo nomina la porta; i portatili perdono anche l'indirizzo, perché le loro richieste viaggiano nella VLAN 20 verso il server DHCP di Router-Core:

```ncl continue
pixelcake> interface 8 trunk 10 on SW-Uffici
port 8 on SW-Uffici is now a trunk carrying VLANs [10]
pixelcake> ping Web-Gestionale from AP-Uffici
Pinging Web-Gestionale (192.168.30.30) from AP-Uffici...
Ping failed (blocked): request: VLAN 20 does not leave through port 8 on SW-Uffici: it is a trunk carrying VLANs [10]
  dropped at: SW-Uffici
pixelcake> ping Web-Gestionale from Portatile-1
Pinging Web-Gestionale (192.168.30.30) from Portatile-1...
Ping failed (error): request: Portatile-1 has no address: no DHCP server answers on its network
pixelcake> interface 8 trunk 10,20 on SW-Uffici
port 8 on SW-Uffici is now a trunk carrying VLANs [10,20]
pixelcake> ping Web-Gestionale from Portatile-1
Pinging Web-Gestionale (192.168.30.30) from Portatile-1...
Reply from 192.168.30.30: hops=7 time=11ms
```

## Da una VLAN all'altra {#between-vlans}

Due VLAN sono due reti: un pacchetto passa dall'una all'altra solo attraverso un router, o un firewall, con una porta in ciascuna. Ognuna di quelle porte ha un indirizzo della sua rete, ed è il gateway dei dispositivi di quella VLAN. Nella rete dell'azienda Router-Core ha la porta 1 sulla VLAN 10 (192.168.10.1), la porta 2 sulla VLAN 20 (192.168.20.1) e la porta 3 sulla VLAN 30, quella dei server (192.168.30.1).

Un `trace` mostra le due cose: la VLAN in cui viaggia il pacchetto a ogni switch, e la rotta che prende il router.

```ncl sample=company
pixelcake> trace Web-Gestionale from PC-Vendite
Tracing route to Web-Gestionale (192.168.30.30) from PC-Vendite:
  1  ○ PC-Vendite (PC)
  2  ○ SW-Uffici (Switch)  — VLAN 10
  3  ○ SW-Core (Switch)  — VLAN 10
  4  ○ Router-Core (Router)  — routed: 192.168.30.0/24 is on port 3
  5  ○ SW-Server (Switch)  — VLAN 30
  6  ● Web-Gestionale (Server)
Trace complete: destination reached.
```

Gli indirizzi delle porte di un router sono spiegati in [Indirizzi e gateway](addresses.md#router-ports).

## Le VLAN che un dispositivo conosce {#device-vlans}

Oltre alla VLAN di ogni porta, un dispositivo ha un suo elenco di VLAN, nel gruppo VLAN della scheda «Generale» della sua finestra:

- su uno switch sono le VLAN che lo switch conosce: le trame di ogni altra VLAN vengono scartate. L'elenco vuoto vuol dire tutte;
- su ogni altro dispositivo sono le VLAN che la sua interfaccia accetta con l'etichetta, su una porta trunk. L'elenco vuoto vuol dire solo traffico senza etichetta. Un dispositivo che dichiara delle VLAN va collegato a una porta di una di esse.

Nella maggior parte dei disegni non serve: basta la VLAN delle porte. Nel terminale l'elenco si cambia con `add vlan` e `remove vlan` ([riferimento](../terminal/interfaces-and-vlans.md#device-vlans)).

## Un nome per le VLAN {#names}

Una VLAN può avere un nome, dato una volta per tutto il progetto. In Impostazioni → Rete, sotto «VLAN del progetto», la tabella elenca le VLAN che il canvas usa: scrivi un nome accanto a ciascuna, oppure aggiungine un'altra con «Aggiungi VLAN», poi salva. Il nome compare allora accanto al numero ovunque la finestra di uno switch o di una porta lo mostri, come `VLAN 10 «Uffici»`. Il terminale e i motivi del motore restano sui numeri.

Le reti di esempio portano con sé i nomi delle loro VLAN.

## Nel terminale {#in-the-terminal}

| Per | Scrivi |
|---|---|
| vedere ogni VLAN e dove si trova | `show vlans` |
| vedere le porte di uno switch, con la VLAN di ciascuna | `show interfaces SW-Uffici` |
| mettere una porta in una VLAN | `interface 3 access 10 on SW-Uffici` |
| fare di una porta un trunk | `interface 8 trunk 10,20 on SW-Uffici` |
| riportare una porta come era | `interface 3 default on SW-Uffici` |

Ogni comando, con le sue opzioni e altri esempi, è in [Interfacce e VLAN](../terminal/interfaces-and-vlans.md).

## Limiti {#limits}

> [!LIMITS]
> - Per passare da una VLAN all'altra serve una porta di router, o di firewall, in ciascuna VLAN. Le sottointerfacce su una porta sola (il "router on a stick") non sono modellate.
> - Il traffico senza etichetta di un trunk è sempre nella VLAN 1: non c'è una VLAN nativa da scegliere.
> - Lo spanning tree non è simulato: un disegno con cavi ridondanti tra switch è percorso senza anelli, ma nessuna porta viene bloccata.
> - Non ci sono l'apprendimento degli indirizzi MAC, VTP o GVRP, la VLAN voce, le VLAN private, la doppia etichetta.
