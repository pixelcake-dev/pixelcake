---
title: "Limiti e domande"
description: "Tutto ciò che PixelCake non simula, in un posto solo, e le risposte alle domande che si fanno."
order: 5
---

PixelCake è un prototipo in fase iniziale. Va bene per esplorare e spiegare una piccola rete, e non è uno strumento per convalidarne una vera: quando non può verificare qualcosa lo dice in una nota, ma non può dirti che cosa farebbe un apparato vero oltre ciò che è elencato qui. Questa pagina raccoglie ciò che l'app non fa. Ogni gruppo nomina la pagina che spiega la funzione a cui appartiene.

## Che cosa non è simulato {#not-simulated}

**I pacchetti.** PixelCake non è un simulatore a livello di pacchetto. Non c'è ARP, non c'è l'apprendimento degli indirizzi MAC, quindi nessuna tabella di indirizzi su uno switch. Il tempo che un ping stampa è ricavato dal numero di salti; la velocità del collegamento non lo cambia. Anche Internet non è simulato: il suo simbolo è un sostituto che porta gli indirizzi pubblici, con una nota, e rifiuta quelli privati come fa Internet; un simbolo Cloud con un altro nome porta tutto, con una nota. Come il motore arriva a una risposta è in [Come decide il motore](../asking/how-the-engine-decides.md#not-simulated).

**L'instradamento.** Le rotte sono statiche. Un router conosce le reti a cui è collegato e le rotte scritte su di lui; non c'è instradamento dinamico. Una rotta di riserva subentra solo quando la linea risulta caduta, cioè quando l'interfaccia della rotta principale non ha più nessun cavo che funzioni: un prossimo salto che muore dietro uno switch non viene notato, come con una semplice rotta statica su un apparato vero. Un host ha un gateway per scheda di rete e non c'è nessun protocollo di ridondanza del gateway. Vedi [Rotte](../services/routes.md#limits).

**Switch e VLAN.** Lo spanning tree non è simulato: un disegno con collegamenti ridondanti viene percorso senza anelli, e si prende la strada più breve che funziona, ma nessuna porta viene bloccata. Per passare da una VLAN all'altra serve una porta di router o di firewall in ciascuna; le sottointerfacce di un router (un "router on a stick") non sono modellate. Il traffico senza etichetta di un trunk è sempre nella VLAN 1, senza una VLAN nativa da scegliere. Non ci sono VTP o GVRP, la VLAN voce, le VLAN private, la doppia etichetta. Vedi [VLAN](../building/vlans.md#limits).

**Il firewall.** Le regole conoscono quattro servizi: ping, web, email e DNS. Non ci sono numeri di porta, né stati della connessione oltre a "la risposta a un flusso permesso passa", né ispezione del contenuto. Il traffico indirizzato al firewall stesso non viene filtrato. Il flag `ips` di una porta è documentazione: non cambia nulla. Vedi [Firewall](../services/firewall.md#limits).

**Il NAT.** La traduzione è per servizio, non per numero di porta: un inoltro è "questo servizio, che arriva su questa porta", e due flussi non competono mai per una traduzione. Un server raggiunto dall'interno al suo indirizzo pubblicato non è trattato a parte, e un dispositivo dietro due livelli di NAT si trova per nome solo attraverso il primo. Vedi [NAT](../services/nat.md#limits).

**Il DHCP.** Un'assegnazione è ricavata dal disegno, non negoziata: non ci sono durate, rinnovi né prenotazioni, e mettere sul DHCP un dispositivo disegnato prima degli altri sposta gli indirizzi di quelli che vengono dopo. Un server dà indirizzi solo alla propria rete (nessun relay attraverso un router), e una porta di router o di firewall non può prendere il suo indirizzo dal DHCP. Un guasto simulato non toglie un indirizzo. Vedi [DHCP](../services/dhcp.md#limits).

**Il DNS.** Un server solo, interrogato ogni volta. Una scheda indica un solo server DNS, senza un secondo a cui ripiegare; un server risponde solo per i nomi scritti su di lui e non gira mai una domanda a un altro; niente viene tenuto in memoria; non c'è la ricerca inversa, né alias né caratteri jolly. Un server DNS pubblico che non è nel disegno non è nessuno. I nomi sono per il terminale: il pannello della simulazione e la presentazione scelgono i dispositivi da menu. Vedi [DNS](../services/dns.md#limits).

**I guasti.** Un guasto appartiene a una presentazione e sparisce quando finisce: non viene salvato con il progetto. Il terminale vede i guasti della presentazione ma non può farne né ripararne uno. Vedi [Presentazione](../asking/presentation.md#failures).

**Le immagini.** Un'immagine è un canvas solo: un progetto con più canvas si esporta un canvas alla volta. I suoi testi sono composti con il carattere del computer, non con quello dell'interfaccia, che un'immagine non può portarsi dietro, quindi la stessa immagine su un altro computer può avere lettere un po' diverse. Un PNG di un disegno molto grande viene ridotto a ciò che il browser riesce a dipingere, e la finestra lo dice. Vedi [Esportare un'immagine](../asking/exporting-an-image.md#limits).

**Il progetto.** Non c'è né annulla né ripristina. Non ci sono account né condivisione: un progetto è un file sul tuo disco, e due schede del browser aperte sullo stesso progetto non vedono le modifiche l'una dell'altra, vince l'ultima che scrive ([salvare](../getting-started/saving-and-files.md#two-tabs)). Il formato YAML è proprio di PixelCake, e i nomi che sembrano numeri o booleani, e i nomi duplicati, non sopravvivono a un'esportazione e a un'importazione. L'esportazione Terraform è una bozza che non si può applicare, e uno stato Terraform non si può leggere ([YAML](yaml.md#limits)). Anche tastiera e mouse hanno le loro lacune ([scorciatoie](shortcuts.md#board)).

## Domande {#faq}

**Posso usarlo per convalidare una rete vera?** No. Segue le regole qui sopra, e una rete vera ne ha molte di più. Serve a ragionare su come dovrebbe comportarsi una piccola rete, e a mostrarla a qualcuno.

**Dove sta il mio lavoro?** Nella memoria del browser che stai usando, mentre lavori: ricarica la pagina e c'è ancora. Non sta su un server, non ti segue su un altro browser o computer, e non sopravvive alla cancellazione dei dati del sito né alla chiusura di una finestra privata. Per tenerlo, o per portarlo altrove, salva il progetto su file con File → Salva ([il file del progetto](project-file.md#format)).

**Funziona senza connessione?** Una volta caricata la pagina, sì: disegnare, fare domande, il terminale e le esportazioni sono andati avanti con la rete staccata. L'unica cosa che può ancora chiedere al sito è il file di un carattere. Non si installa come app e non tiene una copia di sé per l'uso senza connessione, quindi per riaprirla senza connessione il browser deve avere ancora la pagina.

**Manda qualcosa da qualche parte?** No. Dietro l'app non c'è nessun server: mentre lavori non fa richieste per conto suo, non ha statistiche, e nulla di un progetto lascia il computer a meno che non sia tu a salvarlo, esportarlo o copiarlo. I caratteri e le icone fanno parte dell'app e non vengono presi da nessun'altra parte. Un collegamento al sito, all'archivio o alla documentazione si apre solo quando lo clicchi.

**C'è un account?** No, e non c'è niente a cui accedere.

**Quanto costa?** Niente. È gratuito e open source ([licenze](licences.md#app)).

**Posso usarlo al lavoro?** Sì, la licenza lo permette. Quello che disegni resta sul tuo computer. Ricorda che le sue risposte non convalidano una rete vera.

**Posso annullare?** Non ancora: non c'è né annulla né ripristina. Salva il progetto su file prima di una modifica che potresti voler disfare, e riaprilo per tornare indietro.

**Perché un ping si ferma a uno switch?** Lo dice il motivo. Uno switch ferma un flusso quando la porta da cui dovrebbe uscire è spenta, quando manca un cavo, o quando le porte sono in VLAN diverse: la risposta nomina la porta e la VLAN ([VLAN](../building/vlans.md#vlan-1)).

**Perché un dispositivo non ha un indirizzo?** Una scheda con il DHCP non ne ha finché un server della sua rete non risponde; la domanda che la riguarda dice perché: nessun server sulla sua rete, un intervallo esaurito, un cavo che manca ([DHCP](../services/dhcp.md#no-address)).

**Perché il terminale è in inglese se l'interfaccia è in italiano?** Il linguaggio del terminale, NCL, è inglese in tutte e due le lingue: i comandi, ciò che stampano e i motivi del motore. La finestra attorno è tradotta ([il terminale](../terminal/index.md#open)).

**Come porto un progetto su un altro computer?** Salvalo su file qui e apri il file là: File → Apri…. Il file contiene tutti i canvas.

## Segnalare un problema {#report}

Apri una segnalazione su [github.com/pixelcake-dev/pixelcake/issues](https://github.com/pixelcake-dev/pixelcake/issues): la schermata di benvenuto ha un collegamento, «Segnala un problema». Di' che cosa hai fatto, che cosa ti aspettavi e che cosa è successo, in quale browser, e aggiungi il file del progetto se è piccolo, oppure i comandi del terminale che lo mostrano. Un file di progetto contiene i nomi che hai dato ai dispositivi e le note che hai scritto: guardalo prima di allegarlo. Puoi anche scrivere a pixelcake.dev@gmail.com.
