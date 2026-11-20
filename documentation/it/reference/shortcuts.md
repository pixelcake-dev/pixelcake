---
title: "Tastiera e mouse"
description: "Ogni scorciatoia di tastiera e ogni gesto del mouse, sul canvas, nelle finestre, nel terminale, durante la presentazione e nel tour guidato."
order: 3
---

Questi sono tutti i tasti e i gesti dell'app. Sono tutti elencati anche in Impostazioni → Avanzate, sotto «Scorciatoie da tastiera e mouse», con i tasti di Windows e Linux; i tasti del Mac sono solo qui. Dove i tasti cambiano da un computer all'altro, la prima colonna è per Windows e Linux e la seconda per un Mac. Dei menu, solo Modifica → «Annulla» e «Ripeti» mostrano accanto i loro tasti.

## Sul canvas {#board}

| Per | Windows, Linux | Mac |
|---|---|---|
| Salvare il progetto su file | Ctrl + S | Cmd + S |
| Annullare l'ultima modifica del disegno | Ctrl + Z | Cmd + Z |
| Ripetere la modifica annullata | Ctrl + Y, Ctrl + Maiusc + Z | Cmd + Maiusc + Z, Cmd + Y |
| Copiare i dispositivi e i riquadri selezionati | Ctrl + C | Cmd + C |
| Incollarli | Ctrl + V | Cmd + V |
| Eliminare i dispositivi, i cavi e i riquadri selezionati, dopo una domanda | Canc | Fn + cancella (il tasto cancella di un portatile) |
| Aggiungere un dispositivo o un riquadro alla selezione, o toglierlo | Ctrl + clic (un riquadro sul nome o sul bordo) | Control + clic |
| Selezionare con un riquadro di selezione | Trascina su un'area vuota | Trascina su un'area vuota |
| Spostare la vista | Tasto destro + trascina | Tasto destro + trascina |
| Fare zoom | Rotellina del mouse | Rotellina o scorrimento |
| Ingrandire su un punto | Doppio clic su un'area vuota | Doppio clic su un'area vuota |
| Spostare un dispositivo | Trascinalo | Trascinalo |
| Spostare di poco il dispositivo selezionato | Tasti freccia | Tasti freccia |
| Spostarlo di più | Maiusc + tasti freccia | Maiusc + tasti freccia |
| Togliere la selezione | Esc | Esc |
| Spostare il focus della tastiera tra i cavi e i dispositivi | Tab | Tab |
| Selezionare il dispositivo che ha il focus | Invio | Invio |

Qualche precisazione:

- **Salvare** funziona da qualunque punto dell'app, anche mentre scrivi in un campo. Non si apre mai il "salva pagina" del browser.
- **Annullare e ripetere** disfano l'ultima modifica del disegno, e la rifanno: un'azione è un passo, un trascinamento da quando premi a quando lasci, un salvataggio in una finestra con tutti i suoi campi, un comando del terminale. In un campo, e nella riga del terminale, i tasti annullano il testo, come ovunque; mentre una finestra è aperta sopra il canvas non fanno nulla. [Annullare e ripetere](../getting-started/interface.md#undo) dice che cosa è un passo e che cosa no. Funzionano anche con il blocco maiuscole acceso, e su una tastiera con lettere non latine.
- **Copia e incolla** agiscono sul disegno solo quando nessun testo è selezionato e non si sta scrivendo in un campo. Con del testo selezionato (l'output del terminale, per esempio) Ctrl + C copia quel testo, come ovunque. I dispositivi incollati compaiono 50 unità più in basso e a destra degli originali, o più in là se lì c'è già una copia incollata prima, con le connessioni che c'erano tra loro e i riquadri selezionati; [Dispositivi](../building/devices.md#copy-delete) dice che cosa ricevono di nuovo le copie. I tasti funzionano anche con il blocco maiuscole acceso, e su una tastiera con lettere non latine.
- **Eliminare** è il tasto Canc. Backspace non fa nulla. Chiede prima conferma, in una finestra dell'applicazione, come il menu del clic destro: per una cosa sola la domanda del suo menu, per più cose quante ce ne sono di ciascuna. Invio o un clic su «Elimina» elimina; Esc non elimina nulla.
- **Selezionare più di uno**: un clic su un dispositivo lo seleziona da solo; Ctrl + clic ne aggiunge o ne toglie uno; un riquadro di selezione tracciato su un'area vuota seleziona i dispositivi e i riquadri che ci stanno interamente dentro. Ctrl + clic sul nome o sul bordo di un riquadro lo aggiunge o lo toglie. Un clic su un'area vuota toglie la selezione.
- **La vista** si sposta solo tenendo premuto il tasto destro: la rotellina fa zoom, non scorre. Lo zoom va dal 10 % al 400 %. I quattro pulsanti in basso a sinistra del canvas ingrandiscono, riducono, adattano il disegno alla finestra e lo bloccano, perché nulla si possa spostare; Vista → Adatta alla finestra fa lo stesso del terzo.
- **Spostare un dispositivo con le frecce** richiede che il dispositivo sia selezionato o abbia il focus della tastiera: un passo di 5 unità, 20 con Maiusc.
- **Tab** sposta il focus della tastiera tra i cavi e i dispositivi; Invio su un dispositivo lo seleziona. Un dispositivo che ha una nota la mostra finché ha il focus, ed Esc la chiude.

## Con il puntatore {#pointer}

| Per | Fai |
|---|---|
| Aprire la finestra di un dispositivo | Doppio clic sul dispositivo. |
| Aprire il suo menu: «Dettagli (modifica)», «Console», «Racchiudi in un riquadro» ed «Elimina» | Clic destro sul dispositivo. |
| Aprire il menu di un cavo: «Modifica connessione», «Elimina connessione» | Clic destro sul cavo. |
| Tracciare un cavo | Fermare il puntatore sul bordo di un dispositivo finché il lato diventa arancione, trascinare fino a un altro dispositivo e rilasciare il pulsante sopra di esso. |
| Leggere la nota di un dispositivo | Fermare un momento il puntatore sul dispositivo. La nota si chiude con un clic, un giro di rotellina, un menu o Esc. |
| Selezionare un riquadro | Clic sul suo nome o sul suo bordo. |
| Spostare un riquadro o ridimensionarlo | Trascinare il suo nome o il suo bordo; trascinare una maniglia del riquadro selezionato. |
| Rinominare un riquadro | Doppio clic sul suo nome, oppure Invio sul suo nome con la tastiera. |
| Aprire il menu di un riquadro: «Rinomina», il suo colore ed «Elimina» | Clic destro sul riquadro. |
| Rinominare il progetto o un canvas | Doppio clic sul nome nell'Explorer. Invio conferma il nuovo nome, Esc annulla; anche un clic altrove lo conferma. |

## Nelle finestre {#windows}

| Tasto | Che cosa fa |
|---|---|
| Esc | Chiude la finestra in primo piano. Un elenco aperto dentro una finestra si chiude prima della finestra, e una pressione non ne chiude mai due. In un nome che stai modificando, Esc annulla la modifica e basta. |
| Invio | In una domanda che chiede di confermare («Continuare senza salvare?», l'eliminazione di un dispositivo) conferma: quando la domanda si apre, il focus è sul pulsante che conferma. Esc e un clic fuori equivalgono a un no. In un nome che stai modificando, Invio lo conferma. |
| Tab, Maiusc + Tab | Passano da un campo al successivo, come in ogni pagina. |
| Invio o virgola | Nel campo che elenca le VLAN di un dispositivo, aggiunge il numero scritto. Backspace su un campo vuoto toglie l'ultimo. |

Le finestre dell'app non salvano con Invio: una finestra con dei campi ha il suo pulsante «Salva», e Invio in uno dei suoi campi non fa nulla.

## Nel terminale {#terminal}

| Tasto | Che cosa fa |
|---|---|
| Invio | Esegue il comando. |
| Freccia su, freccia giù | Scorrono i comandi di questa sessione. Freccia giù oltre l'ultimo riporta ciò che si stava scrivendo. L'elenco si perde quando la pagina viene ricaricata. |
| Ctrl + C (anche su un Mac, Control + C) | Mentre è in corso un `ping`, un `trace` o un'altra domanda, la ferma: il terminale stampa `^C — interrupted` e il pacchetto si ferma sul canvas. Quando non c'è nulla in corso, copia il testo selezionato come ovunque. |
| Esc | Chiude il terminale. Un `ping`, un `trace` o un'altra domanda in corso viene fermata prima, come con Ctrl + C. |

Il terminale è una finestra mobile sopra il canvas: si sposta trascinandola dalla barra in alto, si ridimensiona trascinando la maniglia in basso a destra. Si chiude con il suo pulsante di chiusura o con Esc, e Tab non completa un comando: esce dal campo. Si apre da «Console», nella barra a sinistra, oppure dal menu del clic destro di un dispositivo, che lo apre già dentro quel dispositivo.

## Durante la presentazione {#presenting}

| Per | Fai |
|---|---|
| Uscire dalla presentazione | Esc. Se il piccolo menu di un clic è aperto, il primo Esc lo chiude; se la modalità appunti è attiva, il primo Esc la disattiva. Non succede nulla mentre un campo ha il focus o è aperta una finestra, il terminale compreso. |
| Fare una domanda o simulare un guasto | Clic su un dispositivo o su un cavo: un menu offre «Parti da qui», «Arriva qui», «Simula un guasto» e «Ripara». |
| Spostare la vista | Trascina con il tasto sinistro; la rotellina fa zoom. Un doppio clic non fa zoom. |

Durante la presentazione nulla si può selezionare, spostare, collegare, copiare, eliminare o annullare, quindi i tasti del [canvas](#board) non fanno niente, tranne Ctrl + S, che salva ancora. A accende la [modalità appunti](#annotations), che mostra gli appunti e scrive sopra il disegno senza cambiarlo.

## In modalità appunti {#annotations}

| Per | Fai |
|---|---|
| Attivare o disattivare la modalità appunti, anche durante la presentazione | A, oppure il suo pulsante nella barra. Non succede nulla mentre scrivi in un campo, è aperta una finestra o tieni premuto Ctrl, Cmd, Alt o Maiusc. |
| Uscire dalla modalità appunti | Esc. Durante la presentazione, il primo Esc esce dalla modalità e il secondo esce dalla presentazione. |
| Scrivere sul canvas le parole digitate (Esc le lascia perdere) | Invio, con lo strumento «Testo», dopo un clic dove vanno le parole. |
| Andare a capo nelle parole | Maiusc + Invio. |
| Spostare la vista mentre scrivi | Tasto destro + trascina, rotellina del mouse. |

Con la modalità attiva, il tasto sinistro, una penna o un dito scrivono: nulla si seleziona, si sposta o si collega. La [modalità appunti](../building/annotations.md) dice che cosa fa ogni strumento.

## Nel tour guidato {#tour}

| Per | Fai |
|---|---|
| Andare al passo successivo | Freccia destra, Invio. Invio su un pulsante preme quel pulsante. |
| Tornare al passo precedente | Freccia sinistra. |
| Chiudere il tour, a qualsiasi passo | Esc, oppure «Salta». |
| Passare da un pulsante del tour all'altro | Tab, Maiusc + Tab: il focus resta nel fumetto. |

Mentre il tour è aperto gli altri tasti dell'app non fanno nulla, e nemmeno un clic fuori dal fumetto. Il tour si riapre da Aiuto → «Tour guidato»: vedi [Il tour guidato](../getting-started/interface.md#tour).

> [!LIMITS]
> - Non ci sono "seleziona tutto" e "taglia": Ctrl + A e Ctrl + X non fanno nulla.
> - La vista non si sposta con la tastiera, né con il tasto sinistro sul canvas fuori da una presentazione: le frecce spostano i dispositivi, non la vista.
> - Salvare, annullare, ripetere, copiare e incollare usano Cmd su un Mac. La selezione multipla, invece, usa anche lì il tasto Control, non Cmd.
