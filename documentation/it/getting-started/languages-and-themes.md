---
title: "Lingue e temi"
description: "L'interfaccia in italiano o in inglese, chiara o scura, e che cosa non cambia con la lingua."
order: 4
---

L'interfaccia di PixelCake parla italiano e inglese, e ha un tema chiaro e uno scuro. Si scelgono con un clic, cambiano subito senza ricaricare la pagina, e la scelta resta salvata nel browser. Questa documentazione fa lo stesso.

## Scegliere la lingua {#language}

Il selettore IT / EN sta in alto a destra nella barra dei menu, accanto al pulsante del tema. Lo stesso selettore c'è nella schermata di benvenuto, in basso a destra; in Impostazioni → Aspetto, sotto «Lingua»; e nella barra della [modalità presentazione](../asking/presentation.md). Ogni lingua porta il proprio nome scritto in quella lingua, Italiano ed English. Un clic su una delle due cambia ogni testo dell'applicazione, finestre aperte comprese, e la scelta viene ricordata in questo browser.

**La prima visita.** Finché non scegli, l'applicazione guarda le lingue che il tuo browser elenca, nell'ordine in cui le preferisci, e usa la prima che conosce. Un browser impostato in italiano apre l'app in italiano; uno impostato in francese e poi in inglese la apre in inglese; uno che non elenca nessuna delle due, in inglese. Una lingua trovata così non viene ricordata: viene cercata di nuovo alla visita successiva. Si ricorda soltanto una scelta fatta da te, quindi se in seguito il browser passa a un'altra lingua, l'applicazione la segue, finché non scegli tu.

**Nell'indirizzo.** `?lang=it` o `?lang=en` dopo l'indirizzo dell'applicazione sceglie la lingua, qualunque cosa dica il browser. La scelta viene ricordata e il parametro viene tolto dall'indirizzo, così che ricaricare la pagina non annulli un clic fatto dopo sul selettore. È il modo per mandare a qualcuno un link che apre l'app in una lingua precisa: `https://app.pixelcake.dev/?lang=it`.

**La documentazione.** Aiuto → «Documentazione» apre queste pagine nella lingua dell'interfaccia, in una nuova scheda. In alto le pagine hanno un selettore proprio, EN e IT. Alla prima visita, la pagina iniziale in inglese passa a quella in italiano se hai scelto l'italiano, qui o nell'applicazione, o se il tuo browser preferisce l'italiano; passando da una pagina all'altra, invece, nessuno viene spostato.

## Che cosa non cambia {#what-stays}

Cambiare lingua traduce l'interfaccia, non ciò che ci è stato fatto:

- **Quello che hai scritto.** I nomi, le note e le descrizioni del progetto, dei suoi canvas, dei suoi dispositivi e dei suoi riquadri restano come li hai scritti.
- **I nomi che ha dato l'applicazione.** Un progetto senza nome, un canvas nuovo, un riquadro nuovo e i dispositivi di una rete di esempio ricevono il nome nella lingua di quel momento, e da lì in poi fanno parte del contenuto: il PC delle vendite della rete di esempio dell'azienda è `PC-Vendite` in italiano e `PC-Sales` in inglese, e una rete di esempio caricata in italiano conserva i nomi italiani quando l'interfaccia passa all'inglese. I nomi tecnici uguali nelle due lingue (`Switch`, `Firewall`, `VLAN`) non vengono toccati.
- **Il terminale.** I suoi comandi, le sue risposte e `help` sono in inglese in entrambe le lingue. Si traduce solo la finestra intorno, il suo titolo e i nomi che un lettore di schermo dà alle sue parti.
- **I motivi del motore.** Una domanda che fallisce dice perché in inglese, in entrambe le lingue: l'avviso intorno è tradotto, il motivo che c'è dentro no.
- **I numeri.** Un conteggio si scrive come lo scrive la lingua: 14.891 in italiano, 14,891 in inglese.

## Chiaro e scuro {#theme}

Il pulsante all'estremità destra della barra dei menu cambia il tema: una luna nel tema chiaro, un sole in quello scuro. Il suo nome, che compare fermandoci sopra il puntatore, dice a quale tema passa: «Passa al tema scuro» o «Passa al tema chiaro». In Impostazioni → Aspetto c'è la stessa scelta, con l'interruttore «Tema scuro».

**La prima visita.** L'applicazione parte con il tema impostato sul tuo computer. Lo guarda una volta sola: da allora tiene il tema che ha, e se poi il computer passa da chiaro a scuro l'applicazione non cambia. La scelta che fai con un clic resta salvata in questo browser.

**Il terminale** è sempre scuro, in tutti e due i temi. **Un'immagine esportata** ha un tema suo, scelto nella finestra in cui la crei, qualunque sia il tema sullo schermo: vedi [Esportare un'immagine](../asking/exporting-an-image.md).

**La documentazione** ha in alto un pulsante proprio, che dice a quale tema passa. All'inizio il tema è quello che hai scelto nell'applicazione, se applicazione e documentazione si aprono dallo stesso indirizzo; altrimenti è quello del tuo computer. Una scelta fatta nella documentazione vale solo per la documentazione.

Le schermate di queste pagine esistono in tutti e due i temi, e mostrano quello della pagina. I video sono nel tema chiaro.
