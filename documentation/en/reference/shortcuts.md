---
title: "Keyboard and mouse"
description: "Every shortcut of the keyboard and every gesture of the mouse, on the board, in the windows, in the terminal and while presenting."
order: 3
---

These are all the keys and gestures the app has. All of them are also listed in Settings → Advanced, under “Keyboard and mouse shortcuts”, with the Windows and Linux keys; the Mac keys are only here. Where the keys differ between computers, the first column is for Windows and Linux and the second for a Mac. The menus have no shortcuts.

## On the board {#board}

| To | Windows, Linux | Mac |
|---|---|---|
| Save the project to a file | Ctrl + S | Cmd + S |
| Copy the selected devices and areas | Ctrl + C | Cmd + C |
| Paste them | Ctrl + V | Cmd + V |
| Delete the selected devices, cables and areas, after a question | Delete | Fn + Delete (the Delete key of a laptop) |
| Add a device or an area to the selection, or take it out | Ctrl + click (an area by its name or border) | Control + click |
| Select with a box | Drag on empty space | Drag on empty space |
| Move the view | Right button + drag | Right button + drag |
| Zoom | Mouse wheel | Mouse wheel or scroll |
| Zoom in on a point | Double click on empty space | Double click on empty space |
| Move a device | Drag it | Drag it |
| Move the selected device a little | Arrow keys | Arrow keys |
| Move it further | Shift + arrow keys | Shift + arrow keys |
| Let go of the selection | Esc | Esc |
| Move the keyboard focus through the cables and the devices | Tab | Tab |
| Select the device that has the focus | Enter | Enter |

A few things about these:

- **Save** works from anywhere in the app, also with a field in focus. The browser's own "save page" never opens.
- **Copy and paste** act on the drawing only while no text is selected and no field is being typed in. With text selected (the output of the terminal, say) Ctrl + C copies that text, as anywhere. The pasted devices appear 50 units down and to the right of the originals, or further when a copy pasted before is there, with the links that were among them and the areas that were selected; [Devices](../building/devices.md#copy-delete) says what a copy is given anew. The keys work with Caps Lock on too, and on a keyboard whose letters are not Latin.
- **Delete** is the Delete key. Backspace does nothing. It asks first, in a window of the app, as the right-click menu does: for one thing alone the question of its menu, for more how many of each. Enter or a click on “Delete” deletes; Esc deletes nothing.
- **Selecting more than one**: a click on a device selects it alone; Ctrl + click adds or removes one; a box drawn on empty space selects the devices and the areas that are wholly inside it. Ctrl + click on the name or the border of an area adds it or removes it. A click on empty space lets go.
- **The view** moves only with the right button held down: the wheel zooms, it does not scroll. The zoom goes from 10 % to 400 %. The four buttons at the bottom left of the board zoom in, zoom out, fit the drawing in the window and lock it, so that nothing can be moved; View → Fit to window does the same as the third.
- **Moving a device with the arrow keys** needs the device to be selected or to have the keyboard focus: a step of 5 units, 20 with Shift.
- **Tab** moves the keyboard focus through the cables and the devices; Enter on a device selects it. A device that has a note shows it while it has the focus, and Esc sends it away.

## With the pointer {#pointer}

| To | Do |
|---|---|
| Open the window of a device | Double click on it. |
| Open its menu: “Details (edit)”, “Console”, “Enclose in an area” and delete | Right click on it. |
| Open the menu of a cable: “Edit link”, “Delete link” | Right click on it. |
| Draw a cable | Rest the pointer on the edge of a device until the side turns orange, drag to another device and let go over it. |
| Read the note of a device | Rest the pointer on it for a moment. It goes at a click, a turn of the wheel, a menu or Esc. |
| Select an area | Click on its name or its border. |
| Move an area, or resize it | Drag its name or its border; drag a handle of the selected area. |
| Rename an area | Double click on its name, or Enter on its name with the keyboard. |
| Open the menu of an area: “Rename”, its colour and delete | Right click on it. |
| Rename the project or a board | Double click on the name in the Explorer. Enter keeps the new name, Esc gives it up; a click elsewhere keeps it. |

## In the windows {#windows}

| Key | What it does |
|---|---|
| Esc | Closes the window on top. A list opened inside a window closes before the window does, and one press never closes two. In a field that is being renamed, Esc gives up the rename and nothing else. |
| Enter | In a question that asks to confirm (“Continue without saving?”, the deletion of a device), confirms: the button that says yes has the keyboard when the question opens. Esc and a click outside are a no. In a name being edited, Enter keeps it. |
| Tab, Shift + Tab | Move from one field to the next, as in any page. |
| Enter or comma | In the field that lists the VLANs of a device, adds the number typed. Backspace on an empty field takes the last one away. |

The windows of the app do not save on Enter: a window with fields has its “Save” button, and Enter in one of its fields does nothing.

## In the terminal {#terminal}

| Key | What it does |
|---|---|
| Enter | Runs the command. |
| Up arrow, Down arrow | Walk through the commands of this session. Down past the newest brings back what was being typed. The list is lost when the page is reloaded. |
| Ctrl + C (Control + C on a Mac too) | While a `ping`, `trace` or other question is running, stops it: the terminal prints `^C — interrupted` and the packet stops on the board. When nothing is running, it copies the selected text as anywhere. |
| Esc | Closes the terminal. A `ping`, `trace` or other question that is running is stopped first, as with Ctrl + C. |

The terminal is a window that floats over the board: drag it by its top bar to move it, drag the grip at the bottom right to resize it. It closes with its own close button or with Esc, and Tab does not complete a command: it leaves the field. It opens from “Console” in the bar on the left, or from the right-click menu of a device, which opens it in the context of that device.

## While presenting {#presenting}

| To | Do |
|---|---|
| Leave the presentation | Esc. If the small menu of a click is open, the first Esc closes it. Nothing happens while a field has the keyboard or a window, the terminal included, is open. |
| Ask or break | Click a device or a cable: a menu offers “Start here”, “Arrive here”, “Simulate a failure” and “Repair”. |
| Move the view | Drag with the left button; the wheel zooms. A double click does not zoom. |

While presenting, nothing can be selected, moved, joined, copied or deleted, so the keys of [the board](#board) do nothing but Ctrl + S, which still saves.

> [!LIMITS]
> - There is no undo, no redo, no select all and no cut: Ctrl + Z, Ctrl + Y, Ctrl + A and Ctrl + X do nothing.
> - The view cannot be moved with the keyboard, nor with the left button on the board outside a presentation: the arrow keys move devices, not the view.
> - Save, copy and paste take Cmd on a Mac. The multiple selection takes the Control key there as well, not Cmd.
