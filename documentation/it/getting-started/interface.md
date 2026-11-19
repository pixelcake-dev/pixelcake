---
title: "L'interfaccia"
description: "La barra dei menu, i pannelli a sinistra, il canvas, annullare e ripetere, la finestra di un dispositivo, la presentazione, il terminale e il tour guidato."
order: 3
---

Lo schermo ha una barra in alto, una colonna di pulsanti a sinistra e il canvas, dove sta il disegno. Quello che apri dai pulsanti compare sopra il canvas: un pannello a sinistra, una finestra del terminale, la finestra di un dispositivo. Questa pagina chiama ogni parte con il nome che ha sullo schermo.

![La rete di esempio «Ufficio: due reti e un router» in PixelCake, con dieci parti segnate da un numero: 1 i menu File, Modifica, Vista e Aiuto; 2 il nome del progetto; 3 il pulsante Presenta; 4 il selettore tra IT ed EN; 5 il pulsante del tema; 6 la colonna di pulsanti a sinistra; 7 il pannello Simulazione; 8 il canvas; 9 la mappa piccola; 10 il terminale, dopo un ping da PC-1 a Web-01.](../../media/getting-started/interface.it.png "Le parti dello schermo: la rete di esempio dell'ufficio, il pannello Simulazione aperto, il terminale dopo un ping.")

1. I menu: [File, Modifica, Vista e Aiuto](#menu-bar), con il logo davanti.
2. Il nome del progetto.
3. «Presenta», che avvia la [modalità presentazione](#presentation).
4. Il selettore tra IT ed EN: vedi [Lingue e temi](languages-and-themes.md).
5. Il pulsante del tema, chiaro o scuro.
6. La colonna dei [pulsanti a sinistra](#panels): «Explorer», «Simulazione», «Aggiungi dispositivo», «Console», «Import/Export», e «Impostazioni» in fondo.
7. Il pannello laterale che apre uno dei pulsanti, qui «Simulazione».
8. [Il canvas](#board).
9. La mappa piccola, in basso a destra del canvas.
10. [Il terminale](#terminal), in una finestra a parte.

## La barra dei menu {#menu-bar}

A sinistra, il logo apre il sito di PixelCake in una nuova scheda, e i quattro menu si aprono quando ci fermi sopra il puntatore:

| Menu | Che cosa contiene |
|---|---|
| File | «Nuovo progetto…», «Apri…», «Salva», «Salva con nome…» ed «Esporta immagine…». Vedi [Salvare, aprire, i file](saving-and-files.md) e [Esportare un'immagine](../asking/exporting-an-image.md). |
| Modifica | «Annulla», «Ripeti», «Copia», «Incolla» e «Racchiudi in un riquadro». Vedi [Annullare e ripetere](#undo). |
| Vista | «Adatta alla finestra», «Modalità presentazione», «Disposizione automatica» («Verticale» od «Orizzontale»), «Collega i dispositivi senza cavo», «Ingrandisci», «Animazione rete», «Mostra i riquadri» e «Pennarello». |
| Aiuto | «Guida», «Documentazione», «Comandi del terminale», «Tour guidato», «Mostra la schermata di benvenuto», «Informazioni» e «Il sito di PixelCake». |

«Guida» è la guida breve dentro l'applicazione. «Tour guidato» riapre il [tour della prima visita](#tour). «Documentazione» apre queste pagine, nella lingua dell'interfaccia, in una nuova scheda del browser. «Mostra la schermata di benvenuto» fa ricomparire la schermata di benvenuto, ma solo su un canvas vuoto.

Al centro della barra c'è il nome del progetto aperto. Un clic sul nome apre l'Explorer. Un puntino arancione davanti al nome dice che il progetto ha modifiche non ancora salvate su file.

A destra ci sono «Pennarello», il pulsante con il pennarello che scrive e disegna sul canvas ([Scrivere sul canvas](../building/marker.md)), «Presenta», il selettore tra IT ed EN e il pulsante del tema.

## I pannelli a sinistra {#panels}

La colonna dei sei pulsanti apre e chiude i pannelli. Ogni pulsante dice il proprio nome quando ci fermi sopra il puntatore.

| Pulsante | Che cosa apre |
|---|---|
| «Explorer» | Il pannello «Explorer»: il nome e la descrizione del progetto, i suoi canvas, e «Salva su file» e «Apri file…». |
| «Simulazione» | Il pannello «Simulazione»: «Partenza», «Destinazione», «Tipo di traffico» e «Avvia simulazione». Vedi [Il pannello Simulazione](../asking/simulation-panel.md). |
| «Aggiungi dispositivo» | Il pannello «Aggiungi», con due schede: «Dispositivi», i tipi di dispositivo con «Aggiungi in blocco» e «Riquadro», ed «Esempi», le cinque reti di esempio. |
| «Console» | Il terminale, in una finestra a parte. |
| «Import/Export» | Una finestra per esportare in YAML la rete del canvas, o per caricarla da un file YAML. Vedi [YAML](../reference/yaml.md). |
| «Impostazioni» | Una finestra con quattro schede: «Rete», «Aspetto», «Template» e «Avanzate». |

Finché un pannello è aperto copre la parte sinistra del canvas, e con essa i pulsanti dello zoom che stanno lì. La croce in alto a destra lo chiude, e lo chiude anche un secondo clic sul suo pulsante.

## Il canvas {#board}

Il canvas è dove sta il disegno. Con il mouse:

- trascina un dispositivo per spostarlo; trascina dal bordo di un dispositivo a un altro per collegarli;
- trascina su un punto vuoto per disegnare un riquadro di selezione; con Ctrl + clic aggiungi un dispositivo o un riquadro alla selezione; con due o più dispositivi selezionati, sopra di loro compare «Racchiudi in un riquadro»;
- trascina con il tasto destro su un punto vuoto per spostare la vista, e usa la rotellina per lo zoom;
- un clic destro su un dispositivo apre il suo menu: «Dettagli (modifica)», «Console», «Racchiudi in un riquadro» ed «Elimina»; un clic destro su un cavo offre «Modifica connessione» ed «Elimina connessione»;
- un clic su un punto vuoto toglie i colori lasciati dall'ultima domanda.

In basso a sinistra ci sono i pulsanti che ingrandiscono, rimpiccioliscono, adattano il disegno alla finestra e bloccano i dispositivi dove sono. In basso a destra la mappa piccola mostra tutto il disegno come quadratini colorati, con la parte in vista in bianco. Vista → «Adatta alla finestra» porta ogni dispositivo in vista. Tutte le scorciatoie sono in [Tastiera e mouse](../reference/shortcuts.md).

## Annullare e ripetere {#undo}

Modifica → «Annulla», o Ctrl + Z, disfa l'ultima modifica del disegno. Modifica → «Ripeti», Ctrl + Y o Ctrl + Maiusc + Z, la rifà. Su un Mac i tasti sono Cmd + Z e Cmd + Maiusc + Z. Con il puntatore su «Annulla» o su «Ripeti», il menu dice di quale modifica si tratta, con il nome del dispositivo, della connessione o del riquadro. Una voce è grigia finché non c'è niente da annullare o da ripetere.

Un'azione è un passo:

- un dispositivo aggiunto, incollato o eliminato, con i cavi e i riquadri che sono andati con lui;
- un trascinamento, da quando premi il tasto a quando lo lasci, anche di più dispositivi insieme, e un passo dei tasti freccia;
- un cavo tracciato o eliminato; un riquadro creato, spostato, ridimensionato, rinominato, ricolorato o eliminato;
- «Salva» nella finestra di un dispositivo o di una connessione, con tutto quello che hai cambiato lì;
- un comando del terminale che cambia il disegno, come `set ip` o `connect`;
- un'importazione YAML, un'aggiunta in blocco, una disposizione automatica, un «Collega i dispositivi senza cavo».

Non sono passi, e non si annullano: spostare o ingrandire la vista, la selezione, aprire e chiudere le finestre, una domanda e la sua risposta, i guasti simulati in una presentazione, le impostazioni di rete del progetto (Impostazioni → Rete), il tema e la lingua. Non lo sono neanche i canvas: aggiungere, rinominare, duplicare o eliminare un canvas.

Ogni canvas tiene i suoi passi, gli ultimi 100, finché la pagina resta aperta: passa a un altro canvas e torna indietro, e sono ancora lì. Una modifica nuova dopo un annullamento toglie quello che si poteva ripetere. Aprire o creare un progetto riparte senza passi, e così caricare una rete di esempio su un canvas. I passi non vengono salvati, né nel browser né nel file del progetto: dopo aver ricaricato la pagina non ce ne sono. Un annullamento è una modifica del progetto come le altre, e lo lascia con modifiche non salvate su file.

In un campo di testo, e nella riga del terminale, Ctrl + Z annulla il testo scritto, come ovunque. Mentre una finestra è aperta sopra il canvas, e durante la presentazione, i tasti non fanno nulla.

## La finestra di un dispositivo {#device-window}

Un doppio clic su un dispositivo, oppure clic destro e «Dettagli (modifica)», ne apre la finestra. Le sue schede dipendono dal tipo di dispositivo: «Generale» per tutti; «Porte» per switch, router e firewall; «Schede di rete» per gli altri; e, dove servono, «Rotte», «Regole», «NAT», «DHCP» e «DNS».

Non cambia niente finché non premi «Salva». «Annulla» chiude la finestra e lascia il dispositivo com'era. Se un valore non va, lo dice una riga sotto il campo, mentre scrivi. Vedi [Dispositivi](../building/devices.md).

## La presentazione {#presentation}

«Presenta» mette via gli strumenti per disegnare: il disegno resta, adattato alla finestra e non più modificabile con il mouse, con un pannello accanto. Con un clic su due dispositivi fai una domanda, poi rompi un dispositivo o un cavo per vedere che cosa si ferma. «Esci», o il tasto Esc, riporta gli strumenti. Vedi [La modalità presentazione](../asking/presentation.md).

## Il terminale {#terminal}

«Console» apre il terminale in una finestra mobile, che si intitola «Terminale», sopra il canvas. La si trascina dalla barra del titolo, si ridimensiona dalla maniglia nell'angolo in basso a destra e si chiude con la croce. Il canvas resta utilizzabile intorno, e quello che scrivi cambia il disegno che vedi. La finestra è sempre scura, in tutti e due i temi.

Con un clic destro su un dispositivo e poi «Console», il terminale si apre già posizionato su quel dispositivo. I comandi sono in inglese in tutte e due le lingue dell'interfaccia. Vedi il [riferimento del terminale](../terminal/index.md).

## Il tour guidato {#tour}

Alla prima visita, appena lasci la schermata di benvenuto, un tour guidato di otto passi percorre lo schermo: aggiungere un dispositivo, collegare due dispositivi con un cavo, fare una domanda dal pannello «Simulazione», il terminale, annullare e ripetere, salvare il progetto in un file, il pennarello e la presentazione. Ogni passo incornicia in arancione una parte dello schermo e scurisce il resto, con accanto un fumetto di una o due frasi. «Avanti» e «Indietro» scorrono i passi, «Salta» chiude il tour a qualsiasi passo; le frecce, Invio ed Esc fanno lo stesso ([Tastiera e mouse](../reference/shortcuts.md#tour)).

Compare da solo una volta in un browser, e non in un browser che contiene già un disegno fatto prima che il tour esistesse. Aiuto → «Tour guidato» lo riapre dal primo passo, in qualsiasi momento. In una finestra più stretta di 600 pixel il fumetto sta in fondo allo schermo, e un passo il cui pulsante lì non è nella barra indica il menu Vista, dove c'è la stessa voce.
