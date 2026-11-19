---
title: "Template"
description: "I tipi di dispositivo e di connessione già pronti nell'app, e quelli che crei tu."
order: 10
---

Un template è il modello di un tipo di dispositivo, o di un tipo di connessione. Un dispositivo creato da un template ne prende il nome, il disegno, e il fatto di avere porte o schede di rete. Una connessione di un certo tipo ne prende il colore, la linea e lo spessore. I template restano nel browser, per tutti i progetti che ci apri, e si gestiscono in Impostazioni → Template.

## Template predefiniti {#built-in}

**Dispositivi.** I 24 tipi di [Dispositivi](devices.md#kinds) sono 24 template. Impostazioni → Template, poi «Dispositivi», poi «Dispositivi generici» li mostra uno per uno, ciascuno con il disegno, il nome e il tipo di base: PC, Switch, Router, Server, Firewall, Access Point, Load Balancer, Database o Cloud. Il mail server, la stampante e il laptop sono template dei tipi di base Server e PC, con un disegno loro. Accanto a ciascuno ci sono una matita, «Modifica template», e un cestino, «Elimina template». In cima alla scheda, «Ripristina i template predefiniti» e «Nuovo template».

- **Modificare** permette di cambiare il «Nome» e il «Disegno». Il «Tipo di base» è bloccato: «Il tipo non può essere modificato, per evitare problemi con i dispositivi esistenti.» Premi «Salva modifiche». Un dispositivo già sul canvas tiene il nome che ha, e viene disegnato con il disegno nuovo, perché ogni dispositivo è disegnato a partire dal suo template.
- **Eliminare** chiede prima conferma, nominando il template e avvisando che i dispositivi esistenti di questo tipo potrebbero non essere più disegnati come prima. Quei dispositivi restano, e sono disegnati con il disegno del loro tipo di base. Il template sparisce dal pannello «Aggiungi» e da [Aggiungi in blocco](bulk-add.md) finché «Ripristina i template predefiniti» non lo rimette.
- **«Ripristina i template predefiniti»** rimette i template predefiniti che erano stati eliminati, ciascuno al suo posto tra gli altri, e un avviso dice quanti («I template predefiniti ci sono già tutti» se non ne mancava nessuno). Non tocca nient'altro: un template predefinito che hai modificato tiene il nome e il disegno nuovi, e quelli che hai creato tu restano come sono. I template restano salvati nel browser, con la stessa chiave e la stessa versione di prima; il ripristino cambia l'elenco e nulla del modo in cui è salvato.
- **«Nuovo template»** apre un modulo con un «Nome», un «Tipo di base» e un «Disegno», e «Crea template» lo crea. Il tipo di base può essere uno qualsiasi dei nove, anche uno che ha già un template predefinito: il template nuovo è una variante, con un nome e un disegno suoi per lo stesso tipo di base, per esempio una postazione CAD accanto al PC. È un template personalizzato: compare nella scheda «Dispositivi personalizzati», che si apre subito, viaggia con il progetto ([più avanti](#in-the-file)) e «Ripristina i template predefiniti» non lo tocca.

**Connessioni.** Impostazioni → Template, poi «Connessioni», elenca i tipi di connessione: Access, Trunk, Uplink, Backbone e MPLS, ciascuno con il suo ID del tipo, la sua descrizione e la sua linea. Sono le voci di «Tipo di connessione» nella finestra di una connessione ([Cavi e connessioni](cables.md#edit)). Un tipo predefinito si può modificare, non eliminare.

Un tipo di connessione ha un «Nome», un «ID del tipo» (minuscolo, senza spazi, univoco, e non si può cambiare una volta creato), una «Descrizione», un «Colore», uno «Stile della linea» («Continua», «Tratteggiata» o «Punteggiata») e uno «Spessore» da 1 a 10 pixel; un'«Anteprima» mostra la linea. «Nuovo tipo di connessione» apre il modulo, e «Crea tipo» crea il tipo nuovo. Un tipo riguarda solo l'aspetto: il motore non lo legge.

## I tuoi template {#custom}

In Impostazioni → Template → «Dispositivi», la scheda «Dispositivi personalizzati» è per i tipi di dispositivo che crei tu. «Nuovo template» apre un modulo:

1. «Nome del template»: per esempio `AWS EC2 Instance`.
2. «Tipo di base»: uno qualsiasi dei nove, in tre gruppi: Rete (Switch, Router, Firewall, Access Point, Load Balancer), Server e dati (Server, Database, Cloud) e Dispositivi finali (PC).
3. «Disegno»: uno dei 24, nei gruppi Rete, Server, Dati e Dispositivi finali. All'inizio è il disegno del tipo di base.
4. Premi «Salva template».

Il tipo di base decide di che cosa è fatto il tipo nuovo. Uno Switch, un Router o un Firewall ha porte numerate (e VLAN e spanning tree su uno switch); gli altri sei, tra cui il PC e l'Access Point, hanno schede di rete, una per cominciare. Uno Switch, un Router e un Firewall hanno anche i numeri di porte dei predefiniti. Il tipo di base decide anche che cosa ne fa il motore: un Router personalizzato instrada, uno Switch personalizzato inoltra dentro una rete, un Access Point personalizzato fa da ponte, un Cloud personalizzato lascia passare il traffico, come i predefiniti ([Dispositivi](devices.md#kinds)). I ruoli che vanno con un nome, come il Mail Server da cui passa la posta, appartengono al template predefinito, non a uno personalizzato che si chiama soltanto mail.

Il template nuovo compare nel pannello «Aggiungi», dopo gli altri, come "Template personalizzato (Server)", con il suo tipo di base tra parentesi, e si usa come ogni altro. «Elimina template» nell'elenco lo elimina, dopo una conferma; i dispositivi creati con esso restano sul canvas.

La scheda dice che cosa contiene un template: «Template personalizzati: un nome, un tipo di base e un disegno». Non c'è nessun campo Terraform; l'esportazione Terraform è solo una bozza.

## Nel file del progetto {#in-the-file}

I template che hai creato viaggiano con il progetto. Quando salvi un progetto, i suoi template **personalizzati**, di dispositivi e di connessioni, sono scritti nel file; quelli predefiniti e quelli generici no. Quando si apre un file, ogni template che contiene viene aggiunto se il browser non ne ha uno con lo stesso ID (un tipo di connessione: nessuno con lo stesso ID del tipo), e quelli che ci sono non vengono mai sovrascritti. Un progetto che usa un tipo personalizzato di dispositivo si può così aprire su un altro computer, e un dispositivo il cui template manca viene comunque disegnato, con il disegno del suo tipo di base.

I dettagli del file sono in [File del progetto](../reference/project-file.md#contents).

## Limiti {#limits}

> [!LIMITS]
> - Un template non ha un comportamento suo: solo un tipo di base, un disegno, e i nomi delle sue porte e schede. Ciò che fa nel motore viene dal tipo di base.
> - I template predefiniti e generici stanno solo in questo browser: non sono nel file del progetto, e un altro browser parte con i 24.
> - A un tipo di dispositivo non si possono dare porte proprie, numeri di porte propri o impostazioni proprie; i numeri di porte sono quelli del tipo di base.
