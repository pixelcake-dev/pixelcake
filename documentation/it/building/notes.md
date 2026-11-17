---
title: "Note"
description: "Un testo libero su qualunque dispositivo, che si legge fermando il puntatore su di esso."
order: 7
---

Una nota è un testo libero tenuto con un dispositivo, per ciò che non sta in nessun campo: di chi è la scrivania, che cosa c'è da sistemare, a chi chiedere. La rete non la legge. È per la persona che guarderà il disegno dopo di te.

## Scrivere una nota {#write}

Apri la finestra del dispositivo con un doppio clic. Nella scheda «Generale», l'ultimo campo sotto «Identità» è «Note». Scrivi il testo: tante righe quante servono, fino a 2000 caratteri. Il campo cresce per contenere ciò che scrivi, fino a sei righe, e poi scorre. Premi «Salva».

Una nota viene tenuta senza spazi attorno, e una nota che svuoti non è più una nota. La nota viaggia con il dispositivo: ogni tipo di dispositivo ha il campo.

## Leggerla {#read}

![La rete di esempio dell'ufficio. Il puntatore è fermo su SW-Office, uno switch, il cui nome è seguito da un piccolo quadrato; un pannello sotto il dispositivo mostra la sua nota: Armadio 2, ripiano alto. Collegato a Router-1 sulla porta 8. Chiedere al team di rete prima di cambiare le VLAN.](../../media/notes/note-panel.it.png "La nota di SW-Office, mostrata dopo una breve sosta del puntatore.")

Un dispositivo con una nota mostra un piccolo quadrato dopo il suo nome. Fermando per un momento il puntatore sul dispositivo si apre sotto di esso un piccolo pannello, sopra se sotto non c'è spazio. Il pannello mostra le righe come sono state scritte; una nota più lunga di sei righe è tagliata dopo la sesta riga intera. Lo stesso pannello si apre quando la tastiera porta il focus sul dispositivo.

Il pannello non prende mai il puntatore. Se ne va quando il puntatore esce, quando premi un pulsante o giri la rotellina, quando si apre un menu, e con Esc. Non compare mentre un dispositivo viene trascinato o un cavo tirato. C'è anche nella modalità presentazione, dove una nota è qualcosa da leggere ad alta voce. Uno screen reader legge la nota dal dispositivo stesso, e il piccolo quadrato serve solo all'occhio.

La nota è anche nell'immagine esportata, come piccolo quadrato, e non come testo.

## Dove va {#travels}

- **Il file del progetto** la tiene con il dispositivo (`notes`), e così l'esportazione e l'importazione YAML, come una riga sola tra virgolette qualunque cosa contenga ([File del progetto](../reference/project-file.md), [YAML](../reference/yaml.md)).
- **Copia e incolla** la portano con sé: un dispositivo incollato ha la nota di quello da cui nasce.
- **Il terminale** la stampa con `show config`:

```ncl fixture=building-office-notes
pixelcake> show config of SW-Office
SW-Office — Switch
  ip:       192.168.10.2
  subnet:   255.255.255.0
  gateway:  192.168.10.1
  location: Offices
  notes:    Rack 2, top shelf.
            Uplink to Router-1 on port 8.
  vlans:    none (untagged)
  ports:    8/8 enabled — "show ports SW-Office" for detail
```

Il terminale non ha un comando per scrivere una nota: si scrive nella finestra del dispositivo.

## Limiti {#limits}

> [!LIMITS]
> - Una nota è testo semplice: niente formattazione, niente collegamenti, niente immagini.
> - Il motore non legge una nota: nessuna risposta cambia per una nota.
