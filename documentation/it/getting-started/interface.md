---
title: "L'interfaccia"
description: "La barra dei menu, i pannelli a sinistra, il canvas, la finestra di un dispositivo, la presentazione e il terminale."
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
| Modifica | «Copia», «Incolla» e «Racchiudi in un riquadro». |
| Vista | «Adatta alla finestra», «Modalità presentazione», «Disposizione automatica» («Verticale» od «Orizzontale»), «Collega i dispositivi senza cavo», «Ingrandisci», «Animazione rete» e «Mostra i riquadri». |
| Aiuto | «Guida», «Documentazione», «Comandi del terminale», «Mostra la schermata di benvenuto», «Informazioni» e «Il sito di PixelCake». |

«Guida» è la guida breve dentro l'applicazione. «Documentazione» apre queste pagine, nella lingua dell'interfaccia, in una nuova scheda del browser. «Mostra la schermata di benvenuto» fa ricomparire la schermata di benvenuto, ma solo su un canvas vuoto.

Al centro della barra c'è il nome del progetto aperto. Un clic sul nome apre l'Explorer. Un puntino arancione davanti al nome dice che il progetto ha modifiche non ancora salvate su file.

A destra ci sono «Presenta», il selettore tra IT ed EN e il pulsante del tema.

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
- trascina su un punto vuoto per disegnare un riquadro di selezione; con Ctrl + clic aggiungi un dispositivo alla selezione;
- trascina con il tasto destro su un punto vuoto per spostare la vista, e usa la rotellina per lo zoom;
- un clic destro su un dispositivo apre il suo menu: «Dettagli (modifica)», «Console», «Racchiudi in un riquadro» ed «Elimina»; un clic destro su un cavo offre «Modifica connessione» ed «Elimina connessione»;
- un clic su un punto vuoto toglie i colori lasciati dall'ultima domanda.

In basso a sinistra ci sono i pulsanti che ingrandiscono, rimpiccioliscono, adattano il disegno alla finestra e bloccano i dispositivi dove sono. In basso a destra la mappa piccola mostra tutto il disegno come quadratini colorati, con la parte in vista in bianco. Vista → «Adatta alla finestra» porta ogni dispositivo in vista. Tutte le scorciatoie sono in [Tastiera e mouse](../reference/shortcuts.md).

## La finestra di un dispositivo {#device-window}

Un doppio clic su un dispositivo, oppure clic destro e «Dettagli (modifica)», ne apre la finestra. Le sue schede dipendono dal tipo di dispositivo: «Generale» per tutti; «Porte» per switch, router e firewall; «Schede di rete» per gli altri; e, dove servono, «Rotte», «Regole», «NAT», «DHCP» e «DNS».

Non cambia niente finché non premi «Salva». «Annulla» chiude la finestra e lascia il dispositivo com'era. Se un valore non va, lo dice una riga sotto il campo, mentre scrivi. Vedi [Dispositivi](../building/devices.md).

## La presentazione {#presentation}

«Presenta» mette via gli strumenti per disegnare: il disegno resta, adattato alla finestra e non più modificabile con il mouse, con un pannello accanto. Con un clic su due dispositivi fai una domanda, poi rompi un dispositivo o un cavo per vedere che cosa si ferma. «Esci», o il tasto Esc, riporta gli strumenti. Vedi [La modalità presentazione](../asking/presentation.md).

## Il terminale {#terminal}

«Console» apre il terminale in una finestra mobile, che si intitola «Terminale», sopra il canvas. La si trascina dalla barra del titolo, si ridimensiona dalla maniglia nell'angolo in basso a destra e si chiude con la croce. Il canvas resta utilizzabile intorno, e quello che scrivi cambia il disegno che vedi. La finestra è sempre scura, in tutti e due i temi.

Con un clic destro su un dispositivo e poi «Console», il terminale si apre già posizionato su quel dispositivo. I comandi sono in inglese in tutte e due le lingue dell'interfaccia. Vedi il [riferimento del terminale](../terminal/index.md).
