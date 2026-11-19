---
title: "Scrivere sul canvas"
description: "Il pennarello scrive e disegna a mano sopra il disegno: parole, frecce, cerchi, spunte e croci. Resta con il canvas, e durante la presentazione è la penna di chi presenta."
order: 7.5
---

Il pennarello scrive e disegna a mano sopra il disegno, come su una lavagna: una parola accanto a uno switch, una freccia verso la connessione che conta, un cerchio intorno al server da cui dipende tutto, una spunta, una croce. Quello che scrivi resta con il canvas. È per chi guarda il disegno: la rete non lo legge.

## Prendere il pennarello {#take}

Premi «Pennarello», il pulsante con il pennarello nella barra dei menu, accanto a «Presenta»; oppure scegli Vista → «Pennarello»; oppure premi P. I suoi strumenti compaiono in alto sul canvas, e il pulsante resta scuro finché il pennarello è attivo.

Con il pennarello attivo il tasto sinistro scrive: nulla si seleziona, si sposta o si collega, e il tasto destro non apre menu. Scrivono anche una penna, o un dito su uno schermo touch. Il tasto destro continua a spostare la vista, e la rotellina a fare zoom.

Per metterlo via premi di nuovo il pulsante, oppure P, oppure Esc, oppure «Chiudi il pennarello» in fondo ai suoi strumenti. Messo via, quello che è scritto è solo un disegno sopra il canvas: un clic lo attraversa e arriva al dispositivo o al cavo che c'è sotto, come se lì non ci fosse scritto niente.

## Gli strumenti {#tools}

![La rete di esempio dell'azienda con il pennarello attivo. In alto sul canvas gli strumenti del pennarello: penna, testo, freccia, cerchio, spunta, croce e gomma, quattro colori, due spessori, il cestino e il pulsante che lo chiude. Sul disegno, un cerchio rosso intorno a Internet, una croce rossa sulla sua connessione con FW-Edge, una freccia arancione verso FW-Edge dalle parole Punto unico di guasto scritte a mano, e una spunta verde accanto a SW-Core.](../../media/marker/marker.it.png "Il pennarello sulla rete di esempio dell'azienda: i suoi strumenti in alto sul canvas, e cinque segni sul disegno.")

- **«Penna»**: una linea a mano, dovunque vada il puntatore.
- **«Testo»**: fai clic dove vanno le parole, scrivile e premi Invio. Maiusc + Invio va a capo, Esc le lascia perdere, un clic altrove le tiene. Sono scritte in una grafia a mano, Caveat.
- **«Freccia»**: da dove premi il tasto a dove lo lasci, con la punta lì.
- **«Cerchio»**: un anello intorno al riquadro che trascini, disegnato come lo disegna una mano, che va un po' oltre il punto da cui è partito.
- **«Spunta»** e **«Croce»**: trascina il riquadro che devono riempire, oppure fai un clic per metterne una di misura fissa.
- **«Gomma»**: passala sui segni da togliere. Ogni segno che tocca si schiarisce, e se ne va quando lasci il tasto: sempre un segno intero, mai un pezzo.

Accanto agli strumenti c'è il colore: «Arancione», l'arancione di PixelCake, «Rosso», «Verde» e «Inchiostro», il colore del testo, scuro nel tema chiaro e chiaro in quello scuro. Poi lo spessore, «Sottile» o «Spesso»; per le parole, piccole o grandi. La scelta vale per i segni che vengono dopo; un segno già scritto tiene il suo.

Le linee tremano un poco, come fatte a mano. Il tremolio si ricava dal segno stesso, quindi un segno è uguale su ogni schermo, dopo aver ricaricato la pagina e nell'immagine esportata.

## Cancellare tutto {#clear}

«Cancella tutto», il cestino tra gli strumenti, toglie ogni segno dal canvas, dopo una domanda in una finestra dell'app: «Cancellare tutto quello che è scritto sul canvas?». «Cancella» li toglie; «Annulla» o Esc li lascia. Dispositivi, cavi e riquadri restano. Il pulsante è spento finché non c'è niente di scritto.

## Sul canvas e nel file {#where}

Quello che scrivi appartiene al suo canvas, come i riquadri:

- è tenuto in questo browser appena lo scrivi, e c'è ancora dopo aver ricaricato la pagina;
- resta con il canvas quando passi a un altro canvas del progetto e torni;
- è salvato nel file del progetto, con il suo canvas ([File di progetto](../reference/project-file.md#marks));
- la copia di un canvas fatta con «Duplica il canvas» lo ha anche lei, e da quel momento ognuno ha il suo;
- l'immagine esportata lo disegna sopra tutto il resto, nel tema chiaro e in quello scuro, con le parole nella grafia a mano ([Esportare un'immagine](../asking/exporting-an-image.md)).

L'esportazione YAML non lo porta: lo YAML è solo la rete. Una rete di esempio caricata sul canvas, o un file YAML importato al posto del disegno, lo toglie insieme al disegno su cui era scritto.

Un segno è disegnato sopra i dispositivi e i cavi, nel punto del canvas dove l'hai scritto. Non segue un dispositivo: se sposti un dispositivo, o usi la disposizione automatica, i segni restano dov'erano.

## Durante la presentazione {#presenting}

Nella [modalità presentazione](../asking/presentation.md#marker) il pennarello è la penna di chi presenta: «Pennarello» nella barra della presentazione, oppure P. Ha gli stessi strumenti, e scrive sopra il disegno e sopra quello che il canvas ha già di scritto, che resta sotto. Gli strumenti dicono «Solo per questa presentazione»: quello che la penna scrive non cambia nulla del canvas e non viene salvato. Sparisce quando la presentazione finisce, e quando si passa a un altro canvas.

«Cancella tutto» lo toglie subito, senza domande; la gomma toglie solo quello che è stato scritto durante la presentazione. Esc mette via la penna, e un secondo Esc esce dalla presentazione. Finché la penna è attiva un clic su un dispositivo scrive: mettila via per fare una domanda o simulare un guasto.

## Limiti {#limits}

> [!LIMITS]
> - Un segno non si sposta, non si ridimensiona e non si modifica: cancellalo con la gomma e scrivilo di nuovo.
> - Le parole sono scritte in una sola grafia, in due misure. Nell'immagine esportata la grafia ha le lettere delle lingue dell'Europa occidentale; le altre lettere sono scritte con una grafia a mano del computer.
> - Gli strumenti non hanno tasti propri: si scelgono dalla barra del pennarello.
> - La mappa piccola non mostra i segni, e «Adatta alla finestra» adatta i dispositivi: un segno lontano da loro può restare fuori dalla vista.
