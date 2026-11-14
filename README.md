<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo/pixelcake-orizzontale-negativo.svg">
    <img src="docs/logo/pixelcake-orizzontale-colore.svg" alt="PixelCake" width="300">
  </picture>
</h1>

**Infrastructure, piece by piece.**

PixelCake is a browser-based designer for small networks. You draw the network, configure it, then ask it a question: does this PC reach that server? If it does not, you see where the traffic stops and why.

![The sample network of a small company, its groups of devices in areas (Internet, Edge, Core, Offices, Servers), with the terminal: a ping from PC-Sales to Web-ERP that works; the gateway of PC-Sales set to a wrong address; the same ping stopped at PC-Sales, with the reason; then the addresses of PC-Sales](docs/screenshot.png)

**Status:** early prototype. It is good for exploring and explaining a small network. Do not use its answers to validate a real one: the [limits](#what-it-does-not-do) are listed below.

## What it does

- **Draw.** Devices, links, ports and network cards on an interactive canvas. 20 device types and 5 link types are built in and can be customised. Labelled areas behind groups of devices (Core, Edge, Offices), auto-layout, multi-selection, copy and paste, and several boards per project.
- **Configure.** Addresses on every router port and network card, static routes, VLANs port by port (access and trunk), each with a name given once for the whole project, firewall zones and ordered rules, NAT towards the Internet and port forwards for what is reached from it, DHCP for the devices that take their address by themselves, DNS records on a server so that a device can be called by name, and a DNS server of the project that new devices start with. A free note on any device, read by resting the pointer on it.
- **Test.** Ping, web, download and email flows are followed hop by hop and animated on the drawing. When a flow fails, the packet stops at the device that drops it and the reason names the port, the route or the rule.
- **Type.** A built-in terminal with a small vendor-neutral command language: `ping`, `trace`, `browse`, `resolve`, `show routes`, `add route`, `add rule`, `interface 3 access 10` and more. Commands that change the network edit the same drawing you see.
- **Present.** A presentation mode puts the editing tools away. Click two devices to ask a question, watch the packet go, read the answer hop by hop. Then break something, a device or a cable, and see at once whether the traffic finds another path and which exchanges between end devices stop working. Nothing in the drawing changes.
- **Save.** A project, with all its boards, is kept in the browser while you work and saved as a single `.pixelcake.json` file that you can open again or pass on. There is no server and no account.
- **Hand over.** The board as an image, PNG or SVG, in the light or the dark theme, to a file or to the clipboard. Made from a presentation, it carries the question, the answer and what was broken.
- **Export.** The topology as YAML, which can be loaded back. A Terraform-style export exists only as a sketch.

The interface is in Italian and in English. It starts in Italian in a browser set to Italian and in English in any other, and `IT` / `EN` on the menu bar (and on the welcome screen, and in Settings → Appearance) change it at once; the choice is kept in the browser. `?lang=it` or `?lang=en` in the address chooses it too. The terminal language is English in both. This page names menus and buttons as the English interface does.

Four sample networks are bundled. The welcome screen loads the first: a small company, with offices and Wi-Fi in two VLANs on one trunk, an access point, a switch of servers, a public portal in a DMZ and a firewall with three rules that does NAT towards the Internet. The router hands out the addresses of the offices and of the Wi-Fi, and the two laptops take theirs from it. One of the servers is the DNS server of the inside: it knows the management software, the mail server and the portal by name. It is also under Add → Samples, with the other three: a small office with two subnets and a router; a site with VLANs, a DMZ and a firewall; and two sites joined by a main line and a backup line, made for trying failures.

A sample sets the network settings of the project to its own (Settings → Network): the network new devices start from and its gateway, the DNS server when it has one, a name for each of its VLANs. A device added afterwards is offered an address of the sample's network. All but the small office come with their areas, the rectangles that say what a group of devices is: Internet, Edge, Core, Offices and Servers for the company; Internet, the DMZ and the internal network for the site; the head office and the branch for the two sites.

### The terminal

A sample network names its devices in the language the interface has when it is loaded, and what is on the board keeps its names afterwards: the sales PC of the small company is `PC-Sales` in English and `PC-Vendite` in Italian. The transcripts below were taken in English.

Output on the small office sample (Add → Samples → “Office: two networks and a router”):

```text
pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Reply from 192.168.20.10: hops=5 time=7ms

pixelcake> set gateway of PC-1 to 192.168.10.254
PC-1: gateway set to 192.168.10.254

pixelcake> ping Web-01 from PC-1
Pinging Web-01 (192.168.20.10) from PC-1...
Ping failed (blocked): request: PC-1 uses gateway 192.168.10.254, but Router-1 port 1 on its network is 192.168.10.1
  dropped at: PC-1
```

Routing, VLANs and firewall rules are configured the same way, and every answer says which device decided what:

```text
pixelcake> add route 192.168.30.0/24 via 10.0.0.2 on Router-1
Router-1: route to 192.168.30.0/24 via 10.0.0.2 added

pixelcake> trace Branch-PC from PC-1
Tracing route to Branch-PC (192.168.30.11) from PC-1:
  1  ○ PC-1 (PC)
  2  ○ SW-Office (Switch)
  3  ○ Router-1 (Router)  — routed: 192.168.30.0/24 via 10.0.0.2 (port 3)
  4  ○ Router-2 (Router)  — routed: 192.168.30.0/24 is on port 2
  5  ● Branch-PC (PC)
Trace complete: destination reached.

pixelcake> add rule allow web from untrust to Web-01 on FW-1
FW-1: rule 1 added — allow web from untrust to 192.168.20.10
  Web-01 → 192.168.20.10

pixelcake> ping Web-01 from Ext
Pinging Web-01 (192.168.20.10) from Ext...
Ping failed (blocked): request: firewall FW-1: no rule matches, zone policy untrust → trust denied
  dropped at: FW-1
```

The full command reference is in [docs/terminal-commands.md](docs/terminal-commands.md).

### How a packet is followed

The engine carries a packet the way the network would. At every device that handles it:

1. **Routing.** The device looks the destination up in its routing table: a network one of its interfaces is in, a static route, or its default gateway. The most specific entry wins. No entry, no way: "no route", "no default gateway".
2. **Filtering.** A firewall in transit applies its rules top to bottom; the first that matches decides. When none matches, the zone policy does: a new flow towards a more trusted zone is denied. The reply to an allowed flow passes.
3. **Delivery.** The packet goes to the next address across switches, VLAN by VLAN: a switch port is an access port in one VLAN or a trunk carrying several, and once a switch has a VLAN on any port the ports nobody touched are in VLAN 1, as on real hardware. The shortest path that works is taken, so a port that is down is gone round when the drawing offers another way.

A routing loop, an address used twice, a next hop nobody has, a trunk towards a device that expects no tag: each stops the packet with its own explanation.

**Addresses can come from DHCP.** A port of a router or of a firewall, or a server, hands out a range of addresses to the network cards of its network that ask for one, with the mask and the gateway. The engine has no clock, so a lease is not remembered: it is worked out from the drawing, the same way every time. Cards are served in the order they were drawn, and each takes the lowest address nobody has. A card that gets none has no address, and every question about it says why: no server on its network, a range that is used up, a cable that is missing.

```text
pixelcake> show dhcp
DHCP — 2 pools, 2 leases
POOLS
  Router-Core port 1     192.168.10.100 – 192.168.10.199  gateway 192.168.10.1  dns 192.168.30.10  0 leased, 100 free of 100
  Router-Core port 2     192.168.20.100 – 192.168.20.199  gateway 192.168.20.1  dns 192.168.30.10  2 leased, 98 free of 100
LEASES
  192.168.20.100   Laptop-1 eth0            from Router-Core port 2
  192.168.20.101   Laptop-2 eth0            from Router-Core port 2
  leases are worked out from the drawing: nothing is renewed, nothing is relayed to another network
```

**A device can be called by name.** A server keeps a list of names, each with its address. A network card says which DNS server it asks, or is handed one with its lease. In the terminal a name then works as the target of a question: `ping`, `trace`, `browse`, `mail`, `download`. Nothing is remembered: every time, the question goes to the DNS server and the answer comes back, through the same switches, routes and firewall rules as any other exchange, and it fails in the same ways, with the reason.

```text
pixelcake> ping erp.company.example from PC-Sales
Looking up erp.company.example from PC-Sales (DNS server 192.168.30.10)...
  ✓ DNS request: PC-Sales → Srv-Auth
  ✓ DNS reply: Srv-Auth → PC-Sales
erp.company.example is 192.168.30.30 (answered by Srv-Auth)
Pinging Web-ERP (192.168.30.30) from PC-Sales...
Reply from 192.168.30.30: hops=6 time=9ms
pixelcake> resolve portal.company.example from Remote-Customer
Looking up portal.company.example from Remote-Customer...
Lookup failed: Remote-Customer has no DNS server: it cannot look up portal.company.example
```

### What happens if this breaks

![Presentation mode on the sample with two sites, the head office and the branch each in its area: the main line between R-HQ and R-Branch is cut, the ping from PC-Branch-1 still reaches Srv-File through R-Backup, and the panel counts twelve exchanges that take another path and none that stop](docs/presentation.png)

In presentation mode a click on a device or on a cable, then “Simulate a failure”, treats it as broken. The drawing is not edited: the failure is a list handed to the engine next to the network, and it is gone when the presentation ends. The question on screen is asked again at once.

- A device that is down sends and takes nothing; a cable that is cut carries nothing. The reason of a failed answer names them: `SW-Core is down`, `link R-HQ–R-Branch is down`.
- Between switches the engine takes the shortest path that still works, so a ring or a second cable carries the traffic.
- A router, or a host with two network cards, stops using a route when the interface it leaves by has no working cable left, and takes the next route for that destination: a backup route written after the main one. The answer says so in a note.
- The panel then counts, over every pair of end devices: how many exchanges stop, how many take another path, how many do not change. A click on one of them asks that question.

The terminal sees the same failures while the presentation lasts, so a `ping` typed there agrees with what is on screen.

Every link is attached to a port or a network card at both ends, chosen automatically when you draw it and editable afterwards.

When the engine cannot verify something, it says so in a note instead of answering "it works": a router whose ports have no address (it still lets traffic through, so drawings made before routing existed keep working), the Internet symbol, NAT. The engine is plain TypeScript with no UI dependencies, in [frontend/src/engine](frontend/src/engine). The same network always gives the same answer.

### The drawing as an image

![The screen above as an exported image: the whole board under the name of the project, with its two areas, the path of the answer in green through R-Backup, the cut line in red, and under the drawing the question, its answer, the simulated failure and the effect on the other exchanges](docs/export.png)

**File → Export image…** draws the whole board again as an image. It is not a screenshot: it is made from the same data as the canvas, so it shows every device whatever the zoom, and never a selection or a connection point.

- **PNG**, at one, two or three times the size of the screen, for documents, slides and messages; or **SVG**, a vector file that stays sharp at any size, with its texts still texts.
- Light or dark, whatever the screen shows. The name of the project can be written above the drawing, and the background left out.
- To a file, or to the clipboard where the browser allows it.

Opened from a presentation (the “Export image” button on its bar), it shows what the presentation shows: the two ends of the question, the cables the answer travels on, what is broken. Under the drawing it writes the question, the answer, the simulated failures and what they do to the rest of the network. The image above is the screen of the previous section, exported.

## What it does not do

- **It is not a packet-level simulator.** There is no ARP, MAC learning or dynamic routing. Ping times are derived from the number of hops.
- **Routes are static.** A router knows the networks it is attached to and the routes you wrote. Router sub-interfaces are not modelled: routing between VLANs needs a router port in each.
- **A backup route takes over only when the line is seen to be down.** That is, when the interface of the main route has no working cable left. A next hop that dies behind a switch is not noticed, as with a plain static route on real hardware, and the traffic is lost there. A host has one gateway per network card: there is no gateway redundancy protocol.
- **Simulated failures are not saved.** They belong to the presentation and are gone when it ends.
- **Firewall rules know four services**: ping, web, email and DNS. There are no port numbers, and traffic addressed to the firewall itself is not filtered.
- **Spanning tree is not simulated.** A drawing with redundant links is walked without loops, but no port is blocked.
- **NAT is by service, not by port number.** A port forward is "this service, arriving on this port": there are no TCP or UDP port numbers, and two flows never compete for a translation. A server reached from inside at its published address is not treated apart, and a device behind two layers of NAT is found by name only through the first.
- **A DHCP lease is worked out, not negotiated.** It depends on the drawing alone: there are no lease times, no renewal and no reservations, so the addresses follow the drawing: putting on DHCP a device that was drawn before the others moves the addresses of those after it. A server gives addresses to its own network only (no relay through a router), and a router or firewall port cannot take its own address from DHCP. A simulated failure does not take an address away.
- **DNS is one server, asked every time.** A network card names one DNS server: there is no second one to fall back on. A server answers only for the names written on it: it does not pass a question on to another server, and a public DNS server that is not in the drawing is nobody. Nothing is cached, so every question that uses a name looks it up again. There is no reverse lookup, and there are no aliases or wildcards. Names are for the terminal: the simulation panel and the presentation choose devices from menus.
- **The Internet symbol is a stand-in.** It carries public addresses, with a note, and refuses private ones, as the Internet does. A Cloud symbol with any other name carries everything, with a note.
- **No undo.** It does not exist yet.
- **An image is one board.** A project with several boards is exported one board at a time. Its texts are set in the typeface of the computer, not in the one of the interface, which an image cannot carry along: the same image opened on another computer can have slightly different letters. A PNG of a very large drawing is reduced to what the browser can paint, and the dialog says so.
- **The YAML format is PixelCake's own.** Device names that look like numbers or booleans, and duplicate names, do not survive an export and import.
- **The Terraform export cannot be applied.** It uses placeholder resource types and no provider. Reading existing Terraform state is not implemented.
- **No accounts, no sharing.** A project is a file on your disk. Two browser tabs open on the same project do not see each other's changes: the last one to write wins.

## Run it

You need Node 22 with pnpm 10.

```bash
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173`. Everything runs in the browser: there is nothing else to start.

Your work is kept in the browser's storage, so it is still there after a reload. To keep it for good, or to move it to another computer, save the project to a file with **File → Save** (Ctrl+S). In Chrome and Edge the file is written in place; in other browsers it is downloaded. The format is described in [docs/project-file.md](docs/project-file.md).

The app's icons are bundled with it. Only an icon name typed by hand in a custom device template is fetched from the Iconify API.

## Development

```bash
cd frontend
pnpm test:run      # 2806 tests: engine, terminal, project files, import/export, images, screens, the two languages
pnpm type-check
pnpm lint
pnpm build
```

GitHub Actions runs the same four steps on every push.

```
frontend/src/
  engine/       routing, VLANs, firewall, flow models, failures (pure TypeScript)
  terminal/     command parser and executor
  components/   canvas, panels, windows
  store/        application state (Zustand, persisted in the browser)
  utils/        auto-layout, IP helpers, project files, import and export, images
docs/           terminal command reference, project file format
```

Built with React 19, TypeScript, Vite, React Flow, Zustand and Tailwind CSS. More detail in [ARCHITECTURE.md](ARCHITECTURE.md).

## Where it is going

PixelCake started from one idea: a single place to **design** an infrastructure, **test** it, and hand it to automation as **code** (Terraform, YAML), so that the people who draw networks and the people who automate them work on the same thing.

Today the first two exist in a basic form and the third is only a sketch. The steps below are ordered to get there for real: an export can only be as correct as the model behind it.

## What is next

1. Undo and redo.
2. In the engine: spanning tree.

## License

Copyright © 2025–2026 [@Phil-pje](https://github.com/Phil-pje).

PixelCake is released under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE).

The bundled icons keep their own licences: Material Design Icons (Apache 2.0), Lucide (ISC), Carbon (Apache 2.0) and Solar (CC BY 4.0, by 480 Design), obtained through [Iconify](https://iconify.design). So do the two typefaces of the interface, which travel with the app: Inter and JetBrains Mono, both under the SIL Open Font License 1.1.

## Contact

Open an issue, or write to pixelcake.dev@gmail.com.
