# ARCHITECTURE.md

Detailed technical reference for PixelCake. To install and run it, see [README.md](./README.md).

The interface speaks Italian and English (see [Two languages](#two-languages-frontendsrci18n)). This document names controls by their Italian labels, the ones the dictionary starts from: «Salva», «Porte», Impostazioni → Rete.

## State Management (Zustand Stores)

All stores use Zustand. There is no server: what must survive a reload is kept in the browser's localStorage, and a project is saved for good as a file (see [Projects and files](#projects-and-files)).

### networkStore (`frontend/src/store/networkStore.ts`)
- The canvas on screen: devices, connections, areas, viewport (x, y, zoom), device/connection counters
- `areas`: the areas drawn behind the devices («riquadri», see [Areas](#areas-riquadri)); `addArea`, `updateArea`, `removeArea` are edits like any other. `selectedAreaId` and `editingAreaId` (not persisted) say which one is selected and which is being renamed: an area is never in `selectedDeviceIds`, and selecting one empties the other. `clearAllDevices` and `loadTopology` take the areas away with the drawing they were made for
- Project-wide network settings (`globalNetworkSettings`, see [GlobalNetworkSettings](#globalnetworksettings))
- **Multi-selection state** (selectedDeviceIds, clipboard) - NOT persisted, resets on reload
- **Copy/Paste functions** (copySelection, paste) - ID remapping + position offset (+50px)
- Auto-layout triggers
- `canvasId`: which canvas of the project this data is. Persisted next to the data, so the two stores cannot be paired wrongly after a reload
- `hasUnsavedChanges`: true when the project changed since it was last saved to, or opened from, a file. Every edit sets it through `markChanged()`; moving the viewport does not. `getChangeToken()` / `markSaved(token)` keep it set when an edit lands while a file is being written
- `getCanvasSnapshot()` / `replaceCanvas()`: used by projectStore to take the canvas off the screen and put another one on
- LocalStorage key: `pixelcake-network-v2`

### projectStore (`frontend/src/store/projectStore.ts`)
- The one project open in the browser: `name`, `description`, `canvases`, `activeCanvasId`. There is always a project
- The entry of the active canvas is refreshed only when it is committed (canvas switch, building the file): read the whole project through `buildProjectFile()`
- **Actions**: createProject, loadProject, renameProject, setDescription, addCanvas, renameCanvas, deleteCanvas (the last canvas cannot be deleted), switchCanvas
- Depends on networkStore, never the other way round
- LocalStorage key: `pixelcake-project-v1`

### simulationStore (`frontend/src/store/simulationStore.ts`)
- The packet travelling on the canvas. Not persisted
- `startSimulation(path, flowModel, links?)` starts a run and returns its `runId`; a new start replaces the run in progress. `path` is the devices to go through, `links` the cable of each stretch as the engine took it (two devices can be joined by more than one cable)
- While it runs: `currentHop`, `activeDeviceId` (the device the packet is stopping on), `currentConnectionId` with its duration and direction
- `speed` (0.5, 1, 2): set from the presentation bar

### presentationStore (`frontend/src/store/presentationStore.ts`)
- Presentation mode: `active`, the question (`sourceId`, `targetId`, `flow`), the simulated failures (`failedDevices`, `failedConnections`), the small menu open on the canvas, the path of the answer (`route`: the device the packet stops on, for the canvas; the cables, for the exported image), whether the panel is open
- **It never changes the drawing.** A failure is an id in this store, handed to the engine next to the topology. Nothing here is persisted; `exit()` forgets question and failures
- `enter()` refuses an empty canvas and puts the building tools away (selection, context menu, running packet)
- `utils/liveTopology.ts` builds the topology every question is asked of (canvas + failures while presenting): the simulation panel, the terminal and the presentation all read it there

### uiStore (`frontend/src/store/uiStore.ts`)
- UI state, modal controls (including `newProject`), context menus, the tab the guide opens on (`helpTab`, `openHelp(tab)`)
- Dark mode (persisted; follows the system until the user chooses), magnification state, sidebar panel state

### templateStore (`frontend/src/store/templateStore.ts`)
- Device and connection templates with auto-update
- Custom device types with their icon and colour; they are placed from the device panel like the built-in ones
- Connection types with line styles and colors
- Template capabilities: supportsVLAN, supportsSTP, supportsPorts, supportsNICs
- Custom templates travel inside the project file; opening a project adds the ones that are missing (`addMissingTemplates`)
- LocalStorage key: `pixelcake-templates-v8`

## Core Components

### Canvas
- **NetworkCanvas** (`frontend/src/components/Canvas/NetworkCanvas.tsx`) - React Flow wrapper with real-time viewport sync. Delete removes the selected devices and links from the network; Ctrl+C / Ctrl+V act on the drawing only while the user is not typing and has no text selected
- **AreaNode** (`frontend/src/components/Canvas/AreaNode.tsx`) - An area of the canvas: see [Areas](#areas-riquadri)
- **NetworkDevice** (`frontend/src/components/Canvas/NetworkDevice.tsx`) - Custom node component. A device that has a note carries it as its `title`: it is read by resting the pointer on the device, and nothing is drawn for it
- **CustomEdge** (`frontend/src/components/Canvas/CustomEdge.tsx`) - Custom edge with connection type styling
- **ParticleEdge** (`frontend/src/components/Canvas/ParticleEdge.tsx`) - Particle flow animation wrapper with CSS offset-path
- **PacketAnimation** (`frontend/src/components/Canvas/PacketAnimation.tsx`) - Moves the packet of a simulation cable by cable and keeps simulationStore up to date; CustomEdge draws it. One run at a time: a new start, a stop or an unmount cancels the run in progress. Timing and the choice of the cable are in `utils/packetTiming.ts`

The panels React Flow draws by itself (zoom buttons, small map, credit) take the colours of the theme from `index.css`. React Flow's own style sheet is loaded after it, so those rules start with `.react-flow` to outrank it. The credit is never hidden.

The connection points of a device (`.connect-point`) are hidden at rest: they show on the device under the pointer, on a selected one, and on every device while a cable is being dragged. Their hit area is always there.

The selection of the devices is React Flow's: every change it tells of (`onSelectionChange`) is written to networkStore, whatever was done on the canvas before it. The handler keeps its identity and reads the store when it is called, because React Flow calls a new handler at once with the selection it has at that moment. It keeps nothing back: React Flow has changed its selection already, and a change that does not reach the store leaves the app with another selection than the one on screen.

The list of React Flow nodes is made anew from the store at every change. A device that stays on the canvas is handed over with the size React Flow measured for it (`width`, `height`), which React Flow needs for more than drawing: a node without a size counts as inside any selection box, and the rectangle around a group taken with a box is made from the sizes (without them two devices in a row give it no height; React Flow takes it away, and the one it draws next cannot be dragged). A size that changes is still told by React Flow, which goes on watching the node. An area has the size the drawing gives it.

Bringing the whole drawing into view is a request (`fitViewRequest` in networkStore, raised by `triggerFitView`). The canvas answers each request once, after React Flow has measured the devices, so a drawing that has just been loaded (a sample network) is fitted too.

The view on screen is kept with the canvas (`viewport` in networkStore, which is not an edit): it is what a reload of the page and the way out of a presentation come back to. A move made with the pointer or the wheel is stored at its end (`onMoveEnd`). A move the app makes (the drawing fitted, the zoom and fit buttons of the canvas, the view that follows a device dragged to the border) has no end React Flow tells of: it reaches the canvas as `onMove` with no event, and the view is stored once it has stood still for 150 ms. Nothing is stored while presenting.

While presenting, NetworkCanvas makes the drawing read-only (nothing is selected, moved, joined, deleted or pasted; dragging pans), a click on a device or a cable opens the presentation menu, the drawing is fitted to the window, and the view saved with the drawing is not touched. NetworkDevice and CustomEdge mark the ends of the question, a broken device and a cut cable. The path of the answer is not painted: the packet shows it, and a cable lights up in the colour of its kind while the packet is on it, as while building.

### Areas («riquadri»)

An area is a rectangle with a label, drawn behind a group of devices to say what they are (Core, Edge, Uffici). It is a drawing: no device belongs to it, the engine never reads it, moving it moves nothing else.

- **Data**: `CanvasArea` (`id`, `label`, `color`, `position`, `size`) in `types/network.ts`; a canvas keeps a list of them next to its devices (`CanvasData.areas`, left out when empty, so that a canvas without areas is stored and written as before). `utils/canvasAreas.ts` (pure) names, numbers, colours and places them, and reads a list from outside (`readAreas`: a file, the browser's storage)
- **On the canvas** they are React Flow nodes of their own kind, first in the list and at depth -1: under the cables, which React Flow draws at depth 0, and under the devices. They are **not** React Flow's to select, drag, join or delete (`selectable`, `draggable`, `connectable`, `focusable`, `deletable` all false): a selection box leaves out what is not selectable, so the selection of the devices, copy and paste and Delete never see an area, and `onSelectionChange` is as it was. Which area is selected is kept in networkStore; NetworkCanvas lets go of React Flow's own selection when one is (`unselectNodesAndEdges`), deletes it on the Delete key, and lets go of it on a click or a selection box on the empty canvas
- **AreaNode** lets the pointer through its inside (`pointer-events: none` on the node; the label and four strips over the border take it back). A press there selects the area and moves it: the pointer is followed on the window, not by React Flow's drag (which would carry the selected devices along) and not with pointer capture (which does not hold inside the canvas). Selected, it shows eight `NodeResizeControl` handles, React Flow's own: `onResize` writes position and size to the store. A double click on the label renames it in place (`ui/InlineEdit`); the right button opens `ui/AreaContextMenu` (rename, the six colours, delete after a question)
- **Added** from the panel «Aggiungi» («Riquadro», in the middle of the view) or around the selected devices («Racchiudi in un riquadro», in Modifica and in the menu of a device): `utils/areaActions.ts`, which reads the view and the size of the devices from the screen. A new area is selected, with its name ready to be typed, in the first colour of the palette the canvas does not use
- **Colours**: six, by name (`slate`, `green`, `amber`, `red`, `violet`, `teal`), each a variable of the theme (`--area-<name>`) with a value in light and in dark, dark or light enough for the label to be read on the tint. The border and the label take the colour, the inside a tenth of it. `AREA_PALETTE` in `utils/canvasAreas.ts` repeats the values for the exported image and the small map; tests hold it to the style sheet
- **While presenting** an area is shown and nothing else: no handle, no side to take it by, no menu. **The small map** shows it as a faint rectangle of its colour, under the devices. **The exported image** draws the areas first, in the colours of the theme it is made in (`AREA_METRICS` repeats the numbers of the style sheet)
- **The sample networks** come with theirs (`utils/sampleNetwork.ts`): a sample names, for each area, the devices it holds, and `areasAround` works the rectangle out from where they are, with the margins of «Racchiudi in un riquadro» (`areaAround`) and the size a device is drawn with (`estimateDeviceSize`, the numbers of the style sheet). No rectangle is typed: when a device is drawn larger, or moved, its area follows. A test holds that no two areas of a sample cross and that no device is half in one. The small office has none: its two networks are plain without, and the labels of the cables from its router would sit on them

### Presentation (`frontend/src/components/Presentation/`)
- **PresentationBar** - Takes the place of the menu bar: project and canvases, pace of the packet, terminal, the image of what is on screen, full screen, the language, the theme, exit (also Esc). In a narrow window what matters less gives way first, so that the tools and the way out stay inside it down to 600 px: the name of the project is cut short, the canvases scroll, below 800 px the badge keeps its symbol alone (its word stays for a screen reader), below 640 px the name of the project goes
- **PresentationPanel** - Question, answer, simulated failures with their effect on the rest of the network, and the way hop by hop. `usePresentationAnswer` works all of it out from the drawing, the question and the failures, marks the way on the canvas and sets the packet off at every change
- **PresentationMenu** - The menu a click on a device or a cable opens: start here, arrive here, break, repair
- `utils/presentation.ts` - The engine's answer turned into what is shown (sentences in the language of the interface, rows tied to the animation, exchanges grouped by device, the caption of an exported image). It touches no store but the language; the reasons and notes of the engine are shown as the engine wrote them, in English in both languages

### WelcomeScreen (`frontend/src/components/WelcomeScreen.tsx`)
- Excalidraw-style minimalist transparent overlay on canvas (NOT popup)
- Shows on an empty project: a single canvas with nothing on it
- What the app is for in three steps (draw, configure, ask), the ways to start, links
- "Non mostrare più" checkbox → localStorage (`pixelcake-hide-welcome`)
- Actions: Nuovo Progetto (form), Apri Progetto (file picker), Carica la rete di esempio
- Auto-dismiss on any action, manual "Mostra la schermata di benvenuto" from the Aiuto menu
- State: `useUIStore.showWelcomeScreen`, the number of devices on screen and the number of canvases

### Modals (Enterprise Style)
- **InspectorModal** - Device configuration in tabs, over one form that «Salva» checks and saves all together: ports and cards are edited in place (`ui/PortEditor`, `ui/NicEditor` in `ui/NicRows`; no panel has a save of its own), what is wrong with one is worked out by `utils/interfaceProblems.ts` both under its field as it is typed and when the device is saved, and they are kept tidy (`tidyPort`, `tidyNic`). The first tab, Generale, is made for the device: every device has its note there, the last field of «Identità» (`TextAreaField`, one row until it is written and then as many as its lines, six at most; kept by `utils/deviceNotes.ts`: trimmed, none when emptied); an end device or a server has the address of its first card there (`NicAddressFields`, the same fields as in the card), a switch its VLANs and how its ports are split (`ui/PortsOverview`, `utils/portSummary.ts`), a router or a firewall its ports in use. The other tabs: Porte (switch, router, firewall: `ui/PortGrid` and the port picked under it; the number of ports changes there) or Schede di rete (end devices), Rotte (router, firewall: `ui/RoutesPanel`, with the routing table the engine would read from the form), Regole (firewall: `ui/FirewallRulesPanel`, ordered rules), NAT (router, firewall: `ui/NatPanel`, a tick for each port that has an address and the ordered port forwards), DHCP (router, firewall, server: `ui/DhcpPanel`, a tick and the range for each interface that can serve, who was given which address and who was left without), DNS (server: `ui/DnsPanel`, the names it answers for). Routes, rules, forwards and DNS records are validated on save (`utils/networkConfigValidation.ts`; a record also as it is typed), pools in the panel of their port or card and again on save (`utils/dhcpLabels.ts`); a pool typed in the DHCP tab is checked as it is typed, kept trimmed on save, and not kept when its range was left empty. NAT and the DHCP server of an interface are one setting with two places to set it: the tab of the service and the panel of the port or card, both on the `ports`/`nics` of the form. A server switched on in the DHCP tab starts from `suggestedPool` of the engine. The window keeps the open tab itself (`TabContainer` with `activeTab`), so that a tab can send to another one: «Dagliene uno» opens the port that needs an address. The DNS server a card asks is a field of the card (`ui/NICConfigPanel`), the one a pool hands out a field of the pool (`ui/DhcpPoolFields`). The DHCP tab and the lease shown on a card are worked out from the form as it is, unsaved edits included
- **HelpModal** - The guide, in three tabs: how to use the app, the terminal commands (rendered from `COMMAND_REFERENCE`, the table the terminal's `help` prints), information
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
- **Modal / BaseModal** - The window every dialog is built on. Esc closes it as its X does (`ui/useEscapeToClose.ts`): whatever Esc can close is on one list while it is open, a single listener closes the last entry, so each press closes one thing, the one on top (a list of the icon picker before its window, a window before the one under it). Whoever uses Esc for itself (an edit in place) marks the event with `preventDefault()`; a press that is marked is left alone, also by the presentation bar
- **ConfirmDialog** (`store/confirmStore.ts`) - A question with a yes and a no, asked in a window of the app: `askConfirm({ title, detail, confirmLabel, danger })` gives a promise of the answer. It lies over any other window; Esc and a click outside are a no. No source file calls the browser's `alert()`, `confirm()` or `prompt()` (a test scans for them). In tests, `test/confirm.ts` answers the questions and `await settled()` lets whoever asked go on
- **Button** - Lays what is inside it out in a row: an icon and its label stay on one line, with no styling of the icon by the caller
- **compact** (`ui/compact.tsx`, `ui/compactStyles.ts`) - The fields of a settings screen: `TextField`, `SelectField`, `CheckField`, `ReadOnlyField`, `TextAreaField` for a text of several lines (a small label over a low field, with its note and what is wrong under it) and `FieldRow`, a row of up to four. Used by the window of a device, by the window that adds one and by Impostazioni → Rete; `Input` and `Select` remain for the windows that ask one or two things
- **TabContainer** - Reusable tab system for modals. It keeps the open tab by itself, or shows the one it is given (`activeTab` with `onTabChange`) when the window has to send to one of its tabs
- **VLANInput** - Multi-value input with tag chips (range 1-4094)
- **The name of a VLAN** - A VLAN is a number in the data and for the engine; the project may give it a name (`GlobalNetworkSettings.vlans`). `utils/vlanNames.ts` writes a VLAN with its name (`vlanLabel`: `VLAN 10 «Uffici»`; `vlanShort`: `10 «Uffici»` in a list of numbers), and `utils/useVlanNames.ts` hands the names to the components that show a number: the summary of a switch (`PortsOverview`), the VLAN field of a port (`PortEditor`, the names under the field: the field holds numbers), what a port says under the pointer (`PortGrid`, `portVlanText`), the tags of `VLANInput`. The terminal, the reasons of the engine and the labels typed on cables keep the numbers
- **DeviceTypeDisplay** - Read-only device type preview with icon
- **PortGrid** / **PortConfigPanel** - Port display grid + configuration panel
- **NICList** / **NICConfigPanel** - NIC list with custom scrollbar + configuration panel
- **Input/Select** - Compact form controls (`py-1.5`, 14 px text, a ring of the accent on focus)
- **Logo** - One of the four files of the logo, never drawn or typed: with the name or the symbol alone (`symbol`), in colour on a light page or negative on a dark one. The logo with the name is never asked narrower than 110 px (a test reads every use)

### Sidebar (`frontend/src/components/Sidebar/`)
- **Sidebar** - Six buttons. Each shows its name beside it under the pointer or the keyboard; the name is drawn on the page through a portal, because the panel a button opens covers the sidebar's own layer
- **SimulationPanel** - From, to, what, then the button that sends it. It proposes an exchange from the first PC of the drawing to its first server, and proposes again when what was chosen leaves the drawing
- **DevicePanel** - The device types to add, each with what it is under its name (`utils/templateText.ts`: a built-in template that is a kind of a type, a printer or an IoT gateway, says what it is and not what it is built on), and, under «Esempi», four sample networks (`utils/sample*.ts`). The first, `sampleCompany.ts`, is the one the welcome screen loads. A sample (`SampleNetwork`, `utils/sampleNetwork.ts`) is its drawing, its areas and the network settings of the project it is made for: `loadSample` in networkStore puts all three in place, every setting included (the network new devices start from and its gateway, the DNS server, a name for each VLAN in use, the mail `auto`), so that a device added afterwards is offered an address of its network. The question asked before a sample replaces a drawing says the settings go too; on an empty canvas nothing is asked. A sample is fitted to the window when it is loaded

### Explorer Panel (`frontend/src/components/Sidebar/ExplorerPanel.tsx`)
- Project name and description, editable in place (`components/ui/InlineEdit.tsx`); a hint shows when there are changes not yet saved to a file
- Canvases list: click to switch, create and rename in place, delete (not the last one), device count
- Buttons: "Salva su file", "Apri file…"

### Top Menu Bar (`frontend/src/components/Toolbar/TopMenuBar.tsx`)
- File Menu: Nuovo progetto…, Apri…, Salva (Ctrl+S), Salva con nome…, Esporta immagine…
- Aiuto Menu: Guida, Comandi del terminale, Mostra la schermata di benvenuto, Informazioni
- In the middle of the bar, the project that is open: its name, the canvas on screen when there is more than one, a dot while there are changes not saved to a file. A click opens the Explorer
- No entry is there to announce a feature: an entry that cannot act (nothing selected to copy) is disabled only for as long as that is true
- On the right, after «Presenta»: the language (`ui/LanguageSwitch.tsx`, two letters each, a `.segmented` control) and the theme

## Two languages (`frontend/src/i18n/`)

Every text a person can read or a screen reader can say is in two dictionaries, Italian and English, and changes at once when the language does. There is no translation library: a small typed layer of our own.

- `it/<namespace>.ts` is the source dictionary, one file for each part of the interface (`menu`, `inspector`, `dhcp`, `help`…), put together in `it/index.ts`. `en/<namespace>.ts` holds the same entries: each namespace is typed `Dictionary['<namespace>']` (`dictionary.ts`: `typeof it`), so a missing English entry, or one of another kind, does not compile.
- An entry is a text, or a function when the text carries values: `devices: (count: number) => …`. Plurals, gender and the order of the words are plain TypeScript, written apart in each language. A sentence is always one entry: it is never glued together in a component out of translated pieces.
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
- `i18n/plurals.test.ts`: every entry that takes a number of things, or a list of them, is called with none, one and two, in both languages, and must not say of one what it says of two («1 dispositivi») or of none what it says of one. Which entries take a number is read from the names of their values: a new name must be listed there as a number, a list or neither.
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
- **Each colour has one job.** `--text-color` on `--bg-canvas` is the page, and the button that goes on is a block of the first with the second written on it (`Button` `primary`, `.presentation-primary`, `.welcome-button.primary`, `.explorer-button-accent`). `--accent-color`, the orange of the logo in both themes, marks a state: selected, in focus, open, where the packet is; what is written on a fill of it takes `--on-accent`, never white. `--accent-text` (the slate, dark on white and light on black) is for links and for the icons of a list. `--secondary-color` is the slate itself: the icon of a device, the end of a question. `--ok-color`, `--trunk-color` and `--danger-color` say that something works, is a trunk, is wrong.
- **Under the pointer** a row, a menu entry or an icon takes `--bg-hover`, a flat grey, and an outline takes the colour of the text. Nothing glows, slides or grows.
- **Corners** come from two sizes, `--radius` (4 px) and `--radius-small` (2 px); Tailwind's `rounded-*` are mapped to the same few values in `tailwind.config.js`. A device on the canvas keeps 3 px, the number the exported image repeats. **Shadows** are for what floats over the page: menus, windows, a device while it is dragged.
- **Labels** (the title of a panel, a `legend`, the heading of a section) are small capitals with space between the letters, as on the site.
- **Typefaces**: Inter for the interface, JetBrains Mono for addresses and for the terminal, both bundled (`@fontsource-variable/inter`, `@fontsource/jetbrains-mono`, imported in `main.tsx`). The exported image uses the typefaces of the computer instead: an SVG shown as an image cannot use the fonts of the page.
- **The terminal** keeps a dark pane in both themes, in the colours of the terminal shown on the site (`TerminalModal.tsx`).

Three test files keep it in one piece: `styleSheet.colours.test.ts` (no fixed palette, no variable without a value in both themes, one accent, nothing white on it), `utils/drawingImage.test.ts` (the image repeats the colours and the numbers of the style sheet) and `components/Canvas/NetworkCanvas.theme.test.tsx` (the panels React Flow draws follow the theme).

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
  the zone policy, with the reply to an allowed flow always passing. A rule
  naming a zone is skipped, with a note, when the link is not on a port.
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
- `trace.ts` — the walk itself, loop detection, and the notes: whatever is not
  verified (a link end not on a port, a router without interface addresses,
  a Cloud symbol) is reported as a note, never as a silent success. A packet
  addressed to a NAT device is sent on to whom the device stands for (the
  server a forward publishes, the sender of a flow it translated); the
  result carries the addresses as sent and as they ended up
  (`seenSourceIp`, `reachedIp`) and the translations made on the way.
- `flows.ts` — request/reply plans per flow model (ping, web, download, email)
  and the service each leg is to a firewall. A reply leg is the return traffic
  of an allowed flow, sent back to the address the request came from. The
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
  (`deadInterfaces`) and takes the next one for that destination, with a note.
  A network the device is attached to is not looked for elsewhere: the broken
  link is the answer.
- `impact.ts` — every exchange between two end devices evaluated with and
  without the failures, and compared: broken, rerouted (other cables),
  unchanged. Exchanges that did not work to begin with are not counted.
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
  example of that document, and two others run its DHCP and DNS sessions and
  compare what the terminal prints with what the document shows. The version of the
  language is `NCL_VERSION` in `types.ts`: the banner of `help` reads it, and
  a test holds the title of the document to it.
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
  caller gives the size each device has on screen, the shapes of the icons and
  a way to measure text.
- A cable is the path the screen draws (`getSmoothStepPath` between the same
  two points, 12 px outside the boxes) carried on to the two boxes: an image
  has no connection points for it to stop at.
- The numbers of a device (padding, border, line heights) and the colours of
  the two themes are repeated from `index.css`. A test reads the style sheet
  and fails when they drift apart. The colours of presentation mode
  (`MARK_COLORS`) are shared with `CustomEdge`; the two colours of a question
  and of what is written on them (`ACCENTS`) are the `--accent-color`,
  `--secondary-color`, `--on-accent` and `--on-secondary` of the theme.
- Everything the user typed is written as text (`escapeXml`). An icon fetched
  by name for a custom template goes in only if it is a plain drawing
  (`isPlainDrawing`): no script, no style, no reference outside the document.
  Ids inside icons are prefixed per icon. The document refers to nothing
  outside itself.
- `drawingMeasure.ts` — what is asked of the browser: the size of each device
  (`.react-flow__node[data-id]`, less the thicker border of a selected one),
  the icon shapes Iconify has loaded, text widths from a canvas.
- `imageExport.ts` — the ways out. `rasterizeSvg()` paints the document on a
  canvas of the pixels it declares (`scaledSvg`); `fitScale()` keeps a PNG
  within what browsers can paint. Saving asks where with the File System
  Access API and downloads elsewhere; copying puts a PNG on the clipboard.
  The PNG is made when the choices are made, not at the click: a browser lets
  a page save or copy only straight from the click.
- While presenting, the dialog hands over the marks of the presentation
  (`DrawingMarks`) and asks the engine the questions of the panel again for
  the caption (`captionOf` in `utils/presentation.ts`).

### Auto-Layout (`frontend/src/utils/autoLayout.ts`)
- **Hierarchical layout** using dagre (top-down hierarchy)
- **Subnet-grouped layout** - Groups by network class (first 2 IP octets)
- Direction: Vertical (TB) or Horizontal (LR)
- Spacing: 100px horizontal, 250px vertical, 150px gap between buildings
- Duplicate prevention: processedConnectionIds Set for inter-building links

### Auto-Connect (`frontend/src/utils/autoLayout.ts`)
- Device tiers: Edge (Router) → Security (Firewall) → Core (Switch) → Distribution → Access
- Connection type inference: hybrid approach (tier + IP subnet)
- Special cases: Database replication links, inter-building WAN backbone
- Proximity-based: connects to closest parent device within same building

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
- `newDevicePorts(portCount, deviceType)` - The ports of a new switch, router or firewall: numbered from 1, each on and at `speed: 'auto'`, `portType` `lan` on a router or a firewall and `access` on a switch (or any other device with ports). Nothing else: no VLAN, PoE, NAT, zone or IPS, because the engine applies them for real and they are for whoever configures the device to choose. So a switch made in either window is not VLAN-aware, a router does no NAT, and a cable goes on any free port of a firewall

### Bulk Device Helpers (`frontend/src/utils/bulkDeviceHelpers.ts`)
- `bulkAddDevices(rows, quantities, …)` - every device is made from the template of its row, found by its id, and says so (`templateId`: the canvas takes its icon, and the windows its capabilities, from there)
- Ports: `newDevicePorts` of `utils/newDevice.ts`, as many as the row says
- A new router or firewall gets no gateway (on a router the gateway is its default route); switches and end devices get the one of the project
- `generateDefaultNIC(ip, subnet, gateway, dns?)` - Auto MAC, eth0, auto speed; the DNS server of the project when it has one. It is the card AddDeviceModal starts from
- Naming: `newDeviceName` of `utils/newDevice.ts` (see [A new device](#a-new-device-frontendsrcutilsnewdevicets)), asked again for each device with those just made in the list: a row of three takes three free names
- Grid positioning: `generateGridPositions()` with random offsets (-25/+25px)
- IP assignment: `findNextAvailableIP()` of `ipHelpers`, the one AddDeviceModal uses: the first free address of the network of the project, from .2
- A device made here is the one AddDeviceModal makes from the same template (`BulkAddDeviceModal.same.test.tsx` compares the two, template by template, and the ports for every number of ports offered), but for two things: its place on the grid, and that it is not selected

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
- Capabilities: `supportsVLAN, supportsSTP, supportsPorts, supportsNICs`
- `defaultPortCount?, portOptions?`

## Device Templates (20 total)

### Base Types (9)
| Template | ID | Icon | Features |
|----------|----|------|----------|
| Switch | tpl-switch | mdi:switch | Ports |
| Router | tpl-router | mdi:router | Ports |
| Firewall | tpl-firewall | mdi:security | Ports |
| Server | tpl-server | mdi:server | NICs |
| Database | tpl-database | mdi:database | NICs |
| PC | tpl-pc | mdi:desktop-classic | NICs |
| Cloud | tpl-cloud | mdi:cloud | NICs |
| AccessPoint | tpl-accesspoint | mdi:access-point | NICs |
| LoadBalancer | tpl-loadbalancer | mdi:scale-balance | NICs |

### Specialized Templates (11)
| Template | ID | Base | Icon |
|----------|----|------|------|
| Mail Server | tpl-mailserver | Server | mdi:email-fast |
| VPS | tpl-vps | Server | mdi:cloud-outline |
| Web Server | tpl-webserver | Server | mdi:web |
| Proxy Server | tpl-proxy | Server | mdi:shield-half-full |
| DNS Server | tpl-dnsserver | Server | mdi:dns |
| DHCP Server | tpl-dhcpserver | Server | mdi:ip-network |
| Storage S3 | tpl-storage-s3 | Database | mdi:bucket |
| NAS | tpl-nas | Database | mdi:nas |
| IoT Gateway | tpl-iotgateway | AccessPoint | mdi:router-wireless-settings |
| IP Camera | tpl-ipcamera | PC | mdi:cctv |
| Printer | tpl-printer | PC | mdi:printer-wireless |

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
Open           -> file -> parseProjectFile() -> projectStore.loadProject() -> networkStore.replaceCanvas()
```

### Icons
- The icons used in the code are shipped with the app: `scripts/bundle-icons.mjs` (`pnpm icons:bundle`) collects them into `src/data/bundledIcons.ts`, registered at start-up by `utils/bundledIcons.ts`
- A test fails when an icon used in the source is missing from the bundle
- An icon name typed by hand in a custom template, if it is not in the bundle, is fetched from the Iconify API

## Known Issues & Solutions (Historical)

| Issue | Solution |
|-------|----------|
| Canvas position reset | Real-time Zustand sync in viewport instead of drag-end only |
| Packet animation paths | Geometric handle calculation based on device centers and dx/dy |
| Duplicate connection IDs | Auto-cleanup on localStorage load + validation in addConnection |
| Subnet-grouped duplicates | processedConnectionIds Set prevents inter-building duplication |
| Auto-connect all to Router | Use tier immediately precedente instead of first available |
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
