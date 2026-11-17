---
title: "DHCP"
description: "Dispositivi che prendono l'indirizzo da soli, le porte e i server che li assegnano, e perché una scheda non ne riceve nessuno."
order: 4
---

Con il DHCP un dispositivo non ha l'indirizzo scritto addosso: lo chiede, e un server DHCP della sua rete glielo assegna insieme alla subnet mask e a un gateway, e a un server DNS quando l'intervallo ne indica uno. In PixelCake il motore non ha un orologio, quindi un'assegnazione non viene ricordata: gli indirizzi si calcolano dal disegno, sempre allo stesso modo.

Gli esempi usano la rete di esempio «Azienda: uffici, Wi-Fi, server e DMZ». Il suo router, Router-Core, assegna gli indirizzi agli uffici (porta 1) e al Wi-Fi (porta 2), e i due portatili prendono i loro da lui.

## Una scheda in DHCP {#clients}

Il cliente è una scheda di rete. Nella finestra di un dispositivo finale (un PC, un portatile, una stampante, un server) apri la scheda «Schede di rete», scegli la scheda e, sotto «Indirizzo», scegli «Automatico (DHCP)» invece di «Manuale». Finché una scheda è in DHCP non ha un indirizzo suo. Prende indirizzo, subnet mask e gateway dal server che le risponde, e il server DNS quando l'intervallo ne indica uno; la scheda li mostra sotto «Indirizzo assegnato». Sul disegno l'indirizzo del dispositivo è seguito da «DHCP».

Nel terminale è `interface <nome> dhcp on <dispositivo>` ([riferimento](../terminal/dhcp-and-dns.md#dhcp-client)), e la risposta dice che cosa è stato assegnato alla scheda:

```ncl sample=company
pixelcake> interface eth0 dhcp on PC-Vendite
interface eth0 on PC-Vendite now takes its address from DHCP
  leased 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 by Router-Core port 1
pixelcake> show ip PC-Vendite
PC-Vendite — addressing
  ip:       192.168.10.100 (dhcp)
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  eth0: 192.168.10.100 / 255.255.255.0 gw 192.168.10.1 dns 192.168.30.10 (dhcp from Router-Core port 1)
```

`show ip` segna un indirizzo assegnato con `(dhcp)` e dice da quale intervallo viene. Scegli «Manuale» nella finestra, oppure scrivi un indirizzo con `set ip`, e la scheda esce dal DHCP.

Un router o un firewall non prende gli indirizzi dal DHCP: le sue porte si scrivono a mano.

## Chi assegna gli indirizzi {#servers}

Un server DHCP è un intervallo di indirizzi su un'interfaccia: una porta di un router o di un firewall, oppure una scheda di un server. Un intervallo assegna indirizzi della rete della sua interfaccia, quindi l'interfaccia deve prima avere un indirizzo suo.

Nella finestra del router, del firewall o del server vai nella scheda «DHCP». Sotto «Intervalli di indirizzi» spunta la porta o la scheda della rete che deve ricevere gli indirizzi: l'intervallo viene proposto, e si cambia con «Primo indirizzo» e «Ultimo indirizzo». «Gateway consegnato» è il gateway che ricevono i clienti: vuoto vuol dire l'indirizzo della porta su un router o un firewall, e nessuno su un server. «Server DNS consegnato» è il server a cui chiederanno i nomi, e può stare in un'altra rete. È la stessa scelta di «Server DHCP attivo» nel pannello della porta o della scheda. Non cambia nulla finché non premi «Salva». Nella scheda, sotto «Indirizzi assegnati», c'è chi ha preso quale indirizzo, con «Indirizzo», «Dispositivo», «Scheda» e «Assegnato da», e «Avvisi» dice che cosa non va.

Nel terminale: `interface <n> pool <primo> to <ultimo> on <dispositivo>` ([riferimento](../terminal/dhcp-and-dns.md#pool)), e `show dhcp` elenca gli intervalli e le assegnazioni di tutto il disegno, o di un dispositivo:

```ncl sample=company
pixelcake> show dhcp
DHCP — 2 pools, 2 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
  192.168.20.101   Portatile-2 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> show ip Portatile-1
Portatile-1 — addressing
  ip:       192.168.20.100 (dhcp)
  subnet:   255.255.255.0
  gateway:  192.168.20.1
  eth0: 192.168.20.100 / 255.255.255.0 gw 192.168.20.1 dns 192.168.30.10 (dhcp from Router-Core port 2)
```

Un intervallo è per una rete, e un dispositivo è servito dall'intervallo che sta sulla sua rete. Un router non gira la richiesta a un'altra rete, quindi un server della rete dei server non dà indirizzi agli uffici. Un server può invece assegnare indirizzi alla propria rete. Nella rete multinazionale lo fa il server DHCP-RM per una sede:

```ncl sample=multinational
pixelcake> show dhcp DHCP-RM
DHCP of DHCP-RM
POOLS
  DHCP-RM eth0           10.20.10.100 – 10.20.10.199  gateway 10.20.10.1  dns 10.10.100.53  8 leased, 92 free of 100
LEASES
  10.20.10.100     PC-RM-101 eth0           from DHCP-RM eth0
  10.20.10.101     PC-RM-102 eth0           from DHCP-RM eth0
  10.20.10.102     PC-RM-103 eth0           from DHCP-RM eth0
  10.20.10.103     PC-RM-104 eth0           from DHCP-RM eth0
  10.20.10.104     PC-RM-201 eth0           from DHCP-RM eth0
  10.20.10.105     PC-RM-202 eth0           from DHCP-RM eth0
  10.20.10.106     PC-RM-203 eth0           from DHCP-RM eth0
  10.20.10.107     PC-RM-204 eth0           from DHCP-RM eth0
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

Un intervallo scritto di nuovo sostituisce quello che l'interfaccia aveva, tutto intero: ciò che il nuovo non dice, il gateway e il server DNS, sparisce.

```ncl sample=company
pixelcake> interface 1 pool 192.168.10.100 to 192.168.10.149 gateway 192.168.10.1 on Router-Core
port 1 on Router-Core now hands out 192.168.10.100 to 192.168.10.149: 50 addresses, gateway 192.168.10.1
  no card on its network asks for an address yet: interface <name> dhcp on <device>
pixelcake> show dhcp Router-Core
DHCP of Router-Core
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.149  gateway 192.168.10.1  0 leased, 50 free of 50
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
  192.168.20.101   Portatile-2 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

L'intervallo della porta 1 ha perso il server DNS, perché il comando non ne indicava uno.

## Quale indirizzo {#which-address}

Il motore dà gli indirizzi alle schede nell'ordine del disegno: i dispositivi come compaiono, e le schede di ciascuno in ordine. Ogni scheda prende l'indirizzo più basso libero del suo intervallo. Un indirizzo non è libero quando:

- è scritto a mano su una qualunque interfaccia del disegno, in qualunque rete;
- è già stato dato a un'altra scheda;
- è il primo o l'ultimo indirizzo della rete.

Perciò un indirizzo scritto a mano dentro un intervallo sposta l'assegnazione che lo aveva. Qui alla stampante si dà a mano 192.168.20.100, e i due portatili scalano di uno:

```ncl sample=company
pixelcake> interface eth0 ip 192.168.20.100 on Stampante
interface eth0 on Stampante: 192.168.20.100 / 255.255.255.0
pixelcake> show dhcp
DHCP — 2 pools, 2 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 97 free of 100
LEASES
  192.168.20.101   Portatile-1 eth0         from Router-Core port 2
  192.168.20.102   Portatile-2 eth0         from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

Se due server di una stessa rete hanno ancora indirizzi liberi, risponde il primo del disegno, e «Avvisi» nella scheda «DHCP» li nomina. Quando il primo non ne ha più, ne dà uno il successivo.

## Una scheda senza indirizzo {#no-address}

Una scheda in DHCP che non trova un indirizzo ne resta senza, e ogni domanda che parte da lei o arriva a lei si ferma con il motivo. Il motivo è uno di questi:

- nessun server DHCP risponde sulla sua rete: su quella rete non c'è un intervallo, oppure non arriva alla scheda;
- l'intervallo è esaurito: tutti i suoi indirizzi sono presi (`the pool of Router-Core port 2 is used up`);
- l'interfaccia della scheda è spenta (`interface eth0 is disabled`);
- alla scheda non è attaccato nessun cavo;
- l'intervallo che risponde non è utilizzabile, per esempio perché è fuori dalla rete della sua interfaccia;
- il cavo verso il server non è attaccato a una delle sue porte, quindi non si sa quale intervallo risponde (su un firewall con le zone vedi [Le zone](firewall.md#zones));
- il dispositivo è un router o un firewall.

La finestra dice lo stesso. Nella scheda «Schede di rete» la scheda riporta `Nessun indirizzo:` seguito dal motivo, e sul disegno l'indirizzo del dispositivo è sostituito da «DHCP: nessun indirizzo» e la parte alta del disegno diventa gialla. `show dhcp` elenca queste schede sotto `WITHOUT AN ADDRESS`.

Un intervallo con un solo indirizzo, preso da un portatile, ne lascia senza l'altro:

```ncl sample=company
pixelcake> interface 2 pool 192.168.20.100 to 192.168.20.100 on Router-Core
port 2 on Router-Core now hands out 192.168.20.100 to 192.168.20.100: 1 address, gateway 192.168.20.1
  leased now: Portatile-1 192.168.20.100
pixelcake> show dhcp
DHCP — 2 pools, 1 lease
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.100  gateway 192.168.20.1  1 leased, 0 free of 1
LEASES
  192.168.20.100   Portatile-1 eth0         from Router-Core port 2
WITHOUT AN ADDRESS
  ✗ Portatile-2 eth0: the pool of Router-Core port 2 is used up: its one address is taken
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
pixelcake> ping Web-Gestionale from Portatile-2
Pinging Web-Gestionale (192.168.30.30) from Portatile-2...
Ping failed (error): request: Portatile-2 has no address: the pool of Router-Core port 2 is used up: its one address is taken
```

Un intervallo su una porta spenta non risponde a nessuno, e le schede che avevano da lui un indirizzo lo perdono:

```ncl sample=company
pixelcake> interface 2 down on Router-Core
port 2 on Router-Core is now down
pixelcake> show dhcp
DHCP — 2 pools, 0 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  0 leased, 100 free of 100  (interface down: it answers nobody)
WITHOUT AN ADDRESS
  ✗ Portatile-1 eth0: no DHCP server answers on its network
  ✗ Portatile-2 eth0: no DHCP server answers on its network
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

Una scheda disabilitata e una scheda senza cavo sono altri due casi:

```ncl sample=company
pixelcake> interface eth0 down on Portatile-1
interface eth0 on Portatile-1 is now down
pixelcake> disconnect Portatile-2 from AP-Uffici
disconnected Portatile-2 ↔ AP-Uffici
pixelcake> show dhcp
DHCP — 2 pools, 0 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  0 leased, 100 free of 100
WITHOUT AN ADDRESS
  ✗ Portatile-1 eth0: interface eth0 is disabled
  ✗ Portatile-2 eth0: interface eth0 has no cable attached
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

Quando una scheda passa al DHCP e nessuno risponde, la risposta lo dice subito:

```ncl sample=company
pixelcake> interface eth0 dhcp on Cliente-Remoto
interface eth0 on Cliente-Remoto now takes its address from DHCP
  warning: no address yet: no DHCP server answers on its network
```

## Limiti {#limits}

> [!LIMITS]
> - Niente relay. Un server assegna gli indirizzi alla rete su cui sta la sua interfaccia, e un router non gira una richiesta a un'altra rete.
> - Niente prenotazioni: un intervallo non può dare sempre lo stesso indirizzo alla stessa scheda. Lo fa un indirizzo scritto a mano sulla scheda.
> - Niente durata dell'assegnazione e niente rinnovo: l'assegnazione è una funzione del disegno. Non è salvata nel file del progetto e viene calcolata di nuovo a ogni domanda.
> - Nessuno scambio di messaggi: la richiesta, l'offerta e la conferma non si vedono. L'assegnazione c'è, oppure c'è il motivo per cui manca.
> - Un intervallo per ogni interfaccia, e insieme all'indirizzo si danno solo il gateway e il server DNS: niente nome di dominio, server dell'ora o altre opzioni.
> - La porta di un router o di un firewall non può prendere il proprio indirizzo dal DHCP.
> - Un guasto simulato in modalità presentazione non toglie l'indirizzo a chi lo aveva, nemmeno quando a spegnersi è il suo server DHCP.
