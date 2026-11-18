---
title: "Rotte statiche e di riserva"
description: "Come un router sceglie dove mandare un pacchetto, le rotte che scrivi, la rotta predefinita, e la rotta di riserva che subentra quando una linea è giù."
order: 1
---

Un router decide dove mandare un pacchetto cercando la destinazione in una tabella. In PixelCake la tabella è formata dalle reti a cui il router è collegato, delle rotte che scrivi e di una rotta predefinita per tutto il resto. Quando due rotte portano alla stessa rete si usa la prima, e la seconda resta in attesa come riserva.

## La tabella di instradamento {#routing-table}

Ogni router e ogni firewall ha una tabella di instradamento, e il motore la legge ogni volta che un pacchetto ci passa. Ce l'ha anche un PC, ma non ci si possono scrivere rotte: le sue righe sono la rete e il gateway di ciascuna delle sue schede di rete ([Indirizzi e gateway](../building/addresses.md#end-devices)), e `show routes` le stampa. Le righe sono di tre tipi:

- **collegata**: una rete in cui sta una porta del dispositivo. Non serve scriverla: basta dare un indirizzo alla porta ([Le porte di un router](../building/addresses.md#router-ports)).
- **statica**: una rotta scritta da te, con una rete e un prossimo salto.
- **predefinita**: la rotta per tutti gli indirizzi che nessun'altra riga contiene.

Se più righe contengono la destinazione, vince la più specifica, cioè quella con la maschera più lunga: una /24 prima di una /16, e tutte e due prima della rotta predefinita, che è /0. A parità di maschera, la collegata viene prima della statica e la statica prima della predefinita.

Per vedere la tabella apri con un doppio clic la finestra di un router o di un firewall, poi la scheda «Rotte». Sotto «Tabella di instradamento» ci sono le righe che il motore legge: «Destinazione», «Prossimo salto», «Esce da» e «Tipo», comprese le modifiche non ancora salvate. Nel terminale `show routes` stampa la stessa tabella. La rete di esempio «Due sedi: linea principale e di riserva» ha il router della sede, R-Sede, unito alla filiale da una linea principale e, passando per un terzo router, da una linea di riserva.

![Le due sedi. A sinistra la sede: R-Sede sopra SW-Core, con il file server e due switch di piano con un PC ciascuno. A destra la filiale: R-Filiale sopra SW-Filiale, con due PC. Una linea punteggiata, la linea principale, unisce R-Sede e R-Filiale. Una linea tratteggiata, la linea di riserva, sale da R-Sede a R-Riserva e scende a R-Filiale.](../../media/routes/two-sites.it.svg "Le due sedi: la linea principale tra R-Sede e R-Filiale, punteggiata, e la linea di riserva passando da R-Riserva, tratteggiata.")

La tabella di R-Sede:

```ncl sample=two-sites
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
```

Le prime tre righe sono reti collegate, ciascuna con la porta da cui si raggiunge. Le ultime due portano alla rete della filiale, 192.168.2.0/24, con due prossimi salti diversi: la seconda è una riserva ([più avanti](#backup)).

## Scrivere una rotta {#static}

Una rotta statica è una rete e un prossimo salto: l'indirizzo del router che sta più vicino a quella rete. Nella finestra del router, nella scheda «Rotte», premi «Aggiungi rotta» sotto «Rotte statiche». Scrivi la rete con la sua maschera in «Rete di destinazione», per esempio `192.168.2.0/24`, l'indirizzo in «Prossimo salto» e, se vuoi un promemoria, una «Nota». Non cambia nulla finché non premi «Salva». Una riga lasciata vuota non viene salvata, e una destinazione che non è una rete viene rifiutata: scrivila come `192.168.30.0/24`, oppure come `default`.

Il prossimo salto deve stare in una rete a cui il router è collegato. Se non ci sta, la riga resta nella tabella, segnata come non utilizzabile, e il router la salta, come fa uno vero: il traffico per la sua rete prende la rotta successiva verso la stessa rete, o la rotta predefinita, e la risposta lo dice in una nota. Se non c'è un'altra strada, il pacchetto si ferma sul router con quel motivo. Il terminale avvisa quando la scrivi:

```ncl sample=two-sites
pixelcake> add route 192.168.9.0/24 via 10.0.9.9 on R-Sede
R-Sede: route to 192.168.9.0/24 via 10.0.9.9 added
  warning: 10.0.9.9 is on none of the networks of R-Sede: the route cannot be used yet
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
192.168.9.0/24       10.0.9.9         ?        static  ✗ next hop on none of its networks
```

Le rotte stanno sui router e sui firewall. Il terminale rifiuta `add route` su un PC e spiega che un dispositivo finale ha una sola uscita, il suo gateway.

Una seconda rotta verso una rete che ne ha già una non aggiunge una riga: cambia il prossimo salto della prima (per una seconda riga vedi [Rotte di riserva](#backup)). Qui la rotta verso la filiale viene tolta e riscritta, una volta per ciascun prossimo salto:

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 from R-Sede
R-Sede: 2 routes to 192.168.2.0/24 removed
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Ping failed (blocked): request: R-Sede has no route to 192.168.2.11
  dropped at: R-Sede
pixelcake> add route 192.168.2.0/24 via 10.0.0.2 on R-Sede
R-Sede: route to 192.168.2.0/24 via 10.0.0.2 added
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Reply from 192.168.2.11: hops=7 time=11ms
pixelcake> add route 192.168.2.0/24 via 10.0.1.2 on R-Sede
R-Sede: route to 192.168.2.0/24 now goes via 10.0.1.2 (was 10.0.0.2)
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
```

### La strada del ritorno {#return-path}

Una domanda è uno scambio: la richiesta va, la risposta torna, e la risposta è un pacchetto che ogni router lungo la strada deve saper instradare. Una rotta in un solo verso non basta.

```ncl sample=two-sites
pixelcake> remove route 192.168.1.0/24 from R-Filiale
R-Filiale: 2 routes to 192.168.1.0/24 removed
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Ping failed (blocked): reply: R-Filiale has no route to 192.168.1.11
  dropped at: R-Filiale
pixelcake> add route 192.168.1.0/24 via R-Sede on R-Filiale
R-Filiale: route to 192.168.1.0/24 via 10.0.0.1 added
  R-Sede → 10.0.0.1
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Reply from 192.168.2.11: hops=7 time=11ms
```

La richiesta è arrivata alla filiale. La risposta non è riuscita a ripartire da R-Filiale, e il motivo dice quale router non aveva la rotta e per quale indirizzo.

## La rotta predefinita {#default-route}

Una rotta verso `default` prende tutte le destinazioni che nessun'altra riga contiene. Si dà a un router che ha una sola uscita e molte reti al di là. Su un router il gateway è la sua rotta predefinita: il campo «Gateway» della scheda «Generale», oppure `set gateway of <router> to <indirizzo>` nel terminale. La tabella lo indica con `default (gateway)`. Anche una rotta scritta nella scheda «Rotte» con `default` come destinazione è una rotta predefinita, e la tabella la indica con `default`.

Nella rete di esempio R-Filiale raggiunge la sede passando da R-Sede. Le due rotte verso 192.168.1.0/24 vengono sostituite da una sola rotta predefinita:

```ncl sample=two-sites
pixelcake> remove route 192.168.1.0/24 from R-Filiale
R-Filiale: 2 routes to 192.168.1.0/24 removed
pixelcake> add route default via R-Sede on R-Filiale
R-Filiale: route to default via 10.0.0.1 added
  R-Sede → 10.0.0.1
pixelcake> show routes R-Filiale
ROUTES of R-Filiale
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.2.0/30          -                port 3   connected
192.168.2.0/24       -                port 1   connected
default              10.0.0.1         port 2   default
pixelcake> trace PC-Sede-1 from PC-Filiale-1
Tracing route to PC-Sede-1 (192.168.1.11) from PC-Filiale-1:
  1  ○ PC-Filiale-1 (PC)
  2  ○ SW-Filiale (Switch)
  3  ○ R-Filiale (Router)  — routed: default route via 10.0.0.1 (port 2)
  4  ○ R-Sede (Router)  — routed: 192.168.1.0/24 is on port 1
  5  ○ SW-Core (Switch)
  6  ○ SW-Piano-1 (Switch)
  7  ● PC-Sede-1 (PC)
Trace complete: destination reached.
```

La rotta più specifica vince comunque su quella predefinita. Qui R-Sede riceve una rotta predefinita verso R-Riserva, e il traffico per la filiale tiene la rotta scritta apposta:

```ncl sample=two-sites
pixelcake> add route default via R-Riserva on R-Sede
R-Sede: route to default via 10.0.1.2 added
  R-Riserva → 10.0.1.2
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
default              10.0.1.2         port 3   default
pixelcake> trace PC-Filiale-1 from PC-Sede-1
Tracing route to PC-Filiale-1 (192.168.2.11) from PC-Sede-1:
  1  ○ PC-Sede-1 (PC)
  2  ○ SW-Piano-1 (Switch)
  3  ○ SW-Core (Switch)
  4  ○ R-Sede (Router)  — routed: 192.168.2.0/24 via 10.0.0.2 (port 2)
  5  ○ R-Filiale (Router)  — routed: 192.168.2.0/24 is on port 1
  6  ○ SW-Filiale (Switch)
  7  ● PC-Filiale-1 (PC)
Trace complete: destination reached.
```

## Rotte di riserva {#backup}

Se scrivi due rotte verso la stessa rete, la prima è quella in uso. La seconda è di riserva: subentra quando l'interfaccia della prima non ha più un cavo che funzioni. Nella scheda «Rotte» premi di nuovo «Aggiungi rotta», con la stessa «Rete di destinazione» e un altro «Prossimo salto», sotto la prima riga. Nel terminale:

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 from R-Sede
R-Sede: 2 routes to 192.168.2.0/24 removed
pixelcake> add route 192.168.2.0/24 via 10.0.0.2 on R-Sede
R-Sede: route to 192.168.2.0/24 via 10.0.0.2 added
pixelcake> add backup route 192.168.2.0/24 via 10.0.1.2 on R-Sede
R-Sede: backup route to 192.168.2.0/24 via 10.0.1.2 added
  used when the interface of the route via 10.0.0.2 has no working link
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static
192.168.2.0/24       10.0.1.2         port 3   static, backup
```

`show routes` indica la seconda riga con `static, backup`.

La riserva si usa quando la porta della rotta principale è spenta, o quando la sua linea è caduta. La linea è caduta quando la porta all'altro capo è spenta, quando il cavo è tagliato, o quando il dispositivo all'altro capo è spento; le ultime due cose si simulano in [modalità presentazione](../asking/presentation.md#failures), dove basta un clic sul cavo e «Simula un guasto». Il router si comporta allora come uno vero che perde il segnale: ritira la rotta che esce da quella porta e usa la successiva. Il `trace` lo dice in una nota, per esempio: `R-Sede: the route 192.168.2.0/24 via 10.0.0.2 is unusable (link R-Sede–R-Filiale is down), the route 192.168.2.0/24 via 10.0.1.2 is used instead`.

Lo stesso vale per due rotte predefinite, e per un PC con un gateway su ciascuna di due schede di rete.

Basta spegnere un capo della linea. Anche il router all'altro capo perde il segnale, e prende la sua rotta di riserva: la richiesta e la risposta passano tutte e due da R-Riserva.

```ncl sample=two-sites
pixelcake> interface 2 down on R-Sede
port 2 on R-Sede is now down
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Reply from 192.168.2.11: hops=8 time=13ms
  note: reply: R-Filiale: the route 192.168.1.0/24 via 10.0.0.1 is unusable (port 2 on R-Sede is disabled), the route 192.168.1.0/24 via 10.0.2.1 is used instead
```

Dal terminale la strada si segue meglio con un `trace`, e con le tabelle di instradamento dei due router:

```ncl sample=two-sites
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
pixelcake> show routes R-Sede
ROUTES of R-Sede
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected  (interface down)
10.0.1.0/30          -                port 3   connected
192.168.1.0/24       -                port 1   connected
192.168.2.0/24       10.0.0.2         port 2   static  (interface down)
192.168.2.0/24       10.0.1.2         port 3   static, backup
pixelcake> show routes R-Filiale
ROUTES of R-Filiale
DESTINATION          VIA              OUT      KIND
10.0.0.0/30          -                port 2   connected  (no link: port 2 on R-Sede is disabled)
10.0.2.0/30          -                port 3   connected
192.168.2.0/24       -                port 1   connected
192.168.1.0/24       10.0.0.1         port 2   static  (no link: port 2 on R-Sede is disabled)
192.168.1.0/24       10.0.2.1         port 3   static, backup
```

Un cavo tagliato in una presentazione fa lo stesso, per tutti e due i router.

## Quando le rotte non concordano {#loops}

Due router possono mandarsi il pacchetto a vicenda, ciascuno convinto che l'altro sia più vicino. Il motore se ne accorge quando un pacchetto torna a un router da cui era già passato, e lo ferma:

```ncl sample=two-sites
pixelcake> remove route 192.168.2.0/24 from R-Sede
R-Sede: 2 routes to 192.168.2.0/24 removed
pixelcake> remove route 192.168.2.0/24 from R-Riserva
R-Riserva: route to 192.168.2.0/24 removed
pixelcake> add route default via R-Riserva on R-Sede
R-Sede: route to default via 10.0.1.2 added
  R-Riserva → 10.0.1.2
pixelcake> add route default via R-Sede on R-Riserva
R-Riserva: route to default via 10.0.1.1 added
  R-Sede → 10.0.1.1
pixelcake> trace PC-Filiale-1 from PC-Sede-1
Tracing route to PC-Filiale-1 (192.168.2.11) from PC-Sede-1:
  1  ○ PC-Sede-1 (PC)
  2  ○ SW-Piano-1 (Switch)
  3  ○ SW-Core (Switch)
  4  ○ R-Sede (Router)  — routed: default route via 10.0.1.2 (port 3)
  5  ○ R-Riserva (Router)  — routed: default route via 10.0.1.1 (port 1)
  6  ✗ R-Sede (Router)  — routing loop: the packet comes back to R-Sede
Trace failed (blocked): routing loop: the packet comes back to R-Sede
```

## Limiti {#limits}

> [!LIMITS]
> - Non c'è il routing dinamico: né RIP, né OSPF, né BGP. Nessuna rotta viene imparata o annunciata; ogni rotta è scritta a mano.
> - Due rotte verso la stessa rete non si dividono il traffico. Si usa la prima, e la seconda solo quando l'interfaccia della prima non ha un cavo che funzioni. Non ci sono metriche né distanze da confrontare.
> - Conta solo ciò che è collegato alla porta. Un prossimo salto che si spegne dietro uno switch non fa cadere l'interfaccia: la rotta resta e il traffico si perde lì, come con ogni rotta statica.
> - Un prossimo salto è un indirizzo, non un'interfaccia. Non ci sono rotte attraverso una porta, né instradamento per criteri, né sottointerfacce su una porta.
> - Una porta spenta si vede solo dall'altro capo del suo cavo. Con uno switch tra i due router, quello oltre lo switch non se ne accorge, come per ogni linea che cade dietro uno switch.
> - Un guasto simulato in modalità presentazione non cambia nulla nel disegno.
