---
title: "Indirizzi e gateway"
description: "L'indirizzo di un dispositivo finale, gli indirizzi delle porte di un router, il gateway, e la rete da cui partono i dispositivi nuovi."
order: 4
---

Un indirizzo dice a un dispositivo dove si trova; una subnet mask gli dice quali altri indirizzi sono nella stessa rete; un gateway gli dice dove mandare ciò che non lo è. Il motore legge tutti e tre dalle interfacce di ogni dispositivo sul percorso di un pacchetto. Un dispositivo manda direttamente a un indirizzo che è nella sua rete, e al suo gateway per ogni altro. Il gateway deve essere un router, o un firewall, che ha un indirizzo in quella rete.

## L'indirizzo di un dispositivo finale {#end-devices}

Un dispositivo finale ha un indirizzo sulla sua prima scheda di rete, `eth0`: un «Indirizzo IP», una «Subnet mask» e un «Gateway», e facoltativamente un «Server DNS». Si impostano in due posti che sono uno solo: la scheda «Generale» della finestra del dispositivo, sotto il titolo `Rete · eth0`, e la riga della scheda nella scheda «Schede di rete» ([Porte e schede di rete](ports-and-cards.md#first-card)).

Una scheda può invece prendere l'indirizzo da un server DHCP: imposta «Indirizzo» su «Automatico (DHCP)», e i campi lasciano il posto all'indirizzo che la scheda riceve ([DHCP](../services/dhcp.md#clients)). Una scheda in DHCP che non riceve un indirizzo rende giallo il suo dispositivo e scrive «DHCP: nessun indirizzo» sotto il nome.

`show ip` dice che cosa ha un dispositivo, nel terminale:

```ncl sample=office
pixelcake> show ip PC-1
PC-1 — addressing
  ip:       192.168.10.11
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.11 / 255.255.255.0 gw 192.168.10.1
pixelcake> show ip Router-1
Router-1 — addressing
  ip:       192.168.10.1
  subnet:   255.255.255.0
  gateway:  -
  port 1: 192.168.10.1 / 255.255.255.0
  port 2: 192.168.20.1 / 255.255.255.0
```

Il dispositivo ha `ip`, `subnet` e `gateway` suoi, che sono quelli della prima scheda, e una riga per ogni scheda o porta con indirizzo. Il terminale li imposta con `set ip`, `set gateway`, `set subnet` e `interface <nome> ip` ([Dispositivi e indirizzi](../terminal/devices-and-addresses.md#set)).

## Le porte di un router {#router-ports}

Le porte di uno switch non hanno indirizzo: uno switch ne ha uno suo, per essere gestito, e inoltra per VLAN. Le porte di un **router** e di un **firewall** hanno ciascuna un «Indirizzo IP» e una «Subnet mask» ([Porte e schede di rete](ports-and-cards.md#ports)). L'indirizzo di una porta fa due cose:

- è il **gateway dei dispositivi collegati lì**: lo scrivono nel loro «Gateway»;
- la sua rete è **connessa** al router: un pacchetto per essa viene consegnato senza una rotta.

Router-1, nella rete di esempio dell'ufficio, ha due porte, una in ciascuna rete. Una porta senza indirizzo non sta in nessuna rete; un router le cui porte non ne hanno lascia comunque passare il traffico, con una nota che dice che gateway e instradamento non sono stati verificati, così i disegni fatti senza indirizzi continuano a funzionare. Più VLAN su uno switch sono più reti, e un router ha bisogno di una porta in ciascuna ([VLAN](vlans.md#between-vlans)). Una rete dietro un altro router si raggiunge con una rotta ([Rotte](../services/routes.md#static)).

## Il gateway {#gateway}

Quando un dispositivo manda a un indirizzo che non è nella sua rete, manda al suo gateway. Il motore controlla che il gateway ci sia. Ognuno di questi casi ferma il pacchetto, con un motivo che dice quale:

```ncl sample=office
pixelcake> set gateway of PC-1 to 192.168.10.5
PC-1: gateway set to 192.168.10.5
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.5, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
pixelcake> interface eth0 gateway none on PC-1
interface eth0 on PC-1 has no gateway now
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: no default gateway configured on PC-1
  dropped at: PC-1
pixelcake> interface eth0 gateway 192.168.10.1 on PC-1
interface eth0 on PC-1: gateway 192.168.10.1
```

Un gateway che nessuno ha: il motivo nomina il gateway che il dispositivo usa e l'indirizzo della porta del router che ha raggiunto. Nessun gateway: il dispositivo non può uscire dalla sua rete. Un gateway che è una porta senza indirizzo:

```ncl continue
pixelcake> interface 1 ip none on Router-1
port 1 on Router-1 has no address now
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.1, but Router-1 port 1 on its link has no IP address
  dropped at: PC-1
pixelcake> interface 1 ip 192.168.10.1 on Router-1
port 1 on Router-1: 192.168.10.1 / 255.255.255.0
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms
```

E una subnet mask troppo larga, che fa sembrare una sola due reti a chi manda. Manda diretto al server invece che al gateway, e il router in mezzo non porta traffico dentro una rete:

```ncl sample=office
pixelcake> interface eth0 ip 192.168.10.11/16 on PC-1
interface eth0 on PC-1: 192.168.10.11 / 255.255.0.0
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: Web-01 (192.168.20.10) is addressed inside the network of PC-1 but sits behind Router-1: a router does not pass traffic within one network
  dropped at: Router-1
```

Il contrario è un indirizzo nella rete sbagliata: il pacchetto arriva al router, che non trova nessuno che risponda:

```ncl sample=office
pixelcake> set ip of PC-2 to 192.168.20.77
PC-2: ip set to 192.168.20.77
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.20.77) from PC-1...
Ping failed (blocked): request: PC-2 (192.168.20.77) does not answer on the network of Router-1
  dropped at: Router-1
```

Nessuno di questi è rifiutato quando lo scrivi. La finestra controlla che un indirizzo sia fatto di quattro numeri da 0 a 255, che una subnet mask sia una maschera, e che una maschera abbia un indirizzo ([Porte e schede di rete](ports-and-cards.md#problems)); non controlla che un gateway sia nella rete della scheda, che due dispositivi abbiano indirizzi diversi, o che un indirizzo appartenga alla rete del cavo a cui è collegato. A questo serve interrogare la rete: un `ping`, o un `trace`, dice dove si è fermato il pacchetto e perché.

## La rete del progetto {#project-network}

A un dispositivo nuovo si dà un indirizzo, una subnet mask e un gateway, e vengono dal progetto. In Impostazioni → Rete, sotto «Nuovi dispositivi»:

| Campo | Che cos'è |
|---|---|
| «Rete» | Un indirizzo di rete, `192.168.1.0`. A un dispositivo nuovo viene proposto il primo indirizzo libero, da `.2`, saltando quelli che i dispositivi hanno già, scritti a mano o assegnati |
| «Subnet mask predefinita» | La subnet mask delle schede nuove |
| «Gateway predefinito» | Il gateway delle schede nuove. Un router o un firewall nasce senza: per loro il gateway è la rotta predefinita, scelta nella loro finestra |
| «Server DNS predefinito» | Facoltativo. Si scrive sulla scheda dei nuovi PC, server e altri dispositivi finali; non su un access point, un load balancer o un Cloud, che portano solo il traffico degli altri |

Premi «Salva le impostazioni di rete». Un campo lasciato vuoto (il server DNS può esserlo) o che non è un indirizzo viene rifiutato, e un avviso lo dice («Tutti i campi sono obbligatori»). Le impostazioni sono quelle del progetto e viaggiano con esso nel file. **Cambiarle non tocca i dispositivi che sono già sul canvas**: hanno gli indirizzi che hanno ricevuto. L'unica eccezione è il server DNS: una volta salvato, la stessa scheda dice quanti dispositivi finali del canvas non interrogano nessuno e propone un pulsante, per esempio "Assegna 192.168.30.10", che glielo dà dopo una domanda. Chi indica già un server lo tiene.

Ogni rete di esempio porta con sé le sue impostazioni: l'azienda, per esempio, fa partire i dispositivi nuovi da `192.168.10.0` con gateway `192.168.10.1`. Caricarne una sostituisce le impostazioni del progetto, e la domanda che viene fatta prima lo dice ([Reti di esempio](../reference/samples.md)). File → «Nuovo progetto…» chiede gli stessi valori.

## Limiti {#limits}

> [!LIMITS]
> - Solo IPv4. Non c'è l'IPv6.
> - Una porta o una scheda ha un solo indirizzo. Un secondo indirizzo sulla stessa interfaccia, una sottointerfaccia e un indirizzo che si sposta tra dispositivi (VRRP, HSRP) non sono modellati.
> - Non c'è l'ARP. Due dispositivi con lo stesso indirizzo non vengono notati, e nulla viene appreso né entra in conflitto.
> - Un gateway viene guardato solo quando un pacchetto ne ha bisogno: il canvas ne accetta uno lontano dalla rete della sua scheda.
