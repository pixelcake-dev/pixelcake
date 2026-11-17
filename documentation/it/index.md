---
title: Documentazione di PixelCake
description: Come disegnare una rete in PixelCake, configurarla e chiederle se un dispositivo ne raggiunge un altro, con il riferimento del terminale e dei file.
---

PixelCake è un ambiente per progettare piccole reti, e funziona nel browser. Disegni la rete, la configuri, poi le fai una domanda: questo PC raggiunge quel server? Se non lo raggiunge, la risposta dice dove si ferma il pacchetto, e perché. Queste pagine ne spiegano ogni parte.

![Dal pannello a sinistra si aggiungono tre dispositivi, un PC, un server e un firewall, uniti da due cavi. Nel terminale un ping dal PC raggiunge il server; una regola aggiunta al firewall nega il ping, e lo stesso ping poi si ferma al firewall, con la regola che l'ha fermato.](../media/home/firewall-ping.it.mp4 "Tre dispositivi, due cavi, una domanda, poi una regola del firewall che cambia la risposta.")

## Da dove cominciare {#start}

- **È la prima volta?** Leggi [Che cos'è PixelCake](getting-started/what-is-pixelcake.md), poi disegna [la prima rete in cinque minuti](getting-started/first-network.md).
- **Cerchi un comando del terminale?** Il [riferimento del terminale](terminal/index.md) ha tutti i comandi, con esempi. Oppure premi `/` e cerca.
- **Ti chiedi perché la risposta è proprio quella?** Leggi [come decide il motore](asking/how-the-engine-decides.md).

## Le sezioni {#sections}

- [Per cominciare](getting-started/what-is-pixelcake.md): che cos'è l'app, una prima rete, l'interfaccia, lingue e temi, salvare e aprire i file.
- [Costruire una rete](building/devices.md): dispositivi, porte e schede di rete, cavi, indirizzi, VLAN, riquadri, note, aggiunta in blocco, disposizione automatica, template.
- [Servizi e sicurezza](services/routes.md): rotte statiche e di riserva, zone e regole del firewall, NAT e inoltri, DHCP, DNS.
- [Interrogare la rete](asking/simulation-panel.md): il pannello della simulazione, come decide il motore, la presentazione e i guasti simulati, esportare un'immagine.
- [Il terminale (NCL)](terminal/index.md): i comandi del terminale, gruppo per gruppo, e la grammatica del suo linguaggio.
- [Riferimento](reference/project-file.md): il file del progetto, il YAML, tastiera e mouse, le reti di esempio, limiti e domande, licenze, le novità.

## Su queste pagine {#about}

Ogni esempio del terminale di queste pagine viene eseguito dai test di PixelCake, sulla rete di esempio che nomina, e stampa esattamente ciò che si vede qui: quando l'app cambia, una pagina che non corrisponde più non passa i test e non viene pubblicata. Ciò che l'app non simula è detto dove conta, a parte, sotto il titolo Limiti.

La documentazione è open source, come l'app: ogni pagina rimanda in fondo al suo sorgente.
