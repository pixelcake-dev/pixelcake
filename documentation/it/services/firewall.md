---
title: "Zone e regole del firewall"
description: "Le zone di sicurezza sulle porte di un firewall, la politica delle zone e le regole in ordine che fanno eccezione."
order: 2
---

In PixelCake un firewall decide su ogni pacchetto che lo attraversa. Ha due strumenti: la zona di sicurezza di ciascuna porta e un elenco di regole. Senza regole decidono le zone, con una politica fissa. Una regola fa un'eccezione alla politica, e decide la prima regola che corrisponde.

Gli esempi di questa pagina usano la rete di esempio «Sede: VLAN, DMZ e firewall». Il suo firewall, FW-Edge, ha gli uffici dietro la porta 1, una DMZ con un server web dietro la porta 2 e Internet alla porta 3.

![La rete di esempio della sede. FW-Edge sta al centro, con tre cavi. Uno sale verso il simbolo Internet e PC-Remoto, nel riquadro Internet. Uno va a sinistra verso Router-Core, che ha dietro SW-Core, due PC e Srv-Interno, nel riquadro Rete interna. Uno va a destra verso SW-DMZ e Web-Pubblico, nel riquadro DMZ.](../../media/firewall/zones.it.svg "La rete di esempio della sede. Le tre porte di FW-Edge guardano la rete interna (trust), la DMZ (dmz) e Internet (untrust).")

## Le zone {#zones}

Una zona dice quanto ci si fida di una rete. Sono tre, e una porta sta in una di esse oppure in nessuna:

- **trust**: la rete che il firewall protegge, gli uffici.
- **dmz**: una rete di server raggiunti da fuori, tenuta separata dagli uffici.
- **untrust**: l'esterno, Internet.

La zona appartiene alla porta, non al dispositivo né al cavo. Nella finestra del firewall apri la scheda «Porte», scegli la porta e imposta «Zona di sicurezza»: «Nessuna», «Trust (rete fidata)», «Untrust (rete non fidata)» oppure «DMZ (zona demilitarizzata)». Non cambia nulla finché non premi «Salva». Nel terminale si fa con `interface <n> zone <zona> on <firewall>` ([riferimento](../terminal/firewall-and-nat.md#zone)); `show ports` ha una colonna apposta:

```ncl sample=site
pixelcake> show ports FW-Edge
PORT   STATE      MODE     VLAN       ZONE     IP               LINK
1      up         lan      -          trust    10.0.0.2         Router-Core (port 3)
2      up         dmz      -          dmz      172.16.0.1       SW-DMZ (port 8)
3      up         wan      -          untrust  203.0.113.1      Internet (eth0)
4      up         lan      -          -        -                -
```

La «Modalità della porta» (LAN, WAN o DMZ) è un'etichetta e non decide nulla: su un firewall conta la zona di sicurezza.

Il motore deve sapere a quale porta è attaccato un cavo, per sapere da quale zona entra un pacchetto e da quale esce. Una connessione tracciata verso un firewall che ha delle zone non viene attaccata a una porta da sola: la porta, e con essa la zona, si sceglie nella finestra della connessione. Fai clic con il tasto destro sulla connessione, scegli «Modifica connessione» e, sotto «Interfacce», scegli la porta nell'elenco intitolato `Interfaccia su FW-Edge`. Un'estremità non attaccata non ha una zona: una regola che nomina una zona viene saltata, e il trace lo dice in una nota.

Una porta con «Nessuna» come zona è lo stesso: niente zona, niente politica. Lì una regola che nomina una zona viene saltata, con la stessa nota, e ciò che nessun'altra regola decide è permesso; il trace scrive `no zone binding: allowed`:

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
  ✓ HTTP request: PC-Uffici-1 → Web-Pubblico
  ✓ HTTP response: Web-Pubblico → PC-Uffici-1
Page received from Web-Pubblico
  note: HTTP request: firewall FW-Edge: no rule matches and no zone binding: allowed
  note: HTTP response: firewall FW-Edge: no rule matches and no zone binding: allowed
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

Senza regole il motivo si legge `firewall policy on FW-Edge: dmz → trust denied`, con regole che non corrispondono `firewall FW-Edge: no rule matches, zone policy dmz → trust denied`. La scheda «Regole» lo dice sotto «Quando nessuna regola corrisponde».

## Le regole {#rules}

Una regola fa un'eccezione alla politica: lascia entrare ciò che la politica nega, o tiene fuori ciò che permette. Nella finestra del firewall vai nella scheda «Regole». Sotto «Regole del firewall» premi «Aggiungi regola» e compila la riga:

- «Azione»: «Permetti» oppure «Nega».
- «Servizio»: «Ping», «Web», «Email», «DNS» oppure «Qualsiasi».
- «Da» e «A»: `any`, una zona (`trust`, `untrust`, `dmz`), un indirizzo, o una rete come `192.168.10.0/24`. Ogni altro nome viene rifiutato.
- «Attiva»: una regola senza la spunta viene saltata.

«Sposta in su» e «Sposta in giù» cambiano l'ordine; «Elimina la regola» toglie una riga. Il numero della prima colonna è quello che usano il terminale e i trace.

Le regole si leggono dall'alto. La prima regola attiva in cui servizio, partenza e destinazione corrispondono decide, e quelle dopo non vengono guardate. Se nessuna corrisponde, decide la politica. «Da» è la partenza del pacchetto e «A» la sua destinazione, come le vede il firewall: una zona corrisponde alla zona della porta da cui il pacchetto entra, o da cui esce.

Nella rete di esempio gli uffici raggiungono il server web della DMZ, come dice la politica. Qui in fondo si aggiunge una regola che nega il web verso la DMZ a un solo PC degli uffici, quello con l'indirizzo 192.168.10.12. L'altro PC non ne è toccato:

```ncl sample=site
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to an allowed flow always passes
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
  the reply to an allowed flow always passes
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

Un firewall tiene lo stato. Quando ha lasciato passare una richiesta, ne lascia passare la risposta, qualunque cosa dicano le regole e la politica sui flussi nuovi nell'altro verso. Senza questo la risposta di un server su Internet sarebbe un flusso nuovo verso una zona più fidata, e la politica la negherebbe. Il motore però tiene questo stato per il flusso, non per ciascun firewall: una risposta passa ogni firewall sulla strada del ritorno, anche uno che la richiesta non ha attraversato. La nota lo dice:

```ncl sample=site
pixelcake> ping Web-Pubblico from PC-Uffici-1
Pinging Web-Pubblico (172.16.0.10) from PC-Uffici-1...
Reply from 172.16.0.10: hops=6 time=9ms
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

## Il firewall stesso {#itself}

Ciò che è diretto al firewall stesso non viene filtrato. Qui una regola nega tutto da Internet, e il firewall risponde comunque a un ping sul suo indirizzo esterno:

```ncl sample=site
pixelcake> add rule deny any from untrust to any on FW-Edge
FW-Edge: rule 2 added — deny any from untrust to any
pixelcake> ping 203.0.113.1 from PC-Remoto
Pinging FW-Edge (203.0.113.1) from PC-Remoto...
Reply from 203.0.113.1: hops=3 time=3ms
  note: request: Internet is not simulated: traffic assumed to pass
  note: reply: Internet is not simulated: traffic assumed to pass
```

Le regole giudicano solo ciò che attraversa il firewall. L'amministrazione del firewall non è simulata.

## Limiti {#limits}

> [!LIMITS]
> - Una regola ha quattro servizi: ping, web, email e DNS, oppure tutti. Non ci sono numeri di porta né protocolli: una regola non distingue una porta web da un'altra, né permette SSH.
> - Tre zone, con nomi fissi: trust, untrust e dmz. Non ci sono altre zone né una politica personalizzata tra le zone; le regole sono le sole eccezioni.
> - Una risposta passa perché è la risposta a un flusso permesso; non c'è una tabella delle connessioni, né un tempo massimo, né un limite a quante possono essere aperte. Così una risposta che torna per un'altra strada passa un firewall che non ha mai visto la richiesta.
> - Ciò che è diretto al firewall stesso non viene filtrato.
> - Il pacchetto è guardato solo per indirizzo e per zona. Non c'è ispezione di ciò che trasporta, né registro degli eventi, né limite di frequenza, né orari. L'opzione IPS/IDS di una porta è solo documentazione: il motore non la simula.
> - Un'estremità di connessione non attaccata a una porta non ha una zona. Le regole che nominano una zona vengono saltate lì, e il trace lo dice; il traffico non viene fermato per questo.
