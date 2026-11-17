---
title: "Interrogare: ping, trace e gli altri"
description: "I comandi che fanno una domanda alla rete e ne seguono la risposta sul canvas: ping, trace, browse, mail, download, resolve."
order: 7
---

Una domanda si pone alla rete così com'è disegnata: il motore segue il pacchetto salto per salto, applica VLAN, rotte, regole e traduzione a ogni dispositivo, e dice dove arriva, oppure dove e perché si ferma ([come decide il motore](../asking/how-the-engine-decides.md)). È lo stesso motore del pannello della simulazione, quindi i due concordano sempre ([il pannello della simulazione](../asking/simulation-panel.md)). Questi comandi non cambiano nulla nel disegno.

Mentre la risposta viene calcolata il pacchetto viaggia sul canvas, e il terminale stampa le righe man mano che il pacchetto le raggiunge: il prompt torna quando il pacchetto è arrivato, oppure si è fermato. Ctrl+C lo interrompe ([la finestra](index.md#open)). Quando la risposta finisce, il dispositivo che risponde diventa verde, e quello su cui la domanda si ferma diventa rosso.

Ogni domanda ha una destinazione e, a meno che il terminale non sia dentro un dispositivo (`use <device>`), una partenza: `<target> from <device>`. La notazione è spiegata nella [panoramica](index.md#conventions); che cosa può essere una destinazione è sotto [Destinazioni](#targets). Gli esempi girano sulle reti di esempio, e la rete è indicata sopra ciascuno. I comandi sono in inglese, come tutto il terminale.

## ping {#ping}

```text
ping <target> [from <device>]
```

Chiede se la destinazione risponde: una richiesta dalla partenza alla destinazione, e una risposta di ritorno. Entrambe le direzioni vengono calcolate, ciascuna con le sue rotte, le sue regole e la sua traduzione, e la domanda fallisce se una delle due fallisce.

| Parametro | Che cos'è |
|---|---|
| `<target>` | Un dispositivo, un indirizzo o un nome di host ([destinazioni](#targets)) |
| `<device>` | Il dispositivo da cui parte la domanda. Dentro `use <device>` si tralascia |

Una risposta che arriva dice `Reply from <address>: hops=<n> time=<t>ms`. Il numero di salti è il numero di dispositivi che la richiesta ha attraversato, i due estremi compresi. Il tempo non è misurato: è calcolato dal numero di salti, e non dice nulla sulla velocità dei cavi.

Una risposta che non arriva dice `Ping failed (<verdict>): <reason>`, e sotto `dropped at:` il dispositivo che ha scartato il pacchetto. Il motivo dice se è stata la richiesta o la risposta, e che cosa l'ha fermata: il dispositivo, la porta, la rotta o la regola. Il verdetto è una di quattro parole:

| Verdetto | Che cosa significa |
|---|---|
| `success` | La domanda è arrivata ed è stata risposta |
| `blocked` | Un dispositivo ha scartato il pacchetto: il motivo lo nomina |
| `unreachable` | Nessun cavo unisce i due dispositivi, per nessun percorso che funzioni |
| `error` | La domanda non si può nemmeno porre: un dispositivo non ha indirizzo, oppure partenza e destinazione sono lo stesso dispositivo |

Le righe che cominciano con `note:` vengono dopo la risposta. Dicono che cosa il motore ha supposto o fatto lungo la strada senza verificarlo: un firewall che ha deciso, un indirizzo che è stato tradotto, il simbolo Internet che è stato preso come se lasciasse passare tutto.

```ncl sample=company
pixelcake> ping Web-Gestionale from PC-Vendite
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> ping Cliente-Remoto from PC-Vendite
Pinging Cliente-Remoto (203.0.113.50) from PC-Vendite...
Reply from 203.0.113.50: hops=7 time=11ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → untrust allowed
  note: request: Internet is not simulated: traffic assumed to pass
  note: reply: Internet is not simulated: traffic assumed to pass
  note: reply: firewall FW-Edge: no rule matches, zone policy untrust → trust allowed (reply to an allowed flow)
pixelcake> ping PC-Vendite from Cliente-Remoto
Pinging PC-Vendite (192.168.10.12) from Cliente-Remoto...
Ping failed (blocked): request: Internet does not carry private addresses: 192.168.10.12 is not reachable from outside: no port forward publishes it for ping
  dropped at: Internet
pixelcake> ping Web-Gestionale from Web-Gestionale
Pinging Web-Gestionale (192.168.30.30) from Web-Gestionale...
Ping failed (error): source and target are the same device
pixelcake> ping Internet from PC-Vendite
Pinging Internet (no ip) from PC-Vendite...
Ping failed (error): request: Internet has no IP address configured
```

## trace {#trace}

```text
trace <target> [from <device>] [as ping|web|email|dns]
traceroute <target> [from <device>]
tracert <target> [from <device>]
```

Segue la richiesta in una direzione, e stampa una riga per ogni dispositivo che raggiunge, con ciò che il dispositivo le ha fatto: la VLAN che porta, la rotta che ha preso, la regola che ha deciso, l'indirizzo che ha tradotto. `traceroute` e `tracert` sono lo stesso comando. Non c'è risposta: una traccia riguarda la strada di andata.

| Parametro | Che cos'è |
|---|---|
| `<target>` | Un dispositivo, un indirizzo o un nome di host ([destinazioni](#targets)) |
| `<device>` | Il dispositivo da cui parte la domanda |
| `as <service>` | Il servizio a cui è destinato il pacchetto: `ping` (predefinito), `web`, `email` o `dns` ([i nomi di un servizio](firewall-and-nat.md#services)). Conta per le regole di un firewall e per gli inoltri, che sono per un servizio solo |

Una riga della traccia comincia con il numero del dispositivo, poi un segno: `○` per un dispositivo che il pacchetto ha attraversato, `●` per quello a cui è stato consegnato, `✗` per quello che l'ha scartato. La riga finisce con ciò che il dispositivo ha fatto, dopo un trattino. Una traccia che arriva finisce con `Trace complete: destination reached.`; una che non arriva finisce con `Trace failed (<verdict>): <reason>`, con il verdetto della tabella qui sopra. Quando non c'è nessun percorso, non viene stampato nessun salto.

```ncl sample=company
pixelcake> trace Web-Gestionale from Portatile-1 as web
Tracing route to Web-Gestionale (192.168.30.30) from Portatile-1 as web:
  1  ○ Portatile-1 (PC)
  2  ○ AP-Uffici (AccessPoint)
  3  ○ SW-Uffici (Switch)  — VLAN 20
  4  ○ SW-Core (Switch)  — VLAN 20
  5  ○ Router-Core (Router)  — routed: 192.168.30.0/24 is on port 3
  6  ○ SW-Server (Switch)  — VLAN 30
  7  ● Web-Gestionale (Server)
Trace complete: destination reached.
pixelcake> trace Portale-Clienti from Cliente-Remoto
Tracing route to Portale-Clienti (172.16.0.10) from Cliente-Remoto:
  1  ○ Cliente-Remoto (PC)
  2  ✗ Internet (Cloud)  — Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
Trace failed (blocked): Internet does not carry private addresses: 172.16.0.10 is not reachable from outside: no port forward publishes it for ping
pixelcake> trace Portale-Clienti from Cliente-Remoto as web
Tracing route to Portale-Clienti (203.0.113.1) from Cliente-Remoto as web:
  1  ○ Cliente-Remoto (PC)
  2  ○ Internet (Cloud)  — Internet is not simulated: traffic assumed to pass
  3  ○ FW-Edge (Firewall)  — NAT: destination 203.0.113.1 → 172.16.0.10 (port forward 1); routed: 172.16.0.0/24 is on port 2; firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
  4  ○ SW-DMZ (Switch)
  5  ● Portale-Clienti (Server)
  note: Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it (port forward 1)
  note: Internet is not simulated: traffic assumed to pass
  note: firewall FW-Edge: allowed by rule 1 (allow web from untrust to 172.16.0.10)
Trace complete: destination reached.
```

## browse {#browse}

```text
browse <target> [from <device>]
web <target> [from <device>]
curl <target> [from <device>]
```

Uno scambio web completo: la richiesta HTTP dalla partenza alla destinazione, poi la risposta di ritorno. Ogni tratto è una riga, con `✓` se è passato e `✗` se no. Lo scambio è per il servizio `web`, quindi una regola o un inoltro per il web lo riguardano. `web` e `curl` sono lo stesso comando. La domanda fallisce al primo tratto che fallisce, e quelli dopo non vengono provati.

| Parametro | Che cos'è |
|---|---|
| `<target>` | Un dispositivo, un indirizzo o un nome di host |
| `<device>` | Il dispositivo da cui parte la domanda |

```ncl sample=office
pixelcake> browse Web-01 from PC-1
Browsing Web-01 (192.168.20.10) from PC-1...
  ✓ HTTP request: PC-1 → Web-01
  ✓ HTTP response: Web-01 → PC-1
Page received from Web-01
pixelcake> interface 2 down on Router-1
port 2 on Router-1 is now down
pixelcake> browse Web-01 from PC-1
Browsing Web-01 (192.168.20.10) from PC-1...
  ✗ HTTP request: PC-1 → Web-01
Browse failed (blocked): HTTP request: port 2 on Router-1 is disabled
  dropped at: Router-1
pixelcake> interface 2 up on Router-1
port 2 on Router-1 is now up
pixelcake> curl Web-01 from PC-1
Browsing Web-01 (192.168.20.10) from PC-1...
  ✓ HTTP request: PC-1 → Web-01
  ✓ HTTP response: Web-01 → PC-1
Page received from Web-01
```

## mail {#mail}

```text
mail <target> [from <device>]
email <target> [from <device>]
```

Un'email, attraverso il suo relay. La posta non va dritta al destinatario: la partenza la manda a un server di posta, e il server la consegna. Quale server fa da relay dipende dalla modalità email del progetto, «Modalità email (SMTP)» in Impostazioni → Rete: con «Server di posta interno», il server di posta più vicino del disegno; con «Cloud (M365, Gmail…)», l'uscita verso Internet; con «Auto (rileva automaticamente)», quello interno se c'è, e altrimenti il cloud, con una nota. I tratti dicono quale: `SMTP submit` e `delivery`, oppure `SMTP to cloud provider` e `cloud delivery`. Quando la partenza o la destinazione è il relay stesso, il tratto è uno solo. `email` è lo stesso comando.

| Parametro | Che cos'è |
|---|---|
| `<target>` | Il destinatario: un dispositivo, un indirizzo o un nome di host |
| `<device>` | Il mittente |

```ncl sample=office
pixelcake> mail PC-2 from PC-1
Mailing PC-2 (192.168.10.12) from PC-1...
  ✓ SMTP submit: PC-1 → Mail-01
  ✓ delivery: Mail-01 → PC-2
Mail delivered to PC-2
pixelcake> mail Mail-01 from PC-1
Mailing Mail-01 (192.168.20.20) from PC-1...
  ✓ SMTP submit: PC-1 → Mail-01
Mail delivered to Mail-01
pixelcake> interface 2 down on Router-1
port 2 on Router-1 is now down
pixelcake> mail PC-1 from Web-01
Mailing PC-1 (192.168.10.11) from Web-01...
  ✓ SMTP submit: Web-01 → Mail-01
  ✗ delivery: Mail-01 → PC-1
Mail failed (blocked): delivery: port 2 on Router-1 is disabled
  dropped at: Router-1
```

## download {#download}

```text
download <target> [from <device>]
wget <target> [from <device>]
```

Un download: la richiesta dalla partenza alla destinazione, poi i dati di ritorno. Per un firewall è traffico web, quindi valgono le regole e gli inoltri per `web`. `wget` è lo stesso comando.

| Parametro | Che cos'è |
|---|---|
| `<target>` | Un dispositivo, un indirizzo o un nome di host |
| `<device>` | Il dispositivo da cui parte la domanda |

```ncl sample=company
pixelcake> download Web-Gestionale from PC-Vendite
Downloading from Web-Gestionale (192.168.30.30) from PC-Vendite...
  ✓ download request: PC-Vendite → Web-Gestionale
  ✓ download data: Web-Gestionale → PC-Vendite
Download complete from Web-Gestionale
pixelcake> download Web-Gestionale from Cliente-Remoto
Downloading from Web-Gestionale (192.168.30.30) from Cliente-Remoto...
  ✗ download request: Cliente-Remoto → Web-Gestionale
Download failed (blocked): download request: Internet does not carry private addresses: 192.168.30.30 is not reachable from outside: no port forward publishes it for web
  dropped at: Internet
```

## resolve {#resolve}

```text
resolve <name> [from <device>]
lookup <name> [from <device>]
nslookup <name> [from <device>]
```

Una sola ricerca DNS: il dispositivo chiede al suo server DNS per quale indirizzo sta un nome, e la risposta viene stampata con i tratti della richiesta e della risposta. `lookup` e `nslookup` sono lo stesso comando. La ricerca è uno scambio vero, come ogni altra domanda: VLAN, rotte, regole e guasti la riguardano, e fallisce quando il dispositivo non ha un server DNS, quando il server non si raggiunge, o quando il server non ha un record per il nome.

| Parametro | Che cos'è |
|---|---|
| `<name>` | Un nome di host con almeno un punto: `gestionale.azienda.example`. Una parola senza punto viene rifiutata |
| `<device>` | Il dispositivo che chiede. Dentro `use <device>` si tralascia |

```ncl sample=company
pixelcake> resolve gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)
pixelcake> resolve intranet.azienda.example from PC-Vendite
Looking up intranet.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
Lookup failed: Srv-Auth has no record for intranet.azienda.example
pixelcake> resolve gestionale.azienda.example from Cliente-Remoto
Looking up gestionale.azienda.example from Cliente-Remoto...
Lookup failed: Cliente-Remoto has no DNS server: it cannot look up gestionale.azienda.example
pixelcake> resolve gestionale.azienda.example from Router-Core
Looking up gestionale.azienda.example from Router-Core...
Lookup failed: Router-Core has no DNS server: it cannot look up gestionale.azienda.example
pixelcake> lookup portale.azienda.example from Portatile-1
Looking up portale.azienda.example from Portatile-1 (DNS server 192.168.30.10)...
  ✓ DNS request: Portatile-1 → Srv-Auth
  ✓ DNS reply: Srv-Auth → Portatile-1
portale.azienda.example is 172.16.0.10 (answered by Srv-Auth)
```

## Destinazioni {#targets}

Una destinazione si scrive in uno di tre modi, e la domanda riguarda il dispositivo che rappresenta:

- **Un dispositivo**, con il suo nome sul canvas: maiuscole e minuscole non contano, un nome di più parole si scrive com'è, e le virgolette tengono intero un nome, così che una parola come `from` o `to` al suo interno non venga letta come parola chiave. La domanda è puntata all'indirizzo principale del dispositivo: la prima scheda di rete di un dispositivo finale, oppure l'indirizzo con cui è conosciuto un router o un firewall.
- **Un indirizzo**, al posto di un dispositivo. Il dispositivo che ha quell'indirizzo è la destinazione, e la domanda è puntata proprio a quell'indirizzo: `ping 192.168.20.1` raggiunge l'interfaccia del router che lo ha, e non l'indirizzo con cui il router è conosciuto.
- **Un nome di host**, `www.azienda.example`: una parola con dei punti che non è né un dispositivo né un indirizzo. La partenza interroga prima il suo server DNS, la ricerca viene stampata e viaggia sul canvas, e poi la domanda va all'indirizzo trovato come se fosse stato digitato. Quando la ricerca fallisce la domanda si ferma lì, con il motivo ([DNS](dhcp-and-dns.md#dns-server)). I comandi che accettano un nome di host sono `ping`, `trace`, `browse`, `mail` e `download`.

```ncl sample=company
pixelcake> ping 192.168.20.1 from PC-Vendite
Pinging Router-Core (192.168.20.1) from PC-Vendite...
Reply from 192.168.20.1: hops=4 time=5ms
pixelcake> ping Router-Core from PC-Vendite
Pinging Router-Core (192.168.10.1) from PC-Vendite...
Reply from 192.168.10.1: hops=4 time=5ms
pixelcake> ping gestionale.azienda.example from PC-Vendite
Looking up gestionale.azienda.example from PC-Vendite (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Vendite → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Vendite
gestionale.azienda.example is 192.168.30.30 (answered by Srv-Auth)
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> browse portale.azienda.example from Portatile-1
Looking up portale.azienda.example from Portatile-1 (DNS server 192.168.30.10)...
  ✓ DNS request: Portatile-1 → Srv-Auth
  ✓ DNS reply: Srv-Auth → Portatile-1
portale.azienda.example is 172.16.0.10 (answered by Srv-Auth)
Browsing Portale-Clienti (172.16.0.10) from Portatile-1...
  ✓ HTTP request: Portatile-1 → Portale-Clienti
  ✓ HTTP response: Portale-Clienti → Portatile-1
Page received from Portale-Clienti
  note: HTTP request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: HTTP response: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

**Un dispositivo dietro il NAT.** Un dispositivo con un indirizzo privato che un firewall pubblica si raggiunge da fuori all'indirizzo del firewall. La domanda è puntata lì, e una nota lo dice: `Portale-Clienti is behind NAT: reached at 203.0.113.1, where FW-Edge publishes it`. Vale per i comandi che nominano un servizio (`browse`, `download`, `mail`, `trace … as <service>`); un `ping` o un `trace` senza `as` è puntato all'indirizzo che il dispositivo ha, e il simbolo Internet lo ferma, perché nessun inoltro pubblica un ping. Un indirizzo digitato è sempre l'indirizzo puntato, e non si prova nient'altro ([NAT e inoltri](../services/nat.md)).

**Un nome che non si trova.** Una destinazione o una partenza che non corrisponde a nessun dispositivo viene rifiutata con il nome più vicino, quando ce n'è uno: `device not found: "web gestionale"`, poi `did you mean "Web-Gestionale"?`. Senza `from`, e fuori da `use`, una domanda non ha partenza e lo dice.

```ncl sample=company
pixelcake> ping web gestionale from PC-Vendite
device not found: "web gestionale"
  did you mean "Web-Gestionale"?
pixelcake> ping Web-Gestionale
specify a source: "ping Web-Gestionale from <device>" — or enter a device context with "use <device>"
pixelcake> ping "Web-Gestionale" from "PC-Vendite"
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> use PC-Vendite
context: PC-Vendite — "from" is now implied, "exit" to leave
PC-Vendite> ping Web-Gestionale
Pinging Web-Gestionale (192.168.30.30) from PC-Vendite...
Reply from 192.168.30.30: hops=6 time=9ms
PC-Vendite> ping Nessun-posto
device not found: "Nessun-posto"
PC-Vendite> exit
left PC-Vendite
```

## Quando un comando viene rifiutato {#refusals}

Una domanda che non si può porre non riceve risposta, e dice perché, o che forma avrebbe dovuto avere:

```ncl sample=company
pixelcake> ping
unknown command: "ping"
  try: ping <target> [from <device>]
  type "help" for the command list
pixelcake> trace Web-Gestionale from PC-Vendite as gopher
unknown command: "trace Web-Gestionale from PC-Vendite as gopher"
  unknown service "gopher" — try: trace <target> [from <device>] [as ping|web|email|dns]
  type "help" for the command list
pixelcake> browse from PC-Vendite
unknown command: "browse from PC-Vendite"
  try: browse <target> [from <device>]
  type "help" for the command list
pixelcake> resolve from PC-Vendite
unknown command: "resolve from PC-Vendite"
  try: resolve <name> [from <device>]
  type "help" for the command list
pixelcake> resolve gestionale.azienda.example
specify a source: "resolve gestionale.azienda.example from <device>" — or enter a device context with "use <device>"
```

## Vedi anche {#see-also}

- [Il pannello della simulazione](../asking/simulation-panel.md): le stesse domande, scelte da menu.
- [Come decide il motore](../asking/how-the-engine-decides.md): l'ordine di ciò che accade a ogni dispositivo, e i motivi e le note.
- [Presentazione](../asking/presentation.md#terminal): il terminale durante una presentazione, con i guasti simulati.
- [DHCP e DNS](dhcp-and-dns.md#add-record): i record e il server DNS di cui un nome ha bisogno.
