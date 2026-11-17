---
title: "Lingue e temi"
description: "L'interfaccia in italiano o in inglese, chiara o scura, e che cosa non cambia con la lingua."
order: 4
---

L'interfaccia di PixelCake parla italiano e inglese, e ha un tema chiaro e uno scuro. Si scelgono con un clic, cambiano subito senza ricaricare la pagina e restano memorizzati nel browser. Questa documentazione li segue.

## Scegliere la lingua {#language}

Il selettore IT / EN sta in alto a destra nella barra dei menu, accanto al pulsante del tema. Lo stesso selettore c'è nella schermata di benvenuto, in basso a destra della sua scheda; in Impostazioni → Aspetto, sotto «Lingua»; e nella barra della [modalità presentazione](../asking/presentation.md). Ogni lingua è scritta nella propria. Un clic su una delle due cambia ogni testo dell'applicazione, finestre aperte comprese, e la scelta viene ricordata in questo browser.

**La prima visita.** Finché non scegli, l'applicazione prende le lingue che il tuo browser elenca, nell'ordine in cui le preferisci, e usa la prima che conosce. Un browser impostato sull'italiano ottiene l'italiano; uno impostato sul francese e poi sull'inglese ottiene l'inglese; uno che non elenca né l'una né l'altra ottiene l'inglese. Una lingua trovata così non viene ricordata: viene cercata di nuovo alla visita dopo. Si conserva soltanto una scelta, quindi un browser che in seguito viene impostato su un'altra lingua viene seguito, finché non scegli tu.

**Nell'indirizzo.** `?lang=it` o `?lang=en` dopo l'indirizzo dell'applicazione sceglie la lingua, qualunque cosa dica il browser. La scelta viene ricordata e il parametro viene tolto dall'indirizzo, così che un clic successivo sul selettore non sia disfatto da un ricaricamento. È il modo per dare a qualcuno un link in una lingua: `https://app.pixelcake.dev/?lang=it`.

**La documentazione.** Aiuto → «Documentazione» apre queste pagine nella lingua che ha l'interfaccia, in una nuova scheda. Le pagine hanno un selettore loro in alto, EN e IT. La home in inglese manda una prima visita su quella in italiano quando hai scelto l'italiano, qui o nell'applicazione, o quando il tuo browser preferisce l'italiano; nessuno viene spostato passando da una pagina all'altra.

## Che cosa non cambia {#what-stays}

Un cambio di lingua traduce l'interfaccia, e nient'altro di ciò che è stato fatto con lei:

- **Quello che hai scritto.** I nomi, le note e le descrizioni del progetto, dei suoi canvas, dei suoi dispositivi e dei suoi riquadri restano come li hai scritti.
- **I nomi che ha dato l'applicazione.** Un progetto senza nome, un canvas nuovo, un riquadro nuovo e i dispositivi di una rete di esempio hanno il nome nella lingua di quel momento, e dopo sono contenuto: il PC delle vendite della rete di esempio dell'azienda è `PC-Vendite` in italiano e `PC-Sales` in inglese, e una rete di esempio caricata in italiano conserva i nomi italiani quando l'interfaccia passa all'inglese. I nomi tecnici uguali nelle due lingue (`Switch`, `Firewall`, `VLAN`) non vengono toccati.
- **Il terminale.** I suoi comandi, le sue risposte e `help` sono in inglese in entrambe le lingue. Si traduce solo la finestra intorno, il suo titolo e i nomi che un lettore di schermo dà alle sue parti.
- **I motivi del motore.** Una domanda che fallisce dice perché in inglese, in entrambe le lingue: l'avviso intorno è tradotto, il motivo che c'è dentro no.
- **I numeri.** Un conteggio si scrive come lo scrive la lingua: 14.891 in italiano, 14,891 in inglese.

## Chiaro e scuro {#theme}

Il pulsante all'estremità destra della barra dei menu cambia il tema: una luna nel tema chiaro, un sole in quello scuro. Il suo nome, che compare quando ci fermi sopra il puntatore, è il tema a cui porta, «Passa al tema scuro» o «Passa al tema chiaro». Impostazioni → Aspetto ha la stessa scelta, come l'interruttore «Tema scuro».

**La prima visita.** L'applicazione parte nel tema a cui è impostato il tuo computer. Lo guarda una volta sola: da allora tiene il tema che ha, e un cambio successivo del computer da chiaro a scuro non la sposta. Il tuo clic viene conservato in questo browser.

**Il terminale** è sempre scuro, in tutti e due i temi. **Un'immagine esportata** ha un tema suo, scelto nella finestra che la fa, qualunque sia il tema sullo schermo: vedi [Esportare un'immagine](../asking/exporting-an-image.md).

**La documentazione** ha un pulsante suo in alto, che dice il tema a cui porta. Il tema parte come quello che hai scelto nell'applicazione, se l'applicazione e la documentazione si aprono dallo stesso indirizzo, e come quello del tuo computer altrimenti. Una scelta fatta nella documentazione vale solo per la documentazione.

Le schermate in queste pagine hanno tutte e due i temi, e mostrano quello in cui è la pagina. I video sono nel tema chiaro.
