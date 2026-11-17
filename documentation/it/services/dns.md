---
title: "DNS"
description: "Chiamare un dispositivo per nome: i record di un server, il server DNS a cui chiede ogni scheda, e una ricerca che attraversa la rete come ogni altro scambio."
order: 5
---

Il DNS fa sì che un nome stia per un indirizzo. In PixelCake un server tiene un elenco di nomi, ciascuno con un indirizzo; a una scheda di rete si dice quale server interrogare; e un comando del terminale a cui si dà un nome chiede prima a quel server, poi prosegue verso l'indirizzo ricevuto. La ricerca è uno scambio vero, e può fallire come ogni altro. Il motore non ha una memoria delle risposte: un nome viene cercato ogni volta che una domanda lo usa.

I nomi funzionano solo nel terminale: `ping`, `trace`, `browse`, `mail` e `download` accettano un nome di host dove accettano un dispositivo, e `resolve` fa la sola ricerca. Il pannello della simulazione e la presentazione scelgono i dispositivi dai menu e non usano i nomi.

Gli esempi usano la rete di esempio «Azienda: uffici, Wi-Fi, server e DMZ», dove il server Srv-Auth conosce tre nomi.

## I record {#records}

Un server DNS è un server con almeno un record. Nella finestra del server apri la scheda «DNS». Sotto «Nomi conosciuti» premi «Aggiungi record» e compila un «Nome» e un «Indirizzo», per esempio `gestionale.azienda.example` e `192.168.30.30`. Non cambia nulla finché non premi «Salva». Nel terminale: `add record <nome> <indirizzo> on <server>` ([riferimento](../terminal/dhcp-and-dns.md#add-record)).

Un nome è un nome di host: lettere, cifre e trattini, con almeno un punto. Maiuscole e minuscole sono uguali. Un nome ha un solo indirizzo: scriverlo di nuovo ne cambia l'indirizzo. Un server risponde solo per i nomi scritti su di lui, e un dispositivo senza record non risponde come server DNS.

`show dns` elenca i record di tutti i server del disegno, e chi interroga chi:

```ncl sample=company
pixelcake> show dns
DNS — 1 server, 3 records
RECORDS of Srv-Auth (192.168.30.10)
   1  gestionale.azienda.example       192.168.30.30
   2  posta.azienda.example            192.168.30.40
   3  portale.azienda.example          172.16.0.10
WHO ASKS WHOM
  PC-Contabilità eth0      192.168.30.10
  PC-Vendite eth0          192.168.30.10
  Stampante eth0           192.168.30.10
  Portatile-1 eth0         192.168.30.10  (with its lease)
  Portatile-2 eth0         192.168.30.10  (with its lease)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

Un nome che non è sul server dà un errore che lo dice. La ricerca in sé ha funzionato: la richiesta è arrivata al server e la risposta è tornata, per questo le due righe sono segnate come arrivate. Scrivi il record e la stessa domanda trova risposta:

```ncl sample=company
pixelcake> resolve intranet.azienda.example from PC-Vendite
Looking up intranet.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
Lookup failed: Srv-Auth has no record for intranet.azienda.example
pixelcake> add record intranet.azienda.example Web-Gestionale on Srv-Auth
Srv-Auth: record 4 added — intranet.azienda.example is 192.168.30.30
  Web-Gestionale → 192.168.30.30
pixelcake> resolve intranet.azienda.example from PC-Vendite
Looking up intranet.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
intranet.azienda.example is 192.168.30.30 (answered by Srv-Auth)
```

## Chi interroga chi {#who-asks}

Ogni dispositivo decide a chi chiedere, sulla propria scheda di rete. Nella scheda «Schede di rete» della finestra, il campo «Server DNS» di una scheda di rete contiene l'indirizzo del server. È un indirizzo, non un nome. Un dispositivo chiede attraverso la prima scheda abilitata che indica un server. Un router, un firewall e uno switch non hanno schede, e non chiedono a nessuno.

Una scheda che prende l'indirizzo dal DHCP non sceglie: interroga il server che l'intervallo da cui arriva consegna, «Server DNS consegnato» nel server DHCP ([DHCP](dhcp.md#servers)). Il terminale rifiuta di scrivere un server DNS su una scheda così. `show dns` su un dispositivo dice quale server interroga e se è arrivato con l'assegnazione:

```ncl sample=company
pixelcake> show dns Portatile-1
DNS of Portatile-1
  eth0: asks 192.168.30.10 (Srv-Auth), handed out with its lease by Router-Core port 2
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

Per non scrivere l'indirizzo su ogni scheda, Impostazioni → Rete ha «Server DNS predefinito»: i dispositivi nuovi partono con quello sulla loro scheda e, una volta salvato, si può assegnare ai dispositivi del canvas che non ne hanno ([Indirizzi e gateway](../building/addresses.md#project-network)).

Un dispositivo che non ha nessuno a cui chiedere non può cercare un nome, e lo dice. Lo stesso accade togliendo il server DNS a una scheda:

```ncl sample=company
pixelcake> resolve portale.azienda.example from Cliente-Remoto
Looking up portale.azienda.example from Cliente-Remoto...
Lookup failed: Cliente-Remoto has no DNS server: it cannot look up portale.azienda.example
pixelcake> show dns PC-Vendite
DNS of PC-Vendite
  eth0: asks 192.168.30.10 (Srv-Auth)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> interface eth0 dns none on PC-Vendite
interface eth0 on PC-Vendite asks no DNS server now
pixelcake> ping gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite...
Lookup failed: PC-Vendite has no DNS server: it cannot look up gestionale.azienda.example
pixelcake> show dns PC-Vendite
DNS of PC-Vendite
  eth0: asks nobody
  name a DNS server: interface eth0 dns <address> on PC-Vendite
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
```

Il server interrogato deve essere un server DNS, e l'indirizzo deve appartenere a un dispositivo. Altri due motivi:

```ncl sample=company
pixelcake> interface eth0 dns 192.168.30.30 on PC-Vendite
interface eth0 on PC-Vendite: DNS server 192.168.30.30
pixelcake> resolve gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.30)...
  ✓ DNS request: PC-Vendite → Web-Gestionale
  ✓ DNS reply: Web-Gestionale → PC-Vendite
Lookup failed: 192.168.30.30 is Web-Gestionale, which is not a DNS server: it keeps no records
pixelcake> interface eth0 dns 8.8.8.8 on PC-Vendite
interface eth0 on PC-Vendite: DNS server 8.8.8.8
pixelcake> resolve gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 8.8.8.8)...
Lookup failed: PC-Vendite asks 8.8.8.8 for names, an address no device has
```

## Una ricerca {#lookup}

Una ricerca è un viaggio di andata e ritorno. Una richiesta va dal dispositivo all'indirizzo del suo server DNS e la risposta torna, come un flusso del servizio DNS. Tutte e due sono seguite come ogni altro pacchetto: VLAN, rotte, regole del firewall, NAT e guasti valgono, e una ricerca si ferma negli stessi modi. Solo se arrivano tutte e due il record viene letto. Poi il comando prosegue verso l'indirizzo trovato, esattamente come se fosse stato scritto.

`resolve <nome>` fa la sola ricerca, e il comando che segue la mostra prima della sua risposta:

```ncl sample=company
pixelcake> resolve gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> ping gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
```

Le due righe dicono che cosa è andato dove: la richiesta DNS, da PC-Vendite a Srv-Auth, e la risposta DNS, di ritorno. Il ping che segue è una domanda a parte, a Web-Gestionale.

Attraverso un firewall la ricerca è giudicata dalle sue regole, come il servizio «DNS». Nella rete di esempio al server web della DMZ si dà Srv-Auth come server DNS. Srv-Auth sta nella rete dei server, e il firewall rifiuta un flusso nuovo dalla DMZ verso una zona più fidata, ricerca compresa. Una regola per il DNS lo lascia passare, e la risposta torna come risposta a un flusso permesso:

```ncl sample=company
pixelcake> interface eth0 dns 192.168.30.10 on Portale-Clienti
interface eth0 on Portale-Clienti: DNS server 192.168.30.10
pixelcake> resolve gestionale.azienda.example from Portale-Clienti
Looking up gestionale.azienda.example from Portale-Clienti (DNS server 192.168.30.10)...
  ✗ DNS request: Portale-Clienti → Srv-Auth
Lookup failed (blocked): DNS request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied
  dropped at: FW-Edge
pixelcake> add rule allow dns from dmz to 192.168.30.10 on FW-Edge
FW-Edge: rule 4 added — allow dns from dmz to 192.168.30.10
pixelcake> resolve gestionale.azienda.example from Portale-Clienti
Looking up gestionale.azienda.example from Portale-Clienti (DNS server 192.168.30.10)...
  ✓ DNS request: Portale-Clienti → Srv-Auth
  ✓ DNS reply: Srv-Auth → Portale-Clienti
gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)
  note: DNS request: firewall FW-Edge: allowed by rule 4 (allow dns from dmz to 192.168.30.10)
  note: DNS reply: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
```

Anche un inoltro può nominare il servizio DNS. Nella rete multinazionale il cliente all'esterno interroga 203.0.113.1, l'indirizzo pubblico del firewall, che manda la domanda al server DNS pubblico dell'azienda:

```ncl sample=multinational
pixelcake> show dns Cliente
DNS of Cliente
  eth0: asks 203.0.113.1 (FW-MI)
  a name is looked up each time it is used: no cache, no second server, no forwarding to another server
pixelcake> resolve www.gruppo.example from Cliente
Looking up www.gruppo.example from Cliente (DNS server 203.0.113.1)...
  ✓ DNS request: Cliente → DNS-PUB
  ✓ DNS reply: DNS-PUB → Cliente
www.gruppo.example is 203.0.113.1 (answered by DNS-PUB)
  note: 203.0.113.1 is FW-MI, which forwards dns to DNS-PUB (port forward 3)
  note: DNS request: Internet A is not simulated: traffic assumed to pass
  note: DNS request: firewall FW-MI: allowed by rule 6 (allow dns from untrust to 172.16.10.53)
  note: DNS reply: firewall FW-MI: no rule matches, zone policy dmz → untrust allowed
  note: DNS reply: Internet A is not simulated: traffic assumed to pass
```

Se il server DNS è spento, o la strada verso di lui è tagliata, i nomi non trovano un indirizzo mentre gli indirizzi continuano a rispondere:

```ncl sample=company
pixelcake> interface eth0 down on Srv-Auth
interface eth0 on Srv-Auth is now down
pixelcake> ping gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✗ DNS request: PC-Vendite → Srv-Auth
Lookup failed (blocked): DNS request: interface eth0 on Srv-Auth is disabled
  dropped at: Srv-Auth
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
```

## Limiti {#limits}

> [!LIMITS]
> - Una scheda indica un solo server DNS. Non c'è un secondo server di riserva.
> - Un server risponde solo per i propri record. Non chiede a un altro server: non ci sono inoltro delle domande né ricorsione, e un server DNS pubblico che non è nel disegno non è nessuno.
> - Niente memoria delle risposte né scadenze: ogni domanda che usa un nome lo cerca di nuovo.
> - Niente ricerca inversa, nomi jolly o alias: un nome è un nome di host con un solo indirizzo.
> - Un dispositivo senza scheda di rete, come un router, un firewall o uno switch, non chiede a nessuno.
> - I nomi funzionano solo nel terminale. Il pannello della simulazione e la presentazione scelgono i dispositivi dai menu.
