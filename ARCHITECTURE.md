# ARCHITECTURE.md

Detailed technical reference for PixelCake. To install and run it, see [README.md](./README.md).

## State Management (Zustand Stores)

All stores use Zustand with LocalStorage persistence.

### networkStore (`frontend/src/store/networkStore.ts`)
- Devices, connections, network settings
- Canvas viewport state (x, y, zoom) - persisted and synced in real-time
- Device/connection counters (persisted to avoid ID collisions)
- Connection mode state (isConnecting, connectionStart)
- **Multi-selection state** (selectedDeviceIds, clipboard) - NOT persisted, resets on reload
- **Copy/Paste functions** (copySelection, paste) - ID remapping + position offset (+50px)
- Auto-layout triggers
- **Backend sync state**: `currentProjectId`, `currentCanvasId`, `isSyncing`, `lastSyncError`, `autoSaveEnabled`
- **Backend sync actions**: `loadFromBackend()`, `saveToBackend()`, `setCurrentCanvas()`, `setAutoSave()`
- **Auto-Save**: All modification actions trigger debounced save after 2 seconds

### projectStore (`frontend/src/store/projectStore.ts`)
- **State**: projects list, currentProject, canvases list, loading/error states
- **Actions**: loadProjects, loadProject, createNewProject, updateCurrentProject, deleteCurrentProject, loadCanvases, createNewCanvas, deleteCanvasById

### simulationStore (`frontend/src/store/simulationStore.ts`)
- Packet simulation state (isRunning, path, currentStep)
- Flow model selection (ping, email, web, download)

### uiStore (`frontend/src/store/uiStore.ts`)
- UI state, modal controls (including `newProject`, `openProject`, `saveAsProject`), context menus
- Dark mode (persisted), magnification state, sidebar panel state

### templateStore (`frontend/src/store/templateStore.ts`)
- Device and connection templates with auto-update
- Custom device types with icons and Terraform fields
- Connection types with line styles and colors
- Template capabilities: supportsVLAN, supportsSTP, supportsPorts, supportsNICs
- LocalStorage key: `pixelcake-templates-v8`

### userStore (`frontend/src/store/userStore.ts`)
- User preferences and settings

## Core Components

### Canvas
- **NetworkCanvas** (`frontend/src/components/Canvas/NetworkCanvas.tsx`) - React Flow wrapper with real-time viewport sync
- **NetworkDevice** (`frontend/src/components/Canvas/NetworkDevice.tsx`) - Custom node component
- **CustomEdge** (`frontend/src/components/Canvas/CustomEdge.tsx`) - Custom edge with connection type styling
- **ParticleEdge** (`frontend/src/components/Canvas/ParticleEdge.tsx`) - Particle flow animation wrapper with CSS offset-path
- **PacketAnimation** (`frontend/src/components/Canvas/PacketAnimation.tsx`) - Geometric handle calculation for animations

### WelcomeScreen (`frontend/src/components/WelcomeScreen.tsx`)
- Excalidraw-style minimalist transparent overlay on canvas (NOT popup)
- Shows when no project is loaded
- "Build piece by piece" workflow (3 steps), Quick Start actions, GitHub links
- "Non mostrare più" checkbox → localStorage (`pixelcake-hide-welcome`)
- Actions: Nuovo Progetto, Apri Progetto, Carica Sample Topology
- Auto-dismiss on any action, manual "Mostra Welcome Screen" from Help menu
- State: `useUIStore.showWelcomeScreen` + `useProjectStore.currentProject`

### Modals (Enterprise Style)
- **InspectorModal** - Device configuration: 2-column layout, tabs (General + Terraform + Ports + NICs), VLAN/STP fields
- **ConnectionInspectorModal** - Connection properties editor
- **SettingsModal** - App settings with tabbed interface
- **BulkAddDeviceModal** - Bulk device creation with table-based interface
  - Two sections: Configurable Devices (Switch/Router/Firewall with portCount dropdown) + Standard Devices (PC/Server/Database with fixed 1 NIC)
  - ConfigurableDeviceRow: Dynamic rows with id, templateType, portCount, quantity
  - Auto-generation: Ports and NICs with realistic defaults (VLAN, PoE, NAT, MAC)
  - Search filtering + custom scrollbar (react-custom-scrollbars-2, autoHeightMax: 500px)

### Project Management Modals
- **NewProjectModal** - sm (448px), minHeight 550px, fullWidth inputs, `.modal-error-box`
- **OpenProjectModal** - md (672px), minHeight "80vh", maxHeight "calc(98vh - 40px)", autoHeightMax 1200, `.project-card` CSS
- **SaveAsModal** - sm (448px), minHeight 550px, `.modal-info-box`

### UI Components
- **TabContainer** - Reusable tab system for modals
- **VLANInput** - Multi-value input with tag chips (range 1-4094)
- **DeviceTypeDisplay** - Read-only device type preview with icon
- **PortGrid** / **PortConfigPanel** - Port display grid + configuration panel
- **NICList** / **NICConfigPanel** - NIC list with custom scrollbar + configuration panel
- **Input/Select** - Compact form controls (`py-1.5`, accent color on focus)

### Explorer Panel (`frontend/src/components/Sidebar/ExplorerPanel.tsx`)
- VS Code-style interface for project/canvas navigation
- Project section, canvases list (click to switch, inline creation, delete protection)
- Quick actions: manual save, "Cambia Progetto"
- Empty state: "Nuovo Progetto" and "Apri Progetto" buttons

### Top Menu Bar (`frontend/src/components/TopMenuBar.tsx`)
- File Menu: Nuovo Progetto, Apri Progetto, Salva, Salva con nome
- Help Menu: Mostra Welcome Screen, Note Programma, Documentazione API

## Reusable CSS Classes (`frontend/src/index.css`)

| Category | Classes |
|----------|---------|
| Modal messages | `.modal-error-box`, `.modal-info-box` |
| Explorer | `.explorer-button`, `.explorer-button-accent`, `.explorer-button-dashed`, `.explorer-canvas-card`, `.explorer-empty-state` |
| Project cards | `.project-card`, `.project-card.selected` |
| NIC list | `.nic-list`, `.nic-card`, `.nic-card-selected` |

## Key Algorithms

### Network Engine (`frontend/src/engine/`)
Pure, deterministic reachability check: shortest path (BFS) evaluated hop by hop
(interface state, VLAN continuity, subnet/gateway, firewall zones) plus the flow
models (ping, web, download, email). Used by both the simulation panel and the
terminal.

- `interfaces.ts` — every link end is attached to one interface of its device
  (a port or a NIC). Owns the binding rules: first free interface on creation,
  migration of old unbound data on load (`normalizeBindings`), cleanup when a
  port/NIC is removed. A firewall with security zones is never bound
  automatically: the user picks the port, and with it the zone.
- `trace.ts` — the hop-by-hop walk. Across subnets the source's gateway must be
  the address of the router port the packet arrives on. Anything not verified
  (unbound link, router without port addresses, routing between routers) is
  reported as a note, never as a silent success.
- `flows.ts` — request/reply plans. A reply leg is the return traffic of an
  allowed flow, so firewalls let it through.
- `topology.ts` — `mirrorPrimaryNic`: on a device with NICs the device-level
  ip/subnet/gateway are a mirror of the first NIC, kept in step by the store.

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

### Connection Cleanup (`frontend/src/store/networkStore.ts`)
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

## Backend Architecture

### Database Layer
- `backend/app/database.py` - Async engine (aiosqlite/asyncpg)
- SQLite dev (`pixelcake.db`), PostgreSQL prod (via `DATABASE_URL`)
- Async session: `AsyncSessionLocal`

### Database Models (`backend/app/models/`)
1. **User** - Accounts and authentication
2. **Project** - Network design projects (metadata)
3. **Canvas** - Network diagrams (devices, connections as JSONB)
4. **ProjectVersion** - Version history
5. **DeviceTemplate** - Device type templates
6. **ConnectionTemplate** - Connection type templates
7. **UserPreferences** - User settings

### API Endpoints

**System & Admin:**
- `GET /` - Root health check
- `GET /api/health` - API health
- `GET /api/admin/health` - System metrics (JSON)
- `GET /dashboard` - Health dashboard (HTML)
- `GET /admin` - SQLAdmin panel

**Projects (5):**
- `GET /api/projects` - List all (with canvas count)
- `POST /api/projects` - Create (auto-creates default canvas)
- `GET /api/projects/{id}` - Get with canvases list
- `PUT /api/projects/{id}` - Update metadata
- `DELETE /api/projects/{id}` - Delete (cascade)

**Canvases (5):**
- `GET /api/projects/{id}/canvases` - List all in project
- `POST /api/projects/{id}/canvases` - Create new
- `GET /api/projects/{id}/canvases/{cid}` - Get with topology
- `PUT /api/projects/{id}/canvases/{cid}` - Update data
- `DELETE /api/projects/{id}/canvases/{cid}` - Delete (min 1 protected)

**Templates (9):**
- `GET/POST /api/templates/devices` - List/create device templates
- `PUT/DELETE /api/templates/devices/{id}` - Update/delete (user-owned)
- `GET/POST /api/templates/connections` - List/create connection templates
- `PUT/DELETE /api/templates/connections/{id}` - Update/delete
- `POST /api/templates/sync` - Bulk sync (migration helper)

### Admin Panel (`backend/app/admin/`)
- SQLAdmin with 7 model views
- Health monitoring: `check_database()`, `check_api()`, `get_db_stats()`, `get_db_size()`, `get_pg_metrics()`
- Dashboard: Auto-refresh 30s, Tabler CSS

### Migrations
- Alembic: `alembic revision --autogenerate -m "desc"`, `alembic upgrade head`

## Backend-Frontend Integration

### API Layer (`frontend/src/api/`)
- **HTTP Client** (`client.ts`): Generic fetch wrapper, `HTTPError` class, configurable base URL
- **Projects API** (`projects.ts`): 5 functions
- **Canvases API** (`canvases.ts`): 5 functions
- **Templates API** (`templates.ts`): 9 functions
- **Debounce** (`utils/debounce.ts`): Generic with cancel, 2s for auto-save

### Data Flow
```
Frontend → Backend: User Action → Store → Debounced Save (2s) → API → Database
Backend → Frontend: API Request → Query → JSON Response → Store → UI Refresh
```

### Storage Strategy
- **LocalStorage**: Cache for offline access and fast initial load
- **Backend Database**: Source of truth
- **Sync Model**: Auto-save (2s debounce)

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

### Phase 1: Export/Import IaC (High Priority) ⏳
- **POST /api/export** - FlowMap → Terraform `.tf` / YAML
- **POST /api/import** - `.tfstate` → FlowMap
- Frontend: Export/Import modals with preview and validation

### Phase 2: Authentication (Medium Priority) ⏳
- JWT auth (register, login, refresh, logout)
- Protected routes, token management
- Remove hardcoded user ID

### Phase 3: LocalStorage Migration (Medium Priority) ⏳
- Detect existing data, prompt migration
- Offline mode with fallback + sync
- Backup export/restore

### Phase 4: Performance & UX (In Progress) ⏳
- **Done**: Toast notifications, Welcome screen, Z-index fixes
- **TODO**: Memoize nodeTypes/edgeTypes, lazy loading modals, virtualization, loading skeletons, undo/redo

### Phase 5: Advanced Features (Future) 💡
- Server-side simulation (OSPF, BGP)
- Version history & real-time collaboration (WebSocket)
- Template marketplace
- Export PNG/SVG/PDF, Ansible playbooks
- PWA & offline mode
