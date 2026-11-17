---
title: "Languages and themes"
description: "The interface in Italian or in English, light or dark, and what does not change with the language."
order: 4
---

The interface of PixelCake speaks Italian and English, and has a light and a dark theme. Both are chosen with a click, change at once without reloading the page, and are kept in the browser. This documentation follows them.

## Choosing the language {#language}

The switch IT / EN is at the top right of the menu bar, next to the button of the theme. The same switch is on the welcome screen, at the bottom right of its card; in Settings → Appearance, under “Language”; and on the bar of [presentation mode](../asking/presentation.md). Each language is named in itself. A click on one changes every text of the app, the open windows included, and the choice is remembered in this browser.

**The first visit.** Until you choose, the app takes the languages your browser lists, in the order you prefer them, and uses the first one it speaks. A browser set to Italian gets Italian; one set to French and then English gets English; one that lists neither gets English. A language found this way is not remembered: it is looked for again at the next visit. Only a choice is kept, so a browser that is later set to another language is followed until you choose.

**In the address.** `?lang=it` or `?lang=en` after the address of the app chooses the language, whatever the browser says. The choice is remembered and the parameter is taken out of the address, so that a later click on the switch is not undone by a reload. It is the way to give someone a link in a language: `https://app.pixelcake.dev/?lang=en`.

**The documentation.** Help → “Documentation” opens these pages in the language the interface has, in a new tab. The pages have a switch of their own at the top, EN and IT. The English home page sends a first visit on to the Italian one when you chose Italian, here or in the app, or when your browser prefers Italian; nobody is moved while going from one page to another.

## What does not change {#what-stays}

A change of language translates the interface, and nothing that was made with it:

- **What you wrote.** The names, notes and descriptions of the project, of its boards, of its devices and of its areas stay as typed.
- **The names the app gave.** A project nobody named, a new board, a new area and the devices of a sample network are named in the language of the moment, and are content afterwards: the sales PC of the company sample is `PC-Sales` in English and `PC-Vendite` in Italian, and a sample loaded in English keeps its English names when the interface goes to Italian. The technical names that are the same in both languages (`Switch`, `Firewall`, `VLAN`) are not touched.
- **The terminal.** Its commands, its answers and `help` are in English in both languages. Only the window around it, its title and the names that a screen reader gives its parts, is translated.
- **The reasons of the engine.** A question that fails says why in English, in both languages: the notice around it is translated, the reason inside it is not.
- **Numbers.** A count is written the way the language writes it: 14,891 in English, 14.891 in Italian.

## Light and dark {#theme}

The button at the right end of the menu bar changes the theme: a moon in the light theme, a sun in the dark one. Its name, shown when the pointer rests on it, is the theme it leads to, “Switch to dark theme” or “Switch to light theme”. Settings → Appearance has the same choice, as the switch “Dark theme”.

**The first visit.** The app starts in the theme your computer is set to. That is looked at once: from then on it keeps the theme it has, and a later change of the computer from light to dark does not move it. Your own click is kept in this browser.

**The terminal** is always dark, in both themes. **An exported image** has a theme of its own, chosen in the window that makes it, whatever the theme on screen: see [Exporting an image](../asking/exporting-an-image.md).

**The documentation** has its own button at the top, which names the theme it leads to. The theme starts as the one you chose in the app, if the app and the documentation are opened from the same address, and as the one of your computer otherwise. A choice made in the documentation is kept for the documentation only.

The screenshots on these pages come in both themes, and show the one the page is in. The videos are in the light theme.
