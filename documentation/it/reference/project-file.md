---
title: "Il file del progetto"
description: "Il file .pixelcake.json in cui si salva un progetto: che cosa contiene, le sue versioni, e che cosa viene riparato quando si apre."
order: 1
---

Un progetto si salva in un file solo, con l'estensione `.pixelcake.json`. È JSON semplice in UTF-8, scritto con due spazi di rientro e un'andata a capo alla fine, e contiene tutto il progetto: ogni canvas con i suoi dispositivi e le sue connessioni, le impostazioni di rete e i template personalizzati. La pagina serve a chi vuole sapere che cosa c'è nel file, oppure leggerlo o scriverlo con altri strumenti. La specifica campo per campo, con ogni tipo e ogni correzione, è [docs/project-file.md](https://github.com/pixelcake-dev/pixelcake/blob/main/docs/project-file.md) nell'archivio.

## Il formato {#format}

**Salvare.** File → Salva (Ctrl + S, Cmd + S su un Mac) scrive il file. In Chrome e in Edge il primo salvataggio chiede dove, e i successivi scrivono nello stesso file finché la pagina non viene ricaricata; File → Salva con nome… chiede sempre. Negli altri browser non si può scrivere sul posto: ogni salvataggio scarica il file, e un avviso lo dice. Il nome proposto è quello del progetto reso adatto a un file: minuscole, lettere e cifre separate da un trattino solo, senza accenti, al massimo 80 caratteri. Un progetto chiamato `Città di Prova` viene proposto come `citta-di-prova.pixelcake.json`; se del nome non resta nulla, come `progetto.pixelcake.json`.

**Aprire.** File → Apri… sceglie un file e, quando lo trova valido, sostituisce il progetto aperto. Se il progetto aperto ha modifiche non ancora salvate su file, prima arriva la domanda «Continuare senza salvare?». Un file che non si può aprire viene rifiutato con un messaggio e non cambia nulla; un file che si apre con delle correzioni lo dice dopo l'apertura ([più sotto](#repairs)).

**Che cosa non c'è.** Il file nasce nel browser e viene scritto sul disco del computer: non viene mandato da nessuna parte. Contiene il progetto, non ciò che appartiene al momento: la domanda fatta in una presentazione e i guasti simulati, la finestra del terminale e ciò che ha stampato, il tema e la lingua dell'interfaccia.

Il file è fatto per essere riletto com'era scritto. Le chiavi hanno un ordine fisso, quindi salvare due volte lo stesso progetto dà lo stesso testo, a parte l'ora di `savedAt`.

## Che cosa contiene {#contents}

Il file della rete di esempio «Ufficio: due reti e un router», come lo scrive l'app, con ciò che si ripete lasciato fuori dove ci sono i puntini:

```json
{
  "format": "pixelcake-project",
  "version": 1,
  "name": "Progetto senza nome",
  "description": "",
  "savedAt": "2026-11-17T00:34:09.744Z",
  "settings": {
    "ipClass": "192.168.10.0",
    "subnet": "255.255.255.0",
    "gateway": "192.168.10.1",
    "emailMode": "auto"
  },
  "activeCanvasId": "canvas-1",
  "canvases": [
    {
      "id": "canvas-1",
      "name": "Canvas 1",
      "devices": [
        {
          "id": "dev-0",
          "type": "Router",
          "templateId": "tpl-router",
          "label": "Router-1",
          "ip": "192.168.10.1",
          "subnet": "255.255.255.0",
          "gateway": "",
          "location": "Sala server",
          "position": {
            "x": 400,
            "y": 60
          },
          "portCount": 4,
          "ports": [
            {
              "id": 1,
              "name": "LAN Uffici",
              "enabled": true,
              "speed": "auto",
              "portType": "lan",
              "ip": "192.168.10.1",
              "subnet": "255.255.255.0"
            },
            …
          ]
        },
        …
      ],
      "connections": [
        {
          "id": "conn-0",
          "source": "dev-3",
          "target": "dev-1",
          "sourceHandle": "top",
          "targetHandle": "bottom",
          "sourceNic": "nic-1",
          "targetPort": 1,
          "type": "access",
          "bandwidth": "1 Gbps"
        },
        …
      ],
      "viewport": { … },
      "deviceCounter": 7,
      "connectionCounter": 6
    }
  ],
  "templates": {
    "devices": [],
    "connections": []
  }
}
```

I nomi dei campi sono quelli del formato, in inglese, anche quando l'interfaccia è in italiano. Che cosa è ogni parte:

| Campo | Che cosa contiene |
|---|---|
| `format`, `version` | `"pixelcake-project"` e la versione del formato, oggi `1`. |
| `name`, `description`, `savedAt` | Il nome del progetto, un testo libero e l'ora del salvataggio (UTC). |
| `settings` | Le impostazioni di rete del progetto: la rete e la maschera da cui partono i dispositivi nuovi, il gateway, il server DNS predefinito, come viaggia la posta (`emailMode`) e i nomi delle VLAN (`vlans`: un numero e un nome ciascuna). |
| `activeCanvasId`, `canvases` | Il canvas che si vede all'apertura del file, e tutti i canvas, nell'ordine in cui li elenca l'Explorer. |
| `templates` | I template personalizzati di dispositivi e di connessioni, così che un progetto che ne usa uno si apra anche su un'altra installazione. I template incorporati non vengono scritti. |

Un canvas contiene:

| Campo | Che cosa contiene |
|---|---|
| `devices` | Ogni dispositivo: tipo, template, nome, indirizzi, posizione, note, le sue porte o schede di rete con VLAN, zone, NAT e pool DHCP, rotte statiche, regole del firewall, port forward e record DNS. |
| `connections` | Le connessioni: i due dispositivi e, a ciascuna estremità, la porta o la scheda di rete a cui è attaccato il cavo; tipo, banda, etichetta, colore, VLAN. |
| `areas` | I riquadri disegnati dietro i gruppi di dispositivi: etichetta, colore, posizione e dimensioni. Assente quando il canvas non ne ha. |
| `viewport` | La posizione e lo zoom del canvas, così che si apra dov'era stato lasciato. |
| `deviceCounter`, `connectionCounter` | I numeri che avranno il prossimo dispositivo e la prossima connessione, perché uno nuovo non prenda mai l'ID di un altro. |

Due cose non si scrivono mai, perché discendono dal disegno: l'indirizzo che una scheda riceve dal DHCP e l'indirizzo a cui un nome si risolve. Il motore le ricalcola ogni volta.

## Aprire un file vecchio o rovinato {#repairs}

**Rifiutato.** Un file viene rifiutato, senza cambiare nulla, quando non si può leggere come progetto. Il messaggio compare in un avviso che nomina il file:

| Messaggio | Quando |
|---|---|
| `Il file non è un JSON valido.` | Il testo non è JSON. |
| `Il file non è un progetto PixelCake (campo "format" mancante o non riconosciuto).` | `format` manca o non è `"pixelcake-project"`. |
| `Il file indica una versione del formato non valida.` | `version` non è un numero intero da 1 in su. |
| `Il file è stato creato con una versione più recente di PixelCake (formato 2): aggiorna l'applicazione per aprirlo.` | `version` è più alta di quella che l'app conosce. |
| `Il progetto non contiene nessun canvas.` | `canvases` manca o è vuoto. |
| `Il canvas n. 2 del file non è valido.` | Un canvas non è un oggetto. |
| `Canvas «Nome»: manca l'elenco dei dispositivi ("devices").` | Un canvas non ha `devices`, oppure non ha `connections` (`manca l'elenco delle connessioni ("connections")`). |
| `Il file non può essere letto: il contenuto non è valido.` | Qualcosa di così malformato che leggerlo è fallito. |

**Corretto.** Tutto il resto si rimette a posto. Il progetto si apre e un avviso, che dice che è stato aperto con alcune correzioni, elenca che cosa è stato fatto, una riga ciascuna, per dodici secondi. Alcune delle righe:

- `Versione del formato non indicata: il file è stato letto come versione 1.` Un file senza `version` è letto come la prima.
- `Nome del progetto mancante: usato «Progetto senza nome».` e, per un canvas, `Canvas n. 1 senza nome: chiamato «Canvas 1».`
- `Canvas «Nome»: 2 dispositivi non validi o duplicati ignorati.` Un dispositivo senza `id` o `type`, o con un `id` che ha già un altro, viene scartato; uno solo incompleto viene completato, e l'avviso dice `1 dispositivo incompleto corretto.`
- `Canvas «Nome»: 1 connessione verso un dispositivo inesistente rimossa.`
- `Canvas attivo non trovato: aperto «Canvas 1».`
- `Canvas «Nome»: vista mancante o non valida, riportata alla posizione iniziale.` e `contatori degli ID mancanti o troppo bassi, ricalcolati.`
- `1 template personalizzato non valido ignorato.`

Lo stesso vale per le parti più piccole: una rotta, una regola, un port forward o un record DNS senza ciò che serve viene lasciato fuori e gli altri tengono il loro ordine; un pool DHCP senza il primo o l'ultimo indirizzo viene lasciato fuori; un elenco di nomi di VLAN non valido viene ignorato.

**Rimesso a posto senza dirlo.** I file scritti da versioni precedenti, o a mano, continuano a funzionare perché alcune cose vengono normalizzate all'ingresso, in silenzio:

- Un'estremità di connessione attaccata a una porta o a una scheda che il suo dispositivo non ha, o che un'altra connessione usa già, viene staccata; ogni estremità rimasta libera riceve poi la prima interfaccia libera del suo dispositivo (la porta libera più bassa, altrimenti la prima scheda). Su un firewall le cui porte hanno una zona di sicurezza l'estremità resta libera: scegliere la porta è scegliere una politica.
- Un dispositivo con schede di rete prende indirizzo, maschera e gateway dalla prima scheda.
- Una scheda con il DHCP perde indirizzo, maschera, gateway e server DNS che porta con sé: non servono finché prende i suoi da un server.
- Le note di un dispositivo perdono gli spazi attorno; i nomi delle VLAN vengono messi in ordine di numero; l'etichetta di un riquadro diventa di una riga sola.

Un template salvato prima che esistessero i disegni dei dispositivi ha in `icon` il nome di un'icona: viene letto così com'è, e il dispositivo si disegna come il suo tipo finché non gli si dà un disegno. Un file che è già nella forma attuale si rilegge esattamente com'era scritto.

## Versioni {#versions}

`version` aumenta solo quando un programma che conosce la versione precedente non potrebbe più leggere il file correttamente. Un nuovo campo facoltativo non la fa aumentare: il file di oggi è la versione 1, e lo erano anche quelli scritti prima che esistessero riquadri, DHCP e DNS, che semplicemente non hanno quei campi. Un'app più vecchia rifiuta un file più nuovo invece di leggerlo male, con il messaggio qui sopra.

I campi che la specifica non elenca si conservano su dispositivi, porte, schede, connessioni e template quando un file viene aperto e salvato di nuovo; al livello più alto, in un canvas, nelle impostazioni e su un riquadro no.

> [!LIMITS]
> - Il file contiene il progetto, non la cronologia: non c'è l'annullamento, e un file salvato è lo stato intero, non un elenco di modifiche.
> - Due schede del browser aperte sullo stesso progetto non vedono le modifiche l'una dell'altra: vince l'ultima che scrive. Il file è aggiornato solo all'ultimo salvataggio.
> - I guasti simulati appartengono a una presentazione e non sono nel file.
> - Il formato è proprio di PixelCake. [L'esportazione in YAML](yaml.md) è la via per passare la rete ad altri strumenti; non porta con sé le posizioni, i riquadri né le impostazioni.
