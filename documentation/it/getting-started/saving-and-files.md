---
title: "Salvare, aprire, i file"
description: "Dove resta il lavoro mentre disegni, come salvarlo in un file .pixelcake.json e riaprirlo, e i canvas di un progetto."
order: 5
---

PixelCake funziona interamente nel browser: non ci sono server né account, quindi il tuo lavoro sta in due posti soltanto. Mentre disegni resta nel browser. Per conservarlo, lo salvi in un file sul tuo disco, che poi riapri tu.

## Nel browser {#in-the-browser}

Ogni modifica viene scritta subito nella memoria del browser, mentre la fai. Chiudi la scheda, ricarichi la pagina, riavvii il computer: quando riapri PixelCake allo stesso indirizzo, nello stesso browser, il progetto è com'era. Non c'è niente da premere.

Quella memoria appartiene a un solo browser, su un solo computer, a un solo indirizzo. Un altro browser, un altro computer o una finestra privata non la vedono. E può essere svuotata: cancellare i cookie e i dati del sito di PixelCake, un'impostazione del browser che li cancella quando lo chiudi, o la chiusura di una finestra privata eliminano quello che vi è conservato. **Un progetto che non è mai stato salvato su file va perso quando si cancellano i dati del browser.**

Il puntino davanti al nome del progetto, al centro della barra dei menu, dice se può succedere: compare finché il progetto ha modifiche non salvate su file, e sparisce quando salvi. Se la memoria è piena, un avviso dice che le ultime modifiche non sono state conservate e chiede di salvare il progetto su file.

## Salvare in un file {#save}

Scegli File → «Salva», oppure premi Ctrl + S ovunque nell'applicazione. Il progetto, con tutti i suoi canvas, viene scritto in un solo file, `nome-del-progetto.pixelcake.json`. L'avviso «Progetto salvato su file» lo conferma, e il puntino sparisce.

Come il file viene scritto dipende dal browser:

- **Chrome ed Edge** la prima volta chiedono dove mettere il file. Ogni «Salva» successivo sovrascrive quello stesso file, senza chiedere. «Salva con nome…» lo chiede di nuovo, per un altro file.
- **Gli altri browser** scaricano il file ogni volta, nella cartella che il browser usa per i download, e l'avviso ne dice il nome. Il file si riapre da lì quando serve.

In Chrome e in Edge il file viene ricordato solo finché non chiudi o ricarichi la pagina: dopo, il primo «Salva» chiede di nuovo dove salvare. «Salva su file» nell'Explorer fa lo stesso di File → «Salva».

Un progetto salvato su file è tuo: lo conservi, lo copi, lo mandi, lo metti sotto controllo di versione. Il formato è descritto in [Il file di progetto](../reference/project-file.md).

## Aprire un file {#open}

Scegli File → «Apri…» (l'Explorer ha «Apri file…», e la schermata di benvenuto «Apri progetto») e scegli un file `.pixelcake.json`. Il file prende il posto del progetto aperto.

Se il progetto aperto ha modifiche non salvate su file, prima compare una domanda: «Continuare senza salvare?», con la riga «Il progetto ha modifiche non ancora salvate su file: andranno perse.». Scegli «Continua senza salvare» per andare avanti, oppure «Annulla» per tenere quello che hai e salvarlo prima. File → «Nuovo progetto…» fa la stessa domanda prima di cominciare un progetto nuovo.

Un file che non si può leggere non viene aperto, e un avviso dice perché: non è un JSON valido, non è un progetto PixelCake, oppure è stato creato con una versione più recente di PixelCake e bisogna aggiornare l'applicazione. Un file vecchio o danneggiato viene riparato per quanto possibile e poi aperto; l'avviso dice che il progetto è stato aperto con alcune correzioni e le elenca una per una: un nome mancante a cui è stato dato un valore predefinito, un dispositivo incompleto che è stato completato, una connessione verso un dispositivo inesistente che è stata rimossa. Che cosa viene riparato, e che cosa contiene il file, è spiegato in [Il file di progetto](../reference/project-file.md#repairs).

## I canvas {#boards}

Un progetto ha uno o più canvas, ognuno con il suo disegno. Apri l'Explorer, il primo pulsante a sinistra, per vederli. Lì puoi:

- aggiungere un canvas con «Nuovo canvas»: scrivi un nome nel campo e conferma;
- rinominare un canvas, con la sua matita o con un doppio clic sul nome, oppure eliminarlo (un progetto ne conserva sempre almeno uno, e l'applicazione chiede conferma prima di eliminarne uno, dicendo quanti dispositivi contiene);
- duplicare un canvas con «Duplica il canvas», il pulsante con due fogli: la copia compare subito dopo, con il nome dell'originale seguito da "(copia)", con i suoi dispositivi, cavi, riquadri, note e vista, ed è un canvas a sé;
- cambiare il nome e la descrizione del progetto;
- passare da un canvas all'altro con un clic.

Tutti i canvas del progetto stanno nello stesso file. Un progetto nuovo parte con un canvas, che si chiama `Canvas 1`. Un'immagine del disegno, da File → «Esporta immagine…», riguarda un canvas alla volta.

## La rete in YAML {#yaml}

«Import/Export», il quinto pulsante a sinistra, riguarda soltanto la rete del canvas aperto, in forma di testo: i dispositivi e le connessioni. La prima scheda la mostra in YAML, da copiare o da scaricare. La seconda carica un file `.yaml` o `.yml`, al posto di quello che è sul canvas («Sostituisci topologia») o in aggiunta («Aggiungi alla topologia»). È un modo per leggere il disegno in un editor di testo, o per costruirne uno con uno script; non è un modo per conservare un progetto, perché il nome, i canvas, i riquadri e le impostazioni non ci sono. Vedi [Importare ed esportare in YAML](../reference/yaml.md).

## Due schede sullo stesso progetto {#two-tabs}

Se apri PixelCake in due schede dello stesso browser, tutte e due leggono e scrivono la stessa memoria e nessuna vede le modifiche dell'altra. Vince l'ultima che scrive: quello che l'altra scheda ha scritto nel frattempo viene sovrascritto, senza avviso. Lavora in una scheda alla volta, e salva su file prima di aprirne una seconda.

## Limiti {#limits}

> [!LIMITS]
> - Non si può ancora annullare: una modifica fatta è fatta, quindi salva su file prima di una modifica grande.
> - Non ci sono account né condivisione: per dare un progetto a qualcuno, manda il file.
> - Un progetto nel browser non è una copia di sicurezza. Cancellare i dati del browser lo svuota.
> - Un file di progetto si legge per intero: non c'è modo di unire due file.
