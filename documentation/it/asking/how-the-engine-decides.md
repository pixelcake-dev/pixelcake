---
title: "Come decide il motore"
description: "Il percorso di un pacchetto salto per salto, al livello 3 e al livello 2, i motivi che dà quando si ferma, e che cosa non è simulato."
order: 2
---

Il motore è la parte di PixelCake che risponde a una domanda come "PC-1 raggiunge Web-01?". Riceve il disegno (dispositivi, cavi e tutto ciò che è impostato su di loro) e segue un pacchetto dal mittente alla destinazione, un dispositivo alla volta. Guarda che cosa farebbe ciascun dispositivo del pacchetto, e la risposta è il punto in cui il pacchetto arriva o il punto in cui si ferma, con il motivo.

Lo stesso motore risponde al [pannello della simulazione](simulation-panel.md), alla [presentazione](presentation.md) e al terminale ([ping, trace e gli altri comandi](../terminal/asking.md)). Non guarda mai lo schermo e non ricorda nulla da una domanda all'altra: lo stesso disegno e la stessa domanda danno sempre la stessa risposta.

## Prima che il pacchetto parta {#before}

Cinque cose si decidono prima del primo salto.

1. **Gli indirizzi da DHCP.** Una scheda di rete impostata per prendere l'indirizzo da un server DHCP ha l'indirizzo che le viene assegnato. Il motore lo ricava dal disegno, sempre allo stesso modo. Una scheda che non ne riceve nessuno resta senza indirizzo, e la risposta dice perché: [una scheda che non ne riceve](../services/dhcp.md#no-address).
2. **I nomi.** Nel terminale un nome di host può prendere il posto di un dispositivo. Il motore chiede prima al server DNS del mittente, con una richiesta e una risposta che viaggiano come qualunque altro pacchetto, e solo dopo manda la domanda vera all'indirizzo trovato. Il pannello e la presentazione scelgono i dispositivi dai menu e non usano nomi: [una ricerca](../services/dns.md#lookup).
3. **Le due estremità esistono e hanno un indirizzo.** Senza, la risposta è `error` e dice quale dispositivo non ce l'ha (`PC-1 has no IP address configured`).
4. **L'indirizzo non è in conflitto.** Quando l'indirizzo a cui va la domanda è anche su un altro dispositivo, e i due possono incontrarsi, nessuno può dire quale dei due risponde: la risposta è `error`, e nomina l'indirizzo e i dispositivi (`address conflict: 192.168.20.10 is on both Web-01 and Mail-01, so the answer cannot be trusted`). Vale lo stesso per l'indirizzo da cui parte il mittente, e per un inoltro che manda il pacchetto a un indirizzo così. [Due dispositivi con lo stesso indirizzo](../building/addresses.md#conflicts) dice quali indirizzi entrano in conflitto.
5. **Un cavo le unisce.** Il motore cerca una qualunque catena di cavi tra i due dispositivi, come sono disegnati. Se non c'è, la risposta è `unreachable` (`no physical path between PC-1 and Web-01`). Un cavo tagliato da un [guasto simulato](#failures) resta disegnato: allora il pacchetto si ferma, e il motivo è il cavo.

Un dispositivo spento non manda nulla. Se è spento il mittente, la domanda si ferma su di lui (`PC-1 is down`).

## Salto per salto {#hop-by-hop}

Il cammino alterna due tipi di passo.

- In un dispositivo che lavora al livello 3 (il mittente, un router, un firewall) il motore **decide**: dove deve andare ora questo pacchetto? Cerca la rotta, applica il firewall e la traduzione degli indirizzi, e trova l'indirizzo successivo.
- Tra due dispositivi di livello 3 il motore **consegna**: porta il pacchetto a quell'indirizzo attraverso ciò che sta in mezzo, switch e access point, VLAN per VLAN, e controlla ogni porta e ogni cavo lungo la strada.

Poi decide di nuovo nel dispositivo dove la consegna è finita, finché la destinazione risponde, qualcosa scarta il pacchetto, oppure il pacchetto torna a un router che ha già attraversato (`routing loop: the packet comes back to Router-1`).

```ncl sample=office
pixelcake> trace Web-01 from PC-1
Tracing route to Web-01 (192.168.20.10) from PC-1:
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)
  3  ○ Router-1 (Router)  — routed: 192.168.20.0/24 is on port 2
  4  ○ SW-Servers (Switch)
  5  ● Web-01 (Server)
Trace complete: destination reached.
```

Ogni riga è un dispositivo attraversato dal pacchetto: `○` passato oltre, `●` consegnato, `✗` scartato. Dopo il trattino c'è ciò che il dispositivo ha fatto. PC-1 ha deciso che Web-01 è fuori dalla sua rete e ha mandato il pacchetto al gateway; la consegna ha attraversato SW-Office; Router-1 ha deciso che 192.168.20.0/24 sta sulla sua porta 2; la consegna ha attraversato SW-Servers e ha raggiunto Web-01.

La strada non si sceglie con una metrica. Al livello 3 è la tabella di instradamento a dire quale indirizzo viene dopo; al livello 2 il motore prende la catena di cavi più corta che funziona, come si spiega [più avanti](#layer-2). La velocità dei cavi e le etichette dei cavi non contano.

## Al livello 3 {#layer-3}

Un dispositivo che lavora al livello 3 decide in quest'ordine: se il pacchetto è per lui o per un server che pubblica, quale rotta prendere, che cosa dice il firewall, e con quale indirizzo di partenza esce il pacchetto. Il mittente non viene filtrato e non traduce ciò che manda lui stesso, e un firewall non filtra un pacchetto indirizzato al firewall stesso.

### La rotta {#route}

Il dispositivo cerca la destinazione nella sua tabella di instradamento. Le voci sono di tre tipi:

- **collegata**: una rete in cui sta una delle sue porte o schede con un indirizzo;
- **statica**: una rotta scritta su un router o su un firewall;
- **predefinita**: il gateway di una scheda di rete, il gateway di un router, o una rotta scritta verso `default`.

Vince la voce più specifica. A parità di lunghezza una rete collegata batte una rotta statica, e una rotta statica batte la predefinita. Di due rotte verso la stessa rete si usa la prima scritta, e le altre sono [rotte di riserva](../services/routes.md#backup). Una rotta che esce da una porta spenta non si usa. La tabella è spiegata in [la tabella di instradamento](../services/routes.md#routing-table).

Quando non c'è nessuna voce, il pacchetto si ferma qui e il motivo dice quale dispositivo e che cosa manca: `no default gateway configured on PC-1`, oppure `Router-1 has no route to 192.168.30.11`. Una rotta il cui prossimo salto non sta in nessuna rete del dispositivo non porta da nessuna parte: viene saltata, come fa un router vero, e decide la voce successiva, una rotta di riserva o la rotta predefinita, con una nota. Se era l'unica strada, il pacchetto si ferma lì con quel motivo: `Router-1 cannot use the route 192.168.30.0/24 via 172.16.0.1: that address is on none of its networks`. Quando l'unica strada esce da una porta spenta, il motivo è quella porta: `port 2 on Router-1 is disabled`.

Trovato l'indirizzo successivo, il motore cerca il dispositivo che risponde per quell'indirizzo sulla rete del mittente. Se non c'è, il motivo dice che cosa c'è al suo posto: `PC-1 uses gateway 192.168.10.99, but Router-1 port 1 on its network is 192.168.10.1`. Vedi [il gateway](../building/addresses.md#gateway).

### Le rotte di riserva {#backup-route}

Una rotta viene ritirata quando l'interfaccia da cui esce non ha più nessun cavo che funzioni: ogni cavo è tagliato, o il dispositivo all'altro capo di ciascuno è spento (i due [guasti simulati](#failures)), o l'interfaccia all'altro capo è spenta; oppure quando è spenta la porta stessa. La rotta successiva verso quella destinazione prende il suo posto. Una linea che cade è caduta per i dispositivi a tutti e due i suoi capi, come un collegamento vero perde il segnale da entrambe le parti. Quando a essere caduta è la linea, e non la porta stessa spenta, la risposta porta una nota:

```text
note: R-HQ: the route 192.168.2.0/24 via 10.0.0.2 is unusable (link R-HQ–R-Branch is down), the route 192.168.2.0/24 via 10.0.1.2 is used instead
```

Due casi tengono la rotta principale. Una rete a cui il dispositivo è collegato con un cavo guasto non viene cercata altrove: la connessione rotta è la risposta. (Una porta spenta non è un guasto: la sua rete esce dalla tabella, e una rotta meno specifica, per esempio quella predefinita, può prenderne il traffico.) E un prossimo salto che si spegne dietro uno switch non fa cadere l'interfaccia, quindi la rotta resta e il pacchetto si perde lì, come con una semplice rotta statica.

### Il firewall {#firewall}

Un firewall che un pacchetto attraversa (non uno che lo manda, non uno a cui è indirizzato) decide prima che il pacchetto prosegua. Lo stesso fa un router che ha delle regole, la sua lista di accesso: le legge allo stesso modo, e non ha zone.

1. **Le regole**, dall'alto in basso. La prima regola attiva che corrisponde per servizio, partenza e destinazione decide se permettere o negare. Una regola che nomina una zona ha bisogno che il cavo sia assegnato a una porta che sta in una zona, perché la zona appartiene alla porta: altrimenti la regola viene saltata, con una nota.
2. **La politica delle zone**, quando nessuna regola corrisponde. Un nuovo flusso verso una zona più fidata viene negato: `untrust → trust`, `untrust → dmz` e `dmz → trust`. Tutto il resto è permesso. Un firewall che non conosce la zona di entrambi i lati, perché un cavo non è assegnato a nessuna porta o è assegnato a una porta senza zona, permette, con una nota. Un router non ha zone: la sua lista finisce con un divieto implicito, come sui router veri, e quindi ciò che nessuna regola permette viene bloccato (`router Router-Core: no rule allows it`). Un router senza regole, o con tutte spente, lascia passare tutto.
3. **Le risposte.** Un firewall ricorda i flussi che ha lasciato passare lui stesso. La risposta a uno di questi flussi lo attraversa, qualunque cosa dicano le regole su un nuovo flusso in quel verso. Una risposta che torna per un'altra strada, attraverso un firewall che la richiesta non ha attraversato, per quel firewall è un pacchetto nuovo: decidono le sue regole e le sue zone, e quando la negano il motivo finisce con `and it never saw the request`.

```ncl sample=site
pixelcake> show rules FW-Edge
RULES of FW-Edge (the first that matches decides)
   1  allow web    from untrust            to 172.16.0.10
  then the zone policy: untrust → trust, untrust → dmz and dmz → trust denied, the rest allowed
  the reply to a flow it allowed passes
pixelcake> ping Srv-Interno from Web-Pubblico
Pinging Srv-Interno (192.168.20.10) from Web-Pubblico...
Ping failed (blocked): request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied
  dropped at: FW-Edge
pixelcake> ping Web-Pubblico from PC-Uffici-1
Pinging Web-Pubblico (172.16.0.10) from PC-Uffici-1...
Reply from 172.16.0.10: hops=6 time=9ms
  note: request: firewall FW-Edge: no rule matches, zone policy trust → dmz allowed
  note: reply: firewall FW-Edge: no rule matches, zone policy dmz → trust allowed (reply to an allowed flow)
```

Le regole e la politica sono in [Firewall](../services/firewall.md): [zone](../services/firewall.md#zones), [politica delle zone](../services/firewall.md#policy), [regole](../services/firewall.md#rules) e [risposte](../services/firewall.md#replies).

### La traduzione degli indirizzi {#nat}

Un router o un firewall può cambiare gli indirizzi di un pacchetto, nell'ordine che dà un senso alle sue regole. Un pacchetto indirizzato al dispositivo viene prima mandato all'indirizzo che un [inoltro](../services/nat.md#forwards) indica. Il firewall vede allora la destinazione vera e la partenza vera. Per ultimo, un nuovo flusso che esce da una porta con il [NAT in uscita](../services/nat.md#source-nat) prende l'indirizzo di quella porta, e il dispositivo ricorda il flusso per tradurre indietro la risposta.

Un simbolo Cloud il cui nome contiene Internet non trasporta indirizzi privati. Un pacchetto che arriva lì con un indirizzo di partenza o di destinazione privato si ferma, e il motivo dice quale dei due e che cosa avrebbe dovuto tradurlo: [Internet non trasporta indirizzi privati](../services/nat.md#private). Quando Internet è di mezzo, un dispositivo dietro il NAT viene raggiunto al suo indirizzo pubblico se ne ha uno, altrimenti all'indirizzo con cui un inoltro lo pubblica, e una nota lo dice.

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
```

Per il web c'è un inoltro e per il ping no: lo stesso server si raggiunge con una domanda e non con l'altra. Regole e inoltri nominano un [servizio](../services/firewall.md#rules): ping, web, email o DNS.

## Al livello 2 {#layer-2}

La consegna cerca il dispositivo che risponde per l'indirizzo successivo sulla rete del mittente. Parte lungo i cavi e li percorre in ampiezza, nell'ordine in cui i cavi sono stati disegnati, così che **si prende la catena di cavi più corta che funziona**. A parità di lunghezza si prende quella trovata per prima. Una porta spenta, un cavo tagliato o una VLAN che non passa vengono aggirati quando il disegno offre un'altra strada. Lo spanning tree non è simulato: un disegno con un anello di switch viene percorso senza girare in tondo, e nessuna porta viene bloccata.

A ogni cavo il motore controlla, in quest'ordine:

1. **Il cavo e il dispositivo all'altro capo.** Un cavo tagliato da un guasto simulato, o un dispositivo spento, non porta nulla.
2. **La porta da cui esce è accesa.** `port 1 on SW-Office is disabled`.
3. **La VLAN può uscire da quella porta.** Su uno switch che applica le VLAN, una porta di accesso lascia uscire solo la sua VLAN, e un trunk solo quelle che trasporta: `VLAN 10 does not leave through port 2 on SW-Office: it is in the default VLAN 1`. Vedi [VLAN](../building/vlans.md) e, per la regola sulle porte che nessuno ha toccato, [la VLAN 1](../building/vlans.md#vlan-1).
4. **Un router o un firewall senza indirizzi sulle porte** lascia passare il pacchetto, e un firewall di questo tipo applica comunque le sue regole e la sua politica delle zone tra le due porte attraversate.
5. **La porta a cui arriva è accesa.**
6. **Il dispositivo che raggiunge.** Uno switch o un access point prende la trama se la VLAN può entrare da quella porta, e la ricerca prosegue da lui. Un router con indirizzi sulle porte non porta mai una trama per altri: risponde se l'indirizzo è quello della porta a cui arriva il cavo (uno qualunque dei suoi, quando l'estremità del cavo non è assegnata a nessuna porta), altrimenti la ricerca non passa da lui. Lo stesso vale per un dispositivo finale.

L'estremità di un cavo è assegnata a una porta o a una scheda di rete del suo dispositivo ([le due estremità](../building/cables.md#ends)). Le regole che appartengono a una porta, come il suo stato, la sua VLAN e la sua zona, si applicano solo quando questo è noto. Un'estremità non assegnata viene accettata, e la risposta porta una nota: `link A–B has no port binding…: per-port rules skipped`.

Quando nessuno risponde per l'indirizzo, il motivo è la prima cosa che ha fermato il pacchetto sulla catena di cavi più corta verso il dispositivo che avrebbe dovuto rispondere. Ciò che l'ha fermato su un ramo laterale non dice nulla sulla strada fin lì. Quando non l'ha fermato nulla, il motivo è ciò che non va nella rete: il dispositivo è su un'altra rete e in mezzo non c'è un router (`no router between subnets 192.168.10.0 and 192.168.20.0 — L2 devices cannot route`), oppure un dispositivo finale sta in mezzo (`PC-2 is an end device: it does not forward traffic for others`), oppure un router sta tra due dispositivi indirizzati nella stessa rete (`… a router does not pass traffic within one network`), oppure nessuno ha quell'indirizzo.

## Chi inoltra che cosa {#who-forwards}

Ciò che un dispositivo fa del traffico che non è per lui dipende da che cos'è.

| Dispositivo | In transito |
|---|---|
| Router, firewall con indirizzi sulle porte | instrada con la sua tabella, e non fa mai passare traffico dentro una rete sola |
| Switch, access point, e ogni altro dispositivo costruito con delle porte | collega dentro una rete sola, VLAN per VLAN |
| Router, firewall **senza** indirizzi sulle porte | trasparente: lascia passare il traffico (un firewall applica comunque le sue regole e la sua politica delle zone tra le due porte); non si verifica nulla, e una nota lo dice |
| Simbolo Internet o Cloud, bilanciatore di carico | non simulato: si assume che lasci passare il traffico, con una nota |
| PC, server e altri dispositivi finali | nulla: un dispositivo finale non porta traffico per altri |

Un simbolo Cloud il cui nome non contiene Internet (la rete di un operatore, una linea privata) porta tutto ciò che lo attraversa, indirizzi privati compresi.

## Flussi: più di un pacchetto {#flows}

Una domanda è raramente un pacchetto solo. Il motore trasforma ogni tipo di traffico in **tratti**, ciascuno un pacchetto che va in un verso, e segue ogni tratto come sopra. I tratti si valutano in ordine e la valutazione si ferma alla prima che fallisce: il motivo ne porta il nome (`request:`, `HTTP response:`, `delivery:`).

| Traffico | Tratti | Per un firewall è |
|---|---|---|
| Ping | richiesta, poi risposta | ping |
| Pagina web | richiesta HTTP, poi risposta HTTP | web |
| Download di un file | richiesta del file, poi dati del file | web |
| Email | invio SMTP al relay, poi consegna dal relay | email |

- **Una risposta è un pacchetto a sé.** Parte solo se la richiesta è arrivata, torna all'indirizzo da cui la richiesta sembrava venire, e prende la strada che le dicono le sue tabelle. Può prendere un'altra strada rispetto alla richiesta, e può fallire dove la richiesta non ha fallito. Un firewall che ha visto la richiesta la lascia passare perché risponde a un flusso che ha permesso; un firewall che la richiesta non ha attraversato la giudica come un pacchetto nuovo. I dispositivi NAT lungo la strada la traducono indietro.
- **L'email non ha risposta.** Il relay dipende dalla modalità email in Impostazioni → Rete, gruppo «Simulazione», campo «Modalità email (SMTP)». «Server di posta interno» usa il server di posta con meno cavi dal mittente, contati sul disegno. «Cloud (M365, Gmail…)» usa l'uscita verso Internet più vicina: un simbolo Internet o Cloud, oppure un dispositivo che nel nome ha Internet, Cloud, WAN o ISP come parola a sé (`ISP-Router`, `R-WAN`, `WAN1`, ma non `Display-1`). «Auto (rileva automaticamente)» preferisce il server di posta e ripiega sull'uscita, con una nota. Quando il destinatario è il server di posta c'è un tratto solo; quando lo è il mittente, la sola consegna.
- **Una pagina da un dispositivo che non è un server** si segue lo stesso, con una nota.

```ncl sample=office
pixelcake> mail PC-2 from PC-1
Mailing PC-2 (192.168.10.12) from PC-1...
  ✓ SMTP submit: PC-1 → Mail-01
  ✓ delivery: Mail-01 → PC-2
Mail delivered to PC-2
```

Siccome una risposta si valuta a parte, un ping può fallire dove un `trace` verso lo stesso dispositivo riesce. Nella rete delle due sedi, togli al router della filiale le rotte che tornano alla sede: la richiesta arriva, e la risposta non trova la strada del ritorno.

```ncl sample=two-sites
pixelcake> remove route 192.168.1.0/24 from R-Filiale
R-Filiale: 2 routes to 192.168.1.0/24 removed
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
pixelcake> ping PC-Filiale-1 from PC-Sede-1
Pinging PC-Filiale-1 (192.168.2.11) from PC-Sede-1...
Ping failed (blocked): reply: R-Filiale has no route to 192.168.1.11
  dropped at: R-Filiale
```

## I guasti simulati {#failures}

In [presentazione](presentation.md#failures) un dispositivo può essere dato per spento e un cavo per tagliato. Il disegno non cambia: il motore riceve l'elenco dei guasti insieme al disegno, e attraverso quei dispositivi e quei cavi non fa passare nulla.

- Un dispositivo spento non manda nulla e non prende nulla. Un cavo tagliato non porta nulla. I motivi sono `SW-Core is down` e `link R-HQ–R-Branch is down`.
- La consegna li aggira quando il disegno offre un'altra strada, e un router ritira una rotta che non ha più nessun cavo che funzioni (vedi [le rotte di riserva](#backup-route)).
- Un'assegnazione DHCP non cambia: un dispositivo tiene l'indirizzo che aveva, anche quando è spento il suo server DHCP.
- Una ricerca di nome è una domanda come le altre. Con il server DNS spento, o la strada verso di lui tagliata, un nome non trova nessun indirizzo mentre gli indirizzi rispondono ancora.

Il terminale interroga lo stesso motore con gli stessi guasti per tutto il tempo che dura la presentazione.

## I motivi e le note {#reasons}

Una risposta è uno di quattro verdetti:

| Verdetto | Significato |
|---|---|
| `success` | la destinazione ha risposto (e, per un flusso, ogni tratto è arrivato) |
| `blocked` | il pacchetto è stato scartato per strada: il motivo dice perché, e dove |
| `unreachable` | nessuna catena di cavi unisce i due dispositivi |
| `error` | la domanda non si può provare: un'estremità non esiste, non ha un indirizzo utilizzabile o ha un indirizzo in conflitto, le due estremità di una pagina, di un download o di un'email sono lo stesso dispositivo, oppure non c'è un server di posta o un'uscita verso Internet da cui far passare un'email. (Un dispositivo che fa il ping a se stesso risponde, senza che il pacchetto esca, come fa un `trace` verso se stesso.) |

Quando il pacchetto si ferma, la risposta dice due cose: il **motivo**, in una frase che nomina il dispositivo, la porta, la rotta o la regola; e il **dispositivo dove si è fermato**, `dropped at:` nel terminale, la cornice rossa nel pannello e nella presentazione. È il dispositivo che ha in mano il pacchetto quando si ferma. Per una porta, una regola o una rotta è il dispositivo a cui appartengono; per un cavo tagliato o un dispositivo spento è il dispositivo davanti, l'ultimo che poteva ancora mandare. In un flusso il motivo comincia con il nome del tratto che è fallito.

```ncl sample=office
pixelcake> interface 1 down on SW-Office
port 1 on SW-Office is now down
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: port 1 on SW-Office is disabled
  dropped at: SW-Office
pixelcake> interface 1 up on SW-Office
port 1 on SW-Office is now up
pixelcake> set gateway of PC-1 to 192.168.10.99
PC-1: gateway set to 192.168.10.99
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.99, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
```

I motivi sono scritti in inglese, in entrambe le lingue dell'interfaccia, e nominano i dispositivi come li nomina il disegno. Questi sono i più frequenti:

| Il motivo dice | Vuol dire |
|---|---|
| `no default gateway configured on PC-1` | un dispositivo deve uscire dalla sua rete e non ha un gateway |
| `Router-1 has no route to 192.168.30.11` | un router non ha nessuna voce per la destinazione |
| `PC-1 uses gateway …, but Router-1 port 1 on its network is …` | il gateway non è l'indirizzo di nessuna porta di router su quella rete |
| `port 2 on SW-Office is disabled` | la porta è spenta |
| `VLAN 10 does not leave through port 2 on SW-Office: …` | la VLAN del pacchetto non può uscire da quella porta |
| `firewall FW-Edge: denied by rule 2 (…)` | una regola dice di negare, con il suo numero |
| `firewall FW-Edge: no rule matches, zone policy dmz → trust denied` | nessuna regola decide, e decidono le zone |
| `router Router-Core: no rule allows it` | un router ha delle regole, e nessuna permette il pacchetto |
| `address conflict: 192.168.20.10 is on both Web-01 and Mail-01, …` | due dispositivi hanno l'indirizzo a cui va la domanda, o da cui parte |
| `Internet does not carry private addresses: …` | un indirizzo privato è arrivato al simbolo Internet |
| `SW-Core is down`, `link R-HQ–R-Branch is down` | un guasto simulato |
| `PC-2 is an end device: it does not forward traffic for others` | l'unica strada passa da un dispositivo finale |
| `Laptop-1 has no address: no DHCP server answers on its network` | una scheda in DHCP non ha ricevuto un indirizzo |
| `routing loop: the packet comes back to Router-1` | due router se lo rimandano |

Ciò che il motore non può verificare **non passa mai in silenzio come un successo**: aggiunge una nota alla risposta. Una nota non è un errore. Quelle più frequenti:

- `Router-1 has no interface addresses: gateway and routing not verified`: le porte del router non hanno indirizzo, quindi si assume che faccia passare il pacchetto.
- `Internet is not simulated: traffic assumed to pass`: il simbolo Internet è un segnaposto. `203.0.113.1 is not in the drawing: Internet assumed to take the traffic` dice che un gateway appartiene al mondo esterno.
- `link A–B has no port binding…: per-port rules skipped`: un'estremità di un cavo non è assegnata a nessuna porta o scheda.
- `firewall FW-1 has no zone binding: allowed`, oppure una regola che `names a zone and the link is not attached to a port: skipped`, o che `names a zone and port 4 is in no zone: skipped`.
- `firewall FW-1: allowed by rule 1 (…)`, `router R-1: denied by rule 1 (…)`, `NAT: source … → …`, e la riga su una rotta che non si può usare e su quella usata al suo posto, che dicono che cosa ha fatto il dispositivo e sono lì per essere lette.

Il terminale stampa le note sotto la risposta. Il pannello della simulazione mostra solo il motivo per cui il pacchetto si è fermato; la [presentazione](presentation.md#ask) mostra il percorso salto per salto con le note di ogni salto, e `trace` le stampa nel terminale.

## Che cosa non è simulato {#not-simulated}

> [!LIMITS]
> - **Non è un simulatore di pacchetti.** Non ci sono ARP, tabelle MAC, spanning tree, instradamento dinamico (RIP, OSPF, BGP) né ridondanza del gateway: un host ha un gateway per ogni scheda di rete. Le rotte sono quelle scritte.
> - **Si guarda solo la linea.** Una rotta viene ritirata quando la porta da cui esce è spenta, o quando la sua linea non porta nulla: i cavi sono tagliati, i dispositivi all'altro capo sono spenti, o lì le interfacce sono spente. Un prossimo salto che si spegne dietro uno switch non si vede, come con una rotta statica su un apparato vero, e il pacchetto si perde lì.
> - **Non ci sono tempo e carico.** Il tempo che stampa `ping` è ricavato dal numero di salti della richiesta (1 ms più 2 ms per ogni dispositivo tra le due estremità). Non ci sono velocità dei cavi, code, congestione, perdita di pacchetti o timeout.
> - **Quattro servizi.** Un flusso è ping, web, email o DNS (un download è web per un firewall). Non ci sono porte TCP o UDP, e il traffico indirizzato al firewall stesso non viene filtrato.
> - **Il NAT è per servizio, non per numero di porta.** Due flussi non si contendono mai una traduzione. Un server raggiunto da dentro al suo indirizzo pubblicato non è trattato a parte, e un dispositivo dietro due livelli di NAT si trova per nome solo attraverso il primo.
> - **Un'assegnazione DHCP è calcolata, non negoziata.** Niente durata dell'assegnazione, rinnovo o prenotazione, niente relay attraverso un router, e una porta di router non può prendere il proprio indirizzo dal DHCP.
> - **Il DNS è un solo server, interrogato ogni volta.** Niente secondo server, niente inoltro tra server, niente cache, niente ricerca inversa, niente alias o nomi jolly. I nomi sono per il terminale.
> - **Le sottointerfacce dei router non sono modellate.** Per passare da una VLAN all'altra serve una porta di router in ciascuna VLAN.
> - **Internet è un segnaposto.** Il simbolo chiamato Internet trasporta indirizzi pubblici e rifiuta quelli privati; dietro di lui non si simula nulla. Un bilanciatore di carico lascia passare il traffico senza bilanciarlo.
>
> Gli stessi limiti, in un posto solo, sono in [che cosa non è simulato](../reference/limits-and-faq.md#not-simulated).
