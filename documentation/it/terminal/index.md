---
title: "Panoramica e convenzioni"
description: "Il terminale di PixelCake e il suo linguaggio, NCL: come si apre, come si scrive un comando, che cosa dice una risposta."
order: 1
---

Con il terminale fai domande alla rete e la cambi scrivendo comandi, in un linguaggio che non appartiene a nessun produttore: NCL, Network Command Language. `ping Web-01 from PC-1` chiede se un dispositivo ne raggiunge un altro; `interface 3 down on Router-1` spegne una porta. Entrambi lavorano sul disegno che vedi, e con lo stesso motore del pannello della simulazione: una domanda fatta dal terminale viaggia sul canvas, e un comando che cambia la rete modifica il canvas.

Il linguaggio è un inglese semplice, con alcune piccole parole facoltative; maiuscole e minuscole non contano, e il nome di un dispositivo si scrive com'è sul canvas. Non copia i comandi di nessun produttore. Questa sezione è il riferimento del linguaggio: ogni comando, con la sua sintassi, ciò che fa, e ciò che stampa quando viene rifiutato. Il terminale parla inglese in entrambe le lingue dell'app, quindi i comandi e le risposte di queste pagine sono quelli delle pagine inglesi; cambiano solo le spiegazioni.

![Un ping digitato nel terminale: il pacchetto viaggia sul canvas da PC-1 a Server-1 passando da Switch-1, e le righe della risposta compaiono man mano che raggiunge ogni dispositivo. Poi un trace della stessa strada.](../../media/terminal/ping-on-the-board.it.mp4 "Un ping e un trace digitati nel terminale, e il pacchetto sul canvas.")

## Aprire il terminale {#open}

Si apre in tre modi:

- **«Console»**, il quarto pulsante della barra a sinistra, apre il terminale.
- **Clic destro su un dispositivo → «Console»** lo apre già dentro quel dispositivo: il prompt è il nome del dispositivo, e `from` e `on` sono sottintesi ([`use`](help.md#use)).
- **«Terminale»**, nella barra in alto di una presentazione, lo apre mentre si presenta ([il terminale durante la presentazione](../asking/presentation.md#terminal)).

Il terminale è una finestra a sé, non una finestra di dialogo: non oscura lo sfondo, e il canvas dietro resta utilizzabile. Si apre piccolo, a destra del canvas, così il disegno resta in vista. Lo si trascina dalla barra del titolo, si ridimensiona dall'angolo in basso a destra, e si chiude con la croce a destra della barra del titolo, oppure con Esc. Chiuderlo non lo svuota: ciò che era stato stampato, e le righe che si richiamano con il tasto Su, ci sono ancora quando lo riapri, finché la pagina non viene ricaricata.

La finestra comincia con `PixelCake Terminal` e `type 'help' to list commands`. Il prompt è `pixelcake>`; dentro un dispositivo è il nome del dispositivo, `PC-1>`. Si digita una riga e si preme Invio. I tasti della riga di comando sono in [Aiuto e sessione](help.md#keys). La finestra e la sua cornice seguono la lingua dell'interfaccia («Terminale» e il nome della riga di comando sono tradotti); ciò che si digita e ciò che viene stampato è in inglese in tutte e due le lingue.

Mentre una domanda viaggia il prompt non torna finché il pacchetto non ha fatto tutta la strada, e le righe compaiono man mano che il pacchetto raggiunge ogni dispositivo. Ctrl+C la ferma. Quando il pacchetto è arrivato il dispositivo che risponde diventa verde sul canvas, e quando è stato fermato diventa rosso il dispositivo che l'ha fermato, fino alla domanda successiva, a una modifica del disegno, o a un clic su un punto vuoto del canvas ([Interrogare](asking.md)).

## Come si scrivono i comandi qui {#conventions}

Ogni comando ha un **blocco di sintassi**: la forma del comando, senza prompt. Questi caratteri non si digitano; dicono come leggere la forma:

| Scritto | Significa |
|---|---|
| `ping`, `from` | Una parola da digitare com'è. Maiuscole e minuscole non contano |
| `<device>` | Un valore che sostituisci con il tuo: il nome di un dispositivo, un indirizzo, un numero. Che cosa sia lo dice la tabella sotto il blocco |
| `[from <device>]` | Facoltativo |
| `trust\|untrust\|dmz` | Uno di questi, com'è (scritto con una barra, `\|`, nella cella di una tabella) |
| `[of] <device>` | Una piccola parola che si può tralasciare: `show config of PC-1` e `show config PC-1` sono la stessa cosa |
| `<vlan>,<vlan>,…` | Un elenco, lungo quanto serve, con le virgole |

Dopo il blocco una tabella dice che cos'è ogni valore, e il testo dice che cosa fa il comando alla rete e che cosa stampa. Le parole che significano la stessa cosa sono mostrate come sinonimi nel blocco: `ls` e `list` sotto `show devices`.

Un **esempio** è una sessione con il suo prompt: le righe che cominciano con `pixelcake>` si digitano, le righe sotto sono ciò che il terminale stampa, parola per parola. Gli esempi vengono eseguiti sull'app ogni volta che la documentazione viene generata, quindi non sono mai superati. Ogni esempio parte da una rete di esempio, indicata sopra l'esempio, e i comandi si susseguono: una modifica fatta da una riga vale anche per le righe successive. Le reti sono quelle della scheda «Esempi» del pannello «Aggiungi» ([le reti di esempio](../reference/samples.md)).

```ncl sample=office
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=0.44ms
pixelcake> interface 2 down on Router-1
port 2 on Router-1 is now down
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: port 2 on Router-1 is disabled
  dropped at: Router-1
```

Nelle pagine italiane le reti di esempio vengono caricate in italiano e i dispositivi hanno nomi italiani (PC-Vendite, Portatile-1), mentre i comandi e le risposte restano in inglese.

Quando si digita `use <device>` il prompt prende il nome del dispositivo, e l'esempio lo mostra così: `PC-1> ping Web-01`.

## Dispositivi, indirizzi, nomi {#names}

Un dispositivo si indica con il nome che ha sul canvas:

- **Maiuscole e minuscole non contano**: `pc-1`, `PC-1` e `Pc-1` sono lo stesso dispositivo.
- **Un nome può avere più parole**: `ping PC Sales 1 from Core Switch HQ`. Le piccole parole `from`, `to`, `of`, `on` e `via` spezzano la riga, così che il nome non abbia bisogno di virgolette, a meno che non contenga una di queste parole: allora va scritto tra virgolette doppie.
- **Un indirizzo sta per un dispositivo**: dove ci si aspetta un dispositivo si può digitare uno dei suoi indirizzi. In una domanda conta proprio quell'indirizzo: `ping 192.168.20.1` raggiunge quell'interfaccia del router, e non l'indirizzo con cui il router è conosciuto.
- **Un nome di host è una destinazione**: dove una domanda ha una destinazione si può scrivere `www.azienda.example`. Il dispositivo di partenza chiede prima l'indirizzo al suo server DNS, poi la domanda va a quell'indirizzo ([Interrogare](asking.md#targets)).
- **Un nome che non si trova non viene mai indovinato.** La risposta è `device not found: "Web 01"` e, quando un dispositivo ha un nome vicino, `did you mean "Web-01"?`. Un verbo sconosciuto, o una parola sconosciuta dopo `show`, riceve una risposta dello stesso tipo.

`use <device>` fa di un dispositivo il soggetto di ogni comando che segue ([Aiuto e sessione](help.md#use)). Le parole `the`, `a`, `device` e `host` prima di un nome vengono ignorate ([La grammatica](grammar.md#tolerances)).

## Che cosa dice una risposta {#answers}

Una risposta è l'insieme delle righe che il terminale stampa dopo un comando. Le righe hanno colori diversi: verde per ciò che è riuscito, rosso per ciò che è stato rifiutato o è fallito, grigio per ciò che si dice di passaggio (una nota, un avviso, un suggerimento), e bianco per tabelle ed elenchi.

**Una domanda** (`ping`, `trace`, `browse`, `mail`, `download`, `resolve`) ha nell'ultima riga una di quattro parole, il suo *verdetto*: `success`; `blocked`, quando un dispositivo ha scartato il pacchetto; `unreachable`, quando nessun cavo unisce i due dispositivi; `error`, quando la domanda non si può nemmeno fare. Una domanda fallita dà il motivo, nei termini della rete: il dispositivo, la porta, la rotta o la regola. Sotto, `dropped at:` nomina il dispositivo che ha fermato il pacchetto. Le righe che cominciano con `note:` sono ciò che il motore ha supposto o fatto lungo la strada senza verificarlo. Tutto è spiegato, con esempi, in [Interrogare](asking.md), e in [come decide il motore](../asking/how-the-engine-decides.md#reasons).

**Un comando che cambia la rete** stampa una riga per ciò che ha fatto, al presente: `port 2 on SW-Office is now down`. Sotto, in grigio, ciò che ne segue (un avviso, un nome trasformato in indirizzo, il comando successivo da provare). Un comando che trova la rete già come richiesto lo dice in grigio e non cambia nulla: `port 2 on SW-Office is already down`.

**Un comando rifiutato** non cambia nulla, e dice che cosa ci si aspettava: la forma del comando, oppure il motivo nei termini della rete. Un comando sconosciuto stampa `unknown command: "<la riga>"`, poi un suggerimento, poi `type "help" for the command list`. Ogni pagina di questa sezione finisce con i rifiuti dei suoi comandi.

## I comandi che cambiano la rete {#edits}

`set`, `interface`, `add`, `remove`, `connect` e gli altri comandi che scrivono fanno le stesse modifiche delle finestre dei dispositivi: passano dallo stesso codice, e il risultato è subito sul canvas. Ciò che scrivono viene salvato con il progetto come ogni altra modifica: nel browser subito, nel file del progetto al salvataggio successivo ([salvare e aprire](../getting-started/saving-and-files.md)).

Un comando controlla ciò che può prima di scrivere, e non scrive nulla se rifiuta. Una modifica al disegno cancella la risposta lasciata sul canvas dall'ultima domanda, perché quella risposta riguardava il disegno com'era. La modalità presentazione non cambia il disegno, e un terminale aperto lì vede i guasti che si stanno simulando ([Presentazione](../asking/presentation.md#terminal)).

## I comandi, per gruppo {#groups}

- [Interfacce e VLAN](interfaces-and-vlans.md): accendere o spegnere un'interfaccia, darle un indirizzo e un gateway, mettere la porta di uno switch in una VLAN, l'elenco delle VLAN di un dispositivo.
- [Dispositivi e indirizzi](devices-and-addresses.md): indirizzo, maschera, gateway e nome di un dispositivo; `connect` e `disconnect`.
- [Rotte](routes.md): `add route`, `add backup route`, `remove route`.
- [Firewall e NAT](firewall-and-nat.md): zone, regole, NAT in uscita, inoltri.
- [DHCP e DNS](dhcp-and-dns.md): una scheda in DHCP, un intervallo da assegnare, il server DNS che una scheda interroga, i record di un server.
- [Interrogare](asking.md): `ping`, `trace`, `browse`, `mail`, `download`, `resolve`, e che cos'è una destinazione.
- [Comandi show](show.md): tutto ciò che legge la rete.
- [Aiuto e sessione](help.md): `help`, `use`, `exit`, `clear`, i tasti del terminale.
- [La grammatica](grammar.md): il linguaggio in una pagina, con le sue tolleranze e i suoi sinonimi.

> [!LIMITS]
> Il terminale sa ciò che sa il motore. ARP e tabelle MAC, spanning tree, instradamento dinamico, sottointerfacce dei router, porte diverse da quelle dei quattro servizi, la banda e il carico di un cavo non sono simulati, e nessun comando ne parla; il tempo di un ping si ricava dai cavi e dai dispositivi della sua strada. I guasti si simulano in modalità presentazione, e i comandi che rompono e riparano un dispositivo o un cavo funzionano solo lì ([`fail`, `repair`](asking.md#failures); [ciò che non è simulato](../reference/limits-and-faq.md#not-simulated)).

## La versione del linguaggio {#version}

Il linguaggio ha una versione sua, ed è la prima riga di `help`: **NCL v0.6**. Fino alla versione 1.0 le forme dei comandi sono stabili, ma i sinonimi e la formulazione delle risposte possono ancora cambiare tra due versioni minori. Che cosa ha aggiunto ciascuna versione:

- **0.6**: il tempo. `ping` stampa il tempo dello scambio ricavato dalla sua strada: i cavi, ciascuno con il suo mezzo e la sua lunghezza o un ritardo scritto a mano, e i dispositivi attraversati. `link <A> to <B>` imposta il mezzo, la lunghezza e il ritardo di un cavo, e `show connections` li stampa. I guasti dal terminale: `fail` spegne un dispositivo o taglia un cavo, `repair` lo rimette a posto (`repair all`: tutto), `show failures` elenca che cosa è fermo e che cosa interrompe nel resto della rete. Agiscono sui guasti della modalità presentazione.
- **0.5**: DNS. Un nome di host funziona come destinazione di `ping`, `trace`, `browse`, `mail` e `download`, e `resolve` lo cerca da solo. Un server ha dei record (`add record`, `remove record`), una scheda indica il suo server DNS (`interface <name> dns`), un server DHCP ne consegna uno, `show dns`. `dns` è un servizio per le regole e gli inoltri, e per `trace … as dns`.
- **0.4**: DHCP. Una scheda prende l'indirizzo da un server (`interface <name> dhcp`), un'interfaccia assegna gli indirizzi di un intervallo (`interface <n> pool`), `show dhcp`. I comandi `show` distinguono un indirizzo assegnato da uno scritto a mano.
- **0.3**: traduzione degli indirizzi. NAT in uscita (`interface <n> nat`), inoltri (`add forward`, `remove forward`), `show nat`. Il simbolo Internet non porta più gli indirizzi privati.
- **0.2**: rotte statiche, regole di firewall, impostazioni di una sola interfaccia (indirizzo, VLAN, zona di sicurezza), scambi completi (`browse`, `mail`, `download`) e `trace … as <service>`.
- **0.1**: `ping` e `trace`, `show` per dispositivi, interfacce, porte, VLAN, connessioni, configurazione, vicini e indirizzi, `set`, l'elenco delle VLAN di un dispositivo, `connect` e `disconnect`, `interface <n> up` e `down`, `use`, `clear` e `help`.

La specifica è [docs/terminal-commands.md](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/terminal-commands.md) nel repository; questa sezione la spiega a chi usa il linguaggio.
