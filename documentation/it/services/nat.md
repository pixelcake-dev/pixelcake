---
title: "NAT e inoltri"
description: "Uscire su Internet con l'indirizzo di una porta, e pubblicare a quell'indirizzo un server che sta dentro."
order: 3
---

Un indirizzo privato, come 192.168.10.11, ha senso solo dentro la sua rete. Per uscire su Internet un dispositivo ha bisogno di un indirizzo pubblico, e per essere raggiunto da Internet un server deve essere pubblicato a uno. Lo fa un router o un firewall traducendo gli indirizzi (NAT): ciò che esce prende l'indirizzo di una porta, e ciò che arriva a quell'indirizzo per un servizio viene passato a un server interno.

Gli esempi usano la rete di esempio «Sede: VLAN, DMZ e firewall». Il suo firewall, FW-Edge, ha Internet alla porta 3, con l'indirizzo pubblico 203.0.113.1.

## Internet non trasporta indirizzi privati {#private}

Un simbolo Cloud il cui nome contiene Internet (`Internet`, `Internet A`) rifiuta un pacchetto la cui origine o destinazione è in un intervallo privato: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 e 169.254.0.0/16. Il motivo dice quale dei due indirizzi è, e che cosa avrebbe dovuto tradurlo. Un simbolo Cloud con un altro nome, la rete di un operatore o una linea privata, lascia passare tutto.

Perciò una rete ha bisogno del NAT per raggiungere Internet e per essere raggiunta. Qui il NAT è spento sulla porta 3 di FW-Edge. Un PC degli uffici non riesce a uscire, e Internet non riesce a raggiungere il PC:

```ncl sample=site
pixelcake> interface 3 nat off on FW-Edge
port 3 on FW-Edge no longer does NAT: what leaves by it keeps its own address
pixelcake> ping PC-Remoto from PC-Uffici-1
Pinging PC-Remoto (203.0.113.50) from PC-Uffici-1...
Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.11 has to be translated before it goes out, and NAT is off on port 3 on FW-Edge
  dropped at: Internet
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
pixelcake> trace PC-Uffici-1 from PC-Remoto
Tracing route to PC-Uffici-1 (192.168.10.11) from PC-Remoto:
  1  ○ PC-Remoto (PC)
  2  ✗ Internet (Cloud)  — Internet does not carry private addresses: 192.168.10.11 is not reachable from outside: no port forward publishes it for ping
Trace failed (blocked): Internet does not carry private addresses: 192.168.10.11 is not reachable from outside: no port forward publishes it for ping
```

## Il NAT in uscita {#source-nat}

Il NAT in uscita (source NAT) è un'impostazione di una porta. Un flusso nuovo che il router o il firewall inoltra da una porta con il NAT esce con l'indirizzo di quella porta, e il trace del dispositivo scrive `NAT: source 192.168.10.11 → 203.0.113.1`. Il dispositivo ricorda il flusso: quando la risposta torna a quell'indirizzo, viene mandata avanti al vero mittente. Una risposta non viene mai tradotta come un flusso a sé, e ciò che il dispositivo manda da sé non viene tradotto.

Per accenderlo apri la finestra del router o del firewall e vai nella scheda «NAT». Sotto «Porte con NAT» spunta la porta che guarda verso Internet. È la stessa scelta di «NAT attivo» sulla porta, nella scheda «Porte». Sono elencate solo le porte che hanno un indirizzo, perché ciò che esce prende quell'indirizzo; se nessuna porta ne ha uno la scheda lo dice e offre un pulsante per andare alla scheda «Porte». Non cambia nulla finché non premi «Salva». Nel terminale si fa con `interface <n> nat on <dispositivo>` ([riferimento](../terminal/firewall-and-nat.md#nat)).

```ncl continue
pixelcake> interface 3 nat on FW-Edge
port 3 on FW-Edge now does NAT: what leaves by it takes the address 203.0.113.1
pixelcake> trace PC-Remoto from PC-Uffici-1
Tracing route to PC-Remoto (203.0.113.50) from PC-Uffici-1:
  1  ○ PC-Uffici-1 (PC)
  2  ○ SW-Core (Switch)  — VLAN 10
  3  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 3)
  4  ○ FW-Edge (Firewall)  — routed: 203.0.113.0/24 is on port 3; firewall FW-Edge: no rule matches, zone policy trust → untrust allowed; NAT: source 192.168.10.11 → 203.0.113.1
  5  ○ Internet (Cloud)  — Internet is not simulated: traffic assumed to pass
  6  ● PC-Remoto (PC)
  note: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
  note: Internet is not simulated: traffic assumed to pass
Trace complete: destination reached.
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
```

Il trace mostra la traduzione a FW-Edge, nella stessa riga della rotta e della decisione del firewall. Lo stesso lo può fare un router, e la porta deve avere un indirizzo:

```ncl sample=office
pixelcake> show nat Router-1
NAT of Router-1
  no interface does NAT: what leaves keeps its own address
FORWARDS (the first that matches is taken)
  none: from outside only the device itself is reached
pixelcake> interface 3 nat on Router-1
port 3 on Router-1 now does NAT
  it has no address yet: nothing is translated until it has one (interface 3 ip <address>)
pixelcake> show nat Router-1
NAT of Router-1
  interface 3   has no address: it translates nothing
FORWARDS (the first that matches is taken)
  none: from outside only the device itself is reached
```

## Gli inoltri {#forwards}

Il NAT in uscita serve a chi esce. Perché qualcuno da fuori raggiunga un server interno, il server si pubblica: un inoltro (port forward) dice che ciò che arriva all'indirizzo di una porta, per un servizio, viene mandato a un indirizzo interno. Nella scheda «NAT», sotto «Servizi pubblicati (port forward)», premi «Aggiungi inoltro» e compila la riga: «Servizio» («Web», «Email», «DNS», «Ping» o «Qualsiasi»), «Arriva sulla porta» e «Va all'indirizzo». Nel terminale: `add forward <servizio> from interface <n> to <indirizzo> on <dispositivo>` ([riferimento](../terminal/firewall-and-nat.md#add-forward)).

Chi sta fuori manda la richiesta all'indirizzo della porta, e la risposta torna da quell'indirizzo: quello interno non lo vede mai. FW-Edge pubblica il server web della DMZ a 203.0.113.1:

```ncl sample=site
pixelcake> browse Web-Pubblico from PC-Remoto
Browsing Web-Pubblico (203.0.113.1) from PC-Remoto...
  ✓ HTTP request: PC-Remoto → Web-Pubblico
  ✓ HTTP response: Web-Pubblico → PC-Remoto
Page received from Web-Pubblico
  note: HTTP request: Web-Pubblico is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed
  note: HTTP response: Internet is not simulated: traffic assumed to pass
pixelcake> ping Web-Pubblico from PC-Remoto
Pinging Web-Pubblico (172.16.0.10) from PC-Remoto...
Ping failed (blocked): request: Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
  dropped at: Internet
pixelcake> trace 172.16.0.10 from PC-Remoto as web
Tracing route to Web-Pubblico (172.16.0.10) from PC-Remoto as web:
  1  ○ PC-Remoto (PC)
  2  ✗ Internet (Cloud)  — Internet does not carry private addresses: 172.16.0.10 is reached from outside at 203.0.113.1, where FW-Edge publishes it (port forward 1)
Trace failed (blocked): Internet does not carry private addresses: 172.16.0.10 is reached from outside at 203.0.113.1, where FW-Edge publishes it (port forward 1)
```

Per nome il browser chiede Web-Pubblico e viene mandato a 203.0.113.1, dove il server web è pubblicato; la nota lo dice. Un ping allo stesso nome non trova un inoltro per il ping, e Internet rifiuta 172.16.0.10. Un indirizzo scritto nel comando è l'indirizzo a cui si mira, e non se ne prova nessun altro al suo posto: l'ultimo comando, con l'indirizzo interno scritto, viene rifiutato, e il motivo dice dove il server è pubblicato.

Gli inoltri si leggono dall'alto, come le regole: si prende il primo che corrisponde a servizio e porta. Un secondo inoltro per lo stesso servizio e la stessa porta è permesso, ma vale il primo, e il terminale avvisa:

```ncl sample=site
pixelcake> add forward web from interface 3 to 172.16.0.99 on FW-Edge
FW-Edge: forward 2 added — forward web from interface 3 to 172.16.0.99
  from outside it is reached at 203.0.113.1
  warning: forward 1 comes first for the same interface and service
  a firewall also needs a rule that lets it in: add rule allow web from untrust to 172.16.0.99 on FW-Edge
pixelcake> show nat FW-Edge
NAT of FW-Edge
  interface 3   what leaves by it takes the address 203.0.113.1
FORWARDS (the first that matches is taken)
   1  web    from interface 3   (203.0.113.1) to 172.16.0.10
   2  web    from interface 3   (203.0.113.1) to 172.16.0.99
```

## Con le regole di un firewall {#with-rules}

Su un firewall l'inoltro dice dove va il traffico. Non dice che può passare. Serve anche una regola, e il firewall vede il pacchetto con la destinazione già tradotta: la regola nomina l'indirizzo interno, non quello pubblico. Anche l'origine non è ancora tradotta: una regola nomina sempre indirizzi veri, oppure una zona.

Nella rete di esempio la regola che fa entrare il web è la prima. Senza di essa la politica delle zone nega untrust → dmz. Riscrivendola per il server, con il suo nome (il terminale ne salva l'indirizzo), la pagina torna:

```ncl sample=site
pixelcake> remove rule 1 from FW-Edge
FW-Edge: rule 1 removed — allow web from untrust to 172.16.0.10
pixelcake> browse Web-Pubblico from PC-Remoto
Browsing Web-Pubblico (203.0.113.1) from PC-Remoto...
  ✗ HTTP request: PC-Remoto → Web-Pubblico
Browse failed (blocked): HTTP request: firewall policy on FW-Edge: untrust → dmz denied
  dropped at: FW-Edge
  note: HTTP request: Web-Pubblico is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
pixelcake> add rule allow web from untrust to Web-Pubblico on FW-Edge
FW-Edge: rule 1 added — allow web from untrust to 172.16.0.10
  Web-Pubblico → 172.16.0.10
pixelcake> browse Web-Pubblico from PC-Remoto
Browsing Web-Pubblico (203.0.113.1) from PC-Remoto...
  ✓ HTTP request: PC-Remoto → Web-Pubblico
  ✓ HTTP response: Web-Pubblico → PC-Remoto
Page received from Web-Pubblico
  note: HTTP request: Web-Pubblico is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: HTTP request: Internet is not simulated: traffic assumed to pass
  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → untrust allowed
  note: HTTP response: Internet is not simulated: traffic assumed to pass
```

Il terminale lo ricorda quando pubblichi qualcosa su un firewall:

```ncl sample=site
pixelcake> add forward email from interface 3 to Srv-Interno on FW-Edge
FW-Edge: forward 2 added — forward email from interface 3 to 192.168.20.10
  Srv-Interno → 192.168.20.10
  from outside it is reached at 203.0.113.1
  a firewall also needs a rule that lets it in: add rule allow email from untrust to 192.168.20.10 on FW-Edge
```

## Limiti {#limits}

> [!LIMITS]
> - Un inoltro è un servizio su una porta, non un numero di porta. Il motore non ha porte TCP o UDP: un flusso è un ping, il web, la posta o il DNS, e due flussi non competono mai per una traduzione. Non c'è la traduzione delle porte, e due server non si possono pubblicare sullo stesso servizio di un indirizzo: vale il primo inoltro.
> - Il NAT in uscita dà l'indirizzo della porta. Non ci sono insiemi di indirizzi, né NAT uno a uno, né la scelta dell'indirizzo.
> - Un server raggiunto da dentro al suo indirizzo pubblicato non è trattato a parte rispetto a ogni altra richiesta a quell'indirizzo.
> - Un dispositivo dietro due strati di NAT si trova per nome solo attraverso il primo.
> - Non c'è una tabella delle traduzioni da leggere, né scadenze, né un limite ai flussi aperti.
> - Internet non è simulata: un simbolo Cloud chiamato Internet rifiuta gli indirizzi privati e lascia passare tutto il resto.
