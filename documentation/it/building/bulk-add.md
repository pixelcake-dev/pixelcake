---
title: "Aggiungi in blocco"
description: "Tanti dispositivi in una volta, con le loro porte, schede, nomi e indirizzi."
order: 8
---

«Aggiungi in blocco» crea tanti dispositivi in una volta: tre PC e uno switch, dieci stampanti, un armadio di server. Ognuno è creato come se lo aggiungessi da solo: stesso nome, stesso indirizzo, stesse porte. La differenza è che non passi da una finestra per ciascuno.

## Aprire la finestra {#open}

Nella barra a sinistra premi «Aggiungi dispositivo», e nel pannello «Aggiungi» scegli «Aggiungi in blocco». Si apre la finestra «Aggiungi dispositivi in blocco», con un campo di ricerca, una parte per i «Dispositivi configurabili» e una per i «Dispositivi standard (1 scheda di rete predefinita)». Scrivi nel campo di ricerca, «Cerca per tipo o porte…», per trovare un tipo o un numero di porte tra ciò che la finestra elenca. La finestra elenca i template generici, quelli sotto «Dispositivi generici» nelle impostazioni, e non quelli creati sotto «Dispositivi personalizzati» ([Template](templates.md)).

## Righe e quantità {#rows}

![La finestra Aggiungi dispositivi in blocco: si aggiunge una riga per uno Switch da 24 porte con quantità 1, poi le quantità delle righe PC e Server salgono a 3 e a 2. Il pulsante dice Aggiungi (6). La finestra si chiude, e sul canvas compaiono sei dispositivi in due file di tre, tutti selezionati.](../../media/bulk-add/bulk.it.mp4 "La finestra, poi la griglia dei dispositivi nuovi.")

I **dispositivi standard** sono i tipi che hanno schede di rete: un PC, un server, una stampante, un access point, un database. Ognuno ha una riga con il suo nome e una quantità. Scrivi il numero, oppure usa «Aumenta» e «Diminuisci». Ogni dispositivo di queste righe riceve una scheda, `eth0`.

I **dispositivi configurabili** sono quelli con porte numerate: uno switch, un router, un firewall. Per loro non c'è una riga fissa. Premi «Aggiungi Switch/Router/Firewall» e scegli il tipo: si aggiunge una riga, con il tipo, un elenco del numero di porte (uno switch ne ha 5, 8, 16, 24 o 48; un router o un firewall 2, 4, 8 o 16) e una quantità. Aggiungi una riga per ogni combinazione che ti serve, per esempio una per gli switch da 24 porte e una per quelli da 8. «Elimina riga» ne elimina una.

In fondo, «Totale dispositivi:» li conta, e il pulsante dice quanti ne creerà, come in "Aggiungi (6)". Con un totale di zero non succede nulla. «Annulla» chiude la finestra e lascia il canvas com'era.

## Che cosa viene creato {#result}

Ogni dispositivo è creato come in [Aggiungere un dispositivo](devices.md#add):

- **Nome.** Il nome del suo template e il numero libero più basso, da 1: `PC-1`, `PC-2`, `PC-3` e `Switch-1`. Una riga di tre riceve i tre nomi liberi successivi, e due dispositivi della stessa serie non hanno mai lo stesso nome. I dispositivi che ci sono già non vengono rinominati.
- **Indirizzo.** Per un dispositivo con una scheda, il prossimo indirizzo libero della rete del progetto, uno dopo l'altro (`192.168.1.3`, `.4`, …), con la sua subnet mask, il suo gateway e, per un dispositivo finale, il suo server DNS; e un MAC suo. Un router o un firewall non ha gateway, e le sue porte non hanno indirizzo: li imposta chi lo configura. Uno switch ha un indirizzo suo.
- **Porte.** Semplici, numerate da 1, accese e a velocità automatica: porte di accesso su uno switch, porte LAN su un router o un firewall. Non si imposta alcuna VLAN, PoE, NAT o zona: perciò uno switch creato qui inoltra tutto così come arriva, e un firewall si può collegare a una porta scelta dopo ([Cavi e connessioni](cables.md#firewall)).
- **Posto.** In una griglia di righe, la più quadrata possibile (tante colonne quante righe, o una in più), dal punto in cui andrebbe un dispositivo nuovo singolo: il primo posto libero della parte di canvas che stai guardando, da in alto a sinistra. Un posto su cui c'è già un dispositivo viene saltato, così due serie non si sovrappongono. Se i dispositivi nuovi non stanno tutti sullo schermo, la vista si sposta per mostrarli.

Alla fine i dispositivi nuovi sono selezionati, così tutta la serie si può trascinare dove deve stare. Un avviso dice quanti ne sono stati creati, come in "6 dispositivi aggiunti". Nulla viene collegato: lo fa [Collegare ciò che non ha un cavo](layout-and-connection.md#connect), e si possono mettere dei riquadri intorno alla serie con Modifica → «Racchiudi in un riquadro» ([Riquadri](areas.md#add)).

## Limiti {#limits}

> [!LIMITS]
> - Una serie è creata con i template generici, non con quelli personalizzati, e senza un vendor, una posizione o una nota propri.
> - Non c'è un campo per l'indirizzo: gli indirizzi sono i successivi liberi, in ordine, e dopo si cambiano un dispositivo alla volta.
> - Ogni volta la finestra crea una serie sola. Una serie sbagliata si toglie con Modifica → «Annulla» (Ctrl + Z), che la toglie tutta, oppure con Canc, perché è già selezionata.
