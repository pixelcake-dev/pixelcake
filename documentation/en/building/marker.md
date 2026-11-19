---
title: "Writing on the board"
description: "The marker writes and draws by hand over the drawing: words, arrows, circles, ticks and crosses. Kept with the board, and a pen for the presenter while presenting."
order: 7.5
---

The marker writes and draws by hand over the drawing, as on a whiteboard: a word next to a switch, an arrow to the link that matters, a circle around the server everything depends on, a tick, a cross. What is written stays with the board. It is for whoever reads the drawing: the network does not read it.

## Taking up the marker {#take}

Press “Marker”, the button with the marker on the menu bar, next to “Present”; or choose View → “Marker”; or press P. Its tools appear over the top of the board, and the button stays dark while the marker is on.

While the marker is on, the left button writes: nothing is selected, moved or joined, and the right button opens no menu. A pen, or a finger on a touch screen, writes too. The right button still drags the view, and the wheel still zooms.

To put it away, press the button again, or P, or Esc, or “Close the marker” at the end of its tools. Put away, what is written is a drawing over the board and nothing more: a click goes through it to the device or the cable under it, as if nothing were written there.

## The tools {#tools}

- **“Pen”**: a line by hand, wherever the pointer goes.
- **“Text”**: click where the words go, type them and press Enter. Shift + Enter starts a new line, Esc gives the words up, a click elsewhere keeps them. They are written in a handwriting, Caveat.
- **“Arrow”**: from where the button is pressed to where it is let go, with its head there.
- **“Circle”**: a ring around the box the pointer drags, drawn as a hand draws it, a little past where it started.
- **“Tick”** and **“Cross”**: drag the box they fill, or click to place one of a fixed size.
- **“Eraser”**: drag it over the marks to take away. Each mark it touches fades, and goes when the button is let go: always a whole mark, never a piece of one.

Next to the tools, the colour: “Orange”, the orange of PixelCake, “Red”, “Green” and “Ink”, the colour of the text, dark in the light theme and light in the dark one. Then the thickness, “Thin” or “Thick”; for words, small or large. The choice holds for the next marks; a mark already written keeps its own.

The lines have a slight wobble, as by hand. It is worked out from the mark itself, so a mark looks the same on every screen, after a reload and in the exported image.

## Clearing the board {#clear}

“Clear all”, the bin among the tools, takes every mark of the board away, after a question in a window of the app: “Clear everything written on the board?”. “Clear” takes them away; “Cancel” or Esc leaves them. Devices, cables and areas stay. The button is off while nothing is written.

## On the board and in the file {#where}

What is written belongs to its board, as the areas do:

- it is kept in this browser as soon as it is written, and is there after a reload;
- it stays with the board when you go to another board of the project and back;
- it is saved in the project file, with its board ([Project file](../reference/project-file.md#marks));
- the copy of a board made with “Duplicate board” has it too, and from then on each has its own;
- the exported image draws it over everything else, in the light theme and in the dark, with the words in the handwriting ([Exporting an image](../asking/exporting-an-image.md)).

The YAML export does not carry it: the YAML is the network alone. A sample network loaded on the board, or a YAML file imported in place of the drawing, takes it away with the drawing it was written on.

A mark is drawn over the devices and the cables, at the place of the board where it was written. It does not follow a device: a device moved, or the automatic layout, leaves the marks where they were.

## While presenting {#presenting}

In [presentation mode](../asking/presentation.md#marker) the marker is a pen for the presenter: “Marker” on the bar of the presentation, or P. It has the same tools, and writes over the drawing and over what the board already has written, which stays underneath. The tools say “Only for this presentation”: what the pen writes changes nothing of the board and is not saved. It is gone when the presentation ends, and when another board is shown.

“Clear all” takes it away at once, without a question; the eraser takes away only what was written during the presentation. Esc puts the pen away, and a second Esc leaves the presentation. While the pen is on, a click on a device writes: put it away to ask a question or to simulate a failure.

## Limits {#limits}

> [!LIMITS]
> - A mark cannot be moved, resized or edited: rub it out and write it again.
> - Words are written in one handwriting, in two sizes. In the exported image the handwriting has the letters of the languages of Western Europe; other letters are written in a handwriting of the computer.
> - The tools have no keys of their own: they are chosen on the bar of the marker.
> - The small map does not show the marks, and “Fit to window” fits the devices: a mark far from them can be outside the view.
