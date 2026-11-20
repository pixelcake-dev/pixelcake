---
title: "Modalità appunti"
description: "La modalità appunti mette uno strato trasparente sopra il disegno per scrivere e disegnare a mano: parole, frecce, cerchi, spunte e croci. Gli appunti si vedono solo mentre la modalità è attiva, nel progetto e nella presentazione."
order: 7.5
---

La modalità appunti mette uno strato trasparente sopra il disegno, come una lavagna: una parola accanto a uno switch, una freccia verso la connessione che conta, un cerchio intorno al server da cui dipende tutto, una spunta, una croce. Quello che scrivi lì sono gli **appunti** del canvas. Sono per chi guarda il disegno: la rete non li legge. Da non confondere con le note di un dispositivo, che si scrivono nella sua finestra.

Ci si entra come nella modalità presentazione, e se ne esce allo stesso modo. **Gli appunti si vedono, e si può scrivere, solo mentre la modalità è attiva.** Leggere e scrivere sono la stessa modalità: quando è spenta il canvas è pulito, con soli dispositivi, cavi e riquadri.

## Entrare e uscire {#take}

Premi «Modalità appunti», il pulsante con il pennarello nella barra dei menu, accanto a «Presenta»; oppure scegli Vista → «Modalità appunti»; oppure premi A. I suoi strumenti compaiono in alto sul canvas, e il pulsante resta scuro finché la modalità è attiva.

Con la modalità attiva il tasto sinistro scrive: nulla si seleziona, si sposta o si collega, e il tasto destro non apre menu. Scrivono anche una penna, o un dito su uno schermo touch. Il tasto destro continua a spostare la vista, e la rotellina a fare zoom. I pannelli di lato restano utilizzabili: puoi lanciare un ping da «Simulazione» con gli appunti in vista, e il pacchetto passa sotto di loro.

Per uscire premi di nuovo il pulsante, oppure A, oppure Esc, oppure «Esci dalla modalità appunti» in fondo ai suoi strumenti. A modalità spenta gli appunti non vengono disegnati e non si può scrivere: il canvas è pulito. Non sono persi: restano con il canvas, e tornano la prossima volta che accendi la modalità.

Quando la modalità è spenta e il canvas ha degli appunti, il pulsante mostra quanti sono, in un piccolo quadrato sul pulsante, e anche la voce del menu Vista ha il numero dopo il nome, così gli appunti fuori vista non si dimenticano. Sparisce quando la modalità è attiva e quando non ce ne sono.

## Gli strumenti {#tools}

![La rete di esempio dell'azienda in modalità appunti. In alto sul canvas gli strumenti: penna, testo, freccia, cerchio, spunta, croce e gomma, quattro colori, due spessori, il cestino e il pulsante che esce dalla modalità. Sul disegno, un cerchio rosso intorno a Internet, una croce rossa sulla sua connessione con FW-Edge, una freccia arancione verso FW-Edge dalle parole Punto unico di guasto scritte a mano, e una spunta verde accanto a SW-Core.](../../media/marker/marker.it.png "La modalità appunti sulla rete di esempio dell'azienda: i suoi strumenti in alto sul canvas, e cinque appunti sul disegno.")

- **«Penna»**: una linea a mano, dovunque vada il puntatore.
- **«Testo»**: fai clic dove vanno le parole, scrivile e premi Invio. Maiusc + Invio va a capo, Esc le lascia perdere, un clic altrove le tiene. Sono scritte in una grafia a mano, Caveat.
- **«Freccia»**: da dove premi il tasto a dove lo lasci, con la punta lì.
- **«Cerchio»**: un anello intorno al riquadro che trascini, disegnato come lo disegna una mano, che va un po' oltre il punto da cui è partito.
- **«Spunta»** e **«Croce»**: trascina il riquadro che devono riempire, oppure fai un clic per metterne una di misura fissa.
- **«Gomma»**: passala sugli appunti da togliere. Ogni appunto che tocca si schiarisce, e se ne va quando lasci il tasto: sempre un appunto intero, mai un pezzo.

Accanto agli strumenti c'è il colore: «Arancione», l'arancione di PixelCake, «Rosso», «Verde» e «Inchiostro», il colore del testo, scuro nel tema chiaro e chiaro in quello scuro. Poi lo spessore, «Sottile» o «Spesso»; per le parole, piccole o grandi. La scelta vale per gli appunti che vengono dopo; uno già scritto tiene il suo.

Le linee tremano un poco, come fatte a mano. Il tremolio si ricava dall'appunto stesso, quindi è uguale su ogni schermo, dopo aver ricaricato la pagina e nell'immagine esportata.

## Cancellare tutto {#clear}

«Cancella tutto», il cestino tra gli strumenti, toglie ogni appunto dal canvas, dopo una domanda in una finestra dell'app: «Cancellare tutti gli appunti del canvas?». «Cancella» li toglie; «Annulla» o Esc li lascia. Dispositivi, cavi e riquadri restano. Il pulsante è spento finché non c'è niente di scritto.

## Sul canvas e nel file {#where}

Gli appunti appartengono al loro canvas, come i riquadri:

- sono tenuti in questo browser appena li scrivi, e ci sono ancora dopo aver ricaricato la pagina;
- restano con il canvas quando passi a un altro canvas del progetto e torni;
- sono salvati nel file del progetto, con il loro canvas, nel campo `marks` ([File di progetto](../reference/project-file.md#marks)), a modalità accesa o spenta;
- la copia di un canvas fatta con «Duplica il canvas» li ha anche lei, e da quel momento ognuno ha i suoi;
- **l'immagine esportata li disegna solo se la modalità è attiva**, sopra tutto il resto, nel tema chiaro e in quello scuro, con le parole nella grafia a mano: quello che vedi è quello che esporti. A modalità spenta l'immagine non li ha, e la finestra lo dice ([Esportare un'immagine](../asking/exporting-an-image.md)).

L'esportazione YAML non li porta: lo YAML è solo la rete. Una rete di esempio caricata sul canvas, o un file YAML importato al posto del disegno, li toglie insieme al disegno su cui erano scritti.

Un appunto è disegnato sopra i dispositivi e i cavi, nel punto del canvas dove l'hai scritto. Non segue un dispositivo: se sposti un dispositivo, o usi la disposizione automatica, gli appunti restano dov'erano. Scrivere e cancellare sono modifiche del canvas come le altre: Ctrl + Z le annulla.

## Durante la presentazione {#presenting}

La [modalità presentazione](../asking/presentation.md#annotations) ha la stessa modalità, con lo stesso foglio. Parte spenta, così chi guarda vede il disegno pulito; premi «Modalità appunti» nella barra della presentazione, oppure A, e compaiono gli appunti preparati prima dell'incontro, pronti a essere completati. Quello che scrivi durante la presentazione va sullo stesso foglio e ci resta finché non lo cancelli. A modalità spenta il pulsante mostra quanti appunti sono nascosti.

Esc esce prima dalla modalità, e un secondo Esc esce dalla presentazione. Con la modalità attiva un clic su un dispositivo scrive invece di aprirne il menu: spegnila per fare una domanda o simulare un guasto, e riaccendila per scrivere. Durante la presentazione nulla si può selezionare o spostare, con la modalità accesa o spenta. L'annullamento non funziona durante la presentazione, come per tutto il resto: quello che hai scritto si annulla con Ctrl + Z dopo essere uscito, oppure si toglie con la gomma.

## Limiti {#limits}

> [!LIMITS]
> - Un appunto non si sposta, non si ridimensiona e non si modifica: cancellalo con la gomma e scrivilo di nuovo.
> - Le parole sono scritte in una sola grafia, in due misure. Nell'immagine esportata la grafia ha le lettere delle lingue dell'Europa occidentale; le altre lettere sono scritte con una grafia a mano del computer.
> - Gli strumenti non hanno tasti propri: si scelgono dalla barra della modalità.
> - La mappa piccola non mostra gli appunti, e «Adatta alla finestra» adatta i dispositivi: un appunto lontano da loro può restare fuori dalla vista.
