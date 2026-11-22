---
title: "Il pannello della simulazione"
description: "Partenza, destinazione, tipo di traffico: chiedi se un dispositivo ne raggiunge un altro, e guarda il pacchetto viaggiare."
order: 1
---

Il pannello della simulazione fa alla rete una sola domanda: questo dispositivo ne raggiunge quell'altro, con questo tipo di traffico? Un pacchetto viaggia lungo i cavi del canvas, e quando arriva in fondo alla sua strada il dispositivo che risponde diventa verde, oppure quello dove si ferma diventa rosso. Il pannello è il modo più rapido per provare un disegno mentre lo costruisci; per mostrare una rete ad altri, la [presentazione](presentation.md) fa le stesse domande con più cose sullo schermo.

![Un canvas con dieci dispositivi, la rete di esempio Sede. Nel pannello Simulazione, Partenza è PC-Uffici-1 e Destinazione è Srv-Interno, con il tipo di traffico Ping. Si preme Avvia simulazione: il pacchetto va dal PC al server e torna, e il server diventa verde. Poi la partenza diventa Web-Pubblico: il pacchetto arriva fino al firewall FW-Edge, che diventa rosso, e un avviso dà il motivo.](../../media/simulation-panel/ask.it.mp4 "Due ping dal pannello della simulazione sulla rete Sede: il primo arriva, il secondo si ferma sul firewall.")

## Chiedere {#ask}

Premi il pulsante «Simulazione» nella barra a sinistra. Il pannello si apre con tre campi e un pulsante.

1. **«Partenza»**: il dispositivo da cui parte il pacchetto.
2. **«Destinazione»**: il dispositivo a cui è diretto.
3. **«Tipo di traffico»**: di che traffico si tratta, vedi [più avanti](#traffic).
4. Premi **«Avvia simulazione»**.

«Partenza» e «Destinazione» sono elenchi in cui si può cercare: aprine uno, scrivi una parte di un nome o di un indirizzo, e scegli il dispositivo. Ogni voce mostra il nome e l'indirizzo, come in `PC-Uffici-1 (192.168.10.11)`; per un dispositivo che prende l'indirizzo dal DHCP, quello che gli è stato assegnato. L'elenco è in ordine alfabetico.

Non si parte da un modulo vuoto. Il pannello propone una domanda: dal primo PC del disegno al primo server (anche un database va bene), oppure, in un disegno che non li ha, tra i primi due dispositivi. La propone di nuovo quando il dispositivo scelto non c'è più sul canvas, per esempio quando si apre un altro disegno.

Mentre il pacchetto viaggia il pulsante dice **«Ferma simulazione»**: premerlo ferma il pacchetto dove si trova, e non lascia nessuna risposta. Una nuova domanda si può fare quando il pacchetto è arrivato, oppure dopo averlo fermato.

Finché sul canvas non ci sono due dispositivi il pulsante è disattivato e il pannello dice «Servono almeno due dispositivi sul canvas.». Se i due campi nominano lo stesso dispositivo, a un ping risponde il dispositivo stesso, come uno vero risponde al proprio indirizzo: non viaggia nessun pacchetto, il dispositivo diventa subito verde, e un avviso dice che risponde a se stesso. Una pagina web, un download o un'email hanno bisogno di due dispositivi: per loro un avviso dice «Il dispositivo di partenza e quello di destinazione non possono coincidere».

La velocità del pacchetto è quella impostata nella presentazione («Lenta», «Normale», «Veloce», nella barra in alto). È normale finché non la cambi, e torna normale quando la pagina viene caricata di nuovo.

## I tipi di traffico {#traffic}

«Tipo di traffico» ha quattro scelte. Ognuna è fatta di uno o più pacchetti, e il pacchetto che vedi li percorre tutti, uno dopo l'altro.

| Scelta | Di che cosa è fatta |
|---|---|
| «Ping (ICMP)» | una richiesta dalla partenza alla destinazione, poi la risposta che torna |
| «Pagina web (HTTP)» | la richiesta di una pagina, poi la pagina che torna |
| «Download di un file (FTP)» | la richiesta di un file, poi il file che torna; per un firewall è traffico web |
| «Messaggio email (SMTP)» | il messaggio dalla partenza al suo server di posta; poi la destinazione chiede la sua posta al proprio server, e la posta le torna |

Una risposta è un pacchetto a sé: si segue solo se la richiesta è arrivata, e può tornare per un'altra strada. Un firewall la lascia passare perché risponde a un flusso permesso. Come viene seguito ogni tratto, e da quale server di posta o uscita verso Internet passa un'email, è spiegato in [i flussi](how-the-engine-decides.md#flows).

Da dove passa un'email si sceglie in Impostazioni → Rete, gruppo «Simulazione», campo «Modalità email (SMTP)»: «Server di posta interno», «Cloud (M365, Gmail…)», dove il messaggio esce verso Internet, oppure «Auto (rileva automaticamente)», che usa un server di posta se il disegno ne ha uno e l'uscita verso Internet se non ce l'ha.

## La risposta {#answer}

La risposta è sul canvas, in tre modi.

- **Il pacchetto.** Un punto viaggia dalla partenza lungo i cavi, dispositivo per dispositivo, fin dove il motore lo segue. Per un ping va alla destinazione e torna; per un'email va al server di posta, poi riparte dal destinatario, che va a prendere la posta e la riceve.
- **La spia.** Quando il pacchetto è arrivato in fondo alla sua strada, un dispositivo dice come è finita la domanda: il dispositivo che risponde diventa **verde**, oppure il dispositivo dove la domanda si ferma diventa **rosso**. Quello che risponde è la destinazione.
- **Il motivo.** Quando la domanda non arriva, un avviso lo dice. Il titolo nomina il tipo di traffico ("Simulazione Ping fallita"; nell'interfaccia inglese, "Ping simulation failed"), e sotto c'è il motivo, come lo dà il motore: `request: firewall FW-Edge: no rule matches, zone policy dmz → trust denied`. Comincia con il tratto che è fallito e nomina il dispositivo, la porta, la rotta o la regola. I motivi sono in inglese in entrambe le lingue; [i motivi e le note](how-the-engine-decides.md#reasons) spiega come leggerli.

Un pacchetto che si ferma non sparisce subito: viaggia fino al dispositivo che lo scarta e resta lì, ed è quel dispositivo a diventare rosso.

In due casi non parte nessun pacchetto. Una domanda che si ferma sul mittente stesso, perché è spento o non ha una via d'uscita, rende rosso il mittente e dice perché, senza pacchetto. Una domanda che non si può nemmeno provare, perché un dispositivo non ha un indirizzo o nessun cavo unisce i due, mostra l'avviso e non accende nessuna spia.

Una domanda che arriva non dà nessun avviso. Lo dicono solo la spia e il pacchetto. Per vedere tutta la strada, salto per salto, con ciò che ha fatto ogni dispositivo, usa `trace` nel [terminale](../terminal/asking.md#trace), oppure il «Percorso» della [presentazione](presentation.md#ask).

## Che cosa resta sul canvas {#afterwards}

La spia resta quando il pacchetto è passato. Il dispositivo verde o rosso la tiene finché:

- fai un'altra domanda, o fermi quella in corso;
- i dispositivi o i cavi cambiano, perché la risposta riguardava il disegno com'era;
- fai clic su un punto vuoto del canvas.

La risposta non viene salvata nel progetto. Compare nell'immagine se [esporti l'immagine](exporting-an-image.md#choices) mentre c'è. Le domande fatte dal terminale (`ping`, `trace`, `browse`, `mail`, `download`) lasciano la stessa spia.

## Limiti {#limits}

> [!LIMITS]
> - Il pannello mostra il motivo per cui il pacchetto si ferma, e nulla delle note di una risposta che arriva (un firewall che ha permesso, una rotta di riserva presa, un indirizzo tradotto). Sono nel terminale e nella presentazione.
> - I dispositivi si scelgono dagli elenchi, mai scrivendo un nome o un indirizzo in un campo: un nome che il DNS risolverebbe è una domanda per il terminale.
> - Una domanda alla volta, e un pacchetto solo sul canvas.
> - «Download di un file (FTP)» è una richiesta e una risposta come una pagina web: non c'è nessun file, nessuna dimensione, nessun tempo di trasferimento.
