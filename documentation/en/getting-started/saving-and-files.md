---
title: "Saving, opening, files"
description: "Where your work is kept while you draw, how to save it to a .pixelcake.json file and open it again, and the boards of a project."
order: 5
---

PixelCake runs entirely in the browser: there is no server and no account, so your work lives in two places only. While you draw it is kept in the browser. For good, it is a file on your disk, which you save and open yourself.

## In the browser {#in-the-browser}

Every change is written to the browser's storage at once, as you make it. Close the tab, reload the page, restart the computer: when you open PixelCake again at the same address, in the same browser, the project is as you left it. There is nothing to press.

That storage belongs to one browser, on one computer, at one address. Another browser, another computer or a private window does not see it. And the browser can empty it: clearing the cookies and site data of PixelCake, a setting that clears them when the browser closes, or closing a private window all take away what is kept there. **A project that was never saved to a file is lost when the browser's data is cleared.**

The dot before the project name in the middle of the menu bar says whether that can happen: it is shown while the project has changes not saved to a file, and it goes when you save. If the storage is full, a notice says that your latest changes were not kept there and asks you to save the project to a file.

## Saving to a file {#save}

Choose File → “Save”, or press Ctrl + S anywhere in the app. The project, with all its boards, is written to one file, `project-name.pixelcake.json`. The notice “Project saved to a file” confirms it, and the dot disappears.

How the file is written depends on the browser:

- **Chrome and Edge** ask where to put the file the first time. Every later “Save” writes to that same file, in place, without asking. “Save as…” asks again, for another file.
- **Other browsers** download the file each time, to the folder the browser uses for downloads, and the notice says its name. Open the file from there when you need it.

In Chrome and Edge the file is remembered only until you close or reload the page: the first “Save” after that asks where again. “Save to file” in the Explorer does the same as File → “Save”.

A project saved to a file is yours to keep, copy, send or put under version control. The format is described in [The project file](../reference/project-file.md).

## Opening a file {#open}

Choose File → “Open…” (the Explorer has “Open file…”, and the welcome screen “Open project”), and pick a `.pixelcake.json` file. It replaces the project that is open.

If the open project has changes not saved to a file, a question comes first: “Continue without saving?”, with the line “The project has changes not yet saved to a file: they will be lost.”. Choose “Continue without saving” to go on, or cancel to keep what you have and save it first. File → “New project…” asks the same question before it starts a new project.

A file that cannot be read is not opened, and a notice says why: it is not valid JSON, it is not a PixelCake project, or it was made with a newer version of PixelCake and the app must be updated. A file that is old or damaged is repaired as far as it can be, then opened, and the notice says that the project was opened with some repairs, and lists each one: a missing name that was given a default, an incomplete device that was completed, a link to a device that does not exist that was removed. What is repaired, and what the file holds, is in [The project file](../reference/project-file.md#repairs).

## Boards {#boards}

A project has one or more boards, each with its own drawing. Open the Explorer, the first button on the left, to see them. There you can:

- add a board with “New board”: type a name in the field and confirm;
- rename a board, with its pencil or by a double click on its name, or delete it (a project always keeps at least one, and the app asks before it deletes a board, and says how many devices it holds);
- duplicate a board with “Duplicate board”, the button with two sheets: the copy comes right after it, named after it with "(copy)", with its devices, cables, areas, notes and view, and it is a board of its own;
- change the name and the description of the project;
- move from one board to another with a click.

Every board of the project goes in the one file. A new project starts with one board, named `Board 1`. An image of the drawing, from File → “Export image…”, is of one board at a time.

## The network as YAML {#yaml}

“Import/Export”, the fifth button on the left, is for the network of the open board only, as text: the devices, the links and the areas. Its first tab shows the network as YAML, to copy or to download. Its second tab loads a `.yaml` or `.yml` file, in place of what is on the board (“Replace the topology”) or in addition to it (“Add to the topology”). It is a way to read the drawing in a text editor, or to build one from a script; it is not a way to keep a project, because the name, the other boards and the settings are not in it. See [YAML import and export](../reference/yaml.md).

## Two tabs on one project {#two-tabs}

If you open PixelCake in two tabs of the same browser, both read and write the same storage and neither sees the other's changes. The last one to write wins: what the other tab wrote meanwhile is overwritten, without a warning. Work in one tab at a time, and save to a file before you open a second.

## Limits {#limits}

> [!LIMITS]
> - Undo goes back 100 steps on each board, and only while the page is open ([Undo and redo](interface.md#undo)): the steps are not in the file. Save to a file before a large change you may want to take back later.
> - There are no accounts and no sharing: to give a project to someone, send the file.
> - A project in the browser is not a backup. Clearing the browser's data empties it.
> - A project file is read as a whole: there is no merging of two files.
