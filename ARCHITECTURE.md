# ARCHITECTURE.md

Detailed technical reference for PixelCake. To install and run it, see [README.md](./README.md).

The interface speaks Italian and English (see [Two languages](#two-languages-frontendsrci18n)). This document names controls by their Italian labels, the ones the dictionary starts from: «Salva», «Porte», Impostazioni → Rete.

## State Management (Zustand Stores)

All stores use Zustand. There is no server: what must survive a reload is kept in the browser's localStorage, and a project is saved for good as a file (see [Projects and files](#projects-and-files)).

### networkStore (`frontend/src/store/networkStore.ts`)
- The canvas on screen: devices, connections, areas, viewport (x, y, zoom), device/connection counters
- `areas`: the areas drawn behind the devices («riquadri», see [Areas](#areas-riquadri)); `addArea`, `updateArea`, `removeArea` are edits like any other. `selectedAreaIds` (not persisted) are the areas in the selection, with the devices or alone; `selectedAreaId` is the one area selected by itself (it shows its handles), and `editingAreaId` the one being renamed. An area is never in `selectedDeviceIds`: `selectArea` selects one alone and empties the devices, `toggleAreaSelection` (Ctrl+click) and `setSelectedAreas` (a selection box) keep them, and `selectMultipleDevices(ids, { keepAreas })` lets go of the areas unless told not to. `moveTogether` and `removeElements` move and delete devices and areas in one edit. `clearAllDevices` and `loadTopology` take the areas away with the drawing they were made for
- Project-wide network settings (`globalNetworkSettings`, see [GlobalNetworkSettings](#globalnetworksettings))
- **Multi-selection state** (selectedDeviceIds, clipboard) - NOT persisted, resets on reload
- **Copy/Paste functions** (copySelection, paste) - the selected devices, the cables among them and the selected areas; a paste is worked out by `utils/pasteDevices.ts` (pure): new ids, the first free name of the family of each device (`newDeviceName`), a new MAC on every card, the cards of an end device that is not a server (`asksForAddressWhenPasted`) on DHCP, new area ids, and a step of 50 down and to the right, or as many steps as it takes not to land on a device that is there. `paste()` says which devices went on DHCP; `utils/pasteActions.ts` (`pasteAndTell`, used by Ctrl+V and Edit → Paste) names in a notice those that got no lease, and the servers, routers, firewalls and switches that kept the addresses of the original, with those now in conflict (`addressConflicts` of the engine)
- `applyAutoLayout(direction, templates)` lays the drawing out again, its areas with it, and asks the canvas to fit the view (a large drawing in steps, done when the promise it hands back is kept); `autoConnectDevices()` adds the cables of the automatic connection and hands back what it did (how many, who was left alone and why). Both are edits: they set `hasUnsavedChanges`, the second only when it added a cable
- `marks`: what is written on the canvas with the marker («Pennarello», see [The marker](#the-marker-pennarello)); `addMark` (a mark finished; refused, with null, when it is no mark), `removeMarks` (one sweep of the eraser) and `clearMarks` are one edit each. Persisted, in the snapshot of the canvas (left out when empty) and so in the project file; `clearAllDevices` and `loadTopology` take them away with the drawing they were written on
- `canvasId`: which canvas of the project this data is. Persisted next to the data, so the two stores cannot be paired wrongly after a reload
- `hasUnsavedChanges`: true when the project changed since it was last saved to, or opened from, a file. Every edit sets it through `markChanged()`; moving the viewport does not. `getChangeToken()` / `markSaved(token)` keep it set when an edit lands while a file is being written
- `getCanvasSnapshot()` / `replaceCanvas()`: used by projectStore to take the canvas off the screen and put another one on. Every key the snapshot has (but `viewport`) is a field of the store with the same name: it is what the history of undo covers (see historyStore), so a field added to a board there is undone and redone with nothing else written for it
- LocalStorage key: `pixelcake-network-v2`

### projectStore (`frontend/src/store/projectStore.ts`)
- The one project open in the browser: `name`, `description`, `canvases`, `activeCanvasId`. There is always a project
- The entry of the active canvas is refreshed only when it is committed (canvas switch, building the file): read the whole project through `buildProjectFile()`
- **Actions**: createProject, loadProject, renameProject, setDescription, addCanvas, renameCanvas, duplicateCanvas (a deep copy right after the original, «<name> (copia)», numbered when taken; it does not switch), deleteCanvas (the last canvas cannot be deleted), switchCanvas
- Depends on networkStore, never the other way round
- LocalStorage key: `pixelcake-project-v1`

### simulationStore (`frontend/src/store/simulationStore.ts`)
- The packet travelling on the canvas. Not persisted
- `startSimulation(path, flowModel, links?, outcome?)` starts a run and returns its `runId`; a new start replaces the run in progress. `path` is the devices to go through, `links` the cable of each stretch as the engine took it (two devices can be joined by more than one cable), `outcome` how the question ends: the device that answers, or the one that drops it (`flowOutcome`, `traceOutcome` in `utils/answerOutcome.ts`)
- The answer left on the canvas: when the packet gets to the end of its way (`finishSimulation`, called by PacketAnimation) the outcome becomes `answer`, and that device says it with its lamp (see [The look](#the-look-frontendsrcindexcss-frontendtailwindconfigjs)). A question that does not even leave its device is left at once, with no run (`leaveAnswer`). The answer goes at the next start, at a stop, on a click on the empty canvas, and at any change to the devices or the cables (`clearAnswer`): it was about the drawing as it was. The simulation panel and the terminal (`ping`, `trace`, `browse`, `mail`, `download`) tell it; presentation mode has its own (the route of presentationStore)
- While it runs: `currentHop`, `activeDeviceId` (the device the packet is stopping on), `currentConnectionId` with its duration and direction
- `speed` (0.5, 1, 2): set from the presentation bar

### presentationStore (`frontend/src/store/presentationStore.ts`)
- Presentation mode: `active`, the question (`sourceId`, `targetId`, `flow`), the simulated failures (`failedDevices`, `failedConnections`), the small menu open on the canvas, the path of the answer (`route`: the device the packet stops on, for the canvas; the cables, for the exported image), whether the panel is open
- **It never changes the drawing.** A failure is an id in this store, handed to the engine next to the topology. Nothing here is persisted; `exit()` forgets question and failures
- `enter()` refuses an empty canvas and puts the building tools away (selection, context menu, running packet)
- `utils/liveTopology.ts` builds the topology every question is asked of (canvas + failures while presenting): the simulation panel, the terminal and the presentation all read it there

### markerStore (`frontend/src/store/markerStore.ts`)
- The marker («Pennarello»): `active`, the `tool` (a kind of mark or the eraser), `color`, `width`; `erasing` (the marks the eraser is passing over, shown faded). Not persisted
- `presenterMarks`: what the presenter writes while presenting (`addPresenterMark`, `removePresenterMarks`, `clearPresenterMarks`), never in the canvas nor in a file. presentationStore puts the pen away and forgets them on `enter()` and `exit()`, and forgets them in `resetCanvasState()` (another canvas on screen)

### historyStore (`frontend/src/store/historyStore.ts`)
- Undo and redo of the drawing: `undo()`, `redo()`, and `useHistoryStore` for the menu (`canUndo`, `canRedo`, and what each would take back or do again, `undoStep`, `redoStep`, named by `utils/historySteps.ts` from the board before and after: one device, link or area added, deleted, moved or edited, several devices, several links; anything else has no name). Not persisted: the history lives in the page, for the session, and is not in the project file
- **What a step holds**: the board as the project file keeps it, every field of `getCanvasSnapshot()` but the viewport, read from networkStore under the same name (devices, connections, areas, the counters, and whatever a board is given later). A step is the board before it, by reference: the stores never change an object in place, so what a step did not change is shared with the steps around it, not copied (a drag of one device on the multinational costs a list of 181 and one device). A step holds lists of its own, with the same things in them: the engine keeps what it worked out for a list of the store (the leases of DHCP, in a `WeakMap` keyed by the list) for as long as the list is around, and the history would keep it alive otherwise. On the multinational 100 steps take about 1.6 MB of the heap
- **What a step is**: historyStore listens to networkStore (`subscribe`), so whatever changes those fields is recorded without being asked, from the canvas, a window, the terminal or a menu. The changes made in one task of the page are one step (closed in a microtask): a save in a window, a paste, a bulk add, an import, a command of the terminal, the automatic layout or connection, however many writes each makes. While a button of the pointer is held, everything until it is let go is one step (`beginGesture`, `endGesture`: a drag of devices, an area moved or resized). A step that leaves the board as it was (a window saved with nothing changed) is dropped
- **Not a step**: what is not in those fields: the view, the selection, the windows, the network settings of the project (`globalNetworkSettings`: project-wide, like the canvases themselves, which are added, renamed, duplicated and deleted without a step), presentation mode, the preferences of the browser. A board that takes the place of another (a change of `canvasId` or of `canvasRevision`: a switch of canvas, a project opened) is not a step: the step under way is closed on the board it was made on
- **A history for each board**, by canvas id, the last `HISTORY_LIMIT` (100) steps; switching canvas keeps it for the session. `clearHistory()` when a project is opened or created (projectStore), `clearCanvasHistory()` when a sample takes the place of the board (`loadSampleNetwork`, `utils/sampleActions.ts`), `forgetCanvasHistory(id)` when a canvas is deleted. While networkStore keeps no id for the board on screen (a first start, a drawing older than projects) it is the active canvas, which projectStore names at start-up (`nameUnnamedBoard`)
- **Undo and redo** are refused while presenting and while a button of the pointer is held. The board is put back with `setState`; the counters only go up (an id is never given twice on a board), the selection keeps what is still there, the context menus close, and so does the window of a device or a link that is gone. It is an edit like any other: `markChanged()`, and localStorage is written
- **The keys** (`utils/undoActions.ts`, `registerUndoShortcuts`, mounted by App with the presses of the pointer): Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo, Cmd on a Mac (`shortcutLetter(event, { withShift: true })`). In a text field, a text area or the line of the terminal the keys are the browser's; nothing happens while presenting, or while a question or a window other than the terminal is open

### uiStore (`frontend/src/store/uiStore.ts`)
- UI state, modal controls (including `newProject`), context menus, the tab the guide opens on (`helpTab`, `openHelp(tab)`)
- Dark mode (persisted; follows the system until the user chooses), magnification state, sidebar panel state

### templateStore (`frontend/src/store/templateStore.ts`)
- Device and connection templates with auto-update
- 24 device templates come with the app, one for each drawing of `assets/device-drawings` (a test holds the two lists to each other)
- Custom device types with the drawing they are shown with, one of the 24; they are placed from the device panel like the built-in ones
- Connection types with line styles and colors
- Template capabilities: supportsVLAN, supportsSTP, supportsPorts, supportsNICs
- Custom templates travel inside the project file; opening a project adds the ones that are missing (`addMissingTemplates`)
- LocalStorage key: `pixelcake-templates-v8`, version 1 (`TEMPLATE_STORAGE_VERSION`). What a browser kept before versions were counted is read as it was, the templates made or changed by the user included, and the templates the app has come with since are added after it (`migrateTemplateStorage`)

## Core Components

### Canvas
- **NetworkCanvas** (`frontend/src/components/Canvas/NetworkCanvas.tsx`) - React Flow wrapper with real-time viewport sync. The Delete key is the canvas's own (React Flow's `deleteKeyCode` is off): it asks first (`askConfirm`, the question of the menu for one thing alone, how many of each for more) and deletes the selected devices, cables and areas in one edit. Ctrl+C / Ctrl+V act on the drawing only while the user is not typing and has no text selected; the letter of a shortcut is read by `utils/shortcutKey.ts` (`shortcutLetter`), whatever Caps Lock and the layout of the keyboard say. With two devices selected or more a `NodeToolbar` of React Flow over them offers «Racchiudi in un riquadro» (`.selection-toolbar-button`). The small map draws a plain square for each device (`MiniMapSquare`: no rounded corner, no border) and nothing for an area
- **AreaNode** (`frontend/src/components/Canvas/AreaNode.tsx`) - An area of the canvas: see [Areas](#areas-riquadri)
- **MarksLayer**, **MarkerSurface**, **MarkerToolbar**, `useMarkerKeys` (`frontend/src/components/Canvas/`) - The marker: see [The marker](#the-marker-pennarello)
- **NetworkDevice** (`frontend/src/components/Canvas/NetworkDevice.tsx`) - A device: its drawing (`ui/DeviceDrawing`), its name under it, then its address (none, and no empty line, when there is no address to show). No box: the frame (`.network-device`, 104 wide for every device whatever its name, a line lower without an address) is seen only under the pointer, with the focus of the keyboard, selected or dragged, and on every device while a cable is pulled. Its numbers are in `utils/deviceGeometry.ts` (`DEVICE_METRICS`, `deviceHeight`, `cableEnd`), held to the style sheet by a test. The upper layer of the drawing says the state of the device (`deviceState`, see [The look](#the-look-frontendsrcindexcss-frontendtailwindconfigjs)). The note of a device is part of what the device says to a screen reader («Nota: …»); the eye reads it in DeviceNote. Nothing is drawn for it
- **DeviceNote** (`frontend/src/components/Canvas/DeviceNote.tsx`) - The note of the device the pointer rests on (450 ms), or the keyboard brought its focus to with Tab: one panel for the canvas, placed on the page under the device (above it without room below), in the look of the menus, that never takes the pointer. The lines of the note, 280 wide at most, six lines at most. Not while a device is dragged, a cable pulled or a menu open; gone when the pointer leaves, at a press of a button, the wheel, a menu asked for, or Esc. There while presenting too
- **CustomEdge** (`frontend/src/components/Canvas/CustomEdge.tsx`) - Custom edge with connection type styling
- **ParticleEdge** (`frontend/src/components/Canvas/ParticleEdge.tsx`) - Particle flow animation wrapper with CSS offset-path
- **PacketAnimation** (`frontend/src/components/Canvas/PacketAnimation.tsx`) - Moves the packet of a simulation cable by cable and keeps simulationStore up to date; CustomEdge draws it. One run at a time: a new start, a stop or an unmount cancels the run in progress. Timing and the choice of the cable are in `utils/packetTiming.ts`

The panels React Flow draws by itself (zoom buttons, small map, credit) take the colours of the theme from `index.css`. React Flow's own style sheet is loaded after it, so those rules start with `.react-flow` to outrank it. The credit is never hidden.

A cable ends next to what is drawn. The four connection points of a device (`.connect-point`, React Flow handles, all of type source with `connectionMode` loose) are placed by the device 3 off the box of its drawing above it and at its two sides, and on the bottom of the frame under the address (`cableEnd`, which the exported image uses too); each drawing has its own shape, so a server is reached further in than a switch. The points are not seen. A cable is started from the frame: the band along each side (the `::before` of the point of that side, 12 deep, placed back on the frame from where the device put the point: `--at-x`, `--at-y`, `--frame-height`) takes the press, and that side of the frame turns orange while the pointer is on it (the `::after`). A press anywhere else on the device selects it and drags it. While a cable is pulled the four bands grow to cover the device between them, so that it can be let go anywhere on a device, and it ends on the side it is let go on. While presenting the bands are not there; the points stay, for the cables that hang on them.

The selection of the devices is React Flow's: every change it tells of (`onSelectionChange`) is written to networkStore, whatever was done on the canvas before it. The handler keeps its identity and reads the store when it is called, because React Flow calls a new handler at once with the selection it has at that moment. It keeps nothing back: React Flow has changed its selection already, and a change that does not reach the store leaves the app with another selection than the one on screen.

The list of React Flow nodes is made anew from the store at every change. A device that stays on the canvas is handed over with the size React Flow measured for it (`width`, `height`), which React Flow needs for more than drawing: a node without a size counts as inside any selection box, and the rectangle around a group taken with a box is made from the sizes (without them two devices in a row give it no height; React Flow takes it away, and the one it draws next cannot be dragged). A size that changes is still told by React Flow, which goes on watching the node. An area has the size the drawing gives it.

Bringing the whole drawing into view is a request (`fitViewRequest` in networkStore, raised by `triggerFitView`). The canvas answers each request once, after React Flow has measured the devices, so a drawing that has just been loaded (a sample network) is fitted too.

The view on screen is kept with the canvas (`viewport` in networkStore, which is not an edit): it is what a reload of the page and the way out of a presentation come back to. A move made with the pointer or the wheel is stored at its end (`onMoveEnd`). A move the app makes (the drawing fitted, the zoom and fit buttons of the canvas, the view that follows a device dragged to the border) has no end React Flow tells of: it reaches the canvas as `onMove` with no event, and the view is stored once it has stood still for 150 ms. Nothing is stored while presenting.

While presenting, NetworkCanvas makes the drawing read-only (nothing is selected, moved, joined, deleted or pasted; dragging pans), a click on a device or a cable opens the presentation menu, the drawing is fitted to the window, and the view saved with the drawing is not touched. NetworkDevice and CustomEdge mark the ends of the question, a broken device and a cut cable. The path of the answer is not painted: the packet shows it, and a cable lights up in the colour of its kind while the packet is on it, as while building.

### Areas («riquadri»)

An area is a rectangle with a label, drawn behind a group of devices to say what they are (Core, Edge, Uffici). It is a drawing: no device belongs to it, the engine never reads it, moving it moves nothing else.

- **Data**: `CanvasArea` (`id`, `label`, `color`, `position`, `size`) in `types/network.ts`; a canvas keeps a list of them next to its devices (`CanvasData.areas`, left out when empty, so that a canvas without areas is stored and written as before). `utils/canvasAreas.ts` (pure) names, numbers, colours and places them, and reads a list from outside (`readAreas`: a file, the browser's storage)
- **On the canvas** they are React Flow nodes of their own kind, first in the list and at depth -1: under the cables, which React Flow draws at depth 0, and under the devices. They are **not** React Flow's to select, drag, join or delete (`selectable`, `draggable`, `connectable`, `focusable`, `deletable` all false): React Flow's selection is of the devices alone, and `onSelectionChange` passes it on keeping the areas. Which areas are selected is kept in networkStore. NetworkCanvas reads React Flow's selection box from its store while it is drawn and selects the areas it holds whole; lets go of the areas on a press without Ctrl on a device that is not selected, on a cable, or on the empty canvas; lets go of React Flow's own selection when an area is selected by itself (`unselectNodesAndEdges`, not while a box is drawn); and moves the selected areas with the selected devices React Flow moves (`handleNodesChange`, from where each was when the move began)
- **AreaNode** lets the pointer through its inside (`pointer-events: none` on the node; the label and four strips over the border take it back). A strip is 9 wide, across the line, but never wider than a third of the room between that side and the devices inside the area, and not narrower than 3 (`areaEdgeBands`, from the sizes React Flow has measured): an area that gave way leaves most of the little room it has to a selection box. A press there selects the area alone and moves it, or, when the area is part of a larger selection, moves the whole selection; with Ctrl it adds the area to the selection or takes it away. The pointer is followed on the window, not by React Flow's drag and not with pointer capture (which does not hold inside the canvas). Selected by itself, it shows eight `NodeResizeControl` handles, React Flow's own: `onResize` writes position and size to the store. A double click on the label renames it in place (`ui/InlineEdit`); the right button opens `ui/AreaContextMenu` (rename, the six colours, delete after a question)
- **Added** from the panel «Aggiungi» («Riquadro», in the middle of the view) or around the selected devices («Racchiudi in un riquadro», in Modifica and in the menu of a device): `utils/areaActions.ts`, which reads the view and the size of the devices from the screen. Around devices an area has room on every side (`AREA_MARGIN`: 16, and 40 above for its label and, under it, the tag a presentation hangs on a device). Where that room would cross another area, or cover a device it does not hold, it gives way on that side down to `AREA_MIN_MARGIN` (above, the label still fits) to leave `AREA_GAP` clear; at a corner the side that gives up less. An area wholly inside another stays inside it, clear of its sides and under its label where the label reaches (`areaLabelReach`); one wholly around another is nesting too. Where even the least room cannot keep it clear (another area across the devices, a device among them it does not hold, something closer than the least room, an area inside another too close under its label) it is made with its whole room, and overlaps (`areaAround`, `overlaps`). A new area is selected, with its name ready to be typed, in the first colour of the palette the canvas does not use
- **Colours**: six, by name (`slate`, `green`, `amber`, `red`, `violet`, `teal`), each a variable of the theme (`--area-<name>`) with a value in light and in dark, dark or light enough for the label to be read on the tint. The border and the label take the colour, the inside a tenth of it. `AREA_PALETTE` in `utils/canvasAreas.ts` repeats the values for the exported image; tests hold it to the style sheet
- **While presenting** an area is shown and nothing else: no handle, no side to take it by, no menu. **The small map** does not show it: at that size its rectangle read as marks around the squares of the devices. **The exported image** draws the areas first, in the colours of the theme it is made in (`AREA_METRICS` repeats the numbers of the style sheet)
- **Shown or hidden** from Vista → «Mostra i riquadri» (`uiStore.areasShown`, kept in this browser with the theme, not in the drawing nor in the project file). Hidden, NetworkCanvas gives React Flow no area node: none is drawn, on the board or in the small map, none can be taken, and the Delete key leaves them alone (the one selected is let go). The exported image follows the board, and so does a presentation. A new area («Riquadro», «Racchiudi in un riquadro») shows them again, with a notice, rather than making one nobody sees (`showAreas` in `utils/areaActions.ts`)
- **The sample networks** come with theirs (`utils/sampleNetwork.ts`): a sample names, for each area, the devices it holds, and `areasAround` works the rectangle out from where they are, with the margins of «Racchiudi in un riquadro» (`areaAround`) and the size a device is drawn with (`deviceSize`, the frame of `utils/deviceGeometry.ts`). No rectangle is typed: when a device is drawn larger, or moved, its area follows. A test holds that no two areas of a sample cross and that no device is half in one. The small office has none: its two networks are plain without, and the labels of the cables from its router would sit on them. A sample is laid out to be read at once in a laptop window: `utils/sampleLayout.test.ts` fits each to the board of a 1568 × 779 window as React Flow does (the boxes of `layoutDrawing`), asks for a zoom of 0.8 at least, no smaller than the company's, and fails on a label of a cable written over the border or the name of an area, a device or another label, or on a device under the small map. The multinational, too large to be read whole, has a rule of its own: fitted, all of it in view (a zoom above the board's least, 0.1) and nothing under the small map; at 100 %, nothing written over anything; and no cable across an area that holds neither of its ends, or across the label of another cable. An area of a sample can hold the areas of groups listed before it (`areas` of a `SampleGroup`): the head office of the multinational holds its DMZ, its server room and its four floors

### The marker («Pennarello»)

Writing and drawing by hand over the drawing, as on a whiteboard: a line, words, an arrow, a ring, a tick, a cross. Like an area, a mark is a drawing: the engine never reads it, and it does not follow a device that is moved or laid out.

- **Data**: `CanvasMark` (`id`, `kind`, `color`, `width`, `points`, `text`, `seed`) in `types/network.ts`; a canvas keeps a list of them (`CanvasData.marks`, left out when empty). `utils/canvasMarks.ts` (pure) has the strokes and the sizes of words, the colours of the two themes (`MARK_PALETTE`, held by a test to the `--mark-*` variables of the style sheet), the handwriting (`HAND_FONT`), ids, `tidyMark` (points to a tenth, words tidy) and `readMarks` (a list from a file or the browser's storage: what cannot be drawn is dropped, the rest completed)
- **Drawing**: `utils/handDrawing.ts` (pure) turns a mark into SVG paths, or into lines of words, with a slight hand-drawn wobble taken from its `seed` (a small seeded generator): the same mark is drawn the same on screen, after a reload and in the exported image. A line by hand is smoothed through its points; an arrow is slightly bent, with a head of two strokes; a ring goes a little past where it started. It also says where a mark is (`markBox`), what the pointer touches of it (`markHit`), and keeps a line short (`simplifyPoints`, Ramer–Douglas–Peucker)
- **On the board**: `MarksLayer` is one SVG among the children of React Flow, at depth 4 (after its renderer: over cables, their labels and devices; under the zoom buttons and the small map, at 5), in the transform of React Flow's view. It never takes the pointer. While presenting, the presenter's marks are a group of their own over the canvas's
- **In use**: `MarkerSurface`, a sheet at the same depth, takes the pointer (mouse, pen, finger: pointer events, `touch-action: none`), so that nothing is selected, moved or joined. A mark finished is one action of the store: of the canvas while building, of markerStore while presenting. The right button pans and the wheel zooms (its own listener, not passive). Words are typed in a field placed where the board was clicked (Enter writes them, Shift + Enter a new line, Esc gives them up, a click elsewhere keeps them). `MarkerToolbar` floats over the top of the board: the tools, four colours, two thicknesses, «Cancella tutto» (`clearWithQuestion` of `utils/markerActions.ts`: `askConfirm` first; while presenting the presenter's marks go at once) and the close button
- **Taken up and put away** from its button on the menu bar (before «Presenta») and on the bar of the presentation, from Vista → «Pennarello», with P (`plainLetter` of `utils/shortcutKey.ts`: no Ctrl, Cmd, Alt or Shift, whatever Caps Lock and the layout say), and put away with Esc (`useMarkerKeys`; not while typing or with a window open). A press of Esc that puts it away is marked as used: the presentation bar leaves the presentation at the next one
- **The exported image** draws the marks last, over everything (`writing` of `DrawingInput`; while presenting the presenter's too), in the colours of the theme of the image; words in Caveat with a halo of the canvas, the font carried inside the SVG as a `data:` address (`handFont`, read once from the bundled file by `utils/handFont.ts`) when there are words

### Presentation (`frontend/src/components/Presentation/`)
- **PresentationBar** - Takes the place of the menu bar: project and canvases, pace of the packet, the presenter's pen («Pennarello», see [The marker](#the-marker-pennarello)), terminal, the image of what is on screen, full screen, the language, the theme, exit (also Esc). In a narrow window what matters less gives way first, so that the tools and the way out stay inside it down to 600 px: the name of the project is cut short, the canvases scroll, below 800 px the badge keeps its symbol alone (its word stays for a screen reader), below 640 px the name of the project goes
- **PresentationPanel** - Question, answer, simulated failures with their effect on the rest of the network, and the way hop by hop. `usePresentationAnswer` works all of it out from the drawing, the question and the failures, marks the way on the canvas and sets the packet off at every change. The answer is worked out at once; the effect of the failures is asked of `utils/impactMemo.ts` through `utils/useImpact.ts` and comes after it, while a line says it is being worked out. `workOutImpact` evaluates the pairs a slice of about 8 ms at a time and gives the page back between slices, so a frame is never held up: on the multinational (132 end devices, 17,292 ordered pairs) the first cut answers in about 0.1 s and its effect follows in under 3 s. It keeps, for the drawing on screen, the exchanges of the intact drawing (shared by every set of failures, and carried on where it was left when the failures change) and the last reports, keyed by the kind of exchange and the failures. A newer set of failures, or another kind of exchange, stops the work for the old one at the next slice, and a report that is no longer wanted is never shown (`wanted`). The export window, whose caption says the same, takes the very report the panel shows, or waits for it with «Salva» and «Copia» disabled. Slices rather than a Worker: the engine reads the drawing as objects, and a Worker would have it copied over at every change, and the panel would still have to wait for the whole of it
- **PresentationMenu** - The menu a click on a device or a cable opens: start here, arrive here, break, repair
- `utils/presentation.ts` - The engine's answer turned into what is shown (sentences in the language of the interface, rows tied to the animation, exchanges grouped by device, the caption of an exported image). It touches no store but the language; the reasons and notes of the engine are shown as the engine wrote them, in English in both languages

### WelcomeScreen (`frontend/src/components/WelcomeScreen.tsx`)
- Excalidraw-style minimalist transparent overlay on canvas (NOT popup)
- Shows on an empty project: a single canvas with nothing on it
- What the app is for in three steps (draw, configure, ask), the ways to start, links
- "Non mostrare più" checkbox → localStorage (`pixelcake-hide-welcome`)
- Actions: Nuovo Progetto (form), Apri Progetto (file picker), Carica la rete di esempio
- Auto-dismiss on any action, manual "Mostra la schermata di benvenuto" from the Aiuto menu
- State: `useUIStore.showWelcomeScreen`, the number of devices on screen and the number of canvases; whether it is on the board now is `useWelcomeShown()` (`components/useWelcomeShown.ts`), which NetworkCanvas draws it by and the first steps wait on

### The first steps of a visitor (`frontend/src/components/Guide/`)
- **GuidedTour** - Eight steps (`data/tourSteps.ts`), each a title and a sentence or two (`guide.tour` of the dictionary): adding a device, a cable, a question in «Simulazione», the terminal, undo and redo, saving to a file, the marker, presenting. Each points at a part of the screen, the first of its `places` that is whole in the window (the parts carry `data-tour`; the cable step takes a device of the board in view, else the board; the marker and «Presenta» fall back on the View menu, where a narrow bar hides their buttons). A frame of the accent around it (`.guide-tour-spotlight`, its shadow dims the rest of the screen, `--tour-veil` of the theme) and the balloon beside it (`tourPlace.ts`: on the right of what is on the left of the screen, under what is along the top, else another side, else the middle); narrower than 600 px the balloon sits at the bottom, the whole width. Measured again at every frame while open (the board is still being fitted after a sample is loaded). A dialog: `aria-modal`, named after its step, described by its text, the focus on «Avanti» and given back where it was on closing; its keys are heard first, on `window` in the capture phase, and none reaches the app while it is open (→ and Enter go on, ← back, Esc closes, Tab goes round its buttons). A press outside the balloon does nothing. «Salta» at every step; presenting closes it
- **FirstTryHint** - The first question a sample suggests (`SampleNetwork.firstQuestion`, two device ids of the sample; the company has one, PC-Vendite to Web-Gestionale): the question with the names the devices have on the board, the command (`ping <to> from <from>`, `firstTryCommand`), and a button that opens the terminal and runs it (`uiStore.runInTerminal`: TerminalModal types and runs `terminalCommand` once as it opens). Over the top of the board; its cross puts it away. A test runs the command on the sample in both languages
- **FirstSteps** - One at a time. On a first visit the tour opens by itself once the welcome screen, seen in this visit, is no longer on the board, and nothing is in its way (a window, a question, presenting, the marker): a new project waits for its window. The first question, offered by `loadSampleNetwork` (`utils/sampleActions.ts`), waits for the tour, and is not shown over a window, the welcome screen, a presentation or the marker; it is put away when the devices it names leave the board
- **guideStore** (`store/guideStore.ts`) - `tourDue`, `tourStep` (`openTour`, `nextStep`, `previousStep`, `closeTour`), `firstTryDue`, `firstTry` (`offerFirstTry`, `firstTryShown`, `dismissFirstTry`). What is due is read from the browser when the page starts (`guideAtStart`, `utils/firstSteps.ts`), before anything of this visit is written; what is shown is written at once (`readStored`, `writeStored` of `utils/safeStorage.ts`): `pixelcake-tour-seen` when the tour opens, by itself or from Aiuto → «Tour guidato», which opens it at any time; `pixelcake-first-try-seen` when the question is on screen. A browser used before the tour existed (a drawing kept on a board of the project, or the welcome screen put away for good: `usedBefore`) is not given the tour by itself; the question is still offered once with the sample
- Tests start as a browser that has seen both (`test/setup.ts`); the tests of the first steps start a visit afresh (`guideAtStart`). The recorder of `tools/media` sets the two keys too, so that neither is filmed

### Modals (Enterprise Style)
- **InspectorModal** - Device configuration in tabs, over one form that «Salva» checks and saves all together: ports and cards are edited in place (`ui/PortEditor`, `ui/NicEditor` in `ui/NicRows`; no panel has a save of its own), what is wrong with one is worked out by `utils/interfaceProblems.ts` both under its field as it is typed and when the device is saved, and they are kept tidy (`tidyPort`, `tidyNic`). The first tab, Generale, is made for the device: every device has its note there, the last field of «Identità» (`TextAreaField`, one row until it is written and then as many as its lines, six at most; kept by `utils/deviceNotes.ts`: trimmed, none when emptied); an end device or a server has the address of its first card there (`NicAddressFields`, the same fields as in the card), a switch its VLANs and how its ports are split (`ui/PortsOverview`, `utils/portSummary.ts`), a router or a firewall its ports in use. The other tabs: Porte (switch, router, firewall: `ui/PortGrid` and the port picked under it; the number of ports changes there) or Schede di rete (end devices), Rotte (router, firewall: `ui/RoutesPanel`, with the routing table the engine would read from the form), Regole (firewall: `ui/FirewallRulesPanel`, ordered rules), NAT (router, firewall: `ui/NatPanel`, a tick for each port that has an address and the ordered port forwards), DHCP (router, firewall, server: `ui/DhcpPanel`, a tick and the range for each interface that can serve, who was given which address and who was left without), DNS (server: `ui/DnsPanel`, the names it answers for). Routes, rules, forwards and DNS records are validated on save (`utils/networkConfigValidation.ts`; a record also as it is typed), pools in the panel of their port or card and again on save (`utils/dhcpLabels.ts`); a pool typed in the DHCP tab is checked as it is typed, kept trimmed on save, and not kept when its range was left empty. NAT and the DHCP server of an interface are one setting with two places to set it: the tab of the service and the panel of the port or card, both on the `ports`/`nics` of the form. A server switched on in the DHCP tab starts from `suggestedPool` of the engine. The window keeps the open tab itself (`TabContainer` with `activeTab`), so that a tab can send to another one: «Dagliene uno» opens the port that needs an address. The DNS server a card asks is a field of the card (`ui/NICConfigPanel`), the one a pool hands out a field of the pool (`ui/DhcpPoolFields`). The DHCP tab and the lease shown on a card are worked out from the form as it is, unsaved edits included. So is an address of the form that another device has too: a box over the tabs (`.inspector-address-conflict`) names the other devices (`conflictsOf` in `utils/addressConflicts.ts`), and the save is not refused
- **HelpModal** - The guide, in three tabs: how to use the app, the terminal commands (rendered from `COMMAND_REFERENCE`, the table the terminal's `help` prints, with a link to the terminal reference of the documentation), information
- **ExportImageModal** - The board as an image: preview, format (PNG, SVG), size, theme, title, background; save to a file or copy to the clipboard. It exists only while it is open, so every time it starts from the drawing and the theme on screen. See "The drawing as a picture" below
- **ConnectionInspectorModal** - Connection properties editor
- **SettingsModal** - App settings with tabbed interface. Its first tab, Rete (`NetworkSettingsTab`), holds the settings of the project: what a new device starts from (network, mask, gateway and, optional, the DNS server its card asks), saved together by the one button of the tab. Once a DNS server is saved, the tab counts the end devices of the canvas that ask nobody (`utils/defaultDns.ts`) and offers to write it on their first card addressed by hand, after a question. The group «VLAN del progetto» is the table of the names of the VLANs (`ui/VlanNamesTable`): the VLANs that have one and those the canvas uses without one (`vlansInUse`), a row added by hand for any other; what is wrong with a row (`vlanRowProblem`) is said under it and stops the save
- **BulkAddDeviceModal** - Bulk device creation with table-based interface
  - Two sections: Configurable Devices (Switch/Router/Firewall with portCount dropdown) + Standard Devices (PC/Server/Database with fixed 1 NIC)
  - A row is a template, told by its id. Several templates are of one type (seven are servers): the quantity of a row, its key and the devices it adds are of its template alone. Only the templates the app comes with are listed, not the user's own
  - ConfigurableDeviceRow: Dynamic rows with id, templateType, portCount, quantity
  - Auto-generation: the ports and the card the window that adds one gives (plain ports; a card with a MAC of its own)
  - Search filtering + custom scrollbar (react-custom-scrollbars-2, autoHeightMax: 500px)

### Project Modal
- **NewProjectModal** - sm (448px), minHeight 550px, fullWidth inputs, `.modal-error-box`. Creates a local project: name, description, network settings (the DNS server of new devices is optional, and refused when it is not an address)
- Opening and saving a project have no modal: they go through the file picker (`frontend/src/utils/projectFileAccess.ts`)

### UI Components
- **Modal / BaseModal** - The window every dialog is built on. Esc closes it as its X does (`ui/useEscapeToClose.ts`): whatever Esc can close is on one list while it is open, a single listener closes the last entry, so each press closes one thing, the one on top (the list of a searchable menu before its window, a window before the one under it). Whoever uses Esc for itself (an edit in place) marks the event with `preventDefault()`; a press that is marked is left alone, also by the presentation bar
- **ConfirmDialog** (`store/confirmStore.ts`) - A question with a yes and a no, asked in a window of the app: `askConfirm({ title, detail, confirmLabel, danger })` gives a promise of the answer. It lies over any other window; Esc and a click outside are a no. No source file calls the browser's `alert()`, `confirm()` or `prompt()` (a test scans for them). In tests, `test/confirm.ts` answers the questions and `await settled()` lets whoever asked go on
- **Button** - Lays what is inside it out in a row: an icon and its label stay on one line, with no styling of the icon by the caller
- **compact** (`ui/compact.tsx`, `ui/compactStyles.ts`) - The fields of a settings screen: `TextField`, `SelectField`, `CheckField`, `ReadOnlyField`, `TextAreaField` for a text of several lines (a small label over a low field, with its note and what is wrong under it) and `FieldRow`, a row of up to four. Used by the window of a device, by the window that adds one and by Impostazioni → Rete; `Input` and `Select` remain for the windows that ask one or two things
- **TabContainer** - Reusable tab system for modals. It keeps the open tab by itself, or shows the one it is given (`activeTab` with `onTabChange`) when the window has to send to one of its tabs
- **VLANInput** - Multi-value input with tag chips (range 1-4094)
- **The name of a VLAN** - A VLAN is a number in the data and for the engine; the project may give it a name (`GlobalNetworkSettings.vlans`). `utils/vlanNames.ts` writes a VLAN with its name (`vlanLabel`: `VLAN 10 «Uffici»`; `vlanShort`: `10 «Uffici»` in a list of numbers), and `utils/useVlanNames.ts` hands the names to the components that show a number: the summary of a switch (`PortsOverview`), the VLAN field of a port (`PortEditor`, the names under the field: the field holds numbers), what a port says under the pointer (`PortGrid`, `portVlanText`), the tags of `VLANInput`. The terminal, the reasons of the engine and the labels typed on cables keep the numbers
- **DeviceDrawing** - The drawing of a kind of device, at the size it is asked for (48 on the canvas, 24 to 40 in lists and windows), with the state its upper layer says
- **DrawingPicker** - The 24 drawings, to choose the one a custom template is shown with: a group of buttons, each named after the device the app shows with it
- **PortGrid** / **PortConfigPanel** - Port display grid + configuration panel
- **NICList** / **NICConfigPanel** - NIC list with custom scrollbar + configuration panel
- **Input/Select** - Compact form controls (`py-1.5`, 14 px text, a ring of the accent on focus)
- **Logo** - One of the four files of the logo, never drawn or typed: with the name or the symbol alone (`symbol`), in colour on a light page or negative on a dark one. The logo with the name is never asked narrower than 110 px (a test reads every use)

### Sidebar (`frontend/src/components/Sidebar/`)
- **Sidebar** - Six buttons. Each shows its name beside it under the pointer or the keyboard; the name is drawn on the page through a portal, because the panel a button opens covers the sidebar's own layer
- **SimulationPanel** - From, to, what, then the button that sends it. It proposes an exchange from the first PC of the drawing to its first server, and proposes again when what was chosen leaves the drawing
- **DevicePanel** - The device types to add, each with what it is under its name (`utils/templateText.ts`: a built-in template that is a kind of a type, a printer or an IoT gateway, says what it is and not what it is built on), and, under «Esempi», five sample networks (`utils/sample*.ts`). The first, `sampleCompany.ts`, is the one the welcome screen loads. The last, `sampleMultinational.ts`, is the network of a multinational in Italy, about two hundred devices on ten sites joined by an MPLS network, two of them also by a direct line with MPLS as backup: it is there to see how the app holds a drawing of that size, and its entry says how many devices it has, counted on the sample. Its answers are pinned by `sampleMultinational.test.ts`: what arrives, what is blocked and by which rule, what a cut line changes. A sample (`SampleNetwork`, `utils/sampleNetwork.ts`) is its drawing, its areas and the network settings of the project it is made for: `loadSample` in networkStore puts all three in place, every setting included (the network new devices start from and its gateway, the DNS server, a name for each VLAN in use, the mail `auto`), so that a device added afterwards is offered an address of its network. The question asked before a sample replaces a drawing says the settings go too; on an empty canvas nothing is asked. A sample is fitted to the window when it is loaded

### Explorer Panel (`frontend/src/components/Sidebar/ExplorerPanel.tsx`)
- Project name and description, editable in place (`components/ui/InlineEdit.tsx`); a hint shows when there are changes not yet saved to a file
- Canvases list: click to switch, create and rename in place, duplicate (`duplicateCanvas`), delete (not the last one), device count
- Buttons: "Salva su file", "Apri file…"

### Top Menu Bar (`frontend/src/components/Toolbar/TopMenuBar.tsx`)
- File Menu: Nuovo progetto…, Apri…, Salva (Ctrl+S), Salva con nome…, Esporta immagine…
- Modifica Menu: Annulla and Ripeti, each with its keys beside it (`.menu-entry-shortcut`: `Ctrl+Z`, `Ctrl+Y`; `⌘Z`, `⇧⌘Z` on a Mac) and, under the pointer, the step it would take back or do again («Annulla: elimina «PC-3»»); Copia, Incolla, Racchiudi in un riquadro
- Aiuto Menu: Guida, Tour guidato (the guided tour again, from its first step), Documentazione (the documentation in a new tab, `docsUrl` of `constants/links.ts`), Comandi del terminale, Mostra la schermata di benvenuto, Informazioni, Il sito di PixelCake
- In the middle of the bar, the project that is open: its name, the canvas on screen when there is more than one, a dot while there are changes not saved to a file. A click opens the Explorer
- No entry is there to announce a feature: an entry that cannot act (nothing selected to copy) is disabled only for as long as that is true
- Vista → «Pennarello» (a tick while it is in use), and its button before «Presenta» (`.marker-toggle`): see [The marker](#the-marker-pennarello)
- On the right, after «Presenta»: the language (`ui/LanguageSwitch.tsx`, two letters each, a `.segmented` control) and the theme

## Two languages (`frontend/src/i18n/`)

Every text a person can read or a screen reader can say is in two dictionaries, Italian and English, and changes at once when the language does. There is no translation library: a small typed layer of our own.

- `it/<namespace>.ts` is the source dictionary, one file for each part of the interface (`menu`, `inspector`, `dhcp`, `help`…), put together in `it/index.ts`. `en/<namespace>.ts` holds the same entries: each namespace is typed `Dictionary['<namespace>']` (`dictionary.ts`: `typeof it`), so a missing English entry, or one of another kind, does not compile.
- An entry is a text, or a function when the text carries values: `devices: (count: number) => …`. Plurals, gender and the order of the words are plain TypeScript, written apart in each language. A sentence is always one entry: it is never glued together in a component out of translated pieces.
- `numbers.ts`: a number of things is written as the language writes it, through `formatCount` (`Intl.NumberFormat`): «14.891» in Italian, "14,891" in English. A dictionary writes its counts through it, and a component that shows a count alone uses `t.common.count(n)`. Italian groups the digits from five on («4422», «14.891»), English from four ("4,422"). A number that names one thing (port 24, rule 3, VLAN 10, a row of a file) is not a count and is written as it is, and so are the terminal and the reasons of the engine, which are English and the same in both languages.
- `index.ts`: `useT()` gives a component the dictionary and draws it again when the language changes; `getT()` gives it to code outside React (a store, a utility, a notice) at the moment of the call. `useLanguage()`, `getLanguage()`, `setLanguage()`.
- `language.ts`: which language. At start-up, in this order: `?lang=it|en` in the address (taken, remembered, and removed from the address); the choice kept in `localStorage` under `pixelcake-language`; the languages of the browser in the order the user prefers them, the first one the interface speaks, English when it speaks none. Only a choice is remembered. `<html lang>` follows.
- `Rich.tsx`: a sentence with something inside it that the screen draws itself. Words between backticks are code; `<name>…</name>` and `<name/>` are pieces handed to the caller (a button in the middle of a sentence, a number in bold). What a person typed is handed over as a piece, never pasted into the text.
- `components/ui/LanguageSwitch.tsx`: the switch, on the menu bar and on the bar of the presentation (next to the theme on both), on the welcome screen and in Impostazioni → Aspetto. Each language is named in itself.

**What is not translated.** What a person wrote (names, notes, descriptions). What the engine says: reasons and notes are English in both languages, as is the whole terminal (commands, output, `help`); only the window around the terminal is in the dictionary. Technical names that are the same in the two languages (`Switch`, `VLAN`, `trust`, `1 Gbps`, the names of the built-in templates) stay in the source.

**Names the app gives** (a project without a name, a new canvas, a new area, the devices of a sample network, the description of a built-in connection type) are given in the language of that moment and are content afterwards: they do not change with the language. The built-in connection types are the one exception, because their description is stored with the templates: one that is still a built-in description, in either language, is shown in the language of the interface (`utils/templateText.ts`); one the user changed is shown as typed. A device made from a template is named after the template (`Web-Server-1`), the same in both languages.

**No text in a constant of a module.** A table of labels or a list of tabs written at the top of a file is frozen in the language the page was loaded in: it is built when it is drawn, or it is a function (`flowName(flow)`, `noLeaseLabel()`, `defaultProjectName()`). A `useMemo` whose result holds text made by a utility takes the language among its dependencies.

**To add a text:** write it in the Italian namespace of the screen and in the English one (the compiler asks for both), then use `t.namespace.entry` in the component or `getT().namespace.entry` outside React. A new part of the interface gets a new pair of files, added to the two `index.ts`.

**Tests.** They run in Italian (`test/setup.ts` makes the browser of the tests an Italian one, since jsdom presents itself as English), so the tests that look for Italian words did not change. On top of them:
- `i18n/language.test.ts`: first visit, the address, the remembered choice, `<html lang>`.
- `i18n/dictionaries.test.ts`: no English entry that is the Italian one again, no Italian in the English dictionary, the same pieces in a sentence in both languages, the glossary (a canvas is a board, «immagine» is an image, the way through a network is a path, a port is connected to its neighbour), and a guide that quotes only labels that controls really have.
- `i18n/plurals.test.ts`: every entry that takes a number of things, or a list of them, is called with none, one and two, in both languages, and must not say of one what it says of two («1 dispositivi») or of none what it says of one. Which entries take a number is read from the names of their values: a new name must be listed there as a number, a list or neither. The same entries are called with 14,891 things and must write «14.891» / "14,891", never 14891 (`i18n/numbers.test.ts` holds the helper itself).
- `i18n/hardcodedText.test.ts`: reads every source file and fails on Italian in a string, a template or JSX text outside `i18n/it/`. It knows Italian by its words (`test/italian.ts`): a list written by hand, and every word the Italian dictionary uses and the English one does not.
- `i18n/english.test.tsx`: the main screens drawn in Italian and switched to English while on screen; nothing Italian may be left in text, `title`, `placeholder`, `aria-label`, `alt`.
- `components/ui/LanguageSwitch.test.tsx`: the switch, what is on screen following it without being drawn from scratch, notices and questions made outside React.

**The two languages are written the same way**: short, plain, sentence case for every label (the style sheet draws the headings that are in capitals), an ellipsis as one character, a range with an en dash (1–4094), a name the app quotes in «guillemets» in Italian and in “curly quotes” in English (straight quotes are kept for what the user typed and for a name of the code). A notice of one sentence has no full stop; a hint under a field has one. The English is British. One word for one thing:

| Italian | English |
|---|---|
| canvas | board |
| disegno | drawing |
| dispositivo, dispositivo finale | device, end device |
| connessione | link (the thing drawn between two devices and edited; «Tipo di connessione»: link type) |
| cavo | cable (the physical thing: what a port has attached, what breaks in a presentation) |
| collegata a | connected to |
| porta, scheda di rete, interfaccia | port, network card (card), interface |
| scheda (of a window) | tab |
| la scheda di un dispositivo | the device window |
| rotta, rotta predefinita, rotta di riserva, prossimo salto | route, default route, backup route, next hop |
| regola, zona di sicurezza, politica delle zone | rule, security zone, zone policy |
| inoltro | port forward |
| intervallo; assegnare; indirizzo assegnato | range; hand out; leased address |
| Gateway consegnato, Server DNS consegnato | Gateway for clients, DNS server for clients ("hand out" stays as a verb in sentences) |
| guasto simulato; Simula un guasto; Ripara | simulated failure; Simulate a failure; Repair |
| domanda, risposta; Da, A; Partenza, Destinazione | question, answer; From, To; Source, Destination |
| percorso, strada; un'altra strada | path; another path |
| comunicazione, scambio; Tipo di traffico | exchange; Traffic type |
| domanda (to a DNS server) | query |
| rete di esempio; schermata di benvenuto | sample network; welcome screen |
| immagine | image |
| riquadro; riquadro di selezione | area; selection box |
| Esempi; Aggiungi in blocco | Samples; Bulk add |
| Elimina; Togli | Delete (the thing stops existing: a card, a row, a rule); Remove (it leaves a list and is still there: a VLAN on a port) |
| Explorer, Console, Import/Export, Template | the same |

## The look (`frontend/src/index.css`, `frontend/tailwind.config.js`)

The interface follows the site: flat surfaces, thin lines, one accent.

- **Every colour is a variable of the theme**, set for light in `:root` and for dark in `.dark` (the class is on `<html>`). No component names a colour of a fixed palette (`text-gray-500`, `dark:bg-…`) and none styles the dark theme apart: the variables change, the classes do not.
- **Each colour has one job.** `--text-color` on `--bg-canvas` is the page, and the button that goes on is a block of the first with the second written on it (`Button` `primary`, `.presentation-primary`, `.welcome-button.primary`, `.explorer-button-accent`). `--accent-color`, the orange of the logo in both themes, marks a state: selected, in focus, open, where the packet is; what is written on a fill of it takes `--on-accent`, never white. `--accent-text` (the slate, dark on white and light on black) is for links and for the icons of a list. `--secondary-color` is the slate itself: the end of a question. `--ok-color`, `--trunk-color` and `--danger-color` say that something works, is a trunk, is wrong.
- **Under the pointer** a row, a menu entry or an icon takes `--bg-hover`, a flat grey, and an outline takes the colour of the text. Nothing glows, slides or grows.
- **Corners** come from two sizes, `--radius` (4 px) and `--radius-small` (2 px); Tailwind's `rounded-*` are mapped to the same few values in `tailwind.config.js`. The frame of a device on the canvas keeps 3 px, the number the exported image repeats. **Shadows** are for what floats over the page: menus, windows, the note of a device.
- **Labels** (the title of a panel, a `legend`, the heading of a section) are small capitals with space between the letters, as on the site.
- **Typefaces**: Inter for the interface, JetBrains Mono for addresses and for the terminal, Caveat (one weight, 600) for the words written with the marker, all bundled (`@fontsource-variable/inter`, `@fontsource/jetbrains-mono`, `@fontsource/caveat`, imported in `main.tsx`). The exported image uses the typefaces of the computer instead: an SVG shown as an image cannot use the fonts of the page. The handwriting is the exception: an image with words of the marker carries its Latin letters inside it.
- **Devices are drawn, not boxed.** Each kind has a drawing of its own, made for the app (`assets/device-drawings`, 24 of them, data in `data/deviceDrawings.ts`): a flat silhouette in two layers with a cut between them, 48 px on the canvas, and the same drawing in every list, window and menu that names a kind of device. The lower layer is `--device-lower`, the upper one at rest `--device-upper`; the symbol on the layers and the cut take the colour of what is behind the drawing (`--device-ground`: the canvas, a menu, a window, the row under the pointer), so that they read as holes. One set of drawings serves both themes, and a drawing names nothing (no id): any number of them can be on a page (`ui/DeviceDrawing`).
- **The upper layer is the lamp of the device.** Its colour is the state, the same in light and in dark (`--state-*`): grey (`off`) for a device taken as broken in a presentation, red (`error`) for the device where the answer on screen stops, green (`ok`) for the one where it arrives, orange (`selected`) for a selected one, yellow (`warning`) for one whose first card waits for an address nobody gave it (the line under its name says «DHCP: nessun indirizzo»), or one with an address another device has too (the line under its name shows that address followed by «· in conflitto»; `conflictedAddress` in `utils/addressConflicts.ts`, from `useAddressConflicts`). When more than one is true, the first of that list is told (`deviceState` in `utils/deviceDrawing.ts`). Colour is never alone: a broken device has its mark and its faded texts, a selected one its frame in the accent, one waiting for an address says so under its name, and where an answer ends the frame shows in the colour of the lamp, with words for a screen reader («Qui arriva», «Qui si ferma»).
- **The terminal** keeps a dark pane in both themes, in the colours of the terminal shown on the site (`TerminalModal.tsx`).

Four test files keep it in one piece: `styleSheet.colours.test.ts` (no fixed palette, no variable without a value in both themes, one accent, nothing white on it), `utils/deviceGeometry.test.ts` (the numbers of a device are those of the style sheet), `utils/drawingImage.test.ts` (the image repeats the colours and the numbers of the style sheet, the colours of the states included) and `components/Canvas/NetworkCanvas.theme.test.tsx` (the panels React Flow draws follow the theme).

## Reusable CSS Classes (`frontend/src/index.css`)

| Category | Classes |
|----------|---------|
| Modal messages | `.modal-error-box`, `.modal-info-box` (a rule on the left, the words in the colour of the text) |
| A choice among a few | `.segmented` (buttons side by side, the chosen one `.active`) |
| Explorer | `.explorer-button`, `.explorer-button-accent`, `.explorer-button-dashed`, `.explorer-canvas-card` |
| NIC list | `.nic-list`, `.nic-card`, `.nic-card-selected` |
| Areas of the canvas | `.area-node` with `.area-<colour>`, `.area-label`, `.area-edge`, `.area-resize-handle`; `.area-colour-swatch` in the menu |

## Key Algorithms

### Network Engine (`frontend/src/engine/`)
Pure and deterministic: no React, no Zustand, no side effects; the same network
always gives the same answer. It follows one packet the way the network would
carry it, and it is used by the simulation panel and by the terminal alike.

The walk (`trace.ts`) alternates two steps until the destination answers or
something drops the packet:

1. **a layer 3 decision** at the device holding the packet: routing table
   lookup, then the firewall. Around it, a router or a firewall may
   translate the addresses of the packet (`nat.ts`): the destination
   before the lookup, the source after the firewall;
2. **a layer 2 delivery** to the address that decision chose (the destination
   itself, or a next hop), across switches.

Modules:

- `addressing.ts` — IPv4 arithmetic; the addressed interfaces of a device
  (`l3Interfaces`: ports and NICs with an IP, or the device-level address when
  none has one); the routing table (`routingTable`: connected networks, static
  routes, default gateway) and its lookup, longest prefix first.
- `firewall.ts` — `evaluateFirewall`: ordered rules (first match decides), then
  the zone policy. A firewall lets through the reply to a flow it saw itself
  (the reply carries the devices of its request, `Packet.requestPath`); to any
  other firewall it is a new packet. A router with rules filters the same
  way, without zones, and its list ends with an implicit deny: once it has an
  enabled rule, what no rule allows is blocked (`no rule allows it`); with
  none, or all of them switched off, it filters nothing. A rule naming a zone is
  skipped, with a note saying why, when the link is not on a port or the
  port is in no zone.
- `nat.ts` — address translation. Source NAT on a port (`doesNat`,
  `natAddress`), port forwards (`matchForward`, `publications`), which
  addresses are private (`isPrivateAddress`), and what a NAT device
  remembers of a flow (`NatTranslation`), handed from a request to its reply.
- `dhcp.ts` — which address every card set to DHCP has (`resolveDhcp`). A
  lease is not remembered: it is worked out from the drawing. A card is
  served by a pool (`dhcpServer` on a router or firewall port, or on a card
  of a server) whose interface hears its broadcast (`broadcastReach` in
  `l2.ts`: the same search that delivers a frame); cards are served in
  drawing order, each gets the lowest address nobody has. The result carries
  the leases, the cards left without and why, the pools, and the drawing
  with the leases filled in (`withLeases`), which is what `trace.ts`,
  `flows.ts` and `impact.ts` read: the rest of the engine does not know an
  address was leased. Simulated failures are not read. The result is kept by
  the identity of the two lists of the drawing.
- `vlan.ts` — how a switch port treats frames (`portVlanMode`: access or
  trunk). A switch is VLAN-aware once one of its ports has a VLAN; the others
  are then access ports in VLAN 1.
- `l2.ts` — the delivery step: a breadth-first search, in connection order,
  for the device that answers for an address, crossing bridges VLAN by VLAN,
  routers and firewalls without interface addresses (transparent; a firewall
  still applies its policy) and devices that are not simulated (Internet
  symbol, load balancer). A Cloud symbol named Internet (`isPublicInternet`)
  refuses a packet with a private source or destination. The shortest path
  that works is the one taken. When
  nobody answers, `explain` picks the most useful reason: what happened on the
  cables of the way to the device that should have answered.
- `conflicts.ts` — addresses in conflict (`addressConflicts`, `conflictOf`):
  an address written by hand on two devices that can meet. A public address
  meets everywhere; a private one does not across the Internet symbols (all
  of them one Internet), which carry no private address; devices not cabled
  together at all are one network. A switched-off interface, a lease (DHCP
  hands out only free addresses), 0.0.0.0 and loopback addresses do not
  count. Kept by the identity of the two lists of the drawing, as the leases.
  `trace.ts` ends a question to or from an address in conflict, and a port
  forward to one, with the reason (`conflictReason`).
- `trace.ts` — the walk itself, loop detection, and the notes: whatever is not
  verified (a link end not on a port, a router without interface addresses,
  a Cloud symbol) is reported as a note, never as a silent success. A packet
  addressed to a NAT device is sent on to whom the device stands for (the
  server a forward publishes, the sender of a flow it translated); the
  result carries the addresses as sent and as they ended up
  (`seenSourceIp`, `reachedIp`) and the translations made on the way.
- `flows.ts` — request/reply plans per flow model (ping, web, download, email)
  and the service each leg is to a firewall. A reply leg is the return traffic
  of an allowed flow, sent back to the address the request came from, with
  the devices the request crossed (for the firewalls). A device pings itself
  without the packet leaving it. Cloud email leaves by the nearest internet
  exit: an Internet or Cloud symbol, or a device named with one of the words
  Internet, Cloud, WAN, ISP on its own. The
  result carries the devices to animate and the cable of each stretch
  (`animationPath`, `animationLinks`).
- `dns.ts` — a name in place of an address (`lookup`). Nothing is
  remembered: a name is looked up each time a question uses it. A server
  answers for the records written on it (`dnsRecords`); a device asks the
  DNS server of its first enabled card that names one (`dns` on the card,
  written by hand or filled in with the lease by `dhcp.ts`). The lookup is a
  round trip planned by `flows.ts` (`planRoundTrip`, the same plan as a
  ping) for the service `dns`, so `trace.ts`, the firewall, NAT and
  simulated failures all apply; only when both legs arrive is the record
  read. The result carries the address or the reason, the device that
  answered and the trip. Names are resolved by the terminal alone: the
  simulation panel and the presentation choose devices from menus.
- `failures.ts` — "what if this breaks": a topology can carry `failures`
  (devices that are down, cables that are cut). `l2.ts` finds nothing
  travelling through them and goes round when the drawing offers another path;
  `trace.ts` withdraws a route whose interface has no working cable left
  (`deadInterfaces`: cut, the device at the other end down, or the interface
  at the other end switched off, which is not a failure but takes the line
  down for both ends) and takes the next one for that destination, with a
  note. A route whose next hop is on none of the device's networks is passed
  over the same way.
  A network the device is attached to is not looked for elsewhere: the broken
  link is the answer.
- `impact.ts` — every exchange between two end devices evaluated with and
  without the failures, and compared: broken, rerouted (other cables),
  unchanged. Exchanges that did not work to begin with are not counted.
  `flowPairs` and `evaluateFlowInto` let a caller evaluate the pairs a few at
  a time (`utils/impactMemo.ts`).
- `memo.ts` — what does not change from one pair to the next (the cables of
  each device, the devices by id, the routing table of a device, the hop
  distances from a device, the dead interfaces under a set of failures) is
  worked out once for a whole set of questions, inside `withMemo(memo, work)`.
  A table is keyed by the very objects it was made from: the list of devices,
  the list of connections, the failures, the device. The stores never change
  those in place, so a drawing that changed, or another set of failures, finds
  nothing it could take for its own. Outside `withMemo` nothing is kept: a
  single question always reads the drawing as it is. `memo.test.ts` holds a
  test for each way a table could go stale (an address edited, a cable added
  or cut, a port disabled, a rule added, a failure added and taken away), and
  `everyAnswer.test.ts` pins a digest of every answer of the samples (every
  ordered pair of end devices, every kind of exchange, with and without
  failures), which the memo did not change.
- `interfaces.ts` — every link end is attached to one interface of its device
  (a port or a NIC). Owns the binding rules: first free interface on creation,
  migration of old unbound data on load (`normalizeBindings`), cleanup when a
  port/NIC is removed. A firewall with security zones is never bound
  automatically: the user picks the port, and with it the zone.
- `topology.ts` — what a device does with traffic that is not for it
  (`forwardingRole`: router, bridge, passthrough, host); name and address
  resolution for the terminal; `mirrorPrimaryNic`: on a device with NICs the
  device-level ip/subnet/gateway are a mirror of the first NIC, kept in step
  by the store; `normalizeAddressing`: the mirror, and a card on DHCP kept
  without an address of its own. The store applies it to every device that
  comes in, so a leased address can never be read as one written by hand.

Tolerance for old data is a design rule, not an accident: a router whose ports
carry no address still lets traffic through (with a note), so a drawing made
before routing existed gives the answers it gave.

### Terminal (`frontend/src/terminal/`)
- `parser.ts` — pure: one input line → a `Command` (`types.ts`). Device names
  are returned as typed; a command that cannot be parsed comes back as
  `unknown` with the form it should have had.
- `executor.ts` — the only terminal layer that touches the stores: it resolves
  names, calls the engine and the same store actions the canvas uses, and
  returns lines to print. `COMMAND_REFERENCE` is the table behind `help` and
  behind the guide.
- The language is specified in `docs/terminal-commands.md`; a test parses every
  example of that document, and its DHCP and DNS sessions, fenced as
  ```` ```ncl ````, are run like every terminal example of the documentation
  (see [Documentation](#documentation-documentation)). The version of the
  language is `NCL_VERSION` in `types.ts`: the banner of `help` reads it, and
  a test holds the title of the document to it. The last line of `help` is the
  address of the terminal reference (`REFERENCE_URL`), a page a test holds it to.
- A command that changes the drawing is one step of undo, like any edit
  (see historyStore). A device that leaves the board while the terminal is in
  its context (deleted, or taken back by an undo) takes the context with it:
  `TerminalModal` says so and the prompt is `pixelcake>` again.
- Commands that only read (`show`, `ping`, `trace`…) look at the drawing with
  its leases filled in; commands that write work on the drawing as it is
  kept, so that a leased address is never written back.
- A target that is neither a device nor an address, and reads as a host
  name, is looked up from the source first (`resolveEnds`). The lookup and
  the flow are one animation: `LiveTrace.lookup` says how many stretches of
  the path belong to the lookup and what to print when the packet is back
  from it, and `TerminalModal` prints the hops of the flow after that.

### The drawing as an image (`frontend/src/utils/drawingImage.ts`)

The image is not taken from the screen: the board is drawn again as one SVG
document from the same data. That is what lets it be whole whatever the zoom,
light or dark whatever the theme, a vector file, and a sharp PNG of any size.

- `drawingImage.ts` — no React, no DOM, and no store but the language (the
  two words it writes on the ends of a question come from the dictionary at
  the moment of the call). `layoutDrawing()`
  places areas, devices and cables in canvas coordinates; `renderDrawingImage()`
  writes the document, with an optional title above and caption below. The
  caller gives a way to measure text: every device has the frame it has on the
  canvas (`deviceSize`), and nothing is read from the screen.
- A device is drawn as on the canvas: its drawing (`drawingMarkup` of
  `utils/deviceDrawing.ts`: the shapes three times, whole, through the window
  of the upper layer, through the one of the cut, with the colours of the
  theme asked for written in), its name and its address with the canvas
  behind them, no box. Its upper layer is the lamp of its state, as on the
  canvas: those of the presentation while presenting, and outside it the
  answer left on the canvas and the devices waiting for an address; where an
  answer ends the frame is drawn in the colour of the lamp. The two windows of
  each drawing (`<clipPath>`, `drawingWindows`) are kept once in the `<defs>`
  of the document, named after the drawing.
- A cable is the path the screen draws: `getSmoothStepPath` between the same
  two points, where it ends on each device (`cableEnd`).
- The numbers of a device are those of the canvas (`utils/deviceGeometry.ts`);
  those of a cable, a label and an area, and the colours of the two themes
  (the layers of a drawing and the states included), are repeated from
  `index.css`. A test reads the style sheet
  and fails when they drift apart. The colours of presentation mode
  (`MARK_COLORS`) are shared with `CustomEdge`; the two colours of a question
  and of what is written on them (`ACCENTS`) are the `--accent-color`,
  `--secondary-color`, `--on-accent` and `--on-secondary` of the theme.
- Everything the user typed is written as text (`escapeXml`); nothing a
  template says (its icon, its colour) is copied in. The only ids are those
  of the windows of the drawings. The document refers to nothing outside
  itself.
- `drawingMeasure.ts` — what is asked of the browser: text widths from a
  canvas, and the size of each device on screen (`.react-flow__node[data-id]`),
  which an area drawn around devices needs.
- `imageExport.ts` — the ways out. `rasterizeSvg()` paints the document on a
  canvas of the pixels it declares (`scaledSvg`); `fitScale()` keeps a PNG
  within what browsers can paint. Saving asks where with the File System
  Access API and downloads elsewhere; copying puts a PNG on the clipboard.
  The PNG is made when the choices are made, not at the click: a browser lets
  a page save or copy only straight from the click.
- While presenting, the dialog hands over the marks of the presentation
  (`DrawingMarks`) and asks the engine the questions of the panel again for
  the caption (`captionOf` in `utils/presentation.ts`).

### Automatic layout (`frontend/src/utils/autoLayout.ts`, `layoutRoom.ts`)
Vista → «Disposizione automatica» → «Verticale» / «Orizzontale» (`arrangeDrawing(input, 'TB' | 'LR', templates)`). The menu asks first (`askConfirm`): every device is moved (one step, which Modifica → Annulla takes back); afterwards the view is fitted to the drawing.
- **Levels from the network** (`networkLevels`). In each group of devices cabled together the top is where its traffic leaves: its clouds; without one, its firewalls; then its routers; then the switch with the most cables (or, with no switch, the device with the most). When some routers or firewalls are cabled only to routers, firewalls and clouds (the backup router between two sites), those alone are the top. A device is one level lower for each cable from the nearest top; a device with no cable has no level.
- **Every cable from its upper end down**, whichever end it was drawn from (dagre's `minlen` is the difference of the levels). A cable between two devices of one level is not given to dagre: with a `minlen` of 0 its ranker puts one end a rank under the other, and the other rankers fail on it. Each end stays on its level, held there by its cable to the level above, and the two are side by side.
- **Areas are groups of the layout** (dagre compound graph). A device belongs to the smallest area that holds it, an area to the smallest area around it. Each area is drawn again around what it holds, with the margins of «Racchiudi in un riquadro» (`areaAround`), the inner ones first, whether areas are shown or hidden. Devices with no cable (and in no area) are put in rows under the rest, and areas with no device under them, as large as they were.
- **Room for what is written.** A device takes the width of its name and address where wider than its frame, so that names count in a horizontal layout. The sides a cable ends on face each other across the levels, or side by side, as the bands and `cableRun` expect; a second and a third cable between the same two devices go round on the left and on the right (on top and below, horizontally). `layoutRoom.makeRoom()` then measures the drawing as the board draws it (`layoutDrawing`) and opens a gap wherever a cable label lies on an area's border or name, on a device or on another label, two devices touch or two areas cross.
- **Three cables or more between two devices** (a router and its switch, one for each VLAN): one goes straight, two go round either side, close to it; in line, the label of the straight one would be on theirs, so the lower device is set aside by the width of a label.
- **A large drawing** is laid out plainly first. When that could not be seen whole (fitted to a window of 1568 × 779 it would be drawn at less than a quarter of its size, `COMB.zoom`), three other ways are tried and the one seen largest is kept. *The leaves stacked*: the devices cabled to one device alone, a level under it, in its area, three or more, stacked in a comb in the room of one node of dagre, two columns either side of the line their cables share (two rows, horizontally), the second half a row on, so that the labels on the line are never side by side. *Around the top*: with one top, in no area, half of what hangs from it under it and the other half over it, laid the other way round (`BT`, `RL`), an outermost area going whole with its devices, the two halves holding as many devices as can be; every cable from the top turns in the band around it. *Both*. On the multinational (181 devices) the plain layout is 17,878 × 1,544 and could only be seen at 0.07, under the least zoom of the board (0.1); stacked and around its MPLS network it is about 10,500 × 4,300 vertically and 9,300 × 4,700 horizontally, seen at 0.12 and more. The four small samples are laid out as before.
- **In steps** (`arrangeInSteps`, a generator; `arrangeDrawing` runs it through): it stops before each of the other ways and before the room is made, and the store's `applyAutoLayout` waits a turn of the page (`setTimeout` 0) at each stop, so that the page draws and answers in between. A drawing seen whole laid out plainly has no stop: it is laid out in the call. A drawing changed in the meantime is left as it is. The menu, after the answer, also waits a turn before it starts, so that the page draws the question gone. On the multinational, about a second in all from the answer to the drawing laid out, as before; but before, it was one task, the question still on the screen and the page frozen. Now the question is drawn gone within 15 ms, and the longest the page goes without drawing is the plain layout, 0.2 to 0.5 s as the machine is loaded, each other step 0.06 to 0.24 s (the built app in Chrome, on the machine of the tests). Nearly all of it is dagre (and lodash, which it uses).
- There is no layout by subnet: routers and firewalls are on several networks, and the areas already group what belongs together.

### Automatic connection (`frontend/src/utils/autoConnect.ts`)
Vista → «Collega i dispositivi senza cavo» (`connectLooseDevices(devices, connections, counter)`): the cables to add, bound to their interfaces, and the devices left alone with the reason. Pure; the store adds the cables, the menu says what happened.
- **Only what has no cable gets one.** An end device goes to the nearest switch of its network; an access point is one of them, and is cabled before the devices on its Wi-Fi. A laptop, a smartphone or a tablet goes first to the nearest access point of its network with a radio card free.
- **A group with no way up gets one cable up.** A group of devices cabled together with no router, firewall or Internet: an access point with only its Wi-Fi devices goes to a switch; a group with switches, from its switch nearest to a router, a firewall or a core switch (one cabled to a router or a firewall) of its network. Every cable added joins two groups, so none closes a loop.
- **The network of a device** is that of its addresses. A switch is on the networks of what is cabled to it (end devices, router ports) and of the VLANs set on its ports, known by the cables of the drawing that join a port in a VLAN to an address; while one of its VLANs is unknown it may be on others too. A switch with VLANs and nothing else to go by may be on any (its own address is the one it is managed at); one without VLANs is on the network of its own address. A device on DHCP goes by distance alone.
- **A port meant for it.** On a switch, a port in the VLAN of the device's network, or one with nothing set on it, never one in another network's VLAN: the first such port for an end device, the trunk or the last free port for an uplink. A device on DHCP, with no network to tell, takes a port in the VLAN of the devices of its kind (its template) on that switch, else in a VLAN that hands out addresses (a router port with a range, or a DHCP server, in it), else one with nothing set. The ports given in one go follow the devices as they stand, from the left in a row, from the top in a column. On a router or a firewall, a port with an address on the switch's network or one with none, never another network's gateway. A firewall whose ports carry zones gets its cable with its end not bound (`requiresExplicitBinding`).
- **A VLAN is a network for a group of switches** (those cabled to one another): the multinational numbers its VLANs the same on every site, each site with its own networks. A group of switches with no way up goes first to a place known to share a network with it, then to one that only may, nearest first.
- **Load balancers**: a server goes first to a load balancer of its network, with a card free, that has servers of its kind behind it; a load balancer with only its servers goes up to a switch, as an access point with only its Wi-Fi devices does. A load balancer with no address of its own (it passes its servers' traffic) is on the networks of the servers behind it.
- **Areas say the site** (`connectLooseDevices(devices, connections, counter, areas)`, the store passes them): among the places a device can go, those in its smallest area come first, then those in its outermost area, then the rest, the nearest first in each; a load balancer or an access point before a switch only within one of those tiers. A device on DHCP of one site, drawn nearer to a switch of another, goes to its own.
- **A port named after a device** (its name as written, case and spaces at the ends aside) says where that device is cabled: of the places of its network, one with such a port free and in service goes first, before its area and its distance, and the port is taken before any other of the place, and kept when the ports given are put in the order of the devices; a port named after another device on the board is kept for that one, taken last. The samples name their switch ports so: on the two sites, the file server cut from «SW-Core» and moved next to the switch of floor 2 goes back to port 1 of «SW-Core», named after it, and not to port 1 of the floor switch, named after the PC of that floor.
- **Sides of a new cable**: those the cable of its nearest neighbour ends on (another end device cabled to the same switch, on the same side of it, nearer to it than the switch is), so that in a stack laid out by the automatic layout it goes down into the line the others share; with none, facing each other from the upper device.
- **Never automatic**: routers and firewalls between themselves, the Internet, end devices between themselves; no cable gets a name. Cables are `access` (to an end device), `uplink` (to a router or a firewall), `trunk` (between switches).
- **Reasons** (`LeftAloneReason`): `noSwitch` (no switch, nor access point, of its network), `noUplink` (a switch with no cable and nowhere to go up to), `noFreePort`, `byHand` (a router, a firewall or the Internet with no cable). A switch with its devices and nowhere to go up to is as it was drawn, and is not said.
- Tested rule by rule, and on the five samples with one cable taken away at a time (the 194 of the multinational included): each comes back where it was drawn, or to a nearer switch of its network, unless it is one never drawn automatically or its two ends are still reached another way (`utils/autoConnect.test.ts`).

### Connection Cleanup (`frontend/src/utils/cleanupConnections.ts`)
- Duplicate detection on localStorage load
- Counter rebuild from existing connections
- Real-time duplicate ID prevention

### IP Management (`frontend/src/utils/ipHelpers.ts`)
- Auto-assign available IPs within subnet range
- `generateMacAddress()` - locally administered unicast (02:XX:XX:XX:XX:XX)
- `isValidMAC()` - MAC address format validation

### Particle Edge Animation (`frontend/src/components/Canvas/ParticleEdge.tsx`)
- Wrapper pattern: CustomEdge + particle layer (zero impact on existing rendering)
- CSS offset-path with GPU-accelerated transforms for 60fps
- 3 CSS animations: `@keyframes flow`, `fade`, `particle-glow`
- Defaults: 10 particles, 3s duration, 3.5px radius, bright blue
- Configurable per connection: particleCount, particleSpeed, particleSize, color
- Edge type switching via `particleAnimationEnabled`

### A new device (`frontend/src/utils/newDevice.ts`)
- What a new device starts with, whichever window makes it. Pure. AddDeviceModal and `bulkAddDevices` both ask here, so that a device made alone and one made in bulk cannot drift apart
- `newDeviceName(templateName, devices)` - The name of the template, with a dash for each space, and a number: the lowest, from 1, for which no device of the canvas has that name (`PC-1`, `Web-Server-2`). The number is not a count: after a deletion the name that was freed is given again, and never one that is taken. A name is taken whatever the template of the device that has it and whatever its case, compared as the terminal compares names (`resolveEndpoint`: trimmed, case-insensitive), since the terminal finds a device by its name. In AddDeviceModal it is a proposal, shown in a field. Nothing that is on the canvas is ever renamed: a drawing made before keeps its `PC-0`
- `isNameTaken(name, devices, exceptId?)` - The one rule for a name already taken, compared as `newDeviceName` compares. AddDeviceModal and the «Generale» tab of InspectorModal say it under the name field and add or save nothing while it holds
- Where a device added by itself goes: `newDeviceSpot` of `utils/viewPlace.ts`, the first free place of what is on screen, row by row from its top left, on the grid of the board (`placeInView` of `utils/placeDevice.ts`, multiples of `NEW_DEVICE_STEP`), clear of a margin of 24 pixels, of the side panel that is open, of the small map and of the zoom buttons. With no free place in view, the nearest free one to its middle (`firstFreePlace`), and the window brings the view to it
- `newDevicePorts(portCount, deviceType)` - The ports of a new switch, router or firewall: numbered from 1, each on and at `speed: 'auto'`, `portType` `lan` on a router or a firewall and `access` on a switch (or any other device with ports). Nothing else: no VLAN, PoE, NAT, zone or IPS, because the engine applies them for real and they are for whoever configures the device to choose. So a switch made in either window is not VLAN-aware, a router does no NAT, and a cable goes on any free port of a firewall

### Bulk Device Helpers (`frontend/src/utils/bulkDeviceHelpers.ts`)
- `bulkAddDevices(rows, quantities, …)` - every device is made from the template of its row, found by its id, and says so (`templateId`: the canvas takes its drawing, and the windows its capabilities, from there)
- Ports: `newDevicePorts` of `utils/newDevice.ts`, as many as the row says
- A new router or firewall gets no gateway (on a router the gateway is its default route); switches and end devices get the one of the project
- `generateDefaultNIC(ip, subnet, gateway, dns?)` - Auto MAC, eth0, auto speed; the DNS server of the project when it has one. It is the card AddDeviceModal starts from
- Naming: `newDeviceName` of `utils/newDevice.ts` (see [A new device](#a-new-device-frontendsrcutilsnewdevicets)), asked again for each device with those just made in the list: a row of three takes three free names
- Places: `gridPlaces` of `utils/placeDevice.ts`, from the place it is given: rows with as many columns as rows or one more, 160 across and 130 down (`NEW_DEVICE_STEP`: the frame of a device and a name that runs out of it), nothing at random, a cell a device is already on skipped. BulkAddDeviceModal gives the place the window that adds one device would use (`newDeviceSpot` of `utils/viewPlace.ts`), then selects the new devices and, when they do not all fit in what is on screen, asks the canvas to show them (`triggerFitView(ids)`: those devices, without zooming in)
- IP assignment: `findNextAvailableIP()` of `ipHelpers`, the one AddDeviceModal uses: the first free address of the network of the project, from .2
- A device made here is the one AddDeviceModal makes from the same template (`BulkAddDeviceModal.same.test.tsx` compares the two, template by template, and the ports for every number of ports offered), but for its place, on the grid

## Data Types

### FlowMap (Central Schema)
```typescript
interface FlowMap {
  meta: { name, version, created?, modified? }
  nodes: NetworkDevice[]
  edges: NetworkConnection[]
}
```

### GlobalNetworkSettings
The settings of a project (`networkStore.globalNetworkSettings`, `settings` in the project file), set in Impostazioni → Rete.
- `ipClass, subnet, gateway` - The network a new device is proposed an address in, its mask and its gateway
- `dns?: string` - The DNS server written on the card of a new end device (the window that adds one, bulk add). An end device is what the engine calls a host (`forwardingRole`): not a router, a firewall or a switch, which have no card, nor an access point, a load balancer or a Cloud symbol, which have one. Changing it never touches the devices that are there
- `emailMode?: 'auto' | 'internal' | 'cloud'` - How the email flow travels
- `vlans?: ProjectVlan[]` - The VLANs that were given a name: `{ id, name }`, lowest number first, one for a number, names of 32 characters at most; absent when none has one

### NetworkDevice
- Basic: `id, type, label, ip, subnet, gateway, vendor, location, position`
- `notes?: string` - Free text about the device, of one or more lines (`\n`). Trimmed, and absent when there is none. It travels wherever the device does: project file, YAML (`notes`, always one quoted line), copy and paste; the terminal prints it in `show config`
- `templateId?: string` - Specific template ID (e.g., 'tpl-mailserver')
- `vlan?: number[]` - VLAN IDs (1-4094)
- `stp?: { enabled, mode, priority }` - STP configuration (kept as documentation: the engine does not simulate it, and the Inspector says so)
- `portCount?, ports?: Port[]` - Network ports (Switch/Router/Firewall)
- `nics?: NetworkInterfaceCard[]` - NICs for end devices
- `routes?: StaticRoute[]` - Static routes (Router/Firewall): `{ id, destination, nextHop, description? }`, destination in CIDR form. `gateway` is the default route
- `firewallRules?: FirewallRule[]` - Ordered rules (Firewall): `{ id, action: 'allow'|'deny', service: 'any'|'ping'|'web'|'email'|'dns', source, destination, enabled?, description? }`; source and destination are `any`, a zone, an address or a network
- `portForwards?: PortForward[]` - Ordered port forwards (Router/Firewall): `{ id, service: 'any'|'ping'|'web'|'email'|'dns', port, to, enabled?, description? }`; what arrives for the address of `port`, for the service, is sent on to `to`. Source NAT is the `nat` flag of each port
- DHCP is kept on the interfaces: `dhcp?: boolean` on a NIC (the card takes its address from a server, and keeps none of its own: `normalizeAddressing` empties it whenever a device enters the store), `dhcpServer?: { start, end, gateway?, dns? }` on a router or firewall port and on a NIC of a server (the pool it hands out to its network, with the DNS server it names). A lease is never stored
- `dnsRecords?: DnsRecord[]` - The names a server answers for as a DNS server: `{ id, name, address }`, a name being a host name with at least one dot, kept in lower case. Which server a device asks is on its NICs (`dns`). What a name resolved to is never stored

### Port
```
id: number, enabled: boolean, speed: '10M'|'100M'|'1G'|'2.5G'|'10G'|'auto',
portType?: 'access'|'trunk'|'hybrid'|'wan'|'lan'|'dmz',
vlan?: number|number[], poe?: boolean, securityZone?: string, description?: string,
ip?: string, subnet?: string,  // L3 address of a router/firewall port
nat?: boolean,                 // source NAT (router, firewall)
dhcpServer?: { start, end, gateway?, dns? }   // DHCP pool for the network of the port
```

### NetworkInterfaceCard
```
id: string, name: string, enabled: boolean, speed: string,
ip: string, subnet: string, gateway: string, mac?: string, description?: string,
dns?: string,                           // the DNS server the card asks (not on a card on DHCP: it comes with the lease)
dhcp?: boolean,                         // address from a DHCP server (ip/subnet/gateway then empty)
dhcpServer?: { start, end, gateway?, dns? }   // DHCP pool, on a card of a server
```

### CanvasMark
- `id` (`mark-N`), `kind` (`pen`, `text`, `arrow`, `ellipse`, `tick`, `cross`), `color` (`accent`, `red`, `green`, `ink`), `width` (`thin`, `thick`: the line, or the size of words), `points` (flat `x, y, …` in canvas coordinates: every point of a line; tail and tip of an arrow; two corners of the box of a ring, a tick, a cross; the top left of words), `text` (words only, 300 characters at most), `seed` (the wobble)

### CanvasArea
- `id` (`area-N`), `label` (one line, 40 characters at most, may be empty), `color` (one of `AREA_COLOURS`), `position: { x, y }`, `size: { width, height }` (120 by 80 at least)

### NetworkConnection
- Basic: `id, source, target, sourceHandle, targetHandle, type, bandwidth, label, color`
- Interface binding, one per end: `sourcePort?/targetPort?: number` (a `Port.id`)
  or `sourceNic?/targetNic?: string` (a NIC id). Never both on the same end.
  In YAML: `source_port`, `target_port`, `source_nic`, `target_nic` (NIC name);
  devices also carry `template_id`, ports carry `ip`/`subnet`.
- `vlan?: number[]` - Tagged VLANs
- `stpPortState?, stpPortPriority?`

### DeviceTemplate
- Basic: `id, name, type, icon, color, terraformFields, isCustom`
- `icon` names the drawing the device is shown with, one of the 24 of `data/deviceDrawings.ts`. A template made before the drawings has the name of an Iconify icon there: it is shown with its own drawing when the app comes with it, else with the one of its base type (`drawingOf`), and keeps what it has until it is edited. `color` is kept, and no longer shown
- Capabilities: `supportsVLAN, supportsSTP, supportsPorts, supportsNICs`
- `defaultPortCount?, portOptions?`

## Device Templates (24 total)

Each is shown with its own drawing (`DRAWING_OF_TEMPLATE` in `utils/deviceDrawing.ts`; the file of the drawing in `assets/device-drawings` is named after it).

### Base Types (9)
| Template | ID | Drawing | Features |
|----------|----|---------|----------|
| PC | tpl-pc | pc | NICs |
| Switch | tpl-switch | switch | Ports |
| Router | tpl-router | router | Ports |
| Server | tpl-server | server | NICs |
| Firewall | tpl-firewall | firewall | Ports |
| AccessPoint | tpl-accesspoint | access-point | NICs |
| LoadBalancer | tpl-loadbalancer | load-balancer | NICs |
| Database | tpl-database | database | NICs |
| Cloud | tpl-cloud | cloud | NICs |

### Specialized Templates (15)
| Template | ID | Base | Drawing |
|----------|----|------|---------|
| Mail Server | tpl-mailserver | Server | server-mail |
| VPS | tpl-vps | Server | server-vps |
| Web Server | tpl-webserver | Server | server-web |
| Proxy Server | tpl-proxy | Server | server-proxy |
| DNS Server | tpl-dnsserver | Server | server-dns |
| DHCP Server | tpl-dhcpserver | Server | server-dhcp |
| Storage S3 | tpl-storage-s3 | Database | storage-s3 |
| NAS | tpl-nas | Database | nas |
| IoT Gateway | tpl-iotgateway | AccessPoint | iot |
| IP Camera | tpl-ipcamera | PC | telecamera-ip |
| Printer | tpl-printer | PC | stampante |
| Laptop | tpl-laptop | PC | laptop |
| Smartphone | tpl-smartphone | PC | smartphone |
| Tablet | tpl-tablet | PC | tablet |
| IP Phone | tpl-ipphone | PC | telefono-ip |

The last four are end devices with one network card, as the printer is.

### Connection Templates (5)
| Type | Style | Use |
|------|-------|-----|
| trunk | Solid | Switch-to-switch |
| access | Solid | End device connections |
| uplink | Solid | Core/internet |
| backbone | Thick solid | Critical infrastructure |
| MPLS (conn-mpls) | Dashed green (`12 6`) | WAN connections |

## Projects and files

PixelCake has no server. A project lives in the browser while you work and is saved as a file.

### In the browser
- `pixelcake-network-v2`: the canvas on screen (networkStore)
- `pixelcake-project-v1`: project name, description and every canvas (projectStore)
- `pixelcake-templates-v8`: device and connection templates
- `pixelcake-ui-v1`: light or dark
- `pixelcake-language`: `it` or `en`, once the user has chosen (the switch, or `?lang=` in the address)
- `pixelcake-tour-seen`, `pixelcake-first-try-seen`: the guided tour and the first question of a sample have been shown (see [The first steps of a visitor](#the-first-steps-of-a-visitor-frontendsrccomponentsguide))
- Every change is written at once: closing the tab loses nothing
- A write that fails (storage full) does not crash the app: `utils/safeStorage.ts` shows one message asking to save the project to a file
- Two tabs open on the same project do not see each other: the last one to write wins. The canvas id kept next to the canvas data prevents one canvas from being shown as another, not the loss of the other tab's edits

### On disk (`.pixelcake.json`)
- Format reference: [docs/project-file.md](docs/project-file.md)
- `utils/projectFile.ts` (pure, but for the language its messages are written in): `serializeProject()`, `parseProjectFile()`. The parser never throws: it returns the project with the list of repairs it made, or a message for the user
- `utils/projectFileAccess.ts`: save, save as, open, new project, Ctrl+S. With the File System Access API (Chrome, Edge) the file is written in place and remembered for the session; elsewhere saving downloads the file and opening uses a file input. The API is looked up at every call, never at import

### Data flow
```
Edit           -> networkStore -> localStorage (at once), hasUnsavedChanges = true
Switch canvas  -> projectStore commits the canvas on screen, then loads the other one
Save           -> projectStore.buildProjectFile() -> serializeProject() -> file, hasUnsavedChanges = false
Open           -> file -> parseProjectFile() -> projectStore.loadProject() -> networkStore.replaceCanvas(), history cleared
Undo, redo     -> historyStore puts the board back -> networkStore -> localStorage, hasUnsavedChanges = true
```

### Icons and what travels with them
- The devices are not drawn with icons: see [The look](#the-look-frontendsrcindexcss-frontendtailwindconfigjs)
- The icons of the interface are shipped with the app: `scripts/bundle-icons.mjs` (`pnpm icons:bundle`, which needs the network) collects them into `src/data/bundledIcons.ts` (two sets, Material Design Icons and Lucide, with what each says of itself: `BUNDLED_ICON_SET_INFO`), registered at start-up by `utils/bundledIcons.ts`, and writes the text of the licence of each set to `public/licenses/`
- The licences of the three typefaces are written to `public/licenses/` from the packages they come from, their first line reduced to the one copyright notice (`pnpm licenses:fonts`, `scripts/font-licenses.mjs`; `constants/thirdParty.ts`). The build copies the folder as it is; the «Informazioni» tab of the guide links to each file
- Tests fail when an icon used in the source is missing from the bundle or one in the bundle is not used, when a bundled set or a typeface has no licence text or a text is not the one of its package, and when the README names other sets than those bundled (`utils/licenses.test.ts`). Nothing is fetched from the Iconify API

## Documentation (`documentation/`)

The documentation is published with the app, at `/docs/` (English) and `/docs/it/` (Italian): https://app.pixelcake.dev/docs/. How to write it: `documentation/WRITING.md`.

- **Sources**: Markdown with a front matter (`title`, `description`, `order`), in two trees with the same files, `documentation/en/<section>/<page>.md` and `documentation/it/…`; the sections and their order in `documentation/sections.json`; pictures and videos in `documentation/media/`, shared unless they show words of the interface (`name.en.png`, `name.it.png`); a dark variant beside a picture (`name.dark.png`); a video with its poster (`name.poster.png`). Every heading names its anchor (`## Words {#anchor}`), the same in the two languages.
- **The generator** (`frontend/scripts/build-docs.mjs`, the modules in `frontend/scripts/docs/`): markdown-it with the conventions of the pages (anchors, boxes `[!NOTE]` `[!LIMITS]` `[!TODO]`, figures, terminal examples), then a static page per source with the masthead of the site, the navigation, a table of contents, previous and next, the head a search engine and a shared link read, and one search index per language that a small script of the pages reads. Fonts, logo, style sheet and script are copied beside the pages: a page asks nothing of another host. `pnpm build` runs it after the app, into `dist/docs`, which the `pages` job publishes with the app; `pnpm docs:dev` builds again at every change and serves it; a problem of the sources (a link, an anchor, a picture, a front matter) stops `pnpm build`.
- **Tests** (`frontend/src/docs/`, run by `pnpm test`; `pnpm docs:test` alone): every page in both languages with the same anchors; every link, anchor and picture resolves; every block with the prompt is a terminal example, and every terminal example (```` ```ncl sample=<name> ````, `fixture=`, `continue`) is run with the real executor on that sample, loaded in the language of the page, and must print exactly what the page shows; every command the parser knows (read from `terminal/parser.ts` through the TypeScript compiler) appears in the terminal reference of both languages; every name in «» or “” is a label of the dictionary of that language; a page with a `[!TODO]` or an empty section is listed in `documentation/stubs.txt`, and a finished one is not; the pages carry their head, landmarks and navigation and load nothing from elsewhere.

## Known Issues & Solutions (Historical)

| Issue | Solution |
|-------|----------|
| Canvas position reset | Real-time Zustand sync in viewport instead of drag-end only |
| Packet animation paths | Geometric handle calculation based on device centers and dx/dy |
| Duplicate connection IDs | Auto-cleanup on localStorage load + validation in addConnection |
| Modal jumps on tab change | `verticalAlign="start"` keeps modal anchored |
| VLAN/STP fields not visible | templateStore v4 with supportsVLAN/supportsSTP |
| Loop infinito onSelectionChange | `isUpdatingSelection` ref + `queueMicrotask` |
| Selezione globale spontanea | `selectionMode="full"`, and a device keeps its measured size (one without a size is inside any selection box). The 5px threshold that came with it is gone: it never saw a selection box, and kept other changes of selection from the store |
| Lag durante drag/selection | Set comparison + NetworkDevice memo comparator |
| Dropdown select accent color | CSS focus state: `border-color: var(--accent-color)` + box-shadow rgba |
| NICs/Ports wrapping on resize | `minWidth: '400px'` on left panel |
| Sample topology illeggibile e con gateway sbagliati | Sostituita da una rete piccola e corretta: 7 dispositivi, due sottoreti, un router con porte indirizzate |
| Bulk devices senza porte/NICs | `bulkDeviceHelpers.ts` auto-generates during creation |
| NICList scrollbar taglia bordi | `.nic-list` padding + removed `overflow-y: auto` |
| Project modals troppo piccole | NewProject `minHeight="550px"`, OpenProject `minHeight="80vh"` |
| Scrollbar artifacts | `overflow: 'hidden'` + custom `renderView` with negative margins |
| Modals inconsistent styling | Standardized footer + reusable CSS classes |
| ExplorerPanel inline styles | Replaced with CSS classes |
| App auto-load sample topology | Removed useEffect, sample only via welcome screen |
| Dropdown menu sotto sidebar | `.top-menubar` z-index 200 > sidebar 100 |
| Welcome checkbox non si resetta | useEffect monitors localStorage and resets |

## Roadmap

See "What is next" in [README.md](./README.md).
