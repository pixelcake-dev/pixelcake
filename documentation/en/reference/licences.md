---
title: "Licences and credits"
description: "The licence of PixelCake, of its drawings and of these pages, and of the typefaces and icons it bundles."
order: 6
---

PixelCake is free and open source. What is its own is under one licence, and what it bundles from others keeps the licence its authors gave it. The texts of the licences of the typefaces and the icons travel with the app, and the guide names them: Help → About, under “Third-party licences”.

## PixelCake {#app}

PixelCake is released under the GNU Affero General Public License, version 3, `AGPL-3.0-only`. The text is the file [LICENSE](https://github.com/pixelcake-dev/pixelcake/blob/main/LICENSE) of the repository.

In two sentences, and not as legal advice: you may use, study, change and share it, for any purpose. If you change it and let other people use your version over a network, you must offer them the source code of your version under the same licence.

The drawings of the devices are PixelCake's own, under the same licence as the app. These pages are part of the same repository, in the folder `documentation/`, and go with it under that licence. The code is at [github.com/pixelcake-dev/pixelcake](https://github.com/pixelcake-dev/pixelcake).

## What it bundles {#bundled}

The app and these pages carry the two typefaces of the interface; the app also carries the handwriting of the marker and two sets of icons. Each licence text is a file of the built app, under `licenses/`.

| What | Licence | Used for | Text |
|---|---|---|---|
| Inter | SIL Open Font License 1.1 | The text of the interface and of these pages. | [inter.txt](https://app.pixelcake.dev/licenses/inter.txt) |
| JetBrains Mono | SIL Open Font License 1.1 | Addresses, the terminal and code. | [jetbrains-mono.txt](https://app.pixelcake.dev/licenses/jetbrains-mono.txt) |
| Caveat | SIL Open Font License 1.1 | The words written with the [marker](../building/marker.md), on the board and in the exported image. | [caveat.txt](https://app.pixelcake.dev/licenses/caveat.txt) |
| Material Design Icons, by Pictogrammers | Apache 2.0 | The icons of the interface that come from this set. | [icons-mdi.txt](https://app.pixelcake.dev/licenses/icons-mdi.txt) |
| Lucide | ISC | The icons of the interface that come from this set. | [icons-lucide.txt](https://app.pixelcake.dev/licenses/icons-lucide.txt) |

The icons are bundled with the app: nothing is fetched from an icon service while you work. The same goes for the typefaces. The device drawings are not from these sets.

The app is also built from open source libraries, which keep their own licences and are listed with their versions in `frontend/package.json`: React and React DOM, React Flow, Zustand, Sonner, dagre and react-custom-scrollbars-2 (MIT), the Iconify component for React (MIT), `lucide-react` and `yaml` (ISC). Their licences are in their packages, with the source.

## Credits {#credits}

- **PixelCake**, its code, the drawings of its devices, its sample networks and these pages: Copyright © 2025–2026 [@Phil-pje](https://github.com/Phil-pje).
- **Inter**: Copyright 2016 The Inter Project Authors, [github.com/rsms/inter](https://github.com/rsms/inter).
- **JetBrains Mono**: Copyright 2020 The JetBrains Mono Project Authors, [github.com/JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono).
- **Caveat**: Copyright 2014 The Caveat Project Authors, [github.com/googlefonts/caveat](https://github.com/googlefonts/caveat).
- **Material Design Icons**: the Pictogrammers icon group, [pictogrammers.com](https://pictogrammers.com/).
- **Lucide**: Lucide Icons and Contributors, [lucide.dev](https://lucide.dev/).
- The board, with its zoom, its selection and the drawing of its links, is built on [React Flow](https://reactflow.dev/); the automatic layout of a drawing uses dagre.

A mistake in a credit, or a licence that is missing, is a problem worth reporting: [Reporting a problem](limits-and-faq.md#report).
