# 5. API Reference e Autenticazione

## 📋 Indice
- [5.1 Panoramica API](#51-panoramica-api)
- [5.2 Autenticazione JWT](#52-autenticazione-jwt)
- [5.3 Auth Endpoints](#53-auth-endpoints)
- [5.4 Projects Endpoints](#54-projects-endpoints)
- [5.5 Templates Endpoints](#55-templates-endpoints)
- [5.6 Export/Import Endpoints](#56-exportimport-endpoints)

---

## 5.1 Panoramica API

### Base URL

```
Development: http://localhost:8000
Production: https://api.pixelcake.com
```

### Authentication

Tutti gli endpoint (tranne `/auth/register` e `/auth/login`) richiedono JWT token:

```http
Authorization: Bearer <your-jwt-token>
```

### Response Format

**Success**:
```json
{
  "id": "uuid",
  "data": {...}
}
```

**Error**:
```json
{
  "detail": "Error message"
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Success |
| 201 | Created - Resource created |
| 204 | No Content - Success, no body |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - No permission |
| 404 | Not Found - Resource not found |
| 422 | Validation Error - Pydantic validation failed |
| 500 | Internal Server Error |

---

## 5.2 Autenticazione JWT

### Security Utilities (`app/utils/security.py`)

```python
"""
Security Utilities
Password hashing and JWT token handling
"""

from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional

from app.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plain password against hashed password

    Args:
        plain_password: Plain text password
        hashed_password: Bcrypt hashed password

    Returns:
        bool: True if password matches
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash password using bcrypt

    Args:
        password: Plain text password

    Returns:
        str: Bcrypt hashed password
    """
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token

    Args:
        data: Payload data (must include 'sub' key with user_id)
        expires_delta: Optional custom expiration time

    Returns:
        str: Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode JWT token and extract user_id

    Args:
        token: JWT token string

    Returns:
        Optional[str]: User ID if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except JWTError:
        return None
```

---

### Dependencies (`app/utils/dependencies.py`)

```python
"""
FastAPI Dependencies
Reusable dependencies for routes
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.utils.security import decode_access_token

# OAuth2 scheme (extracts token from Authorization header)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token

    Args:
        token: JWT token from Authorization header
        db: Database session

    Returns:
        User: Current authenticated user

    Raises:
        HTTPException: 401 if token invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decode token
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    # Get user from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (can add additional checks here)

    Args:
        current_user: User from get_current_user

    Returns:
        User: Active user

    Raises:
        HTTPException: 400 if user inactive
    """
    # Example: check if user is_active field exists and is True
    # if not current_user.is_active:
    #     raise HTTPException(status_code=400, detail="Inactive user")

    return current_user
```

---

## 5.3 Auth Endpoints

### Router (`app/routers/auth.py`)

```python
"""
Auth Router
User registration and authentication endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.template import UserPreferences
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.utils.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register new user

    - **email**: Unique email address
    - **username**: Display name
    - **password**: Plain password (will be hashed)
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password
    )

    db.add(new_user)
    await db.flush()  # Get user.id without committing

    # Create default user preferences
    preferences = UserPreferences(
        user_id=new_user.id,
        preferences={
            "ui": {"darkMode": False, "theme": "pixelcake"},
            "locale": {"language": "it", "dateFormat": "DD/MM/YYYY", "unitSystem": "metric"}
        }
    )
    db.add(preferences)

    await db.commit()
    await db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
async def login(
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    """
    Login user and return JWT token

    - **email**: User email
    - **password**: User password

    Returns JWT access token
    """
    # Find user by email
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()

    # Verify credentials
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token = create_access_token(data={"sub": str(user.id)})

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user profile

    Requires valid JWT token in Authorization header
    """
    return current_user
```

---

### cURL Examples

**Register**:
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "John Doe",
    "password": "secure-password-123"
  }'
```

**Response**:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "username": "John Doe",
  "created_at": "2025-01-16T10:00:00Z",
  "updated_at": "2025-01-16T10:00:00Z"
}
```

**Login**:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure-password-123"
  }'
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJleHAiOjE3MDU0MDcyMDB9.xyz...",
  "token_type": "bearer"
}
```

**Get Current User**:
```bash
TOKEN="your-jwt-token-here"

curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5.4 Projects Endpoints

### Router (`app/routers/projects.py`)

```python
"""
Projects Router
CRUD endpoints for network topology projects
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem
from app.utils.dependencies import get_current_user

router = APIRouter()


@router.get("/", response_model=List[ProjectListItem])
async def get_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all projects for current user

    Query params:
    - **skip**: Number of projects to skip (pagination)
    - **limit**: Max number of projects to return
    """
    result = await db.execute(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    projects = result.scalars().all()

    # Transform to ProjectListItem with counts
    projects_list = []
    for project in projects:
        projects_list.append(ProjectListItem(
            id=project.id,
            name=project.name,
            version=project.version,
            is_public=project.is_public,
            device_count=len(project.devices) if project.devices else 0,
            connection_count=len(project.connections) if project.connections else 0,
            created_at=project.created_at,
            updated_at=project.updated_at,
            last_accessed=project.last_accessed
        ))

    return projects_list


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get single project by ID

    Returns full project data including devices and connections
    """
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Update last_accessed timestamp
    project.last_accessed = func.now()
    await db.commit()

    return project


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create new project

    - **name**: Project name
    - **settings**: Global network settings
    - **devices**: Array of NetworkDevice objects
    - **connections**: Array of NetworkConnection objects
    """
    # Create project
    new_project = Project(
        user_id=current_user.id,
        name=project_data.name,
        version=project_data.version,
        is_public=project_data.is_public,
        settings=project_data.settings.model_dump(),
        devices=[device.model_dump() for device in project_data.devices],
        connections=[conn.model_dump() for conn in project_data.connections]
    )

    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    return new_project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update existing project

    All fields are optional - only provided fields will be updated
    """
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Update fields if provided
    update_data = project_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field == "settings" and value is not None:
            setattr(project, field, value.model_dump())
        elif field == "devices" and value is not None:
            setattr(project, field, [device.model_dump() for device in value])
        elif field == "connections" and value is not None:
            setattr(project, field, [conn.model_dump() for conn in value])
        else:
            setattr(project, field, value)

    await db.commit()
    await db.refresh(project)

    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete project

    Permanently deletes project and all associated versions
    """
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    await db.delete(project)
    await db.commit()

    return None


@router.post("/{project_id}/duplicate", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Duplicate existing project

    Creates a copy with " (Copy)" appended to name
    """
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    original = result.scalar_one_or_none()

    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    # Create duplicate
    duplicate = Project(
        user_id=current_user.id,
        name=f"{original.name} (Copy)",
        version=original.version,
        is_public=False,  # Always private
        settings=original.settings,
        devices=original.devices,
        connections=original.connections
    )

    db.add(duplicate)
    await db.commit()
    await db.refresh(duplicate)

    return duplicate
```

---

### cURL Examples

**Get All Projects**:
```bash
TOKEN="your-jwt-token"

curl -X GET "http://localhost:8000/api/projects?skip=0&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Get Single Project**:
```bash
curl -X GET http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer $TOKEN"
```

**Create Project**:
```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Enterprise Network",
    "version": "1.0.0",
    "is_public": false,
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
  }'
```

**Update Project**:
```bash
curl -X PUT http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Network Name"
  }'
```

**Delete Project**:
```bash
curl -X DELETE http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer $TOKEN"
```

**Duplicate Project**:
```bash
curl -X POST http://localhost:8000/api/projects/123e4567-e89b-12d3-a456-426614174000/duplicate \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5.5 Templates Endpoints

**Status**: ✅ **IMPLEMENTATO** (v1.2 - Template Sync)

### Overview

Templates API gestisce i template di dispositivi e connessioni, sia globali (forniti dal sistema) che custom (creati dagli utenti). Include endpoint CRUD completi e bulk sync per migrazione da LocalStorage.

**Base Path**: `/api/templates`

### Device Templates Endpoints

#### GET `/api/templates/devices`

Ottieni tutti i device templates (globali + custom utente).

**Response**: `200 OK`
```json
[
  {
    "id": "d05f4182-fe67-4996-9c9e-5d69b0dc326d",
    "user_id": null,
    "is_custom": false,
    "template": {
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
    },
    "created_at": "2025-11-22T22:12:22"
  }
]
```

#### POST `/api/templates/devices`

Crea un nuovo device template custom.

**Request Body**:
```json
{
  "template": {
    "id": "tpl-custom-server",
    "name": "Custom Server",
    "type": "CustomServer",
    "icon": "mdi:server-plus",
    "color": "#FF5733",
    "isCustom": true,
    "supportsVLAN": false,
    "supportsSTP": false,
    "supportsPorts": false,
    "supportsNICs": true
  }
}
```

**Response**: `201 Created`

#### PUT `/api/templates/devices/{template_id}`

Aggiorna un device template custom esistente.

**Request Body**: Come POST

**Response**: `200 OK`

**Errors**:
- `403 Forbidden` - Tentativo di modificare template globale
- `404 Not Found` - Template non trovato

#### DELETE `/api/templates/devices/{template_id}`

Elimina un device template custom.

**Response**: `204 No Content`

**Errors**:
- `403 Forbidden` - Tentativo di eliminare template globale
- `404 Not Found` - Template non trovato

### Connection Templates Endpoints

#### GET `/api/templates/connections`

Ottieni tutti i connection templates (globali + custom utente).

**Response**: `200 OK`
```json
[
  {
    "id": "abf8cc76-ec26-4020-9f62-c543c180d562",
    "user_id": null,
    "is_custom": false,
    "template": {
      "id": "conn-trunk",
      "name": "Trunk",
      "type": "trunk",
      "description": "Link trunk tra switch",
      "color": "#9333ea",
      "lineStyle": "solid",
      "strokeWidth": 3.5,
      "strokeWidthHighlighted": 5.0,
      "isCustom": false
    },
    "created_at": "2025-11-22T22:12:22"
  }
]
```

#### POST `/api/templates/connections`

Crea un nuovo connection template custom.

**Request Body**:
```json
{
  "template": {
    "id": "conn-custom-fiber",
    "name": "Fiber Link",
    "type": "fiber",
    "description": "Collegamento in fibra ottica",
    "color": "#00FF00",
    "lineStyle": "solid",
    "strokeWidth": 4.0,
    "strokeWidthHighlighted": 6.0,
    "isCustom": true
  }
}
```

**Response**: `201 Created`

#### PUT `/api/templates/connections/{template_id}`

Aggiorna un connection template custom esistente.

#### DELETE `/api/templates/connections/{template_id}`

Elimina un connection template custom.

### Bulk Sync Endpoint

#### POST `/api/templates/sync`

Sincronizza tutti i template custom (upsert bulk). Usato per migrazione da LocalStorage.

**Request Body**:
```json
{
  "deviceTemplates": [
    {
      "id": "tpl-custom-1",
      "name": "Custom Device",
      "type": "CustomType",
      "icon": "mdi:device",
      "color": "#FF0000",
      "isCustom": true,
      "supportsVLAN": false,
      "supportsSTP": false,
      "supportsPorts": false,
      "supportsNICs": true
    }
  ],
  "connectionTemplates": [
    {
      "id": "conn-custom-1",
      "name": "Custom Connection",
      "type": "custom-type",
      "color": "#00FF00",
      "lineStyle": "dashed",
      "strokeWidth": 3.0,
      "isCustom": true
    }
  ]
}
```

**Response**: `200 OK`
```json
{
  "deviceTemplates": [
    {
      "id": "uuid-db-record",
      "user_id": "user-id",
      "is_custom": true,
      "template": {...},
      "created_at": "2025-11-22T22:30:00"
    }
  ],
  "connectionTemplates": [...],
  "message": "Synced 1 device templates and 1 connection templates"
}
```

**Note**: I template globali (`isCustom: false`) vengono automaticamente ignorati durante il sync.

### Template Seeding

Script di seed per popolare template globali di default:

```bash
cd backend
python -m scripts.seed_templates
```

**Template globali predefiniti**:
- **Device**: PC, Switch, Router, Server, Firewall, Access Point, Load Balancer, Database, Cloud (9 totali)
- **Connection**: Access, Trunk, Uplink, Backbone (4 totali)

### Implementation (`app/routers/templates.py`)

Router completo con 10 endpoint:
- 4 endpoint Device Templates (GET, POST, PUT, DELETE)
- 4 endpoint Connection Templates (GET, POST, PUT, DELETE)
- 1 endpoint List devices
- 1 endpoint List connections
- 1 endpoint Bulk sync

**Protezioni implementate**:
- Template globali (`is_custom=False`) sono read-only
- Solo l'owner può modificare/eliminare template custom
- Validazione Pydantic su tutti i dati template

### Frontend Integration

**Store**: `frontend/src/store/templateStore.ts`
- Auto-load da backend all'avvio (`loadFromBackend()`)
- Auto-sync su create/update/delete template custom
- LocalStorage come cache, backend database come source of truth

**API Client**: `frontend/src/api/templates.ts`
- 9 funzioni API mappate agli endpoint backend
- Type-safe con TypeScript interfaces da `types/api.ts`

---

## 5.6 Export/Import Endpoints

### Export Router Stub (`app/routers/export.py`)

```python
"""
Export Router
Export projects to various formats
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import json
import io

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.utils.dependencies import get_current_user

router = APIRouter()


@router.post("/json/{project_id}")
async def export_json(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export project as .pixelcake.json file"""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Build FlowMap
    flowmap = {
        "meta": {
            "name": project.name,
            "version": project.version,
            "created": project.created_at.isoformat(),
            "modified": project.updated_at.isoformat()
        },
        "nodes": project.devices,
        "edges": project.connections
    }

    # Create JSON file
    json_content = json.dumps(flowmap, indent=2)
    json_bytes = io.BytesIO(json_content.encode('utf-8'))

    return StreamingResponse(
        json_bytes,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{project.name}.pixelcake.json"'
        }
    )


@router.post("/terraform/{project_id}")
async def export_terraform(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export project as Terraform files (.zip)"""
    # TODO: Implement Terraform generation
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Terraform export coming soon"
    )
```

---

## Summary

✅ **JWT Authentication** completo con bcrypt
✅ **Auth endpoints** (register, login, me)
✅ **Projects CRUD** completo
✅ **Templates** endpoints stub
✅ **Export** endpoints stub
✅ **cURL examples** per testing

### Next Steps

1. **[Testing & Deployment](./06_testing_deployment.md)** - Testing e deployment
2. **[Quick Start](./quick_start.md)** - Setup pratico
3. **[Frontend Integration](./10_frontend_integration.md)** - Connetti frontend

---

**Domande Frequenti**

**Q: Come testare auth con Swagger UI?**
A: Click "Authorize" button, insert token nel campo "Value", click "Authorize". Tutti gli endpoint useranno il token automaticamente.

**Q: Token expiration - come gestire?**
A: Frontend deve catched 401 errors e fare re-login. Backend può implementare refresh tokens (futuro enhancement).

**Q: Come proteggere endpoint solo per admin?**
A: Aggiungi campo `is_admin` a User model, crea dependency `get_admin_user` che verifica il ruolo.
