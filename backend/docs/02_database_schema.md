# 2. Database Schema

## 📋 Indice
- [2.1 Panoramica Schema](#21-panoramica-schema)
- [2.2 Diagramma ER](#22-diagramma-er)
- [2.3 Tabelle Dettagliate](#23-tabelle-dettagliate)
- [2.4 JSONB Structure](#24-jsonb-structure)
- [2.5 Indexes e Performance](#25-indexes-e-performance)
- [2.6 Migrations Alembic](#26-migrations-alembic)
- [2.7 Query JSONB Examples](#27-query-jsonb-examples)
- [2.8 SQLite vs PostgreSQL](#28-sqlite-vs-postgresql)

---

## 2.1 Panoramica Schema

### Strategia: JSONB Hybrid Approach

**Relazionale** per:
- User identity e auth (users)
- Project metadata (project name, timestamps, ownership)
- Templates global/custom (device_templates, connection_templates)

**JSONB** per:
- Project data completo (settings, devices[], connections[])
- User preferences (UI settings, language, etc.)
- Version history snapshots

### Tabelle (6 totali)

| Tabella | Tipo | Scopo |
|---------|------|-------|
| `users` | Relazionale | User identity, credentials |
| `projects` | Hybrid | Project metadata + JSONB(devices, connections, settings) |
| `device_templates` | Hybrid | Template metadata + JSONB(template definition) |
| `connection_templates` | Hybrid | Template metadata + JSONB(template definition) |
| `user_preferences` | Hybrid | User settings in JSONB |
| `project_versions` | JSONB-only | History snapshots per undo/redo |

---

## 2.2 Diagramma ER

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ DEVICE_TEMPLATES : creates
    USERS ||--o{ CONNECTION_TEMPLATES : creates
    USERS ||--|| USER_PREFERENCES : has
    PROJECTS ||--o{ PROJECT_VERSIONS : has

    USERS {
        uuid id PK
        string email UK "Unique email"
        string username "Display name"
        string hashed_password "bcrypt hash"
        timestamp created_at
        timestamp updated_at
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        string name "Project name"
        string version "Semver version"
        boolean is_public "Sharing flag"
        timestamp created_at
        timestamp updated_at
        timestamp last_accessed
        jsonb settings "Network settings + viewport + counters"
        jsonb devices "Array of NetworkDevice"
        jsonb connections "Array of NetworkConnection"
    }

    DEVICE_TEMPLATES {
        uuid id PK
        uuid user_id FK "NULL for global templates"
        boolean is_custom "Default vs user-created"
        jsonb template "DeviceTemplate definition"
        timestamp created_at
    }

    CONNECTION_TEMPLATES {
        uuid id PK
        uuid user_id FK "NULL for global templates"
        boolean is_custom "Default vs user-created"
        jsonb template "ConnectionTemplate definition"
        timestamp created_at
    }

    USER_PREFERENCES {
        uuid user_id PK_FK
        jsonb preferences "UI settings, language, etc."
        timestamp updated_at
    }

    PROJECT_VERSIONS {
        uuid id PK
        uuid project_id FK
        int version_number "Incremental version"
        jsonb snapshot "Full project state"
        timestamp created_at
    }
```

---

## 2.3 Tabelle Dettagliate

### Table: `users`

**Scopo**: User identity e autenticazione JWT

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index per performance
CREATE INDEX idx_users_email ON users(email);

-- Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Colonne**:
- `id` (UUID): Primary key, auto-generated
- `email` (VARCHAR(255)): Unique, used for login
- `username` (VARCHAR(100)): Display name (non-unique)
- `hashed_password` (VARCHAR(255)): bcrypt hash (60 chars, ma 255 per safety)
- `created_at`: Account creation timestamp
- `updated_at`: Last profile update (auto-updated via trigger)

**Constraints**:
- `email` UNIQUE per evitare duplicati
- `hashed_password` NOT NULL (no social login per ora)

**Esempio dato**:
```sql
INSERT INTO users (email, username, hashed_password) VALUES
(
    'user@example.com',
    'Admin User',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYVNNcXXE3e' -- bcrypt hash
);
```

---

### Table: `projects`

**Scopo**: Project storage con JSONB hybrid approach

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) DEFAULT '1.0.0',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- JSONB columns (dati flessibili)
    settings JSONB DEFAULT '{"ipClass":"192.168.1.0","subnet":"255.255.255.0","gateway":"192.168.1.1","viewport":{"x":0,"y":0,"zoom":1},"deviceCounter":0,"connectionCounter":0}'::jsonb,
    devices JSONB DEFAULT '[]'::jsonb,
    connections JSONB DEFAULT '[]'::jsonb
);

-- Indexes
CREATE INDEX idx_user_projects ON projects(user_id, updated_at DESC);
CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_last_accessed ON projects(last_accessed DESC);

-- GIN indexes per query su JSONB
CREATE INDEX idx_projects_devices_gin ON projects USING GIN (devices);
CREATE INDEX idx_projects_connections_gin ON projects USING GIN (connections);
CREATE INDEX idx_projects_settings_gin ON projects USING GIN (settings);

-- Trigger updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Colonne**:
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key → users.id (ON DELETE CASCADE)
- `name` (VARCHAR(255)): Project name (es. "Enterprise Network v2")
- `version` (VARCHAR(50)): Semantic version (es. "1.2.3")
- `is_public` (BOOLEAN): Sharing flag (futuro: public gallery)
- `created_at`: Project creation timestamp
- `updated_at`: Last modification timestamp (auto-updated)
- `last_accessed`: Last view/edit timestamp (per sorting "recent projects")

**JSONB Columns** (dettagli in sezione 2.4):
- `settings` (JSONB): Global network settings + viewport + counters
- `devices` (JSONB): Array of NetworkDevice objects
- `connections` (JSONB): Array of NetworkConnection objects

**Constraints**:
- `user_id` NOT NULL + FK con CASCADE delete
- `name` NOT NULL
- Nessun UNIQUE su name (utente può avere "Network 1", "Network 1 Copy")

**Esempio dato**:
```sql
INSERT INTO projects (user_id, name, settings, devices, connections) VALUES
(
    '123e4567-e89b-12d3-a456-426614174000', -- user_id
    'Sample Enterprise Network',
    '{
        "ipClass": "192.168.1.0",
        "subnet": "255.255.255.0",
        "gateway": "192.168.1.1",
        "viewport": {"x": 0, "y": 0, "zoom": 1},
        "deviceCounter": 33,
        "connectionCounter": 42
    }'::jsonb,
    '[
        {
            "id": "dev-0",
            "type": "Router",
            "label": "Internet-GW",
            "ip": "192.168.1.1",
            "subnet": "255.255.255.0",
            "gateway": "",
            "position": {"x": 200, "y": 100},
            "portCount": 8,
            "ports": [...]
        }
    ]'::jsonb,
    '[
        {
            "id": "conn-0",
            "source": "dev-0",
            "target": "dev-1",
            "type": "uplink"
        }
    ]'::jsonb
);
```

---

### Table: `device_templates`

**Scopo**: Device templates (global defaults + custom user templates)

```sql
CREATE TABLE device_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_custom BOOLEAN DEFAULT TRUE,
    template JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_device_templates_user ON device_templates(user_id);
CREATE INDEX idx_device_templates_custom ON device_templates(is_custom);
CREATE INDEX idx_device_templates_gin ON device_templates USING GIN (template);

-- Constraint: global templates have user_id = NULL
-- Custom templates have user_id NOT NULL
```

**Colonne**:
- `id` (UUID): Primary key
- `user_id` (UUID): NULL per global templates, NOT NULL per custom
- `is_custom` (BOOLEAN): FALSE per default templates, TRUE per user-created
- `template` (JSONB): Full DeviceTemplate object (vedi sezione 2.4.4)
- `created_at`: Template creation timestamp

**Seed Data** (default templates):
```sql
-- Global template (user_id = NULL, is_custom = FALSE)
INSERT INTO device_templates (user_id, is_custom, template) VALUES
(
    NULL,
    FALSE,
    '{
        "id": "tpl-switch",
        "name": "Switch",
        "type": "Switch",
        "icon": "carbon:network-4",
        "color": "#5B7C8D",
        "isCustom": false,
        "supportsVLAN": true,
        "supportsSTP": true,
        "supportsPorts": true,
        "supportsNICs": false,
        "portOptions": [5, 8, 16, 24, 48],
        "defaultPortCount": 24
    }'::jsonb
);
```

---

### Table: `connection_templates`

**Scopo**: Connection templates (global defaults + custom user templates)

```sql
CREATE TABLE connection_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_custom BOOLEAN DEFAULT TRUE,
    template JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_connection_templates_user ON connection_templates(user_id);
CREATE INDEX idx_connection_templates_custom ON connection_templates(is_custom);
CREATE INDEX idx_connection_templates_gin ON connection_templates USING GIN (template);
```

**Struttura identica** a `device_templates`, ma con `ConnectionTemplate` objects.

**Seed Data**:
```sql
INSERT INTO connection_templates (user_id, is_custom, template) VALUES
(
    NULL,
    FALSE,
    '{
        "id": "conn-trunk",
        "name": "Trunk",
        "type": "trunk",
        "description": "Link trunk tra switch",
        "color": "#9333ea",
        "lineStyle": "solid",
        "strokeWidth": 3.5,
        "strokeWidthHighlighted": 5,
        "isCustom": false
    }'::jsonb
);
```

---

### Table: `user_preferences`

**Scopo**: User settings (UI preferences, language, etc.)

```sql
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{
        "ui": {
            "darkMode": false,
            "theme": "pixelcake"
        },
        "locale": {
            "language": "it",
            "dateFormat": "DD/MM/YYYY",
            "unitSystem": "metric"
        }
    }'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index GIN per query su preferences
CREATE INDEX idx_user_preferences_gin ON user_preferences USING GIN (preferences);

-- Trigger updated_at
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Colonne**:
- `user_id` (UUID): Primary key + Foreign key
- `preferences` (JSONB): Full preferences object
- `updated_at`: Last update timestamp

**Esempio dato**:
```json
{
    "ui": {
        "darkMode": true,
        "theme": "pixelcake",
        "magnifiedDeviceTypes": ["Switch", "Router"],
        "magnifiedConnectionTypes": ["trunk"]
    },
    "locale": {
        "language": "it",
        "dateFormat": "DD/MM/YYYY",
        "unitSystem": "metric"
    }
}
```

---

### Table: `project_versions`

**Scopo**: Version history per undo/redo functionality

```sql
CREATE TABLE project_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_project_versions_project ON project_versions(project_id, created_at DESC);
CREATE INDEX idx_project_versions_number ON project_versions(project_id, version_number DESC);

-- Constraint: unique version_number per project
CREATE UNIQUE INDEX idx_project_versions_unique ON project_versions(project_id, version_number);
```

**Colonne**:
- `id` (UUID): Primary key
- `project_id` (UUID): Foreign key → projects.id
- `version_number` (INT): Incremental version (1, 2, 3...)
- `snapshot` (JSONB): Full project state (settings + devices + connections)
- `created_at`: Snapshot creation timestamp

**Uso**:
```sql
-- Create version snapshot
INSERT INTO project_versions (project_id, version_number, snapshot)
SELECT
    id,
    COALESCE((
        SELECT MAX(version_number) + 1
        FROM project_versions
        WHERE project_id = projects.id
    ), 1),
    jsonb_build_object(
        'settings', settings,
        'devices', devices,
        'connections', connections
    )
FROM projects
WHERE id = '...';

-- Restore version
UPDATE projects
SET
    settings = snapshot->'settings',
    devices = snapshot->'devices',
    connections = snapshot->'connections'
FROM project_versions
WHERE project_versions.project_id = projects.id
  AND project_versions.version_number = 5;
```

---

## 2.4 JSONB Structure

### 2.4.1 projects.settings (JSONB)

**Schema**:
```typescript
{
    // Global network settings
    "ipClass": "192.168.1.0",
    "subnet": "255.255.255.0",
    "gateway": "192.168.1.1",

    // Canvas viewport
    "viewport": {
        "x": 0,
        "y": 0,
        "zoom": 1
    },

    // Counters (per ID generation)
    "deviceCounter": 33,
    "connectionCounter": 42
}
```

**Size**: ~1 KB

---

### 2.4.2 projects.devices (JSONB Array)

**Schema** (singolo device):
```typescript
{
    "id": "dev-0",
    "type": "Switch",
    "label": "Core-Switch-HQ",
    "ip": "192.168.1.3",
    "subnet": "255.255.255.0",
    "gateway": "192.168.1.1",
    "vendor": "Cisco Catalyst",
    "location": "HQ - Sala Server",
    "position": {"x": 200, "y": 400},

    // Optional: VLAN/STP
    "vlan": [1, 10, 20, 30],
    "stp": {
        "enabled": true,
        "mode": "RSTP",
        "priority": 4096
    },

    // Optional: Ports (Switch/Router/Firewall)
    "portCount": 24,
    "ports": [
        {
            "id": 1,
            "enabled": true,
            "speed": "10G",
            "portType": "trunk",
            "vlan": [1, 10, 20, 30],
            "poe": false,
            "description": "To Firewall"
        }
        // ...altri 23 ports
    ],

    // Optional: NICs (PC/Server/Database/Cloud)
    "nics": [
        {
            "id": "nic-1",
            "name": "eth0",
            "enabled": true,
            "speed": "1G",
            "ip": "192.168.1.100",
            "subnet": "255.255.255.0",
            "gateway": "192.168.1.1",
            "mac": "02:a1:b2:c3:d4:e5",
            "description": "Primary network"
        }
    ]
}
```

**Array completo** (`projects.devices`):
```json
[
    { /* device 0 */ },
    { /* device 1 */ },
    // ...
    { /* device 32 */ }
]
```

**Size**: ~25 KB (33 devices con ports/NICs)

---

### 2.4.3 projects.connections (JSONB Array)

**Schema** (singola connection):
```typescript
{
    "id": "conn-0",
    "source": "dev-0",
    "target": "dev-1",
    "sourceHandle": null,
    "targetHandle": null,
    "type": "uplink",
    "bandwidth": "10Gbps",
    "vlan": [1, 10],
    "label": "Primary uplink",
    "color": "#f59e0b",
    "stpPortState": "forwarding",
    "stpPortPriority": 128
}
```

**Array completo**:
```json
[
    { /* connection 0 */ },
    { /* connection 1 */ },
    // ...
    { /* connection 41 */ }
]
```

**Size**: ~10 KB (42 connections)

---

### 2.4.4 device_templates.template (JSONB)

```json
{
    "id": "tpl-switch",
    "name": "Switch",
    "type": "Switch",
    "icon": "carbon:network-4",
    "color": "#5B7C8D",
    "isCustom": false,
    "supportsVLAN": true,
    "supportsSTP": true,
    "supportsPorts": true,
    "supportsNICs": false,
    "portOptions": [5, 8, 16, 24, 48],
    "defaultPortCount": 24,
    "terraformFields": {
        "provider": "aws",
        "instance_type": "c5.large"
    }
}
```

---

### 2.4.5 connection_templates.template (JSONB)

```json
{
    "id": "conn-trunk",
    "name": "Trunk",
    "type": "trunk",
    "description": "Link trunk tra switch",
    "color": "#9333ea",
    "lineStyle": "solid",
    "strokeWidth": 3.5,
    "strokeWidthHighlighted": 5,
    "strokeDasharray": null,
    "isCustom": false
}
```

---

### 2.4.6 user_preferences.preferences (JSONB)

```json
{
    "ui": {
        "darkMode": true,
        "theme": "pixelcake",
        "magnifiedDeviceTypes": ["Switch", "Router"],
        "magnifiedConnectionTypes": ["trunk"]
    },
    "locale": {
        "language": "it",
        "dateFormat": "DD/MM/YYYY",
        "unitSystem": "metric"
    }
}
```

---

## 2.5 Indexes e Performance

### GIN Indexes (Generalized Inverted Index)

**Perché GIN per JSONB?**
- Supporta operatori JSONB (`@>`, `?`, `?|`, `?&`)
- Performance eccellente per query su nested JSON
- Index su tutto il documento JSONB

**Indexes creati**:
```sql
-- Projects table
CREATE INDEX idx_projects_devices_gin ON projects USING GIN (devices);
CREATE INDEX idx_projects_connections_gin ON projects USING GIN (connections);
CREATE INDEX idx_projects_settings_gin ON projects USING GIN (settings);

-- Templates tables
CREATE INDEX idx_device_templates_gin ON device_templates USING GIN (template);
CREATE INDEX idx_connection_templates_gin ON connection_templates USING GIN (template);

-- User preferences
CREATE INDEX idx_user_preferences_gin ON user_preferences USING GIN (preferences);
```

### Performance Queries

**Query 1: Find projects con device type "Switch"**
```sql
-- Con GIN index: ~1-5ms anche con 10k projects
SELECT id, name
FROM projects
WHERE devices @> '[{"type": "Switch"}]';
```

**Query 2: Find devices con VLAN 10**
```sql
-- GIN index sull'array vlan
SELECT id, name
FROM projects
WHERE devices @> '[{"vlan": [10]}]';
```

**Query 3: Count devices per type**
```sql
-- Utilizza GIN + jsonb_array_elements
SELECT
    device->>'type' AS device_type,
    COUNT(*) AS count
FROM projects,
     jsonb_array_elements(devices) AS device
GROUP BY device->>'type';
```

**Query 4: Full-text search su device labels**
```sql
-- Case-insensitive search
SELECT id, name
FROM projects
WHERE devices::text ILIKE '%router%';
```

### B-tree Indexes (relazionali)

```sql
-- User queries
CREATE INDEX idx_users_email ON users(email);

-- Project queries
CREATE INDEX idx_user_projects ON projects(user_id, updated_at DESC);
CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_last_accessed ON projects(last_accessed DESC);

-- Templates queries
CREATE INDEX idx_device_templates_user ON device_templates(user_id);
CREATE INDEX idx_device_templates_custom ON device_templates(is_custom);
```

---

## 2.6 Migrations Alembic

### Initial Migration

**File**: `alembic/versions/001_initial_schema.py`

```python
"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Users table
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now())
    )
    op.create_index('idx_users_email', 'users', ['email'])

    # Projects table
    op.create_table(
        'projects',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('version', sa.String(50), server_default='1.0.0'),
        sa.Column('is_public', sa.Boolean, server_default='FALSE'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('last_accessed', sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column('settings', JSONB, server_default='{"ipClass":"192.168.1.0","subnet":"255.255.255.0","gateway":"192.168.1.1","viewport":{"x":0,"y":0,"zoom":1},"deviceCounter":0,"connectionCounter":0}'),
        sa.Column('devices', JSONB, server_default='[]'),
        sa.Column('connections', JSONB, server_default='[]')
    )
    op.create_index('idx_user_projects', 'projects', ['user_id', sa.text('updated_at DESC')])
    op.create_index('idx_projects_devices_gin', 'projects', ['devices'], postgresql_using='gin')
    op.create_index('idx_projects_connections_gin', 'projects', ['connections'], postgresql_using='gin')
    op.create_index('idx_projects_settings_gin', 'projects', ['settings'], postgresql_using='gin')

    # Device templates table
    op.create_table(
        'device_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('is_custom', sa.Boolean, server_default='TRUE'),
        sa.Column('template', JSONB, nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now())
    )
    op.create_index('idx_device_templates_gin', 'device_templates', ['template'], postgresql_using='gin')

    # Connection templates table
    op.create_table(
        'connection_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('is_custom', sa.Boolean, server_default='TRUE'),
        sa.Column('template', JSONB, nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now())
    )
    op.create_index('idx_connection_templates_gin', 'connection_templates', ['template'], postgresql_using='gin')

    # User preferences table
    op.create_table(
        'user_preferences',
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('preferences', JSONB, server_default='{"ui":{"darkMode":false,"theme":"pixelcake"},"locale":{"language":"it","dateFormat":"DD/MM/YYYY","unitSystem":"metric"}}'),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now())
    )
    op.create_index('idx_user_preferences_gin', 'user_preferences', ['preferences'], postgresql_using='gin')

    # Project versions table
    op.create_table(
        'project_versions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('project_id', UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_number', sa.Integer, nullable=False),
        sa.Column('snapshot', JSONB, nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now())
    )
    op.create_index('idx_project_versions_project', 'project_versions', ['project_id', sa.text('created_at DESC')])
    op.create_unique_constraint('idx_project_versions_unique', 'project_versions', ['project_id', 'version_number'])

    # Triggers per updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    op.execute("""
        CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

    op.execute("""
        CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    """)

def downgrade():
    op.drop_table('project_versions')
    op.drop_table('user_preferences')
    op.drop_table('connection_templates')
    op.drop_table('device_templates')
    op.drop_table('projects')
    op.drop_table('users')
    op.execute('DROP FUNCTION IF EXISTS update_updated_at_column')
```

### Comandi Alembic

```bash
# Generare migration (auto-detect changes)
alembic revision --autogenerate -m "Initial schema"

# Applicare migration
alembic upgrade head

# Rollback ultima migration
alembic downgrade -1

# Visualizzare history
alembic history

# Visualizzare current version
alembic current
```

---

## 2.7 Query JSONB Examples

### Example 1: Cerca projects con device type "Switch"

```sql
SELECT id, name, created_at
FROM projects
WHERE devices @> '[{"type": "Switch"}]'
ORDER BY created_at DESC;
```

### Example 2: Count devices per project

```sql
SELECT
    id,
    name,
    jsonb_array_length(devices) AS device_count,
    jsonb_array_length(connections) AS connection_count
FROM projects
ORDER BY device_count DESC;
```

### Example 3: Extract tutti i device labels

```sql
SELECT
    projects.name AS project_name,
    device->>'label' AS device_label,
    device->>'type' AS device_type
FROM projects,
     jsonb_array_elements(devices) AS device
ORDER BY projects.name, device_label;
```

### Example 4: Find devices con IP in subnet 192.168.1.x

```sql
SELECT
    id,
    name
FROM projects
WHERE devices::text LIKE '%"ip":"192.168.1%';
```

### Example 5: Update single device in array

```sql
-- Update device label
UPDATE projects
SET devices = jsonb_set(
    devices,
    '{0,label}',  -- Path: array index 0, field "label"
    '"New Label"',
    false
)
WHERE id = '...';
```

### Example 6: Add device to array

```sql
UPDATE projects
SET devices = devices || '[{
    "id": "dev-99",
    "type": "PC",
    "label": "New PC",
    "ip": "192.168.1.99",
    "subnet": "255.255.255.0",
    "gateway": "192.168.1.1",
    "position": {"x": 500, "y": 500}
}]'::jsonb
WHERE id = '...';
```

### Example 7: Remove device from array

```sql
-- Remove device by index
UPDATE projects
SET devices = devices - 2  -- Remove index 2
WHERE id = '...';
```

### Example 8: Query VLAN configuration

```sql
-- Find all devices with VLAN 10
SELECT
    projects.name,
    device->>'label' AS device_label,
    device->'vlan' AS vlans
FROM projects,
     jsonb_array_elements(devices) AS device
WHERE device->'vlan' ? '10'  -- Contains VLAN 10
ORDER BY projects.name;
```

---

## 2.8 SQLite vs PostgreSQL

### Development: SQLite

**Pro**:
- ✅ Zero setup (file-based)
- ✅ Nessun server da configurare
- ✅ Portabile (file .db)
- ✅ Perfetto per test locali

**Contro**:
- ❌ JSON support limitato (no GIN index)
- ❌ Concurrent writes lente (database-level lock)
- ❌ No JSONB operators avanzati

**Setup SQLite**:
```python
# .env
DATABASE_URL=sqlite+aiosqlite:///./database.db

# alembic/env.py usa stessa logica
```

### Production: PostgreSQL

**Pro**:
- ✅ JSONB nativo con tutti gli operators
- ✅ GIN indexes per performance
- ✅ Concurrent writes eccellenti
- ✅ Full-text search built-in
- ✅ Scalabilità infinita

**Contro**:
- ❌ Richiede server PostgreSQL
- ❌ Setup più complesso

**Setup PostgreSQL**:
```python
# .env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/pixelcake

# Installa PostgreSQL 14+
# Crea database: CREATE DATABASE pixelcake;
```

### Migration Path

**Step 1**: Develop con SQLite
```bash
DATABASE_URL=sqlite+aiosqlite:///./database.db
alembic upgrade head
python main.py  # Test locally
```

**Step 2**: Export data da SQLite
```bash
# SQLite dump
sqlite3 database.db .dump > backup.sql
```

**Step 3**: Import in PostgreSQL
```bash
# Setup PostgreSQL database
createdb pixelcake

# Apply migrations
DATABASE_URL=postgresql+asyncpg://... alembic upgrade head

# Import data (manual o via script Python)
python scripts/migrate_sqlite_to_postgres.py
```

**Step 4**: Update production .env
```bash
DATABASE_URL=postgresql+asyncpg://user:password@prod-host:5432/pixelcake
```

---

## Summary

✅ **Schema completo** con 6 tabelle
✅ **JSONB hybrid** per flessibilità + performance
✅ **GIN indexes** per query JSONB veloci
✅ **Alembic migrations** per schema evolution
✅ **SQLite dev → PostgreSQL prod** path chiaro

### Next Steps

1. **[Struttura Backend](./03_backend_structure.md)** - Organizzazione cartelle
2. **[Modelli e Schemas](./04_models_and_schemas.md)** - SQLAlchemy ORM + Pydantic
3. **[Quick Start](./quick_start.md)** - Setup pratico database

---

**Domande Frequenti**

**Q: Quando creare index GIN vs B-tree?**
A: GIN per colonne JSONB, B-tree per colonne relazionali (VARCHAR, UUID, TIMESTAMP).

**Q: JSONB rallenta le query?**
A: No! Con GIN index, query su JSONB sono veloci quanto query su tabelle normalizzate. In alcuni casi anche più veloci (no JOIN necessari).

**Q: Come gestire schema evolution per JSONB?**
A: JSONB è schemaless - nuovi campi aggiunti senza migration. Se serve validation, usa Pydantic schemas nell'API layer.

**Q: Limite dimensioni JSONB?**
A: PostgreSQL supporta documenti JSONB fino a 1 GB. FlowMap tipico ~65 KB, quindi zero problemi anche con 100+ devices.
