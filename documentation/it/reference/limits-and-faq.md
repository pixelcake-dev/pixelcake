---
title: "Limiti e domande"
description: "Tutto ciò che PixelCake non simula, in un posto solo, e le risposte alle domande che si fanno."
order: 5
---

PixelCake è una beta. Va bene per esplorare e spiegare una piccola rete, e non è uno strumento per validarne una vera: quando non può verificare qualcosa lo dice in una nota, ma non può dirti che cosa farebbe un apparato vero oltre ciò che è elencato qui. Questa pagina raccoglie ciò che l'app non fa. Ogni gruppo nomina la pagina che spiega la funzione a cui appartiene.

## Che cosa non è simulato {#not-simulated}

**I pacchetti.** PixelCake non è un simulatore a livello di pacchetto. Non c'è ARP, non c'è l'apprendimento degli indirizzi MAC, quindi nessuna tabella di indirizzi su uno switch, e un indirizzo su due dispositivi si trova nel disegno, non nel traffico ([due dispositivi con lo stesso indirizzo](../building/addresses.md#conflicts)). Il tempo che un ping stampa si ricava dai cavi e dai dispositivi della sua strada, con valori tipici: non ci sono la banda, code o congestione, variazioni del ritardo né perdite ([il tempo di un ping](../asking/how-the-engine-decides.md#time)). Nemmeno Internet è simulato: il suo simbolo è un sostituto che porta gli indirizzi pubblici, con una nota, e rifiuta quelli privati come fa Internet, in entrata e in uscita; un simbolo Cloud con un altro nome porta tutto, con una nota. Come il motore arriva a una risposta è spiegato in [Come decide il motore](../asking/how-the-engine-decides.md#not-simulated).

**L'instradamento.** Le rotte sono statiche. Un router conosce le reti a cui è collegato e le rotte scritte su di esso; non c'è instradamento dinamico. Una rotta di riserva subentra solo quando la linea risulta caduta, cioè quando l'interfaccia della rotta principale non ha più nessun cavo che funzioni (tagliato, con il dispositivo all'altro capo spento, o con la porta all'altro capo spenta): un prossimo salto che si guasta dietro uno switch non viene notato, come con una semplice rotta statica su un apparato vero. Un host ha un gateway per scheda di rete e non c'è nessun protocollo di ridondanza del gateway. Vedi [Rotte](../services/routes.md#limits).

**Switch e VLAN.** Lo spanning tree non è simulato: un disegno con cavi ridondanti viene percorso senza anelli, e si prende la strada più breve che funziona, ma nessuna porta viene bloccata. Per passare da una VLAN all'altra serve una porta di router o di firewall in ciascuna; le sottointerfacce di un router (un "router on a stick") non sono modellate. Il traffico senza etichetta di un trunk è sempre nella VLAN 1, senza una VLAN nativa da scegliere. Non ci sono VTP o GVRP, la VLAN voce, le VLAN private, la doppia etichetta. Vedi [VLAN](../building/vlans.md#limits).

**Il firewall.** Le regole conoscono quattro servizi: ping, web, email e DNS. Non ci sono numeri di porta, né stati della connessione oltre a "un firewall lascia passare la risposta a un flusso che ha permesso lui stesso", né ispezione del contenuto. Anche un router filtra con le sue regole: non ha zone, e appena ha una regola ciò che nessuna regola permette viene bloccato, come sui router veri. Un firewall con una regola fa lo stesso dove non conosce la zona di un lato, un cavo non assegnato a una porta o una porta senza zona, perché lì la sua politica delle zone non può decidere. Le sue regole tengono lo stato come quelle di un firewall, dove una semplice lista di accesso vorrebbe una regola anche per le risposte. Il traffico indirizzato al firewall stesso non viene filtrato. L'impostazione `ips` di una porta resta come documentazione: non cambia nulla. Vedi [Firewall](../services/firewall.md#limits).

**Il NAT.** La traduzione è per servizio, non per numero di porta: un inoltro è "questo servizio, che arriva su questa porta", e due flussi non competono mai per una traduzione. Un server raggiunto dall'interno al suo indirizzo pubblicato non è trattato a parte, e un dispositivo dietro due livelli di NAT si trova per nome solo attraverso il primo. Vedi [NAT](../services/nat.md#limits).

**L'email.** Un'email è una consegna a un server di posta, una ritrasmissione fra due server e un prelievo da parte del destinatario, tutti con il servizio email: non ci sono SMTP, IMAP o POP3, né porte, né code, né caselle da guardare dentro. Un fornitore cloud non è simulato: la sua casella si considera oltre il simbolo Internet. Vedi [i flussi](../asking/how-the-engine-decides.md#flows).

**Il DHCP.** Un'assegnazione è ricavata dal disegno, non negoziata: non ci sono durate, rinnovi né prenotazioni, e mettere in DHCP un dispositivo disegnato prima degli altri sposta gli indirizzi di quelli che vengono dopo. Un server dà indirizzi solo alla propria rete (nessun relay attraverso un router), e una porta di router o di firewall non può prendere il suo indirizzo dal DHCP. Un guasto simulato non toglie un indirizzo. Vedi [DHCP](../services/dhcp.md#limits).

**Il DNS.** Un server solo, interrogato ogni volta. Una scheda indica un solo server DNS, senza un secondo di riserva; un server risponde solo per i nomi scritti su di esso e non inoltra mai una domanda a un altro; niente viene tenuto in memoria; non c'è la ricerca inversa, né alias né nomi jolly. Un server DNS pubblico che non è nel disegno, per il motore, non esiste. I nomi sono per il terminale: il pannello della simulazione e la presentazione scelgono i dispositivi dai menu. Vedi [DNS](../services/dns.md#limits).

**I guasti.** Un guasto appartiene a una presentazione e sparisce quando finisce: non viene salvato con il progetto. Il terminale vede i guasti della presentazione ma non può crearne né ripararne. Vedi [Presentazione](../asking/presentation.md#failures).

**Le immagini.** Un'immagine contiene un canvas solo: un progetto con più canvas si esporta un canvas alla volta. I suoi testi sono composti con il carattere del computer, non con quello dell'interfaccia, che un'immagine non può portarsi dietro, quindi la stessa immagine su un altro computer può avere lettere un po' diverse. Un PNG di un disegno molto grande viene ridotto a ciò che il browser riesce a creare, e la finestra lo dice. Vedi [Esportare un'immagine](../asking/exporting-an-image.md#limits).

**Il progetto.** Si annullano al massimo 100 passi per canvas, e solo finché la pagina resta aperta: ricaricandola si perdono ([Annullare e ripetere](../getting-started/interface.md#undo)). Non ci sono account né condivisione: un progetto è un file sul tuo disco, e due schede del browser aperte sullo stesso progetto non vedono le modifiche l'una dell'altra, vince l'ultima che scrive ([salvare](../getting-started/saving-and-files.md#two-tabs)). Il formato YAML è proprio di PixelCake, e contiene la rete, le sue posizioni e i suoi riquadri, non le impostazioni del progetto. L'esportazione Terraform è una bozza che non si può applicare, e uno stato Terraform non si può leggere ([YAML](yaml.md#limits)). Anche tastiera e mouse hanno le loro lacune ([scorciatoie](shortcuts.md#board)).

## Domande {#faq}

**Posso usarlo per validare una rete vera?** No. Segue le regole qui sopra, e una rete vera ne ha molte di più. Serve a ragionare su come dovrebbe comportarsi una piccola rete, e a mostrarla a qualcuno.

**Dove sta il mio lavoro?** Nella memoria del browser che stai usando, mentre lavori: ricarica la pagina e c'è ancora. Non sta su un server, non ti segue su un altro browser o computer, e non sopravvive alla cancellazione dei dati del sito né alla chiusura di una finestra privata. Per tenerlo, o per portarlo altrove, salva il progetto su file con File → Salva ([il file del progetto](project-file.md#format)).

**Funziona senza connessione?** Una volta caricata la pagina, sì: disegnare, fare domande, il terminale e le esportazioni hanno funzionato anche con la rete staccata. L'unica cosa che può ancora chiedere al sito è il file di un carattere. Non si installa come app e non tiene una copia di sé per l'uso senza connessione, quindi, per riaprirla senza connessione, il browser deve avere ancora la pagina.

**Manda qualcosa da qualche parte?** No. Dietro l'app non c'è nessun server: mentre lavori non fa richieste per conto suo, non ha statistiche, e nulla di un progetto lascia il computer a meno che non sia tu a salvarlo, esportarlo o copiarlo. I caratteri e le icone fanno parte dell'app e non vengono presi da nessun'altra parte. Un collegamento al sito, al repository o alla documentazione si apre solo quando ci fai clic.

**C'è un account?** No, e non c'è niente a cui accedere.

**Quanto costa?** Niente. È gratuito e open source ([licenze](licences.md#app)).

**Posso usarlo al lavoro?** Sì, la licenza lo permette. Quello che disegni resta sul tuo computer. Ricorda che le sue risposte non validano una rete vera.

**Posso annullare?** Sì: Modifica → «Annulla» o Ctrl + Z, e Modifica → «Ripeti» o Ctrl + Y. Ogni canvas tiene i suoi ultimi 100 passi finché la pagina resta aperta; che cosa è un passo e che cosa no è in [Annullare e ripetere](../getting-started/interface.md#undo). Per tornare più indietro, o dopo aver ricaricato la pagina, salva il progetto su file prima della modifica e riaprilo.

**Perché un ping si ferma a uno switch?** Lo dice il motivo. Uno switch ferma un flusso quando la porta da cui dovrebbe uscire è spenta, quando manca un cavo, o quando le porte sono in VLAN diverse: la risposta nomina la porta e la VLAN ([VLAN](../building/vlans.md#vlan-1)).

**Perché un firewall blocca ciò che nessuna sua regola nomina?** Ha una regola, e non conosce la zona di un lato: un cavo non è assegnato a una porta (su un firewall con zone un cavo nuovo non lo è mai da solo), o la porta non ha zona. Senza le due zone la politica delle zone non può decidere, quindi la lista finisce come quella di un router: ciò che nessuna regola permette viene bloccato. Il motivo dice quale lato, `the link is not attached to a port` o `port 2 is in no zone`, e le regole saltate per questo: assegna il cavo in «Modifica connessione», o metti la porta in una zona ([Firewall](../services/firewall.md#zones)).

**Perché un dispositivo è giallo, con `in conflitto` sotto l'indirizzo?** Un altro dispositivo ha lo stesso indirizzo, e i due possono incontrarsi: una domanda verso di lui, o che parte da lui, non è affidabile. Succede dopo aver incollato un server, un router, un firewall o uno switch, che tengono gli indirizzi dell'originale. Dai a uno dei due un altro indirizzo ([due dispositivi con lo stesso indirizzo](../building/addresses.md#conflicts)).

**Perché un dispositivo non ha un indirizzo?** Una scheda con il DHCP non ne ha finché un server della sua rete non risponde; una domanda che la coinvolge ne dice il motivo: nessun server sulla sua rete, un intervallo esaurito, un cavo che manca ([DHCP](../services/dhcp.md#no-address)).

**Perché il terminale è in inglese se l'interfaccia è in italiano?** Il linguaggio del terminale, NCL, è inglese in tutte e due le lingue: i comandi, ciò che stampano e i motivi del motore. La finestra attorno è tradotta ([il terminale](../terminal/index.md#open)).

**Come porto un progetto su un altro computer?** Salvalo su file qui e apri il file là: File → Apri…. Il file contiene tutti i canvas.

## Segnalare un problema {#report}

Apri una segnalazione su [github.com/pixelcake-dev/pixelcake/issues](https://github.com/pixelcake-dev/pixelcake/issues): la schermata di benvenuto ha un collegamento, «Segnala un problema». Di' che cosa hai fatto, che cosa ti aspettavi e che cosa è successo, in quale browser, e aggiungi il file del progetto se è piccolo, oppure i comandi del terminale che lo mostrano. Un file di progetto contiene i nomi che hai dato ai dispositivi e le note che hai scritto: guardalo prima di allegarlo. Puoi anche scrivere a pixelcake.dev@gmail.com.

Un problema di sicurezza va segnalato in privato, non in una segnalazione pubblica: [SECURITY.md](https://github.com/pixelcake-dev/pixelcake/blob/main/SECURITY.md) spiega come.

## Contribuire {#contributing}

Le correzioni a queste pagine, le segnalazioni di errori e quelle di una risposta sbagliata del motore sono l'aiuto più utile. [CONTRIBUTING.md](https://github.com/pixelcake-dev/pixelcake/blob/main/CONTRIBUTING.md) spiega come preparare l'ambiente e che cosa chiedono i controlli. Una pull request viene accettata con il [Contributor Licence Agreement](https://github.com/pixelcake-dev/pixelcake/blob/main/CLA.md), l'accordo per chi contribuisce, che si accetta spuntando una casella nella sua descrizione: resti autore di quello che scrivi, e dai al responsabile del progetto una licenza per pubblicarlo in PixelCake, con l'AGPL o con altre licenze.
