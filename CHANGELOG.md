# Changelog

All notable changes to PixelCake project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- **The Iconify icon picker of the templates**, its list of icons, and the colour of a template on screen: a template is shown with one of the drawings of the devices, chosen among them. The icon sets Solar and Carbon are no longer bundled: what is left of the icons are those of the interface, from Material Design Icons and Lucide.
- **The second colour theme**, "Modern Tech" (Impostazioni → Aspetto). The app has one set of colours, the two of its logo, in light and in dark; the settings keep that one choice, as a switch. A theme picked with an older version is not kept.
- **The backend.** The FastAPI service, its database and admin panel, and the API client in the frontend are gone: the app runs entirely in the browser. Entries further down that mention the backend describe earlier versions.
- **The login page.** It asked for nothing and checked nothing: the app now opens straight on the designer. The particle library it used (`@tsparticles/*`) is no longer a dependency.
- **Interface entries that did nothing**: "Esporta come PNG", "Annulla", "Ripristina" and "Taglia" in the menus, "Preferiti" and "Account" in the sidebar, "Configurazione..." and "Evidenzia Percorso" in the right-click menus.
- **Settings that changed nothing**: the "Utente" tab (a profile that was stored and never used) and the language, date format and unit preferences.
- **More that did nothing**: the Inspector tab announcing Terraform fields, the terminal's Minimize and Maximize dots, two Terraform fields on custom templates, a click-to-connect mode and two windows nothing opened.

### Added
- **The devices are drawn.** A device on the canvas is a drawing of its own, made for the app, with its name under it and then its address: no box. Each of the 24 kinds of device has one, a flat silhouette in two layers with a cut between them, in the colours of the theme; the same drawing shows a kind of device everywhere: the panel and the windows that add devices, the rows of the one that adds many, the window of a device, the menu of a device while presenting, the settings of the templates, the exported picture. The frame of a device shows only under the pointer, with the focus of the keyboard, selected or dragged.
- **A device says its state with the upper layer of its drawing**, its lamp, in one colour in light and in dark: grey when it is taken as broken in a presentation, red where the answer on screen stops, green where it arrives, orange when it is selected, yellow when its first card waits for an address nobody gave it. When more than one is true the first of that list is told, and the colour is never alone: the mark of a failure, the frame in the colour of the lamp where an answer ends, the words under the name.
- **The answer of a question stays on the canvas.** After a question asked from the simulation panel or from the terminal (`ping`, `trace`, `browse`, `mail`, `download`), when the packet has got to the end of its way the device that answers turns green, or the one where the question stops red, until the next question, a change to the drawing, or a click on the empty canvas. A question that does not even leave its device is told at once.
- **Four more end devices**: Laptop, Smartphone, Tablet and IP Phone, each with its drawing and one network card, as the printer. A browser that kept the templates of an earlier version keeps them, the ones made or changed by the user included, and gets the four new ones. In the sample of the welcome screen the two laptops are laptops.
- **The note of a device is shown by the app**: in a small panel under the device, after a short rest of the pointer on it or when the keyboard brings its focus there; its lines as they were written, a long note cut after six lines. It never takes the pointer, goes when the pointer leaves, at a press, or with Esc, and is there while presenting too.
- **The licences travel with the app.** The texts of the licences of what it bundles from others (the typefaces Inter and JetBrains Mono, the icon sets Material Design Icons and Lucide) are in the build, under `licenses/`, and the «Informazioni» tab of the guide names them in one line, each opening its text.
- **Areas on the canvas («riquadri»).** A rectangle with a short name in a corner, drawn behind a group of devices to say what they are: Core, Edge, Uffici, Internet. An area is a light tint of one of six calm colours, with a thin border of the same colour and its name in small capitals; devices and cables are over it. It is added from the panel «Aggiungi» («Riquadro», in the middle of the view) or around the selected devices («Racchiudi in un riquadro», in Modifica and in the right-click menu of a device), and its name is typed at once. It is taken by its name or by its border: a press selects it, a drag moves it, eight handles resize it, a double click on the name renames it, the right button opens a menu (rename, colour, delete) and the Delete key deletes it. Moving an area moves no device. Its inside is not in the way: a selection box drawn there takes the devices and never the area, and selecting, copying, pasting and deleting devices are as they were. Presentation mode shows the areas and lets nothing be done to them; the small map shows them as faint rectangles; the exported picture draws them, in light and in dark. They belong to their canvas and travel with it: in the browser, through a canvas switch, in the project file (`areas`, left out of a canvas that has none: a file without them opens as before). The YAML export, which has no places, does not carry them. The sample networks have none.
- **Names for the VLANs, at project level.** A VLAN was a number everywhere. Impostazioni → Rete has a group «VLAN del progetto»: a table of number and name, which lists by itself the VLANs the canvas uses that have no name yet, so that they are named in one go; «Aggiungi VLAN» adds a row for any other, and the button at the end of a row takes a name away. One name for a VLAN, 32 characters at most; a number that is not a VLAN, a number given twice and a name left out are said under the row and stop the save, which is the one of the tab. Once saved, the name is written next to the number wherever the interface shows the number: the summary of a switch on «Generale» (`VLAN 10 «Uffici»: porte 1–3`, and what each trunk carries), under the VLAN field of a port, in what a port says under the pointer, on the tags of the VLANs of a device. A VLAN without a name shows as before. The names travel in the project file (`settings.vlans`); a file without them opens as before. The engine, the terminal and their English messages keep the numbers.
- **A note on a device.** The window of every device has a «Note» field, the last of «Identità» on its first screen: free text, of as many lines as it takes, for what fits no field (whose desk it is, what is to be fixed, whom to ask). On the drawing nothing is added to the device: the note shows when the pointer rests on it (in a panel of the app, see above). It is kept trimmed, and a note emptied is no note. It travels with the device in the project file (`notes`) and in the YAML export and import (`notes`, one quoted line whatever it holds), is carried by copy and paste, and `show config` prints it in the terminal.
- **A DNS server of the project.** Impostazioni → Rete has a fourth value for new devices, «Server DNS di Default», optional: the card of every new end device starts with it, whether the device is added one at a time or in bulk, and the window that adds a device shows it, to be changed or taken away. It is for end devices (a PC, a server, a printer): routers, firewalls and switches have no card, and what has one but only carries the traffic of others (an access point, a load balancer, a Cloud symbol) is left without. Changing it does not touch the devices that are there: once it is saved, the same tab says how many end devices of the canvas ask nobody and offers to give it to them, after a question. A device that names a server keeps it, and cards on DHCP are left alone. «Nuovo Progetto» asks for it too. It travels in the project file (`settings.dns`); a file without it opens as before.
- **DNS.** A server keeps a list of names, each with the address it stands for (Inspector → DNS). A network card says which DNS server it asks («Server DNS»), or is handed one with its lease («Server DNS consegnato» on a DHCP server). A name is looked up each time a question uses it: the request goes from the device to the address of its DNS server and the reply comes back, as the new service `dns`, through the same VLANs, routes, firewall rules, port forwards and simulated failures as any other exchange. When it fails, the reason says which: the device has no DNS server, no device has that address, the trace's own reason, the device reached is not a DNS server, the server has no record for the name. Rules and port forwards can be for DNS. Not simulated: a second DNS server, forwarding from one server to another, cache, reverse lookup, aliases and wildcards.
- **Terminal, NCL v0.5**: a host name works as the target of `ping`, `trace`, `browse`, `mail` and `download`, and the lookup is printed and animated before the flow. `resolve <name> [from <device>]` (also `lookup`, `nslookup`), `add record <name> <address|device> on <server>`, `remove record <n>|<name> from <server>`, `interface <name> dns <address>|none`, `pool … dns <address>`, `show dns [<device>]`. `show ip`, `show config` and `show dhcp` say the DNS server where there is one. `trace … as dns`.
- **DNS in files**: the records of a server (`dnsRecords`, in YAML `dns_records`), the DNS server of a card and the one a pool hands out (`dns`) travel in the project file and in the YAML export. The address a name resolved to is never written.
- **The sample of the welcome screen has names**: Srv-Auth is the DNS server of the inside and knows the management software, the mail server and the portal; the offices name it on their cards and the two pools of Router-Core hand it out. The customer outside has nobody to ask.
- **DHCP.** A network card can take its address from a DHCP server instead of having one written on it (Inspector → Schede di rete → Indirizzo: «Automatico (DHCP)»). A port of a router or of a firewall, or a card of a server, hands out a range to its network («Server DHCP Abilitato»), with the mask of the interface and a gateway. A lease is not remembered: it is worked out from the drawing, the same way every time. Cards are served in the order they were drawn, each takes the lowest address nobody has, and an address written by hand inside a range is skipped. A card that gets none has no address, and the reason is given wherever it is asked: in its window, on the drawing, in the answer to a ping. The new **DHCP** tab of a router, firewall or server lists its pools, who was given which address, who was left without, and a second server on the same network. A simulated failure does not change a lease.
- **Terminal, NCL v0.4**: `interface <name> dhcp [off]`, `interface <n> pool <first> to <last> [gateway <address>]` (`pool none` to stop), `show dhcp [<device>]`. `show ip`, `show config`, `show devices`, `show neighbors` and `show interfaces` mark an address that is leased. The version of the language is written once in the code, and a test holds the banner of `help` and the reference to it.
- **DHCP in files**: a card on DHCP (`dhcp`) and the pool of an interface (`dhcpServer`, in YAML `dhcp_server`) travel in the project file and in the YAML export. A lease is never written: it is worked out again when the file is opened.
- **The sample of the welcome screen uses it**: Router-Core hands out the addresses of the offices and of the Wi-Fi, and the two laptops take theirs from it.
- **A leased address is shown as one**: on the drawing, in the lists of devices, in the window of a cable and in the exported picture a device on DHCP has the address it is leased, followed by "DHCP", or "DHCP: nessun indirizzo". A new device is not proposed an address that is leased.
- **Address translation (NAT).** The NAT option of a port, which did nothing, is applied, on routers and on firewalls: a new flow the device forwards out of a port with NAT leaves with the address of that port, and the reply, which comes back to that address, is sent on to the real sender. **Port forwards** publish a service inside at the address of a port (Inspector → NAT, an ordered list); the answer leaves with the address that was asked. A firewall filters between the two, so its rules keep naming real addresses. Asked for a device behind NAT from outside, a flow aims at the address that publishes it, or at the device's own public address, and says so.
- **Terminal, NCL v0.3**: `interface <n> nat [off]`, `add forward <service> from interface <n> to <address>`, `remove forward <n>`, `show nat`. `ping`, `trace` and `browse` print the address the packet went to.
- **Port forwards in files**: they travel in the project file (`portForwards`) and in the YAML export (`port_forwards`) and come back in the same order.
- **A sample network of a small company**, loaded from the welcome screen and listed first under Aggiungi → Topologie: offices and Wi-Fi in two VLANs on one trunk, an access point, a switch of servers (authentication, database, management software, mail, storage), a public portal in a DMZ, a firewall with three rules, a customer outside. Twenty devices, every cable on its interface. What it answers, and what each failure does to it, is checked against the engine.
- **The menu bar names the project that is open**, with the canvas on screen when the project has more than one and a dot while there are changes not saved to a file. A click opens the Explorer.
- **The sidebar buttons show their names**, beside them, under the pointer or the keyboard.
- **The drawing as a picture** (File → Esporta immagine…, and a button on the presentation bar). The whole board is drawn again from its data, not taken from the screen: a PNG at one, two or three times the size of the screen, or an SVG; light or dark whatever the screen shows; with or without the name of the project, with or without background; saved to a file or copied to the clipboard. Made from a presentation, the picture shows the ends of the question, the way of the answer and what is broken, and under the drawing it writes the question, the answer, the simulated failures and their effect on the rest of the network.
- **Presentation mode** ("Presenta" on the menu bar, or Vista → Modalità presentazione). The editing tools are put away and the drawing can no longer be changed by clicking: a click on a device opens a small menu to start a question there or end it there, the packet goes by itself, and a panel says whether it arrives, through what, and where and why it stops. Each cable lights up while the packet is on it, in the colour of its kind, as while building. The bar has the pace of the packet, the terminal, full screen and the canvases of the project. Esc leaves.
- **"What happens if this breaks".** In presentation mode a device or a cable can be taken as broken with a click. Nothing in the drawing changes, and the failure is gone when the presentation ends. The question on screen is asked again at once, and the panel counts, over every pair of end devices, how many exchanges stop working, how many take another way and how many do not notice; a click on one of them asks that question. The terminal sees the same failures while the presentation lasts.
- **Failures in the engine.** A topology can carry devices that are down and cables that are cut. Between switches the shortest way that still works is taken. A router, or a host with two network cards, withdraws a route whose interface has no working cable left and takes the next route for that destination, saying so in a note.
- **Backup routes.** A second route to a network that has one is its backup: `add backup route <network> via <next hop>` in the terminal, a second row in Inspector → Rotte. Both `show routes` and the Inspector mark it. `remove route <network> via <next hop>` removes one route of several.
- **A third sample network**, "Due sedi: linea principale e di riserva": two sites joined by a main and a backup line, three switches in a ring. Made for trying failures.
- **Routing.** Every device forwards by its routing table: the networks its addressed ports or network cards are in, the static routes written on a router or firewall (Inspector → Rotte, or `add route … via …`), and its default gateway. A packet is followed across any number of routers; "no route", an unreachable next hop and a routing loop are reported as such. The way back is checked with its own routes.
- **Firewall rules.** Ordered rules on a firewall (Inspector → Regole, or `add rule allow|deny <service> from … to …`): the first that matches decides, by service (ping, web, email), source and destination (any, a zone, an address, a network). The zone policy applies when no rule matches.
- **VLANs port by port.** A switch port is an access port in one VLAN or a trunk carrying several (`interface <n> access|trunk …`). Once a switch has a VLAN on a port, the ports nobody touched are in VLAN 1.
- **Terminal, NCL v0.2**: `show routes`, `show rules`, `add/remove route`, `add/remove rule`, `interface <id> ip|gateway|access|trunk|default|zone`, `browse`, `mail`, `download`, `trace … as <service>`. An address typed as a target is the address aimed at. `set ip` now works on devices with network cards. Reference in `docs/terminal-commands.md`.
- **Routes and rules in files**: both travel in the project file and in the YAML export and come back in the same order.
- **Project files**: a project, with all its canvases, is kept in the browser and saved as a single `.pixelcake.json` file (File → Salva, Ctrl+S, Salva con nome…, Apri…). In Chrome and Edge the file is written in place; elsewhere it is downloaded. Format reference in `docs/project-file.md`.
- **Explorer**: rename the project and its canvases in place; a hint shows when there are changes not yet saved to a file.
- **Bundled icons**: the icons the app uses are shipped with it instead of being fetched from the Iconify API (`pnpm icons:bundle`).
- **BulkAddDeviceModal v2**: Table-based interface with configurable/standard device sections
  - ConfigurableDeviceRow: Dynamic rows for Switch/Router/Firewall with portCount dropdown
  - Dropdown for port selection (8/24/48 ports for switches, custom portOptions per template)
  - "+ Aggiungi Switch/Router/Firewall" button with mini-menu
  - Search filtering across both configurable and standard device sections
  - Custom scrollbar (react-custom-scrollbars-2, autoHeightMax: 500px)
- **generateDefaultNIC()**: Auto-generation NICs with MAC addresses
  - Format: `02:XX:XX:XX:XX:XX` (locally administered unicast)
  - Auto-generated with `generateMacAddress()` from ipHelpers
  - Default: eth0 interface, auto speed, enabled
- **NICList custom scrollbar**: react-custom-scrollbars-2 integration
  - AutoHeightMax: 400px
  - Accent color thumb with 6px border-radius
  - Subtle 2px track line matching BulkAddDeviceModal design

### Changed
- **A cable is pulled from the side of a device.** The four connection points on the sides are gone: a cable ends next to what is drawn (above it, at its two sides) and under the address, and it is started from the frame: the band along each side takes the press, and that side turns orange. While a cable is pulled it can be let go anywhere on a device, and it ends on the side it is let go on.
- **The exported picture draws the devices as the canvas does**: their drawings with the state of each, the name and the address, the cables ending where they end on screen. It no longer reads sizes from the screen nor carries icons fetched by name.
- **An area made around devices gives way instead of overlapping another.** «Racchiudi in un riquadro» leaves its usual room around the devices, but on a side where it would cross another area, or cover a device it does not hold, the room gives way, down to a small minimum, to leave a gap; an area inside another stays inside it, under its label. The room follows the frame of a device: 16 on the sides and under it, 40 above.
- **Bulk add puts the new devices in a grid, where the user is looking.** In rows, spaced for a device and its name, with nothing left to chance, starting in the part of the canvas on screen where a single new device would go; a place a device is on is skipped, so that two batches do not pile up, and the view is brought to show the new devices when they do not fit in it. They are the selection afterwards, to be dragged together.
- **«Aggiungi in Blocco» gives a switch, a router or a firewall plain ports**, those «Aggiungi dispositivo» gives: each on, at automatic speed, an access port on a switch and a LAN port on a router or a firewall, and nothing else. It used to write settings of its own on them: on a switch a trunk with VLANs 1, 10 and 20 on port 1 and PoE on the others, on a router a WAN port with NAT on port 1, on a firewall the zones untrust (with IPS) on port 1, dmz on port 2 and trust on the others. The engine applies VLANs, NAT and zones for real, so a device made in bulk did not behave as one made alone: its switch was VLAN-aware, its router translated the addresses of what left by port 1, and a cable to its firewall was put on no port, because on a firewall with zones the port is for the user to choose. These settings are for whoever configures the device. The two windows ask one function for the ports. Devices already on a canvas keep theirs.
- **The name a new device is given.** It is the name of its template and a number, as before; the number is now the lowest, from 1, that leaves the name free on the canvas: `PC-1`, `PC-2`, and `PC-2` again once that one is deleted. It used to be how many devices of the same type the canvas had: the first PC was `PC-0`, the first DNS server after two web servers was `DNS-Server-2`, and after a deletion a new device could be given the name of one that was there. A name is taken whatever its case and whatever device has it, because the terminal finds a device by its name and does not tell `pc-1` from `PC-1`. «Aggiungi dispositivo» proposes the name, to be changed; «Aggiungi in Blocco» gives a row of three the next three free names. The two ask one function. No device that is on a canvas is renamed, in a drawing made before or in the sample networks.
- **The look of the interface.** The app looks like its site. White or near black surfaces with the greys of the logo, and one accent, the orange of the logo, in light and in dark: it marks a state (what is selected, where the focus is, where the packet is) and nothing else. Links and icons take the slate. The button that goes on is a block of ink, the one next to it an outline. What is under the pointer takes a flat grey: the glows, the gradients and the small movements are gone. Corners are barely rounded and a shadow is kept only for what floats over the page. The typefaces are Inter and JetBrains Mono and travel with the app: no request goes to a font service.
- **Windows** have their title over a line of ink, and their groups of fields under a thin rule with the name of the group, in place of boxes. **Notices** are flat, with the frame of a window and a rule on the left in the colour of what they say.
- **A question with a yes and a no is asked in a window of the app** (deleting a device, a cable, a canvas or a template, loading a sample over a drawing, leaving changes that are not saved): the question, what a yes brings with it, and a button that names the action. The browser's own box, which stopped the page and looked like nothing else, is no longer used anywhere.
- **Presentation mode: the way of the answer is no longer painted on the drawing.** A cable lights up while the packet is on it and rests again, each in the colour of its kind, as while building. The answer in the panel is no longer a filled block: a rule in the colour of the outcome, the words in the colours of the text. (The exported picture, which cannot move, keeps the way marked.)
- **The window of a device is redone, for the device it is about.** Fields are low and several to a row, in place of one field as wide as the window for each value; the first screen of a PC fits without scrolling.
  - **«Generale»** says what the device is and how it is addressed. An end device or a server: the address of its first card, typed there (it was shown read-only, with a note sending to «Schede di rete»). A switch: its own address, the VLANs it knows, and how its ports are split (which ports are in each VLAN, what each trunk carries, how many are linked). A router or a firewall: the ports in use, each with its address, its zone on a firewall, what it is linked to and what it does (NAT, DHCP server); the name of a port opens it in «Porte». Spanning tree is asked of switches only, last.
  - **«Porte»**: the ports as a row of boxes that wraps, and the settings of the port picked under it, full width, in rows of four. **The number of ports can be changed** (it could only be chosen when the device was added): new ports are added at the end, the last ones are taken away unless a cable is on one of them.
  - **«Schede di rete»**: a row for each card (name, address, MAC, speed, what it is linked to), with the settings of the card being set open under its row; a device with one card shows them at once.
  - **One «Salva».** Ports and cards are typed straight into the form of the window: the «Salva» and «Annulla» each port and each card had are gone, and with them the edits that were lost when only the «Salva» of the window was pressed. What is wrong with a value (an address that is not one, a VLAN out of range, a DHCP range outside its network) is said under its field while it is typed, and stops the save with the name of the port or card. Two cards of a device may not have the same name.
  - The list of VLANs of a trunk can be typed a comma at a time (the comma used to vanish while typing).
- **«Aggiungi dispositivo»** has the same look, and the address of an end device is typed there, or left to DHCP, instead of being shown read-only until the device was on the canvas. **Impostazioni → Rete** has its three values in one row and checks that they are addresses.
- **NAT and DHCP are set from their own tabs.** The «NAT» tab of a router or a firewall lists the ports that have an address, each with a tick: NAT is switched on there, where before the tab only said to go to «Porte». The «DHCP» tab does the same for the server of each port (or card, on a server): a tick, and the range, the gateway and the DNS server in four fields under it. Switched on, a server is given a range to start from (.100 to .199 of a /24 or of a larger network, the upper half of a smaller one), so that one tick is enough for it to hand out addresses; a range switched off by mistake comes back with the tick. What a pool gave out, and what is wrong with it, is said under its fields as it is typed. Where an address is missing, «Dagliene uno» opens that port in «Porte». The settings on the port and on the card are still there: they are the same ones.
- **The small map shows each device in the colour of its type** (routers amber, switches green, firewalls red, servers violet…), as it did before the new look made it one grey: a glance tells where to go.
- **A device just added is the selected one**, and it goes in the first free place at the centre of the view instead of somewhere around it at random.
- **The welcome screen** is laid out as a page of the site: the logo over a line, the motto, the three steps as a numbered list, one button to start and two outlines next to it.
- **The sidebar** has icons of one colour; the panel that is open is marked in orange. **The terminal** has the colours of the one shown on the site, a title in place of the coloured dot, and an X to close it.
- **The logo is the new one**: with its name on the welcome screen, the symbol alone on the menu bar, in the browser tab and at the foot of the settings and of the guide, where the logo with its name would be too small to read.
- **The exported picture follows**: the same colours as the screen, no shadow under a device, the labels of the cables in the greys of the theme, and the letters on the two marks of a question («DA», «A») dark or light according to the colour they are on.
- **The Internet does not carry private addresses.** A Cloud symbol named Internet refuses a packet whose source or destination is in a private range, and the reason says which of the two and what should have translated it. A drawing that crossed it with private addresses needs NAT on the port that faces it, and a port forward for what is reached from outside. A Cloud symbol with any other name is unchanged.
- **The two samples with an Internet** (the company, and the site with a DMZ) do NAT on the firewall port that faces it and publish there what is reached from outside. Their answers are the same; what cannot be reached from outside now stops at the Internet.
- **Connection points show where they are needed**: on the device under the pointer, on a selected one, and on all of them while a cable is being dragged. At rest the drawing has none.
- **Side panels.** A panel no longer repeats its title under it. In the simulation panel the fields come first and "Avvia Simulazione" is a button, the main one of the panel; the exchange it proposes goes from the first PC of the drawing to its first server.
- **A sample network is brought whole into view** when it is loaded, wherever the board was.
- **Esc closes the window on top**, as its X does: the device window, the settings, Import/Export, the guide and every other window. One window for each press; a list open inside a window (the icon picker) closes before the window does, a press on a drop-down field is spent on its list, and Esc in a text edited in place still cancels only the edit. While presenting, Esc with a window open closes the window and the presentation goes on. The terminal keeps its own keys.
- **One name, one motto.** The browser tab is titled "PixelCake - Visual Network Designer", and the settings and the guide end with the motto of the welcome screen, in Italian. Name, descriptor and motto are written once, in `frontend/src/constants/brand.ts`.
- **A button that cannot be pressed looks it.** Disabled buttons in the dialogs were drawn like the others.
- **The packet animation is quicker and can be restarted.** A long exchange took about twenty seconds; cables now take between a third of a second and a second each. Starting a new animation, or stopping one, cancels the one in progress at once. The device the packet is stopping on is ringed.
- **The engine follows the shortest way that works**, not the shortest on the drawing: a port that is down is gone round when there is another way. End devices no longer carry traffic for others, and a router with addressed ports no longer passes traffic between two devices addressed in one network.
- **A router with more than one hop to go is checked**, no longer assumed. A router whose ports have no address still lets traffic through, with a note, so drawings made before this change give the answers they gave.
- **New routers and firewalls start without a gateway**: on a router the gateway is its default route. New devices appear in the middle of the visible canvas.
- **Inspector**: labels in Italian; a firewall port can be in no zone; the settings the engine does not simulate (IPS, STP) say so.
- **Help**: the outdated release notes are replaced by a guide in three tabs: how to use the app, the terminal commands (the same table the terminal prints with `help`) and information about the app. The Help menu opens it on each tab.
- **Shortcut list** (Impostazioni → Avanzate): it now lists only what the canvas really does. Panning is with the right mouse button, multi-selection with Ctrl+click; the Ctrl+L line described a shortcut that never existed.
- **Import/Export**: YAML is the default export format. The Terraform export is labelled as a draft and says that it cannot be applied.
- **Messages**: native `alert()` boxes are replaced by toasts.
- **BulkAddDeviceModal**: Complete refactoring from compact form to table-based UI
  - Separated configurable devices (Switch/Router/Firewall) from standard devices (PC/Server/Database)
  - File size: 254 lines → 715 lines (+461 lines)
- **bulkDeviceHelpers**: Signature changed to support configurableRows + standardQuantities
  - New parameters: `configurableRows: ConfigurableDeviceRow[]`, `standardQuantities: Record<DeviceType, number>`
  - File size: 116 lines → 248 lines (+132 lines)
  - Two-part processing: configurable devices (with ports) + standard devices (with NICs)

### Fixed
- **A device made in bulk was not the one «Aggiungi Dispositivo» makes from the same template.** It was named after its type, with a count that skipped every other number (`Server-0`, `Server-2`, `Server-4`); the window that adds one names a device after its template (`Web-Server-1`, `Web-Server-2`). Its address was the first free one of the network the gateway of the project is in, not of the network of the project, and the two differ when the gateway is elsewhere. Its card came with a description in English that nobody had typed. Name, address and card are now the same from both windows. What stays of the bulk window alone: the place of the new devices (a grid), and that none of them is selected.
- **«Aggiungi in Blocco»: the rows of one type shared one quantity, and added devices of another template.** The list has a row for each template, and several templates are of one type: seven are servers, three are of the PC type (PC, IP camera, printer), three are databases, two are access points. One more on «Web Server» raised all seven server rows, a number typed on one was written on all, the total counted them once, and «Aggiungi» made plain servers and, for a printer, a PC: devices that did not know their template, drawn with the icon of the type. A quantity now belongs to its row, and a row adds devices made from its own template. The search of the window no longer leaves rows it should hide, nor shows a row twice: the rows of one type had one key, and React could not tell them apart. The rows of the configurable devices (switch, router, firewall) find their template by its id as well, so that a second template of one of those types has a row of its own.
- **A view the app had made was not the one kept with the drawing.** A sample network is fitted to the window when it is loaded, and so is any drawing with Vista → «Adatta alla finestra» or the fit button of the canvas; the zoom buttons of the canvas move the view too, and so does a device dragged to the border. None of these views was stored: a reload of the page came back to an older one, and so did the way out of presentation mode. Only a move made with the pointer or the wheel was stored, at its end, because those are the only moves React Flow tells the end of. A move the app makes is now stored as soon as the view has stood still for a moment. A presentation stores no view, as before.
- **A group taken with a selection box could be dragged only once** when its devices were in a row or in a column: the second drag moved nothing, and the rectangle around the group went away. And with a device selected, a press on the empty canvas that was not quite still could select every device of the drawing. The two had one cause. At every change of the drawing the devices were handed to React Flow without the size it had measured, and until it had measured them again a device counted as inside any selection box, and the rectangle around a group was as large as the places of its devices alone: of no height for two in a row. A device now keeps its measured size for as long as it is on the canvas.
- **A device clicked after a click on the empty canvas looked selected and was not.** «Copia» stayed off, Ctrl+C copied nothing, and the device lost its selected look as soon as it was moved. The same happened to a device taken with the keyboard, and after the right button on a device. A click on a cable did the opposite: the devices it let go stayed selected for the app, and Ctrl+C still copied them. The canvas remembered where the last press and release had been and, when they were less than 5 pixels apart, kept the next change of selection from the rest of the app, whenever it came and whatever made it. That check is gone. It was written against a selection box drawn by accident and never saw one: a box changes the selection while it is drawn, before the release the check waited for.
- **The cross that removes a VLAN from the list of a device was white on a light chip**, and could not be seen in the light theme.
- **Aiuto → Mostra la schermata di benvenuto did nothing on the empty canvas of a project with more than one canvas**, although its own notice said to go to an empty canvas. Asked for, it now shows on any empty canvas.
- **A selection set by the app was cleared at once by the canvas** (it took it for one the user had cleared): a device the app selects now stays selected.
- **«Aggiungi in Blocco»: on a low window the two buttons at the bottom were cut off**, with no way to reach them (a laptop screen was enough). The list between the search field and the buttons now takes the height the browser window leaves it.
- **Six colours of the interface had no value.** A few lists and buttons used style variables that nothing defined (`--bg-color-hover`, `--bg-color-secondary`, `--input-bg`, `--color-canvas`, `--color-bg`, `--accent-color-hover`): what they coloured was see-through. They take the colours of the theme, and a test fails when a variable is used that has no value in light and in dark.
- **Dark theme: the address under a device was a different grey on screen and in the exported picture**, and so were the labels of the cables. Both take the greys of the theme.
- **White letters on orange** (the mark of a link on a port, the badge of presentation mode, the start of a question) could hardly be read: they are the graphite of the logo.
- **The logo with its name was shown 24 pixels wide** at the foot of two windows, too small to read: the symbol is there now.
- **Adding a YAML file to the drawing lost its routes, firewall rules and port forwards.** Import/Export → Import with «Aggiungi alla topologia» now keeps them, as «Sostituisci topologia» always did.
- **A device with no address on its network cards could not be saved from its window**: the Internet symbol, for one, could not even be renamed ("Nome e IP sono obbligatori"). The address is asked for only where it is typed, in the first tab; a device addressed through its cards, or by DHCP, needs a name.
- **Dark theme: the zoom buttons and the small map are no longer white.** They take the colours of the theme, in light and in dark. The credit to React Flow is readable on a dark canvas and no longer runs under the zoom buttons.
- **Import/Export: the icon of a button sat on a line of its own**, above its label. A button now keeps its icon next to its label, whoever uses it.
- **Labels glued to the field above** in Impostazioni → Rete, in "Nuovo Progetto" and in "Modifica Connessione": the fields are spaced like those of the other windows.
- **Cables follow a change of theme at once.** After switching between light and dark, each cable kept the grey of the old theme until it was drawn again.
- **The packet travels on the cable the engine took.** Between two devices joined by two cables the animation always ran on the first one drawn, even when the traffic was on the other.
- Ctrl+V while typing in a field pasted a copy of the selected devices on the canvas; Ctrl+C took over copying text. The canvas shortcuts now leave text alone.
- A link removed with the Delete key disappeared from the drawing but stayed in the network.
- Saving any field of a firewall port put the port in the `trust` zone.
- Custom device templates could be created but not placed.
- A failed trace could name a port on a side branch instead of the one on the way to the destination.
- The theme no longer flips between light and dark at every reload.
- The welcome screen appears only on an empty project, not on every empty canvas.
- The icon picker offered an icon that does not exist (`mdi:rack`).
- **Bulk devices now include port configurations** for Switch/Router/Firewall
  - Each device created with `ports: Port[]` array matching portCount
  - The ports the window that adds one gives: plain, with no VLAN, PoE, NAT or zone
- **Bulk devices now include NIC configurations** for PC/Server/Database
  - Each device created with `nics: NetworkInterfaceCard[]` (1 NIC default)
  - Auto-generated MAC addresses, IP/subnet/gateway configuration
- **UI consistency**: Custom scrollbar design matches across BulkAddDeviceModal and NICList

## [1.2.0] - 2025-11-23

### Added
- **Backend v1.2**: Templates API (10 endpoints for device/connection templates)
  - `GET /api/templates/devices` - List all device templates (global + custom)
  - `POST /api/templates/devices` - Create custom device template
  - `GET /api/templates/devices/{template_id}` - Get device template by ID
  - `PUT /api/templates/devices/{template_id}` - Update custom device template
  - `DELETE /api/templates/devices/{template_id}` - Delete custom device template
  - `GET /api/templates/connections` - List all connection templates
  - `POST /api/templates/connections` - Create custom connection template
  - `GET /api/templates/connections/{template_id}` - Get connection template by ID
  - `PUT /api/templates/connections/{template_id}` - Update custom connection template
  - `DELETE /api/templates/connections/{template_id}` - Delete custom connection template
- **SQLAdmin Panel**: 7 model views with full CRUD
  - Admin interface on `/admin` with Tabler CSS framework
  - Full CRUD operations for: User, Project, Canvas, ProjectVersion, DeviceTemplate, ConnectionTemplate, UserPreferences
- **Health Monitoring Dashboard**: Real-time system monitoring
  - Dashboard UI on `/dashboard` with auto-refresh every 30 seconds
  - JSON API endpoint `/api/admin/health` for programmatic access
  - Metrics: Database status, latency, record counts, DB size, PostgreSQL metrics
- **Multi-Canvas Architecture**: Project → Canvas[] (one-to-many)
  - Each project contains one or more canvas instances
  - Canvas stores network topology data (devices[], connections[] as JSONB)
  - Cascade deletion: deleting project removes all canvases
  - Protection: cannot delete last canvas in project (minimum 1 required)
- **Frontend-Backend Integration**: Auto-save system with debounced sync
  - API client with fetch wrapper and error handling
  - Auto-save after 2 seconds debounce on modifications
  - Sync indicator in Explorer panel
  - Error handling with `lastSyncError` state
- **ProjectStore**: Project management store
  - Actions: loadProjects, createProject, getProject, updateProject, deleteProject
  - State: projects list, currentProject, canvases list, loading/error states
- **Canvas Switching**: Auto-save before switching
  - Saves current canvas before loading new one
  - Updates networkStore with new devices, connections, viewport, counters
  - Prevents data loss during navigation
- **Template Sync**: Global templates (read-only) + Custom templates (user-owned)
  - Global templates managed by system (cannot delete/edit)
  - Custom templates fully manageable by users
  - Sync between LocalStorage and backend database

### Changed
- **Database schema**: Canvas model separated from Project (multi-canvas support)
- **Storage strategy**: LocalStorage now cache, Backend database source of truth
- **Auto-save**: 2 second debounce after modifications (was instant)
- **NetworkStore**: Enhanced with backend sync actions
  - New state: `currentProjectId`, `currentCanvasId`, `isSyncing`, `lastSyncError`, `autoSaveEnabled`
  - New actions: `loadFromBackend()`, `saveToBackend()`, `setCurrentCanvas()`, `setAutoSave()`
  - All modification actions trigger debounced auto-save

### Fixed
- **Canvas position reset bug**: Real-time Zustand sync instead of drag-end only
- **Packet animation paths**: Geometric handle calculation based on device centers

## [1.1.0] - 2025-11-19

### Added
- **Backend Database**: SQLAlchemy 2.0 async with SQLite (dev) / PostgreSQL (prod)
  - Async engine configuration with aiosqlite/asyncpg
  - Async session management with `AsyncSessionLocal`
  - 7 database models: User, Project, Canvas, ProjectVersion, DeviceTemplate, ConnectionTemplate, UserPreferences
- **Alembic Migrations**: Database migration system
  - Configured in `backend/alembic/`
  - Commands: `alembic revision --autogenerate`, `alembic upgrade head`
- **Admin Panel**: SQLAdmin integration on `/admin`
  - Full CRUD interface for all models
  - Professional web interface
- **Health Dashboard**: Real-time monitoring on `/dashboard`
  - API status, database status, latency, statistics
  - Auto-refresh every 30 seconds
- **Projects API**: 5 CRUD endpoints
  - List, create, get, update, delete projects
  - Auto-creates default "Main Canvas" on project creation
- **Canvases API**: 5 CRUD endpoints
  - List, create, get, update, delete canvases
  - Protected deletion (minimum 1 canvas required per project)

### Changed
- **Architecture**: Multi-tier with FastAPI backend + React frontend
- **Data persistence**: SQLite database instead of files

## [1.0.0] - 2025-11-08

### Added
- **Frontend MVP**: React 19 + TypeScript + Vite + Tailwind CSS v3
  - React 19.1.1 with concurrent features
  - Vite 7.1.7 build tool for fast HMR
  - Tailwind CSS 3.4.18 (NOT v4 alpha)
- **NetworkCanvas**: React Flow 11 integration
  - Custom node components (NetworkDevice)
  - Custom edge components (CustomEdge, ParticleEdge)
  - Real-time viewport persistence
- **Dynamic Device System**: 9 predefined templates + custom templates
  - Templates: PC, Switch, Router, Server, Firewall, AccessPoint, LoadBalancer, Database, Cloud
  - Customizable icons (Iconify), colors, Terraform fields
  - Template capabilities: supportsVLAN, supportsSTP, supportsPorts, supportsNICs
- **BFS Pathfinding**: Packet simulation with 4 flow models
  - Flow models: ping, email, web, download
  - Shortest path calculation between devices
  - Visual packet animation along path
- **Particle Edge Animation**: CSS offset-path continuous flow visualization
  - GPU-accelerated with CSS transforms
  - Configurable: particle count, speed, size, color
  - Three CSS animations: flow, fade, particle-glow
  - Default: 10 particles per edge, 3s duration
- **Dark Mode**: Toggle with system preference detection
  - Persisted in LocalStorage
  - CSS variable-based theming
- **LocalStorage Persistence**: Network, templates, UI state
  - Keys: `pixelcake-network-v2`, `pixelcake-templates-v7`, `pixelcake-ui-v1`
  - Auto-save on modifications
  - Backward compatibility with older versions
- **Sample Topology**: 33-device enterprise network (3 buildings)
  - Complete port configurations (8-48 ports per switch/router/firewall)
  - Complete NIC configurations (1-2 NICs per end device)
  - Realistic VLAN, PoE, security zones
- **VSCode-style UI**: Sidebar, panels, context menus
  - Explorer panel for project/canvas navigation
  - Device panel for adding devices
  - Properties panel for device inspection
  - Top menu bar with File/Edit/View menus
- **Template Management**: Create/edit/delete device templates
  - Template editor modal with live preview
  - Icon picker from Iconify library
  - Color picker for device colors
  - Terraform fields customization

### Changed
- **Tailwind CSS**: Downgraded to v3 (stability over v4 alpha)
  - Reason: v4 auto-install issues
  - Solution: `pnpm add -D tailwindcss@3`

### Fixed
- **Canvas position reset bug**: Real-time Zustand sync in networkStore.viewport
- **Packet animation paths**: Geometric handle calculation based on device centers and dx/dy comparison
- **Duplicate connection IDs**: Auto-cleanup on localStorage load + validation in addConnection
- **Subnet-grouped duplicate connections**: processedConnectionIds Set prevents inter-building link duplication
- **Auto-connect all to Router**: Use tier immediately precedente instead of first tier available
- **Modal jumps when changing tabs**: verticalAlign="start" keeps modal anchored to top
- **VLAN/STP fields not visible**: templateStore v4 with supportsVLAN/supportsSTP fields
- **Type-only import errors**: Use `import { type Tab }` for TypeScript interfaces with verbatimModuleSyntax
- **React Flow selection CSS**: Use `.react-flow__node.selected` NOT `.react-flow__node-selected`
- **Loop infinito onSelectionChange**: `isUpdatingSelection` ref + `queueMicrotask`
- **Selezione globale spontanea**: Soglia 5px movimento + `selectionMode="full"`
- **Lag durante drag/selection**: Set comparison + NetworkDevice memo comparator custom
- **Dropdown select non usa accent color**: CSS focus state con `border-color: var(--accent-color)`
- **NICs/Ports modal wrapping su resize**: `minWidth: '400px'` su pannello sinistro

---

[Unreleased]: https://github.com/pixelcake-dev/pixelcake/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/pixelcake-dev/pixelcake/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/pixelcake-dev/pixelcake/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/pixelcake-dev/pixelcake/releases/tag/v1.0.0
