---
title: "Esportare un'immagine"
description: "Tutto il canvas come immagine PNG o SVG, chiara o scura, in un file o negli appunti; da una presentazione, con la domanda e la risposta."
order: 4
---

Il canvas si può salvare come immagine: un PNG per un documento, una presentazione o un messaggio, oppure un SVG che resta nitido a qualunque dimensione e si può ritoccare con un programma di disegno. L'immagine è tutto il disegno, nel tema che scegli, con il nome del progetto in alto se vuoi. Se la crei da una presentazione, riporta anche la domanda che era stata fatta, la sua risposta e i guasti simulati.

## La finestra {#open}

Scegli File → **«Esporta immagine…»**. In [presentazione](presentation.md#enter) la stessa finestra si apre dal pulsante **«Esporta immagine»** della barra. Su un canvas vuoto non si apre nulla, e un avviso dice «Il canvas è vuoto: non c'è nulla da esportare».

![La finestra Esporta immagine sulla rete delle due sedi in presentazione. A sinistra l'anteprima dell'immagine: il disegno con la linea principale tagliata e, sotto, la domanda con la sua risposta. A destra le opzioni: Formato PNG o SVG, Dimensione Normale, Grande, Molto grande, Tema Chiaro o Scuro, e Contenuto con tre caselle. In basso i pulsanti Copia negli appunti e Salva PNG.](../../media/exporting-an-image/window.it.png "La finestra, aperta da una presentazione: l'anteprima a sinistra, le scelte a destra.")

A sinistra c'è l'**anteprima**, che è l'immagine stessa. A destra ci sono le scelte, descritte [più avanti](#choices). In basso:

- **`Salva PNG…`** (`Salva SVG…` per un SVG) scrive l'immagine. In Chrome e in Edge il browser chiede dove salvarla; negli altri il file viene scaricato, e il pulsante dice `Scarica PNG`. Un avviso dice «Immagine salvata», oppure che è stata scaricata, e la finestra si chiude.
- **«Copia negli appunti»** mette il PNG negli appunti, da incollare in un documento o in un messaggio; il pulsante dice «Copiata» per un momento. C'è solo nei browser che lo permettono a una pagina.

Il file prende il nome dal progetto, e dal canvas quando il progetto ne ha più di uno, in minuscolo e con i trattini (`rete-ufficio.png`); quando non c'è nulla con cui nominarlo, `disegno`.

## Formato, dimensione, tema {#choices}

- **«Formato»**. Il **PNG** è per documenti, presentazioni e messaggi. L'**SVG** è vettoriale: resta nitido a qualunque dimensione, e il testo resta testo.
- **«Dimensione»**, per un PNG: **«Normale»**, **«Grande»**, **«Molto grande»**, uno, due e tre pixel per ogni unità del disegno. La finestra scrive la dimensione che avrà, come `2208 × 1776 pixel`. All'inizio è scelto «Grande». Un SVG non ha una dimensione da scegliere.
- **«Tema»**: **«Chiaro»** o **«Scuro»**. All'inizio è quello dell'app, e cambiarlo qui non cambia l'app.
- **«Contenuto»**:
  - **«Nome del progetto in alto»**, con il nome del canvas sotto quando il progetto ne ha più d'uno;
  - **«Domanda e risposta sotto il disegno»**, solo da una presentazione (vedi [più avanti](#presentation));
  - **«Sfondo trasparente»**: il disegno da solo, senza una pagina dietro, da mettere su una pagina che ha il suo sfondo. L'anteprima mostra allora un fondo a scacchi.

L'immagine viene ridisegnata dai dati del canvas, non presa dallo schermo. Mostra sempre **tutto** il disegno, qualunque parte sia nella finestra e a qualunque ingrandimento, con i nomi e gli indirizzi sotto i dispositivi (un dispositivo in DHCP mostra l'indirizzo che gli è stato assegnato), le etichette dei cavi e i riquadri, a meno che Vista → «Mostra i riquadri» non li abbia nascosti. Gli appunti della [modalità appunti](../building/annotations.md) sono disegnati sopra tutto, con le parole nella grafia a mano, che l'immagine porta con sé, solo se la modalità è attiva: quello che vedi è quello che esporti. A modalità spenta, se il canvas ha degli appunti, la finestra dice che non sono nell'immagine. Non mostra nessuna selezione e nessun punto di collegamento.

Fuori da una presentazione mostra anche la **spia** dell'ultima risposta: il dispositivo che ha risposto diventa verde e quello che ha fermato la domanda diventa rosso, come sul canvas (vedi [che cosa resta sul canvas](simulation-panel.md#afterwards)), e un dispositivo che aspetta un indirizzo lo dice.

Il PNG viene preparato appena hai scelto, così per salvarlo o copiarlo basta un clic. Per un momento dopo ogni scelta il pulsante dice «Preparo il PNG…».

## Da una presentazione {#presentation}

Aperta dalla barra della presentazione, la finestra mostra il disegno **com'è ora sullo schermo**: i segni sui dispositivi guasti e sui cavi tagliati, le due estremità della domanda indicate con `DA` e `A`, la strada della risposta disegnata sui cavi e gli appunti, se la modalità appunti è attiva ([appunti](presentation.md#annotations)). Sotto il disegno, l'immagine dice che cosa è stato chiesto:

- un titolo con la domanda e il suo colore: `Ping da PC-Sede-1 a PC-Filiale-1: arriva`;
- la risposta in una frase, con, quando non arriva, `Motivo:` e il motivo del motore;
- i guasti: `Guasto simulato: cavo R-Sede – R-Filiale.`;
- l'effetto dei guasti sul resto della rete, nella frase che il pannello scrive sotto [«Sul resto della rete»](presentation.md#impact).

![L'immagine creata dalla finestra. La rete delle due sedi con la linea principale tagliata e segnata in rosso. La strada del pacchetto va da PC-Sede-1 attraverso R-Sede e la linea di riserva per R-Riserva, e arriva a PC-Filiale-1. Sotto il disegno: Ping da PC-Sede-1 a PC-Filiale-1: arriva. PC-Filiale-1 risponde a PC-Sede-1. Arriva lo stesso, per un'altra strada: ora passa da R-Riserva. Guasto simulato: cavo R-Sede – R-Filiale. Sul resto della rete, nessuna delle 20 comunicazioni si interrompe, 12 passano da un'altra strada, 8 non cambiano.](../../media/exporting-an-image/presentation-image.it.svg "L'immagine creata dalla presentazione del video: la strada della risposta, il cavo tagliato, e ciò che è scritto sotto il disegno.")

«Domanda e risposta sotto il disegno» mostra o nasconde quel testo. Quando ci sono guasti e nessuna domanda, la stessa casella dice «Guasti simulati sotto il disegno», e il testo riporta i guasti e il loro effetto. Una nota nella finestra dice «L'immagine mostra il disegno com'è ora nella presentazione, con i segni della domanda e dei guasti simulati.»

Su un disegno grande il calcolo dell'effetto dei guasti richiede un momento, e l'immagine lo aspetta: finché non è pronto, il pulsante per salvare dice «Calcolo l'effetto dei guasti…» e non si può premere.

## Limiti {#limits}

> [!LIMITS]
> - **Un canvas alla volta.** Di un progetto con più canvas si esporta quello che hai sullo schermo; gli altri si esportano uno per uno.
> - **Il carattere del computer.** Le parole di un'immagine sono scritte nel carattere del computer su cui viene fatta, non in quello dell'interfaccia, che un'immagine non può portarsi dietro. Lo stesso SVG aperto su un altro computer può avere lettere un po' diverse.
> - **I PNG molto grandi vengono ridotti.** Il browser non riesce a creare un PNG di più di 16.384 pixel per lato, o di 64 milioni di pixel in tutto. Per un disegno più grande l'immagine è grande quanto il browser riesce a farla, e la finestra dice `(ridotta: è il massimo che il browser riesce a creare)`. L'SVG non ha questo limite.
> - **Un'immagine, non un'animazione.** Il pacchetto non è nell'immagine, solo dove è finita la risposta e la strada che ha fatto.
> - **Copiare dipende dal browser.** Dove il browser non lascia a una pagina mettere un'immagine negli appunti non c'è «Copia negli appunti»; salva il file.
