---
title: "Template"
description: "I tipi di dispositivo e di connessione che l'app porta con sé, e quelli che fai tu."
order: 10
---

Un template è il modello di un tipo di dispositivo, o di un tipo di connessione. Un dispositivo fatto da un template ne prende il nome, il disegno, e se ha porte o schede di rete. Una connessione fatta con un tipo ne prende il colore, la linea e lo spessore. I template si tengono nel browser, per tutti i progetti che apri al suo interno, e si gestiscono in Impostazioni → «Template».

## Template predefiniti {#built-in}

**Dispositivi.** I 24 tipi di [Dispositivi](devices.md#kinds) sono 24 template. Impostazioni → «Template», poi «Dispositivi», poi «Dispositivi generici» li mostra come schede, con il disegno, il nome e il tipo di base: PC, Switch, Router, Server, Firewall, Access Point, Load Balancer, Database o Cloud. Il mail server, la stampante e il laptop sono template dei tipi di base Server e PC, con un disegno loro. Su ogni scheda c'è una matita, «Modifica template», e un cestino, «Elimina template».

- **Modificare** cambia il «Nome» e il «Disegno». Il «Tipo di base» è bloccato: «Il tipo non può essere modificato, per evitare problemi con i dispositivi esistenti.» Premi «Salva modifiche». Un dispositivo già sul canvas tiene il nome che ha, e viene disegnato con il disegno nuovo, perché un dispositivo cerca il suo template.
- **Eliminare** chiede prima, nominando il template e avvisando che i dispositivi esistenti di questo tipo potrebbero non essere più disegnati come prima. Quei dispositivi restano, e sono disegnati con il disegno del loro tipo di base. Il template sparisce dal pannello «Aggiungi» e da [Aggiungi in blocco](bulk-add.md); non c'è un pulsante che ne riporti indietro uno predefinito.
- **«Nuovo template»** fa un altro template generico per un tipo di base che non ne ha più. Poiché quelli predefiniti coprono i nove tipi di base, uno nuovo viene rifiutato («Questo tipo esiste già tra i template generici») finché non elimini quelli di quel tipo. Per fare un tipo nuovo di dispositivo, fai un template personalizzato.

**Connessioni.** Impostazioni → «Template», poi «Connessioni», elenca i tipi di connessione: Access, Trunk, Uplink, Backbone e MPLS, ciascuno con il suo ID del tipo, la sua descrizione e la sua linea. Sono le voci di «Tipo di connessione» nella finestra di un cavo ([Cavi e connessioni](cables.md#edit)). Un tipo predefinito si può modificare, non eliminare.

Un tipo di connessione ha un «Nome», un «ID del tipo» (minuscolo, senza spazi, univoco, e non si può cambiare una volta creato), una «Descrizione», un «Colore», uno «Stile della linea» («Continua», «Tratteggiata» o «Punteggiata») e uno «Spessore» da 1 a 10 pixel; un'«Anteprima» mostra la linea. Premi «Crea tipo» per uno nuovo, mentre «Nuovo tipo di connessione» è il pulsante che apre il modulo. Un tipo è un aspetto e nient'altro: il motore non lo legge.

## I tuoi template {#custom}

In Impostazioni → «Template» → «Dispositivi», la scheda «Dispositivi personalizzati» è per i tipi di dispositivo che fai tu. «Nuovo template» apre un modulo:

1. «Nome del template»: per esempio `AWS EC2 Instance`.
2. «Tipo di base»: Server, Firewall, Load Balancer, Database, Cloud, Router o Switch.
3. «Disegno»: uno dei 24, nei gruppi Rete, Server, Dati e Dispositivi finali. Parte come il disegno del tipo di base.
4. Premi «Salva template».

Il tipo di base decide di che cosa è fatto il tipo nuovo. Uno Switch, un Router o un Firewall ha porte numerate (e VLAN e spanning tree su uno switch); gli altri quattro hanno schede di rete, una per cominciare. Il tipo di base decide anche che cosa ne fa il motore: un Router personalizzato instrada, uno Switch personalizzato inoltra dentro una rete, un Cloud personalizzato lascia passare il traffico, come i predefiniti ([Dispositivi](devices.md#kinds)). I ruoli che vanno con un nome, come il Mail Server da cui passa la posta, appartengono al template predefinito, non a uno personalizzato che si chiama soltanto mail.

Il template nuovo compare nel pannello «Aggiungi», dopo gli altri, come "Template personalizzato (Server)", con il suo tipo di base tra parentesi, e si fa dispositivo come ogni altro. «Elimina template» nell'elenco lo toglie, dopo una domanda; i dispositivi fatti da esso restano sul canvas.

> [!NOTE]
> La scheda dice «Template personalizzati con campi Terraform», ma il modulo non ha nessun campo Terraform: un nome, un tipo di base e un disegno sono tutto ciò che contiene. L'esportazione Terraform è solo una bozza.

## Nel file del progetto {#in-the-file}

I template che hai fatto viaggiano con il progetto. Quando salvi un progetto, i suoi template **personalizzati**, di dispositivi e di connessioni, sono scritti nel file; quelli predefiniti e quelli generici no. Quando si apre un file, ogni template che contiene viene aggiunto se il browser non ne ha uno con lo stesso ID (un tipo di connessione: nessuno con lo stesso ID del tipo), e quelli che ci sono non vengono mai sovrascritti. Un progetto che usa un tipo personalizzato di dispositivo si può così aprire su un altro computer, e un dispositivo il cui template manca viene comunque disegnato, con il disegno del suo tipo di base.

I dettagli del file sono in [File del progetto](../reference/project-file.md#contents).

## Limiti {#limits}

> [!LIMITS]
> - Un template non ha un comportamento suo: solo un tipo di base, un disegno, e i nomi delle sue porte e schede. Ciò che fa nel motore viene dal tipo di base.
> - I template predefiniti e generici stanno solo in questo browser: non sono nel file del progetto, e un altro browser parte con i 24.
> - A un tipo di dispositivo non si possono dare porte proprie, numeri di porte propri o impostazioni proprie; i numeri di porte sono quelli del tipo di base.
