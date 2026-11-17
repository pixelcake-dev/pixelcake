---
title: "La prima rete in cinque minuti"
description: "Tre dispositivi, due cavi, un indirizzo ciascuno, e la prima domanda: il PC raggiunge il server?"
order: 2
---

Questa pagina costruisce la rete più piccola che abbia qualcosa da dire: un PC, un firewall e un server in fila, uniti da due cavi. Chiedi se il PC raggiunge il server, e lo raggiunge. Poi aggiungi una regola al firewall, chiedi di nuovo, e leggi perché non lo raggiunge più. Ogni passo dice dove fare clic e che cosa compare.

## Prima di cominciare {#before-you-start}

Apri PixelCake in un browser, su [app.pixelcake.dev](https://app.pixelcake.dev). La schermata di benvenuto compare sopra un canvas vuoto.

1. Premi «Nuovo progetto». Una finestra chiede un nome e la rete da cui partono i nuovi dispositivi.
2. In «Nome del progetto» scrivi `Prima rete`. Lascia la rete com'è: «Rete» 192.168.1.0, «Subnet mask» 255.255.255.0 e «Gateway» 192.168.1.1.
3. Premi «Crea progetto». Un avviso in basso a destra dice che il progetto è stato creato, e il suo nome compare al centro della barra dei menu.

Se la schermata di benvenuto non compare (hai chiesto di non vederla più), scegli invece File → «Nuovo progetto…».

## Disegna tre dispositivi {#draw}

1. Nella barra a sinistra premi «Aggiungi dispositivo», il pulsante +. Si apre il pannello «Aggiungi», con l'elenco dei tipi di dispositivo.
2. Scegli «PC». Una finestra propone il nome PC-1 e un indirizzo, 192.168.1.2, con la maschera 255.255.255.0 e il gateway 192.168.1.1. Premi «Aggiungi». PC-1 compare al centro del canvas.
3. Scegli «Server», poi premi «Aggiungi». La finestra propone Server-1 e 192.168.1.3.
4. Scegli «Firewall» (scorri l'elenco se non lo vedi), poi premi «Aggiungi». La finestra propone Firewall-1 e 192.168.1.4.
5. Chiudi il pannello con la croce in alto a destra. Trascina i dispositivi, prendendoli dal loro disegno, e mettili in fila: PC-1 a sinistra, Firewall-1 in mezzo, Server-1 a destra.

Il video mostra questo passo e il successivo, dalla schermata di benvenuto al secondo cavo.

![Da una schermata di benvenuto si crea un nuovo progetto. Dal pannello a sinistra si aggiungono un PC, un server e un firewall, che si mettono in fila e si uniscono con due cavi, il PC al firewall e il firewall al server.](../../media/getting-started/first-network-draw.it.mp4 "Dalla schermata di benvenuto a tre dispositivi e due cavi.")

## Collegali {#connect}

1. Passa con il puntatore sul bordo destro di PC-1: il lato sotto il puntatore diventa arancione.
2. Premi lì e trascina fino a Firewall-1, poi rilascia il pulsante sopra di esso. Tra i due compare un cavo.
3. Fai lo stesso dal bordo destro di Firewall-1 fino a Server-1.

A ciascun capo il cavo prende una porta o una scheda di rete libera: la scheda di PC-1 va alla porta 1 di Firewall-1, quella di Server-1 alla porta 2. Il cavo si può trascinare da qualunque lato di un dispositivo.

## Dai loro un indirizzo {#configure}

Gli indirizzi ci sono già: quando hai aggiunto ogni dispositivo, l'applicazione ha proposto il primo indirizzo libero della rete del progetto. Controlla uno dei tre.

1. Fai clic destro su PC-1 e scegli «Dettagli (modifica)». Un doppio clic sul dispositivo fa lo stesso.
2. La scheda «Generale» mostra il nome e l'indirizzo: «Indirizzo IP» 192.168.1.2, «Subnet mask» 255.255.255.0 e «Gateway» 192.168.1.1. Sotto, una riga dice che la scheda è collegata a Firewall-1 (porta 1).
3. Premi «Annulla». Per cambiare un indirizzo scriveresti quello nuovo e premeresti «Salva»: finché non lo fai non cambia niente.

I tre dispositivi hanno tutti un indirizzo della rete 192.168.1.0/24, ognuno diverso dagli altri: lo vedi scritto sotto ogni nome sul canvas. È questo che va controllato.

Il gateway, 192.168.1.1, non è un dispositivo di questo disegno, e non deve esserlo. Il gateway è dove un dispositivo manda ciò che non è per la sua rete. Qui è tutto una rete sola, quindi i tre dispositivi si raggiungono direttamente e il gateway non viene mai usato. Conta appena un router unisce una seconda rete: vedi [Il gateway](../building/addresses.md#gateway). Il firewall non ha indirizzo sulle sue porte, quindi fa passare il traffico tra l'una e l'altra come un bridge, e le regole scritte su di lui valgono lo stesso.

## Fai la prima domanda {#ask}

1. Premi «Simulazione», il pulsante con il fulmine. A sinistra si apre un pannello.
2. Il pannello parte con PC-1 come «Partenza» e Server-1 come «Destinazione», e con «Ping (ICMP)» come «Tipo di traffico». Se ne mostra altri, scegli questi dai menu.
3. Premi «Avvia simulazione». Finché il pacchetto è in viaggio il pulsante è rosso e dice «Ferma simulazione». Un puntino luminoso va da PC-1 lungo il cavo fino a Firewall-1, e poi fino a Server-1.
4. Quando arriva, la parte alta del disegno di Server-1 diventa verde, con un bordo verde. Non compare nessun messaggio: il verde è la risposta, il server ha risposto.

I colori restano fino alla domanda successiva, fino a una modifica del disegno o fino a un clic su un punto vuoto del canvas.

![Il pannello Simulazione. La finestra di PC-1 mostra il suo indirizzo e il cavo verso la porta 1 di Firewall-1. Parte un ping da PC-1 a Server-1: il pacchetto attraversa il firewall e Server-1 diventa verde.](../../media/getting-started/first-network-ask.it.mp4 "L'indirizzo di PC-1, poi un ping che arriva: Server-1 diventa verde.")

Il terminale fa la stessa domanda: apri «Console» e scrivi `ping Server-1 from PC-1`. La risposta lì è una riga di testo, con il numero di salti.

## Rompila apposta {#break-it}

Un firewall senza regole lascia passare questo ping. Scrivine una che non lo lasci passare.

1. Fai clic destro su Firewall-1, scegli «Dettagli (modifica)» e apri la scheda «Regole». Dice che non ci sono ancora regole.
2. Premi «Aggiungi regola». Compare una riga, con «Azione» Permetti, «Servizio» Qualsiasi, e `any` sia in «Da» sia in «A».
3. Scegli «Nega» come azione e «Ping» come servizio. Cambia «Da» in `192.168.1.2` e «A» in `192.168.1.3`, gli indirizzi di PC-1 e di Server-1.
4. Premi «Salva». La scheda ora dice `Regole (1)`.
5. Nel pannello Simulazione premi di nuovo «Avvia simulazione».

Stavolta il pacchetto si ferma su Firewall-1. Il firewall diventa rosso, con il bordo rosso, e un avviso in basso a destra, intitolato `Simulazione Ping fallita`, ne dà il motivo:

```text
request: firewall Firewall-1: denied by rule 1 (deny ping from 192.168.1.2 to 192.168.1.3)
```

Il motivo è in inglese, come tutto ciò che dice il motore. Nomina il dispositivo che ha fermato il pacchetto, la regola e ciò che la regola dice. Ogni risposta negativa di PixelCake ha questa forma: dove, e perché.

![La finestra di Firewall-1 nella scheda Regole: si aggiunge una regola che nega il ping, da 192.168.1.2 a 192.168.1.3, e la si salva. Lo stesso ping da PC-1 ora si ferma su Firewall-1, che diventa rosso, e un avviso ne dà come motivo la regola.](../../media/getting-started/first-network-break.it.mp4 "Una regola che nega il ping, e la stessa domanda fermata dal firewall.")

La stessa regola, scritta nel terminale sullo stesso disegno:

```ncl fixture=getting-started-first-network
pixelcake> ping Server-1 from PC-1
Pinging Server-1 (192.168.1.3) from PC-1...
Reply from 192.168.1.3: hops=3 time=3ms
  note: request: firewall Firewall-1 has no zone binding: allowed
  note: reply: firewall Firewall-1 has no zone binding: allowed
pixelcake> add rule deny ping from PC-1 to Server-1 on Firewall-1
Firewall-1: rule 1 added — deny ping from 192.168.1.2 to 192.168.1.3
  PC-1 → 192.168.1.2
  Server-1 → 192.168.1.3
pixelcake> ping Server-1 from PC-1
Pinging Server-1 (192.168.1.3) from PC-1...
Ping failed (blocked): request: firewall Firewall-1: denied by rule 1 (deny ping from 192.168.1.2 to 192.168.1.3)
  dropped at: Firewall-1
```

Le due note sotto la prima risposta dicono che nessuna porta del firewall è in una zona di sicurezza, quindi decidono solo le regole. Il motivo della seconda risposta è quello che mostrava l'avviso.

Per eliminarla, riapri la scheda «Regole» e premi il cestino della regola (fermandoci sopra il puntatore si legge «Elimina la regola»), poi «Salva». Il ping torna ad arrivare.

## Dove andare dopo {#next}

- Aggiungi una seconda rete e un router, e scopri a che cosa serve il gateway: [Indirizzi](../building/addresses.md) e [Rotte statiche e di riserva](../services/routes.md).
- Dividi uno switch in VLAN: [VLAN](../building/vlans.md).
- Impara i comandi del terminale: [il riferimento del terminale](../terminal/index.md).
- Guarda all'opera un disegno più grande: le reti di esempio, in Aggiungi → Esempi, sono descritte in [Reti di esempio](../reference/samples.md).
- Conserva quello che hai disegnato: [Salvare, aprire, i file](saving-and-files.md). La finestra e le sue parti hanno un nome in [L'interfaccia](interface.md).
