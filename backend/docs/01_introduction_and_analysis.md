# 1. Introduzione e Analisi Frontend

## 📋 Indice
- [1.1 Panoramica Progetto](#11-panoramica-progetto)
- [1.2 Stack Tecnologico](#12-stack-tecnologico)
- [1.3 Motivazioni Architetturali](#13-motivazioni-architetturali)
- [1.4 Analisi Frontend Completa](#14-analisi-frontend-completa)
- [1.5 LocalStorage Attuale](#15-localstorage-attuale)
- [1.6 Sample Topology](#16-sample-topology)
- [1.7 Dimensioni Dati](#17-dimensioni-dati)

---

## 1.1 Panoramica Progetto

**PixelCake** è un visual infrastructure designer che permette di progettare architetture di rete in modo visuale e esportarle come Infrastructure as Code (Terraform, YAML) o importare topologie esistenti da file `.tfstate`.

### Caratteristiche Principali

- **Canvas visuale** basato su React Flow 11.11.4
- **Gestione dispositivi** con configurazione avanzata (VLAN, STP, Ports, NICs)
- **Auto-layout intelligente** (hierarchical e subnet-grouped)
- **Simulazione pacchetti** con animazioni
- **Template system** per device e connection types
- **Persistenza** attualmente su LocalStorage → **Obiettivo**: migrazione a PostgreSQL

### Problema da Risolvere

Attualmente tutti i dati sono salvati nel browser (LocalStorage):
- ❌ Non sincronizzati tra dispositivi
- ❌ Rischio perdita dati (clear cache)
- ❌ Nessuna collaboration
- ❌ Nessun version control

### Soluzione Proposta

Backend centralizzato con:
- ✅ Database PostgreSQL con JSONB
- ✅ Autenticazione JWT
- ✅ Projects cloud sync
- ✅ Version history
- ✅ Export Terraform (futuro)

---

## 1.2 Stack Tecnologico

### Frontend (Esistente)
| Tecnologia | Versione | Uso |
|------------|----------|-----|
| React | 19.1.1 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 7.1.7 | Build tool |
| React Flow | 11.11.4 | Canvas visualization |
| Zustand | 5.0.8 | State management + persistence |
| Tailwind CSS | 3.4.18 | Styling |
| Iconify + Lucide | - | Icons |
| Vitest | - | Testing |

### Backend (Da Implementare)
| Tecnologia | Versione | Uso |
|------------|----------|-----|
| Python | 3.10+ | Linguaggio base |
| FastAPI | 0.115.0+ | Web framework |
| Uvicorn | 0.32.0+ | ASGI server |
| SQLAlchemy | 2.0+ | ORM async |
| PostgreSQL | 14+ | Database (JSONB support) |
| Alembic | 1.13.0+ | Migrations |
| python-jose | 3.3.0+ | JWT tokens |
| passlib | 1.7.4+ | Password hashing (bcrypt) |
| asyncpg | 0.29.0+ | PostgreSQL async driver |
| SQLAdmin | 0.16.0+ | Admin panel |

### Strategia Database

**JSONB Hybrid Approach**:
- Schema relazionale per entità core (User, Project metadata)
- Colonne JSONB per dati flessibili (devices[], connections[], settings)
- GIN indexes per performance su JSONB
- Evoluzione schema senza breaking changes

**Perché JSONB invece di tabelle normalizzate?**

| Criterio | JSONB | Normalizzato |
|----------|-------|--------------|
| Flessibilità schema | ✅ Eccellente (nuovi campi senza migration) | ❌ Rigido (ALTER TABLE) |
| Complessità query | ✅ Semplice (JSON operators) | ❌ Complesso (JOIN multipli) |
| Performance lettura | ✅ 1 query per FlowMap | ❌ N query + JOIN |
| Performance scrittura | ✅ 1 UPDATE | ❌ Multiple INSERTs/UPDATEs |
| Dimensioni dati | ~50-70 KB/project | ~50-70 KB/project |
| Matching frontend | ✅ Identico (FlowMap interface) | ❌ Trasformazione necessaria |
| Indexing | ✅ GIN index su JSONB | ✅ B-tree su colonne |

**Conclusione**: JSONB è ideale per PixelCake perché:
1. Schema frontend dinamico (device types custom, ports/NICs variabili)
2. FlowMap già serializzabile JSON
3. Export/Import richiedono formato JSON
4. Performance eccellente con GIN indexes

---

## 1.3 Motivazioni Architetturali

### Perché FastAPI?

```python
# Pro FastAPI
✅ Performance native async (+ veloce di Flask/Django)
✅ Type hints built-in (Pydantic integration)
✅ Auto-generated OpenAPI docs
✅ WebSocket support (futuro: real-time collaboration)
✅ Dependency injection elegante
✅ Validation automatica request/response

# Esempio endpoint tipico
from fastapi import FastAPI, Depends
from app.schemas import ProjectResponse
from app.utils.dependencies import get_current_user

@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    # Type safety garantita + validation automatica
    project = await Project.get_by_id(project_id)
    return project  # Auto-serialized con Pydantic
```

### Perché SQLAlchemy 2.0 Async?

```python
# SQLAlchemy 2.0 async pattern
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

# Queries non-blocking
async with AsyncSession(engine) as session:
    result = await session.execute(select(Project).where(Project.user_id == user_id))
    projects = result.scalars().all()

# Benefit:
# - Non blocca event loop durante query DB
# - Concurrency su richieste multiple
# - Migliore performance sotto carico
```

### Perché PostgreSQL invece di SQLite?

| Feature | PostgreSQL | SQLite |
|---------|------------|--------|
| JSONB support | ✅ Nativo con operators | ❌ JSON text only |
| GIN indexes | ✅ Full support | ❌ Non disponibile |
| Concurrent writes | ✅ Row-level locking | ❌ Database-level lock |
| Production ready | ✅ Scaling illimitato | ❌ Single-user apps |
| Full-text search | ✅ Built-in | ❌ Limitato |
| JSONB operators | ✅ `@>`, `?`, `?|`, etc. | ❌ N/A |

**Strategia implementazione**:
- Development: SQLite (setup veloce)
- Production: PostgreSQL (scalabile)
- Stessa codebase (SQLAlchemy abstraction)

---

## 1.4 Analisi Frontend Completa

### TypeScript Interfaces Chiave

#### NetworkDevice (frontend/src/types/network.ts)

```typescript
export interface NetworkDevice {
  // Identificazione
  id: string;                    // dev-0, dev-1, dev-2...
  type: DeviceType;              // Dynamic string (PC, Switch, Router, Firewall, Server...)
  label: string;                 // User-friendly name

  // Rete base (legacy - per backward compatibility)
  ip: string;                    // Es. "192.168.1.10"
  subnet: string;                // Es. "255.255.255.0"
  gateway: string;               // Es. "192.168.1.1"

  // Metadata
  vendor?: string;               // Es. "Cisco", "MikroTik", "Fortinet"
  location?: string;             // Es. "HQ - Sala Server"

  // React Flow posizione
  position: { x: number; y: number };  // Canvas coordinates

  // Advanced Config (v4: VLAN/STP)
  vlan?: number[];               // VLAN IDs [10, 20, 30]
  stp?: {
    enabled: boolean;
    mode?: 'STP' | 'RSTP' | 'PVST+' | 'MST';
    priority?: number;           // 0-65535, step 4096, default 32768
  };

  // Port Management (v5: Switch, Router, Firewall)
  portCount?: number;            // 5, 8, 16, 24, 48
  ports?: Port[];                // Array di configurazioni porte

  // Network Interface Cards (v6: PC, Server, Database, Cloud)
  nics?: NetworkInterfaceCard[]; // Array di schede di rete
}
```

**Note implementative**:
- `id` è auto-incrementale (`dev-${counter}`) gestito da networkStore.deviceCounter
- `type` è dinamico - qualsiasi stringa valida (gestito da templateStore)
- `position` è persistito in real-time per evitare reset viewport
- `vlan`, `stp`, `ports`, `nics` sono opzionali - presenza determinata da template.supportsVLAN/supportsSTP/supportsPorts/supportsNICs

#### Port (Switch/Router/Firewall)

```typescript
export interface Port {
  id: number;                    // Port number (1-48)
  name?: string;                 // Custom label es. "Uplink to Core"
  enabled: boolean;              // Administratively enabled/disabled
  speed?: '10M' | '100M' | '1G' | '2.5G' | '10G' | 'auto';

  // VLAN config (Switch)
  vlan?: number | number[];      // Single VLAN for access, array for trunk
  portType?: 'access' | 'trunk' | 'wan' | 'lan' | 'dmz';
  poe?: boolean;                 // Power over Ethernet (Switch only)

  // Router config
  nat?: boolean;                 // NAT enabled (Router only)

  // Firewall config
  securityZone?: 'trust' | 'untrust' | 'dmz';
  ips?: boolean;                 // IPS/IDS enabled

  description?: string;          // Notes/comments
}
```

**Esempio configurazione Switch 24 porte**:
```typescript
{
  portCount: 24,
  ports: [
    { id: 1, enabled: true, speed: '10G', portType: 'trunk', vlan: [1, 10, 20, 30], description: 'To Core' },
    { id: 2, enabled: true, speed: '1G', portType: 'access', vlan: 10, poe: true, description: 'PC VLAN 10' },
    // ...altri 22 ports
  ]
}
```

#### NetworkInterfaceCard (PC/Server/Database/Cloud)

```typescript
export interface NetworkInterfaceCard {
  id: string;                    // nic-1, nic-2, nic-3...
  name: string;                  // eth0, eth1, ens192, em1...
  enabled: boolean;              // NIC enabled/disabled
  speed: '10M' | '100M' | '1G' | '2.5G' | '10G' | 'auto';

  // IP Configuration
  ip: string;                    // Es. "192.168.1.100"
  subnet: string;                // Es. "255.255.255.0"
  gateway: string;               // Es. "192.168.1.1"

  // Hardware
  mac?: string;                  // Auto-generated or custom (es. "02:XX:XX:XX:XX:XX")

  description?: string;          // Notes/comments
}
```

**Esempio configurazione Server dual-NIC**:
```typescript
{
  nics: [
    {
      id: 'nic-1',
      name: 'eth0',
      enabled: true,
      speed: '1G',
      ip: '192.168.1.100',
      subnet: '255.255.255.0',
      gateway: '192.168.1.1',
      mac: '02:a1:b2:c3:d4:e5',
      description: 'Primary network'
    },
    {
      id: 'nic-2',
      name: 'eth1',
      enabled: true,
      speed: '10G',
      ip: '10.0.0.100',
      subnet: '255.255.255.0',
      gateway: '10.0.0.1',
      mac: '02:f6:g7:h8:i9:j0',
      description: 'Storage network'
    }
  ]
}
```

**MAC Address Generation** (frontend/src/utils/ipHelpers.ts):
```typescript
export function generateMacAddress(): string {
  // Locally administered unicast MAC (first octet 02)
  const octets = ['02'];
  for (let i = 0; i < 5; i++) {
    const octet = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    octets.push(octet);
  }
  return octets.join(':');
}
// Esempio output: "02:3a:f2:1b:9c:4d"
```

#### NetworkConnection

```typescript
export interface NetworkConnection {
  id: string;                    // conn-0, conn-1, conn-2...
  source: string;                // device ID
  target: string;                // device ID
  sourceHandle?: string | null;  // Optional: specific handle
  targetHandle?: string | null;

  // Connection metadata
  type?: ConnectionType;         // 'trunk' | 'access' | 'uplink' | 'backbone'
  bandwidth?: string;            // Es. "1Gbps", "100Mbps"
  vlan?: number[];               // Tagged VLANs
  label?: string;                // Custom label
  color?: string;                // Custom color override

  // STP Port Configuration
  stpPortState?: 'forwarding' | 'blocking' | 'disabled' | 'learning';
  stpPortPriority?: number;      // 0-240, step 16
}
```

**Connection Types**:
- **trunk**: Switch-to-switch links (supporta multiple VLAN)
- **access**: Porta accesso a end devices (single VLAN)
- **uplink**: Uplink a core/internet
- **backbone**: Infrastruttura critica (WAN between buildings)

#### FlowMap (Schema Principale)

```typescript
export interface FlowMap {
  meta: {
    name: string;                // Project name
    version: string;             // Es. "1.0.0"
    created?: string;            // ISO timestamp
    modified?: string;           // ISO timestamp
  };
  nodes: NetworkDevice[];        // Array di dispositivi
  edges: NetworkConnection[];    // Array di connessioni
}
```

Questo è il formato principale che sarà salvato nella colonna JSONB `projects.settings`, `projects.devices`, `projects.connections`.

#### DeviceTemplate

```typescript
export interface DeviceTemplate {
  id: string;                    // tpl-pc, tpl-switch, tpl-custom-123
  name: string;                  // Display name
  type: DeviceType;              // Device type identifier
  icon: string;                  // Iconify icon name (es. "mdi:server")
  color: string;                 // Hex color

  // Terraform fields (opzionali, futuro)
  terraformFields?: Record<string, string | number | boolean>;

  isCustom: boolean;             // Distingue default da user-created

  // Capabilities (v7)
  supportsVLAN: boolean;         // Device supporta VLAN config
  supportsSTP: boolean;          // Device supporta STP config
  supportsPorts: boolean;        // Device ha port management (Switch/Router/Firewall)
  supportsNICs: boolean;         // Device ha NICs (PC/Server/Database/Cloud)

  // Port options (se supportsPorts = true)
  portOptions?: number[];        // Es. [5, 8, 16, 24, 48]
  defaultPortCount?: number;     // Es. 24
}
```

**Template Defaults**:
```typescript
// Switch template
{
  id: 'tpl-switch',
  name: 'Switch',
  type: 'Switch',
  icon: 'carbon:network-4',
  color: '#5B7C8D',
  isCustom: false,
  supportsVLAN: true,
  supportsSTP: true,
  supportsPorts: true,
  supportsNICs: false,
  portOptions: [5, 8, 16, 24, 48],
  defaultPortCount: 24
}

// Server template
{
  id: 'tpl-server',
  name: 'Server',
  type: 'Server',
  icon: 'mdi:server',
  color: '#5B7C8D',
  isCustom: false,
  supportsVLAN: false,
  supportsSTP: false,
  supportsPorts: false,
  supportsNICs: true  // Server usa NICs invece di ports
}
```

#### ConnectionTemplate

```typescript
export interface ConnectionTemplate {
  id: string;                    // conn-access, conn-trunk, conn-custom-123
  name: string;                  // Display name
  type: string;                  // Type identifier
  description?: string;          // Italian description

  // Visual style
  color: string;                 // Hex color
  lineStyle: 'solid' | 'dashed' | 'dotted';
  strokeWidth: number;           // Base width (2.5-4)
  strokeWidthHighlighted?: number;
  strokeDasharray?: string;      // SVG dash pattern

  isCustom: boolean;             // Default vs user-created
}
```

---

## 1.5 LocalStorage Attuale

### Chiavi LocalStorage (4 chiavi totali)

| Chiave | Store | Dimensione Tipica | Contenuto |
|--------|-------|-------------------|-----------|
| `pixelcake-network-v2` | networkStore | 50-70 KB | devices, connections, globalNetworkSettings, viewport, counters |
| `pixelcake-templates-v7` | templateStore | 10-20 KB | templates[], connectionTemplates[] |
| `pixelcake-ui-v1` | uiStore | ~1 KB | darkMode, theme |
| `pixelcake-user-v1` | userStore | ~1 KB | userName, userEmail, preferences |

### networkStore (pixelcake-network-v2)

```typescript
// Persistiti
{
  devices: NetworkDevice[],           // Array completo devices
  connections: NetworkConnection[],   // Array completo connections
  globalNetworkSettings: {
    ipClass: '192.168.1.0',
    subnet: '255.255.255.0',
    gateway: '192.168.1.1'
  },
  viewport: { x: 0, y: 0, zoom: 1 },  // Canvas position (real-time sync)
  deviceCounter: 33,                  // Next device ID
  connectionCounter: 42               // Next connection ID
}

// NON persistiti (solo in memoria)
{
  selectedDeviceId: null,
  hoveredDeviceId: null,
  selectedDeviceIds: [],              // Multi-selection
  clipboard: null,                    // Copy/paste buffer
  isConnecting: false,
  connectionStart: null,
  shouldFitView: false
}
```

**Migrazione Backend**:
- `devices` → `projects.devices` (JSONB)
- `connections` → `projects.connections` (JSONB)
- `globalNetworkSettings + viewport + counters` → `projects.settings` (JSONB)

### templateStore (pixelcake-templates-v7)

```typescript
{
  templates: DeviceTemplate[],           // 9 default + custom utente
  connectionTemplates: ConnectionTemplate[]  // 4 default + custom utente
}
```

**Migrazione Backend**:
- Default templates → Hardcoded nel backend (seed data)
- Custom templates → `device_templates` table
- Custom connection templates → `connection_templates` table

### uiStore (pixelcake-ui-v1)

```typescript
{
  darkMode: false,
  theme: 'pixelcake'  // 'pixelcake' | 'modern-tech'
}
```

**Migrazione Backend**:
- → `user_preferences.preferences` (JSONB) sotto chiave `ui`

### userStore (pixelcake-user-v1)

```typescript
{
  userName: '',
  userEmail: '',
  preferences: {
    language: 'it',              // 'it' | 'en'
    dateFormat: 'DD/MM/YYYY',    // Format locale
    unitSystem: 'metric'         // 'metric' | 'imperial'
  }
}
```

**Migrazione Backend**:
- `userName, userEmail` → `users` table
- `preferences` → `user_preferences.preferences` (JSONB)

---

## 1.6 Sample Topology

### Topologia Enterprise Tipica (sampleTopology.ts)

```
Total: 33 devices, 42 connections
Dimensione JSON: ~65 KB

BUILDING 1: HEADQUARTERS (HQ) - 15 devices
├── Router-Internet (192.168.1.1) - 8 ports
├── Firewall-HQ (192.168.1.2) - 8 ports
├── Core-Switch-HQ (192.168.1.3) - 24 ports
├── SW-Floor-1 (192.168.11.1) - 24 ports
├── SW-Floor-2 (192.168.12.1) - 24 ports
├── SW-Floor-3 (192.168.13.1) - 24 ports
├── PC-1 (192.168.11.10) - 1 NIC
├── PC-2 (192.168.11.11) - 1 NIC
├── PC-3 (192.168.12.10) - 1 NIC
├── PC-4 (192.168.12.11) - 1 NIC
├── PC-5 (192.168.13.10) - 1 NIC
├── PC-6 (192.168.13.11) - 1 NIC
├── Printer-1 (192.168.11.50) - 1 NIC
├── Printer-2 (192.168.12.50) - 1 NIC
└── AP-1 (192.168.13.50) - 1 NIC

BUILDING 2: DATACENTER (DC) - 12 devices
├── Router-DC (192.168.2.1) - 8 ports
├── Firewall-DC (192.168.2.2) - 8 ports
├── Core-Switch-DC (192.168.2.3) - 48 ports
├── SW-DB (192.168.21.1) - 24 ports
├── SW-APP (192.168.22.1) - 24 ports
├── LoadBalancer-1 (192.168.22.10) - 2 NICs (mgmt0, ha0)
├── WebServer-1 (192.168.22.20) - 2 NICs (eth0, eth1)
├── WebServer-2 (192.168.22.21) - 2 NICs
├── AppServer-1 (192.168.22.30) - 2 NICs
├── DB-Primary (192.168.21.10) - 2 NICs (data, replication)
├── DB-Replica (192.168.21.11) - 2 NICs
└── Backup-Server (192.168.21.50) - 2 NICs (backup, storage)

BUILDING 3: EXECUTIVE OFFICE - 6 devices
├── Router-Exec (192.168.3.1) - 8 ports
├── Firewall-Exec (192.168.3.2) - 8 ports
├── SW-Exec (192.168.31.1) - 16 ports
├── PC-Exec-1 (192.168.31.10) - 1 NIC
├── PC-Exec-2 (192.168.31.11) - 1 NIC
└── Printer-Exec (192.168.31.50) - 1 NIC

CONNECTIONS: 42 total
- 3 WAN backbone (inter-building)
- 12 trunk links (switch-to-switch)
- 27 access links (end devices)
```

### Esempi Configurazioni Complesse

**Switch Core HQ (24 ports)**:
```typescript
{
  id: 'switch-core-hq',
  type: 'Switch',
  portCount: 24,
  ports: [
    {
      id: 1,
      enabled: true,
      speed: '10G',
      portType: 'trunk',
      vlan: [1, 10, 20, 30],
      poe: false,
      description: 'To Firewall'
    },
    {
      id: 2,
      enabled: true,
      speed: '1G',
      portType: 'trunk',
      vlan: [1, 10],
      poe: false,
      description: 'To Floor Switch 1'
    },
    // ...altri 22 ports
  ],
  vlan: [1, 10, 20, 30],
  stp: {
    enabled: true,
    mode: 'RSTP',
    priority: 4096  // Root bridge
  }
}
```

**Server Database (2 NICs)**:
```typescript
{
  id: 'db-primary',
  type: 'Database',
  vendor: 'PostgreSQL',
  nics: [
    {
      id: 'nic-1',
      name: 'eth0',
      enabled: true,
      speed: '10G',
      ip: '192.168.21.10',
      subnet: '255.255.255.0',
      gateway: '192.168.21.1',
      mac: '02:db:01:aa:bb:cc',
      description: 'Primary data network'
    },
    {
      id: 'nic-2',
      name: 'eth1',
      enabled: true,
      speed: '10G',
      ip: '10.10.21.10',
      subnet: '255.255.255.0',
      gateway: '10.10.21.1',
      mac: '02:db:02:dd:ee:ff',
      description: 'Replication network (isolated VLAN)'
    }
  ]
}
```

---

## 1.7 Dimensioni Dati

### Breakdown Dimensioni JSON

```
Sample Topology (33 devices, 42 connections): ~65 KB

Per Device:
- Base device (no ports/NICs): ~200 bytes
- Device con 24 ports: ~1.2 KB
- Device con 2 NICs: ~600 bytes

Per Connection:
- Base connection: ~150 bytes
- Connection con VLAN/STP: ~250 bytes

FlowMap completo tipico:
- Meta: ~100 bytes
- Devices (33): ~25 KB
- Connections (42): ~10 KB
- Total: ~35 KB (senza pretty-print)
- Total: ~65 KB (con formatting/indentation)
```

### Stima Database

**Single Project** (JSONB):
```sql
-- projects table
{
  id: uuid,
  user_id: uuid,
  name: varchar(255),
  version: varchar(50),

  -- JSONB columns (totale ~65 KB)
  settings: jsonb,     -- ~1 KB (ipClass, subnet, gateway, viewport, counters)
  devices: jsonb,      -- ~25 KB (33 devices con ports/NICs)
  connections: jsonb,  -- ~10 KB (42 connections)

  created_at: timestamp,
  updated_at: timestamp,
  last_accessed: timestamp
}
```

**Stima capacità**:
- 1 user, 10 projects: ~650 KB
- 100 users, 10 projects each: ~65 MB
- 1000 users, 10 projects each: ~650 MB

**Conclusione**: JSONB è efficientissimo per PixelCake. Anche con migliaia di utenti e progetti il database rimane piccolo e performante.

---

## Next Steps

Ora che hai una comprensione completa del frontend, procedi a:
1. **[Database Schema](./02_database_schema.md)** - Schema PostgreSQL con JSONB
2. **[Struttura Backend](./03_backend_structure.md)** - Organizzazione cartelle e moduli
3. **[Quick Start](./quick_start.md)** - Setup pratico immediato

---

**Domande Frequenti**

**Q: Perché non normalizzare devices e connections in tabelle separate?**
A: FlowMap è già un formato JSON ben definito. Normalizz are richiederebbe:
- 3+ tabelle (devices, ports, nics, connections)
- JOIN complessi per ricostruire FlowMap
- Complessità schema evolution (ALTER TABLE per nuovi campi)
- Zero benefit in performance (GIN index su JSONB è velocissimo)

**Q: Come gestire device types custom dinamici?**
A: Template store persiste i custom types. Backend valida solo che il `type` esista in `device_templates` table. Nuovi device types = nuovo template, zero schema migration.

**Q: Cosa succede se utente ha 100+ devices?**
A: JSONB supporta documenti grandi. FlowMap con 100 devices ~200 KB, still piccolo. GIN index garantisce query veloci. Se necessario, possiamo aggiungere pagination client-side.

