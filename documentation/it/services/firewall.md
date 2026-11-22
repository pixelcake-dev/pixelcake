---
title: "Zone e regole del firewall"
description: "Le zone di sicurezza sulle porte di un firewall, la politica delle zone e le regole in ordine che fanno eccezione."
order: 2
---

In PixelCake un firewall decide su ogni pacchetto che lo attraversa. Ha due strumenti: la zona di sicurezza di ciascuna porta e un elenco di regole. Senza regole decidono le zone, con una politica fissa. Una regola fa un'eccezione alla politica, e decide la prima regola che corrisponde.

Gli esempi di questa pagina usano la rete di esempio «Sede: VLAN, DMZ e firewall». Il suo firewall, FW-Edge, ha gli uffici dietro la porta 1, una DMZ con un server web dietro la porta 2 e Internet alla porta 3.

![La rete di esempio della sede. FW-Edge sta al centro, con tre cavi. Uno sale verso il simbolo Internet e PC-Remoto, nel riquadro Internet. Uno va a sinistra verso Router-Core, che ha dietro SW-Core, due PC e Srv-Interno, nel riquadro Rete interna. Uno va a destra verso SW-DMZ e Web-Pubblico, nel riquadro DMZ.](../../media/firewall/zones.it.svg "La rete di esempio della sede. Le tre porte di FW-Edge sono rivolte verso la rete interna (trust), la DMZ (dmz) e Internet (untrust).")

## Le zone {#zones}

Una zona dice quanto ci si fida di una rete. Sono tre, e una porta sta in una di esse oppure in nessuna:

- **trust**: la rete che il firewall protegge, gli uffici.
- **dmz**: una rete di server raggiunti da fuori, tenuta separata dagli uffici.
- **untrust**: l'esterno, Internet.

La zona appartiene alla porta, non al dispositivo né al cavo. Nella finestra del firewall apri la scheda «Porte», scegli la porta e imposta «Zona di sicurezza»: «Nessuna», «Trust (rete fidata)», «Untrust (rete non fidata)» oppure «DMZ (zona demilitarizzata)». Non cambia nulla finché non premi «Salva». Nel terminale si fa con `interface <n> zone <zona> on <firewall>` ([riferimento](../terminal/firewall-and-nat.md#zone)); `show ports` ha una colonna apposita:

```ncl sample=site
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 3)
2      up         dmz      -          dmz      172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
```

La «Modalità della porta» (LAN, WAN o DMZ) è un'etichetta e non decide nulla: su un firewall conta la zona di sicurezza.

Il motore deve sapere a quale porta è collegato un cavo, per sapere da quale zona entra un pacchetto e da quale esce. Una connessione disegnata verso un firewall che ha delle zone non viene assegnata a una porta da sola: la porta, e con essa la zona, si sceglie nella finestra della connessione. Fai clic destro sulla connessione, scegli «Modifica connessione» e, sotto «Interfacce», scegli la porta nell'elenco intitolato `Interfaccia su FW-Edge`. Un'estremità non assegnata non ha una zona: una regola che nomina una zona viene saltata, e il `trace` lo dice in una nota.

Una porta con «Nessuna» come zona è lo stesso: niente zona, niente politica. Lì una regola che nomina una zona viene saltata, con la stessa nota. Senza la zona di entrambi i lati non può decidere nemmeno la [politica delle zone](#policy), e che cosa succede allora dipende dalle regole. Un firewall senza regole attive lascia passare il pacchetto, con la nota `has no zone binding: allowed`. Un firewall che ne ha una chiude la sua lista come [fa un router](#router): ciò che nessuna regola permette viene bloccato. Il motivo nomina il lato senza zona, e le regole saltate per questo, cioè che cosa sistemare. FW-Edge ha una regola, quindi con la porta 2 senza zona la pagina chiesta dagli uffici si ferma lì:

```ncl sample=site
pixelcake> interface 2 zone none on FW-Edge
port 2 on FW-Edge is in no security zone now
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 3)
2      up         dmz      -          -        172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
pixelcake> browse Web-Pubblico from PC-Uffici-1
Browsing Web-Pubblico (172.16.0.10) from PC-Uffici-1...
  ✗ HTTP request: PC-Uffici-1 → Web-Pubblico
Browse failed (blocked): HTTP request: firewall FW-Edge: no rule allows it, and the zone policy cannot decide: port 2 is in no zone
  dropped at: FW-Edge
```

Una regola che lascia entrare gli uffici nella DMZ non serve finché la porta 2 non ha una zona: nomina una zona, quindi viene saltata, e il motivo lo dice:

```ncl continue
pixelcake> add rule allow web from trust to dmz on FW-Edge
FW-Edge: rule 2 added — allow web from trust to dmz
  no port of FW-Edge is in zone dmz yet: interface <n> zone dmz on FW-Edge
pixelcake> browse Web-Pubblico from PC-Uffici-1
Browsing Web-Pubblico (172.16.0.10) from PC-Uffici-1...
  ✗ HTTP request: PC-Uffici-1 → Web-Pubblico
Browse failed (blocked): HTTP request: firewall FW-Edge: no rule allows it, and neither rule 2, which names a zone, nor the zone policy can decide: port 2 is in no zone
  dropped at: FW-Edge
  note: HTTP request: firewall FW-Edge: rule 2 names a zone and port 2 is in no zone: skipped
```

Con la porta di nuovo nella sua zona la regola viene letta, e la pagina arriva:

```ncl continue
pixelcake> interface 2 zone dmz on FW-Edge
port 2 on FW-Edge is now in zone dmz
pixelcake> browse Web-Pubblico from PC-Uffici-1
Browsing Web-Pubblico (172.16.0.10) from PC-Uffici-1...
  ✓ HTTP request: PC-Uffici-1 → Web-Pubblico
  ✓ HTTP response: Web-Pubblico → PC-Uffici-1
Page received from Web-Pubblico
  note: HTTP request: firewall FW-Edge: allowed by rule 2 (allow web from trust to dmz)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

## La politica delle zone {#policy}

Quando nessuna regola decide, decidono le zone. Un flusso nuovo verso una zona più fidata è negato, e il resto passa:

| Da | A | Un flusso nuovo è |
|---|---|---|
| untrust | trust | negato |
| untrust | dmz | negato |
| dmz | trust | negato |
| ogni altra coppia, anche una zona verso sé stessa | | permesso |

Gli uffici raggiungono la DMZ e Internet. La DMZ non raggiunge gli uffici, e Internet non raggiunge né gli uni né l'altra. La risposta dice di quale coppia si tratta:

```ncl sample=site
pixelcake> trace Web-Pubblico from PC-Uffici-1
Tracing route to Web-Pubblico (172.16.0.10) from PC-Uffici-1:
  1  ○ PC-Uffici-1 (PC)
  2  ○ SW-Core (Switch)  — VLAN 10
  3  ○ Router-Core (Router)  — routed: default route via 10.0.0.2 (port 3)
  4  ○ FW-Edge (Firewall)  — routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  5  ○ SW-DMZ (Switch)
  6  ● Web-Pubblico (Server)
  note: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
Trace complete: destination reached.
pixelcake> trace PC-Uffici-1 from Web-Pubblico
Tracing route to PC-Uffici-1 (192.168.10.11) from Web-Pubblico:
  1  ○ Web-Pubblico (Server)
  2  ○ SW-DMZ (Switch)
  3  ✗ FW-Edge (Firewall)  — firewall FW-Edge: no rule matches, zone policy dmz → trust denied
Trace failed (blocked): firewall FW-Edge: no rule matches, zone policy dmz → trust denied
```

Senza regole il motivo è `firewall policy on FW-Edge: dmz → trust denied`; con regole che non corrispondono, `firewall FW-Edge: no rule matches, zone policy dmz → trust denied`. La scheda «Regole» lo dice sotto «Quando nessuna regola corrisponde». Dove la zona di un lato non è nota, un firewall con regole invece blocca, e il motivo dice perché la politica non ha potuto decidere: `firewall FW-Edge: no rule allows it, and the zone policy cannot decide: port 2 is in no zone` ([Zone](#zones)).

## Le regole {#rules}

Una regola fa un'eccezione alla politica: lascia entrare ciò che la politica nega, o tiene fuori ciò che permette. Nella finestra del firewall apri la scheda «Regole». Sotto «Regole del firewall» premi «Aggiungi regola» e compila la riga:

- «Azione»: «Permetti» oppure «Nega».
- «Servizio»: «Ping», «Web», «Email», «DNS» oppure «Qualsiasi».
- «Da» e «A»: `any`, una zona (`trust`, `untrust`, `dmz`), un indirizzo, o una rete come `192.168.10.0/24`. Ogni altro nome viene rifiutato.
- «Attiva»: una regola senza la spunta viene saltata.

«Sposta in su» e «Sposta in giù» cambiano l'ordine; «Elimina la regola» elimina una riga. Il numero della prima colonna è quello che usano il terminale e `trace`.

Le regole si leggono dall'alto. La prima regola attiva in cui servizio, partenza e destinazione corrispondono decide, e quelle dopo non vengono lette. Se nessuna corrisponde, decide la politica. «Da» è la partenza del pacchetto e «A» la sua destinazione, come le vede il firewall: una zona corrisponde alla zona della porta da cui il pacchetto entra, o da cui esce.

Nella rete di esempio gli uffici raggiungono il server web della DMZ, come dice la politica. Qui si aggiunge in fondo una regola che nega il web verso la DMZ a un solo PC degli uffici, quello con l'indirizzo 192.168.10.12. L'altro PC non ne è toccato:

```ncl sample=site
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  without a zone on both sides (a link not attached to a port, a port in no zone): what no rule allows is blocked
  the reply to a flow it allowed passes
pixelcake> add rule deny web from 192.168.10.12 to dmz on FW-Edge
FW-Edge: rule 2 added — deny web from 192.168.10.12 to dmz
pixelcake> browse Web-Pubblico from PC-Uffici-2
Browsing Web-Pubblico (172.16.0.10) from PC-Uffici-2...
  ✗ HTTP request: PC-Uffici-2 → Web-Pubblico
Browse failed (blocked): HTTP request: firewall FW-Edge: denied by rule 2 (deny web from 192.168.10.12 to dmz)
  dropped at: FW-Edge
pixelcake> browse Web-Pubblico from PC-Uffici-1
Browsing Web-Pubblico (172.16.0.10) from PC-Uffici-1...
  ✓ HTTP request: PC-Uffici-1 → Web-Pubblico
  ✓ HTTP response: Web-Pubblico → PC-Uffici-1
Page received from Web-Pubblico
  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

PC-Uffici-2 è fermato dalla regola 2, e la risposta la nomina. Ora si scrive un'eccezione sopra di essa, in posizione 1, per lo stesso indirizzo:

```ncl continue
pixelcake> add rule 1 allow web from 192.168.10.12 to 172.16.0.10 on FW-Edge
FW-Edge: rule 1 added — allow web from 192.168.10.12 to 172.16.0.10
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from 192.168.10.12      to 172.16.0.10
   2  allow web    from untrust            to 172.16.0.10
   3  deny  web    from 192.168.10.12      to dmz
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  without a zone on both sides (a link not attached to a port, a port in no zone): what no rule allows is blocked
  the reply to a flow it allowed passes
pixelcake> browse Web-Pubblico from PC-Uffici-2
Browsing Web-Pubblico (172.16.0.10) from PC-Uffici-2...
  ✓ HTTP request: PC-Uffici-2 → Web-Pubblico
  ✓ HTTP response: Web-Pubblico → PC-Uffici-2
Page received from Web-Pubblico
  note: HTTP request: firewall FW-Edge: allowed by rule 1 (allow web from 192.168.10.12 to 172.16.0.10)
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

Lo stesso indirizzo corrisponde ora alla regola 1 prima di arrivare alla 3, e la pagina si apre. L'ordine è tutto: un'eccezione sta sopra la regola a cui fa eccezione, e una regola che prende tutto sta in fondo.

La scheda «Regole» avvisa quando una regola nomina una zona in cui non c'è nessuna porta: una regola così non corrisponde mai.

## Le risposte {#replies}

Un firewall tiene lo stato. Quando ha lasciato passare una richiesta, ne lascia passare la risposta, qualunque cosa dicano le regole e la politica sui flussi nuovi nell'altro verso. Altrimenti la risposta di un server su Internet sarebbe un flusso nuovo verso una zona più fidata, e la politica la negherebbe. La nota lo dice:

```ncl sample=site
pixelcake> ping Web-Pubblico from PC-Uffici-1
Pinging Web-Pubblico (172.16.0.10) from PC-Uffici-1...
Reply from 172.16.0.10: hops=6 time=0.84ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: reply: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

Nemmeno una regola che nega quel verso ferma la risposta. Qui la prima regola nega tutto dalla DMZ verso gli uffici, e gli uffici ricevono comunque la pagina:

```ncl sample=site
pixelcake> add rule 1 deny any from dmz to trust on FW-Edge
FW-Edge: rule 1 added — deny any from dmz to trust
pixelcake> browse Web-Pubblico from PC-Uffici-1
Browsing Web-Pubblico (172.16.0.10) from PC-Uffici-1...
  ✓ HTTP request: PC-Uffici-1 → Web-Pubblico
  ✓ HTTP response: Web-Pubblico → PC-Uffici-1
Page received from Web-Pubblico
  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: HTTP response: firewall FW-Edge: reply to an allowed flow passes rule 1 (deny any from dmz to trust)
```

La regola vale per i flussi nuovi che cominciano nella DMZ. La risposta a un flusso cominciato negli uffici non lo è.

Ogni firewall ricorda solo i flussi che ha visto lui stesso. Una risposta che torna per una strada diversa da quella della sua richiesta, attraverso un firewall che la richiesta non ha attraversato, per quel firewall è un flusso nuovo: decidono le sue regole e la sua politica delle zone, come per ogni pacchetto. Quando la negano, il motivo finisce con `and it never saw the request`, per esempio `reply: firewall FW-B: no rule matches, zone policy untrust → trust denied, and it never saw the request`. Con due firewall affiancati servono rotte che rimandino la risposta per la strada da cui è venuta la richiesta.

## Il firewall stesso {#itself}

Ciò che è diretto al firewall stesso non viene filtrato. Qui una regola nega tutto da Internet, e il firewall risponde comunque a un ping sul suo indirizzo esterno:

```ncl sample=site
pixelcake> add rule deny any from untrust to any on FW-Edge
FW-Edge: rule 2 added — deny any from untrust to any
pixelcake> ping 203.0.113.1 from PC-Remoto
Pinging FW-Edge (203.0.113.1) from PC-Remoto...
Reply from 203.0.113.1: hops=3 time=39ms
  note: request: Internet is not simulated: traffic assumed to pass
  note: reply: Internet is not simulated: traffic assumed to pass
```

Le regole giudicano solo ciò che attraversa il firewall. L'amministrazione del firewall non è simulata.

## Regole su un router {#router}

Anche un router può avere delle regole: la sua lista di accesso. La finestra di un router ha la stessa scheda «Regole», con lo stesso editor, e il terminale accetta `add rule` e `show rules` su un router come su un firewall. Le regole si leggono allo stesso modo, dall'alto in basso, su ciò che il router instrada. Un router non ha zone, quindi una regola nomina indirizzi e reti. Un firewall che non conosce la zona di un lato chiude la sua lista allo stesso modo ([Zone](#zones)).

Ciò che nessuna regola indica si decide come sui router veri: la lista finisce con un divieto implicito. Un router senza regole lascia passare tutto; appena ne ha una attiva, ciò che nessuna regola permette viene bloccato, e il motivo lo dice: `router Router-Core: no rule allows it`. Un router con tutte le regole spente torna a lasciar passare tutto. La risposta a un flusso che il router ha permesso passa, come su un firewall. Sotto «Quando nessuna regola corrisponde» la scheda «Regole» di un router dice lo stesso, e `show rules` finisce con il divieto implicito:

```ncl sample=site
pixelcake> add rule deny ping from any to Srv-Interno on Router-Core
Router-Core: rule 1 added — deny ping from any to 192.168.20.10
  Srv-Interno → 192.168.20.10
  from now on Router-Core blocks what no rule allows
pixelcake> ping Srv-Interno from PC-Uffici-1
Pinging Srv-Interno (192.168.20.10) from PC-Uffici-1...
Ping failed (blocked): request: router Router-Core: denied by rule 1 (deny ping from any to 192.168.20.10)
  dropped at: Router-Core
pixelcake> browse Srv-Interno from PC-Uffici-1
Browsing Srv-Interno (192.168.20.10) from PC-Uffici-1...
  ✗ HTTP request: PC-Uffici-1 → Srv-Interno
Browse failed (blocked): HTTP request: router Router-Core: no rule allows it
  dropped at: Router-Core
```

Il ping è fermato dalla regola 1, la pagina dal divieto implicito: nessuna regola la permette. Una regola che permette ciò che mandano gli uffici apre il resto, e la risposta del server torna indietro come risposta a un flusso che il router ha permesso:

```ncl continue
pixelcake> add rule allow any from 192.168.10.0/24 to any on Router-Core
Router-Core: rule 2 added — allow any from 192.168.10.0/24 to any
pixelcake> browse Srv-Interno from PC-Uffici-1
Browsing Srv-Interno (192.168.20.10) from PC-Uffici-1...
  ✓ HTTP request: PC-Uffici-1 → Srv-Interno
  ✓ HTTP response: Srv-Interno → PC-Uffici-1
Page received from Srv-Interno
  note: HTTP request: router Router-Core: allowed by rule 2 (allow any from 192.168.10.0/24 to any)
  note: HTTP response: router Router-Core: no rule matches, allowed as the reply to an allowed flow
pixelcake> show rules Router-Core
RULES of Router-Core (the first that matches decides)
   1  deny  ping   from any                to 192.168.20.10
   2  allow any    from 192.168.10.0/24    to any
      deny  any    from any                to any  (implicit: what no rule allows)
  the reply to a flow it allowed passes
pixelcake> remove rule 2 from Router-Core
Router-Core: rule 2 removed — allow any from 192.168.10.0/24 to any
pixelcake> remove rule 1 from Router-Core
Router-Core: rule 1 removed — deny ping from any to 192.168.20.10
  Router-Core has no rules left: it lets everything through
```

La regola 1 viene sempre prima: il ping resta negato, e tutto il resto che parte dagli uffici passa. Tolta l'ultima regola, il router non filtra più niente.

## Limiti {#limits}

> [!LIMITS]
> - Una regola conosce quattro servizi: ping, web, email e DNS, oppure tutti. Non ci sono numeri di porta né protocolli: una regola non distingue una porta web da un'altra, né permette SSH.
> - Tre zone, con nomi fissi: trust, untrust e dmz. Non ci sono altre zone né una politica personalizzata tra le zone; le regole sono le sole eccezioni.
> - Un firewall ricorda i flussi che ha lasciato passare per il tempo di una sola domanda: non c'è una tabella delle connessioni da consultare, né un tempo massimo, né un limite a quante possono essere aperte.
> - Ciò che è diretto al firewall stesso non viene filtrato.
> - Il pacchetto è guardato solo per indirizzo e per zona. Non c'è ispezione di ciò che trasporta, né registro degli eventi, né limite di frequenza, né orari. L'opzione IPS/IDS di una porta è solo documentazione: il motore non la simula.
> - Un'estremità di connessione non assegnata a una porta non ha una zona, e nemmeno una porta la cui zona è «Nessuna». Le regole che nominano una zona vengono saltate lì, e il `trace` dice quale dei due casi è. Lì non può decidere nemmeno la politica delle zone: un firewall senza regole attive lascia passare il traffico, uno con una regola blocca ciò che nessuna regola permette. Su un firewall che instrada, il lato da cui un pacchetto esce è la porta della sua rotta, quindi un'estremità non assegnata conta per ciò che entra da lì.
> - Le regole di un router tengono lo stato, come quelle di un firewall: la risposta a un flusso che il router ha permesso passa. Una semplice lista di accesso su un router vero no, e vuole una regola anche per le risposte.
