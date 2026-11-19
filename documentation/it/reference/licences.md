---
title: "Licenze e riconoscimenti"
description: "La licenza di PixelCake, dei suoi disegni e di queste pagine, e quelle dei caratteri e delle icone che include."
order: 6
---

PixelCake è libero e open source. Ciò che è suo ha una licenza sola, e ciò che include di altri autori ha la licenza che quegli autori gli hanno dato. I testi delle licenze dei caratteri e delle icone sono inclusi nell'app, e la guida li elenca: Aiuto → Informazioni, sotto «Licenze di terzi».

## PixelCake {#app}

PixelCake è rilasciato con la GNU Affero General Public License, versione 3, `AGPL-3.0-only`. Il testo è il file [LICENSE](https://github.com/pixelcake-dev/pixelcake/blob/main/LICENSE) del repository.

In due frasi, e non come consulenza legale: puoi usarlo, studiarlo, modificarlo e condividerlo, per qualunque scopo. Se lo modifichi e lasci che altre persone usino la tua versione attraverso una rete, devi offrire loro il codice sorgente della tua versione con la stessa licenza.

I disegni dei dispositivi sono propri di PixelCake, con la stessa licenza dell'app. Queste pagine fanno parte dello stesso repository, nella cartella `documentation/`, e hanno la stessa licenza. Il codice è su [github.com/pixelcake-dev/pixelcake](https://github.com/pixelcake-dev/pixelcake).

## Che cosa include {#bundled}

L'app e queste pagine includono i due caratteri dell'interfaccia; l'app include anche la grafia a mano del pennarello e due serie di icone. Il testo di ogni licenza è un file dell'app compilata, sotto `licenses/`.

| Che cosa | Licenza | A che cosa serve | Testo |
|---|---|---|---|
| Inter | SIL Open Font License 1.1 | Il testo dell'interfaccia e di queste pagine. | [inter.txt](https://app.pixelcake.dev/licenses/inter.txt) |
| JetBrains Mono | SIL Open Font License 1.1 | Gli indirizzi, il terminale e il codice. | [jetbrains-mono.txt](https://app.pixelcake.dev/licenses/jetbrains-mono.txt) |
| Caveat | SIL Open Font License 1.1 | Le parole scritte con il [pennarello](../building/marker.md), sul canvas e nell'immagine esportata. | [caveat.txt](https://app.pixelcake.dev/licenses/caveat.txt) |
| Material Design Icons, di Pictogrammers | Apache 2.0 | Le icone dell'interfaccia che vengono da questa serie. | [icons-mdi.txt](https://app.pixelcake.dev/licenses/icons-mdi.txt) |
| Lucide | ISC | Le icone dell'interfaccia che vengono da questa serie. | [icons-lucide.txt](https://app.pixelcake.dev/licenses/icons-lucide.txt) |

Le icone sono incluse nell'app: mentre lavori non si scarica nulla da un servizio di icone. Lo stesso vale per i caratteri. I disegni dei dispositivi non vengono da queste serie.

L'app è fatta anche con librerie open source, ciascuna con la sua licenza, elencate con le loro versioni in `frontend/package.json`: React e React DOM, React Flow, Zustand, Sonner, dagre e react-custom-scrollbars-2 (MIT), il componente Iconify per React (MIT), `lucide-react` e `yaml` (ISC). I testi delle loro licenze sono nei rispettivi pacchetti, con il sorgente.

## Riconoscimenti {#credits}

- **PixelCake**, il suo codice, i disegni dei suoi dispositivi, le sue reti di esempio e queste pagine: Copyright © 2025–2026 [@Phil-pje](https://github.com/Phil-pje).
- **Inter**: Copyright 2016 The Inter Project Authors, [github.com/rsms/inter](https://github.com/rsms/inter).
- **JetBrains Mono**: Copyright 2020 The JetBrains Mono Project Authors, [github.com/JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono).
- **Caveat**: Copyright 2014 The Caveat Project Authors, [github.com/googlefonts/caveat](https://github.com/googlefonts/caveat).
- **Material Design Icons**: il gruppo di icone Pictogrammers, [pictogrammers.com](https://pictogrammers.com/).
- **Lucide**: Lucide Icons and Contributors, [lucide.dev](https://lucide.dev/).
- Il canvas, con il suo zoom, la sua selezione e il disegno delle connessioni, è costruito su [React Flow](https://reactflow.dev/); la disposizione automatica di un disegno usa dagre.

Un errore in un riconoscimento, o una licenza che manca, è un problema da segnalare: [Segnalare un problema](limits-and-faq.md#report).
