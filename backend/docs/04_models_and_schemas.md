# 4. Modelli e Schemas

## 📋 Indice
- [4.1 SQLAlchemy Models](#41-sqlalchemy-models)
- [4.2 Pydantic Schemas](#42-pydantic-schemas)
- [4.3 Relazioni e Foreign Keys](#43-relazioni-e-foreign-keys)
- [4.4 JSONB Handling](#44-jsonb-handling)
- [4.5 Best Practices](#45-best-practices)

---

## 4.1 SQLAlchemy Models

### `app/models/user.py`

```python
"""
User Model
Handles user authentication and profile data
"""

from sqlalchemy import Column, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class User(Base):
    """User model for authentication"""

    __tablename__ = "users"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Authentication
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    device_templates = relationship("DeviceTemplate", back_populates="user", cascade="all, delete-orphan")
    connection_templates = relationship("ConnectionTemplate", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, username={self.username})>"
```

---

### `app/models/project.py`

```python
"""
Project Model
Stores network topology projects with JSONB columns
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class Project(Base):
    """Project model with JSONB hybrid approach"""

    __tablename__ = "projects"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Metadata
    name = Column(String(255), nullable=False)
    version = Column(String(50), default="1.0.0")
    is_public = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
    last_accessed = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # JSONB Columns (FlowMap data)
    settings = Column(
        JSONB,
        default={
            "ipClass": "192.168.1.0",
            "subnet": "255.255.255.0",
            "gateway": "192.168.1.1",
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "deviceCounter": 0,
            "connectionCounter": 0
        },
        nullable=False
    )
    devices = Column(JSONB, default=[], nullable=False)
    connections = Column(JSONB, default=[], nullable=False)

    # Relationships
    owner = relationship("User", back_populates="projects")
    versions = relationship("ProjectVersion", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, user_id={self.user_id})>"


class ProjectVersion(Base):
    """Project version history for undo/redo functionality"""

    __tablename__ = "project_versions"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)

    # Version info
    version_number = Column(Integer, nullable=False)

    # Snapshot (full project state)
    snapshot = Column(JSONB, nullable=False)

    # Timestamp
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    project = relationship("Project", back_populates="versions")

    def __repr__(self):
        return f"<ProjectVersion(id={self.id}, project_id={self.project_id}, version={self.version_number})>"
```

---

### `app/models/template.py`

```python
"""
Template Models
Device and Connection templates (global + custom)
"""

from sqlalchemy import Column, String, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database import Base


class DeviceTemplate(Base):
    """Device template model (global defaults + user custom)"""

    __tablename__ = "device_templates"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key (NULL for global templates)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Template metadata
    is_custom = Column(Boolean, default=True, index=True)

    # Template definition (full DeviceTemplate object)
    template = Column(JSONB, nullable=False)

    # Timestamp
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="device_templates")

    def __repr__(self):
        template_name = self.template.get("name", "Unknown") if self.template else "Unknown"
        return f"<DeviceTemplate(id={self.id}, name={template_name}, custom={self.is_custom})>"


class ConnectionTemplate(Base):
    """Connection template model (global defaults + user custom)"""

    __tablename__ = "connection_templates"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Foreign Key (NULL for global templates)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Template metadata
    is_custom = Column(Boolean, default=True, index=True)

    # Template definition (full ConnectionTemplate object)
    template = Column(JSONB, nullable=False)

    # Timestamp
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="connection_templates")

    def __repr__(self):
        template_name = self.template.get("name", "Unknown") if self.template else "Unknown"
        return f"<ConnectionTemplate(id={self.id}, name={template_name}, custom={self.is_custom})>"


class UserPreferences(Base):
    """User preferences (UI settings, language, etc.)"""

    __tablename__ = "user_preferences"

    # Primary Key (also Foreign Key)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    # Preferences (JSONB)
    preferences = Column(
        JSONB,
        default={
            "ui": {
                "darkMode": False,
                "theme": "pixelcake"
            },
            "locale": {
                "language": "it",
                "dateFormat": "DD/MM/YYYY",
                "unitSystem": "metric"
            }
        },
        nullable=False
    )

    # Timestamp
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="preferences")

    def __repr__(self):
        return f"<UserPreferences(user_id={self.user_id})>"
```

---

### `app/models/__init__.py`

```python
"""
Models package
Exports all SQLAlchemy models
"""

from app.models.user import User
from app.models.project import Project, ProjectVersion
from app.models.template import DeviceTemplate, ConnectionTemplate, UserPreferences

__all__ = [
    "User",
    "Project",
    "ProjectVersion",
    "DeviceTemplate",
    "ConnectionTemplate",
    "UserPreferences",
]
```

---

## 4.2 Pydantic Schemas

### `app/schemas/flowmap.py`

```python
"""
FlowMap Schemas
Pydantic models for network topology data structures
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal


# ============================================================================
# Port (Switch/Router/Firewall)
# ============================================================================

class Port(BaseModel):
    """Network port configuration"""

    id: int = Field(..., ge=1, le=48, description="Port number (1-48)")
    name: Optional[str] = Field(None, max_length=100, description="Custom port name")
    enabled: bool = Field(True, description="Port administratively enabled")
    speed: Optional[Literal["10M", "100M", "1G", "2.5G", "10G", "auto"]] = Field("auto", description="Link speed")

    # VLAN (Switch)
    vlan: Optional[int | List[int]] = Field(None, description="VLAN assignment")
    portType: Optional[Literal["access", "trunk", "wan", "lan", "dmz"]] = Field(None, description="Port type")
    poe: Optional[bool] = Field(None, description="Power over Ethernet")

    # Router
    nat: Optional[bool] = Field(None, description="NAT enabled (router only)")

    # Firewall
    securityZone: Optional[Literal["trust", "untrust", "dmz"]] = Field(None, description="Security zone")
    ips: Optional[bool] = Field(None, description="IPS/IDS enabled")

    description: Optional[str] = Field(None, max_length=500, description="Port description")

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "enabled": True,
                "speed": "1G",
                "portType": "access",
                "vlan": 10,
                "poe": True,
                "description": "PC VLAN 10"
            }
        }


# ============================================================================
# Network Interface Card (PC/Server/Database/Cloud)
# ============================================================================

class NetworkInterfaceCard(BaseModel):
    """Network Interface Card configuration"""

    id: str = Field(..., pattern=r"^nic-\d+$", description="NIC ID (nic-1, nic-2...)")
    name: str = Field(..., min_length=1, max_length=50, description="Interface name (eth0, eth1...)")
    enabled: bool = Field(True, description="NIC enabled")
    speed: Literal["10M", "100M", "1G", "2.5G", "10G", "auto"] = Field("auto", description="Link speed")

    ip: str = Field(..., pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", description="IP address")
    subnet: str = Field(..., pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", description="Subnet mask")
    gateway: str = Field(..., pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", description="Gateway")

    mac: Optional[str] = Field(None, pattern=r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$", description="MAC address")
    description: Optional[str] = Field(None, max_length=500, description="NIC description")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "nic-1",
                "name": "eth0",
                "enabled": True,
                "speed": "1G",
                "ip": "192.168.1.100",
                "subnet": "255.255.255.0",
                "gateway": "192.168.1.1",
                "mac": "02:a1:b2:c3:d4:e5",
                "description": "Primary network"
            }
        }


# ============================================================================
# STP Configuration
# ============================================================================

class STPConfig(BaseModel):
    """Spanning Tree Protocol configuration"""

    enabled: bool = Field(True, description="STP enabled")
    mode: Optional[Literal["STP", "RSTP", "PVST+", "MST"]] = Field("RSTP", description="STP mode")
    priority: Optional[int] = Field(32768, ge=0, le=65535, description="Bridge priority (0-65535, step 4096)")

    class Config:
        json_schema_extra = {
            "example": {
                "enabled": True,
                "mode": "RSTP",
                "priority": 4096
            }
        }


# ============================================================================
# Network Device
# ============================================================================

class Position(BaseModel):
    """Canvas position"""
    x: float
    y: float


class NetworkDevice(BaseModel):
    """Network device with full configuration"""

    # Identification
    id: str = Field(..., pattern=r"^dev-\d+$", description="Device ID")
    type: str = Field(..., min_length=1, max_length=50, description="Device type")
    label: str = Field(..., min_length=1, max_length=255, description="Device label")

    # Network (legacy - for backward compatibility)
    ip: str = Field(..., pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
    subnet: str = Field(..., pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
    gateway: str = Field(...)

    # Metadata
    vendor: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=255)

    # Position
    position: Position

    # Advanced Config
    vlan: Optional[List[int]] = Field(None, description="VLAN IDs")
    stp: Optional[STPConfig] = None

    # Ports (Switch/Router/Firewall)
    portCount: Optional[int] = Field(None, ge=1, le=48)
    ports: Optional[List[Port]] = None

    # NICs (PC/Server/Database/Cloud)
    nics: Optional[List[NetworkInterfaceCard]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "id": "dev-0",
                "type": "Switch",
                "label": "Core-Switch-HQ",
                "ip": "192.168.1.3",
                "subnet": "255.255.255.0",
                "gateway": "192.168.1.1",
                "vendor": "Cisco",
                "location": "HQ - Sala Server",
                "position": {"x": 200, "y": 400},
                "portCount": 24,
                "ports": [
                    {
                        "id": 1,
                        "enabled": True,
                        "speed": "10G",
                        "portType": "trunk",
                        "vlan": [1, 10, 20, 30]
                    }
                ]
            }
        }


# ============================================================================
# Network Connection
# ============================================================================

class NetworkConnection(BaseModel):
    """Network connection between devices"""

    id: str = Field(..., pattern=r"^conn-\d+$", description="Connection ID")
    source: str = Field(..., pattern=r"^dev-\d+$", description="Source device ID")
    target: str = Field(..., pattern=r"^dev-\d+$", description="Target device ID")
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

    # Connection metadata
    type: Optional[Literal["trunk", "access", "uplink", "backbone"]] = Field("access", description="Connection type")
    bandwidth: Optional[str] = Field(None, max_length=50, description="Bandwidth (e.g., 1Gbps)")
    vlan: Optional[List[int]] = Field(None, description="Tagged VLANs")
    label: Optional[str] = Field(None, max_length=255)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")

    # STP Port Config
    stpPortState: Optional[Literal["forwarding", "blocking", "disabled", "learning"]] = None
    stpPortPriority: Optional[int] = Field(None, ge=0, le=240, description="Port priority (0-240, step 16)")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "conn-0",
                "source": "dev-0",
                "target": "dev-1",
                "type": "uplink",
                "bandwidth": "10Gbps",
                "vlan": [1, 10]
            }
        }


# ============================================================================
# FlowMap
# ============================================================================

class FlowMapMeta(BaseModel):
    """FlowMap metadata"""
    name: str = Field(..., min_length=1, max_length=255)
    version: str = Field("1.0.0", pattern=r"^\d+\.\d+\.\d+$")
    created: Optional[str] = None
    modified: Optional[str] = None


class GlobalNetworkSettings(BaseModel):
    """Global network settings"""
    ipClass: str = Field("192.168.1.0", pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
    subnet: str = Field("255.255.255.0", pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
    gateway: str = Field("192.168.1.1", pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
    viewport: Optional[dict] = Field({"x": 0, "y": 0, "zoom": 1})
    deviceCounter: int = Field(0, ge=0)
    connectionCounter: int = Field(0, ge=0)


class FlowMap(BaseModel):
    """Complete FlowMap structure"""
    meta: FlowMapMeta
    nodes: List[NetworkDevice]
    edges: List[NetworkConnection]
```

---

### `app/schemas/project.py`

```python
"""
Project Schemas
Pydantic models for project CRUD operations
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from app.schemas.flowmap import NetworkDevice, NetworkConnection, GlobalNetworkSettings


# ============================================================================
# Project Create
# ============================================================================

class ProjectCreate(BaseModel):
    """Schema for creating a new project"""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    version: Optional[str] = Field("1.0.0", pattern=r"^\d+\.\d+\.\d+$", description="Semantic version")
    is_public: bool = Field(False, description="Public project flag")

    settings: GlobalNetworkSettings = Field(
        default_factory=lambda: GlobalNetworkSettings(
            ipClass="192.168.1.0",
            subnet="255.255.255.0",
            gateway="192.168.1.1",
            viewport={"x": 0, "y": 0, "zoom": 1},
            deviceCounter=0,
            connectionCounter=0
        )
    )
    devices: List[NetworkDevice] = Field(default_factory=list)
    connections: List[NetworkConnection] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "My Enterprise Network",
                "version": "1.0.0",
                "is_public": False,
                "settings": {
                    "ipClass": "192.168.1.0",
                    "subnet": "255.255.255.0",
                    "gateway": "192.168.1.1",
                    "viewport": {"x": 0, "y": 0, "zoom": 1},
                    "deviceCounter": 0,
                    "connectionCounter": 0
                },
                "devices": [],
                "connections": []
            }
        }


# ============================================================================
# Project Update
# ============================================================================

class ProjectUpdate(BaseModel):
    """Schema for updating a project (all fields optional)"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    version: Optional[str] = Field(None, pattern=r"^\d+\.\d+\.\d+$")
    is_public: Optional[bool] = None

    settings: Optional[GlobalNetworkSettings] = None
    devices: Optional[List[NetworkDevice]] = None
    connections: Optional[List[NetworkConnection]] = None


# ============================================================================
# Project Response
# ============================================================================

class ProjectResponse(BaseModel):
    """Schema for project response (includes auto-generated fields)"""

    id: UUID
    user_id: UUID
    name: str
    version: str
    is_public: bool

    settings: GlobalNetworkSettings
    devices: List[NetworkDevice]
    connections: List[NetworkConnection]

    created_at: datetime
    updated_at: datetime
    last_accessed: datetime

    class Config:
        from_attributes = True  # Enable ORM mode


# ============================================================================
# Project List Item (lighter response for list endpoints)
# ============================================================================

class ProjectListItem(BaseModel):
    """Lightweight project info for list endpoints"""

    id: UUID
    name: str
    version: str
    is_public: bool
    device_count: int = Field(..., description="Number of devices")
    connection_count: int = Field(..., description="Number of connections")
    created_at: datetime
    updated_at: datetime
    last_accessed: datetime

    class Config:
        from_attributes = True
```

---

### `app/schemas/user.py`

```python
"""
User Schemas
Pydantic models for user authentication and profile
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


# ============================================================================
# User Registration
# ============================================================================

class UserCreate(BaseModel):
    """Schema for user registration"""

    email: EmailStr = Field(..., description="User email (used for login)")
    username: str = Field(..., min_length=1, max_length=100, description="Display name")
    password: str = Field(..., min_length=8, max_length=100, description="Password (min 8 chars)")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "username": "John Doe",
                "password": "secure-password-123"
            }
        }


# ============================================================================
# User Login
# ============================================================================

class UserLogin(BaseModel):
    """Schema for user login"""

    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., description="Password")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "secure-password-123"
            }
        }


# ============================================================================
# JWT Token
# ============================================================================

class Token(BaseModel):
    """JWT token response"""

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type")

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }


class TokenData(BaseModel):
    """JWT token payload data"""

    user_id: Optional[UUID] = None


# ============================================================================
# User Response
# ============================================================================

class UserResponse(BaseModel):
    """Schema for user profile response"""

    id: UUID
    email: str
    username: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Enable ORM mode
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "user@example.com",
                "username": "John Doe",
                "created_at": "2025-01-16T10:00:00Z",
                "updated_at": "2025-01-16T10:00:00Z"
            }
        }


# ============================================================================
# User Update
# ============================================================================

class UserUpdate(BaseModel):
    """Schema for updating user profile"""

    username: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=100)
```

---

### `app/schemas/template.py`

```python
"""
Template Schemas
Pydantic models for device and connection templates
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
from uuid import UUID


# ============================================================================
# Device Template
# ============================================================================

class DeviceTemplateData(BaseModel):
    """Device template definition"""

    id: str
    name: str
    type: str
    icon: str = Field(..., description="Iconify icon name")
    color: str = Field(..., pattern=r"^#[0-9A-Fa-f]{6}$")

    terraformFields: Optional[dict] = None
    isCustom: bool

    supportsVLAN: bool
    supportsSTP: bool
    supportsPorts: bool
    supportsNICs: bool

    portOptions: Optional[List[int]] = None
    defaultPortCount: Optional[int] = None


class DeviceTemplateCreate(BaseModel):
    """Schema for creating device template"""

    template: DeviceTemplateData


class DeviceTemplateResponse(BaseModel):
    """Schema for device template response"""

    id: UUID
    user_id: Optional[UUID]
    is_custom: bool
    template: DeviceTemplateData
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Connection Template
# ============================================================================

class ConnectionTemplateData(BaseModel):
    """Connection template definition"""

    id: str
    name: str
    type: str
    description: Optional[str] = None

    color: str = Field(..., pattern=r"^#[0-9A-Fa-f]{6}$")
    lineStyle: Literal["solid", "dashed", "dotted"]
    strokeWidth: float = Field(..., ge=0.5, le=10)
    strokeWidthHighlighted: Optional[float] = None
    strokeDasharray: Optional[str] = None

    isCustom: bool


class ConnectionTemplateCreate(BaseModel):
    """Schema for creating connection template"""

    template: ConnectionTemplateData


class ConnectionTemplateResponse(BaseModel):
    """Schema for connection template response"""

    id: UUID
    user_id: Optional[UUID]
    is_custom: bool
    template: ConnectionTemplateData
    created_at: datetime

    class Config:
        from_attributes = True
```

---

### `app/schemas/__init__.py`

```python
"""
Schemas package
Exports all Pydantic schemas
"""

from app.schemas.flowmap import (
    Port,
    NetworkInterfaceCard,
    STPConfig,
    Position,
    NetworkDevice,
    NetworkConnection,
    FlowMapMeta,
    GlobalNetworkSettings,
    FlowMap,
)
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListItem,
)
from app.schemas.user import (
    UserCreate,
    UserLogin,
    Token,
    TokenData,
    UserResponse,
    UserUpdate,
)
from app.schemas.template import (
    DeviceTemplateData,
    DeviceTemplateCreate,
    DeviceTemplateResponse,
    ConnectionTemplateData,
    ConnectionTemplateCreate,
    ConnectionTemplateResponse,
)

__all__ = [
    # FlowMap
    "Port",
    "NetworkInterfaceCard",
    "STPConfig",
    "Position",
    "NetworkDevice",
    "NetworkConnection",
    "FlowMapMeta",
    "GlobalNetworkSettings",
    "FlowMap",
    # Project
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ProjectListItem",
    # User
    "UserCreate",
    "UserLogin",
    "Token",
    "TokenData",
    "UserResponse",
    "UserUpdate",
    # Template
    "DeviceTemplateData",
    "DeviceTemplateCreate",
    "DeviceTemplateResponse",
    "ConnectionTemplateData",
    "ConnectionTemplateCreate",
    "ConnectionTemplateResponse",
]
```

---

## 4.3 Relazioni e Foreign Keys

### Diagram Relazioni

```
User (1) -----> (*) Project
     (1) -----> (*) DeviceTemplate
     (1) -----> (*) ConnectionTemplate
     (1) -----> (1) UserPreferences

Project (1) -----> (*) ProjectVersion
```

### Cascade Delete

Tutte le relazioni usano `CASCADE` delete:
- Delete User → Delete tutti i Projects, Templates, Preferences
- Delete Project → Delete tutti i ProjectVersions

```python
# In SQLAlchemy Model
user_id = Column(UUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

# In relationship
projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
```

---

## 4.4 JSONB Handling

### Serialize to JSONB

```python
from sqlalchemy import select
from app.models import Project
from app.schemas import ProjectCreate

async def create_project(db: AsyncSession, project_data: ProjectCreate, user_id: UUID):
    # Pydantic schema automaticamente convertito a dict per JSONB
    new_project = Project(
        user_id=user_id,
        name=project_data.name,
        version=project_data.version,
        settings=project_data.settings.model_dump(),  # Pydantic → dict
        devices=[device.model_dump() for device in project_data.devices],
        connections=[conn.model_dump() for conn in project_data.connections],
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    return new_project
```

### Deserialize from JSONB

```python
from app.schemas import ProjectResponse, NetworkDevice, NetworkConnection

async def get_project(db: AsyncSession, project_id: UUID):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        return None

    # JSONB dict automaticamente validato da Pydantic
    return ProjectResponse.model_validate(project)
```

---

## 4.5 Best Practices

### ✅ DO

1. **Usa `from_attributes = True`** per ORM mode
```python
class ProjectResponse(BaseModel):
    class Config:
        from_attributes = True  # Permette SQLAlchemy model → Pydantic
```

2. **Valida input con Field()**
```python
email: EmailStr = Field(..., description="User email")
password: str = Field(..., min_length=8, max_length=100)
```

3. **Usa type hints precisi**
```python
speed: Literal["10M", "100M", "1G", "2.5G", "10G", "auto"]
```

4. **Separa Create/Update/Response schemas**
```python
UserCreate  # Solo campi obbligatori per creazione
UserUpdate  # Tutti campi opzionali
UserResponse  # Include campi auto-generati (id, timestamps)
```

### ❌ DON'T

1. **Non esporre hashed_password**
```python
class UserResponse(BaseModel):
    # NO: hashed_password: str
    pass
```

2. **Non usare Any per JSONB**
```python
# NO: devices: Any
devices: List[NetworkDevice]  # Type-safe
```

3. **Non duplicare validation logic**
```python
# Use Pydantic validators, not custom functions
```

---

## Summary

✅ **SQLAlchemy models** completi (User, Project, Template)
✅ **Pydantic schemas** type-safe per validation
✅ **JSONB handling** automatico con Pydantic
✅ **Relazioni CASCADE** per data integrity
✅ **Best practices** per production-ready code

### Next Steps

1. **[API Reference](./05_api_reference.md)** - Implementa endpoints
2. **[Authentication](./06_authentication.md)** - JWT auth system
3. **[Quick Start](./quick_start.md)** - Test pratico

---

**Domande Frequenti**

**Q: Perché usare `from_attributes = True` invece di `orm_mode = True`?**
A: Pydantic v2 ha rinominato `orm_mode` in `from_attributes`. Usa la sintassi nuova per compatibilità.

**Q: Come validare JSONB nested objects?**
A: Usa Pydantic nested models. Esempio: `settings: GlobalNetworkSettings` valida automaticamente tutto il JSON.

**Q: Come gestire NULL values in JSONB?**
A: Usa `Optional[...]` nei Pydantic schemas. SQLAlchemy inserisce `null` nel JSONB se valore è None.
