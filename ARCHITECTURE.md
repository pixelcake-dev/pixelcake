# ARCHITECTURE.md

Detailed technical reference for PixelCake. To install and run it, see [README.md](./README.md).

## State Management (Zustand Stores)

All stores use Zustand. There is no server: what must survive a reload is kept in the browser's localStorage, and a project is saved for good as a file (see [Projects and files](#projects-and-files)).

### networkStore (`frontend/src/store/networkStore.ts`)
- The canvas on screen: devices, connections, viewport (x, y, zoom), device/connection counters
- Project-wide network settings (`globalNetworkSettings`)
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
- Packet simulation state (isRunning, path, currentStep)
- Flow model selection (ping, email, web, download)

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
- **NetworkDevice** (`frontend/src/components/Canvas/NetworkDevice.tsx`) - Custom node component
- **CustomEdge** (`frontend/src/components/Canvas/CustomEdge.tsx`) - Custom edge with connection type styling
- **ParticleEdge** (`frontend/src/components/Canvas/ParticleEdge.tsx`) - Particle flow animation wrapper with CSS offset-path
- **PacketAnimation** (`frontend/src/components/Canvas/PacketAnimation.tsx`) - Geometric handle calculation for animations

### WelcomeScreen (`frontend/src/components/WelcomeScreen.tsx`)
- Excalidraw-style minimalist transparent overlay on canvas (NOT popup)
- Shows on an empty project: a single canvas with nothing on it
- What the app is for in three steps (draw, configure, ask), the ways to start, links
- "Non mostrare più" checkbox → localStorage (`pixelcake-hide-welcome`)
- Actions: Nuovo Progetto (form), Apri Progetto (file picker), Carica la rete di esempio
- Auto-dismiss on any action, manual "Mostra la schermata di benvenuto" from the Aiuto menu
- State: `useUIStore.showWelcomeScreen`, the number of devices on screen and the number of canvases

### Modals (Enterprise Style)
- **InspectorModal** - Device configuration in tabs: Generale, Porte (switch, router, firewall) or Schede di rete (end devices), Rotte (router, firewall: `ui/RoutesPanel`, with the routing table the engine would read from the form), Regole (firewall: `ui/FirewallRulesPanel`, ordered rules). Routes and rules are validated on save (`utils/networkConfigValidation.ts`)
- **HelpModal** - The guide, in three tabs: how to use the app, the terminal commands (rendered from `COMMAND_REFERENCE`, the table the terminal's `help` prints), information
- **ConnectionInspectorModal** - Connection properties editor
- **SettingsModal** - App settings with tabbed interface
- **BulkAddDeviceModal** - Bulk device creation with table-based interface
  - Two sections: Configurable Devices (Switch/Router/Firewall with portCount dropdown) + Standard Devices (PC/Server/Database with fixed 1 NIC)
  - ConfigurableDeviceRow: Dynamic rows with id, templateType, portCount, quantity
  - Auto-generation: Ports and NICs with realistic defaults (VLAN, PoE, NAT, MAC)
  - Search filtering + custom scrollbar (react-custom-scrollbars-2, autoHeightMax: 500px)

### Project Modal
- **NewProjectModal** - sm (448px), minHeight 550px, fullWidth inputs, `.modal-error-box`. Creates a local project: name, description, network settings
- Opening and saving a project have no modal: they go through the file picker (`frontend/src/utils/projectFileAccess.ts`)

### UI Components
- **TabContainer** - Reusable tab system for modals
- **VLANInput** - Multi-value input with tag chips (range 1-4094)
- **DeviceTypeDisplay** - Read-only device type preview with icon
- **PortGrid** / **PortConfigPanel** - Port display grid + configuration panel
- **NICList** / **NICConfigPanel** - NIC list with custom scrollbar + configuration panel
- **Input/Select** - Compact form controls (`py-1.5`, accent color on focus)

### Explorer Panel (`frontend/src/components/Sidebar/ExplorerPanel.tsx`)
- Project name and description, editable in place (`components/ui/InlineEdit.tsx`); a hint shows when there are changes not yet saved to a file
- Canvases list: click to switch, create and rename in place, delete (not the last one), device count
- Buttons: "Salva su file", "Apri file…"

### Top Menu Bar (`frontend/src/components/Toolbar/TopMenuBar.tsx`)
- File Menu: Nuovo progetto…, Apri…, Salva (Ctrl+S), Salva con nome…
- Aiuto Menu: Guida, Comandi del terminale, Mostra la schermata di benvenuto, Informazioni
- No entry is there to announce a feature: an entry that cannot act (nothing selected to copy) is disabled only for as long as that is true

## Reusable CSS Classes (`frontend/src/index.css`)

| Category | Classes |
|----------|---------|
| Modal messages | `.modal-error-box`, `.modal-info-box` |
| Explorer | `.explorer-button`, `.explorer-button-accent`, `.explorer-button-dashed`, `.explorer-canvas-card` |
| NIC list | `.nic-list`, `.nic-card`, `.nic-card-selected` |

## Key Algorithms

### Network Engine (`frontend/src/engine/`)
Pure and deterministic: no React, no Zustand, no side effects; the same network
always gives the same answer. It follows one packet the way the network would
carry it, and it is used by the simulation panel and by the terminal alike.

The walk (`trace.ts`) alternates two steps until the destination answers or
something drops the packet:

1. **a layer 3 decision** at the device holding the packet: routing table
   lookup, then the firewall;
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
- `vlan.ts` — how a switch port treats frames (`portVlanMode`: access or
  trunk). A switch is VLAN-aware once one of its ports has a VLAN; the others
  are then access ports in VLAN 1.
- `l2.ts` — the delivery step: a breadth-first search, in connection order,
  for the device that answers for an address, crossing bridges VLAN by VLAN,
  routers and firewalls without interface addresses (transparent; a firewall
  still applies its policy) and devices that are not simulated (Internet
  symbol, load balancer). The shortest way that works is the one taken. When
  nobody answers, `explain` picks the most useful reason: what happened on the
  cables of the way to the device that should have answered.
- `trace.ts` — the walk itself, loop detection, and the notes: whatever is not
  verified (a link end not on a port, a router without interface addresses,
  the Internet symbol, NAT) is reported as a note, never as a silent success.
- `flows.ts` — request/reply plans per flow model (ping, web, download, email)
  and the service each leg is to a firewall. A reply leg is the return traffic
  of an allowed flow, sent back to the address the request came from.
- `interfaces.ts` — every link end is attached to one interface of its device
  (a port or a NIC). Owns the binding rules: first free interface on creation,
  migration of old unbound data on load (`normalizeBindings`), cleanup when a
  port/NIC is removed. A firewall with security zones is never bound
  automatically: the user picks the port, and with it the zone.
- `topology.ts` — what a device does with traffic that is not for it
  (`forwardingRole`: router, bridge, passthrough, host); name and address
  resolution for the terminal; `mirrorPrimaryNic`: on a device with NICs the
  device-level ip/subnet/gateway are a mirror of the first NIC, kept in step
  by the store.

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
  example of that document.

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

### Bulk Device Helpers (`frontend/src/utils/bulkDeviceHelpers.ts`)
- `generateDefaultPorts(portCount, deviceType)` - Switch: trunk+access+PoE, Router: WAN+LAN+NAT, Firewall: security zones
- A new router or firewall gets no gateway (on a router the gateway is its default route); switches and end devices get the one of the project
- `generateDefaultNIC(ip, subnet, gateway)` - Auto MAC, eth0, auto speed
- Sequential naming: `${type}-${existingCount}`
- Grid positioning: `generateGridPositions()` with random offsets (-25/+25px)
- IP assignment: `findNextAvailableIP()` skips .1 gateway

## Data Types

### FlowMap (Central Schema)
```typescript
interface FlowMap {
  meta: { name, version, created?, modified? }
  nodes: NetworkDevice[]
  edges: NetworkConnection[]
}
```

### NetworkDevice
- Basic: `id, type, label, ip, subnet, gateway, vendor, location, position`
- `templateId?: string` - Specific template ID (e.g., 'tpl-mailserver')
- `vlan?: number[]` - VLAN IDs (1-4094)
- `stp?: { enabled, mode, priority }` - STP configuration
- `portCount?, ports?: Port[]` - Network ports (Switch/Router/Firewall)
- `nics?: NetworkInterfaceCard[]` - NICs for end devices
- `routes?: StaticRoute[]` - Static routes (Router/Firewall): `{ id, destination, nextHop, description? }`, destination in CIDR form. `gateway` is the default route
- `firewallRules?: FirewallRule[]` - Ordered rules (Firewall): `{ id, action: 'allow'|'deny', service: 'any'|'ping'|'web'|'email', source, destination, enabled?, description? }`; source and destination are `any`, a zone, an address or a network

### Port
```
id: number, enabled: boolean, speed: '10M'|'100M'|'1G'|'2.5G'|'10G'|'auto',
portType?: 'access'|'trunk'|'hybrid'|'wan'|'lan'|'dmz',
vlan?: number|number[], poe?: boolean, securityZone?: string, description?: string,
ip?: string, subnet?: string   // L3 address of a router/firewall port
```

### NetworkInterfaceCard
```
id: string, name: string, enabled: boolean, speed: string,
ip: string, subnet: string, gateway: string, mac?: string, description?: string
```

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
- `pixelcake-ui-v1`: theme
- Every change is written at once: closing the tab loses nothing
- A write that fails (storage full) does not crash the app: `utils/safeStorage.ts` shows one message asking to save the project to a file
- Two tabs open on the same project do not see each other: the last one to write wins. The canvas id kept next to the canvas data prevents one canvas from being shown as another, not the loss of the other tab's edits

### On disk (`.pixelcake.json`)
- Format reference: [docs/project-file.md](docs/project-file.md)
- `utils/projectFile.ts` (pure): `serializeProject()`, `parseProjectFile()`. The parser never throws: it returns the project with the list of repairs it made, or a message for the user
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
| Selezione globale spontanea | 5px movement threshold + `selectionMode="full"` |
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
