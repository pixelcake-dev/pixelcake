---
title: "Disposizione e collegamento automatici"
description: "Disporre di nuovo il disegno a partire dalla rete, e dare un cavo a ogni dispositivo che non ne ha."
order: 9
---

Due voci del menu Vista lavorano su tutto il disegno. «Disposizione automatica» sposta ogni dispositivo in una posizione che segue la rete, e «Collega i dispositivi senza cavo» dà un cavo a ogni dispositivo che non ne ha. Nessuna delle due cambia un indirizzo, una VLAN o un'impostazione di una porta.

## Disposizione automatica {#layout}

![La rete di esempio della sede viene disposta in orizzontale, poi in verticale. Ogni volta compare la domanda Disporre di nuovo il disegno?, e i suoi riquadri, Internet, DMZ e Rete interna, si spostano insieme ai loro dispositivi.](../../media/layout-and-connection/layout.it.mp4 "Vista → Disposizione automatica → Orizzontale, poi Verticale, sulla rete di esempio della sede. I riquadri seguono i loro dispositivi.")

Scegli Vista → «Disposizione automatica» e poi «Verticale» o «Orizzontale». Prima PixelCake chiede «Disporre di nuovo il disegno?», perché ogni dispositivo viene spostato e **non si può annullare**. Premi «Disponi» per andare avanti, oppure «Annulla». Alla fine il disegno viene inquadrato per intero.

La disposizione segue la rete, non il modo in cui era stato fatto il disegno:

- **La cima.** In ogni gruppo di dispositivi collegati tra loro, la cima è il punto da cui il suo traffico esce dalla rete: Internet (qualunque Cloud); se non c'è, i firewall; poi i router; poi lo switch con più cavi.
- **I livelli.** Un dispositivo sta un livello più in basso per ogni cavo tra lui e la cima, e ogni cavo è disposto dalla sua estremità alta verso il basso, qualunque estremità fosse stata disegnata per prima. Due dispositivi dello stesso livello collegati tra loro stanno uno accanto all'altro. In orizzontale è lo stesso, con i livelli da sinistra a destra.
- **I riquadri.** Ogni riquadro viene disposto con i dispositivi disegnati al suo interno, e ridisegnato intorno a loro con lo spazio che lascia «Racchiudi in un riquadro» ([Riquadri](areas.md#add)). Un riquadro dentro un altro resta dentro, e un riquadro nascosto viene spostato anch'esso. I riquadri senza nulla dentro, e i dispositivi senza cavo e senza riquadro, vengono messi in file sotto il resto.
- **Lo spazio.** Nomi e indirizzi hanno il loro spazio, in verticale e in orizzontale: nessun nome sopra un altro, nessuna etichetta di un cavo su un dispositivo o sul bordo di un riquadro, e tre cavi tra due dispositivi tengono distinte le loro etichette.

La disposizione dà lo stesso risultato per lo stesso disegno, e viene calcolata a passi, così la pagina non si blocca mentre lavora.

## I disegni grandi {#large}

Un disegno disposto in modo semplice può essere più largo di quanto il canvas riesca a mostrare al suo zoom minimo. La rete di esempio della multinazionale, 181 dispositivi su dieci sedi, sarebbe larga circa 18.000 unità. In quel caso la disposizione impila i dispositivi che pendono da un solo dispositivo in due colonne accanto a lui, così il disegno è più stretto e si può vedere intero, in verticale e in orizzontale. Sulla rete della multinazionale richiede qualche secondo, e la pagina resta utilizzabile mentre lavora.

Non lo scegli tu: è ciò che la disposizione fa quando il disegno è così grande.

## Collegare ciò che non ha un cavo {#connect}

Vista → «Collega i dispositivi senza cavo» dà un cavo a ogni dispositivo che non ne ha, e non tocca altro: nessun cavo esistente viene spostato, e a nessun cavo viene dato un nome. Servono almeno due dispositivi. Dove mette i cavi:

1. **Un dispositivo finale** va allo **switch più vicino della sua rete**, su una porta libera adatta: una porta nella VLAN del dispositivo, o senza nulla impostato. Un access point viene collegato per primo, così il cavo resta sulla sua prima scheda. Un server va prima a un load balancer della sua rete che ha dietro server del suo genere e una scheda libera.
2. **Un laptop, uno smartphone o un tablet** va prima all'access point più vicino della sua rete che ha una scheda libera, altrimenti a uno switch.
3. **Un gruppo di dispositivi collegati tra loro senza un router, un firewall o Internet** riceve un cavo verso l'alto: dal suo switch più vicino a un router, un firewall o un core switch (uno switch collegato a un router o a un firewall) della sua rete, fino a quel dispositivo. Su un router o un firewall la porta è una con un indirizzo nella rete dello switch, o senza. Un cavo per tutto il gruppo: non chiude mai un anello.

Una rete si riconosce dagli indirizzi, con le loro subnet mask, e dalle VLAN: una VLAN è la rete di un gruppo di switch collegati tra loro, e lo stesso numero in un'altra sede può essere un'altra rete. Un dispositivo in DHCP può stare in qualunque rete, e conta la distanza. Un dispositivo va a uno switch del suo riquadro (la sua sede) prima che a uno di un altro; una porta che ha il nome di un dispositivo viene riservata a quel dispositivo ([Porte e schede di rete](ports-and-cards.md#ports)); e un cavo termina sul lato dove termina il cavo del suo vicino più prossimo, così in una pila scende nella fila che gli altri condividono.

Quando ha finito, un avviso dice quanti cavi sono stati aggiunti («Ogni dispositivo ha già il suo cavo» quando non c'era nulla da fare, «Nessun cavo aggiunto» quando non si è potuto), e quali dispositivi sono stati lasciati soli e perché.

## Chi viene lasciato solo, e perché {#left-alone}

L'avviso nomina i dispositivi che ancora non hanno un cavo, con il motivo dopo ogni nome, per esempio `PC-7, PC-8: nessuno switch nella stessa rete.` I quattro motivi:

| L'avviso dice | Vuol dire |
|---|---|
| «nessuno switch nella stessa rete» | Un dispositivo finale non ha uno switch, né un access point, di cui condivida la rete |
| «nessun router, firewall o core switch nella stessa rete» | Un gruppo di switch o di dispositivi non ha dove salire |
| «nessuna porta libera» | Dove potrebbe andare, nessuna porta è libera per lui, o il dispositivo non ne ha di sue |
| «router, firewall e Internet si collegano a mano» | Questi non vengono mai collegati in automatico |

Mai collegati in automatico: router e firewall tra loro, Internet, e i dispositivi finali tra loro. Un firewall le cui porte hanno zone riceve il suo cavo con quell'estremità non assegnata: la porta, e con essa la zona, la scegli tu ([Cavi e connessioni](cables.md#firewall)). Disegna questi cavi a mano, oppure correggi ciò che era d'intralcio (l'indirizzo, la VLAN, una porta che non era libera) e riprova.

## Limiti {#limits}

> [!LIMITS]
> - La disposizione è una buona ipotesi di dove un tecnico di rete metterebbe i dispositivi, non una promessa: segue i cavi e i riquadri, e non sa nulla di armadi, piani o distanze.
> - Il collegamento automatico sceglie per indirizzo, VLAN e distanza. Non sa che cosa intendevi: controlla i cavi che ha fatto, nella finestra di un dispositivo o con `show connections`.
> - Nessuno dei due si può annullare.
