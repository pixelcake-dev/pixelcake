# Changelog

All notable changes to PixelCake project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- **The backend.** The FastAPI service, its database and admin panel, and the API client in the frontend are gone: the app runs entirely in the browser. Entries further down that mention the backend describe earlier versions.
- **The login page.** It asked for nothing and checked nothing: the app now opens straight on the designer. The particle library it used (`@tsparticles/*`) is no longer a dependency.
- **Interface entries that did nothing**: "Esporta come PNG", "Annulla", "Ripristina" and "Taglia" in the menus, "Preferiti" and "Account" in the sidebar, "Configurazione..." and "Evidenzia Percorso" in the right-click menus.
- **Settings that changed nothing**: the "Utente" tab (a profile that was stored and never used) and the language, date format and unit preferences.

### Added
- **Project files**: a project, with all its canvases, is kept in the browser and saved as a single `.pixelcake.json` file (File → Salva, Ctrl+S, Salva con nome…, Apri…). In Chrome and Edge the file is written in place; elsewhere it is downloaded. Format reference in `docs/project-file.md`.
- **Explorer**: rename the project and its canvases in place; a hint shows when there are changes not yet saved to a file.
- **Bundled icons**: the icons the app uses are shipped with it instead of being fetched from the Iconify API (`pnpm icons:bundle`).
- **BulkAddDeviceModal v2**: Table-based interface with configurable/standard device sections
  - ConfigurableDeviceRow: Dynamic rows for Switch/Router/Firewall with portCount dropdown
  - Dropdown for port selection (8/24/48 ports for switches, custom portOptions per template)
  - "+ Aggiungi Switch/Router/Firewall" button with mini-menu
  - Search filtering across both configurable and standard device sections
  - Custom scrollbar (react-custom-scrollbars-2, autoHeightMax: 500px)
- **generateDefaultPorts()**: Auto-generation realistic port configurations
  - Switch: Port 1 trunk (VLAN 1,10,20), others access (VLAN 1) + PoE enabled
  - Router: Port 1 WAN (NAT enabled), others LAN
  - Firewall: Port 1 WAN (untrust + IPS), Port 2 DMZ, others LAN (trust)
- **generateDefaultNIC()**: Auto-generation NICs with MAC addresses
  - Format: `02:XX:XX:XX:XX:XX` (locally administered unicast)
  - Auto-generated with `generateMacAddress()` from ipHelpers
  - Default: eth0 interface, auto speed, enabled
- **NICList custom scrollbar**: react-custom-scrollbars-2 integration
  - AutoHeightMax: 400px
  - Accent color thumb with 6px border-radius
  - Subtle 2px track line matching BulkAddDeviceModal design

### Changed
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
- The theme no longer flips between light and dark at every reload.
- The welcome screen appears only on an empty project, not on every empty canvas.
- The icon picker offered an icon that does not exist (`mdi:rack`).
- **Bulk devices now include port configurations** for Switch/Router/Firewall
  - Each device created with `ports: Port[]` array matching portCount
  - Realistic defaults: VLAN assignments, PoE settings, NAT, security zones
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
