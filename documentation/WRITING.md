# Writing the documentation

For whoever writes or changes a page of the documentation of PixelCake, published at https://app.pixelcake.dev/docs/ (English) and https://app.pixelcake.dev/docs/it/ (Italian). Read this once, then the two model pages, each in both languages:

- a concept page: `en/building/vlans.md`, `it/building/vlans.md`;
- a reference page: `en/terminal/interfaces-and-vlans.md`, `it/terminal/interfaces-and-vlans.md`.

## Where things are

| | |
|---|---|
| `en/`, `it/` | The pages, one Markdown file each, in the folder of their section. The two trees have the same files. |
| `sections.json` | The sections of the navigation, in order, with their titles in both languages. |
| `media/` | Pictures, animations and videos, shared by the two languages unless they show text of the interface. |
| `fixtures/` | Small projects a terminal example can start from (`.pixelcake.json`, saved from the app). |
| `stubs.txt` | The pages still to be written. Empty it as you go. |
| `frontend/scripts/build-docs.mjs`, `frontend/scripts/docs/` | The generator, its style sheet and its script. |
| `frontend/src/docs/` | The tests of the documentation. |

## The three commands

From `frontend/`:

```text
pnpm docs:dev     the pages at http://127.0.0.1:5180/docs/, built again at every save (--port <n> for another port)
pnpm docs:test    every check of the documentation: examples, links, anchors, labels, pictures, unfinished pages
pnpm docs:build   the pages into dist/docs (pnpm build does it after the app; the CI publishes both)
```

`pnpm docs:test` is the one that matters: a page is done when it passes. `pnpm test` runs it with the rest of the suite.

## A page

```markdown
---
title: VLANs
description: One sentence: what the page is for. It is the line under the title and what a search engine shows.
order: 5
---

The first paragraph says what the thing is, without a heading.

## Access and trunk ports {#access-and-trunk}

…
```

- `order` places the page in its section. Two pages of one section never share a number, and a page has the same number in both languages.
- The title is in the front matter: the page starts with its first paragraph, and its sections with `##` (`###` under them).
- **Every heading names its anchor**: `{#lower-case-words}`, in English, the same in the Italian page, in the same order. The anchor is the address of the section: once published, it does not change, even when the heading is reworded.
- A new page is written in both languages before it is committed. To add a page: create `en/<section>/<name>.md` and `it/<section>/<name>.md`. To add a section: a folder in both trees and a line in `sections.json`.

## Voice and words

- **Say what happens**, in short sentences: what to click, what appears, what the answer says. No selling, no "simply", no "just".
- **English is British** (colour, licence, behaviour), **Italian is natural** Italian, written for itself and not translated word by word. Headings in sentence case.
- **One word for one thing**: the glossary of `ARCHITECTURE.md` (section "Two languages") is the list. A canvas is a *board* in English and a *canvas* in Italian; a NIC is a *network card*, *scheda di rete*; the thing drawn between two devices is a *link*, *connessione*, the physical one a *cable*, *cavo*.
- **The controls of the app are named by their labels**, as the interface of that language shows them, in “curly quotes” in English and in «guillemets» in Italian: “Ports”, «Porte». A test checks every quoted name against the dictionaries of the app (`frontend/src/i18n/en`, `it`): when a label changes, the page that quotes it fails. Anything that is not a label (a name the user types, a VLAN name, an example) goes in `code` or in "straight quotes". Menus are written as a path: Settings → Network, Impostazioni → Rete.
- **The sample networks name their devices in the language they are loaded in**: PC-Sales in English is PC-Vendite in Italian. The office sample (Router-1, SW-Office, PC-1…) has the same names in both.
- **What is not simulated says so.** Every concept page ends with a box of limits; a sentence never lets the reader believe the app does what real hardware does when it does not. The lists to start from: "What it does not do" in `README.md`, "Not simulated" in `docs/terminal-commands.md`.

## Boxes

```markdown
> [!NOTE]
> Something worth knowing next to the text.
```

The kinds: `[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!LIMITS]` (what is not simulated) and `[!TODO]` (what is still to be written: it marks the page as unfinished, see below).

## Links

Written as a path from the file, to the file: `[VLANs](../building/vlans.md#vlan-1)`, or `[below](#limits)` in the same page. They work on GitHub too, and the generator turns them into the addresses of the pages. A page links to pages of its own language. Addresses outside the documentation start with `https://`. A link to a page or an anchor that does not exist fails the tests.

## Terminal examples

An example that shows the terminal is run by the tests, on the network it names, and must print exactly what the page shows.

````markdown
```ncl sample=office
pixelcake> interface 2 down on SW-Office
port 2 on SW-Office is now down
pixelcake> ping PC-2 from PC-1
Pinging PC-2 (192.168.10.12) from PC-1...
Ping failed (blocked): request: port 2 on SW-Office is disabled
  dropped at: SW-Office
```
````

- After `ncl`, what the example starts from: `sample=company`, `office`, `site`, `two-sites`, `multinational` (the five samples of the app, see Add → Samples), `sample=empty`, or `fixture=<name>` for `fixtures/<name>.pixelcake.json`. Or `continue`: the example goes on from where the previous example of the same page left the network.
- The sample is loaded in the language of the page; `lang=en` or `lang=it` chooses the other.
- A line that starts with the prompt is typed: `pixelcake> `, or `SW-Office> ` after `use SW-Office`. The lines under it are what the terminal prints, in full, spaces included. An empty line at the end of an answer is allowed, to let two commands breathe.
- **To get the output**, run the commands in the terminal of the app on the same sample, in the language of the page, and copy what it prints. Or write the commands with no output, run `pnpm docs:test`, and copy the lines the failure shows as received, after checking they say what you meant.
- When the app changes what a command prints, the examples fail: correct them, in both languages.
- A block that shows only syntax, with no prompt, is a ```` ```text ```` block, and is not run. A block with a prompt that is not `ncl` fails the tests.
- Every command the terminal knows must appear, as code, in the pages of the terminal section of both languages (a syntax block, inline code, or a command typed in an example). A test reads the commands from the parser of the terminal: a command added to the app and not to the reference fails there.

`docs/terminal-commands.md` stays the specification of the language (NCL, with its version); its sessions in ```` ```ncl ```` blocks are run by the same tests. The terminal pages explain the language to the people who use it.

## Pictures, animations, videos

```markdown
![What the picture shows, for who cannot see it.](../../media/vlans/offices-trunk.en.svg "The caption under it.")
```

The picture stands alone in its paragraph, and becomes a figure with its caption. Both the words between `[ ]` and the caption are required.

- **Where**: `media/<topic>/<name>.<extension>`, the topic usually the name of the page.
- **Kinds**: `.png`, `.svg`, `.jpg`, `.webp` for a picture; `.gif` for an animation; `.mp4` (and, if you have it, `.webm` with the same name, offered first) for a video.
- **A video has a poster**: `<name>.poster.png` next to it, required. It plays muted, in a loop, by itself only while it is on screen and only for a visitor who has not asked for less motion; otherwise it shows the poster and a play button. Prefer a short MP4 to a GIF: it is lighter and can be paused.
- **An animation (GIF)** may have a poster too, `<name>.poster.png`: a visitor who asked for less motion then sees the poster and a play button.
- **In both themes**: `<name>.dark.png` next to `<name>.png` is shown in the dark theme.
- **Text of the interface in the picture**: one file per language, `<name>.en.png` and `<name>.it.png`, each page naming its own. A picture without words of the interface is shared.
- **Size**: 8 MB at most per file (the tests refuse more); a screen of the app at the size it is shown, not larger.
- **Where they come from**: a recorder of the app for videos and animations is being built in `tools/media/` (it writes MP4, WebM, GIF and PNG posters: name its outputs as above and put them here). A figure of a drawing is best made with File → Export image… in SVG, without the name of the project, once in the light and once in the dark theme: the figures of the VLAN page (`offices-trunk.en.svg`, `offices-trunk.en.dark.svg` and the Italian pair) are drawings of that kind, made by the code behind that window.

## Finishing a page

1. Write every section; take away every `[!TODO]` box. A section with nothing under it counts as unfinished too.
2. Write the other language, with the same headings and anchors.
3. Take the line of the page off `stubs.txt`. The tests fail while a finished page is still listed, and while an unfinished page is not.
4. `pnpm docs:test`, then a look in `pnpm docs:dev`: at the width of a phone, in light and in dark, with the keyboard.
