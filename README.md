# 🍰 PixelCake

**Infrastructure, piece by piece.**

PixelCake is a browser-based designer for small networks. You draw the network, configure it, then ask it a question: does this PC reach that server? If it does not, you see where the traffic stops and why.

![The sample network with the terminal: a ping that works, then the same ping with a wrong gateway, stopped at the PC with the reason](docs/screenshot.png)

**Status:** early prototype. It is good for exploring and explaining a small network. Do not use its answers to validate a real one: the [limits](#what-it-does-not-do) are listed below.

## What it does

- **Draw.** Devices, links, VLANs, ports and network cards on an interactive canvas. 20 device types and 5 link types are built in and can be customised. Auto-layout, multi-selection, copy and paste, and several boards per project.
- **Test.** Ping, web, download and email flows are checked hop by hop and animated on the drawing. When a flow fails, the packet stops at the device that blocks it and the reason is shown.
- **Type.** A built-in terminal with a small vendor-neutral command language: `ping`, `trace`, `show`, `set`, `connect`, `add vlan` and a few more. Commands that change the network edit the same drawing you see.
- **Export.** The topology as YAML, which can be loaded back. A Terraform-style export exists only as a sketch.

The interface is in Italian. The terminal language is English.

### The terminal

Output on the bundled sample network (two subnets, one router):

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

The full command reference is in [docs/terminal-commands.md](docs/terminal-commands.md).

### What the check looks at

The engine walks the shortest path between two devices and applies these rules in order:

1. Both endpoints exist and have a valid IPv4 address.
2. A physical path exists.
3. No disabled port or network card at either end of a link on the way.
4. VLAN membership on the switches crossed.
5. Across subnets: a router or firewall is on the path, and the source's gateway is the address of the router port the packet arrives on.
6. Firewall security zones. A new flow from a less trusted zone is denied; the reply to an allowed flow passes.

Every link is attached to a port or a network card at both ends, chosen automatically when you draw it and editable afterwards. Router and firewall ports carry their own addresses.

When the engine cannot verify something, it says so in a note instead of answering "it works". The engine is plain TypeScript with no UI dependencies, in [frontend/src/engine](frontend/src/engine). The same network always gives the same answer.

## What it does not do

- **It is not a packet-level simulator.** There is no ARP, MAC learning, routing table, spanning tree, NAT or ACL. Ping times are synthetic.
- **It only tries the shortest path.** If that path is blocked, it does not look for another one.
- **It only checks the first router.** With more than one router on the path, routing between them is assumed and the result says so.
- **Firewall rules are a fixed table of zones.** You cannot write your own rules yet.
- **Some settings are stored but not evaluated:** STP, NAT and per-port VLANs.
- **No undo, no image export.** Both are in the menu, disabled.
- **The YAML format is PixelCake's own.** Device names that look like numbers or booleans, and duplicate names, do not survive an export and import.
- **The Terraform export cannot be applied.** It uses placeholder resource types and no provider. Reading existing Terraform state is not implemented.
- **No authentication.** See the warning in [Run it](#run-it).

## Run it

You need Node 22 with pnpm 10. The backend is optional and needs Python 3.10 or later.

### Frontend only

```bash
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173`. Drawing, testing, the terminal and the exports all work. The drawing is kept in the browser. The app reports that the backend is unreachable; named projects need it.

Device icons are fetched from the Iconify API while you use the app, so they need an internet connection.

### With the backend

The backend is a small FastAPI service that stores projects, boards and templates in a SQLite file. The check and the terminal never go through it.

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env         # Linux/macOS: cp .env.example .env
alembic upgrade head
python -m scripts.seed_templates
python main.py
```

It listens on port 8000: API docs at `/docs`, the terminal reference at `/docs/terminal`, an admin panel at `/admin`.

> **Warning.** The backend has no login: it uses one fixed user and the admin panel is open. For that reason it only listens on the machine it runs on (`127.0.0.1`). Do not expose it to a network or run it on a server.

On Windows, once both parts are installed, `start.bat` starts them together and opens the browser.

## Development

```bash
cd frontend
pnpm test:run      # 443 tests: engine, terminal, import/export, sync, screens
pnpm type-check
pnpm lint
pnpm build
```

GitHub Actions runs the same four steps on every push. The backend has no automated tests.

```
frontend/src/
  engine/       reachability check and flow models (pure TypeScript)
  terminal/     command parser and executor
  components/   canvas, panels, windows
  store/        application state (Zustand, persisted in the browser)
  utils/        auto-layout, IP helpers, import and export
  api/          client for the backend
backend/
  main.py       FastAPI app
  app/          models, routers, admin panel
  alembic/      database migrations
docs/           terminal command reference
```

Built with React 19, TypeScript, Vite, React Flow, Zustand and Tailwind CSS. The backend uses FastAPI, SQLAlchemy and SQLite. More detail in [ARCHITECTURE.md](ARCHITECTURE.md).

## Where it is going

PixelCake started from one idea: a single place to **design** an infrastructure, **test** it, and hand it to automation as **code** (Terraform, YAML), so that the people who draw networks and the people who automate them work on the same thing.

Today the first two exist in a basic form and the third is only a sketch. The steps below are ordered to get there for real: an export can only be as correct as the model behind it.

## What is next

1. Undo and redo.
2. Save and open a project as a file, so the app runs without the backend.
3. Export the drawing as an image.
4. Routing tables, ARP and per-port VLANs, so the check can follow a packet across more than one router.

## License

Copyright © 2025–2026 [@Phil-pje](https://github.com/Phil-pje).

PixelCake is released under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE).

## Contact

Open an issue, or write to pixelcake.dev@gmail.com.
