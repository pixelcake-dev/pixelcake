---
title: "Presentazione e guasti simulati"
description: "Una modalità per mostrare una rete ad altri: due clic fanno una domanda, un terzo rompe un dispositivo o un cavo, e il pannello conta che cosa si ferma."
order: 3
---

La presentazione serve a mostrare una rete ad altre persone. Gli strumenti per costruire vengono messi da parte, il disegno occupa tutta la finestra, e un pannello a sinistra risponde alle domande: questo dispositivo raggiunge quell'altro, e che cosa succede se si rompe questo? Due clic fanno una domanda. Un terzo toglie di mezzo un dispositivo o un cavo, e il pannello dice che cosa smette di funzionare, che cosa passa da un'altra strada e che cosa non cambia.

Mentre presenti il disegno non cambia e non si salva nulla: un dispositivo guasto è ancora lì, e un cavo tagliato è ancora disegnato. Per tutta la durata della presentazione, al motore si dice soltanto che non trasportano nulla.

![La rete di esempio delle due sedi in presentazione. Un PC della sede chiede se raggiunge un PC della filiale: il pacchetto attraversa la linea principale e la risposta è Arriva. La linea principale viene tagliata: il pacchetto prende la linea di riserva da R-Riserva, la risposta è Arriva per un'altra strada, e il pannello conta 12 comunicazioni che passano da un'altra strada e nessuna che si interrompe. Si spegne anche R-Riserva: il pacchetto si ferma su R-Sede, la risposta è Non arriva, e il pannello conta 12 comunicazioni che si interrompono.](../../media/presentation/failure.it.mp4 "La rete delle due sedi: una domanda, la linea principale tagliata, poi il router di riserva spento.")

## Entrare e uscire {#enter}

Premi **«Presenta»** nella barra dei menu, oppure scegli Vista → «Modalità presentazione». Su un canvas vuoto non si apre nulla, e un avviso dice «Il canvas è vuoto: non c'è nulla da presentare».

Quando entri, la selezione viene tolta, il menu del tasto destro si chiude e un pacchetto in viaggio viene fermato; il disegno si adatta alla finestra. La barra dei menu diventa una barra con:

- il contrassegno **«Presentazione»** e il nome del progetto;
- i canvas del progetto, in «Canvas del progetto», quando ne ha più di uno. Cambiare canvas fa dimenticare la domanda e i guasti, perché riguardavano l'altro;
- **«Velocità del pacchetto»**: «Lenta», «Normale», «Veloce»;
- **«Modalità appunti»**, per [scrivere sopra il disegno](#annotations), con un numero piccolo quando ci sono appunti nascosti, poi **«Terminale»**, **«Esporta immagine»** e **«Schermo intero»**;
- la lingua e il tema, come nella barra dei menu;
- **«Esci»**.

Per uscire premi «Esci» oppure Esc. Esc chiude prima il piccolo menu, se ce n'è uno aperto, o esce dalla modalità appunti, se è attiva; non fa nulla mentre scrivi in un campo o c'è una finestra aperta. Uscendo si dimenticano la domanda e ogni guasto simulato, e si esce dallo schermo intero.

I riquadri si vedono ma non si possono modificare. Il doppio clic su un dispositivo non apre la sua finestra: qui nulla modifica il disegno.

Il pannello a sinistra ha quattro parti: «Domanda», «Risposta», «Guasti simulati» e, quando c'è una risposta, «Percorso». «Chiudi il pannello» lascia tutta la finestra al disegno, e «Apri il pannello» lo riporta; anche chiuso, continua a funzionare.

## Fare una domanda {#ask}

Fai clic su un dispositivo. Si apre un piccolo menu accanto al puntatore, con il nome e l'indirizzo del dispositivo e tre voci.

1. Scegli **«Parti da qui»** sul dispositivo da cui parte la domanda.
2. Fai clic su un altro dispositivo e scegli **«Arriva qui»**.

Il tasto destro apre lo stesso menu. La domanda parte appena le due estremità sono scelte: il pacchetto viene mandato, e la risposta compare nel pannello. Le due estremità sono segnate sul disegno con `DA` e `A`.

Le estremità si possono scegliere anche nel pannello, con «Da» e «A»; «Inverti partenza e destinazione» inverte la domanda. Scegliere come partenza il dispositivo che era la destinazione la inverte da sé. Sotto, **«Tipo di traffico»** ha tre scelte: «Ping», «Web» e «Email». Il download qui non c'è, e una pagina web per un firewall è lo stesso traffico. «Ping» è una domanda con la sua risposta, «Web» la richiesta di una pagina e la pagina che torna, «Email» un messaggio dal mittente al server di posta e dal server al destinatario. Come viene seguito ciascuno è spiegato in [i flussi](how-the-engine-decides.md#flows).

Il pacchetto viene rimandato ogni volta che cambia la domanda o un guasto, e «Mostra di nuovo» lo fa ripartire. Mentre viaggia, il pulsante dice «Ferma».

La **«Risposta»** dice come finisce, in una parola, in una frase, e con il motivo quando non arriva:

- **«Arriva»**: `PC-Filiale-1 risponde a PC-Sede-1.`
- **«Non arriva»**: `Si ferma su R-Sede (andata).`, oppure `Non esce nemmeno da PC-Sede-1 (andata).`, e sotto, a parte, il motivo come lo dà il motore, in inglese: `link R-Sede–R-Filiale is down`. Nel disegno il dispositivo dove si ferma ha il bordo rosso. Quando nessuna catena di cavi unisce i due dispositivi la frase è `Nessun percorso di cavi collega i due dispositivi.`
- **«Non si può provare»**: manca qualcosa per fare la prova, per esempio un indirizzo.

Quando ci sono guasti, il pannello dice anche che cosa darebbe la stessa domanda con tutto intatto: «Arriva lo stesso, per un'altra strada.» oppure «Senza guasti arrivava.»

Il **«Percorso»** segue il pacchetto salto per salto, un blocco per ogni tratto, con ciò che ha fatto ogni dispositivo, e sotto le note del motore: un firewall che ha permesso, un indirizzo tradotto, una rotta di riserva presa. Una risposta che torna per la stessa strada dell'andata è ripiegata in una riga, che si apre con un clic. Mentre il pacchetto viaggia, il passo a cui è arrivato è evidenziato.

## Simulare un guasto {#failures}

Fai clic su un dispositivo, o su un cavo, e scegli **«Simula un guasto»**. Il dispositivo o il cavo viene segnato sul disegno, ed elencato sotto «Guasti simulati». La risposta, se c'è una domanda, viene calcolata di nuovo e il pacchetto rimandato.

Si può spegnere qualunque dispositivo, uno switch come un PC, e tagliare qualunque cavo; anche più d'uno insieme. Un dispositivo guasto non manda e non prende nulla; un cavo tagliato non porta nulla. Il motore prende un'altra strada quando il disegno la offre, e un router abbandona una rotta che non ha più nessun cavo che funzioni e passa alla successiva: [i guasti simulati](how-the-engine-decides.md#failures) e [le rotte di riserva](../services/routes.md#backup).

Per riparare scegli «Ripara» sullo stesso dispositivo, o «Ripara il cavo» sullo stesso cavo; oppure fai clic sul guasto nell'elenco (fermandoci sopra il puntatore si legge «Ripara»); oppure premi **«Ripara tutto»**.

I guasti sono soltanto un elenco tenuto dalla presentazione. Non si salva, non tocca il disegno né il file, e sparisce quando esci. Se un dispositivo o un cavo che nomina viene eliminato nel frattempo, per esempio dal terminale, viene dimenticato.

## Che cosa succede al resto della rete {#impact}

Appena qualcosa è guasto, il pannello calcola l'effetto sul resto della rete, sotto **«Sul resto della rete»**. Il motore prende ogni comunicazione tra due dispositivi finali (PC, server e simili, e i simboli Internet o Cloud che hanno un indirizzo), la prova con tutto intatto e poi con i guasti, e confronta:

- **si interrompe**: funzionava e ora non funziona più, con il motivo;
- **passa da un'altra strada**: funziona ancora, attraverso altri dispositivi o altri cavi;
- **non cambia**: funziona esattamente come prima.

Una comunicazione che non funzionava già prima non si conta, perché un guasto non può romperla. Le comunicazioni si contano in un solo verso ciascuna: da A a B e da B ad A sono due, perché un firewall può lasciar passare l'una e non l'altra.

Il pannello lo scrive come una frase, "Ping tra i 5 dispositivi finali: 20 comunicazioni che senza guasti funzionano.", e poi "Nessuna si interrompe", "12 si interrompono", "12 passano da un'altra strada", "8 non cambiano". Sotto "si interrompe" e "passa da un'altra strada", ogni partenza è scritta con le sue destinazioni come pulsanti: premine uno per fare quella domanda e vederne il percorso e il motivo. Un elenco lungo ne mostra alcuni e «Mostra tutto».

Il tipo di comunicazione contata è quello scelto nella domanda, «Ping», «Web» o «Email»: cambialo per contarne un altro. Un disegno grande richiede un momento, e il pannello dice «Calcolo l'effetto sul resto della rete…». Con meno di due dispositivi finali che hanno un indirizzo dice «Per misurare l'effetto servono almeno due dispositivi finali (PC, server…) con un indirizzo.»

Il motore prende la strada più corta che funziona. Lo spanning tree e protocolli simili non sono simulati, quindi una comunicazione che "passa da un'altra strada" prende la più corta che i cavi permettono, non quella che avrebbe scelto uno switch vero.

## Scrivere sopra il disegno {#annotations}

La [modalità appunti](../building/annotations.md) funziona anche mentre presenti, sullo stesso foglio di quando costruisci. La presentazione parte con la modalità spenta e il disegno pulito. Premi «Modalità appunti» nella barra, oppure A, e compaiono gli appunti scritti prima; scrivi sopra il disegno mentre rompi uno switch o tagli una connessione: un cerchio intorno a ciò che si ferma, una freccia, una parola. Quello che scrivi resta sul canvas, salvato con lui, finché non lo cancelli. Spegni la modalità e sono di nuovo fuori vista; il pulsante dice quanti ne sono nascosti.

Finché la modalità è attiva, un clic scrive invece di aprire il menu di un dispositivo. Spegnila (A, Esc o il suo pulsante) per fare una domanda o rompere qualcosa, e riaccendila per scrivere. Con la modalità attiva, il primo Esc ne esce e il secondo esce dalla presentazione.

L'annullamento non funziona durante la presentazione, come per tutto il resto: quello che è stato scritto durante la presentazione si annulla con Ctrl + Z dopo essere uscito, oppure si toglie con la gomma.

## Il terminale durante la presentazione {#terminal}

Nella barra c'è il pulsante **«Terminale»**. Finché dura la presentazione, i comandi che fanno una domanda (`ping`, `trace`, `browse`, `mail`, `download`, `resolve`) vedono gli stessi guasti del pannello: un `trace` si ferma con `link R-Sede–R-Filiale is down`, e un nome viene cercato attraverso la rete così com'è, con i pezzi che hai rotto. Le risposte coincidono sempre, perché interrogano lo stesso motore ([come decide](how-the-engine-decides.md)).

I guasti, però, non si possono simulare dal terminale. Si simulano con il piccolo menu, e spariscono quando esci.

## Limiti {#limits}

> [!LIMITS]
> - I guasti non si salvano e non fanno parte del file. Uscire dalla presentazione, o cambiare canvas, li fa dimenticare.
> - Tre tipi di comunicazione: ping, web ed email. Il download no.
> - Un guasto è tutto o niente: un dispositivo è spento o acceso, un cavo tagliato o intero. Non c'è una linea lenta, una perdita parziale, né una porta che si guasta da sola.
> - Una rotta il cui prossimo salto si spegne dietro uno switch non viene ritirata: vedi [che cosa non è simulato](how-the-engine-decides.md#not-simulated).
> - Un'assegnazione DHCP non cambia quando un dispositivo si guasta: tiene l'indirizzo che aveva, anche quando è spento il suo server DHCP.
